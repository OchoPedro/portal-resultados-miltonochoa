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

async function getIntentos(ip) {
  const { data } = await adminSupabase
    .from('login_attempts')
    .select('intentos, bloqueado_hasta')
    .eq('ip', ip)
    .single()
  return data || { intentos: 0, bloqueado_hasta: null }
}

async function registrarFallo(ip, intentosActuales) {
  const nuevos = intentosActuales + 1
  const bloqueado_hasta = nuevos >= MAX_INTENTOS
    ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
    : null
  await adminSupabase.from('login_attempts').upsert({ ip, intentos: nuevos, bloqueado_hasta })
}

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

  const { usuario, password } = req.body || {}
  if (!usuario || !password) return res.status(400).json({ ok: false })
  if (password.length > 128) return res.status(400).json({ ok: false })

  const ip = req.headers['x-real-ip']
    || req.headers['x-forwarded-for']?.split(',').pop()?.trim()
    || req.socket?.remoteAddress || 'unknown'

  const estado = await getIntentos(ip)
  if (estado.bloqueado_hasta && new Date(estado.bloqueado_hasta) > new Date()) {
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

  await registrarFallo(ip, estado.intentos || 0)
  const intentosRestantes = MAX_INTENTOS - (estado.intentos || 0) - 1
  const bloqueado = intentosRestantes <= 0

  return res.status(200).json({
    ok: false,
    blocked: bloqueado,
    intentosRestantes: bloqueado ? 0 : intentosRestantes,
  })
}
