import { useState, useEffect } from 'react'
import { setSupabaseToken, clearSupabaseToken } from './lib/supabase'
import Login from './pages/Login'
import EstudianteDashboard from './pages/EstudianteDashboard'
import ColegioDashboard from './pages/ColegioDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restaurar sesión desde la cookie httpOnly via /api/me
  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.token) {
          setSupabaseToken(data.token)
          setSession(data.user)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleLogin = ({ role, data }) => {
    setSession({ role, data })
  }

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    clearSupabaseToken()
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
  return (
    <>
      {session.role === 'admin' && <AdminDashboard session={session.data} onLogout={handleLogout} />}
      {session.role === 'colegio' && <ColegioDashboard session={session.data} onLogout={handleLogout} />}
      {session.role === 'estudiante' && <EstudianteDashboard session={session.data} onLogout={handleLogout} />}
    </>
  )
}
