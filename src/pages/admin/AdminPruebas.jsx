import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { C, useMobile } from '../../components/ui'
import * as XLSX from 'xlsx'

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
        const binary = evt.target.result
        const wb = XLSX.read(binary, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        // Detectar fila de headers: buscar la fila con más celdas no vacías
        let headerRowIndex = 0
        let maxFilled = 0
        allRows.slice(0, 5).forEach((row, i) => {
          const filled = row.filter(c => c !== '' && c !== null && c !== undefined).length
          if (filled > maxFilled) { maxFilled = filled; headerRowIndex = i }
        })

        const metaRows = allRows.slice(0, headerRowIndex)
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
          raw: allRows,
          file, // archivo original para subir a Storage
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

  // Índices de columnas filtrables en orden de cascada
  const FILTER_COLS = ['Sesión', 'Área', 'Asignatura', 'Ciclo MEN', 'Competencia', 'Componente', 'Dificultad']
  const filterableCols = FILTER_COLS
    .map(name => ({ name, idx: headers.findIndex(h => String(h) === name) }))
    .filter(c => c.idx !== -1)

  const [filters, setFilters] = useState({})

  // Filas que pasan los filtros HASTA la columna anterior (para cascada)
  const getRowsUpTo = (colName) => {
    const colsBeforeThis = filterableCols.slice(0, filterableCols.findIndex(c => c.name === colName))
    return allRows.filter(row =>
      colsBeforeThis.every(col => {
        const active = filters[col.name]
        if (!active) return true
        return String(row[col.idx] ?? '') === active
      })
    )
  }

  // Opciones únicas por columna — solo de filas que pasan filtros anteriores (cascada)
  const getOptions = (col) => {
    const relevantRows = getRowsUpTo(col.name)
    const vals = [...new Set(relevantRows.map(r => String(r[col.idx] ?? '')))]
      .filter(v => v !== '').sort()
    return vals
  }

  // Cuando cambia un filtro, limpiar los filtros de columnas posteriores
  const handleFilterChange = (colName, value) => {
    const colOrder = filterableCols.findIndex(c => c.name === colName)
    const newFilters = { ...filters }
    // Limpiar filtros de columnas posteriores
    filterableCols.slice(colOrder + 1).forEach(c => delete newFilters[c.name])
    if (value) newFilters[colName] = value
    else delete newFilters[colName]
    setFilters(newFilters)
  }

  // Filas filtradas con todos los filtros activos
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

  // Descarga — usa el archivo original de Storage si existe
  const handleDownload = async () => {
    if (referencia.excel_url) {
      // Descargar el archivo original con formato completo
      const link = document.createElement('a')
      link.href = referencia.excel_url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      return
    }
    // Fallback: reconstruir desde datos parseados
    const wb = XLSX.utils.book_new()
    const dataToExport = [
      ...(meta.length > 0 ? meta : []),
      headers,
      ...filteredRows,
    ]
    const ws = XLSX.utils.aoa_to_sheet(dataToExport)
    XLSX.utils.book_append_sheet(wb, ws, 'Prueba')
    XLSX.writeFile(wb, fileName)
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
            {filterableCols.map(col => {
              const options = getOptions(col)
              const isDisabled = options.length === 0
              return (
                <select key={col.name}
                  value={filters[col.name] || ''}
                  disabled={isDisabled}
                  onChange={e => handleFilterChange(col.name, e.target.value)}
                  style={{ padding:'5px 10px', borderRadius:6, border:`1px solid ${C.grayLt}`,
                    fontSize:12, fontFamily:'Inter', color: isDisabled ? C.gray : C.text,
                    background: isDisabled ? C.bg2 : C.white,
                    cursor: isDisabled ? 'not-allowed' : 'pointer', outline:'none',
                    borderColor: filters[col.name] ? C.green : C.grayLt,
                    fontWeight: filters[col.name] ? 600 : 400,
                    opacity: isDisabled ? 0.5 : 1 }}>
                  <option value="">{col.name} ({options.length})</option>
                  {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )
            })}
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

    // Subir archivo original a Storage si hay uno nuevo
    let excelUrl = refData?.excel_url || null
    let excelData = excelParsed ? { ...excelParsed } : (refData?.estructura_excel || null)

    if (excelParsed?.file) {
      const filePath = `${pruebaTipo}/${form.codigo.trim()}_${Date.now()}.xlsx`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('pruebas-excel')
        .upload(filePath, excelParsed.file, { upsert: true, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

      if (uploadErr) { setSaving(false); return setError(`Error al subir Excel: ${uploadErr.message}`) }

      const { data: urlData } = supabase.storage.from('pruebas-excel').getPublicUrl(filePath)
      excelUrl = urlData.publicUrl

      // Guardar datos parseados sin el objeto File (no serializable)
      const { file: _, ...parsedWithoutFile } = excelParsed
      excelData = parsedWithoutFile
    }

    const payload = {
      tipo: pruebaTipo,
      codigo: form.codigo.trim(),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      grados: form.grados,
      estructura_excel: excelData,
      excel_url: excelUrl,
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

// ── MODAL EQUILIBRIO DE PRUEBA ────────────────────────────────
function ModalEquilibrio({ referencia, onClose }) {
  const excel = referencia.estructura_excel || {}
  const headers = excel.headers || []
  const allRows = excel.rows || []

  // Índices de columnas clave — guarda contra findIndex retornando -1
  const idx = (name) => headers.findIndex(h => String(h).trim().toLowerCase() === name.toLowerCase())
  const iArea        = idx('Área') >= 0 ? idx('Área') : idx('Area')
  const iCompetencia = idx('Competencia')
  const iComponente  = idx('Componente')
  const iDificultad  = idx('Dificultad')
  const safeGet = (row, i) => i >= 0 ? String(row[i] ?? '') : ''

  // Áreas disponibles
  const areas = [...new Set(allRows.map(r => safeGet(r, iArea)).filter(Boolean))].sort()
  const [areaSelec, setAreaSelec] = useState(areas[0] || '')

  // Filtrar por área
  const rowsFiltradas = areaSelec
    ? allRows.filter(r => safeGet(r, iArea) === areaSelec)
    : allRows

  // Valores únicos de competencia, componente y dificultad
  const competencias = [...new Set(rowsFiltradas.map(r => safeGet(r, iCompetencia)).filter(Boolean))].sort()
  const componentes  = [...new Set(rowsFiltradas.map(r => safeGet(r, iComponente)).filter(Boolean))].sort()
  const dificultades = ['Bajo', 'Básico', 'Alto', 'Superior'].filter(d =>
    rowsFiltradas.some(r => safeGet(r, iDificultad) === d)
  )

  // Construir matriz: componente → competencia → dificultad → count
  const matriz = {}
  componentes.forEach(comp => {
    matriz[comp] = {}
    competencias.forEach(competencia => {
      matriz[comp][competencia] = {}
      dificultades.forEach(dif => { matriz[comp][competencia][dif] = 0 })
    })
  })
  rowsFiltradas.forEach(row => {
    const comp       = safeGet(row, iComponente)
    const competencia = safeGet(row, iCompetencia)
    const dif        = safeGet(row, iDificultad)
    if (matriz[comp]?.[competencia]?.[dif] !== undefined) {
      matriz[comp][competencia][dif]++
    }
  })

  // Totales por competencia+dificultad
  const totales = {}
  competencias.forEach(competencia => {
    totales[competencia] = {}
    dificultades.forEach(dif => {
      totales[competencia][dif] = componentes.reduce((sum, comp) => sum + (matriz[comp]?.[competencia]?.[dif] || 0), 0)
    })
  })

  // Total general por componente
  const totalComp = (comp) => competencias.reduce((s1, competencia) =>
    s1 + dificultades.reduce((s2, dif) => s2 + (matriz[comp]?.[competencia]?.[dif] || 0), 0), 0)

  // Total general global
  const totalGlobal = componentes.reduce((s, comp) => s + totalComp(comp), 0)

  // Color por dificultad
  const difColor = { Alto:'#DC2626', Básico:'#D97706', Bajo:'#2563EB', Superior:'#7C3AED' }
  const difBg    = { Alto:'#FEF2F2', Básico:'#FFFBEB', Bajo:'#EFF6FF', Superior:'#F5F3FF' }

  const noData = iArea === -1 || iCompetencia === -1 || iComponente === -1 || iDificultad === -1

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100 }}>
      <div style={{ background:C.white, borderRadius:16, width:'96%', maxWidth:1300,
        maxHeight:'92vh', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 80px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${C.grayLt}`,
          display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:22 }}>⚖️</span>
              <h2 style={{ fontSize:18, fontWeight:700, color:C.navy, margin:0, fontFamily:'Inter' }}>
                Equilibrio de Prueba
              </h2>
            </div>
            <p style={{ fontSize:13, color:C.gray, margin:'4px 0 0', fontFamily:'Inter' }}>
              {referencia.nombre} · {rowsFiltradas.length} preguntas
              {areaSelec && ` · Área: ${areaSelec}`}
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none',
            fontSize:24, cursor:'pointer', color:C.gray }}>✕</button>
        </div>

        {/* Filtro área */}
        {areas.length > 1 && (
          <div style={{ padding:'12px 28px', borderBottom:`1px solid ${C.bg2}`,
            display:'flex', alignItems:'center', gap:10, flexShrink:0, background:C.bg }}>
            <span style={{ fontSize:12, fontWeight:600, color:C.gray, fontFamily:'Inter',
              textTransform:'uppercase', letterSpacing:'0.05em' }}>Área:</span>
            {areas.map(a => (
              <button key={a} onClick={() => setAreaSelec(a)}
                style={{ padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer',
                  fontFamily:'Inter', fontSize:12, fontWeight:600, transition:'all 0.15s',
                  background: areaSelec === a ? C.navy : C.bg2,
                  color: areaSelec === a ? C.white : C.text }}>
                {a}
              </button>
            ))}
            <button onClick={() => setAreaSelec('')}
              style={{ padding:'5px 14px', borderRadius:20, cursor:'pointer', fontFamily:'Inter',
                fontSize:12, fontWeight:600, border:`1px solid ${C.grayLt}`,
                background: !areaSelec ? C.green : 'transparent',
                color: !areaSelec ? C.white : C.gray }}>
              Todas
            </button>
          </div>
        )}

        {noData ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
            color:C.gray, fontFamily:'Inter', fontSize:14 }}>
            El archivo Excel no tiene las columnas necesarias (Área, Competencia, Componente, Dificultad)
          </div>
        ) : (
          <div style={{ flex:1, overflowY:'auto', overflowX:'auto', padding:'24px 28px' }}>

            {/* Leyenda dificultades */}
            <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
              {dificultades.map(d => (
                <div key={d} style={{ display:'flex', alignItems:'center', gap:6,
                  background: difBg[d] || '#F9FAFB', borderRadius:20,
                  padding:'4px 12px', border:`1px solid ${difColor[d] || C.grayLt}` }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: difColor[d] || C.gray }}/>
                  <span style={{ fontSize:12, fontWeight:600, color: difColor[d] || C.text, fontFamily:'Inter' }}>{d}</span>
                </div>
              ))}
              <div style={{ marginLeft:'auto', fontSize:12, color:C.gray, fontFamily:'Inter',
                display:'flex', alignItems:'center' }}>
                Total: <strong style={{ color:C.navy, marginLeft:4 }}>{totalGlobal} preguntas</strong>
              </div>
            </div>

            {/* Tabla matriz */}
            <div style={{ borderRadius:12, overflowX:'auto', border:`1px solid ${C.grayLt}`,
              boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:'Inter' }}>
                <thead>
                  {/* Fila 1: Competencias (agrupadas) */}
                  <tr>
                    <th rowSpan={2} style={{ padding:'14px 16px', background:C.navy, color:C.white,
                      fontSize:12, fontWeight:700, textAlign:'left', minWidth:180,
                      borderRight:'2px solid rgba(255,255,255,0.2)', verticalAlign:'middle' }}>
                      Componente
                    </th>
                    {competencias.map(competencia => (
                      <th key={competencia} colSpan={dificultades.length}
                        style={{ padding:'10px 8px', background:'#1E3A5F', color:C.white,
                          fontSize:11, fontWeight:700, textAlign:'center',
                          borderRight:'2px solid rgba(255,255,255,0.15)',
                          borderBottom:'1px solid rgba(255,255,255,0.2)',
                          maxWidth: dificultades.length * 60 }}>
                        <div style={{ maxWidth: dificultades.length * 70,
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                          margin:'0 auto' }} title={competencia}>
                          {competencia}
                        </div>
                      </th>
                    ))}
                    <th style={{ padding:'10px 8px', background:'#0F2A45', color:C.white,
                      fontSize:11, fontWeight:700, textAlign:'center', minWidth:60 }}>
                      Total
                    </th>
                  </tr>
                  {/* Fila 2: Dificultades */}
                  <tr>
                    {competencias.map(competencia =>
                      dificultades.map(dif => (
                        <th key={`${competencia}-${dif}`}
                          style={{ padding:'7px 6px', textAlign:'center',
                            background: difBg[dif] || '#F9FAFB',
                            color: difColor[dif] || C.text,
                            fontSize:10, fontWeight:700,
                            borderRight:'1px solid #E5E7EB',
                            borderBottom:'2px solid #D1D5DB',
                            minWidth:52 }}>
                          {dif}
                        </th>
                      ))
                    )}
                    <th style={{ padding:'7px 6px', background:'#F1F5F9', fontSize:10,
                      fontWeight:700, color:C.gray, textAlign:'center',
                      borderBottom:'2px solid #D1D5DB' }}/>
                  </tr>
                </thead>
                <tbody>
                  {componentes.map((comp, ri) => {
                    const totalFila = totalComp(comp)
                    return (
                      <tr key={comp} style={{ background: ri % 2 === 0 ? C.white : '#F8FAFC' }}>
                        <td style={{ padding:'11px 16px', fontWeight:600, color:C.navy,
                          borderRight:'2px solid #E5E7EB', borderBottom:'1px solid #F1F5F9',
                          background: ri % 2 === 0 ? '#F8FAFC' : '#EEF2F7' }}>
                          {comp}
                        </td>
                        {competencias.map(competencia =>
                          dificultades.map(dif => {
                            const val = matriz[comp]?.[competencia]?.[dif] || 0
                            return (
                              <td key={`${competencia}-${dif}`}
                                style={{ padding:'11px 6px', textAlign:'center',
                                  borderRight:'1px solid #F1F5F9',
                                  borderBottom:'1px solid #F1F5F9',
                                  fontWeight: val > 0 ? 700 : 400,
                                  color: val > 0 ? (difColor[dif] || C.text) : '#CBD5E1',
                                  fontSize: val > 0 ? 14 : 12 }}>
                                {val > 0 ? val : '·'}
                              </td>
                            )
                          })
                        )}
                        <td style={{ padding:'11px 8px', textAlign:'center', fontWeight:700,
                          color: totalFila > 0 ? C.navy : C.gray, fontSize:13,
                          background: ri % 2 === 0 ? '#EEF2F7' : '#E4EAF2',
                          borderBottom:'1px solid #F1F5F9',
                          borderLeft:'2px solid #E5E7EB' }}>
                          {totalFila || '·'}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Fila total */}
                  <tr style={{ background:'#1E3A5F' }}>
                    <td style={{ padding:'12px 16px', fontWeight:700, color:C.white,
                      fontSize:12, borderRight:'2px solid rgba(255,255,255,0.2)' }}>
                      Total General
                    </td>
                    {competencias.map(competencia =>
                      dificultades.map(dif => {
                        const val = totales[competencia]?.[dif] || 0
                        return (
                          <td key={`total-${competencia}-${dif}`}
                            style={{ padding:'12px 6px', textAlign:'center',
                              fontWeight:700, color: val > 0 ? C.white : 'rgba(255,255,255,0.3)',
                              fontSize: val > 0 ? 14 : 12,
                              borderRight:'1px solid rgba(255,255,255,0.1)' }}>
                            {val > 0 ? val : '·'}
                          </td>
                        )
                      })
                    )}
                    <td style={{ padding:'12px 8px', textAlign:'center', fontWeight:800,
                      color:C.white, fontSize:15,
                      borderLeft:'2px solid rgba(255,255,255,0.2)' }}>
                      {totalGlobal}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────────
export default function AdminPruebas({ onUpdate }) {
  const mobile = useMobile()
  const [pruebas, setPruebas] = useState([])
  const [tipoSelec, setTipoSelec] = useState(null)
  const [modalRef, setModalRef] = useState(null)
  const [modalExcel, setModalExcel] = useState(null)
  const [modalEquilibrio, setModalEquilibrio] = useState(null)
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

      <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr' : '220px 1fr', gap:20 }}>
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
            <div style={{ textAlign:'center', padding: mobile ? '20px 0' : '40px 0', color:C.gray }}>
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
                              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                                <button onClick={() => setModalExcel(r)}
                                  style={{ display:'flex', alignItems:'center', gap:5,
                                    background:'#EFF6FF', border:'1.5px solid #BFDBFE',
                                    borderRadius:6, padding:'4px 10px', cursor:'pointer',
                                    fontSize:12, fontWeight:600, color:'#1D4ED8',
                                    fontFamily:'Inter' }}>
                                  📊 Detalle Prueba
                                </button>
                                <button onClick={() => setModalEquilibrio(r)}
                                  style={{ display:'flex', alignItems:'center', gap:5,
                                    background:'#F0FDF4', border:'1.5px solid #86EFAC',
                                    borderRadius:6, padding:'4px 10px', cursor:'pointer',
                                    fontSize:12, fontWeight:600, color:'#15803D',
                                    fontFamily:'Inter' }}>
                                  ⚖️ Equilibrio
                                </button>
                              </div>
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

      {modalEquilibrio && (
        <ModalEquilibrio
          referencia={modalEquilibrio}
          onClose={() => setModalEquilibrio(null)}
        />
      )}
    </div>
  )
}
