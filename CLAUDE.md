# Agendas Profesionales SaaS — Plano del Proyecto

## Objetivo
Plataforma SaaS multi-tenant de agendamiento profesional. Mismo patrón arquitectónico que el POS Deleite del Mar.

## Stack
- **Frontend:** React 19 + Vite + Tailwind CSS
- **Base de datos:** Supabase — proyecto `unpxoamfyushsbyyziyn`
- **URL Supabase:** https://unpxoamfyushsbyyziyn.supabase.co
- **Deploy:** Vercel (pendiente configurar)
- **Dev local:** `npm run dev` desde esta carpeta

## Verticales objetivo
1. Psicólogos / neuropsicólogos
2. Peluquerías / estética
3. Salud y Seguridad en el Trabajo (SSO)

## Módulos requeridos
| Módulo | Estado |
|--------|--------|
| Superadmin (tenants, pagos, planes) | Pendiente |
| Auth multi-tenant con RLS | Pendiente |
| Agenda por negocio (citas, disponibilidad) | Pendiente |
| Panel del profesional | Pendiente |
| Portal del paciente/cliente | Pendiente |
| Automatización Make.com + WhatsApp | Pendiente |

## Arquitectura de tablas (pendiente definir)
- `tenants` — cada negocio/profesional
- `usuarios_tenant` — relación usuario ↔ tenant con rol
- `servicios` — catálogo por tenant
- `profesionales` — agenda individual
- `citas` — reservas con estado
- `disponibilidad` — horarios por profesional

## Reglas obligatorias
- RLS activado en todas las tablas con datos de usuario
- Aislamiento por `tenant_id` en todas las políticas
- Solo `anon` key en frontend; secretos en Edge Functions

## Estado actual (2026-04-25)
- Scaffolding React+Vite creado
- Supabase proyecto creado, sin tablas aún
- Pendiente: definir esquema de BD y arquitectura de auth

## Cómo trabajar con Claude
Iniciar con: `Contexto: Agendas SaaS, quiero [objetivo específico hoy]`
- Para BD: pedir SQL directo para Supabase con RLS incluido
- Para frontend: React + Tailwind, componentes funcionales
- Para flujos de automatización: invocar `/workflow-automation`
