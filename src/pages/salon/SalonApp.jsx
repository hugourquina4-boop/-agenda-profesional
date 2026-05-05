import { useState, Suspense, lazy } from 'react'
import SalonLayout from '../../layouts/SalonLayout'
import { useTenant } from '../../context/TenantContext'
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
const SalonAccesos    = lazy(() => import('./SalonAccesos'))

// Lazy stubs for sections not yet built
function Placeholder({ titulo }) {
  return (
    <div style={{ padding:'0 16px' }}>
      <div className="sp-empty">
        <span className="sp-empty-icon">🚧</span>
        <p className="sp-empty-title">{titulo}</p>
        <p className="sp-empty-sub">Módulo en construcción</p>
      </div>
    </div>
  )
}

function PageLoader() {
  return (
    <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
      <div className="sp-spinner" />
    </div>
  )
}

export default function SalonApp() {
  const { tenant, loading, recargar } = useTenant()
  const [page,         setPage]         = useState('hoy')
  const [nuevaCitaOpen,setNuevaCitaOpen]= useState(false)
  const [refreshKey,   setRefreshKey]   = useState(0)

  function handleNavigate(key) { setPage(key) }
  function handleNuevaCita()   { setNuevaCitaOpen(true) }
  function handleCitaCreada()  { setRefreshKey(k => k + 1); setPage('hoy') }

  if (loading) return <PageLoader />
  if (!tenant) return <SalonLogin onLogin={recargar} />

  function renderPage() {
    switch (page) {
      case 'hoy':        return <SalonDashboard key={refreshKey} />
      case 'agenda':     return <SalonAgenda />
      case 'clientes':   return <SalonClientes />
      case 'equipo':     return <SalonEquipo />
      case 'servicios':  return <SalonServicios />
      case 'caja':       return <SalonCaja />
      case 'comisiones': return <SalonComisiones />
      case 'analytics':  return <SalonAnalytics />
      case 'accesos':    return <SalonAccesos />
      case 'config':     return <SalonConfig />
      default:           return <SalonDashboard key={refreshKey} />
    }
  }

  return (
    <SalonLayout page={page} onNavigate={handleNavigate} onNuevaCita={handleNuevaCita}>
      <Suspense fallback={<PageLoader />}>
        {renderPage()}
      </Suspense>

      {/* Nueva cita sheet */}
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
