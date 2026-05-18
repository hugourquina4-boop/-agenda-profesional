-- v68: descuento automático de stock al completar una cita
-- Cuando citas.estado cambia a 'completada', descuenta los insumos
-- definidos en servicio_insumos del inventario productos_salon.
-- La columna insumos_descontados previene doble descuento si se reenvía el UPDATE.

-- Columna de control para evitar doble descuento
ALTER TABLE citas ADD COLUMN IF NOT EXISTS insumos_descontados BOOLEAN NOT NULL DEFAULT false;

-- Función del trigger (SECURITY DEFINER para poder escribir productos_salon
-- independientemente del rol del usuario que complete la cita)
CREATE OR REPLACE FUNCTION public.fn_descontar_insumos_cita()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Solo actuar cuando el estado cambia A 'completada' y aún no se descontó
  IF NEW.estado = 'completada'
     AND OLD.estado IS DISTINCT FROM 'completada'
     AND NOT COALESCE(NEW.insumos_descontados, false)
     AND NEW.servicio_id IS NOT NULL
  THEN
    -- Descontar cada insumo definido para este servicio
    UPDATE productos_salon p
    SET stock = GREATEST(0, p.stock - si.cantidad)
    FROM servicio_insumos si
    WHERE si.servicio_id = NEW.servicio_id
      AND si.producto_id = p.id
      AND si.tenant_id   = NEW.tenant_id;

    -- Marcar para no descontar de nuevo si el row se actualiza otra vez
    NEW.insumos_descontados := true;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE UPDATE para poder modificar NEW antes de persistir
DROP TRIGGER IF EXISTS trg_descontar_insumos ON citas;
CREATE TRIGGER trg_descontar_insumos
  BEFORE UPDATE ON citas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_descontar_insumos_cita();

-- Verificar:
-- SELECT trigger_name, event_manipulation, action_timing
-- FROM information_schema.triggers WHERE event_object_table = 'citas';

DO $$ BEGIN
  RAISE NOTICE '✓ v68: trigger trg_descontar_insumos activo en citas';
END $$;
