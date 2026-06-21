import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export let supabase = createClient(supabaseUrl, supabaseAnonKey)

export function setSupabaseToken(token) {
  if (token) sessionStorage.setItem('mo_token', token)
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: (url, options = {}) => {
        const headers = new Headers(options.headers)
        headers.set('Authorization', `Bearer ${token}`)
        return fetch(url, { ...options, headers })
      }
    }
  })
}

export function clearSupabaseToken() {
  sessionStorage.removeItem('mo_token')
  supabase = createClient(supabaseUrl, supabaseAnonKey)
}
