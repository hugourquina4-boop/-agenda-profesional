import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const TenantContext = createContext(null)

// tenant_id elegido persiste entre recargas
const KEY_TENANT = 'salon_tenant_id'

export function TenantProvider({ children }) {
  const [user,          setUser]          = useState(undefined)  // undefined = cargando
  const [tenant,        setTenant]        = useState(null)
  const [rol,           setRol]           = useState(null)
  const [profesionalId, setProfesionalId] = useState(null)
  const [todosTenants,  setTodosTenants]  = useState([])         // para superadmin
  const [loading,       setLoading]       = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u || null)
      if (!u) { resetState(); setLoading(false); return }

      // Obtener todos los tenants del usuario vía función segura
      const { data: tenants } = await supabase.rpc('tenants_del_usuario')
      const lista = tenants || []
      setTodosTenants(lista)

      if (lista.length === 0) {
        resetState(); setUser(u); setLoading(false); return
      }

      // Elegir tenant: URL slug > localStorage > primero de lista
      const slugUrl  = new URLSearchParams(window.location.search).get('tenant')
      const guardado = localStorage.getItem(KEY_TENANT)
      const entrada  = (slugUrl  && lista.find(t => t.slug === slugUrl))
                    || (guardado && lista.find(t => t.tenant_id === guardado))
                    || lista[0]

      await cargarTenant(entrada.tenant_id, entrada.rol, u)
    } catch (e) {
      console.error('[TenantContext]', e)
      resetState()
    }
    setLoading(false)
  }, [])

  async function cargarTenant(tenantId, rolUsuario, u) {
    const { data: t } = await supabase
      .from('tenants').select('*').eq('id', tenantId).maybeSingle()

    let profId = null
    if (rolUsuario === 'profesional' && u) {
      const { data: prof } = await supabase
        .from('profesionales')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_id', u.id)
        .maybeSingle()
      profId = prof?.id || null
    }

    localStorage.setItem(KEY_TENANT, tenantId)
    setTenant(t || null)
    setRol(rolUsuario)
    setProfesionalId(profId)
  }

  // Selector de tenant para superadmin (o usuario con múltiples negocios)
  async function seleccionarTenant(tenantId) {
    const entrada = todosTenants.find(t => t.tenant_id === tenantId)
    if (!entrada) return
    setLoading(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    await cargarTenant(entrada.tenant_id, entrada.rol, u)
    setLoading(false)
  }

  function resetState() {
    setUser(null); setTenant(null); setRol(null)
    setProfesionalId(null); setTodosTenants([])
  }

  useEffect(() => {
    cargar()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT')       { resetState(); setLoading(false) }
      else if (event === 'PASSWORD_RECOVERY') { setPasswordRecovery(true); setLoading(false) }
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') cargar()
    })
    return () => subscription.unsubscribe()
  }, [cargar])

  const esSuperadmin = rol === 'superadmin'
  const esProfesional = rol === 'profesional'

  return (
    <TenantContext.Provider value={{
      user, tenant, rol, profesionalId,
      todosTenants, esSuperadmin, esProfesional,
      loading, recargar: cargar, seleccionarTenant,
      passwordRecovery, setPasswordRecovery,
    }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  return useContext(TenantContext)
}
