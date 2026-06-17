import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { C, Card, useMobile } from '../../components/ui'

const CATEGORIAS = ['Noticias', 'Educación', 'Resultados', 'Eventos', 'Docentes', 'ICFES', 'Institucional']

const Input = ({ label, value, onChange, placeholder, type = 'text', required = false }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: C.gray, marginBottom: 6, fontFamily: 'Inter' }}>
      {label}{required && <span style={{ color: C.red }}> *</span>}
    </label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
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
      {options.map(o => <option key={o} value={o}>{o}</option>)}
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

function slugify(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

const ModalArticulo = ({ art, onClose, onSave }) => {
  const mobile = useMobile()
  const isNew = !art
  const [form, setForm] = useState({
    titulo: art?.titulo || '',
    resumen: art?.resumen || '',
    categoria: art?.categoria || CATEGORIAS[0],
    imagen_url: art?.imagen_url || '',
    slug: art?.slug || '',
    fecha_publicacion: art?.fecha_publicacion || new Date().toISOString().slice(0, 10),
    contenido: art?.contenido || '',
    publicado: art?.publicado ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleTituloChange = (v) => {
    set('titulo', v)
    if (isNew) set('slug', slugify(v))
  }

  const handleSave = async () => {
    if (!form.titulo.trim()) { setError('El título es obligatorio.'); return }
    if (!form.slug.trim()) { setError('El slug es obligatorio.'); return }
    if (!form.resumen.trim()) { setError('El resumen es obligatorio.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        titulo: form.titulo.trim(),
        resumen: form.resumen.trim(),
        categoria: form.categoria,
        imagen_url: form.imagen_url.trim() || null,
        slug: form.slug.trim(),
        fecha_publicacion: form.fecha_publicacion || null,
        contenido: form.contenido.trim() || null,
        publicado: form.publicado,
      }
      const { error: err } = art
        ? await supabase.from('articulos').update(payload).eq('id', art.id)
        : await supabase.from('articulos').insert(payload)
      if (err) { setError(err.message); return }
      onSave()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24, overflowY: 'auto' }}>
      <div style={{ background: C.white, borderRadius: 12, padding: 32,
        width: '100%', maxWidth: 620, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxHeight: '92vh', overflowY: 'auto', margin: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.navy }}>
            {isNew ? 'Nuevo Artículo' : 'Editar Artículo'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
        </div>

        <Input label="Título" value={form.titulo} onChange={handleTituloChange}
          placeholder="Ej: Resultados Simulacro Mayo 2025" required />

        <Input label="Slug (URL)" value={form.slug} onChange={v => set('slug', v)}
          placeholder="resultados-simulacro-mayo-2025" required />

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <Select label="Categoría" value={form.categoria}
            onChange={v => set('categoria', v)} options={CATEGORIAS} />
          <Input label="Fecha de publicación" value={form.fecha_publicacion}
            onChange={v => set('fecha_publicacion', v)} type="date" />
        </div>

        <Textarea label="Resumen (aparece en la tira del hero)" value={form.resumen}
          onChange={v => set('resumen', v)} rows={2}
          placeholder="Breve descripción que aparece en listados..." required />

        <Input label="URL de imagen destacada" value={form.imagen_url}
          onChange={v => set('imagen_url', v)}
          placeholder="https://..." />

        <Textarea label="Contenido completo (opcional)" value={form.contenido}
          onChange={v => set('contenido', v)} rows={6}
          placeholder="Texto completo del artículo..." />

        {/* Toggle publicado */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            padding: '12px 16px', borderRadius: 8,
            border: `1px solid ${form.publicado ? C.green : C.grayLt}`,
            background: form.publicado ? `${C.green}0D` : C.bg }}>
            <input type="checkbox" checked={form.publicado}
              onChange={e => set('publicado', e.target.checked)}
              style={{ accentColor: C.green, width: 16, height: 16, cursor: 'pointer' }} />
            <div>
              <div style={{ fontSize: 13, fontFamily: 'Inter', fontWeight: 600,
                color: form.publicado ? C.green : C.gray }}>
                {form.publicado ? '✅ Publicado' : '⏸ Borrador'}
              </div>
              <div style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter', marginTop: 2 }}>
                {form.publicado
                  ? 'Visible en la web y en la tira del hero'
                  : 'Solo visible en este panel, no en la web'}
              </div>
            </div>
          </label>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6,
            padding: '10px 14px', marginBottom: 16, fontSize: 13, color: C.red, fontFamily: 'Inter' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn onClick={onClose} outline color={C.gray}>Cancelar</Btn>
          <Btn onClick={handleSave} disabled={saving} color={C.green}>
            {saving ? 'Guardando...' : isNew ? 'Publicar' : 'Guardar cambios'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default function AdminActualidad() {
  const mobile = useMobile()
  const [articulos, setArticulos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { loadArticulos() }, [])

  const loadArticulos = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('articulos')
      .select('id, titulo, resumen, categoria, slug, publicado, fecha_publicacion, imagen_url')
      .order('fecha_publicacion', { ascending: false })
    setArticulos(data || [])
    setLoading(false)
  }

  const handleTogglePublicado = async (art) => {
    await supabase.from('articulos').update({ publicado: !art.publicado }).eq('id', art.id)
    loadArticulos()
  }

  const handleDelete = async (art) => {
    if (!window.confirm(`¿Eliminar "${art.titulo}"? Esta acción no se puede deshacer.`)) return
    setDeleting(art.id)
    await supabase.from('articulos').delete().eq('id', art.id)
    setDeleting(null)
    loadArticulos()
  }

  const filtrados = filtro === 'todos'
    ? articulos
    : filtro === 'publicados'
    ? articulos.filter(a => a.publicado)
    : articulos.filter(a => !a.publicado)

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.navy, letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 4 }}>Artículos y Noticias</div>
            <div style={{ fontSize: 12, color: C.gray, fontFamily: 'Inter' }}>
              Los artículos publicados aparecen en la tira del hero de la web
            </div>
          </div>
          <Btn onClick={() => setModal('new')} color={C.green}>+ Nuevo artículo</Btn>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { id: 'todos', label: `Todos (${articulos.length})` },
            { id: 'publicados', label: `Publicados (${articulos.filter(a => a.publicado).length})` },
            { id: 'borradores', label: `Borradores (${articulos.filter(a => !a.publicado).length})` },
          ].map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id)} style={{
              padding: '6px 14px', borderRadius: 20, fontFamily: 'Inter',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: filtro === f.id ? C.navy : 'transparent',
              color: filtro === f.id ? C.white : C.gray,
              border: `1px solid ${filtro === f.id ? C.navy : C.grayLt}`,
            }}>{f.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.gray, fontFamily: 'Inter' }}>
            Cargando artículos...
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📰</div>
            <div style={{ fontSize: 14, color: C.gray, fontFamily: 'Inter' }}>
              {filtro === 'todos' ? 'No hay artículos. Crea el primero.' : 'No hay artículos en este filtro.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filtrados.map(art => (
              <div key={art.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px',
                border: `1px solid ${C.grayLt}`, borderRadius: 10,
                background: art.publicado ? C.white : `${C.bg}CC`,
                flexWrap: mobile ? 'wrap' : 'nowrap',
              }}>
                {/* Imagen miniatura */}
                {art.imagen_url ? (
                  <img src={art.imagen_url} alt=""
                    style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 8, flexShrink: 0,
                    background: C.bg2, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 22 }}>📰</div>
                )}

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: C.navy, padding: '2px 7px',
                      border: `1px solid ${C.navy}30`, borderRadius: 3 }}>
                      {art.categoria}
                    </span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontFamily: 'Inter',
                      background: art.publicado ? `${C.green}18` : `${C.gray}18`,
                      color: art.publicado ? C.green : C.gray, fontWeight: 600 }}>
                      {art.publicado ? '● Publicado' : '○ Borrador'}
                    </span>
                    {art.fecha_publicacion && (
                      <span style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter' }}>
                        {new Date(art.fecha_publicacion + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontFamily: 'Playfair Display, serif',
                    color: C.navy, marginBottom: 4, lineHeight: 1.3 }}>{art.titulo}</div>
                  <div style={{ fontSize: 12, color: C.gray, fontFamily: 'Inter',
                    lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{art.resumen}</div>
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <Btn onClick={() => setModal(art)} small outline color={C.navy}>Editar</Btn>
                  <Btn onClick={() => handleTogglePublicado(art)} small outline
                    color={art.publicado ? C.gray : C.green}>
                    {art.publicado ? 'Ocultar' : 'Publicar'}
                  </Btn>
                  <Btn onClick={() => handleDelete(art)} small outline color={C.red}
                    disabled={deleting === art.id}>
                    {deleting === art.id ? '...' : 'Eliminar'}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {modal && (
        <ModalArticulo
          art={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={loadArticulos}
        />
      )}
    </div>
  )
}
