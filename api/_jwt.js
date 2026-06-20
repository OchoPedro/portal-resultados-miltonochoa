import { SignJWT } from 'jose'

/**
 * Emite un JWT firmado con el secreto de Supabase.
 * @param {object} userResult  { role: 'admin'|'colegio'|'estudiante', data: {...} }
 * @returns {Promise<string>}  JWT string
 */
export async function signUserJWT(userResult) {
  const jwtSecret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)

  return new SignJWT({
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
}
