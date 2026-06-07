import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const db = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Helpers ────────────────────────────────────────────────────────────────

function normalPhone(raw: string): string {
  // Whapi sends "573001234567@s.whatsapp.net" or plain "573001234567"
  const digits = raw.replace(/@.*/, '').replace(/\D/g, '')
  return digits
}

function localPhone(digits: string): string {
  return digits.startsWith('57') ? digits.slice(2) : digits
}

async function sendWhapi(whapiToken: string, to: string, body: string) {
  const res = await fetch('https://gate.whapi.cloud/messages/text', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${whapiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, body }),
  })
  if (!res.ok) console.error('Whapi send failed:', await res.text())
}

function fechaBogota(offset = 0): string {
  const d = new Date(Date.now() + offset)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

function horaBogota(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota',
  })
}

// ── Tools implementation ───────────────────────────────────────────────────

async function listarServicios(tenantId: string) {
  const { data } = await db
    .from('servicios')
    .select('id, nombre, precio, duracion_min')
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .order('nombre')
  return data ?? []
}

async function verificarDisponibilidad(tenantId: string, fecha: string, servicioId?: string) {
  // Get tenant config
  const { data: tenant } = await db
    .from('tenants')
    .select('config_vertical')
    .eq('id', tenantId)
    .single()

  const cfg = tenant?.config_vertical ?? {}
  const aperturaH  = parseInt(cfg.hora_apertura ?? '8')
  const cierreH    = parseInt(cfg.hora_cierre   ?? '18')
  const slotMin    = parseInt(cfg.duracion_slot_min ?? '30')

  // Get service duration if provided
  let durMin = slotMin
  if (servicioId) {
    const { data: serv } = await db.from('servicios').select('duracion_min').eq('id', servicioId).single()
    if (serv?.duracion_min) durMin = serv.duracion_min
  }

  // Get active professionals with their appointments on the date
  const { data: profs } = await db
    .from('profesionales')
    .select('id, nombre')
    .eq('tenant_id', tenantId)
    .eq('activo', true)

  if (!profs?.length) return { disponible: false, message: 'No hay profesionales disponibles.' }

  const fechaInicio = `${fecha}T00:00:00`
  const fechaFin    = `${fecha}T23:59:59`

  const { data: citasDelDia } = await db
    .from('citas')
    .select('profesional_id, fecha_inicio, fecha_fin')
    .eq('tenant_id', tenantId)
    .gte('fecha_inicio', fechaInicio)
    .lte('fecha_inicio', fechaFin)
    .in('estado', ['pendiente', 'confirmada'])

  // Build slots
  const slotsLibres: Array<{ hora: string; profesional: string; profesional_id: string; fecha_hora: string }> = []

  for (const prof of profs) {
    for (let h = aperturaH; h < cierreH; h++) {
      for (let m = 0; m < 60; m += slotMin) {
        const slotStart = new Date(`${fecha}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
        const slotEnd   = new Date(slotStart.getTime() + durMin * 60_000)

        // Check the slot doesn't exceed closing time
        if (slotEnd.getHours() > cierreH) continue

        // Check no overlap with existing appointments
        const solapada = (citasDelDia ?? []).some(c => {
          if (c.profesional_id !== prof.id) return false
          const cStart = new Date(c.fecha_inicio)
          const cEnd   = new Date(c.fecha_fin ?? new Date(cStart.getTime() + 30 * 60_000))
          return slotStart < cEnd && slotEnd > cStart
        })

        if (!solapada) {
          slotsLibres.push({
            hora: horaBogota(slotStart.toISOString()),
            profesional: prof.nombre,
            profesional_id: prof.id,
            fecha_hora: slotStart.toISOString(),
          })
        }
      }
    }
  }

  if (!slotsLibres.length) {
    return { disponible: false, message: `No hay horarios disponibles para el ${fecha}.` }
  }

  // Return at most 10 slots to keep context short
  return { disponible: true, fecha, slots: slotsLibres.slice(0, 10) }
}

async function registrarCita(
  tenantId: string,
  clienteTelefono: string,
  clienteNombre: string,
  servicioId: string,
  profesionalId: string,
  fechaHora: string,
) {
  // Upsert client by phone
  const telefonoLocal = localPhone(clienteTelefono)
  let clienteId: string

  const { data: existing } = await db
    .from('clientes_agenda')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('telefono', telefonoLocal)
    .maybeSingle()

  if (existing) {
    clienteId = existing.id
  } else {
    const { data: nuevo, error } = await db
      .from('clientes_agenda')
      .insert({ tenant_id: tenantId, nombre: clienteNombre, telefono: telefonoLocal })
      .select('id')
      .single()
    if (error || !nuevo) return { ok: false, error: 'No se pudo registrar el cliente.' }
    clienteId = nuevo.id
  }

  // Get service duration for fecha_fin
  const { data: serv } = await db.from('servicios').select('duracion_min, nombre, precio').eq('id', servicioId).single()
  const durMin  = serv?.duracion_min ?? 30
  const fechaFin = new Date(new Date(fechaHora).getTime() + durMin * 60_000).toISOString()

  const { error: citaErr } = await db.from('citas').insert({
    tenant_id:        tenantId,
    cliente_agenda_id: clienteId,
    profesional_id:   profesionalId,
    servicio_id:      servicioId,
    fecha_inicio:     fechaHora,
    fecha_fin:        fechaFin,
    estado:           'confirmada',
    fuente:           'agente_wa',
  })

  if (citaErr) {
    console.error('cita insert error:', citaErr)
    return { ok: false, error: 'No se pudo agendar. El horario puede estar ocupado.' }
  }

  return {
    ok: true,
    resumen: `${serv?.nombre ?? 'Servicio'} — ${horaBogota(fechaHora)}`,
    fecha: fechaHora.slice(0, 10),
  }
}

// ── Tool definitions for Claude ────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'listar_servicios',
    description: 'Lista todos los servicios disponibles del salón con sus precios y duración.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'verificar_disponibilidad',
    description: 'Muestra los horarios libres para una fecha específica. Usa formato YYYY-MM-DD.',
    input_schema: {
      type: 'object',
      properties: {
        fecha:       { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
        servicio_id: { type: 'string', description: 'ID del servicio (opcional)' },
      },
      required: ['fecha'],
    },
  },
  {
    name: 'registrar_cita',
    description: 'Crea una cita una vez el cliente ha elegido servicio, profesional y horario.',
    input_schema: {
      type: 'object',
      properties: {
        servicio_id:    { type: 'string' },
        profesional_id: { type: 'string' },
        fecha_hora:     { type: 'string', description: 'ISO 8601, ej: 2025-06-10T10:00:00' },
        nombre_cliente: { type: 'string' },
      },
      required: ['servicio_id', 'profesional_id', 'fecha_hora', 'nombre_cliente'],
    },
  },
  {
    name: 'transferir_a_humano',
    description: 'Cuando el cliente pide hablar con una persona real o hay una situación que el agente no puede resolver.',
    input_schema: {
      type: 'object',
      properties: { motivo: { type: 'string' } },
      required: [],
    },
  },
]

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  if (!ANTHROPIC_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada en el servidor' }),
      { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const url = new URL(req.url)
    const tenantId = url.searchParams.get('t')
    if (!tenantId) {
      return new Response('Missing tenant', { status: 400 })
    }

    // Load tenant & verify agent is active (token vive en wa_config, no en tenants)
    const { data: tenant } = await db
      .from('tenants')
      .select('id, nombre, direccion, wa_agente_activo, wa_agente_nombre, wa_agente_saludo, config_vertical')
      .eq('id', tenantId)
      .eq('activo', true)
      .single()

    if (!tenant?.wa_agente_activo) {
      return new Response('Agent not active', { status: 200 }) // 200 to silence Whapi retries
    }

    // Read the third-party token only on the server (service_role)
    const { data: waCfg } = await db
      .from('wa_config')
      .select('whapi_token')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const whapiToken = waCfg?.whapi_token
    if (!whapiToken) {
      return new Response('Agent not configured', { status: 200 })
    }

    // Parse webhook from Whapi.cloud
    const body = await req.json().catch(() => null)
    if (!body?.messages?.length) return new Response('ok', { status: 200 })

    const msg = body.messages[0]
    if (msg.type !== 'text' || !msg.text?.body) return new Response('ok', { status: 200 })
    if (msg.from_me) return new Response('ok', { status: 200 }) // ignore own messages

    const rawFrom  = msg.from as string
    const fromNum  = normalPhone(rawFrom)
    const fromName = (msg.from_name as string | undefined) || 'cliente'
    const textoEntrante = (msg.text.body as string).trim()

    // Load or create conversation
    const { data: conv } = await db
      .from('wa_conversaciones')
      .select('id, mensajes, handoff_humano, ultima_actividad, cliente_nombre')
      .eq('tenant_id', tenantId)
      .eq('cliente_telefono', fromNum)
      .maybeSingle()

    // If handoff active, ignore
    if (conv?.handoff_humano) return new Response('ok', { status: 200 })

    // Reset conversation if >4h inactive
    const INACTIVIDAD_MS = 4 * 60 * 60 * 1000
    const ultimaActividad = conv?.ultima_actividad ? new Date(conv.ultima_actividad).getTime() : 0
    const reset = conv && (Date.now() - ultimaActividad) > INACTIVIDAD_MS

    let historial: Array<{ role: 'user' | 'assistant'; content: string }> =
      (!conv || reset) ? [] : (conv.mensajes ?? [])

    // Add incoming message
    historial.push({ role: 'user', content: textoEntrante })

    // Keep only last 20 messages
    if (historial.length > 20) historial = historial.slice(-20)

    // Build system prompt
    const nombreAgente = tenant.wa_agente_nombre || 'Asistente'
    const nombreSalon  = tenant.nombre || 'el salón'
    const saludo       = tenant.wa_agente_saludo
      || `Hola, soy ${nombreAgente} de ${nombreSalon}. ¿En qué te puedo ayudar hoy?`

    const systemPrompt = [
      `Eres ${nombreAgente}, el asistente virtual de ${nombreSalon}.`,
      `Tu rol: responder preguntas, mostrar disponibilidad y agendar citas.`,
      `Reglas: responde en español, máximo 4 líneas por mensaje, sin markdown (*/#), tono amable y directo.`,
      `Si el cliente quiere agendar, primero pregunta qué servicio quiere, luego pide la fecha y muestra horarios disponibles.`,
      `Fecha de hoy: ${fechaBogota()}. Mañana: ${fechaBogota(86400_000)}.`,
      `Teléfono del cliente: ${fromNum}. Nombre: ${fromName}.`,
    ].join('\n')

    // If new conversation, prepend greeting as assistant message
    const mensajesParaClaude: Array<{ role: 'user' | 'assistant'; content: string }> =
      (historial.length === 1 && !reset)
        ? [{ role: 'user', content: `[inicio de conversación]\n${textoEntrante}` }]
        : historial

    // Agentic loop with tools
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })
    let respuestaFinal = ''
    let handoff = false

    let messages = mensajesParaClaude.map(m => ({ role: m.role, content: m.content }))

    for (let turn = 0; turn < 5; turn++) {
      const resp = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system:     systemPrompt,
        tools:      TOOLS,
        messages,
      })

      if (resp.stop_reason === 'end_turn') {
        const textBlock = resp.content.find(b => b.type === 'text')
        respuestaFinal = textBlock ? (textBlock as Anthropic.TextBlock).text : saludo
        break
      }

      if (resp.stop_reason === 'tool_use') {
        // Execute all tool calls
        const toolResults: Anthropic.MessageParam = { role: 'user', content: [] }

        for (const block of resp.content) {
          if (block.type !== 'tool_use') continue

          const toolInput = block.input as Record<string, string>
          let result: unknown

          if (block.name === 'listar_servicios') {
            result = await listarServicios(tenantId)

          } else if (block.name === 'verificar_disponibilidad') {
            result = await verificarDisponibilidad(tenantId, toolInput.fecha, toolInput.servicio_id)

          } else if (block.name === 'registrar_cita') {
            result = await registrarCita(
              tenantId,
              fromNum,
              toolInput.nombre_cliente || fromName,
              toolInput.servicio_id,
              toolInput.profesional_id,
              toolInput.fecha_hora,
            )

          } else if (block.name === 'transferir_a_humano') {
            handoff = true
            result = { ok: true }

          } else {
            result = { error: 'Herramienta desconocida' }
          }

          ;(toolResults.content as Anthropic.ToolResultBlockParam[]).push({
            type:        'tool_result',
            tool_use_id: block.id,
            content:     JSON.stringify(result),
          })
        }

        messages = [
          ...messages,
          { role: 'assistant', content: resp.content },
          toolResults,
        ]
        continue
      }

      // Unexpected stop
      break
    }

    if (!respuestaFinal) respuestaFinal = saludo

    // Update conversation in DB
    historial.push({ role: 'assistant', content: respuestaFinal })
    if (historial.length > 20) historial = historial.slice(-20)

    const convUpdate = {
      tenant_id:        tenantId,
      cliente_telefono: fromNum,
      cliente_nombre:   fromName,
      mensajes:         historial,
      ultima_actividad: new Date().toISOString(),
      handoff_humano:   handoff,
    }

    await db.from('wa_conversaciones').upsert(convUpdate, {
      onConflict: 'tenant_id,cliente_telefono',
    })

    // Send response via Whapi.cloud
    const toAddress = rawFrom.includes('@') ? rawFrom : `${fromNum}@s.whatsapp.net`
    await sendWhapi(whapiToken, toAddress, respuestaFinal)

    // If handoff: notify the salon's own WhatsApp (if configured)
    if (handoff && tenant.config_vertical?.telefono_negocio) {
      const aviso = `🤖 El cliente ${fromName} (${localPhone(fromNum)}) pidió hablar con una persona real.`
      await sendWhapi(whapiToken, `57${tenant.config_vertical.telefono_negocio}@s.whatsapp.net`, aviso)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('whatsapp-agent error:', e)
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
