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

function nowBogota() {
  return new Date(new Date().toLocaleString('en-US', { timeZone:'America/Bogota' }))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const ahora = nowBogota()

  // Ventana 24h: citas entre mañana 00:00 y mañana 23:59
  const manana = new Date(ahora)
  manana.setDate(manana.getDate() + 1)
  const mananaInicio = manana.toISOString().slice(0, 10) + 'T00:00:00'
  const mananaFin    = manana.toISOString().slice(0, 10) + 'T23:59:59'

  // Ventana 1h: citas en los próximos 55-75 min (margen de ±10 min)
  const en55min = new Date(ahora.getTime() + 55 * 60 * 1000)
  const en75min = new Date(ahora.getTime() + 75 * 60 * 1000)

  const [res24h, res1h] = await Promise.all([
    db.from('citas')
      .select('id, tenant_id, fecha_inicio, clientes_agenda(nombre,telefono), profesionales(nombre), servicios(nombre), tenants(nombre,direccion)')
      .gte('fecha_inicio', mananaInicio)
      .lte('fecha_inicio', mananaFin)
      .in('estado', ['confirmada', 'pendiente'])
      .eq('recordatorio_24h_enviado', false),
    db.from('citas')
      .select('id, tenant_id, fecha_inicio, clientes_agenda(nombre,telefono), profesionales(nombre), servicios(nombre), tenants(nombre,direccion)')
      .gte('fecha_inicio', en55min.toISOString())
      .lte('fecha_inicio', en75min.toISOString())
      .in('estado', ['confirmada', 'pendiente'])
      .eq('recordatorio_1h_enviado', false),
  ])

  // Registra el envío en wa_envios_log (best-effort, no bloquea el flujo)
  async function logEnvio(tenantId: string, tipo: string, telefono: string, citaId: string) {
    try {
      await db.from('wa_envios_log').insert({ tenant_id: tenantId, tipo, telefono, cita_id: citaId })
    } catch (_) { /* no interrumpir envíos por fallo de log */ }
  }

  let enviados24h = 0
  let enviados1h  = 0

  for (const c of (res24h.data || [])) {
    const cli  = (c as any).clientes_agenda
    const prof = (c as any).profesionales
    const serv = (c as any).servicios
    const ten  = (c as any).tenants
    if (!cli?.telefono) continue

    const dirLine24 = ten?.direccion
      ? `📍 ${ten.direccion}\n🗺️ https://maps.google.com/?q=${encodeURIComponent(ten.direccion)}\n`
      : ''
    const msg =
      `📅 *Recordatorio — tu cita es mañana*\n\n` +
      `Salón: ${ten?.nombre || '—'}\n` +
      `Profesional: ${prof?.nombre || '—'}\n` +
      `Servicio: ${serv?.nombre || '—'}\n` +
      `Día: ${fmtFecha(c.fecha_inicio)}\n` +
      `Hora: ${fmtHora(c.fecha_inicio)}\n` +
      `${dirLine24}\n` +
      `Si necesitas cancelar, responde este mensaje. ¡Te esperamos! ✂️`

    const ok = await enviarWA(cli.telefono, msg)
    if (ok) {
      await db.from('citas').update({ recordatorio_24h_enviado: true }).eq('id', c.id)
      await logEnvio((c as any).tenant_id, 'recordatorio_24h', cli.telefono, c.id)
      enviados24h++
    }
  }

  for (const c of (res1h.data || [])) {
    const cli  = (c as any).clientes_agenda
    const prof = (c as any).profesionales
    const serv = (c as any).servicios
    const ten  = (c as any).tenants
    if (!cli?.telefono) continue

    const dirLine1h = ten?.direccion
      ? `📍 ${ten.direccion}\n🗺️ https://maps.google.com/?q=${encodeURIComponent(ten.direccion)}\n`
      : ''
    const msg =
      `⏰ *Tu cita es en 1 hora*\n\n` +
      `Salón: ${ten?.nombre || '—'}\n` +
      `Profesional: ${prof?.nombre || '—'}\n` +
      `Servicio: ${serv?.nombre || '—'}\n` +
      `Hora: ${fmtHora(c.fecha_inicio)}\n` +
      `${dirLine1h}\n` +
      `¡Te esperamos! ✂️`

    const ok = await enviarWA(cli.telefono, msg)
    if (ok) {
      await db.from('citas').update({ recordatorio_1h_enviado: true }).eq('id', c.id)
      await logEnvio((c as any).tenant_id, 'recordatorio_1h', cli.telefono, c.id)
      enviados1h++
    }
  }

  return new Response(JSON.stringify({ ok: true, enviados24h, enviados1h, ts: ahora.toISOString() }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
