import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const [tenant,       setTenant]       = useState(null)
  const [rol,          setRol]          = useState(null)
  const [profesionalId,setProfesionalId]= useState(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try {
      // Dev bypass: ?tenant=<slug> o localStorage sp_dev_tenant
      const urlSlug = new URLSearchParams(window.location.search).get('tenant')
      if (urlSlug) localStorage.setItem('sp_dev_tenant', urlSlug)
      const devSlug = urlSlug || localStorage.getItem('sp_dev_tenant')
      if (devSlug) {
        const { data: t } = await supabase.from('tenants').select('*').eq('slug', devSlug).eq('activo', true).maybeSingle()
        if (t) { setTenant(t); setRol('admin'); setProfesionalId(null); setLoading(false); return }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setTenant(null); setRol(null); setProfesionalId(null); setLoading(false); return }

      const { data: ut } = await supabase
        .from('usuarios_tenant')
        .select('rol, tenant_id')
        .eq('user_id', user.id)
        .eq('activo', true)
        .maybeSingle()

      if (!ut) { setTenant(null); setRol(null); setProfesionalId(null); setLoading(false); return }

      const { data: t } = await supabase
        .from('tenants').select('*').eq('id', ut.tenant_id).maybeSingle()

      // Si es profesional, obtener su perfil vinculado
      let profId = null
      if (ut.rol === 'profesional') {
        const { data: prof } = await supabase
          .from('profesionales')
          .select('id')
          .eq('tenant_id', ut.tenant_id)
          .eq('user_id', user.id)
          .maybeSingle()
        profId = prof?.id || null
      }

      setTenant(t || null)
      setRol(ut.rol)
      setProfesionalId(profId)
    } catch (e) {
      console.error('[TenantContext]', e)
      setTenant(null); setRol(null); setProfesionalId(null)
    }
    setLoading(false)
  }

  return (
    <TenantContext.Provider value={{ tenant, rol, profesionalId, loading, recargar: cargar }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  return useContext(TenantContext)
}
