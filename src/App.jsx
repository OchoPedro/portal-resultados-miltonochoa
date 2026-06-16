import { useState, useEffect } from 'react'
import { setSupabaseToken, clearSupabaseToken } from './lib/supabase'
import Login from './pages/Login'
import EstudianteDashboard from './pages/EstudianteDashboard'
import ColegioDashboard from './pages/ColegioDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'

// Decodifica el payload del JWT sin verificar la firma (solo para lectura de claims).
// La firma la valida Supabase en cada petición — aquí solo necesitamos saber el rol.
function decodeJWT(token) {
  try {
    const [, payload] = token.split('.')
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch { return null }
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restaurar sesión desde el JWT firmado por el servidor
  useEffect(() => {
    const token = sessionStorage.getItem('mo_token')
    if (token) {
      const claims = decodeJWT(token)
      // Si el token expiró, borrar y pedir login de nuevo
      if (claims && claims.exp && claims.exp * 1000 > Date.now()) {
        setSupabaseToken(token)
        try {
          const saved = sessionStorage.getItem('mo_session')
          if (saved) setSession(JSON.parse(saved))
        } catch(e) { console.error('Session parse error:', e) }
      } else {
        // Token expirado → limpiar
        sessionStorage.removeItem('mo_token')
        sessionStorage.removeItem('mo_session')
      }
    }
    setLoading(false)
  }, [])

  const handleLogin = ({ role, data }) => {
    const s = { role, data }
    setSession(s)
    // mo_token ya fue guardado por Login.jsx al recibir el JWT del servidor
    sessionStorage.setItem('mo_session', JSON.stringify(s))
  }

  const handleLogout = () => {
    clearSupabaseToken()
    sessionStorage.removeItem('mo_token')
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
  return (
    <>
      {session.role === 'admin' && <AdminDashboard session={session.data} onLogout={handleLogout} />}
      {session.role === 'colegio' && <ColegioDashboard session={session.data} onLogout={handleLogout} />}
      {session.role === 'estudiante' && <EstudianteDashboard session={session.data} onLogout={handleLogout} />}
    </>
  )
}
