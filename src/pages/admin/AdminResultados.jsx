import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

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
async function extraerPaginas(arrayBuffer) {
  const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js')
  const pdfDoc    = await PDFDocument.load(arrayBuffer)
  const totalPag  = pdfDoc.getPageCount()
  const paginas   = []

  for (let i = 0; i < totalPag; i++) {
    const subDoc  = await PDFDocument.create()
    const [copia] = await subDoc.copyPages(pdfDoc, [i])
    subDoc.addPage(copia)
    const bytes   = await subDoc.save()
    // Convertir a base64
    let binary = ''
    bytes.forEach(b => binary += String.fromCharCode(b))
    paginas.push(btoa(binary))
  }
  return paginas  // array de strings base64, una por página
}

/* ── Llamar a Claude Vision con un lote de páginas ────────── */
async function visionLote(paginasB64) {
  const content = []

  // Agregar cada página como documento
  paginasB64.forEach((b64, idx) => {
    content.push({
      type: 'text',
      text: `--- PÁGINA ${idx + 1} ---`,
    })
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: b64 },
    })
  })

  content.push({
    type: 'text',
    text: `Analiza estas ${paginasB64.length} páginas de hojas de respuesta de examen colombiano.

Cada página es una hoja de respuesta con burbujas marcadas (círculos negros sólidos = respuesta elegida).
Cada página tiene: número de sesión (1 o 2), número de documento del estudiante, y respuestas por pregunta.

Para CADA página extrae:
- usuario: número de documento (campo "Usuario (No. Documento)")  
- sesion: 1 o 2
- respuestas: string con la letra marcada de cada pregunta en orden estricto (ej: "AACBBDCA...")

Si una burbuja no está marcada o es ilegible, usa "X".

Responde ÚNICAMENTE en JSON sin texto adicional ni bloques de código:
{
  "paginas": [
    { "usuario": "1098765432", "sesion": 1, "respuestas": "AACBB..." },
    { "usuario": "1098765432", "sesion": 2, "respuestas": "BCDAA..." },
    { "usuario": "1087654321", "sesion": 1, "respuestas": "CDAAB..." }
  ]
}`,
  })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const txt  = data.content?.find(b => b.type === 'text')?.text || ''
  return JSON.parse(txt.replace(/```json|```/g, '').trim())
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

      // 1. Extraer páginas individuales
      setProgreso({ actual:0, total:0, msg:'📂 Extrayendo páginas del PDF…' })
      const arrayBuffer = await archivo.arrayBuffer()
      const paginas     = await extraerPaginas(arrayBuffer)
      const totalPag    = paginas.length
      const totalLotes  = Math.ceil(totalPag / PAGINAS_POR_LOTE)

      setProgreso({ actual:0, total:totalLotes, msg:`📋 ${totalPag} páginas → ${totalLotes} lotes de ${PAGINAS_POR_LOTE}. Iniciando…` })
      await new Promise(r => setTimeout(r, 500))

      // 2. Procesar lotes
      const todasLasPaginas = []
      for (let i = 0; i < totalLotes; i++) {
        if (cancelarRef.value) break

        const inicio  = i * PAGINAS_POR_LOTE
        const lote    = paginas.slice(inicio, inicio + PAGINAS_POR_LOTE)
        const numPag  = inicio + 1
        const finPag  = Math.min(inicio + PAGINAS_POR_LOTE, totalPag)

        setProgreso({
          actual: i + 1, total: totalLotes,
          msg: `🔍 Lote ${i+1}/${totalLotes} — páginas ${numPag}–${finPag} (${lote.length} páginas, ~${Math.round(lote.length/2)} estudiantes)`,
        })

        try {
          const resultado = await visionLote(lote)
          todasLasPaginas.push(...(resultado.paginas || []))
        } catch(e) {
          // Si un lote falla, registrar y continuar con el siguiente
          console.warn(`Lote ${i+1} falló:`, e.message)
          for (let p = 0; p < lote.length; p++) {
            todasLasPaginas.push({ usuario: null, sesion: null, respuestas: '', error: e.message })
          }
        }

        // Pausa entre lotes para respetar rate limits
        if (i < totalLotes - 1) await new Promise(r => setTimeout(r, 300))
      }

      // 3. Agrupar por estudiante
      setProgreso({ actual:totalLotes, total:totalLotes, msg:'📊 Agrupando respuestas por estudiante…' })
      const estudiantesLeidos = agruparPorEstudiante(todasLasPaginas)

      // 4. Buscar en Supabase
      setProgreso({ actual:totalLotes, total:totalLotes, msg:'🔎 Buscando estudiantes en el sistema…' })
      const documentos = estudiantesLeidos.map(e => e.documento).filter(Boolean)
      const { data: estudiantesDB } = await supabase
        .from('estudiantes').select('id,nombre,usuario,grado,salon,colegio_id')
        .in('usuario', documentos).eq('colegio_id', colegioId)

      // 5. Calcular resultados
      const filas = estudiantesLeidos.map(e => {
        const est = estudiantesDB?.find(db => db.usuario === e.documento)
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

      const cancelado = cancelarRef.value
      setProgreso({ actual:totalLotes, total:totalLotes,
        msg: cancelado ? '⛔ Procesamiento cancelado' : `✅ Completado — ${filas.length} estudiante(s) detectados` })

      setPreview({
        clave, prueba, via:'pdf',
        filas: filas.map(f=>({...f, yaGuardado:f.encontrado&&yaGuardados.includes(f.estudiante?.id)})),
        paginasNoLeidas: todasLasPaginas.filter(p=>!p.usuario).length,
      })
    } catch(e) { setError('Error al procesar el PDF: ' + e.message) }
    finally { setProcesando(false) }
  }

  /* ── Guardar ───────────────────────────────────────────── */
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
          detalle:f.detalle, cargado_via: preview.via || 'optico',
        }, { onConflict:'estudiante_id,prueba_id' })
        if (err) errores++; else guardados++
      }
      setResultado({ guardados, errores,
        noEncontrados:preview.filas.filter(f=>!f.encontrado).length, total:preview.filas.length })
      setPreview(null)
      if (onUpdate) onUpdate()
    } catch(e) { setError('Error guardando: ' + e.message) }
    finally { setGuardando(false) }
  }

  const metodoActivo = METODOS.find(m => m.id === metodo)
  const pruebaActiva = pruebas.find(p => p.id === pruebaId)
  const listo        = colegioId && pruebaId && archivo
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

        <div style={{ marginTop:24, borderTop:`1px solid ${C.bg2}`, paddingTop:20 }}>
          <button disabled={!listo||procesando} onClick={metodo==='optico'?procesarTXT:procesarPDF}
            style={{ width:'100%', padding:'13px', borderRadius:10, fontSize:15, fontWeight:700,
              border:'none', cursor:listo&&!procesando?'pointer':'not-allowed',
              background:listo&&!procesando?C.green:C.grayLt,
              color:listo&&!procesando?C.white:C.gray }}>
            {procesando
              ? (metodo==='pdf'?`Procesando lote ${progreso.actual}/${progreso.total}…`:'Procesando…')
              : (metodo==='pdf'?'Procesar hojas con Claude Vision':'Procesar archivo')}
          </button>
        </div>
      </Card>
    </div>
  )
}
