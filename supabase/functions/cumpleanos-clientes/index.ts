import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const WA_TOKEN    = Deno.env.get('WHATSAPP_TOKEN') || ''
const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID') || ''

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

  const { data: clientes } = await db.from('v_cumpleanos_hoy').select('*')

  let enviados = 0
  const hoy = new Date().toISOString().slice(0, 10)

  for (const c of (clientes || [])) {
    if (!c.telefono) continue

    const nombre    = c.nombre?.split(' ')[0] || 'cliente'
    const salon     = c.salon_nombre || 'el salón'
    const puntos    = c.puntos_fidelizacion > 0 ? `\n🎁 Tienes ${c.puntos_fidelizacion} puntos acumulados.` : ''

    const msg =
      `🎂 *¡Feliz cumpleaños, ${nombre}!*\n\n` +
      `Todo el equipo de ${salon} te desea un día increíble.${puntos}\n\n` +
      `Para celebrar, escríbenos y recibe un descuento especial en tu próxima visita. ✂️💫`

    const ok = await enviarWA(c.telefono, msg)
    if (ok) {
      await db.from('clientes_agenda')
        .update({ cumpleanos_ultimo_envio: hoy })
        .eq('id', c.id)
      enviados++
    }
  }

  return new Response(JSON.stringify({ ok: true, enviados, fecha: hoy }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
