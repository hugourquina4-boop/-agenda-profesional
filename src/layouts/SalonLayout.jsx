import { useState, useEffect } from 'react'
import { useTenant } from '../context/TenantContext'
import { supabase } from '../lib/supabase'
import '../salon.css'

function Ico({ d, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const IC = {
  hoy:       'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  agenda:    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  clientes:  'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  equipo:    'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  servicios: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  caja:      'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  comisiones:'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  analytics: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  ordenes:    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  inventario: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  accesos:    'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  config:     'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  superadmin: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  plus:      'M12 4v16m8-8H4',
  notif:     'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  menu:      'M4 6h16M4 12h16M4 18h7',
  sun:       'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  moon:      'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
  logout:    'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
}

const NAV_PRINCIPAL = [
  { key: 'hoy',      label: 'Inicio'    },
  { key: 'agenda',   label: 'Agenda'    },
  { key: 'clientes', label: 'Clientes'  },
]
const NAV_NEGOCIO = [
  { key: 'equipo',      label: 'Equipo'      },
  { key: 'servicios',   label: 'Servicios'   },
  { key: 'ordenes',     label: 'Órdenes'     },
  { key: 'inventario',  label: 'Inventario'  },
  { key: 'caja',        label: 'Ingresos'    },
  { key: 'comisiones',  label: 'Comisiones'  },
  { key: 'analytics',   label: 'Analytics'   },
]
const NAV_SISTEMA = [
  { key: 'accesos', label: 'Accesos'        },
  { key: 'config',  label: 'Configuración'  },
]
const NAV_MOBILE = [
  { key: 'hoy',      label: 'Inicio'   },
  { key: 'agenda',   label: 'Agenda'   },
  { key: '__fab__',  label: '', fab: true },
  { key: 'clientes', label: 'Clientes' },
  { key: '__mas__',  label: 'Más', mas: true },
]
const PAGE_LABEL = {
  hoy:'Inicio', agenda:'Agenda', clientes:'Clientes',
  equipo:'Equipo', servicios:'Servicios', caja:'Ingresos',
  ordenes:'Órdenes', inventario:'Inventario', comisiones:'Comisiones', analytics:'Analytics',
  accesos:'Accesos', config:'Configuración', superadmin:'Suscripción',
}

export default function SalonLayout({ page, onNavigate, onNuevaCita, children }) {
  const { tenant, esSuperadmin, tieneAcceso } = useTenant()

  const navPrincipal = NAV_PRINCIPAL.filter(i => tieneAcceso(i.key))
  const navNegocio   = NAV_NEGOCIO.filter(i => tieneAcceso(i.key))
  const navSistema   = NAV_SISTEMA.filter(i => tieneAcceso(i.key))
  const navMobile    = NAV_MOBILE.filter(i => i.fab || i.mas || tieneAcceso(i.key))

  const [masOpen, setMasOpen] = useState(false)
  const [theme,   setTheme]   = useState(() => localStorage.getItem('sp-theme') || 'light')

  useEffect(() => { localStorage.setItem('sp-theme', theme) }, [theme])
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/salon'
  }

  const col    = tenant?.color_primario || '#f43f5e'
  const logo   = tenant?.logo_url
  const nombre = tenant?.nombre || 'Mi Salón'

  const cssVars = {
    '--accent':      col,
    '--accent-2':    col + 'cc',
    '--accent-dim':  col + '22',
    '--accent-glow': col + '55',
  }

  function nav(key) { setMasOpen(false); onNavigate(key) }

  function SbItem({ k, label }) {
    const active = page === k
    return (
      <button className={`sp-sb-item ${active ? 'active' : ''}`} onClick={() => nav(k)}>
        <span className="sp-sb-dot" />
        <Ico d={IC[k]} size={15} />
        {label}
      </button>
    )
  }

  const themeBtn = (
    <button className="sp-theme-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Modo día' : 'Modo noche'}>
      <Ico d={theme === 'dark' ? IC.sun : IC.moon} size={17} />
    </button>
  )

  const alertaPago = tenant?.alerta_pago
  const alertaMsg  = tenant?.alerta_pago_msg || 'Tu suscripción requiere atención. Contacta al administrador para renovarla.'

  return (
    <div className={`sp-root${theme === 'light' ? ' sp-light' : ''}`} style={cssVars}>

      {/* ── Banner alerta de pago ─────────────────────────── */}
      {alertaPago && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, zIndex:9999,
          background:'linear-gradient(90deg,#dc2626,#b91c1c)',
          padding:'10px 20px', display:'flex', alignItems:'center', gap:12,
          boxShadow:'0 4px 20px rgba(220,38,38,0.4)',
        }}>
          <span style={{ fontSize:16, flexShrink:0 }}>⚠️</span>
          <p style={{ flex:1, fontSize:13, fontWeight:600, color:'#fff', margin:0, lineHeight:1.4 }}>
            {alertaMsg}
          </p>
          <a href="https://wa.me/573014196426" target="_blank" rel="noopener noreferrer"
            style={{
              padding:'6px 14px', borderRadius:8, background:'rgba(255,255,255,0.2)',
              border:'1px solid rgba(255,255,255,0.3)', color:'#fff',
              fontSize:12, fontWeight:700, whiteSpace:'nowrap', textDecoration:'none', flexShrink:0,
            }}>
            Contactar
          </a>
        </div>
      )}

      {/* ── SIDEBAR desktop ───────────────────────────────── */}
      <aside className="sp-sidebar">

        <div className="sp-sb-brand">
          <div className="sp-sb-logo"
            style={{ background:`linear-gradient(135deg,${col},${col}99)`, boxShadow:`0 4px 14px ${col}44` }}>
            {logo
              ? <img src={logo} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
              : <span style={{ fontFamily:'Outfit',fontWeight:900,fontSize:17,color:'#fff' }}>{nombre[0]}</span>
            }
          </div>
          <div>
            <div className="sp-sb-name">{nombre}</div>
            <div className="sp-sb-plan">Salón Pro</div>
          </div>
        </div>

        {navPrincipal.length > 0 && <>
          <div className="sp-sb-group">Principal</div>
          {navPrincipal.map(i => <SbItem key={i.key} k={i.key} label={i.label} />)}
        </>}

        {navNegocio.length > 0 && <>
          <div className="sp-sb-sep" />
          <div className="sp-sb-group">Negocio</div>
          {navNegocio.map(i => <SbItem key={i.key} k={i.key} label={i.label} />)}
        </>}

        {navSistema.length > 0 && <>
          <div className="sp-sb-sep" />
          <div className="sp-sb-group">Sistema</div>
          {navSistema.map(i => <SbItem key={i.key} k={i.key} label={i.label} />)}
        </>}

        {esSuperadmin && (
          <>
            <div className="sp-sb-sep" />
            <div className="sp-sb-group">Suscripción</div>
            <SbItem k="superadmin" label="Suscripción" />
          </>
        )}

        <div className="sp-sb-bottom">
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
            padding:'8px 10px',borderRadius:9,background:'rgba(128,128,128,0.06)' }}>
            <div style={{ display:'flex',alignItems:'center',gap:8,minWidth:0 }}>
              <div style={{ width:28,height:28,borderRadius:8,background:`${col}25`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:13,fontWeight:800,color:col,fontFamily:'Outfit',flexShrink:0 }}>
                {nombre[0]}
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:12,fontWeight:600,color:'var(--text-2)',
                  overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis' }}>{nombre}</div>
                <div style={{ fontSize:10,color:'var(--text-3)',fontWeight:500 }}>Administrador</div>
              </div>
            </div>
            <div style={{ display:'flex',gap:4 }}>
              {themeBtn}
              <button className="sp-theme-btn" onClick={logout} title="Cerrar sesión">
                <Ico d={IC.logout} size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN desktop ──────────────────────────────────── */}
      <div className="sp-main" style={ alertaPago ? { paddingTop:44 } : undefined }>

        {/* Topbar */}
        <div className="sp-topbar">
          <span className="sp-topbar-title">{PAGE_LABEL[page] || 'Inicio'}</span>
          <div className="sp-topbar-right">
            {themeBtn}
            <button className="sp-icon-btn" style={{ position:'relative' }}>
              <Ico d={IC.notif} size={18} />
              <span className="sp-notif-dot" />
            </button>
            <button className="sp-btn-primary" onClick={onNuevaCita}
              style={{ background:`linear-gradient(135deg,${col},${col}bb)`,
                boxShadow:`0 4px 14px ${col}44` }}>
              <Ico d={IC.plus} size={14} />
              Nueva cita
            </button>
          </div>
        </div>

        {/* Header móvil */}
        <header className="sp-header">
          <div className="sp-brand">
            <div className="sp-brand-logo"
              style={{ background:`linear-gradient(135deg,${col},${col}99)` }}>
              {logo ? <img src={logo} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} /> : nombre[0]}
            </div>
            <span className="sp-brand-name">{nombre}</span>
          </div>
          <div className="sp-header-right">
            {themeBtn}
            <button className="sp-icon-btn" style={{ position:'relative' }}>
              <Ico d={IC.notif} size={20} />
              <span className="sp-notif-dot" />
            </button>
          </div>
        </header>

        {/* Contenido */}
        <div className="sp-page">{children}</div>
      </div>

      {/* ── SHEET "Más" móvil ─────────────────────────────── */}
      {masOpen && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setMasOpen(false)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">Menú</p>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16 }}>
              {[...navNegocio,...navSistema,...(esSuperadmin ? [{key:'superadmin',label:'Suscripción'}] : [])].map(item => (
                <button key={item.key} onClick={() => nav(item.key)} style={{
                  display:'flex',alignItems:'center',gap:10,
                  padding:'14px 16px',borderRadius:14,cursor:'pointer',textAlign:'left',
                  background: page===item.key ? `${col}18` : 'rgba(128,128,128,0.06)',
                  border:`1px solid ${page===item.key ? col+'50' : 'rgba(128,128,128,0.12)'}`,
                  color: page===item.key ? col : 'var(--text-2)',
                  fontSize:14,fontWeight:600,fontFamily:'Plus Jakarta Sans,sans-serif',
                }}>
                  <Ico d={IC[item.key]} size={17} />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Logout móvil */}
            <button onClick={logout} style={{
              width:'100%', display:'flex', alignItems:'center', gap:10,
              padding:'13px 16px', borderRadius:14, cursor:'pointer',
              background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.18)',
              color:'#f87171', fontSize:14, fontWeight:600, fontFamily:'Plus Jakarta Sans,sans-serif',
            }}>
              <Ico d={IC.logout} size={17} />
              Cerrar sesión
            </button>
          </div>
        </>
      )}

      {/* ── NAV móvil ─────────────────────────────────────── */}
      <nav className="sp-nav">
        {navMobile.map(item => {
          if (item.fab) return (
            <div key="fab" style={{ display:'flex',alignItems:'center',justifyContent:'center',flex:1 }}>
              <button className="sp-fab"
                style={{ background:`linear-gradient(135deg,${col},${col}bb)`,boxShadow:`0 4px 20px ${col}66` }}
                onClick={onNuevaCita}>
                <Ico d={IC.plus} size={24} />
              </button>
            </div>
          )
          if (item.mas) return (
            <button key="mas" className={`sp-nav-item ${masOpen ? 'active' : ''}`}
              onClick={() => setMasOpen(o => !o)}>
              <span className="sp-nav-icon"><Ico d={IC.menu} size={22} /></span>
              <span>Más</span>
            </button>
          )
          return (
            <button key={item.key} className={`sp-nav-item ${page===item.key ? 'active' : ''}`}
              onClick={() => nav(item.key)}>
              <span className="sp-nav-icon"><Ico d={IC[item.key]} size={22} /></span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}
