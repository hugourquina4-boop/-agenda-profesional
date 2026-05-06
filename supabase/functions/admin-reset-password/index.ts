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

const PALABRAS = ['Salon','Plaza','Bella','Nova','Style','Arte','Glow','Star','Pro','Elite']

function generarClave(): string {
  const w = PALABRAS[Math.floor(Math.random() * PALABRAS.length)]
  const n = Math.floor(1000 + Math.random() * 9000)
  return `${w}${n}!`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const secret = req.headers.get('x-admin-secret')
  if (secret !== ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: cors })
  }

  try {
    const { tenant_id, nueva_clave } = await req.json()
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id requerido' }), { status: 400, headers: cors })
    }

    // Buscar usuario admin del tenant
    const { data: ut, error: utErr } = await db
      .from('usuarios_tenant')
      .select('user_id, email')
      .eq('tenant_id', tenant_id)
      .eq('rol', 'admin')
      .eq('activo', true)
      .limit(1)
      .single()

    if (utErr || !ut) {
      return new Response(JSON.stringify({ error: 'Usuario admin no encontrado para este tenant' }), { status: 404, headers: cors })
    }

    const clave = nueva_clave?.trim() || generarClave()

    // Actualizar contraseña en Supabase Auth
    const { error: authErr } = await db.auth.admin.updateUserById(ut.user_id, { password: clave })
    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), { status: 500, headers: cors })
    }

    // Guardar clave visible en tenants para el panel superadmin
    await db.from('tenants').update({
      admin_clave_temp:  clave,
      admin_clave_fecha: new Date().toISOString(),
      admin_email:       ut.email,
    }).eq('id', tenant_id)

    return new Response(
      JSON.stringify({ ok: true, email: ut.email, clave }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})
