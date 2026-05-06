import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Meta Cloud API — configurar en Supabase Dashboard → Edge Functions → Secrets
const WA_TOKEN      = Deno.env.get('WHATSAPP_TOKEN') || ''
const WA_PHONE_ID   = Deno.env.get('WHATSAPP_PHONE_ID') || ''

const db = createClient(SUPABASE_URL, SERVICE_KEY)

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota',
  })
}
function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota',
  })
}

async function enviarWA(telefono: string, mensaje: string) {
  if (!WA_TOKEN || !WA_PHONE_ID) return { skipped: true }
  // Normalizar teléfono colombiano → formato internacional
  const num = telefono.replace(/\D/g, '')
  const intl = num.startsWith('57') ? num : `57${num}`
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: intl,
        type: 'text',
        text: { body: mensaje },
      }),
    }
  )
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()
    const { cita_id } = body

    if (!cita_id) return new Response(JSON.stringify({ error: 'cita_id requerido' }), { status: 400, headers: cors })

    // Cargar datos completos de la cita
    const { data: cita, error } = await db
      .from('citas')
      .select(`
        id, fecha_inicio, fecha_fin, estado,
        clientes_agenda ( nombre, telefono ),
        profesionales   ( nombre ),
        servicios       ( nombre, precio ),
        tenants         ( nombre, whatsapp )
      `)
      .eq('id', cita_id)
      .single()

    if (error || !cita) {
      return new Response(JSON.stringify({ error: 'Cita no encontrada' }), { status: 404, headers: cors })
    }

    const cliente  = (cita as any).clientes_agenda
    const prof     = (cita as any).profesionales
    const serv     = (cita as any).servicios
    const tenant   = (cita as any).tenants
    const fecha    = fmtFecha(cita.fecha_inicio)
    const hora     = fmtHora(cita.fecha_inicio)

    const resultados: Record<string, unknown> = {}

    // ── Mensaje al CLIENTE ─────────────────────────────────────────
    if (cliente?.telefono) {
      const msgCliente =
        `✅ *Cita confirmada en ${tenant?.nombre || 'el salón'}*\n\n` +
        `👤 Profesional: ${prof?.nombre || '—'}\n` +
        `✂️ Servicio: ${serv?.nombre || '—'}\n` +
        `📅 Fecha: ${fecha}\n` +
        `🕐 Hora: ${hora}\n\n` +
        `Si necesitas cancelar o reagendar, responde este mensaje. ¡Te esperamos! 💫`
      resultados.cliente = await enviarWA(cliente.telefono, msgCliente)
    }

    // ── Notificación al SALÓN ──────────────────────────────────────
    if (tenant?.whatsapp) {
      const precio = serv?.precio > 0
        ? `\n💰 Valor: $${Number(serv.precio).toLocaleString('es-CO')}`
        : ''
      const msgSalon =
        `🔔 *Nueva cita agendada*\n\n` +
        `👤 Cliente: ${cliente?.nombre || 'Anónimo'}\n` +
        `📞 Teléfono: ${cliente?.telefono || 'No indicado'}\n` +
        `✂️ Servicio: ${serv?.nombre || '—'}\n` +
        `👩‍💼 Con: ${prof?.nombre || '—'}\n` +
        `📅 ${fecha} a las ${hora}${precio}`
      resultados.salon = await enviarWA(tenant.whatsapp, msgSalon)
    }

    return new Response(JSON.stringify({ ok: true, ...resultados }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})
