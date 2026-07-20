// Mapa departamento → región. FUENTE ÚNICA de este repo.
//
// Antes estaba copiado a mano en cada pantalla que lo necesitaba (RankingNacional,
// ReporteAgrupado, ReportePlantel aquí; otras cuatro en plataforma-interna) y también dentro
// del SQL de get_competencias_gestion / get_componentes_gestion. Nueve copias del mismo dato.
//
// Esa duplicación ya había costado caro: las RPC comparaban estas grafías contra
// `colegios.departamento_nombre`, que escribe cuatro departamentos distinto, y la región
// terminaba excluyendo a Bogotá entera. Ver supabase-regiones.sql.
//
// ── Por qué esto sigue siendo una constante y no un fetch a la tabla `regiones` ──
// El mapa se usa de forma SÍNCRONA durante el render (p. ej. DEPTO_REGION[r.departamento] al
// pintar cada fila del ranking). Cargarlo por red haría que el primer render no tuviera región:
// parpadeo y agrupaciones vacías, a cambio de nada — un mapa de departamentos cambia cada
// varios años, no entre visitas.
//
// La tabla `regiones` en Supabase existe para el SQL, que no puede importar este archivo. Las
// dos deben decir lo mismo; `verificarContraBD()` lo comprueba en desarrollo.

export const REGIONES_DEPTS = {
  'Andina':    ['ANTIOQUIA','BOGOTÁ D.C.','BOYACÁ','CALDAS','CUNDINAMARCA','HUILA','NORTE SANTANDER','QUINDÍO','RISARALDA','SANTANDER','TOLIMA'],
  'Caribe':    ['ATLÁNTICO','BOLÍVAR','CESAR','CÓRDOBA','LA GUAJIRA','MAGDALENA','SUCRE','SAN ANDRÉS'],
  'Pacífica':  ['CAUCA','CHOCÓ','NARIÑO','VALLE DEL CAUCA'],
  'Orinoquía': ['ARAUCA','CASANARE','META','VICHADA'],
  'Amazonía':  ['AMAZONAS','CAQUETÁ','GUAINÍA','GUAVIARE','PUTUMAYO','VAUPÉS'],
}

export const DEPTO_REGION = {}
Object.entries(REGIONES_DEPTS).forEach(([r, ds]) => ds.forEach(d => { DEPTO_REGION[d] = r }))

// Avisa en consola si este archivo y la tabla `regiones` dejan de coincidir. Solo en
// desarrollo: es un detector de divergencia para quien programa, no un chequeo de producción.
export async function verificarContraBD(supabase) {
  if (!import.meta.env?.DEV) return
  const { data, error } = await supabase.from('regiones').select('departamento, region')
  if (error || !data) return
  // La tabla incluye además las grafías alternas de `colegios` ('BOGOTÁ, D.C.', 'QUINDIO'…),
  // que aquí no van: este mapa se compara contra `ranking_colegios`, que usa las canónicas.
  const faltantes = Object.keys(DEPTO_REGION).filter(d => !data.some(r => r.departamento === d))
  const distintos = data.filter(r => DEPTO_REGION[r.departamento] && DEPTO_REGION[r.departamento] !== r.region)
  if (faltantes.length || distintos.length) {
    console.warn('[regiones] el mapa del front y la tabla `regiones` NO coinciden.',
      { faltanEnLaTabla: faltantes, regionDistinta: distintos })
  }
}
