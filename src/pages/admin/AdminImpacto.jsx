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

const Textarea = ({ label, value, onChange, placeholder, rows = 3, required = false }) => (
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

// ─── Modal Testimonio ───────────────────────────────────────────────────────
const ModalTestimonio = ({ item, onClose, onSave }) => {
  const isNew = !item
  const [form, setForm] = useState({
    cita: item?.cita || '',
    autor: item?.autor || '',
    cargo: item?.cargo || '',
    orden: item?.orden ?? 0,
    activo: item?.activo ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.cita.trim()) { setError('La cita es obligatoria.'); return }
    if (!form.autor.trim()) { setError('El autor es obligatorio.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        cita: form.cita.trim(),
        autor: form.autor.trim(),
        cargo: form.cargo.trim(),
        orden: Number(form.orden) || 0,
        activo: form.activo,
      }
      const { error: err } = item
        ? await supabase.from('testimonios').update(payload).eq('id', item.id)
        : await supabase.from('testimonios').insert(payload)
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
        width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxHeight: '90vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.navy }}>
            {isNew ? 'Nuevo Testimonio' : 'Editar Testimonio'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
        </div>

        <Textarea label="Cita / Relato" value={form.cita} onChange={v => set('cita', v)}
          rows={4} placeholder="Las pruebas Martes de Prueba Gold nos permitieron..." required />

        <Input label="Nombre del autor" value={form.autor} onChange={v => set('autor', v)}
          placeholder="María Claudia Restrepo" required />

        <Input label="Cargo e institución" value={form.cargo} onChange={v => set('cargo', v)}
          placeholder="Rectora — Colegio Santa María, Medellín" />

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

// ─── Modal Logo ─────────────────────────────────────────────────────────────
const ModalLogo = ({ item, onClose, onSave }) => {
  const isNew = !item
  const [form, setForm] = useState({
    nombre: item?.nombre || '',
    orden: item?.orden ?? 0,
    activo: item?.activo ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        nombre: form.nombre.trim(),
        orden: Number(form.orden) || 0,
        activo: form.activo,
      }
      const { error: err } = item
        ? await supabase.from('logos_institucionales').update(payload).eq('id', item.id)
        : await supabase.from('logos_institucionales').insert(payload)
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
        width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.navy }}>
            {isNew ? 'Nueva Institución' : 'Editar Institución'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
        </div>

        <Input label="Nombre de la institución" value={form.nombre} onChange={v => set('nombre', v)}
          placeholder="I.E. San Juan Bosco" required />

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

// ─── Modal Caso de Éxito ────────────────────────────────────────────────────
const ModalCaso = ({ item, onClose, onSave }) => {
  const isNew = !item
  const [form, setForm] = useState({
    etiqueta:   item?.etiqueta   || '',
    resultado:  item?.resultado  || '',
    descripcion:item?.descripcion|| '',
    institucion:item?.institucion|| '',
    orden:      item?.orden      ?? 0,
    activo:     item?.activo     ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.etiqueta.trim())   { setError('La etiqueta es obligatoria.');  return }
    if (!form.resultado.trim())  { setError('El resultado es obligatorio.'); return }
    if (!form.descripcion.trim()){ setError('La descripción es obligatoria.'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        etiqueta:    form.etiqueta.trim(),
        resultado:   form.resultado.trim(),
        descripcion: form.descripcion.trim(),
        institucion: form.institucion.trim(),
        orden:       Number(form.orden) || 0,
        activo:      form.activo,
      }
      const { error: err } = item
        ? await supabase.from('casos_exito').update(payload).eq('id', item.id)
        : await supabase.from('casos_exito').insert(payload)
      if (err) { setError(err.message); return }
      onSave(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24 }}>
      <div style={{ background: C.white, borderRadius: 12, padding: 32,
        width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.navy }}>
            {isNew ? 'Nuevo Caso de Éxito' : 'Editar Caso de Éxito'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input label="Etiqueta" value={form.etiqueta} onChange={v => set('etiqueta', v)}
            placeholder="Caso de éxito 1" required />
          <Input label="Resultado destacado" value={form.resultado} onChange={v => set('resultado', v)}
            placeholder="+15 pts" required />
        </div>

        <Textarea label="Descripción" value={form.descripcion} onChange={v => set('descripcion', v)}
          rows={4} placeholder="Describe qué logró la institución..." required />

        <Input label="Institución / Alcance" value={form.institucion} onChange={v => set('institucion', v)}
          placeholder="I.E. San Juan Bosco — Bogotá, Cundinamarca" />

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

// ─── Main ────────────────────────────────────────────────────────────────────
export default function AdminImpacto() {
  const mobile = useMobile()
  const [tab, setTab] = useState('testimonios')
  const [testimonios, setTestimonios] = useState([])
  const [logos, setLogos]             = useState([])
  const [casos, setCasos]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [modal, setModal]             = useState(null)
  const [deleting, setDeleting]       = useState(null)

  const load = async () => {
    setLoading(true)
    const [{ data: t }, { data: l }, { data: c }] = await Promise.all([
      supabase.from('testimonios').select('*').order('orden').order('id'),
      supabase.from('logos_institucionales').select('*').order('orden').order('id'),
      supabase.from('casos_exito').select('*').order('orden').order('id'),
    ])
    setTestimonios(t || [])
    setLogos(l || [])
    setCasos(c || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDeleteTestimonio = async (id) => {
    if (!confirm('¿Eliminar este testimonio?')) return
    setDeleting(id); await supabase.from('testimonios').delete().eq('id', id)
    setDeleting(null); load()
  }
  const handleDeleteLogo = async (id) => {
    if (!confirm('¿Eliminar esta institución?')) return
    setDeleting(id); await supabase.from('logos_institucionales').delete().eq('id', id)
    setDeleting(null); load()
  }
  const handleDeleteCaso = async (id) => {
    if (!confirm('¿Eliminar este caso de éxito?')) return
    setDeleting(id); await supabase.from('casos_exito').delete().eq('id', id)
    setDeleting(null); load()
  }

  const handleToggleT = async (item) => { await supabase.from('testimonios').update({ activo: !item.activo }).eq('id', item.id); load() }
  const handleToggleL = async (item) => { await supabase.from('logos_institucionales').update({ activo: !item.activo }).eq('id', item.id); load() }
  const handleToggleC = async (item) => { await supabase.from('casos_exito').update({ activo: !item.activo }).eq('id', item.id); load() }

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { id: 'testimonios', label: `Testimonios (${testimonios.length})` },
          { id: 'logos',       label: `Logos institucionales (${logos.length})` },
          { id: 'casos',       label: `Casos de Éxito (${casos.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', borderRadius: 20, fontFamily: 'Inter', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', border: 'none',
            background: tab === t.id ? C.navy : C.grayLt,
            color: tab === t.id ? C.white : C.gray,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.gray, fontFamily: 'Inter', fontSize: 14 }}>
          Cargando...
        </div>
      ) : tab === 'testimonios' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: C.gray, fontFamily: 'Inter' }}>
              Relatos que aparecen en la sección "¿Quiénes confían en nosotros?"
            </div>
            <Btn onClick={() => setModal({ type: 'testimonio', item: null })}>+ Nuevo Testimonio</Btn>
          </div>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {testimonios.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.gray, fontFamily: 'Inter', fontSize: 14 }}>
                No hay testimonios. Crea el primero.
              </div>
            ) : testimonios.map((item, idx) => (
              <div key={item.id} style={{
                padding: '18px 24px',
                borderBottom: idx < testimonios.length - 1 ? `1px solid ${C.grayLt}` : 'none',
                display: 'flex', alignItems: 'flex-start', gap: 16,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, fontStyle: 'italic',
                    color: item.activo ? C.text : C.gray, marginBottom: 6,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: mobile ? 180 : 460 }}>
                    "{item.cita}"
                  </div>
                  <div style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: C.navy }}>{item.autor}</div>
                  <div style={{ fontFamily: 'Inter', fontSize: 11, color: C.gray }}>{item.cargo}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                  <button onClick={() => handleToggleT(item)} title={item.activo ? 'Ocultar' : 'Mostrar'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}>
                    {item.activo ? '👁' : '🙈'}
                  </button>
                  <Btn small outline color={C.navy} onClick={() => setModal({ type: 'testimonio', item })}>Editar</Btn>
                  <Btn small outline color="#DC2626" onClick={() => handleDeleteTestimonio(item.id)} disabled={deleting === item.id}>
                    {deleting === item.id ? '...' : 'Eliminar'}
                  </Btn>
                </div>
              </div>
            ))}
          </Card>
        </>
      ) : tab === 'logos' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: C.gray, fontFamily: 'Inter' }}>
              Instituciones que aparecen en la grilla de logos
            </div>
            <Btn onClick={() => setModal({ type: 'logo', item: null })}>+ Nueva Institución</Btn>
          </div>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {logos.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.gray, fontFamily: 'Inter', fontSize: 14 }}>
                No hay instituciones. Crea la primera.
              </div>
            ) : logos.map((item, idx) => (
              <div key={item.id} style={{
                padding: '14px 24px',
                borderBottom: idx < logos.length - 1 ? `1px solid ${C.grayLt}` : 'none',
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{ flex: 1, fontFamily: 'Inter', fontSize: 14,
                  color: item.activo ? C.navy : C.gray, fontWeight: 500 }}>
                  {!item.activo && <span style={{ fontSize: 10, background: '#F3F4F6', color: C.gray,
                    borderRadius: 4, padding: '2px 6px', marginRight: 8, fontWeight: 500 }}>oculto</span>}
                  {item.nombre}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                  <button onClick={() => handleToggleL(item)} title={item.activo ? 'Ocultar' : 'Mostrar'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}>
                    {item.activo ? '👁' : '🙈'}
                  </button>
                  <Btn small outline color={C.navy} onClick={() => setModal({ type: 'logo', item })}>Editar</Btn>
                  <Btn small outline color="#DC2626" onClick={() => handleDeleteLogo(item.id)} disabled={deleting === item.id}>
                    {deleting === item.id ? '...' : 'Eliminar'}
                  </Btn>
                </div>
              </div>
            ))}
          </Card>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: C.gray, fontFamily: 'Inter' }}>
              Tarjetas de la sección "Nuestro impacto real" en la página Nosotros
            </div>
            <Btn onClick={() => setModal({ type: 'caso', item: null })}>+ Nuevo Caso</Btn>
          </div>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {casos.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.gray, fontFamily: 'Inter', fontSize: 14 }}>
                No hay casos. Crea el primero.
              </div>
            ) : casos.map((item, idx) => (
              <div key={item.id} style={{
                padding: '16px 24px',
                borderBottom: idx < casos.length - 1 ? `1px solid ${C.grayLt}` : 'none',
                display: 'flex', alignItems: 'flex-start', gap: 16,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, background: item.activo ? '#D1FAE5' : '#F3F4F6',
                      color: item.activo ? '#065F46' : C.gray,
                      borderRadius: 4, padding: '2px 6px', fontWeight: 600, fontFamily: 'Inter', flexShrink: 0 }}>
                      {item.etiqueta}
                    </span>
                    <span style={{ fontFamily: 'Inter', fontSize: 15, fontWeight: 700, color: C.navy }}>
                      {item.resultado}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'Inter', fontSize: 12, color: C.gray,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: mobile ? 180 : 460 }}>
                    {item.descripcion}
                  </div>
                  {item.institucion && (
                    <div style={{ fontFamily: 'Inter', fontSize: 11, color: C.gray, marginTop: 2 }}>
                      {item.institucion}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                  <button onClick={() => handleToggleC(item)} title={item.activo ? 'Ocultar' : 'Mostrar'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}>
                    {item.activo ? '👁' : '🙈'}
                  </button>
                  <Btn small outline color={C.navy} onClick={() => setModal({ type: 'caso', item })}>Editar</Btn>
                  <Btn small outline color="#DC2626" onClick={() => handleDeleteCaso(item.id)} disabled={deleting === item.id}>
                    {deleting === item.id ? '...' : 'Eliminar'}
                  </Btn>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {modal?.type === 'testimonio' && (
        <ModalTestimonio item={modal.item} onClose={() => setModal(null)} onSave={load} />
      )}
      {modal?.type === 'logo' && (
        <ModalLogo item={modal.item} onClose={() => setModal(null)} onSave={load} />
      )}
      {modal?.type === 'caso' && (
        <ModalCaso item={modal.item} onClose={() => setModal(null)} onSave={load} />
      )}
    </div>
  )
}
