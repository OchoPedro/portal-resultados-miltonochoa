import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { C } from '../../components/ui'
import { DEPTO_REGION } from './AdminRanking'

const REGIONES_DEPTS = {
  'Andina':    ['ANTIOQUIA','BOGOTÁ D.C.','BOYACÁ','CALDAS','CUNDINAMARCA','HUILA','NORTE SANTANDER','QUINDÍO','RISARALDA','SANTANDER','TOLIMA'],
  'Caribe':    ['ATLÁNTICO','BOLÍVAR','CESAR','CÓRDOBA','LA GUAJIRA','MAGDALENA','SUCRE','SAN ANDRÉS'],
  'Pacífica':  ['CAUCA','CHOCÓ','NARIÑO','VALLE DEL CAUCA'],
  'Orinoquía': ['ARAUCA','CASANARE','META','VICHADA'],
  'Amazonía':  ['AMAZONAS','CAQUETÁ','GUAINÍA','GUAVIARE','PUTUMAYO','VAUPÉS'],
}
import {
  BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

const AREAS = [
  { key: 'lectura_critica',    label: 'Lectura Crítica',        short: 'L.C.' },
  { key: 'matematicas',        label: 'Matemáticas',            short: 'Mat.' },
  { key: 'ciencias_sociales',  label: 'Sociales y Ciudadanas',  short: 'C.S.' },
  { key: 'ciencias_naturales', label: 'Ciencias Naturales',     short: 'C.N.' },
  { key: 'ingles',             label: 'Inglés',                 short: 'Ing.' },
]

// Paleta por año
const AÑO_COLORS = {
  2020: '#94A3B8', 2021: '#60A5FA', 2022: '#34D399',
  2023: '#FBBF24', 2024: '#F87171', 2025: '#2D9B6F',
}

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
const Td = ({ children, center, bold, color }) => (
  <td style={{
    padding: '10px 12px', fontSize: 12, fontFamily: 'Inter',
    textAlign: center ? 'center' : 'left',
    fontWeight: bold ? 700 : 400, color: color || C.text,
    borderBottom: `1px solid ${C.bg2}`,
  }}>{children}</td>
)

const ScoreChip = ({ val }) => {
  if (val == null || val === '') return <span style={{ color: C.grayLt }}>—</span>
  const n = parseFloat(val)
  const color = n >= 75 ? C.green : n >= 60 ? C.navy : n >= 50 ? C.amber : C.red
  return <span style={{ fontWeight: 700, color }}>{n.toFixed(1)}</span>
}

const PuestoChip = ({ val, total }) => {
  if (!val) return <span style={{ color: C.grayLt }}>—</span>
  const style = val <= 3
    ? { background: '#FFF8E1', color: '#B7791F', border: '1px solid #F6E05E', padding: '2px 8px', borderRadius: 12, fontWeight: 700, fontSize: 12 }
    : val <= 10
    ? { background: C.green + '18', color: C.green, border: `1px solid ${C.green}40`, padding: '2px 8px', borderRadius: 12, fontWeight: 600, fontSize: 12 }
    : { color: C.text, fontSize: 12 }
  return <span style={style}>#{val}{total ? <span style={{ fontWeight: 400, color: C.gray, fontSize: 11 }}> de {total.toLocaleString('es-CO')}</span> : ''}</span>
}

// ── Tooltip personalizado ────────────────────────────────────────────────────
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

export default function ReportePlantel({ codigo, nombre, onClose }) {
  const [tab, setTab]           = useState('comparativo')
  const [data, setData]         = useState([])
  const [deptData, setDept]     = useState([])
  const [regionData, setRegion] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!codigo) return
    loadData()
  }, [codigo])

  const loadData = async () => {
    setLoading(true)

    // 1. Datos del plantel
    const { data: rows } = await supabase
      .from('ranking_colegios')
      .select('*')
      .eq('codigo', codigo)
      .order('anio', { ascending: true })

    setData(rows || [])

    // 2. Promedios departamento (para los años y departamento del plantel)
    if (rows?.length) {
      const depto = rows[rows.length - 1].departamento
      const anios = rows.map(r => r.anio)

      const { data: dRows } = await supabase
        .from('ranking_colegios')
        .select('anio,lectura_critica,matematicas,ciencias_sociales,ciencias_naturales,ingles,ponderado,puntaje_global')
        .eq('departamento', depto)
        .in('anio', anios)
        .limit(50000)

      // Agrupar por año y calcular promedios
      const byYear = {}
      ;(dRows || []).forEach(r => {
        if (!byYear[r.anio]) byYear[r.anio] = { n: 0, lc:0, mat:0, cs:0, cn:0, ing:0, pond:0, glob:0 }
        const y = byYear[r.anio]
        y.n++
        y.lc   += parseFloat(r.lectura_critica || 0)
        y.mat  += parseFloat(r.matematicas || 0)
        y.cs   += parseFloat(r.ciencias_sociales || 0)
        y.cn   += parseFloat(r.ciencias_naturales || 0)
        y.ing  += parseFloat(r.ingles || 0)
        y.pond += parseFloat(r.ponderado || 0)
        y.glob += parseFloat(r.puntaje_global || 0)
      })
      const deptAvgs = Object.entries(byYear).map(([anio, v]) => ({
        anio: parseInt(anio),
        lectura_critica:   v.n ? v.lc/v.n   : null,
        matematicas:       v.n ? v.mat/v.n   : null,
        ciencias_sociales: v.n ? v.cs/v.n    : null,
        ciencias_naturales:v.n ? v.cn/v.n    : null,
        ingles:            v.n ? v.ing/v.n   : null,
        ponderado:         v.n ? v.pond/v.n  : null,
        puntaje_global:    v.n ? v.glob/v.n  : null,
        total_colegios:    v.n,
      }))
      setDept(deptAvgs)

      // 3. Promedios región
      const region = DEPTO_REGION[depto]
      const regionDepts = region ? REGIONES_DEPTS[region] : []
      if (regionDepts.length) {
        const { data: rRows } = await supabase
          .from('ranking_colegios')
          .select('anio,lectura_critica,matematicas,ciencias_sociales,ciencias_naturales,ingles,ponderado,puntaje_global')
          .in('departamento', regionDepts)
          .in('anio', anios)
          .limit(50000)

        const byYearR = {}
        ;(rRows || []).forEach(r => {
          if (!byYearR[r.anio]) byYearR[r.anio] = { n:0, lc:0, mat:0, cs:0, cn:0, ing:0, pond:0, glob:0 }
          const y = byYearR[r.anio]
          y.n++
          y.lc   += parseFloat(r.lectura_critica || 0)
          y.mat  += parseFloat(r.matematicas || 0)
          y.cs   += parseFloat(r.ciencias_sociales || 0)
          y.cn   += parseFloat(r.ciencias_naturales || 0)
          y.ing  += parseFloat(r.ingles || 0)
          y.pond += parseFloat(r.ponderado || 0)
          y.glob += parseFloat(r.puntaje_global || 0)
        })
        setRegion(Object.entries(byYearR).map(([anio, v]) => ({
          anio: parseInt(anio),
          lectura_critica:    v.n ? v.lc/v.n   : null,
          matematicas:        v.n ? v.mat/v.n   : null,
          ciencias_sociales:  v.n ? v.cs/v.n    : null,
          ciencias_naturales: v.n ? v.cn/v.n    : null,
          ingles:             v.n ? v.ing/v.n   : null,
          ponderado:          v.n ? v.pond/v.n  : null,
          puntaje_global:     v.n ? v.glob/v.n  : null,
          total_colegios:     v.n,
          region,
        })))
      }
    }

    setLoading(false)
  }

  if (!codigo) return null

  const ultimo = data[data.length - 1]
  const primero = data[0]
  const tendencia = data.length >= 2
    ? data[data.length-1].puesto_anio < data[data.length-2].puesto_anio ? '↑'
      : data[data.length-1].puesto_anio === data[data.length-2].puesto_anio ? '→'
      : '↓'
    : '—'

  // ── Datos para gráficas ───────────────────────────────────────────────────

  // Comparativo Plantel: por área, un valor por año
  const comparativoData = AREAS.map(a => {
    const entry = { area: a.short, areaFull: a.label }
    data.forEach(r => { entry[r.anio] = parseFloat(r[a.key] || 0) })
    return entry
  })

  // Tendencia del puntaje por año (línea)
  const tendenciaData = data.map(r => ({
    año: r.anio,
    Ponderado:  parseFloat(r.ponderado || 0),
    Global:     parseFloat(r.puntaje_global || 0),
    Evaluados:  r.eval_estudiantes,
  }))

  // Comparativo Departamento: plantel vs depto por área
  const compDeptoData = AREAS.map(a => {
    const entry = { area: a.short }
    data.forEach(r => {
      const dRow = deptData.find(d => d.anio === r.anio)
      if (dRow) {
        entry[`Plantel ${r.anio}`] = parseFloat(r[a.key] || 0)
        entry[`Depto ${r.anio}`]   = parseFloat(dRow[a.key] || 0).toFixed(1)
      }
    })
    return entry
  })

  // Comparativo Región: plantel vs promedio regional por área (último año disponible en ambos)
  const regionNombre = ultimo ? DEPTO_REGION[ultimo.departamento] : null
  const compRegionData = AREAS.map(a => {
    const entry = { area: a.short }
    data.forEach(r => {
      const rRow = regionData.find(d => d.anio === r.anio)
      if (rRow) {
        entry[`Plantel ${r.anio}`] = parseFloat(r[a.key] || 0)
        entry[`Región ${r.anio}`]  = parseFloat(rRow[a.key] || 0)
      }
    })
    return entry
  })

  // Desviación estándar entre áreas (homogeneidad del plantel)
  const calcDesv = (row) => {
    const vals = ['lectura_critica','matematicas','ciencias_sociales','ciencias_naturales','ingles']
      .map(k => parseFloat(row[k] || 0)).filter(v => v > 0)
    if (vals.length < 2) return null
    const mean = vals.reduce((s,v) => s+v, 0) / vals.length
    return Math.sqrt(vals.reduce((s,v) => s + (v-mean)**2, 0) / vals.length)
  }

  // Ranking histórico (línea invertida: puesto 1 = mejor)
  const rankingData = data.map(r => ({
    año: r.anio,
    'Puesto Nacional': r.puesto_anio,
  }))

  // Radar último año
  const radarData = AREAS.map(a => ({
    area: a.short,
    Plantel: parseFloat(ultimo?.[a.key] || 0),
    Depto:   parseFloat(deptData.find(d => d.anio === ultimo?.anio)?.[a.key] || 0),
  }))

  const años = data.map(r => r.anio)

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
              Reporte de Plantel · Saber 11°
            </div>
            <div style={{ fontSize: 22, color: C.white, fontFamily: 'Playfair Display, serif',
              fontWeight: 600, marginBottom: 8 }}>{nombre || codigo}</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Código', value: codigo },
                { label: 'Ciudad', value: ultimo?.ciudad },
                { label: 'Departamento', value: ultimo?.departamento },
                { label: 'Calendario', value: ultimo?.calendario },
                { label: 'Jornada', value: ultimo?.jornada },
                { label: 'Naturaleza', value: ultimo?.naturaleza },
              ].map(item => item.value && (
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

        {/* KPIs rápidos */}
        {!loading && ultimo && (
          <div style={{ background: C.white, borderBottom: `1px solid ${C.grayLt}`,
            padding: '12px 28px', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {[
              { label: 'Último año', value: ultimo.anio },
              { label: 'Puesto Nacional', value: `#${ultimo.puesto_anio}` },
              { label: 'Puntaje Global', value: ultimo.puntaje_global },
              { label: 'Ponderado', value: parseFloat(ultimo.ponderado || 0).toFixed(3) },
              { label: 'Evaluados', value: ultimo.eval_estudiantes },
              { label: 'Años en ranking', value: data.length },
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
            { id: 'comparativo',  label: 'Comparativo Plantel' },
            { id: 'puestos',      label: 'Puestos Plantel' },
            { id: 'departamento', label: 'Comparativo Departamento' },
            { id: 'promedios',    label: 'Promedios Plantel' },
            { id: 'ranking',      label: 'Tendencia Ranking' },
            { id: 'region',       label: 'Comparativo Región' },
            { id: 'radar',        label: 'Perfil por Áreas' },
          ].map(t => <Tab key={t.id} label={t.label} active={tab===t.id} onClick={() => setTab(t.id)} />)}
        </div>

        {/* CONTENIDO */}
        <div style={{ padding: 28, minHeight: 420 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 80, color: C.gray, fontFamily: 'Inter' }}>
              Cargando datos del plantel...
            </div>
          ) : data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80, color: C.gray, fontFamily: 'Inter' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
              No hay datos de ranking disponibles para este colegio.
            </div>
          ) : (
            <>
              {/* ── Comparativo Plantel ──────────────────────────────────── */}
              {tab === 'comparativo' && (
                <div>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, color: C.gray, marginBottom: 20 }}>
                    Puntaje por área académica en cada año disponible
                  </div>
                  <ResponsiveContainer width="100%" height={380}>
                    <BarChart data={comparativoData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                      <XAxis dataKey="area" tick={{ fontFamily:'Inter', fontSize:12 }} />
                      <YAxis domain={[40, 100]} tick={{ fontFamily:'Inter', fontSize:11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontFamily:'Inter', fontSize:12 }} />
                      <ReferenceLine y={60} stroke={C.amber} strokeDasharray="4 4" label={{ value:'60', position:'right', fontSize:10 }} />
                      <ReferenceLine y={75} stroke={C.green} strokeDasharray="4 4" label={{ value:'75', position:'right', fontSize:10 }} />
                      {años.map(a => (
                        <Bar key={a} dataKey={a} name={String(a)} fill={AÑO_COLORS[a] || '#94A3B8'} radius={[3,3,0,0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Tabla resumen de puntajes */}
                  <div style={{ marginTop: 24, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter' }}>
                      <thead>
                        <tr>
                          <Th>Área</Th>
                          {años.map(a => <Th key={a} center>{a}</Th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {AREAS.map(a => (
                          <tr key={a.key}>
                            <Td><strong>{a.label}</strong></Td>
                            {data.map(r => <Td key={r.anio} center><ScoreChip val={r[a.key]} /></Td>)}
                          </tr>
                        ))}
                        <tr style={{ background: C.bg }}>
                          <Td><strong>Ponderado</strong></Td>
                          {data.map(r => <Td key={r.anio} center bold color={C.navy}>{parseFloat(r.ponderado||0).toFixed(3)}</Td>)}
                        </tr>
                        <tr>
                          <Td><strong>Puntaje Global</strong></Td>
                          {data.map(r => <Td key={r.anio} center bold color={C.navy}>{r.puntaje_global}</Td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Puestos Plantel ──────────────────────────────────────── */}
              {tab === 'puestos' && (
                <div>
                  <div style={{ fontFamily:'Inter', fontSize:13, color:C.gray, marginBottom:20 }}>
                    Posición en el ranking nacional y de periodo por año
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                      <thead>
                        <tr>
                          <Th>Año</Th>
                          <Th center>Puesto Nacional</Th>
                          <Th center>Puesto Periodo</Th>
                          <Th center>Evaluados</Th>
                          <Th center>L.C.</Th>
                          <Th center>Mat.</Th>
                          <Th center>C.S.</Th>
                          <Th center>C.N.</Th>
                          <Th center>Inglés</Th>
                          <Th center>Ponderado</Th>
                          <Th center>Global</Th>
                          <Th center>Desv. Áreas</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...data].reverse().map((r, i) => {
                          const prev = data[data.length - 2 - i]
                          const mejoro = prev && r.puesto_anio < prev.puesto_anio
                          const bajo   = prev && r.puesto_anio > prev.puesto_anio
                          return (
                            <tr key={r.anio} style={{ background: i === 0 ? C.green+'0A' : 'transparent' }}>
                              <Td><strong style={{ color:C.navy }}>{r.anio}</strong>
                                {i === 0 && <span style={{ marginLeft:6, fontSize:10, background:C.green+'20',
                                  color:C.green, padding:'1px 6px', borderRadius:8 }}>Último</span>}
                              </Td>
                              <Td center>
                                <PuestoChip val={r.puesto_anio} />
                                {mejoro && <span style={{ color:C.green, fontSize:12, marginLeft:4 }}>↑</span>}
                                {bajo   && <span style={{ color:C.red,   fontSize:12, marginLeft:4 }}>↓</span>}
                              </Td>
                              <Td center><PuestoChip val={r.puesto_periodo} /></Td>
                              <Td center color={C.gray}>{r.eval_estudiantes || '—'}</Td>
                              <Td center><ScoreChip val={r.lectura_critica} /></Td>
                              <Td center><ScoreChip val={r.matematicas} /></Td>
                              <Td center><ScoreChip val={r.ciencias_sociales} /></Td>
                              <Td center><ScoreChip val={r.ciencias_naturales} /></Td>
                              <Td center><ScoreChip val={r.ingles} /></Td>
                              <Td center bold color={C.navy}>{parseFloat(r.ponderado||0).toFixed(3)}</Td>
                              <Td center bold color={C.navy}>{r.puntaje_global}</Td>
                              <Td center>
                                {(() => {
                                  const d = calcDesv(r)
                                  if (d == null) return <span style={{color:C.gray}}>—</span>
                                  const color = d <= 3 ? C.green : d <= 6 ? C.amber : C.red
                                  return (
                                    <span style={{ fontWeight:700, color }}>
                                      {d.toFixed(2)}
                                      <span style={{ fontSize:10, color:C.gray, fontWeight:400, marginLeft:4 }}>
                                        {d <= 3 ? '✓' : d <= 6 ? '~' : '⚠'}
                                      </span>
                                    </span>
                                  )
                                })()}
                              </Td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Comparativo Departamento ─────────────────────────────── */}
              {tab === 'departamento' && (
                <div>
                  <div style={{ fontFamily:'Inter', fontSize:13, color:C.gray, marginBottom:20 }}>
                    Puntaje del plantel vs promedio del departamento <strong style={{color:C.navy}}>{ultimo?.departamento}</strong>
                  </div>
                  {deptData.length === 0 ? (
                    <div style={{ textAlign:'center', padding:60, color:C.gray, fontFamily:'Inter' }}>
                      Cargando promedios departamentales...
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={360}>
                        <BarChart data={AREAS.map(a => {
                          const entry = { area: a.short }
                          data.forEach(r => {
                            const d = deptData.find(x => x.anio === r.anio)
                            entry[`Plantel ${r.anio}`] = parseFloat(r[a.key]||0)
                            if (d) entry[`Depto ${r.anio}`] = +parseFloat(d[a.key]||0).toFixed(1)
                          })
                          return entry
                        })} margin={{ top:10, right:20, left:0, bottom:10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                          <XAxis dataKey="area" tick={{ fontFamily:'Inter', fontSize:12 }} />
                          <YAxis domain={[40,100]} tick={{ fontFamily:'Inter', fontSize:11 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontFamily:'Inter', fontSize:12 }} />
                          {años.map((a,i) => [
                            <Bar key={`p${a}`} dataKey={`Plantel ${a}`} fill={AÑO_COLORS[a] || '#94A3B8'} radius={[3,3,0,0]} />,
                            <Bar key={`d${a}`} dataKey={`Depto ${a}`}   fill={AÑO_COLORS[a] + '70'} radius={[3,3,0,0]} />,
                          ])}
                        </BarChart>
                      </ResponsiveContainer>

                      <div style={{ marginTop:24, overflowX:'auto' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                          <thead>
                            <tr>
                              <Th>Año</Th>
                              {AREAS.map(a => [
                                <Th key={`p${a.key}`} center>Plantel {a.short}</Th>,
                                <Th key={`d${a.key}`} center>Depto {a.short}</Th>,
                              ])}
                              <Th center>Pond. Plantel</Th>
                              <Th center>Pond. Depto</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...data].reverse().map(r => {
                              const d = deptData.find(x => x.anio === r.anio)
                              return (
                                <tr key={r.anio}>
                                  <Td><strong>{r.anio}</strong></Td>
                                  {AREAS.map(a => {
                                    const plantelVal = parseFloat(r[a.key]||0)
                                    const deptoVal   = d ? parseFloat(d[a.key]||0) : null
                                    const mejor      = deptoVal && plantelVal > deptoVal
                                    return [
                                      <Td key={`p${a.key}`} center>
                                        <span style={{ fontWeight:700, color: mejor ? C.green : C.navy }}>
                                          {plantelVal.toFixed(1)}
                                        </span>
                                      </Td>,
                                      <Td key={`d${a.key}`} center color={C.gray}>
                                        {deptoVal ? deptoVal.toFixed(1) : '—'}
                                      </Td>,
                                    ]
                                  })}
                                  <Td center bold color={C.navy}>{parseFloat(r.ponderado||0).toFixed(2)}</Td>
                                  <Td center color={C.gray}>{d ? parseFloat(d.ponderado||0).toFixed(2) : '—'}</Td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        {deptData[0] && (
                          <div style={{ marginTop:8, fontSize:11, color:C.gray, fontFamily:'Inter' }}>
                            * Promedio calculado sobre {deptData[0].total_colegios?.toLocaleString('es-CO')} instituciones del departamento
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Promedios Plantel ────────────────────────────────────── */}
              {tab === 'promedios' && (
                <div>
                  <div style={{ fontFamily:'Inter', fontSize:13, color:C.gray, marginBottom:20 }}>
                    Evolución histórica de puntajes del plantel por área
                  </div>
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart data={data.map(r => ({
                      año: r.anio,
                      'Lectura Crítica':    parseFloat(r.lectura_critica||0),
                      'Matemáticas':        parseFloat(r.matematicas||0),
                      'Sociales':           parseFloat(r.ciencias_sociales||0),
                      'C. Naturales':       parseFloat(r.ciencias_naturales||0),
                      'Inglés':             parseFloat(r.ingles||0),
                    }))} margin={{ top:10, right:20, left:0, bottom:10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                      <XAxis dataKey="año" tick={{ fontFamily:'Inter', fontSize:12 }} />
                      <YAxis domain={[40,100]} tick={{ fontFamily:'Inter', fontSize:11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontFamily:'Inter', fontSize:12 }} />
                      <ReferenceLine y={60} stroke={C.amber} strokeDasharray="4 4" />
                      <ReferenceLine y={75} stroke={C.green} strokeDasharray="4 4" />
                      {[
                        { key:'Lectura Crítica', color:'#3B82F6' },
                        { key:'Matemáticas',     color:'#10B981' },
                        { key:'Sociales',        color:'#F59E0B' },
                        { key:'C. Naturales',    color:'#8B5CF6' },
                        { key:'Inglés',          color:'#EF4444' },
                      ].map(l => (
                        <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color}
                          strokeWidth={2.5} dot={{ r:5, fill:l.color }} activeDot={{ r:7 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Tabla de puntajes y desviación por año */}
                  <div style={{ marginTop:24, overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                      <thead>
                        <tr>
                          <Th>Año</Th>
                          <Th center>L.C.</Th><Th center>Mat.</Th><Th center>C.S.</Th>
                          <Th center>C.N.</Th><Th center>Inglés</Th>
                          <Th center>Prom. Áreas</Th>
                          <Th center>Desv. Áreas</Th>
                          <Th center>Ponderado</Th><Th center>Global</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...data].reverse().map((r,i) => {
                          const desv = calcDesv(r)
                          const areas = ['lectura_critica','matematicas','ciencias_sociales','ciencias_naturales','ingles']
                          const vals = areas.map(k=>parseFloat(r[k]||0)).filter(v=>v>0)
                          const prom = vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : 0
                          const dc = desv == null ? C.gray : desv<=3 ? C.green : desv<=6 ? C.amber : C.red
                          return (
                            <tr key={r.anio} style={{ background: i===0 ? C.green+'0A' : i%2===0 ? C.bg : 'transparent' }}>
                              <Td bold color={C.navy}>{r.anio}</Td>
                              <Td center><ScoreChip val={r.lectura_critica}/></Td>
                              <Td center><ScoreChip val={r.matematicas}/></Td>
                              <Td center><ScoreChip val={r.ciencias_sociales}/></Td>
                              <Td center><ScoreChip val={r.ciencias_naturales}/></Td>
                              <Td center><ScoreChip val={r.ingles}/></Td>
                              <Td center bold color={C.navy}>{prom.toFixed(1)}</Td>
                              <Td center>
                                {desv != null
                                  ? <span style={{fontWeight:700,color:dc}}>{desv.toFixed(2)} {desv<=3?'✓':desv<=6?'~':'⚠'}</span>
                                  : <span style={{color:C.gray}}>—</span>}
                              </Td>
                              <Td center bold color={C.navy}>{parseFloat(r.ponderado||0).toFixed(3)}</Td>
                              <Td center bold color={C.navy}>{r.puntaje_global}</Td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <div style={{ marginTop:10, fontSize:11, color:C.gray, fontFamily:'Inter' }}>
                      <strong>Desv. Áreas</strong>: desviación estándar entre las 5 áreas.
                      <span style={{color:C.green,marginLeft:6}}>✓ ≤3 Homogéneo</span>
                      <span style={{color:C.amber,marginLeft:6}}>~ 3-6 Moderado</span>
                      <span style={{color:C.red,marginLeft:6}}>⚠ &gt;6 Heterogéneo</span>
                    </div>
                  </div>

                  {/* Puntaje ponderado */}
                  <div style={{ marginTop:28 }}>
                    <div style={{ fontFamily:'Inter', fontSize:12, fontWeight:600, color:C.navy,
                      marginBottom:12, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                      Puntaje Ponderado y Global
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={tendenciaData} margin={{ top:5, right:20, left:0, bottom:5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                        <XAxis dataKey="año" tick={{ fontFamily:'Inter', fontSize:12 }} />
                        <YAxis yAxisId="pond" domain={[40,100]} tick={{ fontFamily:'Inter', fontSize:11 }} />
                        <YAxis yAxisId="glob" orientation="right" tick={{ fontFamily:'Inter', fontSize:11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontFamily:'Inter', fontSize:12 }} />
                        <Line yAxisId="pond" type="monotone" dataKey="Ponderado" stroke={C.green}
                          strokeWidth={3} dot={{ r:6, fill:C.green }} />
                        <Line yAxisId="glob" type="monotone" dataKey="Global" stroke={C.navy}
                          strokeWidth={2} dot={{ r:5, fill:C.navy }} strokeDasharray="5 5" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── Tendencia Ranking ────────────────────────────────────── */}
              {tab === 'ranking' && (
                <div>
                  <div style={{ fontFamily:'Inter', fontSize:13, color:C.gray, marginBottom:20 }}>
                    Evolución del puesto nacional — cuanto más bajo el número, mejor la posición
                  </div>
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart data={rankingData} margin={{ top:10, right:20, left:0, bottom:10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                      <XAxis dataKey="año" tick={{ fontFamily:'Inter', fontSize:12 }} />
                      <YAxis reversed domain={['dataMin - 50', 'dataMax + 50']}
                        tick={{ fontFamily:'Inter', fontSize:11 }}
                        label={{ value:'Puesto (↓ mejor)', angle:-90, position:'insideLeft', fontSize:11, fill:C.gray }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="Puesto Nacional" stroke={C.navy}
                        strokeWidth={3} dot={{ r:7, fill:C.navy }}
                        activeDot={{ r:9, stroke:C.green, strokeWidth:2 }} />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Resumen de movimiento */}
                  <div style={{ marginTop:24, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16 }}>
                    {[...data].reverse().map((r, i) => {
                      const prev = data[data.length - 2 - i]
                      const diff = prev ? prev.puesto_anio - r.puesto_anio : null
                      return (
                        <div key={r.anio} style={{ background:C.white, borderRadius:10,
                          padding:'14px 18px', border:`1px solid ${C.grayLt}`,
                          borderLeft:`4px solid ${diff > 0 ? C.green : diff < 0 ? C.red : C.grayLt}` }}>
                          <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginBottom:4 }}>{r.anio}</div>
                          <div style={{ fontSize:24, fontFamily:'Playfair Display,serif', color:C.navy, fontWeight:700 }}>
                            #{r.puesto_anio}
                          </div>
                          {diff !== null && (
                            <div style={{ fontSize:12, fontFamily:'Inter', marginTop:4,
                              color: diff > 0 ? C.green : diff < 0 ? C.red : C.gray }}>
                              {diff > 0 ? `↑ Subió ${diff} puestos` : diff < 0 ? `↓ Bajó ${Math.abs(diff)} puestos` : '→ Sin cambio'}
                            </div>
                          )}
                          <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginTop:2 }}>
                            Puntaje: {r.puntaje_global} · Eval: {r.eval_estudiantes}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Comparativo Regional ────────────────────────────────── */}
              {tab === 'region' && (
                <div>
                  <div style={{ fontFamily:'Inter', fontSize:13, color:C.gray, marginBottom:20 }}>
                    Puntaje del plantel vs promedio de la <strong style={{ color:C.navy }}>Región {regionNombre}</strong> por área académica
                  </div>
                  {regionData.length === 0 ? (
                    <div style={{ textAlign:'center', padding:60, color:C.gray, fontFamily:'Inter' }}>
                      No hay datos regionales disponibles.
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={360}>
                        <BarChart data={compRegionData} margin={{ top:10, right:20, left:0, bottom:10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                          <XAxis dataKey="area" tick={{ fontFamily:'Inter', fontSize:12 }} />
                          <YAxis domain={[40, 100]} tick={{ fontFamily:'Inter', fontSize:11 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontFamily:'Inter', fontSize:12 }} />
                          {años.map((a, i) => {
                            const keys = compRegionData[0] ? Object.keys(compRegionData[0]).filter(k => k !== 'area') : []
                            const plantelKey = keys.find(k => k.startsWith(`Plantel ${a}`))
                            const regionKey  = keys.find(k => k.startsWith(`Región ${a}`))
                            return plantelKey ? [
                              <Bar key={`p${a}`} dataKey={plantelKey} fill={AÑO_COLORS[a] || '#94A3B8'} radius={[4,4,0,0]} />,
                              <Bar key={`r${a}`} dataKey={regionKey}  fill={AÑO_COLORS[a] || '#94A3B8'} fillOpacity={0.35} radius={[4,4,0,0]} />,
                            ] : null
                          })}
                        </BarChart>
                      </ResponsiveContainer>

                      {/* Tabla resumen regional */}
                      <div style={{ marginTop:24, overflowX:'auto' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                          <thead>
                            <tr>
                              <Th>Año</Th>
                              <Th center>L.C. Plantel</Th><Th center>L.C. Región</Th>
                              <Th center>Mat. Plantel</Th><Th center>Mat. Región</Th>
                              <Th center>Global Plantel</Th><Th center>Global Región</Th>
                              <Th center>Colegios región</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.map(r => {
                              const rRow = regionData.find(d => d.anio === r.anio)
                              if (!rRow) return null
                              const diff = parseFloat(r.puntaje_global||0) - parseFloat(rRow.puntaje_global||0)
                              return (
                                <tr key={r.anio} style={{ background: r.anio % 2 === 0 ? C.bg : 'transparent' }}>
                                  <Td bold color={C.navy}>{r.anio}</Td>
                                  <Td center><ScoreChip val={r.lectura_critica}/></Td>
                                  <Td center><ScoreChip val={rRow.lectura_critica}/></Td>
                                  <Td center><ScoreChip val={r.matematicas}/></Td>
                                  <Td center><ScoreChip val={rRow.matematicas}/></Td>
                                  <Td center bold color={C.navy}>{parseFloat(r.puntaje_global||0).toFixed(1)}</Td>
                                  <Td center>{parseFloat(rRow.puntaje_global||0).toFixed(1)}</Td>
                                  <Td center>
                                    <span style={{ color: diff >= 0 ? C.green : C.red, fontWeight:600 }}>
                                      {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                                    </span>
                                    {' · '}{rRow.total_colegios?.toLocaleString('es-CO')} col.
                                  </Td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Radar por Áreas ──────────────────────────────────────── */}
              {tab === 'radar' && (
                <div>
                  <div style={{ fontFamily:'Inter', fontSize:13, color:C.gray, marginBottom:20 }}>
                    Perfil por áreas del último año disponible ({ultimo?.anio}) — plantel vs promedio departamento
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
                    <div>
                      <ResponsiveContainer width="100%" height={380}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke={C.bg2} />
                          <PolarAngleAxis dataKey="area" tick={{ fontFamily:'Inter', fontSize:13, fill:C.text }} />
                          <Radar name="Plantel" dataKey="Plantel" stroke={C.navy} fill={C.navy} fillOpacity={0.25} strokeWidth={2} />
                          {deptData.length > 0 && (
                            <Radar name={`Prom. ${ultimo?.departamento}`} dataKey="Depto"
                              stroke={C.green} fill={C.green} fillOpacity={0.15} strokeWidth={2} />
                          )}
                          <Legend wrapperStyle={{ fontFamily:'Inter', fontSize:12 }} />
                          <Tooltip content={<CustomTooltip />} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    <div>
                      <div style={{ fontFamily:'Inter', fontSize:12, fontWeight:600, color:C.navy,
                        marginBottom:14, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                        Detalle {ultimo?.anio}
                      </div>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                        <thead>
                          <tr>
                            <Th>Área</Th>
                            <Th center>Plantel</Th>
                            <Th center>Depto</Th>
                            <Th center>Diferencia</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {AREAS.map(a => {
                            const pVal = parseFloat(ultimo?.[a.key] || 0)
                            const dRow = deptData.find(d => d.anio === ultimo?.anio)
                            const dVal = dRow ? parseFloat(dRow[a.key] || 0) : null
                            const diff = dVal ? pVal - dVal : null
                            return (
                              <tr key={a.key}>
                                <Td>{a.label}</Td>
                                <Td center bold color={C.navy}>{pVal.toFixed(1)}</Td>
                                <Td center color={C.gray}>{dVal ? dVal.toFixed(1) : '—'}</Td>
                                <Td center>
                                  {diff !== null && (
                                    <span style={{ fontWeight:600,
                                      color: diff > 0 ? C.green : diff < 0 ? C.red : C.gray }}>
                                      {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                    </span>
                                  )}
                                </Td>
                              </tr>
                            )
                          })}
                          <tr style={{ background: C.bg }}>
                            <Td><strong>Ponderado</strong></Td>
                            <Td center bold color={C.navy}>{parseFloat(ultimo?.ponderado||0).toFixed(3)}</Td>
                            <Td center color={C.gray}>
                              {deptData.find(d=>d.anio===ultimo?.anio)
                                ? parseFloat(deptData.find(d=>d.anio===ultimo?.anio).ponderado||0).toFixed(3) : '—'}
                            </Td>
                            <Td center>
                              {(() => {
                                const dRow = deptData.find(d=>d.anio===ultimo?.anio)
                                if (!dRow) return null
                                const diff = parseFloat(ultimo?.ponderado||0) - parseFloat(dRow.ponderado||0)
                                return <span style={{ fontWeight:700, color: diff>0 ? C.green : C.red }}>
                                  {diff>0?'+':''}{diff.toFixed(3)}
                                </span>
                              })()}
                            </Td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
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
