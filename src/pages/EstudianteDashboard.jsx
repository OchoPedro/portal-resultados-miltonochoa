import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  C, getColor, getLevel, avg,
  Card, CardTitle, Badge, KpiCard, TabBar, ScoreGauge, Sidebar, useMobile, useTablet
} from '../components/ui'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell
} from 'recharts'

export default function EstudianteDashboard({ session, onLogout }) {
  const mobile = useMobile()
  const tablet = useTablet()
  const [todos, setTodos] = useState([])          // todos los resultados del estudiante
  const [selectedIdx, setSelectedIdx] = useState(0) // prueba activa
  const [compañeros, setCompañeros] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: resultados } = await supabase
          .from('resultados_estudiante')
          .select('*, pruebas(codigo, nombre, fecha, grado)')
          .eq('estudiante_id', session.id)
          .order('created_at', { ascending: false })

        if (cancelled) return
        setTodos(resultados || [])

        if (resultados?.length) {
          const r = resultados[0]
          const { data: colegioPares } = await supabase
            .from('resultados_estudiante')
            .select('puntaje_global, estudiante_id, estudiantes(nombre)')
            .eq('colegio_id', r.colegio_id)
            .eq('prueba_id', r.prueba_id)
            .order('puntaje_global', { ascending: false })
          if (cancelled) return
          setCompañeros(colegioPares || [])
        }
      } catch (e) {
        // error de red — la UI muestra estado vacío
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleSelectPrueba = async (idx) => {
    setSelectedIdx(idx)
    setTab('resumen')
    const r = todos[idx]
    if (!r) return
    const { data: colegioPares } = await supabase
      .from('resultados_estudiante')
      .select('puntaje_global, estudiante_id, estudiantes(nombre)')
      .eq('colegio_id', r.colegio_id)
      .eq('prueba_id', r.prueba_id)
      .order('puntaje_global', { ascending: false })
    setCompañeros(colegioPares || [])
  }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center',
      justifyContent: 'center', background: C.bg }}>
      <div style={{ fontFamily: 'Inter', color: C.gray }}>Cargando resultados...</div>
    </div>
  )

  if (!todos.length) return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center',
      justifyContent: 'center', background: C.bg, flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 48 }}>📋</div>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.navy }}>
        Aún no tienes resultados
      </div>
      <div style={{ fontFamily: 'Inter', fontSize: 14, color: C.gray }}>
        Tus resultados aparecerán aquí cuando estén disponibles.
      </div>
      <button onClick={onLogout} style={{ marginTop: 12, padding: '10px 24px',
        background: C.navy, color: C.white, border: 'none', borderRadius: 8,
        fontFamily: 'Inter', fontSize: 13 }}>Cerrar sesión</button>
    </div>
  )

  const r = todos[Math.min(selectedIdx, todos.length - 1)] || todos[0]
  if (!r) return null
  const prueba = r.pruebas
  const promColegio = compañeros.length
    ? Math.round(avg(compañeros.map(c => c.puntaje_global)))
    : 0
  const miPuesto = compañeros.findIndex(c => c.estudiante_id === session.id) + 1 || 0
  const percentil = miPuesto && compañeros.length
    ? Math.round((1 - (miPuesto - 1) / compañeros.length) * 100)
    : 0

  const areaData = [
    { area: 'Mat. Cuantit.', yo: r.mat_cuantitativo, nac: 50.2 },
    { area: 'Mat. Específ.', yo: r.mat_especifico, nac: 48.1 },
    { area: 'Química', yo: r.cn_quimica, nac: 38.6 },
    { area: 'Física', yo: r.cn_fisica, nac: 47.9 },
    { area: 'Biología', yo: r.cn_biologia, nac: 58.1 },
    { area: 'CTS', yo: r.cn_cts, nac: 57.2 },
    { area: 'Sociales', yo: r.sociales, nac: 51.8 },
    { area: 'Ciudadanas', yo: r.ciudadanas, nac: 49.3 },
    { area: 'Lect. Crítica', yo: r.lectura_critica, nac: 52.4 },
    { area: 'Inglés', yo: r.ingles, nac: 55.3 },
  ].filter(a => a.yo != null)

  const radarData = [
    { comp: 'Matemáticas', yo: Math.round(((r.mat_cuantitativo || 0) + (r.mat_especifico || 0)) / 2) },
    { comp: 'Ciencias Nat.', yo: Math.round(((r.cn_quimica || 0) + (r.cn_fisica || 0) + (r.cn_biologia || 0) + (r.cn_cts || 0)) / 4) },
    { comp: 'Soc. y Ciud.', yo: Math.round(((r.sociales||0)+(r.ciudadanas||0))/2) },
    { comp: 'Lect. Crítica', yo: r.lectura_critica || 0 },
    { comp: 'Inglés', yo: r.ingles || 0 },
  ]

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'areas', label: 'Por Área' },
    { id: 'perfil', label: 'Perfil' },
    { id: 'posicion', label: 'Mi Posición' },
  ]

  const distData = [
    { rango: '< 380', cant: compañeros.filter(c => c.puntaje_global < 380).length, color: C.red },
    { rango: '380–399', cant: compañeros.filter(c => c.puntaje_global >= 380 && c.puntaje_global < 400).length, color: C.amber },
    { rango: '400–419', cant: compañeros.filter(c => c.puntaje_global >= 400 && c.puntaje_global < 420).length, color: C.blue },
    { rango: '420–439', cant: compañeros.filter(c => c.puntaje_global >= 420 && c.puntaje_global < 440).length, color: C.green },
    { rango: '≥ 440', cant: compañeros.filter(c => c.puntaje_global >= 440).length, color: C.navy },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar role="estudiante" session={session} onLogout={onLogout}>
        <div style={{ padding: '8px 4px' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter',
            letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
            Mis Pruebas ({todos.length})
          </div>
          {todos.map((res, idx) => (
            <button key={res.id} onClick={() => handleSelectPrueba(idx)} style={{
              width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
              borderRadius: 8, padding: '10px 12px', marginBottom: 6, transition: 'all 0.15s',
              background: idx === selectedIdx
                ? 'rgba(45,155,111,0.25)'
                : 'rgba(255,255,255,0.05)',
              borderLeft: idx === selectedIdx
                ? '3px solid #3AB882'
                : '3px solid transparent',
            }}>
              <div style={{ fontSize: 11, color: idx === selectedIdx ? '#3AB882' : 'rgba(255,255,255,0.6)',
                fontFamily: 'Inter', fontWeight: 600, marginBottom: 2 }}>
                {res.pruebas?.codigo}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter',
                marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {res.pruebas?.nombre}
              </div>
              <div style={{ fontSize: 13, fontFamily: 'Playfair Display, serif',
                color: C.white, fontWeight: 700 }}>
                {res.puntaje_global} pts
              </div>
            </button>
          ))}
        </div>
      </Sidebar>

      <main style={{ flex: 1, padding: mobile ? '72px 16px 24px' : tablet ? '24px 20px' : '36px 40px', overflowY: 'auto', minWidth: 0 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: C.green, letterSpacing: '0.15em',
            textTransform: 'uppercase', fontFamily: 'Inter', marginBottom: 6 }}>
            {prueba?.codigo} · Grado {prueba?.grado} · {prueba?.fecha}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 26, fontFamily: 'Playfair Display, serif', color: C.navy, marginBottom: 4 }}>
                {session.nombre}
              </h1>
              <div style={{ fontSize: 13, color: C.gray, fontFamily: 'Inter' }}>
                {session.colegios?.nombre} · {session.colegios?.ciudad} · Grado {session.grado}
                {miPuesto ? ` · Puesto #${miPuesto} de ${compañeros.length}` : ''}
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: mobile || tablet ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          <KpiCard label="Puntaje Global" value={r.puntaje_global} sub="Escala 0–500" color={getColor((r.puntaje_global / 500) * 100)} />
          <KpiCard label="Desempeño" value={`${r.desempeno_pct?.toFixed(1)}%`} sub="Promedio ponderado" color={getColor(r.desempeno_pct)} />
          <KpiCard label="Puesto" value={miPuesto ? `#${miPuesto}` : '—'} sub={`de ${compañeros.length} estudiantes`} color={C.navy} />
          <KpiCard label="Percentil" value={`${percentil}°`} sub="Dentro del colegio" color={C.green} />
        </div>

        <TabBar tabs={tabs} active={tab} onChange={setTab} />

        {/* RESUMEN */}
        {tab === 'resumen' && (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '220px 1fr', gap: 16 }}>
            <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center' }}>
              <CardTitle>Puntaje</CardTitle>
              <ScoreGauge value={r.puntaje_global} />
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <Badge color={getColor(r.desempeno_pct)}>{getLevel(r.desempeno_pct)}</Badge>
                <div style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter', marginTop: 8 }}>
                  Prom. colegio: <strong style={{ color: C.navy }}>{promColegio}</strong>
                </div>
                <div style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter' }}>
                  Diferencia:{' '}
                  <strong style={{ color: r.puntaje_global >= promColegio ? C.green : C.red }}>
                    {r.puntaje_global >= promColegio ? '+' : ''}{r.puntaje_global - promColegio}
                  </strong>
                </div>
              </div>
            </Card>
            <Card>
              <CardTitle sub="Tu puntaje vs promedio nacional por área">Resumen por Área</CardTitle>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={areaData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                  <XAxis dataKey="area" tick={{ fontSize: 10, fontFamily: 'Inter', fill: C.gray }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'Inter', fill: C.gray }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontFamily: 'Inter', fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: 11 }} />
                  <Bar dataKey="yo" name="Mi puntaje" fill={C.navy} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="nac" name="Nac." fill={C.grayLt} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* POR ÁREA */}
        {tab === 'areas' && (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
            {areaData.map((a, i) => (
              <Card key={i}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, fontFamily: 'Inter',
                  marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${C.bg2}` }}>
                  {a.area}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: 16 }}>
                  {[
                    { label: 'Mi puntaje', val: a.yo, color: getColor(a.yo) },
                    { label: 'Nacional', val: a.nac, color: C.gray },
                  ].map((item, j) => (
                    <div key={j}>
                      <div style={{ fontSize: 28, fontFamily: 'Playfair Display, serif',
                        color: item.color, fontWeight: 700, lineHeight: 1 }}>{item.val}</div>
                      <div style={{ fontSize: 10, color: C.gray, fontFamily: 'Inter', marginTop: 4 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height: 6, background: C.bg2, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${a.yo}%`, borderRadius: 3, background: getColor(a.yo) }} />
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
                  <Badge color={a.yo >= a.nac ? C.green : C.amber}>
                    {a.yo >= a.nac ? '+' : ''}{(a.yo - a.nac).toFixed(1)} vs nac.
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* PERFIL */}
        {tab === 'perfil' && (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <Card>
              <CardTitle sub="Radar de tu perfil por área">Perfil Académico</CardTitle>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={C.bg2} />
                  <PolarAngleAxis dataKey="comp" tick={{ fontSize: 12, fontFamily: 'Inter', fill: C.gray }} />
                  <Radar name="Mi puntaje" dataKey="yo" stroke={C.navy} fill={C.navy} fillOpacity={0.2} strokeWidth={2} dot={{ fill: C.navy, r: 5 }} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <CardTitle sub="Nivel de desempeño en cada área">Nivel por Área</CardTitle>
              {areaData.map((a, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.text, fontFamily: 'Inter' }}>{a.area}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontFamily: 'Playfair Display, serif',
                        color: getColor(a.yo), fontWeight: 700 }}>{a.yo}%</span>
                      <Badge color={getColor(a.yo)}>{getLevel(a.yo)}</Badge>
                    </div>
                  </div>
                  <div style={{ height: 6, background: C.bg2, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${a.yo}%`, borderRadius: 3, background: getColor(a.yo) }} />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* MI POSICIÓN */}
        {tab === 'posicion' && (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <Card>
              <CardTitle sub="Distribución de puntajes del curso">Distribución del Curso</CardTitle>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={distData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                  <XAxis dataKey="rango" tick={{ fontSize: 11, fontFamily: 'Inter', fill: C.gray }} />
                  <YAxis tick={{ fontSize: 11, fontFamily: 'Inter', fill: C.gray }} />
                  <Tooltip contentStyle={{ fontFamily: 'Inter', fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="cant" name="Estudiantes" radius={[4, 4, 0, 0]}>
                    {distData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 16, padding: 12, background: C.bg, borderRadius: 8,
                border: `2px solid ${getColor((r.puntaje_global / 500) * 100)}`, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter' }}>Tu puntaje</div>
                <div style={{ fontSize: 28, fontFamily: 'Playfair Display, serif',
                  color: getColor((r.puntaje_global / 500) * 100), fontWeight: 700 }}>{r.puntaje_global}</div>
                <div style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter' }}>
                  Puesto #{miPuesto} · Percentil {percentil}°
                </div>
              </div>
            </Card>
            <Card>
              <CardTitle sub="Top 10 del curso">Ranking del Curso</CardTitle>
              {compañeros.slice(0, 10).map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderBottom: i < 9 ? `1px solid ${C.bg2}` : 'none',
                  background: c.estudiante_id === session.id ? `${C.navy}06` : 'transparent',
                  borderRadius: c.estudiante_id === session.id ? 6 : 0,
                  paddingLeft: c.estudiante_id === session.id ? 8 : 0 }}>
                  <div style={{ width: 24, textAlign: 'center', fontSize: 12, fontWeight: 700,
                    color: i === 0 ? '#F59E0B' : i === 1 ? C.gray : i === 2 ? '#CD7F32' : C.grayLt,
                    fontFamily: 'Playfair Display, serif' }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 12, fontFamily: 'Inter',
                    color: c.estudiante_id === session.id ? C.navy : C.text,
                    fontWeight: c.estudiante_id === session.id ? 600 : 400 }}>
                    {c.estudiantes?.nombre?.split(' ').slice(0, 2).join(' ')}
                    {c.estudiante_id === session.id && <span style={{ color: C.green, marginLeft: 6, fontSize: 11 }}>← tú</span>}
                  </div>
                  <div style={{ fontSize: 16, fontFamily: 'Playfair Display, serif',
                    color: c.estudiante_id === session.id ? C.green : C.navy, fontWeight: 700 }}>
                    {c.puntaje_global}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
