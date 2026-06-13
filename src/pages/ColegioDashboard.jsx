import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  C, getColor, getLevel, avg,
  Card, CardTitle, Badge, KpiCard, TabBar, Sidebar
} from '../components/ui'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell
} from 'recharts'

export default function ColegioDashboard({ session, onLogout }) {
  const [resultados, setResultados] = useState([])
  const [preguntas, setPreguntas] = useState([])
  const [prueba, setPrueba] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      // Prueba más reciente del colegio
      const { data: res } = await supabase
        .from('resultados_estudiante')
        .select('*, pruebas(id, codigo, nombre, fecha, grado), estudiantes(nombre, grado)')
        .eq('colegio_id', session.id)
        .order('created_at', { ascending: false })

      if (res?.length) {
        const pruebaActiva = res[0].pruebas
        setPrueba(pruebaActiva)
        setResultados(res)

        // Preguntas del análisis
        const { data: pq } = await supabase
          .from('analisis_preguntas')
          .select('*')
          .eq('colegio_id', session.id)
          .eq('prueba_id', pruebaActiva.id)
          .order('sesion')
          .order('nro_pregunta')

        setPreguntas(pq || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center',
      justifyContent: 'center', background: C.bg }}>
      <div style={{ fontFamily: 'Inter', color: C.gray }}>Cargando datos...</div>
    </div>
  )

  if (!resultados.length) return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center',
      justifyContent: 'center', background: C.bg, flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 48 }}>🏫</div>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.navy }}>
        Sin resultados disponibles
      </div>
      <div style={{ fontFamily: 'Inter', fontSize: 14, color: C.gray }}>
        Los resultados aparecerán aquí cuando AAMO los cargue.
      </div>
      <button onClick={onLogout} style={{ marginTop: 12, padding: '10px 24px',
        background: C.navy, color: C.white, border: 'none', borderRadius: 8,
        fontFamily: 'Inter', fontSize: 13 }}>Cerrar sesión</button>
    </div>
  )

  // Cálculos
  const globals = resultados.map(r => r.puntaje_global).filter(Boolean)
  const promGlobal = Math.round(avg(globals))
  const maxGlobal = Math.max(...globals)
  const minGlobal = Math.min(...globals)
  const topEstudiante = resultados.find(r => r.puntaje_global === maxGlobal)

  const areaProms = {
    mat_c: avg(resultados.map(r => r.mat_cuantitativo).filter(Boolean)),
    mat_e: avg(resultados.map(r => r.mat_especifico).filter(Boolean)),
    quim:  avg(resultados.map(r => r.cn_quimica).filter(Boolean)),
    fis:   avg(resultados.map(r => r.cn_fisica).filter(Boolean)),
    bio:   avg(resultados.map(r => r.cn_biologia).filter(Boolean)),
    cts:   avg(resultados.map(r => r.cn_cts).filter(Boolean)),
    soc:   avg(resultados.map(r => r.sociales).filter(Boolean)),
    lc:    avg(resultados.map(r => r.lectura_critica).filter(Boolean)),
    ing:   avg(resultados.map(r => r.ingles).filter(Boolean)),
  }

  const areaData = [
    { area: 'Mat. Cuant.', plan: areaProms.mat_c, nac: 50.2 },
    { area: 'Mat. Espec.', plan: areaProms.mat_e, nac: 48.1 },
    { area: 'Química',     plan: areaProms.quim,  nac: 38.6 },
    { area: 'Física',      plan: areaProms.fis,   nac: 47.9 },
    { area: 'Biología',    plan: areaProms.bio,   nac: 58.1 },
    { area: 'CTS',         plan: areaProms.cts,   nac: 57.2 },
    { area: 'Sociales',    plan: areaProms.soc,   nac: 51.8 },
    { area: 'Lect. Crit.', plan: areaProms.lc,    nac: 52.4 },
    { area: 'Inglés',      plan: areaProms.ing,   nac: 55.3 },
  ].filter(a => a.plan > 0)

  const distData = [
    { rango: '< 380',   cant: globals.filter(g => g < 380).length,               color: C.red },
    { rango: '380–399', cant: globals.filter(g => g >= 380 && g < 400).length,   color: C.amber },
    { rango: '400–419', cant: globals.filter(g => g >= 400 && g < 420).length,   color: C.blue },
    { rango: '420–439', cant: globals.filter(g => g >= 420 && g < 440).length,   color: C.green },
    { rango: '≥ 440',   cant: globals.filter(g => g >= 440).length,              color: C.navy },
  ]

  // Competencias desde preguntas
  const compMap = {}
  preguntas.forEach(p => {
    if (!p.competencia) return
    if (!compMap[p.competencia]) compMap[p.competencia] = { plan: [], nac: [] }
    compMap[p.competencia].plan.push(p.pct_colegio)
    compMap[p.competencia].nac.push(p.pct_nacional)
  })
  const competencias = Object.entries(compMap).map(([comp, v]) => ({
    comp: comp.length > 35 ? comp.slice(0, 35) + '…' : comp,
    plan: Math.round(avg(v.plan)),
    nac: Math.round(avg(v.nac)),
  })).sort((a, b) => b.plan - a.plan)

  const oportunidades = preguntas.filter(p => p.oportunidad_mejora).sort((a, b) => a.pct_colegio - b.pct_colegio)

  const rankingOrdenado = [...resultados]
    .filter(r => r.puntaje_global)
    .sort((a, b) => b.puntaje_global - a.puntaje_global)

  const tabs = [
    { id: 'resumen',      label: 'Resumen' },
    { id: 'competencias', label: 'Competencias' },
    { id: 'mejora',       label: 'Oportunidades' },
    { id: 'ranking',      label: 'Ranking' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar role="colegio" session={session} onLogout={onLogout}>
        <div style={{ padding: '8px 4px' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter',
            letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Institución</div>
          <div style={{ background: 'rgba(45,155,111,0.15)', border: '1px solid rgba(45,155,111,0.3)',
            borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: C.greenLt, fontFamily: 'Inter', fontWeight: 600, marginBottom: 2 }}>
              {session.nombre}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter' }}>
              {session.ciudad}
            </div>
            <div style={{ marginTop: 8, fontSize: 14, fontFamily: 'Playfair Display, serif',
              color: C.white, fontWeight: 700 }}>
              Prom: {promGlobal}
            </div>
          </div>
        </div>
      </Sidebar>

      <main style={{ flex: 1, padding: '36px 40px', overflowY: 'auto' }}>
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
                {session.ciudad} · {resultados.length} estudiantes evaluados
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          <KpiCard label="Prom. Global" value={promGlobal} sub="Promedio del colegio" color={C.navy} />
          <KpiCard label="Estudiantes" value={resultados.length} sub="Evaluados" color={C.navy} />
          <KpiCard label="Mejor puntaje" value={maxGlobal} sub={topEstudiante?.estudiantes?.nombre?.split(' ').slice(0, 2).join(' ')} color={C.green} />
          <KpiCard label="Oport. mejora" value={oportunidades.length} sub="Preguntas críticas" color={C.red} />
        </div>

        <TabBar tabs={tabs} active={tab} onChange={setTab} />

        {/* RESUMEN */}
        {tab === 'resumen' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card>
              <CardTitle sub="Estudiantes por rango de puntaje">Distribución de Puntajes</CardTitle>
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
            </Card>
            <Card>
              <CardTitle sub="Colegio vs Nacional por área">Promedio por Área</CardTitle>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={areaData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                  <XAxis type="number" tick={{ fontSize: 10, fontFamily: 'Inter', fill: C.gray }} domain={[0, 100]} />
                  <YAxis type="category" dataKey="area" tick={{ fontSize: 10, fontFamily: 'Inter', fill: C.gray }} width={70} />
                  <Tooltip contentStyle={{ fontFamily: 'Inter', fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: 11 }} />
                  <Bar dataKey="plan" name="Colegio %" fill={C.navy} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="nac" name="Nacional %" fill={C.grayLt} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* COMPETENCIAS */}
        {tab === 'competencias' && competencias.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card style={{ gridColumn: '1/3' }}>
              <CardTitle sub="% acierto del colegio vs nacional">Desempeño por Competencia</CardTitle>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={competencias} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 230 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                  <XAxis type="number" tick={{ fontSize: 11, fontFamily: 'Inter', fill: C.gray }} domain={[0, 100]} />
                  <YAxis type="category" dataKey="comp" tick={{ fontSize: 11, fontFamily: 'Inter', fill: C.gray }} width={225} />
                  <Tooltip contentStyle={{ fontFamily: 'Inter', fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: 11 }} />
                  <Bar dataKey="plan" name="Colegio %" fill={C.navy} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="nac" name="Nacional %" fill={C.grayLt} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <CardTitle sub="Radar de perfil competencial">Radar</CardTitle>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={competencias.slice(0, 8)}>
                  <PolarGrid stroke={C.bg2} />
                  <PolarAngleAxis dataKey="comp" tick={{ fontSize: 9, fontFamily: 'Inter', fill: C.gray }} />
                  <Radar name="Colegio" dataKey="plan" stroke={C.navy} fill={C.navy} fillOpacity={0.2} strokeWidth={2} />
                  <Radar name="Nacional" dataKey="nac" stroke={C.grayLt} fill={C.grayLt} fillOpacity={0.1} strokeWidth={1.5} />
                  <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <CardTitle sub="Ventaja del colegio sobre el nacional">Brecha vs Nacional</CardTitle>
              {competencias.map((c, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: C.text, fontFamily: 'Inter' }}>{c.comp}</span>
                    <Badge color={c.plan - c.nac >= 30 ? C.green : c.plan - c.nac >= 20 ? C.blue : C.amber}>
                      {c.plan - c.nac >= 0 ? '+' : ''}{(c.plan - c.nac).toFixed(1)}%
                    </Badge>
                  </div>
                  <div style={{ height: 4, background: C.bg2, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(0, c.plan - c.nac)}%`, borderRadius: 2,
                      background: c.plan - c.nac >= 20 ? C.green : C.amber }} />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab === 'competencias' && competencias.length === 0 && (
          <Card>
            <div style={{ textAlign: 'center', padding: 40, color: C.gray, fontFamily: 'Inter' }}>
              No hay datos de competencias cargados para esta prueba.
            </div>
          </Card>
        )}

        {/* OPORTUNIDADES */}
        {tab === 'mejora' && (
          <Card>
            <CardTitle sub={`${oportunidades.length} preguntas identificadas como oportunidad de mejora`}>
              Oportunidades de Mejora
            </CardTitle>
            {oportunidades.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.gray, fontFamily: 'Inter' }}>
                No hay oportunidades de mejora cargadas.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.bg2}` }}>
                      {['Sesión', 'Nro', 'Materia', 'Componente', '% Colegio', '% Nacional', 'Brecha', 'Nivel'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10,
                          color: C.gray, fontWeight: 600, textTransform: 'uppercase',
                          letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {oportunidades.map((q, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.bg2}`,
                        background: i % 2 === 0 ? `${C.bg}80` : 'transparent' }}>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: C.gray }}>{q.sesion}</td>
                        <td style={{ padding: '10px 12px', fontSize: 15, fontWeight: 700,
                          color: C.navy, fontFamily: 'Playfair Display, serif' }}>{q.nro_pregunta}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: C.text, fontWeight: 500 }}>{q.materia}</td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: C.gray }}>{q.componente}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge color={q.pct_colegio < 20 ? C.red : C.amber}>{q.pct_colegio}%</Badge>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: C.gray }}>{q.pct_nacional}%</td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge color={q.pct_colegio < q.pct_nacional ? C.red : C.green}>
                            {q.pct_colegio < q.pct_nacional ? '−' : '+'}{Math.abs(q.pct_colegio - q.pct_nacional)}%
                          </Badge>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge color={q.dificultad === 'Superior' ? C.red : q.dificultad === 'Alto' ? C.amber : C.blue}>
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

        {/* RANKING */}
        {tab === 'ranking' && (
          <Card>
            <CardTitle sub={`${rankingOrdenado.length} estudiantes ordenados por puntaje global`}>Ranking Completo</CardTitle>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.bg2}` }}>
                    {['#', 'Estudiante', 'Global', 'Desempeño', 'Mat.', 'C.Nat.', 'Sociales', 'L.Crít.', 'Inglés'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10,
                        color: C.gray, fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankingOrdenado.map((r, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.bg2}`,
                      background: i < 3 ? `${C.navy}04` : i % 2 === 0 ? `${C.bg}60` : 'transparent' }}>
                      <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700,
                        color: i === 0 ? '#F59E0B' : i === 1 ? C.gray : i === 2 ? '#CD7F32' : C.grayLt }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: C.text, fontWeight: 500 }}>
                        {r.estudiantes?.nombre?.split(' ').slice(0, 3).join(' ')}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.navy,
                          fontFamily: 'Playfair Display, serif' }}>{r.puntaje_global}</span>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <Badge color={getColor(r.desempeno_pct)}>{r.desempeno_pct?.toFixed(1)}%</Badge>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: getColor(r.mat_cuantitativo) }}>
                        {r.mat_cuantitativo?.toFixed(0)}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: getColor(r.cn_biologia) }}>
                        {r.cn_biologia ? Math.round((r.cn_quimica + r.cn_fisica + r.cn_biologia + r.cn_cts) / 4) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: getColor(r.sociales) }}>
                        {r.sociales?.toFixed(0)}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: getColor(r.lectura_critica) }}>
                        {r.lectura_critica?.toFixed(0)}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: getColor(r.ingles) }}>
                        {r.ingles?.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
