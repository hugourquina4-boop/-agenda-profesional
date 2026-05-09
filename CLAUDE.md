# Salón Pro SaaS — Plan Estratégico y Base de Progresión

> Archivo de control para Claude Code. Actualizar al completar cada módulo.
> Stack: React 19 + Vite + Supabase (unpxoamfyushsbyyziyn) + Vercel
> URL prod: https://project-gnyy8.vercel.app
> Superadmin panel: https://project-gnyy8.vercel.app/superadmin.html
> Actualizado: 2026-05-09
> **Versión actual en producción: v1.1** (tag git: v1.1)

---

## Arquitectura Multi-Tenant — Reglas Fundamentales

Cada negocio (tenant) es **completamente independiente**: equipo, servicios, clientes, caja, comisiones, inventario, configuración y claves de acceso son propios y no se comparten entre negocios.

### Jerarquía de roles

| Rol | Quién | Acceso |
|-----|-------|--------|
| `superadmin` | Hugo Urquina (hugourquina@gmail.com) | Todos los negocios, panel maestro, facturación, creación de tenants |
| `admin` | Dueño del negocio | Todo dentro de su negocio: equipo, config, analytics, accesos, comisiones, caja |
| `contable` | Contador del negocio | Caja, comisiones, analytics, inventario, gastos — sin config ni accesos |
| `recepcion` | Recepcionista | Agenda, clientes, servicios, órdenes en espera |
| `profesional` | Trabajador | Solo su propia agenda, clientes asignados, servicios |

### Flujo de login

1. Usuario abre `/salon` → ve lista de negocios (buscador + selector)
2. Elige negocio → URL se actualiza a `?tenant=slug`
3. Ingresa email + clave → Supabase Auth
4. `tenants_del_usuario()` retorna sus negocios; se carga el que coincide con el slug de URL
5. Si superadmin: ve todos los negocios, puede cambiar entre ellos

### Regla crítica de aislamiento

Toda query SIEMPRE lleva `.eq('tenant_id', tenant.id)`. Sin excepción. El `tenant.id` viene de `TenantContext` y es el UUID del negocio activo.

---

## Estado del Sistema — v1.1 (producción)

### ✅ MÓDULOS COMPLETOS Y EN PRODUCCIÓN

| Módulo | Archivo | Descripción |
|--------|---------|-------------|
| Auth — Login selector de salón | SalonLogin.jsx | Selector multi-salón con búsqueda, URL slug actualizada al elegir |
| Auth — TenantContext multi-tenant | TenantContext.jsx | URL slug > localStorage > lista[0] para selección de tenant |
| Auth — Accesos y gestión de usuarios | SalonAccesos.jsx | Crear usuarios, reset clave, cambiar rol, suspender. Oculta superadmin. |
| Panel Maestro Superadmin (standalone) | public/superadmin.html | SHA-256 HFURQUINA12, gestión negocios, reset claves, pagos, sin React |
| Dashboard hoy | SalonDashboard.jsx | Timeline, stats ingresos, equipo libre/ocupado, alerta stock, onboarding |
| Agenda Mes / Semana / Día | SalonAgenda.jsx | Toggle 3 vistas, grid por profesional, bloques proporcionales, pago inline |
| Nueva cita (5 pasos) | SalonNuevaCita.jsx | Horarios, slots, anti-solapamiento, WA confirmación al crear |
| Portal público | SalonPortal.jsx | Reservas online, precios dinámicos, lista de espera, WA confirmación |
| Servicios CRUD | SalonServicios.jsx | Precio, duración, categoría — independiente por tenant |
| Equipo CRUD + horarios táctiles + calendario excepciones | SalonEquipo.jsx | HorarioGrid drag-to-select, MiniCalendar visual para excepciones por fecha (verde=especial, rojo=ausente) |
| HorarioGrid (componente reutilizable) | components/HorarioGrid.jsx | Drag-to-select táctil, pointer capture, exports: rangeToSlots, slotsToRange, slotsToFranjas |
| Clientes CRUD + historial + fotos | SalonClientes.jsx | Cumpleaños, segmento, historial, galería, CSV export + import |
| Caja — Registro de cobros | SalonCaja.jsx | Tabla pagos, tabs Por cobrar/Cobrado, métodos pago, PDF export |
| Comisiones — Reglas + liquidación | SalonComisiones.jsx | % por profesional, meta mensual, liquidación PDF individual |
| Órdenes en espera | SalonOrdenes.jsx | Grid tarjetas, nueva orden, cobrar → pagos → comisión |
| Inventario de productos | SalonInventario.jsx | CRUD + CSV import (preview → upsert por SKU), subcategoria/marca/codigo/contenido/proveedor |
| Analytics — KPIs y métricas | SalonAnalytics.jsx | v_kpis_mes, v_revenue_staff, v_retention, gráficos, PDF export |
| Configuración del negocio | SalonConfig.jsx | Logo, color, WhatsApp, tipología, horario, slots, QR, plan |
| Superadmin React (dentro del app) | SalonSuperadmin.jsx | Vista interna para Hugo: MRR/ARR, crear negocio con datos de contacto completos |
| ErrorBoundary — auto-reload chunks | components/ErrorBoundary.jsx | Detecta chunk 404 post-deploy → window.location.reload() automático |
| Service Worker | public/sw.js | Versión v3, excluye /assets/ (hashes) del caché para evitar chunks rancios |

### ✅ EDGE FUNCTIONS OPERATIVAS

| Función | Cuándo invocar | Qué hace |
|---------|---------------|----------|
| `notificacion-cita` | Al crear cita | WA al cliente + WA al salón |
| `notificacion-recordatorio` | Cron cada hora | WA 24h antes + 1h antes |
| `cumpleanos-clientes` | Cron diario 9am | WA de cumpleaños |
| `resumen-diario` | Cron diario 9pm | WA al dueño con resumen |
| `admin-crear-usuario` | SalonAccesos + Superadmin | Crea usuario Supabase Auth sin afectar sesión |
| `admin-reset-password` | SalonAccesos | Resetea contraseña vía email |

### ✅ SQL APLICADO EN SUPABASE (v1.1 — todos al día)

```
SALON_SETUP_COMPLETO.sql    ✅ Schema base
v9–v35                      ✅ Todos aplicados
v36_eliminar_dev_policies   ✅ Elimina políticas dev_* cross-tenant
v37_salon_superadmin.sql    ✅ SHA-256 admin, SECURITY DEFINER RPCs:
                               salon_verificar_admin, salon_admin_reset_password,
                               salon_admin_get_tenants, salon_admin_set_activo,
                               salon_admin_set_plan, salon_admin_get_users
v38_permisos_rol.sql        ✅ tabla permisos_tenant + RPCs:
                               salon_seed_permisos, get_permisos_tenant, set_permiso_tenant
v39_horarios_flexibles.sql  ✅ tabla horarios_excepcion + RPCs:
                               get_disponibilidad_dia, get_excepciones_mes
v40_superadmin_fixes.sql    ✅ fix crear_negocio + superadmin_tenants_info + Hugo vinculado
v41_inventario_enhanced.sql ✅ subcategoria, marca, codigo, contenido, proveedor en productos_salon
v42_fix_superadmin_info.sql ✅ APLICADO — columnas contacto en tenants (nombre_representante,
                               foto_representante, pagina_web, instagram, admin_email),
                               crear_negocio con 11 parámetros, Hugo re-vinculado a todos los tenants
```

---

## 🚨 Pendientes Críticos (bloquean venta)

### 1. Control de acceso por rol en UI — URGENTE
La tabla `permisos_tenant` ya existe en BD (v38 aplicado). Falta conectarla en el frontend.

**Lo que falta:**
- `SalonLayout.jsx`: leer `get_permisos_tenant(tenant_id)` al cargar sesión → filtrar sidebar según rol
- `SalonAccesos.jsx` o `SalonConfig.jsx`: UI para que el admin configure qué módulos ve cada rol

**Tabla de permisos por rol (referencia):**

| Módulo | admin | contable | recepcion | profesional |
|--------|-------|----------|-----------|-------------|
| Inicio/Dashboard | ✅ | ✅ | ✅ | ✅ |
| Agenda | ✅ | ❌ | ✅ | ✅ (solo propia) |
| Clientes | ✅ | ❌ | ✅ | ✅ |
| Servicios | ✅ | ❌ | ✅ | ✅ |
| Órdenes en espera | ✅ | ❌ | ✅ | ✅ |
| Caja | ✅ | ✅ | ❌ | ❌ |
| Comisiones | ✅ | ✅ | ❌ | ❌ |
| Inventario | ✅ | ✅ | ❌ | ❌ |
| Analytics | ✅ | ✅ | ❌ | ❌ |
| Gastos / Proveedores | ✅ | ✅ | ❌ | ❌ |
| Equipo | ✅ | ❌ | ❌ | ❌ |
| Accesos | ✅ | ❌ | ❌ | ❌ |
| Configuración | ✅ | ❌ | ❌ | ❌ |
| Bóveda | ✅ | ❌ | ❌ | ❌ |
| WhatsApp Bot | ✅ | ❌ | ❌ | ❌ |

### 2. Deploy Edge Functions pendientes
```bash
npx supabase functions deploy cumpleanos-clientes resumen-diario
```

### 3. Activar Supabase Schedules (4 crons)
Ver sección Automatizaciones en SalonConfig para los horarios exactos.

---

## 🔷 Módulos v1.2 — En Construcción

### MÓDULO A: Proveedores y Gastos
**Archivo:** `SalonGastos.jsx`
**SQL:** `v43_proveedores_gastos.sql`

**Tablas necesarias:**
```sql
-- proveedores: directorio de proveedores por negocio
CREATE TABLE proveedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nombre TEXT NOT NULL,
  contacto TEXT,               -- nombre del contacto en el proveedor
  telefono TEXT,
  email TEXT,
  categoria TEXT,              -- insumos, servicios, tecnologia, arriendo, nomina, otro
  nit TEXT,                    -- NIT para Colombia
  direccion TEXT,
  notas TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- gastos: registro de todos los egresos del negocio
CREATE TABLE gastos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  proveedor_id UUID REFERENCES proveedores(id),   -- opcional
  concepto TEXT NOT NULL,
  categoria TEXT NOT NULL,     -- arriendo, servicios_publicos, insumos, nomina, marketing, mantenimiento, otro
  monto NUMERIC(12,2) NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago TEXT DEFAULT 'transferencia',        -- efectivo, transferencia, tarjeta, cheque
  comprobante_url TEXT,        -- foto/PDF del comprobante (Storage)
  estado TEXT DEFAULT 'pagado',                   -- pagado, pendiente, vencido
  fecha_vencimiento DATE,      -- para gastos periódicos con fecha de pago
  recurrente BOOLEAN DEFAULT false,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Funcionalidades UI:**
- Lista de proveedores con CRUD (nombre, contacto, categoría, NIT)
- Registro de gastos con: concepto, categoría, monto, proveedor (opcional), foto comprobante
- Vista de gastos por mes con totales por categoría
- Gastos pendientes de pago (vencidos destacados en rojo)
- Comparativa ingresos vs gastos (utilidad bruta del mes)
- Export PDF de gastos del mes
- Permisos: admin + contable

**SQL próximo:** `v43_proveedores_gastos.sql`

---

### MÓDULO B: WhatsApp Bot por Negocio
**Archivo:** `SalonWhatsApp.jsx`
**SQL:** `v44_whatsapp_bot.sql`
**Edge Functions:** `wa-webhook-tenant`, `wa-bot-reply`

**Arquitectura:**
Cada negocio tiene su propio número de WhatsApp conectado vía Whapi.cloud (o Meta Cloud API). El bot responde automáticamente y se configura desde el panel.

**Tablas necesarias:**
```sql
-- Configuración WA por negocio
CREATE TABLE whatsapp_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id),
  proveedor TEXT DEFAULT 'whapi',   -- whapi | meta
  token TEXT,                        -- API token del número (cifrado o via Vault)
  numero TEXT,                       -- +57300XXXXXXX
  webhook_secret TEXT,
  bot_activo BOOLEAN DEFAULT false,
  horario_bot_inicio TIME DEFAULT '07:00',
  horario_bot_fin TIME DEFAULT '22:00',
  fuera_horario_msg TEXT DEFAULT 'Hola, estamos fuera de horario. Atendemos de 7am a 10pm.',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plantillas de mensajes editables por el negocio
CREATE TABLE wa_plantillas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  clave TEXT NOT NULL,              -- confirmacion_cita | recordatorio_24h | recordatorio_1h | cumpleanos | resumen_dia
  activa BOOLEAN DEFAULT true,
  mensaje TEXT NOT NULL,            -- con variables: {{nombre}}, {{servicio}}, {{fecha}}, {{hora}}, {{profesional}}
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, clave)
);

-- Historial de mensajes enviados (para métricas)
CREATE TABLE wa_mensajes_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  tipo TEXT NOT NULL,               -- confirmacion | recordatorio | cumpleanos | resumen | bot_reply | manual
  destinatario TEXT NOT NULL,       -- número del cliente
  mensaje TEXT,
  estado TEXT DEFAULT 'enviado',    -- enviado | fallido | pendiente
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Funcionalidades UI:**
- Panel de conexión: vincular número de WhatsApp (token Whapi o Meta)
- Test de conexión (enviar mensaje de prueba)
- Editor de plantillas para cada tipo de mensaje con variables disponibles
- Toggle bot activo/inactivo con horario de atención
- Mensaje de fuera de horario configurable
- Respuestas automáticas: horarios del negocio, precios, cómo reservar (configurable)
- Historial de mensajes del mes con estado (enviado / fallido)
- Métricas: mensajes enviados por tipo, tasa de entrega

**Flujo del bot:**
1. Cliente envía WA al número del negocio
2. Webhook llega a Edge Function `wa-webhook-tenant` → identifica tenant por número
3. Si bot activo y en horario → `wa-bot-reply` analiza intent y responde con plantilla
4. Si fuera de horario → mensaje configurado de fuera de horario
5. Log guardado en `wa_mensajes_log`

**SQL próximo:** `v44_whatsapp_bot.sql`

---

### MÓDULO C: Bóveda de Accesos y Contraseñas
**Archivo:** `SalonBoveda.jsx`
**SQL:** `v45_boveda_accesos.sql`

**Seguridad:** Las contraseñas NUNCA se guardan en texto plano. Se cifran en el cliente con Web Crypto API (AES-GCM) antes de ir a Supabase. La clave de descifrado se deriva de la contraseña de sesión del admin + salt del negocio. Supabase solo almacena el blob cifrado.

**Tabla necesaria:**
```sql
CREATE TABLE boveda_accesos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nombre TEXT NOT NULL,            -- "Instagram del negocio", "Google My Business"
  url TEXT,
  usuario TEXT,
  clave_cifrada TEXT,              -- AES-GCM cifrado en cliente antes de INSERT
  iv TEXT,                         -- initialization vector de AES-GCM (no secreto)
  categoria TEXT DEFAULT 'otro',   -- redes_sociales | pagos | proveedores | plataformas | email | otro
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Funcionalidades UI:**
- Lista de accesos por categoría (redes sociales, pagos, plataformas, proveedores, etc.)
- Agregar acceso: nombre, URL, usuario, contraseña (se cifra en browser antes de guardar)
- Ver contraseña: descifra en browser, botón copiar, se oculta tras 30 segundos
- Clave maestra de la bóveda: el admin crea una clave maestra al activar (solo él la conoce)
- Si se olvida la clave maestra: los accesos cifrados se pierden (no hay recuperación — es el precio de la seguridad real)
- Búsqueda por nombre o categoría
- Export cifrado (para backup)
- Solo acceso: rol `admin`

**SQL próximo:** `v45_boveda_accesos.sql`

---

## Dos Paneles de Hugo — DISTINCIÓN CRÍTICA

### Panel 1: superadmin.html (monitoreo, sin React)
**URL**: https://project-gnyy8.vercel.app/superadmin.html
**Clave**: `HFURQUINA12` (SHA-256 en browser, verificado via RPC SECURITY DEFINER)
**Propósito**: **Monitoreo** — revisar negocios vinculados, estado activo/inactivo, plan contratado, métricas.

**Funciones disponibles:**
- Ver todos los negocios con métricas (citas, clientes, profesionales)
- Activar / Suspender negocio
- Cambiar plan y fecha de vencimiento
- Reset de clave de cualquier usuario por email
- Ver todos los usuarios de la plataforma
- Registrar pagos de suscripción

### Panel 2: Módulo Superadmin dentro de /salon (React, solo Hugo)
**URL**: https://project-gnyy8.vercel.app/salon → módulo "Plataforma" en el sidebar
**Acceso**: Solo usuarios con `rol = 'superadmin'` — completamente oculto para dueños de negocios.
**Propósito**: **Gestión operativa** — crear negocios nuevos, vincular dueños, asignar credenciales, contratos/planes, verificar pagos.

**Funciones:**
- Crear nuevo negocio con datos de contacto completos (representante, teléfono, dirección, web, instagram)
- Identificar y vincular al dueño del negocio
- Asignar plan contratado y fecha de vigencia
- Verificar y registrar pagos de suscripción
- MRR / ARR de la plataforma

### Flujo para nuevo negocio

1. Hugo entra a `/salon` → módulo "Plataforma" (Superadmin React)
2. Crea negocio: nombre, slug, vertical, plan, contacto, email admin, clave temporal
3. Admin recibe email + clave temporal
4. Admin entra a `/salon?tenant=slug` → configura servicios, equipo, horarios
5. Trabajadores reciben acceso desde módulo `Accesos` del panel

---

## Decisiones Técnicas (No cambiar sin justificación)

### Auth

- **Clave maestra Hugo**: SHA-256('HFURQUINA12') — acceso a panel standalone y a todos los tenants como superadmin
- **Crear usuarios nuevos**: Edge Function `admin-crear-usuario` (x-admin-secret: salonpro2026)
- **Reset clave dentro de plataforma**: `salon_admin_reset_password` RPC (SECURITY DEFINER, extensions schema para gen_salt)
- **Recovery email**: `supabase.auth.resetPasswordForEmail` → redirige a `/salon` → handler PASSWORD_RECOVERY en TenantContext
- **Superadmin acceso total**: `tenants_del_usuario()` retorna ALL tenants si rol='superadmin'. `crear_negocio()` auto-inserta a Hugo en `usuarios_tenant` del nuevo tenant.

### Datos y Seguridad

- **RLS activo en todas las tablas** — siempre con tenant_id
- **`service_role` key nunca en frontend** — solo Edge Functions o SECURITY DEFINER
- **confirmed_at** es columna generada — actualizar solo `email_confirmed_at`
- **pgcrypto** en Supabase vive en schema `extensions` — search_path debe incluirlo
- **Superadmin oculto en Accesos**: filtrar `rol !== 'superadmin'` en SalonAccesos
- **usuarios_tenant tiene NOT NULL**: nombre y email obligatorios — siempre incluirlos en INSERT
- **Bóveda cifrada**: clave_cifrada en boveda_accesos es AES-GCM cifrado en cliente. Supabase nunca ve la contraseña en claro. La clave de descifrado NUNCA se guarda en BD.
- **WA tokens**: los tokens de API de WhatsApp por negocio son sensibles — considerar Supabase Vault para almacenamiento o cifrado equivalente al de bóveda.

### UI

- **Inline CSS**: no Tailwind en componentes salon/ — variables `var(--bg)`, `var(--card)`, `var(--text)`, `var(--text-2)`, `var(--text-3)`, `var(--border)`, `var(--accent)`
- **URL slug**: `SalonLogin.elegirSalon()` y `TenantPicker` siempre actualizan `?tenant=slug` en URL
- **Code splitting**: lazy imports con Suspense + ErrorBoundary en todos los módulos
- **Chunk errors post-deploy**: ErrorBoundary.componentDidCatch + main.jsx vite:preloadError → ambos llaman window.location.reload(). SW excluye /assets/ del caché.
- **HorarioGrid**: componente táctil reutilizable en `src/components/HorarioGrid.jsx`. Usa `setPointerCapture` + `document.elementFromPoint`. Exporta helpers de conversión de slots.
- **MiniCalendar**: componente inline en SalonEquipo.jsx. Tappable, verde=horario especial, rojo=ausente, borde accent=hoy.
- **sp-sheet**: `position:fixed; bottom:0; max-height:90dvh; overflow-y:auto; overscroll-behavior:contain` — soporta scroll interno en mobile.

### Schema crítico: usuarios_tenant

```
id UUID PK
tenant_id UUID NOT NULL
user_id UUID NOT NULL
rol TEXT CHECK IN ('superadmin','admin','contable','recepcion','profesional')
nombre TEXT NOT NULL
email TEXT NOT NULL
activo BOOLEAN
UNIQUE (tenant_id, user_id)
```

### Schema crítico: tenants (v42)

```
id UUID PK
nombre TEXT, slug TEXT UNIQUE, ciudad TEXT, vertical TEXT
plan TEXT, color_primario TEXT, activo BOOLEAN
admin_email TEXT, nombre_representante TEXT, foto_representante TEXT
pagina_web TEXT, instagram TEXT, telefono TEXT, direccion TEXT
created_at TIMESTAMPTZ
```

### Schema crítico: productos_salon (v41)

```
id, tenant_id, nombre, categoria, subcategoria, marca, codigo (SKU),
contenido NUMERIC, unidad, proveedor, precio_venta, precio_costo,
stock, stock_minimo, notas, activo, created_at
UNIQUE INDEX (tenant_id, codigo) WHERE codigo IS NOT NULL AND codigo <> ''
```

---

## Roadmap de Versiones

| Versión | Estado | Contenido |
|---------|--------|-----------|
| **v1.1** | ✅ En producción (tag git: v1.1) | 17 módulos: agenda, equipo, inventario, analytics, superadmin, WA automático, multi-tenant RLS completo |
| **v1.2** | 🔷 En construcción | Proveedores + Gastos (v43), WhatsApp Bot por negocio (v44), Bóveda de accesos (v45) |
| **v1.3** | 📋 Planificado | Control de acceso por rol en UI, billing automático (Wompi), pagos en línea desde portal público |
| **v2.0** | 📋 Futuro | Vertical psicología/salud (historial clínico, consentimientos, cuestionarios integrados), App nativa PWA en tiendas |

---

## Protocolo de Trabajo con Claude — OBLIGATORIO

```
Contexto: Salón Pro SaaS v1.2. Quiero trabajar en [módulo].
Estado: [lo que está pendiente según este CLAUDE.md]
```

### Antes de iniciar cualquier módulo
1. Leer: `TenantContext.jsx`, el módulo a modificar, y este CLAUDE.md
2. Para SQL nuevo: archivo `vXX_nombre.sql` con RLS + tenant_id + GRANT mínimos
3. Para UI: React + inline CSS, variables salon.css, código splitting con lazy import
4. Para deploy: `git push` → Vercel auto-despliega
5. Para Edge Functions: `npx supabase functions deploy <nombre>`

### Reglas que nunca se rompen
- Nunca omitir `.eq('tenant_id', tenant.id)` en queries
- Nunca poner `service_role` en frontend
- Nunca guardar contraseñas en texto plano (bóveda: cifrar en cliente)
- Nunca guardar tokens de API de WA en frontend — solo en Edge Function environment o Supabase Vault
- `get_excepciones_mes` RPC no retorna `id` — usar query directa a `horarios_excepcion` si necesitas el id
- Al crear cualquier tabla nueva: RLS habilitado + política tenant_id + GRANT específico

### SQL próximo (v1.2)
```
v43_proveedores_gastos.sql    → tablas: proveedores, gastos + RLS + índices
v44_whatsapp_bot.sql          → tablas: whatsapp_config, wa_plantillas, wa_mensajes_log + RLS
v45_boveda_accesos.sql        → tabla: boveda_accesos + RLS (solo admin) + función cifrado check
```

---

## Contexto de Negocio

- **Hugo Urquina** (hugourquina@gmail.com) = Superadmin de toda la plataforma
- **Negocios activos en v1.1**: glamour-studio, estetica-jess
- **Modelo**: SaaS B2B para negocios de citas (belleza, bienestar, salud no-clínica)
- **Competencia**: WeiBook (weibook.co)
- **Planes**: starter $49K · pro $89K · ultra $149K COP/mes
- **Meta**: 5 negocios pagando antes de construir v1.3
