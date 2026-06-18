import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { C, Card, useMobile } from '../../components/ui'

const TABS = [
  { id: 'instituciones', label: 'Instituciones' },
  { id: 'docentes',      label: 'Docentes' },
  { id: 'estudiantes',   label: 'Estudiantes' },
]

const Input = ({ label, value, onChange, placeholder, required = false }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: C.gray, marginBottom: 6, fontFamily: 'Inter' }}>
      {label}{required && <span style={{ color: C.red }}> *</span>}
    </label>
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} style={{ width: '100%', padding: '10px 14px',
        border: `1px solid ${C.grayLt}`, borderRadius: 6, fontFamily: 'Inter',
        fontSize: 13, color: C.text, background: C.bg, outline: 'none', boxSizing: 'border-box' }} />
  </div>
)

const Textarea = ({ label, value, onChange, placeholder, rows = 4, required = false }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: C.gray, marginBottom: 6, fontFamily: 'Inter' }}>
      {label}{required && <span style={{ color: C.red }}> *</span>}
    </label>
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
      placeholder={placeholder} style={{ width: '100%', padding: '10px 14px',
        border: `1px solid ${C.grayLt}`, borderRadius: 6, fontFamily: 'Inter',
        fontSize: 13, color: C.text, background: C.bg, outline: 'none',
        boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 }} />
  </div>
)

const Select = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: C.gray, marginBottom: 6, fontFamily: 'Inter' }}>
      {label}
    </label>
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.grayLt}`,
        borderRadius: 6, fontFamily: 'Inter', fontSize: 13, color: C.text,
        background: C.bg, outline: 'none', boxSizing: 'border-box' }}>
      {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  </div>
)

const Btn = ({ children, onClick, color = C.navy, outline = false, small = false, disabled = false }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: small ? '6px 14px' : '10px 20px',
    background: outline ? 'transparent' : color,
    color: outline ? color : C.white,
    border: `1px solid ${color}`, borderRadius: 6,
    fontFamily: 'Inter', fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }}>{children}</button>
)

const ModalServicio = ({ item, tabActivo, onClose, onSave }) => {
  const isNew = !item
  const mobile = useMobile()
  const [form, setForm] = useState({
    tab: item?.tab || tabActivo,
    categoria: item?.categoria || '',
    titulo: item?.titulo || '',
    descripcion: item?.descripcion || '',
    orden: item?.orden ?? 0,
    activo: item?.activo ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.titulo.trim()) { setError('El título es obligatorio.'); return }
    if (!form.descripcion.trim()) { setError('La descripción es obligatoria.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        tab: form.tab,
        categoria: form.categoria.trim(),
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        orden: Number(form.orden) || 0,
        activo: form.activo,
      }
      const { error: err } = item
        ? await supabase.from('servicios').update(payload).eq('id', item.id)
        : await supabase.from('servicios').insert(payload)
      if (err) { setError(err.message); return }
      onSave()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24 }}>
      <div style={{ background: C.white, borderRadius: 12, padding: 32,
        width: '100%', maxWidth: 600, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxHeight: '90vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.navy }}>
            {isNew ? 'Nuevo Servicio' : 'Editar Servicio'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <Select label="Pestaña" value={form.tab} onChange={v => set('tab', v)} options={TABS} />
          <Input label="Categoría (opcional)" value={form.categoria} onChange={v => set('categoria', v)}
            placeholder="Ej: Evaluación y Seguimiento" />
        </div>

        <Input label="Título del servicio" value={form.titulo} onChange={v => set('titulo', v)}
          placeholder="Ej: Martes de Prueba Gold" required />

        <Textarea label="Descripción" value={form.descripcion} onChange={v => set('descripcion', v)}
          rows={4} placeholder="Describe el servicio..." required />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input label="Orden" value={String(form.orden)} onChange={v => set('orden', v)} placeholder="0" />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: C.gray, marginBottom: 10, fontFamily: 'Inter' }}>
              Estado
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Inter', fontSize: 13 }}>
              <input type="checkbox" checked={form.activo} onChange={e => set('activo', e.target.checked)} />
              Visible en la web
            </label>
          </div>
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 6,
            padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#B91C1C', fontFamily: 'Inter' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Btn outline color={C.gray} onClick={onClose}>Cancelar</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
        </div>
      </div>
    </div>
  )
}

export default function AdminServicios() {
  const mobile = useMobile()
  const [tabActivo, setTabActivo] = useState('instituciones')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('servicios').select('*').order('orden').order('id')
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const visibles = items.filter(i => i.tab === tabActivo)

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este servicio?')) return
    setDeleting(id)
    await supabase.from('servicios').delete().eq('id', id)
    setDeleting(null)
    load()
  }

  const handleToggle = async (item) => {
    await supabase.from('servicios').update({ activo: !item.activo }).eq('id', item.id)
    load()
  }

  // Agrupar por categoría
  const categorias = [...new Set(visibles.map(i => i.categoria || ''))].filter(Boolean)
  const sinCategoria = visibles.filter(i => !i.categoria)
  const grupos = categorias.length > 0
    ? categorias.map(cat => ({ cat, items: visibles.filter(i => i.categoria === cat) }))
    : [{ cat: '', items: visibles }]
  if (categorias.length > 0 && sinCategoria.length > 0) grupos.push({ cat: 'Sin categoría', items: sinCategoria })

  const renderCard = (item) => (
    <div key={item.id} style={{
      padding: '16px 20px',
      borderBottom: `1px solid ${C.grayLt}`,
      display: 'flex', alignItems: 'flex-start', gap: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 600,
          color: item.activo ? C.navy : C.gray, marginBottom: 4 }}>
          {!item.activo && <span style={{ fontSize: 10, background: '#F3F4F6', color: C.gray,
            borderRadius: 4, padding: '2px 6px', marginRight: 6, fontWeight: 500 }}>oculto</span>}
          {item.titulo}
        </div>
        <div style={{ fontFamily: 'Inter', fontSize: 12, color: C.gray,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: mobile ? 180 : 460 }}>
          {item.descripcion}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
        <button onClick={() => handleToggle(item)} title={item.activo ? 'Ocultar' : 'Mostrar'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}>
          {item.activo ? '👁' : '🙈'}
        </button>
        <Btn small outline color={C.navy} onClick={() => setModal(item)}>Editar</Btn>
        <Btn small outline color="#DC2626" onClick={() => handleDelete(item.id)}
          disabled={deleting === item.id}>
          {deleting === item.id ? '...' : 'Eliminar'}
        </Btn>
      </div>
    </div>
  )

  return (
    <div>
      {/* Tabs selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTabActivo(t.id)} style={{
            padding: '8px 18px', borderRadius: 20, fontFamily: 'Inter', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', border: 'none',
            background: tabActivo === t.id ? C.navy : C.grayLt,
            color: tabActivo === t.id ? C.white : C.gray,
          }}>
            {t.label}
            <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>
              ({items.filter(i => i.tab === t.id).length})
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.gray, fontFamily: 'Inter' }}>
          {visibles.length} servicio{visibles.length !== 1 ? 's' : ''} en {TABS.find(t => t.id === tabActivo)?.label}
        </div>
        <Btn onClick={() => setModal('new')}>+ Nuevo Servicio</Btn>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.gray, fontFamily: 'Inter', fontSize: 14 }}>
          Cargando servicios...
        </div>
      ) : grupos.map(({ cat, items: gItems }) => (
        <div key={cat || '_'} style={{ marginBottom: 28 }}>
          {cat && (
            <div style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase', color: C.gray,
              marginBottom: 8, paddingLeft: 4 }}>
              {cat}
            </div>
          )}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {gItems.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: C.gray, fontFamily: 'Inter', fontSize: 13 }}>
                Sin servicios en esta pestaña. Crea el primero.
              </div>
            ) : gItems.map(renderCard)}
          </Card>
        </div>
      ))}

      {modal && (
        <ModalServicio
          item={modal === 'new' ? null : modal}
          tabActivo={tabActivo}
          onClose={() => setModal(null)}
          onSave={load}
        />
      )}
    </div>
  )
}
