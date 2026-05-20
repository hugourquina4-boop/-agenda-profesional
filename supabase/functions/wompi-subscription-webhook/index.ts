import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Variables de entorno — configurar en Supabase Dashboard → Edge Functions → Secrets:
//   WOMPI_EVENTS_SECRET   → clave de integridad de eventos (en Wompi Dashboard → Desarrolladores → Eventos)
//   SUPABASE_URL          → auto-inyectada
//   SUPABASE_SERVICE_ROLE_KEY → auto-inyectada

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EVENTS_SECRET = Deno.env.get('WOMPI_EVENTS_SECRET') || ''

const db = createClient(SUPABASE_URL, SERVICE_KEY)

// Meses por plan (permite que Hugo venda packs en el futuro)
const MESES_POR_PLAN: Record<string, number> = {
  starter: 1,
  pro:     1,
  ultra:   1,
}

// Verifica la firma de integridad de Wompi
// Wompi firma: SHA-256(concat(signature.properties values from data.transaction) + integrity_secret)
async function verificarFirma(body: Record<string, unknown>, checksum: string): Promise<boolean> {
  if (!EVENTS_SECRET) return true // sin secret configurado → skip (solo para desarrollo)
  const sig = body.signature as Record<string, unknown> | undefined
  const properties = sig?.properties as string[] | undefined
  const txn = (body.data as Record<string, unknown>)?.transaction as Record<string, unknown>
  if (!txn || !properties?.length) return false
  // Concatenar valores en el orden que Wompi los envía en signature.properties
  const valores = properties.map(p => {
    const key = p.replace('transaction.', '')
    return String(txn[key] ?? '')
  })
  const cadena = valores.join('') + EVENTS_SECRET
  const encoded = new TextEncoder().encode(cadena)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex === checksum
}

// Parsea la referencia: formato esperado → "{slug}_{plan}_{yyyymm}"
// Ej: "glamour-studio_pro_202506"
function parsearReferencia(ref: string): { slug: string; plan: string } | null {
  const partes = ref.split('_')
  if (partes.length < 3) return null
  const plan = partes[partes.length - 2]
  const slug = partes.slice(0, -2).join('_')
  if (!slug || !plan) return null
  return { slug, plan }
}

// Calcula nueva fecha_vencimiento extendiendo desde hoy (o desde la fecha actual si aún vigente)
function nuevaFechaVencimiento(fechaActual: string | null, meses: number): string {
  const base = fechaActual && new Date(fechaActual) > new Date()
    ? new Date(fechaActual)
    : new Date()
  base.setMonth(base.getMonth() + meses)
  return base.toISOString().split('T')[0]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ ok: true, service: 'wompi-subscription-webhook' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Wompi envía el checksum en el campo signature.checksum
  const signature = body.signature as Record<string, string> | undefined
  const checksum = signature?.checksum ?? ''

  const firmaValida = await verificarFirma(body, checksum)
  if (!firmaValida) {
    console.error('wompi-webhook: firma inválida')
    return new Response('Unauthorized', { status: 401 })
  }

  // Solo procesar eventos de transacción aprobada
  const event = body.event as string
  if (event !== 'transaction.updated') {
    return new Response(JSON.stringify({ ok: true, ignorado: event }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const txn = (body.data as Record<string, unknown>)?.transaction as Record<string, unknown>
  if (!txn || txn.status !== 'APPROVED') {
    return new Response(JSON.stringify({ ok: true, status: txn?.status }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const referencia = (txn.reference as string) ?? ''
  const parsed = parsearReferencia(referencia)
  if (!parsed) {
    console.error('wompi-webhook: referencia no parseable:', referencia)
    return new Response('Bad reference', { status: 400 })
  }

  const { slug, plan } = parsed
  const monto = ((txn.amount_in_cents as number) ?? 0) / 100

  // Buscar tenant por slug
  const { data: tenant, error: errTenant } = await db
    .from('tenants')
    .select('id, fecha_vencimiento, plan')
    .eq('slug', slug)
    .single()

  if (errTenant || !tenant) {
    console.error('wompi-webhook: tenant no encontrado:', slug, errTenant)
    return new Response('Tenant not found', { status: 404 })
  }

  const meses = MESES_POR_PLAN[plan] ?? 1
  const nuevaFecha = nuevaFechaVencimiento(tenant.fecha_vencimiento, meses)

  // Actualizar tenant: activar + extender vencimiento + actualizar plan si cambió
  const { error: errUpdate } = await db
    .from('tenants')
    .update({
      activo: true,
      fecha_vencimiento: nuevaFecha,
      plan: plan,
    })
    .eq('id', tenant.id)

  if (errUpdate) {
    console.error('wompi-webhook: error actualizando tenant:', errUpdate)
    return new Response('DB error', { status: 500 })
  }

  // Registrar pago en pagos_plataforma
  await db.from('pagos_plataforma').insert({
    tenant_id:    tenant.id,
    monto:        monto,
    metodo:       'wompi',
    referencia:   referencia,
    nota:         `Pago automático Wompi — plan ${plan}`,
    fecha:        new Date().toISOString().split('T')[0],
  })

  console.log(`wompi-webhook: ✓ ${slug} activado hasta ${nuevaFecha} — $${monto.toLocaleString('es-CO')} COP`)

  return new Response(JSON.stringify({ ok: true, slug, nuevaFecha, monto }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
