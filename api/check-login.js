import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'

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
    ? new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString()
    : null
  await adminSupabase.from('login_attempts').upsert({ ip, intentos: nuevos, bloqueado_hasta })
}

async function limpiarIntentos(ip) {
  await adminSupabase.from('login_attempts').upsert({ ip, intentos: 0, bloqueado_hasta: null })
}

// Token de un solo uso — válido 60 segundos, solo para colegio/estudiante
async function generarLoginToken(userId, role) {
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
  return new SignJWT({ sub: userId, role, aud: 'login-redirect' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(secret)
}

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false })

  const { usuario, password } = req.body || {}
  if (!usuario || !password) return res.status(400).json({ ok: false })

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'

  // Verificar si la IP está bloqueada
  const estado = await getIntentos(ip)
  if (estado.bloqueado_hasta && new Date(estado.bloqueado_hasta) > new Date()) {
    return res.status(200).json({ ok: false, blocked: true })
  }

  // Buscar en colegios y estudiantes (no admins — ellos tienen 2FA)
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

  // Credenciales incorrectas — registrar fallo
  await registrarFallo(ip, estado.intentos || 0)
  const intentosRestantes = MAX_INTENTOS - (estado.intentos || 0) - 1
  const bloqueado = intentosRestantes <= 0

  return res.status(200).json({
    ok: false,
    blocked: bloqueado,
    intentosRestantes: bloqueado ? 0 : intentosRestantes,
  })
}
