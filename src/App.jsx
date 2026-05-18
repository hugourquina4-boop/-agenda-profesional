import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { TenantProvider, useTenant } from './context/TenantContext'
import Login from './pages/Login'
import SalonApp from './pages/salon/SalonApp'
import Registro from './pages/public/Registro'
import SalonPortal from './pages/public/SalonPortal'
import TenantLayout from './components/TenantLayout'
import TenantDashboard from './pages/tenant/Dashboard'
import Profesionales from './pages/tenant/Profesionales'
import Servicios from './pages/tenant/Servicios'
import Horarios from './pages/tenant/Horarios'
import Agenda from './pages/tenant/Agenda'
import Citas from './pages/tenant/Citas'
import Clientes from './pages/tenant/Clientes'
import Monitor from './pages/tenant/Monitor'
import MiAgenda from './pages/tenant/MiAgenda'
import Ingresos from './pages/tenant/Ingresos'
import Accesos from './pages/tenant/Accesos'
import Configuracion from './pages/tenant/Configuracion'

function Spinner() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function SuperadminRedirect() {
  useEffect(() => { window.location.replace('/superadmin.html') }, [])
  return <Spinner />
}

function RequireTenant({ children }) {
  const { tenant, loading } = useTenant()
  if (loading) return <Spinner />
  if (!tenant) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <p className="text-gray-500 dark:text-slate-400 text-sm text-center">
        Tu usuario no tiene acceso a ningún negocio.
      </p>
    </div>
  )
  return children
}

// Redirige según rol y vertical al entrar al panel
function PanelIndex() {
  const { rol, tenant } = useTenant()
  if (tenant?.vertical === 'peluqueria') return <Navigate to="/salon" replace />
  if (rol === 'profesional') return <Navigate to="/panel/mi-agenda" replace />
  return <TenantDashboard />
}

export default function App() {
  return (
    <TenantProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/registro" element={<Registro />} />

          {/* Panel superadmin → redirige al panel HTML estático */}
          <Route path="/superadmin" element={<SuperadminRedirect />} />
          <Route path="/superadmin/*" element={<SuperadminRedirect />} />

          {/* Panel tenant */}
          <Route path="/panel"
            element={<RequireAuth><RequireTenant><TenantLayout /></RequireTenant></RequireAuth>}>
            {/* Index redirige según rol */}
            <Route index element={<PanelIndex />} />

            {/* Vistas admin + recepción */}
            <Route path="monitor"       element={<Monitor />} />
            <Route path="agenda"        element={<Agenda />} />
            <Route path="profesionales" element={<Profesionales />} />
            <Route path="servicios"     element={<Servicios />} />
            <Route path="horarios"      element={<Horarios />} />
            <Route path="citas"         element={<Citas />} />
            <Route path="clientes"      element={<Clientes />} />

            {/* Solo admin */}
            <Route path="ingresos"      element={<Ingresos />} />
            <Route path="accesos"       element={<Accesos />} />
            <Route path="configuracion" element={<Configuracion />} />

            {/* Vistas profesional */}
            <Route path="mi-agenda"     element={<MiAgenda />} />
            <Route path="mis-clientes"  element={<Clientes />} />
          </Route>

          {/* Panel salón / peluquería — sin auth por ahora */}
          <Route path="/salon" element={<SalonApp />} />

          {/* Portal público de reservas — dos URLs equivalentes */}
          <Route path="/reservar/:slug" element={<SalonPortal />} />
          <Route path="/agenda/:slug"   element={<SalonPortal />} />

          <Route path="/" element={<Navigate to="/salon" replace />} />
          <Route path="*" element={<Navigate to="/salon" replace />} />
        </Routes>
      </BrowserRouter>
    </TenantProvider>
  )
}
