import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ORIGINS = [
  'https://aamocolombia.com',
  'https://www.aamocolombia.com',
  'https://miltonochoa-web.vercel.app',
]

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false })

  const { usuario, password } = req.body || {}
  if (!usuario || !password) return res.status(400).json({ ok: false })

  // Buscar en colegios (activos) y administradores
  const tables = ['colegios', 'administradores', 'estudiantes']
  for (const tabla of tables) {
    const { data } = await supabaseAdmin
      .from(tabla)
      .select('password_hash')
      .eq('usuario', usuario.trim())
      .eq('activo', true)
      .limit(1)
      .single()

    if (data?.password_hash) {
      const match = data.password_hash.startsWith('$2')
        ? await bcrypt.compare(password, data.password_hash)
        : false
      if (match) return res.status(200).json({ ok: true })
    }
  }

  return res.status(200).json({ ok: false })
}
