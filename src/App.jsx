import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  navy: '#0A1F3D', green: '#2D9B6F',
  bg: '#F8F9FB', bg2: '#EFF1F5', white: '#FFFFFF',
  text: '#1A1A2E', gray: '#6B7280', grayLt: '#D1D5DB', red: '#E05252',
}

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const doLogin = useCallback(async (u, p) => {
    setLoading(true)
    setError('')
    try {
      // 1. Buscar en administradores
      const { data: admin } = await supabase
        .from('administradores')
        .select('*')
        .eq('usuario', u.trim())
        .eq('activo', true)
        .single()

      if (admin) {
        if (admin.password_hash !== p) { setError('Contraseña incorrecta.'); setLoading(false); return }
        // Registrar última sesión
        await supabase.from('administradores').update({
          ultima_sesion: new Date().toLocaleString('sv-SE', {timeZone:'America/Bogota'}).replace(' ','T')
        }).eq('id', admin.id)
        onLogin({ role: 'admin', data: admin })
        return
      }

      // 2. Buscar en colegios
      const { data: colegio } = await supabase
        .from('colegios')
        .select('*')
        .eq('usuario', u.trim())
        .eq('activo', true)
        .single()

      if (colegio) {
        if (colegio.password_hash !== p) { setError('Contraseña incorrecta.'); setLoading(false); return }
        await supabase.from('colegios').update({
          ultima_sesion: new Date().toLocaleString('sv-SE', {timeZone:'America/Bogota'}).replace(' ','T')
        }).eq('id', colegio.id)
        onLogin({ role: 'colegio', data: colegio })
        return
      }

      // 3. Buscar en estudiantes
      const { data: estudiante } = await supabase
        .from('estudiantes')
        .select('*, colegios(nombre, ciudad)')
        .eq('usuario', u.trim())
        .eq('activo', true)
        .single()

      if (estudiante) {
        if (estudiante.password_hash !== p) { setError('Contraseña incorrecta.'); setLoading(false); return }
        await supabase.from('estudiantes').update({
          ultima_sesion: new Date().toLocaleString('sv-SE', {timeZone:'America/Bogota'}).replace(' ','T')
        }).eq('id', estudiante.id)
        onLogin({ role: 'estudiante', data: estudiante })
        return
      }

      // No encontrado en ninguna tabla
      setError('Usuario no encontrado.')

    } catch(e) {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [onLogin])

  // Auto-login desde URL params (viene de la homepage)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const u = params.get('u')
    const p = params.get('p')
    if (u && p) {
      window.history.replaceState({}, document.title, window.location.pathname)
      doLogin(u, p)
    }
  }, [doLogin])

  const handleLogin = (e) => {
    e.preventDefault()
    doLogin(usuario, password)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.navy, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)',
        borderTop: '3px solid #2D9B6F', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter', fontSize: 13 }}>
        Verificando acceso...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.navy, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      backgroundImage: 'radial-gradient(ellipse 60% 60% at 20% 50%, rgba(45,155,111,0.1) 0%, transparent 60%)' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 28, fontFamily: 'Playfair Display, serif',
            color: C.white, fontWeight: 400, marginBottom: 6 }}>Milton Ochoa</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter',
            letterSpacing: '0.15em', textTransform: 'uppercase' }}>Portal de Resultados</div>
        </div>

        {/* Card */}
        <div style={{ background: C.white, borderRadius: 12, padding: 40,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', borderTop: '3px solid #2D9B6F' }}>
          <div style={{ fontSize: 20, fontFamily: 'Playfair Display, serif',
            color: C.navy, marginBottom: 6 }}>Bienvenido</div>
          <div style={{ fontSize: 12, color: C.gray, fontFamily: 'Inter', marginBottom: 28 }}>
            Ingresa tus credenciales para continuar
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.15em',
                textTransform: 'uppercase', color: C.gray, marginBottom: 6, fontFamily: 'Inter' }}>
                Usuario
              </label>
              <input type="text" value={usuario} onChange={e => setUsuario(e.target.value)}
                placeholder="Ingresa tu usuario" required
                style={{ width: '100%', padding: '12px 16px', border: `1px solid ${C.grayLt}`,
                  borderRadius: 6, fontFamily: 'Inter', fontSize: 14, color: C.text,
                  background: C.bg, outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.15em',
                textTransform: 'uppercase', color: C.gray, marginBottom: 6, fontFamily: 'Inter' }}>
                Contraseña
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{ width: '100%', padding: '12px 16px', border: `1px solid ${C.grayLt}`,
                  borderRadius: 6, fontFamily: 'Inter', fontSize: 14, color: C.text,
                  background: C.bg, outline: 'none' }} />
            </div>

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 6, padding: '10px 14px', marginBottom: 16,
                fontSize: 13, color: C.red, fontFamily: 'Inter' }}>{error}</div>
            )}

            <button type="submit" style={{ width: '100%', padding: '14px',
              background: C.navy, color: C.white, border: 'none', borderRadius: 6,
              fontFamily: 'Inter', fontSize: 12, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Ingresar
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.grayLt}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>🔒</span>
            <span style={{ fontSize: 11, color: C.gray, fontFamily: 'Inter' }}>
              Acceso seguro y encriptado
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
