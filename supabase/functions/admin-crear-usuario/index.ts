import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Sin autorización' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar que el llamante es superadmin usando su JWT
    const supabaseCaller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: esSuperAdmin } = await supabaseCaller.rpc('es_superadmin')
    if (!esSuperAdmin) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parsear body
    const { email, password, tenant_id, rol = 'admin' } = await req.json()
    if (!email || !password || !tenant_id) {
      return new Response(JSON.stringify({ error: 'email, password y tenant_id son requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Crear usuario con service_role (admin): confirma email automáticamente
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: nuevoUsuario, error: errorCrear } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (errorCrear) throw errorCrear

    const userId = nuevoUsuario.user.id

    // Vincular al tenant
    const { error: errorLink } = await supabaseAdmin.from('usuarios_tenant').insert({
      user_id:   userId,
      tenant_id,
      rol,
      activo:    true,
    })
    if (errorLink) {
      // Rollback: eliminar el usuario auth si el vínculo falla
      await supabaseAdmin.auth.admin.deleteUser(userId)
      throw errorLink
    }

    // Registrar en logs_actividad
    await supabaseAdmin.from('logs_actividad').insert({
      tenant_id,
      evento:  'usuario.creado',
      detalle: { email, rol, creado_via: 'superadmin-edge' },
    })

    return new Response(JSON.stringify({
      user_id:   userId,
      email:     nuevoUsuario.user.email,
      tenant_id,
      rol,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: mensaje }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
