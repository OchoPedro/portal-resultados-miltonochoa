import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import { signUserJWT } from './_jwt.js'

export const config = { maxDuration: 30 }

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ORIGINS = [
  'https://portal-resultados-miltonochoa.vercel.app',
  'https://resultados.aamocolombia.com',
]
const isAllowed = (o) =>
  ALLOWED_ORIGINS.includes(o) ||
  /^https:\/\/portal-resultados-miltonochoa-[a-z0-9-]+\.vercel\.app$/.test(o)

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

async function _otpBlocked(adminId) {
  try {
    const { data } = await adminSupabase
      .from('login_attempts')
      .select('bloqueado_hasta')
      .eq('ip', `otp:${adminId}`)
      .single()
    if (!data?.bloqueado_hasta) return false
    if (new Date(data.bloqueado_hasta) > new Date()) return true
    await adminSupabase.from('login_attempts').update({ intentos: 0, bloqueado_hasta: null }).eq('ip', `otp:${adminId}`)
    return false
  } catch { return false }
}

async function _otpFail(adminId) {
  try {
    const { data } = await adminSupabase.from('login_attempts').select('intentos').eq('ip', `otp:${adminId}`).single()
    const intentos = (data?.intentos || 0) + 1
    const bloqueado_hasta = intentos >= 5 ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null
    await adminSupabase.from('login_attempts').upsert({ ip: `otp:${adminId}`, intentos: bloqueado_hasta ? 0 : intentos, bloqueado_hasta })
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

  const { adminId, code } = req.body || {}
  if (!adminId || !code)
    return res.status(400).json({ error: 'Faltan datos requeridos.' })

  try {
    if (await _otpBlocked(adminId))
      return res.status(429).json({ error: 'Demasiados intentos. Espera 10 minutos.' })

    // Buscar OTP válido
    const { data: otp, error } = await adminSupabase
      .from('admin_otp')
      .select('*')
      .eq('admin_id', adminId)
      .eq('code', code.trim())
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !otp) {
      await _otpFail(adminId)
      return res.status(401).json({ error: 'Código incorrecto o expirado.' })
    }

    adminSupabase.from('login_attempts').delete().eq('ip', `otp:${adminId}`).then(null, () => {})

    // Marcar OTP como usado
    await adminSupabase.from('admin_otp').update({ used: true }).eq('id', otp.id)

    // Obtener datos del admin
    const { data: admin } = await adminSupabase
      .from('administradores')
      .select('id, nombre, usuario, activo, modulos, email, ultima_sesion')
      .eq('id', adminId)
      .eq('activo', true)
      .single()

    if (!admin)
      return res.status(401).json({ error: 'Administrador no encontrado.' })

    // Generar token de dispositivo confiable (30 días)
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString()

    await adminSupabase.from('trusted_devices').insert({
      admin_id: adminId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })

    const userResult = { role: 'admin', data: admin }
    const token = await signUserJWT(userResult)

    // Emitir ambas cookies httpOnly en una sola cabecera
    res.setHeader('Set-Cookie', [
      `mo_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`,
      `mo_trusted_device=${rawToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}`,
    ])

    return res.status(200).json({ user: userResult })
  } catch (e) {
    console.error('[verify-otp] error:', e.message)
    return res.status(500).json({ error: 'Error interno' })
  }
}
