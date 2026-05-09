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
| Equipo CRUD + horarios | SalonEquipo.jsx | 7 días, fotos, upsert horarios — independiente por tenant |
| Clientes CRUD + historial + fotos | SalonClientes.jsx | Cumpleaños, segmento, historial, galería, CSV export + import |
| Caja — Registro de cobros | SalonCaja.jsx | Tabla pagos, tabs Por cobrar/Cobrado, métodos pago, PDF export |
| Comisiones — Reglas + liquidación | SalonComisiones.jsx | % por profesional, meta mensual, liquidación PDF individual |
| Órdenes en espera | SalonOrdenes.jsx | Grid tarjetas, nueva orden, cobrar → pagos → comisión |
| Inventario de productos | SalonInventario.jsx | CRUD, categorías, valor total, alertas stock mínimo |
| Analytics — KPIs y métricas | SalonAnalytics.jsx | v_kpis_mes, v_revenue_staff, v_retention, gráficos, PDF export |
| Configuración del negocio | SalonConfig.jsx | Logo, color, WhatsApp, tipología, horario, slots, QR, plan |
| Superadmin React (dentro del app) | SalonSuperadmin.jsx | Vista interna para Hugo: MRR/ARR, crear negocio con usuario inicial |

### ✅ EDGE FUNCTIONS OPERATIVAS

| Función | Cuándo invocar | Qué hace |
|---------|---------------|----------|
| `notificacion-cita` | Al crear cita | WA al cliente + WA al salón |
| `notificacion-recordatorio` | Cron cada hora | WA 24h antes + 1h antes |
| `cumpleanos-clientes` | Cron diario 9am | WA de cumpleaños |
| `resumen-diario` | Cron diario 9pm | WA al dueño con resumen |
| `admin-crear-usuario` | SalonAccesos + Superadmin | Crea usuario Supabase Auth sin afectar sesión |
| `admin-reset-password` | SalonAccesos | Resetea contraseña vía email |

### ✅ SQL APLICADO EN SUPABASE

```
SALON_SETUP_COMPLETO.sql  ✅ Schema base
v9–v35                    ✅ Todos aplicados (ver historial previo)
v36_eliminar_dev_policies ⚠️ PENDIENTE APLICAR — elimina políticas dev_* (seguridad crítica)
v37_salon_superadmin.sql  ✅ APLICADO — SHA-256 admin, SECURITY DEFINER RPCs:
                             salon_verificar_admin, salon_admin_reset_password,
                             salon_admin_get_tenants, salon_admin_set_activo,
                             salon_admin_set_plan, salon_admin_get_users
```

### ✅ SQL EJECUTADO DIRECTAMENTE (sin archivo)

```sql
-- Función tenants_del_usuario() actualizada:
-- Si usuario es superadmin → retorna TODOS los tenants con campo slug
-- Si usuario regular → retorna solo sus tenants activos

-- Hugo vinculado como superadmin en todos los tenants:
-- INSERT INTO usuarios_tenant ... ON CONFLICT DO UPDATE SET rol='superadmin'
```

---

## 🚨 Pendientes Críticos

### 1. v36_eliminar_dev_policies — APLICAR EN SUPABASE
Archivo existe en `sql/v36_eliminar_dev_policies.sql`. Ejecutar en SQL Editor.
Elimina políticas `dev_*` que permiten acceso cross-tenant. Bloquea lanzamiento a clientes reales.

### 2. Control de acceso por rol — PENDIENTE IMPLEMENTAR
El dueño/admin del negocio debe poder definir qué módulos ve cada integrante del equipo.

**Módulos visibles por rol** (diseño a implementar):

| Módulo | superadmin | admin | contable | recepcion | profesional |
|--------|-----------|-------|----------|-----------|-------------|
| Inicio/Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Agenda | ✅ | ✅ | ❌ | ✅ | ✅ (solo propia) |
| Clientes | ✅ | ✅ | ❌ | ✅ | ✅ |
| Servicios | ✅ | ✅ | ❌ | ✅ | ✅ |
| Órdenes en espera | ✅ | ✅ | ❌ | ✅ | ✅ |
| Caja | ✅ | ✅ | ✅ | ❌ | ❌ |
| Comisiones | ✅ | ✅ | ✅ | ❌ | ❌ |
| Inventario | ✅ | ✅ | ✅ | ❌ | ❌ |
| Analytics | ✅ | ✅ | ✅ | ❌ | ❌ |
| Equipo | ✅ | ✅ | ❌ | ❌ | ❌ |
| Accesos | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configuración | ✅ | ✅ | ❌ | ❌ | ❌ |

**Implementación planificada:**
- Tabla `permisos_tenant` (tenant_id, rol, modulo, activo) — el admin configura por negocio
- `SalonLayout` filtra el menú según `rol` del usuario logueado
- El admin puede ajustar permisos desde `SalonAccesos` o `SalonConfig`

### 3. Deploy Edge Functions pendientes
```bash
npx supabase functions deploy cumpleanos-clientes resumen-diario
```

### 4. Activar Supabase Schedules (4 crons)
Ver sección Automatizaciones en SalonConfig para los horarios.

---

## Panel Maestro Superadmin (superadmin.html)

**URL**: https://project-gnyy8.vercel.app/superadmin.html
**Clave**: `HFURQUINA12` (SHA-256 computado en browser, verificado via RPC SECURITY DEFINER)
**Acceso**: Solo Hugo. Nunca visible para dueños de negocios.

### Funciones disponibles

- Ver todos los negocios con métricas (citas, clientes, profesionales)
- Crear nuevo negocio + usuario admin inicial
- Activar / Suspender negocio
- Cambiar plan y fecha de vencimiento
- Reset de clave de cualquier usuario por email (vía `salon_admin_reset_password`)
- Registrar pagos de suscripción
- Ver todos los usuarios de la plataforma

### Flujo para nuevo negocio

1. Superadmin crea negocio en `superadmin.html` → genera tenant con admin inicial
2. Admin del negocio recibe email + clave temporal
3. Admin entra a `/salon?tenant=slug` → configura servicios, equipo, horarios
4. Trabajadores reciben acceso desde `Accesos` dentro del panel del negocio

---

## Decisiones Técnicas (No cambiar sin justificación)

### Auth

- **Clave maestra Hugo**: SHA-256('HFURQUINA12') — acceso a panel standalone y a todos los tenants como superadmin
- **Crear usuarios nuevos**: Edge Function `admin-crear-usuario` (x-admin-secret: salonpro2026)
- **Reset clave dentro de plataforma**: `salon_admin_reset_password` RPC (SECURITY DEFINER, extensions schema para gen_salt)
- **Recovery email**: `supabase.auth.resetPasswordForEmail` → redirige a `/salon` → handler PASSWORD_RECOVERY en TenantContext
- **Superadmin acceso total**: `tenants_del_usuario()` retorna ALL tenants si rol='superadmin'. Cada nuevo negocio requiere INSERT en usuarios_tenant para Hugo.

### Datos y Seguridad

- **RLS activo en todas las tablas** — siempre con tenant_id
- **`service_role` key nunca en frontend** — solo Edge Functions o SECURITY DEFINER
- **confirmed_at** es columna generada — actualizar solo `email_confirmed_at`
- **pgcrypto** en Supabase vive en schema `extensions` — search_path debe incluirlo
- **Superadmin oculto en Accesos**: filtrar `rol !== 'superadmin'` en SalonAccesos

### UI

- **Inline CSS**: no Tailwind en componentes salon/ — variables `var(--bg)`, `var(--card)`, etc.
- **URL slug**: `SalonLogin.elegirSalon()` y `TenantPicker` siempre actualizan `?tenant=slug` en URL
- **Code splitting**: lazy imports con Suspense + ErrorBoundary en todos los módulos

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
- Para SQL nuevo: archivo `vXX_nombre.sql` con RLS + tenant_id
- Para UI: React + inline CSS, variables salon.css
- Para deploy: `git push` → Vercel auto-despliega. O `npx vercel --prod --yes` si urgente
- Para Edge Functions: `npx supabase functions deploy <nombre>` (requiere access token)
- Nunca omitir `.eq('tenant_id', tenant.id)` en queries
