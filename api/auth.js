import { createClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'

const checkPassword = async (stored, entered) => {
  if (!stored || !entered) return false
  if (stored.startsWith('$2')) return bcrypt.compare(entered, stored)
  // Plaintext passwords are no longer accepted — force migration to bcrypt
  return false
}

const PLAINTEXT_ERROR = 'Contraseña requiere actualización. Contacte al administrador.'

const isPlaintextHash = (stored) => stored && !stored.startsWith('$2')

export const config = { maxDuration: 30 }

// Admin client — solo existe en el servidor, nunca llega al navegador
const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Rate limiting persistente en Supabase — sobrevive cold starts de Vercel
async function _srvBlocked(ip) {
  const { data } = await adminSupabase
    .from('login_attempts')
    .select('bloqueado_hasta')
    .eq('ip', ip)
    .single()
  if (!data || !data.bloqueado_hasta) return false
  if (new Date(data.bloqueado_hasta) > new Date()) return true
  await adminSupabase.from('login_attempts').update({ intentos: 0, bloqueado_hasta: null }).eq('ip', ip)
  return false
}
async function _srvFail(ip) {
  const { data } = await adminSupabase
    .from('login_attempts')
    .select('intentos')
    .eq('ip', ip)
    .single()
  const intentos = (data?.intentos || 0) + 1
  const bloqueado_hasta = intentos >= 10
    ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
    : null
  await adminSupabase.from('login_attempts').upsert({ ip, intentos: bloqueado_hasta ? 0 : intentos, bloqueado_hasta })
}

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

  // Rate limiting por IP del servidor
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress || 'unknown'
  if (await _srvBlocked(ip))
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' })

  const { usuario, password, portal } = req.body || {}
  if (!usuario || !password)
    return res.status(400).json({ error: 'Faltan credenciales' })

  const jwtSecret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)

  try {
    // ── Paso 1: validar credenciales ────────────────────────────────────────

    let userResult = null

    // Intentar con la RPC segura primero
    const { data: rpc, error: rpcErr } = await adminSupabase.rpc('verificar_login', {
      p_usuario: usuario.trim(), p_password: password,
    })
    if (!rpcErr && rpc && typeof rpc === 'object' && rpc.role) {
      userResult = rpc
    } else if (rpcErr && rpcErr.code !== 'PGRST202') {
      throw rpcErr
    }

    // Fallback: validar directamente si la RPC no existe aún
    if (!userResult) {
      const { data: admin } = await adminSupabase
        .from('administradores')
        .select('id, nombre, usuario, password_hash, activo, modulos')
        .eq('usuario', usuario.trim()).eq('activo', true).single()
      if (admin) {
        if (isPlaintextHash(admin.password_hash))
          return res.status(401).json({ error: PLAINTEXT_ERROR })
        if (await checkPassword(admin.password_hash, password)) {
          const { password_hash, ...safe } = admin
          userResult = { role: 'admin', data: safe }
        }
      }
    }

    if (!userResult) {
      const { data: colegio } = await adminSupabase
        .from('colegios')
        .select('id, nombre, usuario, password_hash, ciudad, municipio, departamento_nombre, contactos, ultima_sesion')
        .eq('usuario', usuario.trim()).eq('activo', true).single()
      if (colegio) {
        if (isPlaintextHash(colegio.password_hash))
          return res.status(401).json({ error: PLAINTEXT_ERROR })
        if (await checkPassword(colegio.password_hash, password)) {
          const { password_hash, ...safe } = colegio
          userResult = { role: 'colegio', data: safe }
        }
      }
    }

    if (!userResult) {
      const { data: est } = await adminSupabase
        .from('estudiantes')
        .select('id, nombre, usuario, password_hash, activo, grado, salon, colegio_id, ultima_sesion, colegios(nombre, ciudad)')
        .eq('usuario', usuario.trim()).eq('activo', true).single()
      if (est) {
        if (isPlaintextHash(est.password_hash))
          return res.status(401).json({ error: PLAINTEXT_ERROR })
        if (await checkPassword(est.password_hash, password)) {
          const { password_hash, ...safe } = est
          userResult = { role: 'estudiante', data: safe }
        }
      }
    }

    if (!userResult) {
      await _srvFail(ip)
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    // Validar que el portal coincida con el rol
    if (portal === 'admin' && userResult.role !== 'admin')
      return res.status(403).json({ error: 'Acceso no autorizado' })
    if (portal !== 'admin' && userResult.role === 'admin')
      return res.status(403).json({ error: 'Acceso no autorizado' })

    // ── Paso 2: actualizar última sesión ────────────────────────────────────

    const ahora = new Date().toISOString()
    if (userResult.role === 'admin')
      await adminSupabase.from('administradores').update({ ultima_sesion: ahora }).eq('id', userResult.data.id)
    if (userResult.role === 'colegio')
      await adminSupabase.from('colegios').update({ ultima_sesion: ahora }).eq('id', userResult.data.id)
    if (userResult.role === 'estudiante')
      await adminSupabase.from('estudiantes').update({ ultima_sesion: ahora }).eq('id', userResult.data.id)

    // ── Paso 3: emitir JWT firmado con el secreto de Supabase ───────────────
    // Las políticas RLS leen estos claims para autorizar cada query

    const token = await new SignJWT({
      aud:        'authenticated',
      sub:        userResult.data.id,
      role:       'authenticated',
      app_role:   userResult.role,
      colegio_id: userResult.role === 'colegio'    ? userResult.data.id : null,
      admin_id:   userResult.role === 'admin'      ? userResult.data.id : null,
      est_id:     userResult.role === 'estudiante' ? userResult.data.id : null,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('https://bmspwsbhsjkamjywvvde.supabase.co/auth/v1')
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(jwtSecret)

    return res.status(200).json({ token, user: userResult })
  } catch (e) {
    console.error('[auth] error:', e.message)
    return res.status(500).json({ error: 'Error interno' })
  }
}
