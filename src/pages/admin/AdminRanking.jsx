import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { C, useMobile } from '../../components/ui'
import ReportePlantel from './ReportePlantel'
import ReporteAgrupado from './ReporteAgrupado'

const ANIOS = [2026, 2025, 2024, 2023, 2022, 2021, 2020]
const POR_PAGINA = 100

const DEPARTAMENTOS_COL = [
  'AMAZONAS','ANTIOQUIA','ARAUCA','ATLÁNTICO','BOLÍVAR','BOYACÁ',
  'CALDAS','CAQUETÁ','CASANARE','CAUCA','CESAR','CHOCÓ','CÓRDOBA','CUNDINAMARCA',
  'GUAINÍA','GUAVIARE','HUILA','LA GUAJIRA','MAGDALENA','META','NARIÑO',
  'NORTE SANTANDER','PUTUMAYO','QUINDÍO','RISARALDA','SAN ANDRÉS','SANTANDER',
  'SUCRE','TOLIMA','VALLE DEL CAUCA','VAUPÉS','VICHADA',
]

// Regiones naturales de Colombia → departamentos
const REGIONES_COL = {
  'Andina':    ['ANTIOQUIA','BOGOTÁ D.C.','BOYACÁ','CALDAS','CUNDINAMARCA','HUILA','NORTE SANTANDER','QUINDÍO','RISARALDA','SANTANDER','TOLIMA'],
  'Caribe':    ['ATLÁNTICO','BOLÍVAR','CESAR','CÓRDOBA','LA GUAJIRA','MAGDALENA','SUCRE','SAN ANDRÉS'],
  'Pacífica':  ['CAUCA','CHOCÓ','NARIÑO','VALLE DEL CAUCA'],
  'Orinoquía': ['ARAUCA','CASANARE','META','VICHADA'],
  'Amazonía':  ['AMAZONAS','CAQUETÁ','GUAINÍA','GUAVIARE','PUTUMAYO','VAUPÉS'],
}

// Mapa inverso: departamento → región
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

export default function AdminRanking() {
  const mobile = useMobile()
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
  const [reporteAgrupado, setReporteAgrupado] = useState(null) // { tipo, nombre, departamento }
  const [vista, setVista] = useState('colegios') // 'colegios' | 'departamentos' | 'regiones'
  const [agrupado, setAgrupado] = useState([])
  const [loadingAgrp, setLoadingAgrp] = useState(false)
  const [filtroNatAgrp, setFiltroNatAgrp]   = useState('')
  const [filtroCalAgrp, setFiltroCalAgrp]   = useState('')

  const loadAgrupado = async (a, modo, dep='', nat='', cal='') => {
    setLoadingAgrp(true)

    const buildQ = (year) => {
      let q = supabase
        .from('ranking_colegios')
        .select('departamento,ciudad,eval_estudiantes,lectura_critica,matematicas,ciencias_sociales,ciencias_naturales,ingles,ponderado,puntaje_global')
        .eq('anio', year)
        .limit(5000) // TODO: implement pagination for larger datasets
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

    // Mapa: clave → puesto en año anterior
    const prevRankMap = {}
    prev.forEach((g, i) => {
      const k = modo === 'municipios' ? `${g.nombre}|||${g.departamento}` : g.nombre
      prevRankMap[k] = i + 1
    })

    const result = current.map((g, i) => {
      const k = modo === 'municipios' ? `${g.nombre}|||${g.departamento}` : g.nombre
      const prevRank = prevRankMap[k]
      const diff = prevRank != null ? prevRank - (i + 1) : null // positivo = subió
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

  return (
    <div>
      {/* Tabs de años + toggle de vista */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
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

      {/* Vista agrupada Departamentos / Regiones */}
      {vista !== 'colegios' && (
        <div>
          {/* Aviso contexto municipios */}
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
              <select
                value={filtroDepto}
                onChange={e => { setFiltroDepto(e.target.value); setFiltroRegion('') }}
                style={{
                  padding:'7px 12px', border:'1px solid #BFDBFE', borderRadius:7,
                  fontFamily:'Inter', fontSize:12, color: filtroDepto ? '#1E40AF' : '#60A5FA',
                  background:'#EFF6FF', outline:'none', cursor:'pointer', fontWeight: filtroDepto ? 600 : 400,
                }}
              >
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
          {/* Filtros Naturaleza + Calendario para vistas agrupadas */}
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
                        onClick={() => setReporteAgrupado({ tipo: vista === 'regiones' ? 'region' : vista === 'municipios' ? 'municipio' : 'departamento', nombre: g.nombre, departamento: g.departamento })}
                        style={{ borderBottom:`1px solid ${C.bg2}`, background: baseBg, cursor:'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = C.green+'15'}
                        onMouseLeave={e => e.currentTarget.style.background = baseBg}
                      >
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

      {/* Vista colegios: sin datos + tabla */}
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

      {/* Tabla y controles */}
      {data.length > 0 && (
        <>
          {/* Resumen */}
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

          {/* Filtros */}
          <div style={{ background:C.white, borderRadius:10, padding:'16px 20px',
            border:`1px solid ${C.grayLt}`, marginBottom:16,
            display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
            <input
              value={buscar} onChange={e => setBuscar(e.target.value)}
              placeholder="Buscar colegio..."
              style={{ padding:'8px 14px', border:`1px solid ${C.grayLt}`, borderRadius:7,
                fontFamily:'Inter', fontSize:13, outline:'none', flex:1, minWidth:200 }}
            />
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

          {/* Tabla */}
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
                            borderBottom:`1px solid ${C.bg2}`,
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = C.green + '15'}
                          onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? rowBg(p) : rowBg(p) || `${C.bg}60`}
                        >
                          <Td style={{ fontWeight:700, color:C.navy, textAlign:'center', whiteSpace:'nowrap' }}>
                            {med ? <span style={{ marginRight:2 }}>{med}</span> : null}
                            {p}
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
                          <Td style={{ color:C.gray, whiteSpace:'nowrap', fontSize:11 }}>
                            {r.departamento}
                          </Td>
                          <Td style={{ color:C.gray, whiteSpace:'nowrap', fontSize:11 }}>
                            {r.ciudad}
                          </Td>
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

          {/* Paginación */}
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
  )
}
