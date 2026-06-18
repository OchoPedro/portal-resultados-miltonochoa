import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { C, Card, useMobile } from '../../components/ui'

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

const ModalFaq = ({ item, onClose, onSave }) => {
  const isNew = !item
  const [form, setForm] = useState({
    pregunta: item?.pregunta || '',
    respuesta: item?.respuesta || '',
    orden: item?.orden ?? 0,
    activo: item?.activo ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.pregunta.trim()) { setError('La pregunta es obligatoria.'); return }
    if (!form.respuesta.trim()) { setError('La respuesta es obligatoria.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        pregunta: form.pregunta.trim(),
        respuesta: form.respuesta.trim(),
        orden: Number(form.orden) || 0,
        activo: form.activo,
      }
      const { error: err } = item
        ? await supabase.from('faq').update(payload).eq('id', item.id)
        : await supabase.from('faq').insert(payload)
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
        width: '100%', maxWidth: 580, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxHeight: '90vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.navy }}>
            {isNew ? 'Nueva Pregunta' : 'Editar Pregunta'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
        </div>

        <Input label="Pregunta" value={form.pregunta} onChange={v => set('pregunta', v)}
          placeholder="¿Cuánto cuestan los servicios?" required />

        <Textarea label="Respuesta" value={form.respuesta} onChange={v => set('respuesta', v)}
          rows={5} placeholder="Escribe aquí la respuesta completa..." required />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input label="Orden" value={String(form.orden)} onChange={v => set('orden', v)}
            placeholder="0" />
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

export default function AdminFaq() {
  const mobile = useMobile()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | item
  const [deleting, setDeleting] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('faq').select('*').order('orden').order('id')
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta pregunta?')) return
    setDeleting(id)
    await supabase.from('faq').delete().eq('id', id)
    setDeleting(null)
    load()
  }

  const handleToggle = async (item) => {
    await supabase.from('faq').update({ activo: !item.activo }).eq('id', item.id)
    load()
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: C.gray, fontFamily: 'Inter', fontSize: 14 }}>
      Cargando preguntas frecuentes...
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: C.gray, fontFamily: 'Inter' }}>
          {items.length} pregunta{items.length !== 1 ? 's' : ''} · las activas aparecen en la web
        </div>
        <Btn onClick={() => setModal('new')}>+ Nueva Pregunta</Btn>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.gray, fontFamily: 'Inter', fontSize: 14 }}>
            No hay preguntas aún. Crea la primera.
          </div>
        ) : (
          items.map((item, idx) => (
            <div key={item.id} style={{
              padding: '18px 24px',
              borderBottom: idx < items.length - 1 ? `1px solid ${C.grayLt}` : 'none',
              display: 'flex', alignItems: 'flex-start', gap: 16,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 600,
                  color: item.activo ? C.navy : C.gray, marginBottom: 4,
                  display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, background: item.activo ? '#D1FAE5' : '#F3F4F6',
                    color: item.activo ? '#065F46' : C.gray,
                    borderRadius: 4, padding: '2px 6px', fontWeight: 500, flexShrink: 0 }}>
                    #{item.orden}
                  </span>
                  {item.pregunta}
                </div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: C.gray,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: mobile ? 200 : 500 }}>
                  {item.respuesta}
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
          ))
        )}
      </Card>

      {modal && (
        <ModalFaq
          item={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={load}
        />
      )}
    </div>
  )
}
