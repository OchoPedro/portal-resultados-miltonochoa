import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const C = {
  navy:'#0A1F3D', green:'#2D9B6F', greenLt:'#3AB882',
  bg:'#F8F9FB', bg2:'#EFF1F5', white:'#FFFFFF',
  text:'#1A1A2E', gray:'#6B7280', grayLt:'#D1D5DB',
  red:'#E05252', amber:'#F59E0B',
}

/* ── Métodos de carga disponibles ───────────────────────────── */
const METODOS = [
  {
    id:'optico',
    icon:'🧾',
    titulo:'Lector óptico',
    sub:'Archivo .txt',
    desc:'Sube el archivo de texto que exporta el lector óptico. Cada línea es un estudiante con su cadena de respuestas. Es el método más confiable.',
    accept:'.txt',
    badge:'Recomendado',
  },
  {
    id:'pdf',
    icon:'📄',
    titulo:'Hojas escaneadas',
    sub:'Archivo .pdf — Claude Vision',
    desc:'Sube las hojas de respuesta escaneadas en PDF. El sistema leerá las burbujas marcadas con Claude Vision. Útil cuando no hay archivo del lector óptico.',
    accept:'.pdf',
    badge:'IA',
  },
]

/* ── UI helpers ─────────────────────────────────────────────── */
function Card({ children, style }) {
  return (
    <div style={{
      background:C.white, borderRadius:14, padding:'24px 26px',
      border:`1px solid ${C.grayLt}`, boxShadow:'0 1px 3px rgba(10,31,61,.05)',
      ...style,
    }}>{children}</div>
  )
}

function Label({ children }) {
  return <label style={{ display:'block', fontSize:13, fontWeight:600, color:C.navy, marginBottom:6 }}>{children}</label>
}

const selectStyle = {
  width:'100%', padding:'11px 13px', borderRadius:9, fontSize:14,
  border:`1px solid ${C.grayLt}`, background:C.white, color:C.text, outline:'none',
}

export default function AdminResultados({ onUpdate }) {
  const [metodo, setMetodo]       = useState(null)   // 'optico' | 'pdf'
  const [colegios, setColegios]   = useState([])
  const [pruebas, setPruebas]     = useState([])
  const [colegioId, setColegioId] = useState('')
  const [pruebaId, setPruebaId]   = useState('')
  const [archivos, setArchivos]   = useState([])
  const [cargando, setCargando]   = useState(true)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    try {
      const [colRes, prbRes] = await Promise.all([
        supabase.from('colegios').select('id, nombre, usuario').order('nombre', { ascending:true }),
        supabase.from('pruebas').select('*').order('nombre', { ascending:true }),
      ])
      setColegios(colRes.data || [])
      setPruebas(prbRes.data || [])
    } catch (e) {
      console.error('Error cargando datos:', e)
    } finally {
      setCargando(false)
    }
  }

  const metodoActivo = METODOS.find(m => m.id === metodo)

  function onFiles(e) {
    setArchivos(Array.from(e.target.files || []))
  }

  function resetMetodo() {
    setMetodo(null)
    setArchivos([])
  }

  const listo = colegioId && pruebaId && archivos.length > 0

  function etiquetaPrueba(p) {
    const ref = p.referencia || p.ref || ''
    return ref ? `${p.nombre} — ${ref}` : (p.nombre || 'Prueba')
  }

  /* ── Pantalla 1: elegir método ─────────────────────────────── */
  if (!metodo) {
    return (
      <div>
        <h2 style={{ fontSize:22, fontWeight:700, color:C.navy, margin:'0 0 4px' }}>Cargar Resultados</h2>
        <p style={{ fontSize:14, color:C.gray, margin:'0 0 24px' }}>
          Elige cómo vas a subir los resultados de la prueba aplicada.
        </p>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:18 }}>
          {METODOS.map(m => (
            <button
              key={m.id}
              onClick={() => setMetodo(m.id)}
              style={{
                textAlign:'left', cursor:'pointer', background:C.white,
                border:`1px solid ${C.grayLt}`, borderRadius:14, padding:'24px 24px 26px',
                transition:'all .15s', boxShadow:'0 1px 3px rgba(10,31,61,.05)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.green; e.currentTarget.style.boxShadow = '0 6px 18px rgba(45,155,111,.15)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.grayLt; e.currentTarget.style.boxShadow = '0 1px 3px rgba(10,31,61,.05)' }}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <span style={{ fontSize:34 }}>{m.icon}</span>
                <span style={{
                  fontSize:11, fontWeight:700, color:C.green, background:'#E7F5EE',
                  padding:'3px 10px', borderRadius:20,
                }}>{m.badge}</span>
              </div>
              <div style={{ fontSize:17, fontWeight:700, color:C.navy }}>{m.titulo}</div>
              <div style={{ fontSize:13, fontWeight:600, color:C.gray, marginBottom:10 }}>{m.sub}</div>
              <div style={{ fontSize:13.5, color:C.text, lineHeight:1.5 }}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  /* ── Pantalla 2: formulario de carga del método elegido ────── */
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
        <button
          onClick={resetMetodo}
          style={{
            cursor:'pointer', border:`1px solid ${C.grayLt}`, background:C.white,
            borderRadius:8, padding:'6px 12px', fontSize:13, color:C.gray, fontWeight:600,
          }}
        >← Cambiar método</button>
      </div>

      <h2 style={{ fontSize:22, fontWeight:700, color:C.navy, margin:'10px 0 4px' }}>
        {metodoActivo.icon} {metodoActivo.titulo}
      </h2>
      <p style={{ fontSize:14, color:C.gray, margin:'0 0 24px' }}>{metodoActivo.desc}</p>

      <Card style={{ maxWidth:640 }}>
        {/* Colegio */}
        <div style={{ marginBottom:18 }}>
          <Label>Colegio</Label>
          <select
            style={selectStyle}
            value={colegioId}
            onChange={e => setColegioId(e.target.value)}
            disabled={cargando}
          >
            <option value="">{cargando ? 'Cargando…' : 'Selecciona un colegio'}</option>
            {colegios.map(c => (
              <option key={c.id} value={c.id}>
                {c.nombre}{c.usuario ? ` (${c.usuario})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Prueba / Referencia */}
        <div style={{ marginBottom:18 }}>
          <Label>Prueba y referencia</Label>
          <select
            style={selectStyle}
            value={pruebaId}
            onChange={e => setPruebaId(e.target.value)}
            disabled={cargando}
          >
            <option value="">{cargando ? 'Cargando…' : 'Selecciona la prueba'}</option>
            {pruebas.map(p => (
              <option key={p.id} value={p.id}>{etiquetaPrueba(p)}</option>
            ))}
          </select>
        </div>

        {/* Archivo */}
        <div style={{ marginBottom:6 }}>
          <Label>
            {metodo === 'optico' ? 'Archivo del lector óptico (.txt)' : 'Hojas escaneadas (.pdf)'}
          </Label>
          <input
            type="file"
            accept={metodoActivo.accept}
            multiple={metodo === 'pdf'}
            onChange={onFiles}
            style={{
              width:'100%', padding:'10px 12px', borderRadius:9, fontSize:13.5,
              border:`1px dashed ${C.grayLt}`, background:C.bg, color:C.text,
            }}
          />
          <p style={{ fontSize:12, color:C.gray, margin:'8px 0 0' }}>
            {metodo === 'optico'
              ? 'Un solo archivo .txt — cada línea corresponde a un estudiante.'
              : 'Puedes seleccionar varios PDF a la vez.'}
          </p>
        </div>

        {/* Lista de archivos seleccionados */}
        {archivos.length > 0 && (
          <div style={{ marginTop:16, padding:'12px 14px', background:C.bg2, borderRadius:9 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.navy, marginBottom:8 }}>
              {archivos.length} archivo{archivos.length > 1 ? 's' : ''} seleccionado{archivos.length > 1 ? 's' : ''}
            </div>
            {archivos.map((f, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:C.text, padding:'3px 0' }}>
                <span>{f.name}</span>
                <span style={{ color:C.gray }}>{(f.size / 1024).toFixed(1)} KB</span>
              </div>
            ))}
          </div>
        )}

        {/* Acción — pendiente de construir el procesamiento */}
        <div style={{ marginTop:24, borderTop:`1px solid ${C.bg2}`, paddingTop:20 }}>
          <button
            disabled={!listo}
            onClick={() => alert('Estructura lista. El procesamiento y la calificación automática se construirán en el siguiente paso.')}
            style={{
              width:'100%', padding:'13px', borderRadius:10, fontSize:15, fontWeight:700,
              border:'none', cursor: listo ? 'pointer' : 'not-allowed',
              background: listo ? C.green : C.grayLt,
              color: listo ? C.white : C.gray,
              transition:'background .15s',
            }}
          >
            Procesar y calificar
          </button>
          <p style={{ fontSize:12, color:C.amber, margin:'12px 0 0', textAlign:'center' }}>
            ⚙️ Módulo en construcción — por ahora solo se habilita la selección. El procesamiento y la calificación se conectarán en el siguiente paso.
          </p>
        </div>
      </Card>
    </div>
  )
}
