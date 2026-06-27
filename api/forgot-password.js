import { createClient } from '@supabase/supabase-js'
import { createHash, randomInt } from 'crypto'

export const config = { maxDuration: 30 }

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function _fpBlocked(ip) {
  try {
    const { data } = await adminSupabase.from('login_attempts').select('intentos, bloqueado_hasta').eq('ip', `fp:${ip}`).single()
    if (!data) return false
    if (data.bloqueado_hasta && new Date(data.bloqueado_hasta) > new Date()) return true
    return false
  } catch { return false }
}
async function _fpFail(ip) {
  try {
    const { data } = await adminSupabase.from('login_attempts').select('intentos').eq('ip', `fp:${ip}`).single()
    const intentos = (data?.intentos || 0) + 1
    const bloqueado_hasta = intentos >= 5 ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null
    await adminSupabase.from('login_attempts').upsert({ ip: `fp:${ip}`, intentos: bloqueado_hasta ? 0 : intentos, bloqueado_hasta })
  } catch {}
}

const ALLOWED_ORIGINS = [
  'https://portal-resultados-miltonochoa.vercel.app',
  'https://resultados.aamocolombia.com',
]
const isAllowed = (o) => ALLOWED_ORIGINS.includes(o)

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
  if (req.headers['content-type']?.split(';')[0]?.trim() !== 'application/json')
    return res.status(415).json({ error: 'Content-Type debe ser application/json' })

  const fpIp = req.headers['x-real-ip']
    || req.headers['x-forwarded-for']?.split(',').pop()?.trim()
    || req.socket?.remoteAddress || 'unknown'
  if (await _fpBlocked(fpIp))
    return res.status(429).json({ error: 'Demasiadas solicitudes. Espera una hora.' })

  const { usuario } = req.body || {}
  if (!usuario)
    return res.status(400).json({ error: 'Ingresa tu usuario.' })

  try {
    let email = null
    let tabla = null

    const { data: admin } = await adminSupabase
      .from('administradores')
      .select('id, email')
      .filter('usuario', 'ilike', usuario.trim())
      .eq('activo', true)
      .single()

    if (admin) {
      if (!admin.email) {
        // Cuenta sin email — respuesta genérica para no revelar existencia
        return res.status(200).json({ ok: true, hint: null })
      }
      email = admin.email
      tabla = 'administradores'
    }

    if (!email) {
      const { data: colegio } = await adminSupabase
        .from('colegios')
        .select('id, contacto_email')
        .filter('usuario', 'ilike', usuario.trim())
        .eq('activo', true)
        .single()

      if (colegio) {
        email = colegio.contacto_email
        tabla = 'colegios'
      }
    }

    if (!email) {
      await _fpFail(fpIp)
      // No revelar si el usuario existe o no — siempre 200 con mismo mensaje
      return res.status(200).json({ ok: true, hint: null })
    }

    // OTP criptográficamente seguro
    const codigo = randomInt(100000, 1000000).toString()
    const codigoHash = createHash('sha256').update(codigo).digest('hex')

    await adminSupabase.from('password_resets').insert({
      usuario: usuario.trim().toLowerCase(),
      tabla,
      token: codigoHash,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      used: false,
    })

    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const from = process.env.RESEND_FROM || 'onboarding@resend.dev'
    await resend.emails.send({
      from: `Milton Ochoa <${from}>`,
      to: email,
      subject: 'Código de recuperación — Milton Ochoa',
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background:#f4f6f8;font-family:Inter,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="background:#0A1F3D;padding:32px 40px;text-align:center;">
                      <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.05em;">Milton Ochoa</div>
                      <div style="color:rgba(255,255,255,0.55);font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin-top:4px;">Portal de Resultados</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px;">
                      <p style="margin:0 0 8px;font-size:15px;color:#1a2940;font-weight:600;">Recuperación de contraseña</p>
                      <p style="margin:0 0 28px;font-size:14px;color:#4a5568;line-height:1.6;">
                        Recibimos una solicitud para restablecer la contraseña de la cuenta
                        <strong>${usuario.trim()}</strong>. Usa el siguiente código:
                      </p>
                      <div style="background:#0A1F3D;border-radius:4px;padding:28px;text-align:center;margin-bottom:28px;">
                        <div style="font-size:42px;font-weight:700;letter-spacing:0.3em;color:#ffffff;font-family:monospace;">
                          ${codigo}
                        </div>
                        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:8px;">
                          Válido por 15 minutos
                        </div>
                      </div>
                      <p style="margin:0;font-size:13px;color:#718096;line-height:1.6;">
                        Si no solicitaste este código, ignora este mensaje.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background:#f7fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
                      <p style="margin:0;font-size:11px;color:#a0aec0;text-align:center;">
                        © ${new Date().getFullYear()} Milton Ochoa · AAMO Colombia
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    })

    const hint = email.replace(/(.{2}).*(@.*)/, '$1***$2')
    return res.status(200).json({ ok: true, hint })
  } catch (e) {
    console.error('[forgot-password] error:', e.message)
    return res.status(500).json({ error: 'Error interno' })
  }
}
