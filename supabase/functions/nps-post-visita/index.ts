import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const db       = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // Citas completadas entre hace 2h y 6h sin NPS enviado
    const ahora = new Date()
    const hace2h = new Date(ahora.getTime() - 2 * 60 * 60 * 1000).toISOString()
    const hace6h = new Date(ahora.getTime() - 6 * 60 * 60 * 1000).toISOString()

    const { data: citas, error } = await db
      .from('citas')
      .select(`
        id, tenant_id, nps_token,
        clientes_agenda ( nombre, telefono ),
        tenants         ( nombre )
      `)
      .eq('estado', 'completada')
      .eq('nps_enviado', false)
      .lte('fecha_inicio', hace2h)
      .gte('fecha_inicio', hace6h)

    if (error) throw error

    let enviados = 0

    for (const cita of (citas || [])) {
      const cliente = (cita as any).clientes_agenda
      const tenant  = (cita as any).tenants

      if (!cliente?.telefono) continue

      // Generar token único si no tiene
      let token = cita.nps_token
      if (!token) {
        token = crypto.randomUUID()
        await db.from('citas').update({ nps_token: token }).eq('id', cita.id)
      }

      const link   = `${APP_URL}/nps/${token}`
      const nombre = (cliente.nombre as string)?.split(' ')[0] || 'cliente'
      const salon  = (tenant?.nombre as string) || 'el salón'

      const msg =
        `✨ *Hola ${nombre}*, ¿cómo estuvo tu visita en ${salon}?\n\n` +
        `Tu opinión nos ayuda a mejorar. Tarda solo 10 segundos:\n${link}`

      const ok = await enviarWA(cliente.telefono, msg)

      // Marcar como enviado incluso si WA no está configurado, para no reenviar
      await db.from('citas')
        .update({ nps_enviado: true })
        .eq('id', cita.id)

      if (ok) enviados++
    }

    return new Response(
      JSON.stringify({ ok: true, procesadas: citas?.length || 0, enviados }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: cors },
    )
  }
})
