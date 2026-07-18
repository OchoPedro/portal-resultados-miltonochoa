// Hoja de resultados de UN estudiante, pensada para imprimirse (o guardarse como PDF desde el
// diálogo del navegador). Se usa igual en modo colegio y en modo estudiante.
//
// Deliberadamente NO usa las utilidades de layout de la app (Card, TabBar…): tienen sombras,
// bordes redondeados y fondos que en papel salen mal. Aquí se maqueta con estilos planos.
//
// El cruce pregunta↔respuesta se delega en src/lib/preguntas.js. No reimplementar aquí: la
// llave es la posición global de fila, y equivocarse produce una hoja que se ve bien y miente.
import { construirPreguntas, mapaDetalle, ASIGNATURAS, resumenAciertos } from '../lib/preguntas'

const NAVY = '#0F2C52'

export default function HojaResultados({ estudiante, resultado, detalle, prueba, colegio }) {
  const preguntas = construirPreguntas(prueba?.estructura_excel)
  const dmap = mapaDetalle(detalle)
  const { aciertos, respondidas, total } = resumenAciertos(preguntas, dmap)

  const th = { padding: '3px 4px', background: NAVY, color: '#fff', fontSize: 7.5,
    fontWeight: 600, textAlign: 'center', border: '1px solid #234' }
  const td = (extra = {}) => ({ padding: '2px 4px', fontSize: 7.5, textAlign: 'center',
    border: '1px solid #CBD5E1', ...extra })
  const meta = { fontSize: 9, lineHeight: 1.55 }

  return (
    <section className="hoja-resultados">
      <header style={{ background: NAVY, color: '#fff', padding: '10px 14px', ...meta }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          {estudiante?.nombre || '—'}
        </div>
        <div>
          <strong>Colegio:</strong> {colegio?.nombre || '—'}
          {colegio?.municipio ? <> &nbsp;|&nbsp; <strong>Ciudad:</strong> {colegio.municipio}
            {colegio?.departamento ? ` - ${colegio.departamento}` : ''}</> : null}
        </div>
        <div>
          <strong>Usuario:</strong> {estudiante?.usuario || '—'} &nbsp;|&nbsp;
          <strong>Grado:</strong> {estudiante?.grado || '—'} &nbsp;|&nbsp;
          <strong>Salón:</strong> {estudiante?.salon || '—'}
        </div>
        <div>
          <strong>Prueba:</strong> {prueba?.codigo || '—'}
          {prueba?.tipo ? <> &nbsp;|&nbsp; <strong>Producto:</strong> {prueba.tipo}</> : null}
          {prueba?.fecha ? <> &nbsp;|&nbsp; <strong>Fecha:</strong> {prueba.fecha}</> : null}
        </div>
      </header>

      <div style={{ display: 'flex', gap: 10, margin: '10px 0', ...meta }}>
        <div style={{ border: `1px solid ${NAVY}`, padding: '6px 12px', minWidth: 110 }}>
          <div style={{ fontSize: 8, color: '#475569' }}>Puntaje global</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>
            {resultado?.puntaje_global ?? '—'}
          </div>
        </div>
        <div style={{ border: '1px solid #CBD5E1', padding: '6px 12px', minWidth: 110 }}>
          <div style={{ fontSize: 8, color: '#475569' }}>Desempeño</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>
            {resultado?.desempeno_pct != null ? `${resultado.desempeno_pct}%` : '—'}
          </div>
        </div>
        <div style={{ border: '1px solid #CBD5E1', padding: '6px 12px', flex: 1 }}>
          <div style={{ fontSize: 8, color: '#475569' }}>Respuestas</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, paddingTop: 4 }}>
            {aciertos} correctas de {total} &nbsp;·&nbsp; {respondidas} respondidas
            &nbsp;·&nbsp; {total - respondidas} sin responder o anuladas
          </div>
        </div>
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 10 }}>
        <thead>
          <tr>{ASIGNATURAS.map(a => <th key={a.key} style={th}>{a.label}</th>)}</tr>
        </thead>
        <tbody>
          <tr>
            {ASIGNATURAS.map(a => (
              <td key={a.key} style={td({ fontWeight: 700, fontSize: 9 })}>
                {resultado?.[a.key] ?? '—'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {!preguntas.length || !detalle ? (
        <div style={{ padding: 20, fontSize: 10, color: '#475569' }}>
          No hay detalle de respuestas disponible para esta prueba.
        </div>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {['Ses.', 'No', 'Área', 'Asignatura', 'Componente', 'Competencia', 'Rta', 'Resp.']
                .map(h => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {preguntas.map((q, i) => {
              const d = dmap[q.gpos]
              // `correcto` es tri-estado: true / false / ausente. Comparar contra true y false
              // explícitamente; un `!d.correcto` pintaría de rojo las no respondidas.
              const bg = d?.correcto === true ? '#DCFCE7'
                       : d?.correcto === false ? '#FEE2E2' : '#fff'
              return (
                <tr key={i}>
                  <td style={td()}>{q.sesion}</td>
                  <td style={td()}>{q.nro}</td>
                  <td style={td({ textAlign: 'left' })}>{q.area}</td>
                  <td style={td({ textAlign: 'left' })}>{q.materia}</td>
                  <td style={td({ textAlign: 'left' })}>{q.componente}</td>
                  <td style={td({ textAlign: 'left' })}>{q.competencia}</td>
                  <td style={td({ background: bg, fontWeight: 700 })}>{q.rta || '—'}</td>
                  <td style={td({ background: bg, fontWeight: 700 })}>{d?.marcada || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
