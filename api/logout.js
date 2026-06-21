export const config = { maxDuration: 5 }

const ALLOWED_ORIGINS = [
  'https://portal-resultados-miltonochoa.vercel.app',
  'https://resultados.aamocolombia.com',
]
const isAllowed = (o) =>
  ALLOWED_ORIGINS.includes(o) ||
  /^https:\/\/portal-resultados-miltonochoa-[a-z0-9-]+\.vercel\.app$/.test(o)

export default async function handler(req, res) {
  const origin = req.headers['origin'] || ''
  const allowed = isAllowed(origin)
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : ALLOWED_ORIGINS[0])
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).end()

  res.setHeader('Set-Cookie', [
    'mo_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
    'mo_trusted_device=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
  ])
  return res.status(200).json({ ok: true })
}
