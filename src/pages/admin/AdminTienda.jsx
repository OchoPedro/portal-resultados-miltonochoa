import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { C, Card, Badge, useMobile } from '../../components/ui'

// ── Helpers UI ────────────────────────────────────────────────────────────────
const Btn = ({ children, onClick, color = C.navy, outline = false, small = false, disabled = false }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: small ? '6px 14px' : '10px 20px',
    background: outline ? 'transparent' : (disabled ? C.grayLt : color),
    color: outline ? color : C.white,
    border: `1px solid ${disabled ? C.grayLt : color}`,
    borderRadius: 6, fontFamily: 'Inter', fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
  }}>{children}</button>
)

const Input = ({ label, value, onChange, placeholder, type = 'text', required = false, rows }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: C.gray, marginBottom: 5, fontFamily: 'Inter' }}>
      {label}{required && <span style={{ color: C.red }}> *</span>}
    </label>
    {rows ? (
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.grayLt}`, borderRadius: 6,
          fontFamily: 'Inter', fontSize: 13, color: C.text, background: C.bg, outline: 'none',
          boxSizing: 'border-box', resize: 'vertical' }} />
    ) : (
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.grayLt}`, borderRadius: 6,
          fontFamily: 'Inter', fontSize: 13, color: C.text, background: C.bg, outline: 'none',
          boxSizing: 'border-box' }} />
    )}
  </div>
)

const Select = ({ label, value, onChange, options, required = false }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: C.gray, marginBottom: 5, fontFamily: 'Inter' }}>
      {label}{required && <span style={{ color: C.red }}> *</span>}
    </label>
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.grayLt}`, borderRadius: 6,
        fontFamily: 'Inter', fontSize: 13, color: C.text, background: C.bg, outline: 'none' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
)

const TIPO_OPTS = [
  { value: 'simulacro',            label: '📝 Simulacro Online' },
  { value: 'clase_live',           label: '🎥 Clase en Vivo' },
  { value: 'preicfes_presencial',  label: '🏫 Pre-ICFES Presencial' },
  { value: 'capacitacion_docente', label: '👨‍🏫 Capacitación Docente' },
]

const TIPO_COLOR = {
  simulacro:            C.green,
  clase_live:           '#3B82F6',
  preicfes_presencial:  '#C9A84C',
  capacitacion_docente: '#8B5CF6',
}

const fmt = n => `$${Number(n).toLocaleString('es-CO')}`

const Modal = ({ title, onClose, children, width = 560 }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24 }}>
    <div style={{ background: C.white, borderRadius: 12, padding: 32, width: '100%', maxWidth: width,
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.navy, margin: 0 }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20,
          cursor: 'pointer', color: C.gray }}>✕</button>
      </div>
      {children}
    </div>
  </div>
)

const ErrBox = ({ msg }) => msg ? (
  <div style={{ background: '#FEF2F2', border: `1px solid #FECACA`, borderRadius: 6, padding: '10px 14px',
    marginBottom: 14, fontSize: 13, color: C.red, fontFamily: 'Inter' }}>{msg}</div>
) : null

const TABS = [
  { id: 'productos',      label: '📦 Productos' },
  { id: 'ordenes',        label: '🧾 Órdenes' },
  { id: 'descuentos',     label: '🎟 Descuentos' },
  { id: 'docentes',       label: '👨‍🏫 Docentes' },
  { id: 'disponibilidad', label: '📅 Disponibilidad' },
  { id: 'cupos',          label: '🎫 Cupos Pre-ICFES' },
]

// ══════════════════════════════════════════════════════════════════════════════
// TAB: PRODUCTOS
// ══════════════════════════════════════════════════════════════════════════════
function TabProductos() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(null) // null | 'new' | producto

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('productos').select('*').order('orden').order('created_at', { ascending: false })
    setProductos(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleActivo = async (p) => {
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.gray }}>{productos.length} productos en total</div>
        <Btn onClick={() => setModal('new')} color={C.green}>+ Nuevo Producto</Btn>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.gray }}>Cargando...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.bg2}` }}>
                {['#', 'Nombre', 'Tipo', 'Precio', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10,
                    color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productos.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${C.bg2}`, background: i % 2 === 0 ? `${C.bg}80` : 'transparent' }}>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: C.gray }}>{p.orden || i + 1}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.nombre}</div>
                    {p.badge && <Badge color={C.gold}>{p.badge}</Badge>}
                    {p.descripcion && <div style={{ fontSize: 11, color: C.gray, marginTop: 2,
                      maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.descripcion}</div>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <Badge color={TIPO_COLOR[p.tipo] || C.gray}>
                      {TIPO_OPTS.find(t => t.value === p.tipo)?.label.split(' ').slice(1).join(' ') || p.tipo}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: C.navy }}>
                    {fmt(p.precio)}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <Badge color={p.activo ? C.green : C.red}>{p.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn small outline color={C.navy} onClick={() => setModal(p)}>Editar</Btn>
                      <Btn small outline color={p.activo ? C.red : C.green} onClick={() => toggleActivo(p)}>
                        {p.activo ? 'Desactivar' : 'Activar'}
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <ModalProducto producto={modal === 'new' ? null : modal}
        onClose={() => setModal(null)} onSave={load} />}
    </div>
  )
}

function ModalProducto({ producto, onClose, onSave }) {
  const [form, setForm] = useState(producto || {
    nombre: '', descripcion: '', descripcion_larga: '',
    tipo: 'simulacro', precio: '', imagen_url: '', badge: '', orden: 0,
    metadata: '{}',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nombre || !form.precio) { setError('Nombre y precio son obligatorios.'); return }
    let metadata
    try { metadata = JSON.parse(form.metadata || '{}') } catch { setError('Metadata no es JSON válido.'); return }
    setSaving(true)
    const payload = {
      nombre: form.nombre, descripcion: form.descripcion, descripcion_larga: form.descripcion_larga,
      tipo: form.tipo, precio: Number(form.precio), imagen_url: form.imagen_url || null,
      badge: form.badge || null, orden: Number(form.orden) || 0, metadata,
    }
    const { error: err } = producto
      ? await supabase.from('productos').update(payload).eq('id', producto.id)
      : await supabase.from('productos').insert({ ...payload, activo: true })
    if (err) { setError(err.message); setSaving(false); return }
    onSave(); onClose()
  }

  const METADATA_HINTS = {
    simulacro:            '{\n  "pruebas_incluidas": ["Matemáticas", "Lectura Crítica"]\n}',
    clase_live:           '{\n  "paquetes": [\n    {"horas": 2, "precio": 120000},\n    {"horas": 4, "precio": 220000}\n  ]\n}',
    preicfes_presencial:  '{}',
    capacitacion_docente: '{\n  "fecha_evento": "2025-08-10",\n  "modalidad": "Virtual",\n  "enlace_zoom": "https://zoom.us/..."\n}',
  }

  return (
    <Modal title={producto ? 'Editar Producto' : 'Nuevo Producto'} onClose={onClose} width={620}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Nombre del producto" value={form.nombre} onChange={v => set('nombre', v)} required />
        </div>
        <Select label="Tipo de producto" value={form.tipo} required
          onChange={v => { set('tipo', v); set('metadata', METADATA_HINTS[v] || '{}') }}
          options={TIPO_OPTS} />
        <Input label="Precio base (COP)" value={form.precio} onChange={v => set('precio', v)}
          type="number" placeholder="Ej: 85000" required />
        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Descripción corta" value={form.descripcion}
            onChange={v => set('descripcion', v)} placeholder="Descripción en el catálogo" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Descripción larga" value={form.descripcion_larga}
            onChange={v => set('descripcion_larga', v)} rows={4}
            placeholder="Descripción detallada de la página del producto..." />
        </div>
        <Input label="URL de imagen" value={form.imagen_url} onChange={v => set('imagen_url', v)}
          placeholder="https://..." />
        <Input label="Badge (opcional)" value={form.badge} onChange={v => set('badge', v)}
          placeholder='Ej: "Nuevo", "Popular"' />
        <Input label="Orden de aparición" value={form.orden} onChange={v => set('orden', v)}
          type="number" placeholder="0 = primero" />
        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Metadata (JSON)" value={form.metadata} onChange={v => set('metadata', v)} rows={6}
            placeholder={METADATA_HINTS[form.tipo]} />
          <div style={{ fontSize: 11, color: C.gray, marginTop: -8, marginBottom: 14 }}>
            Configuración adicional según el tipo de producto. Ver ejemplo en el placeholder.
          </div>
        </div>
      </div>
      <ErrBox msg={error} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn outline color={C.gray} onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: ÓRDENES
// ══════════════════════════════════════════════════════════════════════════════
function TabOrdenes() {
  const [ordenes, setOrdenes]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState('todos')
  const [detalle, setDetalle]   = useState(null)

  useEffect(() => {
    supabase.from('ordenes').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { setOrdenes(data || []); setLoading(false) })
  }, [])

  const ESTADO_COLOR = { pendiente: C.amber || '#F59E0B', pagado: C.green, cancelado: C.red, reembolsado: C.gray }
  const visibles = filtro === 'todos' ? ordenes : ordenes.filter(o => o.estado === filtro)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['todos','pendiente','pagado','cancelado'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: '6px 16px', borderRadius: 20, border: `1px solid ${filtro === f ? C.navy : C.grayLt}`,
            background: filtro === f ? C.navy : 'transparent',
            color: filtro === f ? C.white : C.gray, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter',
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'todos' && ` (${ordenes.filter(o => o.estado === f).length})`}
          </button>
        ))}
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: C.gray }}>Cargando...</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.bg2}` }}>
                {['Orden','Comprador','Total','Estado','Fecha',''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10,
                    color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((o, i) => (
                <tr key={o.id} style={{ borderBottom: `1px solid ${C.bg2}`, background: i % 2 === 0 ? `${C.bg}80` : 'transparent' }}>
                  <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: C.navy, fontWeight: 600 }}>
                    {o.numero_orden}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{o.comprador_nombre}</div>
                    <div style={{ fontSize: 11, color: C.gray }}>{o.comprador_email}</div>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: C.navy }}>
                    {fmt(o.total)}
                    {o.descuento > 0 && <div style={{ fontSize: 10, color: C.green }}>-{fmt(o.descuento)} desc.</div>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <Badge color={ESTADO_COLOR[o.estado] || C.gray}>
                      {o.estado.charAt(0).toUpperCase() + o.estado.slice(1)}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: C.gray }}>
                    {new Date(o.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota',
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <Btn small outline color={C.navy} onClick={() => setDetalle(o)}>Ver</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detalle && <ModalOrden orden={detalle} onClose={() => setDetalle(null)} />}
    </div>
  )
}

function ModalOrden({ orden, onClose }) {
  const [items, setItems]   = useState([])
  const [pagos, setPagos]   = useState([])

  useEffect(() => {
    supabase.from('orden_items').select('*').eq('orden_id', orden.id).then(({ data }) => setItems(data || []))
    supabase.from('pagos_wompi').select('*').eq('orden_id', orden.id).then(({ data }) => setPagos(data || []))
  }, [orden.id])

  return (
    <Modal title={`Orden ${orden.numero_orden}`} onClose={onClose} width={580}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          ['Comprador', orden.comprador_nombre],
          ['Email', orden.comprador_email],
          ['Teléfono', orden.comprador_telefono || '—'],
          ['Documento', orden.comprador_documento || '—'],
          ['Subtotal', fmt(orden.subtotal)],
          ['Descuento', orden.descuento > 0 ? fmt(orden.descuento) : '—'],
          ['Total', fmt(orden.total)],
          ['Código desc.', orden.codigo_descuento_usado || '—'],
        ].map(([k, v]) => (
          <div key={k} style={{ background: C.bg, borderRadius: 6, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{k}</div>
            <div style={{ fontSize: 13, color: C.navy, fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Productos</div>
      {items.map(it => (
        <div key={it.id} style={{ background: C.bg, borderRadius: 6, padding: '10px 14px', marginBottom: 8,
          display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{it.nombre_producto}</div>
            <Badge color={TIPO_COLOR[it.tipo_producto] || C.gray} style={{ marginTop: 4 }}>
              {it.tipo_producto.replace(/_/g, ' ')}
            </Badge>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{fmt(it.precio_unitario)}</div>
        </div>
      ))}
      {pagos.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '16px 0 8px' }}>
            Pago Wompi
          </div>
          {pagos.map(pg => (
            <div key={pg.id} style={{ background: C.bg, borderRadius: 6, padding: '10px 14px', fontSize: 12, color: C.gray }}>
              <div>Referencia: <strong>{pg.referencia}</strong></div>
              <div>Estado: <strong>{pg.estado}</strong></div>
              {pg.metodo_pago && <div>Método: {pg.metodo_pago}</div>}
            </div>
          ))}
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <Btn outline color={C.gray} onClick={onClose}>Cerrar</Btn>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: CÓDIGOS DE DESCUENTO
// ══════════════════════════════════════════════════════════════════════════════
function TabDescuentos() {
  const [codigos, setCodigos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)

  const load = () => {
    setLoading(true)
    supabase.from('codigos_descuento').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setCodigos(data || []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const toggleActivo = async (c) => {
    await supabase.from('codigos_descuento').update({ activo: !c.activo }).eq('id', c.id)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.gray }}>{codigos.length} códigos</div>
        <Btn onClick={() => setModal('new')} color={C.green}>+ Nuevo Código</Btn>
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: C.gray }}>Cargando...</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter', minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.bg2}` }}>
                {['Código','Tipo','Valor','Usos','Vence','Estado',''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10,
                    color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codigos.map((c, i) => {
                const vencido = c.fecha_expiracion && new Date(c.fecha_expiracion) < new Date()
                return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${C.bg2}`, background: i % 2 === 0 ? `${C.bg}80` : 'transparent' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: C.navy, fontSize: 14 }}>
                      {c.codigo}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge color={c.tipo === 'porcentaje' ? C.blue : C.green}>
                        {c.tipo === 'porcentaje' ? '%' : '$'}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>
                      {c.tipo === 'porcentaje' ? `${c.valor}%` : fmt(c.valor)}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: C.gray }}>
                      {c.usos_actuales}{c.usos_maximos ? ` / ${c.usos_maximos}` : ' / ∞'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: vencido ? C.red : C.gray }}>
                      {c.fecha_expiracion ? new Date(c.fecha_expiracion + 'T00:00:00').toLocaleDateString('es-CO') : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge color={c.activo && !vencido ? C.green : C.red}>
                        {vencido ? 'Vencido' : c.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn small outline color={C.navy} onClick={() => setModal(c)}>Editar</Btn>
                        <Btn small outline color={c.activo ? C.red : C.green} onClick={() => toggleActivo(c)}>
                          {c.activo ? 'Desact.' : 'Activar'}
                        </Btn>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {modal && <ModalDescuento codigo={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={load} />}
    </div>
  )
}

function ModalDescuento({ codigo, onClose, onSave }) {
  const [form, setForm] = useState(codigo || { codigo: '', tipo: 'porcentaje', valor: '', usos_maximos: '', fecha_expiracion: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.codigo || !form.valor) { setError('Código y valor son obligatorios.'); return }
    setSaving(true)
    const payload = {
      codigo: form.codigo.trim().toUpperCase(),
      tipo: form.tipo,
      valor: Number(form.valor),
      usos_maximos: form.usos_maximos ? Number(form.usos_maximos) : null,
      fecha_expiracion: form.fecha_expiracion || null,
    }
    const { error: err } = codigo
      ? await supabase.from('codigos_descuento').update(payload).eq('id', codigo.id)
      : await supabase.from('codigos_descuento').insert({ ...payload, activo: true, usos_actuales: 0 })
    if (err) { setError(err.message); setSaving(false); return }
    onSave(); onClose()
  }

  return (
    <Modal title={codigo ? 'Editar Código' : 'Nuevo Código de Descuento'} onClose={onClose}>
      <Input label="Código" value={form.codigo} onChange={v => set('codigo', v.toUpperCase())}
        placeholder="Ej: PROMO2025" required />
      <Select label="Tipo de descuento" value={form.tipo} onChange={v => set('tipo', v)} options={[
        { value: 'porcentaje', label: '% Porcentaje (ej: 15%)' },
        { value: 'valor_fijo', label: '$ Valor fijo (ej: $20.000)' },
      ]} />
      <Input label={form.tipo === 'porcentaje' ? 'Porcentaje (0-100)' : 'Valor en COP'} value={form.valor}
        onChange={v => set('valor', v)} type="number" placeholder={form.tipo === 'porcentaje' ? '15' : '20000'} required />
      <Input label="Usos máximos (dejar vacío = ilimitado)" value={form.usos_maximos}
        onChange={v => set('usos_maximos', v)} type="number" placeholder="Ej: 100" />
      <Input label="Fecha de expiración (dejar vacío = sin fecha)" value={form.fecha_expiracion}
        onChange={v => set('fecha_expiracion', v)} type="date" />
      <ErrBox msg={error} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn outline color={C.gray} onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: DOCENTES
// ══════════════════════════════════════════════════════════════════════════════
function TabDocentes() {
  const [docentes, setDocentes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null)

  const load = () => {
    setLoading(true)
    supabase.from('docentes').select('*').order('nombre')
      .then(({ data }) => { setDocentes(data || []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.gray }}>{docentes.length} docentes</div>
        <Btn onClick={() => setModal('new')} color={C.green}>+ Nuevo Docente</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {loading ? <div style={{ color: C.gray }}>Cargando...</div> : docentes.map(d => (
          <div key={d.id} style={{ background: C.white, border: `1px solid ${C.grayLt}`,
            borderRadius: 10, padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.navy}, ${C.green})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: C.white, fontFamily: 'Playfair Display, serif' }}>
              {d.nombre.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{d.nombre}</div>
              {d.especialidad && <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{d.especialidad}</div>}
              {d.bio && <div style={{ fontSize: 11, color: C.gray, marginTop: 4, lineHeight: 1.5 }}>{d.bio}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Btn small outline color={C.navy} onClick={() => setModal(d)}>Editar</Btn>
                <Badge color={d.activo ? C.green : C.red}>{d.activo ? 'Activo' : 'Inactivo'}</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
      {modal && <ModalDocente docente={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={load} />}
    </div>
  )
}

function ModalDocente({ docente, onClose, onSave }) {
  const [form, setForm] = useState(docente || { nombre: '', especialidad: '', bio: '', foto_url: '', activo: true })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nombre) { setError('Nombre es obligatorio.'); return }
    setSaving(true)
    const { error: err } = docente
      ? await supabase.from('docentes').update(form).eq('id', docente.id)
      : await supabase.from('docentes').insert({ ...form, activo: true })
    if (err) { setError(err.message); setSaving(false); return }
    onSave(); onClose()
  }

  return (
    <Modal title={docente ? 'Editar Docente' : 'Nuevo Docente'} onClose={onClose}>
      <Input label="Nombre completo" value={form.nombre} onChange={v => set('nombre', v)} required />
      <Input label="Especialidad / Área" value={form.especialidad} onChange={v => set('especialidad', v)}
        placeholder="Ej: Matemáticas y Física" />
      <Input label="Biografía breve" value={form.bio} onChange={v => set('bio', v)} rows={3}
        placeholder="Descripción del docente que verá el estudiante..." />
      <Input label="URL foto (opcional)" value={form.foto_url} onChange={v => set('foto_url', v)}
        placeholder="https://..." />
      <ErrBox msg={error} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn outline color={C.gray} onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: DISPONIBILIDAD DOCENTES
// ══════════════════════════════════════════════════════════════════════════════
function TabDisponibilidad() {
  const [docentes, setDocentes]   = useState([])
  const [docSel, setDocSel]       = useState('')
  const [slots, setSlots]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [modal, setModal]         = useState(false)

  useEffect(() => {
    supabase.from('docentes').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => { setDocentes(data || []); if (data?.[0]) setDocSel(data[0].id) })
  }, [])

  useEffect(() => {
    if (!docSel) return
    setLoading(true)
    supabase.from('disponibilidad_docente').select('*').eq('docente_id', docSel)
      .gte('fecha', new Date().toISOString().slice(0, 10))
      .order('fecha').order('hora_inicio')
      .then(({ data }) => { setSlots(data || []); setLoading(false) })
  }, [docSel])

  const reload = () => {
    setLoading(true)
    supabase.from('disponibilidad_docente').select('*').eq('docente_id', docSel)
      .gte('fecha', new Date().toISOString().slice(0, 10))
      .order('fecha').order('hora_inicio')
      .then(({ data }) => { setSlots(data || []); setLoading(false) })
  }

  const eliminar = async (id) => {
    await supabase.from('disponibilidad_docente').delete().eq('id', id)
    reload()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <select value={docSel} onChange={e => setDocSel(e.target.value)} style={{
          padding: '8px 14px', border: `1px solid ${C.grayLt}`, borderRadius: 6,
          fontFamily: 'Inter', fontSize: 13, color: C.text, background: C.white,
        }}>
          {docentes.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <Btn onClick={() => setModal(true)} color={C.green} disabled={!docSel}>+ Agregar horario</Btn>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: C.gray }}>Cargando...</div> : (
        slots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.gray }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
            <div>No hay horarios registrados para este docente</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 12 }}>
            {slots.map(s => {
              const fecha = new Date(s.fecha + 'T00:00:00').toLocaleDateString('es-CO',
                { weekday: 'short', month: 'short', day: 'numeric' })
              return (
                <div key={s.id} style={{ background: s.reservado ? `${C.red}08` : C.white,
                  border: `1px solid ${s.reservado ? C.red : C.grayLt}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, textTransform: 'capitalize' }}>{fecha}</div>
                  <div style={{ fontSize: 14, color: C.text, marginTop: 4 }}>
                    {s.hora_inicio.slice(0, 5)} – {s.hora_fin.slice(0, 5)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <Badge color={s.reservado ? C.red : C.green}>{s.reservado ? 'Reservado' : 'Libre'}</Badge>
                    {!s.reservado && (
                      <button onClick={() => eliminar(s.id)} style={{ background: 'none', border: 'none',
                        color: C.red, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter' }}>
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
      {modal && <ModalSlot docenteId={docSel} onClose={() => setModal(false)} onSave={reload} />}
    </div>
  )
}

function ModalSlot({ docenteId, onClose, onSave }) {
  const [form, setForm] = useState({ fecha: '', hora_inicio: '08:00', hora_fin: '10:00' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.fecha || !form.hora_inicio || !form.hora_fin) { setError('Todos los campos son obligatorios.'); return }
    if (form.hora_fin <= form.hora_inicio) { setError('La hora fin debe ser mayor a la hora inicio.'); return }
    setSaving(true)
    const { error: err } = await supabase.from('disponibilidad_docente').insert({
      docente_id: docenteId, fecha: form.fecha,
      hora_inicio: form.hora_inicio, hora_fin: form.hora_fin, reservado: false,
    })
    if (err) { setError(err.message); setSaving(false); return }
    onSave(); onClose()
  }

  return (
    <Modal title="Agregar horario disponible" onClose={onClose}>
      <Input label="Fecha" value={form.fecha} onChange={v => set('fecha', v)} type="date" required />
      <Input label="Hora inicio" value={form.hora_inicio} onChange={v => set('hora_inicio', v)} type="time" required />
      <Input label="Hora fin" value={form.hora_fin} onChange={v => set('hora_fin', v)} type="time" required />
      <ErrBox msg={error} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn outline color={C.gray} onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: CUPOS PRE-ICFES
// ══════════════════════════════════════════════════════════════════════════════
function TabCupos() {
  const [productos, setProductos] = useState([])
  const [prodSel, setProdSel]     = useState('')
  const [cupos, setCupos]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [modal, setModal]         = useState(null)

  useEffect(() => {
    supabase.from('productos').select('id, nombre').eq('tipo', 'preicfes_presencial').eq('activo', true)
      .then(({ data }) => { setProductos(data || []); if (data?.[0]) setProdSel(data[0].id) })
  }, [])

  useEffect(() => {
    if (!prodSel) return
    setLoading(true)
    supabase.from('cupos_producto').select('*').eq('producto_id', prodSel).order('fecha')
      .then(({ data }) => { setCupos(data || []); setLoading(false) })
  }, [prodSel])

  const reload = () => {
    setLoading(true)
    supabase.from('cupos_producto').select('*').eq('producto_id', prodSel).order('fecha')
      .then(({ data }) => { setCupos(data || []); setLoading(false) })
  }

  const toggleActivo = async (c) => {
    await supabase.from('cupos_producto').update({ activo: !c.activo }).eq('id', c.id)
    reload()
  }

  return (
    <div>
      {productos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.gray }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏫</div>
          <div>No hay productos Pre-ICFES activos.</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>Crea primero un producto de tipo "Pre-ICFES Presencial".</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <select value={prodSel} onChange={e => setProdSel(e.target.value)} style={{
              padding: '8px 14px', border: `1px solid ${C.grayLt}`, borderRadius: 6,
              fontFamily: 'Inter', fontSize: 13, color: C.text, background: C.white,
            }}>
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <Btn onClick={() => setModal('new')} color={C.green}>+ Agregar fecha/sede</Btn>
          </div>

          {loading ? <div style={{ textAlign: 'center', padding: 40, color: C.gray }}>Cargando...</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter', minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.bg2}` }}>
                    {['Fecha', 'Lugar', 'Ciudad', 'Cupos', 'Vendidos', 'Estado', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10,
                        color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cupos.map((c, i) => {
                    const disponibles = c.cupos_totales - c.cupos_vendidos
                    const fecha = new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-CO',
                      { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
                    return (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${C.bg2}`, background: i % 2 === 0 ? `${C.bg}80` : 'transparent' }}>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: C.navy, textTransform: 'capitalize' }}>{fecha}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, color: C.text }}>{c.lugar}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: C.gray }}>{c.ciudad || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>{c.cupos_totales}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 13, fontWeight: 600,
                            color: disponibles <= 0 ? C.red : disponibles <= 10 ? '#F59E0B' : C.green }}>
                            {c.cupos_vendidos}
                          </span>
                          <span style={{ fontSize: 11, color: C.gray }}> ({disponibles} disp.)</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge color={c.activo ? C.green : C.red}>{c.activo ? 'Activo' : 'Inactivo'}</Badge>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Btn small outline color={C.navy} onClick={() => setModal(c)}>Editar</Btn>
                            <Btn small outline color={c.activo ? C.red : C.green} onClick={() => toggleActivo(c)}>
                              {c.activo ? 'Desact.' : 'Activar'}
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {modal && <ModalCupo cupo={modal === 'new' ? null : modal} productoId={prodSel}
        onClose={() => setModal(null)} onSave={reload} />}
    </div>
  )
}

function ModalCupo({ cupo, productoId, onClose, onSave }) {
  const [form, setForm] = useState(cupo || {
    fecha: '', lugar: '', ciudad: '', info_adicional: '', cupos_totales: 30,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.fecha || !form.lugar || !form.cupos_totales) { setError('Fecha, lugar y cupos son obligatorios.'); return }
    setSaving(true)
    const payload = { fecha: form.fecha, lugar: form.lugar, ciudad: form.ciudad || null,
      info_adicional: form.info_adicional || null, cupos_totales: Number(form.cupos_totales) }
    const { error: err } = cupo
      ? await supabase.from('cupos_producto').update(payload).eq('id', cupo.id)
      : await supabase.from('cupos_producto').insert({ ...payload, producto_id: productoId, cupos_vendidos: 0, activo: true })
    if (err) { setError(err.message); setSaving(false); return }
    onSave(); onClose()
  }

  return (
    <Modal title={cupo ? 'Editar Cupo / Sede' : 'Nueva Fecha y Sede'} onClose={onClose}>
      <Input label="Fecha del Pre-ICFES" value={form.fecha} onChange={v => set('fecha', v)} type="date" required />
      <Input label="Lugar / Sede" value={form.lugar} onChange={v => set('lugar', v)}
        placeholder="Ej: Sede Bogotá — Cra 7 #45-23" required />
      <Input label="Ciudad" value={form.ciudad} onChange={v => set('ciudad', v)} placeholder="Ej: Bogotá D.C." />
      <Input label="Cupos totales" value={form.cupos_totales} onChange={v => set('cupos_totales', v)}
        type="number" placeholder="Ej: 30" required />
      <Input label="Información adicional" value={form.info_adicional} onChange={v => set('info_adicional', v)}
        rows={2} placeholder="Qué deben traer, instrucciones adicionales..." />
      <ErrBox msg={error} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn outline color={C.gray} onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminTienda() {
  const [tab, setTab] = useState('productos')
  const mobile = useMobile()

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.navy }}>
              Tienda Virtual
            </div>
            <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
              Administra productos, órdenes, descuentos y disponibilidad
            </div>
          </div>
          <a href="https://tienda-miltonochoa.vercel.app" target="_blank" rel="noopener" style={{
            fontSize: 12, color: C.green, textDecoration: 'none', fontFamily: 'Inter',
            border: `1px solid ${C.green}`, padding: '6px 14px', borderRadius: 6,
          }}>
            Ver tienda →
          </a>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 20, overflowX: 'auto', flexWrap: mobile ? 'wrap' : 'nowrap' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 14px', border: 'none', borderRadius: 6,
              background: tab === t.id ? C.navy : C.bg2,
              color: tab === t.id ? C.white : C.gray,
              fontWeight: tab === t.id ? 600 : 400,
              fontSize: 12, cursor: 'pointer', fontFamily: 'Inter', whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>
      </Card>

      {/* Contenido del tab */}
      <Card>
        {tab === 'productos'      && <TabProductos />}
        {tab === 'ordenes'        && <TabOrdenes />}
        {tab === 'descuentos'     && <TabDescuentos />}
        {tab === 'docentes'       && <TabDocentes />}
        {tab === 'disponibilidad' && <TabDisponibilidad />}
        {tab === 'cupos'          && <TabCupos />}
      </Card>
    </div>
  )
}
