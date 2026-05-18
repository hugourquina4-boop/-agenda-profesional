-- v56_descuentos_pagos.sql
-- Añade campos de descuento/cortesía a la tabla pagos.
--
-- tipo_descuento valores:
--   'descuento'   → monto rebajado del total (cliente paga precio - descuento)
--   'cortesia'    → cortesía completa, monto = 0

ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS descuento     NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_descuento TEXT;

-- No requiere nueva política RLS — pagos ya tiene RLS con políticas tenant_id vigentes.
