import { useState, useEffect, useCallback } from 'react'
import { setSupabaseToken } from '../lib/supabase'
import { C } from '../components/ui'

const REDIRECT_HOME = 'https://aamocolombia.com'
const BG_URL = 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1400&q=70&fit=crop'

export default function Login({ onLogin }) {
  // view: 'login' | 'forgot' | 'reset' | 'otp'
  const [view, setView] = useState('login')

  // Login fields
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')

  // Forgot-password fields
  const [fpUsuario, setFpUsuario] = useState('')
  const [fpNombre, setFpNombre] = useState('')
  const [fpHint, setFpHint] = useState('')   // email ofuscado recibido del servidor

  // Reset-password fields
  const [rpCodigo, setRpCodigo] = useState('')
  const [rpPassword, setRpPassword] = useState('')
  const [rpConfirm, setRpConfirm] = useState('')

  // OTP (2FA admin) fields
  const [otpAdminId, setOtpAdminId] = useState(null)
  const [otpCode, setOtpCode] = useState('')

  // Shared
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isAdminPortal = window.location.pathname.startsWith('/aamo-admin')
  const accentColor = isAdminPortal ? '#1D4ED8' : '#2D9B6F'

  const resetErrors = () => { setError(''); setSuccess('') }
  const goBack = () => { resetErrors(); setView('login') }

  // ── Login ────────────────────────────────────────────────────────────────

  const doLogin = useCallback(async (u, p, autoLogin = false) => {
    setLoading(true)
    resetErrors()

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
        credentials: 'include',
        body: JSON.stringify({ usuario: u.trim(), password: p, portal }),
      })

      if (res.status === 429) { wrongCreds('Demasiados intentos fallidos. Espera 15 minutos.'); return }
      if (res.status === 403) { wrongCreds('Acceso no autorizado en este portal.'); return }
      if (!res.ok) { wrongCreds('Credenciales incorrectas.'); return }

      const data = await res.json()

      // 2FA challenge para admin
      if (data.challenge && data.adminId) {
        setOtpAdminId(data.adminId)
        setOtpCode('')
        setView('otp')
        setLoading(false)
        return
      }

      // Token viaja solo en cookie httpOnly — obtenerlo vía /api/me
      const me = await fetch('/api/me', { credentials: 'include' })
      const meData = me.ok ? await me.json() : null
      if (meData?.token) setSupabaseToken(meData.token)
      onLogin(data.user)
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

  // ── Forgot password ──────────────────────────────────────────────────────

  const handleForgot = async (e) => {
    e.preventDefault()
    setLoading(true)
    resetErrors()
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: fpUsuario.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al enviar el código.'); return }
      setFpHint(data.hint || '')
      setRpCodigo('')
      setRpPassword('')
      setRpConfirm('')
      setView('reset')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ── Reset password ───────────────────────────────────────────────────────

  const handleReset = async (e) => {
    e.preventDefault()
    if (rpPassword !== rpConfirm) { setError('Las contraseñas no coinciden.'); return }
    if (rpPassword.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    setLoading(true)
    resetErrors()
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: fpUsuario.trim(), codigo: rpCodigo.trim(), nueva_password: rpPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al cambiar la contraseña.'); return }
      setSuccess('Contraseña actualizada correctamente. Ya puedes iniciar sesión.')
      setView('login')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ── Verify OTP ───────────────────────────────────────────────────────────

  const handleOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    resetErrors()
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ adminId: otpAdminId, code: otpCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Código incorrecto o expirado.'); return }
      // Token viaja solo en cookie httpOnly — obtenerlo vía /api/me
      const me = await fetch('/api/me', { credentials: 'include' })
      const meData = me.ok ? await me.json() : null
      if (meData?.token) setSupabaseToken(meData.token)
      onLogin(data.user)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ── Styles ───────────────────────────────────────────────────────────────

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

  const btnPrimary = {
    width: '100%',
    padding: '14px',
    background: '#fff',
    color: C.navy,
    border: 'none',
    fontFamily: 'Inter, sans-serif',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'background 0.2s, color 0.2s',
  }

  const btnBack = {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Inter, sans-serif',
    fontSize: 12,
    cursor: 'pointer',
    padding: '8px 0',
    textDecoration: 'underline',
  }

  // ── Loading spinner ──────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.navy, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)',
        borderTop: `3px solid ${accentColor}`, borderRadius: '50%',
        animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter', fontSize: 13 }}>
        {view === 'otp' ? 'Verificando código...' : 'Verificando acceso...'}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // ── Layout shell ─────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', position: 'relative', display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: C.navy }}>

      {/* Background image */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url('${BG_URL}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.12,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, padding: '0 24px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <a href="https://aamocolombia.com" style={{ display: 'inline-block' }}>
            <img
              src="/logo-sidebar-blanco.png"
              alt="Milton Ochoa"
              style={{ maxWidth: 200, width: '100%', marginBottom: 14, cursor: 'pointer' }}
            />
          </a>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            {isAdminPortal ? 'Panel Administrativo' : 'Portal de Resultados'}
          </div>
        </div>

        {/* Glass card */}
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderTop: `3px solid ${accentColor}`,
          padding: 40,
        }}>

          {/* ── VIEW: LOGIN ─────────────────────────────────────── */}
          {view === 'login' && (
            <>
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

                {success && (
                  <div style={{ background: 'rgba(45,155,111,0.15)', border: '1px solid rgba(45,155,111,0.3)',
                    padding: '10px 14px', marginBottom: 16,
                    fontSize: 13, color: '#6ee7b7', fontFamily: 'Inter, sans-serif' }}>
                    {success}
                  </div>
                )}
                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                    padding: '10px 14px', marginBottom: 16,
                    fontSize: 13, color: '#FCA5A5', fontFamily: 'Inter, sans-serif' }}>
                    {error}
                  </div>
                )}

                <button type="submit" style={btnPrimary}
                  onMouseEnter={e => { e.currentTarget.style.background = accentColor; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = C.navy }}>
                  Ingresar
                </button>
              </form>

              <div style={{ marginTop: 20, paddingTop: 20,
                borderTop: '1px solid rgba(255,255,255,0.12)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>🔒</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}>
                    Acceso seguro y encriptado
                  </span>
                </div>
                <button
                  type="button"
                  style={btnBack}
                  onClick={() => { resetErrors(); setFpUsuario(''); setFpNombre(''); setView('forgot') }}>
                  ¿Olvidó su contraseña?
                </button>
              </div>
            </>
          )}

          {/* ── VIEW: FORGOT PASSWORD ───────────────────────────── */}
          {view === 'forgot' && (
            <>
              <div style={{ fontSize: 20, fontFamily: 'Playfair Display, serif',
                color: '#fff', marginBottom: 6, fontWeight: 400 }}>
                Recuperar contraseña
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter, sans-serif', marginBottom: 28 }}>
                Te enviaremos un código de 6 dígitos a tu correo registrado
              </div>

              <form onSubmit={handleForgot}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Usuario</label>
                  <input type="text" value={fpUsuario} onChange={e => setFpUsuario(e.target.value)}
                    placeholder="Ingresa tu usuario" required style={inputStyle} />
                </div>
                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                    padding: '10px 14px', marginBottom: 16,
                    fontSize: 13, color: '#FCA5A5', fontFamily: 'Inter, sans-serif' }}>
                    {error}
                  </div>
                )}

                <button type="submit" style={btnPrimary}
                  onMouseEnter={e => { e.currentTarget.style.background = accentColor; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = C.navy }}>
                  Enviar código
                </button>
              </form>

              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button type="button" style={btnBack} onClick={goBack}>← Volver al inicio de sesión</button>
              </div>
            </>
          )}

          {/* ── VIEW: RESET PASSWORD ────────────────────────────── */}
          {view === 'reset' && (
            <>
              <div style={{ fontSize: 20, fontFamily: 'Playfair Display, serif',
                color: '#fff', marginBottom: 6, fontWeight: 400 }}>
                Nueva contraseña
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter, sans-serif', marginBottom: 4 }}>
                Ingresa el código enviado a
              </div>
              {fpHint && (
                <div style={{ fontSize: 13, color: accentColor, fontFamily: 'Inter, sans-serif',
                  fontWeight: 600, marginBottom: 24 }}>
                  {fpHint}
                </div>
              )}

              <form onSubmit={handleReset}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Código (6 dígitos)</label>
                  <input type="text" inputMode="numeric" maxLength={6}
                    value={rpCodigo} onChange={e => setRpCodigo(e.target.value)}
                    placeholder="123456" required style={{ ...inputStyle, letterSpacing: '0.3em', textAlign: 'center', fontSize: 18 }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Nueva contraseña</label>
                  <input type="password" value={rpPassword} onChange={e => setRpPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres" required style={inputStyle} />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>Confirmar contraseña</label>
                  <input type="password" value={rpConfirm} onChange={e => setRpConfirm(e.target.value)}
                    placeholder="Repite la contraseña" required style={inputStyle} />
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                    padding: '10px 14px', marginBottom: 16,
                    fontSize: 13, color: '#FCA5A5', fontFamily: 'Inter, sans-serif' }}>
                    {error}
                  </div>
                )}

                <button type="submit" style={btnPrimary}
                  onMouseEnter={e => { e.currentTarget.style.background = accentColor; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = C.navy }}>
                  Cambiar contraseña
                </button>
              </form>

              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button type="button" style={btnBack} onClick={goBack}>← Volver al inicio de sesión</button>
              </div>
            </>
          )}

          {/* ── VIEW: OTP (2FA admin) ───────────────────────────── */}
          {view === 'otp' && (
            <>
              <div style={{ fontSize: 20, fontFamily: 'Playfair Display, serif',
                color: '#fff', marginBottom: 6, fontWeight: 400 }}>
                Verificación en dos pasos
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter, sans-serif', marginBottom: 28 }}>
                Se envió un código de verificación a tu correo registrado. Válido por 10 minutos.
              </div>

              <form onSubmit={handleOtp}>
                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>Código de verificación (6 dígitos)</label>
                  <input type="text" inputMode="numeric" maxLength={6}
                    value={otpCode} onChange={e => setOtpCode(e.target.value)}
                    placeholder="123456" required autoFocus
                    style={{ ...inputStyle, letterSpacing: '0.3em', textAlign: 'center', fontSize: 22 }} />
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                    padding: '10px 14px', marginBottom: 16,
                    fontSize: 13, color: '#FCA5A5', fontFamily: 'Inter, sans-serif' }}>
                    {error}
                  </div>
                )}

                <button type="submit" style={btnPrimary}
                  onMouseEnter={e => { e.currentTarget.style.background = accentColor; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = C.navy }}>
                  Verificar
                </button>
              </form>

              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button type="button" style={btnBack} onClick={goBack}>← Volver al inicio de sesión</button>
              </div>
            </>
          )}

        </div>
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.3) !important; }
        input:focus { border-color: ${accentColor} !important; }
      `}</style>
    </div>
  )
}
