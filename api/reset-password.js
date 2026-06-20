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
const isAllowed = (o) =>
  ALLOWED_ORIGINS.includes(o) ||
  /^https:\/\/portal-resultados-miltonochoa-[a-z0-9-]+\.vercel\.app$/.test(o)

export default async function handler(req, res) {
  const origin = req.headers['origin'] || ''
  const allowed = isAllowed(origin)
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : ALLOWED_ORIGINS[0])
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST') return res.status(405).end()

  const { usuario, codigo, nueva_password } = req.body || {}
  if (!usuario || !codigo || !nueva_password)
    return res.status(400).json({ error: 'Faltan datos requeridos.' })

  if (nueva_password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' })

  try {
    // Buscar reset válido
    const tokenHash = createHash('sha256').update(codigo.trim()).digest('hex')
    const { data: reset, error } = await adminSupabase
      .from('password_resets')
      .select('usuario, tabla, expires_at, used')
      .eq('usuario', usuario.trim().toLowerCase())
      .eq('token', tokenHash)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !reset)
      return res.status(400).json({ error: 'Código inválido o expirado.' })

    if (!['administradores', 'colegios'].includes(reset.tabla))
      return res.status(400).json({ error: 'Solicitud inválida' })

    // Hashear nueva contraseña
    const password_hash = await bcrypt.hash(nueva_password, 12)

    // Actualizar password en la tabla correspondiente
    await adminSupabase
      .from(reset.tabla)
      .update({ password_hash })
      .eq('usuario', reset.usuario)

    // Marcar reset como usado
    await adminSupabase
      .from('password_resets')
      .update({ used: true })
      .eq('id', reset.id)

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[reset-password] error:', e.message)
    return res.status(500).json({ error: 'Error interno' })
  }
}
