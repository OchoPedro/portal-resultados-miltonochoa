// Asignaturas, ÁREAS y sus pesos — fuente única de verdad.
//
// Las áreas NO existen en la base de datos: `resultados_estudiante` guarda una columna por
// asignatura y el área se compone en el front. Los pesos vivían copiados en varios sitios y
// el commit 2afab0e tuvo que arreglar una divergencia real: el mismo estudiante veía 82.94 en
// su pantalla y 87.39 en la de su colegio, porque una copia promediaba sin ponderar. Cualquier
// vista nueva debe importar de aquí en vez de volver a escribir la fórmula.
//
// Los pesos siguen la proporción real de preguntas de cada asignatura dentro del área
// (Sociales 40/60 con 20 y 30 preguntas; Naturales 30/30/30/10 con 17/17/18/6).

export const ASIGNATURAS = [
  { label: 'Mat. Cuantit.', akey: 'mat', cols: ['mat_cuantitativo'] },
  { label: 'Mat. Específ.', akey: 'mat', cols: ['mat_especifico'] },
  { label: 'Química',       akey: 'cn',  cols: ['cn_quimica'] },
  { label: 'Física',        akey: 'cn',  cols: ['cn_fisica'] },
  { label: 'Biología',      akey: 'cn',  cols: ['cn_biologia'] },
  { label: 'CTS',           akey: 'cn',  cols: ['cn_cts'] },
  { label: 'Sociales',      akey: 'soc', cols: ['sociales'] },
  { label: 'Ciudadanas',    akey: 'soc', cols: ['ciudadanas'] },
  { label: 'Lect. Crítica', akey: 'lc',  cols: ['lectura_critica'] },
  { label: 'Inglés',        akey: 'ing', cols: ['ingles'] },
]

export const AREAS = [
  { label: 'Matemáticas',           akey: 'mat', cols: ['mat_cuantitativo', 'mat_especifico'], pesos: [2, 1] },
  { label: 'Ciencias Naturales',    akey: 'cn',  cols: ['cn_quimica', 'cn_fisica', 'cn_biologia', 'cn_cts'], pesos: [0.9, 0.9, 0.9, 0.3] },
  { label: 'Sociales y Ciudadanas', akey: 'soc', cols: ['sociales', 'ciudadanas'], pesos: [1.2, 1.8] },
  { label: 'Lectura Crítica',       akey: 'lc',  cols: ['lectura_critica'], pesos: [1] },
  { label: 'Inglés',                akey: 'ing', cols: ['ingles'], pesos: [1] },
]

// Etiqueta corta para gráficos: "Matemáticas" cabe, "Sociales y Ciudadanas" no.
export const AREA_CORTA = { mat: 'Matemáticas', cn: 'Cs. Naturales', soc: 'Soc. y Ciud.', lc: 'Lectura Crít.', ing: 'Inglés' }

export const avgCols = (obj, cols) => {
  const vals = cols.map(c => obj?.[c])
    .filter(v => v != null && v !== '' && !isNaN(parseFloat(v)))
    .map(parseFloat)
  return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 100) / 100 : null
}

// Valor de un item (asignatura o área) para un registro de resultados.
// Regla de nulos: si falta ALGUNA asignatura del área, el área queda vacía en vez de promediar
// solo las presentes — así una prueba sin Inglés no infla artificialmente el resto.
export const valorDe = (obj, it) => {
  if (!it?.pesos) return avgCols(obj, it?.cols || [])
  let suma = 0, peso = 0
  for (let i = 0; i < it.cols.length; i++) {
    const v = obj?.[it.cols[i]]
    if (v == null || v === '' || isNaN(parseFloat(v))) return null
    suma += parseFloat(v) * it.pesos[i]; peso += it.pesos[i]
  }
  return peso ? Math.round(suma / peso * 100) / 100 : null
}

// ── Semáforo pedagógico AAMO ────────────────────────────────────────────────
// Los cortes son distintos por área a propósito: un 55 en Inglés no vale lo mismo que un 55
// en Lectura Crítica. `_` es el corte genérico para cualquier cosa sin área definida.
export const SEMAFORO_T = {
  mat: [35, 50, 70], cn: [40, 55, 70], soc: [40, 55, 70],
  lc: [35, 50, 65], ing: [36, 57, 70], _: [24, 44, 64],
}

export const semaforoNivel = (v, area = '_') => {
  const [t1, t2, t3] = SEMAFORO_T[area] || SEMAFORO_T['_']
  return v > t3 ? 3 : v > t2 ? 2 : v > t1 ? 1 : 0
}

export const NIVEL_LABEL = ['Bajo', 'Básico', 'Satisfactorio', 'Avanzado']
// Hexadecimales planos y no `C` de components/ui: este módulo no debe depender de React.
export const NIVEL_COLOR = ['#E05252', '#F97316', '#F59E0B', '#2D9B6F']

// Promedio por columna de asignatura sobre un conjunto de estudiantes (p. ej. un salón).
// Devuelve un objeto con la misma forma que un registro de resultados, para poder pasarlo a
// `valorDe` igual que si fuera un estudiante.
export function promedioDeGrupo(filas) {
  const out = {}
  const cols = ASIGNATURAS.flatMap(a => a.cols)
  for (const col of cols) {
    const vals = (filas || []).map(f => f?.[col])
      .filter(v => v != null && v !== '' && !isNaN(parseFloat(v)))
      .map(parseFloat)
    out[col] = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 100) / 100 : null
  }
  return out
}
