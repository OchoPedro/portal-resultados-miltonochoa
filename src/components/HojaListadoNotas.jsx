// Listado de Notas imprimible: la MISMA tabla que se ve en pantalla, en papel.
//
// Sustituye al lote de hojas por estudiante en el botón "Descargar PDF" de esa pestaña: ahí lo
// que se quiere es el consolidado del salón en pocas hojas, no 24 hojas de respuestas.
//
// No recalcula nada. Recibe las filas con su valor y su color ya resueltos por
// ColegioDashboard, que es donde viven `areaVal`, `semaforoColor` y los pesos del Tablero de
// Gestión. Duplicar aquí esa aritmética es exactamente lo que produjo que el rector y el
// alumno vieran dos números distintos del mismo examen (ver src/lib/areas.js).
//
// Cabe en A4 vertical: 190mm ≈ 718px, y las columnas suman ~718 con la fuente de 7pt.

const NAVY = '#0F2C52'

export default function HojaListadoNotas({
  colegio, prueba, grado, salon, pctScopeLabel,
  columnas,            // [{ label, cols: [[col, encabezado], …] }]
  showAreaCol, areaHdr,
  filas,               // [{ n, nombre, notas:{col:{texto,color}}, area, def, global, pct, pctColor }]
}) {
  const th = { background: NAVY, color: '#fff', fontSize: 6.8, fontWeight: 700,
    textAlign: 'center', padding: '3px 2px', border: '1px solid #1e3a5f' }
  const td = (extra = {}) => ({ fontSize: 7, textAlign: 'center', padding: '2.5px 2px',
    border: '1px solid #CBD5E1', ...extra })

  const nCols = 2 + columnas.reduce((s, a) => s + a.cols.length, 0) + (showAreaCol ? 1 : 0) + 3

  return (
    <section className="hoja-listado">
      <header style={{ background: NAVY, color: '#fff', padding: '8px 12px', fontSize: 9, lineHeight: 1.5 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Listado de Notas</div>
        <div>
          <strong>Colegio:</strong> {colegio?.nombre || '—'}
          {colegio?.municipio ? <> &nbsp;|&nbsp; <strong>Ciudad:</strong> {colegio.municipio}
            {colegio?.departamento ? ` - ${colegio.departamento}` : ''}</> : null}
        </div>
        <div>
          <strong>Prueba:</strong> {prueba?.codigo || '—'}
          {prueba?.fecha ? <> &nbsp;|&nbsp; <strong>Fecha:</strong> {prueba.fecha}</> : null}
          &nbsp;|&nbsp; <strong>Grado:</strong> {grado || 'Todos'}
          &nbsp;|&nbsp; <strong>Salón:</strong> {salon || 'Todos'}
          &nbsp;|&nbsp; <strong>Estudiantes:</strong> {filas.length}
        </div>
      </header>

      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed', marginTop: 8 }}>
        <colgroup>
          <col style={{ width: 22 }} />
          {/* 140 y no más: con las 10 asignaturas la tabla queda en ~186mm de los 190mm útiles
              del A4 vertical. Sin esa holgura de ~4mm el navegador recorta la última columna. */}
          <col style={{ width: 140 }} />
          {columnas.flatMap(a => a.cols.map(([col]) => <col key={col} style={{ width: 40 }} />))}
          {showAreaCol && <col style={{ width: 44 }} />}
          <col style={{ width: 42 }} />
          <col style={{ width: 42 }} />
          <col style={{ width: 34 }} />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} style={th}>#</th>
            <th rowSpan={2} style={{ ...th, textAlign: 'left', paddingLeft: 6 }}>Nombre Estudiante</th>
            {columnas.map(a => (
              <th key={a.label} colSpan={a.cols.length} style={th}>{a.label}</th>
            ))}
            {showAreaCol && (
              <th rowSpan={2} style={th}>Área<span style={{ display: 'block', fontSize: 6, color: '#93c5fd' }}>{areaHdr}</span></th>
            )}
            <th rowSpan={2} style={th}>Def.</th>
            <th rowSpan={2} style={th}>Global<span style={{ display: 'block', fontSize: 6, color: '#86efac' }}>0–500</span></th>
            <th rowSpan={2} style={th}>Pctil</th>
          </tr>
          <tr>
            {columnas.flatMap(a => a.cols.map(([col, h]) => (
              <th key={col} style={{ ...th, fontSize: 6.2 }}>{h}</th>
            )))}
          </tr>
        </thead>
        <tbody>
          {filas.map(f => (
            <tr key={f.n}>
              <td style={td({ fontWeight: 600 })}>{f.n}</td>
              <td style={td({ textAlign: 'left', paddingLeft: 6, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis' })}>{f.nombre}</td>
              {columnas.flatMap(a => a.cols.map(([col]) => {
                const c = f.notas[col] || {}
                return <td key={col} style={td({ color: c.color, fontWeight: 600 })}>{c.texto ?? '—'}</td>
              }))}
              {showAreaCol && (
                <td style={td({ color: f.area?.color, fontWeight: 700, background: '#F1F5F9' })}>
                  {f.area?.texto ?? '—'}
                </td>
              )}
              <td style={td({ color: f.def?.color, fontWeight: 700 })}>{f.def?.texto ?? '—'}</td>
              <td style={td({ fontWeight: 700, color: NAVY, fontSize: 8 })}>{f.global ?? '—'}</td>
              <td style={td({ fontWeight: 600, color: f.pctColor })}>{f.pct != null ? `${f.pct}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
        {/* La leyenda va en un tfoot para que el navegador la repita al pie de CADA página del
            tiro; suelta debajo de la tabla solo saldría en la última. */}
        <tfoot>
          <tr>
            <td colSpan={nCols} style={{ padding: '4px 2px', fontSize: 6.5, color: '#475569',
              border: '1px solid #CBD5E1', textAlign: 'left' }}>
              {[['Nivel 1', '#E05252'], ['Nivel 2', '#F97316'], ['Nivel 3', '#F59E0B'], ['Nivel 4', '#2D9B6F']]
                .map(([l, c]) => (
                  <span key={l} style={{ marginRight: 10, whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, background: c,
                      marginRight: 3, verticalAlign: 'middle' }} />{l}
                  </span>
                ))}
              <span style={{ marginLeft: 6 }}>Percentil calculado sobre: {pctScopeLabel || 'plantel'}.</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  )
}
