import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function slugify(t: string) {
  return t.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Max 5 intentos por IP por hora
async function checkRateLimit(ip: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await db
    .from('rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('endpoint', 'registro-tenant')
    .gte('created_at', windowStart)
  if ((count ?? 0) >= 5) return false
  await db.from('rate_limits').insert({ ip, endpoint: 'registro-tenant' })
  return true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    if (!(await checkRateLimit(ip))) {
      return new Response(
        JSON.stringify({ error: 'Demasiados intentos desde tu red. Espera una hora e intenta de nuevo.' }),
        { status: 429, headers: cors },
      )
    }

    const { email, password, nombre, slug, vertical, ciudad, whatsapp, nombre_owner } = await req.json()

    if (!email?.trim() || !password || !nombre?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Email, contraseña y nombre son requeridos' }),
        { status: 400, headers: cors },
      )
    }
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres' }),
        { status: 400, headers: cors },
      )
    }
    if (!/[0-9]/.test(password)) {
      return new Response(
        JSON.stringify({ error: 'La contraseña debe incluir al menos un número' }),
        { status: 400, headers: cors },
      )
    }

    const finalSlug = (slug?.trim() || slugify(nombre)).substring(0, 60)

    const { data: existing } = await db.from('tenants').select('id').eq('slug', finalSlug).maybeSingle()
    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Ese identificador ya está en uso, elige otro.' }),
        { status: 409, headers: cors },
      )
    }

    const { data: { user }, error: authErr } = await db.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { nombre: nombre_owner || nombre },
    })

    if (authErr) {
      const msg = authErr.message.toLowerCase()
      return new Response(JSON.stringify({
        error: msg.includes('already') ? 'Este email ya tiene una cuenta registrada.' : authErr.message,
      }), { status: 400, headers: cors })
    }

    const { data: tenant, error: tErr } = await db.from('tenants').insert({
      nombre:    nombre.trim(),
      slug:      finalSlug,
      vertical:  vertical || 'peluqueria',
      ciudad:    ciudad?.trim() || 'Colombia',
      whatsapp:  whatsapp?.trim() || null,
      email:     email.trim(),
      activo:    true,
      verificado: false,
    }).select('id').single()

    if (tErr) {
      await db.auth.admin.deleteUser(user!.id)
      return new Response(JSON.stringify({ error: tErr.message }), { status: 400, headers: cors })
    }

    await db.from('usuarios_tenant').insert({
      tenant_id: tenant.id,
      user_id:   user!.id,
      rol:       'admin',
      nombre:    (nombre_owner || nombre).trim(),
      email:     email.trim(),
      activo:    true,
    })

    return new Response(
      JSON.stringify({ ok: true, slug: finalSlug }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})
