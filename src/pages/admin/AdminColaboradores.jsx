import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { C } from '../../components/ui'

const ROLES = ['Coordinador', 'Asesor', 'Digitador', 'Soporte', 'Otro']

const Th = ({ children, center }) => (
  <th style={{
    padding: '9px 14px', fontSize: 10, fontWeight: 600, color: C.gray,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: `2px solid ${C.bg2}`, textAlign: center ? 'center' : 'left',
    background: C.white, position: 'sticky', top: 0, whiteSpace: 'nowrap',
  }}>{children}</th>
)

const Td = ({ children, center, style = {} }) => (
  <td style={{
    padding: '10px 14px', fontSize: 13, fontFamily: 'Inter',
    textAlign: center ? 'center' : 'left',
    borderBottom: `1px solid ${C.bg2}`, color: C.text, ...style,
  }}>{children}</td>
)

const Field = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: C.gray,
      textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter' }}>
      {label}
    </label>
    {children}
  </div>
)

const Input = ({ value, onChange, placeholder, type = 'text' }) => (
  <input type={type} value={value} onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    style={{ padding: '9px 12px', border: `1px solid ${C.grayLt}`, borderRadius: 7,
      fontFamily: 'Inter', fontSize: 13, outline: 'none', color: C.text,
      background: C.white }} />
)

const EMPTY = { nombre: '', apellido: '', email: '', telefono: '', rol: '', activo: true }

export default function AdminColaboradores() {
  const [lista, setLista]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState(EMPTY)
  const [editId, setEditId]     = useState(null)
  const [saving, setSaving]     = useState(false)
  const [buscar, setBuscar]     = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [modal, setModal]       = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('colaboradores')
      .select('*')
      .order('apellido', { ascending: true })
    setLista(data || [])
    setLoading(false)
  }

  const abrirNuevo = () => {
    setForm(EMPTY)
    setEditId(null)
    setError('')
    setModal(true)
  }

  const abrirEditar = (c) => {
    setForm({ nombre: c.nombre, apellido: c.apellido, email: c.email || '',
      telefono: c.telefono || '', rol: c.rol || '', activo: c.activo ?? true })
    setEditId(c.id)
    setError('')
    setModal(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim() || !form.apellido.trim()) {
      setError('Nombre y apellido son obligatorios.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      nombre: form.nombre.trim(), apellido: form.apellido.trim(),
      email: form.email.trim() || null, telefono: form.telefono.trim() || null,
      rol: form.rol || null, activo: form.activo,
    }
    if (editId) {
      await supabase.from('colaboradores').update(payload).eq('id', editId)
    } else {
      await supabase.from('colaboradores').insert(payload)
    }
    setSaving(false)
    setModal(false)
    cargar()
  }

  const toggleActivo = async (c) => {
    await supabase.from('colaboradores').update({ activo: !c.activo }).eq('id', c.id)
    cargar()
  }

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }))

  const filtrados = lista.filter(c => {
    const texto = buscar.toLowerCase()
    const coincide = !texto || `${c.nombre} ${c.apellido} ${c.email || ''}`.toLowerCase().includes(texto)
    const rol = !filtroRol || c.rol === filtroRol
    return coincide && rol
  })

  const activos   = lista.filter(c => c.activo).length
  const inactivos = lista.filter(c => !c.activo).length

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total colaboradores', value: lista.length, icon: '👥' },
          { label: 'Activos',             value: activos,       icon: '✅' },
          { label: 'Inactivos',           value: inactivos,     icon: '⏸' },
        ].map((k, i) => (
          <div key={i} style={{ background: C.white, borderRadius: 10, padding: '16px 20px',
            border: `1px solid ${C.grayLt}`, boxShadow: '0 1px 4px rgba(10,31,61,0.05)' }}>
            <div style={{ fontSize: 9, color: C.gray, fontFamily: 'Inter',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontFamily: 'Playfair Display, serif', color: C.navy, fontWeight: 600 }}>
              {k.icon} {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Barra de acciones */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={buscar} onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar colaborador..."
          style={{ padding: '8px 14px', border: `1px solid ${C.grayLt}`, borderRadius: 7,
            fontFamily: 'Inter', fontSize: 13, outline: 'none', flex: 1, minWidth: 200 }} />
        <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}
          style={{ padding: '8px 12px', border: `1px solid ${C.grayLt}`, borderRadius: 7,
            fontFamily: 'Inter', fontSize: 12, color: filtroRol ? C.text : C.gray,
            background: C.white, outline: 'none', cursor: 'pointer' }}>
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={abrirNuevo} style={{
          padding: '8px 20px', background: C.navy, color: C.white, border: 'none',
          borderRadius: 7, fontFamily: 'Inter', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}>+ Nuevo colaborador</button>
      </div>

      {/* Tabla */}
      <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.grayLt}`,
        overflow: 'hidden', boxShadow: '0 1px 4px rgba(10,31,61,0.05)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.gray, fontFamily: 'Inter' }}>
            Cargando colaboradores...
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.gray, fontFamily: 'Inter' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
            {lista.length === 0 ? 'Aún no hay colaboradores registrados.' : 'No se encontraron resultados.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter' }}>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Email</Th>
                  <Th>Teléfono</Th>
                  <Th center>Rol</Th>
                  <Th center>Estado</Th>
                  <Th center>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c, i) => (
                  <tr key={c.id} style={{
                    background: i % 2 === 0 ? C.bg : 'transparent',
                    borderBottom: `1px solid ${C.bg2}`,
                    opacity: c.activo ? 1 : 0.55,
                  }}>
                    <Td>
                      <div style={{ fontWeight: 600, color: C.navy }}>{c.apellido}, {c.nombre}</div>
                    </Td>
                    <Td style={{ color: C.gray, fontSize: 12 }}>{c.email || '—'}</Td>
                    <Td style={{ color: C.gray, fontSize: 12 }}>{c.telefono || '—'}</Td>
                    <Td center>
                      {c.rol ? (
                        <span style={{ background: C.navy + '12', color: C.navy,
                          padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                          {c.rol}
                        </span>
                      ) : <span style={{ color: C.grayLt }}>—</span>}
                    </Td>
                    <Td center>
                      <span style={{
                        background: c.activo ? C.green + '18' : C.gray + '20',
                        color: c.activo ? C.green : C.gray,
                        padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      }}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </Td>
                    <Td center>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button onClick={() => abrirEditar(c)} style={{
                          padding: '5px 12px', border: `1px solid ${C.grayLt}`, borderRadius: 6,
                          background: C.white, color: C.navy, fontFamily: 'Inter',
                          fontSize: 11, cursor: 'pointer', fontWeight: 500,
                        }}>Editar</button>
                        <button onClick={() => toggleActivo(c)} style={{
                          padding: '5px 12px', border: `1px solid ${c.activo ? C.amber : C.green}`,
                          borderRadius: 6, background: 'transparent',
                          color: c.activo ? C.amber : C.green,
                          fontFamily: 'Inter', fontSize: 11, cursor: 'pointer', fontWeight: 500,
                        }}>{c.activo ? 'Desactivar' : 'Activar'}</button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,31,61,0.5)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 14, width: '100%', maxWidth: 520,
            boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ background: C.navy, padding: '18px 24px', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, color: C.white, fontFamily: 'Playfair Display, serif', fontWeight: 600 }}>
                {editId ? 'Editar colaborador' : 'Nuevo colaborador'}
              </div>
              <button onClick={() => setModal(false)} style={{ background: 'rgba(255,255,255,0.1)',
                border: 'none', color: C.white, fontSize: 18, width: 32, height: 32,
                borderRadius: 7, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Nombre *">
                  <Input value={form.nombre} onChange={set('nombre')} placeholder="Nombre" />
                </Field>
                <Field label="Apellido *">
                  <Input value={form.apellido} onChange={set('apellido')} placeholder="Apellido" />
                </Field>
              </div>
              <Field label="Email">
                <Input value={form.email} onChange={set('email')} placeholder="correo@email.com" type="email" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Teléfono">
                  <Input value={form.telefono} onChange={set('telefono')} placeholder="300 000 0000" />
                </Field>
                <Field label="Rol">
                  <select value={form.rol} onChange={e => set('rol')(e.target.value)}
                    style={{ padding: '9px 12px', border: `1px solid ${C.grayLt}`, borderRadius: 7,
                      fontFamily: 'Inter', fontSize: 13, color: form.rol ? C.text : C.gray,
                      background: C.white, outline: 'none' }}>
                    <option value="">Sin rol</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Estado">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'Inter', fontSize: 13, color: C.text }}>
                  <input type="checkbox" checked={form.activo}
                    onChange={e => set('activo')(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: C.green }} />
                  Colaborador activo
                </label>
              </Field>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7,
                  padding: '10px 14px', color: '#DC2626', fontFamily: 'Inter', fontSize: 13 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setModal(false)} style={{
                  padding: '9px 20px', border: `1px solid ${C.grayLt}`, borderRadius: 7,
                  background: C.white, color: C.gray, fontFamily: 'Inter', fontSize: 13, cursor: 'pointer',
                }}>Cancelar</button>
                <button onClick={guardar} disabled={saving} style={{
                  padding: '9px 24px', background: C.navy, color: C.white, border: 'none',
                  borderRadius: 7, fontFamily: 'Inter', fontSize: 13, fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                }}>{saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear colaborador'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
