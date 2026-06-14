import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import * as XLSX from 'xlsx'

const C = {
  navy:'#0A1F3D', green:'#2D9B6F', greenLt:'#3AB882',
  bg:'#F8F9FB', bg2:'#EFF1F5', white:'#FFFFFF',
  text:'#1A1A2E', gray:'#6B7280', grayLt:'#D1D5DB',
  red:'#E05252', amber:'#F59E0B',
}

const GRADOS = Array.from({ length: 12 }, (_, i) => i)

function Input({ label, value, onChange, placeholder, required }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display:'block', fontSize:12, fontWeight:600,
        color:C.navy, marginBottom:4, fontFamily:'Inter' }}>
        {label}{required && <span style={{ color:C.red }}> *</span>}
      </label>
      <input value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width:'100%', padding:'8px 12px', borderRadius:6,
          border:`1px solid ${C.grayLt}`, fontSize:13, fontFamily:'Inter',
          outline:'none', boxSizing:'border-box' }}/>
    </div>
  )
}

function Btn({ children, onClick, outline, color, disabled, small }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? '5px 12px' : '9px 18px',
      background: outline ? 'transparent' : (color || C.green),
      color: outline ? (color || C.green) : C.white,
      border: `1.5px solid ${color || C.green}`,
      borderRadius: 6, fontSize: small ? 12 : 13, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily:'Inter',
      opacity: disabled ? 0.6 : 1,
    }}>{children}</button>
  )
}

// ── CHECKBOX GRADOS ───────────────────────────────────────────
function GradosSelector({ value, onChange }) {
  const selected = value || []
  const toggle = (g) => {
    if (selected.includes(g)) onChange(selected.filter(x => x !== g))
    else onChange([...selected, g].sort((a,b)=>a-b))
  }
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display:'block', fontSize:12, fontWeight:600,
        color:C.navy, marginBottom:8, fontFamily:'Inter' }}>
        Grados
      </label>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {GRADOS.map(g => (
          <label key={g} style={{ display:'flex', alignItems:'center', gap:5,
            cursor:'pointer', fontSize:13, fontFamily:'Inter', userSelect:'none',
            background: selected.includes(g) ? C.green : C.bg2,
            color: selected.includes(g) ? C.white : C.text,
            borderRadius:6, padding:'5px 10px',
            border:`1.5px solid ${selected.includes(g) ? C.green : C.grayLt}`,
            transition:'all 0.15s'
          }}>
            <input type="checkbox" checked={selected.includes(g)}
              onChange={()=>toggle(g)}
              style={{ accentColor: C.green, width:13, height:13 }}/>
            {g === 0 ? 'Preescolar' : `Grado ${g}`}
          </label>
        ))}
      </div>
      {selected.length === 0 && (
        <p style={{ fontSize:11, color:C.red, marginTop:4, fontFamily:'Inter' }}>
          Selecciona al menos un grado
        </p>
      )}
    </div>
  )
}

// ── UPLOAD EXCEL ──────────────────────────────────────────────
function ExcelUploader({ onParsed, parsed }) {
  const inputRef = useRef()
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setError('')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        // Leer todas las filas como array de arrays
        const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        // Detectar fila de headers: buscar la fila con más celdas no vacías
        let headerRowIndex = 0
        let maxFilled = 0
        allRows.slice(0, 5).forEach((row, i) => {
          const filled = row.filter(c => c !== '' && c !== null && c !== undefined).length
          if (filled > maxFilled) { maxFilled = filled; headerRowIndex = i }
        })

        // Separar metadata (filas antes del header), headers y datos
        const metaRows = allRows.slice(0, headerRowIndex)   // ej: fila "Referencia: DB-A"
        const headers = allRows[headerRowIndex]
        const dataRows = allRows.slice(headerRowIndex + 1).filter(r =>
          r.some(c => c !== '' && c !== null && c !== undefined)
        )

        onParsed({
          meta: metaRows,
          headers,
          rows: dataRows,
          totalRows: dataRows.length,
          cols: headers.length,
          fileName: file.name,
          // También guardamos raw completo para reconstruir el Excel al descargar
          raw: allRows,
        })
      } catch {
        setError('Error al leer el archivo. Verifica que sea un Excel válido.')
      }
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display:'block', fontSize:12, fontWeight:600,
        color:C.navy, marginBottom:6, fontFamily:'Inter' }}>
        Estructura de la prueba (Excel) <span style={{ color:C.red }}>*</span>
      </label>
      <div style={{ border:`2px dashed ${parsed ? C.green : C.grayLt}`,
        borderRadius:8, padding:'16px', textAlign:'center',
        background: parsed ? '#F0FDF4' : C.bg2, cursor:'pointer' }}
        onClick={() => inputRef.current.click()}>
        <input ref={inputRef} type="file" accept=".xlsx,.xls"
          style={{ display:'none' }} onChange={handleFile}/>
        {parsed ? (
          <div>
            <div style={{ fontSize:20 }}>✅</div>
            <div style={{ fontSize:13, fontWeight:600, color:C.green, fontFamily:'Inter' }}>
              {fileName || parsed.fileName}
            </div>
            <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginTop:2 }}>
              {parsed.totalRows ?? parsed.rows} filas × {parsed.cols} columnas — clic para cambiar
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:28 }}>📊</div>
            <div style={{ fontSize:13, fontWeight:600, color:C.navy, fontFamily:'Inter' }}>
              Arrastra el Excel o haz clic para seleccionar
            </div>
            <div style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginTop:4 }}>
              Formato .xlsx o .xls con la estructura de la prueba
            </div>
          </div>
        )}
      </div>
      {error && <p style={{ fontSize:12, color:C.red, marginTop:4, fontFamily:'Inter' }}>{error}</p>}
    </div>
  )
}

// ── MODAL VER EXCEL ───────────────────────────────────────────
function ModalVerExcel({ referencia, onClose }) {
  const excel = referencia.estructura_excel || {}
  const fileName = excel.fileName || `${referencia.codigo}.xlsx`

  const headers = excel.headers || excel.raw?.[0] || []
  const allRows = excel.rows    || excel.raw?.slice(1) || []
  const meta    = excel.meta    || []

  // Índices de columnas filtrables (las que tienen pocos valores únicos)
  const FILTER_COLS = ['Área', 'Asignatura', 'Ciclo MEN', 'Competencia', 'Componente', 'Dificultad', 'Sesión']
  const filterableCols = headers
    .map((h, i) => ({ name: String(h), idx: i }))
    .filter(c => FILTER_COLS.includes(c.name))

  const [filters, setFilters] = useState({})

  // Opciones únicas por columna filtrable
  const getOptions = (colIdx) => {
    const vals = [...new Set(allRows.map(r => String(r[colIdx] ?? '')))]
      .filter(v => v !== '').sort()
    return vals
  }

  // Filas filtradas
  const filteredRows = allRows.filter(row =>
    filterableCols.every(col => {
      const active = filters[col.name]
      if (!active) return true
      return String(row[col.idx] ?? '') === active
    })
  )

  // Colores de columna
  const COL_COLORS = [
    '#BDD7EE','#BDD7EE','#70AD47','#4472C4',
    '#4472C4','#4472C4','#4472C4','#4472C4',
    '#4472C4','#FFD966','#FFD966',
  ]

  // Descarga con formato y colores
  const handleDownload = () => {
    const wb = XLSX.utils.book_new()
    const dataToExport = [
      ...(meta.length > 0 ? meta : []),
      headers,
      ...filteredRows,
    ]
    const ws = XLSX.utils.aoa_to_sheet(dataToExport)

    // Ancho de columnas
    ws['!cols'] = headers.map((h, i) => ({
      wch: i === 5 ? 60 : i >= 6 ? 30 : 16 // Estándar más ancho
    }))

    // Estilos de header (fila de headers)
    const headerRowIdx = meta.length > 0 ? meta.length : 0
    headers.forEach((_, ci) => {
      const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c: ci })
      if (!ws[cellRef]) ws[cellRef] = { v: headers[ci], t: 's' }
      ws[cellRef].s = {
        fill: { fgColor: { rgb: (COL_COLORS[ci] || '#4472C4').replace('#','') } },
        font: { bold: true, color: { rgb: COL_COLORS[ci] === '#FFD966' ? '1A1A2E' : 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style:'thin', color:{ rgb:'FFFFFF' } },
          bottom: { style:'thin', color:{ rgb:'FFFFFF' } },
          left: { style:'thin', color:{ rgb:'FFFFFF' } },
          right: { style:'thin', color:{ rgb:'FFFFFF' } },
        }
      }
    })

    // Estilos de filas de datos (alternado)
    filteredRows.forEach((_, ri) => {
      const rowIdx = headerRowIdx + 1 + ri
      const bgColor = ri % 2 === 0 ? 'FFFFFF' : 'EFF4FB'
      headers.forEach((_, ci) => {
        const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: ci })
        if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' }
        ws[cellRef].s = {
          fill: { fgColor: { rgb: bgColor } },
          alignment: { vertical: 'center', wrapText: ci === 5 },
          border: {
            top: { style:'thin', color:{ rgb:'D1D5DB' } },
            bottom: { style:'thin', color:{ rgb:'D1D5DB' } },
            left: { style:'thin', color:{ rgb:'D1D5DB' } },
            right: { style:'thin', color:{ rgb:'D1D5DB' } },
          }
        }
      })
    })

    XLSX.utils.book_append_sheet(wb, ws, 'Prueba')
    XLSX.writeFile(wb, fileName, { cellStyles: true })
  }

  const activeFilters = Object.entries(filters).filter(([,v]) => v)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100 }}>
      <div style={{ background:C.white, borderRadius:12, width:'95%', maxWidth:1200,
        maxHeight:'92vh', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 64px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'16px 24px', borderBottom:`1px solid ${C.grayLt}`, flexShrink:0 }}>
          <div>
            <h2 style={{ fontSize:16, fontWeight:700, color:C.navy, margin:0, fontFamily:'Inter' }}>
              📊 {referencia.nombre}
            </h2>
            <p style={{ fontSize:12, color:C.gray, margin:'3px 0 0', fontFamily:'Inter' }}>
              {filteredRows.length} de {allRows.length} preguntas · {headers.length} columnas
              {meta.length > 0 && meta[0]?.filter(Boolean).length > 0 &&
                ` · ${meta[0].filter(Boolean).join(' ')}`}
            </p>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <button onClick={handleDownload} style={{
              display:'flex', alignItems:'center', gap:6,
              background:C.green, color:C.white, border:'none',
              borderRadius:6, padding:'8px 16px', fontSize:13,
              fontWeight:600, cursor:'pointer', fontFamily:'Inter' }}>
              ⬇ Descargar Excel
            </button>
            <button onClick={onClose} style={{ background:'none', border:'none',
              fontSize:22, cursor:'pointer', color:C.gray, lineHeight:1 }}>✕</button>
          </div>
        </div>

        {/* Filtros */}
        {filterableCols.length > 0 && (
          <div style={{ padding:'12px 24px', borderBottom:`1px solid ${C.bg2}`,
            display:'flex', flexWrap:'wrap', gap:10, alignItems:'center', flexShrink:0,
            background:C.bg }}>
            <span style={{ fontSize:11, fontWeight:600, color:C.gray, fontFamily:'Inter',
              textTransform:'uppercase', letterSpacing:'0.05em' }}>Filtrar:</span>
            {filterableCols.map(col => (
              <select key={col.name}
                value={filters[col.name] || ''}
                onChange={e => setFilters(f => ({ ...f, [col.name]: e.target.value || undefined }))}
                style={{ padding:'5px 10px', borderRadius:6, border:`1px solid ${C.grayLt}`,
                  fontSize:12, fontFamily:'Inter', color:C.text, background:C.white,
                  cursor:'pointer', outline:'none',
                  borderColor: filters[col.name] ? C.green : C.grayLt,
                  fontWeight: filters[col.name] ? 600 : 400 }}>
                <option value="">{col.name} (todos)</option>
                {getOptions(col.idx).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ))}
            {activeFilters.length > 0 && (
              <button onClick={() => setFilters({})}
                style={{ padding:'5px 12px', borderRadius:6, border:`1px solid ${C.red}`,
                  fontSize:12, color:C.red, background:'transparent', cursor:'pointer',
                  fontFamily:'Inter', fontWeight:600 }}>
                ✕ Limpiar filtros ({activeFilters.length})
              </button>
            )}
          </div>
        )}

        {/* Tabla */}
        <div style={{ overflowY:'auto', overflowX:'auto', flex:1 }}>
          {headers.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter' }}>
              Sin datos en el archivo
            </div>
          ) : filteredRows.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:C.gray, fontFamily:'Inter' }}>
              No hay preguntas que coincidan con los filtros seleccionados
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:'Inter' }}>
              <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                <tr>
                  <th style={{ padding:'10px 12px', background:'#1F3864', color:'white',
                    fontSize:11, fontWeight:700, minWidth:36, textAlign:'center',
                    borderRight:'1px solid rgba(255,255,255,0.2)' }}>#</th>
                  {headers.map((h, i) => (
                    <th key={i} style={{
                      padding:'10px 12px', textAlign:'center',
                      background: COL_COLORS[i] || '#4472C4',
                      color: COL_COLORS[i] === '#FFD966' ? '#1A1A2E' : 'white',
                      fontSize:11, fontWeight:700, whiteSpace:'nowrap', minWidth:110,
                      borderRight:'1px solid rgba(255,255,255,0.3)',
                      borderBottom:'2px solid rgba(0,0,0,0.15)'
                    }}>
                      {h !== undefined && h !== null && h !== '' ? String(h) : `Col ${i+1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? C.white : '#EFF4FB' }}>
                    <td style={{ padding:'7px 12px', color:C.gray, fontSize:11,
                      fontWeight:600, textAlign:'center',
                      background: ri % 2 === 0 ? '#EBF0FA' : '#D6E4F0',
                      borderRight:'1px solid #D1D5DB', borderBottom:'1px solid #E5E7EB' }}>
                      {ri + 1}
                    </td>
                    {headers.map((_, ci) => {
                      const val = Array.isArray(row) ? row[ci] : ''
                      return (
                        <td key={ci} style={{
                          padding:'7px 12px', color:C.text,
                          borderRight:'1px solid #E5E7EB',
                          borderBottom:'1px solid #E5E7EB',
                          maxWidth:260, overflow:'hidden',
                          textOverflow:'ellipsis', whiteSpace:'nowrap'
                        }} title={val !== undefined && val !== null ? String(val) : ''}>
                          {val !== undefined && val !== null && val !== '' ? String(val) : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── MODAL REFERENCIA ──────────────────────────────────────────
function ModalReferencia({ pruebaTipo, refData, onClose, onSaved }) {
  const isEdit = !!refData
  const [form, setForm] = useState({
    codigo: refData?.codigo || '',
    nombre: refData?.nombre || '',
    descripcion: refData?.descripcion || '',
    grados: refData?.grados || [],
  })
  const [excelParsed, setExcelParsed] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.codigo.trim()) return setError('El código es requerido')
    if (!form.nombre.trim()) return setError('El nombre es requerido')
    if (form.grados.length === 0) return setError('Selecciona al menos un grado')
    if (!isEdit && !excelParsed) return setError('Debes adjuntar el archivo Excel de la prueba')

    setSaving(true)
    setError('')

    const payload = {
      tipo: pruebaTipo,
      codigo: form.codigo.trim(),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      grados: form.grados,
      estructura_excel: excelParsed ? excelParsed : (refData?.estructura_excel || null),
    }

    let err
    if (isEdit) {
      ({ error: err } = await supabase.from('pruebas').update(payload).eq('id', refData.id))
    } else {
      ({ error: err } = await supabase.from('pruebas').insert(payload))
    }

    setSaving(false)
    if (err) return setError(err.message)
    onSaved()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:C.white, borderRadius:12, padding:28,
        width:'100%', maxWidth:540, maxHeight:'90vh', overflowY:'auto',
        boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>

        <div style={{ display:'flex', justifyContent:'space-between',
          alignItems:'center', marginBottom:18 }}>
          <h2 style={{ fontSize:16, fontWeight:700, color:C.navy, fontFamily:'Inter', margin:0 }}>
            {isEdit ? 'Editar Referencia' : 'Nueva Referencia'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none',
            fontSize:20, cursor:'pointer', color:C.gray }}>✕</button>
        </div>

        <div style={{ background:C.bg2, borderRadius:6, padding:'8px 14px', marginBottom:16,
          fontSize:12, color:C.gray, fontFamily:'Inter' }}>
          Prueba: <strong style={{ color:C.navy }}>{pruebaTipo.charAt(0).toUpperCase()+pruebaTipo.slice(1)}</strong>
        </div>

        <Input label="Código / Referencia" value={form.codigo} onChange={v=>set('codigo',v)}
          placeholder="Ej: GO2" required/>

        <Input label="Nombre completo" value={form.nombre} onChange={v=>set('nombre',v)}
          placeholder="Ej: Simulacro GO2 — Mayo 2026" required/>

        <Input label="Descripción (opcional)" value={form.descripcion} onChange={v=>set('descripcion',v)}
          placeholder="Descripción de la prueba"/>

        <GradosSelector value={form.grados} onChange={v=>set('grados',v)}/>

        <ExcelUploader onParsed={setExcelParsed} parsed={excelParsed}/>

        {isEdit && !excelParsed && refData?.estructura_excel && (
          <p style={{ fontSize:11, color:C.gray, fontFamily:'Inter', marginBottom:12 }}>
            ℹ️ Se mantiene el Excel anterior. Sube uno nuevo solo si quieres reemplazarlo.
          </p>
        )}

        {error && (
          <div style={{ background:'#FEF2F2', border:'1px solid #FECACA',
            borderRadius:6, padding:'10px 14px', marginBottom:16,
            fontSize:13, color:C.red, fontFamily:'Inter' }}>{error}</div>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
          <Btn onClick={onClose} outline color={C.gray}>Cancelar</Btn>
          <Btn onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────────
export default function AdminPruebas({ onUpdate }) {
  const [pruebas, setPruebas] = useState([])
  const [tipoSelec, setTipoSelec] = useState(null)
  const [modalRef, setModalRef] = useState(null)
  const [modalExcel, setModalExcel] = useState(null)
  const [nuevoTipo, setNuevoTipo] = useState('')
  const [showNuevoTipo, setShowNuevoTipo] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPruebas() }, [])

  const loadPruebas = async () => {
    setLoading(true)
    const { data } = await supabase.from('pruebas').select('*').order('tipo').order('created_at', { ascending: false })
    setPruebas(data || [])
    setLoading(false)
  }

  const handleSaved = () => { loadPruebas(); onUpdate() }

  const handleToggle = async (p) => {
    await supabase.from('pruebas').update({ activa: !p.activa }).eq('id', p.id)
    loadPruebas()
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta referencia?')) return
    await supabase.from('pruebas').delete().eq('id', id)
    loadPruebas(); onUpdate()
  }

  const handleCrearTipo = async () => {
    if (!nuevoTipo.trim()) return
    await supabase.from('pruebas').insert({
      tipo: nuevoTipo.trim().toLowerCase(),
      codigo: '_tipo_', nombre: nuevoTipo.trim(),
      grados: [], activa: true,
    })
    setNuevoTipo(''); setShowNuevoTipo(false)
    loadPruebas()
  }

  const tipos = [...new Set(pruebas.map(p => p.tipo))]
  const refs = pruebas.filter(p => p.tipo === tipoSelec && p.codigo !== '_tipo_')

  return (
    <div style={{ fontFamily:'Inter' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700, color:C.navy, margin:0 }}>Pruebas</h1>
        <Btn onClick={() => setShowNuevoTipo(true)}>+ Nuevo tipo</Btn>
      </div>

      {showNuevoTipo && (
        <div style={{ background:C.white, borderRadius:10, padding:20, marginBottom:20,
          border:`1px solid ${C.grayLt}`, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:C.navy, marginBottom:12 }}>Crear tipo de prueba</h3>
          <div style={{ display:'flex', gap:10 }}>
            <input value={nuevoTipo} onChange={e=>setNuevoTipo(e.target.value)}
              placeholder="Ej: Saber 11, Simulacro, Diagnóstico..."
              style={{ flex:1, padding:'8px 12px', borderRadius:6,
                border:`1px solid ${C.grayLt}`, fontSize:13, outline:'none' }}/>
            <Btn onClick={handleCrearTipo}>Crear</Btn>
            <Btn outline color={C.gray} onClick={()=>setShowNuevoTipo(false)}>Cancelar</Btn>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20 }}>
        {/* Sidebar tipos */}
        <div style={{ background:C.white, borderRadius:10, padding:14,
          border:`1px solid ${C.grayLt}`, height:'fit-content' }}>
          <p style={{ fontSize:11, fontWeight:600, color:C.gray, textTransform:'uppercase',
            letterSpacing:'0.05em', marginBottom:10 }}>Tipos de prueba</p>
          {loading ? (
            <p style={{ fontSize:12, color:C.gray }}>Cargando...</p>
          ) : tipos.length === 0 ? (
            <p style={{ fontSize:12, color:C.gray }}>Sin tipos aún</p>
          ) : tipos.map(t => (
            <button key={t} onClick={() => setTipoSelec(t)}
              style={{ display:'block', width:'100%', textAlign:'left',
                padding:'9px 12px', borderRadius:6, border:'none', cursor:'pointer',
                background: tipoSelec === t ? C.navy : 'transparent',
                color: tipoSelec === t ? C.white : C.text,
                fontSize:13, fontWeight: tipoSelec === t ? 600 : 400,
                marginBottom:3, transition:'all 0.15s' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Panel referencias */}
        <div style={{ background:C.white, borderRadius:10, padding:20,
          border:`1px solid ${C.grayLt}` }}>
          {!tipoSelec ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:C.gray }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
              <p style={{ fontSize:13 }}>Selecciona un tipo de prueba</p>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                <h2 style={{ fontSize:15, fontWeight:700, color:C.navy, margin:0 }}>
                  {tipoSelec.charAt(0).toUpperCase() + tipoSelec.slice(1)} — Referencias
                </h2>
                <Btn onClick={() => setModalRef({ tipo: tipoSelec, refData: null })}>+ Nueva referencia</Btn>
              </div>

              {refs.length === 0 ? (
                <div style={{ textAlign:'center', padding:'30px 0', color:C.gray }}>
                  <p style={{ fontSize:13 }}>Sin referencias. Crea la primera.</p>
                </div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:C.bg2 }}>
                        {['Código','Nombre','Grados','Estructura','Estado','Acciones'].map(h => (
                          <th key={h} style={{ padding:'8px 12px', textAlign:'left',
                            fontSize:11, fontWeight:600, color:C.gray,
                            textTransform:'uppercase', letterSpacing:'0.04em',
                            whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {refs.map(r => (
                        <tr key={r.id} style={{ borderBottom:`1px solid ${C.bg2}` }}>
                          <td style={{ padding:'10px 12px', fontWeight:600, color:C.navy }}>{r.codigo}</td>
                          <td style={{ padding:'10px 12px', color:C.text }}>{r.nombre}</td>
                          <td style={{ padding:'10px 12px', color:C.gray, fontSize:12 }}>
                            {r.grados?.length > 0
                              ? r.grados.map(g => g === 0 ? 'Pre' : `G${g}`).join(', ')
                              : '—'}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            {r.estructura_excel ? (
                              <button onClick={() => setModalExcel(r)}
                                style={{ display:'flex', alignItems:'center', gap:5,
                                  background:'#EFF6FF', border:'1.5px solid #BFDBFE',
                                  borderRadius:6, padding:'4px 10px', cursor:'pointer',
                                  fontSize:12, fontWeight:600, color:'#1D4ED8',
                                  fontFamily:'Inter' }}>
                                📊 Ver Excel
                              </button>
                            ) : (
                              <span style={{ fontSize:11, color:C.gray }}>—</span>
                            )}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <button onClick={() => handleToggle(r)}
                              style={{ fontSize:11, padding:'3px 10px', borderRadius:10,
                                border:'none', cursor:'pointer', fontWeight:600,
                                background: r.activa ? '#DCFCE7' : '#FEE2E2',
                                color: r.activa ? '#16A34A' : C.red }}>
                              {r.activa ? 'Activa' : 'Inactiva'}
                            </button>
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ display:'flex', gap:6 }}>
                              <Btn small outline onClick={() => setModalRef({ tipo: tipoSelec, refData: r })}>Editar</Btn>
                              <Btn small outline color={C.red} onClick={() => handleDelete(r.id)}>Eliminar</Btn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {modalRef && (
        <ModalReferencia
          pruebaTipo={modalRef.tipo}
          refData={modalRef.refData}
          onClose={() => setModalRef(null)}
          onSaved={() => { setModalRef(null); handleSaved() }}
        />
      )}

      {modalExcel && (
        <ModalVerExcel
          referencia={modalExcel}
          onClose={() => setModalExcel(null)}
        />
      )}
    </div>
  )
}
