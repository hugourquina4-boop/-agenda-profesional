# Salón Pro SaaS — Plan Estratégico y Base de Progresión

> Archivo de control para Claude Code. Actualizar al completar cada módulo.
> Stack: React 19 + Vite + Supabase (unpxoamfyushsbyyziyn) + Vercel
> URL prod: https://project-gnyy8.vercel.app
> Superadmin panel: https://project-gnyy8.vercel.app/superadmin.html
> Actualizado: 2026-05-16 (sesión 2)
> **Versión actual en producción: v1.3-dev** (sin tag aún)

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

## Estado del Sistema — v1.2 (producción)

### ✅ MÓDULOS COMPLETOS Y EN PRODUCCIÓN

| Módulo | Archivo | Descripción |
|--------|---------|-------------|
| Auth — Login selector de salón | SalonLogin.jsx | Selector multi-salón con búsqueda, URL slug actualizada al elegir |
| Auth — TenantContext multi-tenant | TenantContext.jsx | URL slug > localStorage > lista[0]; `tieneAcceso()` filtra nav por rol y permisos de BD |
| Auth — Accesos y gestión de usuarios | SalonAccesos.jsx | Crear usuarios (RPC `crear_acceso_tenant`), reset clave (RPC `resetear_clave_tenant`), cambiar rol, suspender. Oculta superadmin. |
| Panel Maestro Superadmin (standalone) | public/superadmin.html | SHA-256 HFURQUINA12, gestión negocios, reset claves, pagos, sin React |
| Panel Suscripción (React, solo Hugo) | SalonSuperadmin.jsx | 5 KPIs (Total/Activos/Suspendidos/CitasHoy/MRR), 4 tabs (Negocios/Accesos/Pagos/Usuarios), Mi acceso maestro, soft delete negocios |
| Dashboard hoy | SalonDashboard.jsx | Timeline, stats ingresos, equipo libre/ocupado, alerta stock, onboarding |
| Agenda Mes / Semana / Día | SalonAgenda.jsx | Toggle 3 vistas, grid por profesional, bloques proporcionales, pago inline |
| Nueva cita (5 pasos) | SalonNuevaCita.jsx | Horarios, slots, anti-solapamiento, WA confirmación al crear |
| Portal público | SalonPortal.jsx | Reservas online, precios dinámicos, lista de espera, WA confirmación |
| Servicios CRUD | SalonServicios.jsx | 4 tabs: Detalles, Precio (base+oferta+duración), Equipo (profesionales asignados), Recordatorio (template WA con preview) |
| Equipo CRUD + horarios táctiles + calendario excepciones | SalonEquipo.jsx | HorarioGrid drag-to-select, MiniCalendar visual para excepciones por fecha (verde=especial, rojo=ausente) |
| HorarioGrid (componente reutilizable) | components/HorarioGrid.jsx | Drag-to-select táctil, pointer capture, exports: rangeToSlots, slotsToRange, slotsToFranjas |
| Clientes CRUD + historial + fotos | SalonClientes.jsx | Cumpleaños, segmento, historial, galería, CSV export + import, tipo_precio (Normal/Mayorista), badge MAYOR en lista, toggle rápido en detalle |
| Caja — Registro de cobros | SalonCaja.jsx | Tabla pagos, tabs Por cobrar/Cobrado, métodos pago, PDF export, breakdown por método, anulación, # movimiento, especialista en historial |
| Comisiones — Reglas + liquidación | SalonComisiones.jsx | % por profesional, meta mensual, liquidación PDF individual, tab Planilla con anticipos/deducciones/neto |
| Órdenes en espera | SalonOrdenes.jsx | Grid tarjetas 2 col, nueva orden, editar orden (modal), cobrar → pagos → comisión |
| Inventario de productos | SalonInventario.jsx | CRUD + CSV import (preview → upsert por SKU), subcategoria/marca/codigo/contenido/proveedor |
| Analytics — KPIs y métricas | SalonAnalytics.jsx | v_kpis_mes, v_revenue_staff, v_retention, gráficos, PDF export |
| Configuración del negocio | SalonConfig.jsx | Logo, color, WhatsApp, tipología, horario, slots, QR, plan |
| ErrorBoundary — auto-reload chunks | components/ErrorBoundary.jsx | Detecta chunk 404 post-deploy → window.location.reload() automático |
| Service Worker | public/sw.js | Versión v3, network-first, excluye /assets/ (hashes) del caché |

### ✅ EDGE FUNCTIONS OPERATIVAS

| Función | Cuándo invocar | Qué hace |
|---------|---------------|----------|
| `notificacion-cita` | Al crear cita | WA al cliente + WA al salón |
| `notificacion-recordatorio` | Cron cada hora | WA 24h antes + 1h antes |
| `cumpleanos-clientes` | Cron diario 9am | WA de cumpleaños |
| `resumen-diario` | Cron diario 9pm | WA al dueño con resumen |

**Nota:** `admin-crear-usuario` y `admin-reset-password` fueron reemplazados por RPCs SECURITY DEFINER en v1.2 (`salon_admin_crear_usuario`, `crear_acceso_tenant`, `resetear_clave_tenant`). Ya no existen como Edge Functions.

### ✅ SQL APLICADO EN SUPABASE (v1.2 — todos al día)

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
v42_fix_superadmin_info.sql ✅ columnas contacto en tenants (nombre_representante, foto_representante,
                               pagina_web, instagram, admin_email), crear_negocio con 11 parámetros,
                               Hugo re-vinculado a todos los tenants
v43_rls_tenants_superadmin.sql    ✅ policies SELECT en tenants: superadmin_ve_todos + usuario_ve_su_tenant
v43_salon_admin_crear_usuario.sql ✅ RPC salon_admin_crear_usuario: crea usuario en auth.users directamente
v44_accesos_tenant.sql            ✅ RPCs crear_acceso_tenant + resetear_clave_tenant
v45_superadmin_enhanced.sql       ✅ deleted_at en tenants + citas_hoy en get_tenants + salon_admin_eliminar_tenant
v46_servicios_enhanced.sql        ✅ columnas precio_oferta, recordatorio_texto, profesionales_ids en servicios
v47_clientes_tipo_precio.sql      ✅ columnas tipo_precio, tags[] en clientes_agenda
v48_anticipos_planilla.sql        ✅ tabla anticipos_profesional (anticipos + deducciones de profesionales)
```

---

## Correcciones aplicadas v1.3-dev (sesión 2 — 2026-05-16)

### Bug fixes deployados

| Bug | Causa raíz | Fix |
| --- | --- | --- |
| Sheets ocultos detrás del nav en mobile | `.sp-root > *` ponía z-index:1 en `.sp-main`, creando stacking context que atrapaba sheets (z-index 300/301) por debajo del nav (z-index 200) | Añadido `.sp-root > .sp-main { z-index: auto }` en salon.css |
| Selector de fecha usa picker nativo del teléfono | `<input type="date">` en SalonNuevaCita llama al date picker del SO | Reemplazado con componente `CalendarioPicker` inline (grid mensual, días pasados deshabilitados) |
| Foto upload propietario rompe silenciosamente | ImageUploader usaba props `currentUrl`/`onUploaded` en lugar de `value`/`onChange` — crash sin feedback | Corregidas las props en SalonEquipo.jsx |
| Agregar/editar profesional sin feedback | `guardar()` sin try/catch; si `tenant` era null lanzaba TypeError sin mostrar error | Añadido null-check + try/catch |
| Color del profesional no persiste | `color` no incluido en payload INSERT/UPDATE — dependía del default de BD | Incluido explícitamente + color picker visual en el form |

### Pendientes confirmados (no deployados)

1. **Módulo Mensajería** (Sprint 4) — ver tabla de roadmap abajo
2. **Módulo Proveedores + Gastos** (Sprint 3) — SQL v49 + UI pendiente
3. **Control de acceso por rol en UI** — tabla `permisos_tenant` existe en BD, falta conectar en SalonLayout sidebar
4. **Roles granulares por módulo** — Sprint 3 pendiente

### 1. Deploy Edge Functions WA pendientes
```bash
cd "d:/Proyectos antrigravity/AGENDAS/agenda-saas-v2"
npx supabase functions deploy cumpleanos-clientes resumen-diario
```

### 2. Activar Supabase Schedules (4 crons)
Configurar en Supabase Dashboard → Database → Extensions → pg_cron, o en SalonConfig.

### 3. Verificar bucket `imagenes` en Supabase Storage

Si el upload de fotos de profesionales falla, aplicar el SQL de `sql/v13_storage_imagenes.sql` en el SQL Editor de Supabase.

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
**Acceso**: Solo usuarios con `rol = 'superadmin'` en cualquier tenant — completamente oculto para dueños de negocios.
**`esSuperadmin`**: `rol === 'superadmin' || todosTenants.some(t => t.rol === 'superadmin')` (chequea todos los tenants del usuario, no solo el activo).

**Funciones (v1.2):**
- 5 KPIs: Total negocios / Activos / Suspendidos / Citas hoy / MRR estimado
- 4 tabs: Negocios (CRUD + soft delete) / Accesos / Pagos / Usuarios
- Crear nuevo negocio con datos de contacto completos (representante, teléfono, dirección, web, instagram)
- Soft delete de negocios: `salon_admin_eliminar_tenant` — pone `activo=false, deleted_at=now()`
- Mi acceso maestro: widget para verificar/resetear acceso de Hugo a todos los tenants

### Flujo para nuevo negocio

1. Hugo entra a `/salon` → módulo "Plataforma" (Superadmin React)
2. Crea negocio: nombre, slug, vertical, plan, contacto, email admin, clave temporal
3. RPC `salon_admin_crear_usuario` crea el usuario en auth.users directamente (SECURITY DEFINER)
4. Admin recibe email + clave temporal
5. Admin entra a `/salon?tenant=slug` → configura servicios, equipo, horarios
6. Trabajadores reciben acceso desde módulo `Accesos` del panel

---

## Decisiones Técnicas (No cambiar sin justificación)

### Auth

- **Clave maestra Hugo**: SHA-256('HFURQUINA12') — acceso a panel standalone y a todos los tenants como superadmin. Hash fijo: `e8f3b093450617294857b208734d3da24124fa0c99bcede207ea0584996f5f91`
- **Crear usuarios nuevos**: RPC `salon_admin_crear_usuario` (SECURITY DEFINER) — opera con privilegios elevados, verificado con ADMIN_HASH, llamado via `fetch()` con anon key para bypass de sesión
- **Accesos de trabajadores**: RPC `crear_acceso_tenant` — crea usuario y lo vincula al tenant
- **Reset clave trabajador**: RPC `resetear_clave_tenant` — igual patrón SECURITY DEFINER
- **Reset clave vía email**: `supabase.auth.resetPasswordForEmail` → redirige a `/salon` → handler PASSWORD_RECOVERY en TenantContext
- **Superadmin acceso total**: `tenants_del_usuario()` retorna ALL tenants si rol='superadmin'. `crear_negocio()` auto-inserta a Hugo en `usuarios_tenant` del nuevo tenant.
- **`rpcAnon()`**: helper en SalonSuperadmin — `fetch()` directo con anon key para llamar RPCs SECURITY DEFINER sin depender de la sesión auth activa

### Datos y Seguridad

- **RLS activo en todas las tablas** — siempre con tenant_id
- **`service_role` key nunca en frontend** — solo Edge Functions o SECURITY DEFINER
- **confirmed_at** es columna generada — actualizar solo `email_confirmed_at`
- **pgcrypto** en Supabase vive en schema `extensions` — search_path debe incluirlo
- **Superadmin oculto en Accesos**: filtrar `rol !== 'superadmin'` en SalonAccesos
- **usuarios_tenant tiene NOT NULL**: nombre y email obligatorios — siempre incluirlos en INSERT
- **Soft delete en tenants**: columna `deleted_at TIMESTAMPTZ`. `salon_admin_get_tenants` filtra `WHERE t.deleted_at IS NULL`

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

### Schema crítico: tenants (v42 + v45)

```
id UUID PK
nombre TEXT, slug TEXT UNIQUE, ciudad TEXT, vertical TEXT
plan TEXT, color_primario TEXT, activo BOOLEAN
admin_email TEXT, nombre_representante TEXT, foto_representante TEXT
pagina_web TEXT, instagram TEXT, telefono TEXT, direccion TEXT
deleted_at TIMESTAMPTZ   (soft delete — v45)
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
| **v1.1** | ✅ En producción (tag git: v1.1) | 17 módulos: agenda, equipo, inventario, analytics, superadmin standalone, WA automático, multi-tenant RLS completo |
| **v1.2** | ✅ En producción (tag git: v1.2) | Panel Suscripción React completo (SalonSuperadmin), RPCs SECURITY DEFINER para auth, soft delete de negocios, v43/v44/v45 SQL |
| **v1.3** | 📋 Planificado | Proveedores + Gastos, billing automático (Wompi), pagos en línea desde portal público |
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
3. Para UI: React + inline CSS, variables salon.css, code splitting con lazy import
4. Para deploy:
   ```bash
   git add <archivos> && git commit -m "descripción"
   git push
   npx vercel deploy --prod --yes   # desde d:/Proyectos antrigravity/AGENDAS/agenda-saas-v2
   ```
   ⚠️ `git push` solo actualiza `agenda-profesional` (auto-deploy). La producción real (`project-gnyy8.vercel.app`) **requiere el deploy manual**.
5. Para Edge Functions: `npx supabase functions deploy <nombre>`

### Reglas que nunca se rompen
- Nunca omitir `.eq('tenant_id', tenant.id)` en queries
- Nunca poner `service_role` en frontend
- `get_excepciones_mes` RPC no retorna `id` — usar query directa a `horarios_excepcion` si necesitas el id
- Al crear cualquier tabla nueva: RLS habilitado + política tenant_id + GRANT específico
- Las RPCs SECURITY DEFINER (`salon_admin_*`, `crear_acceso_tenant`, `resetear_clave_tenant`) se llaman vía `fetch()` con anon key — nunca con el cliente Supabase autenticado

### SQL próximo (v1.4)
```
v49_proveedores_gastos.sql    → tablas: proveedores, gastos + RLS + índices
v50_billing.sql               → tabla suscripciones + pagos Wompi + webhooks
```

---

## Contexto de Negocio

- **Hugo Urquina** (hugourquina@gmail.com) = Superadmin de toda la plataforma
- **Negocios activos en v1.2**: glamour-studio, estetica-jess, barbanegra
- **Modelo**: SaaS B2B para negocios de citas (belleza, bienestar, salud no-clínica)
- **Competencia**: WeiBook (weibook.co)
- **Planes**: starter $60K · pro $100K · ultra $140K COP/mes
- **Meta**: 5 negocios pagando antes de construir v1.3
