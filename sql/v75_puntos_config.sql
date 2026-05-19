-- v75: Configuración de puntos de fidelidad por tenant
-- Agrega puntos_por_visita a tenants y puntos_canje_min
-- APLICAR EN: Supabase → SQL Editor

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS puntos_por_visita   INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS puntos_canje_min    INTEGER DEFAULT 50;

-- Comentario: puntos_por_visita = puntos que gana el cliente al completar una cita
-- puntos_canje_min = mínimo de puntos para poder canjear (ej. 50 pts = 1 servicio gratis)
