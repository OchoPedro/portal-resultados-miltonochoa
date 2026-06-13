import { useState } from 'react'
import Login from './pages/Login'
import EstudianteDashboard from './pages/EstudianteDashboard'
import ColegioDashboard from './pages/ColegioDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'

export default function App() {
  const [session, setSession] = useState(null)

  const handleLogin = ({ role, data }) => setSession({ role, data })
  const handleLogout = () => {
    setSession(null)
    window.location.href = 'https://miltonochoa-web.vercel.app'
  }

  if (!session) return <Login onLogin={handleLogin} />
  if (session.role === 'admin') return <AdminDashboard session={session.data} onLogout={handleLogout} />
  if (session.role === 'colegio') return <ColegioDashboard session={session.data} onLogout={handleLogout} />
  if (session.role === 'estudiante') return <EstudianteDashboard session={session.data} onLogout={handleLogout} />
  return null
}
