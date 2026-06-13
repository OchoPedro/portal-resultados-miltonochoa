import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const C = {
  navy:'#0A1F3D', green:'#2D9B6F', greenLt:'#3AB882',
  bg:'#F8F9FB', bg2:'#EFF1F5', white:'#FFFFFF',
  text:'#1A1A2E', gray:'#6B7280', grayLt:'#D1D5DB',
  red:'#E05252', amber:'#F59E0B',
}

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

export default function AdminAnalisis() {
  const [colegios, setColegios] = useState([])
  const [pruebas, setPruebas] = useState([])
  const [selectedColegio, setSelectedColegio] = useState('')
  const [selectedPrueba, setSelectedPrueba] = useState('')
  const [analisisExistentes, setAnalisisExistentes] = useState([])
  const [generando, setGenerando] = useState(false)
  const [borrador, setBorrador] = useState(null)
  const [publicando, setPublicando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (selectedColegio && selectedPrueba) loadAnalisis()
  }, [selectedColegio, selectedPrueba])

  const loadData = async () => {
    const [{ data: cols }, { data: prbs }] = await Promise.all([
      supabase.from('colegios').select('id, nombre, usuario').eq('activo', true).order('nombre'),
      supabase.from('pruebas').select('id, codigo, nombre, tipo').eq('activa', true).order('nombre'),
    ])
    setColegios(cols || [])
    setPruebas(prbs || [])
  }

  const loadAnalisis = async () => {
    const { data } = await supabase.from('analisis_ia')
      .select('*').eq('colegio_id', selectedColegio).eq('prueba_id', selectedPrueba)
      .order('created_at', { ascending: false })
    setAnalisisExistentes(data || [])
  }

  const generarAnalisis = async () => {
    if (!selectedColegio || !selectedPrueba) return
    setGenerando(true)
    setBorrador(null)
    setMsg('')

    // Cargar datos del colegio y prueba
    const { data: resultados } = await supabase
      .from('resultados_estudiante')
      .select('*, estudiantes(nombre)')
      .eq('colegio_id', selectedColegio)
      .eq('prueba_id', selectedPrueba)

    const { data: competencias } = await supabase
      .from('notas_competencia')
      .select('competencia, nota')
      .in('estudiante_id', (resultados||[]).map(r => r.estudiante_id))
      .eq('prueba_id', selectedPrueba)

    const { data: oportunidades } = await supabase
      .from('analisis_preguntas')
      .select('nro_pregunta, materia, componente, pct_colegio, pct_nacional')
      .eq('colegio_id', selectedColegio)
      .eq('prueba_id', selectedPrueba)
      .eq('oportunidad_mejora', true)
      .order('pct_colegio')

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

    // Agrupar competencias
    const compGrupo = {}
    ;(competencias||[]).forEach(c => {
      if (!compGrupo[c.competencia]) compGrupo[c.competencia] = []
      compGrupo[c.competencia].push(c.nota)
    })
    const compArr = Object.entries(compGrupo)
      .map(([k,v]) => ({comp:k, prom: avg(v)}))
      .sort((a,b) => b.prom - a.prom)

    const topComp = compArr.slice(0,3).map(c=>`${c.comp} (${c.prom}%)`).join(', ')
    const bajComp = compArr.slice(-3).map(c=>`${c.comp} (${c.prom}%)`).join(', ')
    const topOpor = (oportunidades||[]).slice(0,5)
      .map(q=>`Pregunta ${q.nro_pregunta} de ${q.materia} (colegio ${q.pct_colegio}% vs nacional ${q.pct_nacional}%)`).join('; ')

    const prompt = `Eres un experto en evaluación educativa colombiana con profundo conocimiento del sistema ICFES y las pruebas Saber.

Analiza los siguientes resultados del ${colegio?.nombre} en la prueba ${prueba?.codigo} y genera un informe de recomendaciones pedagógicas detallado.

RESULTADOS:
- Puntaje Global Promedio: ${promGlobal} puntos
- Matemáticas: ${promMat}%
- Ciencias Naturales: ${promCN}%
- Sociales y Ciudadanas: ${promSoc}%
- Lectura Crítica: ${promLC}%
- Inglés: ${promIng}%
- Estudiantes evaluados: ${vals.length}

COMPETENCIAS MÁS FUERTES: ${topComp || 'No disponible'}
COMPETENCIAS MÁS DÉBILES: ${bajComp || 'No disponible'}
OPORTUNIDADES DE MEJORA: ${topOpor || 'No disponible'}

Genera un informe estructurado con:
1. DIAGNÓSTICO GENERAL
2. FORTALEZAS IDENTIFICADAS
3. ÁREAS DE MEJORA PRIORITARIAS
4. RECOMENDACIONES PEDAGÓGICAS
5. PLAN DE ACCIÓN SUGERIDO

Sé específico, práctico y orientado a la acción. Tono profesional pero cercano.`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          messages: [{ role:'user', content: prompt }]
        })
      })
      const data = await response.json()
      const texto = data.content?.filter(b=>b.type==='text').map(b=>b.text).join('') || ''
      setBorrador(texto)
    } catch(e) {
      setMsg('Error al generar el análisis. Intenta de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  const publicarAnalisis = async () => {
    if (!borrador) return
    setPublicando(true)
    const { error } = await supabase.from('analisis_ia').insert({
      colegio_id: selectedColegio,
      prueba_id: selectedPrueba,
      contenido: borrador,
      publicado: true,
      generado_por: 'Administrador AAMO',
    })
    if (error) { setMsg('Error al publicar: ' + error.message) }
    else {
      setMsg('✅ Análisis publicado. El colegio ya puede verlo.')
      setBorrador(null)
      await loadAnalisis()
    }
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

  const selStyle = {
    padding:'9px 13px', border:`1px solid ${C.grayLt}`, borderRadius:6,
    fontFamily:'Inter', fontSize:13, color:C.text, background:C.bg,
    outline:'none', cursor:'pointer', width:'100%',
  }

  return (
    <div style={{ display:'grid', gap:20 }}>

      {/* Selector */}
      <Card>
        <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
          textTransform:'uppercase', marginBottom:16, paddingBottom:10,
          borderBottom:`1px solid ${C.bg2}` }}>Generar Análisis con IA</div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          <div>
            <label style={{ display:'block', fontSize:10, letterSpacing:'0.12em',
              textTransform:'uppercase', color:C.gray, marginBottom:5, fontFamily:'Inter' }}>
              Colegio *
            </label>
            <select value={selectedColegio} onChange={e=>setSelectedColegio(e.target.value)} style={selStyle}>
              <option value="">Seleccionar colegio...</option>
              {colegios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:10, letterSpacing:'0.12em',
              textTransform:'uppercase', color:C.gray, marginBottom:5, fontFamily:'Inter' }}>
              Prueba *
            </label>
            <select value={selectedPrueba} onChange={e=>setSelectedPrueba(e.target.value)} style={selStyle}>
              <option value="">Seleccionar prueba...</option>
              {pruebas.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <Btn onClick={generarAnalisis} disabled={!selectedColegio||!selectedPrueba||generando}
            color={C.green}>
            {generando ? '⏳ Generando análisis...' : '✨ Generar análisis con IA'}
          </Btn>
          {generando && (
            <span style={{ fontSize:12, color:C.gray, fontFamily:'Inter' }}>
              Esto puede tomar 15-30 segundos...
            </span>
          )}
        </div>

        {msg && (
          <div style={{ marginTop:12, padding:'10px 14px',
            background: msg.startsWith('✅') ? '#F0FFF4' : '#FEF2F2',
            border: `1px solid ${msg.startsWith('✅') ? '#BBF7D0' : '#FECACA'}`,
            borderRadius:6, fontSize:13,
            color: msg.startsWith('✅') ? C.green : C.red, fontFamily:'Inter' }}>
            {msg}
          </div>
        )}
      </Card>

      {/* Borrador generado */}
      {borrador && (
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            marginBottom:16, paddingBottom:12, borderBottom:`1px solid ${C.bg2}` }}>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
                textTransform:'uppercase' }}>Borrador — Revisar antes de publicar</div>
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
          <div style={{ background:C.bg, borderRadius:8, padding:'20px 24px' }}>
            {formatText(borrador)}
          </div>
        </Card>
      )}

      {/* Análisis publicados */}
      {analisisExistentes.length > 0 && (
        <Card>
          <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
            textTransform:'uppercase', marginBottom:16, paddingBottom:10,
            borderBottom:`1px solid ${C.bg2}` }}>
            Análisis Guardados — {colegios.find(c=>c.id===selectedColegio)?.nombre}
          </div>
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
                  <Btn onClick={()=>togglePublicado(a)} small outline
                    color={a.publicado?C.amber:C.green}>
                    {a.publicado?'Ocultar':'Publicar'}
                  </Btn>
                  <Btn onClick={()=>eliminarAnalisis(a.id)} small outline color={C.red}>
                    Eliminar
                  </Btn>
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
