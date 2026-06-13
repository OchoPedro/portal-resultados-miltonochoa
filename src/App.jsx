import { useState, useEffect } from 'react'
import Login from './pages/Login'
import EstudianteDashboard from './pages/EstudianteDashboard'
import ColegioDashboard from './pages/ColegioDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restaurar sesión al refrescar
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('mo_session')
      if (saved) setSession(JSON.parse(saved))
    } catch(e) {}
    setLoading(false)
  }, [])

  const handleLogin = ({ role, data }) => {
    const s = { role, data }
    setSession(s)
    sessionStorage.setItem('mo_session', JSON.stringify(s))
  }

  const handleLogout = () => {
    sessionStorage.removeItem('mo_session')
    window.location.href = 'https://miltonochoa-web.vercel.app'
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0A1F3D', display:'flex',
      alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:36, height:36, border:'3px solid rgba(255,255,255,0.1)',
        borderTop:'3px solid #2D9B6F', borderRadius:'50%',
        animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!session) return <Login onLogin={handleLogin} />
  if (session.role === 'admin') return <AdminDashboard session={session.data} onLogout={handleLogout} />
  if (session.role === 'colegio') return <ColegioDashboard session={session.data} onLogout={handleLogout} />
  if (session.role === 'estudiante') return <EstudianteDashboard session={session.data} onLogout={handleLogout} />
  return null
}
