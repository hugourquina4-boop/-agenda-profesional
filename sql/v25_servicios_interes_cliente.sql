-- v25: Agrega servicios_interes a clientes_agenda
-- Permite registrar qué servicios prefiere o solicita cada cliente.

ALTER TABLE clientes_agenda
  ADD COLUMN IF NOT EXISTS servicios_interes TEXT;

COMMENT ON COLUMN clientes_agenda.servicios_interes IS 'Servicios de interés o preferidos del cliente (texto libre, ej: Tinte, Corte)';
