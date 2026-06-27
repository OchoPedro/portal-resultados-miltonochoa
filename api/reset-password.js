import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'

export const config = { maxDuration: 30 }

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ORIGINS = [
  'https://portal-resultados-miltonochoa.vercel.app',
  'https://resultados.aamocolombia.com',
]
const isAllowed = (o) => ALLOWED_ORIGINS.includes(o)

// Rate limiting del intento de adivinar el código (brute-force del OTP de 6 dígitos).
// Se cuenta por usuario: 5 intentos fallidos → bloqueo 1 hora.
async function _rpBlocked(key) {
  try {
    const { data } = await adminSupabase.from('login_attempts').select('bloqueado_hasta').eq('ip', `rp:${key}`).single()
    if (!data?.bloqueado_hasta) return false
    return new Date(data.bloqueado_hasta) > new Date()
  } catch { return false }
}
async function _rpFail(key) {
  try {
    const { data } = await adminSupabase.from('login_attempts').select('intentos').eq('ip', `rp:${key}`).single()
    const intentos = (data?.intentos || 0) + 1
    const bloqueado_hasta = intentos >= 5 ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null
    await adminSupabase.from('login_attempts').upsert({ ip: `rp:${key}`, intentos: bloqueado_hasta ? 0 : intentos, bloqueado_hasta })
  } catch {}
}

export default async function handler(req, res) {
  const origin = req.headers['origin'] || ''
  const allowed = isAllowed(origin)
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : ALLOWED_ORIGINS[0])
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST') return res.status(405).end()
  if (req.headers['content-type']?.split(';')[0]?.trim() !== 'application/json')
    return res.status(415).json({ error: 'Content-Type debe ser application/json' })

  const { usuario, codigo, nueva_password } = req.body || {}
  if (typeof usuario !== 'string' || typeof codigo !== 'string' || typeof nueva_password !== 'string')
    return res.status(400).json({ error: 'Faltan datos requeridos.' })
  if (!usuario || !codigo || !nueva_password)
    return res.status(400).json({ error: 'Faltan datos requeridos.' })

  if (nueva_password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' })
  if (nueva_password.length > 128)
    return res.status(400).json({ error: 'La contraseña no puede superar 128 caracteres.' })

  const userKey = usuario.trim().toLowerCase()

  try {
    if (await _rpBlocked(userKey))
      return res.status(429).json({ error: 'Demasiados intentos. Espera una hora.' })

    const tokenHash = createHash('sha256').update(codigo.trim()).digest('hex')

    // UPDATE atómico: consumir el token y devolver datos en una sola operación
    const { data: consumed, error } = await adminSupabase
      .from('password_resets')
      .update({ used: true })
      .eq('usuario', userKey)
      .eq('token', tokenHash)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .select('tabla, usuario')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !consumed || consumed.length === 0) {
      await _rpFail(userKey)
      return res.status(400).json({ error: 'Código inválido o expirado.' })
    }

    const reset = consumed[0]
    if (!['administradores', 'colegios'].includes(reset.tabla))
      return res.status(400).json({ error: 'Solicitud inválida' })

    // Hashear nueva contraseña
    const password_hash = await bcrypt.hash(nueva_password, 12)

    // Actualizar password en la tabla correspondiente
    await adminSupabase
      .from(reset.tabla)
      .update({ password_hash })
      .eq('usuario', reset.usuario)

    // Limpiar el contador de intentos tras éxito
    adminSupabase.from('login_attempts').delete().eq('ip', `rp:${userKey}`).then(null, () => {})

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[reset-password] error:', e.message)
    return res.status(500).json({ error: 'Error interno' })
  }
}
