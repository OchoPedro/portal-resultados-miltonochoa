import { createClient } from '@supabase/supabase-js'
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

  const { adminId, code } = req.body || {}
  if (!adminId || !code)
    return res.status(400).json({ error: 'Faltan datos requeridos.' })

  try {
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

    if (error || !otp)
      return res.status(401).json({ error: 'Código incorrecto o expirado.' })

    // Marcar OTP como usado
    await adminSupabase
      .from('admin_otp')
      .update({ used: true })
      .eq('id', otp.id)

    // Obtener datos del admin
    const { data: admin } = await adminSupabase
      .from('administradores')
      .select('id, nombre, usuario, activo, modulos, email, ultima_sesion')
      .eq('id', adminId)
      .eq('activo', true)
      .single()

    if (!admin)
      return res.status(401).json({ error: 'Administrador no encontrado.' })

    const userResult = { role: 'admin', data: admin }
    const token = await signUserJWT(userResult)

    return res.status(200).json({ token, user: userResult })
  } catch (e) {
    console.error('[verify-otp] error:', e.message)
    return res.status(500).json({ error: 'Error interno' })
  }
}
