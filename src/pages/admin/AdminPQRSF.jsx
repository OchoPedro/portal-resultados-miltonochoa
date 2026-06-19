import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { C, Card, useMobile } from '../../components/ui'

const TIPO_COLOR = {
  'Petición':     { bg: '#dbeafe', color: '#1d4ed8' },
  'Queja':        { bg: '#fee2e2', color: '#b91c1c' },
  'Reclamo':      { bg: '#fef3c7', color: '#b45309' },
  'Sugerencia':   { bg: '#d1fae5', color: '#065f46' },
  'Felicitación': { bg: '#ede9fe', color: '#6d28d9' },
}

const Badge = ({ tipo }) => {
  const s = TIPO_COLOR[tipo] || { bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 9px',
      borderRadius: 20,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.08em',
      fontFamily: 'Inter',
      background: s.bg,
      color: s.color,
    }}>{tipo || 'Sin tipo'}</span>
  )
}

const ModalDetalle = ({ item, onClose }) => {
  if (!item) return null
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:24 }}>
      <div style={{ background:C.white, borderRadius:12, padding:32,
        width:'100%', maxWidth:560, boxShadow:'0 20px 60px rgba(0,0,0,0.25)',
        maxHeight:'90vh', overflowY:'auto' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <Badge tipo={item.servicio} />
            <p style={{ fontFamily:'Playfair Display, serif', fontSize:18, color:C.navy,
              marginTop:8, marginBottom:2 }}>{item.nombre}</p>
            <p style={{ fontFamily:'Inter', fontSize:12, color:C.gray }}>{item.email}</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none',
            fontSize:20, cursor:'pointer', color:C.gray, flexShrink:0 }}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
          {item.institucion && (
            <div>
              <p style={{ fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase',
                color:C.gray, fontFamily:'Inter', marginBottom:4 }}>Institución</p>
              <p style={{ fontSize:13, color:C.text, fontFamily:'Inter' }}>{item.institucion}</p>
            </div>
          )}
          {item.ciudad && (
            <div>
              <p style={{ fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase',
                color:C.gray, fontFamily:'Inter', marginBottom:4 }}>Ciudad</p>
              <p style={{ fontSize:13, color:C.text, fontFamily:'Inter' }}>{item.ciudad}</p>
            </div>
          )}
        </div>

        {item.mensaje && (
          <div>
            <p style={{ fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase',
              color:C.gray, fontFamily:'Inter', marginBottom:8 }}>Mensaje</p>
            <div style={{ background:C.bg, border:`1px solid ${C.grayLt}`, borderRadius:8,
              padding:'14px 16px', fontSize:13, color:C.text, fontFamily:'Inter',
              lineHeight:1.7, whiteSpace:'pre-wrap' }}>
              {item.mensaje}
            </div>
          </div>
        )}

        <p style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginTop:16, textAlign:'right' }}>
          {item.created_at ? new Date(item.created_at).toLocaleString('es-CO', { timeZone:'America/Bogota' }) : ''}
        </p>
      </div>
    </div>
  )
}

export default function AdminPQRSF() {
  const mobile = useMobile()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [detalle, setDetalle] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [filtro, setFiltro] = useState('todos')

  const TIPOS = ['todos', 'Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Felicitación']

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('contactos')
      .select('*')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return
    setDeleting(id)
    await supabase.from('contactos').delete().eq('id', id)
    setDeleting(null)
    load()
  }

  const visibles = filtro === 'todos'
    ? items
    : items.filter(i => i.servicio === filtro)

  const conteo = (t) => t === 'todos'
    ? items.length
    : items.filter(i => i.servicio === t).length

  return (
    <div>
      {/* Filtros */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:24 }}>
        {TIPOS.map(t => (
          <button key={t} onClick={() => setFiltro(t)} style={{
            padding:'7px 14px', borderRadius:20, fontFamily:'Inter', fontSize:11,
            fontWeight:600, cursor:'pointer', border:'none',
            background: filtro === t ? C.navy : C.grayLt,
            color: filtro === t ? C.white : C.gray,
          }}>
            {t === 'todos' ? 'Todos' : t}
            <span style={{ marginLeft:5, fontSize:10, opacity:0.7 }}>({conteo(t)})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:C.gray, fontFamily:'Inter', fontSize:14 }}>
          Cargando solicitudes...
        </div>
      ) : visibles.length === 0 ? (
        <Card>
          <div style={{ padding:48, textAlign:'center', color:C.gray, fontFamily:'Inter', fontSize:13 }}>
            No hay solicitudes {filtro !== 'todos' ? `de tipo "${filtro}"` : ''}.
          </div>
        </Card>
      ) : (
        <Card style={{ padding:0, overflow:'hidden' }}>
          {visibles.map((item, idx) => (
            <div key={item.id} style={{
              padding:'16px 20px',
              borderBottom: idx < visibles.length - 1 ? `1px solid ${C.grayLt}` : 'none',
              display:'flex', alignItems:'center', gap:16,
            }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4, flexWrap:'wrap' }}>
                  <Badge tipo={item.servicio} />
                  <span style={{ fontFamily:'Inter', fontSize:13, fontWeight:600, color:C.navy }}>
                    {item.nombre}
                  </span>
                  {item.institucion && (
                    <span style={{ fontFamily:'Inter', fontSize:12, color:C.gray }}>
                      · {item.institucion}
                    </span>
                  )}
                </div>
                <div style={{ fontFamily:'Inter', fontSize:12, color:C.gray,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  maxWidth: mobile ? 180 : 440 }}>
                  {item.mensaje || item.email}
                </div>
                <div style={{ fontFamily:'Inter', fontSize:11, color:C.gray, marginTop:4, opacity:0.6 }}>
                  {item.email}
                  {item.ciudad ? ` · ${item.ciudad}` : ''}
                  {item.created_at
                    ? ` · ${new Date(item.created_at).toLocaleDateString('es-CO', { timeZone:'America/Bogota' })}`
                    : ''}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                <button onClick={() => setDetalle(item)} style={{
                  padding:'6px 14px', borderRadius:6, fontFamily:'Inter', fontSize:11,
                  fontWeight:600, cursor:'pointer',
                  background:'transparent', border:`1px solid ${C.navy}`, color:C.navy,
                }}>Ver</button>
                <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id} style={{
                  padding:'6px 14px', borderRadius:6, fontFamily:'Inter', fontSize:11,
                  fontWeight:600, cursor:'pointer',
                  background:'transparent', border:'1px solid #DC2626', color:'#DC2626',
                  opacity: deleting === item.id ? 0.5 : 1,
                }}>{deleting === item.id ? '...' : 'Eliminar'}</button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <ModalDetalle item={detalle} onClose={() => setDetalle(null)} />
    </div>
  )
}
