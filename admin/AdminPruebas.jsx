import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const C = {
  navy:'#0A1F3D', green:'#2D9B6F',
  bg:'#F8F9FB', bg2:'#EFF1F5', white:'#FFFFFF',
  text:'#1A1A2E', gray:'#6B7280', grayLt:'#D1D5DB',
  red:'#E05252', amber:'#F59E0B',
}

const Card = ({children, style={}}) => (
  <div style={{ background:C.white, borderRadius:12, padding:24,
    boxShadow:'0 1px 4px rgba(10,31,61,0.07)', border:`1px solid ${C.grayLt}`, ...style }}>{children}</div>
)

const Input = ({label, value, onChange, placeholder, required=false}) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ display:'block', fontSize:10, letterSpacing:'0.12em',
      textTransform:'uppercase', color:C.gray, marginBottom:6, fontFamily:'Inter' }}>
      {label}{required && <span style={{ color:C.red }}> *</span>}
    </label>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{ width:'100%', padding:'10px 14px', border:`1px solid ${C.grayLt}`,
        borderRadius:6, fontFamily:'Inter', fontSize:13, color:C.text,
        background:C.bg, outline:'none', boxSizing:'border-box' }} />
  </div>
)

const Btn = ({children, onClick, color=C.navy, outline=false, small=false, disabled=false}) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: small ? '6px 14px' : '10px 20px',
    background: outline ? 'transparent' : color,
    color: outline ? color : C.white,
    border: `1px solid ${color}`, borderRadius:6,
    fontFamily:'Inter', fontSize:12, fontWeight:600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1, letterSpacing:'0.05em',
  }}>{children}</button>
)

const Badge = ({children, color}) => (
  <span style={{ background:color+'18', color, border:`1px solid ${color}40`,
    padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:500 }}>{children}</span>
)

// ── MODAL REFERENCIA ─────────────────────────────────────────
const ModalReferencia = ({ pruebaTipo, referencia, onClose, onSave }) => {
  const [form, setForm] = useState(referencia || {
    codigo:'', nombre:'', fecha:'', grado:'', descripcion:''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = async () => {
    if (!form.codigo || !form.nombre) { setError('Código y nombre son obligatorios.'); return }
    setSaving(true)
    try {
      const payload = { ...form, tipo: pruebaTipo, activa: true }
      const { error: err } = referencia
        ? await supabase.from('pruebas').update(payload).eq('id', referencia.id)
        : await supabase.from('pruebas').insert(payload)
      if (err) { setError(err.message); return }
      onSave(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:24 }}>
      <div style={{ background:C.white, borderRadius:12, padding:32,
        width:'100%', maxWidth:520, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:20, color:C.navy }}>
            {referencia ? 'Editar Referencia' : 'Nueva Referencia'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none',
            fontSize:20, cursor:'pointer', color:C.gray }}>✕</button>
        </div>
        <div style={{ background:C.bg2, borderRadius:6, padding:'8px 14px', marginBottom:16,
          fontSize:12, color:C.gray, fontFamily:'Inter' }}>
          Prueba: <strong style={{ color:C.navy }}>{pruebaTipo.charAt(0).toUpperCase()+pruebaTipo.slice(1)}</strong>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Código / Referencia" value={form.codigo} onChange={v=>set('codigo',v)}
            placeholder="Ej: GO2" required/>
          <Input label="Grado" value={form.grado} onChange={v=>set('grado',v)}
            placeholder="Ej: 11"/>
        </div>
        <Input label="Nombre completo" value={form.nombre} onChange={v=>set('nombre',v)}
          placeholder="Ej: Simulacro GO2 — Mayo 2026" required/>
        <Input label="Fecha de aplicación" value={form.fecha} onChange={v=>set('fecha',v)}
          placeholder="Ej: 2026-05-15"/>
        <Input label="Descripción (opcional)" value={form.descripcion} onChange={v=>set('descripcion',v)}
          placeholder="Descripción de la prueba"/>

        {error && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA',
          borderRadius:6, padding:'10px 14px', marginBottom:16,
          fontSize:13, color:C.red, fontFamily:'Inter' }}>{error}</div>}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
          <Btn onClick={onClose} outline color={C.gray}>Cancelar</Btn>
          <Btn onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────────
export default function AdminPruebas({ onUpdate }) {
  const [pruebas, setPruebas] = useState([]) // agrupadas por tipo
  const [tipoSelec, setTipoSelec] = useState(null)
  const [modalRef, setModalRef] = useState(null)
  const [nuevoTipo, setNuevoTipo] = useState('')
  const [showNuevoTipo, setShowNuevoTipo] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPruebas() }, [])

  const loadPruebas = async () => {
    setLoading(true)
    const { data } = await supabase.from('pruebas').select('*').order('tipo').order('created_at', {ascending:false})
    setPruebas(data || [])
    setLoading(false)
  }

  const handleSave = () => { loadPruebas(); onUpdate() }

  const handleToggle = async (p) => {
    await supabase.from('pruebas').update({ activa: !p.activa }).eq('id', p.id)
    loadPruebas()
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta referencia?')) return
    await supabase.from('pruebas').delete().eq('id', id)
    loadPruebas(); onUpdate()
  }

  const handleCrearTipo = async () => {
    if (!nuevoTipo.trim()) return
    const tipo = nuevoTipo.trim().toLowerCase()
    // Insertar una prueba placeholder para crear el tipo
    await supabase.from('pruebas').insert({
      tipo, codigo: 'REF1',
      nombre: `${nuevoTipo} — Referencia 1`,
      activa: true,
    })
    setNuevoTipo('')
    setShowNuevoTipo(false)
    setTipoSelec(tipo)
    loadPruebas(); onUpdate()
  }

  // Agrupar por tipo
  const tipos = [...new Set(pruebas.map(p => p.tipo))]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:20 }}>

      {/* Panel izquierdo — tipos */}
      <div>
        <Card style={{ marginBottom:12 }}>
          <div style={{ fontSize:10, color:C.gray, fontFamily:'Inter', textTransform:'uppercase',
            letterSpacing:'0.1em', marginBottom:12, fontWeight:600 }}>Tipos de Prueba</div>
          {loading ? (
            <div style={{ fontSize:12, color:C.gray, fontFamily:'Inter' }}>Cargando...</div>
          ) : (
            tipos.map(tipo => (
              <button key={tipo} onClick={() => setTipoSelec(tipo)} style={{
                width:'100%', textAlign:'left', padding:'10px 12px', borderRadius:8,
                border:'none', cursor:'pointer', marginBottom:4, fontFamily:'Inter', fontSize:13,
                background: tipoSelec===tipo ? `${C.navy}10` : 'transparent',
                color: tipoSelec===tipo ? C.navy : C.text,
                borderLeft: tipoSelec===tipo ? `3px solid ${C.navy}` : '3px solid transparent',
                fontWeight: tipoSelec===tipo ? 600 : 400,
              }}>
                {tipo.charAt(0).toUpperCase()+tipo.slice(1)}
                <span style={{ marginLeft:6, fontSize:11, color:C.gray }}>
                  ({pruebas.filter(p=>p.tipo===tipo).length})
                </span>
              </button>
            ))
          )}
        </Card>
        {showNuevoTipo ? (
          <Card>
            <div style={{ fontSize:10, color:C.gray, fontFamily:'Inter', textTransform:'uppercase',
              letterSpacing:'0.1em', marginBottom:12, fontWeight:600 }}>Nuevo Tipo</div>
            <input value={nuevoTipo} onChange={e=>setNuevoTipo(e.target.value)}
              placeholder="Ej: Maraton" style={{ width:'100%', padding:'8px 12px',
                border:`1px solid ${C.grayLt}`, borderRadius:6, fontFamily:'Inter',
                fontSize:13, outline:'none', marginBottom:10, boxSizing:'border-box' }}/>
            <div style={{ display:'flex', gap:8 }}>
              <Btn onClick={handleCrearTipo} small color={C.green}>Crear</Btn>
              <Btn onClick={() => setShowNuevoTipo(false)} small outline color={C.gray}>Cancelar</Btn>
            </div>
          </Card>
        ) : (
          <Btn onClick={() => setShowNuevoTipo(true)} outline color={C.navy}>+ Nuevo tipo</Btn>
        )}
      </div>

      {/* Panel derecho — referencias */}
      <div>
        {!tipoSelec ? (
          <Card>
            <div style={{ textAlign:'center', padding:60, fontFamily:'Inter' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
              <div style={{ fontSize:18, fontFamily:'Playfair Display, serif', color:C.navy, marginBottom:8 }}>
                Selecciona un tipo de prueba
              </div>
              <div style={{ fontSize:13, color:C.gray }}>
                O crea uno nuevo en el panel izquierdo.
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div>
                <div style={{ fontSize:16, fontFamily:'Playfair Display, serif', color:C.navy, fontWeight:700 }}>
                  {tipoSelec.charAt(0).toUpperCase()+tipoSelec.slice(1)}
                </div>
                <div style={{ fontSize:12, color:C.gray, fontFamily:'Inter', marginTop:2 }}>
                  {pruebas.filter(p=>p.tipo===tipoSelec).length} referencia{pruebas.filter(p=>p.tipo===tipoSelec).length!==1?'s':''}
                </div>
              </div>
              <Btn onClick={() => setModalRef({tipo: tipoSelec, ref: null})} color={C.green}>
                + Nueva Referencia
              </Btn>
            </div>

            {pruebas.filter(p=>p.tipo===tipoSelec).length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter' }}>
                No hay referencias para este tipo. Crea la primera.
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                <thead>
                  <tr style={{ borderBottom:`2px solid ${C.bg2}` }}>
                    {['Código','Nombre','Grado','Fecha','Estado','Acciones'].map(h => (
                      <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontSize:10,
                        color:C.gray, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pruebas.filter(p=>p.tipo===tipoSelec).map((p,i) => (
                    <tr key={i} style={{ borderBottom:`1px solid ${C.bg2}`,
                      background:i%2===0?`${C.bg}80`:'transparent' }}>
                      <td style={{ padding:'10px 12px', fontSize:14, fontWeight:700,
                        color:C.navy, fontFamily:'Playfair Display, serif' }}>{p.codigo}</td>
                      <td style={{ padding:'10px 12px', fontSize:13, color:C.text }}>{p.nombre}</td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:C.gray }}>{p.grado||'—'}</td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:C.gray }}>{p.fecha||'—'}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <Badge color={p.activa?C.green:C.red}>{p.activa?'Activa':'Inactiva'}</Badge>
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ display:'flex', gap:6 }}>
                          <Btn onClick={() => setModalRef({tipo:tipoSelec, ref:p})} small outline color={C.navy}>
                            Editar
                          </Btn>
                          <Btn onClick={() => handleToggle(p)} small outline
                            color={p.activa?C.red:C.green}>
                            {p.activa?'Desactivar':'Activar'}
                          </Btn>
                          <Btn onClick={() => handleDelete(p.id)} small outline color={C.red}>
                            Eliminar
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>

      {/* Modal referencia */}
      {modalRef && (
        <ModalReferencia
          pruebaTipo={modalRef.tipo}
          referencia={modalRef.ref}
          onClose={() => setModalRef(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
