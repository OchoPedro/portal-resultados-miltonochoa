export const config = { maxDuration: 60 }

// Orígenes permitidos. Agrega más separados por coma en la variable de entorno ALLOWED_ORIGIN.
const ALLOWED_ORIGINS = [
  'https://portal-resultados-miltonochoa.vercel.app',
  'https://resultados.aamocolombia.com',
  ...(process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',').map(s => s.trim()) : []),
]

function isAllowedOrigin(origin) {
  if (!origin) return false
  if (ALLOWED_ORIGINS.includes(origin)) return true
  return /^https:\/\/portal-resultados-miltonochoa-[a-z0-9-]+\.vercel\.app$/.test(origin)
}

export default async function handler(req, res) {
  const origin = req.headers['origin'] || ''
  const allowed = isAllowedOrigin(origin)

  const corsOrigin = allowed ? origin : ALLOWED_ORIGINS[0]
  res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (!allowed) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method !== 'POST') {
    return res.status(405).end('Method not allowed')
  }

  const contentLength = req.headers['content-length']
  if (contentLength && parseInt(contentLength) > 20 * 1024 * 1024) {
    return res.status(413).json({ error: 'Payload too large' })
  }

  try {
    const body = req.body

    if (!body.messages || !Array.isArray(body.messages)) {
      return res.status(400).json({ error: 'Invalid request body' })
    }

    const safeBody = {
      model: 'claude-sonnet-4-6',
      max_tokens: Math.min(typeof body.max_tokens === 'number' ? body.max_tokens : 2000, 4000),
      messages: body.messages,
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(safeBody),
    })

    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
