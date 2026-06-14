import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { PDFDocument } from 'pdf-lib'

const C = {
  navy:'#0A1F3D', green:'#2D9B6F', greenLt:'#3AB882',
  bg:'#F8F9FB', bg2:'#EFF1F5', white:'#FFFFFF',
  text:'#1A1A2E', gray:'#6B7280', grayLt:'#D1D5DB',
  red:'#E05252', amber:'#F59E0B',
}

const PAGINAS_POR_LOTE = 8  // 8 páginas = ~4 estudiantes por llamada

const METODOS = [
  {
    id:'optico', icon:'🧾', titulo:'Lector óptico', sub:'Archivo .txt',
    desc:'Sube el archivo de texto que exporta el lector óptico. Cada línea es un estudiante con su cadena de respuestas. Es el método más confiable y rápido.',
    badge:'Recomendado',
  },
  {
    id:'pdf', icon:'📄', titulo:'Hojas escaneadas', sub:'Archivo .pdf — Claude Vision',
    desc:'Sube el PDF con todas las hojas escaneadas. El sistema procesa lotes de páginas con Claude Vision. Funciona aunque falten hojas de algún estudiante.',
    badge:'IA',
  },
  {
    id:'manual', icon:'✏️', titulo:'Ingreso manual', sub:'Digitar respuestas directamente',
    desc:'Ingresa las respuestas de un estudiante manualmente. Usa números para mayor rapidez: 0=A, 1=B, 2=C, 3=D.',
    badge:'Manual',
  },
  {
    id:'fotos', icon:'📷', titulo:'Fotos de hojas', sub:'Imágenes JPG o PNG — Claude Vision',
    desc:'Sube las fotos de las hojas de respuesta. Puedes seleccionar varias imágenes a la vez. Claude Vision lee cada foto automáticamente.',
    badge:'IA',
  },
]

function Card({ children, style }) {
  return (
    <div style={{
      background:C.white, borderRadius:14, padding:'24px 26px',
      border:`1px solid ${C.grayLt}`, boxShadow:'0 1px 3px rgba(10,31,61,.05)', ...style,
    }}>{children}</div>
  )
}
function Label({ children }) {
  return <label style={{ display:'block', fontSize:13, fontWeight:600, color:C.navy, marginBottom:6 }}>{children}</label>
}
const selectStyle = {
  width:'100%', padding:'11px 13px', borderRadius:9, fontSize:14,
  border:`1px solid ${C.grayLt}`, background:C.white, color:C.text, outline:'none',
}

const PESOS_AREA = {
  'Matemáticas':3, 'Lectura Crítica':3, 'Ciencias Sociales':3, 'Ciencias Naturales':3, 'Inglés':1,
}
function pesoArea(area) { return PESOS_AREA[area] || 1 }

const ASIG_COLUMNA = {
  'Contenidos genéricos':'mat_cuantitativo', 'Contenidos no genéricos':'mat_especifico',
  'Química':'cn_quimica', 'Física':'cn_fisica', 'Biología':'cn_biologia',
  'Ciencia, Tecnología y Sociedad':'cn_cts', 'Ciencias Sociales':'sociales',
  'Competencias Ciudadanas':'ciudadanas', 'Lectura Crítica':'lectura_critica', 'Inglés':'ingles',
}

function calcularResultado(respuestasEstudiante, clave, areas, asignaturas) {
  const detalle = [], porArea = {}, porAsig = {}
  for (let i = 0; i < clave.length; i++) {
    const marcada    = (respuestasEstudiante[i] || 'X').toUpperCase()
    const correcta   = (clave[i] || '').toUpperCase()
    const area       = areas?.[i] || 'Sin área'
    const asignatura = asignaturas?.[i] || ''
    const esCorrecto = marcada === correcta && marcada !== 'X'
    if (!porArea[area]) porArea[area] = { correctas:0, total:0, peso:pesoArea(area) }
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
  const correctas  = detalle.filter(d => d.correcto).length
  const porcentaje = sumaPesos > 0 ? Math.round((sumaPonderada / sumaPesos) * 100) : 0
  const puntaje    = Math.round(porcentaje * 5)
  const pctAsig = {}
  for (const [asig, d] of Object.entries(porAsig)) {
    const col = ASIG_COLUMNA[asig]
    if (col) pctAsig[col] = d.total > 0 ? Math.round((d.correctas / d.total) * 100) : 0
  }
  return { correctas, total: clave.length, puntaje, porcentaje, detalle, porArea, pctAsig }
}

function parsearTXT(texto) {
  return texto.trim().split('\n').filter(l => l.trim()).map(linea => {
    const partes = linea.trim().split(';')
    return { documento: partes[0]?.trim(), respuestas: partes[partes.length - 1]?.trim() }
  }).filter(e => e.documento && e.respuestas)
}

function Badge({ pct }) {
  const color = pct >= 65 ? C.green : pct >= 45 ? C.amber : C.red
  const nivel = pct >= 65 ? 'Avanzado' : pct >= 45 ? 'Satisfactorio' : pct >= 25 ? 'Mínimo' : 'Insuficiente'
  return <span style={{ background:color+'22', color, fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20 }}>{nivel} ({pct}%)</span>
}

/* ── Extraer páginas individuales como base64 ─────────────── */
/* ── Contar páginas del PDF sin librerías externas ────────── */
async function contarPaginasPDF(arrayBuffer) {
  // Buscar el contador de páginas en el PDF binario
  const bytes = new Uint8Array(arrayBuffer)
  const str = new TextDecoder('latin1').decode(bytes)
  // Contar objetos /Page (sin /Pages) para estimar páginas
  const matches = str.match(/\/Type\s*\/Page[^s]/g)
  return matches ? matches.length : 1
}

/* ── Enviar PDF completo a Claude Vision ──────────────────── */
async function visionPDF(arrayBuffer, paginaInicio, paginaFin) {
  // Convertir ArrayBuffer a base64
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  // Procesar en chunks para evitar stack overflow
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  const b64 = btoa(binary)

  const prompt = `Analiza estas hojas de respuesta de examen colombiano (páginas ${paginaInicio} a ${paginaFin}).

INSTRUCCIONES:
- Cada página es una hoja con burbujas A B C D. La burbuja marcada es un CÍRCULO NEGRO SÓLIDO completamente relleno en negro.
- Las burbujas NO marcadas muestran la letra (A, B, C o D) en su interior.
- Las burbujas MARCADAS están completamente rellenas de negro sin letra visible.
- Cada página tiene en la cabecera: "Sesión 1" o "Sesión 2" y el campo "Usuario (No. Documento)".
- Lee TODAS las preguntas en orden: arriba a abajo, izquierda a derecha.

Para cada página extrae:
- usuario: el número de documento
- sesion: 1 o 2
- respuestas: string con la letra de cada burbuja marcada en orden

Responde SOLO JSON sin texto adicional:`

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
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
            { type: 'text', text: prompt },
          ],
        },
        { role: 'assistant', content: '{"paginas":[' },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Claude API ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const txt  = data.content?.find(b => b.type === 'text')?.text || ''
  const full = '{"paginas":[' + txt

  try {
    return JSON.parse(full)
  } catch {
    // Reparar JSON incompleto
    const clean = full.replace(/,\s*$/, '').replace(/}\s*$/, '}') + ']}'
    try { return JSON.parse(clean) }
    catch { return { paginas: [] } }
  }
}

/* ── Agrupar páginas por estudiante ───────────────────────── */
function agruparPorEstudiante(todasLasPaginas) {
  const mapa = {}  // { documento: { s1: "...", s2: "..." } }

  for (const pag of todasLasPaginas) {
    const doc = pag.usuario
    if (!doc) continue
    if (!mapa[doc]) mapa[doc] = { s1: null, s2: null }
    if (pag.sesion === 1) mapa[doc].s1 = pag.respuestas
    if (pag.sesion === 2) mapa[doc].s2 = pag.respuestas
  }

  // Combinar s1 + s2 (lo que haya)
  return Object.entries(mapa).map(([doc, sess]) => ({
    documento:  doc,
    respuestas: (sess.s1 || '') + (sess.s2 || ''),
    tieneS1:    !!sess.s1,
    tieneS2:    !!sess.s2,
  }))
}

/* ══════════════════════════════════════════════════════════ */
export default function AdminResultados({ onUpdate }) {
  const [metodo, setMetodo]         = useState(null)
  const [colegios, setColegios]     = useState([])
  const [pruebas, setPruebas]       = useState([])
  const [colegioId, setColegioId]   = useState('')
  const [pruebaId, setPruebaId]     = useState('')
  const [archivo, setArchivo]       = useState(null)
  const [cargando, setCargando]     = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [progreso, setProgreso]     = useState({ actual:0, total:0, msg:'' })
  const [preview, setPreview]       = useState(null)
  const [guardando, setGuardando]   = useState(false)
  const [confirmar, setConfirmar]   = useState(false)
  const [resultado, setResultado]   = useState(null)
  const [error, setError]           = useState('')
  const [cancelarRef]               = useState({ value: false })
  const [archivos, setArchivos]     = useState([])  // múltiples imágenes
  const [manualDoc, setManualDoc]   = useState('')
  const [manualGrado, setManualGrado] = useState('')
  const [manualRespuestas, setManualRespuestas] = useState('')
  const [manualPreview, setManualPreview] = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    const [colRes, prbRes] = await Promise.all([
      supabase.from('colegios').select('id, nombre, usuario').order('nombre'),
      supabase.from('pruebas').select('*').order('nombre'),
    ])
    setColegios(colRes.data || []); setPruebas(prbRes.data || [])
    setCargando(false)
  }

  function reset() {
    setMetodo(null); setArchivo(null); setPreview(null); setResultado(null)
    setError(''); setColegioId(''); setPruebaId('')
    setProgreso({ actual:0, total:0, msg:'' }); cancelarRef.value = false
  }
  function resetForm() {
    setArchivo(null); setPreview(null); setResultado(null)
    setError(''); setConfirmar(false)
    setProgreso({ actual:0, total:0, msg:'' }); cancelarRef.value = false
    setManualDoc(''); setManualGrado(''); setManualRespuestas(''); setManualPreview('')
    setArchivos([])
  }

  /* ── Procesar TXT ──────────────────────────────────────── */
  async function procesarTXT() {
    setError('')
    if (!colegioId || !pruebaId || !archivo) { setError('Completa todos los campos.'); return }
    setProcesando(true)
    try {
      const texto    = await archivo.text()
      const filasTXT = parsearTXT(texto)
      if (!filasTXT.length) { setError('El archivo no tiene líneas válidas.'); return }

      const prueba = pruebas.find(p => p.id === pruebaId)
      const raw    = prueba?.estructura_excel?.raw
      if (!raw || raw.length < 3) { setError('La prueba no tiene preguntas cargadas.'); return }

      const clave       = raw.slice(2).map(f => (f[9]||'').toString().trim().toUpperCase())
      const areas       = raw.slice(2).map(f => (f[2]||'').toString().trim())
      const asignaturas = raw.slice(2).map(f => (f[3]||'').toString().trim())
      const documentos  = filasTXT.map(f => f.documento)

      const { data: estudiantesDB } = await supabase
        .from('estudiantes').select('id,nombre,usuario,grado,salon,colegio_id')
        .in('usuario', documentos).eq('colegio_id', colegioId)

      const filas = filasTXT.map(f => {
        const est = estudiantesDB?.find(e => e.usuario === f.documento)
        return { documento:f.documento, respuestas:f.respuestas, encontrado:!!est, estudiante:est||null,
          ...calcularResultado(f.respuestas, clave, areas, asignaturas) }
      })

      const ids = filas.filter(f=>f.encontrado).map(f=>f.estudiante.id)
      let yaGuardados = []
      if (ids.length) {
        const { data:ex } = await supabase.from('resultados_estudiante')
          .select('estudiante_id').in('estudiante_id', ids).eq('prueba_id', pruebaId)
        yaGuardados = (ex||[]).map(e=>e.estudiante_id)
      }
      setPreview({ clave, filas: filas.map(f=>({...f, yaGuardado:f.encontrado&&yaGuardados.includes(f.estudiante?.id)})), prueba })
    } catch(e) { setError('Error: ' + e.message) }
    finally { setProcesando(false) }
  }

  /* ── Procesar PDF por lotes ────────────────────────────── */
  async function procesarPDF() {
    setError('')
    if (!colegioId || !pruebaId || !archivo) { setError('Completa todos los campos.'); return }
    setProcesando(true); cancelarRef.value = false

    try {
      const prueba = pruebas.find(p => p.id === pruebaId)
      const raw    = prueba?.estructura_excel?.raw
      if (!raw || raw.length < 3) { setError('La prueba no tiene preguntas cargadas.'); return }

      const clave       = raw.slice(2).map(f => (f[9]||'').toString().trim().toUpperCase())
      const areas       = raw.slice(2).map(f => (f[2]||'').toString().trim())
      const asignaturas = raw.slice(2).map(f => (f[3]||'').toString().trim())

      // 1. Analizar PDF y enviarlo directamente a Claude Vision
      setProgreso({ actual:0, total:0, msg:'📂 Leyendo PDF…' })
      const arrayBuffer = await archivo.arrayBuffer()
      const totalPag    = await contarPaginasPDF(arrayBuffer)

      setProgreso({ actual:0, total:1, msg:`📋 ~${totalPag} páginas detectadas. Enviando a Claude Vision…` })
      await new Promise(r => setTimeout(r, 300))

      // 2. Enviar PDF completo a Claude Vision
      const todasLasPaginas = []
      setProgreso({ actual:1, total:1, msg:`🔍 Claude Vision leyendo ${totalPag} página(s) — ${(archivo.size/1024/1024).toFixed(1)} MB…` })

      try {
        const resultado = await visionPDF(arrayBuffer, 1, totalPag)
        todasLasPaginas.push(...(resultado.paginas || []))
      } catch(e) {
        setError('Error al leer el PDF: ' + e.message)
        setProcesando(false)
        return
      }

      // 3. Agrupar por estudiante
      setProgreso({ actual:1, total:1, msg:'📊 Agrupando respuestas por estudiante…' })
      const estudiantesLeidos = agruparPorEstudiante(todasLasPaginas)

      // 4. Buscar en Supabase
      setProgreso({ actual:1, total:1, msg:'🔎 Buscando estudiantes en el sistema…' })
      const documentos = estudiantesLeidos.map(e => e.documento).filter(Boolean)
      const { data: estudiantesDB } = await supabase
        .from('estudiantes').select('id,nombre,usuario,grado,salon,colegio_id')
        .in('usuario', documentos).eq('colegio_id', colegioId)

      // 5. Calcular resultados
      const filas = estudiantesLeidos.map(e => {
        const est  = estudiantesDB?.find(db => db.usuario === e.documento)
        const calc = calcularResultado(e.respuestas, clave, areas, asignaturas)
        return {
          documento:  e.documento,
          respuestas: e.respuestas,
          encontrado: !!est,
          estudiante: est || null,
          tieneS1:    e.tieneS1,
          tieneS2:    e.tieneS2,
          ...calc,
        }
      })

      // 6. Verificar ya guardados
      const ids = filas.filter(f=>f.encontrado).map(f=>f.estudiante.id)
      let yaGuardados = []
      if (ids.length) {
        const { data:ex } = await supabase.from('resultados_estudiante')
          .select('estudiante_id').in('estudiante_id', ids).eq('prueba_id', pruebaId)
        yaGuardados = (ex||[]).map(e=>e.estudiante_id)
      }

      setProgreso({ actual:1, total:1, msg:`✅ Completado — ${filas.length} estudiante(s) detectados` })
      setPreview({
        clave, prueba, via:'pdf',
        filas: filas.map(f=>({...f, yaGuardado:f.encontrado&&yaGuardados.includes(f.estudiante?.id)})),
        paginasNoLeidas: todasLasPaginas.filter(p=>!p.usuario).length,
      })
      // Agrupar por estudiante
      setProgreso({ actual:total, total, msg:'📊 Agrupando respuestas por estudiante…' })
      const estudiantesLeidos = agruparPorEstudiante(todasLasPaginas)

      // Buscar en Supabase
      setProgreso({ actual:total, total, msg:'🔎 Buscando estudiantes en el sistema…' })
      const documentos = estudiantesLeidos.map(e => e.documento).filter(Boolean)
      const { data: estudiantesDB } = await supabase
        .from('estudiantes').select('id,nombre,usuario,grado,salon,colegio_id')
        .in('usuario', documentos).eq('colegio_id', colegioId)

      const filas = estudiantesLeidos.map(e => {
        const est  = estudiantesDB?.find(db => db.usuario === e.documento)
        const calc = calcularResultado(e.respuestas, clave, areas, asignaturas)
        return { documento:e.documento, respuestas:e.respuestas, encontrado:!!est,
          estudiante:est||null, tieneS1:e.tieneS1, tieneS2:e.tieneS2, ...calc }
      })

      const ids = filas.filter(f=>f.encontrado).map(f=>f.estudiante.id)
      let yaGuardados = []
      if (ids.length) {
        const { data:ex } = await supabase.from('resultados_estudiante')
          .select('estudiante_id').in('estudiante_id', ids).eq('prueba_id', pruebaId)
        yaGuardados = (ex||[]).map(e=>e.estudiante_id)
      }

      setProgreso({ actual:total, total, msg:`✅ Completado — ${filas.length} estudiante(s) detectados` })
      setPreview({
        clave, prueba, via:'fotos',
        filas: filas.map(f=>({...f, yaGuardado:f.encontrado&&yaGuardados.includes(f.estudiante?.id)})),
        paginasNoLeidas: todasLasPaginas.filter(p=>!p.usuario).length,
      })
    } catch(e) { setError('Error al procesar las fotos: ' + e.message) }
    finally { setProcesando(false) }
  }

  const metodoActivo = METODOS.find(m => m.id === metodo)
  const pruebaActiva = pruebas.find(p => p.id === pruebaId)
  const listo        = colegioId && pruebaId && (metodo === 'manual' ? manualDoc && manualRespuestas : metodo === 'fotos' ? archivos.length > 0 : archivo)
  const pctProgreso  = progreso.total > 0 ? Math.round((progreso.actual / progreso.total) * 100) : 0

  /* ── Pantalla 1 ────────────────────────────────────────── */
  if (!metodo) return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, color:C.navy, margin:'0 0 4px' }}>Cargar Resultados</h2>
      <p style={{ fontSize:14, color:C.gray, margin:'0 0 24px' }}>Elige cómo vas a subir los resultados de la prueba aplicada.</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:18 }}>
        {METODOS.map(m => (
          <button key={m.id} onClick={()=>setMetodo(m.id)} style={{
            textAlign:'left', cursor:'pointer', background:C.white,
            border:`1px solid ${C.grayLt}`, borderRadius:14, padding:'24px 24px 26px',
            transition:'all .15s', boxShadow:'0 1px 3px rgba(10,31,61,.05)',
          }}
          onMouseEnter={e=>{ e.currentTarget.style.borderColor=C.green; e.currentTarget.style.boxShadow='0 6px 18px rgba(45,155,111,.15)' }}
          onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.grayLt; e.currentTarget.style.boxShadow='0 1px 3px rgba(10,31,61,.05)' }}>
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

  /* ── Pantalla 3: resumen final ─────────────────────────── */
  if (resultado) return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, color:C.navy, margin:'0 0 24px' }}>✅ Resultados guardados</h2>
      <Card style={{ maxWidth:500 }}>
        {[
          { label:'Estudiantes procesados',       val:resultado.total,         color:C.navy  },
          { label:'Guardados correctamente',       val:resultado.guardados,     color:C.green },
          { label:'No encontrados en el colegio', val:resultado.noEncontrados, color:resultado.noEncontrados>0?C.amber:C.gray },
          { label:'Errores al guardar',            val:resultado.errores,       color:resultado.errores>0?C.red:C.gray },
        ].map((r,i)=>(
          <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'12px 0', borderBottom:i<3?`1px solid ${C.bg2}`:'none' }}>
            <span style={{ fontSize:14, color:C.text }}>{r.label}</span>
            <span style={{ fontSize:18, fontWeight:700, color:r.color }}>{r.val}</span>
          </div>
        ))}
        <button onClick={reset} style={{ marginTop:20, width:'100%', padding:'12px', borderRadius:10,
          background:C.navy, color:C.white, border:'none', cursor:'pointer', fontSize:14, fontWeight:600 }}>
          Cargar más resultados
        </button>
      </Card>
    </div>
  )

  /* ── Pantalla 2b: preview ──────────────────────────────── */
  if (preview) return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <button onClick={resetForm} style={{ cursor:'pointer', border:`1px solid ${C.grayLt}`, background:C.white,
          borderRadius:8, padding:'6px 12px', fontSize:13, color:C.gray, fontWeight:600 }}>← Volver</button>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.navy, margin:0 }}>Vista previa de resultados</h2>
      </div>

      {/* Tarjetas resumen */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        {[
          { label:'Estudiantes detectados', val:preview.filas.length,                          color:C.navy  },
          { label:'Encontrados',            val:preview.filas.filter(f=>f.encontrado).length,  color:C.green },
          { label:'No encontrados',         val:preview.filas.filter(f=>!f.encontrado).length, color:C.amber },
          ...(preview.paginasNoLeidas > 0 ? [{ label:'Páginas no leídas', val:preview.paginasNoLeidas, color:C.red }] : []),
        ].map((s,i)=>(
          <div key={i} style={{ background:C.white, border:`1px solid ${C.grayLt}`, borderRadius:10, padding:'12px 18px', minWidth:140 }}>
            <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <Card style={{ padding:0, overflow:'hidden', marginBottom:20 }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter', fontSize:13 }}>
            <thead>
              <tr style={{ background:C.navy }}>
                {['Documento','Nombre','Grado','Salón','Sesiones','Correctas','Puntaje','Nivel','Estado'].map(h=>(
                  <th key={h} style={{ padding:'11px 14px', color:'rgba(255,255,255,0.8)', fontWeight:600, textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.filas.map((f,i)=>(
                <tr key={i} style={{ background:i%2===0?C.white:C.bg, opacity:f.encontrado?1:0.6 }}>
                  <td style={{ padding:'10px 14px', color:C.text }}>{f.documento}</td>
                  <td style={{ padding:'10px 14px', color:C.text, fontWeight:500 }}>{f.encontrado?f.estudiante.nombre:'—'}</td>
                  <td style={{ padding:'10px 14px', color:C.gray }}>{f.estudiante?.grado||'—'}</td>
                  <td style={{ padding:'10px 14px', color:C.gray }}>{f.estudiante?.salon||'—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ fontSize:11 }}>
                      {f.tieneS1 ? '✅S1' : '⚠️S1'} {f.tieneS2 ? '✅S2' : '⚠️S2'}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px', color:C.text, fontWeight:600 }}>{f.correctas}/{f.total}</td>
                  <td style={{ padding:'10px 14px', color:C.navy, fontWeight:700 }}>{f.puntaje}</td>
                  <td style={{ padding:'10px 14px' }}><Badge pct={f.porcentaje}/></td>
                  <td style={{ padding:'10px 14px' }}>
                    {f.yaGuardado
                      ? <span style={{color:C.amber,fontWeight:600,fontSize:12}}>⚠ Ya existe</span>
                      : f.encontrado
                        ? <span style={{color:C.green,fontWeight:600,fontSize:12}}>✦ Nuevo</span>
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
          ⚠️ Los estudiantes "No hallados" no se guardarán. Verifica que estén registrados en el colegio.
        </div>
      )}
      {preview.filas.some(f=>f.yaGuardado) && !confirmar && (
        <div style={{ padding:'14px 16px', background:'#FEF3C7', borderRadius:9, fontSize:13, color:'#92400E', marginBottom:12,
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <span>⚠️ <strong>{preview.filas.filter(f=>f.yaGuardado).length} estudiante(s)</strong> ya tienen resultados. ¿Deseas sobreescribirlos?</span>
          <button onClick={()=>setConfirmar(true)} style={{ padding:'7px 16px', borderRadius:8, border:'none',
            cursor:'pointer', background:'#92400E', color:'white', fontWeight:700, fontSize:12 }}>Sí, sobreescribir</button>
        </div>
      )}
      {preview.filas.some(f=>f.yaGuardado) && confirmar && (
        <div style={{ padding:'12px 16px', background:'#D1FAE5', borderRadius:9, fontSize:13, color:'#065F46', marginBottom:12 }}>
          ✓ Confirmado — los resultados existentes serán reemplazados.
        </div>
      )}
      {error && <div style={{ padding:'12px 16px', background:'#FEE2E2', borderRadius:9, fontSize:13, color:C.red, marginBottom:16 }}>{error}</div>}

      <div style={{ display:'flex', gap:12 }}>
        <button onClick={resetForm} style={{ padding:'12px 24px', borderRadius:10, border:`1px solid ${C.grayLt}`,
          background:C.white, color:C.gray, fontSize:14, fontWeight:600, cursor:'pointer' }}>Cancelar</button>
        <button onClick={guardar}
          disabled={guardando||preview.filas.filter(f=>f.encontrado).length===0||(preview.filas.some(f=>f.yaGuardado)&&!confirmar)}
          style={{ padding:'12px 32px', borderRadius:10, border:'none', fontSize:14, fontWeight:700,
            cursor:guardando?'wait':'pointer',
            background:preview.filas.filter(f=>f.encontrado).length===0?C.grayLt:C.green, color:C.white }}>
          {guardando?'Guardando…':`Guardar ${preview.filas.filter(f=>f.encontrado).length} resultado(s)`}
        </button>
      </div>
    </div>
  )

  /* ── Pantalla 2: formulario ────────────────────────────── */
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
        <button onClick={reset} style={{ cursor:'pointer', border:`1px solid ${C.grayLt}`, background:C.white,
          borderRadius:8, padding:'6px 12px', fontSize:13, color:C.gray, fontWeight:600 }}>← Cambiar método</button>
      </div>
      <h2 style={{ fontSize:22, fontWeight:700, color:C.navy, margin:'10px 0 4px' }}>{metodoActivo.icon} {metodoActivo.titulo}</h2>
      <p style={{ fontSize:14, color:C.gray, margin:'0 0 24px' }}>{metodoActivo.desc}</p>

      <Card style={{ maxWidth:640 }}>
        <div style={{ marginBottom:18 }}>
          <Label>Colegio</Label>
          <select style={selectStyle} value={colegioId} onChange={e=>{setColegioId(e.target.value);resetForm()}} disabled={cargando}>
            <option value="">{cargando?'Cargando…':'Selecciona un colegio'}</option>
            {colegios.map(c=><option key={c.id} value={c.id}>{c.nombre}{c.usuario?` (${c.usuario})`:''}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:18 }}>
          <Label>Prueba y referencia</Label>
          <select style={selectStyle} value={pruebaId} onChange={e=>{setPruebaId(e.target.value);resetForm()}} disabled={cargando}>
            <option value="">{cargando?'Cargando…':'Selecciona la prueba'}</option>
            {pruebas.map(p=><option key={p.id} value={p.id}>{p.nombre}{p.referencia?` — ${p.referencia}`:''}</option>)}
          </select>
          {pruebaActiva && (
            <div style={{ fontSize:12, color:C.green, marginTop:6, fontWeight:600 }}>
              ✓ {(pruebaActiva.estructura_excel?.raw?.length||0)-2} preguntas cargadas
            </div>
          )}
        </div>

        {metodo !== 'manual' && metodo !== 'fotos' && (
        <div style={{ marginBottom:6 }}>
          <Label>{metodo==='optico'?'Archivo del lector óptico (.txt)':'Hojas escaneadas (.pdf)'}</Label>
          <input type="file" accept={metodoActivo.accept}
            onChange={e=>{setArchivo(e.target.files[0]||null);setPreview(null);setError('')}}
            style={{ width:'100%', padding:'10px 12px', borderRadius:9, fontSize:13.5,
              border:`1px dashed ${C.grayLt}`, background:C.bg, color:C.text }} />
          <p style={{ fontSize:12, color:C.gray, margin:'8px 0 0' }}>
            {metodo==='optico'
              ? <><code>documento;cadena_de_respuestas</code> — una línea por estudiante.</>
              : `PDF con todas las hojas en orden. Procesa ${PAGINAS_POR_LOTE} páginas por lote (~${PAGINAS_POR_LOTE/2} estudiantes). Soporta hojas incompletas.`}
          <div style={{ marginTop:10, padding:'10px 14px', background:'#EFF6FF', borderRadius:8,
            fontSize:12, color:'#1D4ED8', lineHeight:1.6 }}>
            💡 <strong>Recomendación de escaneo:</strong> usa <strong>150 DPI en blanco y negro</strong>.
            Suficiente para que el sistema lea las burbujas correctamente y el archivo no pese demasiado.
            Evita 300 DPI o más — no mejora la lectura pero puede hacer el PDF muy pesado.
          </div>
          </p>
        </div>

        )}
        {archivo && (
          <div style={{ marginTop:12, padding:'10px 14px', background:C.bg2, borderRadius:9,
            fontSize:13, color:C.text, display:'flex', justifyContent:'space-between' }}>
            <span>📄 {archivo.name}</span>
            <span style={{ color:C.gray }}>{(archivo.size/1024/1024).toFixed(1)} MB</span>
          </div>
        )}

        {/* Barra de progreso */}
        {procesando && (
          <div style={{ marginTop:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12 }}>
              <span style={{ color:C.navy, fontWeight:600 }}>{progreso.msg}</span>
              {progreso.total > 0 && <span style={{ color:C.gray }}>{pctProgreso}%</span>}
            </div>
            {progreso.total > 0 && (
              <div style={{ background:C.bg2, borderRadius:99, height:10, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:99, background:C.green,
                  width:`${pctProgreso}%`, transition:'width 0.4s ease' }}/>
              </div>
            )}
            {metodo==='pdf' && (
              <button onClick={()=>{ cancelarRef.value = true }}
                style={{ marginTop:10, padding:'6px 16px', borderRadius:8,
                  border:`1px solid ${C.red}`, background:'transparent',
                  color:C.red, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                ⛔ Cancelar
              </button>
            )}
          </div>
        )}

        {error && <div style={{ marginTop:14, padding:'12px 14px', background:'#FEE2E2',
          borderRadius:9, fontSize:13, color:C.red }}>{error}</div>}

        {/* Formulario manual */}
        {metodo === 'manual' && (
          <div>
            <div style={{ marginBottom:18 }}>
              <Label>Número de documento del estudiante</Label>
              <input type="text" value={manualDoc}
                onChange={e => { setManualDoc(e.target.value); setPreview(null); setError('') }}
                placeholder="Ej: 1098765432"
                style={{ ...selectStyle, padding:'11px 13px' }} />
            </div>

            <div style={{ marginBottom:18 }}>
              <Label>Respuestas</Label>
              <div style={{ fontSize:12, color:C.gray, marginBottom:8, lineHeight:1.6 }}>
                Puedes usar números o letras indistintamente:<br/>
                <strong style={{color:C.navy}}>0 = A &nbsp;·&nbsp; 1 = B &nbsp;·&nbsp; 2 = C &nbsp;·&nbsp; 3 = D</strong><br/>
                Ejemplo: <code>0132</code> → <strong>ABDC</strong> &nbsp;|&nbsp; <code>ABDC</code> también es válido
              </div>
              <textarea
                value={manualRespuestas}
                onChange={e => onManualChange(e.target.value)}
                placeholder="Ingresa las respuestas: ej. 013201320132..."
                rows={5}
                style={{ width:'100%', padding:'11px 13px', borderRadius:9, fontSize:14,
                  border:`1px solid ${C.grayLt}`, background:C.white, color:C.text,
                  outline:'none', resize:'vertical', fontFamily:'monospace', letterSpacing:'0.08em' }}
              />
              {manualPreview && (
                <div style={{ marginTop:8, padding:'10px 14px', background:C.bg2, borderRadius:8 }}>
                  <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>Vista previa de respuestas ({manualPreview.length} preguntas):</div>
                  <div style={{ fontFamily:'monospace', fontSize:13, color:C.navy, letterSpacing:'0.1em', wordBreak:'break-all' }}>
                    {manualPreview}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Formulario fotos */}
        {metodo === 'fotos' && (
          <div style={{ marginBottom:6 }}>
            <Label>Selecciona las fotos de las hojas de respuesta</Label>
            <input type="file" accept="image/jpeg,image/png,image/jpg" multiple
              onChange={e => { setArchivos(Array.from(e.target.files)); setPreview(null); setError('') }}
              style={{ width:'100%', padding:'10px 12px', borderRadius:9, fontSize:13.5,
                border:`1px dashed ${C.grayLt}`, background:C.bg, color:C.text }} />
            <p style={{ fontSize:12, color:C.gray, margin:'8px 0 0' }}>
              Puedes seleccionar varias imágenes a la vez (JPG o PNG). Una imagen por hoja de respuesta.
              Mantén presionado <strong>Cmd</strong> para seleccionar múltiples archivos.
            </p>
            {archivos.length > 0 && (
              <div style={{ marginTop:10, padding:'10px 14px', background:C.bg2, borderRadius:9 }}>
                <div style={{ fontSize:12, color:C.navy, fontWeight:700, marginBottom:6 }}>
                  📷 {archivos.length} imagen(es) seleccionada(s):
                </div>
                <div style={{ maxHeight:120, overflowY:'auto' }}>
                  {archivos.map((f,i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between',
                      fontSize:12, color:C.text, padding:'2px 0', borderBottom:`1px solid ${C.bg2}` }}>
                      <span>📄 {f.name}</span>
                      <span style={{ color:C.gray }}>{(f.size/1024).toFixed(0)} KB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop:24, borderTop:`1px solid ${C.bg2}`, paddingTop:20 }}>
          <button disabled={!listo||procesando} onClick={metodo==='optico'?procesarTXT:metodo==='pdf'?procesarPDF:metodo==='fotos'?procesarFotos:procesarManual}
            style={{ width:'100%', padding:'13px', borderRadius:10, fontSize:15, fontWeight:700,
              border:'none', cursor:listo&&!procesando?'pointer':'not-allowed',
              background:listo&&!procesando?C.green:C.grayLt,
              color:listo&&!procesando?C.white:C.gray }}>
            {procesando
              ? (metodo==='pdf'?`Procesando lote ${progreso.actual}/${progreso.total}…`:metodo==='fotos'?`Procesando imagen ${progreso.actual}/${progreso.total}…`:'Procesando…')
              : (metodo==='pdf'?'Procesar hojas con Claude Vision':metodo==='fotos'?'Procesar fotos con Claude Vision':'Procesar archivo')}
          </button>
        </div>
      </Card>
    </div>
  )
}
