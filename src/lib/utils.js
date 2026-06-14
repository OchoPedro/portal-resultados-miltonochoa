/**
 * Genera usuario y contraseña inicial para un estudiante a partir de su nombre y documento.
 * usuario  = número de documento
 * password = primeras 4 letras del primer apellido (sin tildes) + últimas 4 cifras del documento
 */
export function generateCredentials(nombre, documento) {
  const partes = nombre.trim().split(' ')
  const apellido = partes.length >= 2 ? partes[partes.length - 2] : partes[partes.length - 1]
  const prefijo = apellido
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase()
  return { usuario: documento, password: prefijo + documento.slice(-4) }
}
