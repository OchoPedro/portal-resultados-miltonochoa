import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Cliente con fetch personalizado: inyecta el JWT firmado por el servidor en cada
// petición a Supabase. Supabase valida la firma y aplica las políticas RLS.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: {
    fetch: (url, options = {}) => {
      const token = sessionStorage.getItem('mo_token')
      const headers = { ...(options.headers || {}) }
      if (token) headers['Authorization'] = `Bearer ${token}`
      return fetch(url, { ...options, headers })
    },
  },
})
