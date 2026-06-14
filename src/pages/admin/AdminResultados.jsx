import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const C = {
  navy:'#0A1F3D', green:'#2D9B6F', greenLt:'#3AB882',
  bg:'#F8F9FB', bg2:'#EFF1F5', white:'#FFFFFF',
  text:'#1A1A2E', gray:'#6B7280', grayLt:'#D1D5DB',
  red:'#E05252', amber:'#F59E0B',
}

const METODOS = [
  {
    id:'optico',
    icon:'🧾',
    titulo:'Lector óptico',
    sub:'Archivo .txt',
    desc:'Sube el archivo de texto que exporta el lector óptico. Cada línea es un estudiante con su cadena de respuestas. Es el método más confiable.',
    accept:'.txt',
    badge:'Recomendado',
  },
  {
    id:'pdf',
    icon:'📄',
    titulo:'Hojas escaneadas',
    sub:'Archivo .pdf — Claude Vision',
    desc:'Sube las hojas de respuesta escaneadas en PDF. El sistema leerá las burbujas marcadas con Claude Vision. Útil cuando no hay archivo del lector óptico.',
    accept:'.pdf',
    badge:'IA',
  },
]

function Card({ children, style }) {
  return (
    <div style={{
      background:C.white, borderRadius:14, padding:'24px 26px',
      border:`1px solid ${C.grayLt}`, boxShadow:'0 1px 3px rgba(10,31,61,.05)',
      ...style,
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

/* ── Pesos por área ───────────────────────────────────────── */
const PESOS_AREA = {
  'Matemáticas':      3,
  'Lectura Crítica':  3,
  'Ciencias Sociales':3,
  'Ciencias Naturales':3,
  'Inglés':           1,
}
function pesoArea(area) { return PESOS_AREA[area] || 1 }

const ASIG_COLUMNA = {
  'Contenidos genéricos':           'mat_cuantitativo',
  'Contenidos no genéricos':        'mat_especifico',
  'Química':                        'cn_quimica',
  'Física':                         'cn_fisica',
  'Biología':                       'cn_biologia',
  'Ciencia, Tecnología y Sociedad': 'cn_cts',
  'Ciencias Sociales':              'sociales',
  'Competencias Ciudadanas':        'ciudadanas',
  'Lectura Crítica':                'lectura_critica',
  'Inglés':                         'ingles',
}

function calcularResultado(respuestasEstudiante, clave, areas, asignaturas) {
  const detalle = []
  const porArea  = {}
  const porAsig  = {}
  for (let i = 0; i < clave.length; i++) {
    const marcada    = (respuestasEstudiante[i] || 'X').toUpperCase()
    const correcta   = (clave[i] || '').toUpperCase()
    const area       = areas       ? (areas[i]       || 'Sin área') : 'Sin área'
    const asignatura = asignaturas ? (asignaturas[i] || '')         : ''
    const esCorrecto = marcada === correcta && marcada !== 'X'
    if (!porArea[area]) porArea[area] = { correctas:0, total:0, peso: pesoArea(area) }
    porArea[area].total++
    if (esCorrecto) porArea[area].correctas++
    if (!porAsig[asignatura]) porAsig[asignatura] = { correctas:0, total:0 }
    porAsig[asignatura].total++
    if (esCorrecto) porAsig[asignatura].correctas++
    detalle.push({ pregunta:i+1, marcada, correcta, correcto:esCorrecto, area, asignatura })
  }
  let sumaPonderada = 0, sumaPesos = 0
  for (const [, d] of Object.entries(porArea)) {
    const pct = d.total > 0 ? d.correctas / d.total : 0
    sumaPonderada += pct * d.peso
    sumaPesos     += d.peso
  }
  const correctas  = detalle.filter(d => d.correcto).length
  const total      = clave.length
  const porcentaje = sumaPesos > 0 ? Math.round((sumaPonderada / sumaPesos) * 100) : 0
  const puntaje    = Math.round(porcentaje * 5)
  const pctAsig = {}
  for (const [asig, d] of Object.entries(porAsig)) {
    const col = ASIG_COLUMNA[asig]
    if (col) pctAsig[col] = d.total > 0 ? Math.round((d.correctas / d.total) * 100) : 0
  }
  return { correctas, total, puntaje, porcentaje, detalle, porArea, pctAsig }
}

function parsearTXT(texto) {
  const lineas = texto.trim().split('\n').filter(l => l.trim())
  return lineas.map(linea => {
    const partes = linea.trim().split(';')
    return {
      documento:  partes[0]?.trim(),
      respuestas: partes[partes.length - 1]?.trim(),
    }
  }).filter(e => e.documento && e.respuestas)
}

function Badge({ pct }) {
  const color = pct >= 65 ? C.green : pct >= 45 ? C.amber : pct >= 25 ? C.amber : C.red
  const nivel = pct >= 65 ? 'Avanzado' : pct >= 45 ? 'Satisfactorio' : pct >= 25 ? 'Mínimo' : 'Insuficiente'
  return (
    <span style={{
      background: color + '22', color, fontSize:11, fontWeight:700,
      padding:'2px 9px', borderRadius:20,
    }}>{nivel} ({pct}%)</span>
  )
}

/* ── Claude Vision: leer PDF ──────────────────────────────── */
async function leerPDFconVision(archivo) {
  // Convertir PDF a base64
  const arrayBuffer = await archivo.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const b64 = btoa(binary)

  const prompt = `Eres un sistema de lectura de hojas de respuesta de examen colombiano.
Analiza este PDF que contiene hojas de respuesta con burbujas marcadas (círculos negros sólidos).

Para CADA sesión que encuentres, extrae:
1. El usuario/documento del estudiante (número de 10 dígitos en el campo "Usuario (No. Documento)")
2. Las respuestas marcadas de cada pregunta en orden

Una burbuja marcada aparece como un círculo negro sólido. Las opciones son A, B, C, D.
Para cada pregunta indica la letra cuya burbuja está completamente rellena en negro.

Responde ÚNICAMENTE en JSON con este formato exacto (sin texto adicional, sin bloques de código):
{
  "sesiones": [
    {
      "numero": 1,
      "usuario": "1098765432",
      "respuestas": "AACBBBAADAAA..."
    },
    {
      "numero": 2,
      "usuario": "1098765432",
      "respuestas": "BACDAA..."
    }
  ]
}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: b64 },
          },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })

  if (!response.ok) throw new Error(`Error API Claude: ${response.status}`)
  const data = await response.json()
  const texto = data.content?.find(b => b.type === 'text')?.text || ''

  // Limpiar y parsear JSON
  const clean = texto.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

export default function AdminResultados({ onUpdate }) {
  const [metodo, setMetodo]         = useState(null)
  const [colegios, setColegios]     = useState([])
  const [pruebas, setPruebas]       = useState([])
  const [colegioId, setColegioId]   = useState('')
  const [pruebaId, setPruebaId]     = useState('')
  const [archivo, setArchivo]       = useState(null)
  const [cargando, setCargando]     = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [pasoVision, setPasoVision] = useState('')   // mensaje de progreso
  const [preview, setPreview]       = useState(null)
  const [guardando, setGuardando]   = useState(false)
  const [confirmar, setConfirmar]   = useState(false)
  const [resultado, setResultado]   = useState(null)
  const [error, setError]           = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    const [colRes, prbRes] = await Promise.all([
      supabase.from('colegios').select('id, nombre, usuario').order('nombre'),
      supabase.from('pruebas').select('*').order('nombre'),
    ])
    setColegios(colRes.data || [])
    setPruebas(prbRes.data || [])
    setCargando(false)
  }

  function reset() {
    setMetodo(null); setArchivo(null); setPreview(null)
    setResultado(null); setError(''); setColegioId(''); setPruebaId('')
    setPasoVision('')
  }

  function resetForm() {
    setArchivo(null); setPreview(null); setResultado(null)
    setError(''); setConfirmar(false); setPasoVision('')
  }

  /* ── Procesar TXT ─────────────────────────────────────────── */
  async function procesarTXT() {
    setError('')
    if (!colegioId || !pruebaId || !archivo) {
      setError('Completa todos los campos antes de procesar.'); return
    }
    setProcesando(true)
    try {
      const texto = await archivo.text()
      const filasTXT = parsearTXT(texto)
      if (filasTXT.length === 0) {
        setError('El archivo no tiene líneas válidas.'); setProcesando(false); return
      }
      const prueba = pruebas.find(p => p.id === pruebaId)
      const raw = prueba?.estructura_excel?.raw
      if (!raw || raw.length < 3) {
        setError('La prueba seleccionada no tiene preguntas cargadas.'); setProcesando(false); return
      }
      const clave       = raw.slice(2).map(fila => (fila[9] || '').toString().trim().toUpperCase())
      const areas       = raw.slice(2).map(fila => (fila[2] || '').toString().trim())
      const asignaturas = raw.slice(2).map(fila => (fila[3] || '').toString().trim())

      const documentos = filasTXT.map(f => f.documento)
      const { data: estudiantesDB } = await supabase
        .from('estudiantes')
        .select('id, nombre, usuario, grado, salon, colegio_id')
        .in('usuario', documentos)
        .eq('colegio_id', colegioId)

      const filas = filasTXT.map(f => {
        const estudianteDB = estudiantesDB?.find(e => e.usuario === f.documento)
        const resultado    = calcularResultado(f.respuestas, clave, areas, asignaturas)
        return { documento: f.documento, respuestas: f.respuestas, encontrado: !!estudianteDB, estudiante: estudianteDB || null, ...resultado }
      })

      const idsEncontrados = filas.filter(f => f.encontrado).map(f => f.estudiante.id)
      let yaGuardados = []
      if (idsEncontrados.length > 0) {
        const { data: existentes } = await supabase
          .from('resultados_estudiante').select('estudiante_id')
          .in('estudiante_id', idsEncontrados).eq('prueba_id', pruebaId)
        yaGuardados = (existentes || []).map(e => e.estudiante_id)
      }
      setPreview({ clave, filas: filas.map(f => ({ ...f, yaGuardado: f.encontrado && yaGuardados.includes(f.estudiante?.id) })), prueba })
    } catch (e) {
      setError('Error al procesar el archivo: ' + e.message)
    } finally {
      setProcesando(false)
    }
  }

  /* ── Procesar PDF con Claude Vision ──────────────────────── */
  async function procesarPDF() {
    setError('')
    if (!colegioId || !pruebaId || !archivo) {
      setError('Completa todos los campos antes de procesar.'); return
    }
    setProcesando(true)
    try {
      // 1. Obtener clave de la prueba
      const prueba = pruebas.find(p => p.id === pruebaId)
      const raw = prueba?.estructura_excel?.raw
      if (!raw || raw.length < 3) {
        setError('La prueba seleccionada no tiene preguntas cargadas.'); setProcesando(false); return
      }
      const clave       = raw.slice(2).map(fila => (fila[9] || '').toString().trim().toUpperCase())
      const areas       = raw.slice(2).map(fila => (fila[2] || '').toString().trim())
      const asignaturas = raw.slice(2).map(fila => (fila[3] || '').toString().trim())

      // 2. Llamar a Claude Vision
      setPasoVision('📄 Enviando PDF a Claude Vision…')
      const visionResult = await leerPDFconVision(archivo)

      // 3. Combinar sesiones: sesión 1 + sesión 2 = respuestas completas
      setPasoVision('🔍 Procesando respuestas leídas…')
      const sesiones = visionResult.sesiones || []
      const s1 = sesiones.find(s => s.numero === 1)
      const s2 = sesiones.find(s => s.numero === 2)
      if (!s1) throw new Error('No se encontró la Sesión 1 en el PDF.')
      const usuario    = s1.usuario
      const respuestas = (s1.respuestas || '') + (s2?.respuestas || '')

      // 4. Buscar estudiante en Supabase
      setPasoVision('🔎 Buscando estudiante en el sistema…')
      const { data: estudiantesDB } = await supabase
        .from('estudiantes')
        .select('id, nombre, usuario, grado, salon, colegio_id')
        .eq('usuario', usuario)
        .eq('colegio_id', colegioId)

      const estudianteDB = estudiantesDB?.[0] || null

      // 5. Calcular resultado
      const calc = calcularResultado(respuestas, clave, areas, asignaturas)
      const fila = { documento: usuario, respuestas, encontrado: !!estudianteDB, estudiante: estudianteDB, ...calc }

      // 6. Verificar si ya existe
      let yaGuardado = false
      if (estudianteDB) {
        const { data: existente } = await supabase
          .from('resultados_estudiante').select('estudiante_id')
          .eq('estudiante_id', estudianteDB.id).eq('prueba_id', pruebaId)
        yaGuardado = (existente || []).length > 0
      }

      setPasoVision('')
      setPreview({ clave, filas: [{ ...fila, yaGuardado }], prueba, via:'pdf' })
    } catch (e) {
      setError('Error al procesar el PDF: ' + e.message)
      setPasoVision('')
    } finally {
      setProcesando(false)
    }
  }

  /* ── Guardar en Supabase ─────────────────────────────────── */
  async function guardar() {
    if (!preview) return
    setGuardando(true)
    setError('')
    try {
      const filasValidas = preview.filas.filter(f => f.encontrado)
      let guardados = 0, errores = 0

      for (const f of filasValidas) {
        const { error: err } = await supabase
          .from('resultados_estudiante')
          .upsert({
            estudiante_id:    f.estudiante.id,
            prueba_id:        pruebaId,
            colegio_id:       colegioId,
            respuestas:       f.respuestas,
            correctas:        f.correctas,
            total:            f.total,
            desempeno_pct:    f.porcentaje,
            puntaje_global:   f.puntaje,
            mat_cuantitativo: f.pctAsig?.mat_cuantitativo ?? null,
            mat_especifico:   f.pctAsig?.mat_especifico   ?? null,
            cn_quimica:       f.pctAsig?.cn_quimica       ?? null,
            cn_fisica:        f.pctAsig?.cn_fisica         ?? null,
            cn_biologia:      f.pctAsig?.cn_biologia       ?? null,
            cn_cts:           f.pctAsig?.cn_cts            ?? null,
            sociales:         f.pctAsig?.sociales          ?? null,
            ciudadanas:       f.pctAsig?.ciudadanas        ?? null,
            lectura_critica:  f.pctAsig?.lectura_critica   ?? null,
            ingles:           f.pctAsig?.ingles            ?? null,
            detalle:          f.detalle,
            cargado_via:      preview.via || 'optico',
          }, { onConflict: 'estudiante_id,prueba_id' })

        if (err) errores++
        else guardados++
      }

      setResultado({
        guardados, errores,
        noEncontrados: preview.filas.filter(f => !f.encontrado).length,
        total: preview.filas.length,
      })
      setPreview(null)
      if (onUpdate) onUpdate()
    } catch (e) {
      setError('Error guardando: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  const metodoActivo = METODOS.find(m => m.id === metodo)
  const pruebaActiva = pruebas.find(p => p.id === pruebaId)
  const listo = colegioId && pruebaId && archivo

  /* ── Pantalla 1: elegir método ────────────────────────────── */
  if (!metodo) return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, color:C.navy, margin:'0 0 4px' }}>Cargar Resultados</h2>
      <p style={{ fontSize:14, color:C.gray, margin:'0 0 24px' }}>Elige cómo vas a subir los resultados de la prueba aplicada.</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px,1fr))', gap:18 }}>
        {METODOS.map(m => (
          <button key={m.id} onClick={() => setMetodo(m.id)} style={{
            textAlign:'left', cursor:'pointer', background:C.white,
            border:`1px solid ${C.grayLt}`, borderRadius:14, padding:'24px 24px 26px',
            transition:'all .15s', boxShadow:'0 1px 3px rgba(10,31,61,.05)',
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

  /* ── Pantalla 3: resumen final ────────────────────────────── */
  if (resultado) return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, color:C.navy, margin:'0 0 24px' }}>✅ Resultados guardados</h2>
      <Card style={{ maxWidth:500 }}>
        {[
          { label:'Estudiantes en el archivo',    val: resultado.total,         color: C.navy  },
          { label:'Guardados correctamente',       val: resultado.guardados,     color: C.green },
          { label:'No encontrados en el colegio', val: resultado.noEncontrados, color: resultado.noEncontrados > 0 ? C.amber : C.gray },
          { label:'Errores al guardar',            val: resultado.errores,       color: resultado.errores > 0 ? C.red : C.gray },
        ].map((r,i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'12px 0', borderBottom: i < 3 ? `1px solid ${C.bg2}` : 'none' }}>
            <span style={{ fontSize:14, color:C.text }}>{r.label}</span>
            <span style={{ fontSize:18, fontWeight:700, color:r.color }}>{r.val}</span>
          </div>
        ))}
        <button onClick={reset} style={{
          marginTop:20, width:'100%', padding:'12px', borderRadius:10,
          background:C.navy, color:C.white, border:'none', cursor:'pointer',
          fontSize:14, fontWeight:600,
        }}>Cargar más resultados</button>
      </Card>
    </div>
  )

  /* ── Pantalla 2b: vista previa antes de guardar ───────────── */
  if (preview) return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <button onClick={resetForm} style={{
          cursor:'pointer', border:`1px solid ${C.grayLt}`, background:C.white,
          borderRadius:8, padding:'6px 12px', fontSize:13, color:C.gray, fontWeight:600,
        }}>← Volver</button>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.navy, margin:0 }}>Vista previa de resultados</h2>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        {[
          { label:'Total en archivo',  val:preview.filas.length,                          color:C.navy  },
          { label:'Encontrados',       val:preview.filas.filter(f=>f.encontrado).length,  color:C.green },
          { label:'No encontrados',    val:preview.filas.filter(f=>!f.encontrado).length, color:C.amber },
        ].map((s,i) => (
          <div key={i} style={{ background:C.white, border:`1px solid ${C.grayLt}`,
            borderRadius:10, padding:'12px 18px', minWidth:140 }}>
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
                {['Documento','Nombre','Grado','Salón','Correctas','Puntaje','Nivel','Registro','Estado'].map(h => (
                  <th key={h} style={{ padding:'11px 14px', color:'rgba(255,255,255,0.8)',
                    fontWeight:600, textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.filas.map((f, i) => (
                <tr key={i} style={{ background: i%2===0 ? C.white : C.bg, opacity: f.encontrado ? 1 : 0.5 }}>
                  <td style={{ padding:'10px 14px', color:C.text }}>{f.documento}</td>
                  <td style={{ padding:'10px 14px', color:C.text, fontWeight:500 }}>
                    {f.encontrado ? f.estudiante.nombre : '—'}
                  </td>
                  <td style={{ padding:'10px 14px', color:C.gray }}>{f.estudiante?.grado || '—'}</td>
                  <td style={{ padding:'10px 14px', color:C.gray }}>{f.estudiante?.salon || '—'}</td>
                  <td style={{ padding:'10px 14px', color:C.text, fontWeight:600 }}>{f.correctas}/{f.total}</td>
                  <td style={{ padding:'10px 14px', color:C.navy, fontWeight:700 }}>{f.puntaje}</td>
                  <td style={{ padding:'10px 14px' }}><Badge pct={f.porcentaje} /></td>
                  <td style={{ padding:'10px 14px' }}>
                    {f.yaGuardado
                      ? <span style={{ color:C.amber, fontWeight:600, fontSize:12 }}>⚠ Ya existe</span>
                      : f.encontrado
                        ? <span style={{ color:C.green, fontWeight:600, fontSize:12 }}>✦ Nuevo</span>
                        : <span style={{ color:C.gray, fontSize:12 }}>—</span>}
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    {f.encontrado
                      ? <span style={{ color:C.green, fontWeight:600, fontSize:12 }}>✓ Listo</span>
                      : <span style={{ color:C.amber, fontWeight:600, fontSize:12 }}>⚠ No hallado</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {preview.filas.some(f => !f.encontrado) && (
        <div style={{ padding:'12px 16px', background:'#FEF3C7', borderRadius:9,
          fontSize:13, color:'#92400E', marginBottom:12 }}>
          ⚠️ Los estudiantes "No hallados" no se guardarán — verifica que estén registrados en el colegio seleccionado.
        </div>
      )}
      {preview.filas.some(f => f.yaGuardado) && !confirmar && (
        <div style={{ padding:'14px 16px', background:'#FEF3C7', borderRadius:9,
          fontSize:13, color:'#92400E', marginBottom:12,
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <span>⚠️ <strong>{preview.filas.filter(f => f.yaGuardado).length} estudiante(s)</strong> ya tienen resultados para esta prueba. ¿Deseas sobreescribirlos?</span>
          <button onClick={() => setConfirmar(true)} style={{
            padding:'7px 16px', borderRadius:8, border:'none', cursor:'pointer',
            background:'#92400E', color:'white', fontWeight:700, fontSize:12, whiteSpace:'nowrap',
          }}>Sí, sobreescribir</button>
        </div>
      )}
      {preview.filas.some(f => f.yaGuardado) && confirmar && (
        <div style={{ padding:'12px 16px', background:'#D1FAE5', borderRadius:9,
          fontSize:13, color:'#065F46', marginBottom:12 }}>
          ✓ Confirmado — los resultados existentes serán reemplazados.
        </div>
      )}

      {error && <div style={{ padding:'12px 16px', background:'#FEE2E2', borderRadius:9,
        fontSize:13, color:C.red, marginBottom:16 }}>{error}</div>}

      <div style={{ display:'flex', gap:12 }}>
        <button onClick={resetForm} style={{
          padding:'12px 24px', borderRadius:10, border:`1px solid ${C.grayLt}`,
          background:C.white, color:C.gray, fontSize:14, fontWeight:600, cursor:'pointer',
        }}>Cancelar</button>
        <button
          onClick={guardar}
          disabled={guardando || preview.filas.filter(f=>f.encontrado).length === 0
            || (preview.filas.some(f=>f.yaGuardado) && !confirmar)}
          style={{
            padding:'12px 32px', borderRadius:10, border:'none', fontSize:14, fontWeight:700,
            cursor: guardando ? 'wait' : 'pointer',
            background: preview.filas.filter(f=>f.encontrado).length === 0 ? C.grayLt : C.green,
            color: C.white,
          }}>
          {guardando ? 'Guardando…' : `Guardar ${preview.filas.filter(f=>f.encontrado).length} resultado(s)`}
        </button>
      </div>
    </div>
  )

  /* ── Pantalla 2: formulario de carga ──────────────────────── */
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
        <button onClick={reset} style={{
          cursor:'pointer', border:`1px solid ${C.grayLt}`, background:C.white,
          borderRadius:8, padding:'6px 12px', fontSize:13, color:C.gray, fontWeight:600,
        }}>← Cambiar método</button>
      </div>

      <h2 style={{ fontSize:22, fontWeight:700, color:C.navy, margin:'10px 0 4px' }}>
        {metodoActivo.icon} {metodoActivo.titulo}
      </h2>
      <p style={{ fontSize:14, color:C.gray, margin:'0 0 24px' }}>{metodoActivo.desc}</p>

      <Card style={{ maxWidth:640 }}>
        {/* Colegio */}
        <div style={{ marginBottom:18 }}>
          <Label>Colegio</Label>
          <select style={selectStyle} value={colegioId}
            onChange={e => { setColegioId(e.target.value); resetForm() }} disabled={cargando}>
            <option value="">{cargando ? 'Cargando…' : 'Selecciona un colegio'}</option>
            {colegios.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}{c.usuario ? ` (${c.usuario})` : ''}</option>
            ))}
          </select>
        </div>

        {/* Prueba */}
        <div style={{ marginBottom:18 }}>
          <Label>Prueba y referencia</Label>
          <select style={selectStyle} value={pruebaId}
            onChange={e => { setPruebaId(e.target.value); resetForm() }} disabled={cargando}>
            <option value="">{cargando ? 'Cargando…' : 'Selecciona la prueba'}</option>
            {pruebas.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre}{p.referencia ? ` — ${p.referencia}` : ''}
              </option>
            ))}
          </select>
          {pruebaActiva && (
            <div style={{ fontSize:12, color:C.green, marginTop:6, fontWeight:600 }}>
              ✓ {(pruebaActiva.estructura_excel?.raw?.length || 0) - 2} preguntas cargadas
            </div>
          )}
        </div>

        {/* Archivo */}
        <div style={{ marginBottom:6 }}>
          <Label>{metodo === 'optico' ? 'Archivo del lector óptico (.txt)' : 'Hoja de respuesta escaneada (.pdf)'}</Label>
          <input type="file" accept={metodoActivo.accept}
            onChange={e => { setArchivo(e.target.files[0] || null); setPreview(null); setError('') }}
            style={{
              width:'100%', padding:'10px 12px', borderRadius:9, fontSize:13.5,
              border:`1px dashed ${C.grayLt}`, background:C.bg, color:C.text,
            }}
          />
          {metodo === 'optico' && (
            <p style={{ fontSize:12, color:C.gray, margin:'8px 0 0' }}>
              Formato: <code>documento;cadena_de_respuestas</code> — una línea por estudiante.
            </p>
          )}
          {metodo === 'pdf' && (
            <p style={{ fontSize:12, color:C.gray, margin:'8px 0 0' }}>
              Sube el PDF con la hoja de respuesta de un estudiante. Claude Vision leerá las burbujas marcadas automáticamente.
            </p>
          )}
        </div>

        {archivo && (
          <div style={{ marginTop:12, padding:'10px 14px', background:C.bg2, borderRadius:9,
            fontSize:13, color:C.text, display:'flex', justifyContent:'space-between' }}>
            <span>📄 {archivo.name}</span>
            <span style={{ color:C.gray }}>{(archivo.size/1024).toFixed(1)} KB</span>
          </div>
        )}

        {/* Progreso Claude Vision */}
        {pasoVision && (
          <div style={{ marginTop:14, padding:'12px 14px', background:'#EFF6FF',
            borderRadius:9, fontSize:13, color:'#1D4ED8', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>⏳</span> {pasoVision}
          </div>
        )}

        {error && (
          <div style={{ marginTop:14, padding:'12px 14px', background:'#FEE2E2',
            borderRadius:9, fontSize:13, color:C.red }}>{error}</div>
        )}

        <div style={{ marginTop:24, borderTop:`1px solid ${C.bg2}`, paddingTop:20 }}>
          <button
            disabled={!listo || procesando}
            onClick={metodo === 'optico' ? procesarTXT : procesarPDF}
            style={{
              width:'100%', padding:'13px', borderRadius:10, fontSize:15, fontWeight:700,
              border:'none', cursor: listo && !procesando ? 'pointer' : 'not-allowed',
              background: listo && !procesando ? C.green : C.grayLt,
              color: listo && !procesando ? C.white : C.gray,
            }}>
            {procesando
              ? (metodo === 'pdf' ? 'Claude Vision procesando…' : 'Procesando…')
              : 'Procesar archivo'}
          </button>
        </div>
      </Card>
    </div>
  )
}
