import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { C, Card, useMobile } from '../../components/ui'

const VOL_LABEL   = { pequena: 'Menos de 500', mediana: '500 – 1.000', grande: 'Más de 1.000' }
const NAT_LABEL   = { oficial: 'Oficial', privado: 'Privado' }
const CAL_LABEL   = { 'cal-a': 'Calendario A', 'cal-b': 'Calendario B' }
const REC_LABEL   = { a: 'Diagnóstico', b: 'Simulacros', c: 'Editorial' }
const REC_COLOR   = { a: '#1d4ed8', b: '#065f46', c: '#7c3aed' }
const REC_BG      = { a: '#dbeafe', b: '#d1fae5', c: '#ede9fe' }
const OPT_LABEL   = { a: 'A', b: 'B', c: 'C' }

const ESTADO_COLOR = {
  nuevo:      { bg: '#fef3c7', color: '#b45309' },
  contactado: { bg: '#dbeafe', color: '#1d4ed8' },
  cerrado:    { bg: '#d1fae5', color: '#065f46' },
}

const P4_TEXT = {
  a: 'Radiografía completa del nivel de todos los estudiantes desde preescolar.',
  b: 'Familiarizar grados clave con la estructura y presión del ICFES.',
  c: 'Necesitan material didáctico para cerrar brechas detectadas.',
}
const P5_TEXT = {
  a: 'Rara vez evalúan con DCE.',
  b: 'Ocasionalmente; necesitan simulacros idénticos al Estado.',
  c: 'Constantemente; les falta integrar herramientas editoriales.',
}
const P6_TEXT = {
  a: 'Informes cualitativos y cuantitativos por estudiante.',
  b: 'Resultados inmediatos de simulacro para planes de choque.',
  c: 'Herramientas docentes alineadas al Estado.',
}

const Badge = ({ texto, bg, color }) => (
  <span style={{
    display: 'inline-block', padding: '2px 8px', borderRadius: 20,
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    fontFamily: 'Inter', background: bg, color,
  }}>{texto}</span>
)

const ModalDetalle = ({ item, onClose, onEstadoChange }) => {
  if (!item) return null
  const ec = ESTADO_COLOR[item.estado] || ESTADO_COLOR.nuevo
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:24 }}>
      <div style={{ background:C.white, borderRadius:12, padding:32,
        width:'100%', maxWidth:560, boxShadow:'0 20px 60px rgba(0,0,0,0.25)',
        maxHeight:'90vh', overflowY:'auto' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <Badge texto={(REC_LABEL[item.recomendacion] || '—').toUpperCase()}
              bg={REC_BG[item.recomendacion] || '#f3f4f6'}
              color={REC_COLOR[item.recomendacion] || '#374151'} />
            <p style={{ fontFamily:'Playfair Display, serif', fontSize:18, color:C.navy, marginTop:8, marginBottom:2 }}>
              Lead #{item.id?.slice(0,8).toUpperCase()}
            </p>
            <p style={{ fontFamily:'Inter', fontSize:12, color:C.gray }}>
              {new Date(item.created_at).toLocaleString('es-CO', { timeZone:'America/Bogota' })}
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none',
            fontSize:20, cursor:'pointer', color:C.gray, flexShrink:0 }}>✕</button>
        </div>

        {/* Perfil */}
        <div style={{ background:'#f8fafc', borderRadius:8, padding:16, marginBottom:16 }}>
          <p style={{ fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase',
            color:C.gray, fontFamily:'Inter', marginBottom:10, fontWeight:600 }}>Perfil</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div>
              <p style={{ fontSize:10, color:C.gray, fontFamily:'Inter', marginBottom:2 }}>Naturaleza</p>
              <p style={{ fontSize:13, color:C.text, fontFamily:'Inter', fontWeight:600 }}>{NAT_LABEL[item.naturaleza] || '—'}</p>
            </div>
            <div>
              <p style={{ fontSize:10, color:C.gray, fontFamily:'Inter', marginBottom:2 }}>Calendario</p>
              <p style={{ fontSize:13, color:C.text, fontFamily:'Inter', fontWeight:600 }}>{CAL_LABEL[item.calendario] || '—'}</p>
            </div>
            <div>
              <p style={{ fontSize:10, color:C.gray, fontFamily:'Inter', marginBottom:2 }}>Volumen</p>
              <p style={{ fontSize:13, color:C.text, fontFamily:'Inter', fontWeight:600 }}>{VOL_LABEL[item.volumen] || '—'}</p>
            </div>
          </div>
        </div>

        {/* Diagnóstico */}
        <div style={{ marginBottom:16 }}>
          <p style={{ fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase',
            color:C.gray, fontFamily:'Inter', marginBottom:10, fontWeight:600 }}>Diagnóstico académico</p>
          {[
            { label:'Mayor desafío', val: item.pregunta_4, map: P4_TEXT },
            { label:'Frecuencia DCE', val: item.pregunta_5, map: P5_TEXT },
            { label:'Info más útil', val: item.pregunta_6, map: P6_TEXT },
          ].map(({ label, val, map }) => (
            <div key={label} style={{ display:'flex', gap:10, marginBottom:10 }}>
              <span style={{ width:22, height:22, borderRadius:'50%', background:C.navy,
                color:'white', fontSize:11, fontWeight:700, display:'flex',
                alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:'Inter' }}>
                {OPT_LABEL[val] || '?'}
              </span>
              <div>
                <p style={{ fontSize:10, color:C.gray, fontFamily:'Inter', marginBottom:2 }}>{label}</p>
                <p style={{ fontSize:13, color:C.text, fontFamily:'Inter', lineHeight:1.4 }}>{map[val] || '—'}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Score */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{ flex:1, height:6, background:'#e5e7eb', borderRadius:3 }}>
            <div style={{ width:`${item.score || 0}%`, height:'100%', borderRadius:3,
              background: item.score >= 80 ? '#16a34a' : item.score >= 70 ? '#d97706' : C.navy }} />
          </div>
          <span style={{ fontSize:13, fontWeight:700, color:C.navy, fontFamily:'Inter', minWidth:36 }}>{item.score || 0}%</span>
        </div>

        {/* Estado */}
        <div>
          <p style={{ fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase',
            color:C.gray, fontFamily:'Inter', marginBottom:8, fontWeight:600 }}>Estado</p>
          <div style={{ display:'flex', gap:8 }}>
            {['nuevo', 'contactado', 'cerrado'].map(est => {
              const ec2 = ESTADO_COLOR[est]
              const active = item.estado === est
              return (
                <button key={est} onClick={() => onEstadoChange(item.id, est)}
                  style={{ padding:'6px 16px', borderRadius:20, border:'2px solid',
                    borderColor: active ? ec2.color : '#e5e7eb',
                    background: active ? ec2.bg : 'white',
                    color: active ? ec2.color : C.gray,
                    fontFamily:'Inter', fontSize:12, fontWeight:700,
                    cursor:'pointer', textTransform:'capitalize' }}>
                  {est}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminComercial() {
  const mobile = useMobile()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroRec, setFiltroRec] = useState('todas')

  const loadLeads = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('leads_diagnostico')
      .select('*')
      .order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  useEffect(() => { loadLeads() }, [])

  const handleEstadoChange = async (id, estado) => {
    await supabase.from('leads_diagnostico').update({ estado }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, estado } : l))
    setSelected(prev => prev?.id === id ? { ...prev, estado } : prev)
  }

  const filtrados = leads.filter(l => {
    if (filtroEstado !== 'todos' && l.estado !== filtroEstado) return false
    if (filtroRec !== 'todas' && l.recomendacion !== filtroRec) return false
    return true
  })

  const stats = {
    total: leads.length,
    nuevo: leads.filter(l => l.estado === 'nuevo').length,
    contactado: leads.filter(l => l.estado === 'contactado').length,
    cerrado: leads.filter(l => l.estado === 'cerrado').length,
  }

  const thSt = {
    padding: '10px 14px', textAlign:'left', fontFamily:'Inter', fontSize:11,
    fontWeight:700, color:'white', letterSpacing:'0.07em', textTransform:'uppercase',
    background: C.navy, whiteSpace:'nowrap',
  }
  const tdSt = { padding:'10px 14px', fontFamily:'Inter', fontSize:13, color:C.text,
    borderBottom:'1px solid #f1f5f9', verticalAlign:'middle' }

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap:16, marginBottom:28 }}>
        {[
          { label:'Total leads', val: stats.total, color: C.navy },
          { label:'Nuevos',      val: stats.nuevo,      color: '#b45309' },
          { label:'Contactados', val: stats.contactado, color: '#1d4ed8' },
          { label:'Cerrados',    val: stats.cerrado,    color: '#065f46' },
        ].map(({ label, val, color }) => (
          <Card key={label} style={{ padding:'20px 24px' }}>
            <p style={{ fontSize:28, fontWeight:700, color, fontFamily:'Inter', marginBottom:2 }}>{val}</p>
            <p style={{ fontSize:12, color:C.gray, fontFamily:'Inter' }}>{label}</p>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card style={{ padding:'16px 20px', marginBottom:20, display:'flex', gap:16,
        flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:11, color:C.gray, fontFamily:'Inter', fontWeight:600,
            textTransform:'uppercase', letterSpacing:'0.08em' }}>Estado:</span>
          {['todos', 'nuevo', 'contactado', 'cerrado'].map(e => (
            <button key={e} onClick={() => setFiltroEstado(e)}
              style={{ padding:'4px 12px', borderRadius:20, border:'1px solid',
                borderColor: filtroEstado===e ? C.navy : '#e5e7eb',
                background: filtroEstado===e ? C.navy : 'white',
                color: filtroEstado===e ? 'white' : C.gray,
                fontFamily:'Inter', fontSize:11, fontWeight:600, cursor:'pointer',
                textTransform:'capitalize' }}>
              {e}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:11, color:C.gray, fontFamily:'Inter', fontWeight:600,
            textTransform:'uppercase', letterSpacing:'0.08em' }}>Recomendación:</span>
          {[['todas','Todas'], ['a','Diagnóstico'], ['b','Simulacros'], ['c','Editorial']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFiltroRec(val)}
              style={{ padding:'4px 12px', borderRadius:20, border:'1px solid',
                borderColor: filtroRec===val ? C.navy : '#e5e7eb',
                background: filtroRec===val ? C.navy : 'white',
                color: filtroRec===val ? 'white' : C.gray,
                fontFamily:'Inter', fontSize:11, fontWeight:600, cursor:'pointer' }}>
              {lbl}
            </button>
          ))}
        </div>
        <button onClick={loadLeads} style={{ marginLeft:'auto', padding:'6px 14px',
          borderRadius:8, border:'1px solid #e5e7eb', background:'white', color:C.gray,
          fontFamily:'Inter', fontSize:12, cursor:'pointer', fontWeight:600 }}>
          ↻ Actualizar
        </button>
      </Card>

      {/* Tabla */}
      <Card style={{ padding:0, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:C.gray, fontFamily:'Inter' }}>Cargando leads...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:C.gray, fontFamily:'Inter' }}>
            No hay leads con los filtros seleccionados.
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
              <colgroup>
                <col style={{ width:130 }} />
                <col style={{ width:80 }}  />
                <col style={{ width:110 }} />
                <col style={{ width:110 }} />
                <col style={{ width:100 }} />
                <col style={{ width:80 }}  />
                <col style={{ width:60 }}  />
                <col style={{ width:100 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={thSt}>Fecha</th>
                  <th style={thSt}>Naturaleza</th>
                  <th style={thSt}>Calendario</th>
                  <th style={thSt}>Volumen</th>
                  <th style={thSt}>Recomendación</th>
                  <th style={thSt}>Estado</th>
                  <th style={thSt}>Score</th>
                  <th style={thSt}>Respuestas</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(lead => {
                  const ec = ESTADO_COLOR[lead.estado] || ESTADO_COLOR.nuevo
                  return (
                    <tr key={lead.id}
                      onClick={() => setSelected(lead)}
                      style={{ cursor:'pointer', transition:'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={tdSt}>
                        <p style={{ fontSize:12, margin:0 }}>
                          {new Date(lead.created_at).toLocaleDateString('es-CO', { timeZone:'America/Bogota' })}
                        </p>
                        <p style={{ fontSize:10, color:C.gray, margin:0 }}>
                          {new Date(lead.created_at).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', timeZone:'America/Bogota' })}
                        </p>
                      </td>
                      <td style={tdSt}>{NAT_LABEL[lead.naturaleza] || '—'}</td>
                      <td style={tdSt}>{CAL_LABEL[lead.calendario] || '—'}</td>
                      <td style={tdSt}>{VOL_LABEL[lead.volumen] || '—'}</td>
                      <td style={tdSt}>
                        <Badge texto={REC_LABEL[lead.recomendacion] || '—'}
                          bg={REC_BG[lead.recomendacion] || '#f3f4f6'}
                          color={REC_COLOR[lead.recomendacion] || '#374151'} />
                      </td>
                      <td style={tdSt}>
                        <Badge texto={lead.estado || 'nuevo'} bg={ec.bg} color={ec.color} />
                      </td>
                      <td style={tdSt}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ flex:1, height:4, background:'#e5e7eb', borderRadius:2 }}>
                            <div style={{ width:`${lead.score || 0}%`, height:'100%', borderRadius:2,
                              background: lead.score >= 80 ? '#16a34a' : lead.score >= 70 ? '#d97706' : C.navy }} />
                          </div>
                          <span style={{ fontSize:11, fontWeight:700, color:C.navy, fontFamily:'Inter' }}>
                            {lead.score || 0}%
                          </span>
                        </div>
                      </td>
                      <td style={tdSt}>
                        <div style={{ display:'flex', gap:4 }}>
                          {[lead.pregunta_4, lead.pregunta_5, lead.pregunta_6].map((v, i) => (
                            <span key={i} style={{ width:20, height:20, borderRadius:'50%',
                              background: C.navy, color:'white', fontSize:10, fontWeight:700,
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontFamily:'Inter' }}>
                              {(v || '?').toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ModalDetalle item={selected} onClose={() => setSelected(null)} onEstadoChange={handleEstadoChange} />
    </div>
  )
}
