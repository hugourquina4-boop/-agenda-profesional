import { useState, Suspense, lazy, useEffect, useRef, useCallback } from 'react'
import SalonLayout from '../../layouts/SalonLayout'
import { useTenant } from '../../context/TenantContext'
import { supabase } from '../../lib/supabase'
import SalonLogin from './SalonLogin'
import ErrorBoundary from '../../components/ErrorBoundary'
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
const SalonMensajeria  = lazy(() => import('./SalonMensajeria'))
const SalonProveedores = lazy(() => import('./SalonProveedores'))
const SalonSedes       = lazy(() => import('./SalonSedes'))

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
                const url = new URL(window.location)
                url.searchParams.set('tenant', t.slug)
                window.history.replaceState({}, '', url)
                await onSelect(t.tenant_id)
                setSeleccionando(false)
              }}
              style={{
                display:'flex', alignItems:'center', gap:14,
                padding:'16px 18px',
                background:`linear-gradient(135deg,${t.color_primario || '#f43f5e'}08,var(--card))`,
                border:'1px solid transparent', boxShadow:'0 1px 8px rgba(0,0,0,0.08)',
                borderRadius:16, cursor:'pointer', textAlign:'left', width:'100%',
                transition:'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = t.color_primario || '#f43f5e'
                e.currentTarget.style.boxShadow = `0 4px 16px ${t.color_primario || '#f43f5e'}22`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'transparent'
                e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,0,0,0.08)'
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
            background:'var(--card)', border:'none', boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
            color:'var(--text-3)', fontWeight:600, fontSize:13, cursor:'pointer',
          }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function SetNewPassword() {
  const { setPasswordRecovery, recargar } = useTenant()
  const [pass,    setPass]    = useState('')
  const [pass2,   setPass2]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [done,    setDone]    = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (pass !== pass2) { setError('Las contraseñas no coinciden'); return }
    if (pass.length < 6) { setError('Mínimo 6 caracteres'); return }
    setError(''); setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password: pass })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(async () => {
      setPasswordRecovery(false)
      await recargar()
    }, 2000)
  }

  return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:24, background:'var(--bg)' }}>
      <div style={{
        position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
        background:`radial-gradient(ellipse 70% 50% at 20% 30%, rgba(244,63,94,0.12) 0%, transparent 70%),
                    radial-gradient(ellipse 50% 60% at 80% 80%, rgba(168,85,247,0.06) 0%, transparent 70%)`,
      }} />
      <div style={{ width:'100%', maxWidth:360, position:'relative', zIndex:1 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{
            width:64, height:64, borderRadius:20,
            background:'linear-gradient(135deg, #f43f5e, #e11d48)',
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 14px', boxShadow:'0 8px 32px rgba(244,63,94,0.3)',
          }}>
            <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 style={{ fontFamily:'Outfit', fontWeight:900, fontSize:26,
            color:'var(--text)', letterSpacing:'-0.5px', marginBottom:4 }}>Nueva contraseña</h1>
          <p style={{ fontSize:14, color:'var(--text-3)' }}>Elige una contraseña segura para tu cuenta</p>
        </div>

        {done ? (
          <div style={{ textAlign:'center', padding:32 }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:'var(--text)', marginBottom:8 }}>
              ¡Contraseña actualizada!
            </h2>
            <p style={{ fontSize:14, color:'var(--text-3)' }}>Entrando a tu cuenta…</p>
          </div>
        ) : (
          <div style={{ background:'var(--card)',
            borderRadius:24, padding:28, boxShadow:'0 4px 24px rgba(0,0,0,0.12)' }}>
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600,
                  letterSpacing:0.5, display:'block', marginBottom:8 }}>NUEVA CONTRASEÑA</label>
                <input className="sp-input" type="password" placeholder="Mínimo 6 caracteres" required
                  value={pass} onChange={e => setPass(e.target.value)} autoFocus />
              </div>
              <div>
                <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600,
                  letterSpacing:0.5, display:'block', marginBottom:8 }}>CONFIRMAR CONTRASEÑA</label>
                <input className="sp-input" type="password" placeholder="Repite la contraseña" required
                  value={pass2} onChange={e => setPass2(e.target.value)} />
              </div>
              {error && (
                <div style={{ padding:'12px 14px', borderRadius:12,
                  background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
                  fontSize:13, color:'#f87171' }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} style={{
                marginTop:4, padding:'16px', borderRadius:14, border:'none', cursor:'pointer',
                background:'linear-gradient(135deg, #f43f5e, #e11d48)',
                color:'#fff', fontFamily:'Outfit', fontWeight:700, fontSize:16,
                boxShadow:'0 4px 20px rgba(244,63,94,0.35)',
                opacity: loading ? 0.7 : 1, transition:'all 0.2s',
              }}>
                {loading ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

function AppBloqueada({ suscripcion, onSignOut }) {
  const dias = suscripcion?.dias_restantes ?? null
  const diasVencidos = dias !== null ? Math.abs(dias) : '?'
  const metodos = [
    { icon:'📱', label:'Nequi', value:'3155734848', color:'#a855f7' },
    { icon:'💸', label:'Transfiya', value:'3155734848', color:'#3b82f6' },
    { icon:'🏦', label:'Bancolombia', value:'Cta Ahorros 45492209477 · Hugo F. Urquina', color:'#f59e0b' },
  ]
  function copiar(txt) { navigator.clipboard.writeText(txt).catch(() => {}) }

  return (
    <div style={{
      minHeight:'100dvh', background:'var(--bg)', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:'24px 20px',
    }}>
      <div style={{
        position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
        background:'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(239,68,68,0.12) 0%, transparent 70%)',
      }} />
      <div style={{ width:'100%', maxWidth:380, position:'relative', zIndex:1 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{
            width:72, height:72, borderRadius:22,
            background:'linear-gradient(135deg, #ef4444, #dc2626)',
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 16px', boxShadow:'0 8px 32px rgba(239,68,68,0.35)',
            fontSize:32,
          }}>🔒</div>
          <h1 style={{ fontFamily:'Outfit', fontWeight:900, fontSize:24, color:'var(--text)', marginBottom:8 }}>
            Acceso suspendido
          </h1>
          <p style={{ fontSize:14, color:'var(--text-3)', lineHeight:1.6 }}>
            Tu plan venció hace <strong style={{ color:'#ef4444' }}>{diasVencidos} {diasVencidos === 1 ? 'día' : 'días'}</strong>.
            Renueva tu suscripción para restablecer el acceso.
          </p>
        </div>

        <div style={{ background:'var(--card)', borderRadius:20, padding:20, marginBottom:16,
          boxShadow:'0 4px 24px rgba(0,0,0,0.12)' }}>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:1,
            textTransform:'uppercase', marginBottom:14 }}>Métodos de pago</p>
          {metodos.map(m => (
            <div key={m.label} style={{
              display:'flex', alignItems:'center', gap:12,
              padding:'12px 0', borderBottom:'1px solid var(--border)',
            }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{m.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{m.label}</div>
                <div style={{ fontSize:13, color:'var(--text-3)', fontFamily:'monospace' }}>{m.value}</div>
              </div>
              <button onClick={() => copiar(m.value)} style={{
                padding:'6px 12px', borderRadius:8, border:`1px solid ${m.color}40`,
                background:`${m.color}12`, color:m.color, fontSize:12, fontWeight:700, cursor:'pointer',
              }}>Copiar</button>
            </div>
          ))}
          <p style={{ fontSize:12, color:'var(--text-3)', marginTop:14, lineHeight:1.5 }}>
            Envía el comprobante de pago a tu asesor de Salón Pro para reactivar.
          </p>
        </div>

        <button onClick={onSignOut} style={{
          width:'100%', padding:'13px', borderRadius:14, border:'none', cursor:'pointer',
          background:'var(--card)', boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
          color:'var(--text-3)', fontWeight:600, fontSize:14,
        }}>Cerrar sesión</button>
      </div>
    </div>
  )
}

function GlobalSearch({ tenant, col, onNavigate, onClose }) {
  const [q, setQ]           = useState('')
  const [clientes, setClientes] = useState([])
  const [citas,    setCitas]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const buscar = useCallback(async (texto) => {
    if (!tenant?.id || texto.trim().length < 2) { setClientes([]); setCitas([]); return }
    setLoading(true)
    const [{ data: cltData }, { data: citaData }] = await Promise.all([
      supabase.from('clientes_agenda')
        .select('id, nombre, telefono')
        .eq('tenant_id', tenant.id)
        .eq('activo', true)
        .or(`nombre.ilike.%${texto}%,telefono.ilike.%${texto}%`)
        .limit(5),
      supabase.from('citas')
        .select('id, fecha_inicio, clientes_agenda(nombre), servicios(nombre)')
        .eq('tenant_id', tenant.id)
        .neq('estado', 'cancelada')
        .or(`clientes_agenda.nombre.ilike.%${texto}%`)
        .order('fecha_inicio', { ascending: false })
        .limit(5),
    ])
    setClientes(cltData || [])
    setCitas(citaData || [])
    setLoading(false)
  }, [tenant])

  useEffect(() => {
    const t = setTimeout(() => buscar(q), 280)
    return () => clearTimeout(t)
  }, [q, buscar])

  function fmtFecha(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short' }) + ' ' +
      d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', hour12:false })
  }

  const hayResultados = clientes.length > 0 || citas.length > 0

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, zIndex:9999,
        background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)',
        display:'flex', flexDirection:'column', alignItems:'center',
        paddingTop:'10dvh', paddingLeft:16, paddingRight:16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:'100%', maxWidth:520, borderRadius:20,
          background:'var(--card)', boxShadow:'0 24px 80px rgba(0,0,0,0.35)',
          overflow:'hidden',
        }}
      >
        {/* Input */}
        <div style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'16px 18px', borderBottom:'1px solid var(--border)',
        }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
            stroke="var(--text-3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar clientes, citas…"
            style={{
              flex:1, background:'transparent', border:'none', outline:'none',
              fontSize:16, color:'var(--text)', fontFamily:'inherit',
            }}
          />
          {loading && <div className="sp-spinner" style={{ width:16, height:16, borderWidth:2 }} />}
          <button onClick={onClose} style={{
            background:'none', border:'none', cursor:'pointer',
            color:'var(--text-3)', fontSize:12, padding:'4px 8px',
            borderRadius:6, background:'var(--border)',
          }}>Esc</button>
        </div>

        {/* Resultados */}
        <div style={{ maxHeight:'60dvh', overflowY:'auto' }}>
          {!hayResultados && q.trim().length >= 2 && !loading && (
            <div style={{ padding:'24px 18px', fontSize:14, color:'var(--text-3)', textAlign:'center' }}>
              Sin resultados para "{q}"
            </div>
          )}
          {!hayResultados && q.trim().length < 2 && (
            <div style={{ padding:'24px 18px', fontSize:14, color:'var(--text-3)', textAlign:'center' }}>
              Escribe 2+ caracteres para buscar
            </div>
          )}

          {clientes.length > 0 && (
            <div>
              <div style={{ padding:'10px 18px 4px', fontSize:10, fontWeight:700,
                color:'var(--text-3)', textTransform:'uppercase', letterSpacing:0.5 }}>
                Clientes
              </div>
              {clientes.map(c => (
                <button key={c.id}
                  onClick={() => { onNavigate('clientes'); onClose() }}
                  style={{
                    display:'flex', alignItems:'center', gap:14, width:'100%',
                    padding:'12px 18px', background:'none', border:'none', cursor:'pointer',
                    borderBottom:'1px solid var(--border)', textAlign:'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <div style={{
                    width:36, height:36, borderRadius:10, flexShrink:0,
                    background:`${col}20`, display:'flex', alignItems:'center',
                    justifyContent:'center', fontWeight:800, color:col, fontSize:14,
                  }}>{c.nombre?.[0]?.toUpperCase() || '?'}</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{c.nombre}</div>
                    <div style={{ fontSize:12, color:'var(--text-3)' }}>{c.telefono || 'Sin teléfono'}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {citas.length > 0 && (
            <div>
              <div style={{ padding:'10px 18px 4px', fontSize:10, fontWeight:700,
                color:'var(--text-3)', textTransform:'uppercase', letterSpacing:0.5 }}>
                Citas recientes
              </div>
              {citas.map(c => (
                <button key={c.id}
                  onClick={() => { onNavigate('agenda'); onClose() }}
                  style={{
                    display:'flex', alignItems:'center', gap:14, width:'100%',
                    padding:'12px 18px', background:'none', border:'none', cursor:'pointer',
                    borderBottom:'1px solid var(--border)', textAlign:'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <div style={{
                    width:36, height:36, borderRadius:10, flexShrink:0,
                    background:'rgba(168,85,247,0.15)', display:'flex', alignItems:'center',
                    justifyContent:'center', fontSize:16,
                  }}>📅</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>
                      {c.clientes_agenda?.nombre || 'Cliente'}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-3)' }}>
                      {c.servicios?.nombre || 'Servicio'} · {fmtFecha(c.fecha_inicio)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div style={{ height:8 }} />
        </div>
      </div>
    </div>
  )
}

export default function SalonApp() {
  const { tenant, loading, recargar, todosTenants, seleccionarTenant, esSuperadmin, passwordRecovery, tieneAcceso, suscripcion, rol } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'
  const [page,          setPage]          = useState('hoy')
  const [nuevaCitaOpen, setNuevaCitaOpen] = useState(false)
  const [refreshKey,    setRefreshKey]    = useState(0)
  const [searchOpen,    setSearchOpen]    = useState(false)

  function handleNavigate(key) { setPage(key) }
  function handleNuevaCita()   { setNuevaCitaOpen(true) }
  function handleCitaCreada()  { setRefreshKey(k => k + 1); setPage('hoy') }

  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(s => !s)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (loading) return <PageLoader />

  // Recovery mode — usuario llegó desde el email de recuperación
  if (passwordRecovery) return <SetNewPassword />

  // No autenticado → mostrar login
  if (!tenant && todosTenants.length === 0) {
    return <SalonLogin onLogin={recargar} />
  }

  // Autenticado pero con múltiples negocios y ninguno seleccionado aún
  // (no debería ocurrir normalmente, TenantContext selecciona automáticamente)
  if (!tenant && todosTenants.length > 0) {
    return <TenantPicker todosTenants={todosTenants} onSelect={seleccionarTenant} />
  }

  // Bloqueo por suscripción vencida: >2 días después de fecha_limite
  // Superadmin siempre tiene acceso para gestionar / desbloquear
  const diasRestantes = suscripcion?.dias_restantes ?? null
  if (!esSuperadmin && rol !== 'superadmin' && diasRestantes !== null && diasRestantes < -2) {
    return <AppBloqueada suscripcion={suscripcion} onSignOut={() => supabase.auth.signOut()} />
  }

  function renderPage() {
    // Guard: superadmin requiere esSuperadmin; demás módulos requieren tieneAcceso
    const acceso = page === 'superadmin' ? esSuperadmin : tieneAcceso(page)
    if (!acceso) return <SalonDashboard key={refreshKey} onNavigate={handleNavigate} />

    switch (page) {
      case 'hoy':        return <SalonDashboard key={refreshKey} onNavigate={handleNavigate} />
      case 'agenda':     return <SalonAgenda />
      case 'clientes':   return <SalonClientes />
      case 'equipo':     return <SalonEquipo />
      case 'servicios':  return <SalonServicios />
      case 'ordenes':    return <SalonOrdenes />
      case 'inventario': return <SalonInventario />
      case 'caja':       return <SalonCaja />
      case 'comisiones': return <SalonComisiones />
      case 'analytics':  return <SalonAnalytics />
      case 'mensajeria':   return <SalonMensajeria />
      case 'proveedores':  return <SalonProveedores />
      case 'sedes':        return <SalonSedes />
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
      onSearch={() => setSearchOpen(true)}
      todosTenants={todosTenants}
      onCambiarTenant={seleccionarTenant}
    >
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          {renderPage()}
        </Suspense>
      </ErrorBoundary>

      {nuevaCitaOpen && (
        <Suspense fallback={null}>
          <SalonNuevaCita
            onClose={() => setNuevaCitaOpen(false)}
            onCreada={handleCitaCreada}
          />
        </Suspense>
      )}

      {searchOpen && (
        <GlobalSearch
          tenant={tenant}
          col={col}
          onNavigate={handleNavigate}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </SalonLayout>
  )
}
