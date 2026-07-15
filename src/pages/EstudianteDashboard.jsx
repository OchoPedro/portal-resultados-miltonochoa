import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  C, getLevel, avg,
  Card, CardTitle, Badge, KpiCard, TabBar, ScoreGauge, Sidebar, useMobile, useTablet
} from '../components/ui'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell
} from 'recharts'

// Semáforo por área — mismos umbrales pedagógicos AAMO que usa el dashboard de colegio.
// Las barras sí pueden usar verde (nivel avanzado); el texto/números nunca usan verde.
const SEMAFORO_T = {
  mat: [35, 50, 70], cn: [40, 55, 70], soc: [40, 55, 70],
  lc: [35, 50, 65], ing: [36, 57, 70], _: [24, 44, 64],
}
const semaforoNivel = (v, area = '_') => {
  const [t1, t2, t3] = SEMAFORO_T[area] || SEMAFORO_T['_']
  return v > t3 ? 3 : v > t2 ? 2 : v > t1 ? 1 : 0
}
const NIVEL_COLOR_BARRA = [C.red, '#F97316', '#F59E0B', C.green]
const NIVEL_COLOR_TEXTO = [C.red, '#F97316', '#F59E0B', C.navy]
const colorBarra = (v, area) => NIVEL_COLOR_BARRA[semaforoNivel(v, area)]
const colorTexto = (v, area) => NIVEL_COLOR_TEXTO[semaforoNivel(v, area)]

export default function EstudianteDashboard({ session, onLogout }) {
  const mobile = useMobile()
  const tablet = useTablet()
  const [todos, setTodos] = useState([])          // todos los resultados del estudiante
  const [selectedIdx, setSelectedIdx] = useState(0) // prueba activa
  const [compañeros, setCompañeros] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen')
  const [pctScope, setPctScope] = useState('plantel')
  const [pctGeo, setPctGeo] = useState({})
  const [areaScope, setAreaScope] = useState('nacional') // alcance del comparativo Por Área
  const [promAreas, setPromAreas] = useState({})         // promedios por área y alcance (RPC)
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: resultados } = await supabase
          .from('resultados_estudiante')
          .select('*, pruebas(codigo, nombre, fecha, grado, estructura_excel)')
          .eq('estudiante_id', session.id)
          .order('created_at', { ascending: false })

        if (cancelled) return
        setTodos(resultados || [])

        if (resultados?.length) {
          const r = resultados[0]
          const { data: colegioPares } = await supabase
            .from('resultados_estudiante')
            .select('puntaje_global, estudiante_id, estudiantes(nombre, grado, salon)')
            .eq('colegio_id', r.colegio_id)
            .eq('prueba_id', r.prueba_id)
            .order('puntaje_global', { ascending: false })
          if (cancelled) return
          setCompañeros(colegioPares || [])
        }
      } catch (e) {
        // error de red — la UI muestra estado vacío
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleSelectPrueba = async (idx) => {
    setSelectedIdx(idx)
    setTab('resumen')
    const r = todos[idx]
    if (!r) return
    const { data: colegioPares } = await supabase
      .from('resultados_estudiante')
      .select('puntaje_global, estudiante_id, estudiantes(nombre, grado, salon)')
      .eq('colegio_id', r.colegio_id)
      .eq('prueba_id', r.prueba_id)
      .order('puntaje_global', { ascending: false })
    setCompañeros(colegioPares || [])
  }

  // Percentiles geográficos (municipio/departamento/región/nacional) para la prueba activa.
  const pruebaActivaId = todos[Math.min(selectedIdx, Math.max(0, todos.length - 1))]?.prueba_id
  useEffect(() => {
    if (!pruebaActivaId) { setPctGeo({}); return }
    let cancelled = false
    supabase.rpc('get_percentil_estudiante', {
      p_estudiante_id: session.id, p_prueba_id: pruebaActivaId,
    }).then(({ data }) => {
      if (!cancelled) setPctGeo(data || {})
    })
    // Promedios por área para cada alcance (plantel/municipio/departamento/región/nacional).
    supabase.rpc('get_promedios_area_estudiante', {
      p_estudiante_id: session.id, p_prueba_id: pruebaActivaId,
    }).then(({ data }) => {
      if (!cancelled) setPromAreas(data || {})
    })
    return () => { cancelled = true }
  }, [pruebaActivaId])

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center',
      justifyContent: 'center', background: C.bg }}>
      <div style={{ fontFamily: 'Inter', color: C.gray }}>Cargando resultados...</div>
    </div>
  )

  if (!todos.length) return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center',
      justifyContent: 'center', background: C.bg, flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 48 }}>📋</div>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.navy }}>
        Aún no tienes resultados
      </div>
      <div style={{ fontFamily: 'Inter', fontSize: 14, color: C.gray }}>
        Tus resultados aparecerán aquí cuando estén disponibles.
      </div>
      <button onClick={onLogout} style={{ marginTop: 12, padding: '10px 24px',
        background: C.navy, color: C.white, border: 'none', borderRadius: 8,
        fontFamily: 'Inter', fontSize: 13 }}>Cerrar sesión</button>
    </div>
  )

  const r = todos[Math.min(selectedIdx, todos.length - 1)] || todos[0]
  if (!r) return null
  const prueba = r.pruebas
  const promColegio = compañeros.length
    ? Math.round(avg(compañeros.map(c => c.puntaje_global)))
    : 0
  const miPuesto = compañeros.findIndex(c => c.estudiante_id === session.id) + 1 || 0
  const percentilPlantel = miPuesto && compañeros.length
    ? Math.round((1 - (miPuesto - 1) / compañeros.length) * 100)
    : 0
  const PCT_SCOPE_LABEL = { plantel:'colegio', municipio:'municipio', departamento:'departamento', region:'región', nacional:'nacional' }
  const geoKey = { plantel:null, municipio:'municipio_pct', departamento:'departamento_pct', region:'region_pct', nacional:'nacional_pct' }[pctScope]
  const percentil = geoKey ? (pctGeo?.[geoKey] ?? null) : percentilPlantel

  // Mención de Honor: se otorga al mejor puntaje del MISMO grado y salón, para esta prueba.
  // (mismo criterio que la Mención de Honor del colegio filtrada por grado y salón)
  const grupoMencion = compañeros.filter(c =>
    String(c.estudiantes?.grado ?? '') === String(session.grado ?? '') &&
    String(c.estudiantes?.salon ?? '') === String(session.salon ?? ''))
  const maxGrupo = grupoMencion.length
    ? Math.max(...grupoMencion.map(c => c.puntaje_global ?? -Infinity))
    : -Infinity
  const esMencion = r.puntaje_global != null && r.puntaje_global === maxGrupo

  // Diploma en PDF (idéntico al del colegio), para el propio estudiante destacado.
  const descargarDiploma = async () => {
    if (!esMencion || generando) return
    setGenerando(true)
    try {
      const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib')
      const doc = await PDFDocument.create()
      const page = doc.addPage([842, 595])
      const W = 842, H = 595
      const timesB = await doc.embedFont(StandardFonts.TimesRomanBold)
      const timesI = await doc.embedFont(StandardFonts.TimesRomanItalic)
      const helv   = await doc.embedFont(StandardFonts.Helvetica)
      const helvB  = await doc.embedFont(StandardFonts.HelveticaBold)
      const navy  = rgb(10/255, 31/255, 61/255)
      const green = rgb(45/255, 155/255, 111/255)
      const gold  = rgb(0.70, 0.55, 0.24)
      const gray  = rgb(0.42, 0.45, 0.5)
      const clean = (s) => String(s ?? '').replace(/[^\x20-\xFF]/g, '')
      const center = (t, y, f, s, c, ls = 0) => {
        t = clean(t)
        if (ls > 0) {
          const tot = [...t].reduce((a, ch) => a + f.widthOfTextAtSize(ch, s) + ls, 0) - ls
          let x = (W - tot) / 2
          for (const ch of t) { page.drawText(ch, { x, y, size: s, font: f, color: c }); x += f.widthOfTextAtSize(ch, s) + ls }
        } else {
          const w = f.widthOfTextAtSize(t, s)
          page.drawText(t, { x: (W - w) / 2, y, size: s, font: f, color: c })
        }
      }
      const diamond = (cx, cy, rr, color) => page.drawSvgPath(`M ${cx} ${cy-rr} L ${cx+rr} ${cy} L ${cx} ${cy+rr} L ${cx-rr} ${cy} Z`, { color })
      const branch = (cx, cy, R, a0, a1, ls) => {
        let prev = null; const n = 8
        for (let i = 0; i <= n; i++) { const ang = (a0 + (a1-a0)*i/n) * Math.PI/180; const x = cx+R*Math.cos(ang), y = cy+R*Math.sin(ang); if (prev) page.drawLine({ start: prev, end: { x, y }, thickness: 1, color: gold }); prev = { x, y } }
        for (let i = 1; i < n; i++) { const t = i/n; const ad = a0 + (a1-a0)*t; const a = ad*Math.PI/180; const x = cx+R*Math.cos(a), y = cy+R*Math.sin(a); const sz = 8 - t*2.6; page.drawEllipse({ x, y, xScale: sz, yScale: sz*0.4, color: gold, rotate: degrees(ad + 90*ls) }) }
      }
      const laurel = (cx, cy, R) => { branch(cx, cy, R, 256, 116, 1); branch(cx, cy, R, 284, 424, -1) }

      const pruebaNombre = prueba ? (prueba.nombre || prueba.codigo) : 'la prueba'
      const fecha = new Date().toLocaleDateString('es-CO', { day:'numeric', month:'long', year:'numeric', timeZone:'America/Bogota' })
      const nombre = session.nombre || 'Estudiante'
      const grado  = session.grado ?? '—'
      const salon  = session.salon ?? '—'
      const punt   = String(r.puntaje_global ?? '—')

      page.drawRectangle({ x:22, y:22, width:W-44, height:H-44, borderColor:navy, borderWidth:3 })
      page.drawRectangle({ x:30, y:30, width:W-60, height:H-60, borderColor:gold, borderWidth:1 })
      page.drawRectangle({ x:35, y:35, width:W-70, height:H-70, borderColor:gold, borderWidth:0.4 })
      for (const [sx, sy] of [[46,46],[W-46,46],[46,H-46],[W-46,H-46]]) { diamond(sx, sy, 6, gold); diamond(sx, sy, 2.4, navy) }
      center('GRUPO MILTON OCHOA', H-100, helvB, 12, navy, 3)
      center('EXPERTOS EN EVALUACIÓN', H-116, helv, 8, gray, 2)
      page.drawRectangle({ x:W/2-70, y:H-132, width:56, height:0.8, color:gold }); page.drawRectangle({ x:W/2+14, y:H-132, width:56, height:0.8, color:gold }); diamond(W/2, H-131, 4, gold)
      center('Mención de Honor', H-186, timesB, 38, navy)
      center('Se otorga la presente distinción a', H-224, timesI, 15, gray)
      center(nombre, H-272, timesB, 40, navy)
      page.drawRectangle({ x:W/2-90, y:H-286, width:180, height:0.8, color:gold }); diamond(W/2-90, H-285.6, 3, gold); diamond(W/2+90, H-285.6, 3, gold)
      center(`Grado ${grado}      Salón ${salon}`, H-308, helv, 12, gray, 1)
      center(`por su destacado desempeño en el ${pruebaNombre}`, H-340, timesI, 14, gray)
      const cy = 148
      center('PUNTAJE GLOBAL', cy+56, helvB, 8.5, gray, 2)
      laurel(W/2, cy, 48)
      center(punt, cy-6, timesB, 42, green)
      center('de 500 puntos', cy-26, helv, 8.5, gray)
      page.drawRectangle({ x:W/2-110, y:68, width:220, height:0.8, color:navy })
      const cn = clean(session.colegios?.nombre || 'Institución')
      let cnSize = 13; while (timesB.widthOfTextAtSize(cn, cnSize) > 660 && cnSize > 8) cnSize -= 0.5
      center(cn, 50, timesB, cnSize, navy)
      center(`Expedido el ${fecha}`, 36, helv, 9, gray)

      const bytes = await doc.save()
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Diploma - ${clean(session.nombre || 'estudiante')}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (err) {
      console.error('No se pudo generar el diploma:', err)
      alert('No se pudo generar el diploma. Intenta de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  // Promedios reales por alcance (RPC). El gráfico Resumen usa el nacional; las tarjetas
  // Por Área usan el alcance elegido (areaScope).
  const A_NAC = promAreas?.nacional || {}
  const AREA_SCOPE_LABEL = { plantel:'Plantel', municipio:'Municipio', departamento:'Departamento', region:'Región', nacional:'Nacional' }
  const AREA_SCOPE_SHORT = { plantel:'plantel', municipio:'mun.', departamento:'depto.', region:'región', nacional:'nac.' }
  const areaData = [
    { area: 'Mat. Cuantit.', akey: 'mat', col: 'mat_cuantitativo', yo: r.mat_cuantitativo },
    { area: 'Mat. Específ.', akey: 'mat', col: 'mat_especifico',   yo: r.mat_especifico },
    { area: 'Química',       akey: 'cn',  col: 'cn_quimica',        yo: r.cn_quimica },
    { area: 'Física',        akey: 'cn',  col: 'cn_fisica',         yo: r.cn_fisica },
    { area: 'Biología',      akey: 'cn',  col: 'cn_biologia',       yo: r.cn_biologia },
    { area: 'CTS',           akey: 'cn',  col: 'cn_cts',            yo: r.cn_cts },
    { area: 'Sociales',      akey: 'soc', col: 'sociales',          yo: r.sociales },
    { area: 'Ciudadanas',    akey: 'soc', col: 'ciudadanas',        yo: r.ciudadanas },
    { area: 'Lect. Crítica', akey: 'lc',  col: 'lectura_critica',   yo: r.lectura_critica },
    { area: 'Inglés',        akey: 'ing', col: 'ingles',            yo: r.ingles },
  ].map(a => ({ ...a, nac: A_NAC[a.col] ?? null })).filter(a => a.yo != null)

  const radarData = [
    { comp: 'Matemáticas', yo: Math.round(((r.mat_cuantitativo || 0) + (r.mat_especifico || 0)) / 2) },
    { comp: 'Ciencias Nat.', yo: Math.round(((r.cn_quimica || 0) + (r.cn_fisica || 0) + (r.cn_biologia || 0) + (r.cn_cts || 0)) / 4) },
    { comp: 'Soc. y Ciud.', yo: Math.round(((r.sociales||0)+(r.ciudadanas||0))/2) },
    { comp: 'Lect. Crítica', yo: r.lectura_critica || 0 },
    { comp: 'Inglés', yo: r.ingles || 0 },
  ]

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'areas', label: 'Por Asignatura' },
    { id: 'perfil', label: 'Perfil' },
    { id: 'posicion', label: 'Mi Posición' },
    { id: 'respuestas', label: 'Mis Respuestas' },
    ...(esMencion ? [{ id: 'mencion', label: '🏅 Mención de Honor' }] : []),
  ]
  // Si estaba en la pestaña de mención y esta prueba ya no la otorga, volver a Resumen.
  const tabActivo = (tab === 'mencion' && !esMencion) ? 'resumen' : tab

  const distData = [
    { rango: '< 380', cant: compañeros.filter(c => c.puntaje_global < 380).length, color: C.red },
    { rango: '380–399', cant: compañeros.filter(c => c.puntaje_global >= 380 && c.puntaje_global < 400).length, color: C.amber },
    { rango: '400–419', cant: compañeros.filter(c => c.puntaje_global >= 400 && c.puntaje_global < 420).length, color: C.blue },
    { rango: '420–439', cant: compañeros.filter(c => c.puntaje_global >= 420 && c.puntaje_global < 440).length, color: C.green },
    { rango: '≥ 440', cant: compañeros.filter(c => c.puntaje_global >= 440).length, color: C.navy },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar role="estudiante" session={session} onLogout={onLogout}>
        <div style={{ padding: '8px 4px' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter',
            letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
            Mis Pruebas ({todos.length})
          </div>
          {todos.map((res, idx) => (
            <button key={res.id} onClick={() => handleSelectPrueba(idx)} style={{
              width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
              borderRadius: 8, padding: '10px 12px', marginBottom: 6, transition: 'all 0.15s',
              background: idx === selectedIdx
                ? 'rgba(255,255,255,0.12)'
                : 'rgba(255,255,255,0.05)',
              borderLeft: idx === selectedIdx
                ? '3px solid rgba(255,255,255,0.9)'
                : '3px solid transparent',
            }}>
              <div style={{ fontSize: 11, color: idx === selectedIdx ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
                fontFamily: 'Inter', fontWeight: 600, marginBottom: 4,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {res.pruebas?.nombre || res.pruebas?.codigo}
              </div>
              <div style={{ fontSize: 13, fontFamily: 'Playfair Display, serif',
                color: C.white, fontWeight: 700 }}>
                {res.puntaje_global} pts
              </div>
            </button>
          ))}
        </div>
      </Sidebar>

      <main style={{ flex: 1, padding: mobile ? '72px 16px 24px' : tablet ? '24px 20px' : '36px 40px', overflowY: 'auto', minWidth: 0 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 26, fontFamily: 'Playfair Display, serif', color: C.navy, marginBottom: 4 }}>
                {session.nombre}
              </h1>
              <div style={{ fontSize: 13, color: C.gray, fontFamily: 'Inter' }}>
                {session.colegios?.nombre} · {session.colegios?.ciudad} · Grado {session.grado}
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: mobile || tablet ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          <KpiCard label="Puntaje Global" value={r.puntaje_global} sub="Escala 0–500" color={colorTexto((r.puntaje_global / 500) * 100)} />
          <KpiCard label="Desempeño" value={`${r.desempeno_pct?.toFixed(1)}%`} sub="Promedio ponderado" color={colorTexto(r.desempeno_pct)} />
          <KpiCard label="Puesto" value={miPuesto ? `#${miPuesto}` : '—'} sub={`de ${compañeros.length} estudiantes`} color={C.navy} />
          <Card style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.gray, fontFamily: 'Inter',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Percentil</div>
            <div style={{ fontSize: 34, fontFamily: 'Playfair Display, serif',
              color: C.navy, fontWeight: 700, lineHeight: 1, marginBottom: 8 }}>
              {percentil != null ? `${percentil}°` : '—'}
            </div>
            <select value={pctScope} onChange={e => setPctScope(e.target.value)} style={{
              padding: '4px 8px', border: `1px solid ${C.grayLt}`, borderRadius: 6,
              fontFamily: 'Inter', fontSize: 11, color: C.text, background: C.bg,
              outline: 'none', cursor: 'pointer', maxWidth: '100%' }}>
              <option value="plantel">En el colegio</option>
              <option value="municipio">En el municipio</option>
              <option value="departamento">En el departamento</option>
              <option value="region">En la región</option>
              <option value="nacional">Nacional</option>
            </select>
          </Card>
        </div>

        <TabBar tabs={tabs} active={tabActivo} onChange={setTab} />

        {/* RESUMEN */}
        {tabActivo === 'resumen' && (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '220px 1fr', gap: 16 }}>
            <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center' }}>
              <CardTitle>Puntaje</CardTitle>
              <ScoreGauge value={r.puntaje_global} />
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <Badge color={colorTexto(r.desempeno_pct)}>{getLevel(r.desempeno_pct)}</Badge>
                <div style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter', marginTop: 8 }}>
                  Prom. colegio: <strong style={{ color: C.navy }}>{promColegio}</strong>
                </div>
                <div style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter' }}>
                  Diferencia:{' '}
                  <strong style={{ color: r.puntaje_global >= promColegio ? C.navy : C.red }}>
                    {r.puntaje_global >= promColegio ? '+' : ''}{r.puntaje_global - promColegio}
                  </strong>
                </div>
              </div>
            </Card>
            <Card>
              <CardTitle sub="Tu puntaje vs promedio nacional por asignatura">Resumen por Asignatura</CardTitle>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={areaData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                  <XAxis dataKey="area" tick={{ fontSize: 10, fontFamily: 'Inter', fill: C.gray }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'Inter', fill: C.gray }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontFamily: 'Inter', fontSize: 12, borderRadius: 8 }} itemStyle={{ color: C.text }} labelStyle={{ color: C.navy, fontWeight: 600 }} />
                  <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: 11 }} formatter={(v) => <span style={{ color: C.text }}>{v}</span>} />
                  <Bar dataKey="yo" name="Mi puntaje" fill={C.navy} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="nac" name="Nac." fill={C.gray} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* POR ÁREA */}
        {tabActivo === 'areas' && (
          <div>
            <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
              <span style={{ fontSize:12, color:C.gray, fontFamily:'Inter' }}>Comparar contra:</span>
              <select value={areaScope} onChange={e => setAreaScope(e.target.value)} style={{
                padding:'7px 12px', border:`1px solid ${C.grayLt}`, borderRadius:7,
                fontFamily:'Inter', fontSize:13, color:C.text, background:C.white, outline:'none', cursor:'pointer' }}>
                <option value="nacional">Nacional</option>
                <option value="region">Región</option>
                <option value="departamento">Departamento</option>
                <option value="municipio">Municipio</option>
                <option value="plantel">Plantel</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
              {areaData.map((a, i) => {
                const cmp = promAreas?.[areaScope]?.[a.col]
                const hasCmp = cmp != null
                return (
                  <Card key={i}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, fontFamily: 'Inter',
                      marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${C.bg2}` }}>
                      {a.area}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: 16 }}>
                      {[
                        { label: 'Mi puntaje', val: a.yo, color: colorTexto(a.yo, a.akey) },
                        { label: AREA_SCOPE_LABEL[areaScope], val: hasCmp ? cmp : '—', color: C.gray },
                      ].map((item, j) => (
                        <div key={j}>
                          <div style={{ fontSize: 28, fontFamily: 'Playfair Display, serif',
                            color: item.color, fontWeight: 700, lineHeight: 1 }}>{item.val}</div>
                          <div style={{ fontSize: 10, color: C.gray, fontFamily: 'Inter', marginTop: 4 }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ height: 6, background: C.bg2, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${a.yo}%`, borderRadius: 3, background: colorBarra(a.yo, a.akey) }} />
                    </div>
                    {hasCmp && (
                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
                        <Badge color={a.yo >= cmp ? C.navy : C.amber}>
                          {a.yo >= cmp ? '+' : ''}{(a.yo - cmp).toFixed(1)} vs {AREA_SCOPE_SHORT[areaScope]}
                        </Badge>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* PERFIL */}
        {tabActivo === 'perfil' && (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <Card>
              <CardTitle sub="Radar de tu perfil por área">Perfil Académico</CardTitle>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={C.bg2} />
                  <PolarAngleAxis dataKey="comp" tick={{ fontSize: 12, fontFamily: 'Inter', fill: C.gray }} />
                  <Radar name="Mi puntaje" dataKey="yo" stroke={C.navy} fill={C.navy} fillOpacity={0.2} strokeWidth={2} dot={{ fill: C.navy, r: 5 }} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <CardTitle sub="Nivel de desempeño en cada asignatura">Nivel por Asignatura</CardTitle>
              {areaData.map((a, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.text, fontFamily: 'Inter' }}>{a.area}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontFamily: 'Playfair Display, serif',
                        color: colorTexto(a.yo, a.akey), fontWeight: 700 }}>{a.yo}%</span>
                      <Badge color={colorTexto(a.yo, a.akey)}>{getLevel(a.yo)}</Badge>
                    </div>
                  </div>
                  <div style={{ height: 6, background: C.bg2, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${a.yo}%`, borderRadius: 3, background: colorBarra(a.yo, a.akey) }} />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* MI POSICIÓN */}
        {tabActivo === 'posicion' && (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <Card>
              <CardTitle sub="Distribución de puntajes del curso">Distribución del Curso</CardTitle>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={distData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2} />
                  <XAxis dataKey="rango" tick={{ fontSize: 11, fontFamily: 'Inter', fill: C.gray }} />
                  <YAxis tick={{ fontSize: 11, fontFamily: 'Inter', fill: C.gray }} />
                  <Tooltip contentStyle={{ fontFamily: 'Inter', fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="cant" name="Estudiantes" radius={[4, 4, 0, 0]}>
                    {distData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 16, padding: 12, background: C.bg, borderRadius: 8,
                border: `2px solid ${colorTexto((r.puntaje_global / 500) * 100)}`, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter' }}>Tu puntaje</div>
                <div style={{ fontSize: 28, fontFamily: 'Playfair Display, serif',
                  color: colorTexto((r.puntaje_global / 500) * 100), fontWeight: 700 }}>{r.puntaje_global}</div>
                <div style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter' }}>
                  Puesto #{miPuesto} · Percentil {percentilPlantel}°
                </div>
              </div>
            </Card>
            <Card>
              <CardTitle sub="Top 10 del curso">Ranking del Curso</CardTitle>
              {compañeros.slice(0, 10).map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderBottom: i < 9 ? `1px solid ${C.bg2}` : 'none',
                  background: c.estudiante_id === session.id ? `${C.navy}06` : 'transparent',
                  borderRadius: c.estudiante_id === session.id ? 6 : 0,
                  paddingLeft: c.estudiante_id === session.id ? 8 : 0 }}>
                  <div style={{ width: 24, textAlign: 'center', fontSize: 12, fontWeight: 700,
                    color: i === 0 ? '#F59E0B' : i === 1 ? C.gray : i === 2 ? '#CD7F32' : C.grayLt,
                    fontFamily: 'Playfair Display, serif' }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 12, fontFamily: 'Inter',
                    color: c.estudiante_id === session.id ? C.navy : C.text,
                    fontWeight: c.estudiante_id === session.id ? 600 : 400 }}>
                    {c.estudiantes?.nombre?.split(' ').slice(0, 2).join(' ')}
                    {c.estudiante_id === session.id && <span style={{ color: C.navy, marginLeft: 6, fontSize: 11 }}>← tú</span>}
                  </div>
                  <div style={{ fontSize: 16, fontFamily: 'Playfair Display, serif',
                    color: C.navy, fontWeight: 700 }}>
                    {c.puntaje_global}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* MIS RESPUESTAS */}
        {tabActivo === 'respuestas' && (() => {
          const rawRows = prueba?.estructura_excel?.raw || []
          const rawHeader = rawRows[0] || []
          const hIdx = k => rawHeader.findIndex(h => typeof h === 'string' && h.toLowerCase().trim().startsWith(k))
          const iSesion = 0, iNro = 1, iArea = 2, iMateria = 3
          const iEstandar    = hIdx('estándar') >= 0 ? hIdx('estándar') : hIdx('estandar')
          const iCompetencia = hIdx('competencia')
          const iComponente  = hIdx('componente')
          const iTarea       = hIdx('tarea')
          const iRta         = rawHeader.findIndex(h => typeof h === 'string' && ['rta','respuesta correcta','resp. correcta','resp correcta','respuesta'].includes(h.toLowerCase().trim()))
          // gpos = posición global (fila no vacía, 1..N) — coincide con detalle.pregunta
          const preguntas = rawRows.slice(1)
            .filter(f => Array.isArray(f) && f.some(v => v !== '' && v != null))
            .map((f, i) => ({
              gpos: i + 1,
              sesion:      (f[iSesion]    || '').toString().trim(),
              nro:         (f[iNro]       || '').toString().trim(),
              area:        (f[iArea]      || '').toString().trim(),
              materia:     (f[iMateria]   || '').toString().trim(),
              componente:  iComponente  >= 0 ? (f[iComponente]  || '').toString().trim() : '',
              competencia: iCompetencia >= 0 ? (f[iCompetencia] || '').toString().trim() : '',
              tarea:       iTarea       >= 0 ? (f[iTarea]       || '').toString().trim() : '',
              rta:         iRta         >= 0 ? (f[iRta]         || '').toString().trim() : '',
            }))

          const detalleMap = {}
          ;(r.detalle || []).forEach(d => { detalleMap[String(d.pregunta)] = d })

          const thStyle = { padding: '7px 10px', background: C.navy, color: C.white,
            fontSize: 11, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap',
            borderRight: '1px solid rgba(255,255,255,0.12)',
            position: 'sticky', top: 0, zIndex: 1 }
          const tdStyle = (bg) => ({ padding: '5px 8px', fontSize: 11, textAlign: 'center',
            borderBottom: `1px solid ${C.bg2}`, background: bg || C.white })

          return (
            <Card>
              <CardTitle sub={`${preguntas.length} preguntas · ${prueba?.codigo || '—'}`}>
                Mis Respuestas
              </CardTitle>
              {!preguntas.length || !r.detalle ? (
                <div style={{ textAlign: 'center', padding: 40, color: C.gray, fontFamily: 'Inter', fontSize: 13 }}>
                  No hay detalle de respuestas disponible para esta prueba.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 560 }}>
                  <table style={{ borderCollapse: 'collapse', fontFamily: 'Inter', fontSize: 12, width: '100%', minWidth: 700 }}>
                    <thead>
                      <tr>
                        {['Sesión', 'No', 'Área', 'Asignatura', 'Componente', 'Competencia', 'Tarea', 'Rta', 'Mi respuesta'].map(h => (
                          <th key={h} style={{ ...thStyle, textAlign: ['Competencia', 'Componente', 'Tarea', 'Asignatura', 'Área'].includes(h) ? 'left' : 'center' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preguntas.map((q, i) => {
                        const d = detalleMap[q.gpos]
                        const correcto = d?.correcto
                        const cellBg = correcto === true ? '#DCFCE7' : correcto === false ? '#FEE2E2' : null
                        const cellColor = correcto === true ? C.navy : correcto === false ? C.red : C.text
                        const rowBg = i % 2 === 0 ? C.white : '#F8FAFC'
                        return (
                          <tr key={i}>
                            <td style={tdStyle(rowBg)}>{q.sesion}</td>
                            <td style={tdStyle(rowBg)}>{q.nro}</td>
                            <td style={{ ...tdStyle(rowBg), textAlign: 'left', whiteSpace: 'nowrap' }}>{q.area}</td>
                            <td style={{ ...tdStyle(rowBg), textAlign: 'left', whiteSpace: 'nowrap' }}>{q.materia}</td>
                            <td style={{ ...tdStyle(rowBg), textAlign: 'left', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.componente}</td>
                            <td style={{ ...tdStyle(rowBg), textAlign: 'left', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.competencia}</td>
                            <td style={{ ...tdStyle(rowBg), textAlign: 'left', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.tarea}</td>
                            <td style={{ ...tdStyle(cellBg), color: cellColor, fontWeight: 700 }}>{q.rta || '—'}</td>
                            <td style={{ ...tdStyle(cellBg), color: cellColor, fontWeight: 700 }}>{d?.marcada || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )
        })()}

        {/* MENCIÓN DE HONOR (solo mejor puntaje del grado+salón en esta prueba) */}
        {tabActivo === 'mencion' && esMencion && (
          <Card>
            <CardTitle sub="Reconocimiento al mejor puntaje de tu grado y salón en esta prueba">
              🏅 Mención de Honor
            </CardTitle>

            {/* Diploma en pantalla */}
            <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #1A3560 100%)`,
              borderRadius: 16, padding: mobile ? 28 : 40, textAlign: 'center', marginBottom: 24,
              position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 120, opacity: 0.05 }}>🏅</div>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏅</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter',
                letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
                Mención de Honor
              </div>
              <div style={{ fontSize: 28, fontFamily: 'Playfair Display, serif', color: '#FFFFFF',
                fontWeight: 400, marginBottom: 4 }}>{session.nombre}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter', marginBottom: 6 }}>
                Grado {session.grado ?? '—'} · Salón {session.salon ?? '—'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter', marginBottom: 24 }}>
                por su destacado desempeño en el {prueba?.nombre || prueba?.codigo || 'simulacro'}
              </div>
              <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.1)',
                borderRadius: 12, padding: '16px 40px' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter',
                  letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Puntaje Global</div>
                <div style={{ fontSize: 52, fontFamily: 'Playfair Display, serif',
                  color: '#D9B968', fontWeight: 700, lineHeight: 1 }}>{r.puntaje_global}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter', marginTop: 4 }}>de 500 puntos</div>
              </div>
            </div>

            {/* Descargar diploma */}
            <div style={{ textAlign: 'center' }}>
              <button onClick={descargarDiploma} disabled={generando}
                style={{ padding: '11px 26px', background: generando ? C.gray : C.navy, color: '#FFFFFF',
                  border: 'none', borderRadius: 9, fontFamily: 'Inter', fontSize: 13.5, fontWeight: 600,
                  cursor: generando ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 2px 8px rgba(10,31,61,0.25)' }}>
                {generando ? 'Generando…' : '📜  Descargar diploma'}
              </button>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
