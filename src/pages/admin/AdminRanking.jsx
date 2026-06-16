import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { C, useMobile } from '../../components/ui'
import ReportePlantel from './ReportePlantel'
import ReporteAgrupado from './ReporteAgrupado'
import * as XLSX from 'xlsx'

const ANIOS = [2026, 2025, 2024, 2023, 2022, 2021, 2020]
const POR_PAGINA = 100

const DEPARTAMENTOS_COL = [
  'AMAZONAS','ANTIOQUIA','ARAUCA','ATLÁNTICO','BOLÍVAR','BOYACÁ',
  'CALDAS','CAQUETÁ','CASANARE','CAUCA','CESAR','CHOCÓ','CÓRDOBA','CUNDINAMARCA',
  'GUAINÍA','GUAVIARE','HUILA','LA GUAJIRA','MAGDALENA','META','NARIÑO',
  'NORTE SANTANDER','PUTUMAYO','QUINDÍO','RISARALDA','SAN ANDRÉS','SANTANDER',
  'SUCRE','TOLIMA','VALLE DEL CAUCA','VAUPÉS','VICHADA',
]

const REGIONES_COL = {
  'Andina':    ['ANTIOQUIA','BOGOTÁ D.C.','BOYACÁ','CALDAS','CUNDINAMARCA','HUILA','NORTE SANTANDER','QUINDÍO','RISARALDA','SANTANDER','TOLIMA'],
  'Caribe':    ['ATLÁNTICO','BOLÍVAR','CESAR','CÓRDOBA','LA GUAJIRA','MAGDALENA','SUCRE','SAN ANDRÉS'],
  'Pacífica':  ['CAUCA','CHOCÓ','NARIÑO','VALLE DEL CAUCA'],
  'Orinoquía': ['ARAUCA','CASANARE','META','VICHADA'],
  'Amazonía':  ['AMAZONAS','CAQUETÁ','GUAINÍA','GUAVIARE','PUTUMAYO','VAUPÉS'],
}

export const DEPTO_REGION = {}
Object.entries(REGIONES_COL).forEach(([r, ds]) => ds.forEach(d => { DEPTO_REGION[d] = r }))

const medalla = (p) => {
  if (p === 1) return '🥇'
  if (p === 2) return '🥈'
  if (p === 3) return '🥉'
  if (p <= 10) return '⭐'
  return null
}

const rowBg = (p) => {
  if (p === 1) return '#FFFDE7'
  if (p <= 3)  return '#FFF8E1'
  if (p <= 10) return '#F9FBE7'
  if (p <= 50) return '#F0FFF4'
  return 'transparent'
}

const Pill = ({ children, active, onClick }) => (
  <button onClick={onClick} style={{
    padding:'8px 20px', borderRadius:24,
    border: active ? `2px solid ${C.navy}` : `1px solid ${C.grayLt}`,
    background: active ? C.navy : C.white,
    color: active ? C.white : C.gray,
    fontFamily:'Inter', fontSize:13, fontWeight: active ? 600 : 400,
    cursor:'pointer', transition:'all 0.15s',
  }}>{children}</button>
)

const SelectF = ({ value, onChange, options, placeholder }) => (
  <select value={value} onChange={e => onChange(e.target.value)} style={{
    padding:'8px 12px', border:`1px solid ${C.grayLt}`, borderRadius:7,
    fontFamily:'Inter', fontSize:12, color: value ? C.text : C.gray,
    background:C.white, outline:'none', cursor:'pointer',
  }}>
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
)

const Th = ({ children, style={} }) => (
  <th style={{
    textAlign:'left', padding:'10px 12px', fontSize:10,
    color:C.gray, fontWeight:600, textTransform:'uppercase',
    letterSpacing:'0.05em', whiteSpace:'nowrap',
    borderBottom:`2px solid ${C.bg2}`, background:C.white,
    position:'sticky', top:0, zIndex:2,
    ...style
  }}>{children}</th>
)

const Td = ({ children, style={} }) => (
  <td style={{ padding:'10px 12px', fontSize:12, fontFamily:'Inter', ...style }}>{children}</td>
)

const Score = ({ val }) => {
  const n = parseFloat(val)
  if (isNaN(n)) return <span style={{ color:C.gray }}>—</span>
  const color = n >= 75 ? C.green : n >= 60 ? C.navy : n >= 50 ? C.amber : C.red
  return <span style={{ fontWeight:600, color }}>{n.toFixed(1)}</span>
}

// ─── Clasificación badge ──────────────────────────────────────────────────────
const CLAS_COLOR = {
  'A+': { bg:'#D1FAE5', color:'#065F46', border:'#6EE7B7' },
  'A':  { bg:'#DBEAFE', color:'#1E40AF', border:'#93C5FD' },
  'B':  { bg:'#FEF3C7', color:'#92400E', border:'#FCD34D' },
  'C':  { bg:'#FEE2E2', color:'#991B1B', border:'#FCA5A5' },
  'D':  { bg:'#F3F4F6', color:'#374151', border:'#D1D5DB' },
}
const ClasBadge = ({ val }) => {
  const s = CLAS_COLOR[val] || CLAS_COLOR['D']
  return (
    <span style={{
      display:'inline-block', padding:'3px 10px', borderRadius:20,
      fontSize:12, fontWeight:700, fontFamily:'Inter',
      background:s.bg, color:s.color, border:`1px solid ${s.border}`,
    }}>{val || '—'}</span>
  )
}

// ─── Dual-list picker ─────────────────────────────────────────────────────────
function DualList({ available, selected, onSelect, label, height=160 }) {
  const [search, setSearch] = useState('')
  const avail = available.filter(v => !selected.includes(v) && v.toLowerCase().includes(search.toLowerCase()))

  const add    = (v) => onSelect([...selected, v])
  const remove = (v) => onSelect(selected.filter(x => x !== v))
  const addAll    = () => onSelect([...new Set([...selected, ...avail])])
  const removeAll = () => onSelect([])

  const boxStyle = {
    border:`1px solid ${C.grayLt}`, borderRadius:7, overflowY:'auto',
    height, background:C.white, fontFamily:'Inter', fontSize:12,
  }
  const itemStyle = (active) => ({
    padding:'6px 10px', cursor:'pointer',
    background: active ? C.navy : 'transparent',
    color: active ? C.white : C.text,
    transition:'background 0.1s',
  })

  const [leftSel, setLeftSel]   = useState(null)
  const [rightSel, setRightSel] = useState(null)

  return (
    <div>
      <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginBottom:4 }}>{label}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 36px 1fr', gap:4, alignItems:'center' }}>
        {/* Left: available */}
        <div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            style={{ width:'100%', padding:'5px 8px', border:`1px solid ${C.grayLt}`,
              borderRadius:6, fontFamily:'Inter', fontSize:11, outline:'none',
              marginBottom:4, boxSizing:'border-box' }} />
          <div style={boxStyle}>
            {avail.length === 0
              ? <div style={{ padding:'10px', color:C.gray, textAlign:'center' }}>—</div>
              : avail.map(v => (
                <div key={v}
                  onClick={() => setLeftSel(v === leftSel ? null : v)}
                  onDoubleClick={() => { add(v); setLeftSel(null) }}
                  style={itemStyle(v === leftSel)}>
                  {v}
                </div>
              ))
            }
          </div>
          <div style={{ fontSize:10, color:C.gray, marginTop:2 }}>
            {avail.length} disponibles
          </div>
        </div>

        {/* Arrow buttons */}
        <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'center' }}>
          {[
            { label:'»', action: addAll, title:'Agregar todos' },
            { label:'›', action: () => { if (leftSel) { add(leftSel); setLeftSel(null) } }, title:'Agregar seleccionado' },
            { label:'‹', action: () => { if (rightSel) { remove(rightSel); setRightSel(null) } }, title:'Quitar seleccionado' },
            { label:'«', action: removeAll, title:'Quitar todos' },
          ].map(b => (
            <button key={b.label} onClick={b.action} title={b.title} style={{
              width:28, height:24, border:`1px solid ${C.grayLt}`, borderRadius:5,
              background:C.white, cursor:'pointer', fontFamily:'monospace', fontSize:13,
              color:C.navy, display:'flex', alignItems:'center', justifyContent:'center',
            }}>{b.label}</button>
          ))}
        </div>

        {/* Right: selected */}
        <div>
          <div style={{ fontSize:11, color:C.gray, marginBottom:4, height:21 }}>Seleccionados</div>
          <div style={boxStyle}>
            {selected.length === 0
              ? <div style={{ padding:'10px', color:C.gray, textAlign:'center', fontSize:11 }}>Ninguno (= todos)</div>
              : selected.map(v => (
                <div key={v}
                  onClick={() => setRightSel(v === rightSel ? null : v)}
                  onDoubleClick={() => { remove(v); setRightSel(null) }}
                  style={itemStyle(v === rightSel)}>
                  {v}
                </div>
              ))
            }
          </div>
          <div style={{ fontSize:10, color:C.gray, marginTop:2 }}>
            {selected.length ? `${selected.length} seleccionados` : 'todos'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-componente: Clasificación ICFES ─────────────────────────────────────
const ANIOS_CLAS  = [2025, 2024, 2023, 2022, 2021, 2020]
const PERIODOS    = [1, 2, 3, 4]
const GRADOS      = [{ value:11, label:'Grado 11°' }, { value:26, label:'Grado 26' }]
const SECTORES    = ['OFICIAL', 'NO OFICIAL']
const CLAS_OPTS   = ['A+', 'A', 'B', 'C', 'D']

function ClasificacionICFES({ session }) {
  const mobile = useMobile()

  // Filtros
  const [anio,       setAnio]       = useState(2025)
  const [periodo,    setPeriodo]    = useState(1)
  const [grado,      setGrado]      = useState(11)
  const [sector,     setSector]     = useState('')
  const [clasSel,    setClasSel]    = useState([])
  const [deptoSel,   setDeptoSel]   = useState([])
  const [muniSel,    setMuniSel]    = useState([])
  const [estSel,     setEstSel]     = useState([])
  const [codigoDane, setCodigoDane] = useState('')

  // Data / options
  const [data,      setData]      = useState([])
  const [deptoOpts, setDeptoOpts] = useState([])
  const [muniAll,   setMuniAll]   = useState([])  // {municipio, departamento}[]
  const [muniOpts,  setMuniOpts]  = useState([])  // municipios filtrados por deptoSel
  const [estOpts,   setEstOpts]   = useState([])
  const [loading,   setLoading]   = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [consulted, setConsulted]   = useState(false)

  // Carga departamentos y municipios cuando cambia año/periodo/grado
  useEffect(() => {
    setDeptoSel([]); setMuniSel([]); setEstSel([])
    setDeptoOpts([]); setMuniAll([]); setMuniOpts([]); setEstOpts([])
    setData([]); setConsulted(false); setLastUpdate(null)

    supabase
      .from('clasificacion_icfes')
      .select('municipio, departamento')
      .eq('anio', anio).eq('periodo', periodo).eq('grado', grado)
      .order('departamento').order('municipio')
      .then(({ data: rows }) => {
        const pairs = (rows || []).filter(r => r.municipio)
        const uniqueDeptos = [...new Set(pairs.map(r => r.departamento).filter(Boolean))].sort()
        setDeptoOpts(uniqueDeptos)
        setMuniAll(pairs)
        const uniqueMunis = [...new Set(pairs.map(r => r.municipio))]
        setMuniOpts(uniqueMunis)
        return supabase
          .from('clasificacion_icfes')
          .select('created_at')
          .eq('anio', anio).eq('periodo', periodo).eq('grado', grado)
          .order('created_at', { ascending: false }).limit(1)
      })
      .then(({ data: lu }) => setLastUpdate(lu?.[0]?.created_at || null))
  }, [anio, periodo, grado])

  // Cuando cambia deptoSel → filtra municipios en cascada
  useEffect(() => {
    setMuniSel([]); setEstSel([]); setEstOpts([])
    if (deptoSel.length === 0) {
      setMuniOpts([...new Set(muniAll.map(r => r.municipio))])
    } else {
      const filtered = muniAll.filter(r => deptoSel.includes(r.departamento))
      setMuniOpts([...new Set(filtered.map(r => r.municipio))])
    }
  }, [deptoSel, muniAll])

  // Cuando cambia muniSel → carga establecimientos en cascada
  useEffect(() => {
    setEstSel([]); setEstOpts([])
    if (!muniSel.length) return
    supabase
      .from('clasificacion_icfes')
      .select('nombre_sede')
      .eq('anio', anio).eq('periodo', periodo).eq('grado', grado)
      .in('municipio', muniSel)
      .order('nombre_sede')
      .then(({ data: rows }) => {
        const unique = [...new Set((rows || []).map(r => r.nombre_sede).filter(Boolean))]
        setEstOpts(unique)
      })
  }, [muniSel, anio, periodo, grado])

  const consultar = useCallback(async () => {
    setLoading(true)
    setConsulted(true)

    let q = supabase
      .from('clasificacion_icfes')
      .select('*')
      .eq('anio', anio)
      .eq('periodo', periodo)
      .eq('grado', grado)
      .order('clasificacion', { ascending: true })
      .order('nombre_sede', { ascending: true })
      .limit(5000)

    if (sector)          q = q.eq('sector', sector)
    if (clasSel.length)  q = q.in('clasificacion', clasSel)
    if (deptoSel.length) q = q.in('departamento', deptoSel)
    if (muniSel.length)  q = q.in('municipio', muniSel)
    if (estSel.length)   q = q.in('nombre_sede', estSel)
    if (codigoDane.trim()) q = q.ilike('codigo_dane', `%${codigoDane.trim()}%`)

    const { data: rows } = await q
    setData(rows || [])
    setLoading(false)
  }, [anio, periodo, grado, sector, clasSel, deptoSel, muniSel, estSel, codigoDane])

  const importar = async () => {
    setImporting(true)
    setImportMsg(null)
    try {
      const resp = await fetch('/api/icfes-clasificacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token || ''}`,
        },
        body: JSON.stringify({ anio, periodo, grado }),
      })
      const json = await resp.json()
      if (json.imported > 0) {
        setImportMsg({ ok: true, text: `${json.imported} establecimientos importados desde ICFES` })
        await consultar()
        // Refresh municipios
        const { data: rows } = await supabase
          .from('clasificacion_icfes')
          .select('municipio')
          .eq('anio', anio).eq('periodo', periodo).eq('grado', grado)
          .order('municipio')
        setMuniOpts([...new Set((rows || []).map(r => r.municipio).filter(Boolean))])
      } else {
        setImportMsg({ ok: false, text: json.message || json.error || 'Sin resultados desde ICFES' })
      }
    } catch (e) {
      setImportMsg({ ok: false, text: e.message })
    }
    setImporting(false)
  }

  const descargar = () => {
    if (!data.length) return
    const rows = data.map(r => ({
      'Año': r.anio,
      'Período': r.periodo,
      'Grado': r.grado === 11 ? 'Grado 11°' : 'Grado 26',
      'Código DANE': r.codigo_dane,
      'Establecimiento': r.nombre_sede,
      'Municipio': r.municipio,
      'Departamento': r.departamento,
      'Sector': r.sector,
      'Clasificación': r.clasificacion,
      'Evaluados': r.num_evaluados,
      'Puntaje Global': r.puntaje_global,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clasificación ICFES')
    XLSX.writeFile(wb, `clasificacion_icfes_${anio}_p${periodo}_g${grado}.xlsx`)
  }

  // KPIs
  const totalSedes = data.length
  const byClass    = CLAS_OPTS.reduce((acc, c) => {
    acc[c] = data.filter(r => r.clasificacion === c).length
    return acc
  }, {})

  return (
    <div>
      {/* Filtros */}
      <div style={{ background:C.white, borderRadius:10, border:`1px solid ${C.grayLt}`,
        padding:'20px 24px', marginBottom:20, boxShadow:'0 1px 4px rgba(10,31,61,0.05)' }}>

        {/* Row 1: Año, Período, Grado */}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginBottom:4 }}>Año</div>
            <select value={anio} onChange={e => setAnio(+e.target.value)}
              style={{ padding:'8px 12px', border:`1px solid ${C.grayLt}`, borderRadius:7,
                fontFamily:'Inter', fontSize:13, background:C.white, outline:'none', cursor:'pointer' }}>
              {ANIOS_CLAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginBottom:4 }}>Período</div>
            <select value={periodo} onChange={e => setPeriodo(+e.target.value)}
              style={{ padding:'8px 12px', border:`1px solid ${C.grayLt}`, borderRadius:7,
                fontFamily:'Inter', fontSize:13, background:C.white, outline:'none', cursor:'pointer' }}>
              {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginBottom:4 }}>Grado</div>
            <select value={grado} onChange={e => setGrado(+e.target.value)}
              style={{ padding:'8px 12px', border:`1px solid ${C.grayLt}`, borderRadius:7,
                fontFamily:'Inter', fontSize:13, background:C.white, outline:'none', cursor:'pointer' }}>
              {GRADOS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginBottom:4 }}>Sector</div>
            <select value={sector} onChange={e => setSector(e.target.value)}
              style={{ padding:'8px 12px', border:`1px solid ${C.grayLt}`, borderRadius:7,
                fontFamily:'Inter', fontSize:13, background:C.white, outline:'none', cursor:'pointer' }}>
              <option value="">Todos</option>
              {SECTORES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Clasificación checkboxes */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginBottom:6 }}>
            Clasificación <span style={{ color:C.grayLt }}>(vacío = todas)</span>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {CLAS_OPTS.map(c => {
              const s = CLAS_COLOR[c]
              const active = clasSel.includes(c)
              return (
                <button key={c} onClick={() =>
                  setClasSel(active ? clasSel.filter(x => x !== c) : [...clasSel, c])
                } style={{
                  padding:'6px 16px', borderRadius:20, cursor:'pointer',
                  border: active ? `2px solid ${s.border}` : `1px solid ${C.grayLt}`,
                  background: active ? s.bg : C.white,
                  color: active ? s.color : C.gray,
                  fontFamily:'Inter', fontSize:13, fontWeight: active ? 700 : 400,
                  transition:'all 0.15s',
                }}>{c}</button>
              )
            })}
            {clasSel.length > 0 && (
              <button onClick={() => setClasSel([])} style={{
                padding:'6px 12px', borderRadius:20, cursor:'pointer',
                border:`1px solid ${C.red}`, background:'transparent',
                color:C.red, fontFamily:'Inter', fontSize:12,
              }}>✕ Limpiar</button>
            )}
          </div>
        </div>

        {/* Row 3: Código DANE */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginBottom:4 }}>Código DANE</div>
          <input
            value={codigoDane} onChange={e => setCodigoDane(e.target.value)}
            placeholder="Ej: 311001065489"
            style={{ padding:'8px 12px', border:`1px solid ${C.grayLt}`, borderRadius:7,
              fontFamily:'Inter', fontSize:13, outline:'none', width:220, boxSizing:'border-box' }}
          />
        </div>

        {/* Row 4: Departamento dual-list */}
        <div style={{ marginBottom:16 }}>
          <DualList
            label={`Departamento ${deptoOpts.length ? `(${deptoOpts.length} disponibles)` : '— sin datos'}`}
            available={deptoOpts}
            selected={deptoSel}
            onSelect={setDeptoSel}
            height={130}
          />
        </div>

        {/* Row 5: Municipio dual-list (cascada desde departamento) */}
        <div style={{ marginBottom:16 }}>
          <DualList
            label={`Municipio ${muniOpts.length ? `(${muniOpts.length} disponibles${deptoSel.length ? ` en ${deptoSel.length} depto(s)` : ''})` : '— sin datos'}`}
            available={muniOpts}
            selected={muniSel}
            onSelect={setMuniSel}
            height={130}
          />
        </div>

        {/* Row 6: Establecimiento dual-list (cascada desde municipio) */}
        <div style={{ marginBottom:16 }}>
          <DualList
            label={
              muniSel.length
                ? `Establecimiento Educativo (${estOpts.length} disponibles en municipios seleccionados)`
                : 'Establecimiento Educativo — selecciona municipios primero'
            }
            available={estOpts}
            selected={estSel}
            onSelect={setEstSel}
            height={130}
          />
        </div>

        {/* Row 7: Action buttons */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter' }}>
            {deptoSel.length > 0 && <span style={{ marginRight:8 }}>🗺 {deptoSel.length} depto(s)</span>}
            {muniSel.length > 0  && <span style={{ marginRight:8 }}>🏙 {muniSel.length} municipio(s)</span>}
            {estSel.length > 0   && <span style={{ marginRight:8 }}>🏫 {estSel.length} establecimiento(s)</span>}
          </div>
          <div style={{ flex:1 }} />
          <button onClick={consultar} disabled={loading} style={{
            padding:'9px 24px', borderRadius:8, border:'none', cursor:'pointer',
            background: loading ? C.grayLt : C.navy, color:C.white,
            fontFamily:'Inter', fontSize:13, fontWeight:600,
            display:'flex', alignItems:'center', gap:8,
          }}>
            {loading ? 'Consultando...' : '🔍 Consultar'}
          </button>
          <button onClick={descargar} disabled={!data.length} style={{
            padding:'9px 18px', borderRadius:8, cursor: data.length ? 'pointer' : 'not-allowed',
            border:`1px solid ${C.navy}`, background:C.white,
            color: data.length ? C.navy : C.gray,
            fontFamily:'Inter', fontSize:13, fontWeight:500,
          }}>
            ⬇ Descargar todas las sedes
          </button>
          <button onClick={importar} disabled={importing} title="Importar datos desde ICFES" style={{
            padding:'9px 16px', borderRadius:8, cursor:'pointer',
            border:`1px solid ${C.green}`, background: importing ? C.grayLt : 'transparent',
            color: importing ? C.gray : C.green,
            fontFamily:'Inter', fontSize:12, fontWeight:500,
          }}>
            {importing ? 'Importando...' : '↻ Actualizar datos ICFES'}
          </button>
        </div>

        {/* Status messages */}
        {importMsg && (
          <div style={{ marginTop:10, padding:'8px 14px', borderRadius:7, fontFamily:'Inter', fontSize:12,
            background: importMsg.ok ? '#D1FAE5' : '#FEE2E2',
            color: importMsg.ok ? '#065F46' : '#991B1B',
            border: `1px solid ${importMsg.ok ? '#6EE7B7' : '#FCA5A5'}`,
          }}>
            {importMsg.ok ? '✓' : '⚠'} {importMsg.text}
          </div>
        )}
        {lastUpdate && (
          <div style={{ marginTop:8, fontSize:11, color:C.gray, fontFamily:'Inter' }}>
            Datos actualizados: {new Date(lastUpdate).toLocaleDateString('es-CO', {
              day:'numeric', month:'long', year:'numeric'
            })}
          </div>
        )}
      </div>

      {/* Sin datos todavía */}
      {!consulted && !loading && (
        <div style={{ textAlign:'center', padding:'60px 0', color:C.gray, fontFamily:'Inter' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏫</div>
          <div style={{ fontSize:17, fontFamily:'Playfair Display, serif', color:C.navy, marginBottom:6 }}>
            Clasificación de Planteles ICFES
          </div>
          <div style={{ fontSize:13, maxWidth:380, margin:'0 auto', lineHeight:1.6 }}>
            Selecciona los filtros y haz clic en <strong>Consultar</strong>.
            <br/>Si no hay datos cargados, usa <em>Actualizar datos ICFES</em> primero.
          </div>
        </div>
      )}

      {/* Resultados */}
      {consulted && !loading && data.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 0', color:C.gray, fontFamily:'Inter' }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
          <div style={{ fontSize:15, color:C.navy }}>Sin resultados</div>
          <div style={{ fontSize:12, marginTop:6 }}>
            No hay datos para {anio} P{periodo} G{grado} con estos filtros.
            <br/>Intenta con <em>Actualizar datos ICFES</em>.
          </div>
        </div>
      )}

      {data.length > 0 && (
        <>
          {/* KPI cards */}
          <div style={{ display:'grid', gridTemplateColumns: mobile ? 'repeat(3,1fr)' : 'repeat(6,1fr)',
            gap:10, marginBottom:20 }}>
            <div style={{ background:C.white, borderRadius:9, padding:'12px 14px',
              border:`1px solid ${C.grayLt}`, textAlign:'center',
              gridColumn: mobile ? '1/4' : 'auto' }}>
              <div style={{ fontSize:22, fontFamily:'Playfair Display, serif', color:C.navy, fontWeight:700 }}>
                {totalSedes.toLocaleString('es-CO')}
              </div>
              <div style={{ fontSize:10, color:C.gray, textTransform:'uppercase',
                letterSpacing:'0.08em', fontFamily:'Inter', marginTop:2 }}>Total sedes</div>
            </div>
            {CLAS_OPTS.map(c => {
              const s = CLAS_COLOR[c]
              return (
                <div key={c} style={{ background:s.bg, borderRadius:9, padding:'12px 14px',
                  border:`1px solid ${s.border}`, textAlign:'center' }}>
                  <div style={{ fontSize:20, fontFamily:'Playfair Display, serif', color:s.color, fontWeight:700 }}>
                    {byClass[c] || 0}
                  </div>
                  <div style={{ fontSize:11, color:s.color, fontWeight:700, fontFamily:'Inter', marginTop:2 }}>
                    {c}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tabla */}
          <div style={{ background:C.white, borderRadius:10, border:`1px solid ${C.grayLt}`,
            overflow:'hidden', boxShadow:'0 1px 4px rgba(10,31,61,0.05)' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Código DANE</Th>
                    <Th>Establecimiento</Th>
                    <Th>Municipio</Th>
                    <Th>Departamento</Th>
                    <Th style={{ textAlign:'center' }}>Sector</Th>
                    <Th style={{ textAlign:'center' }}>Clasificación</Th>
                    <Th style={{ textAlign:'center' }}>Evaluados</Th>
                    <Th style={{ textAlign:'center' }}>Puntaje</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => {
                    const s  = CLAS_COLOR[r.clasificacion] || CLAS_COLOR['D']
                    const bg = i % 2 === 0 ? `${C.bg}60` : 'transparent'
                    return (
                      <tr key={r.id} style={{ borderBottom:`1px solid ${C.bg2}`, background:bg }}
                        onMouseEnter={e => e.currentTarget.style.background = `${C.green}12`}
                        onMouseLeave={e => e.currentTarget.style.background = bg}>
                        <Td style={{ color:C.gray, fontSize:11, textAlign:'center' }}>{i + 1}</Td>
                        <Td style={{ color:C.gray, fontSize:11, fontFamily:'monospace' }}>{r.codigo_dane}</Td>
                        <Td style={{ fontWeight:600, color:C.navy, maxWidth:260,
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {r.nombre_sede}
                        </Td>
                        <Td style={{ color:C.gray, whiteSpace:'nowrap', fontSize:11 }}>{r.municipio}</Td>
                        <Td style={{ color:C.gray, whiteSpace:'nowrap', fontSize:11 }}>{r.departamento}</Td>
                        <Td style={{ textAlign:'center' }}>
                          <span style={{ fontSize:11, color:r.sector === 'OFICIAL' ? C.navy : C.gray,
                            fontWeight: r.sector === 'OFICIAL' ? 600 : 400 }}>
                            {r.sector || '—'}
                          </span>
                        </Td>
                        <Td style={{ textAlign:'center' }}>
                          <ClasBadge val={r.clasificacion} />
                        </Td>
                        <Td style={{ textAlign:'center', color:C.gray }}>{r.num_evaluados?.toLocaleString('es-CO') || '—'}</Td>
                        <Td style={{ textAlign:'center', fontWeight:700, color:C.navy }}>
                          {r.puntaje_global ? parseFloat(r.puntaje_global).toFixed(2) : '—'}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop:10, fontSize:11, color:C.gray, fontFamily:'Inter', textAlign:'right' }}>
            Fuente: ICFES — Clasificación de Planteles Saber 11 · {anio} P{periodo} G{grado}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function AdminRanking({ session }) {
  const mobile = useMobile()
  const [subTab, setSubTab] = useState('ranking')

  // ── RANKING state ──────────────────────────────────────────────────────────
  const [anio, setAnio]         = useState(2024)
  const [data, setData]         = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [pagina, setPagina]     = useState(1)
  const [buscar, setBuscar]     = useState('')
  const [filtroDepto, setFiltroDepto]   = useState('')
  const [filtroNat, setFiltroNat]       = useState('')
  const [filtroJorn, setFiltroJorn]     = useState('')
  const [filtroCalend, setFiltroCalend] = useState('')
  const [filtroRegion, setFiltroRegion] = useState('')
  const [reporte, setReporte] = useState(null)
  const [reporteAgrupado, setReporteAgrupado] = useState(null)
  const [vista, setVista] = useState('colegios')
  const [agrupado, setAgrupado] = useState([])
  const [loadingAgrp, setLoadingAgrp] = useState(false)
  const [filtroNatAgrp, setFiltroNatAgrp] = useState('')
  const [filtroCalAgrp, setFiltroCalAgrp] = useState('')

  const loadAgrupado = async (a, modo, dep='', nat='', cal='') => {
    setLoadingAgrp(true)

    const buildQ = (year) => {
      let q = supabase
        .from('ranking_colegios')
        .select('departamento,ciudad,eval_estudiantes,lectura_critica,matematicas,ciencias_sociales,ciencias_naturales,ingles,ponderado,puntaje_global')
        .eq('anio', year)
        .limit(5000)
      if (modo === 'municipios' && dep) q = q.eq('departamento', dep)
      if (nat) q = q.eq('naturaleza', nat)
      if (cal) q = q.eq('calendario', cal)
      return q
    }

    const groupKey = (r) =>
      modo === 'regiones'    ? (DEPTO_REGION[r.departamento] || 'Sin región')
      : modo === 'municipios' ? `${r.ciudad}|||${r.departamento}`
      : r.departamento

    const aggregate = (rows) => {
      const grupos = {}
      ;(rows || []).forEach(r => {
        const key = groupKey(r)
        if (!grupos[key]) grupos[key] = {
          nombre: modo === 'municipios' ? r.ciudad : key,
          departamento: r.departamento,
          colegios:0, estudiantes:0, lc:0, mat:0, cs:0, cn:0, ing:0, pond:0, glob:0
        }
        const g = grupos[key]
        g.colegios++
        g.estudiantes += parseInt(r.eval_estudiantes || 0)
        g.lc   += parseFloat(r.lectura_critica || 0)
        g.mat  += parseFloat(r.matematicas || 0)
        g.cs   += parseFloat(r.ciencias_sociales || 0)
        g.cn   += parseFloat(r.ciencias_naturales || 0)
        g.ing  += parseFloat(r.ingles || 0)
        g.pond += parseFloat(r.ponderado || 0)
        g.glob += parseFloat(r.puntaje_global || 0)
      })
      return Object.values(grupos)
        .map(g => ({
          nombre: g.nombre, departamento: g.departamento,
          colegios: g.colegios, estudiantes: g.estudiantes,
          lc:   g.colegios ? g.lc/g.colegios   : 0,
          mat:  g.colegios ? g.mat/g.colegios  : 0,
          cs:   g.colegios ? g.cs/g.colegios   : 0,
          cn:   g.colegios ? g.cn/g.colegios   : 0,
          ing:  g.colegios ? g.ing/g.colegios  : 0,
          pond: g.colegios ? g.pond/g.colegios : 0,
          glob: g.colegios ? g.glob/g.colegios : 0,
        }))
        .sort((a, b) => b.pond - a.pond)
    }

    const [{ data: currRows }, { data: prevRows }] = await Promise.all([
      buildQ(a), buildQ(a - 1)
    ])

    const current = aggregate(currRows)
    const prev    = aggregate(prevRows)

    const prevRankMap = {}
    prev.forEach((g, i) => {
      const k = modo === 'municipios' ? `${g.nombre}|||${g.departamento}` : g.nombre
      prevRankMap[k] = i + 1
    })

    const result = current.map((g, i) => {
      const k = modo === 'municipios' ? `${g.nombre}|||${g.departamento}` : g.nombre
      const prevRank = prevRankMap[k]
      const diff = prevRank != null ? prevRank - (i + 1) : null
      return { ...g, comportamiento: diff }
    })

    setAgrupado(result)
    setLoadingAgrp(false)
  }

  useEffect(() => {
    if (vista !== 'colegios') loadAgrupado(anio, vista, filtroDepto, filtroNatAgrp, filtroCalAgrp)
  }, [vista, anio, filtroDepto, filtroNatAgrp, filtroCalAgrp])

  const doLoad = async (a, p, bus, dep, nat, jorn, cal, reg) => {
    setLoading(true)
    const offset = (p - 1) * POR_PAGINA
    let q = supabase
      .from('ranking_colegios')
      .select('*', { count: 'exact' })
      .eq('anio', a)
      .order('puesto_anio', { ascending: true })
      .range(offset, offset + POR_PAGINA - 1)
    if (bus.trim()) q = q.ilike('nombre', `%${bus.trim()}%`)
    if (dep)        q = q.eq('departamento', dep)
    else if (reg)   q = q.in('departamento', REGIONES_COL[reg] || [])
    if (nat)        q = q.eq('naturaleza', nat)
    if (jorn)       q = q.ilike('jornada', `%${jorn}%`)
    if (cal)        q = q.eq('calendario', cal)
    const { data: rows, count, error } = await q
    if (!error && rows?.length) {
      const { data: prevRows } = await supabase
        .from('ranking_colegios')
        .select('codigo,puesto_anio')
        .eq('anio', a - 1)
        .in('codigo', rows.map(r => r.codigo))
      const prevMap = {}
      ;(prevRows || []).forEach(r => { prevMap[r.codigo] = r.puesto_anio })
      setData(rows.map(r => ({
        ...r,
        comportamiento: prevMap[r.codigo] != null ? prevMap[r.codigo] - r.puesto_anio : null
      })))
      setTotal(count || 0)
    } else if (!error) {
      setData([]); setTotal(0)
    }
    setLoading(false)
  }

  useEffect(() => {
    doLoad(anio, pagina, buscar, filtroDepto, filtroNat, filtroJorn, filtroCalend, filtroRegion)
  }, [anio, pagina, buscar, filtroDepto, filtroNat, filtroJorn, filtroCalend, filtroRegion])

  const totalPags = Math.ceil(total / POR_PAGINA)

  // ── Sub-tab navigation ────────────────────────────────────────────────────
  const SubTabBtn = ({ id, label }) => (
    <button onClick={() => setSubTab(id)} style={{
      padding:'8px 22px', borderRadius:0, border:'none', cursor:'pointer',
      fontFamily:'Inter', fontSize:13, fontWeight: subTab===id ? 600 : 400,
      background:'transparent',
      color: subTab===id ? C.navy : C.gray,
      borderBottom: subTab===id ? `2px solid ${C.navy}` : '2px solid transparent',
      transition:'all 0.15s',
    }}>{label}</button>
  )

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display:'flex', borderBottom:`1px solid ${C.grayLt}`, marginBottom:24 }}>
        <SubTabBtn id="ranking"       label="🏆 Ranking" />
        <SubTabBtn id="clasificacion" label="📊 Clasificación ICFES" />
      </div>

      {/* ── Ranking ── */}
      {subTab === 'ranking' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            marginBottom:20, flexWrap:'wrap', gap:12 }}>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {ANIOS.map(a => (
                <Pill key={a} active={anio===a} onClick={() => setAnio(a)}>{a}</Pill>
              ))}
            </div>
            <div style={{ display:'flex', gap:4, background:C.bg, borderRadius:8, padding:4 }}>
              {[['colegios','🏆 Nacional'],['regiones','🌎 Regiones'],['departamentos','🗺 Departamentos'],['municipios','🏙 Municipios']].map(([v,l]) => (
                <button key={v} onClick={() => setVista(v)} style={{
                  padding:'7px 14px', borderRadius:6, border:'none', fontFamily:'Inter', fontSize:12,
                  fontWeight: vista===v ? 600 : 400,
                  background: vista===v ? C.navy : 'transparent',
                  color: vista===v ? C.white : C.gray,
                  cursor:'pointer', transition:'all 0.15s',
                }}>{l}</button>
              ))}
            </div>
          </div>

          {vista !== 'colegios' && (
            <div>
              {vista === 'municipios' && (
                <div style={{ display:'flex', alignItems:'center', gap:12, background:'#EFF6FF',
                  border:'1px solid #BFDBFE', borderRadius:8, padding:'10px 16px', marginBottom:12,
                  fontFamily:'Inter', fontSize:13, color:'#1E40AF', flexWrap:'wrap' }}>
                  <span style={{ fontSize:16 }}>🏙</span>
                  <span style={{ flex:1, minWidth:180 }}>
                    {filtroDepto
                      ? <>Municipios de <strong>{filtroDepto}</strong> — ordenados por ponderado</>
                      : <>Filtra por departamento o consulta todos los municipios</>
                    }
                  </span>
                  <select value={filtroDepto} onChange={e => { setFiltroDepto(e.target.value); setFiltroRegion('') }}
                    style={{ padding:'7px 12px', border:'1px solid #BFDBFE', borderRadius:7,
                      fontFamily:'Inter', fontSize:12, color: filtroDepto ? '#1E40AF' : '#60A5FA',
                      background:'#EFF6FF', outline:'none', cursor:'pointer', fontWeight: filtroDepto ? 600 : 400 }}>
                    <option value="">Todos los departamentos</option>
                    {DEPARTAMENTOS_COL.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {filtroDepto && (
                    <button onClick={() => setFiltroDepto('')} style={{
                      background:'none', border:'1px solid #BFDBFE', borderRadius:6,
                      color:'#1E40AF', fontSize:11, padding:'5px 10px', cursor:'pointer', fontFamily:'Inter',
                    }}>✕ Limpiar</button>
                  )}
                </div>
              )}
              <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>
                <SelectF value={filtroNatAgrp} onChange={setFiltroNatAgrp}
                  options={['OFICIAL','NO OFICIAL','OFICIAL(C)']} placeholder="Naturaleza" />
                <SelectF value={filtroCalAgrp} onChange={setFiltroCalAgrp}
                  options={['A','B','O']} placeholder="Calendario" />
                {(filtroNatAgrp || filtroCalAgrp) && (
                  <button onClick={() => { setFiltroNatAgrp(''); setFiltroCalAgrp('') }}
                    style={{ padding:'7px 12px', border:`1px solid ${C.red}`, borderRadius:7,
                      background:'transparent', color:C.red, fontFamily:'Inter', fontSize:12, cursor:'pointer' }}>
                    Limpiar ✕
                  </button>
                )}
              </div>

              <div style={{ background:C.white, borderRadius:10, border:`1px solid ${C.grayLt}`,
                overflow:'hidden', boxShadow:'0 1px 4px rgba(10,31,61,0.05)' }}>
                {loadingAgrp ? (
                  <div style={{ textAlign:'center', padding:60, color:C.gray, fontFamily:'Inter' }}>Cargando...</div>
                ) : (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                      <thead>
                        <tr>
                          <Th style={{width:40}}>#</Th>
                          <Th>{vista==='regiones' ? 'Región' : vista==='municipios' ? 'Municipio' : 'Departamento'}</Th>
                          {vista === 'municipios' && <Th>Departamento</Th>}
                          <Th style={{textAlign:'center'}}>Tendencia</Th>
                          <Th style={{textAlign:'center'}}>Colegios</Th>
                          <Th style={{textAlign:'center'}}>Estudiantes</Th>
                          <Th style={{textAlign:'center'}}>L.C.</Th>
                          <Th style={{textAlign:'center'}}>Mat.</Th>
                          <Th style={{textAlign:'center'}}>C.S.</Th>
                          <Th style={{textAlign:'center'}}>C.N.</Th>
                          <Th style={{textAlign:'center'}}>Inglés</Th>
                          <Th style={{textAlign:'center'}}>Ponderado</Th>
                          <Th style={{textAlign:'center'}}>Global</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {agrupado.map((g, i) => {
                          const baseBg = i===0 ? '#FFFDE7' : i===1 ? '#FFF8E1' : i===2 ? '#F9FBE7' : i%2===0?`${C.bg}80`:'transparent'
                          return (
                          <tr key={g.nombre + g.departamento}
                            onClick={() => setReporteAgrupado({ tipo: vista==='regiones' ? 'region' : vista==='municipios' ? 'municipio' : 'departamento', nombre: g.nombre, departamento: g.departamento })}
                            style={{ borderBottom:`1px solid ${C.bg2}`, background: baseBg, cursor:'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = C.green+'15'}
                            onMouseLeave={e => e.currentTarget.style.background = baseBg}>
                            <Td style={{ fontWeight:700, color:C.navy, textAlign:'center' }}>
                              {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
                            </Td>
                            <Td style={{ fontWeight:600, color:C.navy,
                              textDecoration:'underline', textDecorationColor: C.green+'80' }}>{g.nombre}</Td>
                            {vista === 'municipios' && (
                              <Td style={{ color:C.gray, fontSize:11 }}>{g.departamento}</Td>
                            )}
                            <Td style={{ textAlign:'center' }}>
                              {g.comportamiento == null
                                ? <span style={{ color:C.grayLt, fontSize:11 }}>—</span>
                                : g.comportamiento > 0
                                ? <span style={{ color:C.green, fontWeight:700, fontSize:16 }} title={`Subió ${g.comportamiento} posiciones`}>↑</span>
                                : g.comportamiento < 0
                                ? <span style={{ color:C.red, fontWeight:700, fontSize:16 }} title={`Bajó ${Math.abs(g.comportamiento)} posiciones`}>↓</span>
                                : <span style={{ color:C.gray, fontSize:14 }}>→</span>
                              }
                            </Td>
                            <Td style={{ textAlign:'center', color:C.gray }}>{g.colegios.toLocaleString('es-CO')}</Td>
                            <Td style={{ textAlign:'center', color:C.gray }}>{g.estudiantes.toLocaleString('es-CO')}</Td>
                            <Td style={{ textAlign:'center' }}><Score val={g.lc}/></Td>
                            <Td style={{ textAlign:'center' }}><Score val={g.mat}/></Td>
                            <Td style={{ textAlign:'center' }}><Score val={g.cs}/></Td>
                            <Td style={{ textAlign:'center' }}><Score val={g.cn}/></Td>
                            <Td style={{ textAlign:'center' }}><Score val={g.ing}/></Td>
                            <Td style={{ textAlign:'center', fontWeight:700, color:C.navy }}>{g.pond.toFixed(3)}</Td>
                            <Td style={{ textAlign:'center', fontWeight:700, color:C.navy }}>{g.glob.toFixed(1)}</Td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {vista === 'colegios' && <>
            {!loading && data.length === 0 && (
              <div style={{ textAlign:'center', padding:'80px 0', color:C.gray, fontFamily:'Inter' }}>
                <div style={{ fontSize:48, marginBottom:16 }}>📅</div>
                <div style={{ fontSize:20, fontFamily:'Playfair Display, serif', color:C.navy, marginBottom:8 }}>
                  Ranking {anio}
                </div>
                <div style={{ fontSize:14, color:C.gray }}>
                  Los datos de este año aún no han sido cargados.
                </div>
              </div>
            )}

            {data.length > 0 && (
              <>
                <div style={{ display:'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:16, marginBottom:24 }}>
                  {[
                    { label:'Total colegios', value: total.toLocaleString('es-CO'), icon:'🏫' },
                    { label:'1er puesto',     value: data[0]?.nombre?.slice(0,22) || '—', icon:'🥇', small:true },
                    { label:'Puntaje máx.',   value: data[0]?.puntaje_global || '—', icon:'⭐' },
                    { label:'Página',         value: `${pagina} / ${totalPags}`, icon:'📄' },
                  ].map((s,i) => (
                    <div key={i} style={{ background:C.white, borderRadius:10, padding:'16px 18px',
                      border:`1px solid ${C.grayLt}`, boxShadow:'0 1px 4px rgba(10,31,61,0.05)' }}>
                      <div style={{ fontSize:9, color:C.gray, fontFamily:'Inter',
                        textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>{s.label}</div>
                      <div style={{ fontSize: s.small ? 13 : 22, fontFamily:'Playfair Display, serif',
                        color:C.navy, fontWeight:600 }}>{s.icon} {s.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background:C.white, borderRadius:10, padding:'16px 20px',
                  border:`1px solid ${C.grayLt}`, marginBottom:16,
                  display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
                  <input value={buscar} onChange={e => setBuscar(e.target.value)}
                    placeholder="Buscar colegio..."
                    style={{ padding:'8px 14px', border:`1px solid ${C.grayLt}`, borderRadius:7,
                      fontFamily:'Inter', fontSize:13, outline:'none', flex:1, minWidth:200 }} />
                  <SelectF value={filtroRegion} onChange={v => { setFiltroRegion(v); setFiltroDepto('') }}
                    options={Object.keys(REGIONES_COL)} placeholder="Región" />
                  <SelectF value={filtroDepto} onChange={v => { setFiltroDepto(v); setFiltroRegion('') }}
                    options={DEPARTAMENTOS_COL} placeholder="Departamento" />
                  <SelectF value={filtroNat} onChange={setFiltroNat}
                    options={['OFICIAL','NO OFICIAL','OFICIAL(C)']} placeholder="Naturaleza" />
                  <SelectF value={filtroCalend} onChange={setFiltroCalend}
                    options={['A','B','O']} placeholder="Calendario" />
                  <SelectF value={filtroJorn} onChange={setFiltroJorn}
                    options={['MAÑANA','TARDE','NOCHE','COMPLETA','ÚNICA','SABATINO']} placeholder="Jornada" />
                  {(buscar||filtroRegion||filtroDepto||filtroNat||filtroCalend||filtroJorn) && (
                    <button onClick={() => {
                      setBuscar(''); setFiltroRegion(''); setFiltroDepto('');
                      setFiltroNat(''); setFiltroCalend(''); setFiltroJorn('')
                    }} style={{ padding:'8px 14px', border:`1px solid ${C.red}`,
                      borderRadius:7, background:'transparent', color:C.red,
                      fontFamily:'Inter', fontSize:12, cursor:'pointer' }}>
                      Limpiar ✕
                    </button>
                  )}
                </div>

                <div style={{ background:C.white, borderRadius:10, border:`1px solid ${C.grayLt}`,
                  overflow:'hidden', boxShadow:'0 1px 4px rgba(10,31,61,0.05)' }}>
                  {loading ? (
                    <div style={{ textAlign:'center', padding:60, color:C.gray, fontFamily:'Inter' }}>
                      Cargando ranking...
                    </div>
                  ) : data.length === 0 ? (
                    <div style={{ textAlign:'center', padding:60, color:C.gray, fontFamily:'Inter' }}>
                      No se encontraron resultados con esos filtros.
                    </div>
                  ) : (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                        <thead>
                          <tr>
                            <Th style={{ width:50 }}>#</Th>
                            <Th style={{ width:24, textAlign:'center' }}>↕</Th>
                            <Th>Institución</Th>
                            <Th>Departamento</Th>
                            <Th>Ciudad</Th>
                            <Th style={{ textAlign:'center' }}>Cal.</Th>
                            <Th style={{ textAlign:'center' }}>Eval.</Th>
                            <Th style={{ textAlign:'center' }}>L.C.</Th>
                            <Th style={{ textAlign:'center' }}>Mat.</Th>
                            <Th style={{ textAlign:'center' }}>C.S.</Th>
                            <Th style={{ textAlign:'center' }}>C.N.</Th>
                            <Th style={{ textAlign:'center' }}>Inglés</Th>
                            <Th style={{ textAlign:'center' }}>Ponder.</Th>
                            <Th style={{ textAlign:'center' }}>Global</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.map((r, i) => {
                            const p   = r.puesto_anio
                            const med = medalla(p)
                            return (
                              <tr key={r.id}
                                onClick={() => setReporte({ codigo: r.codigo, nombre: r.nombre, anio })}
                                style={{
                                  background: i % 2 === 0 ? rowBg(p) : rowBg(p) || `${C.bg}60`,
                                  borderBottom:`1px solid ${C.bg2}`, cursor: 'pointer',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = C.green + '15'}
                                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? rowBg(p) : rowBg(p) || `${C.bg}60`}>
                                <Td style={{ fontWeight:700, color:C.navy, textAlign:'center', whiteSpace:'nowrap' }}>
                                  {med ? <span style={{ marginRight:2 }}>{med}</span> : null}{p}
                                </Td>
                                <Td style={{ textAlign:'center', width:24, padding:'10px 4px' }}>
                                  {r.comportamiento == null
                                    ? <span style={{ color:C.grayLt, fontSize:11 }}>—</span>
                                    : r.comportamiento > 0
                                    ? <span style={{ color:C.green, fontWeight:700, fontSize:15 }} title={`Subió ${r.comportamiento}`}>↑</span>
                                    : r.comportamiento < 0
                                    ? <span style={{ color:C.red, fontWeight:700, fontSize:15 }} title={`Bajó ${Math.abs(r.comportamiento)}`}>↓</span>
                                    : <span style={{ color:C.gray, fontSize:13 }}>→</span>
                                  }
                                </Td>
                                <Td style={{ fontWeight:600, color:C.navy, maxWidth:220,
                                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                                  textDecoration:'underline', textDecorationColor: C.green + '80' }}>
                                  {r.nombre}
                                </Td>
                                <Td style={{ color:C.gray, whiteSpace:'nowrap', fontSize:11 }}>{r.departamento}</Td>
                                <Td style={{ color:C.gray, whiteSpace:'nowrap', fontSize:11 }}>{r.ciudad}</Td>
                                <Td style={{ textAlign:'center' }}>
                                  <span style={{ background:r.calendario==='B'?C.navy+'18':C.green+'18',
                                    color:r.calendario==='B'?C.navy:C.green,
                                    padding:'2px 6px', borderRadius:12, fontSize:11, fontWeight:600 }}>
                                    {r.calendario}
                                  </span>
                                </Td>
                                <Td style={{ textAlign:'center', color:C.gray, fontSize:11 }}>{r.eval_estudiantes}</Td>
                                <Td style={{ textAlign:'center' }}><Score val={r.lectura_critica}/></Td>
                                <Td style={{ textAlign:'center' }}><Score val={r.matematicas}/></Td>
                                <Td style={{ textAlign:'center' }}><Score val={r.ciencias_sociales}/></Td>
                                <Td style={{ textAlign:'center' }}><Score val={r.ciencias_naturales}/></Td>
                                <Td style={{ textAlign:'center' }}><Score val={r.ingles}/></Td>
                                <Td style={{ textAlign:'center' }}>
                                  <span style={{ fontWeight:700, color:C.navy, fontSize:13 }}>
                                    {parseFloat(r.ponderado||0).toFixed(2)}
                                  </span>
                                </Td>
                                <Td style={{ textAlign:'center' }}>
                                  <span style={{ fontWeight:700, color:C.text, fontSize:14 }}>
                                    {r.puntaje_global}
                                  </span>
                                </Td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {totalPags > 1 && (
                  <div style={{ display:'flex', justifyContent:'center', alignItems:'center',
                    gap:8, marginTop:20, fontFamily:'Inter' }}>
                    <button onClick={() => setPagina(1)} disabled={pagina===1}
                      style={{ padding:'6px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                        background:C.white, cursor:pagina===1?'not-allowed':'pointer',
                        color:pagina===1?C.gray:C.navy, fontSize:12 }}>«</button>
                    <button onClick={() => setPagina(p=>Math.max(1,p-1))} disabled={pagina===1}
                      style={{ padding:'6px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                        background:C.white, cursor:pagina===1?'not-allowed':'pointer',
                        color:pagina===1?C.gray:C.navy, fontSize:12 }}>‹ Ant.</button>
                    <span style={{ fontSize:13, color:C.gray, padding:'0 8px' }}>
                      Página <strong style={{ color:C.navy }}>{pagina}</strong> de{' '}
                      <strong style={{ color:C.navy }}>{totalPags}</strong>
                      {' '}· {total.toLocaleString('es-CO')} colegios
                    </span>
                    <button onClick={() => setPagina(p=>Math.min(totalPags,p+1))} disabled={pagina===totalPags}
                      style={{ padding:'6px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                        background:C.white, cursor:pagina===totalPags?'not-allowed':'pointer',
                        color:pagina===totalPags?C.gray:C.navy, fontSize:12 }}>Sig. ›</button>
                    <button onClick={() => setPagina(totalPags)} disabled={pagina===totalPags}
                      style={{ padding:'6px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                        background:C.white, cursor:pagina===totalPags?'not-allowed':'pointer',
                        color:pagina===totalPags?C.gray:C.navy, fontSize:12 }}>»</button>
                  </div>
                )}
              </>
            )}
          </>}

          {reporte && (
            <ReportePlantel
              codigo={reporte.codigo}
              nombre={reporte.nombre}
              anioRef={reporte.anio}
              onClose={() => setReporte(null)}
            />
          )}
          {reporteAgrupado && (
            <ReporteAgrupado
              tipo={reporteAgrupado.tipo}
              nombre={reporteAgrupado.nombre}
              departamento={reporteAgrupado.departamento}
              anioRef={anio}
              onClose={() => setReporteAgrupado(null)}
            />
          )}
        </div>
      )}

      {/* ── Clasificación ICFES ── */}
      {subTab === 'clasificacion' && (
        <ClasificacionICFES session={session} />
      )}
    </div>
  )
}
