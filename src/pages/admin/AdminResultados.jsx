import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { C } from '../../components/ui'

const METODOS = [
  { id:'masivo',  icon:'📦', titulo:'Carga masiva',      sub:'Múltiples TXT — todos los colegios', badge:'Nuevo',       desc:'Sube todos los archivos TXT de una vez. El sistema detecta automáticamente a qué colegio pertenece cada estudiante por su número de documento.' },
  { id:'optico',  icon:'🧾', titulo:'Lector óptico',     sub:'Archivo .txt',                  badge:'Recomendado', desc:'Sube el archivo de texto que exporta el lector óptico. Cada línea es un estudiante con su cadena de respuestas. Es el método más confiable y rápido.' },
  { id:'pdf',     icon:'📄', titulo:'Hojas escaneadas',  sub:'Archivo .pdf — Claude Vision',   badge:'IA',          desc:'Sube el PDF con las hojas escaneadas. Claude Vision lee cada página automáticamente. Funciona aunque falten hojas de algún estudiante.' },
  { id:'fotos',   icon:'📷', titulo:'Fotos de hojas',    sub:'Imágenes JPG o PNG',             badge:'IA',          desc:'Sube las fotos de las hojas de respuesta. Puedes seleccionar varias imágenes a la vez. Claude Vision lee cada foto automáticamente.' },
  { id:'manual',  icon:'✏️', titulo:'Ingreso manual',    sub:'Digitar respuestas directamente', badge:'Manual',      desc:'Ingresa las respuestas de un estudiante manualmente. Usa números para mayor rapidez: 0=A, 1=B, 2=C, 3=D.' },
]

function Card({ children, style }) {
  return <div style={{ background:C.white, borderRadius:14, padding:'24px 26px', border:`1px solid ${C.grayLt}`, boxShadow:'0 1px 3px rgba(10,31,61,.05)', ...style }}>{children}</div>
}
function Label({ children }) {
  return <label style={{ display:'block', fontSize:13, fontWeight:600, color:C.navy, marginBottom:6 }}>{children}</label>
}
const selectStyle = { width:'100%', padding:'11px 13px', borderRadius:9, fontSize:14, border:`1px solid ${C.grayLt}`, background:C.white, color:C.text, outline:'none' }

const PESOS_AREA = { 'Matemáticas':3, 'Lectura Crítica':3, 'Ciencias Sociales':3, 'Ciencias Naturales':3, 'Inglés':1 }
const ASIG_COLUMNA = {
  'Contenidos genéricos':'mat_cuantitativo', 'Contenidos no genéricos':'mat_especifico',
  'Química':'cn_quimica', 'Física':'cn_fisica', 'Biología':'cn_biologia',
  'Ciencia, Tecnología y Sociedad':'cn_cts', 'Ciencias Sociales':'sociales',
  'Competencias Ciudadanas':'ciudadanas', 'Lectura Crítica':'lectura_critica', 'Inglés':'ingles',
}

function calcularResultado(respuestasEstudiante, clave, areas, asignaturas, competencias, componentes, dificultades) {
  const detalle = [], porArea = {}, porAsig = {}, porComp = {}, porCompN = {}
  for (let i = 0; i < clave.length; i++) {
    const marcada = (respuestasEstudiante[i] || 'X').toUpperCase()
    const correcta = (clave[i] || '').toUpperCase()
    const area = areas?.[i] || 'Sin área'
    const asignatura = asignaturas?.[i] || ''
    const competencia = competencias?.[i] || ''
    const componente = componentes?.[i] || ''
    const dificultad = dificultades?.[i] || null
    const esCorrecto = marcada === correcta && marcada !== 'X'
    if (!porArea[area]) porArea[area] = { correctas:0, total:0, peso: PESOS_AREA[area] || 1 }
    porArea[area].total++; if (esCorrecto) porArea[area].correctas++
    if (!porAsig[asignatura]) porAsig[asignatura] = { correctas:0, total:0 }
    porAsig[asignatura].total++; if (esCorrecto) porAsig[asignatura].correctas++
    if (asignatura && competencia) {
      const key = `${asignatura}|${competencia}`
      if (!porComp[key]) porComp[key] = { correctas:0, total:0, asignatura, competencia }
      porComp[key].total++; if (esCorrecto) porComp[key].correctas++
    }
    if (asignatura && componente) {
      const key = `${asignatura}|${componente}`
      if (!porCompN[key]) porCompN[key] = { correctas:0, total:0, asignatura, componente }
      porCompN[key].total++; if (esCorrecto) porCompN[key].correctas++
    }
    detalle.push({ pregunta:i+1, marcada, correcta, correcto:esCorrecto, area, asignatura, dificultad })
  }
  let sumaPonderada = 0, sumaPesos = 0
  for (const [, d] of Object.entries(porArea)) {
    const pct = d.total > 0 ? d.correctas / d.total : 0
    sumaPonderada += pct * d.peso; sumaPesos += d.peso
  }
  const correctas = detalle.filter(d => d.correcto).length
  const porcentaje = sumaPesos > 0 ? Math.round((sumaPonderada / sumaPesos) * 100) : 0
  const pctAsig = {}
  for (const [asig, d] of Object.entries(porAsig)) {
    const col = ASIG_COLUMNA[asig]
    if (col) pctAsig[col] = d.total > 0 ? Math.round((d.correctas / d.total) * 100) : 0
  }
  return { correctas, total:clave.length, puntaje:Math.round(porcentaje * 5), porcentaje, detalle, porArea, pctAsig, porComp, porCompN }
}

function parsearTXT(texto) {
  return texto.trim().split('\n').filter(l => l.trim()).map(l => {
    const p = l.trim().split(';')
    return { documento:p[0]?.trim(), respuestas:p[p.length-1]?.trim() }
  }).filter(e => e.documento && e.respuestas)
}

function agruparPorEstudiante(paginas) {
  const mapa = {}
  for (const pag of paginas) {
    if (!pag.usuario) continue
    if (!mapa[pag.usuario]) mapa[pag.usuario] = { s1:null, s2:null }
    if (pag.sesion === 1) mapa[pag.usuario].s1 = pag.respuestas
    if (pag.sesion === 2) mapa[pag.usuario].s2 = pag.respuestas
  }
  return Object.entries(mapa).map(([doc, sess]) => ({
    documento: doc,
    respuestas: (sess.s1 || '') + (sess.s2 || ''),
    tieneS1: !!sess.s1,
    tieneS2: !!sess.s2,
  }))
}

function Badge({ pct }) {
  const color = pct >= 65 ? C.green : pct >= 45 ? C.amber : C.red
  const nivel = pct >= 65 ? 'Avanzado' : pct >= 45 ? 'Satisfactorio' : pct >= 25 ? 'Mínimo' : 'Insuficiente'
  return <span style={{ background:color+'22', color, fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20 }}>{nivel} ({pct}%)</span>
}

// ── Convertir archivo a base64 (compatible Safari) ────────
async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      // dataUrl = "data:application/pdf;base64,XXXXX"
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

// ── Llamar a Claude Vision con imagen ────────────────────
async function visionImagen(file) {
  const b64 = await toBase64(file)
  const mediaType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'

  const token = sessionStorage.getItem('mo_token')
  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type:'image', source:{ type:'base64', media_type:mediaType, data:b64 } },
          { type:'text', text:`Eres un lector de hojas de respuesta. Esta imagen es una hoja de respuesta de examen.
Las burbujas MARCADAS son círculos completamente rellenos de negro.
Las NO marcadas muestran la letra A, B, C o D en su interior.

Extrae estos datos:
- usuario: el número de 10 dígitos del campo "USUARIO (NO. DOCUMENTO)"
- sesion: 1 o 2 según diga "Sesión 1" o "Sesión 2" en el encabezado
- respuestas: string con la letra marcada de cada pregunta en orden estricto

Responde ÚNICAMENTE con un objeto JSON válido, sin explicaciones:
{"usuario":"1098765432","sesion":1,"respuestas":"AACBBDCA..."}` },
        ],
      }],
    }),
  })

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const txt = (data.content?.find(b => b.type === 'text')?.text || '').trim()

  // Extraer JSON aunque venga con texto alrededor
  const match = txt.match(/\{[^{}]*"usuario"[^{}]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch {}
  }
  // Limpiar y parsear directamente
  const clean = txt.replace(/```json|```/g, '').trim()
  try { return JSON.parse(clean) } catch {}

  throw new Error('No pudo leer la hoja. Respuesta: ' + txt.substring(0, 120))
}

// ── Llamar a Claude Vision con PDF ───────────────────────
async function visionPDF(archivo) {
  const b64 = await toBase64(archivo)

  const token = sessionStorage.getItem('mo_token')
  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } },
          { type:'text', text:`Eres un lector de hojas de respuesta. Este PDF contiene hojas de respuesta de examen colombiano.
Las burbujas MARCADAS son círculos completamente rellenos de negro.
Las NO marcadas muestran la letra A, B, C o D en su interior.

Para CADA página del PDF extrae:
- usuario: número de 10 dígitos del campo "USUARIO (NO. DOCUMENTO)"
- sesion: 1 o 2 según diga "Sesión 1" o "Sesión 2"
- respuestas: string con la letra marcada de cada pregunta en orden estricto

Responde ÚNICAMENTE con JSON válido sin explicaciones:
{"paginas":[{"usuario":"1098765432","sesion":1,"respuestas":"AACBB..."},{"usuario":"1098765432","sesion":2,"respuestas":"BCDAA..."}]}` },
        ],
      }],
    }),
  })

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const txt = (data.content?.find(b => b.type === 'text')?.text || '').trim()

  // Extraer JSON del texto
  const match = txt.match(/\{[\s\S]*"paginas"[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch {}
  }
  const clean = txt.replace(/```json|```/g, '').trim()
  try { return JSON.parse(clean) } catch {}

  throw new Error('No pudo leer el PDF. Respuesta: ' + txt.substring(0, 150))
}

// ── Buscar estudiantes y calcular resultados ──────────────
async function procesarResultados(estudiantesLeidos, clave, areas, asignaturas, competencias, colegioId, pruebaId, componentes, dificultades) {
  const documentos = estudiantesLeidos.map(e => e.documento).filter(Boolean)
  const { data: estudiantesDB } = await supabase
    .from('estudiantes').select('id,nombre,usuario,grado,salon,colegio_id')
    .in('usuario', documentos).eq('colegio_id', colegioId)

  const filas = estudiantesLeidos.map(e => {
    const est = estudiantesDB?.find(db => db.usuario === e.documento)
    const calc = calcularResultado(e.respuestas, clave, areas, asignaturas, competencias, componentes, dificultades)
    return { documento:e.documento, respuestas:e.respuestas, encontrado:!!est, estudiante:est||null,
      tieneS1:e.tieneS1, tieneS2:e.tieneS2, ...calc }
  })

  const ids = filas.filter(f => f.encontrado).map(f => f.estudiante.id)
  let yaGuardados = []
  if (ids.length) {
    const { data:ex } = await supabase.from('resultados_estudiante')
      .select('estudiante_id').in('estudiante_id', ids).eq('prueba_id', pruebaId)
    yaGuardados = (ex || []).map(e => e.estudiante_id)
  }

  return filas.map(f => ({ ...f, yaGuardado: f.encontrado && yaGuardados.includes(f.estudiante?.id) }))
}

// ══════════════════════════════════════════════════════════
export default function AdminResultados({ onUpdate }) {
  const [metodo, setMetodo]           = useState(null)
  const [colegiosData, setColegiosData] = useState([])
  const [pruebas, setPruebas]         = useState([])
  const [usuarioInput, setUsuarioInput] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio]     = useState('')
  const [colegioId, setColegioId]     = useState('')
  const [pruebaId, setPruebaId]       = useState('')
  const [archivo, setArchivo]         = useState(null)
  const [archivos, setArchivos]       = useState([])
  const [archivosMasivo, setArchivosMasivo] = useState([])
  const [cargando, setCargando]       = useState(true)
  const [procesando, setProcesando]   = useState(false)
  const [progreso, setProgreso]       = useState({ actual:0, total:0, msg:'' })
  const [preview, setPreview]         = useState(null)
  const [guardando, setGuardando]     = useState(false)
  const [confirmar, setConfirmar]     = useState(false)
  const [resultado, setResultado]     = useState(null)
  const [error, setError]             = useState('')
  const [manualDoc, setManualDoc]         = useState('')
  const [manualResp, setManualResp]       = useState('')
  const [manualPrev, setManualPrev]       = useState('')
  const [manualGrado, setManualGrado]     = useState('')
  const [manualEstId, setManualEstId]     = useState('')
  const [gradosDisp, setGradosDisp]       = useState([])
  const [estudiantesDisp, setEstDisp]     = useState([])
  const cancelarRef                   = useRef(false)

  useEffect(() => { cargarDatos() }, [])



  async function cargarDatos() {
    setCargando(true)
    const [colRes, prbRes] = await Promise.all([
      supabase.from('colegios').select('id,nombre,usuario,departamento_nombre,municipio').eq('activo', true).order('nombre'),
      supabase.from('pruebas').select('*').order('nombre'),
    ])
    setColegiosData(colRes.data || []); setPruebas(prbRes.data || [])
    setCargando(false)
  }

  // Listas derivadas para cascada
  const departamentos = [...new Set(colegiosData.map(c => c.departamento_nombre).filter(Boolean))].sort()
  const municipiosFiltrados = [...new Set(colegiosData.filter(c => c.departamento_nombre === departamento).map(c => c.municipio).filter(Boolean))].sort()
  const colegiosFiltrados = colegiosData.filter(c => c.departamento_nombre === departamento && c.municipio === municipio)

  function handleUsuarioInput(val) {
    setUsuarioInput(val)
    const found = colegiosData.find(c => (c.usuario || '').toUpperCase() === val.toUpperCase())
    if (found) {
      setDepartamento(found.departamento_nombre || '')
      setMunicipio(found.municipio || '')
      setColegioId(found.id)
      resetFormFields()
    }
  }

  function handleDepartamento(dep) {
    setDepartamento(dep); setMunicipio(''); setColegioId(''); resetFormFields()
  }
  function handleMunicipio(mun) {
    setMunicipio(mun); setColegioId(''); resetFormFields()
    // Si solo hay un colegio en ese municipio, seleccionarlo automáticamente
    const cols = colegiosData.filter(c => c.departamento_nombre === departamento && c.municipio === mun)
    if (cols.length === 1) setColegioId(cols[0].id)
  }
  async function handleColegio(cid) {
    setColegioId(cid); resetFormFields()
    if (cid) {
      const { data } = await supabase.from('estudiantes').select('grado').eq('colegio_id', cid).eq('activo', true)
      const unicos = [...new Set((data||[]).map(r => r.grado).filter(Boolean))]
      unicos.sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric:true}))
      setGradosDisp(unicos)
    } else { setGradosDisp([]) }
  }

  function resetFormFields() {
    setArchivo(null); setArchivos([]); setArchivosMasivo([]); setPreview(null); setResultado(null)
    setError(''); setConfirmar(false)
    setManualGrado(''); setManualEstId(''); setManualDoc(''); setEstDisp([])
    setManualResp(''); setManualPrev(''); setGradosDisp([])
  }

  function reset() {
    setMetodo(null); setArchivo(null); setArchivos([]); setArchivosMasivo([]); setPreview(null); setResultado(null)
    setError(''); setColegioId(''); setPruebaId(''); setProgreso({ actual:0, total:0, msg:'' })
    setManualDoc(''); setManualResp(''); setManualPrev(''); setManualGrado(''); setManualEstId(''); setEstDisp([])
    setUsuarioInput(''); setDepartamento(''); setMunicipio(''); setGradosDisp([])
    cancelarRef.current = false
  }
  function resetForm() {
    setArchivo(null); setArchivos([]); setArchivosMasivo([]); setPreview(null); setResultado(null)
    setError(''); setConfirmar(false); setProgreso({ actual:0, total:0, msg:'' })
    setManualDoc(''); setManualResp(''); setManualPrev(''); setManualGrado(''); setManualEstId(''); setEstDisp([])
  }

  function getClave() {
    const prueba = pruebas.find(p => p.id === pruebaId)
    const raw = prueba?.estructura_excel?.raw
    if (!raw || raw.length < 2) return null

    // Detectar fila de encabezados dinámicamente
    const headerRow = raw[0]
    const idx = (nombres) => {
      for (const n of nombres) {
        const i = headerRow.findIndex(h =>
          typeof h === 'string' && h.trim().toLowerCase() === n.toLowerCase()
        )
        if (i >= 0) return i
      }
      return -1
    }

    const i_rta   = idx(['rta', 'respuesta', 'clave'])
    const i_area  = idx(['área', 'area'])
    const i_asig  = idx(['asignatura'])
    const i_comp  = idx(['competencia'])
    const i_compon= idx(['componente'])
    const i_dif   = idx(['dificultad'])

    // Si no encontró encabezados reconocidos, usar índices del formato anterior
    const dataRows = (i_rta >= 0) ? raw.slice(1) : raw.slice(2)
    const get = (f, iDyn, iLeg) => (iDyn >= 0 ? f[iDyn] : f[iLeg] || '')

    return {
      clave:        dataRows.map(f => get(f, i_rta,    9).toString().trim().toUpperCase()),
      areas:        dataRows.map(f => get(f, i_area,   2).toString().trim()),
      asignaturas:  dataRows.map(f => get(f, i_asig,   3).toString().trim()),
      competencias: dataRows.map(f => get(f, i_comp,   6).toString().trim()),
      componentes:  dataRows.map(f => get(f, i_compon, 7).toString().trim()),
      dificultades: i_dif >= 0 ? dataRows.map(f => (f[i_dif]||'').toString().trim()) : null,
      prueba,
    }
  }

  // ── TXT ────────────────────────────────────────────────
  async function procesarTXT() {
    setError('')
    if (!colegioId || !pruebaId || !archivo) { setError('Completa todos los campos.'); return }
    const kd = getClave()
    if (!kd) { setError('La prueba no tiene preguntas cargadas.'); return }
    setProcesando(true)
    try {
      const filasTXT = parsearTXT(await archivo.text())
      if (!filasTXT.length) { setError('El archivo no tiene líneas válidas.'); return }
      const estudiantesLeidos = filasTXT.map(f => ({ documento:f.documento, respuestas:f.respuestas, tieneS1:true, tieneS2:true }))
      const filas = await procesarResultados(estudiantesLeidos, kd.clave, kd.areas, kd.asignaturas, kd.competencias, colegioId, pruebaId, kd.componentes, kd.dificultades)
      setPreview({ clave:kd.clave, filas, prueba:kd.prueba, via:'optico', dificultades:kd.dificultades })
    } catch(e) { setError('Error: ' + e.message) }
    finally { setProcesando(false) }
  }

  // ── MASIVO (auto-detección de colegio) ────────────────
  async function procesarMasivo() {
    setError('')
    if (!pruebaId || archivosMasivo.length === 0) { setError('Selecciona la prueba y al menos un archivo TXT.'); return }
    const kd = getClave()
    if (!kd) { setError('La prueba no tiene preguntas cargadas.'); return }
    setProcesando(true)
    setProgreso({ actual:0, total:archivosMasivo.length, msg:'Leyendo archivos…' })
    try {
      // Leer todos los TXT
      const estudiantesLeidos = []
      for (let i = 0; i < archivosMasivo.length; i++) {
        const texto = await archivosMasivo[i].text()
        const filas = parsearTXT(texto)
        for (const f of filas) {
          estudiantesLeidos.push({ documento:f.documento, respuestas:f.respuestas, tieneS1:true, tieneS2:true })
        }
        setProgreso({ actual:i+1, total:archivosMasivo.length, msg:`Leyendo archivos… (${i+1}/${archivosMasivo.length})` })
      }

      if (!estudiantesLeidos.length) { setError('Los archivos no tienen líneas válidas.'); return }

      // Buscar estudiantes en TODOS los colegios (sin filtrar por colegio_id)
      setProgreso({ actual:archivosMasivo.length, total:archivosMasivo.length, msg:`Buscando ${estudiantesLeidos.length} estudiantes en la base de datos…` })
      const documentos = [...new Set(estudiantesLeidos.map(e => e.documento).filter(Boolean))]

      // Buscar en lotes de 200 para no exceder límites
      const estudiantesDB = []
      for (let i = 0; i < documentos.length; i += 200) {
        const lote = documentos.slice(i, i + 200)
        const { data } = await supabase
          .from('estudiantes')
          .select('id,nombre,usuario,grado,salon,colegio_id')
          .in('usuario', lote)
          .eq('activo', true)
        if (data) estudiantesDB.push(...data)
      }

      // Calcular resultados
      const filas = estudiantesLeidos.map(e => {
        const est = estudiantesDB.find(db => db.usuario === e.documento)
        const calc = calcularResultado(e.respuestas, kd.clave, kd.areas, kd.asignaturas, kd.competencias, kd.componentes, kd.dificultades)
        return { documento:e.documento, respuestas:e.respuestas, encontrado:!!est, estudiante:est||null,
          tieneS1:true, tieneS2:true, ...calc }
      })

      // Verificar cuáles ya tienen resultado guardado
      const ids = filas.filter(f => f.encontrado).map(f => f.estudiante.id)
      let yaGuardados = []
      if (ids.length) {
        const { data:ex } = await supabase.from('resultados_estudiante')
          .select('estudiante_id').in('estudiante_id', ids).eq('prueba_id', pruebaId)
        yaGuardados = (ex || []).map(e => e.estudiante_id)
      }

      const filasConEstado = filas.map(f => ({ ...f, yaGuardado: f.encontrado && yaGuardados.includes(f.estudiante?.id) }))
      setPreview({ clave:kd.clave, filas:filasConEstado, prueba:kd.prueba, via:'optico', masivo:true, dificultades:kd.dificultades })
    } catch(e) { setError('Error: ' + e.message) }
    finally { setProcesando(false) }
  }

  // ── PDF ────────────────────────────────────────────────
  async function procesarPDF() {
    setError('')
    if (!colegioId || !pruebaId || !archivo) { setError('Completa todos los campos.'); return }
    const kd = getClave()
    if (!kd) { setError('La prueba no tiene preguntas cargadas.'); return }
    setProcesando(true); cancelarRef.current = false
    try {
      setProgreso({ actual:0, total:1, msg:`🔍 Claude Vision leyendo PDF (${(archivo.size/1024/1024).toFixed(1)} MB)…` })
      const result = await visionPDF(archivo)
      const todasLasPaginas = result.paginas || []

      setProgreso({ actual:1, total:1, msg:'📊 Agrupando y calculando resultados…' })
      const estudiantesLeidos = agruparPorEstudiante(todasLasPaginas)
      const filas = await procesarResultados(estudiantesLeidos, kd.clave, kd.areas, kd.asignaturas, kd.competencias, colegioId, pruebaId, kd.componentes, kd.dificultades)

      setProgreso({ actual:1, total:1, msg:`✅ ${filas.length} estudiante(s) detectados` })
      setPreview({ clave:kd.clave, filas, prueba:kd.prueba, via:'pdf', paginasNoLeidas:todasLasPaginas.filter(p=>!p.usuario).length, dificultades:kd.dificultades })
    } catch(e) { setError('Error al leer el PDF: ' + e.message) }
    finally { setProcesando(false) }
  }

  // ── FOTOS ──────────────────────────────────────────────
  async function procesarFotos() {
    setError('')
    if (!colegioId || !pruebaId || archivos.length === 0) { setError('Completa todos los campos y selecciona imágenes.'); return }
    const kd = getClave()
    if (!kd) { setError('La prueba no tiene preguntas cargadas.'); return }
    setProcesando(true); cancelarRef.current = false
    try {
      const total = archivos.length
      const todasLasPaginas = []

      for (let i = 0; i < archivos.length; i++) {
        if (cancelarRef.current) break
        setProgreso({ actual:i+1, total, msg:`🔍 Leyendo imagen ${i+1}/${total}: ${archivos[i].name}…` })
        try {
          const r = await visionImagen(archivos[i])
          todasLasPaginas.push({ usuario:r.usuario, sesion:Number(r.sesion), respuestas:r.respuestas || '' })
        } catch(e) {
          console.error('Vision image error:', e)
          todasLasPaginas.push({ usuario:null, sesion:null, respuestas:'', error:e.message })
          setProgreso({ actual:i+1, total, msg:`⚠️ Error imagen ${i+1}: ${e.message.substring(0,60)}` })
          await new Promise(r => setTimeout(r, 1500))
        }
        if (i < archivos.length - 1) await new Promise(r => setTimeout(r, 200))
      }

      setProgreso({ actual:total, total, msg:'📊 Agrupando y calculando resultados…' })
      const estudiantesLeidos = agruparPorEstudiante(todasLasPaginas)
      const filas = await procesarResultados(estudiantesLeidos, kd.clave, kd.areas, kd.asignaturas, kd.competencias, colegioId, pruebaId, kd.componentes, kd.dificultades)

      setProgreso({ actual:total, total, msg:`✅ ${filas.length} estudiante(s) detectados` })
      setPreview({ clave:kd.clave, filas, prueba:kd.prueba, via:'fotos', paginasNoLeidas:todasLasPaginas.filter(p=>!p.usuario).length, dificultades:kd.dificultades })
    } catch(e) { setError('Error: ' + e.message) }
    finally { setProcesando(false) }
  }

  // ── MANUAL ─────────────────────────────────────────────
  function convertirResp(raw) {
    return raw.split('').map(c => {
      if (/[0-3]/.test(c)) return ['A','B','C','D'][parseInt(c)]
      if (/[AaBbCcDd]/.test(c)) return c.toUpperCase()
      return null
    }).filter(Boolean).join('')
  }

  async function procesarManual() {
    setError('')
    if (!colegioId || !pruebaId || !manualDoc) { setError('Completa colegio, prueba y documento.'); return }
    const respuestas = convertirResp(manualResp)
    if (!respuestas) { setError('Ingresa al menos una respuesta.'); return }
    const kd = getClave()
    if (!kd) { setError('La prueba no tiene preguntas cargadas.'); return }
    setProcesando(true)
    try {
      const estudiantesLeidos = [{ documento:manualDoc, respuestas, tieneS1:true, tieneS2:true }]
      const filas = await procesarResultados(estudiantesLeidos, kd.clave, kd.areas, kd.asignaturas, kd.competencias, colegioId, pruebaId, kd.componentes, kd.dificultades)
      setPreview({ clave:kd.clave, filas, prueba:kd.prueba, via:'manual', dificultades:kd.dificultades })
    } catch(e) { setError('Error: ' + e.message) }
    finally { setProcesando(false) }
  }

  // ── GUARDAR ────────────────────────────────────────────
  async function guardar() {
    if (!preview) return
    setGuardando(true); setError('')
    try {
      const filasValidas = preview.filas.filter(f => f.encontrado)
      let guardados = 0, errores = 0
      for (const f of filasValidas) {
        const cid = preview.masivo ? f.estudiante.colegio_id : colegioId
        const { error:err } = await supabase.from('resultados_estudiante').upsert({
          estudiante_id:f.estudiante.id, prueba_id:pruebaId, colegio_id:cid,
          respuestas:f.respuestas, correctas:f.correctas, total:f.total,
          desempeno_pct:f.porcentaje, puntaje_global:f.puntaje,
          mat_cuantitativo:f.pctAsig?.mat_cuantitativo??null, mat_especifico:f.pctAsig?.mat_especifico??null,
          cn_quimica:f.pctAsig?.cn_quimica??null, cn_fisica:f.pctAsig?.cn_fisica??null,
          cn_biologia:f.pctAsig?.cn_biologia??null, cn_cts:f.pctAsig?.cn_cts??null,
          sociales:f.pctAsig?.sociales??null, ciudadanas:f.pctAsig?.ciudadanas??null,
          lectura_critica:f.pctAsig?.lectura_critica??null, ingles:f.pctAsig?.ingles??null,
          detalle:f.detalle, cargado_via:preview.via||'optico',
        }, { onConflict:'estudiante_id,prueba_id' })
        if (err) { errores++ } else {
          guardados++
          const compRows = Object.values(f.porComp || {})
            .filter(c => c.asignatura && c.competencia)
            .map(c => ({
              estudiante_id: f.estudiante.id,
              prueba_id: pruebaId,
              materia: c.asignatura,
              competencia: c.competencia,
              nota: c.total > 0 ? Math.round((c.correctas / c.total) * 100) : 0,
              preguntas: c.total,
            }))
          if (compRows.length) {
            await supabase.from('notas_competencia')
              .upsert(compRows, { onConflict: 'estudiante_id,prueba_id,materia,competencia' })
          }
          const compNRows = Object.values(f.porCompN || {})
            .filter(c => c.asignatura && c.componente)
            .map(c => ({
              estudiante_id: f.estudiante.id,
              prueba_id: pruebaId,
              materia: c.asignatura,
              componente: c.componente,
              nota: c.total > 0 ? Math.round((c.correctas / c.total) * 100) : 0,
              preguntas: c.total,
            }))
          if (compNRows.length) {
            await supabase.from('notas_componente')
              .upsert(compNRows, { onConflict: 'estudiante_id,prueba_id,materia,componente' })
          }
        }
      }
      const noEncontrados = preview.filas.filter(f=>!f.encontrado).length
      setResultado({ guardados, errores, noEncontrados, total:preview.filas.length, masivo:!!preview.masivo })
      setPreview(null)
      if (onUpdate) onUpdate()
      // Calibrar IRT en background (no bloqueante)
      if (guardados > 0) {
        const kd = getClave()
        if (kd) calibrarIRT(pruebaId, kd).catch(() => {})
      }
    } catch(e) { setError('Error guardando: ' + e.message) }
    finally { setGuardando(false) }
  }

  async function calibrarIRT(pruebaId, kd) {
    // ── 1. Leer todos los detalles de esta prueba (todos los colegios) ──
    const { data: todos } = await supabase
      .from('resultados_estudiante')
      .select('id,estudiante_id,detalle')
      .eq('prueba_id', pruebaId)
    if (!todos || todos.length < 10) return

    const nPreg = kd.clave.length
    const aciertos = new Array(nPreg).fill(0)
    const totales  = new Array(nPreg).fill(0)

    for (const row of todos) {
      for (const item of (row.detalle || [])) {
        const i = item.pregunta - 1
        if (i >= 0 && i < nPreg) {
          totales[i]++
          if (item.correcto) aciertos[i]++
        }
      }
    }

    // ── 2. Calcular b_i = logit(1-p_i) por pregunta ──
    const bPorPregunta = kd.clave.map((_, i) => {
      const total = totales[i] || 1
      const p = Math.max(0.01, Math.min(0.99, aciertos[i] / total))
      return { b: Math.log((1 - p) / p), p, total }
    })

    // ── 3. Agrupar b_i por área ──
    const areas = [...new Set(kd.areas.filter(Boolean))]
    const bPorArea = {}
    areas.forEach(area => {
      bPorArea[area] = kd.areas
        .map((a, i) => a === area ? { i, b: bPorPregunta[i].b } : null)
        .filter(Boolean)
    })

    // ── 4. Estimar θ por área por estudiante (1PL + c=0.25, EAP prior N(0,1)) ──
    function estimarTheta(respuestas, bItems) {
      // EAP sobre grilla de -4 a +4 con prior N(0,1)
      const GRID = Array.from({ length: 41 }, (_, k) => -4 + k * 0.2)
      const prior = GRID.map(t => Math.exp(-0.5 * t * t))
      const C = 0.25

      const likelihood = GRID.map((t, gi) => {
        let logL = 0
        for (const { i, b } of bItems) {
          const xi = respuestas[i]
          if (xi === undefined) continue
          const P = C + (1 - C) / (1 + Math.exp(-(t - b)))
          logL += xi === 1 ? Math.log(Math.max(P, 1e-10)) : Math.log(Math.max(1 - P, 1e-10))
        }
        return Math.exp(logL) * prior[gi]
      })

      const Z = likelihood.reduce((s, v) => s + v, 0) || 1
      return GRID.reduce((s, t, gi) => s + t * likelihood[gi] / Z, 0)
    }

    // ── 5. Calcular θ de cada estudiante por área ──
    const thetasPorArea = {}
    areas.forEach(a => { thetasPorArea[a] = [] })

    const irtPorEstudiante = todos.map(row => {
      const respVec = new Array(nPreg).fill(undefined)
      for (const item of (row.detalle || [])) {
        const i = item.pregunta - 1
        if (i >= 0 && i < nPreg) respVec[i] = item.correcto ? 1 : 0
      }

      const scores = {}
      areas.forEach(area => {
        const theta = estimarTheta(respVec, bPorArea[area])
        scores[area] = theta
        thetasPorArea[area].push(theta)
      })
      return { id: row.id, scores }
    })

    // ── 6. Normalizar θ → 0-100 por área (media=50, sd=10) ──
    const stats = {}
    areas.forEach(area => {
      const ts = thetasPorArea[area]
      const mu = ts.reduce((s, v) => s + v, 0) / ts.length
      const sigma = Math.sqrt(ts.reduce((s, v) => s + (v - mu) ** 2, 0) / ts.length) || 1
      stats[area] = { mu, sigma }
    })

    function thetaToScore(theta, area) {
      const { mu, sigma } = stats[area]
      return Math.max(0, Math.min(100, Math.round(50 + (theta - mu) / sigma * 10)))
    }

    // ── 7. Calcular puntaje global con pesos ICFES (3-3-3-3-1 / 13 × 5) ──
    const PESOS_IRT = {
      'Matemáticas': 3, 'Lectura Crítica': 3,
      'Ciencias Naturales': 3, 'Ciencias Sociales': 3, 'Inglés': 1,
    }
    const pesoTotal = Object.values(PESOS_IRT).reduce((s, v) => s + v, 0)

    const updates = irtPorEstudiante.map(({ id, scores }) => {
      const porArea = {}
      let sumaPonderada = 0, sumaPesos = 0
      areas.forEach(area => {
        const score = thetaToScore(scores[area], area)
        porArea[area] = score
        const peso = PESOS_IRT[area] || 1
        sumaPonderada += score * peso
        sumaPesos += peso
      })
      const ig = sumaPesos > 0 ? sumaPonderada / sumaPesos : 0
      const global = Math.round(ig / pesoTotal * (pesoTotal * 5))
      return { id, puntaje_irt: { ...porArea, global } }
    })

    // ── 8. Guardar θ normalizados en resultados_estudiante ──
    for (const { id, puntaje_irt } of updates) {
      supabase.from('resultados_estudiante')
        .update({ puntaje_irt })
        .eq('id', id)
        .then(null, () => {})
    }

    // ── 9. Guardar b_i + estadísticos de normalización en parametros_irt ──
    const params = kd.clave.map((_, i) => {
      const { b, p, total } = bPorPregunta[i]
      const area = kd.areas?.[i] || null
      const s = area && stats[area] ? stats[area] : null
      return {
        prueba_id:     pruebaId,
        nro_pregunta:  i + 1,
        area,
        competencia:   kd.competencias?.[i] || null,
        componente:    kd.componentes?.[i]  || null,
        dificultad_teo: kd.dificultades?.[i] || null,
        p_correcta:    Math.round(p * 10000) / 10000,
        b_logit:       Math.round(b * 10000) / 10000,
        n_estudiantes: total,
        n_calibrado:   todos.length,
        mu_theta:      s ? Math.round(s.mu * 10000) / 10000 : null,
        sigma_theta:   s ? Math.round(s.sigma * 10000) / 10000 : null,
      }
    })

    await supabase.from('parametros_irt')
      .upsert(params, { onConflict: 'prueba_id,nro_pregunta' })
  }

  const metodoActivo = METODOS.find(m => m.id === metodo)
  const pruebaActiva = pruebas.find(p => p.id === pruebaId)
  const listo = pruebaId && (
    metodo === 'masivo'  ? archivosMasivo.length > 0 :
    metodo === 'manual'  ? colegioId && manualEstId && manualResp :
    metodo === 'fotos'   ? colegioId && archivos.length > 0 :
    colegioId && archivo
  )
  const pctProg = progreso.total > 0 ? Math.round((progreso.actual / progreso.total) * 100) : 0

  // ── Pantalla 1: elegir método ──────────────────────────
  if (!metodo) return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, color:C.navy, margin:'0 0 4px' }}>Cargar Resultados</h2>
      <p style={{ fontSize:14, color:C.gray, margin:'0 0 24px' }}>Elige cómo vas a subir los resultados.</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:18 }}>
        {METODOS.map(m => (
          <button key={m.id} onClick={async () => {
            setMetodo(m.id)
            if (m.id === 'manual' && colegioId) {
              const { data } = await supabase.from('estudiantes')
                .select('grado').eq('colegio_id', colegioId).eq('activo', true)
              const unicos = [...new Set((data||[]).map(r => r.grado).filter(Boolean))]
              unicos.sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric:true}))
              setGradosDisp([...unicos])
            }
          }} style={{
            textAlign:'left', cursor:'pointer', background:C.white, border:`1px solid ${C.grayLt}`,
            borderRadius:14, padding:'24px 24px 26px', transition:'all .15s', boxShadow:'0 1px 3px rgba(10,31,61,.05)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor=C.green; e.currentTarget.style.boxShadow='0 6px 18px rgba(45,155,111,.15)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor=C.grayLt; e.currentTarget.style.boxShadow='0 1px 3px rgba(10,31,61,.05)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <span style={{ fontSize:34 }}>{m.icon}</span>
              <span style={{ fontSize:11, fontWeight:700, color:C.green, background:'#E7F5EE', padding:'3px 10px', borderRadius:20 }}>{m.badge}</span>
            </div>
            <div style={{ fontSize:17, fontWeight:700, color:C.navy }}>{m.titulo}</div>
            <div style={{ fontSize:13, fontWeight:600, color:C.gray, marginBottom:10 }}>{m.sub}</div>
            <div style={{ fontSize:13.5, color:C.text, lineHeight:1.5 }}>{m.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )

  // ── Pantalla 3: resumen final ──────────────────────────
  if (resultado) return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, color:C.navy, margin:'0 0 24px' }}>✅ Resultados guardados</h2>
      <Card style={{ maxWidth:500 }}>
        {[
          { label:'Estudiantes procesados',       val:resultado.total,         color:C.navy  },
          { label:'Guardados correctamente',       val:resultado.guardados,     color:C.green },
          { label:`No encontrados en ${resultado.masivo?'la base de datos':'el colegio'}`, val:resultado.noEncontrados, color:resultado.noEncontrados>0?C.amber:C.gray },
          { label:'Errores al guardar',            val:resultado.errores,       color:resultado.errores>0?C.red:C.gray },
        ].map((r,i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:i<3?`1px solid ${C.bg2}`:'none' }}>
            <span style={{ fontSize:14, color:C.text }}>{r.label}</span>
            <span style={{ fontSize:18, fontWeight:700, color:r.color }}>{r.val}</span>
          </div>
        ))}
        <button onClick={reset} style={{ marginTop:20, width:'100%', padding:'12px', borderRadius:10, background:C.navy, color:C.white, border:'none', cursor:'pointer', fontSize:14, fontWeight:600 }}>
          Cargar más resultados
        </button>
      </Card>
    </div>
  )

  // ── Pantalla 2b: vista previa ──────────────────────────
  if (preview) return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <button onClick={resetForm} style={{ cursor:'pointer', border:`1px solid ${C.grayLt}`, background:C.white, borderRadius:8, padding:'6px 12px', fontSize:13, color:C.gray, fontWeight:600 }}>← Volver</button>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.navy, margin:0 }}>Vista previa de resultados</h2>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        {[
          { label:'Detectados',    val:preview.filas.length,                          color:C.navy  },
          { label:'Encontrados',   val:preview.filas.filter(f=>f.encontrado).length,  color:C.green },
          { label:'No hallados',   val:preview.filas.filter(f=>!f.encontrado).length, color:C.amber },
          ...(preview.paginasNoLeidas>0 ? [{ label:'Páginas no leídas', val:preview.paginasNoLeidas, color:C.red }] : []),
        ].map((s,i) => (
          <div key={i} style={{ background:C.white, border:`1px solid ${C.grayLt}`, borderRadius:10, padding:'12px 18px', minWidth:140 }}>
            <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <Card style={{ padding:0, overflow:'hidden', marginBottom:20 }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:C.navy }}>
                {['Documento','Nombre','Grado','Salón',...(preview.masivo?['Colegio']:['Sesiones']),'Correctas','Puntaje','Nivel','Estado'].map(h => (
                  <th key={h} style={{ padding:'11px 14px', color:'rgba(255,255,255,0.8)', fontWeight:600, textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.filas.map((f,i) => (
                <tr key={i} style={{ background:i%2===0?C.white:C.bg, opacity:f.encontrado?1:0.6 }}>
                  <td style={{ padding:'10px 14px', color:C.text }}>{f.documento}</td>
                  <td style={{ padding:'10px 14px', color:C.text, fontWeight:500 }}>{f.encontrado?f.estudiante.nombre:'—'}</td>
                  <td style={{ padding:'10px 14px', color:C.gray }}>{f.estudiante?.grado||'—'}</td>
                  <td style={{ padding:'10px 14px', color:C.gray }}>{f.estudiante?.salon||'—'}</td>
                  {preview.masivo
                    ? <td style={{ padding:'10px 14px', fontSize:12, color:C.gray, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {f.encontrado ? (colegiosData.find(c=>c.id===f.estudiante?.colegio_id)?.nombre || f.estudiante?.colegio_id?.slice(0,8)+'…') : '—'}
                      </td>
                    : <td style={{ padding:'10px 14px', fontSize:11 }}>
                        {f.tieneS1!==undefined ? <>{f.tieneS1?'✅':'⚠️'}S1 {f.tieneS2?'✅':'⚠️'}S2</> : '—'}
                      </td>
                  }
                  <td style={{ padding:'10px 14px', fontWeight:600 }}>{f.correctas}/{f.total}</td>
                  <td style={{ padding:'10px 14px', color:C.navy, fontWeight:700 }}>{f.puntaje}</td>
                  <td style={{ padding:'10px 14px' }}><Badge pct={f.porcentaje}/></td>
                  <td style={{ padding:'10px 14px' }}>
                    {f.yaGuardado ? <span style={{color:C.amber,fontWeight:600,fontSize:12}}>⚠ Ya existe</span>
                      : f.encontrado ? <span style={{color:C.green,fontWeight:600,fontSize:12}}>✦ Nuevo</span>
                      : <span style={{color:C.amber,fontWeight:600,fontSize:12}}>⚠ No hallado</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {preview.filas.some(f=>!f.encontrado) && (
        <div style={{ padding:'12px 16px', background:'#FEF3C7', borderRadius:9, fontSize:13, color:'#92400E', marginBottom:12 }}>
          ⚠️ Los estudiantes "No hallados" no se guardarán.
        </div>
      )}
      {preview.filas.some(f=>f.yaGuardado) && !confirmar && (
        <div style={{ padding:'14px 16px', background:'#FEF3C7', borderRadius:9, fontSize:13, color:'#92400E', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <span>⚠️ <strong>{preview.filas.filter(f=>f.yaGuardado).length}</strong> estudiante(s) ya tienen resultados. ¿Sobreescribir?</span>
          <button onClick={() => setConfirmar(true)} style={{ padding:'7px 16px', borderRadius:8, border:'none', cursor:'pointer', background:'#92400E', color:'white', fontWeight:700, fontSize:12 }}>Sí, sobreescribir</button>
        </div>
      )}
      {preview.filas.some(f=>f.yaGuardado) && confirmar && (
        <div style={{ padding:'12px 16px', background:'#D1FAE5', borderRadius:9, fontSize:13, color:'#065F46', marginBottom:12 }}>✓ Confirmado.</div>
      )}
      {error && <div style={{ padding:'12px 16px', background:'#FEE2E2', borderRadius:9, fontSize:13, color:C.red, marginBottom:16 }}>{error}</div>}

      <div style={{ display:'flex', gap:12 }}>
        <button onClick={resetForm} style={{ padding:'12px 24px', borderRadius:10, border:`1px solid ${C.grayLt}`, background:C.white, color:C.gray, fontSize:14, fontWeight:600, cursor:'pointer' }}>Cancelar</button>
        <button onClick={guardar}
          disabled={guardando||preview.filas.filter(f=>f.encontrado).length===0||(preview.filas.some(f=>f.yaGuardado)&&!confirmar)}
          style={{ padding:'12px 32px', borderRadius:10, border:'none', fontSize:14, fontWeight:700, cursor:guardando?'wait':'pointer',
            background:preview.filas.filter(f=>f.encontrado).length===0?C.grayLt:C.green, color:C.white }}>
          {guardando?'Guardando…':`Guardar ${preview.filas.filter(f=>f.encontrado).length} resultado(s)`}
        </button>
      </div>
    </div>
  )

  // ── Pantalla 2: formulario ─────────────────────────────
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
        <button onClick={reset} style={{ cursor:'pointer', border:`1px solid ${C.grayLt}`, background:C.white, borderRadius:8, padding:'6px 12px', fontSize:13, color:C.gray, fontWeight:600 }}>← Cambiar método</button>
      </div>
      <h2 style={{ fontSize:22, fontWeight:700, color:C.navy, margin:'10px 0 4px' }}>{metodoActivo.icon} {metodoActivo.titulo}</h2>
      <p style={{ fontSize:14, color:C.gray, margin:'0 0 24px' }}>{metodoActivo.desc}</p>

      <Card style={{ maxWidth:640 }}>
        {/* Selector de colegio — oculto en modo masivo */}
        {metodo !== 'masivo' && (<>
        {/* Usuario colegio (auto-fill) */}
        <div style={{ marginBottom:18 }}>
          <Label>Usuario del colegio</Label>
          <input
            type="text"
            placeholder="Escribe el usuario (ej: ATBA0001)"
            value={usuarioInput}
            onChange={e => handleUsuarioInput(e.target.value)}
            style={{ ...selectStyle, textTransform:'uppercase' }}
          />
          {usuarioInput && !colegioId && (
            <div style={{ fontSize:12, color:C.amber, marginTop:5 }}>⚠ Usuario no encontrado entre colegios activos</div>
          )}
          {colegioId && (
            <div style={{ fontSize:12, color:C.green, marginTop:5, fontWeight:600 }}>
              ✓ {colegiosData.find(c=>c.id===colegioId)?.nombre}
            </div>
          )}
        </div>

        {/* Separador */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
          <div style={{ flex:1, height:1, background:C.grayLt }}/>
          <span style={{ fontSize:11, color:C.gray, fontWeight:600 }}>O SELECCIONA EN CASCADA</span>
          <div style={{ flex:1, height:1, background:C.grayLt }}/>
        </div>

        {/* Departamento */}
        <div style={{ marginBottom:18 }}>
          <Label>Departamento</Label>
          <select style={selectStyle} value={departamento} onChange={e => handleDepartamento(e.target.value)} disabled={cargando}>
            <option value="">{cargando ? 'Cargando…' : 'Selecciona el departamento'}</option>
            {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Municipio */}
        <div style={{ marginBottom:18 }}>
          <Label>Municipio</Label>
          <select style={selectStyle} value={municipio} onChange={e => handleMunicipio(e.target.value)} disabled={!departamento}>
            <option value="">{!departamento ? 'Selecciona el departamento primero' : 'Selecciona el municipio'}</option>
            {municipiosFiltrados.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Colegio */}
        <div style={{ marginBottom:18 }}>
          <Label>Colegio</Label>
          <select style={selectStyle} value={colegioId} onChange={e => handleColegio(e.target.value)} disabled={!municipio}>
            <option value="">{!municipio ? 'Selecciona el municipio primero' : 'Selecciona el colegio'}</option>
            {colegiosFiltrados.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.usuario ? ` (${c.usuario})` : ''}</option>)}
          </select>
        </div>
        </>)}

        {/* Prueba */}
        <div style={{ marginBottom:18 }}>
          <Label>Prueba y referencia</Label>
          <select style={selectStyle} value={pruebaId} onChange={e => { setPruebaId(e.target.value); resetForm() }} disabled={cargando}>
            <option value="">{cargando?'Cargando…':'Selecciona la prueba'}</option>
            {pruebas.filter(p => p.codigo !== '_tipo_').map(p => <option key={p.id} value={p.id}>{p.nombre}{p.referencia?` — ${p.referencia}`:''}</option>)}
          </select>
          {pruebaActiva && (
            <div style={{ fontSize:12, color:C.green, marginTop:6, fontWeight:600 }}>
              ✓ {(pruebaActiva.estructura_excel?.raw?.length||0)-2} preguntas cargadas
            </div>
          )}
        </div>

        {/* Masivo — solo prueba + archivos TXT múltiples (sin colegio) */}
        {metodo === 'masivo' && (
          <div style={{ marginBottom:6 }}>
            <div style={{ padding:'12px 16px', background:'#EFF6FF', borderRadius:9, fontSize:13, color:'#1D4ED8', marginBottom:18, lineHeight:1.6 }}>
              📦 <strong>Carga masiva:</strong> sube todos los archivos TXT a la vez. El sistema detecta automáticamente el colegio de cada estudiante por su número de documento.
            </div>
            <Label>Archivos del lector óptico (.txt)</Label>
            <input type="file" accept=".txt" multiple
              onChange={e => { setArchivosMasivo(Array.from(e.target.files)); setPreview(null); setError('') }}
              style={{ width:'100%', padding:'10px 12px', borderRadius:9, fontSize:13.5, border:`1px dashed ${C.grayLt}`, background:C.bg, color:C.text }} />
            {archivosMasivo.length > 0 && (
              <div style={{ marginTop:10, padding:'10px 14px', background:C.bg2, borderRadius:9 }}>
                <div style={{ fontSize:12, color:C.navy, fontWeight:700, marginBottom:6 }}>📄 {archivosMasivo.length} archivo(s):</div>
                <div style={{ maxHeight:120, overflowY:'auto' }}>
                  {archivosMasivo.map((f,i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'2px 0', borderBottom:`1px solid ${C.bg2}` }}>
                      <span>{f.name}</span>
                      <span style={{ color:C.gray }}>{(f.size/1024).toFixed(0)} KB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Archivo — TXT o PDF */}
        {(metodo === 'optico' || metodo === 'pdf') && (
          <div style={{ marginBottom:6 }}>
            <Label>{metodo==='optico'?'Archivo del lector óptico (.txt)':'Hojas escaneadas (.pdf)'}</Label>
            <input type="file" accept={metodo==='optico'?'.txt':'.pdf'}
              onChange={e => { setArchivo(e.target.files[0]||null); setPreview(null); setError('') }}
              style={{ width:'100%', padding:'10px 12px', borderRadius:9, fontSize:13.5, border:`1px dashed ${C.grayLt}`, background:C.bg, color:C.text }} />
            {metodo==='pdf' && (
              <div style={{ marginTop:10, padding:'10px 14px', background:'#EFF6FF', borderRadius:8, fontSize:12, color:'#1D4ED8', lineHeight:1.6 }}>
                💡 <strong>Recomendación de escaneo:</strong> usa <strong>150 DPI en blanco y negro</strong>. Evita 300 DPI o más.
              </div>
            )}
            {archivo && (
              <div style={{ marginTop:10, padding:'10px 14px', background:C.bg2, borderRadius:9, fontSize:13, display:'flex', justifyContent:'space-between' }}>
                <span>📄 {archivo.name}</span>
                <span style={{ color:C.gray }}>{(archivo.size/1024/1024).toFixed(1)} MB</span>
              </div>
            )}
          </div>
        )}

        {/* Fotos */}
        {metodo === 'fotos' && (
          <div style={{ marginBottom:6 }}>
            <Label>Selecciona las fotos (JPG o PNG)</Label>
            <input type="file" accept="image/jpeg,image/png,image/jpg" multiple
              onChange={e => { setArchivos(Array.from(e.target.files)); setPreview(null); setError('') }}
              style={{ width:'100%', padding:'10px 12px', borderRadius:9, fontSize:13.5, border:`1px dashed ${C.grayLt}`, background:C.bg, color:C.text }} />
            <p style={{ fontSize:12, color:C.gray, margin:'8px 0 0' }}>
              Selecciona varias imágenes a la vez. Una imagen por hoja de respuesta. Mantén <strong>Cmd</strong> para seleccionar múltiples.
            </p>
            {archivos.length > 0 && (
              <div style={{ marginTop:10, padding:'10px 14px', background:C.bg2, borderRadius:9 }}>
                <div style={{ fontSize:12, color:C.navy, fontWeight:700, marginBottom:6 }}>📷 {archivos.length} imagen(es):</div>
                <div style={{ maxHeight:100, overflowY:'auto' }}>
                  {archivos.map((f,i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'2px 0', borderBottom:`1px solid ${C.bg2}` }}>
                      <span>{f.name}</span>
                      <span style={{ color:C.gray }}>{(f.size/1024).toFixed(0)} KB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual */}
        {metodo === 'manual' && (
          <div>
            <div style={{ marginBottom:18 }}>
              <Label>Grado</Label>
              <select key={`grado-${gradosDisp.join(',')}`} style={selectStyle} value={manualGrado} onChange={async e => {
                setManualGrado(e.target.value); setManualEstId(''); setManualDoc(''); setEstDisp([])
                if (e.target.value && colegioId) {
                  const { data } = await supabase.from('estudiantes')
                    .select('id,nombre,usuario').eq('colegio_id', colegioId)
                    .eq('grado', e.target.value).eq('activo', true).order('nombre')
                  setEstDisp(data || [])
                }
              }} disabled={!colegioId}>
                <option value="">{gradosDisp.length === 0 ? 'Cargando…' : 'Selecciona el grado'}</option>
                {gradosDisp.map(g => <option key={g} value={g}>Grado {g}</option>)}
              </select>
            </div>

            <div style={{ marginBottom:18 }}>
              <Label>Estudiante</Label>
              <select style={selectStyle} value={manualEstId} onChange={e => {
                const est = estudiantesDisp.find(es => es.id === e.target.value)
                setManualEstId(e.target.value)
                setManualDoc(est?.usuario || '')
              }} disabled={!manualGrado || estudiantesDisp.length === 0}>
                <option value="">{!manualGrado ? 'Selecciona el grado primero' : estudiantesDisp.length === 0 ? 'Cargando estudiantes…' : 'Selecciona el estudiante'}</option>
                {estudiantesDisp.map(est => (
                  <option key={est.id} value={est.id}>{est.nombre} — {est.usuario}</option>
                ))}
              </select>
              {manualDoc && (
                <div style={{ fontSize:12, color:C.green, marginTop:5, fontWeight:600 }}>
                  ✓ Usuario seleccionado: {manualDoc}
                </div>
              )}
            </div>

            <div style={{ marginBottom:18 }}>
              <Label>Respuestas</Label>
              <div style={{ fontSize:12, color:C.gray, marginBottom:8, lineHeight:1.6 }}>
                <strong style={{color:C.navy}}>0=A &nbsp;·&nbsp; 1=B &nbsp;·&nbsp; 2=C &nbsp;·&nbsp; 3=D</strong> — también puedes escribir letras directamente.
              </div>
              <textarea value={manualResp} onChange={e => { setManualResp(e.target.value); setManualPrev(convertirResp(e.target.value)) }}
                placeholder="Ej: 013201320132..." rows={5}
                style={{ width:'100%', padding:'11px 13px', borderRadius:9, fontSize:14, border:`1px solid ${C.grayLt}`, background:C.white, color:C.text, outline:'none', resize:'vertical', fontFamily:'monospace' }} />
              {manualPrev && (
                <div style={{ marginTop:8, padding:'10px 14px', background:C.bg2, borderRadius:8 }}>
                  <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>Vista previa ({manualPrev.length} preguntas):</div>
                  <div style={{ fontFamily:'monospace', fontSize:13, color:C.navy, wordBreak:'break-all' }}>{manualPrev}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Barra de progreso */}
        {procesando && (
          <div style={{ marginTop:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12 }}>
              <span style={{ color:C.navy, fontWeight:600 }}>{progreso.msg || 'Procesando…'}</span>
              {progreso.total>0 && <span style={{ color:C.gray }}>{pctProg}%</span>}
            </div>
            {progreso.total>0 && (
              <div style={{ background:C.bg2, borderRadius:99, height:10, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:99, background:C.green, width:`${pctProg}%`, transition:'width 0.4s ease' }}/>
              </div>
            )}
            {(metodo==='pdf'||metodo==='fotos') && (
              <button onClick={() => { cancelarRef.current = true }}
                style={{ marginTop:10, padding:'6px 16px', borderRadius:8, border:`1px solid ${C.red}`, background:'transparent', color:C.red, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                ⛔ Cancelar
              </button>
            )}
          </div>
        )}

        {error && <div style={{ marginTop:14, padding:'12px 14px', background:'#FEE2E2', borderRadius:9, fontSize:13, color:C.red }}>{error}</div>}

        <div style={{ marginTop:24, borderTop:`1px solid ${C.bg2}`, paddingTop:20 }}>
          <button disabled={!listo||procesando}
            onClick={metodo==='masivo'?procesarMasivo:metodo==='optico'?procesarTXT:metodo==='pdf'?procesarPDF:metodo==='fotos'?procesarFotos:procesarManual}
            style={{ width:'100%', padding:'13px', borderRadius:10, fontSize:15, fontWeight:700, border:'none',
              cursor:listo&&!procesando?'pointer':'not-allowed',
              background:listo&&!procesando?C.green:C.grayLt, color:listo&&!procesando?C.white:C.gray }}>
            {procesando ? 'Procesando…' : metodo==='pdf'?'Procesar con Claude Vision':metodo==='fotos'?'Procesar fotos con Claude Vision':'Procesar'}
          </button>
        </div>
      </Card>
    </div>
  )
}
