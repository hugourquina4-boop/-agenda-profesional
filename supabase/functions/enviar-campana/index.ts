import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WA_TOKEN      = Deno.env.get('WHATSAPP_TOKEN') ?? ''
const WA_PHONE_ID   = Deno.env.get('WHATSAPP_PHONE_ID') ?? ''

const db = createClient(SUPABASE_URL, SERVICE_KEY)

function normalizar(telefono: string) {
  const num = telefono.replace(/\D/g, '')
  return num.startsWith('57') ? num : `57${num}`
}

async function enviarWA(telefono: string, mensaje: string) {
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizar(telefono),
        type: 'text',
        text: { body: mensaje },
      }),
    }
  )
  return res.ok
}

function sustituir(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (txt, [key, val]) => txt.replaceAll(`{{${key}}}`, val),
    template,
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  if (!WA_TOKEN || !WA_PHONE_ID) {
    return new Response(
      JSON.stringify({ error: 'WhatsApp API no configurado en el servidor' }),
      { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  try {
    // Verificar JWT del usuario
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: cors })
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401, headers: cors })
    }

    const body = await req.json()
    const { tenant_id, mensaje, clientes } = body as {
      tenant_id: string
      mensaje:   string
      clientes:  Array<{ id: string; telefono: string; nombre: string; [k: string]: string }>
    }

    if (!tenant_id || !mensaje || !Array.isArray(clientes) || clientes.length === 0) {
      return new Response(JSON.stringify({ error: 'Parámetros inválidos' }), { status: 400, headers: cors })
    }

    // Verificar que el usuario pertenece al tenant
    const { data: acceso } = await db
      .from('usuarios_tenant')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('user_id', user.id)
      .eq('activo', true)
      .single()

    if (!acceso) {
      return new Response(JSON.stringify({ error: 'Sin acceso a este negocio' }), { status: 403, headers: cors })
    }

    // Obtener datos del tenant para variables
    const { data: tenant } = await db
      .from('tenants')
      .select('nombre, direccion')
      .eq('id', tenant_id)
      .single()

    let enviados = 0
    let fallidos = 0

    for (const c of clientes) {
      if (!c.telefono?.replace(/\D/g, '')) { fallidos++; continue }

      const texto = sustituir(mensaje, {
        nombre:  c.nombre?.split(' ')[0] ?? 'cliente',
        negocio: tenant?.nombre ?? 'el salón',
        direccion: tenant?.direccion ?? '',
        ...c,
      })

      const ok = await enviarWA(c.telefono, texto)
      if (ok) {
        enviados++
        try {
          await db.from('wa_envios_log').insert({
            tenant_id, tipo: 'campana', telefono: c.telefono,
          })
        } catch (_) { /* no interrumpir por fallo de log */ }
      } else {
        fallidos++
      }

      // Pausa mínima para evitar rate limit de la API de Meta
      await new Promise(r => setTimeout(r, 200))
    }

    return new Response(
      JSON.stringify({ ok: true, enviados, fallidos, total: clientes.length }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers: cors })
  }
})
