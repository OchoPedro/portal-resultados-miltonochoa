import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { C } from '../../components/ui'
import ReportePlantel from './ReportePlantel'

const ANIOS = [2026, 2025, 2024, 2023, 2022, 2021, 2020]
const POR_PAGINA = 100

const DEPARTAMENTOS_COL = [
  'AMAZONAS','ANTIOQUIA','ARAUCA','ATLÁNTICO','CUNDINAMARCA','BOLÍVAR','BOYACÁ',
  'CALDAS','CAQUETÁ','CASANARE','CAUCA','CESAR','CHOCÓ','CÓRDOBA','CUNDINAMARCA',
  'GUAINÍA','GUAVIARE','HUILA','LA GUAJIRA','MAGDALENA','META','NARIÑO',
  'NORTE SANTANDER','PUTUMAYO','QUINDÍO','RISARALDA','SAN ANDRÉS','SANTANDER',
  'SUCRE','TOLIMA','VALLE DEL CAUCA','VAUPÉS','VICHADA',
]

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
  const [reporte, setReporte] = useState(null)

  const doLoad = async (a, p, bus, dep, nat, jorn, cal) => {
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
    if (nat)        q = q.eq('naturaleza', nat)
    if (jorn)       q = q.ilike('jornada', `%${jorn}%`)
    if (cal)        q = q.eq('calendario', cal)
    const { data: rows, count, error } = await q
    if (!error) { setData(rows || []); setTotal(count || 0) }
    setLoading(false)
  }

  useEffect(() => {
    doLoad(anio, pagina, buscar, filtroDepto, filtroNat, filtroJorn, filtroCalend)
  }, [anio, pagina, buscar, filtroDepto, filtroNat, filtroJorn, filtroCalend])

  const totalPags = Math.ceil(total / POR_PAGINA)

  return (
    <div>
      {/* Tabs de años */}
      <div style={{ display:'flex', gap:8, marginBottom:28, flexWrap:'wrap' }}>
        {ANIOS.map(a => (
          <Pill key={a} active={anio===a} onClick={() => setAnio(a)}>{a}</Pill>
        ))}
      </div>

      {/* Sin datos */}
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

      {/* Año 2025 */}
      {anio === 2025 && (
        <>
          {/* Resumen */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
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
            <SelectF value={filtroDepto} onChange={setFiltroDepto}
              options={DEPARTAMENTOS_COL} placeholder="Departamento" />
            <SelectF value={filtroNat} onChange={setFiltroNat}
              options={['OFICIAL','NO OFICIAL','OFICIAL(C)']} placeholder="Naturaleza" />
            <SelectF value={filtroCalend} onChange={setFiltroCalend}
              options={['A','B','O']} placeholder="Calendario" />
            <SelectF value={filtroJorn} onChange={setFiltroJorn}
              options={['MAÑANA','TARDE','NOCHE','COMPLETA','ÚNICA','SABATINO']} placeholder="Jornada" />
            {(buscar||filtroDepto||filtroNat||filtroCalend||filtroJorn) && (
              <button onClick={() => {
                setBuscar(''); setFiltroDepto(''); setFiltroNat('');
                setFiltroCalend(''); setFiltroJorn('')
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
                      <Th style={{ width:60 }}>#</Th>
                      <Th>Institución</Th>
                      <Th>Departamento</Th>
                      <Th>Ciudad</Th>
                      <Th style={{ textAlign:'center' }}>Cal.</Th>
                      <Th>Naturaleza</Th>
                      <Th>Jornada</Th>
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
                          onClick={() => setReporte({ codigo: r.codigo, nombre: r.nombre })}
                          style={{
                            background: i % 2 === 0 ? rowBg(p) : rowBg(p) || `${C.bg}60`,
                            borderBottom:`1px solid ${C.bg2}`,
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = C.green + '15'}
                          onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? rowBg(p) : rowBg(p) || `${C.bg}60`}
                        >
                          <Td style={{ fontWeight:700, color:C.navy, textAlign:'center' }}>
                            {med ? <span style={{ marginRight:2 }}>{med}</span> : null}
                            {p}
                          </Td>
                          <Td style={{ fontWeight:600, color:C.navy, maxWidth:260,
                            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                            textDecoration:'underline', textDecorationColor: C.green + '80' }}>
                            {r.nombre}
                          </Td>
                          <Td style={{ color:C.gray, whiteSpace:'nowrap' }}>
                            {r.departamento}
                          </Td>
                          <Td style={{ color:C.gray, whiteSpace:'nowrap' }}>
                            {r.ciudad}
                          </Td>
                          <Td style={{ textAlign:'center' }}>
                            <span style={{ background:r.calendario==='B'?C.navy+'18':C.green+'18',
                              color:r.calendario==='B'?C.navy:C.green,
                              padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600 }}>
                              {r.calendario}
                            </span>
                          </Td>
                          <Td style={{ color:C.gray, fontSize:11, whiteSpace:'nowrap' }}>
                            {r.naturaleza}
                          </Td>
                          <Td style={{ color:C.gray, fontSize:11, whiteSpace:'nowrap' }}>
                            {r.jornada}
                          </Td>
                          <Td style={{ textAlign:'center', color:C.gray }}>{r.eval_estudiantes}</Td>
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

      {reporte && (
        <ReportePlantel
          codigo={reporte.codigo}
          nombre={reporte.nombre}
          onClose={() => setReporte(null)}
        />
      )}
    </div>
  )
}
