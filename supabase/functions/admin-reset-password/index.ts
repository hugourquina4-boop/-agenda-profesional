import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
}

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Sin fallback: si no está configurado, la función retorna 503
const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET') ?? ''

const PALABRAS = ['Salon','Plaza','Bella','Nova','Style','Arte','Glow','Star','Pro','Elite']

function generarClave(): string {
  const w = PALABRAS[Math.floor(Math.random() * PALABRAS.length)]
  const n = Math.floor(1000 + Math.random() * 9000)
  return `${w}${n}!`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  if (!ADMIN_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Función no configurada en servidor' }),
      { status: 503, headers: cors },
    )
  }

  const secret = req.headers.get('x-admin-secret')
  if (!secret || secret !== ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: cors })
  }

  try {
    const body = await req.json()
    const { tenant_id, email, nueva_clave } = body
    const clave = nueva_clave?.trim() || generarClave()

    // ── Modo 1: por email directo (superadmin, sin tenant) ──────────────────
    if (email) {
      const { data: users, error: listErr } = await db.auth.admin.listUsers()
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), { status: 500, headers: cors })
      }

      const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (!user) {
        return new Response(
          JSON.stringify({ error: `Usuario no encontrado: ${email}` }),
          { status: 404, headers: cors },
        )
      }

      const { error: authErr } = await db.auth.admin.updateUserById(user.id, { password: clave })
      if (authErr) {
        return new Response(JSON.stringify({ error: authErr.message }), { status: 500, headers: cors })
      }

      return new Response(
        JSON.stringify({ ok: true, email: user.email, clave }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    // ── Modo 2: por tenant_id → busca el admin del tenant ──────────────────
    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Se requiere email o tenant_id' }),
        { status: 400, headers: cors },
      )
    }

    const { data: ut, error: utErr } = await db
      .from('usuarios_tenant')
      .select('user_id, email')
      .eq('tenant_id', tenant_id)
      .eq('rol', 'admin')
      .eq('activo', true)
      .limit(1)
      .single()

    if (utErr || !ut) {
      return new Response(
        JSON.stringify({ error: 'Usuario admin no encontrado para este tenant' }),
        { status: 404, headers: cors },
      )
    }

    const { error: authErr } = await db.auth.admin.updateUserById(ut.user_id, { password: clave })
    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), { status: 500, headers: cors })
    }

    // Clave temporal visible al superadmin — pg_cron la borra después de 24h
    await db.from('tenants').update({
      admin_clave_temp:  clave,
      admin_clave_fecha: new Date().toISOString(),
      admin_email:       ut.email,
    }).eq('id', tenant_id)

    return new Response(
      JSON.stringify({ ok: true, email: ut.email, clave }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})
