import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { C } from '../../components/ui'
import {
  BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

const REGIONES_DEPTS = {
  'Andina':    ['ANTIOQUIA','BOGOTÁ D.C.','BOYACÁ','CALDAS','CUNDINAMARCA','HUILA','NORTE SANTANDER','QUINDÍO','RISARALDA','SANTANDER','TOLIMA'],
  'Caribe':    ['ATLÁNTICO','BOLÍVAR','CESAR','CÓRDOBA','LA GUAJIRA','MAGDALENA','SUCRE','SAN ANDRÉS'],
  'Pacífica':  ['CAUCA','CHOCÓ','NARIÑO','VALLE DEL CAUCA'],
  'Orinoquía': ['ARAUCA','CASANARE','META','VICHADA'],
  'Amazonía':  ['AMAZONAS','CAQUETÁ','GUAINÍA','GUAVIARE','PUTUMAYO','VAUPÉS'],
}

const DEPTO_REGION_MAP = {}
Object.entries(REGIONES_DEPTS).forEach(([r, ds]) => ds.forEach(d => { DEPTO_REGION_MAP[d] = r }))

const AREAS = [
  { key: 'lectura_critica',    label: 'Lectura Crítica',       short: 'L.C.' },
  { key: 'matematicas',        label: 'Matemáticas',           short: 'Mat.' },
  { key: 'ciencias_sociales',  label: 'Sociales y Ciudadanas', short: 'C.S.' },
  { key: 'ciencias_naturales', label: 'Ciencias Naturales',    short: 'C.N.' },
  { key: 'ingles',             label: 'Inglés',                short: 'Ing.' },
]

const AÑO_COLORS = {
  2020: '#94A3B8', 2021: '#60A5FA', 2022: '#34D399',
  2023: '#FBBF24', 2024: '#F87171', 2025: '#2D9B6F',
}

const TIPO_LABEL = { region: 'Región', departamento: 'Departamento', municipio: 'Municipio' }
const TIPO_ICON  = { region: '🌎', departamento: '🗺', municipio: '🏙' }

// ── UI helpers ────────────────────────────────────────────────────────────────

const Tab = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: '9px 16px', border: 'none', background: 'none',
    borderBottom: active ? `3px solid ${C.green}` : '3px solid transparent',
    color: active ? C.navy : C.gray, fontFamily: 'Inter',
    fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer',
    whiteSpace: 'nowrap', transition: 'all 0.15s',
  }}>{label}</button>
)

const Th = ({ children, center }) => (
  <th style={{
    padding: '9px 12px', fontSize: 10, fontWeight: 600, color: C.gray,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: `2px solid ${C.bg2}`, textAlign: center ? 'center' : 'left',
    background: C.white, position: 'sticky', top: 0, whiteSpace: 'nowrap',
  }}>{children}</th>
)

const Td = ({ children, center, bold, color, style = {} }) => (
  <td style={{
    padding: '10px 12px', fontSize: 12, fontFamily: 'Inter',
    textAlign: center ? 'center' : 'left',
    fontWeight: bold ? 700 : 400, color: color || C.text,
    borderBottom: `1px solid ${C.bg2}`, ...style,
  }}>{children}</td>
)

const ScoreChip = ({ val }) => {
  if (val == null || val === '') return <span style={{ color: C.grayLt }}>—</span>
  const n = parseFloat(val)
  const color = n >= 75 ? C.green : n >= 60 ? C.navy : n >= 50 ? C.amber : C.red
  return <span style={{ fontWeight: 700, color }}>{n.toFixed(1)}</span>
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.white, border: `1px solid ${C.grayLt}`, borderRadius: 8,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: 'Inter' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: p.color, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ── Agregación de filas por año ───────────────────────────────────────────────

const aggregate = (rows) => {
  const byYear = {}
  ;(rows || []).forEach(r => {
    const y = r.anio
    if (!byYear[y]) byYear[y] = { anio: y, n: 0, est: 0, lc:0, mat:0, cs:0, cn:0, ing:0, pond:0, glob:0 }
    const b = byYear[y]
    b.n++
    b.est  += parseInt(r.eval_estudiantes || 0)
    b.lc   += parseFloat(r.lectura_critica || 0)
    b.mat  += parseFloat(r.matematicas || 0)
    b.cs   += parseFloat(r.ciencias_sociales || 0)
    b.cn   += parseFloat(r.ciencias_naturales || 0)
    b.ing  += parseFloat(r.ingles || 0)
    b.pond += parseFloat(r.ponderado || 0)
    b.glob += parseFloat(r.puntaje_global || 0)
  })
  return Object.values(byYear).sort((a, b) => a.anio - b.anio).map(b => ({
    anio: b.anio, colegios: b.n, estudiantes: b.est,
    lc:   b.n ? b.lc/b.n   : 0,
    mat:  b.n ? b.mat/b.n  : 0,
    cs:   b.n ? b.cs/b.n   : 0,
    cn:   b.n ? b.cn/b.n   : 0,
    ing:  b.n ? b.ing/b.n  : 0,
    pond: b.n ? b.pond/b.n : 0,
    glob: b.n ? b.glob/b.n : 0,
  }))
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ReporteAgrupado({ tipo, nombre, departamento, anioRef, onClose }) {
  const [tab, setTab]         = useState('areas')
  const [data, setData]       = useState([])   // agregado por año para la entidad
  const [ctx, setCtx]         = useState([])   // contexto superior (región/depto/nacional)
  const [topCol, setTopCol]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [tipo, nombre, departamento, anioRef])

  const buildEntityQ = (year) => {
    let q = supabase
      .from('ranking_colegios')
      .select('anio,eval_estudiantes,lectura_critica,matematicas,ciencias_sociales,ciencias_naturales,ingles,ponderado,puntaje_global')
      .eq('anio', year)
      .limit(50000)

    if (tipo === 'municipio')     { q = q.eq('ciudad', nombre).eq('departamento', departamento) }
    else if (tipo === 'departamento') { q = q.eq('departamento', nombre) }
    else { // region
      const depts = REGIONES_DEPTS[nombre] || []
      q = q.in('departamento', depts)
    }
    return q
  }

  const buildCtxQ = (year) => {
    let q = supabase
      .from('ranking_colegios')
      .select('anio,eval_estudiantes,lectura_critica,matematicas,ciencias_sociales,ciencias_naturales,ingles,ponderado,puntaje_global')
      .eq('anio', year)
      .limit(50000)

    if (tipo === 'municipio') {
      // contexto = departamento
      q = q.eq('departamento', departamento)
    } else if (tipo === 'departamento') {
      // contexto = región
      const region = DEPTO_REGION_MAP[nombre]
      const depts  = region ? REGIONES_DEPTS[region] : []
      if (depts.length) q = q.in('departamento', depts)
      else q = q.limit(0)
    }
    // región → contexto = nacional (no filtro extra)
    return q
  }

  const ANIOS = [2020, 2021, 2022, 2023, 2024, 2025]

  const loadAll = async () => {
    setLoading(true)

    const [entityResps, ctxResps] = await Promise.all([
      Promise.all(ANIOS.map(y => buildEntityQ(y))),
      Promise.all(ANIOS.map(y => buildCtxQ(y))),
    ])

    const allEntityRows = entityResps.flatMap((r, i) =>
      (r.data || []).map(row => ({ ...row, anio: ANIOS[i] }))
    )
    const allCtxRows = ctxResps.flatMap((r, i) =>
      (r.data || []).map(row => ({ ...row, anio: ANIOS[i] }))
    )

    const entityAgg = aggregate(allEntityRows).filter(r => r.colegios > 0)
    const ctxAgg    = aggregate(allCtxRows).filter(r => r.colegios > 0)

    setData(entityAgg)
    setCtx(ctxAgg)

    // Top colegios del año de referencia
    const refYear = anioRef || 2024
    let topQ = supabase
      .from('ranking_colegios')
      .select('nombre,ciudad,departamento,calendario,naturaleza,puesto_anio,eval_estudiantes,lectura_critica,matematicas,ciencias_sociales,ciencias_naturales,ingles,ponderado,puntaje_global')
      .eq('anio', refYear)
      .order('puesto_anio', { ascending: true })
      .limit(20)

    if (tipo === 'municipio')         { topQ = topQ.eq('ciudad', nombre).eq('departamento', departamento) }
    else if (tipo === 'departamento') { topQ = topQ.eq('departamento', nombre) }
    else {
      const depts = REGIONES_DEPTS[nombre] || []
      if (depts.length) topQ = topQ.in('departamento', depts)
    }

    const { data: topRows } = await topQ
    setTopCol(topRows || [])
    setLoading(false)
  }

  if (!nombre) return null

  const refRow  = data.find(r => r.anio === anioRef) ?? data[data.length - 1]
  const prevRow = data[data.indexOf(refRow) - 1]
  const ctxRef  = ctx.find(r => r.anio === refRow?.anio)
  const años    = data.map(r => r.anio)

  const tendencia = prevRow
    ? refRow.pond > prevRow.pond ? '↑' : refRow.pond < prevRow.pond ? '↓' : '→'
    : '—'

  // Datos gráficas
  const areasData = AREAS.map(a => {
    const entry = { area: a.short }
    data.forEach(r => { entry[String(r.anio)] = +r[a.key === 'lectura_critica' ? 'lc' : a.key === 'matematicas' ? 'mat' : a.key === 'ciencias_sociales' ? 'cs' : a.key === 'ciencias_naturales' ? 'cn' : 'ing'].toFixed(1) })
    return entry
  })

  const ctxLabel = tipo === 'municipio' ? `Prom. ${departamento}` : tipo === 'departamento' ? `Prom. ${DEPTO_REGION_MAP[nombre] || 'Región'}` : 'Prom. Nacional'

  const vsCtxData = AREAS.map(a => {
    const aKey = a.key === 'lectura_critica' ? 'lc' : a.key === 'matematicas' ? 'mat' : a.key === 'ciencias_sociales' ? 'cs' : a.key === 'ciencias_naturales' ? 'cn' : 'ing'
    const entry = { area: a.short }
    if (refRow)  entry[nombre]    = +refRow[aKey].toFixed(1)
    if (ctxRef)  entry[ctxLabel]  = +ctxRef[aKey].toFixed(1)
    return entry
  })

  const evolucionData = data.map(r => ({
    año: r.anio,
    Ponderado: +r.pond.toFixed(3),
    Global:    +r.glob.toFixed(1),
  }))

  const radarData = AREAS.map(a => {
    const aKey = a.key === 'lectura_critica' ? 'lc' : a.key === 'matematicas' ? 'mat' : a.key === 'ciencias_sociales' ? 'cs' : a.key === 'ciencias_naturales' ? 'cn' : 'ing'
    return {
      area: a.short,
      [nombre]:   refRow  ? +refRow[aKey].toFixed(1)  : 0,
      [ctxLabel]: ctxRef  ? +ctxRef[aKey].toFixed(1)  : 0,
    }
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,31,61,0.55)',
      zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '20px 16px', overflowY: 'auto' }}>

      <div style={{ background: C.bg, borderRadius: 16, width: '100%', maxWidth: 1100,
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)', overflow: 'hidden' }}>

        {/* HEADER */}
        <div style={{ background: C.navy, padding: '20px 28px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: C.green, fontFamily: 'Inter',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              {TIPO_ICON[tipo]} Reporte de {TIPO_LABEL[tipo]} · Saber 11°
            </div>
            <div style={{ fontSize: 24, color: C.white, fontFamily: 'Playfair Display, serif',
              fontWeight: 600, marginBottom: 10 }}>{nombre}</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {tipo === 'municipio' && (
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter',
                    textTransform: 'uppercase', letterSpacing: '0.1em' }}>Departamento</div>
                  <div style={{ fontSize: 12, color: C.white, fontFamily: 'Inter', fontWeight: 500 }}>
                    {departamento}
                  </div>
                </div>
              )}
              {tipo === 'departamento' && DEPTO_REGION_MAP[nombre] && (
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter',
                    textTransform: 'uppercase', letterSpacing: '0.1em' }}>Región</div>
                  <div style={{ fontSize: 12, color: C.white, fontFamily: 'Inter', fontWeight: 500 }}>
                    {DEPTO_REGION_MAP[nombre]}
                  </div>
                </div>
              )}
              {tipo === 'region' && (
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter',
                    textTransform: 'uppercase', letterSpacing: '0.1em' }}>Departamentos</div>
                  <div style={{ fontSize: 12, color: C.white, fontFamily: 'Inter', fontWeight: 500 }}>
                    {(REGIONES_DEPTS[nombre] || []).join(' · ')}
                  </div>
                </div>
              )}
              {refRow && [
                { label: 'Año ref.',    value: anioRef || refRow.anio },
                { label: 'Colegios',    value: refRow.colegios?.toLocaleString('es-CO') },
                { label: 'Estudiantes', value: refRow.estudiantes?.toLocaleString('es-CO') },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter',
                    textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: C.white, fontFamily: 'Inter', fontWeight: 500 }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none',
            color: C.white, fontSize: 20, width: 36, height: 36, borderRadius: 8,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginLeft: 16 }}>✕</button>
        </div>

        {/* KPIs */}
        {!loading && refRow && (
          <div style={{ background: C.white, borderBottom: `1px solid ${C.grayLt}`,
            padding: '12px 28px', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {[
              { label: 'Ponderado',  value: refRow.pond.toFixed(3) },
              { label: 'Global',     value: refRow.glob.toFixed(1) },
              { label: 'L.C.',       value: refRow.lc.toFixed(1) },
              { label: 'Matemáticas',value: refRow.mat.toFixed(1) },
              { label: 'C.S.',       value: refRow.cs.toFixed(1) },
              { label: 'C.N.',       value: refRow.cn.toFixed(1) },
              { label: 'Inglés',     value: refRow.ing.toFixed(1) },
              { label: 'Tendencia',
                value: tendencia === '↑' ? '↑ Mejoró' : tendencia === '↓' ? '↓ Bajó' : tendencia === '→' ? '→ Igual' : '—',
                color: tendencia === '↑' ? C.green : tendencia === '↓' ? C.red : C.gray },
            ].map(k => (
              <div key={k.label}>
                <div style={{ fontSize: 9, color: C.gray, fontFamily: 'Inter',
                  textTransform: 'uppercase', letterSpacing: '0.1em' }}>{k.label}</div>
                <div style={{ fontSize: 18, fontFamily: 'Playfair Display, serif',
                  color: k.color || C.navy, fontWeight: 600 }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* TABS */}
        <div style={{ background: C.white, borderBottom: `1px solid ${C.grayLt}`,
          paddingLeft: 20, display: 'flex', overflowX: 'auto' }}>
          {[
            { id: 'areas',      label: 'Comparativo por Área' },
            { id: 'evolucion',  label: 'Evolución' },
            { id: 'vscontexto', label: `vs ${ctxLabel}` },
            { id: 'radar',      label: 'Perfil Áreas' },
            { id: 'colegios',   label: `Top Colegios ${anioRef || 2024}` },
            { id: 'historico',  label: 'Histórico' },
          ].map(t => <Tab key={t.id} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />)}
        </div>

        {/* CONTENIDO */}
        <div style={{ padding: 28, minHeight: 420 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 80, color: C.gray, fontFamily: 'Inter' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{TIPO_ICON[tipo]}</div>
              Cargando datos de {TIPO_LABEL[tipo].toLowerCase()}...
            </div>
          ) : data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80, color: C.gray, fontFamily: 'Inter' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
              No hay datos disponibles para este {TIPO_LABEL[tipo].toLowerCase()}.
            </div>
          ) : (
            <>
              {/* ── Comparativo por Área ──────────────────────────────────── */}
              {tab === 'areas' && (
                <div>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, color: C.gray, marginBottom: 20 }}>
                    Promedio por área académica en cada año disponible
                  </div>
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart data={areasData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                      <XAxis dataKey="area" tick={{ fontFamily: 'Inter', fontSize: 12 }} />
                      <YAxis domain={[40, 100]} tick={{ fontFamily: 'Inter', fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: 12 }} />
                      <ReferenceLine y={60} stroke={C.amber} strokeDasharray="4 4" label={{ value:'60', position:'right', fontSize:10 }} />
                      <ReferenceLine y={75} stroke={C.green} strokeDasharray="4 4" label={{ value:'75', position:'right', fontSize:10 }} />
                      {años.map(a => (
                        <Bar key={a} dataKey={String(a)} name={String(a)} fill={AÑO_COLORS[a] || '#94A3B8'} radius={[3,3,0,0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>

                  <div style={{ marginTop: 24, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter' }}>
                      <thead>
                        <tr>
                          <Th>Área</Th>
                          {años.map(a => <Th key={a} center>{a}</Th>)}
                          {ctxRef && <Th center>{ctxLabel} {refRow?.anio}</Th>}
                        </tr>
                      </thead>
                      <tbody>
                        {AREAS.map(a => {
                          const aKey = a.key === 'lectura_critica' ? 'lc' : a.key === 'matematicas' ? 'mat' : a.key === 'ciencias_sociales' ? 'cs' : a.key === 'ciencias_naturales' ? 'cn' : 'ing'
                          const ctxVal = ctxRef ? ctxRef[aKey] : null
                          return (
                            <tr key={a.key}>
                              <Td><strong>{a.label}</strong></Td>
                              {data.map(r => {
                                const v = r[aKey]
                                const mejor = ctxVal && v > ctxVal
                                return (
                                  <Td key={r.anio} center>
                                    <span style={{ fontWeight: 700, color: mejor ? C.green : C.navy }}>
                                      {v.toFixed(1)}
                                    </span>
                                  </Td>
                                )
                              })}
                              {ctxRef && <Td center color={C.gray}>{ctxVal?.toFixed(1)}</Td>}
                            </tr>
                          )
                        })}
                        <tr style={{ background: C.bg }}>
                          <Td><strong>Ponderado</strong></Td>
                          {data.map(r => <Td key={r.anio} center bold color={C.navy}>{r.pond.toFixed(3)}</Td>)}
                          {ctxRef && <Td center color={C.gray}>{ctxRef.pond.toFixed(3)}</Td>}
                        </tr>
                        <tr>
                          <Td><strong>Global</strong></Td>
                          {data.map(r => <Td key={r.anio} center bold color={C.navy}>{r.glob.toFixed(1)}</Td>)}
                          {ctxRef && <Td center color={C.gray}>{ctxRef.glob.toFixed(1)}</Td>}
                        </tr>
                        <tr>
                          <Td><strong>Colegios</strong></Td>
                          {data.map(r => <Td key={r.anio} center color={C.gray}>{r.colegios.toLocaleString('es-CO')}</Td>)}
                          {ctxRef && <Td center color={C.gray}>{ctxRef.colegios.toLocaleString('es-CO')}</Td>}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Evolución ─────────────────────────────────────────────── */}
              {tab === 'evolucion' && (
                <div>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, color: C.gray, marginBottom: 20 }}>
                    Evolución del puntaje promedio ponderado y global a lo largo de los años
                  </div>
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart data={evolucionData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                      <XAxis dataKey="año" tick={{ fontFamily: 'Inter', fontSize: 12 }} />
                      <YAxis domain={['auto','auto']} tick={{ fontFamily: 'Inter', fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: 12 }} />
                      <Line type="monotone" dataKey="Ponderado" stroke={C.green} strokeWidth={3}
                        dot={{ r: 6, fill: C.green }} activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="Global" stroke={C.navy} strokeWidth={2}
                        dot={{ r: 5, fill: C.navy }} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>

                  <div style={{ marginTop: 24, display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
                    {[...data].reverse().map((r, i) => {
                      const prev = data[data.length - 2 - i]
                      const diff = prev ? r.pond - prev.pond : null
                      return (
                        <div key={r.anio} style={{ background: C.white, borderRadius: 10,
                          padding: '14px 18px', border: `1px solid ${C.grayLt}`,
                          borderLeft: `4px solid ${diff > 0 ? C.green : diff < 0 ? C.red : C.grayLt}` }}>
                          <div style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter', marginBottom: 4 }}>{r.anio}</div>
                          <div style={{ fontSize: 22, fontFamily: 'Playfair Display,serif', color: C.navy, fontWeight: 700 }}>
                            {r.pond.toFixed(3)}
                          </div>
                          {diff !== null && (
                            <div style={{ fontSize: 12, fontFamily: 'Inter', marginTop: 4,
                              color: diff > 0 ? C.green : diff < 0 ? C.red : C.gray }}>
                              {diff > 0 ? `↑ +${diff.toFixed(3)}` : diff < 0 ? `↓ ${diff.toFixed(3)}` : '→ Sin cambio'}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter', marginTop: 2 }}>
                            Global: {r.glob.toFixed(1)} · {r.colegios} col.
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── vs Contexto ───────────────────────────────────────────── */}
              {tab === 'vscontexto' && (
                <div>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, color: C.gray, marginBottom: 20 }}>
                    Promedio de <strong style={{ color: C.navy }}>{nombre}</strong> vs <strong style={{ color: C.green }}>{ctxLabel}</strong> — año {refRow?.anio}
                  </div>
                  {!ctxRef ? (
                    <div style={{ textAlign: 'center', padding: 60, color: C.gray, fontFamily: 'Inter' }}>
                      No hay datos de contexto disponibles para {ctxLabel}.
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={360}>
                        <BarChart data={vsCtxData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                          <XAxis dataKey="area" tick={{ fontFamily: 'Inter', fontSize: 12 }} />
                          <YAxis domain={[40, 100]} tick={{ fontFamily: 'Inter', fontSize: 11 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: 12 }} />
                          <ReferenceLine y={60} stroke={C.amber} strokeDasharray="4 4" />
                          <ReferenceLine y={75} stroke={C.green} strokeDasharray="4 4" />
                          <Bar dataKey={nombre}    fill={C.navy}  radius={[4,4,0,0]} />
                          <Bar dataKey={ctxLabel}  fill={C.green} fillOpacity={0.55} radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>

                      <div style={{ marginTop: 24, overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter' }}>
                          <thead>
                            <tr>
                              <Th>Área</Th>
                              <Th center>{nombre}</Th>
                              <Th center>{ctxLabel}</Th>
                              <Th center>Diferencia</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {AREAS.map(a => {
                              const aKey = a.key === 'lectura_critica' ? 'lc' : a.key === 'matematicas' ? 'mat' : a.key === 'ciencias_sociales' ? 'cs' : a.key === 'ciencias_naturales' ? 'cn' : 'ing'
                              const eV = refRow ? refRow[aKey] : 0
                              const cV = ctxRef ? ctxRef[aKey] : 0
                              const diff = eV - cV
                              return (
                                <tr key={a.key}>
                                  <Td><strong>{a.label}</strong></Td>
                                  <Td center bold color={C.navy}>{eV.toFixed(1)}</Td>
                                  <Td center color={C.gray}>{cV.toFixed(1)}</Td>
                                  <Td center>
                                    <span style={{ fontWeight: 700, color: diff >= 0 ? C.green : C.red }}>
                                      {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                                    </span>
                                  </Td>
                                </tr>
                              )
                            })}
                            <tr style={{ background: C.bg }}>
                              <Td><strong>Ponderado</strong></Td>
                              <Td center bold color={C.navy}>{refRow.pond.toFixed(3)}</Td>
                              <Td center color={C.gray}>{ctxRef.pond.toFixed(3)}</Td>
                              <Td center>
                                <span style={{ fontWeight: 700,
                                  color: refRow.pond >= ctxRef.pond ? C.green : C.red }}>
                                  {refRow.pond >= ctxRef.pond ? '+' : ''}{(refRow.pond - ctxRef.pond).toFixed(3)}
                                </span>
                              </Td>
                            </tr>
                            <tr>
                              <Td><strong>Global</strong></Td>
                              <Td center bold color={C.navy}>{refRow.glob.toFixed(1)}</Td>
                              <Td center color={C.gray}>{ctxRef.glob.toFixed(1)}</Td>
                              <Td center>
                                <span style={{ fontWeight: 700,
                                  color: refRow.glob >= ctxRef.glob ? C.green : C.red }}>
                                  {refRow.glob >= ctxRef.glob ? '+' : ''}{(refRow.glob - ctxRef.glob).toFixed(1)}
                                </span>
                              </Td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Radar ─────────────────────────────────────────────────── */}
              {tab === 'radar' && (
                <div>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, color: C.gray, marginBottom: 20 }}>
                    Perfil por áreas — {refRow?.anio} · {nombre} vs {ctxLabel}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke={C.bg2} />
                        <PolarAngleAxis dataKey="area" tick={{ fontFamily: 'Inter', fontSize: 13, fill: C.text }} />
                        <Radar name={nombre} dataKey={nombre} stroke={C.navy} fill={C.navy} fillOpacity={0.25} strokeWidth={2} />
                        {ctxRef && (
                          <Radar name={ctxLabel} dataKey={ctxLabel} stroke={C.green} fill={C.green} fillOpacity={0.15} strokeWidth={2} />
                        )}
                        <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                      </RadarChart>
                    </ResponsiveContainer>

                    <div>
                      <div style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: C.navy,
                        marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Detalle {refRow?.anio}
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter' }}>
                        <thead>
                          <tr>
                            <Th>Área</Th>
                            <Th center>{nombre}</Th>
                            {ctxRef && <Th center>{ctxLabel}</Th>}
                            {ctxRef && <Th center>Dif.</Th>}
                          </tr>
                        </thead>
                        <tbody>
                          {AREAS.map(a => {
                            const aKey = a.key === 'lectura_critica' ? 'lc' : a.key === 'matematicas' ? 'mat' : a.key === 'ciencias_sociales' ? 'cs' : a.key === 'ciencias_naturales' ? 'cn' : 'ing'
                            const eV = refRow ? refRow[aKey] : 0
                            const cV = ctxRef ? ctxRef[aKey] : null
                            const diff = cV != null ? eV - cV : null
                            return (
                              <tr key={a.key}>
                                <Td>{a.label}</Td>
                                <Td center bold color={C.navy}>{eV.toFixed(1)}</Td>
                                {ctxRef && <Td center color={C.gray}>{cV?.toFixed(1) ?? '—'}</Td>}
                                {ctxRef && (
                                  <Td center>
                                    {diff != null && (
                                      <span style={{ fontWeight: 600, color: diff >= 0 ? C.green : C.red }}>
                                        {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                                      </span>
                                    )}
                                  </Td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Top Colegios ──────────────────────────────────────────── */}
              {tab === 'colegios' && (
                <div>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, color: C.gray, marginBottom: 20 }}>
                    Top 20 colegios en <strong style={{ color: C.navy }}>{nombre}</strong> — año {anioRef || 2024}
                  </div>
                  {topCol.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: C.gray, fontFamily: 'Inter' }}>
                      No hay colegios disponibles para este año.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter' }}>
                        <thead>
                          <tr>
                            <Th>#</Th>
                            <Th>Institución</Th>
                            {tipo !== 'municipio' && <Th>Ciudad</Th>}
                            {tipo === 'region' && <Th>Departamento</Th>}
                            <Th center>Cal.</Th>
                            <Th center>Nat.</Th>
                            <Th center>Eval.</Th>
                            <Th center>L.C.</Th>
                            <Th center>Mat.</Th>
                            <Th center>C.S.</Th>
                            <Th center>C.N.</Th>
                            <Th center>Ing.</Th>
                            <Th center>Pond.</Th>
                            <Th center>Global</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {topCol.map((c, i) => (
                            <tr key={i} style={{
                              background: i === 0 ? '#FFFDE7' : i === 1 ? '#FFF8E1' : i === 2 ? '#F9FBE7' : i % 2 === 0 ? C.bg : 'transparent',
                              borderBottom: `1px solid ${C.bg2}`,
                            }}>
                              <Td bold color={C.navy} center>
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : c.puesto_anio}
                              </Td>
                              <Td>
                                <div style={{ fontWeight: 600, color: C.navy, maxWidth: 200,
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {c.nombre}
                                </div>
                              </Td>
                              {tipo !== 'municipio' && <Td color={C.gray} style={{ fontSize: 11 }}>{c.ciudad}</Td>}
                              {tipo === 'region' && <Td color={C.gray} style={{ fontSize: 11 }}>{c.departamento}</Td>}
                              <Td center>
                                <span style={{ background: c.calendario === 'B' ? C.navy+'18' : C.green+'18',
                                  color: c.calendario === 'B' ? C.navy : C.green,
                                  padding: '2px 6px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                                  {c.calendario}
                                </span>
                              </Td>
                              <Td center color={C.gray} style={{ fontSize: 10 }}>
                                {c.naturaleza === 'NO OFICIAL' ? 'Priv.' : c.naturaleza === 'OFICIAL' ? 'Of.' : c.naturaleza}
                              </Td>
                              <Td center color={C.gray}>{c.eval_estudiantes}</Td>
                              <Td center><ScoreChip val={c.lectura_critica} /></Td>
                              <Td center><ScoreChip val={c.matematicas} /></Td>
                              <Td center><ScoreChip val={c.ciencias_sociales} /></Td>
                              <Td center><ScoreChip val={c.ciencias_naturales} /></Td>
                              <Td center><ScoreChip val={c.ingles} /></Td>
                              <Td center bold color={C.navy}>{parseFloat(c.ponderado || 0).toFixed(2)}</Td>
                              <Td center bold color={C.navy}>{c.puntaje_global}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Histórico ─────────────────────────────────────────────── */}
              {tab === 'historico' && (
                <div>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, color: C.gray, marginBottom: 20 }}>
                    Resumen histórico por año — promedios de {TIPO_LABEL[tipo].toLowerCase()}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter' }}>
                      <thead>
                        <tr>
                          <Th>Año</Th>
                          <Th center>Colegios</Th>
                          <Th center>Estudiantes</Th>
                          <Th center>L.C.</Th>
                          <Th center>Mat.</Th>
                          <Th center>C.S.</Th>
                          <Th center>C.N.</Th>
                          <Th center>Inglés</Th>
                          <Th center>Ponderado</Th>
                          <Th center>Global</Th>
                          <Th center>Δ Pond.</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...data].reverse().map((r, i) => {
                          const prev = data[data.length - 2 - i]
                          const delta = prev ? r.pond - prev.pond : null
                          return (
                            <tr key={r.anio} style={{
                              background: i === 0 ? C.green+'0A' : i % 2 === 0 ? C.bg : 'transparent',
                            }}>
                              <Td bold color={C.navy}>
                                {r.anio}
                                {i === 0 && <span style={{ marginLeft: 6, fontSize: 10,
                                  background: C.green+'20', color: C.green,
                                  padding: '1px 6px', borderRadius: 8 }}>Último</span>}
                              </Td>
                              <Td center color={C.gray}>{r.colegios.toLocaleString('es-CO')}</Td>
                              <Td center color={C.gray}>{r.estudiantes.toLocaleString('es-CO')}</Td>
                              <Td center><ScoreChip val={r.lc} /></Td>
                              <Td center><ScoreChip val={r.mat} /></Td>
                              <Td center><ScoreChip val={r.cs} /></Td>
                              <Td center><ScoreChip val={r.cn} /></Td>
                              <Td center><ScoreChip val={r.ing} /></Td>
                              <Td center bold color={C.navy}>{r.pond.toFixed(3)}</Td>
                              <Td center bold color={C.navy}>{r.glob.toFixed(1)}</Td>
                              <Td center>
                                {delta !== null ? (
                                  <span style={{ fontWeight: 700,
                                    color: delta > 0 ? C.green : delta < 0 ? C.red : C.gray }}>
                                    {delta > 0 ? '+' : ''}{delta.toFixed(3)}
                                  </span>
                                ) : <span style={{ color: C.grayLt }}>—</span>}
                              </Td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
