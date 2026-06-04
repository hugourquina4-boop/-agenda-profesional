import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const db          = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const WA_TOKEN    = Deno.env.get('WHATSAPP_TOKEN')    || ''
const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID') || ''
const APP_URL     = Deno.env.get('APP_URL')            || 'https://project-gnyy8.vercel.app'

async function enviarWA(telefono: string, mensaje: string): Promise<boolean> {
  if (!WA_TOKEN || !WA_PHONE_ID) return false
  const num  = telefono.replace(/\D/g, '')
  const intl = num.startsWith('57') ? num : `57${num}`
  const res  = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: intl,
      type: 'text',
      text: { body: mensaje },
    }),
  })
  return res.ok
}

function mensajeVencimiento(tenant: any, diasRestantes: number): string {
  const nombre = tenant.nombre || 'tu negocio'
  const url    = `${APP_URL}/salon?tenant=${tenant.slug}`

  if (diasRestantes > 0) {
    return (
      `⚠️ *${nombre}* — Suscripción próxima a vencer\n\n` +
      `Tu plan vence en *${diasRestantes} día${diasRestantes === 1 ? '' : 's'}*.\n\n` +
      `Para continuar usando Salón Pro sin interrupciones, renueva antes de que expire.\n\n` +
      `💳 Métodos de pago:\n` +
      `• Nequi: 3017826543\n` +
      `• Bancolombia: 123-456789-00\n` +
      `• Transferencia a Hugo Urquina\n\n` +
      `¿Tienes dudas? Escríbenos por este medio.\n\n` +
      `🔗 Tu panel: ${url}`
    )
  }

  return (
    `🚨 *${nombre}* — Suscripción vencida hoy\n\n` +
    `Tu plan de Salón Pro venció *hoy*. El sistema entrará en modo restringido en 24 horas.\n\n` +
    `Para renovar y evitar interrupciones, comunícate con nosotros de inmediato:\n\n` +
    `💳 Nequi: 3017826543\n` +
    `💳 Bancolombia: 123-456789-00\n\n` +
    `Envíanos el comprobante y reactivamos al instante.\n\n` +
    `🔗 Tu panel: ${url}`
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const hoy    = new Date()
    const addDia = (d: number) => {
      const dt = new Date(hoy)
      dt.setDate(dt.getDate() + d)
      return dt.toISOString().slice(0, 10)
    }

    // Tenants con vencimiento en 7, 3 o 0 días
    const fechasObjetivo = [addDia(7), addDia(3), addDia(0)]

    const { data: tenants, error } = await db
      .from('tenants')
      .select('id, nombre, slug, telefono, fecha_vencimiento')
      .in('fecha_vencimiento', fechasObjetivo)
      .eq('activo', true)
      .is('deleted_at', null)

    if (error) throw error

    let enviados = 0

    for (const t of (tenants || [])) {
      if (!t.telefono) continue

      const fechaVenc    = new Date(t.fecha_vencimiento + 'T12:00:00')
      const diasRestantes = Math.round((fechaVenc.getTime() - hoy.getTime()) / 86_400_000)

      const msg = mensajeVencimiento(t, diasRestantes)
      const ok  = await enviarWA(t.telefono, msg)
      if (ok) enviados++
    }

    return new Response(
      JSON.stringify({ ok: true, revisados: tenants?.length ?? 0, enviados }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )

  } catch (e) {
    console.error(e)
    return new Response(
      JSON.stringify({ error: 'Error interno' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
})
