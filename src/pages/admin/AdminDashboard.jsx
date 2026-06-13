import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminColegios from './AdminColegios'
import AdminEstudiantes from './AdminEstudiantes'
import AdminPruebas from './AdminPruebas'
import AdminAdmins from './AdminAdmins'
import AdminAnalisis from './AdminAnalisis'

const C = {
  navy:'#0A1F3D', green:'#2D9B6F', greenLt:'#3AB882',
  bg:'#F8F9FB', bg2:'#EFF1F5', white:'#FFFFFF',
  text:'#1A1A2E', gray:'#6B7280', grayLt:'#D1D5DB',
  red:'#E05252', amber:'#F59E0B',
}

const MENU = [
  { id:'colegios',     label:'Colegios',        icon:'🏫', desc:'Gestión de instituciones' },
  { id:'estudiantes',  label:'Estudiantes',      icon:'👥', desc:'Carga masiva de estudiantes' },
  { id:'pruebas',      label:'Pruebas',          icon:'📋', desc:'Tipos y referencias' },
  { id:'analisis',     label:'Análisis IA',      icon:'🤖', desc:'Recomendaciones con Claude' },
  { id:'admins',       label:'Administradores',  icon:'👤', desc:'Usuarios admin' },
]

export default function AdminDashboard({ session, onLogout }) {
  const [section, setSection] = useState('colegios')
  const [stats, setStats] = useState({ colegios: 0, estudiantes: 0, pruebas: 0 })

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    const [{ count: c }, { count: e }, { count: p }] = await Promise.all([
      supabase.from('colegios').select('*', { count: 'exact', head: true }),
      supabase.from('estudiantes').select('*', { count: 'exact', head: true }),
      supabase.from('pruebas').select('*', { count: 'exact', head: true }),
    ])
    setStats({ colegios: c || 0, estudiantes: e || 0, pruebas: p || 0 })
  }

  const now = new Date().toLocaleDateString('es-CO', {
    weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'America/Bogota'
  }) + ' · ' + new Date().toLocaleTimeString('es-CO', {
    hour:'2-digit', minute:'2-digit', timeZone:'America/Bogota'
  })

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:C.bg }}>

      {/* SIDEBAR */}
      <div style={{ width:240, minHeight:'100vh', background:C.navy,
        display:'flex', flexDirection:'column', flexShrink:0 }}>

        {/* Header */}
        <div style={{ padding:'28px 20px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize:15, fontFamily:'Playfair Display, serif', color:C.white, marginBottom:2 }}>
            Milton Ochoa
          </div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontFamily:'Inter',
            letterSpacing:'0.12em', textTransform:'uppercase' }}>Panel Administrador</div>
        </div>

        {/* Stats rápidas */}
        <div style={{ padding:'16px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          {[
            { label:'Colegios', val:stats.colegios },
            { label:'Estudiantes', val:stats.estudiantes },
            { label:'Pruebas', val:stats.pruebas },
          ].map((s,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between',
              marginBottom:6, fontFamily:'Inter' }}>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.45)' }}>{s.label}</span>
              <span style={{ fontSize:12, color:C.white, fontWeight:600 }}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* Menú */}
        <nav style={{ flex:1, padding:'12px' }}>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', fontFamily:'Inter',
            letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:8, paddingLeft:4 }}>
            Módulos
          </div>
          {MENU.map(item => (
            <button key={item.id} onClick={() => setSection(item.id)} style={{
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
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:1 }}>{item.desc}</div>
              </div>
            </button>
          ))}
        </nav>

        {/* Footer */}
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
      </div>

      {/* MAIN */}
      <main style={{ flex:1, padding:'36px 40px', overflowY:'auto' }}>
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
        {section==='colegios'    && <AdminColegios    onUpdate={loadStats} />}
        {section==='estudiantes' && <AdminEstudiantes onUpdate={loadStats} />}
        {section==='pruebas'     && <AdminPruebas     onUpdate={loadStats} />}
        {section==='analisis'    && <AdminAnalisis />}
        {section==='admins'      && <AdminAdmins      session={session}    onUpdate={loadStats} />}
      </main>
    </div>
  )
}
