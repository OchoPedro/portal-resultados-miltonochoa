import { createClient } from '@supabase/supabase-js'
import { verifyJWT, signUserJWT } from './_jwt.js'

export const config = { maxDuration: 10 }

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') return res.status(204).end()
  // GET same-origin no envía header Origin → permitir Origin ausente.
  // Solo se bloquea un Origin PRESENTE y no permitido (cross-origin malicioso).
  // La cookie es SameSite=Strict, así que no viaja cross-site de todos modos.
  if (origin && !allowed) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'GET') return res.status(405).end()

  const sessionToken = parseCookie(req.headers.cookie || '', 'mo_session')
  if (!sessionToken) return res.status(401).json({ error: 'No session' })

  try {
    const payload = await verifyJWT(sessionToken)
    const appRole = payload.app_role

    let userResult
    if (appRole === 'admin') {
      const { data } = await adminSupabase
        .from('administradores')
        .select('id, nombre, usuario, activo, modulos, email, ultima_sesion')
        .eq('id', payload.sub)
        .eq('activo', true)
        .single()
      if (!data) throw new Error('not found')
      userResult = { role: 'admin', data }
    } else if (appRole === 'colegio') {
      const { data } = await adminSupabase
        .from('colegios')
        .select('id, nombre, usuario, activo, ciudad, municipio, departamento_nombre, contactos, ultima_sesion')
        .eq('id', payload.sub)
        .eq('activo', true)
        .single()
      if (!data) throw new Error('not found')
      userResult = { role: 'colegio', data }
    } else if (appRole === 'estudiante') {
      const { data } = await adminSupabase
        .from('estudiantes')
        .select('id, nombre, usuario, activo, grado, salon, colegio_id, ultima_sesion, colegios(nombre, ciudad)')
        .eq('id', payload.sub)
        .eq('activo', true)
        .single()
      if (!data) throw new Error('not found')
      userResult = { role: 'estudiante', data }
    } else {
      throw new Error('invalid role')
    }

    const token = await signUserJWT(userResult)
    return res.status(200).json({ token, user: userResult })
  } catch {
    res.setHeader('Set-Cookie',
      'mo_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
    )
    return res.status(401).json({ error: 'Session expired' })
  }
}
