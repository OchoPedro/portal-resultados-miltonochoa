// Revela la contraseña de UN colegio, bajo demanda y solo para el admin del portal.
//
// La clave ya no viaja al navegador con la lista: en la BD las columnas
// password_cifrada / password_hash / password_plain están revocadas para
// anon/authenticated, así que ningún camino desde el navegador las puede leer.
// Solo este endpoint, con service-role, tras verificar la sesión del servidor.
//
// La clave se guarda cifrada (AES-256-GCM) con una llave que vive únicamente en
// COLEGIOS_CLAVE_SECRET; se descifra aquí para mostrarla.
import { createClient } from '@supabase/supabase-js'
import { verifyJWT } from './_jwt.js'
import { descifrar } from './_cripto.js'

export const config = { maxDuration: 10 }

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseCookie(str, name) {
  const m = str.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return m ? m[1] : null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).end()

  if (!process.env.COLEGIOS_CLAVE_SECRET)
    return res.status(500).json({ error: 'Falta configurar COLEGIOS_CLAVE_SECRET' })

  const token = parseCookie(req.headers.cookie || '', 'mo_session')
  if (!token) return res.status(401).json({ error: 'No autorizado' })
  let payload
  try { payload = await verifyJWT(token) } catch { return res.status(401).json({ error: 'Sesión inválida' }) }
  if (payload.app_role !== 'admin') return res.status(403).json({ error: 'No tienes permiso' })

  const id = String(req.query?.id || '')
  if (!UUID.test(id)) return res.status(400).json({ error: 'Colegio inválido' })

  const { data, error } = await supabase.from('colegios')
    .select('usuario, password_cifrada').eq('id', id).maybeSingle()
  if (error) {
    console.error('[colegio-clave]', error.message)
    return res.status(500).json({ error: 'No pude consultar la clave' })
  }
  if (!data) return res.status(404).json({ error: 'Colegio no encontrado' })

  let clave = null
  try {
    clave = data.password_cifrada ? descifrar(data.password_cifrada) : null
  } catch (e) {
    console.error('[colegio-clave] no pude descifrar', id, e.message)
    return res.status(500).json({ error: 'La clave guardada no se pudo descifrar' })
  }

  // Rastro de quién vio la clave de qué colegio.
  console.log('[colegio-clave] revelada', JSON.stringify({
    actor: payload.sub, colegio: id, usuario: data.usuario, ts: new Date().toISOString(),
  }))

  return res.status(200).json({ clave })
}
