import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export let supabase = createClient(supabaseUrl, supabaseAnonKey)

export function setSupabaseToken(token) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => token,
  })
}

export function clearSupabaseToken() {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
}
