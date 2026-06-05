import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const WA_TOKEN    = Deno.env.get('WHATSAPP_TOKEN') || ''
const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID') || ''

function fmtCOP(n: number) {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

async function enviarWA(telefono: string, mensaje: string) {
  if (!WA_TOKEN || !WA_PHONE_ID) return false
  const num = telefono.replace(/\D/g, '')
  const intl = num.startsWith('57') ? num : `57${num}`
  const res = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product:'whatsapp', to:intl, type:'text', text:{ body:mensaje } }),
  })
  return res.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const [resumenRes, mananaRes] = await Promise.all([
    db.from('v_resumen_dia').select('*'),
    db.from('v_citas_manana_count').select('*'),
  ])

  const mananaMap: Record<string, number> = {}
  for (const r of (mananaRes.data || [])) mananaMap[r.tenant_id] = r.total

  let enviados = 0

  for (const t of (resumenRes.data || [])) {
    if (!t.salon_whatsapp) continue

    const completadas = t.citas_completadas || 0
    const noShows     = t.no_shows || 0
    const ingresos    = t.ingresos_hoy || 0
    const manana      = mananaMap[t.tenant_id] || 0

    // Solo enviar si hubo actividad hoy
    if (completadas === 0 && manana === 0) continue

    const noShowLine = noShows > 0 ? `\n❌ No asistieron: ${noShows}` : ''
    const mananaLine = manana > 0 ? `\n\n📅 *Mañana:* ${manana} cita${manana !== 1 ? 's' : ''} programada${manana !== 1 ? 's' : ''}` : ''

    const msg =
      `💈 *[Salón Pro] Resumen — ${t.salon_nombre}*\n\n` +
      `✅ Citas atendidas: ${completadas}${noShowLine}\n` +
      `💰 Ingresos: ${fmtCOP(ingresos)}` +
      mananaLine +
      `\n\n_Salón Pro — peluquerías, barberías y spas · ¡Hasta mañana!_ 🌙`

    const ok = await enviarWA(t.salon_whatsapp, msg)
    if (ok) enviados++
  }

  return new Response(JSON.stringify({ ok: true, enviados }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
