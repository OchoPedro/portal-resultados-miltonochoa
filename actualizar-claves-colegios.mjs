import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://bmspwsbhsjkamjywvvde.supabase.co'
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtc3B3c2Joc2prYW1qeXd2dmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMDE3NDIsImV4cCI6MjA5Njg3Nzc0Mn0.pnp0c31IbLm4JVv46tsePwcJOs5H5qoqc7aZRPTPmjE'
const ADMIN_TOKEN   = process.env.ADMIN_TOKEN

if (!ADMIN_TOKEN) { console.error('Falta ADMIN_TOKEN'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
})

// Sin O/0 e I/1 para evitar confusión visual
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomSuffix() {
  let s = ''
  for (let i = 0; i < 2; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)]
  return s
}

async function main() {
  // Traer todos los colegios
  const { data: colegios, error } = await supabase
    .from('colegios')
    .select('id, usuario')
    .order('usuario')

  if (error) { console.error('Error al leer colegios:', error.message); process.exit(1) }
  console.log(`Total colegios: ${colegios.length}\n`)

  let ok = 0, fail = 0
  const log = []

  for (const c of colegios) {
    const plain = `${c.usuario}-${randomSuffix()}`

    const { data: hashed, error: hashErr } = await supabase
      .rpc('hashear_password', { p_password: plain })

    if (hashErr) {
      console.error(`  ✗ ${c.usuario}: ${hashErr.message}`)
      fail++
      continue
    }

    const { error: updErr } = await supabase
      .from('colegios')
      .update({ password_hash: hashed, password_plain: plain })
      .eq('id', c.id)

    if (updErr) {
      console.error(`  ✗ ${c.usuario}: ${updErr.message}`)
      fail++
    } else {
      console.log(`  ✓ ${c.usuario.padEnd(14)} → ${plain}`)
      log.push({ usuario: c.usuario, nueva_clave: plain })
      ok++
    }
  }

  console.log(`\n✅ Actualizados: ${ok}  ✗ Fallidos: ${fail}`)

  if (log.length) {
    console.log('\n── RESUMEN DE CLAVES NUEVAS ──')
    log.forEach(r => console.log(`${r.usuario.padEnd(14)}  ${r.nueva_clave}`))
  }
}

main()
