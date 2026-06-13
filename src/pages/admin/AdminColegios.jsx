import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import * as XLSX from 'xlsx'

const C = {
  navy:'#0A1F3D', green:'#2D9B6F', greenLt:'#3AB882',
  bg:'#F8F9FB', bg2:'#EFF1F5', white:'#FFFFFF',
  text:'#1A1A2E', gray:'#6B7280', grayLt:'#D1D5DB',
  red:'#E05252', amber:'#F59E0B', blue:'#3B82F6',
}

const Card = ({children, style={}}) => (
  <div style={{ background:C.white, borderRadius:12, padding:24,
    boxShadow:'0 1px 4px rgba(10,31,61,0.07), 0 4px 16px rgba(10,31,61,0.05)',
    border:`1px solid ${C.grayLt}`, ...style }}>{children}</div>
)

const Input = ({label, value, onChange, placeholder, type='text', required=false}) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ display:'block', fontSize:10, letterSpacing:'0.12em',
      textTransform:'uppercase', color:C.gray, marginBottom:6, fontFamily:'Inter' }}>
      {label}{required && <span style={{ color:C.red }}> *</span>}
    </label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} required={required}
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
    border: `1px solid ${color}`,
    borderRadius:6, fontFamily:'Inter', fontSize:12, fontWeight:600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    letterSpacing:'0.05em',
  }}>{children}</button>
)

const Badge = ({children, color}) => (
  <span style={{ background:color+'18', color, border:`1px solid ${color}40`,
    padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:500 }}>{children}</span>
)

// ── MODAL COLEGIO ─────────────────────────────────────────────
const ModalColegio = ({ colegio, onClose, onSave }) => {
  const [form, setForm] = useState(colegio || {
    nombre:'', departamento_nombre:'', municipio:'', direccion:'', barrio:'',
    contacto_nombre:'', contacto_telefono:'', contacto_email:'',
    usuario:'', password_hash:'',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key, val) => setForm(f => ({...f, [key]:val}))

  const handleSave = async () => {
    if (!form.nombre || !form.usuario || !form.password_hash) {
      setError('Nombre, usuario y contraseña son obligatorios.')
      return
    }
    setSaving(true)
    try {
      // Generar código único si es nuevo
      const payload = { ...form }
      if (!colegio) {
        const { count } = await supabase.from('colegios').select('*', { count:'exact', head:true })
        payload.codigo = 7000 + (count || 0) + 1
      }
      const { error: err } = colegio
        ? await supabase.from('colegios').update(payload).eq('id', colegio.id)
        : await supabase.from('colegios').insert(payload)
      if (err) { setError(err.message); return }
      onSave()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:24 }}>
      <div style={{ background:C.white, borderRadius:12, padding:32,
        width:'100%', maxWidth:640, maxHeight:'90vh', overflowY:'auto',
        boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:22, color:C.navy }}>
            {colegio ? 'Editar Colegio' : 'Nuevo Colegio'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none',
            fontSize:20, cursor:'pointer', color:C.gray }}>✕</button>
        </div>

        {/* Datos institución */}
        <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
          textTransform:'uppercase', marginBottom:16, paddingBottom:8,
          borderBottom:`1px solid ${C.bg2}` }}>Datos de la Institución</div>
        <Input label="Nombre del colegio" value={form.nombre} onChange={v=>set('nombre',v)}
          placeholder="Ej: Colegio Boston Internacional" required/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Departamento" value={form.departamento_nombre} onChange={v=>set('departamento_nombre',v)}
            placeholder="Ej: Atlántico"/>
          <Input label="Municipio" value={form.municipio} onChange={v=>set('municipio',v)}
            placeholder="Ej: Barranquilla"/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Dirección" value={form.direccion} onChange={v=>set('direccion',v)}
            placeholder="Ej: Calle 53 No 31-128"/>
          <Input label="Barrio" value={form.barrio} onChange={v=>set('barrio',v)}
            placeholder="Ej: Campestre"/>
        </div>

        {/* Contacto */}
        <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
          textTransform:'uppercase', margin:'20px 0 16px', paddingBottom:8,
          borderBottom:`1px solid ${C.bg2}` }}>Contacto</div>
        <Input label="Nombre del contacto" value={form.contacto_nombre} onChange={v=>set('contacto_nombre',v)}
          placeholder="Ej: Mg. Carlos Andrade"/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Teléfono" value={form.contacto_telefono} onChange={v=>set('contacto_telefono',v)}
            placeholder="Ej: 3001234567"/>
          <Input label="Correo electrónico" value={form.contacto_email} onChange={v=>set('contacto_email',v)}
            placeholder="Ej: rector@colegio.edu.co" type="email"/>
        </div>

        {/* Acceso */}
        <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
          textTransform:'uppercase', margin:'20px 0 16px', paddingBottom:8,
          borderBottom:`1px solid ${C.bg2}` }}>Credenciales de Acceso</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Usuario" value={form.usuario} onChange={v=>set('usuario',v)}
            placeholder="Ej: boston2026" required/>
          <Input label="Contraseña" value={form.password_hash} onChange={v=>set('password_hash',v)}
            placeholder="Contraseña inicial" required/>
        </div>

        {error && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA',
          borderRadius:6, padding:'10px 14px', marginBottom:16,
          fontSize:13, color:C.red, fontFamily:'Inter' }}>{error}</div>}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 }}>
          <Btn onClick={onClose} outline color={C.gray}>Cancelar</Btn>
          <Btn onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Colegio'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── MODAL ESTUDIANTES ─────────────────────────────────────────
const ModalEstudiantes = ({ colegio, onClose, onSave }) => {
  const [mode, setMode] = useState('lista') // 'lista' | 'subir'
  const [estudiantes, setEstudiantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState([])
  const [msg, setMsg] = useState('')
  const fileRef = useRef()

  useEffect(() => { loadEstudiantes() }, [])

  const loadEstudiantes = async () => {
    setLoading(true)
    const { data } = await supabase.from('estudiantes')
      .select('*').eq('colegio_id', colegio.id).order('nombre')
    setEstudiantes(data || [])
    setLoading(false)
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type:'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header:1 })
      // Skip header row, process data
      const data = rows.slice(1).filter(r => r[0]).map(r => ({
        nombre:    String(r[0] || '').trim(),
        documento: String(r[1] || '').trim(),
        grado:     String(r[2] || '').trim(),
        salon:     String(r[3] || '').trim(),
      }))
      setPreview(data)
      setMode('preview')
    }
    reader.readAsArrayBuffer(file)
  }

  const generateCredentials = (nombre, documento) => {
    const partes = nombre.trim().split(' ')
    const apellido = partes[partes.length > 1 ? Math.floor(partes.length/2) : 0] || partes[0]
    const prefijo = apellido.substring(0,4).toUpperCase().replace(/[^A-Z]/g,'')
    const sufijo = documento.slice(-4)
    return {
      usuario: documento,
      password: prefijo + sufijo,
    }
  }

  const handleUpload = async () => {
    if (!preview.length) return
    setUploading(true)
    setMsg('')
    try {
      let creados = 0, omitidos = 0
      for (const row of preview) {
        const { usuario, password } = generateCredentials(row.nombre, row.documento)
        const { error } = await supabase.from('estudiantes').insert({
          colegio_id:    colegio.id,
          codigo:        parseInt(row.documento) || 0,
          nombre:        row.nombre,
          grado:         row.grado,
          salon:         row.salon,
          usuario:       usuario,
          password_hash: password,
          activo:        true,
        })
        if (error) omitidos++
        else creados++
      }
      setMsg(`✅ ${creados} estudiantes creados. ${omitidos > 0 ? `${omitidos} omitidos (ya existían).` : ''}`)
      await loadEstudiantes()
      setMode('lista')
      onSave()
    } finally {
      setUploading(false)
    }
  }

  const downloadPlantilla = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nombre Completo', 'Número de Documento', 'Grado', 'Salón'],
      ['García López Juan Pablo', '1098765432', '11', '1'],
      ['Martínez Ruiz Ana Sofía', '1087654321', '11', '2'],
    ])
    ws['!cols'] = [{wch:35},{wch:20},{wch:10},{wch:10}]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes')
    XLSX.writeFile(wb, 'plantilla_estudiantes.xlsx')
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este estudiante?')) return
    await supabase.from('estudiantes').delete().eq('id', id)
    await loadEstudiantes()
    onSave()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:24 }}>
      <div style={{ background:C.white, borderRadius:12, padding:32,
        width:'100%', maxWidth:800, maxHeight:'90vh', overflowY:'auto',
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
          <button onClick={onClose} style={{ background:'none', border:'none',
            fontSize:20, cursor:'pointer', color:C.gray }}>✕</button>
        </div>

        {/* Tabs modo */}
        {mode === 'lista' && (
          <>
            <div style={{ display:'flex', gap:10, marginBottom:20 }}>
              <Btn onClick={() => setMode('subir')} color={C.green}>+ Subir Excel</Btn>
              <Btn onClick={downloadPlantilla} outline color={C.navy}>↓ Descargar plantilla</Btn>
            </div>

            {msg && <div style={{ background:'#F0FFF4', border:'1px solid #BBF7D0',
              borderRadius:6, padding:'10px 14px', marginBottom:16,
              fontSize:13, color:C.green, fontFamily:'Inter' }}>{msg}</div>}

            {loading ? (
              <div style={{ textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter' }}>
                Cargando estudiantes...
              </div>
            ) : estudiantes.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter' }}>
                No hay estudiantes registrados aún. Sube un Excel para comenzar.
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                <thead>
                  <tr style={{ borderBottom:`2px solid ${C.bg2}` }}>
                    {['Nombre','Grado','Salón','Usuario','Contraseña',''].map(h => (
                      <th key={h} style={{ textAlign:'left', padding:'8px 10px', fontSize:10,
                        color:C.gray, fontWeight:600, textTransform:'uppercase',
                        letterSpacing:'0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {estudiantes.map((e,i) => (
                    <tr key={i} style={{ borderBottom:`1px solid ${C.bg2}`,
                      background:i%2===0?`${C.bg}80`:'transparent' }}>
                      <td style={{ padding:'10px', fontSize:13, color:C.text, fontWeight:500 }}>{e.nombre}</td>
                      <td style={{ padding:'10px', fontSize:12, color:C.gray }}>{e.grado}</td>
                      <td style={{ padding:'10px', fontSize:12, color:C.gray }}>{e.salon}</td>
                      <td style={{ padding:'10px', fontSize:12, color:C.navy, fontWeight:500 }}>{e.usuario}</td>
                      <td style={{ padding:'10px', fontSize:12, color:C.gray }}>{e.password_hash}</td>
                      <td style={{ padding:'10px' }}>
                        <Btn onClick={() => handleDelete(e.id)} small outline color={C.red}>Eliminar</Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {mode === 'subir' && (
          <div>
            <div style={{ background:C.bg2, borderRadius:8, padding:20, marginBottom:20,
              border:`2px dashed ${C.grayLt}`, textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📂</div>
              <div style={{ fontFamily:'Playfair Display, serif', fontSize:18, color:C.navy, marginBottom:6 }}>
                Sube el Excel de estudiantes
              </div>
              <div style={{ fontSize:12, color:C.gray, fontFamily:'Inter', marginBottom:16 }}>
                Columnas requeridas: Nombre Completo · Número de Documento · Grado · Salón
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls"
                onChange={handleFile} style={{ display:'none' }}/>
              <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                <Btn onClick={() => fileRef.current?.click()} color={C.green}>Seleccionar archivo</Btn>
                <Btn onClick={() => setMode('lista')} outline color={C.gray}>Cancelar</Btn>
              </div>
            </div>
            <div style={{ background:'#FFF9EB', border:'1px solid #FDE68A', borderRadius:8,
              padding:14, fontFamily:'Inter', fontSize:12, color:'#92400E' }}>
              💡 <strong>Credenciales generadas automáticamente:</strong> Usuario = Número de documento.
              Contraseña = primeras 4 letras del apellido + últimos 4 dígitos del documento.
              El estudiante puede cambiarla desde su perfil.
            </div>
          </div>
        )}

        {mode === 'preview' && (
          <div>
            <div style={{ fontFamily:'Inter', fontSize:13, color:C.navy, marginBottom:16, fontWeight:500 }}>
              Vista previa — {preview.length} estudiantes a importar
            </div>
            <div style={{ maxHeight:300, overflowY:'auto', marginBottom:16 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                <thead>
                  <tr style={{ borderBottom:`2px solid ${C.bg2}`, position:'sticky', top:0, background:C.white }}>
                    {['Nombre','Documento','Grado','Salón','Usuario','Contraseña'].map(h => (
                      <th key={h} style={{ textAlign:'left', padding:'8px 10px', fontSize:10,
                        color:C.gray, fontWeight:600, textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((e,i) => {
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
              <Btn onClick={() => setMode('subir')} outline color={C.gray}>Volver</Btn>
              <Btn onClick={handleUpload} disabled={uploading} color={C.green}>
                {uploading ? 'Importando...' : `Importar ${preview.length} estudiantes`}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function AdminColegios({ onUpdate }) {
  const [colegios, setColegios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalColegio, setModalColegio] = useState(null) // null | 'new' | colegio obj
  const [modalEst, setModalEst] = useState(null) // null | colegio obj
  const [search, setSearch] = useState('')

  useEffect(() => { loadColegios() }, [])

  const loadColegios = async () => {
    setLoading(true)
    const { data } = await supabase.from('colegios').select('*').order('nombre')
    setColegios(data || [])
    setLoading(false)
  }

  const handleSave = () => { loadColegios(); onUpdate() }

  const handleDeleteResultados = async (colegio) => {
    if (!confirm(`¿Eliminar TODOS los resultados de "${colegio.nombre}"?\nEsto no se puede deshacer.`)) return
    try {
      // Borrar en orden respetando relaciones
      const estIds = (await supabase.from('estudiantes').select('id').eq('colegio_id', colegio.id)).data?.map(e => e.id) || []
      if (estIds.length) await supabase.from('notas_competencia').delete().in('estudiante_id', estIds)
      await supabase.from('comparativos_gestion').delete().eq('prueba_id', colegio.id)
      await supabase.from('comparativos_salon').delete().eq('colegio_id', colegio.id)
      await supabase.from('analisis_preguntas').delete().eq('colegio_id', colegio.id)
      await supabase.from('resultados_estudiante').delete().eq('colegio_id', colegio.id)
      alert('✅ Resultados eliminados correctamente.')
      loadColegios(); onUpdate()
    } catch(e) {
      alert('Error al eliminar: ' + e.message)
    }
  }

  const handleDeleteColegio = async (colegio) => {
    if (!confirm(`⚠️ ¿Eliminar COMPLETAMENTE el colegio "${colegio.nombre}"?\nSe eliminarán también todos sus estudiantes y resultados.\nEsta acción NO se puede deshacer.`)) return
    try {
      const estIds = (await supabase.from('estudiantes').select('id').eq('colegio_id', colegio.id)).data?.map(e => e.id) || []
      if (estIds.length) await supabase.from('notas_competencia').delete().in('estudiante_id', estIds)
      await supabase.from('comparativos_salon').delete().eq('colegio_id', colegio.id)
      await supabase.from('analisis_preguntas').delete().eq('colegio_id', colegio.id)
      await supabase.from('resultados_estudiante').delete().eq('colegio_id', colegio.id)
      await supabase.from('estudiantes').delete().eq('colegio_id', colegio.id)
      await supabase.from('colegios').delete().eq('id', colegio.id)
      alert('✅ Colegio eliminado correctamente.')
      loadColegios(); onUpdate()
    } catch(e) {
      alert('Error al eliminar: ' + e.message)
    }
  }

  const handleToggle = async (colegio) => {
    await supabase.from('colegios').update({ activo: !colegio.activo }).eq('id', colegio.id)
    loadColegios()
  }

  const filtered = colegios.filter(c =>
    c.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    c.municipio?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar colegio..." style={{ padding:'10px 16px', border:`1px solid ${C.grayLt}`,
            borderRadius:8, fontFamily:'Inter', fontSize:13, width:280, outline:'none', background:C.bg }} />
        <Btn onClick={() => setModalColegio('new')} color={C.green}>+ Nuevo Colegio</Btn>
      </div>

      {/* Lista */}
      <Card>
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, fontFamily:'Inter' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🏫</div>
            <div style={{ fontSize:18, fontFamily:'Playfair Display, serif', color:C.navy, marginBottom:8 }}>
              No hay colegios registrados
            </div>
            <div style={{ fontSize:13, color:C.gray }}>Crea el primer colegio con el botón de arriba.</div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
            <thead>
              <tr style={{ borderBottom:`2px solid ${C.bg2}` }}>
                {['Código','Nombre','Ciudad','Contacto','Usuario','Estado','Acciones'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'10px 12px', fontSize:10,
                    color:C.gray, fontWeight:600, textTransform:'uppercase',
                    letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c,i) => (
                <tr key={i} style={{ borderBottom:`1px solid ${C.bg2}`,
                  background:i%2===0?`${C.bg}80`:'transparent' }}>
                  <td style={{ padding:'12px', fontSize:13, color:C.gray }}>{c.codigo}</td>
                  <td style={{ padding:'12px' }}>
                    <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>{c.nombre}</div>
                    <div style={{ fontSize:11, color:C.gray }}>{c.departamento_nombre}</div>
                  </td>
                  <td style={{ padding:'12px', fontSize:12, color:C.gray }}>{c.municipio||'—'}</td>
                  <td style={{ padding:'12px' }}>
                    <div style={{ fontSize:12, color:C.text }}>{c.contacto_nombre||'—'}</div>
                    <div style={{ fontSize:11, color:C.gray }}>{c.contacto_email||''}</div>
                  </td>
                  <td style={{ padding:'12px', fontSize:12, color:C.navy, fontWeight:500 }}>{c.usuario}</td>
                  <td style={{ padding:'12px' }}>
                    <Badge color={c.activo?C.green:C.red}>{c.activo?'Activo':'Inactivo'}</Badge>
                  </td>
                  <td style={{ padding:'12px' }}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <Btn onClick={() => setModalColegio(c)} small outline color={C.navy}>Editar</Btn>
                      <Btn onClick={() => setModalEst(c)} small color={C.green}>Estudiantes</Btn>
                      <Btn onClick={() => handleToggle(c)} small outline color={c.activo?C.amber:C.green}>
                        {c.activo?'Desactivar':'Activar'}
                      </Btn>
                      <Btn onClick={() => handleDeleteResultados(c)} small outline color={C.red}>
                        Borrar resultados
                      </Btn>
                      <Btn onClick={() => handleDeleteColegio(c)} small color={C.red}>
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

      {/* Modales */}
      {modalColegio && (
        <ModalColegio
          colegio={modalColegio === 'new' ? null : modalColegio}
          onClose={() => setModalColegio(null)}
          onSave={handleSave}
        />
      )}
      {modalEst && (
        <ModalEstudiantes
          colegio={modalEst}
          onClose={() => setModalEst(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
