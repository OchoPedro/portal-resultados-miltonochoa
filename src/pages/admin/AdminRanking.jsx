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

// ─── Ponderado chart helpers ──────────────────────────────────────────────────

const CLAS_COL_BG  = { 'A+':'#6EE7B7', 'A':'#93C5FD', 'B':'#FCD34D', 'C':'#FCA5A5', 'D':'#D1D5DB' }
const CLAS_COL_TXT = { 'A+':'#065F46', 'A':'#1E40AF', 'B':'#92400E', 'C':'#991B1B', 'D':'#6B7280' }

function DistBar({ anio, counts, total }) {
  const OPTS = ['A+', 'A', 'B', 'C', 'D']
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
        <span style={{ fontSize:13, fontWeight:700, color: anio === 'prom' ? C.green : C.navy,
          fontFamily:'Playfair Display, serif' }}>
          {anio === 'prom' ? '⊘ Promedio 3 años' : anio}
        </span>
        <span style={{ fontSize:11, color:C.gray, fontFamily:'Inter' }}>
          {total.toLocaleString('es-CO')} sedes
        </span>
      </div>
      <div style={{ display:'flex', height:28, borderRadius:6, overflow:'hidden',
        border:`1px solid ${C.grayLt}`, boxShadow:'inset 0 1px 2px rgba(0,0,0,0.04)' }}>
        {OPTS.map(c => {
          const cnt = counts[c] || 0
          const pct = total > 0 ? cnt / total * 100 : 0
          if (pct < 0.1) return null
          return (
            <div key={c} style={{ width:`${pct}%`, background:CLAS_COL_BG[c],
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:10, fontWeight:700, color:CLAS_COL_TXT[c], transition:'width 0.3s ease' }}
              title={`${c}: ${cnt.toLocaleString('es-CO')} (${pct.toFixed(1)}%)`}>
              {pct > 5 ? c : ''}
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex', gap:12, marginTop:5, flexWrap:'wrap' }}>
        {OPTS.map(c => {
          const cnt = counts[c] || 0
          const pct = total > 0 ? cnt / total * 100 : 0
          return (
            <span key={c} style={{ fontSize:10, fontFamily:'Inter', display:'flex', alignItems:'center', gap:3 }}>
              <span style={{ display:'inline-block', width:8, height:8, borderRadius:2,
                background:CLAS_COL_BG[c], flexShrink:0 }} />
              <span style={{ color:C.gray }}>
                {c}: <strong style={{ color:CLAS_COL_TXT[c] }}>{cnt.toLocaleString('es-CO')}</strong>
                <span style={{ color:C.grayLt }}> ({pct.toFixed(1)}%)</span>
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function IndexChart({ stats }) {
  const [tooltip, setTooltip] = useState(null)
  const areas  = ['mat','cn','soc','lc','ing','total']
  const labels = ['Matemáticas','C. Naturales','Soc. y Ciu.','Lect. Crítica','Inglés','Índice Total']
  const bColors = ['#0A1F3D','#2D9B6F','#3B82F6']
  const W=580, H=200, PAD={ top:14, right:16, bottom:52, left:48 }
  const cW = W-PAD.left-PAD.right, cH = H-PAD.top-PAD.bottom
  const nG = areas.length, nB = stats.length
  const gW = cW / nG
  const bW = Math.min((gW * 0.72) / Math.max(nB, 1), 18)
  const bGap = (gW - bW * nB) / (nB + 1)
  const yS = v => PAD.top + cH - v * cH

  return (
    <div style={{ position:'relative', userSelect:'none' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', overflow:'visible' }}
        onMouseLeave={() => setTooltip(null)}>
        {[0, 0.25, 0.5, 0.75, 1.0].map(v => {
          const y = yS(v)
          return (
            <g key={v}>
              <line x1={PAD.left} y1={y} x2={W-PAD.right} y2={y}
                stroke={v===0 ? '#D1D5DB' : '#F3F4F6'} strokeWidth={v===0 ? 1 : 0.75} />
              <text x={PAD.left-4} y={y+3.5} fontSize={8} fill="#9CA3AF" textAnchor="end">
                {v.toFixed(2)}
              </text>
            </g>
          )
        })}
        {areas.map((area, gi) => {
          const gX = PAD.left + gi * gW
          return (
            <g key={area}>
              {stats.map((s, si) => {
                const val = Math.min(s.avgIdx[area] || 0, 1)
                const x = gX + bGap + si * (bW + bGap / Math.max(nB,1))
                const bH = Math.max(val * cH, 1)
                const y = PAD.top + cH - bH
                const color = bColors[si % bColors.length]
                return (
                  <g key={si}>
                    <rect x={x} y={y} width={bW} height={bH}
                      fill={color} rx={2}
                      opacity={tooltip && (tooltip.gi!==gi || tooltip.si!==si) ? 0.45 : 0.9}
                      style={{ cursor:'pointer' }}
                      onMouseEnter={e => {
                        const svgRect = e.currentTarget.closest('svg').getBoundingClientRect()
                        const elRect  = e.currentTarget.getBoundingClientRect()
                        setTooltip({
                          gi, si, val,
                          label: labels[gi], anio: s.anio, color,
                          pctX: (elRect.left + elRect.width/2 - svgRect.left) / svgRect.width * 100,
                          pctY: (elRect.top - svgRect.top) / svgRect.height * 100,
                        })
                      }}
                    />
                    {bH > 18 && (
                      <text x={x+bW/2} y={y+10} fontSize={6} fill="white"
                        textAnchor="middle" fontWeight="700" style={{ pointerEvents:'none' }}>
                        {val.toFixed(4)}
                      </text>
                    )}
                  </g>
                )
              })}
              <text x={gX+gW/2} y={H-PAD.bottom+13} fontSize={8.5} fill="#374151"
                textAnchor="middle" fontWeight="600">{labels[gi]}</text>
            </g>
          )
        })}
        {stats.map((s, si) => (
          <g key={si} transform={`translate(${PAD.left + si*90},${H-8})`}>
            <rect x={0} y={-9} width={10} height={10} fill={bColors[si%bColors.length]} rx={2} />
            <text x={14} y={0} fontSize={9} fill="#374151" fontWeight="600">{s.anio}</text>
          </g>
        ))}
      </svg>
      {tooltip && (
        <div style={{
          position:'absolute',
          left:`${Math.min(tooltip.pctX, 75)}%`,
          top:`${tooltip.pctY}%`,
          transform:'translate(-50%,-115%)',
          background:C.navy, color:C.white, borderRadius:8,
          padding:'8px 14px', fontSize:12, fontFamily:'Inter',
          pointerEvents:'none', zIndex:20, whiteSpace:'nowrap',
          boxShadow:'0 4px 20px rgba(10,31,61,0.3)', lineHeight:1.5,
        }}>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginBottom:2 }}>
            {tooltip.label} · <strong style={{ color:C.white }}>{tooltip.anio}</strong>
          </div>
          <div style={{ fontSize:16, fontWeight:700, color:'#6EE7B7' }}>
            {tooltip.val.toFixed(4)}
          </div>
          <div style={{
            position:'absolute', bottom:-6, left:'50%', transform:'translateX(-50%)',
            width:0, height:0,
            borderLeft:'6px solid transparent', borderRight:'6px solid transparent',
            borderTop:`6px solid ${C.navy}`,
          }} />
        </div>
      )}
    </div>
  )
}

function RadarChart({ stats }) {
  const [tooltip, setTooltip] = useState(null)
  const areas  = ['mat','cn','soc','lc','ing','total']
  const labels = ['Matemáticas','C. Naturales','Soc. y Ciu.','Lect. Crítica','Inglés','Índice Total']
  const bColors = ['#0A1F3D','#2D9B6F','#3B82F6']
  const W=480, H=420, cx=220, cy=195, R=145
  const N = areas.length
  const ang = i => (i / N) * 2 * Math.PI - Math.PI / 2
  const pt  = (v, i) => ({ x: cx + R*v*Math.cos(ang(i)), y: cy + R*v*Math.sin(ang(i)) })

  if (!stats || !stats.length) return null

  // Determinar rango dinámico para que las diferencias sean visibles
  const allVals = stats.flatMap(s => areas.map(a => s.avgIdx[a] || 0)).filter(v => v>0)
  const dataMin = allVals.length ? Math.max(0, Math.min(...allVals) - 0.05) : 0
  const dataMax = allVals.length ? Math.min(1, Math.max(...allVals) + 0.02) : 1
  const range = dataMax - dataMin || 1
  // Normalizar valor al rango [dataMin, dataMax] → [0,1] para posición en radar
  const norm = v => Math.max(0, Math.min(1, (v - dataMin) / range))

  const polyPts = s => areas.map((a,i) => {
    const p = pt(norm(s.avgIdx[a] || 0), i)
    return `${p.x},${p.y}`
  }).join(' ')

  const gridLevels = [0.25, 0.5, 0.75, 1.0]
  const gridVal = lvl => (dataMin + lvl * range).toFixed(3)

  return (
    <div style={{ position:'relative', userSelect:'none' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', overflow:'visible' }}
        onMouseLeave={() => setTooltip(null)}>
        {/* Grid concéntrico */}
        {gridLevels.map(lvl => (
          <polygon key={lvl}
            points={areas.map((_,i) => { const p = pt(lvl,i); return `${p.x},${p.y}` }).join(' ')}
            fill="none" stroke="#E5E7EB" strokeWidth={lvl===1?1.2:0.75}
            strokeDasharray={lvl<1?'3,3':''} />
        ))}
        {/* Etiquetas de grid */}
        {gridLevels.map(lvl => (
          <text key={lvl} x={cx+5} y={cy - R*lvl + 3.5} fontSize={7.5} fill="#9CA3AF">
            {gridVal(lvl)}
          </text>
        ))}
        {/* Ejes */}
        {areas.map((_,i) => {
          const end = pt(1,i)
          const lp  = pt(1.18,i)
          const anchor = lp.x < cx-5 ? 'end' : lp.x > cx+5 ? 'start' : 'middle'
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#D1D5DB" strokeWidth={0.75} />
              <text x={lp.x} y={lp.y+3} fontSize={9} fill="#374151" fontWeight="600"
                textAnchor={anchor}>{labels[i]}</text>
            </g>
          )
        })}
        {/* Centro */}
        <circle cx={cx} cy={cy} r={2} fill="#9CA3AF" />
        {/* Polígonos de datos */}
        {stats.map((s,si) => (
          <polygon key={s.anio} points={polyPts(s)}
            fill={bColors[si]} fillOpacity={0.12}
            stroke={bColors[si]} strokeWidth={2} strokeLinejoin="round" />
        ))}
        {/* Puntos interactivos */}
        {stats.map((s,si) =>
          areas.map((area,i) => {
            const v = s.avgIdx[area] || 0
            const p = pt(norm(v), i)
            const isHov = tooltip?.key === `${si}_${i}`
            return (
              <circle key={`${si}_${i}`} cx={p.x} cy={p.y} r={isHov?7:5}
                fill={bColors[si]} stroke="white" strokeWidth={isHov?2:1.5}
                style={{ cursor:'pointer' }}
                onMouseEnter={e => {
                  const svgRect = e.currentTarget.closest('svg').getBoundingClientRect()
                  const el = e.currentTarget.getBoundingClientRect()
                  setTooltip({
                    key:`${si}_${i}`,
                    label: labels[i], anio: s.anio, val: v,
                    color: bColors[si],
                    pctX: (el.left + el.width/2 - svgRect.left) / svgRect.width * 100,
                    pctY: (el.top  - svgRect.top)  / svgRect.height * 100,
                  })
                }}
              />
            )
          })
        )}
        {/* Leyenda */}
        {stats.map((s,si) => (
          <g key={si} transform={`translate(${W-110},${30+si*22})`}>
            <rect x={0} y={-10} width={14} height={14} fill={bColors[si]} rx={3}
              fillOpacity={0.85} />
            <text x={20} y={2} fontSize={11} fill="#1F2937" fontWeight="700">{s.anio}</text>
          </g>
        ))}
        {/* Nota escala */}
        <text x={cx} y={H-8} fontSize={8} fill="#9CA3AF" textAnchor="middle">
          Escala dinámica: {dataMin.toFixed(3)} – {dataMax.toFixed(3)}
        </text>
      </svg>
      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position:'absolute',
          left:`${Math.min(Math.max(tooltip.pctX,10),75)}%`,
          top:`${tooltip.pctY}%`,
          transform:'translate(-50%,-120%)',
          background:C.navy, color:C.white, borderRadius:8,
          padding:'8px 14px', fontSize:11, fontFamily:'Inter',
          pointerEvents:'none', zIndex:20, whiteSpace:'nowrap',
          boxShadow:'0 4px 20px rgba(10,31,61,0.35)', lineHeight:1.5,
        }}>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginBottom:2 }}>
            {tooltip.label} · <strong style={{ color:'white' }}>{tooltip.anio}</strong>
          </div>
          <div style={{ fontSize:16, fontWeight:700, color:'#6EE7B7' }}>
            {tooltip.val.toFixed(4)}
          </div>
          <div style={{
            position:'absolute', bottom:-6, left:'50%', transform:'translateX(-50%)',
            width:0, height:0, borderLeft:'6px solid transparent',
            borderRight:'6px solid transparent', borderTop:`6px solid ${C.navy}`,
          }} />
        </div>
      )}
    </div>
  )
}

function ScatterChart({ data, aniosPond }) {
  const [tooltip, setTooltip] = useState(null)
  const W=600, H=300, PAD={ top:20, right:140, bottom:50, left:52 }
  const cW = W-PAD.left-PAD.right, cH = H-PAD.top-PAD.bottom
  const bColors = ['#0A1F3D','#2D9B6F','#3B82F6']
  const colorMap = {}
  ;(aniosPond||[]).forEach((a,i) => { colorMap[a] = bColors[i % bColors.length] })

  const valid = data.filter(r => r.puntaje_global != null && r.idx_ingles != null)
  if (!valid.length) return <div style={{ color:C.gray, fontSize:12, padding:20, textAlign:'center' }}>Sin datos suficientes</div>

  const allX = valid.map(r => +r.puntaje_global)
  const allY = valid.map(r => +r.idx_ingles)
  // Rango mínimo de 0.08 para que los puntos no se vean aplastados
  const MR = 0.08
  const rawMinX = Math.min(...allX), rawMaxX = Math.max(...allX)
  const rawMinY = Math.min(...allY), rawMaxY = Math.max(...allY)
  const padX = Math.max((MR - (rawMaxX - rawMinX)) / 2, 0.015)
  const padY = Math.max((MR - (rawMaxY - rawMinY)) / 2, 0.015)
  const minX = Math.max(0, rawMinX - padX)
  const maxX = Math.min(1, rawMaxX + padX)
  const minY = Math.max(0, rawMinY - padY)
  const maxY = Math.min(1, rawMaxY + padY)

  const xPos = v => PAD.left + ((v - minX) / (maxX - minX)) * cW
  const yPos = v => PAD.top  + cH - ((v - minY) / (maxY - minY)) * cH

  const TICKS = 5
  const xStep = (maxX - minX) / TICKS
  const yStep = (maxY - minY) / TICKS

  return (
    <div style={{ position:'relative', userSelect:'none' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', overflow:'visible' }}
        onMouseLeave={() => setTooltip(null)}>
        {/* Fondo área del gráfico */}
        <rect x={PAD.left} y={PAD.top} width={cW} height={cH}
          fill="#F9FAFB" rx={4} stroke="#E5E7EB" strokeWidth={0.5} />
        {/* Grid Y */}
        {Array.from({ length: TICKS+1 }, (_, i) => {
          const v = minY + i * yStep
          const y = yPos(v)
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={PAD.left+cW} y2={y}
                stroke={i===0?'#D1D5DB':'#E5E7EB'} strokeWidth={i===0?1:0.75} strokeDasharray={i>0?'3,3':''} />
              <text x={PAD.left-5} y={y+3.5} fontSize={8} fill="#9CA3AF" textAnchor="end">
                {v.toFixed(3)}
              </text>
            </g>
          )
        })}
        {/* Grid X */}
        {Array.from({ length: TICKS+1 }, (_, i) => {
          const v = minX + i * xStep
          const x = xPos(v)
          return (
            <g key={i}>
              <line x1={x} y1={PAD.top} x2={x} y2={PAD.top+cH}
                stroke='#E5E7EB' strokeWidth={0.75} strokeDasharray="3,3" />
              <text x={x} y={PAD.top+cH+13} fontSize={8} fill="#9CA3AF" textAnchor="middle">
                {v.toFixed(3)}
              </text>
            </g>
          )
        })}
        {/* Puntos — líneas entre años del mismo plantel */}
        {Object.entries(
          valid.reduce((acc, r) => {
            if (!acc[r.codigo_dane]) acc[r.codigo_dane] = []
            acc[r.codigo_dane].push(r)
            return acc
          }, {})
        ).map(([dane, rows]) => {
          const sorted = [...rows].sort((a,b)=>a.anio-b.anio)
          return sorted.slice(0,-1).map((r,i) => {
            const next = sorted[i+1]
            return (
              <line key={`${dane}_${i}`}
                x1={xPos(+r.puntaje_global)} y1={yPos(+r.idx_ingles)}
                x2={xPos(+next.puntaje_global)} y2={yPos(+next.idx_ingles)}
                stroke="#CBD5E1" strokeWidth={1} strokeDasharray="3,2" />
            )
          })
        })}
        {/* Puntos */}
        {valid.map((r, i) => {
          const cx = xPos(+r.puntaje_global)
          const cy = yPos(+r.idx_ingles)
          const color = colorMap[r.anio] || '#6B7280'
          const isHov = tooltip?.i === i
          return (
            <circle key={i} cx={cx} cy={cy} r={isHov ? 7 : 5}
              fill={color} opacity={isHov ? 1 : 0.8}
              stroke="white" strokeWidth={isHov?2:1}
              style={{ cursor:'pointer' }}
              onMouseEnter={e => {
                const svgRect = e.currentTarget.closest('svg').getBoundingClientRect()
                const elRect  = e.currentTarget.getBoundingClientRect()
                setTooltip({
                  i, r,
                  pctX: (elRect.left + elRect.width/2 - svgRect.left) / svgRect.width * 100,
                  pctY: (elRect.top - svgRect.top) / svgRect.height * 100,
                })
              }}
            />
          )
        })}
        {/* Eje X label */}
        <text x={PAD.left + cW/2} y={H-6} fontSize={9} fill="#4B5563"
          textAnchor="middle" fontWeight="600">→ Índice Total</text>
        {/* Eje Y label */}
        <text x={12} y={PAD.top + cH/2} fontSize={9} fill="#4B5563"
          textAnchor="middle" fontWeight="600"
          transform={`rotate(-90, 12, ${PAD.top + cH/2})`}>↑ Inglés</text>
        {/* Leyenda dentro del gráfico (derecha) */}
        <rect x={PAD.left+cW+10} y={PAD.top} width={120} height={36+(aniosPond||[]).length*18}
          rx={6} fill="white" stroke="#E5E7EB" strokeWidth={0.75} />
        <text x={PAD.left+cW+16} y={PAD.top+12} fontSize={8} fill="#6B7280" fontWeight="600">AÑO</text>
        {(aniosPond||[]).map((a,i) => (
          <g key={a} transform={`translate(${PAD.left+cW+16},${PAD.top+24+i*18})`}>
            <circle cx={5} cy={0} r={5} fill={bColors[i%bColors.length]} />
            <text x={14} y={4} fontSize={9} fill="#374151" fontWeight="600">{a}</text>
          </g>
        ))}
        {/* Nota: n puntos */}
        <text x={PAD.left+cW} y={PAD.top+cH+34} fontSize={8} fill="#9CA3AF" textAnchor="end">
          {valid.length} registros · {new Set(valid.map(r=>r.codigo_dane)).size} planteles
        </text>
      </svg>
      {/* Tooltip flotante */}
      {tooltip && (
        <div style={{
          position:'absolute',
          left:`${Math.min(tooltip.pctX, 68)}%`,
          top:`${tooltip.pctY}%`,
          transform:'translate(-50%,-115%)',
          background:C.navy, color:C.white, borderRadius:8,
          padding:'10px 14px', fontSize:11, fontFamily:'Inter',
          pointerEvents:'none', zIndex:20, minWidth:200,
          boxShadow:'0 4px 20px rgba(10,31,61,0.35)', lineHeight:1.6,
        }}>
          <div style={{ fontWeight:700, fontSize:12, marginBottom:2 }}>{tooltip.r.nombre_sede}</div>
          <div style={{ color:'rgba(255,255,255,0.6)', fontSize:10, marginBottom:6 }}>
            {tooltip.r.municipio} · {tooltip.r.departamento}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'1px 10px', fontSize:11 }}>
            <span style={{ color:'rgba(255,255,255,0.55)' }}>Año</span>
            <span style={{ fontWeight:700 }}>{tooltip.r.anio}</span>
            <span style={{ color:'rgba(255,255,255,0.55)' }}>Clasificación</span>
            <span style={{ fontWeight:700 }}>{tooltip.r.clasificacion || '—'}</span>
            <span style={{ color:'rgba(255,255,255,0.55)' }}>Índice Total</span>
            <span style={{ fontWeight:700, color:'#6EE7B7' }}>{parseFloat(tooltip.r.puntaje_global).toFixed(4)}</span>
            <span style={{ color:'rgba(255,255,255,0.55)' }}>Inglés</span>
            <span style={{ fontWeight:700, color:'#6EE7B7' }}>{parseFloat(tooltip.r.idx_ingles).toFixed(4)}</span>
          </div>
          <div style={{
            position:'absolute', bottom:-6, left:'50%', transform:'translateX(-50%)',
            width:0, height:0,
            borderLeft:'6px solid transparent', borderRight:'6px solid transparent',
            borderTop:`6px solid ${C.navy}`,
          }} />
        </div>
      )}
    </div>
  )
}

function MiniClasPill({ val }) {
  const bg  = CLAS_COL_BG[val]  || '#F3F4F6'
  const txt = CLAS_COL_TXT[val] || '#6B7280'
  return val
    ? <span style={{ display:'inline-block', padding:'2px 7px', borderRadius:12,
        fontSize:11, fontWeight:700, fontFamily:'Inter', background:bg, color:txt }}>{val}</span>
    : <span style={{ color:'#D1D5DB' }}>—</span>
}

// Flecha de tendencia vs año anterior para un índice numérico
function TrendArrow({ curr, prev }) {
  if (curr == null || prev == null || isNaN(+curr) || isNaN(+prev)) return null
  const diff = +curr - +prev
  if (Math.abs(diff) < 0.00005)
    return <span style={{ color:'#9CA3AF', fontSize:11, lineHeight:1 }} title="Sin cambio (→)">→</span>
  if (diff > 0)
    return <span style={{ color:'#059669', fontSize:12, fontWeight:700, lineHeight:1 }}
      title={`+${diff.toFixed(4)} vs ${''}`}>↑</span>
  return <span style={{ color:'#DC2626', fontSize:12, fontWeight:700, lineHeight:1 }}
    title={`${diff.toFixed(4)} vs año anterior`}>↓</span>
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

  // Paginación normal
  const POR_PAG = 20
  const [pagina,   setPagina]   = useState(1)
  const [total,    setTotal]    = useState(0)
  const [byClass,  setByClass]  = useState({})
  // Filtros "activos" (congelados al hacer Consultar, usados en cambio de página)
  const [activeF,  setActiveF]  = useState(null)

  // Modo Ponderado
  const [isPonderado,    setIsPonderado]    = useState(false)
  const [aniosPond,      setAniosPond]      = useState([])      // e.g. [2025,2024,2023]
  const [ponderadoData,  setPonderadoData]  = useState([])      // filas ponderadas por plantel
  const [ponderadoStats, setPonderadoStats] = useState([])      // stats por año para gráficas
  const [prevRefData,    setPrevRefData]    = useState([])      // año anterior al más antiguo, solo para flechas
  const [pondPagina,     setPondPagina]     = useState(1)
  const POND_PAG = 20

  // Data / options
  const [data,      setData]      = useState([])
  const [deptoOpts, setDeptoOpts] = useState([])
  const [muniAll,   setMuniAll]   = useState([])
  const [muniOpts,  setMuniOpts]  = useState([])
  const [estOpts,   setEstOpts]   = useState([])
  const [loading,   setLoading]   = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [consulted, setConsulted]   = useState(false)
  const [prevYearMap, setPrevYearMap] = useState({})  // {codigo_dane: row del año anterior}

  // Carga departamentos y municipios cuando cambia año/periodo/grado (o modo ponderado)
  useEffect(() => {
    setDeptoSel([]); setMuniSel([]); setEstSel([])
    setDeptoOpts([]); setMuniAll([]); setMuniOpts([]); setEstOpts([])
    setData([]); setConsulted(false); setLastUpdate(null)
    setTotal(0); setByClass({}); setPagina(1); setActiveF(null)
    setPonderadoData([]); setPonderadoStats([]); setAniosPond([]); setPrevRefData([])

    let q = supabase.from('clasificacion_icfes').select('municipio, departamento')
    if (isPonderado) {
      q = q.in('anio', ANIOS_CLAS.slice(0, 3))
    } else {
      q = q.eq('anio', anio)
    }
    q.eq('periodo', periodo).eq('grado', grado)
      .order('departamento').order('municipio')
      .then(({ data: rows }) => {
        const pairs = (rows || []).filter(r => r.municipio)
        const uniqueDeptos = [...new Set(pairs.map(r => r.departamento).filter(Boolean))].sort()
        setDeptoOpts(uniqueDeptos)
        setMuniAll(pairs)
        setMuniOpts([...new Set(pairs.map(r => r.municipio))])
        if (!isPonderado) {
          return supabase.from('clasificacion_icfes').select('created_at')
            .eq('anio', anio).eq('periodo', periodo).eq('grado', grado)
            .order('created_at', { ascending: false }).limit(1)
        }
        return { data: null }
      })
      .then(({ data: lu }) => setLastUpdate(lu?.[0]?.created_at || null))
  }, [anio, periodo, grado, isPonderado])

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

  // Aplica filtros activos a una query base
  const applyFilters = (q, f) => {
    if (f.sector)           q = q.eq('sector', f.sector)
    if (f.clasSel?.length)  q = q.in('clasificacion', f.clasSel)
    if (f.deptoSel?.length) q = q.in('departamento', f.deptoSel)
    if (f.muniSel?.length)  q = q.in('municipio', f.muniSel)
    if (f.estSel?.length)   q = q.in('nombre_sede', f.estSel)
    if (f.codigoDane?.trim()) q = q.ilike('codigo_dane', `%${f.codigoDane.trim()}%`)
    return q
  }

  const loadPage = useCallback(async (pag, f) => {
    setLoading(true)
    const offset = (pag - 1) * POR_PAG
    let q = applyFilters(
      supabase.from('clasificacion_icfes').select('*')
        .eq('anio', f.anio).eq('periodo', f.periodo).eq('grado', f.grado)
        .order('clasificacion', { ascending: true })
        .order('nombre_sede', { ascending: true })
        .range(offset, offset + POR_PAG - 1),
      f
    )
    const { data: rows } = await q
    setData(rows || [])

    // Cargar año anterior para mostrar flechas de tendencia
    if (rows && rows.length > 0 && f.anio > 2020) {
      const daneList = rows.map(r => r.codigo_dane).filter(Boolean)
      const { data: prevRows } = await supabase
        .from('clasificacion_icfes')
        .select('codigo_dane,clasificacion,idx_matematicas,idx_cn,idx_sociales,idx_lc,idx_ingles,puntaje_global')
        .eq('anio', f.anio - 1).eq('periodo', f.periodo).eq('grado', f.grado)
        .in('codigo_dane', daneList)
      const map = {}
      ;(prevRows || []).forEach(r => { map[r.codigo_dane] = r })
      setPrevYearMap(map)
    } else {
      setPrevYearMap({})
    }

    setLoading(false)
  }, [])

  // ── Ponderado: promedia los últimos 3 años cargados ──────────────────────────
  const consultarPonderado = useCallback(async () => {
    setLoading(true); setConsulted(true); setPondPagina(1)
    setPonderadoData([]); setPonderadoStats([]); setPrevRefData([])

    // 1. Detectar cuáles años de ANIOS_CLAS tienen datos para este periodo/grado
    const yearChecks = await Promise.all(
      ANIOS_CLAS.map(a =>
        supabase.from('clasificacion_icfes')
          .select('anio', { count:'exact', head:true })
          .eq('anio', a).eq('periodo', periodo).eq('grado', grado)
      )
    )
    const last3 = ANIOS_CLAS.filter((a, i) => (yearChecks[i].count || 0) > 0).slice(0, 3)
    setAniosPond(last3)

    if (last3.length === 0) { setLoading(false); return }

    // 2. Fetch datos de cada año con los filtros activos
    const applyF = (q) => {
      if (sector)           q = q.eq('sector', sector)
      if (clasSel.length)   q = q.in('clasificacion', clasSel)
      if (deptoSel.length)  q = q.in('departamento', deptoSel)
      if (muniSel.length)   q = q.in('municipio', muniSel)
      if (estSel.length)    q = q.in('nombre_sede', estSel)
      if (codigoDane.trim()) q = q.ilike('codigo_dane', `%${codigoDane.trim()}%`)
      return q
    }

    const fetches = await Promise.all(
      last3.map(a =>
        applyF(
          supabase.from('clasificacion_icfes').select('*')
            .eq('anio', a).eq('periodo', periodo).eq('grado', grado).limit(5000)
        )
      )
    )
    const rowsByAnio = {}
    last3.forEach((a, i) => { rowsByAnio[a] = fetches[i].data || [] })

    // 3. Stats por año (para gráficas)
    const avg = arr => {
      const vals = arr.filter(v => v != null && !isNaN(Number(v)))
      return vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : 0
    }
    const stats = last3.map(a => {
      const rows = rowsByAnio[a]
      const byC = {}; CLAS_OPTS.forEach(c => { byC[c] = 0 })
      rows.forEach(r => { if (r.clasificacion) byC[r.clasificacion] = (byC[r.clasificacion] || 0) + 1 })
      return {
        anio: a,
        total: rows.length,
        byClass: byC,
        avgIdx: {
          mat:   avg(rows.map(r => r.idx_matematicas)),
          cn:    avg(rows.map(r => r.idx_cn)),
          soc:   avg(rows.map(r => r.idx_sociales)),
          lc:    avg(rows.map(r => r.idx_lc)),
          ing:   avg(rows.map(r => r.idx_ingles)),
          total: avg(rows.map(r => r.puntaje_global)),
        },
        totalEval: rows.reduce((s, r) => s + (r.num_evaluados || 0), 0),
        totalMat:  rows.reduce((s, r) => s + (r.num_matriculados || 0), 0),
      }
    })
    setPonderadoStats(stats)

    // 4. Calcular promedio global (para barra de resumen)
    const avgByClass = {}
    CLAS_OPTS.forEach(c => {
      avgByClass[c] = Math.round(stats.reduce((s, st) => s + (st.byClass[c] || 0), 0) / stats.length)
    })
    const avgTotal = Math.round(stats.reduce((s, st) => s + st.total, 0) / stats.length)
    setByClass(avgByClass)

    // 5. Tabla: agregada por año si no hay establecimiento, o detalle por plantel
    const isModoAgrupado = !estSel.length && !codigoDane.trim()
    const avgF = (rows, fn) => {
      const vals = rows.map(fn).filter(v => v != null && !isNaN(Number(v)))
      return vals.length ? vals.reduce((s, v) => s + Number(v), 0) / vals.length : null
    }
    let tableRows = []
    if (isModoAgrupado) {
      tableRows = last3.map(a => {
        const rows = rowsByAnio[a]
        const byC = {}; CLAS_OPTS.forEach(c => { byC[c] = 0 })
        rows.forEach(r => { if (r.clasificacion) byC[r.clasificacion] = (byC[r.clasificacion] || 0) + 1 })
        return {
          anio: a, _isAggregate: true,
          _planteles: rows.length,
          _clasDistrib: byC,
          zona: muniSel.length ? muniSel.join(', ') : deptoSel.length ? deptoSel.join(', ') : 'Nacional',
          sector: sector || 'Todos',
          num_matriculados: rows.reduce((s, r) => s + (r.num_matriculados || 0), 0),
          num_evaluados:    rows.reduce((s, r) => s + (r.num_evaluados || 0), 0),
          idx_matematicas:  avgF(rows, r => r.idx_matematicas),
          idx_cn:           avgF(rows, r => r.idx_cn),
          idx_sociales:     avgF(rows, r => r.idx_sociales),
          idx_lc:           avgF(rows, r => r.idx_lc),
          idx_ingles:       avgF(rows, r => r.idx_ingles),
          puntaje_global:   avgF(rows, r => r.puntaje_global),
        }
      }).sort((a, b) => b.anio - a.anio)
    } else {
      last3.forEach(a => {
        rowsByAnio[a].forEach(r => { if (r.codigo_dane) tableRows.push({ ...r }) })
      })
      tableRows.sort((a, b) => {
        const na = (a.nombre_sede || '').toUpperCase()
        const nb = (b.nombre_sede || '').toUpperCase()
        if (na !== nb) return na.localeCompare(nb, 'es')
        return b.anio - a.anio
      })
    }
    setTotal(tableRows.length)
    setPonderadoData(tableRows)

    // 6. Cargar año anterior al más antiguo para flechas de tendencia
    const oldestYear = last3[last3.length - 1]
    const refYear = oldestYear - 1
    const { data: refRows } = await applyF(
      supabase.from('clasificacion_icfes').select(
        'codigo_dane,anio,idx_matematicas,idx_cn,idx_sociales,idx_lc,idx_ingles,puntaje_global'
      ).eq('anio', refYear).eq('periodo', periodo).eq('grado', grado).limit(5000)
    )
    if (isModoAgrupado) {
      const rr = refRows || []
      setPrevRefData([{
        _isAggregate: true, anio: refYear,
        idx_matematicas: avgF(rr, r => r.idx_matematicas),
        idx_cn:          avgF(rr, r => r.idx_cn),
        idx_sociales:    avgF(rr, r => r.idx_sociales),
        idx_lc:          avgF(rr, r => r.idx_lc),
        idx_ingles:      avgF(rr, r => r.idx_ingles),
        puntaje_global:  avgF(rr, r => r.puntaje_global),
      }])
    } else {
      setPrevRefData(refRows || [])
    }

    setLoading(false)
  }, [periodo, grado, sector, clasSel, deptoSel, muniSel, estSel, codigoDane])

  // ── Consultar normal ──────────────────────────────────────────────────────────
  const consultar = useCallback(async () => {
    if (isPonderado) { await consultarPonderado(); return }
    setLoading(true)
    setConsulted(true)
    setPagina(1)

    const f = { anio, periodo, grado, sector, clasSel, deptoSel, muniSel, estSel, codigoDane }
    setActiveF(f)

    const base = () => applyFilters(
      supabase.from('clasificacion_icfes').select('*', { count:'exact', head:true })
        .eq('anio', f.anio).eq('periodo', f.periodo).eq('grado', f.grado),
      f
    )

    // Conteo total + por clasificación en paralelo
    const [totalRes, ...clasRes] = await Promise.all([
      base(),
      ...CLAS_OPTS.map(c => base().eq('clasificacion', c))
    ])

    setTotal(totalRes.count || 0)
    const bc = {}
    CLAS_OPTS.forEach((c, i) => { bc[c] = clasRes[i].count || 0 })
    setByClass(bc)

    await loadPage(1, f)
  }, [isPonderado, consultarPonderado, anio, periodo, grado, sector, clasSel, deptoSel, muniSel, estSel, codigoDane, loadPage])

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
      'Matriculados (últ. 3 años)': r.num_matriculados,
      'Evaluados (últ. 3 años)': r.num_evaluados,
      'Índice Matemáticas': r.idx_matematicas,
      'Índice C. Naturales': r.idx_cn,
      'Índice Soc. y Ciu.': r.idx_sociales,
      'Índice Lect. Crítica': r.idx_lc,
      'Índice Inglés': r.idx_ingles,
      'Índice Total': r.puntaje_global,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clasificación ICFES')
    XLSX.writeFile(wb, `clasificacion_icfes_${anio}_p${periodo}_g${grado}.xlsx`)
  }

  const totalPags = Math.ceil(total / POR_PAG)

  const cambiarPagina = (p) => {
    if (!activeF || p < 1 || p > totalPags) return
    setPagina(p)
    loadPage(p, activeF)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      {/* Filtros */}
      <div style={{ background:C.white, borderRadius:10, border:`1px solid ${C.grayLt}`,
        padding:'20px 24px', marginBottom:20, boxShadow:'0 1px 4px rgba(10,31,61,0.05)' }}>

        {/* Row 1: Año, Período, Grado */}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginBottom:4 }}>Año</div>
            <select
              value={isPonderado ? 'ponderado' : anio}
              onChange={e => {
                if (e.target.value === 'ponderado') {
                  setIsPonderado(true)
                  setData([]); setConsulted(false); setTotal(0); setByClass({})
                  setPonderadoData([]); setPonderadoStats([]); setAniosPond([]); setPrevRefData([])
                } else {
                  setIsPonderado(false)
                  setAnio(+e.target.value)
                }
              }}
              style={{ padding:'8px 12px', border: isPonderado ? `2px solid ${C.green}` : `1px solid ${C.grayLt}`,
                borderRadius:7, fontFamily:'Inter', fontSize:13,
                background: isPonderado ? '#F0FDF4' : C.white,
                color: isPonderado ? C.green : C.text,
                outline:'none', cursor:'pointer', fontWeight: isPonderado ? 700 : 400 }}>
              <option value="ponderado">⚖️ Ponderado</option>
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

      {/* Indicador modo ponderado */}
      {isPonderado && !consulted && !loading && (
        <div style={{ textAlign:'center', padding:'60px 0', color:C.gray, fontFamily:'Inter' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>⚖️</div>
          <div style={{ fontSize:17, fontFamily:'Playfair Display, serif', color:C.green, marginBottom:6 }}>
            Modo Ponderado
          </div>
          <div style={{ fontSize:13, maxWidth:420, margin:'0 auto', lineHeight:1.6 }}>
            Se detectarán automáticamente los <strong>últimos 3 años</strong> con datos cargados
            y se calcularán promedios por plantel. Aplica los filtros y haz clic en <strong>Consultar</strong>.
          </div>
        </div>
      )}

      {/* Sin datos todavía (modo normal) */}
      {!isPonderado && !consulted && !loading && (
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

      {/* Sin resultados (solo modo normal) */}
      {!isPonderado && consulted && !loading && data.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 0', color:C.gray, fontFamily:'Inter' }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
          <div style={{ fontSize:15, color:C.navy }}>Sin resultados</div>
          <div style={{ fontSize:12, marginTop:6 }}>
            No hay datos para {anio} P{periodo} G{grado} con estos filtros.
            <br/>Intenta con <em>Actualizar datos ICFES</em>.
          </div>
        </div>
      )}

      {/* ── RESULTADOS PONDERADO ─────────────────────────────────────────────── */}
      {isPonderado && consulted && !loading && ponderadoStats.length > 0 && (() => {
        const pondPags = Math.ceil(ponderadoData.length / POND_PAG)
        const pageRows = ponderadoData.slice((pondPagina-1)*POND_PAG, pondPagina*POND_PAG)

        // Promedio global entre todos los años
        const avgStats = {
          anio: 'Prom.',
          total: Math.round(ponderadoStats.reduce((s,st)=>s+st.total,0)/ponderadoStats.length),
          byClass: {},
          avgIdx: {
            mat:   ponderadoStats.reduce((s,st)=>s+st.avgIdx.mat,0)/ponderadoStats.length,
            cn:    ponderadoStats.reduce((s,st)=>s+st.avgIdx.cn,0)/ponderadoStats.length,
            soc:   ponderadoStats.reduce((s,st)=>s+st.avgIdx.soc,0)/ponderadoStats.length,
            lc:    ponderadoStats.reduce((s,st)=>s+st.avgIdx.lc,0)/ponderadoStats.length,
            ing:   ponderadoStats.reduce((s,st)=>s+st.avgIdx.ing,0)/ponderadoStats.length,
            total: ponderadoStats.reduce((s,st)=>s+st.avgIdx.total,0)/ponderadoStats.length,
          },
          totalEval: Math.round(ponderadoStats.reduce((s,st)=>s+st.totalEval,0)/ponderadoStats.length),
          totalMat:  Math.round(ponderadoStats.reduce((s,st)=>s+st.totalMat,0)/ponderadoStats.length),
        }
        CLAS_OPTS.forEach(c => {
          avgStats.byClass[c] = Math.round(ponderadoStats.reduce((s,st)=>s+(st.byClass[c]||0),0)/ponderadoStats.length)
        })

        const card = (children) => (
          <div style={{ background:C.white, borderRadius:10, border:`1px solid ${C.grayLt}`,
            padding:'20px 24px', marginBottom:20, boxShadow:'0 1px 4px rgba(10,31,61,0.05)' }}>
            {children}
          </div>
        )
        const idx4 = v => v != null ? parseFloat(v).toFixed(4) : '—'

        return (
          <div>
            {/* Años detectados */}
            <div style={{ marginBottom:16, padding:'10px 16px', background:'#F0FDF4',
              border:`1px solid ${C.green}40`, borderRadius:8, display:'flex', alignItems:'center',
              gap:10, fontFamily:'Inter', fontSize:12, color:C.green, flexWrap:'wrap' }}>
              <span style={{ fontWeight:700 }}>⚖️ Ponderado —</span>
              <span>Promediando los años:</span>
              {aniosPond.map(a => (
                <span key={a} style={{ background:C.green, color:C.white, padding:'3px 10px',
                  borderRadius:20, fontWeight:700, fontSize:12 }}>{a}</span>
              ))}
              <span style={{ color:C.gray, marginLeft:4 }}>· {new Set(ponderadoData.map(r=>r.codigo_dane)).size.toLocaleString('es-CO')} planteles únicos</span>
            </div>

            {/* KPI cards */}
            <div style={{ display:'grid', gridTemplateColumns: mobile ? 'repeat(3,1fr)' : 'repeat(6,1fr)',
              gap:10, marginBottom:20 }}>
              <div style={{ background:C.white, borderRadius:9, padding:'12px 14px',
                border:`1px solid ${C.grayLt}`, textAlign:'center',
                gridColumn: mobile ? '1/4' : 'auto' }}>
                <div style={{ fontSize:22, fontFamily:'Playfair Display, serif', color:C.navy, fontWeight:700 }}>
                  {new Set(ponderadoData.map(r=>r.codigo_dane)).size.toLocaleString('es-CO')}
                </div>
                <div style={{ fontSize:10, color:C.gray, textTransform:'uppercase',
                  letterSpacing:'0.08em', fontFamily:'Inter', marginTop:2 }}>Planteles únicos</div>
              </div>
              {CLAS_OPTS.map(c => {
                const s = CLAS_COLOR[c]
                return (
                  <div key={c} style={{ background:s.bg, borderRadius:9, padding:'12px 14px',
                    border:`1px solid ${s.border}`, textAlign:'center' }}>
                    <div style={{ fontSize:20, fontFamily:'Playfair Display, serif', color:s.color, fontWeight:700 }}>
                      {(avgStats.byClass[c] || 0).toLocaleString('es-CO')}
                    </div>
                    <div style={{ fontSize:10, color:s.color, fontWeight:700, fontFamily:'Inter', marginTop:2 }}>
                      {c} <span style={{ fontWeight:400 }}>(prom/año)</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Gráfica: Índices por área */}
            {card(<>
              <div style={{ fontSize:11, fontWeight:700, color:C.navy, letterSpacing:'0.08em',
                textTransform:'uppercase', fontFamily:'Inter', marginBottom:16,
                paddingBottom:10, borderBottom:`1px solid ${C.bg2}` }}>
                Promedios por área — comparativo anual
              </div>
              <IndexChart stats={ponderadoStats} />
            </>)}

            {/* Gráfica: Radar todas las áreas */}
            {card(<>
              <div style={{ fontSize:11, fontWeight:700, color:C.navy, letterSpacing:'0.08em',
                textTransform:'uppercase', fontFamily:'Inter', marginBottom:4,
                paddingBottom:10, borderBottom:`1px solid ${C.bg2}` }}>
                Perfil por área — comparativo anual (radar)
              </div>
              <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginBottom:12 }}>
                Cada polígono representa el promedio de un año. Pasa el cursor sobre un punto para ver el valor exacto.
              </div>
              <RadarChart stats={ponderadoStats} />
            </>)}

            {/* Gráfica: Cobertura */}
            {card(<>
              <div style={{ fontSize:11, fontWeight:700, color:C.navy, letterSpacing:'0.08em',
                textTransform:'uppercase', fontFamily:'Inter', marginBottom:16,
                paddingBottom:10, borderBottom:`1px solid ${C.bg2}` }}>
                Cobertura — Matriculados vs Evaluados por año
              </div>
              <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr' : `repeat(${ponderadoStats.length},1fr)`, gap:16 }}>
                {ponderadoStats.map(s => {
                  const pctEval = s.totalMat > 0 ? s.totalEval / s.totalMat * 100 : 0
                  return (
                    <div key={s.anio} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:15, fontFamily:'Playfair Display, serif',
                        color:C.navy, fontWeight:700, marginBottom:8 }}>{s.anio}</div>
                      {[
                        { label:'Matriculados', val:s.totalMat, color:C.navy },
                        { label:'Evaluados',    val:s.totalEval, color:C.green },
                      ].map(item => (
                        <div key={item.label} style={{ marginBottom:8 }}>
                          <div style={{ display:'flex', justifyContent:'space-between',
                            fontSize:11, fontFamily:'Inter', marginBottom:3 }}>
                            <span style={{ color:C.gray }}>{item.label}</span>
                            <span style={{ fontWeight:700, color:item.color }}>
                              {item.val.toLocaleString('es-CO')}
                            </span>
                          </div>
                          <div style={{ height:8, background:`${C.grayLt}50`, borderRadius:4, overflow:'hidden' }}>
                            <div style={{ height:'100%', borderRadius:4,
                              width: item.label==='Matriculados' ? '100%' : `${pctEval}%`,
                              background: item.color, transition:'width 0.4s ease' }} />
                          </div>
                        </div>
                      ))}
                      <div style={{ fontSize:11, color:C.green, fontWeight:600, fontFamily:'Inter', marginTop:4 }}>
                        {pctEval.toFixed(1)}% cobertura
                      </div>
                    </div>
                  )
                })}
              </div>
            </>)}

            {/* Tabla ponderada — modo agregado o detalle por plantel */}
            {(() => {
              const isModoAgregado = ponderadoData[0]?._isAggregate === true

              // Mapa anio → row para flechas en modo agregado
              const aggMap = {}
              if (isModoAgregado) {
                ;[...ponderadoData, ...prevRefData].forEach(r => { aggMap[r.anio] = r })
              }

              // Mapa {codigo_dane → {anio → row}} para flechas en modo detalle
              const pondMap = {}
              if (!isModoAgregado) {
                ;[...ponderadoData, ...prevRefData].forEach(row => {
                  if (!pondMap[row.codigo_dane]) pondMap[row.codigo_dane] = {}
                  pondMap[row.codigo_dane][row.anio] = row
                })
              }

              const camposIdx = [
                ['idx_matematicas','Mat.'],
                ['idx_cn','C.N.'],
                ['idx_sociales','Soc.'],
                ['idx_lc','L.C.'],
                ['idx_ingles','Ing.'],
              ]

              return (
                <div style={{ background:C.white, borderRadius:10, border:`1px solid ${C.grayLt}`,
                  overflow:'hidden', boxShadow:'0 1px 4px rgba(10,31,61,0.05)', marginBottom:16 }}>
                  <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.bg2}`,
                    fontSize:11, fontWeight:700, color:C.navy, fontFamily:'Inter',
                    letterSpacing:'0.08em', textTransform:'uppercase', display:'flex',
                    justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                    <span>Detalle por año · {aniosPond.join(' · ')}</span>
                    <span style={{ fontWeight:400, color:C.gray }}>
                      {isModoAgregado
                        ? `${ponderadoData.length} filas · ${ponderadoData.reduce((s,r)=>s+(r._planteles||0),0).toLocaleString('es-CO')} planteles únicos`
                        : `${ponderadoData.length.toLocaleString('es-CO')} filas · ${new Set(ponderadoData.map(r=>r.codigo_dane)).size.toLocaleString('es-CO')} planteles únicos`
                      }
                    </span>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                      <thead>
                        <tr>
                          <Th>#</Th>
                          <Th style={{ textAlign:'center' }}>Año</Th>
                          {isModoAgregado ? (
                            <>
                              <Th>Zona</Th>
                              <Th style={{ textAlign:'center' }}>Planteles</Th>
                              <Th style={{ textAlign:'center' }}>Clasificaciones</Th>
                            </>
                          ) : (
                            <>
                              <Th>Código DANE</Th>
                              <Th>Establecimiento</Th>
                              <Th>Municipio</Th>
                              <Th>Departamento</Th>
                              <Th style={{ textAlign:'center' }}>Sector</Th>
                              <Th style={{ textAlign:'center' }}>Clasif.</Th>
                            </>
                          )}
                          <Th style={{ textAlign:'center' }}>Matr.</Th>
                          <Th style={{ textAlign:'center' }}>Eval.</Th>
                          {camposIdx.map(([,label]) => (
                            <Th key={label} style={{ textAlign:'center' }}>{label}</Th>
                          ))}
                          <Th style={{ textAlign:'center' }}>Índice Total</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((r, i) => {
                          const prevPond = isModoAgregado
                            ? (aggMap[r.anio - 1] || null)
                            : (pondMap[r.codigo_dane]?.[r.anio - 1] || null)
                          const n = (pondPagina-1)*POND_PAG + i + 1
                          const isNewGroup = !isModoAgregado && (i === 0 || pageRows[i-1].codigo_dane !== r.codigo_dane)
                          const bg = isNewGroup ? `${C.bg}80` : i%2===0 ? `${C.bg}40` : 'transparent'
                          return (
                            <tr key={isModoAgregado ? r.anio : `${r.codigo_dane}_${r.anio}`}
                              style={{
                                borderBottom:`1px solid ${C.bg2}`,
                                borderTop: isNewGroup && i > 0 ? `2px solid ${C.grayLt}` : undefined,
                                background: bg,
                              }}
                              onMouseEnter={e=>e.currentTarget.style.background=`${C.green}12`}
                              onMouseLeave={e=>e.currentTarget.style.background=bg}>
                              <Td style={{ color:C.gray, fontSize:11, textAlign:'center' }}>{n}</Td>
                              <Td style={{ textAlign:'center' }}>
                                <span style={{ display:'inline-block', padding:'2px 8px',
                                  borderRadius:10, fontSize:11, fontWeight:700,
                                  background:`${C.navy}15`, color:C.navy }}>
                                  {r.anio}
                                </span>
                              </Td>

                              {isModoAgregado ? (
                                <>
                                  <Td style={{ fontWeight:600, color:C.navy }}>{r.zona}</Td>
                                  <Td style={{ textAlign:'center', color:C.navy, fontWeight:700 }}>
                                    {(r._planteles||0).toLocaleString('es-CO')}
                                  </Td>
                                  <Td style={{ textAlign:'center' }}>
                                    <div style={{ display:'flex', gap:4, flexWrap:'wrap', justifyContent:'center' }}>
                                      {CLAS_OPTS.filter(c=>(r._clasDistrib?.[c]||0)>0).map(c => {
                                        const s = CLAS_COLOR[c]
                                        return (
                                          <span key={c} style={{ fontSize:10, padding:'1px 6px',
                                            borderRadius:8, background:s.bg, color:s.color,
                                            border:`1px solid ${s.border}`, fontWeight:700 }}>
                                            {c} {r._clasDistrib[c]}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  </Td>
                                </>
                              ) : (
                                <>
                                  <Td style={{ color:C.gray, fontSize:11, fontFamily:'monospace', whiteSpace:'nowrap' }}>
                                    {r.codigo_dane}
                                  </Td>
                                  <Td style={{ fontWeight:600, color:C.navy, maxWidth:200,
                                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                    {r.nombre_sede}
                                  </Td>
                                  <Td style={{ color:C.gray, fontSize:11, whiteSpace:'nowrap' }}>{r.municipio}</Td>
                                  <Td style={{ color:C.gray, fontSize:11, whiteSpace:'nowrap' }}>{r.departamento}</Td>
                                  <Td style={{ textAlign:'center', fontSize:11, color:C.gray }}>{r.sector||'—'}</Td>
                                  <Td style={{ textAlign:'center' }}><ClasBadge val={r.clasificacion}/></Td>
                                </>
                              )}

                              <Td style={{ textAlign:'center', color:C.gray, fontSize:11 }}>
                                {r.num_matriculados?.toLocaleString('es-CO') || '—'}
                              </Td>
                              <Td style={{ textAlign:'center', color:C.gray, fontSize:11 }}>
                                {r.num_evaluados?.toLocaleString('es-CO') || '—'}
                              </Td>
                              {camposIdx.map(([field]) => (
                                <Td key={field} style={{ textAlign:'center', padding:'10px 8px' }}>
                                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:3 }}>
                                    <span style={{ fontWeight:600, fontSize:11, color:C.navy, fontFamily:'Inter' }}>
                                      {idx4(r[field])}
                                    </span>
                                    {prevPond && <TrendArrow curr={r[field]} prev={prevPond[field]} />}
                                  </div>
                                </Td>
                              ))}
                              <Td style={{ textAlign:'center', padding:'10px 8px' }}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:3 }}>
                                  <span style={{ fontWeight:700, color:C.green, fontSize:12, fontFamily:'Inter' }}>
                                    {idx4(r.puntaje_global)}
                                  </span>
                                  {prevPond && <TrendArrow curr={r.puntaje_global} prev={prevPond.puntaje_global} />}
                                </div>
                              </Td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}

            {/* Paginación tabla ponderada */}
            {pondPags > 1 && (
              <div style={{ display:'flex', justifyContent:'center', alignItems:'center',
                gap:6, marginBottom:16, fontFamily:'Inter', flexWrap:'wrap' }}>
                <button onClick={() => setPondPagina(1)} disabled={pondPagina===1}
                  style={{ padding:'6px 10px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                    background:C.white, cursor:pondPagina===1?'not-allowed':'pointer',
                    color:pondPagina===1?C.gray:C.navy, fontSize:12 }}>«</button>
                <button onClick={() => setPondPagina(p=>Math.max(1,p-1))} disabled={pondPagina===1}
                  style={{ padding:'6px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                    background:C.white, cursor:pondPagina===1?'not-allowed':'pointer',
                    color:pondPagina===1?C.gray:C.navy, fontSize:12 }}>‹ Ant.</button>
                {Array.from({ length: Math.min(5, pondPags) }, (_, i) => {
                  const start = Math.max(1, Math.min(pondPagina-2, pondPags-4))
                  const p = start + i
                  return (
                    <button key={p} onClick={() => setPondPagina(p)}
                      style={{ padding:'6px 11px', border:`1px solid ${p===pondPagina?C.green:C.grayLt}`,
                        borderRadius:6, background:p===pondPagina?C.green:C.white,
                        color:p===pondPagina?C.white:C.navy,
                        fontWeight:p===pondPagina?700:400, cursor:'pointer', fontSize:12 }}>{p}</button>
                  )
                })}
                <button onClick={() => setPondPagina(p=>Math.min(pondPags,p+1))} disabled={pondPagina===pondPags}
                  style={{ padding:'6px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                    background:C.white, cursor:pondPagina===pondPags?'not-allowed':'pointer',
                    color:pondPagina===pondPags?C.gray:C.navy, fontSize:12 }}>Sig. ›</button>
                <button onClick={() => setPondPagina(pondPags)} disabled={pondPagina===pondPags}
                  style={{ padding:'6px 10px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                    background:C.white, cursor:pondPagina===pondPags?'not-allowed':'pointer',
                    color:pondPagina===pondPags?C.gray:C.navy, fontSize:12 }}>»</button>
                <span style={{ fontSize:12, color:C.gray, marginLeft:4 }}>
                  Pág. <strong style={{ color:C.navy }}>{pondPagina}</strong> de{' '}
                  <strong style={{ color:C.navy }}>{pondPags}</strong>
                  {' '}· {ponderadoData.length.toLocaleString('es-CO')} filas
                </span>
              </div>
            )}

            <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', textAlign:'right', marginBottom:8 }}>
              Fuente: ICFES — Clasificación de Planteles Saber 11 · Promedio {aniosPond.join(' · ')} P{periodo} G{grado}
            </div>
          </div>
        )
      })()}

      {/* ── RESULTADOS NORMALES ───────────────────────────────────────────────── */}
      {data.length > 0 && (
        <>
          {/* KPI cards */}
          <div style={{ display:'grid', gridTemplateColumns: mobile ? 'repeat(3,1fr)' : 'repeat(6,1fr)',
            gap:10, marginBottom:20 }}>
            <div style={{ background:C.white, borderRadius:9, padding:'12px 14px',
              border:`1px solid ${C.grayLt}`, textAlign:'center',
              gridColumn: mobile ? '1/4' : 'auto' }}>
              <div style={{ fontSize:22, fontFamily:'Playfair Display, serif', color:C.navy, fontWeight:700 }}>
                {total.toLocaleString('es-CO')}
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
                    {(byClass[c] || 0).toLocaleString('es-CO')}
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
                    <Th style={{ textAlign:'center' }}>Clasif.</Th>
                    <Th style={{ textAlign:'center' }}>Matriculados</Th>
                    <Th style={{ textAlign:'center' }}>Evaluados</Th>
                    <Th style={{ textAlign:'center' }}>Matemáticas</Th>
                    <Th style={{ textAlign:'center' }}>C. Naturales</Th>
                    <Th style={{ textAlign:'center' }}>Soc. y Ciu.</Th>
                    <Th style={{ textAlign:'center' }}>Lect. Crítica</Th>
                    <Th style={{ textAlign:'center' }}>Inglés</Th>
                    <Th style={{ textAlign:'center' }}>Índice Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => {
                    const bg = i % 2 === 0 ? `${C.bg}60` : 'transparent'
                    const idx = (v) => v ? parseFloat(v).toFixed(4) : '—'
                    return (
                      <tr key={r.id} style={{ borderBottom:`1px solid ${C.bg2}`, background:bg }}
                        onMouseEnter={e => e.currentTarget.style.background = `${C.green}12`}
                        onMouseLeave={e => e.currentTarget.style.background = bg}>
                        <Td style={{ color:C.gray, fontSize:11, textAlign:'center' }}>{i + 1}</Td>
                        <Td style={{ color:C.gray, fontSize:11, fontFamily:'monospace', whiteSpace:'nowrap' }}>{r.codigo_dane}</Td>
                        <Td style={{ fontWeight:600, color:C.navy, maxWidth:220,
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
                        <Td style={{ textAlign:'center', color:C.gray, fontSize:11 }}>{r.num_matriculados?.toLocaleString('es-CO') || '—'}</Td>
                        <Td style={{ textAlign:'center', color:C.gray, fontSize:11 }}>{r.num_evaluados?.toLocaleString('es-CO') || '—'}</Td>
                        {[
                          ['idx_matematicas', r.idx_matematicas],
                          ['idx_cn',          r.idx_cn],
                          ['idx_sociales',    r.idx_sociales],
                          ['idx_lc',          r.idx_lc],
                          ['idx_ingles',      r.idx_ingles],
                        ].map(([field, val]) => {
                          const prev = prevYearMap[r.codigo_dane]
                          return (
                            <Td key={field} style={{ textAlign:'center', padding:'10px 8px' }}>
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:3 }}>
                                <span style={{ fontWeight:600, fontSize:11, color:C.navy, fontFamily:'Inter' }}>
                                  {val ? parseFloat(val).toFixed(4) : '—'}
                                </span>
                                {prev && <TrendArrow curr={val} prev={prev[field]} />}
                              </div>
                            </Td>
                          )
                        })}
                        <Td style={{ textAlign:'center', fontWeight:700, color:C.green, fontSize:12 }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:3 }}>
                            <span>{r.puntaje_global ? parseFloat(r.puntaje_global).toFixed(4) : '—'}</span>
                            {prevYearMap[r.codigo_dane] &&
                              <TrendArrow curr={r.puntaje_global} prev={prevYearMap[r.codigo_dane]?.puntaje_global} />}
                          </div>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          {totalPags > 1 && (
            <div style={{ display:'flex', justifyContent:'center', alignItems:'center',
              gap:6, marginTop:16, fontFamily:'Inter', flexWrap:'wrap' }}>
              <button onClick={() => cambiarPagina(1)} disabled={pagina===1}
                style={{ padding:'6px 10px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                  background:C.white, cursor:pagina===1?'not-allowed':'pointer',
                  color:pagina===1?C.gray:C.navy, fontSize:12 }}>«</button>
              <button onClick={() => cambiarPagina(pagina-1)} disabled={pagina===1}
                style={{ padding:'6px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                  background:C.white, cursor:pagina===1?'not-allowed':'pointer',
                  color:pagina===1?C.gray:C.navy, fontSize:12 }}>‹ Ant.</button>
              {/* Páginas cercanas */}
              {Array.from({ length: Math.min(5, totalPags) }, (_, i) => {
                const start = Math.max(1, Math.min(pagina - 2, totalPags - 4))
                const p = start + i
                return (
                  <button key={p} onClick={() => cambiarPagina(p)}
                    style={{ padding:'6px 11px', border:`1px solid ${p===pagina ? C.navy : C.grayLt}`,
                      borderRadius:6, background: p===pagina ? C.navy : C.white,
                      color: p===pagina ? C.white : C.navy,
                      fontWeight: p===pagina ? 700 : 400,
                      cursor:'pointer', fontSize:12 }}>{p}</button>
                )
              })}
              <button onClick={() => cambiarPagina(pagina+1)} disabled={pagina===totalPags}
                style={{ padding:'6px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                  background:C.white, cursor:pagina===totalPags?'not-allowed':'pointer',
                  color:pagina===totalPags?C.gray:C.navy, fontSize:12 }}>Sig. ›</button>
              <button onClick={() => cambiarPagina(totalPags)} disabled={pagina===totalPags}
                style={{ padding:'6px 10px', border:`1px solid ${C.grayLt}`, borderRadius:6,
                  background:C.white, cursor:pagina===totalPags?'not-allowed':'pointer',
                  color:pagina===totalPags?C.gray:C.navy, fontSize:12 }}>»</button>
              <span style={{ fontSize:12, color:C.gray, marginLeft:4 }}>
                Página <strong style={{ color:C.navy }}>{pagina}</strong> de{' '}
                <strong style={{ color:C.navy }}>{totalPags}</strong>
                {' '}· {total.toLocaleString('es-CO')} sedes
              </span>
            </div>
          )}

          <div style={{ marginTop:8, fontSize:11, color:C.gray, fontFamily:'Inter', textAlign:'right' }}>
            Fuente: ICFES — Clasificación de Planteles Saber 11 · {activeF?.anio || anio} P{activeF?.periodo || periodo} G{activeF?.grado || grado}
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
