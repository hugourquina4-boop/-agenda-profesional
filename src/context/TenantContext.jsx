import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const TenantContext = createContext(null)

// tenant_id elegido persiste entre recargas
const KEY_TENANT = 'salon_tenant_id'

// Permisos por defecto si la BD aún no retornó datos (evita flash de nav vacía)
const PERMISOS_DEFAULT = {
  contable:    { hoy:true,  agenda:false, clientes:false, servicios:false, ordenes:false, caja:true,  comisiones:true,  inventario:true,  proveedores:true,  mensajeria:false, analytics:true,  equipo:false, accesos:false, config:false },
  recepcion:   { hoy:true,  agenda:true,  clientes:true,  servicios:true,  ordenes:true,  caja:false, comisiones:false, inventario:false, proveedores:false, mensajeria:true,  analytics:false, equipo:false, accesos:false, config:false },
  profesional: { hoy:true,  agenda:true,  clientes:true,  servicios:true,  ordenes:true,  caja:false, comisiones:false, inventario:false, proveedores:false, mensajeria:false, analytics:false, equipo:false, accesos:false, config:false },
}

export function TenantProvider({ children }) {
  const [user,          setUser]          = useState(undefined)  // undefined = cargando
  const [tenant,        setTenant]        = useState(null)
  const [rol,           setRol]           = useState(null)
  const [profesionalId, setProfesionalId] = useState(null)
  const [todosTenants,  setTodosTenants]  = useState([])         // para superadmin
  const [permisos,      setPermisos]      = useState({})
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

    // Cargar permisos por rol (para filtrar nav y config del admin)
    let pData = {}
    const { data: pResult } = await supabase.rpc('get_permisos_tenant', { p_tenant_id: tenantId })
    if (pResult && !pResult.error) pData = pResult

    localStorage.setItem(KEY_TENANT, tenantId)
    setTenant(t || null)
    setRol(rolUsuario)
    setProfesionalId(profId)
    setPermisos(pData)
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
    setProfesionalId(null); setTodosTenants([]); setPermisos({})
  }

  const recargarPermisos = useCallback(async () => {
    if (!tenant) return
    const { data } = await supabase.rpc('get_permisos_tenant', { p_tenant_id: tenant.id })
    if (data && !data.error) setPermisos(data)
  }, [tenant])

  useEffect(() => {
    cargar()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT')       { resetState(); setLoading(false) }
      else if (event === 'PASSWORD_RECOVERY') { setPasswordRecovery(true); setLoading(false) }
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') cargar()
    })
    return () => subscription.unsubscribe()
  }, [cargar])

  const esSuperadmin  = rol === 'superadmin' || todosTenants.some(t => t.rol === 'superadmin')
  const esProfesional = rol === 'profesional'

  const tieneAcceso = useCallback((modulo) => {
    if (!rol) return false
    if (rol === 'superadmin' || rol === 'admin') return true
    const map = (permisos[rol] && Object.keys(permisos[rol]).length > 0)
      ? permisos[rol]
      : (PERMISOS_DEFAULT[rol] || {})
    return map[modulo] ?? false
  }, [rol, permisos])

  return (
    <TenantContext.Provider value={{
      user, tenant, rol, profesionalId,
      todosTenants, esSuperadmin, esProfesional,
      permisos, tieneAcceso, recargarPermisos,
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
