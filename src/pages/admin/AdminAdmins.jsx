import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { C, Card, Badge, useMobile } from '../../components/ui'

const Input = ({label, value, onChange, placeholder, type='text', required=false}) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ display:'block', fontSize:10, letterSpacing:'0.12em',
      textTransform:'uppercase', color:C.gray, marginBottom:6, fontFamily:'Inter' }}>
      {label}{required && <span style={{ color:C.red }}> *</span>}
    </label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} style={{ width:'100%', padding:'10px 14px',
        border:`1px solid ${C.grayLt}`, borderRadius:6, fontFamily:'Inter',
        fontSize:13, color:C.text, background:C.bg, outline:'none', boxSizing:'border-box' }} />
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
    opacity: disabled ? 0.6 : 1,
  }}>{children}</button>
)

const MODULOS_DISP = [
  { id:'colegios',    label:'Colegios',           icon:'🏫' },
  { id:'estudiantes', label:'Estudiantes',         icon:'👥' },
  { id:'pruebas',     label:'Pruebas',             icon:'📋' },
  { id:'resultados',  label:'Resultados',          icon:'📊' },
  { id:'ranking',     label:'Ranking',             icon:'🏆' },
  { id:'hojas',       label:'Hojas de Respuesta',  icon:'📝' },
  { id:'analisis',    label:'Análisis IA',         icon:'🤖' },
]

const ModalAdmin = ({admin, onClose, onSave}) => {
  const mobile = useMobile()
  const [form, setForm] = useState(admin || { nombre:'', usuario:'', password_hash:'' })
  // null = acceso total (superadmin); array = módulos seleccionados
  const [isSuperAdmin, setIsSuperAdmin] = useState(admin?.modulos === null || admin?.modulos === undefined)
  const [modulos, setModulos] = useState(admin?.modulos || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const toggleMod = (id) =>
    setModulos(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])

  const handleSave = async () => {
    if (!form.nombre || !form.usuario || (!admin && !form.password_hash)) {
      setError('Todos los campos son obligatorios.'); return
    }
    if (!isSuperAdmin && modulos.length === 0) {
      setError('Selecciona al menos un módulo.'); return
    }
    setSaving(true)
    try {
      let pwdField = {}
      if (form.password_hash) {
        const { data: hashed } = await supabase.rpc('hashear_password', { p_password: form.password_hash })
        pwdField = { password_hash: hashed }
      }
      const modulosPayload = isSuperAdmin ? null : modulos
      const payload = { nombre: form.nombre, usuario: form.usuario, modulos: modulosPayload, ...pwdField }
      const { error: err } = admin
        ? await supabase.from('administradores').update(payload).eq('id', admin.id)
        : await supabase.from('administradores').insert({ ...payload, activo: true })
      if (err) { setError(err.message); return }
      onSave(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:24 }}>
      <div style={{ background:C.white, borderRadius:12, padding:32,
        width:'100%', maxWidth:520, boxShadow:'0 20px 60px rgba(0,0,0,0.3)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:20, color:C.navy }}>
            {admin ? 'Editar Administrador' : 'Nuevo Administrador'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:C.gray }}>✕</button>
        </div>
        <Input label="Nombre completo" value={form.nombre} onChange={v=>set('nombre',v)}
          placeholder="Ej: María García" required/>
        <Input label="Usuario" value={form.usuario} onChange={v=>set('usuario',v)}
          placeholder="Ej: mgarcia" required/>
        <Input label={admin ? 'Nueva contraseña (dejar en blanco para no cambiar)' : 'Contraseña'}
          value={form.password_hash} onChange={v=>set('password_hash',v)}
          placeholder={admin ? 'Dejar en blanco para mantener la actual' : 'Contraseña de acceso'}
          required={!admin}/>

        {/* Módulos visibles */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase',
            color:C.gray, marginBottom:10, fontFamily:'Inter' }}>
            Acceso y módulos
          </div>

          {/* Toggle superadmin */}
          <label style={{ display:'flex', alignItems:'center', gap:10,
            padding:'10px 14px', borderRadius:8, cursor:'pointer', marginBottom:10,
            border: `1px solid ${isSuperAdmin ? C.navy : C.grayLt}`,
            background: isSuperAdmin ? `${C.navy}0E` : C.bg }}>
            <input type="checkbox" checked={isSuperAdmin} onChange={e => setIsSuperAdmin(e.target.checked)}
              style={{ accentColor: C.navy, width:16, height:16, cursor:'pointer' }} />
            <span style={{ fontSize:12, fontFamily:'Inter',
              color: isSuperAdmin ? C.navy : C.gray, fontWeight: isSuperAdmin ? 700 : 400 }}>
              👑 Superadmin — acceso total (todos los módulos + Administradores)
            </span>
          </label>

          {/* Módulos individuales — solo si no es superadmin */}
          {!isSuperAdmin && (
            <>
              <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap:8 }}>
                {MODULOS_DISP.map(m => {
                  const activo = modulos.includes(m.id)
                  return (
                    <label key={m.id} style={{ display:'flex', alignItems:'center', gap:10,
                      padding:'10px 14px', borderRadius:8, cursor:'pointer',
                      border: `1px solid ${activo ? C.green : C.grayLt}`,
                      background: activo ? C.green + '0E' : C.bg,
                      transition:'all 0.15s' }}>
                      <input type="checkbox" checked={activo} onChange={() => toggleMod(m.id)}
                        style={{ accentColor: C.green, width:16, height:16, cursor:'pointer' }} />
                      <span style={{ fontSize:12, fontFamily:'Inter',
                        color: activo ? C.navy : C.gray, fontWeight: activo ? 600 : 400 }}>
                        {m.icon} {m.label}
                      </span>
                    </label>
                  )
                })}
              </div>
              <div style={{ marginTop:8, display:'flex', justifyContent:'flex-end', gap:8 }}>
                <button onClick={() => setModulos(MODULOS_DISP.map(m=>m.id))}
                  style={{ fontSize:11, color:C.green, background:'none', border:'none', cursor:'pointer', fontFamily:'Inter' }}>
                  Seleccionar todos
                </button>
                <span style={{ color:C.grayLt }}>·</span>
                <button onClick={() => setModulos([])}
                  style={{ fontSize:11, color:C.red, background:'none', border:'none', cursor:'pointer', fontFamily:'Inter' }}>
                  Limpiar
                </button>
              </div>
            </>
          )}
        </div>

        {error && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA',
          borderRadius:6, padding:'10px 14px', marginBottom:16,
          fontSize:13, color:C.red, fontFamily:'Inter' }}>{error}</div>}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
          <Btn onClick={onClose} outline color={C.gray}>Cancelar</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving?'Guardando...':'Guardar'}</Btn>
        </div>
      </div>
    </div>
  )
}

export default function AdminAdmins({ session }) {
  const mobile = useMobile()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [changePwd, setChangePwd] = useState({ show:false, newPwd:'', saving:false, msg:'' })

  useEffect(() => { loadAdmins() }, [])

  const loadAdmins = async () => {
    setLoading(true)
    const { data } = await supabase.from('administradores').select('id, nombre, usuario, activo, ultima_sesion, modulos').order('nombre')
    setAdmins(data || [])
    setLoading(false)
  }

  const handleToggle = async (a) => {
    if (a.id === session.id) { alert('No puedes desactivar tu propio usuario.'); return }
    await supabase.from('administradores').update({ activo: !a.activo }).eq('id', a.id)
    loadAdmins()
  }

  const handleChangePwd = async () => {
    if (!changePwd.newPwd) return
    setChangePwd(p => ({...p, saving:true}))
    const { data: hashed } = await supabase.rpc('hashear_password', { p_password: changePwd.newPwd })
    await supabase.from('administradores').update({ password_hash: hashed }).eq('id', session.id)
    setChangePwd({ show:false, newPwd:'', saving:false, msg:'✅ Contraseña actualizada.' })
    setTimeout(() => setChangePwd(p => ({...p, msg:''})), 3000)
  }

  return (
    <div style={{ display:'grid', gap:20 }}>

      {/* Mi cuenta */}
      <Card>
        <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
          textTransform:'uppercase', marginBottom:16, paddingBottom:12,
          borderBottom:`1px solid ${C.bg2}` }}>Mi Cuenta</div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontSize:16, fontFamily:'Playfair Display, serif', color:C.navy }}>{session?.nombre}</div>
            <div style={{ fontSize:12, color:C.gray, fontFamily:'Inter', marginTop:2 }}>
              Usuario: <strong>{session?.usuario}</strong>
            </div>
          </div>
          <Btn onClick={() => setChangePwd(p=>({...p, show:!p.show}))} outline color={C.navy}>
            Cambiar contraseña
          </Btn>
        </div>
        {changePwd.show && (
          <div style={{ marginTop:16, display:'flex', gap:10, alignItems:'flex-end' }}>
            <div style={{ flex:1 }}>
              <Input label="Nueva contraseña" value={changePwd.newPwd}
                onChange={v => setChangePwd(p=>({...p, newPwd:v}))}
                placeholder="Nueva contraseña" type="password"/>
            </div>
            <div style={{ marginBottom:16 }}>
              <Btn onClick={handleChangePwd} disabled={changePwd.saving} color={C.green}>
                {changePwd.saving ? 'Guardando...' : 'Actualizar'}
              </Btn>
            </div>
          </div>
        )}
        {changePwd.msg && (
          <div style={{ marginTop:8, fontSize:13, color:C.green, fontFamily:'Inter' }}>{changePwd.msg}</div>
        )}
      </Card>

      {/* Lista admins */}
      <Card>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
            textTransform:'uppercase' }}>Administradores del Sistema</div>
          <Btn onClick={() => setModal('new')} color={C.green}>+ Nuevo Admin</Btn>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:30, color:C.gray, fontFamily:'Inter' }}>Cargando...</div>
        ) : (
          <div style={{overflowX:'auto'}}><table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter', minWidth:420 }}>
            <thead>
              <tr style={{ borderBottom:`2px solid ${C.bg2}` }}>
                {['Nombre','Usuario','Última sesión','Estado','Acciones'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontSize:10,
                    color:C.gray, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.map((a,i) => (
                <tr key={i} style={{ borderBottom:`1px solid ${C.bg2}`,
                  background:a.id===session.id?`${C.green}08`:i%2===0?`${C.bg}80`:'transparent' }}>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{a.nombre}</div>
                    {a.id===session.id && <Badge color={C.green}>Tú</Badge>}
                  </td>
                  <td style={{ padding:'10px 12px', fontSize:12, color:C.navy, fontWeight:500 }}>{a.usuario}</td>
                  <td style={{ padding:'10px 12px', fontSize:11, color:C.gray }}>
                    {a.ultima_sesion ? new Date(a.ultima_sesion).toLocaleString('es-CO', {timeZone:'America/Bogota'}) : '—'}
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <Badge color={a.activo?C.green:C.red}>{a.activo?'Activo':'Inactivo'}</Badge>
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <Btn onClick={() => setModal(a)} small outline color={C.navy}>Editar</Btn>
                      {a.id !== session.id && (
                        <Btn onClick={() => handleToggle(a)} small outline
                          color={a.activo?C.red:C.green}>
                          {a.activo?'Desactivar':'Activar'}
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>

      {modal && (
        <ModalAdmin
          admin={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={loadAdmins}
        />
      )}
    </div>
  )
}
