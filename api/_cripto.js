// Cifrado simétrico para las contraseñas de los colegios.
//
// El admin necesita PODER VER la clave original (se la dicta al colegio), así que
// no basta un hash: hay que poder descifrarla. La llave vive solo en
// COLEGIOS_CLAVE_SECRET (variable de entorno de Vercel, cifrada) y nunca toca la
// base de datos. Con eso, un volcado de la base no sirve para nada: sin la llave,
// `password_cifrada` es ruido.
//
// AES-256-GCM: además de cifrar, autentica. Si alguien altera un byte del texto
// cifrado, el descifrado falla en vez de devolver basura silenciosamente.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const IV_BYTES = 12    // el tamaño recomendado para GCM
const TAG_BYTES = 16

function llave() {
  const b64 = process.env.COLEGIOS_CLAVE_SECRET
  if (!b64) throw new Error('Falta configurar COLEGIOS_CLAVE_SECRET')
  const k = Buffer.from(b64, 'base64')
  if (k.length !== 32) throw new Error('COLEGIOS_CLAVE_SECRET debe ser de 32 bytes en base64')
  return k
}

// Devuelve base64 de: iv (12) || tag (16) || texto cifrado
export function cifrar(texto) {
  if (texto === null || texto === undefined || texto === '') return null
  const iv = randomBytes(IV_BYTES)
  const c = createCipheriv('aes-256-gcm', llave(), iv)
  const cifrado = Buffer.concat([c.update(String(texto), 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), cifrado]).toString('base64')
}

export function descifrar(base64) {
  if (!base64) return null
  const buf = Buffer.from(base64, 'base64')
  if (buf.length < IV_BYTES + TAG_BYTES) throw new Error('Texto cifrado inválido')
  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const d = createDecipheriv('aes-256-gcm', llave(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(buf.subarray(IV_BYTES + TAG_BYTES)), d.final()]).toString('utf8')
}
