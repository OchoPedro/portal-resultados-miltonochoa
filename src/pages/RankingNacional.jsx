// Ranking Nacional de colegios (ICFES) para la vista del COLEGIO — réplica de la pestaña
// "Ranking" del panel interno (admin.aamocolombia.com), adaptada al estilo inline y a los
// componentes del portal (que no usa Tailwind ni lucide). Solo lectura: los colegios ven el
// ranking nacional del último año cargado, con modos Nacional/Regiones/Departamentos/Municipios,
// buscador y filtros — igual que en plataforma interna. Datos de `ranking_colegios` (RLS: lectura
// pública a authenticated/anon, verificado). La lógica de carga/agregación es la misma del admin.
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { C, Card, Badge, useMobile } from '../components/ui'

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
const DEPTO_REGION = {}
Object.entries(REGIONES_COL).forEach(([r, ds]) => ds.forEach(d => { DEPTO_REGION[d] = r }))

// Paginación completa (Colombia tiene >12.000 colegios/año; un solo .limit corta y sesga).
async function fetchTodasLasFilas(factory, tam = 1000) {
  let all = [], offset = 0
  while (true) {
    const { data, error } = await factory(offset, tam)
    if (error) throw error
    const rows = data || []
    all = all.concat(rows)
    if (rows.length < tam) break
    offset += tam
  }
  return all
}

// ── helpers visuales (estilo portal, inline) ──────────────────────────────────
const medal = (p) => (p === 1 ? '🏆' : p === 2 ? '🥈' : p === 3 ? '🥉' : p <= 10 ? '⭐' : '')

function Score({ val }) {
  const n = parseFloat(val)
  if (isNaN(n)) return <span style={{ color: C.grayLt }}>—</span>
  const col = n >= 75 ? C.green : n >= 60 ? C.navy : n >= 50 ? C.amber : C.red
  return <span style={{ fontWeight: 600, color: col }}>{n.toFixed(1)}</span>
}

function Trend({ v }) {
  if (v == null) return <span style={{ color: C.grayLt }}>–</span>
  if (v > 0) return <span style={{ color: C.green, fontWeight: 700 }} title={`Subió ${v} posiciones`}>▲</span>
  if (v < 0) return <span style={{ color: C.red, fontWeight: 700 }} title={`Bajó ${Math.abs(v)} posiciones`}>▼</span>
  return <span style={{ color: C.gray }}>–</span>
}

const thBase = {
  textAlign: 'left', padding: '9px 10px', fontSize: 10, color: C.gray, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
  borderBottom: `2px solid ${C.bg2}`, background: C.white, position: 'sticky', top: 0, zIndex: 2,
  fontFamily: 'Inter',
}
const tdBase = { padding: '9px 10px', fontSize: 12, fontFamily: 'Inter', borderBottom: `1px solid ${C.bg2}` }
const Th = ({ children, style = {} }) => <th style={{ ...thBase, ...style }}>{children}</th>
const Td = ({ children, style = {} }) => <td style={{ ...tdBase, ...style }}>{children}</td>

function Sel({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      padding: '8px 10px', border: `1px solid ${C.grayLt}`, borderRadius: 7,
      background: C.white, fontFamily: 'Inter', fontSize: 12, outline: 'none', cursor: 'pointer',
      color: value ? C.text : C.gray,
    }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

const rowBg = (p, i) =>
  p === 1 ? '#FFFDE7' : p <= 3 ? '#FFF8E1' : p <= 10 ? '#F9FBE7' : p <= 50 ? '#F0FFF4'
  : i % 2 === 0 ? C.bg : 'transparent'

// ══════════════════════════════════════════════════════════════════════════════
export default function RankingNacional() {
  const mobile = useMobile()

  const [anios, setAnios]   = useState([])
  const [anio, setAnio]     = useState(null)
  const [data, setData]     = useState([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [buscar, setBuscar] = useState('')
  const [filtroDepto, setFiltroDepto]     = useState('')
  const [filtroDeptoAgrp, setFiltroDeptoAgrp] = useState('')
  const [filtroNat, setFiltroNat]         = useState('')
  const [filtroJorn, setFiltroJorn]       = useState('')
  const [filtroCalend, setFiltroCalend]   = useState('')
  const [filtroRegion, setFiltroRegion]   = useState('')
  const [vista, setVista]   = useState('colegios')
  const [agrupado, setAgrupado] = useState([])
  const [loadingAgrp, setLoadingAgrp] = useState(false)
  const [filtroNatAgrp, setFiltroNatAgrp] = useState('')
  const [filtroCalAgrp, setFiltroCalAgrp] = useState('')
  const [errorRanking, setErrorRanking] = useState('')
  const agrupadoReqRef = useRef(0)
  const doLoadReqRef = useRef(0)

  // Último año cargado + años disponibles (los 6 más recientes con datos).
  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.from('ranking_colegios')
        .select('anio').order('anio', { ascending: false }).limit(1)
      const maxY = (r && r[0]?.anio) || new Date().getFullYear() - 1
      const lista = Array.from({ length: 6 }, (_, i) => maxY - i)
      setAnios(lista); setAnio(maxY)
    })()
  }, [])

  const loadAgrupado = async (a, modo, dep = '', nat = '', cal = '') => {
    const myId = ++agrupadoReqRef.current
    setLoadingAgrp(true)
    const buildQ = (year, offset, tam) => {
      let q = supabase.from('ranking_colegios')
        .select('departamento,ciudad,eval_estudiantes,lectura_critica,matematicas,ciencias_sociales,ciencias_naturales,ingles,ponderado,puntaje_global,naturaleza,calendario')
        .eq('anio', year).range(offset, offset + tam - 1)
      if (modo === 'municipios' && dep) q = q.eq('departamento', dep)
      if (nat) q = q.eq('naturaleza', nat)
      if (cal) q = q.eq('calendario', cal)
      return q
    }
    const groupKey = (r) =>
      modo === 'regiones' ? (DEPTO_REGION[r.departamento] || 'Sin región')
      : modo === 'municipios' ? `${r.ciudad}|||${r.departamento}` : r.departamento
    const aggregate = (rows) => {
      const grupos = {}
      ;(rows || []).forEach(r => {
        const key = groupKey(r)
        if (!grupos[key]) grupos[key] = {
          nombre: modo === 'municipios' ? r.ciudad : key, departamento: r.departamento,
          colegios: 0, estudiantes: 0, lc: 0, mat: 0, cs: 0, cn: 0, ing: 0, pond: 0, glob: 0,
          nLc: 0, nMat: 0, nCs: 0, nCn: 0, nIng: 0, nPond: 0, nGlob: 0,
        }
        const g = grupos[key]
        g.colegios++; g.estudiantes += parseInt(r.eval_estudiantes || 0)
        const sumar = (campo, cont, valor) => {
          if (valor === null || valor === undefined || valor === '') return
          const n = parseFloat(valor); if (isNaN(n)) return
          g[campo] += n; g[cont]++
        }
        sumar('lc', 'nLc', r.lectura_critica); sumar('mat', 'nMat', r.matematicas)
        sumar('cs', 'nCs', r.ciencias_sociales); sumar('cn', 'nCn', r.ciencias_naturales)
        sumar('ing', 'nIng', r.ingles); sumar('pond', 'nPond', r.ponderado); sumar('glob', 'nGlob', r.puntaje_global)
      })
      return Object.values(grupos).map(g => ({
        nombre: g.nombre, departamento: g.departamento, colegios: g.colegios, estudiantes: g.estudiantes,
        lc: g.nLc ? g.lc / g.nLc : 0, mat: g.nMat ? g.mat / g.nMat : 0, cs: g.nCs ? g.cs / g.nCs : 0,
        cn: g.nCn ? g.cn / g.nCn : 0, ing: g.nIng ? g.ing / g.nIng : 0,
        pond: g.nPond ? g.pond / g.nPond : 0, glob: g.nGlob ? g.glob / g.nGlob : 0,
      })).sort((a, b) => b.pond - a.pond)
    }
    let currRows = [], prevRows = []
    try {
      ;[currRows, prevRows] = await Promise.all([
        fetchTodasLasFilas((o, t) => buildQ(a, o, t)),
        fetchTodasLasFilas((o, t) => buildQ(a - 1, o, t)),
      ])
    } catch (e) { if (myId === agrupadoReqRef.current) setLoadingAgrp(false); return }
    if (myId !== agrupadoReqRef.current) return
    const current = aggregate(currRows), prev = aggregate(prevRows)
    const prevRankMap = {}
    prev.forEach((g, i) => { prevRankMap[modo === 'municipios' ? `${g.nombre}|||${g.departamento}` : g.nombre] = i + 1 })
    setAgrupado(current.map((g, i) => {
      const k = modo === 'municipios' ? `${g.nombre}|||${g.departamento}` : g.nombre
      const pr = prevRankMap[k]
      return { ...g, comportamiento: pr != null ? pr - (i + 1) : null }
    }))
    setLoadingAgrp(false)
  }

  const doLoad = async (a, p, bus, dep, nat, jorn, cal, reg) => {
    const myId = ++doLoadReqRef.current
    setLoading(true)
    const offset = (p - 1) * POR_PAGINA
    let q = supabase.from('ranking_colegios')
      .select('*', { count: 'exact' })
      .eq('anio', a).order('puesto_anio', { ascending: true })
      .range(offset, offset + POR_PAGINA - 1)
    if (bus.trim()) q = q.ilike('nombre', `%${bus.trim()}%`)
    if (dep)      q = q.eq('departamento', dep)
    else if (reg) q = q.in('departamento', REGIONES_COL[reg] || [])
    if (nat)      q = q.eq('naturaleza', nat)
    if (jorn)     q = q.ilike('jornada', `%${jorn}%`)
    if (cal)      q = q.eq('calendario', cal)
    const { data: rows, count, error } = await q
    if (myId !== doLoadReqRef.current) return
    if (error) { setErrorRanking('No se pudo cargar el ranking — intenta de nuevo.'); setData([]); setTotal(0); setLoading(false); return }
    setErrorRanking('')
    if (rows?.length) {
      const { data: prevRows } = await supabase.from('ranking_colegios')
        .select('codigo,puesto_anio').eq('anio', a - 1).in('codigo', rows.map(r => r.codigo))
      if (myId !== doLoadReqRef.current) return
      const prevMap = {}
      ;(prevRows || []).forEach(r => { prevMap[r.codigo] = r.puesto_anio })
      setData(rows.map(r => ({ ...r, comportamiento: prevMap[r.codigo] != null ? prevMap[r.codigo] - r.puesto_anio : null })))
      setTotal(count || 0)
    } else { setData([]); setTotal(0) }
    setLoading(false)
  }

  useEffect(() => {
    if (anio == null) return
    doLoad(anio, pagina, buscar, filtroDepto, filtroNat, filtroJorn, filtroCalend, filtroRegion)
  }, [anio, pagina, buscar, filtroDepto, filtroNat, filtroJorn, filtroCalend, filtroRegion])

  useEffect(() => {
    if (anio == null || vista === 'colegios') return
    loadAgrupado(anio, vista, filtroDeptoAgrp, filtroNatAgrp, filtroCalAgrp)
  }, [vista, anio, filtroDeptoAgrp, filtroNatAgrp, filtroCalAgrp])

  const totalPags = Math.ceil(total / POR_PAGINA) || 1
  const VISTA_OPTS = [['colegios', '🏆 Nacional'], ['regiones', '🌎 Regiones'], ['departamentos', '🗺️ Departamentos'], ['municipios', '🏙️ Municipios']]

  const pillStyle = (active) => ({
    padding: '7px 16px', borderRadius: 999, fontFamily: 'Inter', fontSize: 13, cursor: 'pointer',
    border: `1px solid ${active ? C.navy : C.grayLt}`, transition: 'all 0.15s',
    background: active ? C.navy : C.white, color: active ? C.white : C.gray, fontWeight: active ? 600 : 400,
  })
  const modeStyle = (active) => ({
    padding: '6px 13px', borderRadius: 7, border: 'none', fontFamily: 'Inter', fontSize: 12, cursor: 'pointer',
    background: active ? C.navy : 'transparent', color: active ? C.white : C.gray, fontWeight: active ? 600 : 400,
  })

  const limpiar = () => { setBuscar(''); setFiltroRegion(''); setFiltroDepto(''); setFiltroNat(''); setFiltroCalend(''); setFiltroJorn('') }
  const hayFiltros = buscar || filtroRegion || filtroDepto || filtroNat || filtroCalend || filtroJorn

  return (
    <div>
      {/* año + modo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {anios.map(a => <button key={a} onClick={() => { setAnio(a); setPagina(1) }} style={pillStyle(anio === a)}>{a}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 3, background: C.bg2, borderRadius: 9, padding: 4 }}>
          {VISTA_OPTS.map(([v, l]) => <button key={v} onClick={() => setVista(v)} style={modeStyle(vista === v)}>{l}</button>)}
        </div>
      </div>

      {/* ── Vistas agrupadas (Regiones / Departamentos / Municipios) ── */}
      {vista !== 'colegios' && (
        <div>
          {vista === 'municipios' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.blue + '14', border: `1px solid ${C.blue}40`, borderRadius: 9, padding: '10px 14px', marginBottom: 12, fontFamily: 'Inter', fontSize: 13, color: C.blue, flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 180 }}>
                {filtroDeptoAgrp ? <>Municipios de <strong>{filtroDeptoAgrp}</strong> — ordenados por ponderado</> : <>Filtra por departamento o consulta todos los municipios</>}
              </span>
              <Sel value={filtroDeptoAgrp} onChange={setFiltroDeptoAgrp} options={DEPARTAMENTOS_COL} placeholder="Todos los departamentos" />
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <Sel value={filtroNatAgrp} onChange={setFiltroNatAgrp} options={['OFICIAL', 'NO OFICIAL', 'OFICIAL(C)']} placeholder="Naturaleza" />
            <Sel value={filtroCalAgrp} onChange={setFiltroCalAgrp} options={['A', 'B', 'O']} placeholder="Calendario" />
          </div>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {loadingAgrp ? <div style={{ padding: 40, textAlign: 'center', color: C.gray, fontFamily: 'Inter' }}>Cargando…</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <Th style={{ width: 40, textAlign: 'center' }}>#</Th>
                    <Th>{vista === 'regiones' ? 'Región' : vista === 'municipios' ? 'Municipio' : 'Departamento'}</Th>
                    {vista === 'municipios' && <Th>Departamento</Th>}
                    <Th style={{ textAlign: 'center' }}>Tend.</Th>
                    <Th style={{ textAlign: 'center' }}>Colegios</Th>
                    <Th style={{ textAlign: 'center' }}>Estud.</Th>
                    <Th style={{ textAlign: 'center' }}>L.C.</Th><Th style={{ textAlign: 'center' }}>Mat.</Th>
                    <Th style={{ textAlign: 'center' }}>C.S.</Th><Th style={{ textAlign: 'center' }}>C.N.</Th>
                    <Th style={{ textAlign: 'center' }}>Inglés</Th><Th style={{ textAlign: 'center' }}>Ponder.</Th><Th style={{ textAlign: 'center' }}>Global</Th>
                  </tr></thead>
                  <tbody>
                    {agrupado.map((g, i) => (
                      <tr key={g.nombre + g.departamento} style={{ background: rowBg(i + 1, i) }}>
                        <Td style={{ textAlign: 'center', fontWeight: 700, color: C.navy }}>{medal(i + 1)}{i + 1}</Td>
                        <Td style={{ fontWeight: 600, color: C.navy }}>{g.nombre}</Td>
                        {vista === 'municipios' && <Td style={{ color: C.gray, fontSize: 11 }}>{g.departamento}</Td>}
                        <Td style={{ textAlign: 'center' }}><Trend v={g.comportamiento} /></Td>
                        <Td style={{ textAlign: 'center', color: C.gray }}>{g.colegios.toLocaleString('es-CO')}</Td>
                        <Td style={{ textAlign: 'center', color: C.gray }}>{g.estudiantes.toLocaleString('es-CO')}</Td>
                        <Td style={{ textAlign: 'center' }}><Score val={g.lc} /></Td><Td style={{ textAlign: 'center' }}><Score val={g.mat} /></Td>
                        <Td style={{ textAlign: 'center' }}><Score val={g.cs} /></Td><Td style={{ textAlign: 'center' }}><Score val={g.cn} /></Td>
                        <Td style={{ textAlign: 'center' }}><Score val={g.ing} /></Td>
                        <Td style={{ textAlign: 'center', fontWeight: 700, color: C.navy }}>{g.pond.toFixed(3)}</Td>
                        <Td style={{ textAlign: 'center', fontWeight: 700, color: C.navy }}>{g.glob.toFixed(1)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Vista Nacional (colegios) ── */}
      {vista === 'colegios' && <>
        {errorRanking && <div style={{ background: C.red + '14', border: `1px solid ${C.red}40`, borderRadius: 9, padding: '10px 14px', marginBottom: 14, color: C.red, fontFamily: 'Inter', fontSize: 13 }}>⚠️ {errorRanking}</div>}

        {data.length > 0 && (
          <div style={{ display: 'grid', gap: 14, marginBottom: 18, gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4,1fr)' }}>
            {[
              { label: 'Total colegios', value: total.toLocaleString('es-CO') },
              { label: '1er puesto', value: (data[0]?.nombre?.slice(0, 22) || '—'), small: true },
              { label: 'Puntaje máx.', value: data[0]?.puntaje_global ?? '—' },
              { label: 'Página', value: `${pagina} / ${totalPags}` },
            ].map((s, i) => (
              <Card key={i} style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 9, color: C.gray, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: s.small ? 13 : 22, fontWeight: 700, color: C.navy, fontFamily: s.small ? 'Inter' : 'Playfair Display, serif' }}>{s.value}</div>
              </Card>
            ))}
          </div>
        )}

        <Card style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: 16 }}>
          <input value={buscar} onChange={e => { setBuscar(e.target.value); setPagina(1) }} placeholder="Buscar colegio..."
            style={{ padding: '8px 12px', border: `1px solid ${C.grayLt}`, borderRadius: 7, fontFamily: 'Inter', fontSize: 13, outline: 'none', flex: 1, minWidth: 200, background: C.white, color: C.text }} />
          <Sel value={filtroRegion} onChange={v => { setFiltroRegion(v); setFiltroDepto(''); setPagina(1) }} options={Object.keys(REGIONES_COL)} placeholder="Región" />
          <Sel value={filtroDepto} onChange={v => { setFiltroDepto(v); setFiltroRegion(''); setPagina(1) }} options={DEPARTAMENTOS_COL} placeholder="Departamento" />
          <Sel value={filtroNat} onChange={v => { setFiltroNat(v); setPagina(1) }} options={['OFICIAL', 'NO OFICIAL', 'OFICIAL(C)']} placeholder="Naturaleza" />
          <Sel value={filtroCalend} onChange={v => { setFiltroCalend(v); setPagina(1) }} options={['A', 'B', 'O']} placeholder="Calendario" />
          <Sel value={filtroJorn} onChange={v => { setFiltroJorn(v); setPagina(1) }} options={['MAÑANA', 'TARDE', 'NOCHE', 'COMPLETA', 'ÚNICA', 'SABATINO']} placeholder="Jornada" />
          {hayFiltros && <button onClick={limpiar} style={{ padding: '8px 12px', border: `1px solid ${C.red}`, borderRadius: 7, background: 'transparent', color: C.red, fontFamily: 'Inter', fontSize: 12, cursor: 'pointer' }}>✕ Limpiar</button>}
        </Card>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: C.gray, fontFamily: 'Inter' }}>Cargando ranking…</div>
            : data.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: C.gray, fontFamily: 'Inter' }}>No se encontraron resultados. Intenta con otros filtros.</div>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <Th style={{ width: 60, textAlign: 'center' }}>#</Th>
                    <Th style={{ width: 24, textAlign: 'center' }}>⇅</Th>
                    <Th>Institución</Th><Th>Departamento</Th><Th>Ciudad</Th>
                    <Th style={{ textAlign: 'center' }}>Cal.</Th><Th style={{ textAlign: 'center' }}>Eval.</Th>
                    <Th style={{ textAlign: 'center' }}>L.C.</Th><Th style={{ textAlign: 'center' }}>Mat.</Th>
                    <Th style={{ textAlign: 'center' }}>C.S.</Th><Th style={{ textAlign: 'center' }}>C.N.</Th>
                    <Th style={{ textAlign: 'center' }}>Inglés</Th><Th style={{ textAlign: 'center' }}>Ponder.</Th><Th style={{ textAlign: 'center' }}>Global</Th>
                  </tr></thead>
                  <tbody>
                    {data.map((r, i) => {
                      const p = r.puesto_anio
                      return (
                        <tr key={r.id} style={{ background: rowBg(p, i) }}>
                          <Td style={{ fontWeight: 700, color: C.navy, textAlign: 'center', whiteSpace: 'nowrap' }}>{medal(p)}{p}</Td>
                          <Td style={{ textAlign: 'center', padding: '9px 4px' }}><Trend v={r.comportamiento} /></Td>
                          <Td style={{ maxWidth: 240 }}>
                            <div style={{ fontWeight: 600, color: C.navy, maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nombre}</div>
                            <div style={{ color: C.gray, fontSize: 10, fontFamily: 'monospace', marginTop: 2 }}>{r.dane || '—'}</div>
                          </Td>
                          <Td style={{ color: C.gray, whiteSpace: 'nowrap', fontSize: 11 }}>{r.departamento}</Td>
                          <Td style={{ color: C.gray, whiteSpace: 'nowrap', fontSize: 11 }}>{r.ciudad}</Td>
                          <Td style={{ textAlign: 'center' }}><Badge color={r.calendario === 'B' ? C.amber : C.green}>{r.calendario}</Badge></Td>
                          <Td style={{ textAlign: 'center', color: C.gray, fontSize: 11 }}>{r.eval_estudiantes}</Td>
                          <Td style={{ textAlign: 'center' }}><Score val={r.lectura_critica} /></Td>
                          <Td style={{ textAlign: 'center' }}><Score val={r.matematicas} /></Td>
                          <Td style={{ textAlign: 'center' }}><Score val={r.ciencias_sociales} /></Td>
                          <Td style={{ textAlign: 'center' }}><Score val={r.ciencias_naturales} /></Td>
                          <Td style={{ textAlign: 'center' }}><Score val={r.ingles} /></Td>
                          <Td style={{ textAlign: 'center', fontWeight: 700, color: C.navy, fontSize: 13 }}>{parseFloat(r.ponderado || 0).toFixed(2)}</Td>
                          <Td style={{ textAlign: 'center', fontWeight: 700, color: C.text, fontSize: 14 }}>{r.puntaje_global}</Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </Card>

        {data.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 18, fontFamily: 'Inter', fontSize: 13, color: C.gray, flexWrap: 'wrap' }}>
            <button disabled={pagina <= 1} onClick={() => setPagina(1)} style={pgBtn(pagina <= 1)}>«</button>
            <button disabled={pagina <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))} style={pgBtn(pagina <= 1)}>‹</button>
            <span>Página <strong style={{ color: C.navy }}>{pagina}</strong> / {totalPags} · {total.toLocaleString('es-CO')} colegios</span>
            <button disabled={pagina >= totalPags} onClick={() => setPagina(p => Math.min(totalPags, p + 1))} style={pgBtn(pagina >= totalPags)}>›</button>
            <button disabled={pagina >= totalPags} onClick={() => setPagina(totalPags)} style={pgBtn(pagina >= totalPags)}>»</button>
          </div>
        )}
      </>}
    </div>
  )
}

const pgBtn = (disabled) => ({
  padding: '6px 11px', border: `1px solid ${C.grayLt}`, borderRadius: 7, background: C.white,
  color: disabled ? C.grayLt : C.navy, cursor: disabled ? 'default' : 'pointer', fontSize: 13, fontFamily: 'Inter',
})
