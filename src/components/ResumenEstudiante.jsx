// Resumen gráfico de UN estudiante en UNA página, pensado para entregar al acudiente.
//
// Complementa (no reemplaza) a HojaResultados: aquella es la hoja pregunta-por-pregunta para
// revisar en detalle; esta es la foto de una sola página con gráficas.
//
// ── Por qué los gráficos llevan tamaño fijo en px y NO ResponsiveContainer ──────────────────
// ResponsiveContainer mide su contenedor con un ResizeObserver y pinta el SVG en un segundo
// commit, ASÍNCRONO. `useImpresion` llama a window.print() —que es síncrono— tras dos
// requestAnimationFrame, calibrados para markup síncrono. Con ResponsiveContainer el diálogo
// de impresión alcanza a abrirse antes de que el SVG exista y la gráfica sale como un hueco en
// blanco, sin ningún error en consola. Con width/height fijos Recharts pinta en el mismo commit.
// Por lo mismo va isAnimationActive={false}: una barra animada se captura a media altura.
//
// El ancho está atado a #print-root (210mm) menos los márgenes de @page (10mm por lado):
// 190mm ≈ 718px a 96dpi. De ahí ANCHO = 700.
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import {
  ASIGNATURAS, AREAS, AREA_CORTA, valorDe,
  semaforoNivel, NIVEL_LABEL, NIVEL_COLOR,
} from '../lib/areas'

const NAVY = '#0F2C52'
const GRIS_COMP = '#94A3B8'   // barra del comparativo: neutra, para que no compita con el color del semáforo
const ANCHO = 700

const fmt = v => (v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1))

export default function ResumenEstudiante({
  estudiante, resultado, prueba, colegio,
  comparativo,                      // objeto con columnas de asignatura (promedio del grupo)
  comparativoLabel = 'Promedio',
  puesto, totalGrupo, percentil,
}) {
  const hayComparativo = !!comparativo && ASIGNATURAS.some(a => comparativo[a.cols[0]] != null)

  const dataAsig = ASIGNATURAS
    .map(it => ({
      label: it.label, akey: it.akey,
      yo: valorDe(resultado, it),
      comp: hayComparativo ? valorDe(comparativo, it) : null,
    }))
    .filter(d => d.yo != null)

  const dataArea = AREAS
    .map(it => ({
      label: AREA_CORTA[it.akey] || it.label, larga: it.label, akey: it.akey,
      yo: valorDe(resultado, it),
      comp: hayComparativo ? valorDe(comparativo, it) : null,
    }))
    .filter(d => d.yo != null)

  const meta = { fontSize: 9, lineHeight: 1.55 }
  const th = { padding: '3px 5px', background: NAVY, color: '#fff', fontSize: 8,
    fontWeight: 600, textAlign: 'center', border: '1px solid #234' }
  const td = (extra = {}) => ({ padding: '3px 5px', fontSize: 8.5, textAlign: 'center',
    border: '1px solid #CBD5E1', ...extra })
  const caja = (extra = {}) => ({ border: '1px solid #CBD5E1', padding: '6px 12px', ...extra })
  const rotulo = { fontSize: 8, color: '#475569' }
  const cifra = { fontSize: 20, fontWeight: 700, color: NAVY, lineHeight: 1.1 }
  const titulo = { fontSize: 10, fontWeight: 700, color: NAVY, textTransform: 'uppercase',
    letterSpacing: '0.06em', margin: '10px 0 2px' }

  return (
    <section className="hoja-resultados hoja-resumen">
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
        <div style={caja({ border: `1px solid ${NAVY}`, minWidth: 105 })}>
          <div style={rotulo}>Puntaje global</div>
          <div style={cifra}>{resultado?.puntaje_global ?? '—'}</div>
        </div>
        <div style={caja({ minWidth: 95 })}>
          <div style={rotulo}>Desempeño</div>
          <div style={cifra}>
            {resultado?.desempeno_pct != null ? `${resultado.desempeno_pct}%` : '—'}
          </div>
        </div>
        {percentil != null && (
          <div style={caja({ minWidth: 95 })}>
            <div style={rotulo}>Percentil</div>
            <div style={cifra}>{percentil}</div>
          </div>
        )}
        {puesto ? (
          <div style={caja({ minWidth: 95 })}>
            <div style={rotulo}>Puesto</div>
            <div style={cifra}>{puesto}{totalGrupo ? <span style={{ fontSize: 11, fontWeight: 400 }}> / {totalGrupo}</span> : null}</div>
          </div>
        ) : null}
        <div style={caja({ flex: 1 })}>
          <div style={rotulo}>Referencia de niveles</div>
          <div style={{ display: 'flex', gap: 10, paddingTop: 5, flexWrap: 'wrap' }}>
            {NIVEL_LABEL.map((l, i) => (
              <span key={l} style={{ fontSize: 8, color: '#334155', whiteSpace: 'nowrap' }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, background: NIVEL_COLOR[i],
                  marginRight: 3, verticalAlign: 'middle' }} />{l}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Barras por asignatura ─────────────────────────────────────────── */}
      <div style={titulo}>Puntaje por asignatura</div>
      {dataAsig.length ? (
        <BarChart width={ANCHO} height={270} data={dataAsig}
          margin={{ top: 16, right: 8, left: -18, bottom: 4 }} barGap={2}>
          <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#334155' }} interval={0}
            axisLine={{ stroke: '#94A3B8' }} tickLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}
            tick={{ fontSize: 8, fill: '#64748B' }} axisLine={false} tickLine={false} />
          {hayComparativo && (
            <Legend verticalAlign="top" height={16} iconSize={8}
              wrapperStyle={{ fontSize: 8.5, color: '#334155' }} />
          )}
          {/* fill= además de los Cell: el color de cada barra lo pone su Cell, pero la Legend
              lee el fill del Bar y sin esto pinta su cuadrito de negro. */}
          <Bar dataKey="yo" name="Estudiante" fill={NAVY} isAnimationActive={false} maxBarSize={26}>
            {dataAsig.map((d, i) => (
              <Cell key={i} fill={NIVEL_COLOR[semaforoNivel(d.yo, d.akey)]} />
            ))}
            <LabelList dataKey="yo" position="top" formatter={fmt}
              style={{ fontSize: 8, fill: '#334155', fontWeight: 700 }} />
          </Bar>
          {hayComparativo && (
            <Bar dataKey="comp" name={comparativoLabel} fill={GRIS_COMP}
              isAnimationActive={false} maxBarSize={26}>
              <LabelList dataKey="comp" position="top" formatter={fmt}
                style={{ fontSize: 7.5, fill: '#64748B' }} />
            </Bar>
          )}
        </BarChart>
      ) : (
        <div style={{ padding: 14, fontSize: 9, color: '#475569' }}>
          No hay puntajes por asignatura para esta prueba.
        </div>
      )}

      {/* ── Radar + tabla por área ────────────────────────────────────────── */}
      <div style={titulo}>Perfil por área</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {dataArea.length ? (
          <RadarChart width={330} height={260} data={dataArea}
            margin={{ top: 10, right: 30, bottom: 4, left: 30 }}>
            <PolarGrid stroke="#CBD5E1" />
            <PolarAngleAxis dataKey="label" tick={{ fontSize: 8, fill: '#334155' }} />
            {/* Escala 0–100 fija para que dos estudiantes sean comparables entre sí. Sin
                rótulos: Recharts los dibuja rotados sobre una diagonal del pentágono y quedan
                ilegibles; la tabla de al lado ya da los números exactos. */}
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            {hayComparativo && (
              <Radar name={comparativoLabel} dataKey="comp" stroke={GRIS_COMP}
                fill={GRIS_COMP} fillOpacity={0.22} isAnimationActive={false} />
            )}
            <Radar name="Estudiante" dataKey="yo" stroke={NAVY}
              fill={NAVY} fillOpacity={0.28} isAnimationActive={false} />
          </RadarChart>
        ) : null}

        <table style={{ borderCollapse: 'collapse', flex: 1 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Área</th>
              <th style={th}>Puntaje</th>
              {hayComparativo && <th style={th}>{comparativoLabel}</th>}
              {hayComparativo && <th style={th}>Dif.</th>}
              <th style={th}>Nivel</th>
            </tr>
          </thead>
          <tbody>
            {dataArea.map(d => {
              const n = semaforoNivel(d.yo, d.akey)
              // La diferencia solo tiene sentido si el grupo tiene dato en esa área concreta:
              // `hayComparativo` es global y puede ser true con este área vacía.
              const dif = d.comp != null ? d.yo - d.comp : null
              return (
                <tr key={d.akey}>
                  <td style={td({ textAlign: 'left' })}>{d.larga}</td>
                  <td style={td({ fontWeight: 700, color: NIVEL_COLOR[n] })}>{fmt(d.yo)}</td>
                  {hayComparativo && <td style={td({ color: '#475569' })}>{fmt(d.comp)}</td>}
                  {hayComparativo && (
                    <td style={td({ fontWeight: 600, color: dif == null ? '#94A3B8' : dif >= 0 ? '#2D9B6F' : '#E05252' })}>
                      {dif == null ? '—' : `${dif >= 0 ? '+' : '−'}${fmt(Math.abs(dif))}`}
                    </td>
                  )}
                  <td style={td({ background: NIVEL_COLOR[n] + '22', fontWeight: 600 })}>
                    {NIVEL_LABEL[n]}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Detalle numérico por asignatura ───────────────────────────────── */}
      <div style={titulo}>Detalle por asignatura</div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left', width: 72 }} />
            {dataAsig.map(d => <th key={d.label} style={th}>{d.label}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={td({ textAlign: 'left', fontWeight: 600, background: '#F1F5F9' })}>Estudiante</td>
            {dataAsig.map(d => (
              <td key={d.label} style={td({ fontWeight: 700, color: NIVEL_COLOR[semaforoNivel(d.yo, d.akey)] })}>
                {fmt(d.yo)}
              </td>
            ))}
          </tr>
          {hayComparativo && (
            <tr>
              <td style={td({ textAlign: 'left', fontWeight: 600, background: '#F1F5F9' })}>{comparativoLabel}</td>
              {dataAsig.map(d => (
                <td key={d.label} style={td({ color: '#475569' })}>{fmt(d.comp)}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 8, fontSize: 7.5, color: '#64748B', lineHeight: 1.5 }}>
        Los puntajes por área son promedios ponderados de sus asignaturas, con los mismos pesos
        que usa el Tablero de Gestión. Un área queda vacía si falta alguna de sus asignaturas.
      </div>
    </section>
  )
}
