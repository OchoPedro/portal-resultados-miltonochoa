import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { C } from '../../components/ui'

// ─── Constantes ───────────────────────────────────────────────────────────────

// En la BD los colegios de Bogotá tienen departamento='BOGOTÁ D.C.' pero en la UI
// se tratan como municipio de Cundinamarca. BOGOTA_DB se mantiene en REGIONES_COL
// para que el filtro por región siga funcionando.
const BOGOTA_DB = 'BOGOTÁ D.C.'

const REGIONES_COL = {
  'Andina':    ['ANTIOQUIA', BOGOTA_DB,'BOYACÁ','CALDAS','CUNDINAMARCA','HUILA','NORTE SANTANDER','QUINDÍO','RISARALDA','SANTANDER','TOLIMA'],
  'Caribe':    ['ATLÁNTICO','BOLÍVAR','CESAR','CÓRDOBA','LA GUAJIRA','MAGDALENA','SUCRE','SAN ANDRÉS'],
  'Pacífica':  ['CAUCA','CHOCÓ','NARIÑO','VALLE DEL CAUCA'],
  'Orinoquía': ['ARAUCA','CASANARE','META','VICHADA'],
  'Amazonía':  ['AMAZONAS','CAQUETÁ','GUAINÍA','GUAVIARE','PUTUMAYO','VAUPÉS'],
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const Card = ({children, style={}}) => (
  <div style={{ background:C.white, borderRadius:12, padding:24,
    boxShadow:'0 1px 4px rgba(10,31,61,0.07)', border:`1px solid ${C.grayLt}`, ...style }}>{children}</div>
)

const Badge = ({children, color}) => (
  <span style={{ background:color+'18', color, border:`1px solid ${color}40`,
    padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:500 }}>{children}</span>
)

const Btn = ({children, onClick, color=C.navy, outline=false, small=false, disabled=false}) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: small ? '6px 14px' : '10px 20px',
    background: outline ? 'transparent' : color,
    color: outline ? color : C.white,
    border: `1px solid ${color}`, borderRadius:6,
    fontFamily:'Inter', fontSize:12, fontWeight:600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }}>{children}</button>
)

const SectionTitle = ({children}) => (
  <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
    textTransform:'uppercase', marginBottom:16, paddingBottom:10,
    borderBottom:`1px solid ${C.bg2}` }}>{children}</div>
)

const Label = ({children}) => (
  <label style={{ display:'block', fontSize:10, letterSpacing:'0.12em',
    textTransform:'uppercase', color:C.gray, marginBottom:5, fontFamily:'Inter' }}>
    {children}
  </label>
)

const formatText = (text) => text.split('\n').map((line, i) => {
  if (line.match(/^\d\./)) return (
    <div key={i} style={{fontFamily:'Playfair Display, serif', fontSize:15,
      color:C.navy, fontWeight:600, marginTop:16, marginBottom:6}}>{line}</div>
  )
  if (line.startsWith('- ') || line.startsWith('• ')) return (
    <div key={i} style={{fontFamily:'Inter', fontSize:13, color:C.text,
      lineHeight:1.8, paddingLeft:12, marginBottom:4, display:'flex', gap:8}}>
      <span style={{color:C.green, flexShrink:0}}>▸</span>
      <span>{line.replace(/^[-•]\s*/,'')}</span>
    </div>
  )
  if (line.trim()) return (
    <p key={i} style={{fontFamily:'Inter', fontSize:13, color:C.gray,
      lineHeight:1.9, marginBottom:6}}>{line}</p>
  )
  return <div key={i} style={{height:4}}/>
})

const selStyle = {
  padding:'9px 13px', border:`1px solid ${C.grayLt}`, borderRadius:6,
  fontFamily:'Inter', fontSize:13, color:C.text, background:C.bg,
  outline:'none', cursor:'pointer', width:'100%',
}

const textareaStyle = {
  width:'100%', padding:'10px 13px', border:`1px solid ${C.grayLt}`, borderRadius:6,
  fontFamily:'Inter', fontSize:13, color:C.text, background:C.bg,
  outline:'none', resize:'vertical', minHeight:80, lineHeight:1.6, boxSizing:'border-box',
}

const MsgBox = ({msg}) => msg ? (
  <div style={{ marginTop:12, padding:'10px 14px',
    background: msg.startsWith('✅') ? '#F0FFF4' : '#FEF2F2',
    border: `1px solid ${msg.startsWith('✅') ? '#BBF7D0' : '#FECACA'}`,
    borderRadius:6, fontSize:13, color: msg.startsWith('✅') ? C.green : C.red, fontFamily:'Inter' }}>
    {msg}
  </div>
) : null

// ─── Modo selector ────────────────────────────────────────────────────────────

function ModoSelector({ onSelect }) {
  const modos = [
    { key:'pruebas', icon:'📊', titulo:'Análisis de Pruebas Internas',
      desc:'Analiza resultados de simulacros y pruebas propias del colegio. Identifica fortalezas, debilidades y genera recomendaciones pedagógicas.' },
    { key:'ranking', icon:'🏆', titulo:'Análisis de Ranking Saber 11',
      desc:'Analiza el historial de posicionamiento en ICFES Saber 11 — desde el nivel nacional hasta un colegio específico.' },
  ]
  return (
    <div>
      <div style={{ fontSize:13, color:C.gray, fontFamily:'Inter', marginBottom:20 }}>
        Selecciona el tipo de análisis que deseas generar con IA:
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {modos.map(m => (
          <button key={m.key} onClick={() => onSelect(m.key)} style={{
            textAlign:'left', padding:24, background:C.white,
            border:`2px solid ${C.grayLt}`, borderRadius:12, cursor:'pointer', fontFamily:'Inter',
            transition:'border-color 0.15s, box-shadow 0.15s', boxShadow:'0 1px 3px rgba(10,31,61,0.06)',
          }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=C.navy; e.currentTarget.style.boxShadow='0 4px 12px rgba(10,31,61,0.12)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=C.grayLt; e.currentTarget.style.boxShadow='0 1px 3px rgba(10,31,61,0.06)'}}>
            <div style={{ fontSize:28, marginBottom:12 }}>{m.icon}</div>
            <div style={{ fontSize:14, fontWeight:700, color:C.navy, marginBottom:8,
              fontFamily:'Playfair Display, serif' }}>{m.titulo}</div>
            <div style={{ fontSize:12, color:C.gray, lineHeight:1.6 }}>{m.desc}</div>
            <div style={{ marginTop:16, fontSize:11, fontWeight:600, color:C.navy,
              textTransform:'uppercase', letterSpacing:'0.08em' }}>Seleccionar →</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Análisis Pruebas Internas ─────────────────────────────────────────────

function AnalisisPruebas({ colegios, pruebas }) {
  const [selectedColegio, setSelectedColegio] = useState('')
  const [selectedPrueba, setSelectedPrueba] = useState('')
  const [promptCustom, setPromptCustom] = useState('')
  const [analisisExistentes, setAnalisisExistentes] = useState([])
  const [generando, setGenerando] = useState(false)
  const [borrador, setBorrador] = useState(null)
  const [publicando, setPublicando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (selectedColegio && selectedPrueba) loadAnalisis()
  }, [selectedColegio, selectedPrueba])

  const loadAnalisis = async () => {
    const { data } = await supabase.from('analisis_ia')
      .select('*').eq('colegio_id', selectedColegio).eq('prueba_id', selectedPrueba)
      .order('created_at', { ascending: false })
    setAnalisisExistentes(data || [])
  }

  const generarAnalisis = async () => {
    if (!selectedColegio || !selectedPrueba) return
    setGenerando(true); setBorrador(null); setMsg('')

    const { data: resultados } = await supabase
      .from('resultados_estudiante').select('*, estudiantes(nombre)')
      .eq('colegio_id', selectedColegio).eq('prueba_id', selectedPrueba)
    const { data: competencias } = await supabase
      .from('notas_competencia').select('competencia, nota')
      .in('estudiante_id', (resultados||[]).map(r => r.estudiante_id))
      .eq('prueba_id', selectedPrueba)
    const { data: oportunidades } = await supabase
      .from('analisis_preguntas').select('nro_pregunta, materia, componente, pct_colegio, pct_nacional')
      .eq('colegio_id', selectedColegio).eq('prueba_id', selectedPrueba)
      .eq('oportunidad_mejora', true).order('pct_colegio')

    const colegio = colegios.find(c => c.id === selectedColegio)
    const prueba = pruebas.find(p => p.id === selectedPrueba)
    const avg = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : 0
    const vals = resultados || []
    const promGlobal = avg(vals.map(r=>r.puntaje_global).filter(Boolean))
    const promMat = avg(vals.map(r=>((r.mat_cuantitativo||0)+(r.mat_especifico||0))/2))
    const promCN  = avg(vals.map(r=>((r.cn_quimica||0)+(r.cn_fisica||0)+(r.cn_biologia||0)+(r.cn_cts||0))/4))
    const promSoc = avg(vals.map(r=>r.sociales||0))
    const promLC  = avg(vals.map(r=>r.lectura_critica||0))
    const promIng = avg(vals.map(r=>r.ingles||0))

    const compGrupo = {}
    ;(competencias||[]).forEach(c => {
      if (!compGrupo[c.competencia]) compGrupo[c.competencia] = []
      compGrupo[c.competencia].push(c.nota)
    })
    const compArr = Object.entries(compGrupo).map(([k,v]) => ({comp:k, prom: avg(v)})).sort((a,b) => b.prom - a.prom)
    const topComp = compArr.slice(0,3).map(c=>`${c.comp} (${c.prom}%)`).join(', ')
    const bajComp = compArr.slice(-3).map(c=>`${c.comp} (${c.prom}%)`).join(', ')
    const topOpor = (oportunidades||[]).slice(0,5)
      .map(q=>`Pregunta ${q.nro_pregunta} de ${q.materia} (colegio ${q.pct_colegio}% vs nacional ${q.pct_nacional}%)`).join('; ')

    const instruccionCustom = promptCustom.trim()
      ? `\nENFOQUE ESPECÍFICO SOLICITADO: ${promptCustom.trim()}\nUtiliza ÚNICAMENTE los datos suministrados. No inventes información externa.`
      : ''

    const prompt = `Eres un experto en evaluación educativa colombiana con profundo conocimiento del sistema ICFES y las pruebas Saber.

Analiza los siguientes resultados del ${colegio?.nombre} en la prueba ${prueba?.codigo} y genera un informe de recomendaciones pedagógicas detallado.

RESULTADOS:
- Puntaje Global Promedio: ${promGlobal} puntos
- Matemáticas: ${promMat}% | Ciencias Naturales: ${promCN}% | Sociales: ${promSoc}%
- Lectura Crítica: ${promLC}% | Inglés: ${promIng}%
- Estudiantes evaluados: ${vals.length}

COMPETENCIAS MÁS FUERTES: ${topComp || 'No disponible'}
COMPETENCIAS MÁS DÉBILES: ${bajComp || 'No disponible'}
OPORTUNIDADES DE MEJORA: ${topOpor || 'No disponible'}
${instruccionCustom}
Genera un informe estructurado con:
1. DIAGNÓSTICO GENERAL
2. FORTALEZAS IDENTIFICADAS
3. ÁREAS DE MEJORA PRIORITARIAS
4. RECOMENDACIONES PEDAGÓGICAS
5. PLAN DE ACCIÓN SUGERIDO

Sé específico, práctico y orientado a la acción. Tono profesional pero cercano.`

    try {
      const response = await fetch('/api/vision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:1500,
          messages:[{ role:'user', content:prompt }] }),
      })
      if (!response.ok) throw new Error(`Error ${response.status}`)
      const data = await response.json()
      const texto = data.content?.filter(b => b.type==='text').map(b=>b.text).join('') || ''
      if (!texto) throw new Error('Respuesta vacía del modelo')
      setBorrador(texto)
    } catch(e) { setMsg('Error al generar el análisis: ' + e.message) }
    finally { setGenerando(false) }
  }

  const publicarAnalisis = async () => {
    if (!borrador) return
    setPublicando(true)
    const { error } = await supabase.from('analisis_ia').insert({
      colegio_id: selectedColegio, prueba_id: selectedPrueba,
      contenido: borrador, publicado: true, generado_por: 'Administrador AAMO',
    })
    if (error) setMsg('Error al publicar: ' + error.message)
    else { setMsg('✅ Análisis publicado. El colegio ya puede verlo.'); setBorrador(null); await loadAnalisis() }
    setPublicando(false)
  }

  const togglePublicado = async (a) => {
    await supabase.from('analisis_ia').update({ publicado: !a.publicado }).eq('id', a.id)
    await loadAnalisis()
  }
  const eliminarAnalisis = async (id) => {
    if (!confirm('¿Eliminar este análisis?')) return
    await supabase.from('analisis_ia').delete().eq('id', id)
    await loadAnalisis()
  }

  return (
    <div style={{ display:'grid', gap:20 }}>
      <Card>
        <SectionTitle>Generar Análisis de Prueba Interna</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          <div>
            <Label>Colegio *</Label>
            <select value={selectedColegio} onChange={e=>setSelectedColegio(e.target.value)} style={selStyle}>
              <option value="">Seleccionar colegio...</option>
              {colegios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <Label>Prueba *</Label>
            <select value={selectedPrueba} onChange={e=>setSelectedPrueba(e.target.value)} style={selStyle}>
              <option value="">Seleccionar prueba...</option>
              {pruebas.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom:16 }}>
          <Label>¿Qué deseas examinar? (opcional)</Label>
          <textarea value={promptCustom} onChange={e=>setPromptCustom(e.target.value)}
            placeholder="Ej: Enfócate en el desempeño de Matemáticas y sugiere actividades para reforzar el pensamiento lógico..."
            style={textareaStyle} />
          <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginTop:4 }}>
            Claude solo usará los datos de la prueba seleccionada, sin información externa.
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <Btn onClick={generarAnalisis} disabled={!selectedColegio||!selectedPrueba||generando} color={C.green}>
            {generando ? '⏳ Generando análisis...' : '✨ Generar análisis con IA'}
          </Btn>
          {generando && <span style={{ fontSize:12, color:C.gray, fontFamily:'Inter' }}>Esto puede tomar 15-30 segundos...</span>}
        </div>
        <MsgBox msg={msg} />
      </Card>

      {borrador && (
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            marginBottom:16, paddingBottom:12, borderBottom:`1px solid ${C.bg2}` }}>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                Borrador — Revisar antes de publicar
              </div>
              <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginTop:3 }}>
                {colegios.find(c=>c.id===selectedColegio)?.nombre} · {pruebas.find(p=>p.id===selectedPrueba)?.codigo}
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <Btn onClick={generarAnalisis} outline color={C.gray} small>↺ Regenerar</Btn>
              <Btn onClick={publicarAnalisis} disabled={publicando} color={C.green}>
                {publicando ? 'Publicando...' : '📢 Publicar al colegio'}
              </Btn>
            </div>
          </div>
          <div style={{ background:C.bg, borderRadius:8, padding:'20px 24px' }}>{formatText(borrador)}</div>
        </Card>
      )}

      {analisisExistentes.length > 0 && (
        <Card>
          <SectionTitle>Análisis Guardados — {colegios.find(c=>c.id===selectedColegio)?.nombre}</SectionTitle>
          {analisisExistentes.map((a,i) => (
            <div key={i} style={{ borderBottom: i<analisisExistentes.length-1?`1px solid ${C.bg2}`:'none',
              paddingBottom:16, marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <Badge color={a.publicado?C.green:C.amber}>{a.publicado?'Publicado':'Oculto'}</Badge>
                  <span style={{ fontSize:11, color:C.gray, fontFamily:'Inter' }}>
                    {new Date(a.created_at).toLocaleString('es-CO', {timeZone:'America/Bogota'})}
                  </span>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <Btn onClick={()=>togglePublicado(a)} small outline color={a.publicado?C.amber:C.green}>
                    {a.publicado?'Ocultar':'Publicar'}
                  </Btn>
                  <Btn onClick={()=>eliminarAnalisis(a.id)} small outline color={C.red}>Eliminar</Btn>
                </div>
              </div>
              <div style={{ background:C.bg, borderRadius:8, padding:'16px 20px',
                fontSize:12, color:C.gray, fontFamily:'Inter', lineHeight:1.7 }}>
                {a.contenido.substring(0,300)}...
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// ─── Análisis Ranking Saber 11 ────────────────────────────────────────────

const NIVELES = [
  { key:'nacional',     label:'🌎 Nacional',      icon:'🌎' },
  { key:'region',       label:'🗺 Región',         icon:'🗺' },
  { key:'departamento', label:'🏛 Departamento',   icon:'🏛' },
  { key:'municipio',    label:'🏙 Municipio',      icon:'🏙' },
  { key:'colegio',      label:'🏫 Colegio',        icon:'🏫' },
]

function AnalisisRanking() {
  // Filtro jerárquico
  const [nivel, setNivel] = useState('nacional')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedDepto, setSelectedDepto] = useState('')
  const [selectedMunicipio, setSelectedMunicipio] = useState('')
  const [municipios, setMunicipios] = useState([])
  // Colegio search
  const [busqueda, setBusqueda] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [seleccionado, setSeleccionado] = useState(null)
  const [mostrarSug, setMostrarSug] = useState(false)
  // Análisis
  const [promptCustom, setPromptCustom] = useState('')
  const [generando, setGenerando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [borrador, setBorrador] = useState(null)
  const [analisisGuardados, setAnalisisGuardados] = useState([])
  const [expandido, setExpandido] = useState(null)
  const [msg, setMsg] = useState('')
  const timerRef = useRef(null)

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getGuardadoPorKey = () => {
    if (nivel === 'nacional') return 'ranking:nacional'
    if (nivel === 'region') return `ranking:region:${selectedRegion}`
    if (nivel === 'departamento') return `ranking:depto:${selectedDepto}`
    if (nivel === 'municipio') return `ranking:muni:${selectedMunicipio}:${selectedDepto}`
    if (nivel === 'colegio' && seleccionado) return `ranking:colegio:${seleccionado.codigo}`
    return null
  }

  const getScopeLabel = () => {
    if (nivel === 'nacional') return 'Colombia — Todos los colegios'
    if (nivel === 'region') return `Región ${selectedRegion}`
    if (nivel === 'departamento') return `Departamento de ${selectedDepto}`
    if (nivel === 'municipio') return `Municipio de ${selectedMunicipio}, ${selectedDepto}`
    if (nivel === 'colegio' && seleccionado) return seleccionado.nombre
    return ''
  }

  const puedeGenerar = () => {
    if (nivel === 'nacional') return true
    if (nivel === 'region') return !!selectedRegion
    if (nivel === 'departamento') return !!selectedDepto
    if (nivel === 'municipio') return !!selectedMunicipio
    if (nivel === 'colegio') return !!seleccionado
    return false
  }

  // Cuáles botones de nivel están habilitados
  const nivelHabilitado = (n) => {
    if (n === 'nacional') return true
    if (n === 'region') return true
    if (n === 'departamento') return !!selectedRegion || nivel === 'departamento'
    if (n === 'municipio') return !!selectedDepto
    if (n === 'colegio') return !!selectedMunicipio || !!selectedDepto
    return false
  }

  // ── Cambios de nivel ───────────────────────────────────────────────────────

  const cambiarNivel = (n) => {
    if (!nivelHabilitado(n)) return
    setNivel(n)
    setBorrador(null); setMsg('')
    // Reset downstream
    if (n === 'nacional') { setSelectedRegion(''); setSelectedDepto(''); setSelectedMunicipio(''); setMunicipios([]); setSeleccionado(null); setBusqueda('') }
    if (n === 'region')   { setSelectedDepto(''); setSelectedMunicipio(''); setMunicipios([]); setSeleccionado(null); setBusqueda('') }
    if (n === 'departamento') { setSelectedMunicipio(''); setMunicipios([]); setSeleccionado(null); setBusqueda('') }
    if (n === 'municipio') { setSeleccionado(null); setBusqueda('') }
  }

  const cambiarRegion = (r) => {
    setSelectedRegion(r)
    setSelectedDepto(''); setSelectedMunicipio(''); setMunicipios([])
    setSeleccionado(null); setBusqueda(''); setBorrador(null)
  }

  const cambiarDepto = async (d) => {
    setSelectedDepto(d)
    setSelectedMunicipio(''); setSeleccionado(null); setBusqueda(''); setBorrador(null)
    if (!d) { setMunicipios([]); return }
    // Cundinamarca: incluir también registros con departamento='BOGOTÁ D.C.' (son Bogotá en la BD)
    let q = supabase.from('ranking_colegios').select('ciudad').order('ciudad').limit(2000)
    q = d === 'CUNDINAMARCA' ? q.in('departamento', ['CUNDINAMARCA', BOGOTA_DB]) : q.eq('departamento', d)
    const { data } = await q
    const uniq = [...new Set((data||[]).map(r => r.ciudad).filter(Boolean))].sort()
    setMunicipios(uniq)
  }

  const cambiarMunicipio = (m) => {
    setSelectedMunicipio(m)
    setSeleccionado(null); setBusqueda(''); setBorrador(null)
  }

  // ── Colegio search ─────────────────────────────────────────────────────────

  const buscarColegios = async (q) => {
    if (q.length < 3) { setSugerencias([]); return }
    setBuscando(true)
    let query = supabase.from('ranking_colegios')
      .select('codigo, nombre, departamento, ciudad')
      .ilike('nombre', `%${q}%`)
      .order('nombre').limit(50)
    if (selectedMunicipio) query = query.eq('ciudad', selectedMunicipio)
    else if (selectedDepto) query = query.eq('departamento', selectedDepto)
    const { data } = await query
    const visto = new Set()
    const uniq = (data||[]).filter(r => { if (visto.has(r.codigo)) return false; visto.add(r.codigo); return true })
    setSugerencias(uniq); setBuscando(false)
  }

  const handleBusqueda = (val) => {
    setBusqueda(val); setSeleccionado(null); setBorrador(null)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscarColegios(val), 350)
    setMostrarSug(true)
  }

  const seleccionarColegio = (c) => {
    setSeleccionado(c); setBusqueda(c.nombre); setSugerencias([]); setMostrarSug(false)
    setBorrador(null); setMsg('')
  }

  // ── Guardados ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const key = getGuardadoPorKey()
    if (key) cargarGuardados(key)
    else setAnalisisGuardados([])
  }, [nivel, selectedRegion, selectedDepto, selectedMunicipio, seleccionado])

  const cargarGuardados = async (key) => {
    const { data } = await supabase.from('analisis_ia')
      .select('*').eq('generado_por', key).order('created_at', { ascending: false })
    setAnalisisGuardados(data || [])
  }

  const eliminarAnalisis = async (id) => {
    if (!confirm('¿Eliminar este análisis?')) return
    await supabase.from('analisis_ia').delete().eq('id', id)
    const key = getGuardadoPorKey()
    if (key) await cargarGuardados(key)
  }

  const copiarTexto = (texto) => {
    navigator.clipboard.writeText(texto)
    setMsg('✅ Análisis copiado al portapapeles.')
    setTimeout(() => setMsg(''), 3000)
  }

  // ── Generación ─────────────────────────────────────────────────────────────

  const avgArr = (arr) => {
    const vals = arr.filter(v => v != null)
    return vals.length ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1) : '—'
  }

  const generarAnalisis = async () => {
    if (!puedeGenerar()) return
    setGenerando(true); setBorrador(null); setMsg('')
    try {
      const texto = nivel === 'colegio'
        ? await buildAnalisisColegio()
        : await buildAnalisisAgrupado()
      if (!texto) return
      setBorrador(texto)
      // Auto-guardar
      const key = getGuardadoPorKey()
      if (key) {
        setGuardando(true)
        await supabase.from('analisis_ia').insert({
          colegio_id: null, prueba_id: null, contenido: texto,
          publicado: false, generado_por: key,
        })
        await cargarGuardados(key)
        setGuardando(false)
      }
    } catch(e) {
      setMsg('Error al generar el análisis: ' + e.message)
    } finally { setGenerando(false) }
  }

  const buildAnalisisColegio = async () => {
    const { data: filas } = await supabase
      .from('ranking_colegios')
      .select('anio, puesto_anio, puesto_periodo, eval_estudiantes, lectura_critica, matematicas, ciencias_sociales, ciencias_naturales, ingles, puntaje_global, naturaleza, jornada, calendario, departamento, ciudad')
      .eq('codigo', seleccionado.codigo).order('anio')

    if (!filas || filas.length === 0) { setMsg('No se encontraron datos de ranking.'); return null }

    const ultimo  = filas[filas.length - 1]
    const primero = filas[0]
    const tendGeneral = ultimo.puesto_anio < primero.puesto_anio ? 'mejoró'
      : ultimo.puesto_anio > primero.puesto_anio ? 'bajó' : 'se mantuvo estable'

    const historial = filas.map(f =>
      `  ${f.anio}: Puesto #${f.puesto_anio} | LC=${f.lectura_critica??'—'} Mat=${f.matematicas??'—'} CS=${f.ciencias_sociales??'—'} CN=${f.ciencias_naturales??'—'} Ing=${f.ingles??'—'} | Global=${f.puntaje_global??'—'} | ${f.eval_estudiantes??'?'} est.`
    ).join('\n')

    const areas = ['lectura_critica','matematicas','ciencias_sociales','ciencias_naturales','ingles']
    const nombresArea = { lectura_critica:'Lectura Crítica', matematicas:'Matemáticas',
      ciencias_sociales:'Ciencias Sociales', ciencias_naturales:'Ciencias Naturales', ingles:'Inglés' }
    const tendAreas = areas.map(a => {
      const vals = filas.map(f => f[a]).filter(v => v != null)
      if (vals.length < 2) return null
      const dif = vals[vals.length-1] - vals[0]
      return `${nombresArea[a]}: ${dif > 0 ? '↑ +' : dif < 0 ? '↓ ' : '→ '}${Math.abs(dif).toFixed(1)} pts (${vals[0].toFixed(1)} → ${vals[vals.length-1].toFixed(1)})`
    }).filter(Boolean).join('\n')

    const mejorAnio = filas.reduce((m,f) => f.puesto_anio < m.puesto_anio ? f : m, filas[0])
    const instruccionCustom = promptCustom.trim()
      ? `\nENFOQUE ESPECÍFICO: ${promptCustom.trim()}\nUsa ÚNICAMENTE los datos del historial suministrado.`
      : ''

    const prompt = `Eres un experto en educación colombiana y el sistema ICFES Saber 11.

IMPORTANTE: Usa ÚNICAMENTE los datos proporcionados. No incorpores información de otras fuentes.

COLEGIO: ${seleccionado.nombre}
UBICACIÓN: ${ultimo.ciudad}, ${ultimo.departamento}
NATURALEZA: ${ultimo.naturaleza??'?'} | JORNADA: ${ultimo.jornada??'?'} | CALENDARIO: ${ultimo.calendario??'?'}
PERÍODO: ${primero.anio} – ${ultimo.anio}

HISTORIAL (puesto nacional por año):
${historial}

TENDENCIA GENERAL: ${tendGeneral.toUpperCase()} (de #${primero.puesto_anio} en ${primero.anio} a #${ultimo.puesto_anio} en ${ultimo.anio})
MEJOR AÑO: ${mejorAnio.anio} con puesto #${mejorAnio.puesto_anio}

EVOLUCIÓN POR ÁREA:
${tendAreas || 'No disponible'}
${instruccionCustom}
Genera un informe estructurado con:
1. DIAGNÓSTICO HISTÓRICO DE POSICIONAMIENTO
2. ÁREAS DE MAYOR FORTALEZA Y DEBILIDAD
3. TENDENCIAS RELEVANTES Y PUNTOS DE INFLEXIÓN
4. FACTORES A POTENCIAR PARA MEJORAR EL RANKING
5. RECOMENDACIONES ESTRATÉGICAS

Sé específico, apóyate en los números. Tono profesional y propositivo.`

    return await callClaude(prompt, 1800)
  }

  const buildAnalisisAgrupado = async () => {
    const anios = [2024, 2023, 2022, 2021, 2020]
    const porAnio = {}

    for (const anio of anios) {
      let q = supabase.from('ranking_colegios')
        .select('puesto_anio, nombre, departamento, ciudad, lectura_critica, matematicas, ciencias_sociales, ciencias_naturales, ingles, puntaje_global, eval_estudiantes')
        .eq('anio', anio).order('puesto_anio')
      if (nivel === 'region' && selectedRegion)
        q = q.in('departamento', REGIONES_COL[selectedRegion])
      if ((nivel === 'departamento' || nivel === 'municipio') && selectedDepto) {
        // Cundinamarca: incluir también registros con departamento='BOGOTÁ D.C.'
        q = selectedDepto === 'CUNDINAMARCA'
          ? q.in('departamento', ['CUNDINAMARCA', BOGOTA_DB])
          : q.eq('departamento', selectedDepto)
      }
      if (nivel === 'municipio' && selectedMunicipio)
        q = q.eq('ciudad', selectedMunicipio)
      // Nacional: limitar muestra representativa; resto: traer todo
      const { data } = await q.limit(nivel === 'nacional' ? 500 : 5000)
      if (data && data.length > 0) porAnio[anio] = data
    }

    if (Object.keys(porAnio).length === 0) {
      setMsg('No se encontraron datos para el filtro seleccionado.')
      return null
    }

    const areas = ['lectura_critica','matematicas','ciencias_sociales','ciencias_naturales','ingles']
    const nombresArea = { lectura_critica:'LC', matematicas:'Mat', ciencias_sociales:'CS',
      ciencias_naturales:'CN', ingles:'Ing' }

    const resumenAnios = Object.entries(porAnio).sort(([a],[b]) => b-a).map(([anio, rows]) =>
      `  ${anio}: ${rows.length} colegios | ${areas.map(a => `${nombresArea[a]}=${avgArr(rows.map(r=>r[a]))}`).join(' ')} | Global prom.=${avgArr(rows.map(r=>r.puntaje_global))}`
    ).join('\n')

    const aniosList = Object.keys(porAnio).map(Number).sort()
    const anioReciente = Math.max(...aniosList)
    const anioBase    = Math.min(...aniosList)
    const top5 = (porAnio[anioReciente]||[]).slice(0,5).map((r,i) =>
      `  ${i+1}. ${r.nombre} (${r.ciudad ?? ''}) — Puesto nacional #${r.puesto_anio}`
    ).join('\n')

    const rowsBase = porAnio[anioBase]
    const rowsUlt  = porAnio[anioReciente]
    const tendAreas = areas.map(a => {
      const v1 = parseFloat(avgArr(rowsBase.map(r=>r[a])))
      const v2 = parseFloat(avgArr(rowsUlt.map(r=>r[a])))
      if (isNaN(v1) || isNaN(v2)) return null
      const dif = v2 - v1
      return `${nombresArea[a]}: ${dif > 0 ? '↑ +' : dif < 0 ? '↓ ' : '→ '}${Math.abs(dif).toFixed(1)} pts`
    }).filter(Boolean).join(' | ')

    const instruccionCustom = promptCustom.trim()
      ? `\nENFOQUE ESPECÍFICO: ${promptCustom.trim()}\nUsa ÚNICAMENTE los datos suministrados. No incorpores información externa.`
      : ''

    const notaNacional = nivel === 'nacional'
      ? '\nNota: Para el nivel Nacional se analiza una muestra de los 500 mejor clasificados por año como referencia representativa.'
      : ''

    const prompt = `Eres un experto en educación colombiana y el sistema ICFES Saber 11.${notaNacional}

Analiza el desempeño en Saber 11 del siguiente ámbito: ${getScopeLabel()}
PERÍODO ANALIZADO: ${anioBase} – ${anioReciente}

PROMEDIOS POR AÑO:
${resumenAnios}

TOP 5 COLEGIOS EN ${anioReciente}:
${top5 || 'No disponible'}

TENDENCIA ENTRE ${anioBase} Y ${anioReciente}:
${tendAreas || 'No disponible'}
${instruccionCustom}
Genera un informe estructurado con:
1. DIAGNÓSTICO GENERAL DEL ÁMBITO
2. FORTALEZAS Y ÁREAS DESTACADAS
3. ÁREAS DE MEJORA PRIORITARIAS
4. TENDENCIAS Y EVOLUCIÓN EN EL PERÍODO
5. RECOMENDACIONES ESTRATÉGICAS

Basa el análisis exclusivamente en los datos proporcionados. Tono profesional y propositivo.`

    return await callClaude(prompt, 1800)
  }

  const callClaude = async (prompt, maxTokens) => {
    const response = await fetch('/api/vision', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:maxTokens,
        messages:[{ role:'user', content:prompt }] }),
    })
    if (!response.ok) throw new Error(`Error ${response.status}`)
    const data = await response.json()
    const texto = data.content?.filter(b => b.type==='text').map(b=>b.text).join('') || ''
    if (!texto) throw new Error('Respuesta vacía del modelo')
    return texto
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const deptosDeRegion = selectedRegion ? (REGIONES_COL[selectedRegion] || []).sort() : []

  return (
    <div style={{ display:'grid', gap:20 }}>
      <Card>
        <SectionTitle>Generar Análisis de Ranking Saber 11</SectionTitle>

        {/* Botones de nivel */}
        <div style={{ marginBottom:20 }}>
          <Label>Nivel de análisis</Label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {NIVELES.map(n => {
              const habilitado = nivelHabilitado(n.key)
              const activo = nivel === n.key
              return (
                <button key={n.key} onClick={() => cambiarNivel(n.key)} disabled={!habilitado}
                  style={{
                    padding:'8px 16px', borderRadius:20,
                    background: activo ? C.navy : 'transparent',
                    color: activo ? C.white : habilitado ? C.navy : C.gray,
                    border: `1.5px solid ${activo ? C.navy : habilitado ? C.navy+'60' : C.grayLt}`,
                    fontFamily:'Inter', fontSize:12, fontWeight:600,
                    cursor: habilitado ? 'pointer' : 'not-allowed',
                    opacity: habilitado ? 1 : 0.4,
                    transition:'all 0.15s',
                  }}>
                  {n.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selectors en cascada */}
        <div style={{ display:'grid', gap:12, marginBottom:16 }}>

          {/* Región — visible cuando nivel >= region */}
          {(nivel === 'region' || nivel === 'departamento' || nivel === 'municipio' || nivel === 'colegio') && (
            <div>
              <Label>Región {nivel === 'region' ? '*' : '(para filtrar departamentos)'}</Label>
              <select value={selectedRegion} onChange={e => cambiarRegion(e.target.value)} style={selStyle}>
                <option value="">Seleccionar región...</option>
                {Object.keys(REGIONES_COL).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          {/* Departamento — visible cuando nivel >= departamento y hay región (o siempre en dept) */}
          {(nivel === 'departamento' || nivel === 'municipio' || nivel === 'colegio') && (
            <div>
              <Label>Departamento {nivel !== 'colegio' ? '*' : '(opcional)'}</Label>
              <select value={selectedDepto} onChange={e => cambiarDepto(e.target.value)} style={selStyle}
                disabled={nivel !== 'departamento' && !selectedRegion && nivel !== 'colegio'}>
                <option value="">Seleccionar departamento...</option>
                {(selectedRegion ? deptosDeRegion : Object.values(REGIONES_COL).flat().sort())
                  .filter(d => d !== BOGOTA_DB)
                  .map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          {/* Municipio — visible cuando nivel >= municipio y hay departamento */}
          {(nivel === 'municipio' || nivel === 'colegio') && selectedDepto && (
            <div>
              <Label>Municipio {nivel === 'municipio' ? '*' : '(opcional)'}</Label>
              <select value={selectedMunicipio} onChange={e => cambiarMunicipio(e.target.value)} style={selStyle}>
                <option value="">Seleccionar municipio...</option>
                {municipios.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {/* Colegio — visible en nivel colegio */}
          {nivel === 'colegio' && (
            <div>
              <Label>Colegio *</Label>
              <div style={{ position:'relative' }}>
                <input value={busqueda} onChange={e => handleBusqueda(e.target.value)}
                  onFocus={() => sugerencias.length > 0 && setMostrarSug(true)}
                  placeholder="Escribe mínimo 3 letras para buscar..."
                  style={{ ...selStyle, paddingRight:36 }} />
                {buscando && (
                  <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                    fontSize:12, color:C.gray }}>⏳</span>
                )}
                {mostrarSug && sugerencias.length > 0 && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100,
                    background:C.white, border:`1px solid ${C.grayLt}`, borderRadius:8,
                    boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:240, overflowY:'auto', marginTop:2 }}>
                    {sugerencias.map(c => (
                      <div key={c.codigo} onClick={() => seleccionarColegio(c)}
                        style={{ padding:'10px 14px', cursor:'pointer', borderBottom:`1px solid ${C.bg2}`,
                          fontSize:13, fontFamily:'Inter', color:C.text }}
                        onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                        onMouseLeave={e=>e.currentTarget.style.background=C.white}>
                        <div style={{ fontWeight:600 }}>{c.nombre}</div>
                        <div style={{ fontSize:11, color:C.gray, marginTop:2 }}>{c.ciudad} · {c.departamento} · Cód. {c.codigo}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {busqueda.length > 0 && busqueda.length < 3 && (
                <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginTop:4 }}>
                  Escribe al menos 3 caracteres para buscar.
                </div>
              )}
              {seleccionado && (
                <div style={{ marginTop:8, padding:'10px 14px', background:C.bg,
                  borderRadius:6, border:`1px solid ${C.grayLt}` }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C.navy, fontFamily:'Inter' }}>{seleccionado.nombre}</div>
                  <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginTop:2 }}>
                    {seleccionado.ciudad} · {seleccionado.departamento} · Código {seleccionado.codigo}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scope badge */}
        {puedeGenerar() && (
          <div style={{ marginBottom:16, padding:'8px 14px', background:'#EEF2FF',
            border:`1px solid #C7D2FE`, borderRadius:6, fontSize:12,
            color:'#3730A3', fontFamily:'Inter', fontWeight:500 }}>
            📍 Ámbito del análisis: <strong>{getScopeLabel()}</strong>
          </div>
        )}

        {/* Prompt personalizado */}
        <div style={{ marginBottom:16 }}>
          <Label>¿Qué deseas examinar? (opcional)</Label>
          <textarea value={promptCustom} onChange={e => setPromptCustom(e.target.value)}
            placeholder="Ej: Compara la evolución de Matemáticas e identifica los años con mayor cambio..."
            style={textareaStyle} />
          <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginTop:4 }}>
            Claude solo usará los datos de ranking suministrados, sin información externa.
          </div>
        </div>

        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <Btn onClick={generarAnalisis} disabled={!puedeGenerar()||generando} color={C.green}>
            {generando ? '⏳ Analizando...' : '✨ Generar análisis con IA'}
          </Btn>
          {generando && <span style={{ fontSize:12, color:C.gray, fontFamily:'Inter' }}>Esto puede tomar 15-30 segundos...</span>}
          {guardando && <span style={{ fontSize:12, color:C.gray, fontFamily:'Inter' }}>Guardando...</span>}
        </div>
        <MsgBox msg={msg} />
      </Card>

      {/* Análisis recién generado */}
      {borrador && (
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            marginBottom:16, paddingBottom:12, borderBottom:`1px solid ${C.bg2}` }}>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                Análisis generado — guardado automáticamente
              </div>
              <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginTop:3 }}>
                {getScopeLabel()} · Solo visible para administradores
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <Btn onClick={generarAnalisis} outline color={C.gray} small>↺ Regenerar</Btn>
              <Btn onClick={() => copiarTexto(borrador)} outline color={C.navy} small>📋 Copiar</Btn>
            </div>
          </div>
          <div style={{ background:C.bg, borderRadius:8, padding:'20px 24px' }}>{formatText(borrador)}</div>
        </Card>
      )}

      {/* Historial guardado */}
      {analisisGuardados.length > 0 && (
        <Card>
          <SectionTitle>Análisis Guardados — {getScopeLabel()}</SectionTitle>
          <div style={{ fontSize:11, color:'#92400E', fontFamily:'Inter', marginBottom:16,
            padding:'8px 12px', background:'#FFF8E1', border:'1px solid #FFE082', borderRadius:6 }}>
            🔒 Solo visible para administradores. No aparece en la vista del colegio.
          </div>
          {analisisGuardados.map((a,i) => (
            <div key={a.id} style={{ borderBottom: i<analisisGuardados.length-1?`1px solid ${C.bg2}`:'none',
              paddingBottom:16, marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:11, color:C.gray, fontFamily:'Inter' }}>
                  {new Date(a.created_at).toLocaleString('es-CO', {timeZone:'America/Bogota'})}
                </span>
                <div style={{ display:'flex', gap:6 }}>
                  <Btn onClick={() => setExpandido(expandido===a.id ? null : a.id)} small outline color={C.navy}>
                    {expandido===a.id ? 'Contraer' : 'Ver completo'}
                  </Btn>
                  <Btn onClick={() => copiarTexto(a.contenido)} small outline color={C.navy}>📋</Btn>
                  <Btn onClick={() => eliminarAnalisis(a.id)} small outline color={C.red}>Eliminar</Btn>
                </div>
              </div>
              <div style={{ background:C.bg, borderRadius:8, padding:'14px 18px',
                fontSize:12, color:C.gray, fontFamily:'Inter', lineHeight:1.7 }}>
                {expandido===a.id
                  ? formatText(a.contenido)
                  : <>{a.contenido.substring(0,280)}<span style={{color:C.navy, cursor:'pointer'}}
                      onClick={() => setExpandido(a.id)}> ... Ver completo →</span></>
                }
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminAnalisis() {
  const [colegios, setColegios] = useState([])
  const [pruebas, setPruebas] = useState([])
  const [modo, setModo] = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [{ data: cols }, { data: prbs }] = await Promise.all([
      supabase.from('colegios').select('id, nombre, usuario').eq('activo', true).order('nombre'),
      supabase.from('pruebas').select('id, codigo, nombre, tipo').eq('activa', true).order('nombre'),
    ])
    setColegios(cols || [])
    setPruebas(prbs || [])
  }

  return (
    <div style={{ display:'grid', gap:20 }}>
      {modo && (
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => setModo(null)} style={{
            background:'none', border:'none', cursor:'pointer',
            fontSize:13, color:C.navy, fontFamily:'Inter', fontWeight:600,
            display:'flex', alignItems:'center', gap:6, padding:0,
          }}>
            ← Volver
          </button>
          <div style={{ fontSize:13, color:C.gray, fontFamily:'Inter' }}>
            {modo === 'pruebas' ? '📊 Análisis de Pruebas Internas' : '🏆 Análisis de Ranking Saber 11'}
          </div>
        </div>
      )}

      {!modo && (
        <Card>
          <SectionTitle>Análisis con IA</SectionTitle>
          <ModoSelector onSelect={setModo} />
        </Card>
      )}

      {modo === 'pruebas' && <AnalisisPruebas colegios={colegios} pruebas={pruebas} />}
      {modo === 'ranking' && <AnalisisRanking />}
    </div>
  )
}
