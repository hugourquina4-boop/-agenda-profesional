# Salón Pro SaaS — Plan Estratégico y Base de Progresión

> Archivo de control para Claude Code. Actualizar al completar cada módulo.
> Stack: React 19 + Vite + Supabase (unpxoamfyushsbyyziyn) + Vercel
> URL prod: https://project-gnyy8.vercel.app
> Superadmin panel: https://project-gnyy8.vercel.app/superadmin.html
> Actualizado: 2026-05-18 (sesión 16)
> **Versión actual en producción: v1.4-dev** (commit 2155117)

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

## Estado del Sistema — v1.3-dev (producción, sesión 3)

### ✅ MÓDULOS COMPLETOS Y EN PRODUCCIÓN

| Módulo | Archivo | Descripción |
|--------|---------|-------------|
| Auth — Login selector de salón | SalonLogin.jsx | Selector multi-salón con búsqueda, URL slug actualizada al elegir |
| Auth — TenantContext multi-tenant | TenantContext.jsx | URL slug > localStorage > lista[0]; `tieneAcceso()` filtra nav por rol y permisos de BD |
| Auth — Accesos y gestión de usuarios | SalonAccesos.jsx | Crear usuarios (RPC `crear_acceso_tenant`), reset clave (RPC `resetear_clave_tenant`), cambiar rol, suspender. Oculta superadmin. |
| Panel Maestro Superadmin (standalone) | public/superadmin.html | SHA-256 HFURQUINA12, gestión negocios, reset claves, pagos, sin React |
| Panel Suscripción (React, solo Hugo) | SalonSuperadmin.jsx | 5 KPIs (Total/Activos/Suspendidos/CitasHoy/MRR), 4 tabs (Negocios/Accesos/Pagos/Usuarios), Mi acceso maestro, soft delete negocios |
| Dashboard hoy | SalonDashboard.jsx | Timeline, stats ingresos, equipo libre/ocupado, alerta stock, onboarding |
| Agenda Mes / Semana / Día | SalonAgenda.jsx | Toggle 3 vistas, grid por profesional, bloques con color de profesional + candado 🔒 en completadas, STAR/VIP badge, nota auto-save, pago inline |
| Nueva cita (5 pasos) | SalonNuevaCita.jsx | Horarios, slots, anti-solapamiento, WA confirmación al crear |
| Portal público | SalonPortal.jsx | Reservas online, precios dinámicos, lista de espera, WA confirmación |
| Servicios CRUD | SalonServicios.jsx | 4 tabs: Detalles, Precio (base+oferta+duración), Equipo (profesionales asignados), Recordatorio (template WA con preview) |
| Equipo CRUD + horarios táctiles + calendario excepciones | SalonEquipo.jsx | HorarioGrid drag-to-select, MiniCalendar visual para excepciones por fecha (verde=especial, rojo=ausente). Fix: props ImageUploader corregidas, try/catch en guardar(), color picker |
| Mensajería WA | SalonMensajeria.jsx | Lista clientes con filtros (todos/mayorista/cumpleaños/sin visita 30d), 6 plantillas con sustitución {{nombre}}/{{negocio}}, wa.me links directos |
| HorarioGrid (componente reutilizable) | components/HorarioGrid.jsx | Drag-to-select táctil, pointer capture, exports: rangeToSlots, slotsToRange, slotsToFranjas |
| Clientes CRUD + historial + fotos | SalonClientes.jsx | Cumpleaños, segmento, historial, galería, CSV export + import, tipo_precio (Normal/Mayorista), badge MAYOR en lista, toggle rápido en detalle |
| Caja — Registro de cobros | SalonCaja.jsx | KPI 2×2 (Ingresos/Egresos/Saldo), tabs Por cobrar/Cobrado/Egresos, buscador en Cobrado, modal egreso con categoría, PDF export, anulación |
| Comisiones — Reglas + liquidación | SalonComisiones.jsx | % por profesional, meta mensual, liquidación PDF individual, tab Planilla con anticipos/deducciones/neto, tab Cuentas (estado deuda colaboradores) |
| Analytics avanzados | SalonAnalytics.jsx | KPIs MoM con trend %, heatmap días semana, top 5 servicios por ingresos, comparativa histórica 6 meses |
| Proveedores — Pedidos con flujo estados | SalonProveedores.jsx | Tab Pedidos: Abierto→Cotizaciones→Aceptado→Entregado→Pagado, ítems con precio unitario |
| Servicios — Paquetes combos | SalonServicios.jsx | Toggle Servicios/Paquetes, CRUD con selección servicios, precio especial, % OFF, visible_portal |
| Clientes — Préstamos y abonos | SalonClientes.jsx | Tab Crédito: préstamos/abonos por cliente, saldo deudor en tiempo real |
| Órdenes en espera | SalonOrdenes.jsx | Grid tarjetas 2 col, buscador + filtro por profesional, cancelar-todas con confirm, nueva orden, cobrar → pagos → comisión |
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
v49_proveedores_gastos.sql        ✅ tabla gastos_salon + proveedores
v50_pagos_plataforma.sql          ✅ tabla pagos_plataforma + RPCs salon_admin_registrar_pago/get_pagos
v53_profesional_servicios.sql     ✅ tabla profesional_servicios (muchos-a-muchos prof↔servicio, comisión por servicio)
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

### Features deployadas sesión 5 (2026-05-16)

| Feature | Archivos | Notas |
| ------- | -------- | ----- |
| Matrix de permisos completa | SalonAccesos.jsx, TenantContext.jsx | proveedores + mensajería añadidos a MODULOS y PERMISOS_DEFAULT |
| Registro de pagos de suscripción | SalonSuperadmin.jsx, sql/v50 | ModalPago: monto/método/meses + preview nueva fecha + historial en tab Pagos |
| SQL v50 billing | sql/v50_pagos_plataforma.sql | tablas pagos_plataforma + RPCs salon_admin_registrar_pago/get_pagos ✅ APLICADO |
| Dashboard preview mañana | SalonDashboard.jsx | Card "Mañana" con citas del día siguiente + botón "Ver agenda →" |
| Cobro rápido inline en timeline | SalonDashboard.jsx | Botón muestra monto; click expande selector método + "Cobrar"/"Sin cobro" |

### Features deployadas — sesión 7 (2026-05-17)

| Feature | Archivos | Notas |
| ------- | -------- | ----- |
| Countdown suscripción en Dashboard | SalonDashboard.jsx | Pill verde >10 días, tarjeta amarilla ≤5, tarjeta roja ≤0 con Nequi/Transfiya/Bancolombia copiables |
| Bloqueo automático por vencimiento | SalonApp.jsx | Pantalla de bloqueo tras >2 días de gracia; superadmin siempre accede |
| Sección "Suscripción y pagos" en Config | SalonConfig.jsx | Estado plan+fecha+días restantes + 3 métodos de pago con botón Copiar |
| SQL v54 (solo comentario) | sql/v54_suscripcion_status.sql | No requiere correr SQL — suscripción se lee de tenants.fecha_vencimiento; planes_salon y suscripciones_negocio NO existen |
| TenantContext carga suscripción | TenantContext.jsx | `suscripcion` {fecha_limite, estado, plan_nombre, dias_restantes} en contexto |

### Features deployadas — sesión 8 — Sprint 1 completo (2026-05-17)

| Feature | Archivos | Notas |
| ------- | -------- | ----- |
| Agenda: bloques por color de profesional | SalonAgenda.jsx | PROF_CLR map desde `profesionales.color` (fallback palette); estado como dot top-right; canceladas gris+opacidad |
| Agenda: nota en cita con auto-save | SalonAgenda.jsx | textarea en popup, guardar en onBlur vía `guardarNota()`, estado local `nota`/`guardandoNota` |
| Agenda: STAR/VIP badge en popup | SalonAgenda.jsx | Badge color accent en header del detalle si cliente tiene tag 'vip' o 'star' |
| Agenda: 🔒 candado en completadas | SalonAgenda.jsx | Icono 🔒 en bloque de cita con estado 'completada' en VistaDia |
| Agenda: nowOffset en minutos crudos | SalonAgenda.jsx | `setNowOffset(h*60+m)`; conversión a px dentro de VistaDia donde H_START/SLOT_H son conocidos |
| Caja: reescritura completa | SalonCaja.jsx | KPI grid 2×2, 3 tabs (PorCobrar/Cobrado/Egresos), buscador useMemo, modal egreso, fetch paralelo |
| Órdenes: buscador + filtro prof | SalonOrdenes.jsx | `busqOrden`, `filtroProf` state; `ordenesFiltradas` computed; dropdown solo si >1 profesional |
| Órdenes: cancelar todas con confirm | SalonOrdenes.jsx | Botón header → confirm inline → `eliminarTodas()` marca 'cancelado' |

### Bug fixes deployados — sesión 6 (2026-05-17)

| Bug | Causa raíz | Fix |
| --- | --- | --- |
| Anticipos/deducciones no se guardan | `registrarAnticipo` no capturaba error de Supabase → cerraba form y mostraba "Registrado ✓" aunque fallara | Captura `{ error }` del insert, muestra toast de error y no cierra el form. `cargarAnticipos` corre en mount. |
| Fotos de profesionales desaparecen al scroll en VistaDia | `overflowY:'clip'` + `overflowX:'auto'` rompen CSS `position:sticky` del header | Cambio a `overflow:'auto'` con `maxHeight: calc(100dvh - 210px)` → sticky funciona dentro del container |
| Timeline agenda muy extensa en móvil | H_START=7 a H_END=21 fijo → 1232px siempre | Rango dinámico basado en horas de citas del día (±1h). SLOT_H reducido a 40px. |
| Duración de citas incorrecta en grid (+5h extra) | `fecha_fin = new Date(inicio).toISOString()` convierte local→UTC, guarda sin 'Z'. Al leer, se interpreta como local → desfase de 5h (Colombia UTC-5) | En SalonNuevaCita: usar `getHours()/getMinutes()` local. En durPx: usar `duracion_min` del servicio como fuente canónica (ignora fecha_fin corrupta) |
| Sin selector de rol al crear acceso para profesional | `{!creandoPara?.nombre && <ROL selector>}` lo ocultaba | Selector siempre visible, con descripción del rol activo |

### Pendientes operativos

1. ~~**Módulo Mensajería**~~ ✅ DEPLOYADO (sesión 3)
2. ~~**Módulo Proveedores + Gastos**~~ ✅ DEPLOYADO (sesión 4) — SQL v49 aplicado
3. ~~**Control de acceso por rol en UI**~~ ✅ COMPLETADO (sesión 5) — permisos wired + MODULOS fix
4. ~~**SQL v50_pagos_plataforma.sql**~~ ✅ APLICADO (2026-05-16) — tabla pagos_plataforma + salon_admin_registrar_pago + salon_admin_get_pagos

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
v49_proveedores_gastos.sql        ✅ APLICADO
v50_pagos_plataforma.sql          ✅ APLICADO (2026-05-16)
v53_profesional_servicios.sql     ✅ APLICADO (2026-05-17)
v54_suscripcion_status.sql        ✅ NO REQUIERE SQL (solo comentario)
v55_anticipo_citas.sql            ✅ APLICADO (2026-05-17) — columna anticipo NUMERIC en citas
v56_descuentos_pagos.sql          ✅ APLICADO (2026-05-17) — columnas descuento + tipo_descuento en pagos
v57_propina_pagos_lineas.sql      ✅ APLICADO (2026-05-17) — propina en pagos + tabla pagos_lineas
v58_servicio_insumos.sql          ✅ APLICADO (2026-05-17) — tabla servicio_insumos
v59_fixes_portal_anticipos.sql    ✅ APLICADO (2026-05-18) — RLS anticipos unificado + ps_anon_select portal
v60_pedidos_proveedor.sql         ✅ APLICADO (2026-05-18) — pedidos_proveedor + pedidos_proveedor_items
v61_paquetes_salon.sql            ✅ APLICADO (2026-05-18) — paquetes_salon + paquetes_servicios
v62_prestamos_cliente.sql         ✅ APLICADO (2026-05-18) — prestamos_cliente (préstamos/abonos por cliente)
v63_fix_rls_anticipos.sql         ✅ APLICADO (2026-05-18) — RLS = ANY() para anticipos_profesional, comisiones, prestamos_cliente
v64_recordatorios_cron.sql        ✅ APLICADO (2026-05-18) — pg_cron: recordatorio-citas + cumpleanos-clientes + resumen-diario-salon
v65_self_service_trial.sql        ✅ APLICADO (2026-05-18) — salon_self_service_registrar SECURITY DEFINER grant anon
v66_plantillas_mensajeria.sql     ✅ APLICADO (2026-05-18) — tabla plantillas_mensajeria + RLS tenant
v67_sedes.sql                     ✅ APLICADO (2026-05-18) — tabla sedes + sede_id en profesionales y citas
v68_trigger_stock.sql             ✅ APLICADO (2026-05-18) — trigger fn_descontar_insumos_cita activo
v69_wompi_portal.sql              ✅ APLICADO (2026-05-18) — wompi_public_key + pagos_portal_activo en tenants
v70_desvincular_usuario.sql       ✅ APLICADO (2026-05-18) — RPC desvincular_usuario_tenant SECURITY DEFINER
v71_sedes_horario.sql             ✅ APLICADO (2026-05-18) — hora_apertura + hora_cierre + dias_activos en sedes
v72_portal_anon_tenants.sql       ✅ APLICADO — anon RLS en tenants/profesionales/servicios/horarios/sedes/paquetes/citas
v73_movimientos_stock.sql         ✅ APLICADO — tabla movimientos_stock + RLS + índices
```

---

## Backlog de Features — Sesión 9 (2026-05-18)

### ✅ Bloque A — COMPLETADO (sesión 8)

| Feature | SQL | Estado |
| ------- | --- | ------ |
| Abono a reserva | v55 | ✅ |
| Descuento / cortesía en cobro | v56 | ✅ |
| Estado de cuenta colaboradores | sin SQL | ✅ (tab "Cuentas" en SalonComisiones) |

### ✅ Bloque B — COMPLETADO (sesiones 8–9)

| Feature | SQL | Estado |
| ------- | --- | ------ |
| Productos + propina en modal de cobro | v57 | ✅ |
| Insumos por servicio | v58 | ✅ |
| Analytics avanzado: heatmap, top servicios, trend MoM | sin SQL | ✅ |

### ✅ Bloque C — COMPLETADO (sesión 9)

| Feature | SQL | Estado |
| ------- | --- | ------ |
| Pedidos a proveedores (flujo estados) | v60 | ✅ |
| Paquetes de servicios + portal | v61 | ✅ |
| Préstamos a clientes | v62 | ✅ |

### ✅ Brand — COMPLETADO (sesión 9)

| Feature | Estado |
| ------- | ------ |
| favicon.svg — corona+tijeras charcoal/verde | ✅ |
| logo192.png + logo512.png (iOS homescreen) | ✅ |
| Playfair Display añadida para wordmark | ✅ |

### ✅ Bloque D — Cambios sesión 10 (2026-05-18)

| Feature | Archivos | Estado |
| ------- | -------- | ------ |
| Dashboard: cobro rápido con toggle Anticipo | SalonDashboard.jsx | ✅ |
| Mensajería: última visita real + filtro por servicio + conteos | SalonMensajeria.jsx | ✅ |
| Clientes: badge "Debe $X" cuando saldo_prestamos > 0 | SalonClientes.jsx | ✅ |
| Órdenes: subtítulo "walk-in sin cita previa" | SalonOrdenes.jsx | ✅ |
| v63 RLS fix: = ANY() en anticipos/comisiones/préstamos | v63_fix_rls_anticipos.sql | ✅ |

### ✅ Bloque E — Completado sesión 10 (cont.)

| Feature | Archivos | Estado |
| ------- | -------- | ------ |
| Drag & drop citas en VistaDia (hora + profesional) | SalonAgenda.jsx | ✅ |
| Analytics tab Ventas: por método/servicio/profesional + rango fecha | SalonAnalytics.jsx | ✅ |
| v64 pg_cron recordatorios automáticos | sql/v64_recordatorios_cron.sql | ✅ creado — pendiente aplicar en Supabase |

### ✅ Bloque F — Completado sesión 10

| Feature | SQL | Estado |
| ------- | --- | ------ |
| Portal público paquetes con % OFF | sin SQL nuevo | ✅ Portal.jsx + paquetes_salon.visible_portal |
| Self-service trial 14 días | v65 | ✅ SalonRegistroPublico.jsx + /salon-registro + CTA en Login |

### ✅ Bloque G — Completado sesión 10 (cont.)

| Feature | SQL | Estado |
| ------- | --- | ------ |
| Plantillas WA editables | v66 | ✅ SalonMensajeria: edit mode inline, fallback TEMPLATES hardcoded |

### ✅ Bloque H — Completado sesión 10

| Feature | SQL | Estado |
| ------- | --- | ------ |
| Onboarding checklist 3 pasos con % completado | sin SQL | ✅ SalonDashboard — barra progreso dinámica |
| Multi-sede | v67 ✅ | ✅ SalonSedes.jsx — CRUD + asignación profesionales |
| Descuento automático de stock | v68 pendiente | ✅ trigger fn_descontar_insumos_cita + insumos_descontados |

### ✅ Bloque I — COMPLETADO (sesión 11 — 2026-05-18)

| Feature | SQL | Estado |
| ------- | --- | ------ |
| Agenda: filtro por sede en VistaDia | sin SQL | ✅ Pills sede encima de pills prof; filtra PROFS por sede_id |
| Portal: selector de sede en step 1 | sin SQL | ✅ Pills sede + filtroSede en profsParaServicios |
| Stock bajo detallado en Dashboard | sin SQL | ✅ Card expandida muestra lista nombre/stock/mínimo |
| Pagos en línea desde portal (Wompi/PSE) | v69 ✅ | ✅ WidgetCheckout CDN; SalonConfig configura clave pública; portal detecta pagos_portal_activo y cobra antes de crear cita |

### ✅ Bloque J — COMPLETADO (sesión 11 — 2026-05-18)

| Feature | SQL | Estado |
| ------- | --- | ------ |
| NuevaCita: filtro por sede en paso 0 | sin SQL | ✅ Pills sede encima de lista de profesionales; inserta sede_id en cita |
| Caja: badge "🌐 Portal" para pagos Wompi | sin SQL | ✅ METODO_LABELS + METODO_COLORS con wompi verde |
| Analytics: label "🌐 Portal" en desglose métodos | sin SQL | ✅ METODO_LABELS + color verde en ventas por método |
| Config: galería 4 fotos para portal + config Wompi | sin SQL | ✅ 2×2 ImageUploaders; toggle pagos + input clave pública; guardado en config_vertical.fotos_galeria |
| Portal: strip de fotos en paso 0 | sin SQL | ✅ Carrusel horizontal scrollable (fotos_galeria de config_vertical) |

---

### ✅ Bloque K — COMPLETADO (sesión 12 — 2026-05-18)

| Feature | SQL | Estado |
| ------- | --- | ------ |
| Recordatorios WA desde cita (botón en popup agenda) | sin SQL | ✅ Ya existía desde sesión 8 (línea 831 SalonAgenda) |
| Caja: descarga CSV (abre en Excel) del período filtrado | sin SQL | ✅ `descargarCSV()` + botón "↓ CSV" junto a PDF |
| Accesos: desvincular usuario del negocio | v70 ✅ | ✅ RPC `desvincular_usuario_tenant` + UI con confirmación en panel expandido |
| Dashboard: tendencia ingresos semana actual vs semana anterior | sin SQL | ✅ Gráfico de barras dobles (gris=anterior, col=actual) + % cambio + totales |

### ✅ Bloque L — COMPLETADO (sesión 13 — 2026-05-18)

| Feature | SQL | Estado |
| ------- | --- | ------ |
| Portal: anti double-booking antes de confirmar | sin SQL | ✅ Overlap check en `crearReserva()` — cuenta citas solapadas antes de crear |
| Caja: filtrar historial por rango de fechas personalizado | sin SQL | ✅ Pill "Rango" + 2 date inputs; `rangoDesde/rangoHasta` en cargar |
| Dashboard: acceso rápido a lista de espera del día | sin SQL | ✅ Chip ámbar con count → navega a agenda; 11ª query en Promise.all |
| Agenda: copiar/duplicar cita a otra fecha | sin SQL | ✅ Botón "Duplicar" en popup → date picker → insert con mismo prof/servicio/cliente |

### ✅ Bloque M — COMPLETADO (sesión 14 — 2026-05-18)

| Feature | SQL | Estado |
| ------- | --- | ------ |
| Agenda: búsqueda de citas por cliente/servicio/profesional | sin SQL | ✅ Barra búsqueda encima del calendario; resultados en lista; limpiable con × |
| Caja: desglose egresos por categoría en PDF | sin SQL | ✅ Sección egresos al final del PDF con tabla por categoría + saldo neto |
| Sedes: horarios de atención por sede | v71 pendiente aplicar | ✅ hora_apertura/cierre/dias_activos en form + mostrados en card; v71 SQL listo |

### ✅ Bloque N — COMPLETADO (sesión 15 — 2026-05-18)

| Feature | SQL | Estado |
| ------- | --- | ------ |
| Clientes: búsqueda multi-campo (nombre + teléfono + email) | sin SQL | ✅ `.or()` Supabase con ilike en 3 columnas |
| Dashboard: barras de carga por profesional hoy | sin SQL | ✅ Mini horizontal bars en card — verde/accent/rojo según % |
| Caja: exportar egresos a CSV | sin SQL | ✅ `descargarEgresosCSV()` + botón "↓ CSV" en tab Egresos |

### ✅ Bloque O — COMPLETADO (sesión 16 — 2026-05-18)

| Feature | SQL | Estado |
| ------- | --- | ------ |
| Equipo: citas + ingresos del mes por profesional | sin SQL | ✅ Card muestra "X citas · $YK este mes" en color del profesional |
| Agenda: contador citas por profesional en VistaDia | sin SQL | ✅ Badge numerado bajo el nombre en el header del grid |
| Clientes: exportar historial individual a PDF | sin SQL | ✅ Botón "↓ PDF" en tab Historial → PDF con tabla completa |
| Proveedores: dashboard gastos acumulados por proveedor | sin SQL | ✅ Tarjeta con barras horizontales al tope del tab Proveedores |
| Analytics: tab "Gerencial" con P&L completo | sin SQL | ✅ Estado de Resultados + 6 KPIs + IVA estimado + PDF export |
| Portal /reservar/slug — fix RLS anon en tenants | v72 ⏳ | ⏳ SQL corregido, pendiente aplicar en Supabase |

## Bloque P — Sprint activo (sesión 17 — 2026-05-18)

### Gaps competitivos vs WeiBook (prioridad alta)

| Feature | SQL necesario | Prioridad |
| ------- | ------------- | --------- |
| Agenda: bloquear horario (marcar no disponible sin crear cita falsa) | sin SQL | ✅ DONE — block rayado en grid, sheet con eliminar |
| Portal: notificación WA al cliente al confirmar reserva | sin SQL | ✅ YA EXISTÍA — SalonPortal.jsx:405 llama notificacion-cita EF |
| Agenda: cita recurrente (crear serie semanal/mensual) | sin SQL | ✅ DONE — botones Duplicar+Crear serie, slider 2–24 reps |
| Comisiones: notificación WA al liquidar | sin SQL | ✅ DONE — abre WA por cada prof con teléfono al liquidar |
| Agenda: vista semana con color por estado | sin SQL | 🟡 Media — ya tiene ESTADO_COLOR, pendiente revisión |

### Features de calidad

| Feature | SQL necesario | Prioridad |
| ------- | ------------- | --------- |
| Caja: gráfico de barras ingresos vs egresos por semana | sin SQL | ✅ DONE — 7 barras dobles (ing/eg), solo visible en periodo='semana' |
| Caja: cierre del día con PDF de cuadre | sin SQL | ✅ DONE — botón 'Z Cierre' en periodo='hoy', PDF con KPIs+métodos+cobros+firma |
| Inventario: historial de movimientos de stock | v73 ✅ | ✅ DONE — botón historial en cada producto, modal con ajuste manual + timeline |
| Búsqueda global (barra que busca clientes/citas desde cualquier módulo) | sin SQL | ✅ DONE — overlay Ctrl+K, debounce 280ms, clientes+citas, navega módulo |

## Bloque Q — COMPLETADO (sesión 17 cont. — 2026-05-18)

| Feature | SQL | Estado |
| ------- | --- | ------ |
| Agenda: detección de solapamiento de citas por profesional | sin SQL | ✅ DONE — badge ⚠️ sobre cita; O(n²) comparación de rangos activos |
| Dashboard: card "Top 3 clientes del mes" con barras | sin SQL | ✅ DONE — query #12 pagos→citas→clientes; medallas 🥇🥈🥉 + barras |
| Mensajería: filtro "Cumpleaños esta semana" (≤7d) | sin SQL | ✅ DONE — isCumpleEstaSemana() |
| Mensajería: filtro "Sin visita 60d" | sin SQL | ✅ DONE — sinVisita60d() |

**SQL aplicado:** v72 ✅ (portal activo) · v73 ✅ (movimientos stock activos)

---

## Contexto de Negocio

- **Hugo Urquina** (hugourquina@gmail.com) = Superadmin de toda la plataforma
- **Negocios activos en v1.2**: glamour-studio, estetica-jess, barbanegra
- **Modelo**: SaaS B2B para negocios de citas (belleza, bienestar, salud no-clínica)
- **Competencia**: WeiBook (weibook.co)
- **Planes**: starter $60K · pro $100K · ultra $140K COP/mes
- **Meta**: 5 negocios pagando antes de construir v1.3
