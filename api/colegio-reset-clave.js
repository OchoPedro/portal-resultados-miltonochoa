// Cambia la contraseña de un colegio. Se hashea y se cifra AQUÍ, en el servidor.
// El navegador ya no escribe password_hash ni la clave en claro: esas columnas
// están revocadas para anon/authenticated.
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { verifyJWT } from './_jwt.js'
import { cifrar } from './_cripto.js'

export const config = { maxDuration: 10 }

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MIN_CLAVE = 6
const MAX_CLAVE = 72   // bcrypt trunca más allá de 72 bytes: rechazar en vez de truncar en silencio

function parseCookie(str, name) {
  const m = str.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return m ? m[1] : null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).end()

  if (!process.env.COLEGIOS_CLAVE_SECRET)
    return res.status(500).json({ error: 'Falta configurar COLEGIOS_CLAVE_SECRET' })

  const token = parseCookie(req.headers.cookie || '', 'mo_session')
  if (!token) return res.status(401).json({ error: 'No autorizado' })
  let payload
  try { payload = await verifyJWT(token) } catch { return res.status(401).json({ error: 'Sesión inválida' }) }
  if (payload.app_role !== 'admin') return res.status(403).json({ error: 'No tienes permiso' })

  const { id, clave } = req.body || {}
  if (!UUID.test(String(id || ''))) return res.status(400).json({ error: 'Colegio inválido' })
  const nueva = String(clave || '')
  if (nueva.length < MIN_CLAVE) return res.status(400).json({ error: `La clave debe tener al menos ${MIN_CLAVE} caracteres` })
  if (Buffer.byteLength(nueva, 'utf8') > MAX_CLAVE) return res.status(400).json({ error: 'La clave es demasiado larga' })

  const { data: colegio } = await supabase.from('colegios').select('id, usuario').eq('id', id).maybeSingle()
  if (!colegio) return res.status(404).json({ error: 'Colegio no encontrado' })

  const { error } = await supabase.from('colegios').update({
    password_hash: await bcrypt.hash(nueva, 10),
    password_cifrada: cifrar(nueva),
    password_plain: null,
  }).eq('id', id)
  if (error) {
    console.error('[colegio-reset-clave]', error.message)
    return res.status(500).json({ error: 'No pude cambiar la clave' })
  }

  console.log('[colegio-reset-clave] cambiada', JSON.stringify({
    actor: payload.sub, colegio: id, usuario: colegio.usuario, ts: new Date().toISOString(),
  }))

  return res.status(200).json({ ok: true })
}
