import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { C, useMobile } from '../../components/ui'
import AdminBaseDatos from './AdminBaseDatos'
import AdminEstudiantes from './AdminEstudiantes'
import AdminPruebas from './AdminPruebas'
import AdminResultados from './AdminResultados'
import AdminAdmins from './AdminAdmins'
import AdminAnalisis from './AdminAnalisis'
import AdminRanking from './AdminRanking'
import HojasRespuesta from '../../components/HojasRespuesta'

const MENU_ALL = [
  { id:'basedatos',    label:'Base de Datos',       icon:'🗄',  desc:'Colegios, Estudiantes y Colaboradores' },
  { id:'estudiantes',  label:'Listado de Estudiantes', icon:'👥', desc:'Todos los estudiantes por colegio' },
  { id:'pruebas',      label:'Pruebas',             icon:'📋', desc:'Tipos y referencias' },
  { id:'resultados',   label:'Resultados',          icon:'📊', desc:'Cargar resultados de pruebas' },
  { id:'ranking',      label:'Ranking',             icon:'🏆', desc:'Ranking Colombia · Saber 11' },
  { id:'hojas',        label:'Hojas de Respuesta',  icon:'📝', desc:'Generar hojas por referencia' },
  { id:'analisis',     label:'Análisis IA',         icon:'🤖', desc:'Recomendaciones con Claude' },
  { id:'admins',       label:'Administradores',     icon:'👤', desc:'Usuarios admin' },
]

export default function AdminDashboard({ session, onLogout }) {
  const mobile = useMobile()
  const [menuOpen, setMenuOpen] = useState(false)

  // session.modulos === null → superadmin (todo acceso)
  // session.modulos === [...] → solo esos módulos; 'admins' nunca aparece para sub-admins
  const esSuperadmin = !session?.modulos
  const MENU = esSuperadmin
    ? MENU_ALL
    : MENU_ALL.filter(m => m.id !== 'admins' && session.modulos.includes(m.id))

  const [section, setSection] = useState(
    esSuperadmin ? 'basedatos' : (session.modulos?.[0] || 'basedatos')
  )
  const [stats, setStats] = useState({ colegios: 0, estudiantes: 0, pruebas: 0 })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [{ count: c }, { count: e }, { count: p }] = await Promise.all([
        supabase.from('colegios').select('id', { count: 'exact', head: true }),
        supabase.from('estudiantes').select('id', { count: 'exact', head: true }),
        supabase.from('pruebas').select('id', { count: 'exact', head: true }),
      ])
      if (cancelled) return
      setStats({ colegios: c || 0, estudiantes: e || 0, pruebas: p || 0 })
    }
    load()
    return () => { cancelled = true }
  }, [])

  const now = new Date().toLocaleDateString('es-CO', {
    weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'America/Bogota'
  }) + ' · ' + new Date().toLocaleTimeString('es-CO', {
    hour:'2-digit', minute:'2-digit', timeZone:'America/Bogota'
  })

  const navItems = (
    <nav style={{ flex:1, padding:'12px' }}>
      <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', fontFamily:'Inter',
        letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:8, paddingLeft:4 }}>
        Módulos
      </div>
      {MENU.map(item => (
        <button key={item.id} onClick={() => { setSection(item.id); setMenuOpen(false) }} style={{
          width:'100%', textAlign:'left', padding:'10px 12px', borderRadius:8,
          border:'none', cursor:'pointer', marginBottom:4,
          display:'flex', alignItems:'center', gap:10,
          fontFamily:'Inter', fontSize:12,
          background: section===item.id ? 'rgba(255,255,255,0.1)' : 'transparent',
          color: section===item.id ? C.white : 'rgba(255,255,255,0.55)',
          borderLeft: section===item.id ? `3px solid ${C.green}` : '3px solid transparent',
          transition:'all 0.2s',
        }}>
          <span style={{ fontSize:16 }}>{item.icon}</span>
          <div>
            <div style={{ fontWeight:500 }}>{item.label}</div>
            {!mobile && <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:1 }}>{item.desc}</div>}
          </div>
        </button>
      ))}
    </nav>
  )

  const sidebarFooter = (
    <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize:12, color:C.white, fontFamily:'Inter', fontWeight:500, marginBottom:2 }}>
        {session?.nombre}
      </div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontFamily:'Inter', marginBottom:12 }}>
        Administrador AAMO
      </div>
      <button onClick={onLogout} style={{ width:'100%', padding:'8px', borderRadius:7,
        border:'1px solid rgba(255,255,255,0.15)', background:'transparent',
        color:'rgba(255,255,255,0.5)', fontFamily:'Inter', fontSize:11, cursor:'pointer' }}>
        Cerrar sesión
      </button>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:C.bg }}>

      {mobile ? (
        <>
          {/* Navbar móvil */}
          <div style={{
            position:'fixed', top:0, left:0, right:0, zIndex:200,
            background:C.navy, height:56,
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'0 16px', boxShadow:'0 2px 12px rgba(10,31,61,0.3)',
          }}>
            <div>
              <div style={{ fontSize:13, fontFamily:'Playfair Display, serif', color:C.white, lineHeight:1.2 }}>
                Milton Ochoa
              </div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', fontFamily:'Inter',
                letterSpacing:'0.1em', textTransform:'uppercase' }}>Panel Admin</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)', fontFamily:'Inter' }}>
                {MENU.find(m=>m.id===section)?.icon} {MENU.find(m=>m.id===section)?.label}
              </span>
              <button onClick={() => setMenuOpen(o => !o)} style={{
                background:'none', border:'none', padding:8, cursor:'pointer',
                display:'flex', flexDirection:'column', gap:5,
              }}>
                {menuOpen
                  ? <span style={{ color:C.white, fontSize:22, lineHeight:1 }}>✕</span>
                  : <>
                      <span style={{ display:'block', width:22, height:2, background:C.white, borderRadius:2 }} />
                      <span style={{ display:'block', width:22, height:2, background:C.white, borderRadius:2 }} />
                      <span style={{ display:'block', width:22, height:2, background:C.white, borderRadius:2 }} />
                    </>
                }
              </button>
            </div>
          </div>

          {/* Menú overlay móvil */}
          {menuOpen && (
            <div style={{
              position:'fixed', top:56, left:0, right:0, bottom:0, zIndex:199,
              background:C.navy, overflowY:'auto',
              display:'flex', flexDirection:'column',
            }}>
              {navItems}
              {sidebarFooter}
            </div>
          )}
        </>
      ) : (
        /* SIDEBAR desktop */
        <div style={{ width:240, minHeight:'100vh', background:C.navy,
          display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
              <img src="/logo-sidebar-blanco.png" alt="Milton Ochoa"
                style={{ width:'100%', maxWidth:190, height:'auto', display:'block' }} />
            </div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontFamily:'Inter',
              letterSpacing:'0.12em', textTransform:'uppercase', textAlign:'center' }}>Panel Administrador</div>
          </div>
          {navItems}
          {sidebarFooter}
        </div>
      )}

      {/* MAIN */}
      <main style={{ flex:1, padding: mobile ? '72px 16px 24px' : '36px 40px', overflowY:'auto', minWidth:0 }}>
        {/* Header */}
        <div style={{ marginBottom:32 }}>
          <div style={{ fontSize:11, color:C.green, letterSpacing:'0.12em',
            textTransform:'uppercase', fontFamily:'Inter', marginBottom:6 }}>
            {now}
          </div>
          <h1 style={{ fontSize:28, fontFamily:'Playfair Display, serif', color:C.navy, marginBottom:4 }}>
            {MENU.find(m => m.id===section)?.icon} {MENU.find(m => m.id===section)?.label}
          </h1>
          <div style={{ fontSize:13, color:C.gray, fontFamily:'Inter' }}>
            {MENU.find(m => m.id===section)?.desc}
          </div>
        </div>

        {/* Contenido */}
        {section==='basedatos'   && <AdminBaseDatos   onUpdate={loadStats} />}
        {section==='estudiantes' && <AdminEstudiantes onUpdate={loadStats} />}
        {section==='pruebas'     && <AdminPruebas     onUpdate={loadStats} />}
        {section==='resultados'  && <AdminResultados  onUpdate={loadStats} />}
        {section==='ranking'     && <AdminRanking />}
        {section==='hojas'       && <HojasRespuesta />}
        {section==='analisis'    && <AdminAnalisis />}
        {section==='admins'      && <AdminAdmins      session={session}    onUpdate={loadStats} />}
      </main>
    </div>
  )
}
