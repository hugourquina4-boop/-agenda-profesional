import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const [tenant, setTenant]   = useState(null)
  const [rol, setRol]         = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setTenant(null); setRol(null); setLoading(false); return }

      // Paso 1: obtener tenant_id y rol
      const { data: ut, error: e1 } = await supabase
        .from('usuarios_tenant')
        .select('rol, tenant_id')
        .eq('user_id', user.id)
        .eq('activo', true)
        .maybeSingle()

      if (e1) console.error('[TenantContext] usuarios_tenant:', e1.message)
      if (!ut) { setTenant(null); setRol(null); setLoading(false); return }

      // Paso 2: obtener datos del tenant
      const { data: t, error: e2 } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', ut.tenant_id)
        .maybeSingle()

      if (e2) console.error('[TenantContext] tenants:', e2.message)

      setTenant(t || null)
      setRol(ut.rol)
    } catch (e) {
      console.error('[TenantContext]', e)
      setTenant(null)
      setRol(null)
    }
    setLoading(false)
  }

  return (
    <TenantContext.Provider value={{ tenant, rol, loading, recargar: cargar }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  return useContext(TenantContext)
}
