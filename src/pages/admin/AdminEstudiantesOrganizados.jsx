import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { C } from '../../components/ui'

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
    padding: '9px 14px', fontSize: 13, fontFamily: 'Inter',
    textAlign: center ? 'center' : 'left',
    borderBottom: `1px solid ${C.bg2}`, color: C.text, ...style,
  }}>{children}</td>
)

export default function AdminEstudiantesOrganizados() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [total, setTotal] = useState(0)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('estudiantes')
      .select('nombre, documento, grado, salon, colegios(nombre, municipio, departamento_nombre)')
    if (!data) { setLoading(false); return }

    const sorted = data
      .filter(e => e.colegios)
      .sort((a, b) => {
        const dep = (a.colegios.departamento_nombre || '').localeCompare(b.colegios.departamento_nombre || '', 'es')
        if (dep !== 0) return dep
        const mun = (a.colegios.municipio || '').localeCompare(b.colegios.municipio || '', 'es')
        if (mun !== 0) return mun
        const col = (a.colegios.nombre || '').localeCompare(b.colegios.nombre || '', 'es')
        if (col !== 0) return col
        const gA = parseInt(a.grado) || 0
        const gB = parseInt(b.grado) || 0
        if (gA !== gB) return gA - gB
        return (a.salon || '').localeCompare(b.salon || '', 'es')
      })

    setRows(sorted)
    setTotal(sorted.length)
    setLoading(false)
  }

  const filtrados = rows.filter(e => {
    if (!buscar) return true
    const q = buscar.toLowerCase()
    return (
      e.nombre?.toLowerCase().includes(q) ||
      e.documento?.toLowerCase().includes(q) ||
      e.colegios?.nombre?.toLowerCase().includes(q) ||
      e.colegios?.municipio?.toLowerCase().includes(q) ||
      e.colegios?.departamento_nombre?.toLowerCase().includes(q)
    )
  })

  // Agrupar por departamento para mostrar separadores
  const grupos = []
  let depActual = null
  let munActual = null
  let colActual = null
  for (const e of filtrados) {
    const dep = e.colegios?.departamento_nombre || '—'
    const mun = e.colegios?.municipio || '—'
    const col = e.colegios?.nombre || '—'
    if (dep !== depActual) {
      grupos.push({ type: 'dep', label: dep })
      depActual = dep; munActual = null; colActual = null
    }
    if (mun !== munActual) {
      grupos.push({ type: 'mun', label: mun })
      munActual = mun; colActual = null
    }
    if (col !== colActual) {
      grupos.push({ type: 'col', label: col })
      colActual = col
    }
    grupos.push({ type: 'row', data: e })
  }

  return (
    <div>
      {/* KPI + búsqueda */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: C.white, borderRadius: 10, padding: '12px 20px',
          border: `1px solid ${C.grayLt}`, boxShadow: '0 1px 4px rgba(10,31,61,0.05)',
          display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>👥</span>
          <div>
            <div style={{ fontSize: 9, color: C.gray, fontFamily: 'Inter',
              textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total estudiantes</div>
            <div style={{ fontSize: 24, fontFamily: 'Playfair Display, serif',
              color: C.navy, fontWeight: 600 }}>{total.toLocaleString('es-CO')}</div>
          </div>
        </div>
        <input
          value={buscar} onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar por nombre, documento, colegio, municipio o departamento..."
          style={{ flex: 1, minWidth: 260, padding: '10px 14px',
            border: `1px solid ${C.grayLt}`, borderRadius: 8,
            fontFamily: 'Inter', fontSize: 13, outline: 'none' }}
        />
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
          <div style={{ overflowX: 'auto', maxHeight: 620, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter' }}>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Nombre</Th>
                  <Th>Documento</Th>
                  <Th center>Grado</Th>
                  <Th center>Salón</Th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let rowNum = 0
                  return grupos.map((g, i) => {
                    if (g.type === 'dep') return (
                      <tr key={`dep-${i}`}>
                        <td colSpan={5} style={{
                          padding: '10px 14px', fontSize: 11, fontWeight: 700,
                          color: C.white, background: C.navy,
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                        }}>📍 {g.label}</td>
                      </tr>
                    )
                    if (g.type === 'mun') return (
                      <tr key={`mun-${i}`}>
                        <td colSpan={5} style={{
                          padding: '8px 24px', fontSize: 11, fontWeight: 600,
                          color: C.navy, background: C.navy + '14',
                          letterSpacing: '0.05em',
                        }}>🏙 {g.label}</td>
                      </tr>
                    )
                    if (g.type === 'col') return (
                      <tr key={`col-${i}`}>
                        <td colSpan={5} style={{
                          padding: '7px 36px', fontSize: 12, fontWeight: 600,
                          color: C.green, background: C.green + '0D',
                          borderBottom: `1px solid ${C.green}30`,
                        }}>🏫 {g.label}</td>
                      </tr>
                    )
                    rowNum++
                    const e = g.data
                    return (
                      <tr key={`row-${i}`} style={{ background: rowNum % 2 === 0 ? C.bg : 'transparent' }}>
                        <Td style={{ color: C.gray, fontSize: 11 }}>{rowNum}</Td>
                        <Td style={{ fontWeight: 500, color: C.navy }}>{e.nombre}</Td>
                        <Td style={{ color: C.gray, fontSize: 12 }}>{e.documento || '—'}</Td>
                        <Td center>
                          <span style={{ background: C.navy + '12', color: C.navy,
                            padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
                            {e.grado}°
                          </span>
                        </Td>
                        <Td center style={{ color: C.gray }}>{e.salon || '—'}</Td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
