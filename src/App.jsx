import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { TenantProvider, useTenant } from './context/TenantContext'
import Login from './pages/Login'
import Portal from './pages/public/Portal'
import Registro from './pages/public/Registro'
import SuperadminLayout from './components/SuperadminLayout'
import TenantLayout from './components/TenantLayout'
import SuperDashboard from './pages/superadmin/Dashboard'
import Negocios from './pages/superadmin/Negocios'
import Suscripciones from './pages/superadmin/Suscripciones'
import Planes from './pages/superadmin/Planes'
import TenantDashboard from './pages/tenant/Dashboard'
import Profesionales from './pages/tenant/Profesionales'
import Servicios from './pages/tenant/Servicios'
import Horarios from './pages/tenant/Horarios'
import Agenda from './pages/tenant/Agenda'
import Citas from './pages/tenant/Citas'
import Clientes from './pages/tenant/Clientes'

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

function RequireTenant({ children }) {
  const { tenant, loading } = useTenant()
  if (loading) return <Spinner />
  if (!tenant) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-gray-500 dark:text-slate-400 text-sm">Tu usuario no tiene acceso a ningún negocio.</p>
        <a href="/superadmin" className="text-blue-500 text-sm mt-2 inline-block hover:underline">
          Ir al superadmin
        </a>
      </div>
    </div>
  )
  return children
}

export default function App() {
  return (
    <TenantProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Panel superadmin */}
          <Route
            path="/superadmin"
            element={<RequireAuth><SuperadminLayout /></RequireAuth>}
          >
            <Route index element={<SuperDashboard />} />
            <Route path="negocios" element={<Negocios />} />
            <Route path="suscripciones" element={<Suscripciones />} />
            <Route path="planes" element={<Planes />} />
          </Route>

          {/* Panel tenant */}
          <Route
            path="/panel"
            element={<RequireAuth><RequireTenant><TenantLayout /></RequireTenant></RequireAuth>}
          >
            <Route index element={<TenantDashboard />} />
            <Route path="profesionales" element={<Profesionales />} />
            <Route path="servicios" element={<Servicios />} />
            <Route path="horarios" element={<Horarios />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="citas" element={<Citas />} />
            <Route path="clientes" element={<Clientes />} />
          </Route>

          {/* Rutas públicas — sin auth */}
          <Route path="/registro" element={<Registro />} />
          <Route path="/agenda/:slug" element={<Portal />} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </TenantProvider>
  )
}
