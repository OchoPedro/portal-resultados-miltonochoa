import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { PDFDocument } from 'pdf-lib'

const C = {
  navy:'#0A1F3D', green:'#2D9B6F', greenLt:'#3AB882',
  bg:'#F8F9FB', bg2:'#EFF1F5', white:'#FFFFFF',
  text:'#1A1A2E', gray:'#6B7280', grayLt:'#D1D5DB',
  red:'#E05252', amber:'#F59E0B',
}

const METODOS = [
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

function calcularResultado(respuestasEstudiante, clave, areas, asignaturas) {
  const detalle = [], porArea = {}, porAsig = {}
  for (let i = 0; i < clave.length; i++) {
    const marcada = (respuestasEstudiante[i] || 'X').toUpperCase()
    const correcta = (clave[i] || '').toUpperCase()
    const area = areas?.[i] || 'Sin área'
    const asignatura = asignaturas?.[i] || ''
    const esCorrecto = marcada === correcta && marcada !== 'X'
    if (!porArea[area]) porArea[area] = { correctas:0, total:0, peso: PESOS_AREA[area] || 1 }
    porArea[area].total++; if (esCorrecto) porArea[area].correctas++
    if (!porAsig[asignatura]) porAsig[asignatura] = { correctas:0, total:0 }
    porAsig[asignatura].total++; if (esCorrecto) porAsig[asignatura].correctas++
    detalle.push({ pregunta:i+1, marcada, correcta, correcto:esCorrecto, area, asignatura })
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
  return { correctas, total:clave.length, puntaje:Math.round(porcentaje * 5), porcentaje, detalle, porArea, pctAsig }
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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            { type:'image', source:{ type:'base64', media_type:mediaType, data:b64 } },
            { type:'text', text:'Analiza esta hoja de respuesta de examen colombiano. Las burbujas MARCADAS son círculos completamente rellenos de negro sin letra visible. Las NO marcadas muestran la letra (A, B, C o D). Lee en orden: arriba a abajo, izquierda a derecha. Extrae: usuario (número de documento), sesion (1 o 2), respuestas (string con letra marcada de cada pregunta). Responde SOLO JSON sin texto:' },
          ],
        },
        { role:'assistant', content:'{"usuario":"' },
      ],
    }),
  })

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const txt = data.content?.find(b => b.type === 'text')?.text || ''
  const full = '{"usuario":"' + txt

  // Intentar múltiples estrategias de parseo
  const candidates = [full, full + '}', full.replace(/,\s*$/, '}'), full.replace(/[^}]*$/, '}')]
  for (const c of candidates) {
    try { return JSON.parse(c) } catch { /* continuar */ }
  }
  throw new Error('No se pudo parsear respuesta: ' + full.substring(0, 80))
}

// ── Llamar a Claude Vision con PDF ───────────────────────
async function visionPDF(archivo) {
  const b64 = await toBase64(archivo)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            { type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } },
            { type:'text', text:'Analiza cada página de este PDF. Son hojas de respuesta de examen colombiano. Las burbujas MARCADAS son círculos completamente rellenos de negro. Lee en orden. Para cada página extrae: usuario (número de documento del campo "Usuario (No. Documento)"), sesion (1 o 2 según el encabezado), respuestas (string con letra marcada de cada pregunta en orden). Responde SOLO JSON sin texto:' },
          ],
        },
        { role:'assistant', content:'{"paginas":[' },
      ],
    }),
  })

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const txt = data.content?.find(b => b.type === 'text')?.text || ''
  const full = '{"paginas":[' + txt

  const candidates = [full, full + ']}', full.replace(/,\s*$/, ']}'), full.replace(/[^\]]*$/, ']}')]
  for (const c of candidates) {
    try { return JSON.parse(c) } catch { /* continuar */ }
  }
  return { paginas: [] }
}

// ── Buscar estudiantes y calcular resultados ──────────────
async function procesarResultados(estudiantesLeidos, clave, areas, asignaturas, colegioId, pruebaId) {
  const documentos = estudiantesLeidos.map(e => e.documento).filter(Boolean)
  const { data: estudiantesDB } = await supabase
    .from('estudiantes').select('id,nombre,usuario,grado,salon,colegio_id')
    .in('usuario', documentos).eq('colegio_id', colegioId)

  const filas = estudiantesLeidos.map(e => {
    const est = estudiantesDB?.find(db => db.usuario === e.documento)
    const calc = calcularResultado(e.respuestas, clave, areas, asignaturas)
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
  const [colegios, setColegios]       = useState([])
  const [pruebas, setPruebas]         = useState([])
  const [colegioId, setColegioId]     = useState('')
  const [pruebaId, setPruebaId]       = useState('')
  const [archivo, setArchivo]         = useState(null)
  const [archivos, setArchivos]       = useState([])
  const [cargando, setCargando]       = useState(true)
  const [procesando, setProcesando]   = useState(false)
  const [progreso, setProgreso]       = useState({ actual:0, total:0, msg:'' })
  const [preview, setPreview]         = useState(null)
  const [guardando, setGuardando]     = useState(false)
  const [confirmar, setConfirmar]     = useState(false)
  const [resultado, setResultado]     = useState(null)
  const [error, setError]             = useState('')
  const [manualDoc, setManualDoc]     = useState('')
  const [manualResp, setManualResp]   = useState('')
  const [manualPrev, setManualPrev]   = useState('')
  const cancelarRef                   = { value: false }

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    const [colRes, prbRes] = await Promise.all([
      supabase.from('colegios').select('id,nombre,usuario').order('nombre'),
      supabase.from('pruebas').select('*').order('nombre'),
    ])
    setColegios(colRes.data || []); setPruebas(prbRes.data || [])
    setCargando(false)
  }

  function reset() {
    setMetodo(null); setArchivo(null); setArchivos([]); setPreview(null); setResultado(null)
    setError(''); setColegioId(''); setPruebaId(''); setProgreso({ actual:0, total:0, msg:'' })
    setManualDoc(''); setManualResp(''); setManualPrev(''); cancelarRef.value = false
  }
  function resetForm() {
    setArchivo(null); setArchivos([]); setPreview(null); setResultado(null)
    setError(''); setConfirmar(false); setProgreso({ actual:0, total:0, msg:'' })
    setManualDoc(''); setManualResp(''); setManualPrev('')
  }

  function getClave() {
    const prueba = pruebas.find(p => p.id === pruebaId)
    const raw = prueba?.estructura_excel?.raw
    if (!raw || raw.length < 3) return null
    return {
      clave:       raw.slice(2).map(f => (f[9]||'').toString().trim().toUpperCase()),
      areas:       raw.slice(2).map(f => (f[2]||'').toString().trim()),
      asignaturas: raw.slice(2).map(f => (f[3]||'').toString().trim()),
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
      const filas = await procesarResultados(estudiantesLeidos, kd.clave, kd.areas, kd.asignaturas, colegioId, pruebaId)
      setPreview({ clave:kd.clave, filas, prueba:kd.prueba, via:'optico' })
    } catch(e) { setError('Error: ' + e.message) }
    finally { setProcesando(false) }
  }

  // ── PDF ────────────────────────────────────────────────
  async function procesarPDF() {
    setError('')
    if (!colegioId || !pruebaId || !archivo) { setError('Completa todos los campos.'); return }
    const kd = getClave()
    if (!kd) { setError('La prueba no tiene preguntas cargadas.'); return }
    setProcesando(true); cancelarRef.value = false
    try {
      setProgreso({ actual:0, total:1, msg:`🔍 Claude Vision leyendo PDF (${(archivo.size/1024/1024).toFixed(1)} MB)…` })
      const result = await visionPDF(archivo)
      const todasLasPaginas = result.paginas || []

      setProgreso({ actual:1, total:1, msg:'📊 Agrupando y calculando resultados…' })
      const estudiantesLeidos = agruparPorEstudiante(todasLasPaginas)
      const filas = await procesarResultados(estudiantesLeidos, kd.clave, kd.areas, kd.asignaturas, colegioId, pruebaId)

      setProgreso({ actual:1, total:1, msg:`✅ ${filas.length} estudiante(s) detectados` })
      setPreview({ clave:kd.clave, filas, prueba:kd.prueba, via:'pdf', paginasNoLeidas:todasLasPaginas.filter(p=>!p.usuario).length })
    } catch(e) { setError('Error al leer el PDF: ' + e.message) }
    finally { setProcesando(false) }
  }

  // ── FOTOS ──────────────────────────────────────────────
  async function procesarFotos() {
    setError('')
    if (!colegioId || !pruebaId || archivos.length === 0) { setError('Completa todos los campos y selecciona imágenes.'); return }
    const kd = getClave()
    if (!kd) { setError('La prueba no tiene preguntas cargadas.'); return }
    setProcesando(true); cancelarRef.value = false
    try {
      const total = archivos.length
      const todasLasPaginas = []

      for (let i = 0; i < archivos.length; i++) {
        if (cancelarRef.value) break
        setProgreso({ actual:i+1, total, msg:`🔍 Leyendo imagen ${i+1}/${total}: ${archivos[i].name}…` })
        try {
          const r = await visionImagen(archivos[i])
          todasLasPaginas.push({ usuario:r.usuario, sesion:Number(r.sesion), respuestas:r.respuestas || '' })
        } catch(e) {
          todasLasPaginas.push({ usuario:null, sesion:null, respuestas:'', error:e.message })
          setProgreso({ actual:i+1, total, msg:`⚠️ Error imagen ${i+1}: ${e.message.substring(0,60)}` })
          await new Promise(r => setTimeout(r, 1500))
        }
        if (i < archivos.length - 1) await new Promise(r => setTimeout(r, 200))
      }

      setProgreso({ actual:total, total, msg:'📊 Agrupando y calculando resultados…' })
      const estudiantesLeidos = agruparPorEstudiante(todasLasPaginas)
      const filas = await procesarResultados(estudiantesLeidos, kd.clave, kd.areas, kd.asignaturas, colegioId, pruebaId)

      setProgreso({ actual:total, total, msg:`✅ ${filas.length} estudiante(s) detectados` })
      setPreview({ clave:kd.clave, filas, prueba:kd.prueba, via:'fotos', paginasNoLeidas:todasLasPaginas.filter(p=>!p.usuario).length })
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
      const filas = await procesarResultados(estudiantesLeidos, kd.clave, kd.areas, kd.asignaturas, colegioId, pruebaId)
      setPreview({ clave:kd.clave, filas, prueba:kd.prueba, via:'manual' })
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
        const { error:err } = await supabase.from('resultados_estudiante').upsert({
          estudiante_id:f.estudiante.id, prueba_id:pruebaId, colegio_id:colegioId,
          respuestas:f.respuestas, correctas:f.correctas, total:f.total,
          desempeno_pct:f.porcentaje, puntaje_global:f.puntaje,
          mat_cuantitativo:f.pctAsig?.mat_cuantitativo??null, mat_especifico:f.pctAsig?.mat_especifico??null,
          cn_quimica:f.pctAsig?.cn_quimica??null, cn_fisica:f.pctAsig?.cn_fisica??null,
          cn_biologia:f.pctAsig?.cn_biologia??null, cn_cts:f.pctAsig?.cn_cts??null,
          sociales:f.pctAsig?.sociales??null, ciudadanas:f.pctAsig?.ciudadanas??null,
          lectura_critica:f.pctAsig?.lectura_critica??null, ingles:f.pctAsig?.ingles??null,
          detalle:f.detalle, cargado_via:preview.via||'optico',
        }, { onConflict:'estudiante_id,prueba_id' })
        if (err) errores++; else guardados++
      }
      setResultado({ guardados, errores, noEncontrados:preview.filas.filter(f=>!f.encontrado).length, total:preview.filas.length })
      setPreview(null)
      if (onUpdate) onUpdate()
    } catch(e) { setError('Error guardando: ' + e.message) }
    finally { setGuardando(false) }
  }

  const metodoActivo = METODOS.find(m => m.id === metodo)
  const pruebaActiva = pruebas.find(p => p.id === pruebaId)
  const listo = colegioId && pruebaId && (
    metodo === 'manual' ? manualDoc && manualResp :
    metodo === 'fotos'  ? archivos.length > 0 : archivo
  )
  const pctProg = progreso.total > 0 ? Math.round((progreso.actual / progreso.total) * 100) : 0

  // ── Pantalla 1: elegir método ──────────────────────────
  if (!metodo) return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, color:C.navy, margin:'0 0 4px' }}>Cargar Resultados</h2>
      <p style={{ fontSize:14, color:C.gray, margin:'0 0 24px' }}>Elige cómo vas a subir los resultados.</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:18 }}>
        {METODOS.map(m => (
          <button key={m.id} onClick={() => setMetodo(m.id)} style={{
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
          { label:'No encontrados en el colegio', val:resultado.noEncontrados, color:resultado.noEncontrados>0?C.amber:C.gray },
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
                {['Documento','Nombre','Grado','Salón','Sesiones','Correctas','Puntaje','Nivel','Estado'].map(h => (
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
                  <td style={{ padding:'10px 14px', fontSize:11 }}>
                    {f.tieneS1!==undefined ? <>{f.tieneS1?'✅':'⚠️'}S1 {f.tieneS2?'✅':'⚠️'}S2</> : '—'}
                  </td>
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
        {/* Colegio */}
        <div style={{ marginBottom:18 }}>
          <Label>Colegio</Label>
          <select style={selectStyle} value={colegioId} onChange={e => { setColegioId(e.target.value); resetForm() }} disabled={cargando}>
            <option value="">{cargando?'Cargando…':'Selecciona un colegio'}</option>
            {colegios.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.usuario?` (${c.usuario})`:''}</option>)}
          </select>
        </div>

        {/* Prueba */}
        <div style={{ marginBottom:18 }}>
          <Label>Prueba y referencia</Label>
          <select style={selectStyle} value={pruebaId} onChange={e => { setPruebaId(e.target.value); resetForm() }} disabled={cargando}>
            <option value="">{cargando?'Cargando…':'Selecciona la prueba'}</option>
            {pruebas.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.referencia?` — ${p.referencia}`:''}</option>)}
          </select>
          {pruebaActiva && (
            <div style={{ fontSize:12, color:C.green, marginTop:6, fontWeight:600 }}>
              ✓ {(pruebaActiva.estructura_excel?.raw?.length||0)-2} preguntas cargadas
            </div>
          )}
        </div>

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
              <Label>Número de documento del estudiante</Label>
              <input type="text" value={manualDoc} onChange={e => { setManualDoc(e.target.value); setPreview(null); setError('') }}
                placeholder="Ej: 1098765432" style={{ ...selectStyle, padding:'11px 13px' }} />
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
              <button onClick={() => { cancelarRef.value = true }}
                style={{ marginTop:10, padding:'6px 16px', borderRadius:8, border:`1px solid ${C.red}`, background:'transparent', color:C.red, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                ⛔ Cancelar
              </button>
            )}
          </div>
        )}

        {error && <div style={{ marginTop:14, padding:'12px 14px', background:'#FEE2E2', borderRadius:9, fontSize:13, color:C.red }}>{error}</div>}

        <div style={{ marginTop:24, borderTop:`1px solid ${C.bg2}`, paddingTop:20 }}>
          <button disabled={!listo||procesando}
            onClick={metodo==='optico'?procesarTXT:metodo==='pdf'?procesarPDF:metodo==='fotos'?procesarFotos:procesarManual}
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
