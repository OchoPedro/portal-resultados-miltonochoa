import { useState } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  navy: '#0A1F3D', green: '#2D9B6F', greenLt: '#3AB882',
  bg: '#F8F9FB', bg2: '#EFF1F5', white: '#FFFFFF',
  text: '#1A1A2E', gray: '#6B7280', grayLt: '#D1D5DB', red: '#E05252',
}

export default function Login({ onLogin }) {
  const [tab, setTab] = useState('estudiante')
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (tab === 'estudiante') {
        const { data, error: err } = await supabase
          .from('estudiantes')
          .select('*, colegios(nombre, ciudad)')
          .eq('usuario', usuario.trim())
          .eq('activo', true)
          .single()

        if (err || !data) { setError('Usuario no encontrado.'); return }
        if (data.password_hash !== password) { setError('Contraseña incorrecta.'); return }
        onLogin({ role: 'estudiante', data })

      } else {
        const { data, error: err } = await supabase
          .from('colegios')
          .select('*')
          .eq('usuario', usuario.trim())
          .eq('activo', true)
          .single()

        if (err || !data) { setError('Código de colegio no encontrado.'); return }
        if (data.password_hash !== password) { setError('Contraseña incorrecta.'); return }
        onLogin({ role: 'colegio', data })
      }
    } catch (e) {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.navy, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      backgroundImage: 'radial-gradient(ellipse 60% 60% at 20% 50%, rgba(45,155,111,0.1) 0%, transparent 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontSize: 28, fontFamily: 'Playfair Display, serif',
            color: C.white, fontWeight: 400, marginBottom: 6,
          }}>Milton Ochoa</div>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter',
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>Portal de Resultados</div>
        </div>

        {/* Card */}
        <div style={{
          background: C.white, borderRadius: 12, padding: 40,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          borderTop: `3px solid ${C.green}`,
        }}>
          <div style={{ fontSize: 20, fontFamily: 'Playfair Display, serif',
            color: C.navy, marginBottom: 6 }}>Consulte sus resultados</div>
          <div style={{ fontSize: 12, color: C.gray, fontFamily: 'Inter', marginBottom: 28 }}>
            Portal académico Milton Ochoa
          </div>

          {/* Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2,
            background: C.bg2, padding: 3, borderRadius: 8, marginBottom: 28 }}>
            {['estudiante', 'colegio'].map(t => (
              <button key={t} onClick={() => { setTab(t); setError('') }} style={{
                padding: '9px', borderRadius: 6, border: 'none',
                fontFamily: 'Inter', fontSize: 12, fontWeight: 500,
                background: tab === t ? C.white : 'transparent',
                color: tab === t ? C.navy : C.gray,
                boxShadow: tab === t ? '0 1px 4px rgba(10,31,61,0.1)' : 'none',
                textTransform: 'capitalize', transition: 'all 0.2s',
              }}>{t === 'estudiante' ? 'Estudiante' : 'Institución'}</button>
            ))}
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.15em',
                textTransform: 'uppercase', color: C.gray, marginBottom: 6, fontFamily: 'Inter' }}>
                {tab === 'estudiante' ? 'Número de documento' : 'Código institucional'}
              </label>
              <input
                type="text"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                placeholder={tab === 'estudiante' ? 'CC / TI / CE' : 'Ej: boston2026'}
                required
                style={{
                  width: '100%', padding: '12px 16px', border: `1px solid ${C.grayLt}`,
                  borderRadius: 6, fontFamily: 'Inter', fontSize: 14, color: C.text,
                  background: C.bg, outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.15em',
                textTransform: 'uppercase', color: C.gray, marginBottom: 6, fontFamily: 'Inter' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '12px 16px', border: `1px solid ${C.grayLt}`,
                  borderRadius: 6, fontFamily: 'Inter', fontSize: 14, color: C.text,
                  background: C.bg, outline: 'none',
                }}
              />
            </div>

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 6, padding: '10px 14px', marginBottom: 16,
                fontSize: 13, color: C.red, fontFamily: 'Inter' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px', background: loading ? C.gray : C.navy,
              color: C.white, border: 'none', borderRadius: 6,
              fontFamily: 'Inter', fontSize: 12, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              transition: 'background 0.2s',
            }}>
              {loading ? 'Verificando...' : 'Ingresar'}
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
