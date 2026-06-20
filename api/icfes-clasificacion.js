import { createClient } from '@supabase/supabase-js'
import { verifyJWT } from './_jwt.js'

export const config = { maxDuration: 60 }

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ORIGINS = [
  'https://portal-resultados-miltonochoa.vercel.app',
  'https://resultados.aamocolombia.com',
]
const isAllowed = (o) =>
  ALLOWED_ORIGINS.includes(o) ||
  /^https:\/\/portal-resultados-miltonochoa-[a-z0-9-]+\.vercel\.app$/.test(o)

const ICFES_BASE = 'https://resultados.icfes.edu.co/resultados-saber2016-web/pages/publicacionResultados/agregados/saber11/clasificacionPlanteles.jsf'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
}

function extractViewState(html) {
  const m = html.match(/name=["']javax\.faces\.ViewState["'][^>]*value=["']([^"']+)["']/)
    || html.match(/value=["']([^"']+)["'][^>]*name=["']javax\.faces\.ViewState["']/)
  return m ? m[1] : null
}

function extractFormId(html) {
  const m = html.match(/<form[^>]*id=["']([^"']+)["']/)
  return m ? m[1] : 'form1'
}

function parseCookies(response) {
  const raw = response.headers.get('set-cookie') || ''
  // Extract all name=value pairs, ignoring directives
  return raw.split(',')
    .map(c => c.trim().split(';')[0])
    .filter(Boolean)
    .join('; ')
}

// Extract all <select> elements and their options
function extractSelects(html) {
  const selects = {}
  const re = /<select[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const name = m[1]
    const opts = []
    const optRe = /<option[^>]*value=["']([^"']*?)["'][^>]*>([^<]*)<\/option>/gi
    let om
    while ((om = optRe.exec(m[2])) !== null) {
      opts.push({ value: om[1], label: om[2].trim() })
    }
    selects[name] = opts
  }
  return selects
}

// Parse the results table from ICFES HTML
function parseResultTable(html) {
  const rows = []
  // Find the table containing institution data
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi
  let tableMatch
  while ((tableMatch = tableRe.exec(html)) !== null) {
    const tableContent = tableMatch[1]
    // Check if this looks like the results table (contains DANE codes or clasificacion)
    if (!tableContent.match(/[A-D]\+?/) || !tableContent.match(/\d{9,}/)) continue

    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    let trMatch
    while ((trMatch = trRe.exec(tableContent)) !== null) {
      const cells = []
      const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
      let tdMatch
      while ((tdMatch = tdRe.exec(trMatch[1])) !== null) {
        // Strip HTML tags and trim
        cells.push(tdMatch[1].replace(/<[^>]+>/g, '').trim())
      }
      if (cells.length >= 4 && cells[0].match(/\d{9,}/)) {
        rows.push(cells)
      }
    }
  }
  return rows
}

export default async function handler(req, res) {
  const origin = req.headers['origin'] || ''
  const allowed = isAllowed(origin)
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : ALLOWED_ORIGINS[0])
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // GET: query stored data from Supabase
  if (req.method === 'GET') {
    const authHeader = req.headers['authorization'] || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'No autorizado' })
    try {
      await verifyJWT(token)
    } catch {
      return res.status(401).json({ error: 'Token inválido o expirado' })
    }

    const { anio, periodo, grado, municipio, sector, clasificacion, search } = req.query

    let q = adminSupabase
      .from('clasificacion_icfes')
      .select('*')
      .order('clasificacion', { ascending: true })
      .order('nombre_sede', { ascending: true })
      .limit(2000)

    if (anio)        q = q.eq('anio', parseInt(anio))
    if (periodo)     q = q.eq('periodo', parseInt(periodo))
    if (grado)       q = q.eq('grado', parseInt(grado))
    if (municipio)   q = q.eq('municipio', municipio)
    if (sector)      q = q.eq('sector', sector)
    if (clasificacion) {
      const clas = clasificacion.split(',').filter(Boolean)
      if (clas.length) q = q.in('clasificacion', clas)
    }
    if (search?.trim()) q = q.ilike('nombre_sede', `%${search.trim()}%`)

    const { data, error, count } = await q
    if (error) return res.status(500).json({ error: error.message })

    // Get available filter options for this anio/periodo/grado
    let meta = {}
    if (anio && periodo && grado) {
      const { data: muni } = await adminSupabase
        .from('clasificacion_icfes')
        .select('municipio')
        .eq('anio', parseInt(anio))
        .eq('periodo', parseInt(periodo))
        .eq('grado', parseInt(grado))
        .order('municipio')
      meta.municipios = [...new Set((muni || []).map(r => r.municipio).filter(Boolean))]
    }

    return res.json({ data: data || [], meta })
  }

  // POST: import data from ICFES for given year/period/grade
  if (req.method === 'POST') {
    // Verify admin token
    const auth = req.headers.authorization || ''
    const token = auth.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'No autorizado' })

    const { anio, periodo, grado } = req.body || {}
    if (!anio || !periodo || !grado) {
      return res.status(400).json({ error: 'Faltan parámetros: anio, periodo, grado' })
    }

    try {
      // Step 1: GET ICFES page to obtain ViewState + session cookie
      const getResp = await fetch(ICFES_BASE, { headers: HEADERS })
      if (!getResp.ok) {
        return res.status(502).json({ error: `ICFES respondió ${getResp.status}` })
      }
      const pageHtml = await getResp.text()
      const cookie = parseCookies(getResp)
      const viewState = extractViewState(pageHtml)
      const formId = extractFormId(pageHtml)

      if (!viewState) {
        return res.status(502).json({ error: 'No se pudo extraer ViewState de ICFES' })
      }

      const selects = extractSelects(pageHtml)

      // Find field names for año and período dynamically
      // Year select should contain the year values; period select typically contains 1,2,3,4
      let anioField = null, periodoField = null, gradoField = null
      for (const [name, opts] of Object.entries(selects)) {
        if (opts.some(o => o.value === String(anio) || o.label.includes(String(anio)))) {
          anioField = name
        }
        if (opts.some(o => o.value === String(periodo) || o.label.trim() === String(periodo))) {
          periodoField = name
        }
        if (opts.some(o => o.value === String(grado) || o.label.includes('11') || o.label.includes('26'))) {
          gradoField = name
        }
      }

      // Build POST body
      const body = new URLSearchParams()
      body.set('javax.faces.ViewState', viewState)
      body.set('javax.faces.partial.ajax', 'true')
      body.set('javax.faces.source', `${formId}:j_idt_consultar`)
      body.set('javax.faces.partial.execute', '@all')
      body.set('javax.faces.partial.render', '@all')

      if (anioField) body.set(anioField, String(anio))
      if (periodoField) body.set(periodoField, String(periodo))
      if (gradoField) body.set(gradoField, String(grado))

      // POST to get results
      const postResp = await fetch(ICFES_BASE, {
        method: 'POST',
        headers: {
          ...HEADERS,
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Faces-Request': 'partial/ajax',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: body.toString()
      })

      const resultHtml = await postResp.text()
      const rows = parseResultTable(resultHtml)

      if (!rows.length) {
        return res.json({
          imported: 0,
          message: 'No se encontraron datos. Intente importar manualmente con el script Python.',
          debug: { viewState: !!viewState, formId, fieldCount: Object.keys(selects).length }
        })
      }

      // Map rows to table columns
      // ICFES table order: DANE code, Nombre, Municipio, Departamento, Sector, Clasificacion, Evaluados, Puntaje
      const records = rows.map(cells => ({
        anio: parseInt(anio),
        periodo: parseInt(periodo),
        grado: parseInt(grado),
        codigo_dane: cells[0] || null,
        nombre_sede: cells[1] || null,
        municipio: cells[2] || null,
        departamento: cells[3] || null,
        sector: cells[4] || null,
        clasificacion: cells[5] || null,
        num_evaluados: parseInt(cells[6]) || null,
        puntaje_global: parseFloat(cells[7]) || null,
      })).filter(r => r.codigo_dane && r.nombre_sede)

      const { error: upsertError } = await adminSupabase
        .from('clasificacion_icfes')
        .upsert(records, { onConflict: 'anio,periodo,grado,codigo_dane,nombre_sede' })

      if (upsertError) return res.status(500).json({ error: upsertError.message })

      return res.json({ imported: records.length, message: `${records.length} establecimientos importados` })

    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  res.status(405).json({ error: 'Método no permitido' })
}
