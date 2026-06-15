import { createClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'

const checkPassword = async (stored, entered) => {
  if (!stored || !entered) return false
  if (stored.startsWith('$2')) return bcrypt.compare(entered, stored)
  return stored === entered
}

export const config = { maxDuration: 30 }

// Admin client — solo existe en el servidor, nunca llega al navegador
const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Rate limiting en memoria del proceso servidor (no se puede bypassear recargando)
const _serverAttempts = {}
function _srvBlocked(ip) {
  const r = _serverAttempts[ip]
  if (!r) return false
  if (r.until > Date.now()) return true
  delete _serverAttempts[ip]; return false
}
function _srvFail(ip) {
  if (!_serverAttempts[ip]) _serverAttempts[ip] = { n: 0, until: 0 }
  _serverAttempts[ip].n++
  if (_serverAttempts[ip].n >= 10)
    _serverAttempts[ip] = { n: 0, until: Date.now() + 15 * 60 * 1000 }
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
  if (_srvBlocked(ip))
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' })

  const { usuario, password } = req.body || {}
  if (!usuario || !password)
    return res.status(400).json({ error: 'Faltan credenciales' })

  // Supabase almacena el JWT secret como base64url — hay que decodificarlo para HMAC
  const jwtSecret = Buffer.from(process.env.SUPABASE_JWT_SECRET, 'base64')

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
      if (admin && await checkPassword(admin.password_hash, password)) {
        const { password_hash, ...safe } = admin
        userResult = { role: 'admin', data: safe }
      }
    }

    if (!userResult) {
      const { data: colegio } = await adminSupabase
        .from('colegios')
        .select('id, nombre, usuario, password_hash, ciudad, municipio, departamento_nombre, contactos, ultima_sesion')
        .eq('usuario', usuario.trim()).single()
      if (colegio && await checkPassword(colegio.password_hash, password)) {
        const { password_hash, ...safe } = colegio
        userResult = { role: 'colegio', data: safe }
      }
    }

    if (!userResult) {
      const { data: est } = await adminSupabase
        .from('estudiantes')
        .select('id, nombre, usuario, password_hash, activo, grado, salon, colegio_id, ultima_sesion, colegios(nombre, ciudad)')
        .eq('usuario', usuario.trim()).eq('activo', true).single()
      if (est && await checkPassword(est.password_hash, password)) {
        const { password_hash, ...safe } = est
        userResult = { role: 'estudiante', data: safe }
      }
    }

    if (!userResult) {
      _srvFail(ip)
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    // ── Paso 2: actualizar última sesión ────────────────────────────────────

    const ahora = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace(' ', 'T')
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
