# Salón Pro SaaS — Plan Estratégico y Base de Progresión

> Archivo de control para Claude Code. Actualizar al completar cada módulo.
> Stack: React 19 + Vite + Supabase (unpxoamfyushsbyyziyn) + Vercel
> URL prod: https://project-gnyy8.vercel.app
> Superadmin panel: https://project-gnyy8.vercel.app/superadmin.html
> Actualizado: 2026-05-09

---

## Arquitectura Multi-Tenant — Reglas Fundamentales

Cada negocio (tenant) es **completamente independiente**: equipo, servicios, clientes, caja, comisiones, inventario, configuración y claves de acceso son propios y no se comparten entre negocios.

### Jerarquía de roles

| Rol | Quién | Acceso |
|-----|-------|--------|
| `superadmin` | Hugo Urquina (hugourquina@gmail.com) | Todos los negocios, panel maestro, facturación, creación de tenants |
| `admin` | Dueño del negocio | Todo dentro de su negocio: equipo, config, analytics, accesos, comisiones, caja |
| `contable` | Contador del negocio | Caja, comisiones, analytics, inventario — sin config ni accesos |
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

## Estado del Sistema

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
| Equipo CRUD + horarios táctiles + excepciones | SalonEquipo.jsx | HorarioGrid drag-to-select por día, excepciones por fecha (ausencia/horario especial) |
| HorarioGrid (componente reutilizable) | components/HorarioGrid.jsx | Drag-to-select táctil, pointer capture, exports: rangeToSlots, slotsToRange, slotsToFranjas |
| Clientes CRUD + historial + fotos | SalonClientes.jsx | Cumpleaños, segmento, historial, galería, CSV export + import |
| Caja — Registro de cobros | SalonCaja.jsx | Tabla pagos, tabs Por cobrar/Cobrado, métodos pago, PDF export |
| Comisiones — Reglas + liquidación | SalonComisiones.jsx | % por profesional, meta mensual, liquidación PDF individual |
| Órdenes en espera | SalonOrdenes.jsx | Grid tarjetas, nueva orden, cobrar → pagos → comisión |
| Inventario de productos | SalonInventario.jsx | CRUD + CSV import (preview → upsert por SKU), subcategoria/marca/codigo/contenido/proveedor, categorías: capilar/color/tratamiento/retail/uñas/insumos/herramienta/otro |
| Analytics — KPIs y métricas | SalonAnalytics.jsx | v_kpis_mes, v_revenue_staff, v_retention, gráficos, PDF export |
| Configuración del negocio | SalonConfig.jsx | Logo, color, WhatsApp, tipología, horario, slots, QR, plan |
| Superadmin React (dentro del app) | SalonSuperadmin.jsx | Vista interna para Hugo: MRR/ARR, crear negocio con usuario inicial |
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

### ✅ SQL APLICADO EN SUPABASE (todos al día)

```
SALON_SETUP_COMPLETO.sql   ✅ Schema base
v9–v35                     ✅ Todos aplicados
v36_eliminar_dev_policies  ✅ APLICADO — elimina políticas dev_* cross-tenant
v37_salon_superadmin.sql   ✅ APLICADO — SHA-256 admin, SECURITY DEFINER RPCs:
                              salon_verificar_admin, salon_admin_reset_password,
                              salon_admin_get_tenants, salon_admin_set_activo,
                              salon_admin_set_plan, salon_admin_get_users
v38_permisos_rol.sql       ✅ APLICADO — tabla permisos_tenant + RPCs:
                              salon_seed_permisos, get_permisos_tenant, set_permiso_tenant
v39_horarios_flexibles.sql ✅ APLICADO — tabla horarios_excepcion + RPCs:
                              get_disponibilidad_dia, get_excepciones_mes
v40_superadmin_fixes.sql   ✅ APLICADO — fix crear_negocio (vincula Hugo vía RLS),
                              fix superadmin_tenants_info (+admin_email),
                              vincula Hugo a todos los tenants existentes
v41_inventario_enhanced.sql ✅ APLICADO — subcategoria, marca, codigo, contenido, proveedor
                              en productos_salon; CHECK categorías expandido; índice único
                              (tenant_id, codigo) para upsert CSV sin duplicados
v42_fix_superadmin_info.sql  ⏳ PENDIENTE APLICAR — fix superadmin_tenants_info + crear_negocio
                              con campos de contacto; nuevas columnas tenants: nombre_representante,
                              foto_representante, pagina_web, instagram; re-vincula Hugo
```

### ✅ SQL EJECUTADO DIRECTAMENTE (sin archivo)

```sql
-- tenants_del_usuario(): superadmin → todos los tenants; regular → solo los suyos
-- Hugo vinculado como superadmin en todos los tenants existentes via ON CONFLICT DO UPDATE
```

---

## 🚨 Pendientes Críticos

### 1. Control de acceso por rol — PENDIENTE IMPLEMENTAR EN UI
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
| Equipo | ✅ | ❌ | ❌ | ❌ |
| Accesos | ✅ | ❌ | ❌ | ❌ |
| Configuración | ✅ | ❌ | ❌ | ❌ |

### 2. Deploy Edge Functions pendientes
```bash
npx supabase functions deploy cumpleanos-clientes resumen-diario
```

### 3. Activar Supabase Schedules (4 crons)
Ver sección Automatizaciones en SalonConfig para los horarios.

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
- Crear nuevo negocio (tenant) con usuario admin inicial y clave temporal
- Identificar y vincular al dueño del negocio
- Asignar plan contratado y fecha de vigencia
- Verificar y registrar pagos de suscripción
- MRR / ARR de la plataforma

### Flujo para nuevo negocio

1. Hugo entra a `/salon` → módulo "Plataforma" (Superadmin React)
2. Crea negocio: nombre, slug, vertical, plan, email admin, clave temporal
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

### UI

- **Inline CSS**: no Tailwind en componentes salon/ — variables `var(--bg)`, `var(--card)`, `var(--text)`, `var(--text-2)`, `var(--text-3)`, `var(--border)`, `var(--accent)`
- **URL slug**: `SalonLogin.elegirSalon()` y `TenantPicker` siempre actualizan `?tenant=slug` en URL
- **Code splitting**: lazy imports con Suspense + ErrorBoundary en todos los módulos
- **Chunk errors post-deploy**: ErrorBoundary.componentDidCatch + main.jsx vite:preloadError → ambos llaman window.location.reload(). SW excluye /assets/ del caché.
- **HorarioGrid**: componente táctil reutilizable en `src/components/HorarioGrid.jsx`. Usa `setPointerCapture` + `document.elementFromPoint`. Exporta helpers de conversión de slots.

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

### Schema crítico: productos_salon (v41)

```
id, tenant_id, nombre, categoria, subcategoria, marca, codigo (SKU),
contenido NUMERIC, unidad, proveedor, precio_venta, precio_costo,
stock, stock_minimo, notas, activo, created_at
UNIQUE INDEX (tenant_id, codigo) WHERE codigo IS NOT NULL AND codigo <> ''
```

---

## Contexto de Negocio

- **Hugo Urquina** (hugourquina@gmail.com) = Superadmin de toda la plataforma
- **Negocios activos**: glamour-studio, estetica-jess
- **Modelo**: SaaS B2B para salones de belleza colombianos
- **Competencia**: WeiBook (weibook.co)
- **Planes**: starter $49K · pro $89K · ultra $149K COP/mes
- **Meta**: 5 salones pagando en 60 días

---

## Cómo Trabajar con Claude

```
Contexto: Salón Pro SaaS. Quiero trabajar en [módulo].
Estado: [lo que está pendiente según este CLAUDE.md]
```

- Leer siempre primero: `TenantContext.jsx`, el módulo a modificar, y este CLAUDE.md
- Para SQL nuevo: archivo `vXX_nombre.sql` con RLS + tenant_id. Próximo: v42
- Para UI: React + inline CSS, variables salon.css
- Para deploy: `git push` → Vercel auto-despliega. O `npx vercel --prod --yes` si urgente
- Para Edge Functions: `npx supabase functions deploy <nombre>` (requiere access token)
- Nunca omitir `.eq('tenant_id', tenant.id)` en queries
- `get_excepciones_mes` RPC no retorna `id` — usar query directa a `horarios_excepcion` si necesitas el id
