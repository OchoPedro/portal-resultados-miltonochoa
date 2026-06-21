import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

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
  // Al llegar al límite, bloquear indefinidamente (solo se libera con reset de contraseña)
  const bloqueado_hasta = nuevos >= MAX_INTENTOS
    ? new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString() // ~10 años
    : null
  await adminSupabase.from('login_attempts').upsert({ ip, intentos: nuevos, bloqueado_hasta })
}

async function limpiarIntentos(ip) {
  await adminSupabase.from('login_attempts').upsert({ ip, intentos: 0, bloqueado_hasta: null })
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

  // Verificar credenciales en colegios, administradores y estudiantes
  const tablas = ['colegios', 'administradores', 'estudiantes']
  for (const tabla of tablas) {
    const { data } = await adminSupabase
      .from(tabla)
      .select('password_hash')
      .eq('usuario', usuario.trim())
      .eq('activo', true)
      .limit(1)
      .single()

    if (data?.password_hash?.startsWith('$2')) {
      const match = await bcrypt.compare(password, data.password_hash)
      if (match) {
        await limpiarIntentos(ip)
        return res.status(200).json({ ok: true })
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
