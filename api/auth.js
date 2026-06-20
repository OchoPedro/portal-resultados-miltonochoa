import { createClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import { signUserJWT } from './_jwt.js'

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

// Verifica si el dispositivo ya fue validado con 2FA previamente
async function isTrustedDevice(req, adminId) {
  try {
    const cookieHeader = req.headers['cookie'] || ''
    const match = cookieHeader.match(/mo_trusted_device=([^;]+)/)
    if (!match) return false
    const tokenHash = createHash('sha256').update(match[1]).digest('hex')
    const { data } = await adminSupabase
      .from('trusted_devices')
      .select('id')
      .eq('admin_id', adminId)
      .eq('token_hash', tokenHash)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .single()
    return !!data
  } catch {
    return false
  }
}

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
        .select('id, nombre, usuario, password_hash, activo, modulos, email')
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

    // ── Paso 2: 2FA para administradores ───────────────────────────────────

    if (userResult.role === 'admin') {
      const adminEmail = userResult.data.email

      if (adminEmail && process.env.RESEND_API_KEY && !(await isTrustedDevice(req, userResult.data.id))) {
        try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        // Generar OTP de 6 dígitos
        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        const adminId = userResult.data.id

        // Borrar OTPs anteriores e insertar uno nuevo
        await adminSupabase.from('admin_otp').delete().eq('admin_id', adminId)
        await adminSupabase.from('admin_otp').insert({
          admin_id: adminId,
          code: otp,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          used: false,
        })

        // Enviar OTP por email
        const from = process.env.RESEND_FROM || 'onboarding@resend.dev'
        await resend.emails.send({
          from: `Milton Ochoa <${from}>`,
          to: adminEmail,
          subject: 'Código de acceso — Panel Administrativo',
          html: `
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"></head>
            <body style="margin:0;padding:0;background:#f4f6f8;font-family:Inter,Arial,sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
                <tr><td align="center">
                  <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
                    <tr>
                      <td style="background:#0A1F3D;padding:32px 40px;text-align:center;">
                        <div style="color:#fff;font-size:20px;font-weight:700;">Milton Ochoa</div>
                        <div style="color:rgba(255,255,255,0.55);font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin-top:4px;">Panel Administrativo</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px;">
                        <p style="margin:0 0 8px;font-size:15px;color:#1a2940;font-weight:600;">Verificación de identidad</p>
                        <p style="margin:0 0 28px;font-size:14px;color:#4a5568;line-height:1.6;">
                          Se detectó un intento de acceso al panel administrativo con el usuario <strong>${userResult.data.usuario}</strong>. Usa este código para completar el inicio de sesión:
                        </p>
                        <div style="background:#0A1F3D;border-radius:4px;padding:28px;text-align:center;margin-bottom:28px;">
                          <div style="font-size:42px;font-weight:700;letter-spacing:0.3em;color:#fff;font-family:monospace;">${otp}</div>
                          <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:8px;">Válido por 10 minutos</div>
                        </div>
                        <p style="margin:0;font-size:13px;color:#718096;line-height:1.6;">
                          Si no intentaste acceder al panel, ignora este mensaje o contacta al administrador del sistema.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background:#f7fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
                        <p style="margin:0;font-size:11px;color:#a0aec0;text-align:center;">© ${new Date().getFullYear()} Milton Ochoa · AAMO Colombia</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
          `,
        })

        return res.status(200).json({ challenge: true, adminId })
        } catch (otpErr) {
          console.error('[auth] OTP send failed, skipping 2FA:', otpErr.message)
          // Si el email falla, continúa con login normal
        }
      }
      // Admin sin email o RESEND_API_KEY no configurado: saltar 2FA
    }

    // ── Paso 3: actualizar última sesión ────────────────────────────────────

    const ahora = new Date().toISOString()
    if (userResult.role === 'admin')
      await adminSupabase.from('administradores').update({ ultima_sesion: ahora }).eq('id', userResult.data.id)
    if (userResult.role === 'colegio')
      await adminSupabase.from('colegios').update({ ultima_sesion: ahora }).eq('id', userResult.data.id)
    if (userResult.role === 'estudiante')
      await adminSupabase.from('estudiantes').update({ ultima_sesion: ahora }).eq('id', userResult.data.id)

    // ── Paso 4: emitir JWT firmado con el secreto de Supabase ───────────────
    // Las políticas RLS leen estos claims para autorizar cada query

    const token = await signUserJWT(userResult)

    // ── Paso 5: audit log (no bloqueante) ───────────────────────────────────
    adminSupabase.from('sesiones_log').insert({
      usuario: userResult.data.usuario,
      rol: userResult.role,
      ip,
      user_agent: req.headers['user-agent'] || '',
      accion: 'login',
    }).catch(() => {})

    return res.status(200).json({ token, user: userResult })
  } catch (e) {
    console.error('[auth] error:', e.message)
    return res.status(500).json({ error: 'Error interno', _debug: e.message })
  }
}
