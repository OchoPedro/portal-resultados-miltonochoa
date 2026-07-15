import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { randomUUID } from 'crypto'

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ORIGINS = [
  'https://aamocolombia.com',
  'https://www.aamocolombia.com',
  'https://miltonochoa-web.vercel.app',
]

const MAX_INTENTOS = 5

async function limpiarIntentos(ip) {
  await adminSupabase.from('login_attempts').upsert({ ip, intentos: 0, bloqueado_hasta: null })
}

// Token de un solo uso — válido 60 segundos, registrado en DB para invalidación tras primer uso
async function generarLoginToken(userId, role) {
  const jti = randomUUID()
  const expiresAt = new Date(Date.now() + 70 * 1000).toISOString() // 10s de gracia sobre el TTL del JWT
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
  const token = await new SignJWT({ sub: userId, role, aud: 'login-redirect', jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(secret)

  await adminSupabase.from('login_tokens').insert({ jti, expires_at: expiresAt })

  return token
}

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const allowed = ALLOWED_ORIGINS.includes(origin)
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : ALLOWED_ORIGINS[0])
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!allowed) return res.status(403).json({ ok: false })
  if (req.method !== 'POST') return res.status(405).json({ ok: false })
  if (req.headers['content-type']?.split(';')[0]?.trim() !== 'application/json')
    return res.status(415).json({ ok: false })

  const { usuario, password } = req.body || {}
  if (!usuario || !password) return res.status(400).json({ ok: false })
  if (password.length > 128) return res.status(400).json({ ok: false })

  const ip = req.headers['x-real-ip']
    || req.headers['x-forwarded-for']?.split(',').pop()?.trim()
    || req.socket?.remoteAddress || 'unknown'

  const { data: bloqueadoAhora } = await adminSupabase.rpc('rl_check', { p_key: ip })
  if (bloqueadoAhora === true) {
    return res.status(200).json({ ok: false, blocked: true })
  }

  const tablas = [
    { nombre: 'colegios',    role: 'colegio'     },
    { nombre: 'estudiantes', role: 'estudiante'  },
  ]

  for (const { nombre, role } of tablas) {
    const { data } = await adminSupabase
      .from(nombre)
      .select('id, password_hash')
      .eq('usuario', usuario.trim())
      .eq('activo', true)
      .limit(1)
      .single()

    if (data?.password_hash?.startsWith('$2')) {
      const match = await bcrypt.compare(password, data.password_hash)
      if (match) {
        await limpiarIntentos(ip)
        const loginToken = await generarLoginToken(String(data.id), role)
        return res.status(200).json({ ok: true, loginToken })
      }
    }
  }

  // Puerta temporal: credenciales de un contrato (p. ej. Gobernación de Santander) que
  // caducan por fecha. MISMA lógica que /api/auth — la credencial temporal NO es una
  // identidad nueva, apunta al colegio/estudiante REAL, así que el token de login se emite
  // con la identidad real y la sesión resultante es idéntica a la del código permanente.
  // Sin esto, el código del contrato entra directo al portal (auth.js) pero era rechazado
  // desde el formulario de la web (que pasa por este endpoint).
  {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    const { data: temp } = await adminSupabase
      .from('credenciales_temporales')
      .select('colegio_id, estudiante_id, password_hash')
      .eq('usuario_temp', usuario.trim())
      .eq('activo', true)
      .lte('vigente_desde', hoy)
      .gte('vigente_hasta', hoy)
      .maybeSingle()

    if (temp?.password_hash?.startsWith('$2') && await bcrypt.compare(password, temp.password_hash)) {
      let real = null
      if (temp.colegio_id) {
        const { data: colegio } = await adminSupabase
          .from('colegios').select('id').eq('id', temp.colegio_id).eq('activo', true).single()
        if (colegio) real = { id: colegio.id, role: 'colegio' }
      } else if (temp.estudiante_id) {
        const { data: est } = await adminSupabase
          .from('estudiantes').select('id').eq('id', temp.estudiante_id).eq('activo', true).single()
        if (est) real = { id: est.id, role: 'estudiante' }
      }
      if (real) {
        await limpiarIntentos(ip)
        const loginToken = await generarLoginToken(String(real.id), real.role)
        return res.status(200).json({ ok: true, loginToken })
      }
    }
  }

  // Conteo atómico vía RPC; rl_fail devuelve el nº de intentos acumulado
  const { data: intentos } = await adminSupabase.rpc('rl_fail', { p_key: ip, p_max: MAX_INTENTOS, p_window_min: 15 })
  const restantes = Math.max(0, MAX_INTENTOS - (intentos || MAX_INTENTOS))

  return res.status(200).json({
    ok: false,
    blocked: restantes <= 0,
    intentosRestantes: restantes,
  })
}
