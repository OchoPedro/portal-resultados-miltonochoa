import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { C } from '../../components/ui'
import { generateCredentials } from '../../lib/utils'
import * as XLSX from 'xlsx'

const Card = ({children, style={}}) => (
  <div style={{ background:C.white, borderRadius:12, padding:24,
    boxShadow:'0 1px 4px rgba(10,31,61,0.07)', border:`1px solid ${C.grayLt}`, ...style }}>{children}</div>
)

const Badge = ({children, color}) => (
  <span style={{ background:color+'18', color, border:`1px solid ${color}40`,
    padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:500 }}>{children}</span>
)

export default function AdminEstudiantes({ onUpdate }) {
  const [archivos, setArchivos] = useState([]) // [{nombre, codigo, estudiantes, estado}]
  const [procesando, setProcesando] = useState(false)
  const [resultados, setResultados] = useState([]) // resumen post-carga
  const [colegios, setColegios] = useState({}) // cache codigo -> colegio
  const fileRef = useRef()

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    const parsed = []
    for (const file of files) {
      const result = await parseFile(file)
      parsed.push(result)
    }
    setArchivos(parsed)
    setResultados([])
  }

  const parseFile = (file) => new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type:'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header:1 })

        // Fila 1: ["Código Colegio", codigoColegio]
        const codigoColegio = rows[0]?.[1]
        // Fila 2: headers, Fila 3+: datos
        const estudiantes = rows.slice(2).filter(r => r[0]).map(r => ({
          nombre:    String(r[0]||'').trim(),
          documento: String(r[1]||'').trim(),
          grado:     String(r[2]||'').trim(),
          salon:     String(r[3]||'').trim(),
        }))

        // Buscar colegio por usuario (ej: ANME0001) o por código numérico
        let colegio = null
        let error = null
        if (codigoColegio) {
          const codigoStr = String(codigoColegio).trim()
          // Intentar por usuario primero
          const { data: porUsuario } = await supabase.from('colegios')
            .select('id, nombre, municipio').eq('usuario', codigoStr).single()
          if (porUsuario) {
            colegio = porUsuario
          } else {
            // Intentar por código numérico
            const { data: porCodigo } = await supabase.from('colegios')
              .select('id, nombre, municipio').eq('codigo', parseInt(codigoStr)).single()
            if (porCodigo) colegio = porCodigo
            else error = `Colegio con código "${codigoStr}" no encontrado`
          }
        } else {
          error = 'No se encontró código de colegio en la celda B1'
        }

        resolve({
          nombre: file.name,
          codigo: codigoColegio,
          colegio,
          estudiantes,
          error,
          estado: error ? 'error' : 'listo',
        })
      } catch(e) {
        resolve({ nombre: file.name, error: 'Error al leer el archivo', estado:'error', estudiantes:[] })
      }
    }
    reader.readAsArrayBuffer(file)
  })

  const handleCargar = async () => {
    const archivosValidos = archivos.filter(a => a.estado === 'listo')
    if (!archivosValidos.length) return

    setProcesando(true)
    const res = []

    for (const archivo of archivosValidos) {
      let creados = 0, omitidos = 0
      const errores = []
      for (const est of archivo.estudiantes) {
        const { usuario, password } = generateCredentials(est.nombre, est.documento)
        const { error } = await supabase.from('estudiantes').insert({
          colegio_id:    archivo.colegio.id,
          nombre:        est.nombre,
          grado:         est.grado,
          salon:         est.salon,
          usuario,
          password_hash: password,
          activo:        true,
        })
        if (error) {
          console.error('Error insertando:', est.nombre, error)
          omitidos++
          errores.push(`${est.nombre}: ${error.message}`)
        } else creados++
      }
      res.push({
        archivo: archivo.nombre,
        colegio: archivo.colegio.nombre,
        creados,
        omitidos,
        errores,
      })
    }

    setResultados(res)
    setArchivos([])
    setProcesando(false)
    onUpdate()
  }

  const downloadPlantilla = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['Usuario Colegio', 'ANME0001', '← Reemplaza con el usuario real del colegio', ''],
      ['Nombre Completo', 'Número de Documento', 'Grado', 'Salón'],
      ['Juan Pablo García López', '1098765432', '11', '1'],
      ['Ana Sofía Martínez Ruiz', '1087654321', '11', '2'],
    ])
    ws['!cols'] = [{wch:20},{wch:22},{wch:38},{wch:10}]
    XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes')
    XLSX.writeFile(wb, 'plantilla_estudiantes.xlsx')
  }

  const removeArchivo = (idx) => setArchivos(a => a.filter((_,i) => i !== idx))

  const totalEstudiantes = archivos.filter(a=>a.estado==='listo')
    .reduce((s,a) => s + a.estudiantes.length, 0)

  return (
    <div style={{ display:'grid', gap:20 }}>

      {/* Zona de carga */}
      <Card>
        <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
          textTransform:'uppercase', marginBottom:16, paddingBottom:10,
          borderBottom:`1px solid ${C.bg2}` }}>Carga Masiva de Estudiantes</div>

        {/* Drop zone */}
        <div onClick={() => fileRef.current?.click()}
          style={{ border:`2px dashed ${C.grayLt}`, borderRadius:12, padding:'40px 24px',
            textAlign:'center', cursor:'pointer', marginBottom:16,
            background:C.bg, transition:'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.green}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.grayLt}>
          <div style={{ fontSize:40, marginBottom:12 }}>📂</div>
          <div style={{ fontFamily:'Playfair Display, serif', fontSize:18,
            color:C.navy, marginBottom:6 }}>Selecciona uno o varios archivos Excel</div>
          <div style={{ fontFamily:'Inter', fontSize:12, color:C.gray, marginBottom:16 }}>
            Puedes cargar listados de múltiples colegios a la vez
          </div>
          <div style={{ display:'inline-block', background:C.green, color:C.white,
            padding:'8px 20px', borderRadius:6, fontFamily:'Inter',
            fontSize:12, fontWeight:600 }}>Seleccionar archivos</div>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls"
          multiple onChange={handleFiles} style={{ display:'none' }}/>

        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={downloadPlantilla} style={{ background:'none',
            border:`1px solid ${C.navy}`, color:C.navy, padding:'8px 16px',
            borderRadius:6, fontFamily:'Inter', fontSize:12, cursor:'pointer',
            fontWeight:600 }}>↓ Descargar plantilla Excel</button>
          <span style={{ fontSize:12, color:C.gray, fontFamily:'Inter' }}>
            Usa esta plantilla para garantizar el formato correcto
          </span>
        </div>
      </Card>

      {/* Lista de archivos cargados */}
      {archivos.length > 0 && (
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:16 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
                textTransform:'uppercase' }}>
                {archivos.length} archivo{archivos.length!==1?'s':''} seleccionado{archivos.length!==1?'s':''}
              </div>
              {totalEstudiantes > 0 && (
                <div style={{ fontSize:12, color:C.gray, fontFamily:'Inter', marginTop:4 }}>
                  {totalEstudiantes} estudiante{totalEstudiantes!==1?'s':''} listos para importar
                </div>
              )}
            </div>
            <button onClick={handleCargar} disabled={procesando || totalEstudiantes===0}
              style={{ background: totalEstudiantes>0 ? C.green : C.grayLt,
                color:C.white, border:'none', padding:'10px 24px', borderRadius:6,
                fontFamily:'Inter', fontSize:12, fontWeight:600,
                cursor: totalEstudiantes>0 ? 'pointer' : 'not-allowed' }}>
              {procesando ? 'Importando...' : `Importar ${totalEstudiantes} estudiante${totalEstudiantes!==1?'s':''}`}
            </button>
          </div>

          <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
            <thead>
              <tr style={{ borderBottom:`2px solid ${C.bg2}` }}>
                {['Archivo','Colegio','Código','Estudiantes','Estado',''].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontSize:10,
                    color:C.gray, fontWeight:600, textTransform:'uppercase',
                    letterSpacing:'0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {archivos.map((a, i) => (
                <tr key={i} style={{ borderBottom:`1px solid ${C.bg2}`,
                  background:i%2===0?`${C.bg}80`:'transparent' }}>
                  <td style={{ padding:'12px', fontSize:12, color:C.text, fontWeight:500 }}>
                    📄 {a.nombre}
                  </td>
                  <td style={{ padding:'12px', fontSize:12, color:C.text }}>
                    {a.colegio?.nombre || <span style={{color:C.red}}>No encontrado</span>}
                  </td>
                  <td style={{ padding:'12px', fontSize:12, color:C.gray }}>{a.codigo || '—'}</td>
                  <td style={{ padding:'12px', fontSize:14, fontWeight:700,
                    color:C.navy, fontFamily:'Playfair Display, serif' }}>
                    {a.estudiantes.length}
                  </td>
                  <td style={{ padding:'12px' }}>
                    {a.estado === 'listo'
                      ? <Badge color={C.green}>Listo</Badge>
                      : <Badge color={C.red}>{a.error}</Badge>}
                  </td>
                  <td style={{ padding:'12px' }}>
                    <button onClick={() => removeArchivo(i)} style={{ background:'none',
                      border:'none', color:C.red, cursor:'pointer', fontSize:16 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Vista previa del primer archivo válido */}
          {archivos.filter(a=>a.estado==='listo')[0] && (
            <div style={{ marginTop:20 }}>
              <div style={{ fontSize:11, fontWeight:600, color:C.gray, letterSpacing:'0.08em',
                textTransform:'uppercase', marginBottom:10 }}>
                Vista previa — {archivos.filter(a=>a.estado==='listo')[0].nombre}
              </div>
              <div style={{ maxHeight:200, overflowY:'auto', border:`1px solid ${C.bg2}`,
                borderRadius:8 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter' }}>
                  <thead>
                    <tr style={{ background:C.bg2 }}>
                      {['Nombre','Documento','Grado','Salón','Usuario','Contraseña'].map(h=>(
                        <th key={h} style={{ textAlign:'left', padding:'6px 10px', fontSize:10,
                          color:C.gray, fontWeight:600, textTransform:'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {archivos.filter(a=>a.estado==='listo')[0].estudiantes.slice(0,5).map((e,i)=>{
                      const creds = generateCredentials(e.nombre, e.documento)
                      return (
                        <tr key={i} style={{ borderBottom:`1px solid ${C.bg2}` }}>
                          <td style={{ padding:'6px 10px', fontSize:11, color:C.text }}>{e.nombre}</td>
                          <td style={{ padding:'6px 10px', fontSize:11, color:C.gray }}>{e.documento}</td>
                          <td style={{ padding:'6px 10px', fontSize:11, color:C.gray }}>{e.grado}</td>
                          <td style={{ padding:'6px 10px', fontSize:11, color:C.gray }}>{e.salon}</td>
                          <td style={{ padding:'6px 10px', fontSize:11, color:C.navy }}>{creds.usuario}</td>
                          <td style={{ padding:'6px 10px', fontSize:11, color:C.green }}>{creds.password}</td>
                        </tr>
                      )
                    })}
                    {archivos.filter(a=>a.estado==='listo')[0].estudiantes.length > 5 && (
                      <tr>
                        <td colSpan={6} style={{ padding:'8px 10px', fontSize:11,
                          color:C.gray, fontStyle:'italic', textAlign:'center' }}>
                          ... y {archivos.filter(a=>a.estado==='listo')[0].estudiantes.length - 5} más
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Resultados de la carga */}
      {resultados.length > 0 && (
        <Card>
          <div style={{ fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
            textTransform:'uppercase', marginBottom:16, paddingBottom:10,
            borderBottom:`1px solid ${C.bg2}` }}>Resultado de la Importación</div>
          {resultados.map((r, i) => (
            <div key={i}>
              <div style={{ display:'flex', justifyContent:'space-between',
                alignItems:'center', padding:'14px 0',
                borderBottom: i < resultados.length-1 && !r.errores?.length ? `1px solid ${C.bg2}` : 'none' }}>
                <div>
                  <div style={{ fontSize:13, color:C.text, fontWeight:600,
                    fontFamily:'Inter' }}>{r.colegio}</div>
                  <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter',
                    marginTop:2 }}>{r.archivo}</div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <Badge color={C.green}>{r.creados} creados</Badge>
                  {r.omitidos > 0 && <Badge color={C.amber}>{r.omitidos} omitidos</Badge>}
                </div>
              </div>
              {r.errores?.length > 0 && (
                <div style={{ marginBottom:8, padding:'8px 12px', background:'#FEF2F2',
                  border:'1px solid #FECACA', borderRadius:6, fontSize:11,
                  color:C.red, fontFamily:'Inter' }}>
                  {r.errores.slice(0,3).map((e,j) => <div key={j}>⚠️ {e}</div>)}
                  {r.errores.length > 3 && <div>...y {r.errores.length-3} más</div>}
                </div>
              )}
            </div>
          ))}
          <div style={{ marginTop:16, padding:'12px 16px', background:'#F0FFF4',
            border:'1px solid #BBF7D0', borderRadius:8, fontFamily:'Inter',
            fontSize:13, color:C.green }}>
            ✅ Importación completada. Los estudiantes ya pueden acceder al portal.
          </div>
        </Card>
      )}
    </div>
  )
}
