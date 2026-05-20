# Salón Pro — Roadmap, Análisis Competitivo y Proyección Autónoma

> Versión 2026-05-20 · v1.4-dev

---

## 1. Análisis Competitivo — Apps de Peluquería y Barbería Top

| Funcionalidad | **Salón Pro** | WeiBook (weibook.co) | Fresha | Booksy | Vagaro | GlossGenius |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Agenda multi-profesional** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Vista horizontal timeline** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Portal de reservas públicas** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Pagos en línea (Wompi/Stripe)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Multi-sede** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Comisiones + planilla** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Informe gerencial P&L** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **PDFs con membrete de marca** | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| **Inventario + descuento automático** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Proveedores + órdenes de compra** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Caja con cierre del día (Z)** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Préstamos a clientes** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Programa de puntos de fidelidad** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **WhatsApp automático (recordatorios)** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Bóveda de contraseñas** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Búsqueda global Ctrl+K** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Analytics: heatmap + MoM trend** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Historial clínico / notas paciente** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **App nativa (iOS/Android)** | PWA+TWA | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Precio Colombia** | $60K–140K COP | ~$90K COP | Gratis+comisión | $80K COP | USD $25+ | USD $24 |
| **Self-service trial** | ✅ 15 días | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Multi-tenant SaaS** | ✅ | ❌ (por negocio) | ❌ | ❌ | ❌ | ❌ |

### Ventajas diferenciadoras de Salón Pro

- **Precio local COP** — sin fricción de cambio de divisa, pagos con Nequi/Bancolombia
- **WhatsApp nativo** — recordatorios y confirmaciones vía WA, no SMS/email (canal dominante en Colombia)
- **Informe P&L gerencial** — funcionalidad típica de ERPs, no de apps de agenda
- **Órdenes de compra a proveedores** — diferenciador único en el segmento
- **Préstamos a clientes y estado de cuenta** — cubre realidad financiera del sector informal
- **SaaS multi-tenant real** — Hugo gestiona todos los negocios desde un panel, sin instalaciones

### Brechas a cerrar (vs competencia)

| Brecha | Impacto | Esfuerzo |
|--------|---------|---------|
| App nativa (Play Store / App Store) | Alto — clientes piden "app" | Medio — TWA lista, pendiente SHA-256 |
| Dominio propio (salonpro.co / .app) | Alto — credibilidad | Bajo — compra + DNS |
| Historial de notas clínicas / trichológicas | Medio — diferenciador bienestar | Medio |
| Recordatorio por email además de WA | Bajo — canal secundario | Bajo |
| Widget de reservas embebible (iframe) | Medio — web del cliente | Medio |

---

## 2. Mejoras de Diseño Implementadas — PDFs con Membrete de Marca

### Módulo `src/lib/pdfBrand.js`

Utilidad compartida que unifica el diseño de todos los PDFs del sistema.

#### Estructura del encabezado (64mm total)

```
┌─────────────────────────────────────────────────────┐  10mm
│ ██ NOMBRE DEL SALÓN                   SALÓN PRO ··· │  barra oscura #1a1a1a
├─────────────────────────────────────────────────────┤
│ ▌  ●  Glamour Studio                                │  5mm barra color accent
│    📍 Bogotá · 📞 321-xxx · 📸 @glamour             │  info contacto
│                          [ DOCUMENTO OFICIAL ]      │  chip brand
├─────────────────────────────────────────────────────┤  1mm separador color
│              TÍTULO DEL REPORTE                     │  20mm banda título
│              Subtítulo · Período · Fecha            │
└─────────────────────────────────────────────────────┘  0.7mm borde color
  Contenido comienza en Y = 72mm
```

#### Encabezado de páginas de continuación (16mm)

```
┌─────────────────────────────────────────────────────┐  8mm
│ ██ NOMBRE DEL SALÓN        TÍTULO · Continuación    │  barra oscura compacta
└─────────────────────────────────────────────────────┘  1mm línea color
  Contenido en Y = 16mm
```

#### Pie de página (Y = 281mm)

```
──────── color line ───────────────────────────────────
  Pág. X       SALÓN · TÍTULO       Salón Pro · salonpro.app
```

### PDFs actualizados con membrete

| PDF | Módulo | Funciones |
|-----|--------|-----------|
| Cierre de Caja (Z) | SalonCaja.jsx | `descargarCierre()` |
| Reporte de Caja | SalonCaja.jsx | `descargarPDF()` |
| Planilla Colectiva | SalonComisiones.jsx | `descargarPlanillaColectiva()` |
| Liquidación Individual | SalonComisiones.jsx | `descargarPDFProf()` |
| Historial de Cliente | SalonClientes.jsx | PDF en tab Historial |
| Orden de Compra | SalonProveedores.jsx | PDF por pedido |
| Reporte Analytics Mensual | SalonAnalytics.jsx | `descargarPDF()` |
| Informe de Gestión Financiera | SalonAnalytics.jsx | `exportarPDFGerencial()` |

---

## 3. Proyección — Optimización y Funcionamiento Autónomo

### Fase 1 — Estabilización operativa (mes 1–2)

**Objetivo:** 5 negocios pagando regularmente.

| Acción | Estado | Responsable |
|--------|--------|-------------|
| Wompi: activar clave integridad + webhook | Pendiente Hugo | Hugo |
| Edge Functions WA: deploy cumpleaños + resumen | Pendiente Hugo | Hugo |
| Dominio salonpro.co o salonpro.app | Pendiente compra | Hugo |
| Play Store TWA: SHA-256 de PWA Builder | Pendiente build | Hugo |
| Verificar 3 negocios activos (glamour, jess, barbanegra) | Activo | Sistema |

**Automatizaciones activas al completar:**
- Recordatorio WA 24h antes de cada cita (pg_cron cada hora)
- Recordatorio WA 1h antes de cada cita
- Felicitación WA en cumpleaños (9am diario)
- Resumen del día al dueño (9pm diario)
- Bloqueo automático por vencimiento de suscripción

### Fase 2 — Crecimiento SaaS (mes 3–6)

**Objetivo:** 20 negocios activos · MRR $1.5M COP.

| Componente | Descripción |
|------------|-------------|
| **Self-service** | Trial 15 días activo en `/salon-registro` — sin intervención de Hugo para onboarding |
| **Landing page** | Marketing en `/` con CTA → `/salon-registro` |
| **Cobros automáticos Wompi** | Links de suscripción mensual por plan; webhook actualiza fecha_vencimiento |
| **Suspensión automática** | BD bloquea suscripciones vencidas vía `mi_tenant_id()` en RLS |
| **Panel superadmin** | Hugo monitorea KPIs, registra pagos, activa/suspende desde superadmin.html |
| **WA de bienvenida** | Al crear trial → Edge Function envía WA con credenciales + tutorial |
| **Seguimiento trial** | A los 7 días: WA automático con logros ("Ya tienes 12 citas agendadas") |

### Fase 3 — Autonomía completa (mes 6–12)

**Objetivo:** El sistema opera sin intervención manual para negocios estándar.

```
Cliente → Landing → Registro self-service
       → Trial 15 días activo automáticamente
       → WA onboarding D+0, D+7, D+13
       → Cobro Wompi D+15 (link de suscripción)
       → Si paga: fecha_vencimiento +30 días automático (webhook)
       → Si no paga: bloqueo automático D+16 (RLS)
       → WA recordatorio de pago D+14, D+16
       → Si reactiva: WA bienvenida de vuelta
```

**Métricas a monitorear:**
- Conversion trial → pago (objetivo: >40%)
- Churn mensual (objetivo: <10%)
- Tiempo de onboarding (objetivo: <30min desde registro hasta primera cita)
- NPS proxy: uso de módulos (salones que usan ≥5 módulos tienen menor churn)

### Fase 4 — Verticales adicionales (mes 12+)

| Vertical | Diferenciador |
|----------|---------------|
| Centros de estética | Consentimientos + fotos antes/después |
| Spas y bienestar | Membresías + paquetes por sesión |
| Psicología y salud | Historial clínico, cuestionarios CONNERS/16PF integrados |
| Barbería premium | Gestión de pedidos de insumos por WhatsApp |

---

## 4. Stack Técnico — Sostenibilidad

| Componente | Tecnología | Costo actual |
|------------|-----------|--------------|
| Frontend | React 19 + Vite + Vercel | $0 (plan hobby) |
| Base de datos + Auth | Supabase (unpxoamfyushsbyyziyn) | $0 (plan free, límites holgados) |
| Edge Functions + Crons | Supabase Edge + pg_cron | Incluido |
| WhatsApp | Whapi.cloud / Meta API | ~$10 USD/mes |
| Pagos | Wompi (comisión por transacción) | Sin costo fijo |
| Dominio | salonpro.co / salonpro.app | ~$30 USD/año |
| Play Store | Google Play (one-time) | $25 USD |

**Escenario 5 negocios pagando:** Ingresos $400K COP/mes · Costos plataforma <$100K · Margen >75%

**Escenario 20 negocios pagando:** Ingresos $1.5M COP/mes · Costos plataforma <$200K · Margen >85%

---

## 5. Próximas Acciones Inmediatas

### Hugo debe hacer (requiere credenciales/compra):

1. **Wompi:** Ingresar clave integridad en Supabase + configurar webhook URL `https://project-gnyy8.vercel.app/api/wompi-webhook` + crear 3 links de pago (Starter/Pro/Ultra) + add env vars en Vercel + deploy Edge Function
2. **Deploy WA crons:** `npx supabase functions deploy cumpleanos-clientes resumen-diario`
3. **Dominio:** Comprar `salonpro.co` (Namecheap ~$12 USD) → apuntar DNS a Vercel → actualizar twa-manifest.json + assetlinks.json
4. **Play Store TWA:** Abrir pwabuilder.com → ingresar URL del dominio → descargar APK → actualizar SHA-256 en assetlinks.json → deploy

### Código listo para deploy ahora:

```bash
cd "d:\Proyectos antrigravity\AGENDAS\agenda-saas-v2"
git add src/lib/pdfBrand.js \
        src/pages/salon/SalonCaja.jsx \
        src/pages/salon/SalonComisiones.jsx \
        src/pages/salon/SalonClientes.jsx \
        src/pages/salon/SalonProveedores.jsx \
        src/pages/salon/SalonAnalytics.jsx \
        src/pages/public/LandingPage.jsx \
        src/App.jsx \
        public/logo192.png public/logo512.png \
        public/apple-touch-icon.png \
        public/.well-known/assetlinks.json \
        twa-manifest.json \
        docs/ROADMAP_SALON_PRO.md
git commit -m "feat: PDF membrete de marca + landing page + PWA icons + TWA config"
npx vercel deploy --prod --yes
```
