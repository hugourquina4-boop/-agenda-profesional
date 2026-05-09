import { useState, Suspense, lazy } from 'react'
import SalonLayout from '../../layouts/SalonLayout'
import { useTenant } from '../../context/TenantContext'
import { supabase } from '../../lib/supabase'
import SalonLogin from './SalonLogin'
import '../../salon.css'

const SalonDashboard  = lazy(() => import('./SalonDashboard'))
const SalonAgenda     = lazy(() => import('./SalonAgenda'))
const SalonClientes   = lazy(() => import('./SalonClientes'))
const SalonEquipo     = lazy(() => import('./SalonEquipo'))
const SalonServicios  = lazy(() => import('./SalonServicios'))
const SalonCaja       = lazy(() => import('./SalonCaja'))
const SalonNuevaCita  = lazy(() => import('./SalonNuevaCita'))
const SalonConfig     = lazy(() => import('./SalonConfig'))
const SalonComisiones = lazy(() => import('./SalonComisiones'))
const SalonAnalytics  = lazy(() => import('./SalonAnalytics'))
const SalonOrdenes    = lazy(() => import('./SalonOrdenes'))
const SalonInventario = lazy(() => import('./SalonInventario'))
const SalonAccesos    = lazy(() => import('./SalonAccesos'))
const SalonSuperadmin = lazy(() => import('./SalonSuperadmin'))

function PageLoader() {
  return (
    <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
      <div className="sp-spinner" />
    </div>
  )
}

// Selector de negocio para superadmin o usuarios con múltiples tenants
function TenantPicker({ todosTenants, onSelect }) {
  const [seleccionando, setSeleccionando] = useState(false)

  return (
    <div style={{
      minHeight:'100dvh', background:'var(--bg)', padding:'24px 16px 40px',
      display:'flex', flexDirection:'column',
    }}>
      {/* Fondo degradado */}
      <div style={{
        position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
        background:'radial-gradient(ellipse 70% 50% at 20% 30%, rgba(244,63,94,0.08) 0%, transparent 70%)',
      }} />

      <div style={{ maxWidth:520, margin:'0 auto', width:'100%', position:'relative', zIndex:1 }}>
        <div style={{ textAlign:'center', padding:'40px 0 32px' }}>
          <div style={{
            width:60, height:60, borderRadius:18,
            background:'linear-gradient(135deg, #f43f5e, #e11d48)',
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 16px', boxShadow:'0 8px 24px rgba(244,63,94,0.3)',
          }}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h1 style={{ fontFamily:'Outfit', fontWeight:900, fontSize:26,
            color:'var(--text)', marginBottom:6 }}>Salón Pro</h1>
          <p style={{ fontSize:14, color:'var(--text-3)' }}>
            Selecciona el negocio a gestionar
          </p>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {todosTenants.map(t => (
            <button
              key={t.tenant_id}
              disabled={seleccionando}
              onClick={async () => {
                setSeleccionando(true)
                await onSelect(t.tenant_id)
                setSeleccionando(false)
              }}
              style={{
                display:'flex', alignItems:'center', gap:14,
                padding:'16px 18px',
                background:'var(--card)', border:'1px solid var(--border)',
                borderRadius:16, cursor:'pointer', textAlign:'left', width:'100%',
                transition:'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = t.color_primario || '#f43f5e'
                e.currentTarget.style.boxShadow = `0 4px 16px ${t.color_primario || '#f43f5e'}22`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{
                width:46, height:46, borderRadius:13, flexShrink:0,
                background:`linear-gradient(135deg, ${t.color_primario || '#f43f5e'}, ${t.color_primario || '#f43f5e'}88)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'Outfit', fontWeight:800, fontSize:20, color:'#fff',
              }}>
                {t.nombre[0].toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'Outfit', fontWeight:700, fontSize:15,
                  color:'var(--text)', marginBottom:2 }}>{t.nombre}</div>
                <div style={{ fontSize:12, color:'var(--text-3)' }}>
                  {t.ciudad || t.vertical || '—'} · {t.rol}
                </div>
              </div>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
                stroke="var(--text-3)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            marginTop:24, width:'100%', padding:'12px', borderRadius:14,
            background:'transparent', border:'1px solid var(--border)',
            color:'var(--text-3)', fontWeight:600, fontSize:13, cursor:'pointer',
          }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default function SalonApp() {
  const { tenant, loading, recargar, todosTenants, seleccionarTenant, esSuperadmin } = useTenant()
  const [page,          setPage]          = useState('hoy')
  const [nuevaCitaOpen, setNuevaCitaOpen] = useState(false)
  const [refreshKey,    setRefreshKey]    = useState(0)

  function handleNavigate(key) { setPage(key) }
  function handleNuevaCita()   { setNuevaCitaOpen(true) }
  function handleCitaCreada()  { setRefreshKey(k => k + 1); setPage('hoy') }

  if (loading) return <PageLoader />

  // No autenticado → mostrar login
  if (!tenant && todosTenants.length === 0) {
    return <SalonLogin onLogin={recargar} />
  }

  // Autenticado pero con múltiples negocios y ninguno seleccionado aún
  // (no debería ocurrir normalmente, TenantContext selecciona automáticamente)
  if (!tenant && todosTenants.length > 0) {
    return <TenantPicker todosTenants={todosTenants} onSelect={seleccionarTenant} />
  }

  function renderPage() {
    switch (page) {
      case 'hoy':        return <SalonDashboard key={refreshKey} />
      case 'agenda':     return <SalonAgenda />
      case 'clientes':   return <SalonClientes />
      case 'equipo':     return <SalonEquipo />
      case 'servicios':  return <SalonServicios />
      case 'ordenes':    return <SalonOrdenes />
      case 'inventario': return <SalonInventario />
      case 'caja':       return <SalonCaja />
      case 'comisiones': return <SalonComisiones />
      case 'analytics':  return <SalonAnalytics />
      case 'accesos':    return <SalonAccesos />
      case 'config':     return <SalonConfig />
      case 'superadmin': return (
        <SalonSuperadmin onGestionar={async (tid) => {
          await seleccionarTenant(tid)
          setPage('hoy')
        }} />
      )
      default:           return <SalonDashboard key={refreshKey} />
    }
  }

  return (
    <SalonLayout
      page={page}
      onNavigate={handleNavigate}
      onNuevaCita={handleNuevaCita}
      todosTenants={todosTenants}
      onCambiarTenant={seleccionarTenant}
    >
      <Suspense fallback={<PageLoader />}>
        {renderPage()}
      </Suspense>

      {nuevaCitaOpen && (
        <Suspense fallback={null}>
          <SalonNuevaCita
            onClose={() => setNuevaCitaOpen(false)}
            onCreada={handleCitaCreada}
          />
        </Suspense>
      )}
    </SalonLayout>
  )
}
