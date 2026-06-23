import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { C } from '../../components/ui'

const Th = ({ children }) => (
  <th style={{
    padding: '9px 14px', fontSize: 10, fontWeight: 600, color: C.gray,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: `2px solid ${C.bg2}`, textAlign: 'left',
    background: C.white, position: 'sticky', top: 0, whiteSpace: 'nowrap',
  }}>{children}</th>
)

const Td = ({ children, style = {} }) => (
  <td style={{
    padding: '10px 14px', fontSize: 13, fontFamily: 'Inter',
    borderBottom: `1px solid ${C.bg2}`, color: C.text, ...style,
  }}>{children}</td>
)

const FilterInput = ({ placeholder, value, onChange }) => (
  <input
    value={value} onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      padding: '8px 12px', border: `1px solid ${C.grayLt}`, borderRadius: 7,
      fontFamily: 'Inter', fontSize: 12, outline: 'none', width: '100%',
      background: C.white, color: C.text,
    }}
  />
)

const FilterSelect = ({ value, onChange, options, placeholder }) => (
  <select
    value={value} onChange={e => onChange(e.target.value)}
    style={{
      padding: '8px 12px', border: `1px solid ${C.grayLt}`, borderRadius: 7,
      fontFamily: 'Inter', fontSize: 12, outline: 'none', width: '100%',
      background: C.white, color: value ? C.text : C.gray, cursor: 'pointer',
    }}
  >
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
)

export default function AdminEstudiantesOrganizados() {
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)

  const [fNombre, setFNombre]   = useState('')
  const [fDep, setFDep]         = useState('')
  const [fMun, setFMun]         = useState('')
  const [fColegio, setFColegio] = useState('')
  const [fUsuario, setFUsuario] = useState('')

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const [{ data: colegiosData }, { data: estudiantesData }] = await Promise.all([
      supabase.from('colegios').select('id, nombre, municipio, departamento_nombre'),
      supabase.from('estudiantes').select('nombre, usuario, colegio_id').limit(5000),
    ])

    const colMap = {}
    for (const c of (colegiosData || [])) colMap[c.id] = c

    const joined = (estudiantesData || []).map(e => ({
      nombre:       e.nombre,
      usuario:      e.usuario,
      departamento: colMap[e.colegio_id]?.departamento_nombre || '—',
      municipio:    colMap[e.colegio_id]?.municipio || '—',
      colegio:      colMap[e.colegio_id]?.nombre || '—',
    })).sort((a, b) => {
      const d = a.departamento.localeCompare(b.departamento, 'es')
      if (d !== 0) return d
      const m = a.municipio.localeCompare(b.municipio, 'es')
      if (m !== 0) return m
      const c = a.colegio.localeCompare(b.colegio, 'es')
      if (c !== 0) return c
      return a.nombre.localeCompare(b.nombre, 'es')
    })

    setRows(joined)
    setLoading(false)
  }

  const departamentos = useMemo(() => [...new Set(rows.map(r => r.departamento).filter(Boolean))].sort(), [rows])
  const municipios    = useMemo(() => [...new Set(rows.filter(r => !fDep || r.departamento === fDep).map(r => r.municipio).filter(Boolean))].sort(), [rows, fDep])
  const colegios      = useMemo(() => [...new Set(rows.filter(r => (!fDep || r.departamento === fDep) && (!fMun || r.municipio === fMun)).map(r => r.colegio).filter(Boolean))].sort(), [rows, fDep, fMun])

  const filtrados = useMemo(() => rows.filter(r => {
    if (fNombre  && !r.nombre.toLowerCase().includes(fNombre.toLowerCase()))   return false
    if (fDep     && r.departamento !== fDep)  return false
    if (fMun     && r.municipio    !== fMun)  return false
    if (fColegio && r.colegio      !== fColegio) return false
    if (fUsuario && !r.usuario?.toLowerCase().includes(fUsuario.toLowerCase())) return false
    return true
  }), [rows, fNombre, fDep, fMun, fColegio, fUsuario])

  const hayFiltros = fNombre || fDep || fMun || fColegio || fUsuario
  const limpiar = () => { setFNombre(''); setFDep(''); setFMun(''); setFColegio(''); setFUsuario('') }

  return (
    <div>
      {/* KPI */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: C.white, borderRadius: 10, padding: '12px 20px',
          border: `1px solid ${C.grayLt}`, boxShadow: '0 1px 4px rgba(10,31,61,0.05)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 22 }}>👥</span>
          <div>
            <div style={{ fontSize: 9, color: C.gray, fontFamily: 'Inter',
              textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {hayFiltros ? 'Resultados' : 'Total estudiantes'}
            </div>
            <div style={{ fontSize: 24, fontFamily: 'Playfair Display, serif', color: C.navy, fontWeight: 600 }}>
              {loading ? '…' : filtrados.length.toLocaleString('es-CO')}
              {hayFiltros && <span style={{ fontSize: 12, color: C.gray, fontWeight: 400 }}> / {rows.length.toLocaleString('es-CO')}</span>}
            </div>
          </div>
        </div>
        {hayFiltros && (
          <button onClick={limpiar} style={{
            padding: '8px 16px', border: `1px solid ${C.grayLt}`, borderRadius: 7,
            background: C.white, color: C.gray, fontFamily: 'Inter', fontSize: 12,
            cursor: 'pointer',
          }}>✕ Limpiar filtros</button>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
        <FilterInput placeholder="Buscar nombre..." value={fNombre} onChange={v => setFNombre(v)} />
        <FilterSelect placeholder="Todos los departamentos" value={fDep} onChange={v => { setFDep(v); setFMun(''); setFColegio('') }} options={departamentos} />
        <FilterSelect placeholder="Todos los municipios" value={fMun} onChange={v => { setFMun(v); setFColegio('') }} options={municipios} />
        <FilterSelect placeholder="Todos los colegios" value={fColegio} onChange={setFColegio} options={colegios} />
        <FilterInput placeholder="Buscar usuario..." value={fUsuario} onChange={setFUsuario} />
      </div>

      {/* Tabla */}
      <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.grayLt}`,
        overflow: 'hidden', boxShadow: '0 1px 4px rgba(10,31,61,0.05)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.gray, fontFamily: 'Inter' }}>
            Cargando estudiantes...
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.gray, fontFamily: 'Inter' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
            {rows.length === 0 ? 'Aún no hay estudiantes registrados.' : 'No se encontraron resultados.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 560, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter' }}>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Nombre</Th>
                  <Th>Departamento</Th>
                  <Th>Municipio</Th>
                  <Th>Colegio</Th>
                  <Th>Usuario</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((e, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? C.bg : 'transparent' }}>
                    <Td style={{ color: C.gray, fontSize: 11, width: 40 }}>{i + 1}</Td>
                    <Td style={{ fontWeight: 600, color: C.navy }}>{e.nombre}</Td>
                    <Td style={{ color: C.gray, fontSize: 12 }}>{e.departamento}</Td>
                    <Td style={{ color: C.gray, fontSize: 12 }}>{e.municipio}</Td>
                    <Td style={{ fontSize: 12 }}>{e.colegio}</Td>
                    <Td>
                      <span style={{ background: C.navy + '12', color: C.navy,
                        padding: '2px 10px', borderRadius: 10, fontSize: 12, fontFamily: 'monospace' }}>
                        {e.usuario || '—'}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
