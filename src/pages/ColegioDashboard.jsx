import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  C, getColor, getLevel, avg,
  Card, CardTitle, Badge, KpiCard, TabBar, Sidebar
} from '../components/ui'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line, Cell, ComposedChart, ErrorBar
} from 'recharts'

// ── DATOS REALES ─────────────────────────────────────────────
const STUDENTS = [
  {pos:1,  nombre:"Ramirez Sanguino Camilo Andres",     mat_c:100,  mat_e:84,  quim:82.1, fis:100,  bio:100,  cts:100, soc:93,  lc:84.9, ing:98.2, def_:92.3, global_:461},
  {pos:2,  nombre:"Santana Josepha Julian David",        mat_c:96.6, mat_e:95,  quim:88.2, fis:93.9, bio:100,  cts:82,  soc:93,  lc:90,   ing:98.1, def_:92.1, global_:460},
  {pos:3,  nombre:"Caraballo Navarro Isabella Sofia",    mat_c:89.4, mat_e:95,  quim:76,   fis:87.7, bio:94.4, cts:100, soc:97,  lc:82.5, ing:88.9, def_:88.4, global_:442},
  {pos:4,  nombre:"Meza Viana Maria Jose",               mat_c:89.5, mat_e:84,  quim:64.3, fis:75.7, bio:94.3, cts:82,  soc:90,  lc:87.3, ing:96.3, def_:87.5, global_:438},
  {pos:5,  nombre:"Sanchez Salcedo Valentina",           mat_c:92.9, mat_e:90,  quim:64,   fis:82.4, bio:88.5, cts:100, soc:90,  lc:82.4, ing:98,   def_:87,   global_:435},
  {pos:6,  nombre:"Saavedra Schwart Mateo Juliocesar",   mat_c:92.9, mat_e:79,  quim:70,   fis:76.1, bio:94.1, cts:65,  soc:97,  lc:87.4, ing:94.3, def_:87,   global_:435},
  {pos:7,  nombre:"Solano Cantillo Josue David",         mat_c:85.9, mat_e:90,  quim:46.1, fis:93.8, bio:94.4, cts:82,  soc:97,  lc:89.7, ing:92.6, def_:86.9, global_:434},
  {pos:8,  nombre:"Angulo Gomez Antonio Jose",           mat_c:93.3, mat_e:74,  quim:64.2, fis:82.2, bio:100,  cts:82,  soc:90,  lc:92.2, ing:94.4, def_:86.6, global_:433},
  {pos:9,  nombre:"Franco Muskus Juan Pablo",            mat_c:89.7, mat_e:90,  quim:76.4, fis:76.3, bio:88.7, cts:82,  soc:87,  lc:89.9, ing:92.5, def_:86,   global_:430},
  {pos:10, nombre:"Martinez Dimate Mateo",               mat_c:82.5, mat_e:69,  quim:76,   fis:76.5, bio:94.1, cts:82,  soc:90,  lc:95,   ing:94.5, def_:85.8, global_:429},
  {pos:11, nombre:"Quiroz Saade Juan Fernando",          mat_c:82.4, mat_e:79,  quim:64.2, fis:87.7, bio:100,  cts:82,  soc:93,  lc:87.4, ing:90.8, def_:85.5, global_:427},
  {pos:12, nombre:"Martinez De La Rosa Abby Dayana",     mat_c:75.3, mat_e:84,  quim:76.5, fis:76,   bio:94.1, cts:82,  soc:87,  lc:87.2, ing:90.7, def_:84.6, global_:423},
  {pos:13, nombre:"Melendez Negrete Ana Belen",          mat_c:86.5, mat_e:79,  quim:52,   fis:81.9, bio:94.5, cts:100, soc:90,  lc:79.8, ing:89,   def_:84.4, global_:422},
  {pos:14, nombre:"Arana Reyes Shadia",                  mat_c:86.1, mat_e:95,  quim:46.4, fis:70.4, bio:94.1, cts:100, soc:83,  lc:84.6, ing:94.3, def_:84.1, global_:421},
  {pos:15, nombre:"Baez Diaz Santiago",                  mat_c:85.9, mat_e:85,  quim:76.1, fis:76.1, bio:94.1, cts:82,  soc:86,  lc:82.3, ing:90.7, def_:84,   global_:420},
  {pos:16, nombre:"Nieves Barroso Samuel David",         mat_c:93.1, mat_e:74,  quim:40.5, fis:76,   bio:100,  cts:82,  soc:90,  lc:84.7, ing:92.4, def_:83.5, global_:418},
  {pos:17, nombre:"Avilez Solano Ana Valentina",         mat_c:85.9, mat_e:74,  quim:63.9, fis:64,   bio:94.4, cts:82,  soc:93,  lc:82.1, ing:94.4, def_:83.4, global_:417},
  {pos:18, nombre:"Lizarazo Delgado Santiago",           mat_c:89.4, mat_e:69,  quim:58.4, fis:81.9, bio:94.3, cts:100, soc:90,  lc:82.2, ing:98,   def_:82.7, global_:414},
  {pos:19, nombre:"Blandon Bermudez Andres Daniel",      mat_c:100,  mat_e:90,  quim:52.4, fis:75.9, bio:77.2, cts:82,  soc:86,  lc:77.6, ing:96.1, def_:82.4, global_:412},
  {pos:20, nombre:"Hamburguer Angulo Sophia",            mat_c:86.1, mat_e:69,  quim:52.6, fis:69.6, bio:94.3, cts:82,  soc:93,  lc:77.5, ing:96.1, def_:81.7, global_:408},
  {pos:21, nombre:"Angulo Leal Gabriela Sofia",          mat_c:75.7, mat_e:69,  quim:40.8, fis:82.2, bio:88.6, cts:100, soc:97,  lc:77.6, ing:96.3, def_:81.3, global_:406},
  {pos:22, nombre:"Avellaneda Ardila Luciana",           mat_c:65.6, mat_e:69,  quim:52.4, fis:87.9, bio:88.3, cts:83,  soc:86,  lc:89.6, ing:85.2, def_:81.2, global_:406},
  {pos:23, nombre:"Ballestas De La Ossa Laura",          mat_c:75.7, mat_e:79,  quim:58,   fis:70.6, bio:88.1, cts:82,  soc:90,  lc:77.4, ing:92.5, def_:80,   global_:400},
  {pos:24, nombre:"Molina Mejia Humberto Joel",          mat_c:78.8, mat_e:79,  quim:57.9, fis:76.1, bio:88.8, cts:82,  soc:79,  lc:77.2, ing:83.6, def_:79.6, global_:398},
  {pos:25, nombre:"Osorio Rangel Danna Sofia",           mat_c:72.3, mat_e:79,  quim:40.7, fis:76.4, bio:94.1, cts:82,  soc:83,  lc:82.4, ing:92.6, def_:79.3, global_:397},
  {pos:26, nombre:"Otero Castro Fernando Adrian",        mat_c:82.7, mat_e:74,  quim:70.2, fis:69.6, bio:77.3, cts:82,  soc:83,  lc:84.8, ing:88.8, def_:79.1, global_:396},
  {pos:27, nombre:"Salas Garcia Maria Jose",             mat_c:82.4, mat_e:69,  quim:64.1, fis:70.2, bio:77,   cts:66,  soc:80,  lc:79.9, ing:87,   def_:78.4, global_:392},
  {pos:28, nombre:"Oviedo Rico Susana",                  mat_c:72,   mat_e:69,  quim:58.1, fis:75.8, bio:94.1, cts:82,  soc:76,  lc:79.8, ing:90.6, def_:78.2, global_:391},
  {pos:29, nombre:"Bolaños Villa Santiago Andres",       mat_c:89.3, mat_e:64,  quim:46.2, fis:70.3, bio:88.3, cts:66,  soc:79,  lc:77.1, ing:90.7, def_:77.6, global_:388},
  {pos:30, nombre:"Castro Rodriguez Valerie",            mat_c:82.5, mat_e:74,  quim:34.9, fis:87.7, bio:82.8, cts:82,  soc:79,  lc:77.6, ing:92.5, def_:77.2, global_:386},
  {pos:31, nombre:"Lugo Suaza Samuel",                   mat_c:89.6, mat_e:74,  quim:46.6, fis:46.2, bio:88.5, cts:82,  soc:63,  lc:82.7, ing:79.7, def_:76.5, global_:382},
  {pos:32, nombre:"Gomez Cespedes Valeria",              mat_c:68.8, mat_e:54,  quim:51.9, fis:70.2, bio:100,  cts:65,  soc:86,  lc:82.4, ing:92.5, def_:76.4, global_:382},
  {pos:33, nombre:"Barros Miranda Sofia",                mat_c:82.3, mat_e:79,  quim:46.1, fis:63.7, bio:94.1, cts:82,  soc:83,  lc:72.1, ing:92.5, def_:76.4, global_:382},
  {pos:34, nombre:"Guerra De La Cruz Sebastian Enrique", mat_c:82.5, mat_e:79,  quim:46.5, fis:81.7, bio:76.9, cts:82,  soc:79,  lc:70,   ing:90.7, def_:76.3, global_:381},
  {pos:35, nombre:"Morales Morales Gabriela",            mat_c:75.3, mat_e:74,  quim:58.3, fis:76.1, bio:83.2, cts:66,  soc:83,  lc:74.8, ing:90.6, def_:76,   global_:380},
  {pos:36, nombre:"Curvelo Gallardo Gabriela",           mat_c:82.7, mat_e:65,  quim:46.5, fis:76.3, bio:88.6, cts:82,  soc:86,  lc:72.6, ing:94.4, def_:75.9, global_:379},
  {pos:37, nombre:"Llanos Sanchez Allison",              mat_c:58.6, mat_e:64,  quim:65.1, fis:70,   bio:88.1, cts:82,  soc:87,  lc:82.1, ing:81.6, def_:75.5, global_:377},
  {pos:38, nombre:"Mercado Sanchez Isabella",            mat_c:75.7, mat_e:69,  quim:34.9, fis:51.9, bio:88.4, cts:100, soc:76,  lc:80.1, ing:94.5, def_:74.6, global_:373},
  {pos:39, nombre:"Castro Manosalva Lina Marcela",       mat_c:79,   mat_e:74,  quim:40.2, fis:81.8, bio:88.4, cts:83,  soc:79,  lc:65,   ing:85.1, def_:73.7, global_:369},
  {pos:40, nombre:"Orozco Saavedra Daniel Alejadro",     mat_c:89.4, mat_e:74,  quim:41,   fis:81.6, bio:71.1, cts:83,  soc:73,  lc:72.6, ing:94.3, def_:73.6, global_:368},
  {pos:41, nombre:"Campo Betancourt Samuel",             mat_c:78.9, mat_e:70,  quim:53,   fis:64.1, bio:88.5, cts:82,  soc:56,  lc:75.1, ing:92.5, def_:73.1, global_:365},
  {pos:42, nombre:"Jimenez Zabaleta Paola Andrea",       mat_c:55.4, mat_e:64,  quim:28.9, fis:57.7, bio:76.7, cts:82,  soc:83,  lc:84.7, ing:96.3, def_:73.1, global_:365},
  {pos:43, nombre:"Cuello Barreto Emanuel David",        mat_c:79.2, mat_e:79,  quim:46.8, fis:69.4, bio:83,   cts:82,  soc:76,  lc:70.1, ing:88.7, def_:72.5, global_:363},
  {pos:44, nombre:"Bernal Mayorquin Mariana",            mat_c:69.1, mat_e:60,  quim:40.4, fis:75.4, bio:82.9, cts:82,  soc:83,  lc:70.2, ing:92.5, def_:72.5, global_:362},
  {pos:45, nombre:"Maravilla Fonseca Sofia Isabel",      mat_c:65.6, mat_e:79,  quim:51.9, fis:64.5, bio:82.8, cts:82,  soc:76,  lc:70.2, ing:83.1, def_:71.7, global_:358},
  {pos:46, nombre:"Peña Montes Shiara Sofia",            mat_c:65.7, mat_e:69,  quim:29,   fis:69.8, bio:88.6, cts:82,  soc:83,  lc:74.5, ing:85,   def_:71.5, global_:358},
  {pos:47, nombre:"Mejia Marquez Ariana Isabel",         mat_c:65.8, mat_e:59,  quim:63.9, fis:52.5, bio:100,  cts:82,  soc:63,  lc:77.1, ing:96.2, def_:70.4, global_:352},
  {pos:48, nombre:"Carmona Cano Ariana",                 mat_c:68.7, mat_e:69,  quim:28.8, fis:63.8, bio:94.1, cts:67,  soc:83,  lc:64.8, ing:81.5, def_:69.1, global_:346},
]

const TABLERO_COMPARATIVO = [
  {tipo:'Mejores Promedios', mat:89, cn:86, soc:92, lc:96, ing:95, def_:88, global_:441},
  {tipo:'Nacional',          mat:47, cn:48, soc:51, lc:55, ing:56, def_:51, global_:253},
  {tipo:'Ciudad',            mat:53, cn:55, soc:62, lc:63, ing:71, def_:59, global_:296},
  {tipo:'Plantel',           mat:79, cn:76, soc:82, lc:80, ing:91, def_:80, global_:400},
]

const TABLERO_SALON = [
  {grado:'11', salon:'1', mat_gen:74, mat_nogen:71, quim:48, fis:71, bio:88, cts:82, soc:76, ciu:81, lc:77, ing:90, def_:76, global_:380, eval_:23},
  {grado:'11', salon:'2', mat_gen:87, mat_nogen:80, quim:61, fis:78, bio:92, cts:84, soc:84, ciu:87, lc:83, ing:93, def_:84, global_:418, eval_:25},
]

const COMPETENCIAS_PROM = [
  {comp:'Sociolingüística',                                        prom:99.1},
  {comp:'Lingüística',                                             prom:92.0},
  {comp:'Comprende articulación del texto',                        prom:90.4},
  {comp:'Pragmática',                                              prom:88.4},
  {comp:'Razonamiento y Argumentación',                            prom:88.3},
  {comp:'Interpretación y Análisis de Perspectivas',               prom:86.3},
  {comp:'Interpretación y Representación',                         prom:82.5},
  {comp:'Explicación de Fenómenos',                                prom:81.3},
  {comp:'Identifica Contenidos Explícitos',                        prom:80.4},
  {comp:'Pensamiento Reflexivo y Sistémico',                       prom:79.2},
  {comp:'Pensamiento Social',                                      prom:78.0},
  {comp:'Indagación',                                              prom:74.3},
  {comp:'Uso Comprensivo del Conoc. Científico',                   prom:72.1},
  {comp:'Reflexiona y Evalúa el Texto',                            prom:68.0},
  {comp:'Formulación y Ejecución',                                 prom:67.6},
]

const NIVELES_MATERIA = [
  {materia:'Inglés',           superior:100, alto:0,  basico:0,  bajo:0},
  {materia:'Biología',         superior:97,  alto:3,  basico:0,  bajo:0},
  {materia:'Comp. Ciudadanas', superior:88,  alto:11, basico:1,  bajo:0},
  {materia:'Cont. Genéricos',  superior:82,  alto:17, basico:1,  bajo:0},
  {materia:'Cont. No Genér.',  superior:84,  alto:13, basico:3,  bajo:0},
  {materia:'Lectura Crítica',  superior:83,  alto:15, basico:1,  bajo:0},
  {materia:'CTS',              superior:70,  alto:30, basico:0,  bajo:0},
  {materia:'Cs. Sociales',     superior:76,  alto:21, basico:3,  bajo:0},
  {materia:'Física',           superior:64,  alto:20, basico:10, bajo:6},
  {materia:'Química',          superior:29,  alto:28, basico:36, bajo:6},
]

const DESVIACION_MATERIAS = [
  {materia:'Razon. Cuantit.',  prom:81, desv:10, min:55, max:100},
  {materia:'Conoc. Específico',prom:76, desv:10, min:54, max:95},
  {materia:'Química',          prom:55, desv:14, min:29, max:88},
  {materia:'Física',           prom:75, desv:11, min:46, max:100},
  {materia:'Biología',         prom:90, desv:7,  min:71, max:100},
  {materia:'CTS',              prom:83, desv:9,  min:65, max:100},
  {materia:'Sociales',         prom:80, desv:12, min:54, max:100},
  {materia:'Ciudadanas',       prom:84, desv:9,  min:56, max:97},
  {materia:'Lect. Crítica',    prom:80, desv:7,  min:65, max:95},
  {materia:'Inglés',           prom:91, desv:5,  min:79, max:98},
]

const OPOR_MEJORA = [
  {nro:"S2-P28",  materia:"Matemáticas",   componente:"Álgebra y Cálculo",           plan:4,  nac:15, dif:"Superior"},
  {nro:"S1-P30",  materia:"Lect. Crítica", componente:"Dim. Relacional-Intertextual", plan:6,  nac:12, dif:"Superior"},
  {nro:"S1-P56",  materia:"Lect. Crítica", componente:"Dimensión Enunciativa",        plan:12, nac:16, dif:"Superior"},
  {nro:"S1-P120", materia:"Química",       componente:"Asp. Fisicoquímicos Mezclas",  plan:14, nac:19, dif:"Superior"},
  {nro:"S1-P111", materia:"Química",       componente:"Asp. Analíticos Sustancias",   plan:18, nac:12, dif:"Superior"},
  {nro:"S1-P62",  materia:"Lect. Crítica", componente:"Dimensión Sociocultural",      plan:20, nac:24, dif:"Superior"},
  {nro:"S1-P106", materia:"Química",       componente:"Asp. Analíticos Mezclas",      plan:20, nac:23, dif:"Superior"},
  {nro:"S1-P17",  materia:"Matemáticas",   componente:"Geometría",                    plan:25, nac:22, dif:"Superior"},
  {nro:"S2-P47",  materia:"Matemáticas",   componente:"Estadística",                  plan:30, nac:27, dif:"Alto"},
  {nro:"S1-P88",  materia:"Cs. Sociales",  componente:"El Poder y Economía",          plan:33, nac:28, dif:"Alto"},
  {nro:"S2-P34",  materia:"Matemáticas",   componente:"Geometría",                    plan:35, nac:30, dif:"Alto"},
  {nro:"S1-P23",  materia:"Matemáticas",   componente:"Geometría",                    plan:43, nac:18, dif:"Superior"},
]

const RADAR_AREAS = [
  {area:'Matemáticas',    plantel:81, nacional:47},
  {area:'Cs. Naturales',  plantel:76, nacional:48},
  {area:'Soc. y Ciudad.', plantel:82, nacional:51},
  {area:'Lect. Crítica',  plantel:80, nacional:55},
  {area:'Inglés',         plantel:91, nacional:56},
]

// ── HELPERS ──────────────────────────────────────────────────
const avgArr = arr => Math.round(arr.reduce((a,b)=>a+b,0)/arr.length)
const PROM_GLOBAL = avgArr(STUDENTS.map(s=>s.global_))

const DIST_PUNTAJES = [
  {rango:'< 380',   cant:STUDENTS.filter(s=>s.global_<380).length,              color:C.red},
  {rango:'380–399', cant:STUDENTS.filter(s=>s.global_>=380&&s.global_<400).length, color:C.amber},
  {rango:'400–419', cant:STUDENTS.filter(s=>s.global_>=400&&s.global_<420).length, color:C.blue},
  {rango:'420–439', cant:STUDENTS.filter(s=>s.global_>=420&&s.global_<440).length, color:C.green},
  {rango:'≥ 440',   cant:STUDENTS.filter(s=>s.global_>=440).length,             color:C.navy},
]

// ── SEMÁFORO TABLERO ─────────────────────────────────────────
const semaforoColor = (val) => {
  if (val >= 65) return C.green
  if (val >= 45) return '#F59E0B'
  if (val >= 25) return '#F97316'
  return C.red
}
const semaforoBg = (val) => {
  if (val >= 65) return '#DCFCE7'
  if (val >= 45) return '#FEF9C3'
  if (val >= 25) return '#FFEDD5'
  return '#FEE2E2'
}

// ── CUSTOM TOOLTIP ───────────────────────────────────────────
const CustomTooltip = ({active, payload, label}) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{background:C.white, border:`1px solid ${C.grayLt}`, borderRadius:8,
      padding:'10px 14px', fontFamily:'Inter', fontSize:12, boxShadow:'0 4px 16px rgba(0,0,0,0.1)'}}>
      <div style={{fontWeight:600, color:C.navy, marginBottom:6}}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{color:p.color, marginBottom:2}}>{p.name}: <strong>{p.value}%</strong></div>
      ))}
    </div>
  )
}

// ── TAB BAR ──────────────────────────────────────────────────
const TabBar = ({tabs, active, onChange}) => (
  <div style={{display:'flex', gap:4, marginBottom:24, background:C.bg2,
    padding:4, borderRadius:10, flexWrap:'wrap'}}>
    {tabs.map(t => (
      <button key={t.id} onClick={()=>onChange(t.id)} style={{
        padding:'8px 14px', borderRadius:7, border:'none', cursor:'pointer',
        fontFamily:'Inter', fontSize:12, fontWeight:500,
        background: active===t.id ? C.white : 'transparent',
        color: active===t.id ? C.navy : C.gray,
        boxShadow: active===t.id ? '0 1px 4px rgba(10,31,61,0.1)' : 'none',
        transition:'all 0.2s',
      }}>{t.label}</button>
    ))}
  </div>
)

// ── CARD ─────────────────────────────────────────────────────
const Card = ({children, style={}}) => (
  <div style={{background:C.white, borderRadius:12, padding:24,
    boxShadow:'0 1px 4px rgba(10,31,61,0.07), 0 4px 16px rgba(10,31,61,0.05)',
    border:`1px solid ${C.grayLt}`, ...style}}>{children}</div>
)

const CardTitle = ({children, sub}) => (
  <div style={{marginBottom:20, paddingBottom:12, borderBottom:`1px solid ${C.bg2}`}}>
    <div style={{fontSize:11, fontWeight:600, color:C.navy, letterSpacing:'0.08em',
      textTransform:'uppercase', fontFamily:'Inter'}}>{children}</div>
    {sub && <div style={{fontSize:11, color:C.gray, fontFamily:'Inter', marginTop:3}}>{sub}</div>}
  </div>
)

const Badge = ({color, children}) => (
  <span style={{background:color+'18', color, border:`1px solid ${color}40`,
    padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:500, whiteSpace:'nowrap'}}>
    {children}
  </span>
)

const KpiCard = ({label, value, sub, color=C.navy}) => (
  <Card style={{textAlign:'center'}}>
    <div style={{fontSize:10, color:C.gray, fontFamily:'Inter', textTransform:'uppercase',
      letterSpacing:'0.1em', marginBottom:8}}>{label}</div>
    <div style={{fontSize:32, fontFamily:'Playfair Display, serif', color,
      fontWeight:700, lineHeight:1, marginBottom:6}}>{value}</div>
    {sub && <div style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>{sub}</div>}
  </Card>
)

// ── LEYENDA NIVELES ──────────────────────────────────────────
const LeyendaNiveles = () => (
  <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:12}}>
    {[
      {label:'Avanzado (65-100)', color:C.green},
      {label:'Satisfactorio (45-64)', color:'#F59E0B'},
      {label:'Mínimo (25-44)', color:'#F97316'},
      {label:'Insuficiente (0-24)', color:C.red},
    ].map((l,i) => (
      <div key={i} style={{display:'flex', alignItems:'center', gap:6}}>
        <div style={{width:12, height:12, borderRadius:2, background:l.color}}/>
        <span style={{fontSize:11, color:C.gray, fontFamily:'Inter'}}>{l.label}</span>
      </div>
    ))}
  </div>
)

// ── MAIN DASHBOARD ───────────────────────────────────────────
export default function ColegioDashboard({session, onLogout}) {
  const [tab, setTab] = useState('tablero')

  const tabs = [
    {id:'tablero',      label:'Tablero de Gestión'},
    {id:'areas',        label:'Análisis por Áreas'},
    {id:'niveles',      label:'% por Nivel'},
    {id:'desviacion',   label:'Desviación'},
    {id:'competencias', label:'Competencias'},
    {id:'mejora',       label:'Oportunidades'},
    {id:'ranking',      label:'Ranking'},
  ]

  return (
    <div style={{display:'flex', minHeight:'100vh', background:C.bg}}>
      {/* SIDEBAR */}
      <div style={{width:220, minHeight:'100vh', background:C.navy,
        display:'flex', flexDirection:'column', flexShrink:0}}>
        <div style={{padding:'28px 20px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:15, fontFamily:'Playfair Display, serif', color:C.white, marginBottom:2}}>
            Milton Ochoa
          </div>
          <div style={{fontSize:10, color:'rgba(255,255,255,0.4)', fontFamily:'Inter',
            letterSpacing:'0.12em', textTransform:'uppercase'}}>Portal de Resultados</div>
        </div>
        <div style={{flex:1, padding:'12px'}}>
          <div style={{background:'rgba(45,155,111,0.15)', border:'1px solid rgba(45,155,111,0.3)',
            borderRadius:8, padding:'10px 12px', marginBottom:12}}>
            <div style={{fontSize:11, color:'#3AB882', fontFamily:'Inter', fontWeight:600, marginBottom:2}}>
              {session?.nombre || 'Colegio Boston Internacional'}
            </div>
            <div style={{fontSize:10, color:'rgba(255,255,255,0.4)', fontFamily:'Inter'}}>
              {session?.ciudad || 'Barranquilla'} · GO2 · Grado 11°
            </div>
            <div style={{marginTop:8, fontSize:16, fontFamily:'Playfair Display, serif',
              color:C.white, fontWeight:700}}>Prom: {PROM_GLOBAL}</div>
          </div>
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              width:'100%', textAlign:'left', padding:'9px 12px', borderRadius:8,
              border:'none', cursor:'pointer', marginBottom:2, fontFamily:'Inter', fontSize:11,
              background: tab===t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: tab===t.id ? C.white : 'rgba(255,255,255,0.55)',
              borderLeft: tab===t.id ? `3px solid ${C.green}` : '3px solid transparent',
              transition:'all 0.2s',
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:12, color:C.white, fontFamily:'Inter', fontWeight:500, marginBottom:2}}>
            {session?.nombre || 'Colegio Boston Internacional'}
          </div>
          <div style={{fontSize:10, color:'rgba(255,255,255,0.4)', fontFamily:'Inter', marginBottom:12}}>
            {session?.ciudad || 'Barranquilla'}
          </div>
          <button onClick={onLogout} style={{width:'100%', padding:'8px', borderRadius:7,
            border:'1px solid rgba(255,255,255,0.15)', background:'transparent',
            color:'rgba(255,255,255,0.5)', fontFamily:'Inter', fontSize:11, cursor:'pointer'}}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main style={{flex:1, padding:'36px 40px', overflowY:'auto'}}>
        {/* HEADER */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:11, color:C.green, letterSpacing:'0.15em',
            textTransform:'uppercase', fontFamily:'Inter', marginBottom:6}}>
            Simulacro GO2 · Grado 11° · 12 de junio de 2026
          </div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12}}>
            <div>
              <h1 style={{fontSize:26, fontFamily:'Playfair Display, serif', color:C.navy, marginBottom:4}}>
                {session?.nombre || 'Colegio Boston Internacional'}
              </h1>
              <div style={{fontSize:13, color:C.gray, fontFamily:'Inter'}}>
                {session?.ciudad || 'Barranquilla, Atlántico'} · Código 7146 · 48 estudiantes evaluados
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:28}}>
          <KpiCard label="Prom. Global" value={PROM_GLOBAL} sub="Promedio de 48 estudiantes" color={C.navy}/>
          <KpiCard label="Mejor puntaje" value={461} sub="Ramirez Sanguino C.A." color={C.green}/>
          <KpiCard label="Puntaje mínimo" value={346} sub="Carmona Cano Ariana" color={C.amber}/>
          <KpiCard label="Oport. mejora" value={12} sub="Preguntas críticas" color={C.red}/>
        </div>

        <TabBar tabs={tabs} active={tab} onChange={setTab}/>

        {/* ══ TABLERO DE GESTIÓN ══════════════════════════════ */}
        {tab==='tablero' && (
          <div style={{display:'grid', gap:16}}>
            <Card>
              <CardTitle sub="Comparativo de promedios por área — Simulacro GO2">
                Tablero de Gestión
              </CardTitle>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                  <thead>
                    <tr style={{background:C.navy}}>
                      {['Promedio','Matemáticas','Ciencias Naturales','Sociales y Ciudad.','Lectura Crítica','Inglés','Definitiva','Global'].map(h => (
                        <th key={h} style={{padding:'10px 14px', fontSize:12, color:C.white,
                          fontWeight:600, textAlign:'center', whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TABLERO_COMPARATIVO.map((row,i) => (
                      <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`}}>
                        <td style={{padding:'10px 14px', fontSize:13, fontWeight:600, color:C.navy,
                          fontFamily:'Inter'}}>{row.tipo}</td>
                        {[row.mat, row.cn, row.soc, row.lc, row.ing, row.def_].map((val,j) => (
                          <td key={j} style={{padding:'8px', textAlign:'center'}}>
                            <div style={{
                              background: semaforoBg(val),
                              color: semaforoColor(val),
                              padding:'6px 10px', borderRadius:6,
                              fontWeight:700, fontSize:14,
                              fontFamily:'Playfair Display, serif',
                              display:'inline-block', minWidth:40,
                            }}>{val}</div>
                          </td>
                        ))}
                        <td style={{padding:'8px', textAlign:'center'}}>
                          <div style={{fontFamily:'Playfair Display, serif', fontSize:16,
                            fontWeight:700, color:C.navy}}>{row.global_}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <LeyendaNiveles/>
            </Card>

            <Card>
              <CardTitle sub="Promedios por grado y salón — Simulacro GO2">
                Resultados por Salón
              </CardTitle>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                  <thead>
                    <tr style={{background:C.navy}}>
                      {['Grado','Salón','Prueba','Mat. Gen.','Mat. No Gen.','Química','Física','Biología','CTS','Sociales','Ciudadanas','Lect. Crítica','Inglés','Definitiva','Global','Eval.'].map(h => (
                        <th key={h} style={{padding:'8px 10px', fontSize:11, color:C.white,
                          fontWeight:600, textAlign:'center', whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TABLERO_SALON.map((row,i) => (
                      <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`}}>
                        <td style={{padding:'10px', textAlign:'center', fontSize:13, fontWeight:600, color:C.navy}}>{row.grado}</td>
                        <td style={{padding:'10px', textAlign:'center', fontSize:13, fontWeight:600, color:C.navy}}>{row.salon}</td>
                        <td style={{padding:'10px', textAlign:'center', fontSize:12, color:C.gray}}>GO2</td>
                        {[row.mat_gen, row.mat_nogen, row.quim, row.fis, row.bio, row.cts, row.soc, row.ciu, row.lc, row.ing, row.def_].map((val,j) => (
                          <td key={j} style={{padding:'6px', textAlign:'center'}}>
                            <div style={{
                              background: semaforoBg(val),
                              color: semaforoColor(val),
                              padding:'4px 8px', borderRadius:5,
                              fontWeight:700, fontSize:13,
                              display:'inline-block', minWidth:36,
                            }}>{val}</div>
                          </td>
                        ))}
                        <td style={{padding:'10px', textAlign:'center', fontSize:14,
                          fontWeight:700, color:C.navy, fontFamily:'Playfair Display, serif'}}>{row.global_}</td>
                        <td style={{padding:'10px', textAlign:'center', fontSize:12, color:C.gray}}>{row.eval_}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <LeyendaNiveles/>
            </Card>
          </div>
        )}

        {/* ══ ANÁLISIS POR ÁREAS ══════════════════════════════ */}
        {tab==='areas' && (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <Card>
              <CardTitle sub="Perfil del colegio vs promedio nacional por área">
                Radar — Desempeño por Área
              </CardTitle>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={RADAR_AREAS}>
                  <PolarGrid stroke={C.bg2}/>
                  <PolarAngleAxis dataKey="area" tick={{fontSize:12, fontFamily:'Inter', fill:C.gray}}/>
                  <Radar name="Plantel" dataKey="plantel" stroke={C.navy} fill={C.navy} fillOpacity={0.25} strokeWidth={2} dot={{fill:C.navy, r:5}}/>
                  <Radar name="Nacional" dataKey="nacional" stroke={C.grayLt} fill={C.grayLt} fillOpacity={0.1} strokeWidth={1.5}/>
                  <Legend wrapperStyle={{fontFamily:'Inter', fontSize:12}}/>
                </RadarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <CardTitle sub="Promedio colegio vs nacional por área">
                Comparativo por Área
              </CardTitle>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={RADAR_AREAS} layout="vertical" margin={{top:0, right:20, bottom:0, left:80}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2}/>
                  <XAxis type="number" tick={{fontSize:11, fontFamily:'Inter', fill:C.gray}} domain={[0,100]}/>
                  <YAxis type="category" dataKey="area" tick={{fontSize:11, fontFamily:'Inter', fill:C.gray}} width={80}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{fontFamily:'Inter', fontSize:11}}/>
                  <Bar dataKey="plantel" name="Plantel %" fill={C.navy} radius={[0,4,4,0]}/>
                  <Bar dataKey="nacional" name="Nacional %" fill={C.grayLt} radius={[0,4,4,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card style={{gridColumn:'1/3'}}>
              <CardTitle sub="Distribución de puntajes globales">
                Distribución de Puntajes
              </CardTitle>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={DIST_PUNTAJES} margin={{top:0, right:0, bottom:0, left:-20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2}/>
                  <XAxis dataKey="rango" tick={{fontSize:11, fontFamily:'Inter', fill:C.gray}}/>
                  <YAxis tick={{fontSize:11, fontFamily:'Inter', fill:C.gray}}/>
                  <Tooltip contentStyle={{fontFamily:'Inter', fontSize:12, borderRadius:8}}/>
                  <Bar dataKey="cant" name="Estudiantes" radius={[4,4,0,0]}>
                    {DIST_PUNTAJES.map((d,i) => <Cell key={i} fill={d.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* ══ % POR NIVEL ═════════════════════════════════════ */}
        {tab==='niveles' && (
          <div style={{display:'grid', gap:16}}>
            <Card>
              <CardTitle sub="Porcentaje de estudiantes por nivel de desempeño y materia">
                % Estudiantes por Nivel de Desempeño
              </CardTitle>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={NIVELES_MATERIA} margin={{top:10, right:0, bottom:0, left:-20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2}/>
                  <XAxis dataKey="materia" tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}}/>
                  <YAxis tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}} domain={[0,100]}/>
                  <Tooltip contentStyle={{fontFamily:'Inter', fontSize:12, borderRadius:8}}/>
                  <Legend wrapperStyle={{fontFamily:'Inter', fontSize:11}}/>
                  <Bar dataKey="superior" name="Superior" stackId="a" fill={C.green}/>
                  <Bar dataKey="alto" name="Alto" stackId="a" fill="#F59E0B"/>
                  <Bar dataKey="basico" name="Básico" stackId="a" fill="#F97316"/>
                  <Bar dataKey="bajo" name="Bajo" stackId="a" fill={C.red}/>
                </BarChart>
              </ResponsiveContainer>
              <LeyendaNiveles/>
            </Card>
            <Card>
              <CardTitle sub="Cantidad y porcentaje de estudiantes por nivel">
                Tabla Detallada por Materia
              </CardTitle>
              <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                <thead>
                  <tr style={{borderBottom:`2px solid ${C.bg2}`}}>
                    {['Materia','Sup %','Alto %','Básico %','Bajo %'].map(h => (
                      <th key={h} style={{textAlign:'left', padding:'8px 12px', fontSize:10,
                        color:C.gray, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {NIVELES_MATERIA.map((m,i) => (
                    <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`,
                      background:i%2===0?`${C.bg}80`:'transparent'}}>
                      <td style={{padding:'10px 12px', fontSize:13, color:C.text, fontWeight:500}}>{m.materia}</td>
                      {[
                        {val:m.superior, color:C.green},
                        {val:m.alto, color:'#F59E0B'},
                        {val:m.basico, color:'#F97316'},
                        {val:m.bajo, color:C.red},
                      ].map((item,j) => (
                        <td key={j} style={{padding:'10px 12px'}}>
                          <Badge color={item.color}>{item.val}%</Badge>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* ══ DESVIACIÓN ══════════════════════════════════════ */}
        {tab==='desviacion' && (
          <div style={{display:'grid', gap:16}}>
            <Card>
              <CardTitle sub="Promedio, valor mínimo y máximo por materia">
                Desviación por Materias
              </CardTitle>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={DESVIACION_MATERIAS} margin={{top:10, right:20, bottom:0, left:-20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2}/>
                  <XAxis dataKey="materia" tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}}/>
                  <YAxis tick={{fontSize:10, fontFamily:'Inter', fill:C.gray}} domain={[0,110]}/>
                  <Tooltip contentStyle={{fontFamily:'Inter', fontSize:12, borderRadius:8}}/>
                  <Bar dataKey="prom" name="Promedio" radius={[4,4,0,0]}>
                    {DESVIACION_MATERIAS.map((d,i) => (
                      <Cell key={i} fill={d.prom>=65?C.green:d.prom>=45?'#F59E0B':'#F97316'}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <CardTitle sub="Promedio / Desviación / Mínimo / Máximo por materia">
                Tabla de Desviación
              </CardTitle>
              <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                <thead>
                  <tr style={{borderBottom:`2px solid ${C.bg2}`}}>
                    {['Materia','Promedio','Desviación','Mín. Valor','Máx. Valor'].map(h => (
                      <th key={h} style={{textAlign:'left', padding:'8px 12px', fontSize:10,
                        color:C.gray, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DESVIACION_MATERIAS.map((m,i) => (
                    <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`,
                      background:i%2===0?`${C.bg}80`:'transparent'}}>
                      <td style={{padding:'10px 12px', fontSize:13, color:C.text, fontWeight:500}}>{m.materia}</td>
                      <td style={{padding:'10px 12px'}}>
                        <div style={{display:'inline-block', background:semaforoBg(m.prom),
                          color:semaforoColor(m.prom), padding:'4px 10px', borderRadius:6,
                          fontWeight:700, fontSize:14, fontFamily:'Playfair Display, serif'}}>
                          {m.prom}
                        </div>
                      </td>
                      <td style={{padding:'10px 12px', fontSize:13, color:C.gray}}>{m.desv}</td>
                      <td style={{padding:'10px 12px', fontSize:13, color:C.gray}}>{m.min}</td>
                      <td style={{padding:'10px 12px', fontSize:13, color:C.gray}}>{m.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* ══ COMPETENCIAS ════════════════════════════════════ */}
        {tab==='competencias' && (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <Card style={{gridColumn:'1/3'}}>
              <CardTitle sub="Promedio del colegio por competencia evaluada — todas las áreas">
                Desempeño por Competencia
              </CardTitle>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={COMPETENCIAS_PROM} layout="vertical" margin={{top:0, right:40, bottom:0, left:230}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg2}/>
                  <XAxis type="number" tick={{fontSize:11, fontFamily:'Inter', fill:C.gray}} domain={[0,100]}/>
                  <YAxis type="category" dataKey="comp" tick={{fontSize:11, fontFamily:'Inter', fill:C.gray}} width={225}/>
                  <Tooltip contentStyle={{fontFamily:'Inter', fontSize:12, borderRadius:8}}/>
                  <Bar dataKey="prom" name="Promedio %" radius={[0,4,4,0]}>
                    {COMPETENCIAS_PROM.map((d,i) => (
                      <Cell key={i} fill={d.prom>=65?C.green:d.prom>=45?'#F59E0B':'#F97316'}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <CardTitle sub="Radar de perfil competencial">Radar de Competencias</CardTitle>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={COMPETENCIAS_PROM.slice(0,8).map(c=>({...c,comp:c.comp.split(' ').slice(0,2).join(' ')}))}>
                  <PolarGrid stroke={C.bg2}/>
                  <PolarAngleAxis dataKey="comp" tick={{fontSize:9, fontFamily:'Inter', fill:C.gray}}/>
                  <Radar name="Plantel" dataKey="prom" stroke={C.navy} fill={C.navy} fillOpacity={0.2} strokeWidth={2}/>
                </RadarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <CardTitle sub="Nivel por competencia">Detalle por Competencia</CardTitle>
              {COMPETENCIAS_PROM.map((c,i) => (
                <div key={i} style={{marginBottom:10}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                    <span style={{fontSize:11, color:C.text, fontFamily:'Inter'}}>{c.comp}</span>
                    <Badge color={c.prom>=65?C.green:c.prom>=45?'#F59E0B':'#F97316'}>{c.prom}%</Badge>
                  </div>
                  <div style={{height:5, background:C.bg2, borderRadius:3, overflow:'hidden'}}>
                    <div style={{height:'100%', width:`${c.prom}%`, borderRadius:3,
                      background:c.prom>=65?C.green:c.prom>=45?'#F59E0B':'#F97316'}}/>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ══ OPORTUNIDADES ═══════════════════════════════════ */}
        {tab==='mejora' && (
          <Card>
            <CardTitle sub={`${OPOR_MEJORA.length} preguntas identificadas como oportunidad de mejora`}>
              Oportunidades de Mejoramiento
            </CardTitle>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                <thead>
                  <tr style={{borderBottom:`2px solid ${C.bg2}`}}>
                    {['Pregunta','Materia','Componente','% Colegio','% Nacional','Brecha','Nivel'].map(h => (
                      <th key={h} style={{textAlign:'left', padding:'8px 12px', fontSize:10,
                        color:C.gray, fontWeight:600, textTransform:'uppercase',
                        letterSpacing:'0.05em', whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {OPOR_MEJORA.map((q,i) => (
                    <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`,
                      background:i%2===0?`${C.bg}80`:'transparent'}}>
                      <td style={{padding:'10px 12px', fontSize:14, fontWeight:700,
                        color:C.navy, fontFamily:'Playfair Display, serif'}}>{q.nro}</td>
                      <td style={{padding:'10px 12px', fontSize:12, color:C.text, fontWeight:500}}>{q.materia}</td>
                      <td style={{padding:'10px 12px', fontSize:11, color:C.gray}}>{q.componente}</td>
                      <td style={{padding:'10px 12px'}}>
                        <Badge color={q.plan<20?C.red:'#F59E0B'}>{q.plan}%</Badge>
                      </td>
                      <td style={{padding:'10px 12px', fontSize:12, color:C.gray}}>{q.nac}%</td>
                      <td style={{padding:'10px 12px'}}>
                        <Badge color={q.plan<q.nac?C.red:C.green}>
                          {q.plan<q.nac?`−${q.nac-q.plan}`:`+${q.plan-q.nac}`}%
                        </Badge>
                      </td>
                      <td style={{padding:'10px 12px'}}>
                        <Badge color={q.dif==='Superior'?C.red:q.dif==='Alto'?'#F59E0B':C.blue}>{q.dif}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ══ RANKING ═════════════════════════════════════════ */}
        {tab==='ranking' && (
          <Card>
            <CardTitle sub="48 estudiantes ordenados por puntaje global">Ranking Completo</CardTitle>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontFamily:'Inter'}}>
                <thead>
                  <tr style={{borderBottom:`2px solid ${C.bg2}`}}>
                    {['#','Estudiante','Global','Def.%','Mat.C','Mat.E','Quím.','Fís.','Bio.','CTS','Soc.','L.Crít.','Inglés'].map(h => (
                      <th key={h} style={{textAlign:'left', padding:'8px 10px', fontSize:10,
                        color:C.gray, fontWeight:600, textTransform:'uppercase',
                        letterSpacing:'0.04em', whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STUDENTS.map((s,i) => (
                    <tr key={i} style={{borderBottom:`1px solid ${C.bg2}`,
                      background:i<3?`${C.navy}04`:i%2===0?`${C.bg}60`:'transparent'}}>
                      <td style={{padding:'8px 10px', fontSize:12, fontWeight:700,
                        color:i===0?'#F59E0B':i===1?C.gray:i===2?'#CD7F32':C.grayLt}}>{s.pos}</td>
                      <td style={{padding:'8px 10px', fontSize:12, color:C.text, fontWeight:500}}>
                        {s.nombre.split(' ').slice(0,3).join(' ')}
                      </td>
                      <td style={{padding:'8px 10px'}}>
                        <span style={{fontSize:15, fontWeight:700, color:C.navy,
                          fontFamily:'Playfair Display, serif'}}>{s.global_}</span>
                      </td>
                      <td style={{padding:'8px 10px'}}>
                        <Badge color={s.def_>=65?C.green:s.def_>=45?'#F59E0B':'#F97316'}>{s.def_}%</Badge>
                      </td>
                      {[s.mat_c, s.mat_e, s.quim, s.fis, s.bio, s.cts, s.soc, s.lc, s.ing].map((v,j) => (
                        <td key={j} style={{padding:'8px 10px', fontSize:12,
                          color:v>=65?C.green:v>=45?'#F59E0B':'#F97316',
                          fontWeight:v>=65?600:400}}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
