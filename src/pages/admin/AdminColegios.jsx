import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { C } from '../../components/ui'
import { generateCredentials } from '../../lib/utils'
import { COLOMBIA } from '../../lib/colombia'
import * as XLSX from 'xlsx'

const DEPARTAMENTOS = Object.keys(COLOMBIA).sort()

const CALENDARIO_OPTIONS = ['A', 'B']
const NATURALEZA_OPTIONS  = ['Oficial', 'Privada', 'Concesión']
const JORNADA_OPTIONS     = ['Mañana', 'Tarde', 'Noche', 'Completa / Única', 'Sabatino']

const Card = ({children, style={}}) => (
  <div style={{ background:C.white, borderRadius:12, padding:24,
    boxShadow:'0 1px 4px rgba(10,31,61,0.07), 0 4px 16px rgba(10,31,61,0.05)',
    border:`1px solid ${C.grayLt}`, ...style }}>{children}</div>
)

const Input = ({label, value, onChange, placeholder, type='text', required=false}) => (
  <div style={{ marginBottom:14 }}>
    <label style={{ display:'block', fontSize:10, letterSpacing:'0.12em',
      textTransform:'uppercase', color:C.gray, marginBottom:5, fontFamily:'Inter' }}>
      {label}{required && <span style={{ color:C.red }}> *</span>}
    </label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} required={required}
      style={{ width:'100%', padding:'9px 13px', border:`1px solid ${C.grayLt}`,
        borderRadius:6, fontFamily:'Inter', fontSize:13, color:C.text,
        background:C.bg, outline:'none', boxSizing:'border-box' }} />
  </div>
)

const Select = ({label, value, onChange, options, required=false, placeholder='Seleccionar...'}) => (
  <div style={{ marginBottom:14 }}>
    <label style={{ display:'block', fontSize:10, letterSpacing:'0.12em',
      textTransform:'uppercase', color:C.gray, marginBottom:5, fontFamily:'Inter' }}>
      {label}{required && <span style={{ color:C.red }}> *</span>}
    </label>
    <select value={value} onChange={e=>onChange(e.target.value)} required={required}
      style={{ width:'100%', padding:'9px 13px', border:`1px solid ${C.grayLt}`,
        borderRadius:6, fontFamily:'Inter', fontSize:13, color: value ? C.text : C.gray,
        background:C.bg, outline:'none', boxSizing:'border-box', cursor:'pointer' }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
)

const Btn = ({children, onClick, color=C.navy, outline=false, small=false, disabled=false}) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: small ? '5px 12px' : '10px 20px',
    background: outline ? 'transparent' : color,
    color: outline ? color : C.white,
    border: `1px solid ${color}`, borderRadius:6,
    fontFamily:'Inter', fontSize:11, fontWeight:600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1, letterSpacing:'0.04em', whiteSpace:'nowrap',
  }}>{children}</button>
)

const Badge = ({children, color}) => (
  <span style={{ background:color+'18', color, border:`1px solid ${color}40`,
    padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:500 }}>{children}</span>
)

const SectionTitle = ({children}) => (
  <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
    textTransform:'uppercase', marginBottom:14, paddingBottom:8,
    borderBottom:`1px solid ${C.bg2}` }}>{children}</div>
)

// ── GENERAR USUARIO ───────────────────────────────────────────
const generarUsuario = async (departamento, municipio) => {
  const dep = departamento.normalize('NFD').replace(/[\u0300-\u036f]/g,'').substring(0,2).toUpperCase()
  const mun = municipio.normalize('NFD').replace(/[\u0300-\u036f]/g,'').substring(0,2).toUpperCase()
  const prefijo = dep + mun
  const { data } = await supabase.from('colegios').select('usuario').like('usuario', `${prefijo}%`)
  const siguiente = (data?.length || 0) + 1
  return `${prefijo}${String(siguiente).padStart(4,'0')}`
}

// ── MODAL COLEGIO ─────────────────────────────────────────────
const ModalColegio = ({ colegio, onClose, onSave }) => {
  const [form, setForm] = useState({
    nombre:'', departamento_nombre:'', municipio:'', direccion:'', barrio:'',
    calendario:'', naturaleza:'', jornada:'',
    contactos:[{nombre:'', cargo:'', telefono:'', email:''}],
    usuario:'', password_hash:'', password_plain:'',
    ...(colegio || {}),
    password_hash: '',  // nunca prellenar con el hash bcrypt del DB
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [generando, setGenerando] = useState(false)

  const municipios = form.departamento_nombre ? COLOMBIA[form.departamento_nombre] || [] : []
  const set = (key, val) => setForm(f => ({...f, [key]:val}))

  const handleDeptoChange = (dep) => {
    setForm(f => ({...f, departamento_nombre:dep, municipio:'', usuario:'', password_hash:''}))
  }

  const handleMuniChange = async (mun) => {
    setForm(f => ({...f, municipio:mun}))
    if (!colegio && mun && form.departamento_nombre) {
      setGenerando(true)
      const user = await generarUsuario(form.departamento_nombre, mun)
      setForm(f => ({...f, municipio:mun, usuario:user, password_hash:user, password_plain:user}))
      setGenerando(false)
    }
  }

  const addContacto = () => setForm(f => ({...f, contactos:[...(f.contactos||[]), {nombre:'',cargo:'',telefono:'',email:''}]}))
  const removeContacto = (i) => setForm(f => ({...f, contactos:f.contactos.filter((_,idx)=>idx!==i)}))
  const updateContacto = (i, key, val) => setForm(f => ({...f,
    contactos:f.contactos.map((c,idx)=>idx===i?{...c,[key]:val}:c)
  }))

  const validate = () => {
    if (!form.nombre) return 'Nombre del colegio es obligatorio.'
    if (!form.departamento_nombre) return 'Departamento es obligatorio.'
    if (!form.municipio) return 'Municipio es obligatorio.'
    if (!form.direccion) return 'Dirección es obligatoria.'
    if (!form.barrio) return 'Barrio es obligatorio.'
    const c = form.contactos?.[0]
    if (!c?.nombre) return 'Nombre del contacto principal es obligatorio.'
    if (!c?.cargo) return 'Cargo del contacto principal es obligatorio.'
    if (!c?.telefono) return 'Teléfono del contacto principal es obligatorio.'
    if (!c?.email) return 'Correo del contacto principal es obligatorio.'
    if (!form.usuario) return 'Usuario es obligatorio.'
    if (!colegio && !form.password_hash) return 'Contraseña es obligatoria.'
    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)
    try {
      let hashedPassword
      if (form.password_hash) {
        const { data: hashed } = await supabase.rpc('hashear_password', { p_password: form.password_hash })
        hashedPassword = hashed
      }
      const payload = {
        nombre: form.nombre,
        departamento_nombre: form.departamento_nombre,
        municipio: form.municipio,
        ciudad: `${form.municipio}, ${form.departamento_nombre}`,
        direccion: form.direccion,
        barrio: form.barrio,
        calendario: form.calendario || null,
        naturaleza: form.naturaleza || null,
        jornada: form.jornada || null,
        contactos: form.contactos,
        contacto_nombre: form.contactos?.[0]?.nombre,
        contacto_telefono: form.contactos?.[0]?.telefono,
        contacto_email: form.contactos?.[0]?.email,
        usuario: form.usuario,
        ...(hashedPassword ? { password_hash: hashedPassword, password_plain: form.password_hash } : {}),
        ...(!colegio ? { activo: false } : {}),
      }
      const { error: err } = colegio
        ? await supabase.from('colegios').update(payload).eq('id', colegio.id)
        : await supabase.from('colegios').insert(payload)
      if (err) { setError(err.message); return }
      onSave(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:24 }}>
      <div style={{ background:C.white, borderRadius:12, padding:32,
        width:'100%', maxWidth:680, maxHeight:'92vh', overflowY:'auto',
        boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:22, color:C.navy }}>
            {colegio ? 'Editar Colegio' : 'Nuevo Colegio'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:C.gray }}>✕</button>
        </div>

        <SectionTitle>Datos de la Institución</SectionTitle>
        <Input label="Nombre del colegio" value={form.nombre} onChange={v=>set('nombre',v)}
          placeholder="Nombre completo de la institución" required/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Select label="Departamento" value={form.departamento_nombre}
            onChange={handleDeptoChange} options={DEPARTAMENTOS}
            placeholder="Seleccionar departamento..." required/>
          <Select label="Municipio" value={form.municipio} onChange={handleMuniChange}
            options={municipios}
            placeholder={form.departamento_nombre?'Seleccionar municipio...':'Primero selecciona departamento'}
            required/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Dirección" value={form.direccion} onChange={v=>set('direccion',v)}
            placeholder="Ej: Calle 53 No 31-128" required/>
          <Input label="Barrio" value={form.barrio} onChange={v=>set('barrio',v)}
            placeholder="Ej: Campestre" required/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
          <Select label="Calendario" value={form.calendario} onChange={v=>set('calendario',v)}
            options={CALENDARIO_OPTIONS} placeholder="Seleccionar..."/>
          <Select label="Naturaleza" value={form.naturaleza} onChange={v=>set('naturaleza',v)}
            options={NATURALEZA_OPTIONS} placeholder="Seleccionar..."/>
          <Select label="Jornada" value={form.jornada} onChange={v=>set('jornada',v)}
            options={JORNADA_OPTIONS} placeholder="Seleccionar..."/>
        </div>

        <SectionTitle>Contactos</SectionTitle>
        {(form.contactos||[]).map((c,i) => (
          <div key={i} style={{ background:C.bg, borderRadius:8, padding:16,
            marginBottom:12, border:`1px solid ${C.bg2}`, position:'relative' }}>
            <div style={{ fontSize:11, color:C.navy, fontWeight:600, fontFamily:'Inter', marginBottom:12 }}>
              {i===0?'Contacto Principal':`Contacto ${i+1}`}
            </div>
            {i>0 && (
              <button onClick={()=>removeContacto(i)} style={{ position:'absolute', top:12, right:12,
                background:'none', border:'none', color:C.red, cursor:'pointer', fontSize:16 }}>✕</button>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Input label="Nombre completo" value={c.nombre} onChange={v=>updateContacto(i,'nombre',v)}
                placeholder="Ej: Carlos Andrade" required={i===0}/>
              <Input label="Cargo" value={c.cargo} onChange={v=>updateContacto(i,'cargo',v)}
                placeholder="Ej: Rector" required={i===0}/>
              <Input label="Teléfono" value={c.telefono} onChange={v=>updateContacto(i,'telefono',v)}
                placeholder="Ej: 3001234567" required={i===0}/>
              <Input label="Correo electrónico" value={c.email} onChange={v=>updateContacto(i,'email',v)}
                placeholder="Ej: rector@colegio.edu.co" type="email" required={i===0}/>
            </div>
          </div>
        ))}
        <button onClick={addContacto} style={{ display:'flex', alignItems:'center', gap:6,
          background:'none', border:`1px dashed ${C.green}`, color:C.green,
          padding:'8px 16px', borderRadius:6, cursor:'pointer', fontFamily:'Inter', fontSize:12, marginBottom:20 }}>
          + Agregar otro contacto
        </button>

        <SectionTitle>Credenciales de Acceso</SectionTitle>
        <div style={{ background:'#FFF9EB', border:'1px solid #FDE68A', borderRadius:8,
          padding:'10px 14px', marginBottom:14, fontFamily:'Inter', fontSize:12, color:'#92400E' }}>
          💡 Las credenciales se generan automáticamente al seleccionar departamento y municipio.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Usuario (generado automáticamente)" value={generando?'Generando...':form.usuario}
            onChange={v=>set('usuario',v)} placeholder="Se genera al seleccionar municipio" required/>
          <Input label={colegio ? 'Nueva contraseña (dejar en blanco para no cambiar)' : 'Contraseña inicial'}
            value={form.password_hash}
            onChange={v=>set('password_hash',v)}
            placeholder={colegio ? 'Dejar en blanco para mantener la actual' : 'Contraseña inicial'}
            required={!colegio}/>
        </div>

        {error && (
          <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:6,
            padding:'10px 14px', marginBottom:16, fontSize:13, color:C.red, fontFamily:'Inter' }}>{error}</div>
        )}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
          <Btn onClick={onClose} outline color={C.gray}>Cancelar</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving?'Guardando...':'Guardar Colegio'}</Btn>
        </div>
      </div>
    </div>
  )
}

// ── MODAL ESTUDIANTES ─────────────────────────────────────────
const ModalEstudiantes = ({ colegio, onClose, onSave }) => {
  const [mode, setMode] = useState('lista')
  const [estudiantes, setEstudiantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState([])
  const [msg, setMsg] = useState('')
  const [editando, setEditando] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [copiadoEst, setCopiadoEst] = useState(null)
  const fileRef = useRef()

  const handleCopiarEst = (id, texto) => {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiadoEst(id)
      setTimeout(() => setCopiadoEst(null), 1500)
    })
  }

  useEffect(() => { loadEstudiantes() }, [])

  const loadEstudiantes = async () => {
    setLoading(true)
    const { data } = await supabase.from('estudiantes')
      .select('*').eq('colegio_id', colegio.id).order('nombre')
    setEstudiantes(data || [])
    setLoading(false)
  }

  const startEdit = (e) => {
    setEditando(e.id)
    setEditForm({ nombre:e.nombre, grado:e.grado, salon:e.salon,
      usuario:e.usuario, password_hash:'' })
  }

  const cancelEdit = () => { setEditando(null); setEditForm({}) }

  const saveEdit = async (id) => {
    let pwdField = {}
    if (editForm.password_hash) {
      const { data: hashed } = await supabase.rpc('hashear_password', { p_password: editForm.password_hash })
      pwdField = { password_hash: hashed }
    }
    const { error } = await supabase.from('estudiantes').update({
      nombre: editForm.nombre, grado: editForm.grado, salon: editForm.salon,
      usuario: editForm.usuario, ...pwdField,
    }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    setEditando(null)
    setMsg('✅ Estudiante actualizado correctamente.')
    await loadEstudiantes(); onSave()
  }

  const handleToggle = async (e) => {
    await supabase.from('estudiantes').update({ activo: !e.activo }).eq('id', e.id)
    await loadEstudiantes()
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este estudiante?')) return
    await supabase.from('estudiantes').delete().eq('id', id)
    await loadEstudiantes(); onSave()
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type:'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header:1 })
      const data = rows.slice(1).filter(r=>r[0]).map(r => ({
        nombre: String(r[0]||'').trim(), documento: String(r[1]||'').trim(),
        grado: String(r[2]||'').trim(), salon: String(r[3]||'').trim(),
      }))
      setPreview(data); setMode('preview')
    }
    reader.readAsArrayBuffer(file)
  }

  const handleUpload = async () => {
    if (!preview.length) return
    setUploading(true); setMsg('')
    let creados=0, omitidos=0
    for (const row of preview) {
      const { usuario, password } = generateCredentials(row.nombre, row.documento)
      const { data: hashed } = await supabase.rpc('hashear_password', { p_password: password })
      const { error } = await supabase.from('estudiantes').insert({
        colegio_id: colegio.id, nombre: row.nombre,
        grado: row.grado, salon: row.salon,
        usuario, password_hash: hashed, activo: true,
      })
      if (error) omitidos++; else creados++
    }
    setMsg(`✅ ${creados} estudiantes creados.${omitidos>0?` ${omitidos} omitidos.`:''}`)
    await loadEstudiantes(); setMode('lista'); onSave(); setUploading(false)
  }

  const downloadPlantilla = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nombre Completo','Número de Documento','Grado','Salón'],
      ['Juan Pablo García López','1098765432','11','1'],
      ['Ana Sofía Martínez Ruiz','1087654321','11','2'],
    ])
    ws['!cols'] = [{wch:35},{wch:20},{wch:10},{wch:10}]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes')
    XLSX.writeFile(wb, 'plantilla_estudiantes.xlsx')
  }

  const inStyle = {
    padding:'4px 8px', border:`1px solid ${C.grayLt}`, borderRadius:4,
    fontFamily:'Inter', fontSize:12, outline:'none', width:'100%',
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:24 }}>
      <div style={{ background:C.white, borderRadius:12, padding:32,
        width:'100%', maxWidth:900, maxHeight:'92vh', overflowY:'auto',
        boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div>
            <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:22, color:C.navy }}>
              Estudiantes — {colegio.nombre}
            </h2>
            <div style={{ fontSize:12, color:C.gray, fontFamily:'Inter', marginTop:2 }}>
              {estudiantes.length} estudiante{estudiantes.length!==1?'s':''} registrado{estudiantes.length!==1?'s':''}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:C.gray }}>✕</button>
        </div>

        {/* MODO LISTA */}
        {mode==='lista' && (
          <>
            <div style={{ display:'flex', gap:10, marginBottom:20 }}>
              <Btn onClick={()=>setMode('subir')} color={C.green}>+ Subir Excel</Btn>
              <Btn onClick={downloadPlantilla} outline color={C.navy}>↓ Plantilla</Btn>
            </div>
            {msg && (
              <div style={{ background:'#F0FFF4', border:'1px solid #BBF7D0', borderRadius:6,
                padding:'10px 14px', marginBottom:16, fontSize:13, color:C.green, fontFamily:'Inter' }}>{msg}</div>
            )}
            {loading ? (
              <div style={{ textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter' }}>Cargando...</div>
            ) : estudiantes.length===0 ? (
              <div style={{ textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter' }}>
                No hay estudiantes. Sube un Excel para comenzar.
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                  <thead>
                    <tr style={{ borderBottom:`2px solid ${C.bg2}` }}>
                      {['Nombre','Grado','Salón','Usuario','Contraseña','Estado','Acciones'].map(h=>(
                        <th key={h} style={{ textAlign:'left', padding:'8px 10px', fontSize:10,
                          color:C.gray, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em',
                          whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {estudiantes.map((e,i)=>(
                      <tr key={i} style={{ borderBottom:`1px solid ${C.bg2}`,
                        background: !e.activo?'#FEF2F2':i%2===0?`${C.bg}80`:'transparent' }}>
                        {editando===e.id ? (
                          <>
                            <td style={{ padding:'6px' }}>
                              <input value={editForm.nombre} onChange={ev=>setEditForm({...editForm,nombre:ev.target.value})} style={inStyle}/>
                            </td>
                            <td style={{ padding:'6px' }}>
                              <input value={editForm.grado} onChange={ev=>setEditForm({...editForm,grado:ev.target.value})} style={{...inStyle,width:48}}/>
                            </td>
                            <td style={{ padding:'6px' }}>
                              <input value={editForm.salon} onChange={ev=>setEditForm({...editForm,salon:ev.target.value})} style={{...inStyle,width:48}}/>
                            </td>
                            <td style={{ padding:'6px' }}>
                              <input value={editForm.usuario} onChange={ev=>setEditForm({...editForm,usuario:ev.target.value})} style={inStyle}/>
                            </td>
                            <td style={{ padding:'6px' }}>
                              <input type="password" value={editForm.password_hash} onChange={ev=>setEditForm({...editForm,password_hash:ev.target.value})} placeholder="Dejar vacío para no cambiar" style={inStyle}/>
                            </td>
                            <td style={{ padding:'6px' }}>
                              <Badge color={e.activo?C.green:C.red}>{e.activo?'Activo':'Inactivo'}</Badge>
                            </td>
                            <td style={{ padding:'6px' }}>
                              <div style={{ display:'flex', gap:4 }}>
                                <Btn onClick={()=>saveEdit(e.id)} small color={C.green}>Guardar</Btn>
                                <Btn onClick={cancelEdit} small outline color={C.gray}>Cancelar</Btn>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding:'10px', fontSize:13,
                              color:e.activo?C.text:C.gray, fontWeight:500,
                              textDecoration:e.activo?'none':'line-through' }}>{e.nombre}</td>
                            <td style={{ padding:'10px', fontSize:12, color:C.gray }}>{e.grado}</td>
                            <td style={{ padding:'10px', fontSize:12, color:C.gray }}>{e.salon}</td>
                            <td style={{ padding:'10px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <span style={{ fontFamily:'monospace', fontSize:12, color:C.navy,
                                  fontWeight:600 }}>{e.usuario}</span>
                                <button onClick={()=>handleCopiarEst(e.usuario + '_u', e.usuario)}
                                  title="Copiar usuario" style={{ background:'none', border:'none',
                                    cursor:'pointer', fontSize:14, padding:2,
                                    color: copiadoEst===e.usuario+'_u' ? C.green : C.gray }}>
                                  {copiadoEst===e.usuario+'_u' ? '✓' : '⧉'}
                                </button>
                              </div>
                            </td>
                            <td style={{ padding:'10px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <span style={{ fontFamily:'monospace', fontSize:12, color:C.text,
                                  background:C.bg, border:`1px solid ${C.grayLt}`,
                                  borderRadius:4, padding:'2px 8px', letterSpacing:'0.04em' }}>
                                  {generateCredentials(e.nombre, e.codigo || e.usuario).password}
                                </span>
                                <button onClick={()=>handleCopiarEst(e.id, generateCredentials(e.nombre, e.codigo || e.usuario).password)}
                                  title="Copiar clave" style={{ background:'none', border:'none',
                                    cursor:'pointer', fontSize:14, padding:2,
                                    color: copiadoEst===e.id ? C.green : C.gray }}>
                                  {copiadoEst===e.id ? '✓' : '⧉'}
                                </button>
                              </div>
                            </td>
                            <td style={{ padding:'10px' }}>
                              <Badge color={e.activo?C.green:C.red}>{e.activo?'Activo':'Inactivo'}</Badge>
                            </td>
                            <td style={{ padding:'10px' }}>
                              <div style={{ display:'flex', gap:4 }}>
                                <Btn onClick={()=>startEdit(e)} small outline color={C.navy}>Editar</Btn>
                                <Btn onClick={()=>handleToggle(e)} small outline color={e.activo?C.amber:C.green}>
                                  {e.activo?'Inactivar':'Activar'}
                                </Btn>
                                <Btn onClick={()=>handleDelete(e.id)} small outline color={C.red}>Eliminar</Btn>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* MODO SUBIR */}
        {mode==='subir' && (
          <div>
            <div style={{ background:C.bg2, borderRadius:8, padding:24, marginBottom:20,
              border:`2px dashed ${C.grayLt}`, textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📂</div>
              <div style={{ fontFamily:'Playfair Display, serif', fontSize:18, color:C.navy, marginBottom:6 }}>
                Sube el Excel de estudiantes
              </div>
              <div style={{ fontSize:12, color:C.gray, fontFamily:'Inter', marginBottom:16 }}>
                Columnas: Nombre Completo · Documento · Grado · Salón
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{display:'none'}}/>
              <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                <Btn onClick={()=>fileRef.current?.click()} color={C.green}>Seleccionar archivo</Btn>
                <Btn onClick={()=>setMode('lista')} outline color={C.gray}>Cancelar</Btn>
              </div>
            </div>
          </div>
        )}

        {/* MODO PREVIEW */}
        {mode==='preview' && (
          <div>
            <div style={{ fontFamily:'Inter', fontSize:13, color:C.navy, marginBottom:16, fontWeight:500 }}>
              Vista previa — {preview.length} estudiantes a importar
            </div>
            <div style={{ maxHeight:320, overflowY:'auto', marginBottom:16 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                <thead>
                  <tr style={{ borderBottom:`2px solid ${C.bg2}`, position:'sticky', top:0, background:C.white }}>
                    {['Nombre','Documento','Grado','Salón','Usuario','Contraseña'].map(h=>(
                      <th key={h} style={{ textAlign:'left', padding:'8px 10px', fontSize:10,
                        color:C.gray, fontWeight:600, textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((e,i)=>{
                    const creds = generateCredentials(e.nombre, e.documento)
                    return (
                      <tr key={i} style={{ borderBottom:`1px solid ${C.bg2}` }}>
                        <td style={{ padding:'8px 10px', fontSize:12, color:C.text }}>{e.nombre}</td>
                        <td style={{ padding:'8px 10px', fontSize:12, color:C.gray }}>{e.documento}</td>
                        <td style={{ padding:'8px 10px', fontSize:12, color:C.gray }}>{e.grado}</td>
                        <td style={{ padding:'8px 10px', fontSize:12, color:C.gray }}>{e.salon}</td>
                        <td style={{ padding:'8px 10px', fontSize:12, color:C.navy }}>{creds.usuario}</td>
                        <td style={{ padding:'8px 10px', fontSize:12, color:C.green }}>{creds.password}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <Btn onClick={()=>setMode('subir')} outline color={C.gray}>Volver</Btn>
              <Btn onClick={handleUpload} disabled={uploading} color={C.green}>
                {uploading?'Importando...':`Importar ${preview.length} estudiantes`}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MODAL IMPORTAR COLEGIOS DESDE EXCEL ──────────────────────
const ModalImportarColegios = ({ onClose, onSave }) => {
  const [mode, setMode]       = useState('subir')
  const [preview, setPreview] = useState([])
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg]         = useState('')
  const fileRef               = useRef()

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb   = XLSX.read(ev.target.result, { type:'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header:1 })
      const data = rows.slice(1).filter(r => r[0]).map(r => ({
        nombre:            String(r[0]  || '').trim(),
        departamento_nombre: String(r[1] || '').trim(),
        municipio:         String(r[2]  || '').trim(),
        direccion:         String(r[3]  || '').trim(),
        barrio:            String(r[4]  || '').trim(),
        calendario:        String(r[5]  || '').trim(),
        naturaleza:        String(r[6]  || '').trim(),
        jornada:           String(r[7]  || '').trim(),
        contacto_nombre:   String(r[8]  || '').trim(),
        contacto_cargo:    String(r[9]  || '').trim(),
        contacto_telefono: String(r[10] || '').trim(),
        contacto_email:    String(r[11] || '').trim(),
      }))
      setPreview(data); setMode('preview')
    }
    reader.readAsArrayBuffer(file)
  }

  const handleUpload = async () => {
    if (!preview.length) return
    setUploading(true); setMsg('')
    let creados = 0, omitidos = 0
    for (const row of preview) {
      if (!row.nombre || !row.departamento_nombre || !row.municipio) { omitidos++; continue }
      const usuario = await generarUsuario(row.departamento_nombre, row.municipio)
      const pwdRaw  = usuario.toLowerCase() + '*Mo2026'
      const { data: hashed } = await supabase.rpc('hashear_password', { p_password: pwdRaw })
      const { error } = await supabase.from('colegios').insert({
        nombre:              row.nombre,
        departamento_nombre: row.departamento_nombre,
        municipio:           row.municipio,
        ciudad:              `${row.municipio}, ${row.departamento_nombre}`,
        direccion:           row.direccion || '',
        barrio:              row.barrio    || '',
        calendario:          row.calendario || null,
        naturaleza:          row.naturaleza || null,
        jornada:             row.jornada   || null,
        contacto_nombre:     row.contacto_nombre   || '',
        contacto_telefono:   row.contacto_telefono || '',
        contacto_email:      row.contacto_email    || '',
        contactos: [{
          nombre:   row.contacto_nombre   || '',
          cargo:    row.contacto_cargo    || '',
          telefono: row.contacto_telefono || '',
          email:    row.contacto_email    || '',
        }],
        usuario,
        password_hash: hashed,
        password_plain: usuario,
        activo: false,
      })
      if (error) omitidos++; else creados++
    }
    setMsg(`✅ ${creados} colegios importados.${omitidos > 0 ? ` ${omitidos} omitidos (datos incompletos o duplicados).` : ''}`)
    setMode('lista'); onSave(); setUploading(false)
  }

  const downloadPlantilla = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nombre','Departamento','Municipio','Dirección','Barrio','Calendario','Naturaleza','Jornada','Contacto Nombre','Contacto Cargo','Contacto Teléfono','Contacto Email'],
      ['Colegio Ejemplo','Antioquia','Medellín','Calle 1 # 2-3','Centro','A','Oficial','Mañana','Juan Pérez','Rector','3001234567','rector@colegio.edu.co'],
    ])
    ws['!cols'] = Array(12).fill({wch:22})
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Colegios')
    XLSX.writeFile(wb, 'plantilla_colegios.xlsx')
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:24 }}>
      <div style={{ background:C.white, borderRadius:12, padding:32,
        width:'100%', maxWidth:900, maxHeight:'92vh', overflowY:'auto',
        boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div>
            <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:22, color:C.navy }}>
              Importar Colegios desde Excel
            </h2>
            <div style={{ fontSize:12, color:C.gray, fontFamily:'Inter', marginTop:2 }}>
              Todos los colegios se crearán en estado <strong>inactivo</strong>. Las credenciales se generan automáticamente.
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:C.gray }}>✕</button>
        </div>

        {mode === 'subir' && (
          <div>
            <div style={{ background:'#FFF9EB', border:'1px solid #FDE68A', borderRadius:8,
              padding:'10px 14px', marginBottom:20, fontFamily:'Inter', fontSize:12, color:'#92400E' }}>
              💡 Descarga la plantilla para ver el formato exacto de columnas esperado.
            </div>
            <div style={{ background:C.bg2, borderRadius:8, padding:32,
              border:`2px dashed ${C.grayLt}`, textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>📂</div>
              <div style={{ fontFamily:'Playfair Display, serif', fontSize:18, color:C.navy, marginBottom:6 }}>
                Selecciona el archivo Excel con los colegios
              </div>
              <div style={{ fontSize:12, color:C.gray, fontFamily:'Inter', marginBottom:16 }}>
                Columnas: Nombre · Departamento · Municipio · Dirección · Barrio · Calendario · Naturaleza · Jornada · Contacto (nombre, cargo, tel, email)
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{display:'none'}}/>
              <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                <Btn onClick={()=>fileRef.current?.click()} color={C.green}>Seleccionar archivo</Btn>
                <Btn onClick={downloadPlantilla} outline color={C.navy}>↓ Plantilla</Btn>
                <Btn onClick={onClose} outline color={C.gray}>Cancelar</Btn>
              </div>
            </div>
          </div>
        )}

        {mode === 'preview' && (
          <div>
            <div style={{ fontFamily:'Inter', fontSize:13, color:C.navy, marginBottom:16, fontWeight:500 }}>
              Vista previa — {preview.length} colegios a importar
            </div>
            <div style={{ maxHeight:380, overflowY:'auto', marginBottom:16, overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter', minWidth:900 }}>
                <thead>
                  <tr style={{ borderBottom:`2px solid ${C.bg2}`, position:'sticky', top:0, background:C.white }}>
                    {['Nombre','Departamento','Municipio','Calendario','Naturaleza','Jornada','Contacto'].map(h=>(
                      <th key={h} style={{ textAlign:'left', padding:'8px 10px', fontSize:10,
                        color:C.gray, fontWeight:600, textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r,i)=>(
                    <tr key={i} style={{ borderBottom:`1px solid ${C.bg2}` }}>
                      <td style={{ padding:'8px 10px', fontSize:12, color:C.text, fontWeight:500 }}>{r.nombre}</td>
                      <td style={{ padding:'8px 10px', fontSize:12, color:C.gray }}>{r.departamento_nombre}</td>
                      <td style={{ padding:'8px 10px', fontSize:12, color:C.gray }}>{r.municipio}</td>
                      <td style={{ padding:'8px 10px', fontSize:12, color:C.gray }}>{r.calendario||'—'}</td>
                      <td style={{ padding:'8px 10px', fontSize:12, color:C.gray }}>{r.naturaleza||'—'}</td>
                      <td style={{ padding:'8px 10px', fontSize:12, color:C.gray }}>{r.jornada||'—'}</td>
                      <td style={{ padding:'8px 10px', fontSize:12, color:C.gray }}>{r.contacto_nombre||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <Btn onClick={()=>setMode('subir')} outline color={C.gray}>Volver</Btn>
              <Btn onClick={handleUpload} disabled={uploading} color={C.green}>
                {uploading ? 'Importando...' : `Importar ${preview.length} colegios`}
              </Btn>
            </div>
          </div>
        )}

        {mode === 'lista' && msg && (
          <div style={{ background:'#F0FFF4', border:'1px solid #BBF7D0', borderRadius:8,
            padding:20, textAlign:'center', fontFamily:'Inter', fontSize:14, color:C.green }}>
            {msg}
            <div style={{ marginTop:16 }}><Btn onClick={onClose}>Cerrar</Btn></div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MODAL HISTÓRICOS ──────────────────────────────────────────
const ModalHistoricos = ({ colegio, onClose }) => {
  const [anios, setAnios]     = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')

  useEffect(() => { loadAnios() }, [])

  const loadAnios = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('colegio_anios')
      .select('*')
      .eq('colegio_id', colegio.id)
      .order('anio', { ascending: false })
    setAnios(data || [])
    setLoading(false)
  }

  const anioActivo = anios.find(a => a.activo)
  const anioActual = new Date().getFullYear()

  const handleIniciarAnio = async () => {
    if (anioActivo) {
      setMsg('⚠️ Ya existe un año activo. Ciérralo antes de iniciar uno nuevo.')
      return
    }
    setSaving(true); setMsg('')
    const { error } = await supabase.from('colegio_anios').insert({
      colegio_id:   colegio.id,
      anio:         anioActual,
      activo:       true,
      fecha_inicio: new Date().toISOString().split('T')[0],
    })
    if (error) setMsg('❌ Error: ' + error.message)
    else { setMsg(`✅ Año ${anioActual} iniciado correctamente.`); await loadAnios() }
    setSaving(false)
  }

  const handleCerrarAnio = async () => {
    if (!anioActivo) return
    if (!confirm(`¿Cerrar el año ${anioActivo.anio}? Los resultados quedarán archivados y podrás iniciar el siguiente año.`)) return
    setSaving(true); setMsg('')
    const { error } = await supabase.from('colegio_anios').update({
      activo:       false,
      fecha_cierre: new Date().toISOString().split('T')[0],
    }).eq('id', anioActivo.id)
    if (error) setMsg('❌ Error: ' + error.message)
    else { setMsg(`✅ Año ${anioActivo.anio} cerrado y archivado.`); await loadAnios() }
    setSaving(false)
  }

  const formatFecha = (f) => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' }) : '—'

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:24 }}>
      <div style={{ background:C.white, borderRadius:12, padding:32,
        width:'100%', maxWidth:620, maxHeight:'88vh', overflowY:'auto',
        boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:22, color:C.navy }}>
            Históricos
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:C.gray }}>✕</button>
        </div>
        <div style={{ fontSize:13, color:C.gray, fontFamily:'Inter', marginBottom:24 }}>
          {colegio.nombre}
        </div>

        {msg && (
          <div style={{ background: msg.startsWith('✅') ? '#F0FFF4' : '#FEF2F2',
            border:`1px solid ${msg.startsWith('✅') ? '#BBF7D0' : '#FECACA'}`,
            borderRadius:6, padding:'10px 14px', marginBottom:16, fontSize:13,
            color: msg.startsWith('✅') ? C.green : C.red, fontFamily:'Inter' }}>{msg}</div>
        )}

        {/* Acciones */}
        <div style={{ display:'flex', gap:10, marginBottom:24 }}>
          {!anioActivo && (
            <Btn onClick={handleIniciarAnio} disabled={saving} color={C.green}>
              + Iniciar año {anioActual}
            </Btn>
          )}
          {anioActivo && (
            <Btn onClick={handleCerrarAnio} disabled={saving} color={C.amber}>
              Cerrar y archivar año {anioActivo.anio}
            </Btn>
          )}
        </div>

        {/* Lista de años */}
        {loading ? (
          <div style={{ textAlign:'center', padding:32, color:C.gray, fontFamily:'Inter' }}>Cargando...</div>
        ) : anios.length === 0 ? (
          <div style={{ textAlign:'center', padding:32, color:C.gray, fontFamily:'Inter', background:C.bg, borderRadius:8 }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📅</div>
            <div style={{ fontSize:14, color:C.navy, fontFamily:'Playfair Display, serif', marginBottom:4 }}>Sin histórico registrado</div>
            <div style={{ fontSize:12 }}>Inicia el año {anioActual} para comenzar a registrar resultados.</div>
          </div>
        ) : (
          <div>
            <SectionTitle>Años registrados</SectionTitle>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {anios.map(a => (
                <div key={a.id} style={{
                  background: a.activo ? '#F0FFF4' : C.bg,
                  border:`1px solid ${a.activo ? '#BBF7D0' : C.grayLt}`,
                  borderRadius:8, padding:'14px 18px',
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontFamily:'Playfair Display, serif', fontSize:20, color:C.navy, fontWeight:700 }}>{a.anio}</span>
                      {a.activo && <Badge color={C.green}>Año activo</Badge>}
                      {!a.activo && <Badge color={C.gray}>Archivado</Badge>}
                    </div>
                    <div style={{ fontSize:12, color:C.gray, fontFamily:'Inter', marginTop:4 }}>
                      Inicio: {formatFecha(a.fecha_inicio)}
                      {a.fecha_cierre && <> · Cierre: {formatFecha(a.fecha_cierre)}</>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MENÚ ACCIONES DESPLEGABLE ─────────────────────────────────
const AccionesMenu = ({ onEditar, onEstudiantes, onHistoricos, onToggle, activo, onBorrarResultados, onEliminar }) => {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top:0, left:0 })
  const btnRef = useRef()

  useEffect(() => {
    const handleClick = () => setOpen(false)
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleOpen = (e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const menuH = 220
      const top = rect.bottom + menuH > window.innerHeight
        ? rect.top - menuH
        : rect.bottom + 4
      setPos({ top, left: rect.right - 180 })
    }
    setOpen(!open)
  }

  const items = [
    { label:'✏️ Editar',            onClick: onEditar,           color: C.text  },
    { label:'👥 Estudiantes',        onClick: onEstudiantes,      color: C.green },
    { label:'📅 Históricos',         onClick: onHistoricos,       color: C.navy  },
    { label: activo ? '🔴 Desactivar' : '🟢 Activar', onClick: onToggle, color: activo ? C.amber : C.green },
    { label:'🗑️ Borrar resultados',  onClick: onBorrarResultados, color: C.red   },
    { label:'❌ Eliminar colegio',   onClick: onEliminar,         color: C.red   },
  ]

  return (
    <>
      <button ref={btnRef} onClick={handleOpen} style={{
        padding:'6px 14px', background:C.navy, color:C.white,
        border:'none', borderRadius:6, fontFamily:'Inter', fontSize:11,
        fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6,
      }}>
        Acciones <span style={{ fontSize:10 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div onMouseDown={e=>e.stopPropagation()} style={{
          position:'fixed', top: pos.top, left: pos.left, zIndex:9999,
          background:C.white, borderRadius:8, boxShadow:'0 8px 32px rgba(0,0,0,0.18)',
          border:`1px solid ${C.grayLt}`, minWidth:180, overflow:'hidden',
        }}>
          {items.map((item, i) => (
            <button key={i} onClick={() => { item.onClick(); setOpen(false) }} style={{
              width:'100%', textAlign:'left', padding:'10px 16px',
              background:'transparent', border:'none',
              borderBottom: i < items.length-1 ? `1px solid ${C.bg2}` : 'none',
              fontFamily:'Inter', fontSize:12, color: item.color, cursor:'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.bg}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

const POR_PAG = 50

// ── MAIN ─────────────────────────────────────────────────────
export default function AdminColegios({ onUpdate }) {
  const [colegios, setColegios]         = useState([])
  const [total, setTotal]               = useState(0)
  const [pagina, setPagina]             = useState(1)
  const [loading, setLoading]           = useState(true)
  const [modalColegio, setModalColegio] = useState(null)
  const [modalEst, setModalEst]         = useState(null)
  const [modalImport, setModalImport]   = useState(false)
  const [modalHistorico, setModalHistorico] = useState(null)
  const [fNombre, setFNombre]           = useState('')
  const [fDepto, setFDepto]             = useState('')
  const [fMuni, setFMuni]               = useState('')
  const [fUser, setFUser]               = useState('')
  const [copiado, setCopiado]           = useState(null)
  const [tendencias, setTendencias]     = useState({})

  useEffect(() => { setPagina(1) }, [fNombre, fDepto, fMuni, fUser])
  useEffect(() => { loadColegios() }, [pagina, fNombre, fDepto, fMuni, fUser])

  const loadColegios = async () => {
    setLoading(true)
    const offset = (pagina - 1) * POR_PAG
    let q = supabase.from('colegios')
      .select('*', { count: 'exact' })
      .order('departamento_nombre', { ascending: true, nullsFirst: false })
      .order('municipio',           { ascending: true, nullsFirst: false })
      .order('nombre',              { ascending: true })
      .range(offset, offset + POR_PAG - 1)
    if (fNombre.trim()) q = q.ilike('nombre',              `%${fNombre.trim()}%`)
    if (fDepto.trim())  q = q.ilike('departamento_nombre', `%${fDepto.trim()}%`)
    if (fMuni.trim())   q = q.ilike('municipio',           `%${fMuni.trim()}%`)
    if (fUser.trim())   q = q.ilike('usuario',             `%${fUser.trim()}%`)
    const { data, count } = await q
    setColegios(data || [])
    setTotal(count || 0)
    setLoading(false)

    // Tendencia: cruzar por nombre+departamento+municipio (único combinado)
    // porque colegios.usuario != ranking_colegios.codigo (son códigos distintos)
    const nombres = (data || []).map(c => c.nombre).filter(Boolean)
    if (nombres.length > 0) {
      // 1. Año más reciente disponible para estos nombres
      const { data: maxAnioRow } = await supabase
        .from('ranking_colegios').select('anio')
        .in('nombre', nombres).order('anio', { ascending: false }).limit(1)
      const anioMax = maxAnioRow?.[0]?.anio
      if (anioMax) {
        // 2. Puestos del año actual y anterior, filtrando por los nombres de la página
        const [{ data: curr }, { data: prev }] = await Promise.all([
          supabase.from('ranking_colegios').select('nombre, departamento, ciudad, puesto_anio')
            .eq('anio', anioMax).in('nombre', nombres),
          supabase.from('ranking_colegios').select('nombre, departamento, ciudad, puesto_anio')
            .eq('anio', anioMax - 1).in('nombre', nombres),
        ])
        // Clave compuesta normalizada: nombre|departamento|ciudad
        const mk = (n, d, c) =>
          `${(n||'').trim().toUpperCase()}|${(d||'').trim().toUpperCase()}|${(c||'').trim().toUpperCase()}`
        const currMap = {}
        ;(curr || []).forEach(r => { currMap[mk(r.nombre, r.departamento, r.ciudad)] = r.puesto_anio })
        const prevMap = {}
        ;(prev || []).forEach(r => { prevMap[mk(r.nombre, r.departamento, r.ciudad)] = r.puesto_anio })
        const tend = {}
        ;(data || []).forEach(c => {
          const key = mk(c.nombre, c.departamento_nombre, c.municipio)
          const cp = currMap[key]; const pp = prevMap[key]
          if (cp == null || pp == null) { tend[c.id] = '—'; return }
          tend[c.id] = cp < pp ? '↑' : cp > pp ? '↓' : '→'
        })
        setTendencias(tend)
      } else {
        setTendencias({})
      }
    } else {
      setTendencias({})
    }
  }

  const handleSave = () => { loadColegios(); onUpdate() }

  const handleCopiar = (id, texto) => {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(id)
      setTimeout(() => setCopiado(null), 1500)
    })
  }

  const handleToggle = async (c) => {
    await supabase.from('colegios').update({ activo: !c.activo }).eq('id', c.id)
    loadColegios()
  }

  const handleDeleteResultados = async (c) => {
    if (!confirm(`¿Eliminar TODOS los resultados de "${c.nombre}"?\nEsto no se puede deshacer.`)) return
    try {
      const { data: ests } = await supabase.from('estudiantes').select('id').eq('colegio_id', c.id)
      const estIds = (ests||[]).map(e=>e.id)
      if (estIds.length) await supabase.from('notas_competencia').delete().in('estudiante_id', estIds)
      await supabase.from('comparativos_salon').delete().eq('colegio_id', c.id)
      await supabase.from('analisis_preguntas').delete().eq('colegio_id', c.id)
      await supabase.from('resultados_estudiante').delete().eq('colegio_id', c.id)
      await supabase.from('comparativos_gestion').delete().eq('colegio_id', c.id)
      alert('✅ Resultados eliminados correctamente.')
      loadColegios(); onUpdate()
    } catch(e) { alert('Error: ' + e.message) }
  }

  const handleDeleteColegio = async (c) => {
    if (!confirm(`⚠️ ¿Eliminar COMPLETAMENTE "${c.nombre}"?\nSe eliminarán estudiantes y resultados.\nNo se puede deshacer.`)) return
    try {
      const { data: ests } = await supabase.from('estudiantes').select('id').eq('colegio_id', c.id)
      const estIds = (ests||[]).map(e=>e.id)
      if (estIds.length) await supabase.from('notas_competencia').delete().in('estudiante_id', estIds)
      await supabase.from('comparativos_salon').delete().eq('colegio_id', c.id)
      await supabase.from('analisis_preguntas').delete().eq('colegio_id', c.id)
      await supabase.from('resultados_estudiante').delete().eq('colegio_id', c.id)
      await supabase.from('comparativos_gestion').delete().eq('colegio_id', c.id)
      await supabase.from('estudiantes').delete().eq('colegio_id', c.id)
      await supabase.from('colegios').delete().eq('id', c.id)
      alert('✅ Colegio eliminado.')
      loadColegios(); onUpdate()
    } catch(e) { alert('Error: ' + e.message) }
  }

  return (
    <div>
      {/* Filtros y acciones */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        marginBottom:16, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', flex:1 }}>
          {[
            { val:fNombre, set:setFNombre, ph:'Nombre del colegio...' },
            { val:fDepto,  set:setFDepto,  ph:'Departamento...' },
            { val:fMuni,   set:setFMuni,   ph:'Municipio...' },
            { val:fUser,   set:setFUser,   ph:'Usuario...' },
          ].map(({val,set,ph}) => (
            <input key={ph} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
              style={{ padding:'9px 14px', border:`1px solid ${C.grayLt}`, borderRadius:8,
                fontFamily:'Inter', fontSize:12, width:180, outline:'none', background:C.bg }} />
          ))}
          {(fNombre||fDepto||fMuni||fUser) && (
            <button onClick={()=>{setFNombre('');setFDepto('');setFMuni('');setFUser('')}}
              style={{ padding:'9px 12px', border:`1px solid ${C.grayLt}`, borderRadius:8,
                background:'transparent', color:C.gray, cursor:'pointer', fontFamily:'Inter', fontSize:12 }}>
              ✕ Limpiar
            </button>
          )}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn onClick={()=>setModalImport(true)} outline color={C.navy}>↑ Importar Excel</Btn>
          <Btn onClick={()=>setModalColegio('new')} color={C.green}>+ Nuevo Colegio</Btn>
        </div>
      </div>
      {/* Contador */}
      <div style={{ fontSize:12, color:C.gray, fontFamily:'Inter', marginBottom:10 }}>
        {total.toLocaleString('es-CO')} colegios · página {pagina} de {Math.ceil(total/POR_PAG)||1}
      </div>

      <Card>
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter' }}>Cargando...</div>
        ) : colegios.length===0 ? (
          <div style={{ textAlign:'center', padding:60, fontFamily:'Inter' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🏫</div>
            <div style={{ fontSize:18, fontFamily:'Playfair Display, serif', color:C.navy, marginBottom:8 }}>
              No hay colegios registrados
            </div>
            <div style={{ fontSize:13, color:C.gray }}>Crea el primer colegio con el botón de arriba.</div>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
              <thead>
                <tr style={{ borderBottom:`2px solid ${C.bg2}` }}>
                  {['Nombre','Departamento','Municipio','Usuario','Clave','Estado','Tendencia','Acciones'].map(h=>(
                    <th key={h} style={{ textAlign:'left', padding:'10px 12px', fontSize:10,
                      color:C.gray, fontWeight:600, textTransform:'uppercase',
                      letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colegios.map((c,i)=>(
                  <tr key={i} style={{ borderBottom:`1px solid ${C.bg2}`,
                    background:i%2===0?`${C.bg}80`:'transparent' }}>
                    <td style={{ padding:'12px', fontSize:13, color:C.text, fontWeight:600 }}>{c.nombre}</td>
                    <td style={{ padding:'12px', fontSize:12, color:C.gray }}>{c.departamento_nombre||'—'}</td>
                    <td style={{ padding:'12px', fontSize:12, color:C.gray }}>{c.municipio||'—'}</td>
                    <td style={{ padding:'12px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontFamily:'monospace', fontSize:12, color:C.navy,
                          fontWeight:600 }}>{c.usuario}</span>
                        <button onClick={()=>handleCopiar(c.id + '_u', c.usuario)}
                          title="Copiar usuario" style={{ background:'none', border:'none',
                            cursor:'pointer', fontSize:14, padding:2,
                            color: copiado===c.id+'_u' ? C.green : C.gray }}>
                          {copiado===c.id+'_u' ? '✓' : '⧉'}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding:'12px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontFamily:'monospace', fontSize:12, color:C.text,
                          background:C.bg, border:`1px solid ${C.grayLt}`,
                          borderRadius:4, padding:'2px 8px', letterSpacing:'0.04em' }}>
                          {c.password_plain || c.usuario || '—'}
                        </span>
                        <button onClick={()=>handleCopiar(c.id, c.password_plain||c.usuario||'')}
                          title="Copiar clave" style={{ background:'none', border:'none',
                            cursor:'pointer', fontSize:14, padding:2,
                            color: copiado===c.id ? C.green : C.gray }}>
                          {copiado===c.id ? '✓' : '⧉'}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding:'12px' }}>
                      <Badge color={c.activo?C.green:C.red}>{c.activo?'Activo':'Inactivo'}</Badge>
                    </td>
                    <td style={{ padding:'12px', textAlign:'center', fontSize:18, fontWeight:600,
                      color: tendencias[c.id] === '↑' ? C.green
                           : tendencias[c.id] === '↓' ? C.red : C.gray }}>
                      {tendencias[c.id] || '—'}
                    </td>
                    <td style={{ padding:'12px' }}>
                      <AccionesMenu
                        onEditar={()=>setModalColegio(c)}
                        onEstudiantes={()=>setModalEst(c)}
                        onHistoricos={()=>setModalHistorico(c)}
                        onToggle={()=>handleToggle(c)}
                        activo={c.activo}
                        onBorrarResultados={()=>handleDeleteResultados(c)}
                        onEliminar={()=>handleDeleteColegio(c)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Paginación */}
      {Math.ceil(total/POR_PAG) > 1 && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center',
          gap:8, marginTop:16, fontFamily:'Inter' }}>
          <button onClick={()=>setPagina(1)} disabled={pagina===1}
            style={{ padding:'6px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
              background:C.white, cursor:pagina===1?'not-allowed':'pointer',
              color:pagina===1?C.gray:C.navy, fontSize:12 }}>«</button>
          <button onClick={()=>setPagina(p=>Math.max(1,p-1))} disabled={pagina===1}
            style={{ padding:'6px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
              background:C.white, cursor:pagina===1?'not-allowed':'pointer',
              color:pagina===1?C.gray:C.navy, fontSize:12 }}>‹ Ant.</button>
          <span style={{ fontSize:12, color:C.gray, padding:'0 6px' }}>
            <strong style={{color:C.navy}}>{pagina}</strong> / {Math.ceil(total/POR_PAG)}
          </span>
          <button onClick={()=>setPagina(p=>Math.min(Math.ceil(total/POR_PAG),p+1))} disabled={pagina===Math.ceil(total/POR_PAG)}
            style={{ padding:'6px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
              background:C.white, cursor:pagina===Math.ceil(total/POR_PAG)?'not-allowed':'pointer',
              color:pagina===Math.ceil(total/POR_PAG)?C.gray:C.navy, fontSize:12 }}>Sig. ›</button>
          <button onClick={()=>setPagina(Math.ceil(total/POR_PAG))} disabled={pagina===Math.ceil(total/POR_PAG)}
            style={{ padding:'6px 12px', border:`1px solid ${C.grayLt}`, borderRadius:6,
              background:C.white, cursor:pagina===Math.ceil(total/POR_PAG)?'not-allowed':'pointer',
              color:pagina===Math.ceil(total/POR_PAG)?C.gray:C.navy, fontSize:12 }}>»</button>
        </div>
      )}

      {modalColegio && (
        <ModalColegio
          colegio={modalColegio==='new'?null:modalColegio}
          onClose={()=>setModalColegio(null)}
          onSave={handleSave}
        />
      )}
      {modalEst && (
        <ModalEstudiantes
          colegio={modalEst}
          onClose={()=>setModalEst(null)}
          onSave={handleSave}
        />
      )}
      {modalImport && (
        <ModalImportarColegios
          onClose={()=>setModalImport(false)}
          onSave={handleSave}
        />
      )}
      {modalHistorico && (
        <ModalHistoricos
          colegio={modalHistorico}
          onClose={()=>setModalHistorico(null)}
        />
      )}
    </div>
  )
}
