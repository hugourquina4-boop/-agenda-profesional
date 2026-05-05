import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useTenant } from '../context/TenantContext'

// ── Íconos SVG ───────────────────────────────────────────────────────────────
const IC = {
  home:    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  config:  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  monitor: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  calendar:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  team:    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  services:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  clock:   'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  list:    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  users:   'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  money:   'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  key:     'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  menu:    'M4 6h16M4 12h16M4 18h16',
  sun:     'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z',
  moon:    'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
  logout:  'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
}

// ── Configuración de nav por rol ─────────────────────────────────────────────
const NAV_ADMIN = [
  { to: '/panel',               label: 'Dashboard',  icon: 'home',     exact: true },
  { to: '/panel/monitor',       label: 'Monitor',    icon: 'monitor',  highlight: true },
  { to: '/panel/agenda',        label: 'Agenda',     icon: 'calendar' },
  { to: '/panel/profesionales', label: 'Equipo',     icon: 'team' },
  { to: '/panel/servicios',     label: 'Servicios',  icon: 'services' },
  { to: '/panel/horarios',      label: 'Horarios',   icon: 'clock' },
  { to: '/panel/citas',         label: 'Citas',      icon: 'list' },
  { to: '/panel/clientes',      label: 'Clientes',   icon: 'users' },
  { to: '/panel/ingresos',      label: 'Ingresos',      icon: 'money' },
  { to: '/panel/accesos',       label: 'Accesos',       icon: 'key' },
  { to: '/panel/configuracion', label: 'Configuración', icon: 'config' },
]

const NAV_PROFESIONAL = [
  { to: '/panel/mi-agenda',     label: 'Mi agenda',  icon: 'calendar', exact: true },
  { to: '/panel/mis-clientes',  label: 'Clientes',   icon: 'users' },
]

const NAV_RECEPCION = [
  { to: '/panel',               label: 'Dashboard',  icon: 'home',     exact: true },
  { to: '/panel/monitor',       label: 'Monitor',    icon: 'monitor',  highlight: true },
  { to: '/panel/agenda',        label: 'Agenda',     icon: 'calendar' },
  { to: '/panel/citas',         label: 'Citas',      icon: 'list' },
  { to: '/panel/clientes',      label: 'Clientes',   icon: 'users' },
]

// Bottom bar: primeros 4 ítems + "Más" si hay más
const BOTTOM_LIMIT = 4

function Icon({ d, cls = 'w-5 h-5' }) {
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
    </svg>
  )
}

export default function TenantLayout() {
  const { user, logout }   = useAuth()
  const { dark, toggle }   = useTheme()
  const { tenant, rol }    = useTenant()
  const navigate           = useNavigate()
  const [drawer, setDrawer]= useState(false)

  const nav = rol === 'profesional' ? NAV_PROFESIONAL
            : rol === 'recepcion'   ? NAV_RECEPCION
            : NAV_ADMIN

  const bottomItems = nav.slice(0, BOTTOM_LIMIT)
  const hasMore     = nav.length > BOTTOM_LIMIT

  const col  = tenant?.color_primario || '#3b82f6'
  const name = tenant?.nombre || 'Mi negocio'
  const init = name[0]?.toUpperCase() || '?'

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-slate-950 overflow-hidden">

      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex-col">
        <SidebarHeader tenant={tenant} col={col} init={init} />
        <SidebarNav nav={nav} col={col} />
        <SidebarFooter user={user} dark={dark} toggle={toggle} onLogout={handleLogout} col={col} />
      </aside>

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      {drawer && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-900 flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <SidebarHeader tenant={tenant} col={col} init={init} onClose={() => setDrawer(false)} />
            <SidebarNav nav={nav} col={col} onNav={() => setDrawer(false)} />
            <SidebarFooter user={user} dark={dark} toggle={toggle} onLogout={handleLogout} col={col} />
          </aside>
        </div>
      )}

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex-shrink-0">
          <button onClick={() => setDrawer(true)}
            className="p-2 -ml-1 rounded-xl text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
            <Icon d={IC.menu} cls="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: col }}>
              {init}
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{name}</span>
          </div>

          <button onClick={toggle}
            className="p-2 -mr-1 rounded-xl text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
            <Icon d={dark ? IC.sun : IC.moon} cls="w-5 h-5" />
          </button>
        </header>

        {/* Main content — pb-16 on mobile for bottom bar */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex z-40 safe-bottom">
          {bottomItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact}>
              {({ isActive }) => (
                <div className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 transition-colors ${isActive ? '' : 'text-gray-400 dark:text-slate-500'}`}
                  style={isActive ? { color: col } : undefined}>
                  <div className="p-1.5 rounded-xl transition-all"
                    style={isActive ? { background: `${col}18` } : undefined}>
                    <Icon d={IC[item.icon]} cls="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </div>
              )}
            </NavLink>
          ))}
          {hasMore && (
            <button onClick={() => setDrawer(true)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-gray-400 dark:text-slate-500">
              <div className="p-1.5 rounded-xl">
                <Icon d={IC.menu} cls="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium leading-none">Más</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  )
}

// ── Componentes internos ─────────────────────────────────────────────────────

function SidebarHeader({ tenant, col, init, onClose }) {
  return (
    <div className="px-4 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-sm"
          style={{ background: `linear-gradient(135deg, ${col}, ${col}cc)` }}>
          {init}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white leading-none truncate">
            {tenant?.nombre || 'Mi negocio'}
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 capitalize">
            {tenant?.vertical || 'negocio'}
          </p>
        </div>
      </div>
      {onClose && (
        <button onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      )}
    </div>
  )
}

function SidebarNav({ nav, col, onNav }) {
  return (
    <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
      {nav.map(item => (
        <NavLink key={item.to} to={item.to} end={item.exact}
          onClick={onNav}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? item.highlight ? 'text-white shadow-sm' : 'bg-blue-600 text-white'
                : item.highlight
                  ? 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 border border-dashed border-gray-200 dark:border-slate-700'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
            }`
          }
          style={({ isActive }) => isActive && item.highlight ? { backgroundColor: col } : isActive ? {} : {}}
        >
          {({ isActive }) => (
            <>
              <Icon d={IC[item.icon]} cls="w-5 h-5 flex-shrink-0" />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarFooter({ user, dark, toggle, onLogout, col }) {
  return (
    <div className="px-3 py-3 border-t border-gray-200 dark:border-slate-800 space-y-1">
      <button onClick={toggle}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
        <Icon d={dark ? IC.sun : IC.moon} cls="w-4 h-4" />
        {dark ? 'Modo día' : 'Modo noche'}
      </button>

      <div className="flex items-center gap-2.5 px-3 py-2">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${col}, ${col}99)` }}>
          {user?.email?.[0]?.toUpperCase() || '?'}
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{user?.email}</p>
      </div>

      <button onClick={onLogout}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors">
        <Icon d={IC.logout} cls="w-4 h-4" />
        Cerrar sesión
      </button>
    </div>
  )
}
