import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
}

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET') || 'salonpro2026'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const secret = req.headers.get('x-admin-secret')
  if (secret !== ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: cors })
  }

  try {
    const { email, password, tenant_id, rol = 'admin' } = await req.json()
    if (!email || !password || !tenant_id) {
      return new Response(
        JSON.stringify({ error: 'email, password y tenant_id son requeridos' }),
        { status: 400, headers: cors }
      )
    }

    // Crear usuario con service role (sin confirmación de email)
    const { data: created, error: userErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (userErr) {
      return new Response(JSON.stringify({ error: userErr.message }), { status: 500, headers: cors })
    }

    const userId = created.user.id

    // Vincular al tenant
    const { error: utErr } = await db.from('usuarios_tenant').insert({
      user_id: userId,
      tenant_id,
      rol,
      activo: true,
    })
    if (utErr) {
      await db.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: utErr.message }), { status: 500, headers: cors })
    }

    // Guardar credenciales en tenants para el panel superadmin
    await db.from('tenants').update({
      admin_email:       email,
      admin_clave_temp:  password,
      admin_clave_fecha: new Date().toISOString(),
    }).eq('id', tenant_id)

    return new Response(
      JSON.stringify({ ok: true, user_id: userId, email }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})
