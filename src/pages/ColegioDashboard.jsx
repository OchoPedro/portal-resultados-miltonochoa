import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  C, getColor, getLevel,
  Card, CardTitle, Badge, KpiCard, Sidebar
} from '../components/ui'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  Cell
} from 'recharts'

// ── HELPERS ──────────────────────────────────────────────────
const avgArr = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10 : 0
const semaforoBg  = v => v>=65?'#DCFCE7':v>=45?'#FEF9C3':v>=25?'#FFEDD5':'#FEE2E2'
const semaforoColor = v => v>=65?C.green:v>=45?'#F59E0B':v>=25?'#F97316':C.red

const LeyendaNiveles = () => (
  <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:12}}>
    {[
      {label:'Avanzado (65-100)', color:C.green},
      {label:'Satisfactorio (45-64)', color:'#F59E0B'},
      {label:'Mínimo (25-44)', color:'#F97316'},
      {label:'Insuficiente (0-24)', color:C.red},
    ].map((l,i) => (
      <div key={i} style={{display:'flex', alignItems:'center', gap:6}}>
        <div style={{width:12, height:12, borderRadius:2, background:l.color}}/>
        <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>{l.label}</span>
      </div>
    ))}
  </div>
)

const TabBar = ({tabs, active, onChange}) => (
  <div style={{display:'flex', gap:4, marginBottom:24, background:C.bg2,
    padding:4, borderRadius:10, flexWrap:'wrap'}}>
    {tabs.map(t => (
      <button key={t.id} onClick={()=>onChange(t.id)} style={{
        padding:'8px 14px', borderRadius:7, border:'none', cursor:'pointer',
        fontFamily:'Inter', fontSize:12, fontWeight:500,
        background: active===t.id?C.white:'transparent',
        color: active===t.id?C.navy:C.gray,
        boxShadow: active===t.id?'0 1px 4px rgba(10,31,61,0.1)':'none',
        transition:'all 0.2s',
      }}>{t.label}</button>
    ))}
  </div>
)

const CustomTooltip = ({active, payload, label}) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{background:C.white, border:`1px solid ${C.grayLt}`, borderRadius:8,
      padding:'10px 14px', fontFamily:'Inter', fontSize:12, boxShadow:'0 4px 16px rgba(0,0,0,0.1)'}}>
      <div style={{fontWeight:600, color:C.navy, marginBottom:6}}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{color:p.color, marginBottom:2}}>{p.name}: <strong>{p.value}%</strong></div>
      ))}
    </div>
  )
}

const FilterSelect = ({label, value, onChange, options}) => (
  <div style={{marginBottom:12}}>
    <div style={{fontSize:9, color:'rgba(255,255,255,0.35)', fontFamily:'Inter',
      letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:6}}>{label}</div>
    <select value={value} onChange={e=>onChange(e.target.value)} style={{
      width:'100%', padding:'8px 10px', background:'rgba(255,255,255,0.08)',
      border:'1px solid rgba(255,255,255,0.15)', color:C.white,
      fontFamily:'Inter', fontSize:12, borderRadius:6, cursor:'pointer',
      outline:'none', appearance:'none',
    }}>
      {options.map((o,i) => (
        <option key={i} value={o.value||o}
          style={{background:C.navy, color:C.white}}>{o.label||o}</option>
      ))}
    </select>
  </div>
)

const Loading = () => (
  <div style={{display:'flex', alignItems:'center', justifyContent:'center', padding:80, flexDirection:'column', gap:16}}>
    <div style={{width:36, height:36, border:'3px solid rgba(10,31,61,0.1)',
      borderTop:`3px solid ${C.green}`, borderRadius:'50%', animation:'spin 0.8s linear infinite'}}/>
    <div style={{fontFamily:'Inter', color:C.gray, fontSize:13}}>Cargando datos...</div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
)

// ── MAIN DASHBOARD ───────────────────────────────────────────
export default function ColegioDashboard({session, onLogout}) {
  const [tab, setTab] = useState('tablero')
  const [menuSection, setMenuSection] = useState('herramientas')
  const [loading, setLoading] = useState(true)
  const [prueba, setPrueba] = useState(null)

  // Filter states
  const [allPruebas, setAllPruebas] = useState([])
  const [selectedPrueba, setSelectedPrueba] = useState(null)
  const [selectedGrado, setSelectedGrado] = useState('Todos')
  const [selectedSalon, setSelectedSalon] = useState('Todos')

  // Data states
  const [allStudents, setAllStudents] = useState([])
  const [tableroComp, setTableroComp] = useState([])
  const [tableroSalon, setTableroSalon] = useState([])
  const [competencias, setCompetencias] = useState([])
  const [oportunidades, setOportunidades] = useState([])

  useEffect(() => { loadAll() }, [])

  // Filtered students based on selectors
  const students = allStudents.filter(s => {
    if (selectedGrado !== 'Todos' && s.estudiantes?.grado !== selectedGrado) return false
    if (selectedSalon !== 'Todos' && s.estudiantes?.salon !== selectedSalon) return false
    return true
  })

  // Derived filter options from loaded data
  const gradosDisponibles = ['Todos', ...new Set(allStudents.map(s => s.estudiantes?.grado).filter(Boolean)).values()]
  const salonesDisponibles = ['Todos', ...new Set(
    allStudents
      .filter(s => selectedGrado === 'Todos' || s.estudiantes?.grado === selectedGrado)
      .map(s => s.estudiantes?.salon).filter(Boolean)
  ).values()]

  // Reload when prueba changes
  useEffect(() => {
    if (selectedPrueba) loadForPrueba(selectedPrueba)
  }, [selectedPrueba])

  const loadAll = async () => {
    setLoading(true)
    try {
      // Registrar última sesión del colegio (hora Colombia)
      await supabase.from('colegios').update({
        ultima_sesion: new Date().toLocaleString('sv-SE', {timeZone:'America/Bogota'}).replace(' ','T')
      }).eq('id', session.id)

      // Cargar todas las pruebas activas
      const { data: pruebasData } = await supabase
        .from('pruebas').select('*').eq('activa', true)
        .order('created_at', {ascending: false})
      setAllPruebas(pruebasData || [])

      if (!pruebasData?.length) { setLoading(false); return }

      // Seleccionar la más reciente por defecto
      const primera = pruebasData[0]
      setSelectedPrueba(primera)
      setPrueba(primera)
      await loadForPrueba(primera)

    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadForPrueba = async (pruebaSelec) => {
    setLoading(true)
    try {
      const pid = pruebaSelec.id
      const cid = session.id
      setPrueba(pruebaSelec)

      // Resultados estudiantes
      const { data: res } = await supabase
        .from('resultados_estudiante')
        .select('*, estudiantes(nombre, salon, grado)')
        .eq('colegio_id', cid).eq('prueba_id', pid)
        .order('puntaje_global', {ascending: false})
      setAllStudents(res || [])
      setSelectedGrado('Todos')
      setSelectedSalon('Todos')

      // Comparativos gestión
      const { data: comp } = await supabase
        .from('comparativos_gestion').select('*').eq('prueba_id', pid)
      setTableroComp(comp || [])

      // Comparativos salón
      const { data: salon } = await supabase
        .from('comparativos_salon')
        .select('*').eq('colegio_id', cid).eq('prueba_id', pid).order('salon')
      setTableroSalon(salon || [])

      // Competencias
      const { data: comps } = await supabase
        .from('notas_competencia')
        .select('competencia, nota')
        .in('estudiante_id', (res||[]).map(r => r.estudiante_id))
        .eq('prueba_id', pid)
      if (comps) {
        const grouped = {}
        comps.forEach(c => {
          if (!grouped[c.competencia]) grouped[c.competencia] = []
          grouped[c.competencia].push(c.nota)
        })
        const compArr = Object.entries(grouped).map(([comp, notas]) => ({
          comp: comp.length > 40 ? comp.slice(0,40)+'…' : comp,
          prom: Math.round(avgArr(notas)*10)/10,
        })).sort((a,b) => b.prom - a.prom)
        setCompetencias(compArr)
      }

      // Oportunidades
      const { data: opor } = await supabase
        .from('analisis_preguntas').select('*')
        .eq('colegio_id', cid).eq('prueba_id', pid)
        .eq('oportunidad_mejora', true).order('pct_colegio')
      setOportunidades(opor || [])

    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── COMPUTED DATA ─────────────────────────────────────────
  const globals = students.map(s => s.puntaje_global).filter(Boolean)
  const promGlobal = globals.length ? Math.round(avgArr(globals)) : 0
  const maxStudent = students[0]
  const minStudent = students[students.length-1]

  // Áreas para radar
  const radarData = [
    {area:'Matemáticas',    plantel: Math.round(avgArr(students.map(s=>(s.mat_cuantitativo+s.mat_especifico)/2).filter(Boolean)))},
    {area:'Cs. Naturales',  plantel: Math.round(avgArr(students.map(s=>(s.cn_quimica+s.cn_fisica+s.cn_biologia+s.cn_cts)/4).filter(Boolean)))},
    {area:'Soc. y Ciudad.', plantel: Math.round(avgArr(students.map(s=>s.sociales).filter(Boolean)))},
    {area:'Lect. Crítica',  plantel: Math.round(avgArr(students.map(s=>s.lectura_critica).filter(Boolean)))},
    {area:'Inglés',         plantel: Math.round(avgArr(students.map(s=>s.ingles).filter(Boolean)))},
  ]

  // Promedios por área para barras
  const areaData = [
    {area:'Mat. Cuant.', plan: Math.round(avgArr(students.map(s=>s.mat_cuantitativo).filter(Boolean)))},
    {area:'Mat. Espec.', plan: Math.round(avgArr(students.map(s=>s.mat_especifico).filter(Boolean)))},
    {area:'Química',     plan: Math.round(avgArr(students.map(s=>s.cn_quimica).filter(Boolean)))},
    {area:'Física',      plan: Math.round(avgArr(students.map(s=>s.cn_fisica).filter(Boolean)))},
    {area:'Biología',    plan: Math.round(avgArr(students.map(s=>s.cn_biologia).filter(Boolean)))},
    {area:'CTS',         plan: Math.round(avgArr(students.map(s=>s.cn_cts).filter(Boolean)))},
    {area:'Sociales',    plan: Math.round(avgArr(students.map(s=>s.sociales).filter(Boolean)))},
    {area:'Lect. Crít.', plan: Math.round(avgArr(students.map(s=>s.lectura_critica).filter(Boolean)))},
    {area:'Inglés',      plan: Math.round(avgArr(students.map(s=>s.ingles).filter(Boolean)))},
  ]

  // Distribución puntajes
  const distData = [
    {rango:'< 380',   cant:globals.filter(g=>g<380).length,              color:C.red},
    {rango:'380–399', cant:globals.filter(g=>g>=380&&g<400).length,      color:'#F59E0B'},
    {rango:'400–419', cant:globals.filter(g=>g>=400&&g<420).length,      color:C.blue},
    {rango:'420–439', cant:globals.filter(g=>g>=420&&g<440).length,      color:C.green},
    {rango:'≥ 440',   cant:globals.filter(g=>g>=440).length,             color:C.navy},
  ]

  // Niveles por área
  const nivel = n => n>=65?'superior':n>=45?'alto':n>=25?'basico':'bajo'
  const nivelesData = [
    {materia:'Matemáticas',  ...calcNiveles(students.map(s=>(s.mat_cuantitativo+s.mat_especifico)/2))},
    {materia:'Cs. Naturales',...calcNiveles(students.map(s=>(s.cn_quimica+s.cn_fisica+s.cn_biologia+s.cn_cts)/4))},
    {materia:'Sociales',     ...calcNiveles(students.map(s=>s.sociales))},
    {materia:'Lect. Crítica',...calcNiveles(students.map(s=>s.lectura_critica))},
    {materia:'Inglés',       ...calcNiveles(students.map(s=>s.ingles))},
  ]

  function calcNiveles(vals) {
    const v = vals.filter(Boolean)
    if (!v.length) return {superior:0,alto:0,basico:0,bajo:0}
    return {
      superior: Math.round(v.filter(n=>n>=65).length/v.length*100),
      alto:     Math.round(v.filter(n=>n>=45&&n<65).length/v.length*100),
      basico:   Math.round(v.filter(n=>n>=25&&n<45).length/v.length*100),
      bajo:     Math.round(v.filter(n=>n<25).length/v.length*100),
    }
  }

  // Desviación por materia
  const desvData = areaData.map(a => {
    const key = a.area.toLowerCase().replace('.','').replace(' ','_')
    const vals = students.map(s => {
      if (a.area==='Mat. Cuant.') return s.mat_cuantitativo
      if (a.area==='Mat. Espec.') return s.mat_especifico
      if (a.area==='Química')     return s.cn_quimica
      if (a.area==='Física')      return s.cn_fisica
      if (a.area==='Biología')    return s.cn_biologia
      if (a.area==='CTS')         return s.cn_cts
      if (a.area==='Sociales')    return s.sociales
      if (a.area==='Lect. Crít.') return s.lectura_critica
      if (a.area==='Inglés')      return s.ingles
      return null
    }).filter(Boolean)
    return {
      materia: a.area,
      prom: Math.round(avgArr(vals)),
      min: vals.length ? Math.round(Math.min(...vals)) : 0,
      max: vals.length ? Math.round(Math.max(...vals)) : 0,
      desv: vals.length ? Math.round(Math.sqrt(vals.reduce((acc,v)=>acc+Math.pow(v-avgArr(vals),2),0)/vals.length)) : 0,
    }
  })

  // Tablero orden
  const tableroOrden = ['mejores','nacional','ciudad','plantel']
  const tableroLabels = {mejores:'Mejores Promedios', nacional:'Nacional', ciudad:'Ciudad', plantel:'Plantel'}

  const tabs = [
    {id:'tablero',      label:'Tablero de Gestión'},
    {id:'areas',        label:'Análisis por Áreas'},
    {id:'niveles',      label:'% por Nivel'},
    {id:'desviacion',   label:'Desviación'},
    {id:'competencias', label:'Competencias'},
    {id:'mejora',       label:'Oportunidades'},
    {id:'ranking',      label:'Ranking'},
  ]

  if (loading) return (
    <div style={{display:'flex', minHeight:'100vh', background:C.bg}}>
      <div style={{width:220, background:C.navy, minHeight:'100vh'}}/>
      <main style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center'}}>
        <Loading/>
      </main>
    </div>
  )

  const EmptyState = ({msg='Los resultados aparecerán aquí cuando AAMO los cargue.'}) => (
    <Card>
      <div style={{textAlign:'center', padding:60, display:'flex', flexDirection:'column',
        alignItems:'center', gap:16}}>
        <div style={{fontSize:48}}>📋</div>
        <div style={{fontFamily:'Playfair Display, serif', fontSize:20, color:C.navy}}>
          Sin resultados disponibles
        </div>
        <div style={{fontFamily:'Inter', fontSize:13, color:C.gray, maxWidth:360}}>{msg}</div>
      </div>
    </Card>
  )

  // No early return — always show layout

  return (
    <div style={{display:'flex', minHeight:'100vh', background:C.bg}}>
      {/* SIDEBAR */}
      <div style={{width:220, minHeight:'100vh', background:C.navy,
        display:'flex', flexDirection:'column', flexShrink:0}}>
        <div style={{padding:'28px 20px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:15, fontFamily:'Playfair Display, serif', color:C.white, marginBottom:2}}>
            Milton Ochoa
          </div>
          <div style={{fontSize:10, color:'rgba(255,255,255,0.4)', fontFamily:'Inter',
            letterSpacing:'0.12em', textTransform:'uppercase'}}>Portal de Resultados</div>
        </div>
        <div style={{flex:1, padding:'12px'}}>
          {/* Filtros */}
          <FilterSelect
            label="Prueba"
            value={selectedPrueba?.tipo || ''}
            onChange={val => {
              const p = allPruebas.find(p => p.tipo === val)
              if (p) setSelectedPrueba(p)
            }}
            options={[...new Set(allPruebas.map(p => p.tipo))].map(t => ({
              value: t,
              label: t.charAt(0).toUpperCase() + t.slice(1)
            }))}
          />
          <FilterSelect
            label="Referencia"
            value={selectedPrueba?.codigo || ''}
            onChange={val => {
              const p = allPruebas.find(p => p.codigo === val)
              if (p) setSelectedPrueba(p)
            }}
            options={allPruebas
              .filter(p => !selectedPrueba || p.tipo === selectedPrueba.tipo)
              .map(p => ({value: p.codigo, label: p.codigo}))}
          />
          <FilterSelect
            label="Grado"
            value={selectedGrado}
            onChange={val => { setSelectedGrado(val); setSelectedSalon('Todos') }}
            options={gradosDisponibles.map(g => ({value:g, label:g==='Todos'?'Todos los grados':g}))}
          />
          <FilterSelect
            label="Salón"
            value={selectedSalon}
            onChange={setSelectedSalon}
            options={salonesDisponibles.map(s => ({value:s, label:s==='Todos'?'Todos los salones':`Salón ${s}`}))}
          />

          <div style={{height:1, background:'rgba(255,255,255,0.08)', margin:'16px 0'}}/>

          {/* Menú jerárquico */}
          {[
            {
              id: 'plantel', label: 'Plantel', icon: '🏫',
              items: [
                {id:'carta',      label:'Carta de Bienvenida'},
                {id:'estudiantes',label:'Listado de Estudiantes'},
                {id:'resultados', label:'Reporte de Resultados'},
                {id:'mencion',    label:'Mención de Honor'},
                {id:'acompanamiento', label:'Acompañamiento'},
              ]
            },
            {
              id: 'herramientas', label: 'Herramientas', icon: '🛠️',
              items: [
                {id:'tablero',      label:'Tablero de Gestión'},
                {id:'areas',        label:'Análisis por Áreas'},
                {id:'niveles',      label:'% por Nivel'},
                {id:'desviacion',   label:'Desviación'},
                {id:'competencias', label:'Competencias'},
                {id:'mejora',       label:'Oportunidades'},
                {id:'ranking',      label:'Ranking'},
              ]
            },
            {
              id: 'consultoria', label: 'Consultoría', icon: '💡',
              items: [
                {id:'recomendaciones', label:'Recomendaciones'},
                {id:'portafolio',      label:'Portafolio'},
                {id:'valor',           label:'Valor Agregado'},
              ]
            },
          ].map(section => (
            <div key={section.id} style={{marginBottom:4}}>
              {/* Sección header */}
              <button onClick={() => setMenuSection(menuSection === section.id ? null : section.id)}
                style={{
                  width:'100%', textAlign:'left', padding:'9px 12px', borderRadius:8,
                  border:'none', cursor:'pointer', marginBottom:2, fontFamily:'Inter', fontSize:12,
                  background: menuSection===section.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: menuSection===section.id ? C.white : 'rgba(255,255,255,0.7)',
                  display:'flex', alignItems:'center', gap:8, fontWeight:600,
                  transition:'all 0.2s',
                }}>
                <span>{section.icon}</span>
                <span style={{flex:1}}>{section.label}</span>
                <span style={{fontSize:10, opacity:0.5}}>{menuSection===section.id ? '▲' : '▼'}</span>
              </button>

              {/* Sub-items */}
              {menuSection === section.id && (
                <div style={{paddingLeft:8}}>
                  {section.items.map(item => (
                    <button key={item.id} onClick={() => setTab(item.id)} style={{
                      width:'100%', textAlign:'left', padding:'7px 12px', borderRadius:6,
                      border:'none', cursor:'pointer', marginBottom:1, fontFamily:'Inter', fontSize:11,
                      background: tab===item.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: tab===item.id ? C.white : 'rgba(255,255,255,0.5)',
                      borderLeft: tab===item.id ? `3px solid ${C.green}` : '3px solid transparent',
                      transition:'all 0.2s',
                    }}>{item.label}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:12, color:C.white, fontFamily:'Inter', fontWeight:500, marginBottom:2}}>
            {session?.nombre}
          </div>
          <div style={{fontSize:10, color:'rgba(255,255,255,0.4)', fontFamily:'Inter', marginBottom:12}}>
            {session?.ciudad}
          </div>
          <button onClick={onLogout} style={{width:'100%', padding:'8px', borderRadius:7,
            border:'1px solid rgba(255,255,255,0.15)', background:'transparent',
            color:'rgba(255,255,255,0.5)', fontFamily:'Inter', fontSize:11, cursor:'pointer'}}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* MAIN */}
      <main style={{flex:1, padding:'36px 40px', overflowY:'auto'}}>
        {/* HEADER */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:11, color:C.green, letterSpacing:'0.12em',
            textTransform:'uppercase', fontFamily:'Inter', marginBottom:6}}>
            {new Date().toLocaleDateString('es-CO', {
              weekday:'long', year:'numeric', month:'long', day:'numeric',
              timeZone:'America/Bogota'
            })}
            {' · '}
            {new Date().toLocaleTimeString('es-CO', {
              hour:'2-digit', minute:'2-digit',
              timeZone:'America/Bogota'
            })}
          </div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12}}>
            <div>
              <h1 style={{fontSize:26, fontFamily:'Playfair Display, serif', color:C.navy, marginBottom:4}}>
                {session?.nombre}
              </h1>
              <div style={{fontSize:13, color:C.gray, fontFamily:'Inter'}}>
                {session?.ciudad} · Código {session?.codigo} · {students.length} estudiantes evaluados
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:28}}>
          <KpiCard label="Prom. Global" value={promGlobal||'—'} sub={`Prueba ${prueba?.codigo||'—'}`} color={C.navy}/>
          <KpiCard label="Estudiantes" value={students.length||'—'} sub="Evaluados" color={C.navy}/>
          <KpiCard label="Mejor puntaje" value={maxStudent?.puntaje_global||'—'}
            sub={maxStudent?.estudiantes?.nombre?.split(' ').slice(0,2).join(' ')||'Sin datos'} color={C.green}/>
          <KpiCard label="Oport. mejora" value={oportunidades.length||'—'} sub="Preguntas críticas" color={C.red}/>
        </div>

        <TabBar tabs={tabs} active={tab} onChange={setTab}/>

        {/* ══ TABLERO ══════════════════════════════════════════ */}
        {tab==='tablero' && (
          students.length === 0 ? <EmptyState/> :
          <div style={{display:'grid', gap:16}}>
            <Card>
              <CardTitle sub="Comparativo de promedios por área">Tablero de Gestión</CardTitle>
              {tableroComp.length === 0 ? (
                <div style={{textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter'}}>
                  No hay datos de comparativos cargados.
                </div>
              ) : (
                <>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                      <thead>
                        <tr style={{background:C.navy}}>
                          {['Promedio','Matemáticas','Ciencias Naturales','Sociales y Ciudad.','Lectura Crítica','Inglés','Definitiva','Global'].map(h => (
                            <th key={h} style={{padding:'10px 14px', fontSize:12, color:C.white,
                              fontWeight:600, textAlign:'center', whiteSpace:'nowrap'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableroOrden.map(tipo => {
                          const row = tableroComp.find(r => r.tipo === tipo)
                          if (!row) return null
                          return (
                            <tr key={tipo} style={{borderBottom:`1px solid ${C.bg2}`}}>
                              <td style={{padding:'10px 14px', fontSize:13, fontWeight:600, color:C.navy}}>
                                {tableroLabels[tipo]}
                              </td>
                              {[row.matematicas, row.ciencias_naturales, row.sociales_ciudadanas,
                                row.lectura_critica, row.ingles, row.definitiva].map((val,j) => (
                                <td key={j} style={{padding:'8px', textAlign:'center'}}>
                                  <div style={{background:semaforoBg(val), color:semaforoColor(val),
                                    padding:'6px 10px', borderRadius:6, fontWeight:700, fontSize:14,
                                    fontFamily:'Playfair Display, serif', display:'inline-block', minWidth:40}}>
                                    {val}
                                  </div>
                                </td>
                              ))}
                              <td style={{padding:'8px', textAlign:'center'}}>
                                <div style={{fontFamily:'Playfair Display, serif', fontSize:16,
                                  fontWeight:700, color:C.navy}}>{row.global}</div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <LeyendaNiveles/>
                </>
              )}
            </Card>

            {tableroSalon.length > 0 && (
              <Card>
                <CardTitle sub="Promedios por salón">Resultados por Salón</CardTitle>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                    <thead>
                      <tr style={{background:C.navy}}>
                        {['Grado','Salón','Mat.Gen.','Mat.No Gen.','Química','Física','Biología','CTS',
                          'Sociales','Ciudadanas','Lect. Crit.','Inglés','Definitiva','Global','Eval.'].map(h => (
                          <th key={h} style={{padding:'8px 10px', fontSize:11, color:C.white,
                            fontWeight:600, textAlign:'center', whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableroSalon.map((row,i) => (
                        <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`}}>
                          <td style={{padding:'10px', textAlign:'center', fontSize:13, fontWeight:600, color:C.navy}}>{row.grado}</td>
                          <td style={{padding:'10px', textAlign:'center', fontSize:13, fontWeight:600, color:C.navy}}>{row.salon}</td>
                          {[row.mat_genericos, row.mat_nogenericos, row.cn_quimica, row.cn_fisica,
                            row.cn_biologia, row.cn_cts, row.soc_sociales, row.soc_ciudadanas,
                            row.lectura_critica, row.ingles, row.definitiva].map((val,j) => (
                            <td key={j} style={{padding:'6px', textAlign:'center'}}>
                              <div style={{background:semaforoBg(val), color:semaforoColor(val),
                                padding:'4px 8px', borderRadius:5, fontWeight:700, fontSize:13,
                                display:'inline-block', minWidth:36}}>{val}</div>
                            </td>
                          ))}
                          <td style={{padding:'10px', textAlign:'center', fontSize:14,
                            fontWeight:700, color:C.navy, fontFamily:'Playfair Display, serif'}}>{row.global}</td>
                          <td style={{padding:'10px', textAlign:'center', fontSize:12, color:C.gray}}>{row.evaluados}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <LeyendaNiveles/>
              </Card>
            )}
          </div>
        )}

        {/* ══ ÁREAS ════════════════════════════════════════════ */}
        {tab==='areas' && (
          students.length === 0 ? <EmptyState/> :
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <Card>
              <CardTitle sub="Perfil del colegio por área">Radar — Desempeño por Área</CardTitle>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={C.bg2}/>
                  <PolarAngleAxis dataKey="area" tick={{fontSize:12, fontFamily:'Inter', fill:C.gray}}/>
                  <Radar name="Plantel" dataKey="plantel" stroke={C.navy} fill={C.navy}
                    fillOpacity={0.25} strokeWidth={2} dot={{fill:C.navy, r:5}}/>
                  <Legend wrapperStyle={{fontFamily:'Inter', fontSize:12}}/>
                </RadarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <CardTitle sub="Promedio por área">Comparativo por Área</CardTitle>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={areaData} layout="vertical" margin={{top:0, right:20, bottom:0, left:70}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2}/>
                  <XAxis type="number" tick={{fontSize:11, fontFamily:'Inter', fill:C.gray}} domain={[0,100]}/>
                  <YAxis type="category" dataKey="area" tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}} width={70}/>
                  <Tooltip contentStyle={{fontFamily:'Inter', fontSize:12, borderRadius:8}}/>
                  <Bar dataKey="plan" name="Promedio %" radius={[0,4,4,0]}>
                    {areaData.map((d,i) => <Cell key={i} fill={semaforoColor(d.plan)}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card style={{gridColumn:'1/3'}}>
              <CardTitle sub="Distribución de puntajes globales">Distribución de Puntajes</CardTitle>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={distData} margin={{top:0, right:0, bottom:0, left:-20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2}/>
                  <XAxis dataKey="rango" tick={{fontSize:11, fontFamily:'Inter', fill:C.gray}}/>
                  <YAxis tick={{fontSize:11, fontFamily:'Inter', fill:C.gray}}/>
                  <Tooltip contentStyle={{fontFamily:'Inter', fontSize:12, borderRadius:8}}/>
                  <Bar dataKey="cant" name="Estudiantes" radius={[4,4,0,0]}>
                    {distData.map((d,i) => <Cell key={i} fill={d.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* ══ NIVELES ══════════════════════════════════════════ */}
        {tab==='niveles' && (
          students.length === 0 ? <EmptyState/> :
          <div style={{display:'grid', gap:16}}>
            <Card>
              <CardTitle sub="% de estudiantes por nivel de desempeño y área">
                % Estudiantes por Nivel de Desempeño
              </CardTitle>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={nivelesData} margin={{top:10, right:0, bottom:0, left:-20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2}/>
                  <XAxis dataKey="materia" tick={{fontSize:11, fontFamily:'Inter', fill:C.gray}}/>
                  <YAxis tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}} domain={[0,100]}/>
                  <Tooltip contentStyle={{fontFamily:'Inter', fontSize:12, borderRadius:8}}/>
                  <Legend wrapperStyle={{fontFamily:'Inter', fontSize:11}}/>
                  <Bar dataKey="superior" name="Superior" stackId="a" fill={C.green}/>
                  <Bar dataKey="alto" name="Alto" stackId="a" fill="#F59E0B"/>
                  <Bar dataKey="basico" name="Básico" stackId="a" fill="#F97316"/>
                  <Bar dataKey="bajo" name="Bajo" stackId="a" fill={C.red}/>
                </BarChart>
              </ResponsiveContainer>
              <LeyendaNiveles/>
            </Card>
            <Card>
              <CardTitle sub="Tabla detallada por área">Detalle por Área</CardTitle>
              <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                <thead>
                  <tr style={{borderBottom:`2px solid ${C.bg2}`}}>
                    {['Área','Superior %','Alto %','Básico %','Bajo %'].map(h => (
                      <th key={h} style={{textAlign:'left', padding:'8px 12px', fontSize:10,
                        color:C.gray, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nivelesData.map((m,i) => (
                    <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`,
                      background:i%2===0?`${C.bg}80`:'transparent'}}>
                      <td style={{padding:'10px 12px', fontSize:13, color:C.text, fontWeight:500}}>{m.materia}</td>
                      {[{v:m.superior,c:C.green},{v:m.alto,c:'#F59E0B'},{v:m.basico,c:'#F97316'},{v:m.bajo,c:C.red}].map((item,j) => (
                        <td key={j} style={{padding:'10px 12px'}}>
                          <Badge color={item.c}>{item.v}%</Badge>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* ══ DESVIACIÓN ═══════════════════════════════════════ */}
        {tab==='desviacion' && (
          students.length === 0 ? <EmptyState/> :
          <div style={{display:'grid', gap:16}}>
            <Card>
              <CardTitle sub="Promedio por materia con color semáforo">Desviación por Materias</CardTitle>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={desvData} margin={{top:10, right:20, bottom:0, left:-20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2}/>
                  <XAxis dataKey="materia" tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}}/>
                  <YAxis tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}} domain={[0,110]}/>
                  <Tooltip contentStyle={{fontFamily:'Inter', fontSize:12, borderRadius:8}}/>
                  <Bar dataKey="prom" name="Promedio" radius={[4,4,0,0]}>
                    {desvData.map((d,i) => <Cell key={i} fill={semaforoColor(d.prom)}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <CardTitle sub="Promedio / Desviación / Mínimo / Máximo por materia">Tabla de Desviación</CardTitle>
              <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                <thead>
                  <tr style={{borderBottom:`2px solid ${C.bg2}`}}>
                    {['Materia','Promedio','Desviación','Mín.','Máx.'].map(h => (
                      <th key={h} style={{textAlign:'left', padding:'8px 12px', fontSize:10,
                        color:C.gray, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {desvData.map((m,i) => (
                    <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`,
                      background:i%2===0?`${C.bg}80`:'transparent'}}>
                      <td style={{padding:'10px 12px', fontSize:13, color:C.text, fontWeight:500}}>{m.materia}</td>
                      <td style={{padding:'10px 12px'}}>
                        <div style={{display:'inline-block', background:semaforoBg(m.prom),
                          color:semaforoColor(m.prom), padding:'4px 10px', borderRadius:6,
                          fontWeight:700, fontSize:14, fontFamily:'Playfair Display, serif'}}>{m.prom}</div>
                      </td>
                      <td style={{padding:'10px 12px', fontSize:13, color:C.gray}}>{m.desv}</td>
                      <td style={{padding:'10px 12px', fontSize:13, color:C.gray}}>{m.min}</td>
                      <td style={{padding:'10px 12px', fontSize:13, color:C.gray}}>{m.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* ══ COMPETENCIAS ═════════════════════════════════════ */}
        {tab==='competencias' && (
          students.length === 0 ? <EmptyState/> :
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            {competencias.length === 0 ? (
              <div style={{gridColumn:'1/3'}}><EmptyState/></div>
            ) : (
              <>
                <Card style={{gridColumn:'1/3'}}>
                  <CardTitle sub="Promedio por competencia evaluada">Desempeño por Competencia</CardTitle>
                  <ResponsiveContainer width="100%" height={Math.max(300, competencias.length*28)}>
                    <BarChart data={competencias} layout="vertical"
                      margin={{top:0, right:40, bottom:0, left:230}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.bg2}/>
                      <XAxis type="number" tick={{fontSize:11, fontFamily:'Inter', fill:C.gray}} domain={[0,100]}/>
                      <YAxis type="category" dataKey="comp" tick={{fontSize:11, fontFamily:'Inter', fill:C.gray}} width={225}/>
                      <Tooltip contentStyle={{fontFamily:'Inter', fontSize:12, borderRadius:8}}/>
                      <Bar dataKey="prom" name="Promedio %" radius={[0,4,4,0]}>
                        {competencias.map((d,i) => <Cell key={i} fill={semaforoColor(d.prom)}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <CardTitle sub="Radar competencial">Radar</CardTitle>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={competencias.slice(0,8).map(c=>({...c,comp:c.comp.split(' ').slice(0,2).join(' ')}))}>
                      <PolarGrid stroke={C.bg2}/>
                      <PolarAngleAxis dataKey="comp" tick={{fontSize:9, fontFamily:'Inter', fill:C.gray}}/>
                      <Radar name="Plantel" dataKey="prom" stroke={C.navy} fill={C.navy} fillOpacity={0.2} strokeWidth={2}/>
                    </RadarChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <CardTitle sub="Detalle por competencia">Nivel por Competencia</CardTitle>
                  {competencias.map((c,i) => (
                    <div key={i} style={{marginBottom:10}}>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                        <span style={{fontSize:11, color:C.text, fontFamily:'Inter'}}>{c.comp}</span>
                        <Badge color={semaforoColor(c.prom)}>{c.prom}%</Badge>
                      </div>
                      <div style={{height:5, background:C.bg2, borderRadius:3, overflow:'hidden'}}>
                        <div style={{height:'100%', width:`${c.prom}%`, borderRadius:3,
                          background:semaforoColor(c.prom)}}/>
                      </div>
                    </div>
                  ))}
                </Card>
              </>
            )}
          </div>
        )}

        {/* ══ OPORTUNIDADES ════════════════════════════════════ */}
        {tab==='mejora' && (
          students.length === 0 ? <EmptyState/> :
          <Card>
            <CardTitle sub={`${oportunidades.length} preguntas identificadas`}>
              Oportunidades de Mejoramiento
            </CardTitle>
            {oportunidades.length === 0 ? (
              <EmptyState msg="No hay oportunidades de mejora cargadas para esta prueba."/>
            ) : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                  <thead>
                    <tr style={{borderBottom:`2px solid ${C.bg2}`}}>
                      {['Sesión','Nro','Materia','Componente','% Colegio','% Nacional','Brecha','Nivel'].map(h => (
                        <th key={h} style={{textAlign:'left', padding:'8px 12px', fontSize:10,
                          color:C.gray, fontWeight:600, textTransform:'uppercase',
                          letterSpacing:'0.05em', whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {oportunidades.map((q,i) => (
                      <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`,
                        background:i%2===0?`${C.bg}80`:'transparent'}}>
                        <td style={{padding:'10px 12px', fontSize:12, color:C.gray}}>{q.sesion}</td>
                        <td style={{padding:'10px 12px', fontSize:15, fontWeight:700,
                          color:C.navy, fontFamily:'Playfair Display, serif'}}>{q.nro_pregunta}</td>
                        <td style={{padding:'10px 12px', fontSize:12, color:C.text, fontWeight:500}}>{q.materia}</td>
                        <td style={{padding:'10px 12px', fontSize:11, color:C.gray}}>{q.componente}</td>
                        <td style={{padding:'10px 12px'}}>
                          <Badge color={q.pct_colegio<20?C.red:'#F59E0B'}>{q.pct_colegio}%</Badge>
                        </td>
                        <td style={{padding:'10px 12px', fontSize:12, color:C.gray}}>{q.pct_nacional}%</td>
                        <td style={{padding:'10px 12px'}}>
                          <Badge color={q.pct_colegio<q.pct_nacional?C.red:C.green}>
                            {q.pct_colegio<q.pct_nacional?`−${q.pct_nacional-q.pct_colegio}`:`+${q.pct_colegio-q.pct_nacional}`}%
                          </Badge>
                        </td>
                        <td style={{padding:'10px 12px'}}>
                          <Badge color={q.dificultad==='Superior'?C.red:q.dificultad==='Alto'?'#F59E0B':C.blue}>
                            {q.dificultad}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ══ RANKING ══════════════════════════════════════════ */}
        {tab==='ranking' && (
          students.length === 0 ? <EmptyState/> :
          <Card>
            <CardTitle sub={`${students.length} estudiantes ordenados por puntaje global`}>
              Ranking Completo
            </CardTitle>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                <thead>
                  <tr style={{borderBottom:`2px solid ${C.bg2}`}}>
                    {['#','Estudiante','Global','Def.%','Mat.C','Mat.E','Quím.','Fís.','Bio.','CTS','Soc.','L.Crít.','Inglés'].map(h => (
                      <th key={h} style={{textAlign:'left', padding:'8px 10px', fontSize:10,
                        color:C.gray, fontWeight:600, textTransform:'uppercase',
                        letterSpacing:'0.04em', whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s,i) => (
                    <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`,
                      background:i<3?`${C.navy}04`:i%2===0?`${C.bg}60`:'transparent'}}>
                      <td style={{padding:'8px 10px', fontSize:12, fontWeight:700,
                        color:i===0?'#F59E0B':i===1?C.gray:i===2?'#CD7F32':C.grayLt}}>{i+1}</td>
                      <td style={{padding:'8px 10px', fontSize:12, color:C.text, fontWeight:500}}>
                        {s.estudiantes?.nombre?.split(' ').slice(0,3).join(' ')}
                      </td>
                      <td style={{padding:'8px 10px'}}>
                        <span style={{fontSize:15, fontWeight:700, color:C.navy,
                          fontFamily:'Playfair Display, serif'}}>{s.puntaje_global}</span>
                      </td>
                      <td style={{padding:'8px 10px'}}>
                        <Badge color={semaforoColor(s.desempeno_pct)}>{s.desempeno_pct?.toFixed(1)}%</Badge>
                      </td>
                      {[s.mat_cuantitativo, s.mat_especifico, s.cn_quimica, s.cn_fisica,
                        s.cn_biologia, s.cn_cts, s.sociales, s.lectura_critica, s.ingles].map((v,j) => (
                        <td key={j} style={{padding:'8px 10px', fontSize:12,
                          color:semaforoColor(v), fontWeight:v>=65?600:400}}>
                          {v?.toFixed(0)||'—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        {/* ══ SECCIONES PLANTEL ════════════════════════════════ */}
        {['carta','estudiantes','mencion','acompanamiento'].includes(tab) && (
          <Card>
            <div style={{textAlign:'center', padding:60, display:'flex', flexDirection:'column',
              alignItems:'center', gap:16}}>
              <div style={{fontSize:48}}>
                {tab==='carta'?'✉️':tab==='estudiantes'?'👥':tab==='mencion'?'🏅':'🤝'}
              </div>
              <div style={{fontFamily:'Playfair Display, serif', fontSize:22, color:C.navy}}>
                {tab==='carta'?'Carta de Bienvenida':
                 tab==='estudiantes'?'Listado de Estudiantes':
                 tab==='mencion'?'Mención de Honor':'Acompañamiento'}
              </div>
              <div style={{fontFamily:'Inter', fontSize:13, color:C.gray, maxWidth:360}}>
                Esta sección estará disponible próximamente.
              </div>
            </div>
          </Card>
        )}

        {/* ══ SECCIONES CONSULTORÍA ════════════════════════════ */}
        {['recomendaciones','portafolio','valor'].includes(tab) && (
          <Card>
            <div style={{textAlign:'center', padding:60, display:'flex', flexDirection:'column',
              alignItems:'center', gap:16}}>
              <div style={{fontSize:48}}>
                {tab==='recomendaciones'?'📌':tab==='portafolio'?'📁':'⭐'}
              </div>
              <div style={{fontFamily:'Playfair Display, serif', fontSize:22, color:C.navy}}>
                {tab==='recomendaciones'?'Recomendaciones':
                 tab==='portafolio'?'Portafolio':'Valor Agregado'}
              </div>
              <div style={{fontFamily:'Inter', fontSize:13, color:C.gray, maxWidth:360}}>
                Esta sección estará disponible próximamente.
              </div>
            </div>
          </Card>
        )}

      </main>
    </div>
  )
}
