// Cruce de la estructura de la prueba (Excel) con el detalle de respuestas del estudiante.
//
// Esta rutina estaba duplicada literalmente en EstudianteDashboard ("Mis Respuestas") y en el
// modal de detalle de ColegioDashboard. Al extraerla se garantiza que la hoja imprimible y la
// vista en pantalla usen EXACTAMENTE el mismo criterio de cruce.
//
// OJO — la llave de cruce es `gpos`, la posición global de la fila no vacía (1..N), que es lo
// que escribe `calcularResultado` en `detalle.pregunta`. NO se puede usar el "Nro" del Excel:
// se reinicia en cada sesión, así que dos preguntas distintas comparten número. Si se cambia
// esta llave, los aciertos y errores salen desalineados SIN lanzar ningún error: la tabla se
// ve perfectamente bien y está mal.

export function construirPreguntas(estructuraExcel) {
  const rawRows = estructuraExcel?.raw || []
  const rawHeader = rawRows[0] || []
  const hIdx = k => rawHeader.findIndex(h => typeof h === 'string' && h.toLowerCase().trim().startsWith(k))
  const iSesion = 0, iNro = 1, iArea = 2, iMateria = 3
  const iEstandar    = hIdx('estándar') >= 0 ? hIdx('estándar') : hIdx('estandar')
  const iCompetencia = hIdx('competencia')
  const iComponente  = hIdx('componente')
  const iTarea       = hIdx('tarea')
  const iRta         = rawHeader.findIndex(h => typeof h === 'string' &&
    ['rta', 'respuesta correcta', 'resp. correcta', 'resp correcta', 'respuesta']
      .includes(h.toLowerCase().trim()))

  return rawRows.slice(1)
    .filter(f => Array.isArray(f) && f.some(v => v !== '' && v != null))
    .map((f, i) => ({
      gpos:        i + 1,
      sesion:      (f[iSesion]  || '').toString().trim(),
      nro:         (f[iNro]     || '').toString().trim(),
      area:        (f[iArea]    || '').toString().trim(),
      materia:     (f[iMateria] || '').toString().trim(),
      estandar:    iEstandar    >= 0 ? (f[iEstandar]    || '').toString().trim() : '',
      competencia: iCompetencia >= 0 ? (f[iCompetencia] || '').toString().trim() : '',
      componente:  iComponente  >= 0 ? (f[iComponente]  || '').toString().trim() : '',
      tarea:       iTarea       >= 0 ? (f[iTarea]       || '').toString().trim() : '',
      rta:         iRta         >= 0 ? (f[iRta]         || '').toString().trim() : '',
    }))
}

export function mapaDetalle(detalle) {
  const m = {}
  ;(detalle || []).forEach(d => { m[String(d.pregunta)] = d })
  return m
}

// Asignaturas tal como se guardan en resultados_estudiante, en el orden en que se muestran.
export const ASIGNATURAS = [
  { key: 'mat_cuantitativo', label: 'Matemáticas (Cuantitativo)' },
  { key: 'mat_especifico',   label: 'Matemáticas (Específico)' },
  { key: 'cn_quimica',       label: 'Química' },
  { key: 'cn_fisica',        label: 'Física' },
  { key: 'cn_biologia',      label: 'Biología' },
  { key: 'cn_cts',           label: 'CTS' },
  { key: 'sociales',         label: 'Sociales' },
  { key: 'ciudadanas',       label: 'Ciudadanas' },
  { key: 'lectura_critica',  label: 'Lectura Crítica' },
  { key: 'ingles',           label: 'Inglés' },
]

// Aciertos / total a partir del detalle ya cruzado. `correcto` puede venir null (sin responder),
// por eso se cuenta explícitamente contra `true` y no por veracidad.
export function resumenAciertos(preguntas, detalleMap) {
  let ok = 0, resp = 0
  for (const q of preguntas) {
    const d = detalleMap[q.gpos]
    if (!d) continue
    if (d.marcada && d.marcada !== 'X' && d.marcada !== '?') resp++
    if (d.correcto === true) ok++
  }
  return { aciertos: ok, respondidas: resp, total: preguntas.length }
}
