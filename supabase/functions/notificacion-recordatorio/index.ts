import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const WA_TOKEN    = Deno.env.get('WHATSAPP_TOKEN') || ''
const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID') || ''

function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'America/Bogota' })
}
function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', timeZone:'America/Bogota' })
}

async function enviarWA(telefono: string, mensaje: string) {
  if (!WA_TOKEN || !WA_PHONE_ID) return
  const num = telefono.replace(/\D/g, '')
  const intl = num.startsWith('57') ? num : `57${num}`
  await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product:'whatsapp', to:intl, type:'text', text:{ body:mensaje } }),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Mañana en zona Colombia
  const bogota = new Date(new Date().toLocaleString('en-US', { timeZone:'America/Bogota' }))
  bogota.setDate(bogota.getDate() + 1)
  const manana = bogota.toISOString().slice(0, 10)

  const { data: citas } = await db
    .from('citas')
    .select(`
      id, fecha_inicio,
      clientes_agenda ( nombre, telefono ),
      profesionales   ( nombre ),
      servicios       ( nombre ),
      tenants         ( nombre )
    `)
    .gte('fecha_inicio', `${manana}T00:00:00`)
    .lte('fecha_inicio', `${manana}T23:59:59`)
    .in('estado', ['confirmada', 'pendiente'])

  let enviados = 0
  for (const c of (citas || [])) {
    const cli  = (c as any).clientes_agenda
    const prof = (c as any).profesionales
    const serv = (c as any).servicios
    const ten  = (c as any).tenants
    if (!cli?.telefono) continue

    const msg =
      `📅 *Recordatorio de tu cita mañana*\n\n` +
      `Salón: ${ten?.nombre || '—'}\n` +
      `Profesional: ${prof?.nombre || '—'}\n` +
      `Servicio: ${serv?.nombre || '—'}\n` +
      `Hora: ${fmtHora(c.fecha_inicio)}\n\n` +
      `Si necesitas cancelar, responde este mensaje. ¡Te esperamos! ✂️`

    await enviarWA(cli.telefono, msg)
    enviados++
  }

  return new Response(JSON.stringify({ ok: true, enviados, fecha: manana }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
