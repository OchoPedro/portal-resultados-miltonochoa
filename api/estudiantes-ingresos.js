import { createClient } from '@supabase/supabase-js'
import { verifyJWT } from './_jwt.js'

export const config = { maxDuration: 10 }

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

function parseCookie(str, name) {
  const m = str.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return m ? m[1] : null
}

export default async function handler(req, res) {
  const origin = req.headers['origin'] || ''
  const allowed = isAllowed(origin)
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : ALLOWED_ORIGINS[0])
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).end()

  const sessionToken = parseCookie(req.headers.cookie || '', 'mo_session')
  if (!sessionToken) return res.status(401).json({ error: 'No session' })

  try {
    const payload = await verifyJWT(sessionToken)
    if (payload.app_role !== 'colegio') return res.status(403).json({ error: 'Forbidden' })

    const { data: estudiantes } = await adminSupabase
      .from('estudiantes')
      .select('usuario')
      .eq('colegio_id', payload.sub)
    const usuarios = (estudiantes || []).map(e => e.usuario).filter(Boolean)
    if (!usuarios.length) return res.status(200).json({ ingresos: {} })

    const { data: logs } = await adminSupabase
      .from('sesiones_log')
      .select('usuario')
      .eq('rol', 'estudiante')
      .eq('accion', 'login')
      .in('usuario', usuarios)

    const ingresos = {}
    for (const row of logs || []) {
      ingresos[row.usuario] = (ingresos[row.usuario] || 0) + 1
    }
    return res.status(200).json({ ingresos })
  } catch {
    return res.status(401).json({ error: 'Session expired' })
  }
}
