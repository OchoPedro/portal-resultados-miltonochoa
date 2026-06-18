import { useState, useEffect, useCallback } from 'react'
import { setSupabaseToken } from '../lib/supabase'
import { C } from '../components/ui'

const REDIRECT_HOME = 'https://miltonochoa-web.vercel.app'

const BG_URL = 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1400&q=70&fit=crop'

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isAdminPortal = window.location.pathname.startsWith('/aamo-admin')
  const accentColor = isAdminPortal ? '#1D4ED8' : '#2D9B6F'

  const doLogin = useCallback(async (u, p, autoLogin = false) => {
    setLoading(true)
    setError('')

    const wrongCreds = (msg = 'Credenciales incorrectas.') => {
      if (autoLogin) { window.location.href = REDIRECT_HOME; return }
      setError(msg)
      setLoading(false)
    }

    try {
      const portal = window.location.pathname.startsWith('/aamo-admin') ? 'admin' : 'public'
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: u.trim(), password: p, portal }),
      })

      if (res.status === 429) { wrongCreds('Demasiados intentos fallidos. Espera 15 minutos.'); return }
      if (res.status === 403) { wrongCreds('Acceso no autorizado en este portal.'); return }
      if (!res.ok) { wrongCreds('Credenciales incorrectas.'); return }

      const { token, user } = await res.json()
      sessionStorage.setItem('mo_token', token)
      setSupabaseToken(token)
      onLogin(user)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [onLogin])

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const params = new URLSearchParams(hash)
    const u = params.get('u')
    const p = params.get('p')
    if (u && p) {
      if (window.location.hash) history.replaceState(null, '', window.location.pathname)
      doLogin(u, p, true)
    }
  }, [doLogin])

  const handleLogin = (e) => {
    e.preventDefault()
    doLogin(usuario, password, false)
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 0,
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    display: 'block',
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 6,
    fontFamily: 'Inter, sans-serif',
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.navy, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)',
        borderTop: `3px solid ${accentColor}`, borderRadius: '50%',
        animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter', fontSize: 13 }}>
        Verificando acceso...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', position: 'relative', display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: C.navy }}>

      {/* Imagen de fondo a baja opacidad */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url('${BG_URL}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.12,
        pointerEvents: 'none',
      }} />

      {/* Contenido */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, padding: '0 24px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img
            src="/logo-sidebar-blanco.png"
            alt="Milton Ochoa"
            style={{ maxWidth: 200, width: '100%', marginBottom: 14 }}
          />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            {isAdminPortal ? 'Panel Administrativo' : 'Portal de Resultados'}
          </div>
        </div>

        {/* Panel glass */}
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderTop: `3px solid ${accentColor}`,
          padding: 40,
        }}>
          <div style={{ fontSize: 20, fontFamily: 'Playfair Display, serif',
            color: '#fff', marginBottom: 6, fontWeight: 400 }}>
            {isAdminPortal ? 'Acceso Administrador' : 'Bienvenido'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter, sans-serif', marginBottom: 28 }}>
            {isAdminPortal ? 'Solo personal autorizado de AAMO' : 'Ingresa tus credenciales para continuar'}
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Usuario</label>
              <input type="text" value={usuario} onChange={e => setUsuario(e.target.value)}
                placeholder="Ingresa tu usuario" required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required style={inputStyle} />
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                padding: '10px 14px', marginBottom: 16,
                fontSize: 13, color: '#FCA5A5', fontFamily: 'Inter, sans-serif' }}>
                {error}
              </div>
            )}

            <button type="submit" style={{ width: '100%', padding: '14px',
              background: '#fff', color: C.navy, border: 'none',
              fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = accentColor; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = C.navy }}>
              Ingresar
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 20,
            borderTop: '1px solid rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>🔒</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}>
              Acceso seguro y encriptado
            </span>
          </div>
        </div>

      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.3) !important; }
        input:focus { border-color: ${accentColor} !important; }
      `}</style>
    </div>
  )
}
