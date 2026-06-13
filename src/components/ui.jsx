export const C = {
  navy: '#0A1F3D', navyLt: '#122849',
  green: '#2D9B6F', greenLt: '#3AB882',
  bg: '#F8F9FB', bg2: '#EFF1F5', white: '#FFFFFF',
  text: '#1A1A2E', gray: '#6B7280', grayLt: '#D1D5DB',
  red: '#E05252', amber: '#F59E0B', blue: '#3B82F6',
}

export const getColor = v => v >= 85 ? C.green : v >= 70 ? C.blue : v >= 55 ? C.amber : C.red
export const getLevel = v => v >= 85 ? 'Superior' : v >= 70 ? 'Alto' : v >= 55 ? 'Básico' : 'Bajo'
export const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0

export const Card = ({ children, style = {} }) => (
  <div style={{
    background: C.white, borderRadius: 12, padding: 24,
    boxShadow: '0 1px 4px rgba(10,31,61,0.07), 0 4px 16px rgba(10,31,61,0.05)',
    border: `1px solid ${C.grayLt}`, ...style,
  }}>{children}</div>
)

export const CardTitle = ({ children, sub }) => (
  <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${C.bg2}` }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: C.navy, letterSpacing: '0.08em',
      textTransform: 'uppercase', fontFamily: 'Inter' }}>{children}</div>
    {sub && <div style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter', marginTop: 3 }}>{sub}</div>}
  </div>
)

export const Badge = ({ color, children }) => (
  <span style={{
    background: color + '18', color, border: `1px solid ${color}40`,
    padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500,
    whiteSpace: 'nowrap',
  }}>{children}</span>
)

export const KpiCard = ({ label, value, sub, color = C.navy }) => (
  <Card style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 10, color: C.gray, fontFamily: 'Inter',
      textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 34, fontFamily: 'Playfair Display, serif',
      color, fontWeight: 700, lineHeight: 1, marginBottom: 6 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter' }}>{sub}</div>}
  </Card>
)

export const TabBar = ({ tabs, active, onChange }) => (
  <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: C.bg2,
    padding: 4, borderRadius: 10, width: 'fit-content', flexWrap: 'wrap' }}>
    {tabs.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)} style={{
        padding: '8px 16px', borderRadius: 7, border: 'none',
        fontFamily: 'Inter', fontSize: 12, fontWeight: 500,
        background: active === t.id ? C.white : 'transparent',
        color: active === t.id ? C.navy : C.gray,
        boxShadow: active === t.id ? '0 1px 4px rgba(10,31,61,0.1)' : 'none',
        transition: 'all 0.2s',
      }}>{t.label}</button>
    ))}
  </div>
)

export const ScoreGauge = ({ value, max = 500 }) => {
  const pct = value / max
  const r = 54, cx = 64, cy = 64, circ = 2 * Math.PI * r
  const dash = pct * circ * 0.75
  const color = getColor(pct * 100)
  return (
    <svg width={128} height={128} viewBox="0 0 128 128">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.bg2} strokeWidth={10}
        strokeDasharray={`${circ * 0.75} ${circ}`} strokeDashoffset={circ * 0.125}
        strokeLinecap="round" transform="rotate(135 64 64)" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ * 0.125}
        strokeLinecap="round" transform="rotate(135 64 64)"
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)' }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={22} fontWeight={700}
        fill={C.navy} fontFamily="Playfair Display, serif">{value}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fill={C.gray}
        fontFamily="Inter">de {max}</text>
    </svg>
  )
}

export const Sidebar = ({ role, session, onLogout, children }) => (
  <div style={{ width: 240, minHeight: '100vh', background: C.navy,
    display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
    <div style={{ padding: '28px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: 15, fontFamily: 'Playfair Display, serif',
        color: C.white, marginBottom: 2 }}>Milton Ochoa</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter',
        letterSpacing: '0.12em', textTransform: 'uppercase' }}>Portal de Resultados</div>
    </div>
    <div style={{ flex: 1, padding: '12px' }}>{children}</div>
    <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: 12, color: C.white, fontFamily: 'Inter', fontWeight: 500, marginBottom: 2 }}>
        {role === 'estudiante' ? session.nombre : session.nombre}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter', marginBottom: 12 }}>
        {role === 'estudiante' ? `Grado ${session.grado}` : session.ciudad}
      </div>
      <button onClick={onLogout} style={{
        width: '100%', padding: '8px', borderRadius: 7,
        border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
        color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter', fontSize: 11,
      }}>Cerrar sesión</button>
    </div>
  </div>
)
