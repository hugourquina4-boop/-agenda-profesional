# Reporte del Grafo de Conocimiento — Salón Pro SaaS (v1.5)

Este documento contiene un resumen completo de la arquitectura, dependencias y reglas de negocio críticas de tu proyecto **Salón Pro SaaS**, extraído directamente de la estructura del código y los esquemas de base de datos. Sirve como capa de memoria optimizada para evitar la lectura redundante de archivos.

---

## 1. Reglas Fundamentales de Arquitectura Multi-Tenant

El sistema está diseñado bajo un modelo **multi-tenant aislado**. Cada negocio (o salón/estilista) tiene sus propios datos exclusivos y ningún usuario de un tenant puede acceder a información de otro.

- **Identificación:** Toda consulta e inserción a la base de datos Supabase debe llevar el filtro `.eq('tenant_id', tenant.id)`. El ID de tenant activo proviene de `TenantContext` y se propaga mediante la URL en el parámetro `?tenant=slug`.
- **Aislamiento en Base de Datos (RLS):** Las políticas de seguridad a nivel de fila (Row Level Security - RLS) en PostgreSQL/Supabase comprueban que el `tenant_id` de la fila coincida con el tenant asociado al usuario autenticado (`auth.uid()`) mediante la tabla `usuarios_tenant`.

---

## 2. Jerarquía de Roles y Seguridad

| Rol | Alcance de Permisos |
| :--- | :--- |
| **`superadmin`** | Hugo Urquina. Acceso global a todos los tenants, panel maestro (`superadmin.html`), gestión de suscripciones, pagos y restablecimiento de claves. |
| **`admin`** | Propietario del salón. Acceso total dentro de su tenant: comisiones, caja, equipo, servicios y configuración general. |
| **`contable`** | Consulta de movimientos de caja, comisiones de colaboradores, inventario y egresos. No tiene permisos de configuración ni accesos de personal. |
| **`recepcion`** | Gestión operativa diaria: agenda de citas, base de clientes, servicios y órdenes de cobro. |
| **`profesional`** | Vista restringida a su propia agenda de turnos, clientes asignados y comisiones individuales. |

---

## 3. Mapeo de Archivos Clave del Frontend (`src/`)

### Contextos y Layouts
- **[TenantContext.jsx](file:///d:/Proyectos%20antrigravity/AGENDAS/agenda-saas-v2/src/context/TenantContext.jsx):** Administra la carga del tenant actual leyendo el slug de la URL, valida los permisos del usuario de Supabase y define la función `tieneAcceso()` para controlar el renderizado de vistas según roles.
- **[SalonLayout.jsx](file:///d:/Proyectos%20antrigravity/AGENDAS/agenda-saas-v2/src/layouts/SalonLayout.jsx):** Esqueleto visual de la aplicación. Renderiza el panel de navegación lateral (sidebar) dividido en secciones operativas (Inicio, Agenda, Clientes), de gestión (Equipo, Servicios, Órdenes, etc.) y de administración de sistema (Sedes, Accesos, Configuración).

### Módulos Principales (en `src/pages/salon/`)
1. **[SalonAgenda.jsx](file:///d:/Proyectos%20antrigravity/AGENDAS/agenda-saas-v2/src/pages/salon/SalonAgenda.jsx):** Controla el libro de reservas. Implementa vistas diaria, semanal y mensual, colores de bloque por profesional, notas con auto-save y arrastrar y soltar (drag & drop) para reagendar citas.
2. **[SalonCaja.jsx](file:///d:/Proyectos%20antrigravity/AGENDAS/agenda-saas-v2/src/pages/salon/SalonCaja.jsx):** Registro diario de ingresos y egresos, anulación de cobros y exportación a PDF/CSV del cuadre de caja (cierre de caja Z).
3. **[SalonComisiones.jsx](file:///d:/Proyectos%20antrigravity/AGENDAS/agenda-saas-v2/src/pages/salon/SalonComisiones.jsx):** Calcula comisiones y permite liquidar nóminas/planillas de colaboradores individuales aplicando deducciones y anticipos registrados.
4. **[SalonDashboard.jsx](file:///d:/Proyectos%20antrigravity/AGENDAS/agenda-saas-v2/src/pages/salon/SalonDashboard.jsx):** KPIs rápidos del día (citas hoy, ganancias, personal libre), aviso de renovación de suscripción, barra de onboarding checklist y cuadre rápido de citas completadas sin facturar.
5. **[SalonClientes.jsx](file:///d:/Proyectos%20antrigravity/AGENDAS/agenda-saas-v2/src/pages/salon/SalonClientes.jsx):** CRUD de clientes, historial de visitas exportable a PDF, tags de segmentación (VIP, STAR, etc.) y control de puntos de fidelidad.

---

## 4. Base de Datos Supabase (Tablas e Integridad)

- **`tenants`:** Almacena el perfil del salón, slug web, datos de contacto de Hugo, plan activo y `fecha_vencimiento`.
- **`usuarios_tenant`:** Vincula a los usuarios de Supabase Auth con los salones, especificando el rol asignado (`rol`) y si está `activo`.
- **`citas`:** Datos de los turnos agendados, hora de inicio/fin, servicio, cliente y profesional asociado, incluyendo campos como `sede_id` y `anticipo`.
- **`pagos`:** Transacciones cobradas en caja con detalle de método de pago (Wompi, PSE, Efectivo, Tarjeta), descuentos y propinas asociadas.
- **`productos_salon`:** Tabla de inventario. Incluye SKU (`codigo`), stock actual y mínimo, costo, precio de venta, marca y proveedor.

---

## 5. Recomendaciones de Optimización de Contexto (Ahorro de Tokens)

Cuando trabajes con este repositorio en el chat:
1. **No cargues archivos completos de código** si solo necesitas conocer las relaciones estructurales. En su lugar, haz referencia a este grafo.
2. **Verificación de Seguridad:** Recuerda que ninguna API key sensible (`service_role` o tokens DIAN/Wompi) debe declararse en archivos frontend. Utiliza siempre las funciones backend RPC de Supabase con `SECURITY DEFINER` o variables de entorno en Edge Functions.
