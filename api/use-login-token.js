import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
import { signUserJWT } from './_jwt.js'

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Solo POST — nunca GET para evitar que el token quede en URLs, logs y cabeceras Referer
  if (req.method !== 'POST') return res.redirect(302, '/?error=method_not_allowed')

  const token = req.body?.t
  if (!token) return res.redirect(302, '/?error=token_missing')

  try {
    const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
    const { payload } = await jwtVerify(token, secret, { audience: 'login-redirect' })

    const { sub: userId, role, jti } = payload
    if (!userId || !role || !jti) return res.redirect(302, '/?error=token_invalid')

    // Consumir el token — DELETE atómico garantiza uso único
    const { count } = await adminSupabase
      .from('login_tokens')
      .delete({ count: 'exact' })
      .eq('jti', jti)
      .gt('expires_at', new Date().toISOString())

    if (!count || count === 0) return res.redirect(302, '/?error=token_already_used')

    // Obtener datos frescos del usuario
    let userResult = null

    if (role === 'colegio') {
      const { data } = await adminSupabase
        .from('colegios')
        .select('id, nombre, usuario, ciudad, municipio, departamento_nombre, contactos, ultima_sesion')
        .eq('id', userId)
        .eq('activo', true)
        .single()
      if (data) userResult = { role: 'colegio', data }
    } else if (role === 'estudiante') {
      const { data } = await adminSupabase
        .from('estudiantes')
        .select('id, nombre, usuario, activo, grado, salon, colegio_id, ultima_sesion, colegios(nombre, ciudad)')
        .eq('id', userId)
        .eq('activo', true)
        .single()
      if (data) userResult = { role: 'estudiante', data }
    }

    if (!userResult) return res.redirect(302, '/?error=user_not_found')

    const sessionJwt = await signUserJWT(userResult)

    const tabla = role === 'colegio' ? 'colegios' : 'estudiantes'
    await adminSupabase.from(tabla).update({ ultima_sesion: new Date().toISOString() }).eq('id', userId)

    const cookieOpts = 'HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800'
    res.setHeader('Set-Cookie', `mo_session=${sessionJwt}; ${cookieOpts}`)
    return res.redirect(302, '/')

  } catch {
    return res.redirect(302, '/?error=token_expired')
  }
}
