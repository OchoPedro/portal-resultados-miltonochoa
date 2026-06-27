import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { verifyJWT } from './_jwt.js'

export const config = { maxDuration: 5 }

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ORIGINS = [
  'https://portal-resultados-miltonochoa.vercel.app',
  'https://resultados.aamocolombia.com',
]
const isAllowed = (o) => ALLOWED_ORIGINS.includes(o)

function parseCookie(str, name) {
  const m = str.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return m ? m[1] : null
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

  // Registrar logout en sesiones_log (no bloqueante)
  try {
    const token = parseCookie(req.headers.cookie || '', 'mo_session')
    if (token) {
      const payload = await verifyJWT(token)
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
      adminSupabase.from('sesiones_log').insert({
        usuario: String(payload.sub),
        rol: payload.app_role,
        ip,
        user_agent: req.headers['user-agent'] || '',
        accion: 'logout',
      }).then(null, () => {})
    }
  } catch {}

  // Invalidar trusted_device en DB para que el token físico ya no sirva (no bloqueante)
  const rawTrusted = parseCookie(req.headers.cookie || '', 'mo_trusted_device')
  if (rawTrusted) {
    const tokenHash = createHash('sha256').update(rawTrusted).digest('hex')
    adminSupabase.from('trusted_devices').delete().eq('token_hash', tokenHash).then(null, () => {})
  }

  res.setHeader('Set-Cookie', [
    'mo_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
    'mo_trusted_device=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
  ])
  return res.status(200).json({ ok: true })
}
