import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../components/ui'

// S-3: Rate limiter en memoria (se resetea al recargar)
const _attempts = {}
function _blocked(u) {
  const r = _attempts[u]; if (!r) return 0
  return r.until > Date.now() ? Math.ceil((r.until - Date.now()) / 1000) : 0
}
function _fail(u) {
  const r = _attempts[u] || { n: 0, until: 0 }
  r.n = (r.n || 0) + 1
  if (r.n >= 5) { r.until = Date.now() + 5 * 60 * 1000; r.n = 0 }
  _attempts[u] = r
}
function _ok(u) { delete _attempts[u] }

const REDIRECT_HOME = 'https://miltonochoa-web.vercel.app'

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const doLogin = useCallback(async (u, p, autoLogin = false) => {
    // S-3: Bloquear si hay demasiados intentos fallidos
    const secs = _blocked(u.trim())
    if (secs) {
      setError(`Demasiados intentos fallidos. Espera ${secs} segundos.`)
      return
    }

    setLoading(true)
    setError('')

    const wrongCreds = () => {
      _fail(u.trim())
      if (autoLogin) { window.location.href = REDIRECT_HOME; return true }
      setError('Credenciales incorrectas. Redirigiendo...')  // S-7: mensaje unificado
      setTimeout(() => { window.location.href = REDIRECT_HOME }, 2000)
      setLoading(false)
      return true
    }

    try {
      // S-1: Intentar login seguro vía RPC (activo después de ejecutar supabase-security.sql)
      const { data: rpc, error: rpcErr } = await supabase.rpc('verificar_login', {
        p_usuario: u.trim(), p_password: p,
      })
      if (!rpcErr) {
        if (rpc) { _ok(u.trim()); onLogin(rpc); return }
        wrongCreds(); return
      }
      // PGRST202 = función no encontrada → usar modo legado hasta ejecutar la migración SQL
      if (rpcErr.code !== 'PGRST202') throw rpcErr

      // ── Modo legado ────────────────────────────────────────────────
      const { data: admin } = await supabase
        .from('administradores')
        .select('id, nombre, usuario, password_hash, activo, ultima_sesion, modulos')
        .eq('usuario', u.trim()).eq('activo', true).single()
      if (admin) {
        if (admin.password_hash !== p) { wrongCreds(); return }
        await supabase.from('administradores').update({
          ultima_sesion: new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace(' ', 'T'),
        }).eq('id', admin.id)
        const { password_hash: _, ...safeAdmin } = admin  // S-5: nunca guardar la contraseña en sesión
        _ok(u.trim())
        onLogin({ role: 'admin', data: safeAdmin })
        return
      }

      const { data: colegio } = await supabase
        .from('colegios')
        .select('id, nombre, usuario, password_hash, activo, ciudad, municipio, departamento_nombre, contactos, ultima_sesion')
        .eq('usuario', u.trim()).eq('activo', true).single()
      if (colegio) {
        if (colegio.password_hash !== p) { wrongCreds(); return }
        await supabase.from('colegios').update({
          ultima_sesion: new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace(' ', 'T'),
        }).eq('id', colegio.id)
        const { password_hash: _, ...safeColegio } = colegio  // S-5
        _ok(u.trim())
        onLogin({ role: 'colegio', data: safeColegio })
        return
      }

      const { data: estudiante } = await supabase
        .from('estudiantes')
        .select('id, nombre, usuario, password_hash, activo, grado, salon, colegio_id, ultima_sesion, colegios(nombre, ciudad)')
        .eq('usuario', u.trim()).eq('activo', true).single()
      if (estudiante) {
        if (estudiante.password_hash !== p) { wrongCreds(); return }
        await supabase.from('estudiantes').update({
          ultima_sesion: new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace(' ', 'T'),
        }).eq('id', estudiante.id)
        const { password_hash: _, ...safeEst } = estudiante  // S-5
        _ok(u.trim())
        onLogin({ role: 'estudiante', data: safeEst })
        return
      }

      wrongCreds()  // S-7: mismo mensaje si el usuario no existe
    } catch (e) {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [onLogin])

  // Auto-login desde hash fragment (viene de la homepage; hash no se envía al servidor)
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const params = new URLSearchParams(hash)
    const u = params.get('u')
    const p = params.get('p')
    if (u && p) {
      window.history.replaceState({}, document.title, window.location.pathname)
      doLogin(u, p, true)
    }
  }, [doLogin])

  const handleLogin = (e) => {
    e.preventDefault()
    doLogin(usuario, password, false)
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

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 28, fontFamily: 'Playfair Display, serif',
            color: C.white, fontWeight: 400, marginBottom: 6 }}>Milton Ochoa</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter',
            letterSpacing: '0.15em', textTransform: 'uppercase' }}>Portal de Resultados</div>
        </div>

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
                fontSize: 13, color: C.red, fontFamily: 'Inter' }}>
                {error}
              </div>
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
