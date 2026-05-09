# Salón Pro SaaS — Plan Estratégico y Base de Progresión

> Archivo de control para Claude Code. Actualizar al completar cada módulo.
> Stack: React 19 + Vite + Tailwind + Supabase (unpxoamfyushsbyyziyn) + Vercel
> URL prod: https://project-gnyy8.vercel.app
> Tenant demo: glamour-studio

---

## Estado del Sistema (actualizado 2026-05-08)

### ✅ MÓDULOS COMPLETOS Y EN PRODUCCIÓN

| Módulo | Archivo | Descripción |
|--------|---------|-------------|
| Auth — Login selector de salón | SalonLogin.jsx | Supabase Auth, selector multi-salón, recovery |
| Auth — TenantContext multi-tenant | TenantContext.jsx | getUser + tenants_del_usuario RPC, tenant picker, rol |
| Auth — Accesos y gestión de usuarios | SalonAccesos.jsx | Crear usuarios, reset contraseña, cambiar rol, suspender |
| Dashboard hoy | SalonDashboard.jsx | Timeline, stats ingresos, equipo libre/ocupado |
| Agenda mensual | SalonAgenda.jsx | Vista mensual color-coded, sheet detalle, cambio estado |
| Nueva cita (5 pasos) | SalonNuevaCita.jsx | Horarios, slots, anti-solapamiento |
| Portal público | SalonPortal.jsx | Reservas online, glassmorphism, footer WhatsApp |
| Servicios CRUD | SalonServicios.jsx | Precio, duración, categoría |
| Equipo CRUD + horarios | SalonEquipo.jsx | 7 días, fotos, upsert horarios |
| Clientes CRUD + historial | SalonClientes.jsx | Cumpleaños, servicios de interés, historial |
| Caja — Registro de cobros | SalonCaja.jsx | Tabla pagos, tabs Por cobrar/Cobrado, métodos pago |
| Comisiones — Reglas, liquidación y desempeño | SalonComisiones.jsx | % por profesional, liquidación quincenal, tab Desempeño con horas/ingresos/comisión |
| Órdenes en espera | SalonOrdenes.jsx | Grid tarjetas, nueva orden, cobrar orden → pagos → comisión |
| Analytics — KPIs y métricas | SalonAnalytics.jsx | v_kpis_mes, v_revenue_staff, v_retention, gráficos |
| Configuración del negocio | SalonConfig.jsx | Logo, color, WhatsApp, promo, link reservas, tipología, horario, slots, cancelación |

### SQL Aplicado en Supabase

```
SALON_SETUP_COMPLETO.sql  ✅ Schema base + seed glamour-studio
v9_dev_permisos.sql       ✅ GRANTs desarrollo
v10_tenants_update.sql    ✅ GRANT UPDATE ON tenants
v11_produccion_core.sql   ✅ Pagos, comisiones, eventos, triggers, analytics
v12_lista_espera.sql      ✅ Lista de espera
v13_storage_imagenes.sql  ✅ Storage Supabase
v14_owner_acceso_pago.sql ✅ Owner data + alertas pago
v15_tenants_plan.sql      ✅ Planes y suscripciones
v16 al v26               ✅ Eventos LTV, segmentación, loyalty, accesos, portal anon, multi-servicio
v27_auth_superadmin_fix  ✅ Fix accesos superadmin + constraint rol + nombre/email NOT NULL
v28_ordenes_desempeno    ✅ ordenes_espera, v_desempeno_prof, trigger updated_at
v29_inventario           ✅ productos_salon con RLS + trigger
v30_fotos_clientes       ⏳ PENDIENTE — tabla fotos_cliente para galería antes/después
v31_metas_profesionales  ⏳ PENDIENTE — columna meta_mensual en commission_rules
```

---

## Roadmap por Fases

### FASE 1 — Completar núcleo (En curso)

**Prioridad 1: Auth fix (v27) — CRÍTICO**
- [ ] Correr v27_auth_superadmin_fix.sql en Supabase
- [ ] Verificar login de Hugo en nuevo dispositivo
- [ ] Verificar creación de usuarios desde SalonAccesos
- [ ] Verificar reset de contraseña funciona

**Prioridad 2: Agenda visual por colaborador**
- [ ] Nueva vista "Día" en SalonAgenda.jsx
- [ ] Grid columnas por profesional, bloques proporcionales a duración
- [ ] Toggle Mes / Semana / Día
- [ ] Panel desplegable al click en cita (estado + pago + acciones)

**Prioridad 3: Órdenes en espera**
- [ ] SQL: tabla ordenes_espera (tenant_id, cliente_id, profesional_id, items JSONB, total, estado)
- [ ] SalonOrdenes.jsx: grid de tarjetas, botón "Pagar orden"
- [ ] Flujo: crear orden → cobrar → registrar en pagos → calcular comisión
- [ ] Integrar en SalonLayout sidebar

**Prioridad 4: QR de reservas**
- [ ] `npm install qrcode.react`
- [ ] En SalonConfig: mostrar QR del link `/reservar/:slug`
- [ ] Botón "Descargar QR" como PNG

**Prioridad 5: PDF de informes**
- [ ] `npm install html2canvas jspdf`
- [ ] En SalonCaja y SalonAnalytics: botón "Descargar PDF"
- [ ] Resumen del período: ingresos, top servicios, top profesionales

### FASE 2 — Expansión de valor (Mes 2)

**Inventario de productos**
- [ ] SQL: tabla productos_salon (tenant_id, nombre, categoria, precio_venta, precio_costo, stock, unidad, foto_url)
- [ ] SalonInventario.jsx: CRUD completo, valor de inventario
- [ ] Descuento de stock al registrar servicio (opcional)
- [ ] Categorías: capilar, color, tratamiento, retail

**Comisiones — Panel de desempeño por profesional**
- [ ] Vista por profesional: horas trabajadas, citas completadas, ingresos generados
- [ ] Comparación mes anterior
- [ ] Meta mensual configurable por profesional
- [ ] Export PDF de liquidación individual

**Configuración General**
- [ ] Horario del negocio (apertura/cierre)
- [ ] Tipología: salón, barbería, spa, uñas, estética (ajusta terminología)
- [ ] Duración mínima de cita (slot de agenda)
- [ ] Anticipación mínima para reservas online
- [ ] Mensaje de bienvenida en portal
- [ ] Política de cancelación (texto)

### FASE 3 — Diferenciadores (Mes 3-4)

**Recordatorios WhatsApp via n8n**
- [ ] Cuenta Whapi.cloud o Evolution API
- [ ] Workflow n8n: schedule cada hora → generar_recordatorios() → enviar → marcar procesado
- [ ] Template mensaje 24h: "Hola {nombre}, mañana tienes cita..."
- [ ] Template mensaje 1h: "Hola {nombre}, en 1 hora tienes..."

**Fotos: galería antes/después por cliente**
- [ ] Tabla fotos_cliente (cliente_id, tenant_id, foto_url, tipo, notas, created_at)
- [ ] En SalonClientes: sección galería por cliente
- [ ] Upload desde móvil (cámara)

**Precios dinámicos por demanda (DIFERENCIADOR ÚNICO)**
- [ ] SQL: tabla reglas_precio_dinamico (tenant_id, dia_semana[], hora_inicio, hora_fin, multiplicador)
- [ ] En portal de reservas: precio base × multiplicador según horario
- [ ] UI de configuración: calendario de precios, porcentaje de incremento
- [ ] Badge "Horario premium" en slots de alta demanda

### FASE 4 — SaaS escalable (Mes 5+)

**Superadmin — Onboarding de negocios**
- [ ] Crear tenant desde superadmin
- [ ] Generar credenciales del dueño automáticamente
- [ ] Asignar plan contratado
- [ ] Email de bienvenida automático
- [ ] Dashboard de todos los negocios: ARR, MRR, churn

**Multi-ubicación**
- [ ] Un negocio con múltiples sedes
- [ ] Staff puede trabajar en varias sedes
- [ ] Agenda por sede

**Bot WhatsApp (whatsapp-agentkit)**
- [ ] Recibe mensajes → Claude procesa → agenda citas
- [ ] Consulta disponibilidad en Supabase
- [ ] Confirmar / cancelar / reagendar

---

## Decisiones Técnicas (No cambiar sin justificación)

### Auth
- **Una sesión por dispositivo** — Supabase Auth maneja tokens JWT en localStorage
- **Crear usuarios nuevos**: `supabaseTemp.auth.signUp()` (cliente temporal sin persistSession)
  + `supabase.rpc('crear_usuario_tenant', {...})` (SECURITY DEFINER en DB)
- **Reset de contraseña**: `supabase.auth.resetPasswordForEmail(email)` — envía email automático
- **Superadmin**: rol 'superadmin' en `usuarios_tenant`. TenantContext usa `tenants_del_usuario()` RPC
  para obtener todos sus tenants. Puede cambiar entre negocios con `seleccionarTenant(id)`

### Datos y Seguridad
- **RLS activo en todas las tablas** — siempre con tenant_id
- **`service_role` key nunca en frontend** — solo Edge Functions o SQL SECURITY DEFINER
- **Políticas dev_\* en production**: ELIMINAR antes de go-live real (v9 y otras)
- **`tenants_del_usuario()`**: función SECURITY DEFINER que retorna tenants del usuario logueado

### UI y Layout
- **Inline CSS**: no Tailwind en componentes salon/ — usar variables CSS del sistema (`var(--bg)`, `var(--card)`, etc.)
- **Dark mode**: clase `dark` en `<html>`, variables CSS en salon.css
- **Mobile-first**: 100dvh, sin sticky headers problemáticos, scroll nativo
- **Supabase queries**: siempre `.eq('tenant_id', tenant.id)` — nunca omitir el filtro de tenant

### Pagos
- **Nivel 1 (actual)**: registro manual en tabla `pagos` vía SalonCaja
- **Trigger comisión**: INSERT pendiente → UPDATE pagado → `trg_comision_al_pagar` calcula automático
- **Nivel 2 (futuro)**: Wompi — solo Edge Functions, nunca secretos en frontend

---

## Contexto de Negocio

- **Hugo Urquina** (hugourquina@gmail.com) = Superadmin de toda la plataforma
- **Tenant demo activo**: glamour-studio (para desarrollo y pruebas)
- **Modelo de negocio**: SaaS B2B para salones de belleza colombianos
- **Competencia referencia**: WeiBook (weibook.co) — ver capturas para UX ideas
- **Monetización**: planes mensuales por tenant (starter/pro/ultra)
- **Meta corto plazo**: 5 salones pagando antes de agregar features avanzadas

---

## Cómo Trabajar con Claude

Iniciar sesión con:
```
Contexto: Salón Pro SaaS. Quiero trabajar en [módulo específico].
Estado actual: [lo que está pendiente según este CLAUDE.md]
```

- Para SQL: pedir archivo `vXX_nombre.sql` con RLS incluido
- Para UI: React + inline CSS, variables salon.css, misma estructura que otros módulos
- Para seguridad: aplicar checklist del CLAUDE.md raíz del workspace
- Para deploy: `npm run build` → push → Vercel despliega automáticamente
