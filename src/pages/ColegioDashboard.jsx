import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import {
  C,
  Card, CardTitle, Badge, KpiCard, Sidebar, useMobile, useTablet
} from '../components/ui'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  Cell, LabelList,
  PieChart, Pie,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
  Line, ComposedChart, LineChart
} from 'recharts'

// ── HELPERS ──────────────────────────────────────────────────
const avgArr = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0

const toTitleCase = str => str
  ? str.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase())
  : str

const REGION_NOMBRES = {
  'ANTIOQUIA':'Andina','BOGOTÁ D.C.':'Andina','BOYACÁ':'Andina',
  'CALDAS':'Andina','CUNDINAMARCA':'Andina','HUILA':'Andina',
  'NORTE DE SANTANDER':'Andina','NORTE SANTANDER':'Andina',
  'QUINDÍO':'Andina','RISARALDA':'Andina','SANTANDER':'Andina','TOLIMA':'Andina',
  'ATLÁNTICO':'Caribe','BOLÍVAR':'Caribe','CESAR':'Caribe',
  'CÓRDOBA':'Caribe','LA GUAJIRA':'Caribe','MAGDALENA':'Caribe',
  'SUCRE':'Caribe','SAN ANDRÉS':'Caribe',
  'CAUCA':'Pacífico','CHOCÓ':'Pacífico','NARIÑO':'Pacífico','VALLE DEL CAUCA':'Pacífico',
  'ARAUCA':'Llanos','CASANARE':'Llanos','META':'Llanos','VICHADA':'Llanos',
  'AMAZONAS':'Amazonía','CAQUETÁ':'Amazonía','GUAINÍA':'Amazonía',
  'GUAVIARE':'Amazonía','PUTUMAYO':'Amazonía','VAUPÉS':'Amazonía',
}

// Semáforo por área — umbrales específicos según criterios pedagógicos AAMO
const SEMAFORO_T = {
  mat: [35, 50, 70],   // insuf ≤35, min ≤50, satis ≤70, avanz >70
  cn:  [40, 55, 70],
  soc: [40, 55, 70],
  lc:  [35, 50, 65],
  ing: [36, 57, 70],
  _:   [24, 44, 64],   // genérico para competencias, porcentajes, etc.
}
const NIVEL_BG    = ['#FEE2E2','#FFEDD5','#FEF9C3','#DCFCE7']
const NIVEL_COLOR = [C.red,'#F97316','#F59E0B',C.green]
const semaforoNivel = (v, area='_') => {
  const [t1,t2,t3] = SEMAFORO_T[area] || SEMAFORO_T['_']
  return v > t3 ? 3 : v > t2 ? 2 : v > t1 ? 1 : 0
}
const semaforoBg    = (v, area) => NIVEL_BG[semaforoNivel(v, area)]
const semaforoColor = (v, area) => NIVEL_COLOR[semaforoNivel(v, area)]

const calcBoxStats = (vals) => {
  const v = vals.filter(x => x != null && !isNaN(x))
  if (!v.length) return {min:0,q1:0,median:0,q3:0,max:0,mean:0,std:0,n:0}
  const s = [...v].sort((a,b) => a-b)
  const n = s.length
  const q = p => { const pos=(n-1)*p; const lo=Math.floor(pos); const hi=Math.ceil(pos); return s[lo]+(s[hi]-s[lo])*(pos-lo) }
  const mean = v.reduce((a,b)=>a+b,0)/n
  const std  = Math.sqrt(v.reduce((a,b)=>a+Math.pow(b-mean,2),0)/n)
  return { min:s[0], q1:q(0.25), median:q(0.5), q3:q(0.75), max:s[n-1], mean, std, n }
}

// Leyenda genérica (para tabs de competencias, desviación, etc.)
const LeyendaNiveles = () => (
  <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:12}}>
    {[
      {label:'Nivel 1', color:C.red},
      {label:'Nivel 2', color:'#F97316'},
      {label:'Nivel 3', color:'#F59E0B'},
      {label:'Nivel 4', color:C.green},
    ].map((l,i) => (
      <div key={i} style={{display:'flex', alignItems:'center', gap:6}}>
        <div style={{width:12, height:12, borderRadius:2, background:l.color}}/>
        <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>{l.label}</span>
      </div>
    ))}
  </div>
)

// Leyenda por área con umbrales específicos — usada en Tablero de Gestión
const AREAS_ASIGNATURAS = [
  {label:'Matemáticas',        akey:'mat', t:SEMAFORO_T.mat,
   asignaturas:['Genéricos','No Genéricos']},
  {label:'Ciencias Naturales', akey:'cn',  t:SEMAFORO_T.cn,
   asignaturas:['Química','Física','Biología','CTS']},
  {label:'Sociales y Ciudad.', akey:'soc', t:SEMAFORO_T.soc,
   asignaturas:['Sociales','Ciudadanas']},
  {label:'Lectura Crítica',    akey:'lc',  t:SEMAFORO_T.lc,
   asignaturas:['Lectura Crítica']},
  {label:'Inglés',             akey:'ing', t:SEMAFORO_T.ing,
   asignaturas:['Inglés']},
]

const LeyendaNivelesPorArea = () => (
  <div style={{marginTop:20}}>
    <div style={{fontSize:11, fontFamily:'Inter', fontWeight:600, color:C.navy,
      letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:10}}>
      Umbrales por Área
    </div>
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter', fontSize:11}}>
        <thead>
          <tr>
            {['Área','Asignatura','Nivel 1','Nivel 2','Nivel 3','Nivel 4'].map((h,i) => (
              <th key={i} style={{padding:'6px 10px', textAlign: i<2 ? 'left' : 'center',
                color: i<2 ? C.navy : NIVEL_COLOR[i-2], fontWeight:600,
                borderBottom:`2px solid ${i<2 ? C.navy : NIVEL_COLOR[i-2]}`}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {AREAS_ASIGNATURAS.flatMap(({label, t, asignaturas}) =>
            asignaturas.map((asig, i) => (
              <tr key={`${label}-${i}`} style={{borderBottom:`1px solid #f0f0f0`}}>
                {i === 0 && (
                  <td rowSpan={asignaturas.length}
                    style={{padding:'6px 10px', fontWeight:600, color:C.navy,
                      verticalAlign:'middle',
                      borderRight:'1px solid #f0f0f0'}}>
                    {label}
                  </td>
                )}
                <td style={{padding:'6px 10px', color:C.gray}}>{asig}</td>
                <td style={{padding:'6px 10px', textAlign:'center'}}>
                  <span style={{background:NIVEL_BG[0], color:NIVEL_COLOR[0],
                    padding:'2px 8px', borderRadius:4, fontWeight:600}}>0 – {t[0]}</span>
                </td>
                <td style={{padding:'6px 10px', textAlign:'center'}}>
                  <span style={{background:NIVEL_BG[1], color:NIVEL_COLOR[1],
                    padding:'2px 8px', borderRadius:4, fontWeight:600}}>{t[0]+1} – {t[1]}</span>
                </td>
                <td style={{padding:'6px 10px', textAlign:'center'}}>
                  <span style={{background:NIVEL_BG[2], color:NIVEL_COLOR[2],
                    padding:'2px 8px', borderRadius:4, fontWeight:600}}>{t[1]+1} – {t[2]}</span>
                </td>
                <td style={{padding:'6px 10px', textAlign:'center'}}>
                  <span style={{background:NIVEL_BG[3], color:NIVEL_COLOR[3],
                    padding:'2px 8px', borderRadius:4, fontWeight:600}}>{t[2]+1} – 100</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
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

// ── PLANTEL: LISTADO DE ESTUDIANTES ──────────────────────────
function PlantelEstudiantes({ colegioId }) {
  const mobile = useMobile()
  const [estudiantes, setEstudiantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroGrado, setFiltroGrado] = useState('Todos')
  const [filtroSalon, setFiltroSalon] = useState('Todos')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('estudiantes')
        .select('id, nombre, usuario, grado, salon').eq('colegio_id', colegioId).eq('activo', true)
        .order('nombre')
      setEstudiantes(data || [])
      setLoading(false)
    }
    load()
  }, [colegioId])

  const grados = ['Todos', ...new Set(estudiantes.map(e => e.grado).filter(Boolean))]
  const salones = ['Todos', ...new Set(
    estudiantes.filter(e => filtroGrado === 'Todos' || e.grado === filtroGrado)
      .map(e => e.salon).filter(Boolean)
  )]

  const filtered = estudiantes.filter(e => {
    const matchSearch = e.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      e.usuario?.includes(search)
    const matchGrado = filtroGrado === 'Todos' || e.grado === filtroGrado
    const matchSalon = filtroSalon === 'Todos' || e.salon === filtroSalon
    return matchSearch && matchGrado && matchSalon
  })

  const selStyle = {
    padding:'8px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
    fontFamily:'Inter', fontSize:12, color:C.text, background:C.bg,
    outline:'none', cursor:'pointer',
  }

  return (
    <Card>
      <CardTitle sub={`${filtered.length} de ${estudiantes.length} estudiantes activos`}>
        Listado de Estudiantes
      </CardTitle>
      {/* Filtros */}
      <div style={{display:'flex', gap:10, marginBottom:20, flexWrap:'wrap'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar por nombre o documento..."
          style={{...selStyle, flex:1, minWidth:200}}/>
        <select value={filtroGrado} onChange={e=>{setFiltroGrado(e.target.value); setFiltroSalon('Todos')}}
          style={selStyle}>
          {grados.map(g => <option key={g} value={g}>{g==='Todos'?'Todos los grados':`Grado ${g}`}</option>)}
        </select>
        <select value={filtroSalon} onChange={e=>setFiltroSalon(e.target.value)} style={selStyle}>
          {salones.map(s => <option key={s} value={s}>{s==='Todos'?'Todos los salones':`Salón ${s}`}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter'}}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter'}}>
          No se encontraron estudiantes.
        </div>
      ) : (
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter', minWidth: mobile ? 480 : 'auto'}}>
            <thead>
              <tr style={{borderBottom:`2px solid ${C.bg2}`}}>
                {['#','Nombre','Grado','Salón','Usuario'].map(h => (
                  <th key={h} style={{textAlign:'left', padding:'8px 12px', fontSize:10,
                    color:C.gray, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e,i) => (
                <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`,
                  background:i%2===0?`${C.bg}80`:'transparent'}}>
                  <td style={{padding:'10px 12px', fontSize:12, color:C.gray}}>{i+1}</td>
                  <td style={{padding:'10px 12px', fontSize:13, color:C.text, fontWeight:500, whiteSpace:'nowrap'}}>{e.nombre}</td>
                  <td style={{padding:'10px 12px', fontSize:12, color:C.gray}}>{e.grado||'—'}</td>
                  <td style={{padding:'10px 12px', fontSize:12, color:C.gray}}>{e.salon||'—'}</td>
                  <td style={{padding:'10px 12px', fontSize:12, color:C.navy, fontWeight:500}}>{e.usuario}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── PLANTEL: REPORTE DE RESULTADOS ───────────────────────────
function PlantelResultados({ colegioId, pruebas }) {
  const mobile = useMobile()
  const [estudiantes, setEstudiantes] = useState([])
  const [resultados, setResultados] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroPrueba, setFiltroPrueba] = useState('')
  const [filtroGrado, setFiltroGrado] = useState('Todos')
  const [filtroSalon, setFiltroSalon] = useState('Todos')

  useEffect(() => {
    const load = async () => {
      const { data: est } = await supabase.from('estudiantes')
        .select('id, nombre, usuario, grado, salon').eq('colegio_id', colegioId).eq('activo', true).order('nombre')
      setEstudiantes(est || [])
      setLoading(false)
    }
    load()
  }, [colegioId])

  useEffect(() => {
    if (!filtroPrueba) return
    const load = async () => {
      const { data } = await supabase.from('resultados_estudiante')
        .select('estudiante_id, puntaje_global')
        .eq('colegio_id', colegioId).eq('prueba_id', filtroPrueba)
      setResultados(data || [])
    }
    load()
  }, [filtroPrueba, colegioId])

  const grados = ['Todos', ...new Set(estudiantes.map(e => e.grado).filter(Boolean))]
  const salones = ['Todos', ...new Set(
    estudiantes.filter(e => filtroGrado==='Todos' || e.grado===filtroGrado)
      .map(e => e.salon).filter(Boolean)
  )]

  const filtered = estudiantes.filter(e => {
    const matchGrado = filtroGrado==='Todos' || e.grado===filtroGrado
    const matchSalon = filtroSalon==='Todos' || e.salon===filtroSalon
    return matchGrado && matchSalon
  })

  const tieneResultado = (estId) => resultados.some(r => r.estudiante_id === estId)
  const conResultados = filtered.filter(e => tieneResultado(e.id)).length
  const sinResultados = filtered.length - conResultados

  const selStyle = {
    padding:'8px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
    fontFamily:'Inter', fontSize:12, color:C.text, background:C.bg, outline:'none', cursor:'pointer',
  }

  return (
    <div style={{display:'grid', gap:16}}>
      <Card>
        <CardTitle sub="Estudiantes con y sin resultados cargados">Reporte de Resultados</CardTitle>
        {/* Filtros */}
        <div style={{display:'flex', gap:10, marginBottom:20, flexWrap:'wrap'}}>
          <select value={filtroPrueba} onChange={e=>setFiltroPrueba(e.target.value)} style={selStyle}>
            <option value="">Seleccionar prueba...</option>
            {pruebas.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
          </select>
          <select value={filtroGrado} onChange={e=>{setFiltroGrado(e.target.value); setFiltroSalon('Todos')}}
            style={selStyle}>
            {grados.map(g => <option key={g} value={g}>{g==='Todos'?'Todos los grados':`Grado ${g}`}</option>)}
          </select>
          <select value={filtroSalon} onChange={e=>setFiltroSalon(e.target.value)} style={selStyle}>
            {salones.map(s => <option key={s} value={s}>{s==='Todos'?'Todos los salones':`Salón ${s}`}</option>)}
          </select>
        </div>

        {/* KPIs resumen */}
        {filtroPrueba && (
          <div style={{display:'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)', gap:12, marginBottom:20}}>
            {[
              {label:'Total estudiantes', val:filtered.length, color:C.navy},
              {label:'Con resultados', val:conResultados, color:C.green},
              {label:'Sin resultados', val:sinResultados, color:sinResultados>0?C.amber:C.green},
            ].map((k,i) => (
              <div key={i} style={{background:C.bg, borderRadius:8, padding:'16px',
                textAlign:'center', border:`1px solid ${C.grayLt}`}}>
                <div style={{fontSize:10, color:C.gray, fontFamily:'Inter',
                  textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>{k.label}</div>
                <div style={{fontSize:28, fontFamily:'Playfair Display, serif',
                  color:k.color, fontWeight:700}}>{k.val}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter'}}>Cargando...</div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter', minWidth: mobile ? 420 : 'auto'}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.bg2}`}}>
                  {['#','Nombre','Grado','Salón','Estado','Puntaje'].map(h => (
                    <th key={h} style={{textAlign:'left', padding:'8px 12px', fontSize:10,
                      color:C.gray, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e,i) => {
                  const res = resultados.find(r => r.estudiante_id === e.id)
                  return (
                    <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`,
                      background:i%2===0?`${C.bg}80`:'transparent'}}>
                      <td style={{padding:'10px 12px', fontSize:12, color:C.gray}}>{i+1}</td>
                      <td style={{padding:'10px 12px', fontSize:13, color:C.text, fontWeight:500, whiteSpace:'nowrap'}}>{e.nombre}</td>
                      <td style={{padding:'10px 12px', fontSize:12, color:C.gray}}>{e.grado||'—'}</td>
                      <td style={{padding:'10px 12px', fontSize:12, color:C.gray}}>{e.salon||'—'}</td>
                      <td style={{padding:'10px 12px'}}>
                        {!filtroPrueba ? (
                          <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>Selecciona una prueba</span>
                        ) : res ? (
                          <Badge color={C.green}>Con resultados</Badge>
                        ) : (
                          <Badge color={C.amber}>Sin resultados</Badge>
                        )}
                      </td>
                      <td style={{padding:'10px 12px', fontSize:14, fontWeight:700,
                        color:C.navy, fontFamily:'Playfair Display, serif'}}>
                        {res?.puntaje_global ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ── PLANTEL: MENCIÓN DE HONOR ─────────────────────────────────
function PlantelMencion({ colegioId, pruebas }) {
  const mobile = useMobile()
  const [filtroPrueba, setFiltroPrueba] = useState('')
  const [filtroGrado, setFiltroGrado] = useState('Todos')
  const [filtroSalon, setFiltroSalon] = useState('Todos')
  const [ganador, setGanador] = useState(null)
  const [todosResultados, setTodosResultados] = useState([])
  const [grados, setGrados] = useState(['Todos'])
  const [salones, setSalones] = useState(['Todos'])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadGrados = async () => {
      const { data } = await supabase.from('estudiantes')
        .select('grado, salon').eq('colegio_id', colegioId).eq('activo', true)
      const g = ['Todos', ...new Set((data||[]).map(e=>e.grado).filter(Boolean))]
      setGrados(g)
    }
    loadGrados()
  }, [colegioId])

  useEffect(() => {
    const updateSalones = async () => {
      const { data } = await supabase.from('estudiantes')
        .select('salon, grado').eq('colegio_id', colegioId).eq('activo', true)
      const filtered = (data||[]).filter(e => filtroGrado==='Todos' || e.grado===filtroGrado)
      setSalones(['Todos', ...new Set(filtered.map(e=>e.salon).filter(Boolean))])
      setFiltroSalon('Todos')
    }
    updateSalones()
  }, [filtroGrado, colegioId])

  useEffect(() => {
    if (!filtroPrueba) return
    const load = async () => {
      setLoading(true)
      const { data } = await supabase.from('resultados_estudiante')
        .select('*, estudiantes(nombre, grado, salon)')
        .eq('colegio_id', colegioId).eq('prueba_id', filtroPrueba)
        .order('puntaje_global', {ascending: false})
      setTodosResultados(data || [])
      setLoading(false)
    }
    load()
  }, [filtroPrueba])

  useEffect(() => {
    if (!todosResultados.length) { setGanador(null); return }
    const filtrados = todosResultados.filter(r => {
      const g = filtroGrado==='Todos' || r.estudiantes?.grado===filtroGrado
      const s = filtroSalon==='Todos' || r.estudiantes?.salon===filtroSalon
      return g && s
    })
    setGanador(filtrados[0] || null)
  }, [todosResultados, filtroGrado, filtroSalon])

  const selStyle = {
    padding:'8px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
    fontFamily:'Inter', fontSize:12, color:C.text, background:C.bg, outline:'none', cursor:'pointer',
  }

  const areas = ganador ? [
    {label:'Mat. Cuantitativa', val:ganador.mat_cuantitativo},
    {label:'Mat. Específica',   val:ganador.mat_especifico},
    {label:'Química',           val:ganador.cn_quimica},
    {label:'Física',            val:ganador.cn_fisica},
    {label:'Biología',          val:ganador.cn_biologia},
    {label:'CTS',               val:ganador.cn_cts},
    {label:'Sociales',          val:ganador.sociales},
    {label:'Lect. Crítica',     val:ganador.lectura_critica},
    {label:'Inglés',            val:ganador.ingles},
  ].filter(a => a.val != null) : []

  return (
    <Card>
      <CardTitle sub="Estudiante con mejor puntaje según los filtros aplicados">
        🏅 Mención de Honor
      </CardTitle>

      {/* Filtros */}
      <div style={{display:'flex', gap:10, marginBottom:24, flexWrap:'wrap'}}>
        <select value={filtroPrueba} onChange={e=>setFiltroPrueba(e.target.value)} style={selStyle}>
          <option value="">Seleccionar prueba...</option>
          {pruebas.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
        </select>
        <select value={filtroGrado} onChange={e=>setFiltroGrado(e.target.value)} style={selStyle}>
          {grados.map(g => <option key={g} value={g}>{g==='Todos'?'Todos los grados':`Grado ${g}`}</option>)}
        </select>
        <select value={filtroSalon} onChange={e=>setFiltroSalon(e.target.value)} style={selStyle}>
          {salones.map(s => <option key={s} value={s}>{s==='Todos'?'Todos los salones':`Salón ${s}`}</option>)}
        </select>
      </div>

      {!filtroPrueba ? (
        <div style={{textAlign:'center', padding:60, color:C.gray, fontFamily:'Inter'}}>
          <div style={{fontSize:40, marginBottom:12}}>🏅</div>
          <div style={{fontFamily:'Playfair Display, serif', fontSize:18, color:C.navy, marginBottom:8}}>
            Selecciona una prueba
          </div>
          <div style={{fontSize:13}}>para ver el estudiante con mejor desempeño.</div>
        </div>
      ) : loading ? (
        <div style={{textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter'}}>Cargando...</div>
      ) : !ganador ? (
        <div style={{textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter'}}>
          No hay resultados para los filtros seleccionados.
        </div>
      ) : (
        <div>
          {/* Tarjeta del ganador */}
          <div style={{background:`linear-gradient(135deg, ${C.navy} 0%, #1A3560 100%)`,
            borderRadius:16, padding:40, textAlign:'center', marginBottom:24,
            position:'relative', overflow:'hidden'}}>
            <div style={{position:'absolute', top:-20, right:-20, fontSize:120, opacity:0.05}}>🏅</div>
            <div style={{fontSize:48, marginBottom:12}}>🏅</div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.5)', fontFamily:'Inter',
              letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:8}}>
              Mención de Honor
            </div>
            <div style={{fontSize:28, fontFamily:'Playfair Display, serif', color:'#FFFFFF',
              fontWeight:400, marginBottom:4}}>{ganador.estudiantes?.nombre}</div>
            <div style={{fontSize:13, color:'rgba(255,255,255,0.5)', fontFamily:'Inter', marginBottom:24}}>
              Grado {ganador.estudiantes?.grado} · Salón {ganador.estudiantes?.salon}
            </div>
            <div style={{display:'inline-block', background:'rgba(255,255,255,0.1)',
              borderRadius:12, padding:'16px 40px'}}>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.5)', fontFamily:'Inter',
                letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4}}>Puntaje Global</div>
              <div style={{fontSize:52, fontFamily:'Playfair Display, serif',
                color:C.greenLt, fontWeight:700, lineHeight:1}}>{ganador.puntaje_global}</div>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', fontFamily:'Inter',
                marginTop:4}}>de 500 puntos</div>
            </div>
          </div>

          {/* Desglose por áreas */}
          <div style={{display:'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)', gap:10}}>
            {areas.map((a,i) => (
              <div key={i} style={{background:C.bg, borderRadius:8, padding:'14px 16px',
                border:`1px solid ${C.grayLt}`}}>
                <div style={{fontSize:10, color:C.gray, fontFamily:'Inter',
                  textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4}}>{a.label}</div>
                <div style={{fontSize:22, fontFamily:'Playfair Display, serif',
                  color:semaforoColor(a.val), fontWeight:700}}>{a.val?.toFixed(1)}%</div>
                <div style={{height:4, background:C.bg2, borderRadius:2, marginTop:6, overflow:'hidden'}}>
                  <div style={{height:'100%', width:`${a.val}%`, borderRadius:2,
                    background:semaforoColor(a.val)}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

// ── RECOMENDACIONES — SOLO LECTURA ───────────────────────────
function RecomendacionesClaude({ session, prueba }) {
  const [analisis, setAnalisis] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      if (!session?.id || !prueba?.id) { setLoading(false); return }
      const { data } = await supabase.from('analisis_ia')
        .select('id, contenido, created_at, publicado')
        .eq('colegio_id', session.id)
        .eq('prueba_id', prueba.id)
        .eq('publicado', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setAnalisis(data || null)
      setLoading(false)
    }
    load()
  }, [session?.id, prueba?.id])

  const formatText = (text) => text.split('\n').map((line, i) => {
    if (line.match(/^\d\./)) return (
      <div key={i} style={{fontFamily:'Playfair Display, serif', fontSize:16,
        color:C.navy, fontWeight:600, marginTop:20, marginBottom:8}}>{line}</div>
    )
    if (line.startsWith('- ') || line.startsWith('• ')) return (
      <div key={i} style={{fontFamily:'Inter', fontSize:13, color:C.text,
        lineHeight:1.8, paddingLeft:16, marginBottom:4, display:'flex', gap:8}}>
        <span style={{color:C.green, flexShrink:0}}>▸</span>
        <span>{line.replace(/^[-•]\s*/,'')}</span>
      </div>
    )
    if (line.trim()) return (
      <p key={i} style={{fontFamily:'Inter', fontSize:13, color:C.gray,
        lineHeight:1.9, marginBottom:8}}>{line}</p>
    )
    return <div key={i} style={{height:4}}/>
  })

  return (
    <div style={{display:'grid', gap:16}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg, ${C.navy} 0%, #1A3560 100%)`,
        borderRadius:16, padding:'32px 40px', position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', top:-20, right:-20, fontSize:120, opacity:0.06}}>🤖</div>
        <div style={{fontSize:10, color:'rgba(255,255,255,0.45)', fontFamily:'Inter',
          letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:10}}>
          Consultoría Inteligente — Powered by Claude AI
        </div>
        <div style={{fontSize:26, fontFamily:'Playfair Display, serif', color:'#FFFFFF', marginBottom:8}}>
          Análisis y Recomendaciones
        </div>
        <div style={{fontSize:13, color:'rgba(255,255,255,0.6)', fontFamily:'Inter', lineHeight:1.7, maxWidth:600}}>
          Recomendaciones pedagógicas personalizadas generadas por inteligencia artificial
          y publicadas por el equipo de Asesorías Académicas Milton Ochoa.
        </div>
      </div>

      {loading ? (
        <Card>
          <div style={{textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter'}}>
            Cargando análisis...
          </div>
        </Card>
      ) : !analisis ? (
        <Card>
          <div style={{textAlign:'center', padding:60, display:'flex', flexDirection:'column',
            alignItems:'center', gap:16}}>
            <div style={{fontSize:48}}>📋</div>
            <div style={{fontFamily:'Playfair Display, serif', fontSize:20, color:C.navy}}>
              Análisis en preparación
            </div>
            <div style={{fontFamily:'Inter', fontSize:13, color:C.gray, maxWidth:380, textAlign:'center'}}>
              El equipo de Milton Ochoa está preparando el análisis de resultados
              para su institución. Estará disponible próximamente.
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{marginBottom:20, paddingBottom:12, borderBottom:`1px solid ${C.bg2}`}}>
            <div style={{fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
              textTransform:'uppercase'}}>Informe de Recomendaciones Pedagógicas</div>
            <div style={{fontSize:11, color:C.gray, fontFamily:'Inter', marginTop:3}}>
              Publicado por Asesorías Académicas Milton Ochoa ·{' '}
              {new Date(analisis.created_at).toLocaleDateString('es-CO', {
                year:'numeric', month:'long', day:'numeric', timeZone:'America/Bogota'
              })}
            </div>
          </div>
          <div>{formatText(analisis.contenido)}</div>
        </Card>
      )}
    </div>
  )
}

// ── MAIN DASHBOARD ───────────────────────────────────────────
export default function ColegioDashboard({session, onLogout}) {
  const mobile = useMobile()
  const tablet = useTablet()
  const [tab, setTab] = useState('carta')
  const [boxHover, setBoxHover] = useState(null) // {d, x, y}
  const [menuSection, setMenuSection] = useState('plantel')
  const [subGroup, setSubGroup] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [prueba, setPrueba] = useState(null)

  // Filter states
  const [allPruebas, setAllPruebas] = useState([])
  const [pruebasDisponibles, setPruebasDisponibles] = useState([])
  const [selectedPrueba, setSelectedPrueba] = useState(null)
  const [selectedGrado, setSelectedGrado] = useState('Todos')
  const [selectedSalon, setSelectedSalon] = useState('Todos')

  // Student detail modal
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentDetalle, setStudentDetalle] = useState(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  // Data states
  const [allStudents, setAllStudents] = useState([])
  const [tableroComp, setTableroComp] = useState([])
  const [tableroSalon, setTableroSalon] = useState([])
  const [competencias, setCompetencias] = useState([])
  const [compGestion, setCompGestion] = useState([])
  const [compAsigFilter, setCompAsigFilter] = useState('Todas')
  const [notasComp, setNotasComp] = useState([])
  const [notasCompAsig, setNotasCompAsig] = useState('Todas')
  const [notasCompN, setNotasCompN] = useState([])
  const [notasCompNAsig, setNotasCompNAsig] = useState('Todas')
  const [compNGestion, setCompNGestion] = useState([])
  const [mejoraLimite, setMejoraLimite] = useState(0)
  const [mejoraAsig, setMejoraAsig] = useState('Todas')
  const [mejoraArea, setMejoraArea] = useState('Todas')
  const [mejoraSort, setMejoraSort] = useState({col:'pctDebajo', dir:'desc'})
  const [compMejoraLimite, setCompMejoraLimite] = useState(0)
  const [compMejoraAsig, setCompMejoraAsig] = useState('Todas')
  const [compMejoraArea, setCompMejoraArea] = useState('Todas')
  const [compMejoraSort, setCompMejoraSort] = useState({col:'pctDebajo', dir:'desc'})
  const [compNAsigFilter, setCompNAsigFilter] = useState('Todas')
  const [equilibrioMateria, setEquilibrioMateria] = useState('')
  const [consolidadoArea, setConsolidadoArea] = useState('Todas')
  const [distribModal, setDistribModal] = useState(null)   // {q, data, loading}

  const [desviacionView, setDesviacionView] = useState('bars')
  const [mejoraView, setMejoraView] = useState('table')
  const [compDesviacionView, setCompDesviacionView] = useState('bars')
  const [compMejoraView, setCompMejoraView] = useState('table')
  const [notasCompSort, setNotasCompSort] = useState({col:'nombre', dir:'asc'})
  const [notasCompNSort, setNotasCompNSort] = useState({col:'nombre', dir:'asc'})
  const [rankingSort, setRankingSort] = useState({col:'_def', dir:'desc'})
  const [detallePruebaSort, setDetallePruebaSort] = useState({col:'nro_pregunta', dir:'asc'})
  const [listadoNotasSort, setListadoNotasSort] = useState({col:'_def', dir:'desc'})
  const [nombreColWidth, setNombreColWidth] = useState(175)
  const [convMin, setConvMin] = useState(0)
  const [convMax, setConvMax] = useState(5)
  const [convAprobacion, setConvAprobacion] = useState(3.5)
  const [convUmbral, setConvUmbral] = useState(45)
  const [oportunidades, setOportunidades] = useState([])
  const [detallePreguntas, setDetallePreguntas] = useState([])
  const [allPruebasPromedio, setAllPruebasPromedio] = useState([])

  const mountedRef = useRef(true)
  useEffect(() => { return () => { mountedRef.current = false } }, [])

  useEffect(() => { setBoxHover(null) }, [tab])

  useEffect(() => {
    let cancelled = false
    loadAll()
    return () => { cancelled = true }
  }, [])

  // Filtered students based on selectors
  const students = allStudents.filter(s => {
    if (selectedGrado !== 'Todos' && String(s.estudiantes?.grado) !== selectedGrado) return false
    if (selectedSalon !== 'Todos' && String(s.estudiantes?.salon) !== selectedSalon) return false
    return true
  })

  // Derived filter options from loaded data
  const gradosDisponibles = useMemo(() =>
    ['Todos', ...new Set(allStudents.map(s => s.estudiantes?.grado != null ? String(s.estudiantes.grado) : null).filter(Boolean)).values()],
    [allStudents]
  )
  const salonesDisponibles = useMemo(() =>
    ['Todos', ...new Set(
      allStudents
        .filter(s => selectedGrado === 'Todos' || String(s.estudiantes?.grado) === selectedGrado)
        .map(s => s.estudiantes?.salon != null ? String(s.estudiantes.salon) : null).filter(Boolean)
    ).values()],
    [allStudents, selectedGrado]
  )

  // Reload when prueba changes
  useEffect(() => {
    if (!selectedPrueba) return
    let cancelled = false
    loadForPrueba(selectedPrueba, () => cancelled)
    return () => { cancelled = true }
  }, [selectedPrueba])

  // Load student detail when selectedStudent changes
  useEffect(() => {
    if (!selectedStudent || !selectedPrueba) return
    let cancelled = false
    setStudentDetalle(null)
    setLoadingDetalle(true)
    supabase
      .from('resultados_estudiante')
      .select('detalle')
      .eq('estudiante_id', selectedStudent.estudiante_id)
      .eq('prueba_id', selectedPrueba.id)
      .eq('colegio_id', session.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        setStudentDetalle(data?.detalle || [])
        setLoadingDetalle(false)
      })
    return () => { cancelled = true }
  }, [selectedStudent, selectedPrueba])

  const loadAll = async () => {
    setLoading(true)
    try {
      // Registrar última sesión del colegio (hora Colombia)
      await supabase.from('colegios').update({
        ultima_sesion: new Date().toISOString()
      }).eq('id', session.id)

      if (!mountedRef.current) return

      // Cargar todas las pruebas activas
      const { data: pruebasData } = await supabase
        .from('pruebas').select('id, codigo, nombre, fecha, grado, tipo, activa, created_at, estructura_excel').eq('activa', true)
        .order('created_at', {ascending: false})
      if (!mountedRef.current) return
      setAllPruebas(pruebasData || [])

      if (!pruebasData?.length) { setLoading(false); return }

      // Seleccionar la más reciente por defecto
      // setSelectedPrueba dispara el useEffect que llama loadForPrueba — no llamar dos veces
      const primera = pruebasData[0]
      setSelectedPrueba(primera)
      setPrueba(primera)

      // Notas Acumuladas — promedios por prueba para línea de tiempo
      const { data: todosRes } = await supabase
        .from('resultados_estudiante')
        .select('prueba_id, puntaje_global, mat_cuantitativo, mat_especifico, cn_quimica, cn_fisica, cn_biologia, cn_cts, sociales, ciudadanas, lectura_critica, ingles')
        .eq('colegio_id', session.id)
      if (pruebasData?.length) {
        const idsConResultados = new Set((todosRes || []).map(r => r.prueba_id))
        setPruebasDisponibles(pruebasData.filter(p => idsConResultados.has(p.id)))
      }
      if (todosRes && pruebasData?.length) {
        const byPrueba = {}
        todosRes.forEach(r => {
          if (!byPrueba[r.prueba_id]) byPrueba[r.prueba_id] = []
          byPrueba[r.prueba_id].push(r)
        })
        const avgNull = arr => { const f = arr.filter(v => v != null && !isNaN(v)); return f.length ? f.reduce((a,b)=>a+b,0)/f.length : null }
        const promedios = [...pruebasData].reverse().map(p => {
          const arr = byPrueba[p.id] || []
          if (!arr.length) return null
          return {
            label: p.codigo || p.nombre,
            prueba: p,
            global: Math.round(avgNull(arr.map(r=>r.puntaje_global))),
            mat:    Math.round(avgNull(arr.flatMap(r=>[r.mat_cuantitativo,r.mat_especifico]))),
            cn:     Math.round(avgNull(arr.flatMap(r=>[r.cn_quimica,r.cn_fisica,r.cn_biologia,r.cn_cts]))),
            soc:    Math.round(avgNull(arr.flatMap(r=>[r.sociales,r.ciudadanas]))),
            lc:     Math.round(avgNull(arr.map(r=>r.lectura_critica))),
            ing:    Math.round(avgNull(arr.map(r=>r.ingles))),
            n: arr.length,
          }
        }).filter(Boolean)
        setAllPruebasPromedio(promedios)
      }

    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadForPrueba = async (pruebaSelec, isCancelled = () => false) => {
    setLoading(true)
    // Reset all derived filters when prueba changes
    setCompNAsigFilter('Todas')
    setEquilibrioMateria('')
    setConsolidadoArea('Todas')
    setMejoraView('table')
    setCompMejoraView('table')
    setDesviacionView('bars')
    setCompDesviacionView('bars')
    setMejoraLimite(0)
    setCompMejoraLimite(0)
    setMejoraArea('Todas')
    setCompMejoraArea('Todas')
    setMejoraAsig('Todas')
    setCompMejoraAsig('Todas')
    setNotasCompSort({col:'nombre', dir:'asc'})
    setNotasCompNSort({col:'nombre', dir:'asc'})
    setRankingSort({col:'_def', dir:'desc'})
    setDetallePruebaSort({col:'nro_pregunta', dir:'asc'})
    setListadoNotasSort({col:'_def', dir:'desc'})
    setSelectedStudent(null)
    setStudentDetalle(null)
    try {
      const pid = pruebaSelec.id
      const cid = session.id
      setPrueba(pruebaSelec)

      // Resultados estudiantes
      const { data: res } = await supabase
        .from('resultados_estudiante')
        .select('*, estudiantes(nombre, salon, grado, codigo, usuario)')
        .eq('colegio_id', cid).eq('prueba_id', pid)
        .order('puntaje_global', {ascending: false})
      if (isCancelled()) return
      setAllStudents(res || [])
      setSelectedGrado('Todos')
      setSelectedSalon('Todos')

      if (!res?.length) {
        setCompetencias([])
        setCompGestion([])
        setNotasComp([])
        setNotasCompN([])
        setCompNGestion([])
        setOportunidades([])
        setDetallePreguntas([])
        setLoading(false)
        return
      }

      // Tablero de gestión (calculado dinámicamente)
      const { data: tablero } = await supabase.rpc('get_tablero_gestion', {
        p_prueba_id: pid,
        p_colegio_id: cid,
      })
      if (tablero) {
        setTableroComp(tablero.comparativos || [])
        setTableroSalon(tablero.por_salon || [])
      }

      if (isCancelled()) return
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
      if (isCancelled()) return

      // Desviación competencias (comparativo geográfico)
      const { data: cgData } = await supabase.rpc('get_competencias_gestion', {
        p_prueba_id: pid,
        p_colegio_id: cid,
      })
      if (isCancelled()) return
      setCompGestion(cgData || [])
      // Seleccionar automáticamente la primera asignatura disponible
      const firstMat = cgData?.length ? cgData[0].materia : 'Todas'
      setCompAsigFilter(firstMat)
      setMejoraAsig(firstMat)

      // Notas por competencia
      const { data: nc } = await supabase
        .from('notas_competencia')
        .select('estudiante_id, materia, competencia, nota, preguntas')
        .in('estudiante_id', (res||[]).map(r => r.estudiante_id))
        .eq('prueba_id', pid)
        .order('materia').order('competencia').order('nota')
      if (isCancelled()) return
      setNotasComp(nc || [])
      setNotasCompAsig('Todas')

      // Notas por componente
      const { data: ncn } = await supabase
        .from('notas_componente')
        .select('estudiante_id, materia, componente, nota, preguntas')
        .in('estudiante_id', (res||[]).map(r => r.estudiante_id))
        .eq('prueba_id', pid)
        .order('materia').order('componente').order('nota')
      if (isCancelled()) return
      setNotasCompN(ncn || [])
      setNotasCompNAsig('Todas')

      // Desviación componentes (comparativo geográfico)
      const { data: cgnData } = await supabase.rpc('get_componentes_gestion', {
        p_prueba_id: pid, p_colegio_id: cid,
      })
      if (isCancelled()) return
      setCompNGestion(cgnData || [])
      const firstMatN = cgnData?.length ? cgnData[0].materia : 'Todas'
      setCompNAsigFilter(firstMatN)

      // Oportunidades
      const { data: opor } = await supabase
        .from('analisis_preguntas').select('id, nro_pregunta, sesion, area, asignatura, competencia, pct_colegio, pct_nacional, oportunidad_mejora')
        .eq('colegio_id', cid).eq('prueba_id', pid)
        .eq('oportunidad_mejora', true).order('pct_colegio')
      if (isCancelled()) return
      setOportunidades(opor || [])

      // Detalle Prueba — todas las preguntas
      const { data: detalle } = await supabase
        .from('analisis_preguntas')
        .select('id, sesion, nro_pregunta, materia, estandar, competencia, componente, tarea, respuesta_correcta, pct_nacional, pct_colegio, dificultad, oportunidad_mejora')
        .eq('colegio_id', cid).eq('prueba_id', pid)
        .order('sesion').order('nro_pregunta')
      if (isCancelled()) return
      setDetallePreguntas(detalle || [])

    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── COMPUTED DATA ─────────────────────────────────────────
  const globals = students.map(s => s.puntaje_global).filter(v => v != null && !isNaN(v))
  const promGlobal = globals.length ? Math.round(avgArr(globals)) : 0
  const maxStudent = students[0]
  const minStudent = students[students.length-1]

  // Áreas para radar
  const radarData = [
    {area:'Matemáticas',    plantel: Math.round(avgArr(students.map(s=>s.mat_cuantitativo != null && s.mat_especifico != null ? (s.mat_cuantitativo+s.mat_especifico)/2 : null).filter(v => v != null && !isNaN(v))))},
    {area:'Cs. Naturales',  plantel: Math.round(avgArr(students.map(s=>s.cn_quimica != null && s.cn_fisica != null && s.cn_biologia != null && s.cn_cts != null ? (s.cn_quimica+s.cn_fisica+s.cn_biologia+s.cn_cts)/4 : null).filter(v => v != null && !isNaN(v))))},
    {area:'Soc. y Ciudad.', plantel: Math.round(avgArr(students.map(s=>s.sociales != null && s.ciudadanas != null ? (s.sociales+s.ciudadanas)/2 : null).filter(v => v != null && !isNaN(v))))},
    {area:'Lect. Crítica',  plantel: Math.round(avgArr(students.map(s=>s.lectura_critica).filter(v => v != null && !isNaN(v))))},
    {area:'Inglés',         plantel: Math.round(avgArr(students.map(s=>s.ingles).filter(v => v != null && !isNaN(v))))},
  ]

  // Promedios por área para barras
  const areaData = [
    {area:'Mat. Cuant.', plan: Math.round(avgArr(students.map(s=>s.mat_cuantitativo).filter(v => v != null && !isNaN(v))))},
    {area:'Mat. Espec.', plan: Math.round(avgArr(students.map(s=>s.mat_especifico).filter(v => v != null && !isNaN(v))))},
    {area:'Química',     plan: Math.round(avgArr(students.map(s=>s.cn_quimica).filter(v => v != null && !isNaN(v))))},
    {area:'Física',      plan: Math.round(avgArr(students.map(s=>s.cn_fisica).filter(v => v != null && !isNaN(v))))},
    {area:'Biología',    plan: Math.round(avgArr(students.map(s=>s.cn_biologia).filter(v => v != null && !isNaN(v))))},
    {area:'CTS',         plan: Math.round(avgArr(students.map(s=>s.cn_cts).filter(v => v != null && !isNaN(v))))},
    {area:'Sociales',    plan: Math.round(avgArr(students.map(s=>s.sociales).filter(v => v != null && !isNaN(v))))},
    {area:'Ciudadanas',  plan: Math.round(avgArr(students.map(s=>s.ciudadanas).filter(v => v != null && !isNaN(v))))},
    {area:'Lect. Crít.', plan: Math.round(avgArr(students.map(s=>s.lectura_critica).filter(v => v != null && !isNaN(v))))},
    {area:'Inglés',      plan: Math.round(avgArr(students.map(s=>s.ingles).filter(v => v != null && !isNaN(v))))},
  ]

  // Distribución puntajes
  const distData = [
    {rango:'< 380',   cant:globals.filter(g=>g<380).length,              color:C.red},
    {rango:'380–399', cant:globals.filter(g=>g>=380&&g<400).length,      color:'#F59E0B'},
    {rango:'400–419', cant:globals.filter(g=>g>=400&&g<420).length,      color:C.blue},
    {rango:'420–439', cant:globals.filter(g=>g>=420&&g<440).length,      color:C.green},
    {rango:'≥ 440',   cant:globals.filter(g=>g>=440).length,             color:C.navy},
  ]

  // Niveles por asignatura (con umbrales específicos por área)
  const nivelesAsig = [
    {asig:'Genéricos',     akey:'mat', vals: students.map(s=>s.mat_cuantitativo)},
    {asig:'No Genéricos',  akey:'mat', vals: students.map(s=>s.mat_especifico)},
    {asig:'Química',       akey:'cn',  vals: students.map(s=>s.cn_quimica)},
    {asig:'Física',        akey:'cn',  vals: students.map(s=>s.cn_fisica)},
    {asig:'Biología',      akey:'cn',  vals: students.map(s=>s.cn_biologia)},
    {asig:'CTS',           akey:'cn',  vals: students.map(s=>s.cn_cts)},
    {asig:'Sociales',      akey:'soc', vals: students.map(s=>s.sociales)},
    {asig:'Ciudadanas',    akey:'soc', vals: students.map(s=>s.ciudadanas)},
    {asig:'Lect. Crítica', akey:'lc',  vals: students.map(s=>s.lectura_critica)},
    {asig:'Inglés',        akey:'ing', vals: students.map(s=>s.ingles)},
  ].map(({asig, akey, vals}) => {
    const v = vals.filter(x => x != null)
    const [t1,t2,t3] = SEMAFORO_T[akey]
    const total = v.length
    const n4c = v.filter(x=>x>t3).length
    const n3c = v.filter(x=>x>t2 && x<=t3).length
    const n2c = v.filter(x=>x>t1 && x<=t2).length
    const n1c = v.filter(x=>x<=t1).length
    return {
      asig, total, n4c, n3c, n2c, n1c,
      n4: total ? Math.round(n4c/total*100) : 0,
      n3: total ? Math.round(n3c/total*100) : 0,
      n2: total ? Math.round(n2c/total*100) : 0,
      n1: total ? Math.round(n1c/total*100) : 0,
    }
  })

  // Desviación por asignatura — box plot + tabla
  const desvAsigData = [
    {asig:'Genéricos',     akey:'mat', vals: students.map(s=>s.mat_cuantitativo)},
    {asig:'No Genéricos',  akey:'mat', vals: students.map(s=>s.mat_especifico)},
    {asig:'Química',       akey:'cn',  vals: students.map(s=>s.cn_quimica)},
    {asig:'Física',        akey:'cn',  vals: students.map(s=>s.cn_fisica)},
    {asig:'Biología',      akey:'cn',  vals: students.map(s=>s.cn_biologia)},
    {asig:'CTS',           akey:'cn',  vals: students.map(s=>s.cn_cts)},
    {asig:'Sociales',      akey:'soc', vals: students.map(s=>s.sociales)},
    {asig:'Ciudadanas',    akey:'soc', vals: students.map(s=>s.ciudadanas)},
    {asig:'Lect. Crítica', akey:'lc',  vals: students.map(s=>s.lectura_critica)},
    {asig:'Inglés',        akey:'ing', vals: students.map(s=>s.ingles)},
    {asig:'Definitiva',    akey:'_',   vals: students.map(s => {
      const gen=s.mat_cuantitativo, nogen=s.mat_especifico
      const q=s.cn_quimica, f=s.cn_fisica, b=s.cn_biologia, cts=s.cn_cts
      const soc=s.sociales, ciu=s.ciudadanas, lc=s.lectura_critica, ing=s.ingles
      if ([gen,nogen,q,f,b,cts,soc,ciu,lc,ing].some(x=>x==null)) return null
      return (((gen+nogen)/2)*3 + ((q+f+b+cts)/4)*3 + ((soc+ciu)/2)*3 + lc*3 + ing) / 13
    })},
  ].map(({asig, akey, vals}) => ({ asig, akey, ...calcBoxStats(vals) }))

  // Desviación por área
  const desvAreaData = [
    {area:'Matemáticas',          akey:'mat', vals: students.map(s => {
      if (s.mat_cuantitativo == null || s.mat_especifico == null) return null
      return (s.mat_cuantitativo + s.mat_especifico) / 2
    })},
    {area:'Ciencias Naturales',   akey:'cn',  vals: students.map(s => {
      if ([s.cn_quimica,s.cn_fisica,s.cn_biologia,s.cn_cts].some(x=>x==null)) return null
      return (s.cn_quimica + s.cn_fisica + s.cn_biologia + s.cn_cts) / 4
    })},
    {area:'Soc. y Ciudadanas',    akey:'soc', vals: students.map(s => {
      if (s.sociales == null || s.ciudadanas == null) return null
      return (s.sociales + s.ciudadanas) / 2
    })},
    {area:'Lectura Crítica',      akey:'lc',  vals: students.map(s => s.lectura_critica)},
    {area:'Inglés',               akey:'ing', vals: students.map(s => s.ingles)},
    {area:'Definitiva',           akey:'_',   vals: students.map(s => {
      const gen=s.mat_cuantitativo, nogen=s.mat_especifico
      const q=s.cn_quimica, f=s.cn_fisica, b=s.cn_biologia, cts=s.cn_cts
      const soc=s.sociales, ciu=s.ciudadanas, lc=s.lectura_critica, ing=s.ingles
      if ([gen,nogen,q,f,b,cts,soc,ciu,lc,ing].some(x=>x==null)) return null
      return (((gen+nogen)/2)*3 + ((q+f+b+cts)/4)*3 + ((soc+ciu)/2)*3 + lc*3 + ing) / 13
    })},
  ].map(({area, akey, vals}) => ({ area, akey, ...calcBoxStats(vals) }))

  // Desviación por materia
  const desvData = areaData.map(a => {
    const vals = students.map(s => {
      if (a.area==='Mat. Cuant.') return s.mat_cuantitativo
      if (a.area==='Mat. Espec.') return s.mat_especifico
      if (a.area==='Química')     return s.cn_quimica
      if (a.area==='Física')      return s.cn_fisica
      if (a.area==='Biología')    return s.cn_biologia
      if (a.area==='CTS')         return s.cn_cts
      if (a.area==='Sociales')    return s.sociales
      if (a.area==='Ciudadanas')  return s.ciudadanas
      if (a.area==='Lect. Crít.') return s.lectura_critica
      if (a.area==='Inglés')      return s.ingles
      return null
    }).filter(v => v != null && !isNaN(v))
    const prom = avgArr(vals)
    return {
      materia: a.area,
      prom: Math.round(prom),
      min: vals.length ? Math.round(Math.min(...vals)) : 0,
      max: vals.length ? Math.round(Math.max(...vals)) : 0,
      desv: vals.length ? Math.round(Math.sqrt(vals.reduce((acc,v)=>acc+Math.pow(v-prom,2),0)/vals.length)) : 0,
    }
  })

  // Tablero orden
  const tableroOrden = ['mejores','nacional','region','departamento','municipio','plantel']
  const tableroLabels = {
    mejores:      'Mejores Promedios',
    nacional:     'Colombia',
    region:       REGION_NOMBRES[session?.departamento_nombre?.toUpperCase()] || 'Región',
    departamento: toTitleCase(session?.departamento_nombre) || 'Departamento',
    municipio:    toTitleCase(session?.municipio) || 'Municipio',
    plantel:      'Plantel',
  }

  const tabs = [
    {id:'tablero',          label:'Tablero de Gestión'},
    {id:'niveles',          label:'% Estudiantes por Nivel de Desempeño'},
    {id:'desv_materias',    label:'Desviación por Asignatura'},
    {id:'desv_area',        label:'Desviación por Área'},
    {id:'desviacion',       label:'Desviación Competencias'},
    {id:'comp_comparativo', label:'Comparativo Competencias'},
    {id:'competencias',     label:'Notas Estudiantes por Competencias'},
    {id:'mejora',           label:'Oportunidad de Mejoramiento'},
    {id:'comp_desviacion',  label:'Desviación Componentes'},
    {id:'comp_comp2',       label:'Comparativo Componentes'},
    {id:'comp_notas',       label:'Notas Estudiantes por Componentes'},
    {id:'comp_mejora',      label:'Oportunidad de Mejoramiento (Componentes)'},
    {id:'listado_notas',       label:'Listado de Notas'},
    {id:'convertidor_notas',   label:'Convertidor de Notas'},
    {id:'detalle_prueba',      label:'Detalle de Prueba'},
    {id:'consolidado',      label:'Consolidado de Respuestas'},
    {id:'equilibrio',       label:'Equilibrio de la Prueba'},
  ]

  if (loading) return (
    <div style={{display:'flex', minHeight:'100vh', background:C.bg}}>
      {!mobile && <div style={{width:220, background:C.navy, minHeight:'100vh'}}/> }
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
      {/* NAV MÓVIL */}
      {mobile && (
        <>
          <div style={{
            position:'fixed', top:0, left:0, right:0, zIndex:200,
            background:C.navy, height:56,
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'0 16px', boxShadow:'0 2px 12px rgba(10,31,61,0.3)',
          }}>
            <div>
              <div style={{fontSize:13, fontFamily:'Playfair Display, serif', color:C.white, lineHeight:1.2}}>Milton Ochoa</div>
              <div style={{fontSize:9, color:'rgba(255,255,255,0.4)', fontFamily:'Inter',
                letterSpacing:'0.1em', textTransform:'uppercase'}}>Portal de Resultados</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:12}}>
              <span style={{fontSize:11, color:'rgba(255,255,255,0.6)', fontFamily:'Inter'}}>
                {tab}
              </span>
              <button onClick={() => setMenuOpen(o => !o)} style={{
                background:'none', border:'none', padding:8, cursor:'pointer',
                display:'flex', flexDirection:'column', gap:5,
              }}>
                {menuOpen
                  ? <span style={{color:C.white, fontSize:22, lineHeight:1}}>✕</span>
                  : <>
                      <span style={{display:'block', width:22, height:2, background:C.white, borderRadius:2}}/>
                      <span style={{display:'block', width:22, height:2, background:C.white, borderRadius:2}}/>
                      <span style={{display:'block', width:22, height:2, background:C.white, borderRadius:2}}/>
                    </>
                }
              </button>
            </div>
          </div>
          {menuOpen && (
            <div style={{
              position:'fixed', top:56, left:0, right:0, bottom:0, zIndex:199,
              background:C.navy, overflowY:'auto', display:'flex', flexDirection:'column',
            }}>
        <div style={{display:'flex', flexDirection:'column', flexShrink:0}}>
        <div style={{padding:'20px 20px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)', textAlign:'center'}}>
          <img src="data:image/png;base64,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"
            alt="Milton Ochoa" style={{height:36, maxWidth:'100%', objectFit:'contain'}}/>
          <div style={{fontSize:9, color:'rgba(255,255,255,0.35)', fontFamily:'Inter',
            letterSpacing:'0.12em', textTransform:'uppercase', marginTop:6}}>Portal de Resultados</div>
        </div>
        <div style={{flex:1, padding:'12px', overflowY:'auto'}}>

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
              filters: true,
              items: [
                {id:'tablero',       label:'Tablero de Gestión'},
                {
                  id:'grp_materias', label:'Análisis por Asignaturas', isGroup: true,
                  children: [
                    {id:'niveles',       label:'% Estudiantes por Nivel de Desempeño'},
                    {id:'desv_materias', label:'Desviación por Asignatura'},
                    {id:'desv_area',     label:'Desviación por Área'},
                  ]
                },
                {
                  id:'grp_comp', label:'Competencias', isGroup: true,
                  children: [
                    {id:'desviacion',       label:'Desviación Competencias'},
                    {id:'comp_comparativo', label:'Comparativo Competencias', soon:true},
                    {id:'competencias',     label:'Notas Estudiantes por Competencias'},
                    {id:'mejora',           label:'Oportunidad de Mejoramiento'},
                  ]
                },
                {
                  id:'grp_compon', label:'Componentes', isGroup: true,
                  children: [
                    {id:'comp_desviacion', label:'Desviación Componentes'},
                    {id:'comp_comp2',      label:'Comparativo Componentes',           soon:true},
                    {id:'comp_notas',      label:'Notas Estudiantes por Componentes'},
                    {id:'comp_mejora',     label:'Oportunidad de Mejoramiento'},
                  ]
                },
                {id:'listado_notas',      label:'Listado de Notas'},
                {id:'convertidor_notas',  label:'Convertidor de Notas'},
                {id:'notas_acumuladas',   label:'Notas Acumuladas'},
                {
                  id:'grp_detalle', label:'Detalle de Prueba', isGroup: true,
                  children: [
                    {id:'detalle_prueba', label:'Detalle de Prueba'},
                    {id:'consolidado',    label:'Consolidado de Respuestas'},
                    {id:'equilibrio',     label:'Equilibrio de la Prueba'},
                  ]
                },
              ],
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
                  {/* Filtros solo para Herramientas */}
                  {section.filters && (
                    <div style={{padding:'8px 4px 4px'}}>
                      <FilterSelect
                        label="Prueba"
                        value={selectedPrueba?.tipo || ''}
                        onChange={val => {
                          const p = pruebasDisponibles.find(p => p.tipo === val)
                          if (p) setSelectedPrueba(p)
                        }}
                        options={[...new Set(pruebasDisponibles.map(p => p.tipo))].map(t => ({
                          value: t, label: t.charAt(0).toUpperCase() + t.slice(1)
                        }))}
                      />
                      <FilterSelect
                        label="Referencia"
                        value={selectedPrueba?.codigo || ''}
                        onChange={val => {
                          const p = pruebasDisponibles.find(p => p.codigo === val)
                          if (p) setSelectedPrueba(p)
                        }}
                        options={pruebasDisponibles
                          .filter(p => p.tipo === selectedPrueba?.tipo)
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
                      <div style={{height:1, background:'rgba(255,255,255,0.08)', margin:'8px 0 12px'}}/>
                    </div>
                  )}
                  {section.items.map(item => item.isGroup ? (
                    <div key={item.id}>
                      <button onClick={() => setSubGroup(subGroup === item.id ? null : item.id)} style={{
                        width:'100%', textAlign:'left', padding:'6px 12px', borderRadius:6,
                        border:'none', cursor:'pointer', marginBottom:1, fontFamily:'Inter', fontSize:11,
                        background:'transparent', color:'rgba(255,255,255,0.65)',
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        transition:'all 0.2s',
                      }}>
                        <span style={{fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', fontSize:10}}>{item.label}</span>
                        <span style={{fontSize:9, opacity:0.5}}>{subGroup===item.id ? '▲' : '▼'}</span>
                      </button>
                      {subGroup === item.id && (
                        <div style={{paddingLeft:8}}>
                          {item.children.map(child => (
                            <button key={child.id} onClick={() => { if (!child.soon) { setTab(child.id); setMenuOpen(false) } }} style={{
                              width:'100%', textAlign:'left', padding:'6px 12px', borderRadius:6,
                              border:'none', cursor: child.soon ? 'default' : 'pointer', marginBottom:1,
                              fontFamily:'Inter', fontSize:11,
                              background: tab===child.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                              color: child.soon ? 'rgba(255,255,255,0.25)' : tab===child.id ? C.white : 'rgba(255,255,255,0.5)',
                              borderLeft: tab===child.id ? `3px solid ${C.green}` : '3px solid transparent',
                              transition:'all 0.2s',
                              display:'flex', alignItems:'center', justifyContent:'space-between',
                            }}>
                              <span>{child.label}</span>
                              {child.soon && <span style={{fontSize:8, color:'rgba(255,255,255,0.25)', fontStyle:'italic'}}>pronto</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button key={item.id} onClick={() => { setTab(item.id); setMenuOpen(false) }} style={{
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
          </div>
          )}
        </>
      )}

      {/* SIDEBAR tablet/desktop */}
      {!mobile && (
        <div style={{width: tablet ? 200 : 220, minHeight:'100vh', background:C.navy,
          display:'flex', flexDirection:'column', flexShrink:0}}>
        <div style={{display:'flex', flexDirection:'column', flexShrink:0}}>
        <div style={{padding:'20px 20px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)', textAlign:'center'}}>
          <img src="data:image/png;base64,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"
            alt="Milton Ochoa" style={{height:36, maxWidth:'100%', objectFit:'contain'}}/>
          <div style={{fontSize:9, color:'rgba(255,255,255,0.35)', fontFamily:'Inter',
            letterSpacing:'0.12em', textTransform:'uppercase', marginTop:6}}>Portal de Resultados</div>
        </div>
        <div style={{flex:1, padding:'12px', overflowY:'auto'}}>

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
              filters: true,
              items: [
                {id:'tablero',       label:'Tablero de Gestión'},
                {
                  id:'grp_materias', label:'Análisis por Asignaturas', isGroup: true,
                  children: [
                    {id:'niveles',       label:'% Estudiantes por Nivel de Desempeño'},
                    {id:'desv_materias', label:'Desviación por Asignatura'},
                    {id:'desv_area',     label:'Desviación por Área'},
                  ]
                },
                {
                  id:'grp_comp', label:'Competencias', isGroup: true,
                  children: [
                    {id:'desviacion',       label:'Desviación Competencias'},
                    {id:'comp_comparativo', label:'Comparativo Competencias', soon:true},
                    {id:'competencias',     label:'Notas Estudiantes por Competencias'},
                    {id:'mejora',           label:'Oportunidad de Mejoramiento'},
                  ]
                },
                {
                  id:'grp_compon', label:'Componentes', isGroup: true,
                  children: [
                    {id:'comp_desviacion', label:'Desviación Componentes'},
                    {id:'comp_comp2',      label:'Comparativo Componentes',           soon:true},
                    {id:'comp_notas',      label:'Notas Estudiantes por Componentes'},
                    {id:'comp_mejora',     label:'Oportunidad de Mejoramiento'},
                  ]
                },
                {id:'listado_notas',      label:'Listado de Notas'},
                {id:'convertidor_notas',  label:'Convertidor de Notas'},
                {id:'notas_acumuladas',   label:'Notas Acumuladas'},
                {
                  id:'grp_detalle', label:'Detalle de Prueba', isGroup: true,
                  children: [
                    {id:'detalle_prueba', label:'Detalle de Prueba'},
                    {id:'consolidado',    label:'Consolidado de Respuestas'},
                    {id:'equilibrio',     label:'Equilibrio de la Prueba'},
                  ]
                },
              ],
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
                  {/* Filtros solo para Herramientas */}
                  {section.filters && (
                    <div style={{padding:'8px 4px 4px'}}>
                      <FilterSelect
                        label="Prueba"
                        value={selectedPrueba?.tipo || ''}
                        onChange={val => {
                          const p = pruebasDisponibles.find(p => p.tipo === val)
                          if (p) setSelectedPrueba(p)
                        }}
                        options={[...new Set(pruebasDisponibles.map(p => p.tipo))].map(t => ({
                          value: t, label: t.charAt(0).toUpperCase() + t.slice(1)
                        }))}
                      />
                      <FilterSelect
                        label="Referencia"
                        value={selectedPrueba?.codigo || ''}
                        onChange={val => {
                          const p = pruebasDisponibles.find(p => p.codigo === val)
                          if (p) setSelectedPrueba(p)
                        }}
                        options={pruebasDisponibles
                          .filter(p => p.tipo === selectedPrueba?.tipo)
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
                      <div style={{height:1, background:'rgba(255,255,255,0.08)', margin:'8px 0 12px'}}/>
                    </div>
                  )}
                  {section.items.map(item => item.isGroup ? (
                    <div key={item.id}>
                      <button onClick={() => setSubGroup(subGroup === item.id ? null : item.id)} style={{
                        width:'100%', textAlign:'left', padding:'6px 12px', borderRadius:6,
                        border:'none', cursor:'pointer', marginBottom:1, fontFamily:'Inter', fontSize:11,
                        background:'transparent', color:'rgba(255,255,255,0.65)',
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        transition:'all 0.2s',
                      }}>
                        <span style={{fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', fontSize:10}}>{item.label}</span>
                        <span style={{fontSize:9, opacity:0.5}}>{subGroup===item.id ? '▲' : '▼'}</span>
                      </button>
                      {subGroup === item.id && (
                        <div style={{paddingLeft:8}}>
                          {item.children.map(child => (
                            <button key={child.id} onClick={() => { if (!child.soon) { setTab(child.id); setMenuOpen(false) } }} style={{
                              width:'100%', textAlign:'left', padding:'6px 12px', borderRadius:6,
                              border:'none', cursor: child.soon ? 'default' : 'pointer', marginBottom:1,
                              fontFamily:'Inter', fontSize:11,
                              background: tab===child.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                              color: child.soon ? 'rgba(255,255,255,0.25)' : tab===child.id ? C.white : 'rgba(255,255,255,0.5)',
                              borderLeft: tab===child.id ? `3px solid ${C.green}` : '3px solid transparent',
                              transition:'all 0.2s',
                              display:'flex', alignItems:'center', justifyContent:'space-between',
                            }}>
                              <span>{child.label}</span>
                              {child.soon && <span style={{fontSize:8, color:'rgba(255,255,255,0.25)', fontStyle:'italic'}}>pronto</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button key={item.id} onClick={() => { setTab(item.id); setMenuOpen(false) }} style={{
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
      </div>
      )}

      {/* MAIN */}
      <main style={{flex:1, padding: mobile ? '72px 16px 24px' : tablet ? '24px 20px' : '36px 40px', overflowY:'auto', minWidth: 0}}>
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
          {['tablero','niveles','desv_materias','desv_area','desviacion','comp_comparativo','competencias','mejora','comp_desviacion','comp_comp2','comp_notas','comp_mejora','listado_notas','convertidor_notas','detalle_prueba','consolidado','equilibrio'].includes(tab) && (
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12}}>
              <div>
                <h1 style={{fontSize:26, fontFamily:'Playfair Display, serif', color:C.navy, marginBottom:4}}>
                  {session?.nombre}
                </h1>
                <div style={{fontSize:13, color:C.gray, fontFamily:'Inter'}}>
                  {session?.ciudad} · {students.length} estudiantes evaluados
                </div>
              </div>
            </div>
          )}
        </div>

        {/* KPIs — solo en Tablero de Gestión */}
        {tab === 'tablero' && (
        <div style={{display:'grid', gridTemplateColumns: mobile || tablet ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:12, marginBottom:28}}>
          <KpiCard label="Prom. Global" value={promGlobal ?? '—'} sub={`Prueba ${prueba?.codigo ?? '—'}`} color={C.navy}/>
          <KpiCard label="Estudiantes" value={students.length || '—'} sub="Evaluados" color={C.navy}/>
          <KpiCard label="Mejor puntaje"
            value={maxStudent ? (maxStudent.puntaje_irt?.global ?? maxStudent.puntaje_global ?? '—') : '—'}
            sub={maxStudent?.estudiantes?.nombre?.split(' ').slice(0,2).join(' ') || 'Sin datos'} color={C.green}/>
          <KpiCard label="Oport. mejora" value={oportunidades.length || '—'} sub="Preguntas críticas" color={C.red}/>
        </div>
        )}

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
                              {[
                                {val:row.matematicas,        area:'mat'},
                                {val:row.ciencias_naturales, area:'cn'},
                                {val:row.sociales_ciudadanas,area:'soc'},
                                {val:row.lectura_critica,    area:'lc'},
                                {val:row.ingles,             area:'ing'},
                                {val:row.definitiva,         area:'_'},
                              ].map(({val,area},j) => (
                                <td key={j} style={{padding:'8px', textAlign:'center'}}>
                                  <div style={{background:semaforoBg(val,area), color:semaforoColor(val,area),
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
                          {[
                            {val:row.mat_genericos,   area:'mat'},
                            {val:row.mat_nogenericos, area:'mat'},
                            {val:row.cn_quimica,      area:'cn'},
                            {val:row.cn_fisica,       area:'cn'},
                            {val:row.cn_biologia,     area:'cn'},
                            {val:row.cn_cts,          area:'cn'},
                            {val:row.soc_sociales,    area:'soc'},
                            {val:row.soc_ciudadanas,  area:'soc'},
                            {val:row.lectura_critica, area:'lc'},
                            {val:row.ingles,          area:'ing'},
                            {val:row.definitiva,      area:'_'},
                          ].map(({val,area},j) => (
                            <td key={j} style={{padding:'6px', textAlign:'center'}}>
                              <div style={{background:semaforoBg(val,area), color:semaforoColor(val,area),
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
                <LeyendaNivelesPorArea/>
              </Card>
            )}
          </div>
        )}

        {/* ══ ÁREAS ════════════════════════════════════════════ */}
        {tab==='areas' && (
          students.length === 0 ? <EmptyState/> :
          <div style={{display:'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap:16}}>
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
              <CardTitle sub="% de estudiantes por nivel de desempeño y asignatura">
                % Estudiantes por Nivel de Desempeño
              </CardTitle>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={nivelesAsig} margin={{top:10, right:0, bottom:20, left:-20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2}/>
                  <XAxis dataKey="asig" tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}}
                    angle={-30} textAnchor="end" interval={0}/>
                  <YAxis tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}} domain={[0,100]}/>
                  <Tooltip contentStyle={{fontFamily:'Inter', fontSize:12, borderRadius:8}}/>
                  <Bar dataKey="n1" name="Nivel 1" stackId="a" fill={C.red}/>
                  <Bar dataKey="n2" name="Nivel 2" stackId="a" fill="#F97316"/>
                  <Bar dataKey="n3" name="Nivel 3" stackId="a" fill="#F59E0B"/>
                  <Bar dataKey="n4" name="Nivel 4" stackId="a" fill={C.green}/>
                </BarChart>
              </ResponsiveContainer>
              <LeyendaNiveles/>
            </Card>
            <Card>
              <CardTitle sub="Tabla detallada por asignatura">Detalle por Asignatura</CardTitle>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                  <thead>
                    <tr style={{borderBottom:`2px solid ${C.bg2}`}}>
                      <th style={{textAlign:'left', padding:'8px 12px', fontSize:10,
                        color:C.navy, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em'}}>
                        Asignatura
                      </th>
                      {[
                        {label:'Nivel 1', color:C.red},
                        {label:'Nivel 2', color:'#F97316'},
                        {label:'Nivel 3', color:'#F59E0B'},
                        {label:'Nivel 4', color:C.green},
                      ].map(({label, color}) => (
                        <th key={label} colSpan={2} style={{textAlign:'center', padding:'8px 4px',
                          fontSize:10, color, fontWeight:600, textTransform:'uppercase',
                          letterSpacing:'0.05em', borderBottom:`2px solid ${color}`}}>
                          {label}
                        </th>
                      ))}
                    </tr>
                    <tr style={{borderBottom:`1px solid ${C.bg2}`}}>
                      <th/>
                      {[C.red,'#F97316','#F59E0B',C.green].flatMap(color => [
                        <th key={`${color}-pct`} style={{textAlign:'center', padding:'4px 8px',
                          fontSize:9, color, fontWeight:600}}>%</th>,
                        <th key={`${color}-cnt`} style={{textAlign:'center', padding:'4px 8px',
                          fontSize:9, color:C.gray, fontWeight:600}}>Cant.</th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {nivelesAsig.map((m,i) => (
                      <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`,
                        background:i%2===0?`${C.bg}80`:'transparent'}}>
                        <td style={{padding:'10px 12px', fontSize:13, color:C.text, fontWeight:500,
                          whiteSpace:'nowrap'}}>{m.asig}</td>
                        {[
                          {pct:m.n1, cnt:m.n1c, color:C.red},
                          {pct:m.n2, cnt:m.n2c, color:'#F97316'},
                          {pct:m.n3, cnt:m.n3c, color:'#F59E0B'},
                          {pct:m.n4, cnt:m.n4c, color:C.green},
                        ].map(({pct, cnt, color}, j) => [
                          <td key={`p${j}`} style={{padding:'8px 8px', textAlign:'center'}}>
                            <Badge color={color}>{pct}%</Badge>
                          </td>,
                          <td key={`c${j}`} style={{padding:'8px 8px', textAlign:'center',
                            fontSize:12, color:C.gray}}>{cnt}</td>,
                        ])}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ══ DESVIACIÓN ═══════════════════════════════════════ */}
        {tab==='desviacion' && (() => {
          const regionNombre = REGION_NOMBRES[session?.departamento_nombre?.toUpperCase()] || 'Región'
          const dptoNombre   = toTitleCase(session?.departamento_nombre) || 'Dpto.'
          const ciudadNombre = toTitleCase(session?.municipio) || 'Ciudad'

          const asignaturas = ['Todas', ...new Set(compGestion.map(r => r.materia)).values()]
          const filas = compAsigFilter === 'Todas'
            ? compGestion
            : compGestion.filter(r => r.materia === compAsigFilter)

          const fmtVal = v => v != null ? Math.round(v) : '—'
          const fmtDesv = v => v != null ? Math.round(v) : '—'

          const ColHeader = ({label, sub}) => (
            <th colSpan={2} style={{padding:'8px 10px', textAlign:'center', background:'#1E3A5F',
              color:'white', fontSize:11, fontWeight:700, borderRight:'2px solid rgba(255,255,255,0.15)',
              borderBottom:'1px solid rgba(255,255,255,0.2)', whiteSpace:'nowrap'}}>
              {label}{sub && <div style={{fontSize:9, fontWeight:400, opacity:0.7, marginTop:1}}>{sub}</div>}
            </th>
          )

          return students.length === 0 ? <EmptyState/> : (
            <div style={{display:'grid', gap:16}}>
              <Card>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start',
                  flexWrap:'wrap', gap:12, marginBottom:20}}>
                  <CardTitle sub="Promedio y desviación por competencia vs referentes geográficos">
                    Desviación por Competencias
                  </CardTitle>
                  <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>Asignatura:</span>
                      <select value={compAsigFilter} onChange={e=>setCompAsigFilter(e.target.value)}
                        style={{padding:'6px 10px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                          fontFamily:'Inter', fontSize:12, color:C.text, background:C.white,
                          outline:'none', cursor:'pointer'}}>
                        {asignaturas.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    {compAsigFilter !== 'Todas' && (
                      <div style={{display:'flex', gap:0, borderRadius:6, overflow:'hidden', border:'1px solid #E5E7EB'}}>
                        {['bars','radar'].map(v => (
                          <button key={v} onClick={() => setDesviacionView(v)}
                            style={{padding:'5px 12px', fontSize:11, fontFamily:'Inter', cursor:'pointer', border:'none',
                              background: desviacionView===v ? '#1E3A5F' : 'white',
                              color: desviacionView===v ? 'white' : '#6B7280', fontWeight: desviacionView===v ? 700 : 400}}>
                            {v==='bars' ? 'Barras' : 'Radar'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {filas.length > 0 && compAsigFilter === 'Todas' && (
                  <div style={{display:'flex', alignItems:'center', justifyContent:'center',
                    height:120, background:C.bg2, borderRadius:10, marginBottom:24,
                    color:C.gray, fontFamily:'Inter', fontSize:13, gap:8}}>
                    <span style={{fontSize:20}}>📊</span>
                    Selecciona una asignatura para ver la gráfica de competencias
                  </div>
                )}

                {filas.length > 0 && compAsigFilter !== 'Todas' && (() => {
                  // Barras flotantes: cada barra va de (prom - desv) a (prom + desv)
                  // Las etiquetas muestran el valor mínimo (abajo) y máximo (arriba) de la barra
                  const SCOPES = [
                    {sfx:'nac',  color:'#2563EB', label:'Nacional',     promKey:'nac_prom',    desvKey:'nac_desv'},
                    {sfx:'reg',  color:'#059669', label:regionNombre,   promKey:'reg_prom',    desvKey:'reg_desv'},
                    {sfx:'dpto', color:'#7C3AED', label:dptoNombre,    promKey:'dpto_prom',   desvKey:'dpto_desv'},
                    {sfx:'ciu',  color:'#06B6D4', label:ciudadNombre,  promKey:'ciudad_prom', desvKey:'ciudad_desv'},
                    {sfx:'pln',  color:'#1E3A5F', label:'Plantel',      promKey:'plantel_prom',desvKey:'plantel_desv'},
                  ]
                  const clamp = v => Math.max(0, Math.min(100, Math.round(v)))
                  const chartData = filas.map(r => {
                    const entry = { name: r.competencia }
                    SCOPES.forEach(({sfx, promKey, desvKey}) => {
                      const prom = r[promKey]
                      const desv = r[desvKey]
                      if (prom == null) {
                        entry[`${sfx}_base`] = 0; entry[`${sfx}_rng`] = 0
                        entry[`${sfx}_lo`] = null; entry[`${sfx}_hi`] = null
                      } else if (desv == null) {
                        // Sin desviación: barra sólida desde 0 hasta el promedio
                        entry[`${sfx}_base`] = 0; entry[`${sfx}_rng`] = clamp(prom)
                        entry[`${sfx}_lo`] = null; entry[`${sfx}_hi`] = clamp(prom)
                      } else {
                        // Con desviación: barra flotante entre prom-desv y prom+desv
                        const lo = clamp(prom - desv), hi = clamp(prom + desv)
                        entry[`${sfx}_base`] = lo; entry[`${sfx}_rng`] = hi - lo
                        entry[`${sfx}_lo`] = lo; entry[`${sfx}_hi`] = hi
                      }
                    })
                    return entry
                  })
                  const minW = Math.max(560, filas.length * 170)
                  // Tooltip personalizado que muestra prom, desv, rango
                  const TooltipComp = ({active, payload, label}) => {
                    if (!active || !payload?.length) return null
                    const row = filas.find(f => f.competencia === label) || {}
                    return (
                      <div style={{background:'white', border:`1px solid ${C.grayLt}`, borderRadius:8,
                        padding:'10px 14px', fontFamily:'Inter', fontSize:11, boxShadow:'0 4px 12px rgba(0,0,0,0.12)'}}>
                        <div style={{fontWeight:700, marginBottom:6, fontSize:12}}>{label}</div>
                        {SCOPES.map(({sfx, color, label:lbl}) => {
                          const prom = row[`${sfx === 'nac' ? 'nac' : sfx === 'dpto' ? 'dpto' : sfx === 'ciu' ? 'ciudad' : 'plantel'}_prom`]
                          const desv = row[`${sfx === 'nac' ? 'nac' : sfx === 'dpto' ? 'dpto' : sfx === 'ciu' ? 'ciudad' : 'plantel'}_desv`]
                          if (prom == null) return null
                          return (
                            <div key={sfx} style={{display:'flex', alignItems:'center', gap:6, marginBottom:3}}>
                              <div style={{width:10, height:10, borderRadius:2, background:color, flexShrink:0}}/>
                              <span style={{color:C.dark, fontWeight:600}}>{lbl}:</span>
                              <span>Prom {Math.round(prom)}</span>
                              {desv != null && <span style={{color:C.gray}}>± {Math.round(desv)} (Rango {clamp(prom-desv)}–{clamp(prom+desv)})</span>}
                            </div>
                          )
                        })}
                        <div style={{marginTop:8, color:C.gray, fontSize:10, borderTop:`1px solid ${C.bg2}`, paddingTop:6}}>
                          Barra: promedio ± desviación estándar
                        </div>
                      </div>
                    )
                  }
                  // Tick horizontal en 2 líneas para nombres largos de competencias
                  const XTick = ({x, y, payload}) => {
                    const words = (payload.value || '').split(' ')
                    const mid = Math.ceil(words.length / 2)
                    const l1 = words.slice(0, mid).join(' ')
                    const l2 = words.slice(mid).join(' ')
                    return (
                      <g transform={`translate(${x},${y+4})`}>
                        <text textAnchor="middle" fontFamily="Inter" fontSize={11} fill={C.gray}>
                          <tspan x={0} dy={10}>{l1}</tspan>
                          {l2 && <tspan x={0} dy={14}>{l2}</tspan>}
                        </text>
                      </g>
                    )
                  }
                  const radarData = filas.map(r => {
                    const entry = { name: r.competencia }
                    SCOPES.forEach(({sfx, promKey}) => { entry[sfx] = r[promKey] != null ? Math.round(r[promKey]) : 0 })
                    return entry
                  })
                  return desviacionView === 'radar' ? (
                    <div style={{marginBottom:28}}>
                      <ResponsiveContainer width="100%" height={400}>
                        <RadarChart data={radarData} margin={{top:16, right:40, bottom:16, left:40}}>
                          <PolarGrid stroke={C.bg2}/>
                          <PolarAngleAxis dataKey="name" tick={{fontSize:11, fontFamily:'Inter', fill:C.gray}}/>
                          {SCOPES.map(({sfx, color, label:lbl}) => (
                            <Radar key={sfx} name={lbl} dataKey={sfx} stroke={color} fill={color} fillOpacity={0.1} dot={false}/>
                          ))}
                          <Legend wrapperStyle={{fontFamily:'Inter', fontSize:12}}
                            formatter={(val) => { const s = SCOPES.find(x => x.label === val); return <span style={{color: s ? s.color : C.dark}}>{val}</span> }}/>
                          <Tooltip contentStyle={{fontFamily:'Inter', fontSize:11, borderRadius:8}}/>
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div style={{marginBottom:28, overflowX:'auto'}}>
                      <div style={{minWidth:minW}}>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={chartData} barCategoryGap="30%" barGap={2}
                            margin={{top:24, right:16, bottom:20, left:4}}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} vertical={false}/>
                            <XAxis dataKey="name" tick={<XTick/>} interval={0} height={52}/>
                            <YAxis tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}}
                              domain={[0,100]} tickFormatter={v=>`${v}`} width={28}/>
                            <Tooltip content={<TooltipComp/>}/>
                            <Legend
                              wrapperStyle={{fontFamily:'Inter', fontSize:12, paddingTop:6}}
                              formatter={(val, entry) => {
                                const s = SCOPES.find(x => x.label === val)
                                return <span style={{color: s ? s.color : C.dark}}>{val}</span>
                              }}/>
                            {SCOPES.map(({sfx, color, label:lbl}) => [
                              // Barra base transparente (eleva la barra visible al nivel prom-desv)
                              <Bar key={`${sfx}_base`} dataKey={`${sfx}_base`} stackId={sfx}
                                fill="transparent" legendType="none" isAnimationActive={false}/>,
                              // Barra visible coloreada (altura = 2×desv o = prom cuando no hay desv)
                              <Bar key={`${sfx}_rng`} dataKey={`${sfx}_rng`} stackId={sfx}
                                fill={color} radius={[3,3,0,0]} name={lbl} maxBarSize={36} isAnimationActive={false}>
                                <LabelList dataKey={`${sfx}_hi`} position="insideTop"
                                  style={{fontSize:9, fontFamily:'Inter', fill:'white', fontWeight:700}}
                                  formatter={v => v != null ? v : ''}/>
                                <LabelList dataKey={`${sfx}_lo`} position="insideBottom"
                                  style={{fontSize:9, fontFamily:'Inter', fill:'white', fontWeight:700}}
                                  formatter={v => v != null ? v : ''}/>
                              </Bar>
                            ])}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p style={{fontFamily:'Inter', fontSize:10, color:C.gray, textAlign:'center', marginTop:4}}>
                        Cada barra muestra el rango promedio ± desviación estándar del grupo. Las etiquetas indican el valor mínimo y máximo del rango.
                      </p>
                    </div>
                  )
                })()}

                {filas.length === 0 ? (
                  <div style={{textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter', fontSize:13}}>
                    Sin datos de competencias para esta asignatura.
                  </div>
                ) : (
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter', fontSize:12}}>
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{padding:'10px 14px', background:C.navy, color:'white',
                            fontSize:11, fontWeight:700, textAlign:'left', minWidth:140,
                            borderRight:'2px solid rgba(255,255,255,0.2)', verticalAlign:'middle'}}>
                            Materia
                          </th>
                          <th rowSpan={2} style={{padding:'10px 14px', background:C.navy, color:'white',
                            fontSize:11, fontWeight:700, textAlign:'left', minWidth:200,
                            borderRight:'2px solid rgba(255,255,255,0.2)', verticalAlign:'middle'}}>
                            Competencia
                          </th>
                          <ColHeader label="Colombia"/>
                          <ColHeader label={regionNombre}/>
                          <ColHeader label={dptoNombre}/>
                          <ColHeader label={ciudadNombre}/>
                          <ColHeader label="Plantel" sub="(este colegio)"/>
                        </tr>
                        <tr>
                          {['Colombia','Región','Dpto.','Ciudad','Plantel'].map(scope => (
                            ['Prom','Desv'].map(metric => (
                              <th key={`${scope}-${metric}`}
                                style={{padding:'6px 8px', textAlign:'center',
                                  background: metric==='Prom' ? '#F0F4FF' : '#F8FAFC',
                                  color: metric==='Prom' ? C.navy : C.gray,
                                  fontSize:10, fontWeight:700,
                                  borderRight:'1px solid #E5E7EB',
                                  borderBottom:'2px solid #D1D5DB',
                                  minWidth:52}}>
                                {metric}
                              </th>
                            ))
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((r, i) => {
                          const plantelProm = r.plantel_prom != null ? Math.round(r.plantel_prom) : null
                          return (
                            <tr key={i} style={{background: i%2===0 ? C.white : '#F8FAFC',
                              borderBottom:'1px solid #F1F5F9'}}>
                              <td style={{padding:'10px 14px', fontWeight:600, color:C.navy,
                                borderRight:'2px solid #E5E7EB', fontSize:12}}>
                                {r.materia}
                              </td>
                              <td style={{padding:'10px 14px', color:C.text,
                                borderRight:'2px solid #E5E7EB', fontSize:12}}>
                                {r.competencia}
                              </td>
                              {[
                                [r.nac_prom,    r.nac_desv],
                                [r.reg_prom,    r.reg_desv],
                                [r.dpto_prom,   r.dpto_desv],
                                [r.ciudad_prom, r.ciudad_desv],
                                [r.plantel_prom, r.plantel_desv],
                              ].map(([prom, desv], j) => {
                                const promVal = prom != null ? Math.round(prom) : null
                                const isLast = j === 4
                                return [
                                  <td key={`p${j}`} style={{
                                    padding:'10px 8px', textAlign:'center',
                                    borderRight:'1px solid #F1F5F9',
                                    background: isLast && plantelProm != null
                                      ? `${semaforoBg(plantelProm,'_')}` : 'transparent',
                                  }}>
                                    {promVal != null ? (
                                      <span style={{
                                        fontWeight:700, fontSize:14,
                                        fontFamily:'Playfair Display, serif',
                                        color: isLast ? semaforoColor(promVal,'_') : C.navy,
                                      }}>{promVal}</span>
                                    ) : <span style={{color:'#CBD5E1',fontSize:12}}>—</span>}
                                  </td>,
                                  <td key={`d${j}`} style={{
                                    padding:'10px 8px', textAlign:'center',
                                    borderRight: j<4 ? '2px solid #E2E8F0' : 'none',
                                    color:C.gray, fontSize:12,
                                  }}>
                                    {desv != null ? Math.round(desv) : <span style={{color:'#CBD5E1'}}>—</span>}
                                  </td>,
                                ]
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{marginTop:16, padding:'10px 14px', background:C.bg, borderRadius:8,
                  fontSize:11, color:C.gray, fontFamily:'Inter', lineHeight:1.6}}>
                  <strong style={{color:C.navy}}>Nota:</strong> Los promedios de Colombia, {regionNombre}, {dptoNombre} y {ciudadNombre}
                  se calculan como el promedio de los colegios registrados con esta misma prueba.
                  Los valores se actualizan a medida que más colegios carguen resultados.
                </div>
              </Card>
            </div>
          )
        })()}

        {/* ══ DESVIACIÓN POR ASIGNATURA ════════════════════════ */}
        {tab==='desv_materias' && (
          students.length === 0 ? <EmptyState/> :
          <div style={{display:'grid', gap:16}}>
            <Card>
              <CardTitle sub="Distribución de puntajes por asignatura">
                Desviación por Asignatura
              </CardTitle>
              {/* Box plot SVG interactivo */}
              <div style={{width:'100%', overflowX:'auto', position:'relative'}}
                onMouseLeave={()=>setBoxHover(null)}>
                <svg viewBox="0 0 1020 300" style={{width:'100%', minWidth:640, display:'block'}}>
                  {/* Grid lines */}
                  {[0,25,50,75,100].map(v => {
                    const y = 30 + 210 * (1 - v/110)
                    return <g key={v}>
                      <line x1={50} x2={1010} y1={y} y2={y} stroke="#f0f0f0" strokeWidth={1}/>
                      <text x={44} y={y+4} textAnchor="end" fontSize={9} fill="#94a3b8">{v}</text>
                    </g>
                  })}
                  {/* Boxes */}
                  {desvAsigData.map((d, i) => {
                    const cols  = desvAsigData.length
                    const slotW = 960 / cols
                    const cx    = 50 + slotW * i + slotW / 2
                    const bw    = slotW * 0.55
                    const toY   = v => 30 + 210 * (1 - v / 110)
                    const yMin  = toY(d.min), yQ1 = toY(d.q1), yMed = toY(d.median)
                    const yQ3   = toY(d.q3),  yMax = toY(d.max)
                    const col   = semaforoColor(d.mean, d.akey)
                    const hot   = boxHover?.i === i
                    const strokeC = hot ? C.navy : '#64748b'
                    const boxFill = hot ? `${semaforoBg(d.mean, d.akey)}` : 'white'
                    return (
                      <g key={i} style={{cursor:'pointer'}}
                        onMouseEnter={e => setBoxHover({d, i, x:e.clientX, y:e.clientY})}
                        onMouseMove={e  => setBoxHover(h => h ? {...h, x:e.clientX, y:e.clientY} : h)}>
                        {/* Hover hit area */}
                        <rect x={cx-slotW/2} y={10} width={slotW} height={250} fill="transparent"/>
                        {/* Whisker */}
                        <line x1={cx} y1={yMin} x2={cx} y2={yMax} stroke={strokeC} strokeWidth={hot?2:1.5}/>
                        {/* Min cap */}
                        <line x1={cx-bw/4} y1={yMin} x2={cx+bw/4} y2={yMin} stroke={strokeC} strokeWidth={hot?2:1.5}/>
                        {/* Max cap */}
                        <line x1={cx-bw/4} y1={yMax} x2={cx+bw/4} y2={yMax} stroke={strokeC} strokeWidth={hot?2:1.5}/>
                        {/* Max label */}
                        <rect x={cx-13} y={yMax-17} width={26} height={14} rx={3}
                          fill={hot ? C.navy : 'white'} stroke={hot ? C.navy : '#e2e8f0'} strokeWidth={1}/>
                        <text x={cx} y={yMax-6} textAnchor="middle" fontSize={8}
                          fill={hot ? 'white' : '#334155'} fontWeight="600">{Math.round(d.max)}</text>
                        {/* Box Q1–Q3 */}
                        <rect x={cx-bw/2} y={yQ3} width={bw} height={Math.max(yQ1-yQ3,2)}
                          fill={boxFill} stroke={strokeC} strokeWidth={hot?2:1.5} rx={3}/>
                        {/* Median */}
                        <line x1={cx-bw/2} y1={yMed} x2={cx+bw/2} y2={yMed}
                          stroke={col} strokeWidth={hot?3.5:2.5}/>
                        {/* Mean dot */}
                        <circle cx={cx} cy={toY(d.mean)} r={hot?4.5:3} fill={col}
                          stroke="white" strokeWidth={1}/>
                        {/* X label */}
                        <text x={cx} y={258} textAnchor="end" fontSize={9}
                          fill={hot ? C.navy : '#64748b'} fontWeight={hot?600:400}
                          transform={`rotate(-35,${cx},258)`}>{d.asig}</text>
                      </g>
                    )
                  })}
                </svg>

                {/* Tooltip flotante */}
                {boxHover && (
                  <div style={{
                    position:'fixed', top: boxHover.y - 10,
                    left: boxHover.x > window.innerWidth - 220 ? boxHover.x - 188 : boxHover.x + 18,
                    background:C.white, border:`1px solid ${C.grayLt}`,
                    borderRadius:10, padding:'12px 16px', fontFamily:'Inter', fontSize:12,
                    boxShadow:'0 8px 24px rgba(10,31,61,0.15)', zIndex:9999,
                    pointerEvents:'none', minWidth:170,
                  }}>
                    <div style={{fontWeight:700, color:C.navy, marginBottom:8, fontSize:13}}>
                      {boxHover.d.asig}
                    </div>
                    {[
                      {label:'Máximo',    val: boxHover.d.max,    color:C.gray},
                      {label:'Q3 (75%)',  val: boxHover.d.q3,     color:C.gray},
                      {label:'Mediana',   val: boxHover.d.median, color: semaforoColor(boxHover.d.median, boxHover.d.akey), bold:true},
                      {label:'Promedio',  val: boxHover.d.mean,   color: semaforoColor(boxHover.d.mean,   boxHover.d.akey), bold:true},
                      {label:'Q1 (25%)',  val: boxHover.d.q1,     color:C.gray},
                      {label:'Mínimo',    val: boxHover.d.min,    color:C.gray},
                    ].map(({label, val, color, bold}) => (
                      <div key={label} style={{display:'flex', justifyContent:'space-between',
                        gap:16, marginBottom:4, color}}>
                        <span style={{color:C.gray}}>{label}</span>
                        <span style={{fontWeight: bold?700:500}}>{Math.round(val)}</span>
                      </div>
                    ))}
                    <div style={{borderTop:`1px solid ${C.bg2}`, marginTop:6, paddingTop:6,
                      display:'flex', justifyContent:'space-between', color:C.gray}}>
                      <span>Desviación</span>
                      <span style={{fontWeight:500}}>{Math.round(boxHover.d.std)}</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', color:C.gray, marginTop:4}}>
                      <span>Estudiantes</span>
                      <span style={{fontWeight:500}}>{boxHover.d.n}</span>
                    </div>
                  </div>
                )}
              </div>
              {/* Leyenda */}
              <div style={{display:'flex', gap:16, marginTop:8, flexWrap:'wrap', fontSize:10,
                fontFamily:'Inter', color:C.gray}}>
                <span style={{display:'flex', alignItems:'center', gap:4}}>
                  <span style={{display:'inline-block', width:20, height:2, background:'#64748b'}}/>
                  Min – Máx
                </span>
                <span style={{display:'flex', alignItems:'center', gap:4}}>
                  <span style={{display:'inline-block', width:16, height:10, border:'1.5px solid #64748b', borderRadius:2}}/>
                  Q1 – Q3
                </span>
                <span style={{display:'flex', alignItems:'center', gap:4}}>
                  <span style={{display:'inline-block', width:16, height:2.5, background:C.green}}/>
                  Mediana
                </span>
                <span style={{display:'flex', alignItems:'center', gap:4}}>
                  <span style={{display:'inline-block', width:6, height:6, borderRadius:'50%', background:C.green}}/>
                  Promedio
                </span>
              </div>
            </Card>
            <Card>
              <CardTitle sub="Estadísticas por asignatura">Tabla de Estadísticas</CardTitle>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                  <thead>
                    <tr style={{borderBottom:`2px solid ${C.bg2}`}}>
                      {['Asignatura','Promedio','Desviación','Mín.','Máx.'].map((h,i) => (
                        <th key={h} style={{textAlign: i===0?'left':'center', padding:'8px 12px',
                          fontSize:10, color:C.gray, fontWeight:600, textTransform:'uppercase',
                          letterSpacing:'0.05em'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {desvAsigData.map((d,i) => (
                      <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`,
                        background: i%2===0 ? `${C.bg}80` : 'transparent'}}>
                        <td style={{padding:'10px 12px', fontSize:13, color:C.text,
                          fontWeight: d.asig==='Definitiva' ? 700 : 500}}>{d.asig}</td>
                        <td style={{padding:'10px 12px', textAlign:'center'}}>
                          <Badge color={semaforoColor(d.mean, d.akey)}>
                            {Math.round(d.mean)}
                          </Badge>
                        </td>
                        <td style={{padding:'10px 12px', textAlign:'center', fontSize:13, color:C.gray}}>
                          {Math.round(d.std)}
                        </td>
                        <td style={{padding:'10px 12px', textAlign:'center', fontSize:13, color:C.gray}}>
                          {Math.round(d.min)}
                        </td>
                        <td style={{padding:'10px 12px', textAlign:'center', fontSize:13, color:C.gray}}>
                          {Math.round(d.max)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ══ DESVIACIÓN POR ÁREA ══════════════════════════════ */}
        {tab==='desv_area' && (
          students.length === 0 ? <EmptyState/> :
          <div style={{display:'grid', gap:16}}>
            <Card>
              <CardTitle sub="Distribución de puntajes por área">
                Desviación por Área
              </CardTitle>
              <div style={{width:'100%', overflowX:'auto', position:'relative'}}
                onMouseLeave={()=>setBoxHover(null)}>
                <svg viewBox="0 0 720 300" style={{width:'100%', minWidth:480, display:'block'}}>
                  {[0,25,50,75,100].map(v => {
                    const y = 30 + 210 * (1 - v/110)
                    return <g key={v}>
                      <line x1={50} x2={710} y1={y} y2={y} stroke="#f0f0f0" strokeWidth={1}/>
                      <text x={44} y={y+4} textAnchor="end" fontSize={9} fill="#94a3b8">{v}</text>
                    </g>
                  })}
                  {desvAreaData.map((d, i) => {
                    const cols  = desvAreaData.length
                    const slotW = 660 / cols
                    const cx    = 50 + slotW * i + slotW / 2
                    const bw    = slotW * 0.55
                    const toY   = v => 30 + 210 * (1 - v / 110)
                    const yMin  = toY(d.min), yQ1 = toY(d.q1), yMed = toY(d.median)
                    const yQ3   = toY(d.q3),  yMax = toY(d.max)
                    const col   = semaforoColor(d.mean, d.akey)
                    const hot   = boxHover?.i === i && boxHover?.ctx === 'area'
                    const strokeC = hot ? C.navy : '#64748b'
                    const boxFill = hot ? semaforoBg(d.mean, d.akey) : 'white'
                    return (
                      <g key={i} style={{cursor:'pointer'}}
                        onMouseEnter={e => setBoxHover({d, i, ctx:'area', x:e.clientX, y:e.clientY})}
                        onMouseMove={e  => setBoxHover(h => h ? {...h, x:e.clientX, y:e.clientY} : h)}>
                        <rect x={cx-slotW/2} y={10} width={slotW} height={250} fill="transparent"/>
                        <line x1={cx} y1={yMin} x2={cx} y2={yMax} stroke={strokeC} strokeWidth={hot?2:1.5}/>
                        <line x1={cx-bw/4} y1={yMin} x2={cx+bw/4} y2={yMin} stroke={strokeC} strokeWidth={hot?2:1.5}/>
                        <line x1={cx-bw/4} y1={yMax} x2={cx+bw/4} y2={yMax} stroke={strokeC} strokeWidth={hot?2:1.5}/>
                        <rect x={cx-13} y={yMax-17} width={26} height={14} rx={3}
                          fill={hot ? C.navy : 'white'} stroke={hot ? C.navy : '#e2e8f0'} strokeWidth={1}/>
                        <text x={cx} y={yMax-6} textAnchor="middle" fontSize={8}
                          fill={hot ? 'white' : '#334155'} fontWeight="600">{Math.round(d.max)}</text>
                        <rect x={cx-bw/2} y={yQ3} width={bw} height={Math.max(yQ1-yQ3,2)}
                          fill={boxFill} stroke={strokeC} strokeWidth={hot?2:1.5} rx={3}/>
                        <line x1={cx-bw/2} y1={yMed} x2={cx+bw/2} y2={yMed}
                          stroke={col} strokeWidth={hot?3.5:2.5}/>
                        <circle cx={cx} cy={toY(d.mean)} r={hot?4.5:3} fill={col} stroke="white" strokeWidth={1}/>
                        <text x={cx} y={258} textAnchor="end" fontSize={9}
                          fill={hot ? C.navy : '#64748b'} fontWeight={hot?600:400}
                          transform={`rotate(-35,${cx},258)`}>{d.area}</text>
                      </g>
                    )
                  })}
                </svg>
                {boxHover?.ctx === 'area' && (
                  <div style={{
                    position:'fixed', top: boxHover.y - 10,
                    left: boxHover.x > window.innerWidth - 220 ? boxHover.x - 188 : boxHover.x + 18,
                    background:C.white, border:`1px solid ${C.grayLt}`,
                    borderRadius:10, padding:'12px 16px', fontFamily:'Inter', fontSize:12,
                    boxShadow:'0 8px 24px rgba(10,31,61,0.15)', zIndex:9999,
                    pointerEvents:'none', minWidth:170,
                  }}>
                    <div style={{fontWeight:700, color:C.navy, marginBottom:8, fontSize:13}}>
                      {boxHover.d.area}
                    </div>
                    {[
                      {label:'Máximo',   val: boxHover.d.max,    color:C.gray},
                      {label:'Q3 (75%)', val: boxHover.d.q3,     color:C.gray},
                      {label:'Mediana',  val: boxHover.d.median, color: semaforoColor(boxHover.d.median, boxHover.d.akey), bold:true},
                      {label:'Promedio', val: boxHover.d.mean,   color: semaforoColor(boxHover.d.mean,   boxHover.d.akey), bold:true},
                      {label:'Q1 (25%)', val: boxHover.d.q1,     color:C.gray},
                      {label:'Mínimo',   val: boxHover.d.min,    color:C.gray},
                    ].map(({label, val, color, bold}) => (
                      <div key={label} style={{display:'flex', justifyContent:'space-between',
                        gap:16, marginBottom:4, color}}>
                        <span style={{color:C.gray}}>{label}</span>
                        <span style={{fontWeight: bold?700:500}}>{Math.round(val)}</span>
                      </div>
                    ))}
                    <div style={{borderTop:`1px solid ${C.bg2}`, marginTop:6, paddingTop:6,
                      display:'flex', justifyContent:'space-between', color:C.gray}}>
                      <span>Desviación</span>
                      <span style={{fontWeight:500}}>{Math.round(boxHover.d.std)}</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', color:C.gray, marginTop:4}}>
                      <span>Estudiantes</span>
                      <span style={{fontWeight:500}}>{boxHover.d.n}</span>
                    </div>
                  </div>
                )}
              </div>
              <div style={{display:'flex', gap:16, marginTop:8, flexWrap:'wrap', fontSize:10,
                fontFamily:'Inter', color:C.gray}}>
                <span style={{display:'flex', alignItems:'center', gap:4}}>
                  <span style={{display:'inline-block', width:20, height:2, background:'#64748b'}}/>Min – Máx
                </span>
                <span style={{display:'flex', alignItems:'center', gap:4}}>
                  <span style={{display:'inline-block', width:16, height:10, border:'1.5px solid #64748b', borderRadius:2}}/>Q1 – Q3
                </span>
                <span style={{display:'flex', alignItems:'center', gap:4}}>
                  <span style={{display:'inline-block', width:16, height:2.5, background:C.green}}/>Mediana
                </span>
                <span style={{display:'flex', alignItems:'center', gap:4}}>
                  <span style={{display:'inline-block', width:6, height:6, borderRadius:'50%', background:C.green}}/>Promedio
                </span>
              </div>
            </Card>
            <Card>
              <CardTitle sub="Estadísticas por área">Tabla de Estadísticas</CardTitle>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                  <thead>
                    <tr style={{borderBottom:`2px solid ${C.bg2}`}}>
                      {['Área','Promedio','Desviación','Mín.','Máx.'].map((h,i) => (
                        <th key={h} style={{textAlign:i===0?'left':'center', padding:'8px 12px',
                          fontSize:10, color:C.gray, fontWeight:600, textTransform:'uppercase',
                          letterSpacing:'0.05em'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {desvAreaData.map((d,i) => (
                      <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`,
                        background:i%2===0?`${C.bg}80`:'transparent'}}>
                        <td style={{padding:'10px 12px', fontSize:13, color:C.text,
                          fontWeight:d.area==='Definitiva'?700:500}}>{d.area}</td>
                        <td style={{padding:'10px 12px', textAlign:'center'}}>
                          <Badge color={semaforoColor(d.mean, d.akey)}>{Math.round(d.mean)}</Badge>
                        </td>
                        <td style={{padding:'10px 12px', textAlign:'center', fontSize:13, color:C.gray}}>
                          {Math.round(d.std)}
                        </td>
                        <td style={{padding:'10px 12px', textAlign:'center', fontSize:13, color:C.gray}}>
                          {Math.round(d.min)}
                        </td>
                        <td style={{padding:'10px 12px', textAlign:'center', fontSize:13, color:C.gray}}>
                          {Math.round(d.max)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ══ COMPETENCIAS ═════════════════════════════════════ */}
        {tab==='competencias' && (() => {
          const estMap = {}
          allStudents.forEach(s => { if (s.estudiantes) estMap[s.estudiante_id] = s.estudiantes })

          const asignaturas = ['Todas', ...new Set(notasComp.map(r => r.materia))]

          const filasBase = notasComp.filter(r => {
            const est = estMap[r.estudiante_id]
            if (!est) return false
            if (selectedGrado !== 'Todos' && String(est.grado) !== selectedGrado) return false
            if (selectedSalon !== 'Todos' && String(est.salon) !== selectedSalon) return false
            if (notasCompAsig !== 'Todas' && r.materia !== notasCompAsig) return false
            return true
          })
          const handleSortComp = col => setNotasCompSort(s => ({col, dir: s.col===col && s.dir==='asc' ? 'desc' : 'asc'}))
          const arrowComp = col => notasCompSort.col===col ? (notasCompSort.dir==='asc' ? ' ▲' : ' ▼') : ' ⇅'
          const filas = [...filasBase].sort((a, b) => {
            const est_a = estMap[a.estudiante_id] || {}
            const est_b = estMap[b.estudiante_id] || {}
            const v = notasCompSort.col
            const av = v==='nombre' ? (est_a.nombre||'') : v==='grado' ? (est_a.grado||0) : v==='salon' ? (est_a.salon||0) : v==='nota' ? (a.nota||0) : v==='preguntas' ? (a.preguntas||0) : v==='materia' ? (a.materia||'') : (a.competencia||'')
            const bv = v==='nombre' ? (est_b.nombre||'') : v==='grado' ? (est_b.grado||0) : v==='salon' ? (est_b.salon||0) : v==='nota' ? (b.nota||0) : v==='preguntas' ? (b.preguntas||0) : v==='materia' ? (b.materia||'') : (b.competencia||'')
            const cmp = typeof av==='string' ? av.localeCompare(bv) : av - bv
            return notasCompSort.dir==='asc' ? cmp : -cmp
          })

          const thSt = {padding:'8px 10px', textAlign:'left', background:'#1E3A5F',
            color:'white', fontSize:11, fontWeight:700, whiteSpace:'nowrap',
            borderBottom:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', userSelect:'none'}
          const thNum = {...thSt, textAlign:'center'}

          return students.length === 0 ? <EmptyState/> : (
            <Card>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start',
                flexWrap:'wrap', gap:12, marginBottom:20}}>
                <CardTitle sub={`${filas.length} registros`}>
                  Notas Estudiantes por Competencias
                </CardTitle>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>Materia:</span>
                  <select value={notasCompAsig} onChange={e => setNotasCompAsig(e.target.value)}
                    style={{padding:'6px 10px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                      fontFamily:'Inter', fontSize:12, color:C.text, background:C.white,
                      outline:'none', cursor:'pointer'}}>
                    {asignaturas.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              {filas.length === 0 ? (
                <div style={{textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter', fontSize:13}}>
                  Sin datos para los filtros seleccionados.
                </div>
              ) : (
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter', fontSize:12}}>
                    <thead>
                      <tr>
                        <th style={thSt} onClick={() => handleSortComp('nombre')}>Estudiante{arrowComp('nombre')}</th>
                        <th style={thNum} onClick={() => handleSortComp('grado')}>Grado{arrowComp('grado')}</th>
                        <th style={thNum} onClick={() => handleSortComp('salon')}>Salón{arrowComp('salon')}</th>
                        <th style={thSt} onClick={() => handleSortComp('materia')}>Materia{arrowComp('materia')}</th>
                        <th style={thSt} onClick={() => handleSortComp('competencia')}>Competencia{arrowComp('competencia')}</th>
                        <th style={thNum} onClick={() => handleSortComp('nota')}>Nota{arrowComp('nota')}</th>
                        <th style={thNum} onClick={() => handleSortComp('preguntas')}>Preguntas{arrowComp('preguntas')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((r, i) => {
                        const est = estMap[r.estudiante_id] || {}
                        const nota = r.nota != null ? Math.round(r.nota * 100) / 100 : null
                        const bg = nota != null ? semaforoBg(nota, '_') : C.bg2
                        const fg = nota != null ? semaforoColor(nota, '_') : C.gray
                        return (
                          <tr key={i} style={{background: i%2===0 ? C.white : C.bg2,
                            borderBottom:`1px solid ${C.bg2}`}}>
                            <td style={{padding:'7px 10px', color:C.dark, fontWeight:500}}>
                              {est.nombre || '—'}
                            </td>
                            <td style={{padding:'7px 10px', textAlign:'center', color:C.gray}}>
                              {est.grado ?? '—'}
                            </td>
                            <td style={{padding:'7px 10px', textAlign:'center', color:C.gray}}>
                              {est.salon ?? '—'}
                            </td>
                            <td style={{padding:'7px 10px', color:C.text}}>{r.materia}</td>
                            <td style={{padding:'7px 10px', color:C.text}}>{r.competencia}</td>
                            <td style={{padding:'7px 10px', textAlign:'center'}}>
                              <span style={{display:'inline-block', minWidth:52, padding:'2px 8px',
                                borderRadius:20, background:bg, color:fg, fontWeight:700, fontSize:12}}>
                                {nota != null ? nota.toFixed(2) : '—'}
                              </span>
                            </td>
                            <td style={{padding:'7px 10px', textAlign:'center', color:C.gray}}>
                              {r.preguntas ?? '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )
        })()}

        {/* ══ OPORTUNIDADES ════════════════════════════════════ */}
        {tab==='mejora' && (() => {
          // Mapeo materia → área desde el Excel de la prueba (detección dinámica de columnas)
          const matAreaMap = {}
          const rawRows = selectedPrueba?.estructura_excel?.raw || []
          const rawHdr0 = rawRows[0] || []
          const hFind0 = k => rawHdr0.findIndex(h => typeof h === 'string' && h.toLowerCase().trim().startsWith(k))
          const iAreaCol  = hFind0('área') >= 0 ? hFind0('área') : hFind0('area') >= 0 ? hFind0('area') : 2
          const iMatCol   = hFind0('asignatura') >= 0 ? hFind0('asignatura') : hFind0('materia') >= 0 ? hFind0('materia') : 3
          rawRows.slice(1).forEach(f => {
            if (!f || !Array.isArray(f)) return
            const nro = f[1]
            if (nro === '' || nro === null || nro === undefined || isNaN(Number(nro))) return
            const area = (f[iAreaCol] || '').toString().trim()
            const mat  = (f[iMatCol]  || '').toString().trim()
            if (area && mat) matAreaMap[mat] = area
          })

          const todasAreas = [...new Set(Object.values(matAreaMap))]
          // Área sin opción "Todas" — por defecto la primera
          const areaActual = todasAreas.includes(mejoraArea) ? mejoraArea : (todasAreas[0] || '')

          const todasAsigs = [...new Set(compGestion.map(r => r.materia))]
          const asigsFiltradas = todasAsigs.filter(m => matAreaMap[m] === areaActual)
          // Asignatura sí tiene "Todas"
          const asigActual = (mejoraAsig === 'Todas' || !asigsFiltradas.includes(mejoraAsig))
            ? 'Todas'
            : mejoraAsig

          // Límites dinámicos — usa el max nac_prom entre todas las asigs del área
          const compRowsArea = compGestion.filter(r => asigsFiltradas.includes(r.materia))
          const maxNacProm = compRowsArea.length > 0 ? Math.max(...compRowsArea.map(r => r.nac_prom || 0)) : 0
          const maxLimite = Math.floor((100 - maxNacProm) / 5) * 5
          const limites = []
          for (let v = 0; v <= maxLimite; v += 5) limites.push(v)
          const limiteActual = Math.min(mejoraLimite, maxLimite)

          // Filas: filtra por asignatura seleccionada o todas las del área
          const materiasFicha = asigActual === 'Todas' ? asigsFiltradas : [asigActual]
          const filteredIds = new Set(students.map(s => s.estudiante_id))
          const notasCompFiltradas = notasComp.filter(r => filteredIds.has(r.estudiante_id))

          const filasBase = compGestion
            .filter(r => materiasFicha.includes(r.materia))
            .map(r => {
              const umbral = (r.nac_prom || 0) + limiteActual
              const notasDeComp = notasCompFiltradas.filter(n => n.materia === r.materia && n.competencia === r.competencia)
              const total = notasDeComp.length
              const encima = notasDeComp.filter(n => n.nota > umbral).length
              const debajo = total - encima
              const pctEncima = total > 0 ? Math.round((encima / total) * 100) : 0
              const pctDebajo = total > 0 ? Math.round((debajo / total) * 100) : 0
              return { materia: r.materia, competencia: r.competencia, nacProm: r.nac_prom || 0, umbral, total, encima, debajo, pctEncima, pctDebajo }
            })

          // Ordenamiento por columna
          const filas = [...filasBase].sort((a, b) => {
            const v = mejoraSort.col
            const av = typeof a[v] === 'string' ? a[v].localeCompare(b[v]) : a[v] - b[v]
            return mejoraSort.dir === 'asc' ? av : -av
          })

          const handleSort = col => setMejoraSort(s =>
            s.col === col ? {col, dir: s.dir === 'asc' ? 'desc' : 'asc'} : {col, dir: 'desc'}
          )
          const arrow = col => mejoraSort.col === col ? (mejoraSort.dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'

          const selStyle = {padding:'6px 10px', border:`1px solid ${C.grayLt}`, borderRadius:6,
            fontFamily:'Inter', fontSize:12, color:C.text, background:C.white, outline:'none', cursor:'pointer'}
          const thBase = {padding:'8px 12px', background:'#1E3A5F', color:'white', fontSize:11,
            fontWeight:700, whiteSpace:'nowrap', borderBottom:'1px solid rgba(255,255,255,0.15)',
            cursor:'pointer', userSelect:'none'}
          const thSt  = {...thBase, textAlign:'left'}
          const thNum = {...thBase, textAlign:'center'}

          return students.length === 0 ? <EmptyState/> : (
            <Card>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start',
                flexWrap:'wrap', gap:12, marginBottom:20}}>
                <CardTitle sub={`${filas.length} competencias · Umbral = Prom. Nacional + Límite`}>
                  Oportunidad de Mejoramiento
                </CardTitle>
                <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>Área:</span>
                    <select value={areaActual} onChange={e => { setMejoraArea(e.target.value); setMejoraAsig('Todas') }} style={selStyle}>
                      {todasAreas.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>Asignatura:</span>
                    <select value={asigActual} onChange={e => setMejoraAsig(e.target.value)} style={selStyle}>
                      <option value="Todas">Todas</option>
                      {asigsFiltradas.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>Límite:</span>
                    <select value={limiteActual} onChange={e => setMejoraLimite(Number(e.target.value))} style={selStyle}>
                      {limites.map(v => <option key={v} value={v}>{v === 0 ? '0' : `+${v}`}</option>)}
                    </select>
                  </div>
                  <div style={{display:'flex', gap:0, borderRadius:6, overflow:'hidden', border:'1px solid #E5E7EB'}}>
                    {['table','scatter'].map(v => (
                      <button key={v} onClick={() => setMejoraView(v)}
                        style={{padding:'5px 12px', fontSize:11, fontFamily:'Inter', cursor:'pointer', border:'none',
                          background: mejoraView===v ? '#1E3A5F' : 'white',
                          color: mejoraView===v ? 'white' : '#6B7280', fontWeight: mejoraView===v ? 700 : 400}}>
                        {v==='table' ? 'Tabla' : 'Gráfico'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filas.length === 0 ? (
                <div style={{textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter', fontSize:13}}>
                  Sin datos para los filtros seleccionados.
                </div>
              ) : mejoraView === 'scatter' ? (() => {
                const scatterData = filas.map(f => ({x: f.nacProm, y: f.pctDebajo, nombre: f.competencia || f.materia}))
                const avgPctDebajo = filas.length > 0 ? filas.reduce((a,b) => a + b.pctDebajo, 0) / filas.length : 0
                const ScatterTooltip = ({active, payload}) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload || {}
                  return (
                    <div style={{background:'white', border:`1px solid ${C.grayLt}`, borderRadius:8,
                      padding:'10px 14px', fontFamily:'Inter', fontSize:11, boxShadow:'0 4px 12px rgba(0,0,0,0.12)'}}>
                      <div style={{fontWeight:700, marginBottom:4, fontSize:12, color:C.navy}}>{d.nombre}</div>
                      <div style={{color:C.gray}}>Prom. Nacional: <strong style={{color:C.navy}}>{d.x?.toFixed(1)}</strong></div>
                      <div style={{color:C.gray}}>% bajo umbral: <strong style={{color:C.red}}>{d.y}%</strong></div>
                    </div>
                  )
                }
                return (
                  <ResponsiveContainer width="100%" height={380}>
                    <ScatterChart margin={{top:20, right:30, bottom:40, left:20}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.bg2}/>
                      <XAxis type="number" dataKey="x" domain={[0,100]} name="Promedio Nacional"
                        label={{value:'Promedio Nacional', position:'insideBottom', offset:-10, fontFamily:'Inter', fontSize:11, fill:C.gray}}
                        tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}}/>
                      <YAxis type="number" dataKey="y" domain={[0,100]} name="% bajo el umbral"
                        label={{value:'% bajo el umbral', angle:-90, position:'insideLeft', offset:10, fontFamily:'Inter', fontSize:11, fill:C.gray}}
                        tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}}/>
                      <ZAxis range={[40,200]}/>
                      <Tooltip content={<ScatterTooltip/>}/>
                      <ReferenceLine y={avgPctDebajo} strokeDasharray="4 2" stroke="red"
                        label={{value:`Prom: ${Math.round(avgPctDebajo)}%`, position:'insideTopRight', fontFamily:'Inter', fontSize:10, fill:'red'}}/>
                      <Scatter data={scatterData} fill="#2563EB" opacity={0.8}/>
                    </ScatterChart>
                  </ResponsiveContainer>
                )
              })() : (
                <>
                  <div style={{display:'flex', gap:20, marginBottom:14, flexWrap:'wrap'}}>
                    <div style={{display:'flex', alignItems:'center', gap:6, fontFamily:'Inter', fontSize:11, color:C.gray}}>
                      <span style={{width:12, height:12, borderRadius:2, background:C.red, display:'inline-block'}}/>
                      Por debajo del umbral
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:6, fontFamily:'Inter', fontSize:11, color:C.gray}}>
                      <span style={{width:12, height:12, borderRadius:2, background:C.green, display:'inline-block'}}/>
                      Por encima del umbral
                    </div>
                    <div style={{fontFamily:'Inter', fontSize:11, color:C.gray, marginLeft:'auto'}}>
                      Clic en encabezado para ordenar
                    </div>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter', fontSize:12}}>
                      <thead>
                        <tr>
                          {asigActual === 'Todas' && (
                            <th style={thSt} onClick={() => handleSort('materia')}>
                              Asignatura{arrow('materia')}
                            </th>
                          )}
                          <th style={thSt} onClick={() => handleSort('competencia')}>
                            Competencia{arrow('competencia')}
                          </th>
                          <th style={thNum} onClick={() => handleSort('nacProm')}>
                            Prom. Nacional{arrow('nacProm')}
                          </th>
                          <th style={thNum} onClick={() => handleSort('umbral')}>
                            Umbral{arrow('umbral')}
                          </th>
                          <th style={thNum} onClick={() => handleSort('total')}>
                            Estudiantes{arrow('total')}
                          </th>
                          <th style={thNum} onClick={() => handleSort('pctDebajo')}>
                            % Por debajo{arrow('pctDebajo')}
                          </th>
                          <th style={thNum} onClick={() => handleSort('pctEncima')}>
                            % Por encima{arrow('pctEncima')}
                          </th>
                          <th style={{...thSt, minWidth:140, cursor:'default'}}>Distribución</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((f, i) => (
                          <tr key={i} style={{background: i%2===0 ? C.white : C.bg2, borderBottom:`1px solid ${C.bg2}`}}>
                            {asigActual === 'Todas' && (
                              <td style={{padding:'8px 12px', color:C.gray, fontSize:11}}>{f.materia}</td>
                            )}
                            <td style={{padding:'8px 12px', color:C.dark, fontWeight:500, maxWidth:280}}>
                              {f.competencia}
                            </td>
                            <td style={{padding:'8px 12px', textAlign:'center', color:C.gray}}>
                              {f.nacProm.toFixed(1)}
                            </td>
                            <td style={{padding:'8px 12px', textAlign:'center'}}>
                              <span style={{fontWeight:700, color:C.navy}}>{f.umbral.toFixed(1)}</span>
                            </td>
                            <td style={{padding:'8px 12px', textAlign:'center', color:C.gray}}>
                              {f.total}
                            </td>
                            <td style={{padding:'8px 12px', textAlign:'center'}}>
                              <span style={{display:'inline-block', minWidth:52, padding:'2px 8px', borderRadius:20,
                                background: f.pctDebajo >= 60 ? `${C.red}22` : f.pctDebajo >= 40 ? '#FEF3C722' : `${C.green}18`,
                                color: f.pctDebajo >= 60 ? C.red : f.pctDebajo >= 40 ? '#D97706' : C.green,
                                fontWeight:700}}>
                                {f.pctDebajo}%
                              </span>
                            </td>
                            <td style={{padding:'8px 12px', textAlign:'center'}}>
                              <span style={{display:'inline-block', minWidth:52, padding:'2px 8px', borderRadius:20,
                                background: f.pctEncima >= 60 ? `${C.green}18` : f.pctEncima >= 40 ? '#FEF3C722' : `${C.red}22`,
                                color: f.pctEncima >= 60 ? C.green : f.pctEncima >= 40 ? '#D97706' : C.red,
                                fontWeight:700}}>
                                {f.pctEncima}%
                              </span>
                            </td>
                            <td style={{padding:'8px 12px'}}>
                              <div style={{display:'flex', height:18, borderRadius:4, overflow:'hidden', background:C.bg2, minWidth:120}}>
                                {f.total > 0 && (
                                  <>
                                    <div style={{width:`${f.pctDebajo}%`, background:C.red, transition:'width 0.3s'}}/>
                                    <div style={{width:`${f.pctEncima}%`, background:C.green, transition:'width 0.3s'}}/>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
          )
        })()}

        {/* ══ RANKING ══════════════════════════════════════════ */}
        {tab==='ranking' && (() => {
          const calcDefR = s => {
            const mc=s.mat_cuantitativo, me=s.mat_especifico, q=s.cn_quimica, f=s.cn_fisica
            const b=s.cn_biologia, cts=s.cn_cts, sc=s.sociales, ciu=s.ciudadanas
            const lc=s.lectura_critica, ing=s.ingles
            if ([mc,me,q,f,b,cts,sc,ciu,lc,ing].every(v => v == null)) return null
            return (((mc||0)+(me||0))/2*3 + ((q||0)+(f||0)+(b||0)+(cts||0))/4*3 + ((sc||0)+(ciu||0))/2*3 + (lc||0)*3 + (ing||0)) / 13
          }
          const RANK_COLS = [
            {key:'nombre', label:'Estudiante'}, {key:'puntaje_global', label:'Global'},
            {key:'_def', label:'Def.'}, {key:'desempeno_pct', label:'Desem.%'},
            {key:'mat_cuantitativo', label:'Mat.C'}, {key:'mat_especifico', label:'Mat.E'},
            {key:'cn_quimica', label:'Quím.'}, {key:'cn_fisica', label:'Fís.'},
            {key:'cn_biologia', label:'Bio.'}, {key:'cn_cts', label:'CTS'},
            {key:'sociales', label:'Soc.'}, {key:'ciudadanas', label:'Ciud.'},
            {key:'lectura_critica', label:'L.Crít.'}, {key:'ingles', label:'Inglés'},
          ]
          const handleSortR = col => setRankingSort(s => ({col, dir: s.col===col && s.dir==='asc' ? 'desc' : 'asc'}))
          const arrowR = col => rankingSort.col===col ? (rankingSort.dir==='asc' ? ' ▲' : ' ▼') : ' ⇅'
          const rankSorted = [...students].map(s => ({...s, _def: calcDefR(s)})).sort((a, b) => {
            const av = rankingSort.col==='nombre' ? (a.estudiantes?.nombre||'') : (a[rankingSort.col]||0)
            const bv = rankingSort.col==='nombre' ? (b.estudiantes?.nombre||'') : (b[rankingSort.col]||0)
            const cmp = typeof av==='string' ? av.localeCompare(bv) : av - bv
            return rankingSort.dir==='asc' ? cmp : -cmp
          })
          const thR = {textAlign:'left', padding:'8px 10px', fontSize:10, color:C.gray, fontWeight:600,
            textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap',
            cursor:'pointer', userSelect:'none', background:'#1E3A5F', color:'white'}
          return students.length === 0 ? <EmptyState/> : (
          <Card>
            <CardTitle sub={`${students.length} estudiantes`}>
              Ranking Completo
            </CardTitle>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                <thead>
                  <tr>
                    <th style={{...thR, minWidth:30}}>#</th>
                    {RANK_COLS.map(c => (
                      <th key={c.key} style={thR} onClick={() => handleSortR(c.key)}>
                        {c.label}{arrowR(c.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankSorted.map((s,i) => (
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
                      <td style={{padding:'8px 10px', fontSize:12, color:C.text}}>{s._def?.toFixed(2)||'—'}</td>
                      <td style={{padding:'8px 10px'}}>
                        <Badge color={semaforoColor(s.desempeno_pct)}>{s.desempeno_pct?.toFixed(1)}%</Badge>
                      </td>
                      {[s.mat_cuantitativo, s.mat_especifico, s.cn_quimica, s.cn_fisica,
                        s.cn_biologia, s.cn_cts, s.sociales, s.ciudadanas, s.lectura_critica, s.ingles].map((v,j) => (
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
          )
        })()}
        {/* ══ DETALLE PRUEBA ════════════════════════════════════ */}
        {tab==='detalle_prueba' && (() => {
          const handleSortDP = col => setDetallePruebaSort(s => ({col, dir: s.col===col && s.dir==='asc' ? 'desc' : 'asc'}))
          const arrowDP = col => detallePruebaSort.col===col ? (detallePruebaSort.dir==='asc' ? ' ▲' : ' ▼') : ' ⇅'
          const dpSorted = [...detallePreguntas].sort((a, b) => {
            const v = detallePruebaSort.col
            const strCols = ['materia','estandar','competencia','componente','tarea','respuesta_correcta','dificultad']
            const av = strCols.includes(v) ? (a[v]||'') : (a[v]||0)
            const bv = strCols.includes(v) ? (b[v]||'') : (b[v]||0)
            const cmp = typeof av==='string' ? av.localeCompare(bv) : av - bv
            return detallePruebaSort.dir==='asc' ? cmp : -cmp
          })

          const thDP = {
            padding:'6px 8px', fontSize:10, color:C.white, fontWeight:700,
            textAlign:'center', whiteSpace:'nowrap', background:C.navy,
            borderRight:'1px solid rgba(255,255,255,0.1)',
            cursor:'pointer', userSelect:'none', verticalAlign:'middle',
          }
          const tdDP = {padding:'6px 8px', fontSize:11, verticalAlign:'middle', borderBottom:`1px solid ${C.bg2}`}

          const difColor = d => d==='Superior'?'#DC2626': d==='Alto'?'#D97706': d==='Básico'?'#2563EB': d==='Bajo'?'#16A34A': C.gray
          const difLabel = d => d==='Superior'?'Nivel 4': d==='Alto'?'Nivel 3': d==='Básico'?'Nivel 2': d==='Bajo'?'Nivel 1': d||'—'
          const pctColor = v => v >= 70 ? '#16A34A' : v >= 45 ? '#D97706' : '#DC2626'

          return students.length === 0 ? <EmptyState/> : (
            <Card>
              <CardTitle sub={`${detallePreguntas.length} preguntas · ${prueba?.codigo||'—'}`}>
                Detalle de la Prueba por Pregunta
              </CardTitle>
              {detallePreguntas.length === 0 ? (
                <EmptyState msg="No hay análisis de preguntas cargado para esta prueba."/>
              ) : (
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter', fontSize:11}}>
                    <thead>
                      <tr>
                        <th style={{...thDP, width:40}} onClick={()=>handleSortDP('sesion')}>Ses.{arrowDP('sesion')}</th>
                        <th style={{...thDP, width:40}} onClick={()=>handleSortDP('nro_pregunta')}>Nro{arrowDP('nro_pregunta')}</th>
                        <th style={{...thDP, textAlign:'left', width:220}} onClick={()=>handleSortDP('estandar')}>Estándar{arrowDP('estandar')}</th>
                        <th style={{...thDP, textAlign:'left', width:130}} onClick={()=>handleSortDP('componente')}>Componente{arrowDP('componente')}</th>
                        <th style={{...thDP, textAlign:'left', width:130}} onClick={()=>handleSortDP('competencia')}>Competencia{arrowDP('competencia')}</th>
                        <th style={{...thDP, textAlign:'left', width:180}} onClick={()=>handleSortDP('tarea')}>Tarea{arrowDP('tarea')}</th>
                        <th style={{...thDP, width:44}} onClick={()=>handleSortDP('respuesta_correcta')}>RTA{arrowDP('respuesta_correcta')}</th>
                        <th style={{...thDP, width:52}} onClick={()=>handleSortDP('pct_nacional')}>% Nac{arrowDP('pct_nacional')}</th>
                        <th style={{...thDP, width:52}} onClick={()=>handleSortDP('pct_colegio')}>% Plan{arrowDP('pct_colegio')}</th>
                        <th style={{...thDP, width:70}} onClick={()=>handleSortDP('dificultad')}>Dificultad{arrowDP('dificultad')}</th>
                        <th style={{...thDP, width:60, cursor:'default'}}>Opor.<br/>Mejora</th>
                        <th style={{...thDP, width:60, cursor:'default'}}>% Rta</th>
                        <th style={{...thDP, width:80, cursor:'default', color:'rgba(255,255,255,0.45)'}}>Explicación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dpSorted.map((q, i) => {
                        const mejora = q.oportunidad_mejora || (q.pct_colegio != null && q.pct_nacional != null && q.pct_colegio < q.pct_nacional)
                        return (
                          <tr key={i} style={{background: mejora ? '#FFF7F7' : i%2===0 ? `${C.bg}80` : C.white}}>
                            <td style={{...tdDP, textAlign:'center', color:C.gray}}>{q.sesion??'—'}</td>
                            <td style={{...tdDP, textAlign:'center', fontWeight:700, fontSize:13,
                              color:C.navy, fontFamily:'Playfair Display, serif'}}>{q.nro_pregunta}</td>
                            <td style={{...tdDP, color:C.text, lineHeight:1.4}}>{q.estandar||'—'}</td>
                            <td style={{...tdDP, color:C.gray}}>{q.componente||'—'}</td>
                            <td style={{...tdDP, color:C.gray}}>{q.competencia||'—'}</td>
                            <td style={{...tdDP, color:C.text}}>{q.tarea||'—'}</td>
                            <td style={{...tdDP, textAlign:'center', fontWeight:700, fontSize:13,
                              color:C.navy}}>{q.respuesta_correcta||'—'}</td>
                            <td style={{...tdDP, textAlign:'center'}}>
                              {q.pct_nacional != null
                                ? <span style={{fontWeight:700, color:pctColor(q.pct_nacional)}}>{q.pct_nacional}</span>
                                : <span style={{color:C.grayLt}}>—</span>}
                            </td>
                            <td style={{...tdDP, textAlign:'center'}}>
                              {q.pct_colegio != null
                                ? <span style={{fontWeight:700, color:pctColor(q.pct_colegio)}}>{q.pct_colegio}</span>
                                : <span style={{color:C.grayLt}}>—</span>}
                            </td>
                            <td style={{...tdDP, textAlign:'center'}}>
                              {q.dificultad
                                ? <span style={{display:'inline-block', padding:'2px 8px', borderRadius:20,
                                    fontSize:10, fontWeight:700, color:'#fff',
                                    background:difColor(q.dificultad)}}>
                                    {difLabel(q.dificultad)}
                                  </span>
                                : <span style={{color:C.grayLt}}>—</span>}
                            </td>
                            <td style={{...tdDP, textAlign:'center'}}>
                              {mejora
                                ? <span style={{fontWeight:700, color:'#DC2626', fontSize:12}}>Sí</span>
                                : <span style={{fontWeight:700, color:'#16A34A', fontSize:12}}>No</span>}
                            </td>
                            <td style={{...tdDP, textAlign:'center'}}>
                              <button onClick={async () => {
                                setDistribModal({q, data:null, loading:true})
                                const {data} = await supabase.rpc('get_distribucion_pregunta', {
                                  p_prueba_id: prueba.id,
                                  p_nro_pregunta: q.nro_pregunta,
                                  p_colegio_id: session.id,
                                })
                                setDistribModal({q, data, loading:false})
                              }} style={{padding:'3px 10px', borderRadius:6, border:`1px solid ${C.navy}`,
                                background:'transparent', color:C.navy, fontSize:11,
                                fontWeight:600, cursor:'pointer', fontFamily:'Inter'}}>
                                Ver
                              </button>
                            </td>
                            <td style={{...tdDP, textAlign:'center', color:C.grayLt, fontSize:10}}>—</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div style={{marginTop:12, fontSize:11, color:C.gray, fontFamily:'Inter'}}>
                    <strong style={{color:'#DC2626'}}>Sí</strong> = % Plantel inferior al % Nacional &nbsp;|&nbsp;
                    Colores: <strong style={{color:'#16A34A'}}>≥70%</strong> &nbsp;
                    <strong style={{color:'#D97706'}}>45–69%</strong> &nbsp;
                    <strong style={{color:'#DC2626'}}>&lt;45%</strong>
                  </div>
                </div>
              )}
            </Card>
          )
        })()}

        {/* ══ LISTADO DE NOTAS ═══════════════════════════════════ */}
        {tab==='listado_notas' && (() => {
          // Fórmula Tablero de Gestión
          const calcDef = s => {
            const mc = s.mat_cuantitativo, me = s.mat_especifico
            const q  = s.cn_quimica,       f  = s.cn_fisica
            const b  = s.cn_biologia,      cts= s.cn_cts
            const sc = s.sociales,         ciu= s.ciudadanas
            const lc = s.lectura_critica,  ing= s.ingles
            if ([mc,me,q,f,b,cts,sc,ciu,lc,ing].every(v => v == null)) return null
            return (((mc||0)+(me||0))/2*3 + ((q||0)+(f||0)+(b||0)+(cts||0))/4*3 + ((sc||0)+(ciu||0))/2*3 + (lc||0)*3 + (ing||0)) / 13
          }

          const handleSortLN = col => setListadoNotasSort(s => ({col, dir: s.col===col && s.dir==='asc' ? 'desc' : 'asc'}))
          const arrowLN = col => listadoNotasSort.col===col ? (listadoNotasSort.dir==='asc' ? ' ▲' : ' ▼') : ' ⇅'

          const onResizeNombre = e => {
            e.preventDefault()
            const startX = e.clientX
            const startW = nombreColWidth
            const onMove = ev => { if (mountedRef.current) setNombreColWidth(Math.max(80, Math.min(400, startW + ev.clientX - startX))) }
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
          }

          const getGlobal = s => s.puntaje_global ?? null
          const getDef = s => s.desempeno_pct != null ? +parseFloat(s.desempeno_pct).toFixed(3) : null

          const withDef = [...students].map(s => ({...s, _def: getDef(s), _global: getGlobal(s)}))
          const byDef = [...withDef].sort((a,b) => (b._global||0) - (a._global||0))
          byDef.forEach((s, idx) => {
            s._pct = byDef.length > 1 ? Math.round(((byDef.length - 1 - idx) / (byDef.length - 1)) * 100) : 100
          })
          const ranked = [...withDef].sort((a, b) => {
              const v = listadoNotasSort.col
              const av = v==='nombre' ? (a.estudiantes?.nombre||'') : v==='global' ? (a._global||0) : v==='_def' ? (a._def||0) : (a[v]||0)
              const bv = v==='nombre' ? (b.estudiantes?.nombre||'') : v==='global' ? (b._global||0) : v==='_def' ? (b._def||0) : (b[v]||0)
              const cmp = typeof av==='string' ? av.localeCompare(bv) : av - bv
              return listadoNotasSort.dir==='asc' ? cmp : -cmp
            })

          const thBase = {padding:'4px 3px', textAlign:'center', color:'#fff', background:C.navy,
            fontSize:10, fontWeight:700, whiteSpace:'nowrap',
            borderRight:'1px solid rgba(255,255,255,0.12)', cursor:'pointer', userSelect:'none'}
          const tdBase = {padding:'4px 3px', textAlign:'center', fontSize:11, background:C.white}

          // Col de nota con color en el número según área
          const notaTd = (val, area) => {
            const v = val != null ? Math.round(val*1000)/1000 : null
            return {
              style: {...tdBase, color: v != null ? semaforoColor(v, area) : C.grayLt,
                fontWeight: v != null ? 700 : 400},
              text:  v != null ? v.toFixed(2) : '—'
            }
          }

          const AREAS = [
            {label:'Matemáticas',   area:'mat', cols:[['mat_cuantitativo','Cuant.'],['mat_especifico','Espec.']]},
            {label:'Cs. Naturales', area:'cn',  cols:[['cn_quimica','Quím.'],['cn_fisica','Fís.'],['cn_biologia','Bio.'],['cn_cts','CTS']]},
            {label:'Soc. y Ciu.',   area:'soc', cols:[['sociales','Soc.'],['ciudadanas','Ciud.']]},
            {label:'L. Crítica',    area:'lc',  cols:[['lectura_critica','L.C.']]},
            {label:'Inglés',        area:'ing', cols:[['ingles','Ing.']]},
          ]

          return students.length === 0 ? <EmptyState/> : (
            <Card>
              <div style={{overflowX:'auto'}}>
                <table style={{borderCollapse:'collapse', fontFamily:'Inter', fontSize:11, width:'100%', tableLayout:'fixed'}}>
                  <colgroup>
                    <col style={{width:28}}/>
                    <col style={{width:nombreColWidth}}/>
                    {AREAS.flatMap(a => a.cols.map(([col]) => <col key={col} style={{width:52}}/>))}
                    <col style={{width:52}}/>
                    <col style={{width:48}}/>
                    <col style={{width:42}}/>
                    <col style={{width:38}}/>
                  </colgroup>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{...thBase, borderBottom:'1px solid rgba(255,255,255,0.15)',
                        cursor:'default', padding:'4px 4px'}}>#</th>
                      <th rowSpan={2} style={{...thBase, textAlign:'left', borderBottom:'1px solid rgba(255,255,255,0.15)',
                        padding:'4px 8px', position:'relative'}}
                        onClick={() => handleSortLN('nombre')}>
                        Nombre Estudiante{arrowLN('nombre')}
                        <div onMouseDown={onResizeNombre}
                          style={{position:'absolute', right:0, top:0, bottom:0, width:5,
                            cursor:'col-resize', background:'rgba(255,255,255,0.15)',
                            borderRadius:2}}
                          onClick={e => e.stopPropagation()}/>
                      </th>
                      {AREAS.map(a => (
                        <th key={a.label} colSpan={a.cols.length}
                          style={{...thBase, borderBottom:'1px solid rgba(255,255,255,0.15)', cursor:'default', padding:'4px 2px'}}>
                          {a.label}
                        </th>
                      ))}
                      <th rowSpan={2} style={{...thBase, borderBottom:'1px solid rgba(255,255,255,0.15)', padding:'4px 2px'}}
                        onClick={() => handleSortLN('_def')}>
                        Def.{arrowLN('_def')}
                      </th>
                      <th rowSpan={2} style={{...thBase, borderBottom:'1px solid rgba(255,255,255,0.15)', padding:'4px 2px'}}
                        onClick={() => handleSortLN('global')}>
                        Global{arrowLN('global')}
                        <span style={{display:'block',fontSize:8,fontWeight:700,color:'#86efac',letterSpacing:.3}}>0–500</span>
                      </th>
                      <th rowSpan={2} style={{...thBase, borderBottom:'1px solid rgba(255,255,255,0.15)',
                        cursor:'default', padding:'4px 2px'}}>Pctil</th>
                      <th rowSpan={2} style={{...thBase, borderBottom:'1px solid rgba(255,255,255,0.15)',
                        cursor:'default', padding:'4px 2px'}}>Ver</th>
                    </tr>
                    <tr>
                      {AREAS.flatMap(a => a.cols.map(([col, h]) => (
                        <th key={col} style={{...thBase, fontSize:9, borderTop:'1px solid rgba(255,255,255,0.15)', padding:'3px 2px'}}
                          onClick={() => handleSortLN(col)}>
                          {h}{arrowLN(col)}
                        </th>
                      )))}
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((s, i) => {
                      const pct = s._pct
                      return (
                        <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`}}>
                          <td style={{...tdBase, color:C.dark, fontWeight:600, fontSize:11, padding:'4px 4px'}}>{i+1}</td>
                          <td style={{...tdBase, textAlign:'left', padding:'4px 8px',
                            color:C.dark, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden',
                            textOverflow:'ellipsis'}}>
                            {s.estudiantes?.nombre}
                          </td>
                          {AREAS.flatMap(a => a.cols.map(([col]) => {
                            const {style, text} = notaTd(s[col], a.area)
                            return <td key={col} style={style}>{text}</td>
                          }))}
                          <td style={{...tdBase, color: s._def != null ? semaforoColor(s._def, '_') : C.grayLt, fontWeight:700, fontSize:10}}>
                            {s._def != null ? s._def.toFixed(2) : '—'}
                          </td>
                          <td style={{...tdBase, fontWeight:700, color:C.navy, fontSize:12,
                            fontFamily:'Playfair Display, serif'}}>
                            {s._global != null ? s._global : '—'}
                          </td>
                          <td style={{...tdBase, fontWeight:600, fontSize:10,
                            color: pct>=75 ? '#16A34A' : pct>=50 ? '#D97706' : '#DC2626'}}>
                            {pct != null ? `${pct}%` : '—'}
                          </td>
                          <td style={{...tdBase}}>
                            <span onClick={() => setSelectedStudent(s)}
                              style={{cursor:'pointer', color:'#2563EB', fontWeight:600, fontSize:10,
                                textDecoration:'underline'}}>
                              Ver
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <LeyendaNiveles/>
            </Card>
          )
        })()}

        {/* ══ CONVERTIDOR DE NOTAS ══════════════════════════════════ */}
        {tab==='convertidor_notas' && (() => {
          const convertir = pct => {
            if (pct == null) return null
            const u = convUmbral, mn = convMin, mx = convMax, ap = convAprobacion
            let nota
            if (u <= 0) nota = mn
            else if (pct >= u) nota = ap + (pct - u) / (100 - u) * (mx - ap)
            else nota = mn + (pct / u) * (ap - mn)
            return Math.min(mx, Math.max(mn, nota))
          }

          const sorted = [...students].sort((a,b) => (b.puntaje_global||0) - (a.puntaje_global||0))

          const AREAS_CONV = [
            {label:'Matemáticas',   cols:[['mat_cuantitativo','Cuant.'],['mat_especifico','Espec.']]},
            {label:'Cs. Naturales', cols:[['cn_quimica','Quím.'],['cn_fisica','Fís.'],['cn_biologia','Bio.'],['cn_cts','CTS']]},
            {label:'Soc. y Ciu.',   cols:[['sociales','Soc.'],['ciudadanas','Ciud.']]},
            {label:'L. Crítica',    cols:[['lectura_critica','L.C.']]},
            {label:'Inglés',        cols:[['ingles','Ing.']]},
          ]

          const thBase = {padding:'4px 3px', textAlign:'center', color:'#fff', background:C.navy,
            fontSize:10, fontWeight:700, whiteSpace:'nowrap',
            borderRight:'1px solid rgba(255,255,255,0.12)', cursor:'default', userSelect:'none'}
          const tdBase = {padding:'4px 3px', textAlign:'center', fontSize:11, background:C.white}

          const notaColor = nota => {
            if (nota == null) return C.grayLt
            if (nota >= convAprobacion) return '#16A34A'
            if (nota >= convAprobacion * 0.8) return '#D97706'
            return '#DC2626'
          }

          const inputStyle = {
            width: 64, padding: '5px 8px', border: `1px solid ${C.grayLt}`,
            borderRadius: 6, fontFamily: 'Inter', fontSize: 13, color: C.text,
            background: C.white, outline: 'none', textAlign: 'center',
          }

          return students.length === 0 ? <EmptyState/> : (
            <Card>
              <CardTitle sub="Convierte los porcentajes del simulacro a la escala de tu institución">
                Convertidor de Notas
              </CardTitle>

              {/* Config row */}
              <div style={{display:'flex', flexWrap:'wrap', gap:20, alignItems:'flex-end',
                background:C.bg2, borderRadius:10, padding:'14px 20px', marginBottom:20}}>
                <div style={{display:'flex', flexDirection:'column', gap:4}}>
                  <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>Nota mínima</span>
                  <input type="number" step="0.1" min="0" max="10"
                    value={convMin} onChange={e=>setConvMin(+e.target.value)} style={inputStyle}/>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:4}}>
                  <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>Nota máxima</span>
                  <input type="number" step="0.1" min="1" max="10"
                    value={convMax} onChange={e=>setConvMax(+e.target.value)} style={inputStyle}/>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:4}}>
                  <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>Nota aprobación</span>
                  <input type="number" step="0.1" min="0" max="10"
                    value={convAprobacion} onChange={e=>setConvAprobacion(+e.target.value)} style={inputStyle}/>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:4}}>
                  <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>Umbral de aprobación (%)</span>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <input type="range" min="1" max="99" value={convUmbral}
                      onChange={e=>setConvUmbral(+e.target.value)}
                      style={{width:120, accentColor:C.navy}}/>
                    <span style={{fontSize:13, fontWeight:700, color:C.navy, fontFamily:'Inter', minWidth:36}}>
                      {convUmbral}%
                    </span>
                  </div>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:4,
                  padding:'8px 14px', background:C.white, borderRadius:8,
                  border:`1px solid ${C.grayLt}`, fontSize:12, fontFamily:'Inter', color:C.gray, lineHeight:1.7}}>
                  <span><strong style={{color:C.navy}}>{convUmbral}%</strong> correcto → <strong style={{color:'#16A34A'}}>{convAprobacion.toFixed(1)}</strong></span>
                  <span><strong style={{color:C.navy}}>100%</strong> correcto → <strong style={{color:'#16A34A'}}>{convMax.toFixed(1)}</strong></span>
                  <span><strong style={{color:C.navy}}>0%</strong> correcto → <strong style={{color:'#DC2626'}}>{convMin.toFixed(1)}</strong></span>
                </div>
              </div>

              {/* Table */}
              <div style={{overflowX:'auto'}}>
                <table style={{borderCollapse:'collapse', fontFamily:'Inter', fontSize:11,
                  width:'100%', tableLayout:'fixed'}}>
                  <colgroup>
                    <col style={{width:28}}/>
                    <col style={{width:175}}/>
                    {AREAS_CONV.flatMap(a => a.cols.map(([col]) => <col key={col} style={{width:52}}/>))}
                    <col style={{width:58}}/>
                  </colgroup>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{...thBase, borderBottom:'1px solid rgba(255,255,255,0.15)',
                        padding:'4px 4px'}}>#</th>
                      <th rowSpan={2} style={{...thBase, textAlign:'left',
                        borderBottom:'1px solid rgba(255,255,255,0.15)', padding:'4px 8px'}}>
                        Nombre Estudiante
                      </th>
                      {AREAS_CONV.map(a => (
                        <th key={a.label} colSpan={a.cols.length}
                          style={{...thBase, borderBottom:'1px solid rgba(255,255,255,0.15)', padding:'4px 2px'}}>
                          {a.label}
                        </th>
                      ))}
                      <th rowSpan={2} style={{...thBase, borderBottom:'1px solid rgba(255,255,255,0.15)',
                        padding:'4px 2px', background:'#0A2F1F'}}>
                        Definitiva
                        <span style={{display:'block', fontSize:8, fontWeight:700,
                          color:'#86efac', letterSpacing:.3}}>{convMin}–{convMax}</span>
                      </th>
                    </tr>
                    <tr>
                      {AREAS_CONV.flatMap(a => a.cols.map(([col,h]) => (
                        <th key={col} style={{...thBase, fontSize:9,
                          borderTop:'1px solid rgba(255,255,255,0.15)', padding:'3px 2px'}}>
                          {h}
                        </th>
                      )))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s, i) => {
                      const defNota = convertir(s.desempeno_pct != null ? +s.desempeno_pct : null)
                      return (
                        <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`}}>
                          <td style={{...tdBase, color:C.dark, fontWeight:600, fontSize:11,
                            padding:'4px 4px'}}>{i+1}</td>
                          <td style={{...tdBase, textAlign:'left', padding:'4px 8px',
                            color:C.dark, fontWeight:500, whiteSpace:'nowrap',
                            overflow:'hidden', textOverflow:'ellipsis'}}>
                            {s.estudiantes?.nombre}
                          </td>
                          {AREAS_CONV.flatMap(a => a.cols.map(([col]) => {
                            const nota = convertir(s[col])
                            return (
                              <td key={col} style={{...tdBase, color:notaColor(nota), fontWeight:700}}>
                                {nota != null ? nota.toFixed(1) : '—'}
                              </td>
                            )
                          }))}
                          <td style={{...tdBase, fontWeight:700, fontSize:12,
                            color: notaColor(defNota), fontFamily:'Playfair Display, serif',
                            background: defNota != null && defNota >= convAprobacion
                              ? '#F0FDF4' : defNota != null ? '#FFF7F7' : C.white}}>
                            {defNota != null ? defNota.toFixed(1) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        })()}

        {/* ══ NOTAS ACUMULADAS ═══════════════════════════════════ */}
        {tab==='notas_acumuladas' && (
          <div style={{display:'grid', gap:16}}>
            {allPruebasPromedio.length === 0 ? (
              <Card><EmptyState msg="No hay datos acumulados de pruebas anteriores."/></Card>
            ) : (
              <>
                <Card>
                  <CardTitle sub="Evolución del promedio global a través de las pruebas">
                    Notas Acumuladas por Prueba
                  </CardTitle>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={allPruebasPromedio} margin={{top:10, right:20, bottom:0, left:-20}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.bg2}/>
                      <XAxis dataKey="label" tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}}/>
                      <YAxis tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}} domain={[0,110]}/>
                      <Tooltip contentStyle={{fontFamily:'Inter', fontSize:12, borderRadius:8}}/>
                      <Legend wrapperStyle={{fontFamily:'Inter', fontSize:11}}/>
                      <Bar dataKey="mat" name="Matemáticas" fill="#3B82F6" radius={[3,3,0,0]}/>
                      <Bar dataKey="cn"  name="Cs. Naturales" fill="#10B981" radius={[3,3,0,0]}/>
                      <Bar dataKey="soc" name="Soc/Ciudad." fill="#8B5CF6" radius={[3,3,0,0]}/>
                      <Bar dataKey="lc"  name="Lect. Crítica" fill="#F59E0B" radius={[3,3,0,0]}/>
                      <Bar dataKey="ing" name="Inglés" fill="#EF4444" radius={[3,3,0,0]}/>
                      <Line dataKey="global" name="Global" type="monotone" stroke="#1E3A5F" strokeWidth={2} dot={true}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <CardTitle sub="Tabla de promedios acumulados por área y prueba">
                    Tabla de Notas Acumuladas
                  </CardTitle>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                      <thead>
                        <tr style={{background:C.navy}}>
                          {['Prueba','Global','Matemáticas','Cs. Naturales','Soc/Ciudad.','Lect. Crítica','Inglés','Estud.'].map(h => (
                            <th key={h} style={{padding:'10px 14px', fontSize:11, color:C.white,
                              fontWeight:600, textAlign:'center', whiteSpace:'nowrap'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allPruebasPromedio.map((row,i) => (
                          <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`,
                            background: row.prueba?.id === prueba?.id ? `${C.navy}08` : i%2===0?`${C.bg}60`:'transparent',
                            fontWeight: row.prueba?.id === prueba?.id ? 600 : 400}}>
                            <td style={{padding:'10px 14px', fontSize:13, color:C.navy, fontWeight:600}}>
                              {row.label}
                              {row.prueba?.id === prueba?.id && (
                                <span style={{fontSize:9, color:C.green, marginLeft:6, fontWeight:400}}>actual</span>
                              )}
                            </td>
                            <td style={{padding:'10px 14px', textAlign:'center'}}>
                              <span style={{fontSize:15, fontWeight:700, color:C.navy,
                                fontFamily:'Playfair Display, serif'}}>{row.global}</span>
                            </td>
                            {[row.mat, row.cn, row.soc, row.lc, row.ing].map((v,j) => (
                              <td key={j} style={{padding:'10px 14px', textAlign:'center'}}>
                                <div style={{display:'inline-block', background:semaforoBg(v||0),
                                  color:semaforoColor(v||0), padding:'3px 10px',
                                  borderRadius:5, fontWeight:700, fontSize:13}}>{v||'—'}</div>
                              </td>
                            ))}
                            <td style={{padding:'10px 14px', textAlign:'center', fontSize:12, color:C.gray}}>{row.n}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <LeyendaNiveles/>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ══ DESVIACIÓN COMPONENTES ═══════════════════════════ */}
        {tab==='comp_desviacion' && (() => {
          const regionNombre = REGION_NOMBRES[session?.departamento_nombre?.toUpperCase()] || 'Región'
          const dptoNombre   = toTitleCase(session?.departamento_nombre) || 'Dpto.'
          const ciudadNombre = toTitleCase(session?.municipio) || 'Ciudad'
          const asignaturas  = ['Todas', ...new Set(compNGestion.map(r => r.materia)).values()]
          const filas        = compNAsigFilter === 'Todas' ? compNGestion : compNGestion.filter(r => r.materia === compNAsigFilter)
          const fmtVal       = v => v != null ? Math.round(v) : '—'

          const ColHeader = ({label, sub}) => (
            <th colSpan={2} style={{padding:'8px 10px', textAlign:'center', background:'#1E3A5F',
              color:'white', fontSize:11, fontWeight:700, borderRight:'2px solid rgba(255,255,255,0.15)',
              borderBottom:'1px solid rgba(255,255,255,0.2)', whiteSpace:'nowrap'}}>
              {label}{sub && <div style={{fontSize:9,fontWeight:400,opacity:0.7,marginTop:1}}>{sub}</div>}
            </th>
          )

          return students.length === 0 ? <EmptyState/> : (
            <div style={{display:'grid', gap:16}}>
              <Card>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start',
                  flexWrap:'wrap', gap:12, marginBottom:20}}>
                  <CardTitle sub="Promedio y desviación por componente vs referentes geográficos">
                    Desviación por Componentes
                  </CardTitle>
                  <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>Asignatura:</span>
                      <select value={compNAsigFilter} onChange={e=>setCompNAsigFilter(e.target.value)}
                        style={{padding:'6px 10px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                          fontFamily:'Inter', fontSize:12, color:C.text, background:C.white, outline:'none', cursor:'pointer'}}>
                        {asignaturas.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    {compNAsigFilter !== 'Todas' && (
                      <div style={{display:'flex', gap:0, borderRadius:6, overflow:'hidden', border:'1px solid #E5E7EB'}}>
                        {['bars','radar'].map(v => (
                          <button key={v} onClick={() => setCompDesviacionView(v)}
                            style={{padding:'5px 12px', fontSize:11, fontFamily:'Inter', cursor:'pointer', border:'none',
                              background: compDesviacionView===v ? '#1E3A5F' : 'white',
                              color: compDesviacionView===v ? 'white' : '#6B7280', fontWeight: compDesviacionView===v ? 700 : 400}}>
                            {v==='bars' ? 'Barras' : 'Radar'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {filas.length > 0 && compNAsigFilter === 'Todas' && (
                  <div style={{display:'flex', alignItems:'center', justifyContent:'center',
                    height:120, background:C.bg2, borderRadius:10, marginBottom:24,
                    color:C.gray, fontFamily:'Inter', fontSize:13, gap:8}}>
                    <span style={{fontSize:20}}>📊</span>
                    Selecciona una asignatura para ver la gráfica de componentes
                  </div>
                )}

                {filas.length > 0 && compNAsigFilter !== 'Todas' && (() => {
                  const SCOPES = [
                    {sfx:'nac',  color:'#2563EB', label:'Nacional',     promKey:'nac_prom',    desvKey:'nac_desv'},
                    {sfx:'reg',  color:'#059669', label:regionNombre,  promKey:'reg_prom',    desvKey:'reg_desv'},
                    {sfx:'dpto', color:'#7C3AED', label:dptoNombre,   promKey:'dpto_prom',   desvKey:'dpto_desv'},
                    {sfx:'ciu',  color:'#06B6D4', label:ciudadNombre, promKey:'ciudad_prom', desvKey:'ciudad_desv'},
                    {sfx:'pln',  color:'#1E3A5F', label:'Plantel',    promKey:'plantel_prom',desvKey:'plantel_desv'},
                  ]
                  const clamp = v => Math.max(0, Math.min(100, Math.round(v)))
                  const chartData = filas.map(r => {
                    const entry = { name: r.componente }
                    SCOPES.forEach(({sfx, promKey, desvKey}) => {
                      const prom = r[promKey], desv = r[desvKey]
                      if (prom == null) { entry[`${sfx}_base`]=0; entry[`${sfx}_rng`]=0; entry[`${sfx}_lo`]=null; entry[`${sfx}_hi`]=null }
                      else if (desv == null) { entry[`${sfx}_base`]=0; entry[`${sfx}_rng`]=clamp(prom); entry[`${sfx}_lo`]=null; entry[`${sfx}_hi`]=clamp(prom) }
                      else { const lo=clamp(prom-desv),hi=clamp(prom+desv); entry[`${sfx}_base`]=lo; entry[`${sfx}_rng`]=hi-lo; entry[`${sfx}_lo`]=lo; entry[`${sfx}_hi`]=hi }
                    })
                    return entry
                  })
                  const XTick = ({x,y,payload}) => {
                    const words=(payload.value||'').split(' '), mid=Math.ceil(words.length/2)
                    return <g transform={`translate(${x},${y+4})`}><text textAnchor="middle" fontFamily="Inter" fontSize={11} fill={C.gray}><tspan x={0} dy={10}>{words.slice(0,mid).join(' ')}</tspan>{words.slice(mid).join(' ')&&<tspan x={0} dy={14}>{words.slice(mid).join(' ')}</tspan>}</text></g>
                  }
                  const radarDataComp = filas.map(r => {
                    const entry = { name: r.componente }
                    SCOPES.forEach(({sfx, promKey}) => { entry[sfx] = r[promKey] != null ? Math.round(r[promKey]) : 0 })
                    return entry
                  })
                  return compDesviacionView === 'radar' ? (
                    <div style={{marginBottom:28}}>
                      <ResponsiveContainer width="100%" height={400}>
                        <RadarChart data={radarDataComp} margin={{top:16, right:40, bottom:16, left:40}}>
                          <PolarGrid stroke={C.bg2}/>
                          <PolarAngleAxis dataKey="name" tick={{fontSize:11, fontFamily:'Inter', fill:C.gray}}/>
                          {SCOPES.map(({sfx, color, label:lbl}) => (
                            <Radar key={sfx} name={lbl} dataKey={sfx} stroke={color} fill={color} fillOpacity={0.1} dot={false}/>
                          ))}
                          <Legend wrapperStyle={{fontFamily:'Inter', fontSize:12}}
                            formatter={(val) => { const s = SCOPES.find(x => x.label === val); return <span style={{color: s ? s.color : C.dark}}>{val}</span> }}/>
                          <Tooltip contentStyle={{fontFamily:'Inter', fontSize:11, borderRadius:8}}/>
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div style={{marginBottom:28, overflowX:'auto'}}>
                      <div style={{minWidth:Math.max(560,filas.length*170)}}>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={chartData} barCategoryGap="30%" barGap={2} margin={{top:24,right:16,bottom:20,left:4}}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} vertical={false}/>
                            <XAxis dataKey="name" tick={<XTick/>} interval={0} height={52}/>
                            <YAxis tick={{fontSize:10,fontFamily:'Inter',fill:C.gray}} domain={[0,100]} width={28}/>
                            <Tooltip contentStyle={{fontFamily:'Inter',fontSize:11,borderRadius:8,border:`1px solid ${C.grayLt}`}}/>
                            <Legend wrapperStyle={{fontFamily:'Inter',fontSize:12,paddingTop:6}}/>
                            {SCOPES.map(({sfx,color,label:lbl}) => [
                              <Bar key={`${sfx}_base`} dataKey={`${sfx}_base`} stackId={sfx} fill="transparent" legendType="none" isAnimationActive={false}/>,
                              <Bar key={`${sfx}_rng`} dataKey={`${sfx}_rng`} stackId={sfx} fill={color} radius={[3,3,0,0]} name={lbl} maxBarSize={36} isAnimationActive={false}>
                                <LabelList dataKey={`${sfx}_hi`} position="insideTop" style={{fontSize:9,fontFamily:'Inter',fill:'white',fontWeight:700}} formatter={v=>v!=null?v:''}/>
                                <LabelList dataKey={`${sfx}_lo`} position="insideBottom" style={{fontSize:9,fontFamily:'Inter',fill:'white',fontWeight:700}} formatter={v=>v!=null?v:''}/>
                              </Bar>
                            ])}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p style={{fontFamily:'Inter',fontSize:10,color:C.gray,textAlign:'center',marginTop:4}}>
                        Cada barra muestra el rango promedio ± desviación estándar del grupo.
                      </p>
                    </div>
                  )
                })()}

                {/* Tabla */}
                {filas.length === 0 ? (
                  <div style={{textAlign:'center',padding:40,color:C.gray,fontFamily:'Inter',fontSize:13}}>Sin datos de componentes para esta asignatura.</div>
                ) : (
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'Inter',fontSize:12}}>
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{padding:'8px 10px',textAlign:'left',background:'#1E3A5F',color:'white',fontSize:11,fontWeight:700,borderRight:'1px solid rgba(255,255,255,0.1)'}}>Materia</th>
                          <th rowSpan={2} style={{padding:'8px 10px',textAlign:'left',background:'#1E3A5F',color:'white',fontSize:11,fontWeight:700,borderRight:'2px solid rgba(255,255,255,0.2)'}}>Componente</th>
                          <ColHeader label="Colombia"/>
                          <ColHeader label="Región"/>
                          <ColHeader label={dptoNombre}/>
                          <ColHeader label={ciudadNombre}/>
                          <ColHeader label="Plantel" sub="(este colegio)"/>
                        </tr>
                        <tr>
                          {['nac','reg','dpto','ciudad','plantel'].map(s => [
                            <th key={`${s}p`} style={{padding:'6px 8px',textAlign:'center',background:'#263f5a',color:'rgba(255,255,255,0.85)',fontSize:10,fontWeight:600}}>Prom</th>,
                            <th key={`${s}d`} style={{padding:'6px 8px',textAlign:'center',background:'#263f5a',color:'rgba(255,255,255,0.85)',fontSize:10,fontWeight:600,borderRight:'2px solid rgba(255,255,255,0.15)'}}>Desv</th>,
                          ])}
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((r,i) => {
                          const promVal = r.plantel_prom
                          return (
                            <tr key={i} style={{background:i%2===0?C.white:C.bg2,borderBottom:`1px solid ${C.bg2}`}}>
                              <td style={{padding:'7px 10px',color:C.dark,fontWeight:500,borderRight:`1px solid ${C.bg2}`}}>{r.materia}</td>
                              <td style={{padding:'7px 10px',color:C.text,borderRight:`2px solid ${C.bg2}`}}>{r.componente}</td>
                              {[
                                [r.nac_prom,r.nac_desv],[r.reg_prom,r.reg_desv],
                                [r.dpto_prom,r.dpto_desv],[r.ciudad_prom,r.ciudad_desv],
                              ].map(([p,d],j) => [
                                <td key={`p${j}`} style={{padding:'7px 8px',textAlign:'center',color:C.gray}}>{fmtVal(p)}</td>,
                                <td key={`d${j}`} style={{padding:'7px 8px',textAlign:'center',color:C.gray,borderRight:`2px solid ${C.bg2}`}}>{fmtVal(d)}</td>,
                              ])}
                              <td style={{padding:'7px 8px',textAlign:'center',fontWeight:700,
                                background:promVal!=null?semaforoBg(promVal,'_'):'transparent',
                                color:promVal!=null?semaforoColor(promVal,'_'):C.gray}}>
                                {fmtVal(promVal)}
                              </td>
                              <td style={{padding:'7px 8px',textAlign:'center',color:C.gray}}>{fmtVal(r.plantel_desv)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )
        })()}

        {/* ══ NOTAS ESTUDIANTES POR COMPONENTES ════════════════ */}
        {tab==='comp_notas' && (() => {
          const estMap = {}
          allStudents.forEach(s => { if (s.estudiantes) estMap[s.estudiante_id] = s.estudiantes })
          const asignaturas = ['Todas', ...new Set(notasCompN.map(r => r.materia))]
          const filasBaseN = notasCompN.filter(r => {
            const est = estMap[r.estudiante_id]
            if (!est) return false
            if (selectedGrado !== 'Todos' && String(est.grado) !== selectedGrado) return false
            if (selectedSalon !== 'Todos' && String(est.salon) !== selectedSalon) return false
            if (notasCompNAsig !== 'Todas' && r.materia !== notasCompNAsig) return false
            return true
          })
          const handleSortCompN = col => setNotasCompNSort(s => ({col, dir: s.col===col && s.dir==='asc' ? 'desc' : 'asc'}))
          const arrowCompN = col => notasCompNSort.col===col ? (notasCompNSort.dir==='asc' ? ' ▲' : ' ▼') : ' ⇅'
          const filas = [...filasBaseN].sort((a, b) => {
            const est_a = estMap[a.estudiante_id] || {}
            const est_b = estMap[b.estudiante_id] || {}
            const v = notasCompNSort.col
            const av = v==='nombre' ? (est_a.nombre||'') : v==='grado' ? (est_a.grado||0) : v==='salon' ? (est_a.salon||0) : v==='nota' ? (a.nota||0) : v==='preguntas' ? (a.preguntas||0) : v==='materia' ? (a.materia||'') : (a.componente||'')
            const bv = v==='nombre' ? (est_b.nombre||'') : v==='grado' ? (est_b.grado||0) : v==='salon' ? (est_b.salon||0) : v==='nota' ? (b.nota||0) : v==='preguntas' ? (b.preguntas||0) : v==='materia' ? (b.materia||'') : (b.componente||'')
            const cmp = typeof av==='string' ? av.localeCompare(bv) : av - bv
            return notasCompNSort.dir==='asc' ? cmp : -cmp
          })
          const thSt = {padding:'8px 10px',textAlign:'left',background:'#1E3A5F',color:'white',fontSize:11,fontWeight:700,whiteSpace:'nowrap',borderBottom:'1px solid rgba(255,255,255,0.15)',cursor:'pointer',userSelect:'none'}
          const thNum = {...thSt, textAlign:'center'}
          return students.length === 0 ? <EmptyState/> : (
            <Card>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:20}}>
                <CardTitle sub={`${filas.length} registros`}>Notas Estudiantes por Componentes</CardTitle>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:11,color:C.gray,fontFamily:'Inter'}}>Materia:</span>
                  <select value={notasCompNAsig} onChange={e=>setNotasCompNAsig(e.target.value)}
                    style={{padding:'6px 10px',border:`1px solid ${C.grayLt}`,borderRadius:6,fontFamily:'Inter',fontSize:12,color:C.text,background:C.white,outline:'none',cursor:'pointer'}}>
                    {asignaturas.map(a=><option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              {filas.length === 0 ? (
                <div style={{textAlign:'center',padding:40,color:C.gray,fontFamily:'Inter',fontSize:13}}>Sin datos para los filtros seleccionados.</div>
              ) : (
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'Inter',fontSize:12}}>
                    <thead>
                      <tr>
                        <th style={thSt} onClick={() => handleSortCompN('nombre')}>Estudiante{arrowCompN('nombre')}</th>
                        <th style={thNum} onClick={() => handleSortCompN('grado')}>Grado{arrowCompN('grado')}</th>
                        <th style={thNum} onClick={() => handleSortCompN('salon')}>Salón{arrowCompN('salon')}</th>
                        <th style={thSt} onClick={() => handleSortCompN('materia')}>Materia{arrowCompN('materia')}</th>
                        <th style={thSt} onClick={() => handleSortCompN('componente')}>Componente{arrowCompN('componente')}</th>
                        <th style={thNum} onClick={() => handleSortCompN('nota')}>Nota{arrowCompN('nota')}</th>
                        <th style={thNum} onClick={() => handleSortCompN('preguntas')}>Preguntas{arrowCompN('preguntas')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((r,i) => {
                        const est = estMap[r.estudiante_id] || {}
                        const nota = r.nota!=null ? Math.round(r.nota*100)/100 : null
                        const bg = nota!=null ? semaforoBg(nota,'_') : C.bg2
                        const fg = nota!=null ? semaforoColor(nota,'_') : C.gray
                        return (
                          <tr key={i} style={{background:i%2===0?C.white:C.bg2,borderBottom:`1px solid ${C.bg2}`}}>
                            <td style={{padding:'7px 10px',color:C.dark,fontWeight:500}}>{est.nombre||'—'}</td>
                            <td style={{padding:'7px 10px',textAlign:'center',color:C.gray}}>{est.grado??'—'}</td>
                            <td style={{padding:'7px 10px',textAlign:'center',color:C.gray}}>{est.salon??'—'}</td>
                            <td style={{padding:'7px 10px',color:C.text}}>{r.materia}</td>
                            <td style={{padding:'7px 10px',color:C.text}}>{r.componente}</td>
                            <td style={{padding:'7px 10px',textAlign:'center'}}>
                              <span style={{display:'inline-block',minWidth:52,padding:'2px 8px',borderRadius:20,background:bg,color:fg,fontWeight:700,fontSize:12}}>
                                {nota!=null?nota.toFixed(2):'—'}
                              </span>
                            </td>
                            <td style={{padding:'7px 10px',textAlign:'center',color:C.gray}}>{r.preguntas??'—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )
        })()}

        {/* ══ COMP OPORTUNIDADES ═══════════════════════════════ */}
        {tab==='comp_mejora' && (() => {
          // Mapeo materia → área desde el Excel (detección dinámica de columnas)
          const matAreaMap = {}
          const rawRows = selectedPrueba?.estructura_excel?.raw || []
          const rawHdr0 = rawRows[0] || []
          const hFind0 = k => rawHdr0.findIndex(h => typeof h === 'string' && h.toLowerCase().trim().startsWith(k))
          const iAreaCol  = hFind0('área') >= 0 ? hFind0('área') : hFind0('area') >= 0 ? hFind0('area') : 2
          const iMatCol   = hFind0('asignatura') >= 0 ? hFind0('asignatura') : hFind0('materia') >= 0 ? hFind0('materia') : 3
          rawRows.slice(1).forEach(f => {
            if (!f || !Array.isArray(f)) return
            const nro = f[1]
            if (nro === '' || nro === null || nro === undefined || isNaN(Number(nro))) return
            const area = (f[iAreaCol] || '').toString().trim()
            const mat  = (f[iMatCol]  || '').toString().trim()
            if (area && mat) matAreaMap[mat] = area
          })

          const todasAreas = [...new Set(Object.values(matAreaMap))]
          const areaActual = todasAreas.includes(compMejoraArea) ? compMejoraArea : (todasAreas[0] || '')

          const todasAsigs = [...new Set(compNGestion.map(r => r.materia))]
          const asigsFiltradas = todasAsigs.filter(m => matAreaMap[m] === areaActual)
          const asigActual = (compMejoraAsig === 'Todas' || !asigsFiltradas.includes(compMejoraAsig))
            ? 'Todas'
            : compMejoraAsig

          // Límite: máximo nac_prom del área para que ningún umbral supere 100
          const compRowsArea = compNGestion.filter(r => asigsFiltradas.includes(r.materia))
          const maxNacProm = compRowsArea.length > 0 ? Math.max(...compRowsArea.map(r => r.nac_prom || 0)) : 0
          const maxLimite = Math.floor((100 - maxNacProm) / 5) * 5
          const limites = []
          for (let v = 0; v <= maxLimite; v += 5) limites.push(v)
          const limiteActual = Math.min(compMejoraLimite, maxLimite)

          // Filas
          const filteredIdsN = new Set(students.map(s => s.estudiante_id))
          const notasCompNFiltradas = notasCompN.filter(r => filteredIdsN.has(r.estudiante_id))

          const materiasFicha = asigActual === 'Todas' ? asigsFiltradas : [asigActual]
          const filasBase = compNGestion
            .filter(r => materiasFicha.includes(r.materia))
            .map(r => {
              const umbral = (r.nac_prom || 0) + limiteActual
              const notasDeComp = notasCompNFiltradas.filter(n => n.materia === r.materia && n.componente === r.componente)
              const total = notasDeComp.length
              const encima = notasDeComp.filter(n => n.nota > umbral).length
              const debajo = total - encima
              const pctEncima = total > 0 ? Math.round((encima / total) * 100) : 0
              const pctDebajo = total > 0 ? Math.round((debajo / total) * 100) : 0
              return { materia: r.materia, componente: r.componente, nacProm: r.nac_prom || 0, umbral, total, encima, debajo, pctEncima, pctDebajo }
            })

          const filas = [...filasBase].sort((a, b) => {
            const v = compMejoraSort.col
            const av = typeof a[v] === 'string' ? a[v].localeCompare(b[v]) : a[v] - b[v]
            return compMejoraSort.dir === 'asc' ? av : -av
          })

          const handleSort = col => setCompMejoraSort(s =>
            s.col === col ? {col, dir: s.dir === 'asc' ? 'desc' : 'asc'} : {col, dir: 'desc'}
          )
          const arrow = col => compMejoraSort.col === col ? (compMejoraSort.dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'

          const selStyle = {padding:'6px 10px', border:`1px solid ${C.grayLt}`, borderRadius:6,
            fontFamily:'Inter', fontSize:12, color:C.text, background:C.white, outline:'none', cursor:'pointer'}
          const thBase = {padding:'8px 12px', background:'#1E3A5F', color:'white', fontSize:11,
            fontWeight:700, whiteSpace:'nowrap', borderBottom:'1px solid rgba(255,255,255,0.15)',
            cursor:'pointer', userSelect:'none'}
          const thSt  = {...thBase, textAlign:'left'}
          const thNum = {...thBase, textAlign:'center'}

          return students.length === 0 ? <EmptyState/> : (
            <Card>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start',
                flexWrap:'wrap', gap:12, marginBottom:20}}>
                <CardTitle sub={`${filas.length} componentes · Umbral = Prom. Nacional + Límite`}>
                  Oportunidad de Mejoramiento
                </CardTitle>
                <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>Área:</span>
                    <select value={areaActual} onChange={e => { setCompMejoraArea(e.target.value); setCompMejoraAsig('Todas') }} style={selStyle}>
                      {todasAreas.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>Asignatura:</span>
                    <select value={asigActual} onChange={e => setCompMejoraAsig(e.target.value)} style={selStyle}>
                      <option value="Todas">Todas</option>
                      {asigsFiltradas.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>Límite:</span>
                    <select value={limiteActual} onChange={e => setCompMejoraLimite(Number(e.target.value))} style={selStyle}>
                      {limites.map(v => <option key={v} value={v}>{v === 0 ? '0' : `+${v}`}</option>)}
                    </select>
                  </div>
                  <div style={{display:'flex', gap:0, borderRadius:6, overflow:'hidden', border:'1px solid #E5E7EB'}}>
                    {['table','scatter'].map(v => (
                      <button key={v} onClick={() => setCompMejoraView(v)}
                        style={{padding:'5px 12px', fontSize:11, fontFamily:'Inter', cursor:'pointer', border:'none',
                          background: compMejoraView===v ? '#1E3A5F' : 'white',
                          color: compMejoraView===v ? 'white' : '#6B7280', fontWeight: compMejoraView===v ? 700 : 400}}>
                        {v==='table' ? 'Tabla' : 'Gráfico'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filas.length === 0 ? (
                <div style={{textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter', fontSize:13}}>
                  Sin datos para los filtros seleccionados.
                </div>
              ) : compMejoraView === 'scatter' ? (() => {
                const scatterDataComp = filas.map(f => ({x: f.nacProm, y: f.pctDebajo, nombre: f.componente || f.materia}))
                const avgPctDebajoComp = filas.length > 0 ? filas.reduce((a,b) => a + b.pctDebajo, 0) / filas.length : 0
                const ScatterTooltipComp = ({active, payload}) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload || {}
                  return (
                    <div style={{background:'white', border:`1px solid ${C.grayLt}`, borderRadius:8,
                      padding:'10px 14px', fontFamily:'Inter', fontSize:11, boxShadow:'0 4px 12px rgba(0,0,0,0.12)'}}>
                      <div style={{fontWeight:700, marginBottom:4, fontSize:12, color:C.navy}}>{d.nombre}</div>
                      <div style={{color:C.gray}}>Prom. Nacional: <strong style={{color:C.navy}}>{d.x?.toFixed(1)}</strong></div>
                      <div style={{color:C.gray}}>% bajo umbral: <strong style={{color:C.red}}>{d.y}%</strong></div>
                    </div>
                  )
                }
                return (
                  <ResponsiveContainer width="100%" height={380}>
                    <ScatterChart margin={{top:20, right:30, bottom:40, left:20}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.bg2}/>
                      <XAxis type="number" dataKey="x" domain={[0,100]} name="Promedio Nacional"
                        label={{value:'Promedio Nacional', position:'insideBottom', offset:-10, fontFamily:'Inter', fontSize:11, fill:C.gray}}
                        tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}}/>
                      <YAxis type="number" dataKey="y" domain={[0,100]} name="% bajo el umbral"
                        label={{value:'% bajo el umbral', angle:-90, position:'insideLeft', offset:10, fontFamily:'Inter', fontSize:11, fill:C.gray}}
                        tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}}/>
                      <ZAxis range={[40,200]}/>
                      <Tooltip content={<ScatterTooltipComp/>}/>
                      <ReferenceLine y={avgPctDebajoComp} strokeDasharray="4 2" stroke="red"
                        label={{value:`Prom: ${Math.round(avgPctDebajoComp)}%`, position:'insideTopRight', fontFamily:'Inter', fontSize:10, fill:'red'}}/>
                      <Scatter data={scatterDataComp} fill="#2563EB" opacity={0.8}/>
                    </ScatterChart>
                  </ResponsiveContainer>
                )
              })() : (
                <>
                  <div style={{display:'flex', gap:20, marginBottom:14, flexWrap:'wrap'}}>
                    <div style={{display:'flex', alignItems:'center', gap:6, fontFamily:'Inter', fontSize:11, color:C.gray}}>
                      <span style={{width:12, height:12, borderRadius:2, background:C.red, display:'inline-block'}}/>
                      Por debajo del umbral
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:6, fontFamily:'Inter', fontSize:11, color:C.gray}}>
                      <span style={{width:12, height:12, borderRadius:2, background:C.green, display:'inline-block'}}/>
                      Por encima del umbral
                    </div>
                    <div style={{fontFamily:'Inter', fontSize:11, color:C.gray, marginLeft:'auto'}}>
                      Clic en encabezado para ordenar
                    </div>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter', fontSize:12}}>
                      <thead>
                        <tr>
                          {asigActual === 'Todas' && (
                            <th style={thSt} onClick={() => handleSort('materia')}>
                              Asignatura{arrow('materia')}
                            </th>
                          )}
                          <th style={thSt} onClick={() => handleSort('componente')}>
                            Componente{arrow('componente')}
                          </th>
                          <th style={thNum} onClick={() => handleSort('nacProm')}>
                            Prom. Nacional{arrow('nacProm')}
                          </th>
                          <th style={thNum} onClick={() => handleSort('umbral')}>
                            Umbral{arrow('umbral')}
                          </th>
                          <th style={thNum} onClick={() => handleSort('total')}>
                            Estudiantes{arrow('total')}
                          </th>
                          <th style={thNum} onClick={() => handleSort('pctDebajo')}>
                            % Por debajo{arrow('pctDebajo')}
                          </th>
                          <th style={thNum} onClick={() => handleSort('pctEncima')}>
                            % Por encima{arrow('pctEncima')}
                          </th>
                          <th style={{...thSt, minWidth:140, cursor:'default'}}>Distribución</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((f, i) => (
                          <tr key={i} style={{background: i%2===0 ? C.white : C.bg2, borderBottom:`1px solid ${C.bg2}`}}>
                            {asigActual === 'Todas' && (
                              <td style={{padding:'8px 12px', color:C.gray, fontSize:11}}>{f.materia}</td>
                            )}
                            <td style={{padding:'8px 12px', color:C.dark, fontWeight:500, maxWidth:280}}>
                              {f.componente}
                            </td>
                            <td style={{padding:'8px 12px', textAlign:'center', color:C.gray}}>
                              {f.nacProm.toFixed(1)}
                            </td>
                            <td style={{padding:'8px 12px', textAlign:'center'}}>
                              <span style={{fontWeight:700, color:C.navy}}>{f.umbral.toFixed(1)}</span>
                            </td>
                            <td style={{padding:'8px 12px', textAlign:'center', color:C.gray}}>
                              {f.total}
                            </td>
                            <td style={{padding:'8px 12px', textAlign:'center'}}>
                              <span style={{display:'inline-block', minWidth:52, padding:'2px 8px', borderRadius:20,
                                background: f.pctDebajo >= 60 ? `${C.red}22` : f.pctDebajo >= 40 ? '#FEF3C722' : `${C.green}18`,
                                color: f.pctDebajo >= 60 ? C.red : f.pctDebajo >= 40 ? '#D97706' : C.green,
                                fontWeight:700}}>
                                {f.pctDebajo}%
                              </span>
                            </td>
                            <td style={{padding:'8px 12px', textAlign:'center'}}>
                              <span style={{display:'inline-block', minWidth:52, padding:'2px 8px', borderRadius:20,
                                background: f.pctEncima >= 60 ? `${C.green}18` : f.pctEncima >= 40 ? '#FEF3C722' : `${C.red}22`,
                                color: f.pctEncima >= 60 ? C.green : f.pctEncima >= 40 ? '#D97706' : C.red,
                                fontWeight:700}}>
                                {f.pctEncima}%
                              </span>
                            </td>
                            <td style={{padding:'8px 12px'}}>
                              <div style={{display:'flex', height:18, borderRadius:4, overflow:'hidden', background:C.bg2, minWidth:120}}>
                                {f.total > 0 && (
                                  <>
                                    <div style={{width:`${f.pctDebajo}%`, background:C.red, transition:'width 0.3s'}}/>
                                    <div style={{width:`${f.pctEncima}%`, background:C.green, transition:'width 0.3s'}}/>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
          )
        })()}

        {/* ══ PRÓXIMAMENTE ══════════════════════════════════════ */}
        {['comp_comparativo','comp_comp2'].includes(tab) && (
          <Card>
            <div style={{textAlign:'center', padding:60, display:'flex', flexDirection:'column', alignItems:'center', gap:16}}>
              <div style={{fontSize:48}}>🚧</div>
              <div style={{fontFamily:'Playfair Display, serif', fontSize:20, color:C.navy}}>Próximamente</div>
              <div style={{fontFamily:'Inter', fontSize:13, color:C.gray, maxWidth:360}}>
                Este módulo está en construcción. Estará disponible muy pronto.
              </div>
            </div>
          </Card>
        )}

        {/* ══ CONSOLIDADO DE RESPUESTAS ════════════════════════ */}
        {tab==='consolidado' && (() => {
          if (!students.length) return (
            <Card><EmptyState msg="No hay resultados cargados para esta prueba."/></Card>
          )

          // Lookup sesión por nro_pregunta desde analisis_preguntas
          const sesionMap = {}
          detallePreguntas.forEach(q => { sesionMap[q.nro_pregunta] = q.sesion })

          // Agregar respuestas por pregunta desde detalle de cada estudiante
          const OPTS = ['A','B','C','D','E','F','G','H']
          const byQ = {}
          students.forEach(s => {
            if (!s.detalle || !Array.isArray(s.detalle)) return
            s.detalle.forEach(d => {
              const nro = d.pregunta
              if (!byQ[nro]) {
                byQ[nro] = {
                  nro,
                  sesion: sesionMap[nro] ?? '—',
                  area: d.area || '',
                  materia: d.asignatura || '',
                  correcta: (d.correcta || '').toUpperCase().trim(),
                  counts: {A:0,B:0,C:0,D:0,E:0,F:0,G:0,H:0},
                  x: 0, evaluados: 0, aciertos: 0,
                }
              }
              const marcada = (d.marcada || '').toUpperCase().trim()
              byQ[nro].evaluados++
              if (d.correcto) byQ[nro].aciertos++
              if (OPTS.includes(marcada)) byQ[nro].counts[marcada]++
              else byQ[nro].x++
            })
          })

          const filas = Object.values(byQ)
            .sort((a,b) => a.sesion - b.sesion || a.nro - b.nro)

          // Filtro por área
          const areas = ['Todas', ...new Set(filas.map(f => f.area).filter(Boolean))]
          const filasFil = consolidadoArea === 'Todas' ? filas : filas.filter(f => f.area === consolidadoArea)

          if (!filas.length) return (
            <Card><EmptyState msg="Los resultados no tienen detalle de respuestas por pregunta."/></Card>
          )

          const thS = {padding:'7px 6px', background:C.navy, color:C.white, fontSize:10,
            fontWeight:700, textAlign:'center', fontFamily:'Inter', whiteSpace:'nowrap',
            borderRight:'1px solid rgba(255,255,255,0.12)'}
          const tdS = (bg) => ({padding:'6px 5px', fontSize:11, textAlign:'center',
            borderBottom:`1px solid ${C.bg2}`, background: bg || 'transparent',
            fontFamily:'Inter'})
          const pctColor = v => v >= 70 ? '#16A34A' : v >= 45 ? '#D97706' : '#DC2626'

          return (
            <Card>
              <CardTitle sub={`${filasFil.length} preguntas · ${students.length} estudiante(s)`}>
                Consolidado de Respuestas
              </CardTitle>

              {/* Filtro área */}
              {areas.length > 2 && (
                <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center'}}>
                  <span style={{fontSize:11, fontWeight:600, color:C.gray, fontFamily:'Inter',
                    textTransform:'uppercase', letterSpacing:'0.06em'}}>Área:</span>
                  {areas.map(a => (
                    <button key={a} onClick={() => setConsolidadoArea(a)}
                      style={{padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer',
                        fontFamily:'Inter', fontSize:12, fontWeight:600,
                        background: consolidadoArea===a ? C.navy : C.bg2,
                        color: consolidadoArea===a ? C.white : C.text}}>
                      {a}
                    </button>
                  ))}
                </div>
              )}

              <div style={{overflowX:'auto', borderRadius:10, border:`1px solid ${C.grayLt}`,
                boxShadow:'0 2px 8px rgba(0,0,0,0.05)'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:11, fontFamily:'Inter'}}>
                  <thead>
                    <tr>
                      {['Ses.','Nro','Área','Materia','Correcta',
                        'A','B','C','D','E','F','G','H','X',
                        'Evaluados','% Acierto','% Desacierto','% Mal Marc.'].map(h => (
                        <th key={h} style={{...thS,
                          textAlign: ['Área','Materia'].includes(h) ? 'left' : 'center',
                          paddingLeft: ['Área','Materia'].includes(h) ? 10 : undefined}}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filasFil.map((f, i) => {
                      const rowBg = i%2===0 ? C.white : '#F8FAFC'
                      const pctAc = f.evaluados ? Math.round(f.aciertos/f.evaluados*100) : 0
                      const pctDes = 100 - pctAc
                      const pctMal = f.evaluados ? Math.round(f.x/f.evaluados*100) : 0
                      return (
                        <tr key={f.nro}>
                          <td style={tdS(rowBg)}>{f.sesion}</td>
                          <td style={{...tdS(rowBg), fontWeight:700, color:C.navy}}>{f.nro}</td>
                          <td style={{...tdS(rowBg), textAlign:'left', paddingLeft:10,
                            whiteSpace:'nowrap', maxWidth:140, overflow:'hidden',
                            textOverflow:'ellipsis'}}>{f.area}</td>
                          <td style={{...tdS(rowBg), textAlign:'left', paddingLeft:10,
                            whiteSpace:'nowrap', maxWidth:160, overflow:'hidden',
                            textOverflow:'ellipsis'}}>{f.materia}</td>
                          {/* Correcta */}
                          <td style={{...tdS('#DCFCE7'), fontWeight:800, color:'#16A34A',
                            fontSize:13}}>{f.correcta||'—'}</td>
                          {/* A-H counts — resalta la correcta */}
                          {OPTS.map(op => {
                            const cnt = f.counts[op] || 0
                            const isCorrect = op === f.correcta
                            return (
                              <td key={op} style={{...tdS(isCorrect ? '#DCFCE7' : rowBg),
                                fontWeight: cnt>0 ? 700 : 400,
                                color: isCorrect ? '#16A34A' : cnt>0 ? C.dark : '#CBD5E1'}}>
                                {cnt > 0 ? cnt : '·'}
                              </td>
                            )
                          })}
                          {/* X */}
                          <td style={{...tdS(rowBg),
                            color: f.x>0 ? '#DC2626' : '#CBD5E1',
                            fontWeight: f.x>0 ? 700 : 400}}>
                            {f.x>0 ? f.x : '·'}
                          </td>
                          {/* Evaluados */}
                          <td style={{...tdS(rowBg), fontWeight:600, color:C.navy}}>
                            {f.evaluados}
                          </td>
                          {/* % Acierto */}
                          <td style={{...tdS(rowBg), fontWeight:700, color:pctColor(pctAc)}}>
                            {pctAc}%
                          </td>
                          {/* % Desacierto */}
                          <td style={{...tdS(rowBg), fontWeight:700,
                            color:pctColor(100-pctDes)}}>
                            {pctDes}%
                          </td>
                          {/* % Mal Marcadas */}
                          <td style={{...tdS(rowBg),
                            color: pctMal>0 ? '#DC2626' : '#CBD5E1',
                            fontWeight: pctMal>0 ? 700 : 400}}>
                            {pctMal>0 ? `${pctMal}%` : '·'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        })()}

        {/* ══ EQUILIBRIO DE LA PRUEBA ══════════════════════════ */}
        {tab==='equilibrio' && (() => {
          if (!detallePreguntas.length) return (
            <Card><EmptyState msg="No hay análisis de preguntas cargado para esta prueba."/></Card>
          )

          const NIVELES = ['Bajo','Básico','Alto','Superior']
          const difColor = {'Bajo':'#2563EB','Básico':'#D97706','Alto':'#DC2626','Superior':'#7C3AED'}
          const difBg    = {'Bajo':'#EFF6FF','Básico':'#FFFBEB','Alto':'#FEF2F2','Superior':'#F5F3FF'}
          const difLabel = d => d==='Superior'?'Nivel 4': d==='Alto'?'Nivel 3': d==='Básico'?'Nivel 2': d==='Bajo'?'Nivel 1': d

          const materias = [...new Set(detallePreguntas.map(q => q.materia).filter(Boolean))].sort()
          const matActual = materias.includes(equilibrioMateria) ? equilibrioMateria : (materias[0] || '')

          const qFil = matActual
            ? detallePreguntas.filter(q => q.materia === matActual)
            : detallePreguntas

          const competencias = [...new Set(qFil.map(q => q.competencia).filter(Boolean))].sort()
          const componentes  = [...new Set(qFil.map(q => q.componente).filter(Boolean))].sort()
          const nivelesPres  = NIVELES.filter(d => qFil.some(q => q.dificultad === d))

          // Matriz componente → competencia → nivel → count
          const matriz = {}
          componentes.forEach(comp => {
            matriz[comp] = {}
            competencias.forEach(c => {
              matriz[comp][c] = {}
              nivelesPres.forEach(d => { matriz[comp][c][d] = 0 })
            })
          })
          qFil.forEach(q => {
            if (q.componente && q.competencia && q.dificultad && matriz[q.componente]?.[q.competencia]) {
              matriz[q.componente][q.competencia][q.dificultad] = (matriz[q.componente][q.competencia][q.dificultad] || 0) + 1
            }
          })

          const totalFila   = comp => competencias.reduce((s1,c) => s1 + nivelesPres.reduce((s2,d) => s2 + (matriz[comp]?.[c]?.[d]||0), 0), 0)
          const totalGlobal = componentes.reduce((s, comp) => s + totalFila(comp), 0)
          const totalesCol  = competencias.reduce((acc,c) => {
            acc[c] = {}
            nivelesPres.forEach(d => { acc[c][d] = componentes.reduce((s,comp) => s + (matriz[comp]?.[c]?.[d]||0), 0) })
            return acc
          }, {})

          const thBase = {padding:'10px 8px', background:C.navy, color:C.white, fontSize:11,
            fontWeight:700, textAlign:'center', fontFamily:'Inter'}

          return (
            <Card>
              <CardTitle sub={`${qFil.length} preguntas · ${prueba?.codigo||'—'}`}>
                Equilibrio de la Prueba
              </CardTitle>

              {/* Filtro materia */}
              {materias.length > 1 && (
                <div style={{display:'flex', gap:8, marginBottom:20, flexWrap:'wrap', alignItems:'center'}}>
                  <span style={{fontSize:11, fontWeight:600, color:C.gray, fontFamily:'Inter',
                    textTransform:'uppercase', letterSpacing:'0.06em'}}>Materia:</span>
                  {materias.map(m => (
                    <button key={m} onClick={() => setEquilibrioMateria(m)}
                      style={{padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer',
                        fontFamily:'Inter', fontSize:12, fontWeight:600, transition:'all 0.15s',
                        background: matActual===m ? C.navy : C.bg2,
                        color: matActual===m ? C.white : C.text}}>
                      {m}
                    </button>
                  ))}
                </div>
              )}

              {/* Leyenda */}
              <div style={{display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center'}}>
                {nivelesPres.map(d => (
                  <div key={d} style={{display:'flex', alignItems:'center', gap:6,
                    background:difBg[d], borderRadius:20, padding:'4px 12px',
                    border:`1px solid ${difColor[d]}`}}>
                    <div style={{width:8, height:8, borderRadius:'50%', background:difColor[d]}}/>
                    <span style={{fontSize:12, fontWeight:600, color:difColor[d], fontFamily:'Inter'}}>{difLabel(d)}</span>
                  </div>
                ))}
                <div style={{marginLeft:'auto', fontSize:12, color:C.gray, fontFamily:'Inter'}}>
                  Total: <strong style={{color:C.navy, marginLeft:4}}>{totalGlobal} preguntas</strong>
                </div>
              </div>

              {/* Tabla matriz */}
              <div style={{borderRadius:12, overflowX:'auto', border:`1px solid ${C.grayLt}`,
                boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:'Inter'}}>
                  <thead>
                    {/* Fila 1: competencias agrupadas */}
                    <tr>
                      <th rowSpan={2} style={{...thBase, textAlign:'left', padding:'14px 16px',
                        minWidth:180, borderRight:'2px solid rgba(255,255,255,0.2)', verticalAlign:'middle'}}>
                        Componente
                      </th>
                      {competencias.map(c => (
                        <th key={c} colSpan={nivelesPres.length}
                          style={{...thBase, background:'#1E3A5F',
                            borderRight:'2px solid rgba(255,255,255,0.15)',
                            borderBottom:'1px solid rgba(255,255,255,0.2)'}}>
                          <div style={{maxWidth:nivelesPres.length*70, overflow:'hidden',
                            textOverflow:'ellipsis', whiteSpace:'nowrap', margin:'0 auto'}} title={c}>
                            {c}
                          </div>
                        </th>
                      ))}
                      <th style={{...thBase, background:'#0F2A45', minWidth:60}}>Total</th>
                    </tr>
                    {/* Fila 2: niveles por competencia */}
                    <tr>
                      {competencias.map(c => nivelesPres.map(d => (
                        <th key={`${c}-${d}`} style={{padding:'7px 6px', textAlign:'center',
                          background:difBg[d], color:difColor[d], fontSize:10, fontWeight:700,
                          borderRight:'1px solid #E5E7EB', borderBottom:'2px solid #D1D5DB', minWidth:52}}>
                          {difLabel(d)}
                        </th>
                      )))}
                      <th style={{padding:'7px 6px', background:'#F1F5F9', fontSize:10,
                        fontWeight:700, color:C.gray, textAlign:'center', borderBottom:'2px solid #D1D5DB'}}/>
                    </tr>
                  </thead>
                  <tbody>
                    {componentes.map((comp, ri) => {
                      const tf = totalFila(comp)
                      return (
                        <tr key={comp} style={{background: ri%2===0 ? C.white : '#F8FAFC'}}>
                          <td style={{padding:'11px 16px', fontWeight:600, color:C.navy,
                            borderRight:'2px solid #E5E7EB', borderBottom:'1px solid #F1F5F9',
                            background: ri%2===0 ? '#F8FAFC' : '#EEF2F7'}}>
                            {comp}
                          </td>
                          {competencias.map(c => nivelesPres.map(d => {
                            const val = matriz[comp]?.[c]?.[d] || 0
                            return (
                              <td key={`${c}-${d}`} style={{padding:'11px 6px', textAlign:'center',
                                borderRight:'1px solid #F1F5F9', borderBottom:'1px solid #F1F5F9',
                                fontWeight: val>0 ? 700 : 400,
                                color: val>0 ? difColor[d] : '#CBD5E1',
                                fontSize: val>0 ? 14 : 12}}>
                                {val>0 ? val : '·'}
                              </td>
                            )
                          }))}
                          <td style={{padding:'11px 8px', textAlign:'center', fontWeight:700,
                            color: tf>0 ? C.navy : C.gray, fontSize:13,
                            background: ri%2===0 ? '#EEF2F7' : '#E4EAF2',
                            borderBottom:'1px solid #F1F5F9', borderLeft:'2px solid #E5E7EB'}}>
                            {tf || '·'}
                          </td>
                        </tr>
                      )
                    })}
                    {/* Fila total */}
                    <tr style={{background:'#1E3A5F'}}>
                      <td style={{padding:'12px 16px', fontWeight:700, color:C.white,
                        fontSize:12, borderRight:'2px solid rgba(255,255,255,0.2)'}}>
                        Total General
                      </td>
                      {competencias.map(c => nivelesPres.map(d => {
                        const val = totalesCol[c]?.[d] || 0
                        return (
                          <td key={`tot-${c}-${d}`} style={{padding:'11px 6px', textAlign:'center',
                            fontWeight:700, color: val>0 ? difBg[d] : 'rgba(255,255,255,0.3)',
                            fontSize: val>0 ? 14 : 12}}>
                            {val>0 ? val : '·'}
                          </td>
                        )
                      }))}
                      <td style={{padding:'12px 8px', textAlign:'center', fontWeight:800,
                        color:C.white, fontSize:15, borderLeft:'2px solid rgba(255,255,255,0.2)'}}>
                        {totalGlobal}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )
        })()}

        {/* ══ CARTA DE BIENVENIDA ══════════════════════════════ */}
        {tab==='carta' && (
          <div style={{display:'grid', gap:20}}>
            {/* Header carta */}
            <div style={{background:`linear-gradient(135deg, ${C.navy} 0%, #1A3560 100%)`,
              borderRadius:16, padding:'48px 56px', position:'relative', overflow:'hidden'}}>
              <div style={{position:'absolute', top:-30, right:-30, fontSize:180,
                opacity:0.04, lineHeight:1}}>✦</div>
              <div style={{position:'absolute', bottom:-20, left:-20, fontSize:120,
                opacity:0.04, lineHeight:1}}>✦</div>
              <div style={{fontSize:10, color:'rgba(255,255,255,0.45)', fontFamily:'Inter',
                letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:16}}>
                Portal de Resultados — Milton Ochoa
              </div>
              <div style={{fontSize:32, fontFamily:'Playfair Display, serif', color:C.white,
                fontWeight:400, lineHeight:1.3, marginBottom:8}}>
                Carta de Bienvenida
              </div>
              <div style={{width:48, height:2, background:C.green, marginTop:16}}/>
            </div>

            {/* Cuerpo de la carta */}
            <Card style={{padding:'48px 56px'}}>
              {/* Saludo */}
              <div style={{fontFamily:'Playfair Display, serif', fontSize:18, color:C.navy,
                fontStyle:'italic', marginBottom:32}}>
                Estimada comunidad de <strong style={{fontStyle:'normal'}}>{session?.nombre}</strong>,
              </div>

              {/* Párrafos */}
              {[
                'Es un honor para nosotros recibirlos en el Portal de Resultados de Asesorías Académicas Milton Ochoa.',
                'Cada institución que confía en nosotros representa mucho más que un aliado estratégico — representa una comunidad comprometida con el futuro de Colombia. Ustedes, junto a sus estudiantes y docentes, son protagonistas de una transformación que va más allá de los resultados académicos: están construyendo el país que soñamos.',
                'En Milton Ochoa creemos profundamente que la evaluación es el primer paso hacia la excelencia. No como un juicio, sino como una brújula que orienta, que revela fortalezas y que ilumina el camino por recorrer. Por eso, cada dato que encuentran en este portal no es solo un número — es una oportunidad de crecer.',
                'Nuestro equipo está con ustedes en cada etapa. Detrás de cada reporte, de cada análisis, hay personas comprometidas con su éxito y con el de sus estudiantes. No están solos en este camino.',
                'Gracias por creer en la educación de calidad. Gracias por ser parte de esta misión que nos une:',
              ].map((p, i) => (
                <p key={i} style={{fontFamily:'Inter', fontSize:15, lineHeight:1.9,
                  color:C.gray, marginBottom:20, fontWeight:300}}>{p}</p>
              ))}

              {/* Frase destacada */}
              <div style={{background:C.bg, borderRadius:12, padding:'24px 32px',
                borderLeft:`4px solid ${C.green}`, margin:'8px 0 32px'}}>
                <div style={{fontFamily:'Playfair Display, serif', fontSize:22, color:C.navy,
                  fontStyle:'italic', textAlign:'center'}}>
                  "Inspirar y transformar el mundo."
                </div>
              </div>

              {/* Firma */}
              <div style={{borderTop:`1px solid ${C.bg2}`, paddingTop:32, marginTop:8}}>
                <div style={{fontFamily:'Inter', fontSize:13, color:C.gray,
                  marginBottom:4}}>Con gratitud y compromiso,</div>
                <div style={{fontFamily:'Playfair Display, serif', fontSize:20, color:C.navy,
                  fontWeight:700, marginBottom:4}}>Asesorías Académicas Milton Ochoa</div>
                <div style={{fontFamily:'Inter', fontSize:12, color:C.green,
                  letterSpacing:'0.08em', textTransform:'uppercase'}}>Expertos en Evaluación</div>
              </div>
            </Card>
          </div>
        )}

        {/* ══ LISTADO DE ESTUDIANTES ═══════════════════════════ */}
        {tab==='estudiantes' && (
          <PlantelEstudiantes colegioId={session?.id} />
        )}

        {/* ══ REPORTE DE RESULTADOS ════════════════════════════ */}
        {tab==='resultados' && (
          <PlantelResultados colegioId={session?.id} pruebas={allPruebas} />
        )}

        {/* ══ MENCIÓN DE HONOR ═════════════════════════════════ */}
        {tab==='mencion' && (
          <PlantelMencion colegioId={session?.id} pruebas={allPruebas} />
        )}

        {/* ══ ACOMPAÑAMIENTO ═══════════════════════════════════ */}
        {tab==='acompanamiento' && (
          <Card>
            <div style={{textAlign:'center', padding:60, display:'flex', flexDirection:'column',
              alignItems:'center', gap:16}}>
              <div style={{fontSize:48}}>🤝</div>
              <div style={{fontFamily:'Playfair Display, serif', fontSize:22, color:C.navy}}>
                Acompañamiento
              </div>
              <div style={{fontFamily:'Inter', fontSize:13, color:C.gray, maxWidth:360}}>
                Esta sección estará disponible próximamente.
              </div>
            </div>
          </Card>
        )}

        {/* ══ CONSULTORÍA — RECOMENDACIONES ═══════════════════ */}
        {tab==='recomendaciones' && (
          <RecomendacionesClaude session={session} prueba={prueba}/>
        )}

        {/* ══ CONSULTORÍA — PORTAFOLIO ════════════════════════ */}
        {tab==='portafolio' && (
          <Card>
            <div style={{textAlign:'center', padding:60, display:'flex', flexDirection:'column', alignItems:'center', gap:16}}>
              <div style={{fontSize:48}}>📁</div>
              <div style={{fontFamily:'Playfair Display, serif', fontSize:22, color:C.navy}}>Portafolio</div>
              <div style={{fontFamily:'Inter', fontSize:13, color:C.gray, maxWidth:360}}>Esta sección estará disponible próximamente.</div>
            </div>
          </Card>
        )}

        {/* ══ CONSULTORÍA — VALOR AGREGADO ════════════════════ */}
        {tab==='valor' && (
          <Card>
            <div style={{textAlign:'center', padding:60, display:'flex', flexDirection:'column', alignItems:'center', gap:16}}>
              <div style={{fontSize:48}}>⭐</div>
              <div style={{fontFamily:'Playfair Display, serif', fontSize:22, color:C.navy}}>Valor Agregado</div>
              <div style={{fontFamily:'Inter', fontSize:13, color:C.gray, maxWidth:360}}>Esta sección estará disponible próximamente.</div>
            </div>
          </Card>
        )}

      </main>

      {/* ══ STUDENT DETAIL MODAL ════════════════════════════════ */}
      {selectedStudent && (
        <div
          onClick={() => setSelectedStudent(null)}
          style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
            zIndex:1000, display:'flex', alignItems:'flex-start',
            justifyContent:'center', overflowY:'auto', padding:'24px 16px'}}>
          <div
            onClick={e => e.stopPropagation()}
            style={{background:C.white, borderRadius:10, width:'100%', maxWidth:1100,
              boxShadow:'0 8px 40px rgba(0,0,0,0.22)', fontFamily:'Inter',
              overflow:'hidden', marginBottom:24}}>

            {/* Close button */}
            <div style={{display:'flex', justifyContent:'flex-end', padding:'10px 14px 0',
              background:C.navy}}>
              <button
                onClick={() => setSelectedStudent(null)}
                style={{background:'transparent', border:'none', color:C.white,
                  fontSize:22, cursor:'pointer', lineHeight:1, padding:'2px 6px',
                  borderRadius:4}}>
                ×
              </button>
            </div>

            {/* Header block */}
            <div style={{background:C.navy, color:C.white, padding:'8px 18px 14px',
              fontFamily:'Inter', fontSize:11, lineHeight:1.9}}>
              <div>
                <strong>Código:</strong> {session?.codigo} &nbsp;|&nbsp;
                <strong>Nombre:</strong> {session?.nombre} &nbsp;|&nbsp;
                <strong>Ciudad:</strong> {toTitleCase(session?.municipio)} - {toTitleCase(session?.departamento_nombre)} &nbsp;|&nbsp;
                <strong>Fecha:</strong> {new Date().toLocaleDateString('es-CO', {day:'2-digit', month:'2-digit', year:'numeric'})}
              </div>
              <div>
                <strong>Producto:</strong> {selectedPrueba?.tipo} &nbsp;|&nbsp;
                <strong>Prueba:</strong> {selectedPrueba?.codigo}
              </div>
              <div>
                <strong>Usuario:</strong> {selectedStudent.estudiantes?.usuario || '—'} &nbsp;|&nbsp;
                <strong>Nombre:</strong> {selectedStudent.estudiantes?.nombre || '—'} &nbsp;|&nbsp;
                <strong>Grado:</strong> {selectedStudent.estudiantes?.grado || '—'} &nbsp;|&nbsp;
                <strong>Salón:</strong> {selectedStudent.estudiantes?.salon || '—'} &nbsp;|&nbsp;
                <strong>Est:</strong> {selectedStudent.estudiantes?.codigo || '—'}
              </div>
            </div>

            {/* Detail table */}
            <div style={{padding:'16px', overflowX:'auto'}}>
              {loadingDetalle ? (
                <div style={{textAlign:'center', padding:40, color:C.gray, fontSize:13}}>
                  Cargando respuestas…
                </div>
              ) : (() => {
                const rawRows = selectedPrueba?.estructura_excel?.raw || []
                // Detect column indices from header row
                const rawHeader = rawRows[0] || []
                const hIdx = k => rawHeader.findIndex(h => typeof h === 'string' && h.toLowerCase().trim().startsWith(k))
                const iSesion = 0, iNro = 1, iArea = 2, iMateria = 3
                const iEstandar    = hIdx('estándar') >= 0 ? hIdx('estándar') : hIdx('estandar')
                const iCompetencia = hIdx('competencia')
                const iComponente  = hIdx('componente')
                const iTarea       = hIdx('tarea')
                const iRta         = rawHeader.findIndex(h => typeof h === 'string' && ['rta','respuesta correcta','resp. correcta','resp correcta','respuesta'].includes(h.toLowerCase().trim()))
                const questions = rawRows.slice(1).map(f => ({
                  sesion:      (f[iSesion]    || '').toString().trim(),
                  nro:         (f[iNro]       || '').toString().trim(),
                  area:        (f[iArea]      || '').toString().trim(),
                  materia:     (f[iMateria]   || '').toString().trim(),
                  estandar:    iEstandar    >= 0 ? (f[iEstandar]    || '').toString().trim() : '',
                  competencia: iCompetencia >= 0 ? (f[iCompetencia] || '').toString().trim() : '',
                  componente:  iComponente  >= 0 ? (f[iComponente]  || '').toString().trim() : '',
                  tarea:       iTarea       >= 0 ? (f[iTarea]       || '').toString().trim() : '',
                  rta:         iRta         >= 0 ? (f[iRta]         || '').toString().trim() : '',
                })).filter(q => q.nro && !isNaN(Number(q.nro)))

                // Build a map from pregunta number → detalle entry
                const detalleMap = {}
                ;(studentDetalle || []).forEach(d => {
                  detalleMap[String(d.pregunta)] = d
                })

                const thStyle = {padding:'7px 10px', background:C.navy, color:C.white,
                  fontSize:11, fontWeight:600, textAlign:'center', whiteSpace:'nowrap',
                  borderRight:'1px solid rgba(255,255,255,0.12)'}
                const tdStyle = (bg) => ({padding:'5px 8px', fontSize:11, textAlign:'center',
                  borderBottom:`1px solid ${C.bg2}`, background: bg || C.white})

                return (
                  <table style={{borderCollapse:'collapse', fontFamily:'Inter', fontSize:12, width:'100%', minWidth:700}}>
                    <thead>
                      <tr>
                        {['Sesión','No','Área','Asignatura','Componente','Competencia','Tarea','Rta','Est'].map(h => (
                          <th key={h} style={{...thStyle, textAlign: ['Competencia','Componente','Tarea','Asignatura','Área'].includes(h) ? 'left' : 'center'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q, i) => {
                        const d = detalleMap[q.nro]
                        const correcto = d?.correcto
                        const cellBg = correcto === true ? '#DCFCE7' : correcto === false ? '#FEE2E2' : null
                        const cellColor = correcto === true ? C.green : correcto === false ? C.red : C.dark
                        const rowBg = i % 2 === 0 ? C.white : '#F8FAFC'
                        return (
                          <tr key={i}>
                            <td style={tdStyle(rowBg)}>{q.sesion}</td>
                            <td style={tdStyle(rowBg)}>{q.nro}</td>
                            <td style={{...tdStyle(rowBg), textAlign:'left', whiteSpace:'nowrap'}}>{q.area}</td>
                            <td style={{...tdStyle(rowBg), textAlign:'left', whiteSpace:'nowrap'}}>{q.materia}</td>
                            <td style={{...tdStyle(rowBg), textAlign:'left', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{q.componente}</td>
                            <td style={{...tdStyle(rowBg), textAlign:'left', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{q.competencia}</td>
                            <td style={{...tdStyle(rowBg), textAlign:'left', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{q.tarea}</td>
                            <td style={{...tdStyle(cellBg), color:cellColor, fontWeight:700}}>{q.rta || '—'}</td>
                            <td style={{...tdStyle(cellBg), color:cellColor, fontWeight:700}}>{d?.marcada || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ══ % RTA DISTRIBUTION MODAL ════════════════════════════════ */}
      {distribModal && (
        <div onClick={() => setDistribModal(null)}
          style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
            zIndex:1100, display:'flex', alignItems:'flex-start',
            justifyContent:'center', overflowY:'auto', padding:'24px 16px'}}>
          <div onClick={e => e.stopPropagation()}
            style={{background:C.white, borderRadius:12, width:'100%', maxWidth:980,
              boxShadow:'0 8px 40px rgba(0,0,0,0.25)', fontFamily:'Inter',
              overflow:'hidden', marginBottom:24}}>

            {/* Header */}
            <div style={{background:C.navy, padding:'16px 20px', display:'flex',
              justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div style={{color:'rgba(255,255,255,0.7)', fontSize:11, letterSpacing:'0.08em',
                  textTransform:'uppercase', fontWeight:600}}>
                  % de Elección por Opción de Respuesta
                </div>
                <div style={{color:'#fff', fontSize:16, fontFamily:'Playfair Display, serif',
                  fontWeight:700, marginTop:4}}>
                  Pregunta #{distribModal.q.nro_pregunta} · {distribModal.q.materia||'—'}
                  &nbsp;·&nbsp; Correcta:&nbsp;
                  <span style={{color:'#4ADE80'}}>{distribModal.q.respuesta_correcta||'—'}</span>
                </div>
              </div>
              <button onClick={() => setDistribModal(null)}
                style={{background:'rgba(255,255,255,0.15)', border:'none', color:'#fff',
                  width:32, height:32, borderRadius:6, cursor:'pointer', fontSize:18,
                  display:'flex', alignItems:'center', justifyContent:'center'}}>
                ✕
              </button>
            </div>

            <div style={{padding:'20px'}}>
              {distribModal.loading ? (
                <div style={{textAlign:'center', padding:'60px 0', color:C.gray, fontSize:14}}>
                  Calculando distribución...
                </div>
              ) : (() => {
                const { q, data } = distribModal
                const rawRows = selectedPrueba?.estructura_excel?.raw || []
                const rawHeader = rawRows[0] || []
                const iAfirm = rawHeader.findIndex(h => typeof h === 'string' && h.toLowerCase().trim().startsWith('afirm'))
                const iEvid  = rawHeader.findIndex(h => typeof h === 'string' && h.toLowerCase().trim().startsWith('evid'))
                const rawRow = rawRows.slice(1).find(r => r && String(r[1]||'').trim() === String(q.nro_pregunta))

                const OPTS = ['A','B','C','D','E','F','G','H']
                const OPT_COLORS = {
                  A:'#3B82F6', B:'#F97316', C:'#10B981', D:'#EF4444',
                  E:'#8B5CF6', F:'#F59E0B', G:'#06B6D4', H:'#EC4899', X:'#9CA3AF'
                }

                const makeChartData = (scope) => {
                  if (!data?.[scope]) return []
                  const counts = data[scope]
                  const total = Object.values(counts).reduce((s,v) => s + Number(v), 0)
                  if (total === 0) return []
                  return [...OPTS, 'X'].filter(o => counts[o] > 0).map(o => ({
                    op: o,
                    value: Math.round((counts[o] / total) * 100),
                    color: OPT_COLORS[o] || C.gray,
                    isRta: o === q.respuesta_correcta,
                    n: Number(counts[o]),
                  }))
                }

                const scopes = [
                  {key:'plantel', label:'Plantel'},
                  {key:'ciudad', label: data?.ciudad_nombre || 'Ciudad'},
                  {key:'dpto',   label: data?.dpto_nombre   || 'Departamento'},
                  {key:'reg',    label: data?.region_nombre || 'Región'},
                  {key:'nac',    label:'Nacional'},
                ]

                const DonutChart = ({scopeKey, label}) => {
                  const chartData = makeChartData(scopeKey)
                  const total = data?.[scopeKey] ? Object.values(data[scopeKey]).reduce((s,v)=>s+Number(v),0) : 0
                  if (!chartData.length) return (
                    <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                      <div style={{fontSize:11, fontWeight:700, color:C.navy,
                        textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8}}>
                        {label}
                      </div>
                      <div style={{width:150, height:150, display:'flex', alignItems:'center',
                        justifyContent:'center', color:C.grayLt, fontSize:11}}>Sin datos</div>
                    </div>
                  )
                  const rtaPct = chartData.find(d=>d.isRta)?.value || 0
                  return (
                    <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                      <div style={{fontSize:11, fontWeight:700, color:C.navy,
                        textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8, textAlign:'center'}}>
                        {label}
                      </div>
                      <div style={{position:'relative', width:150, height:150}}>
                        <PieChart width={150} height={150}>
                          <Pie data={chartData} cx={75} cy={75}
                            innerRadius={42} outerRadius={68}
                            dataKey="value" startAngle={90} endAngle={-270}
                            strokeWidth={2} stroke="#fff">
                            {chartData.map((entry, i) => (
                              <Cell key={i} fill={entry.color}/>
                            ))}
                          </Pie>
                        </PieChart>
                        <div style={{position:'absolute', top:'50%', left:'50%',
                          transform:'translate(-50%,-50%)', textAlign:'center',
                          pointerEvents:'none'}}>
                          <div style={{fontSize:16, fontWeight:800, color:C.navy}}>{rtaPct}%</div>
                          <div style={{fontSize:9, color:C.gray}}>correcta</div>
                        </div>
                      </div>
                      <div style={{display:'flex', flexDirection:'column', gap:3, marginTop:6,
                        alignItems:'flex-start', width:'100%', maxWidth:140}}>
                        {chartData.map(d => (
                          <div key={d.op} style={{display:'flex', alignItems:'center', gap:5, fontSize:11, width:'100%'}}>
                            <div style={{width:10, height:10, borderRadius:2, flexShrink:0,
                              background:d.color,
                              outline: d.isRta ? '2px solid #0A1F3D' : 'none'}}/>
                            <span style={{fontWeight: d.isRta ? 700 : 400,
                              color: d.isRta ? C.navy : C.gray, flexGrow:1}}>
                              {d.op}{d.isRta ? ' ✓' : ''}
                            </span>
                            <span style={{fontWeight:600, color:C.text}}>{d.value}%</span>
                          </div>
                        ))}
                        <div style={{fontSize:10, color:C.grayLt, marginTop:2}}>n = {total}</div>
                      </div>
                    </div>
                  )
                }

                return (
                  <>
                    <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)',
                      gap:16, marginBottom:24}}>
                      {scopes.map(s => (
                        <DonutChart key={s.key} scopeKey={s.key} label={s.label}/>
                      ))}
                    </div>

                    <div style={{border:`1px solid ${C.bg2}`, borderRadius:8, overflow:'hidden'}}>
                      <table style={{width:'100%', borderCollapse:'collapse',
                        fontSize:12, fontFamily:'Inter'}}>
                        <tbody>
                          {[
                            ['Estándar',      q.estandar || '—'],
                            ['Afirmación',    (iAfirm >= 0 && rawRow) ? String(rawRow[iAfirm]||'—') : '—'],
                            ['Evidencia',     (iEvid  >= 0 && rawRow) ? String(rawRow[iEvid] ||'—') : '—'],
                            ['Tarea',         q.tarea || '—'],
                            ['Recomendación', '—'],
                          ].map(([label, value], i) => (
                            <tr key={label} style={{background: i%2===0 ? C.bg : C.white}}>
                              <td style={{padding:'9px 14px', fontWeight:700, color:C.navy,
                                width:130, borderRight:`1px solid ${C.bg2}`, fontSize:11,
                                textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap'}}>
                                {label}
                              </td>
                              <td style={{padding:'9px 14px', color:C.text, lineHeight:1.5}}>
                                {value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
