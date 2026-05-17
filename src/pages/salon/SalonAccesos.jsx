import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

function Ico({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const ROL = {
  superadmin: { label:'Superadmin', color:'#f43f5e', desc:'Acceso a todos los negocios' },
  admin:      { label:'Admin',      color:'#8b5cf6', desc:'Acceso total al panel' },
  contable:   { label:'Contable',   color:'#f59e0b', desc:'Caja, comisiones y analytics' },
  recepcion:  { label:'Recepción',  color:'#10b981', desc:'Agenda y clientes, sin config' },
  profesional:{ label:'Profesional',color:'#3b82f6', desc:'Solo su propia agenda' },
}

const MODULOS = [
  { key:'hoy',         label:'Inicio / Dashboard' },
  { key:'agenda',      label:'Agenda' },
  { key:'clientes',    label:'Clientes' },
  { key:'servicios',   label:'Servicios' },
  { key:'ordenes',     label:'Órdenes en espera' },
  { key:'caja',        label:'Caja / Ingresos' },
  { key:'comisiones',  label:'Comisiones' },
  { key:'inventario',  label:'Inventario' },
  { key:'proveedores', label:'Proveedores / Gastos' },
  { key:'mensajeria',  label:'Mensajería WhatsApp' },
  { key:'analytics',   label:'Analytics' },
  { key:'equipo',      label:'Equipo' },
  { key:'accesos',     label:'Accesos' },
  { key:'config',      label:'Configuración' },
]

const ROLES_CONFIG = [
  { key:'contable',    label:'Contable',    color:'#f59e0b' },
  { key:'recepcion',   label:'Recepción',   color:'#10b981' },
  { key:'profesional', label:'Profesional', color:'#3b82f6' },
]

function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function SalonAccesos() {
  const { tenant, esSuperadmin, permisos: permisosCtx, recargarPermisos } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [activeTab,    setActiveTab]    = useState('equipo')  // 'equipo' | 'permisos'
  const [localPermisos,setLocalPermisos]= useState(null)
  const [expandedUser, setExpandedUser] = useState(null)     // user_id expandido

  const [usuarios,    setUsuarios]    = useState([])
  const [sinCuenta,   setSinCuenta]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [toast,       setToast]       = useState(null)

  // Sheet crear acceso
  const [creandoPara, setCreandoPara] = useState(null)
  const [formEmail,   setFormEmail]   = useState('')
  const [formPass,    setFormPass]    = useState('')
  const [formRol,     setFormRol]     = useState('profesional')
  const [creando,     setCreando]     = useState(false)
  const [creError,    setCreError]    = useState('')

  // Sheet cambiar rol
  const [rolSheet, setRolSheet] = useState(null)

  // Sheet reset password
  const [resetSheet,  setResetSheet]  = useState(null)  // { user_id, email }
  const [resetSent,   setResetSent]   = useState(false)
  const [resetLoading,setResetLoading]= useState(false)

  const baseUrl     = typeof window !== 'undefined' ? window.location.origin : ''
  const linkAcceso  = tenant?.slug ? `${baseUrl}/salon` : null

  const showToast = (msg, ok = true) => {
    setToast({ msg, color: ok ? '#22c55e' : '#ef4444' })
    setTimeout(() => setToast(null), 2800)
  }

  const cargar = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    const [
      { data: uts },
      { data: emailData },
      { data: profs },
    ] = await Promise.all([
      supabase.from('usuarios_tenant')
        .select('user_id, rol, activo, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at'),
      supabase.rpc('get_usuarios_email_tenant', { p_tenant_id: tenant.id }),
      supabase.from('profesionales')
        .select('id, nombre, foto_url, activo, user_id')
        .eq('tenant_id', tenant.id)
        .order('nombre'),
    ])

    const emailMap = {}
    ;(emailData || []).forEach(r => { emailMap[r.user_id] = r.email })

    const profMap = {}
    ;(profs || []).forEach(p => { if (p.user_id) profMap[p.user_id] = p })

    const usrs = (uts || [])
      .filter(u => u.rol !== 'superadmin')   // superadmin es gestión interna, no visible aquí
      .map(u => ({
        ...u,
        email:       emailMap[u.user_id] || '',
        profesional: profMap[u.user_id] || null,
      }))

    setUsuarios(usrs)
    setSinCuenta((profs || []).filter(p => !p.user_id && p.activo))
    setLoading(false)
  }, [tenant])

  useEffect(() => { cargar() }, [cargar])

  // Sincronizar permisos del contexto al estado local
  useEffect(() => {
    if (permisosCtx && Object.keys(permisosCtx).length > 0) setLocalPermisos(permisosCtx)
  }, [permisosCtx])

  async function togglePermiso(rol, modulo) {
    const actual = localPermisos?.[rol]?.[modulo] ?? false
    const nuevo  = !actual
    // Optimistic update
    setLocalPermisos(prev => ({ ...prev, [rol]: { ...(prev?.[rol] || {}), [modulo]: nuevo } }))
    const { data } = await supabase.rpc('set_permiso_tenant', {
      p_tenant_id: tenant.id, p_rol: rol, p_modulo: modulo, p_activo: nuevo,
    })
    if (!data?.ok) {
      setLocalPermisos(prev => ({ ...prev, [rol]: { ...(prev?.[rol] || {}), [modulo]: actual } }))
      showToast('Error al actualizar permiso', false)
      return
    }
    await recargarPermisos()
    showToast(`${nuevo ? 'Acceso activado' : 'Acceso revocado'}`)
  }

  // ── Cambiar rol ─────────────────────────────────────────────
  async function cambiarRol(userId, nuevoRol) {
    await supabase.from('usuarios_tenant')
      .update({ rol: nuevoRol })
      .eq('user_id', userId).eq('tenant_id', tenant.id)
    setRolSheet(null)
    showToast('Rol actualizado')
    cargar()
  }

  // ── Suspender / Reactivar ───────────────────────────────────
  async function toggleActivo(userId, activo) {
    await supabase.from('usuarios_tenant')
      .update({ activo: !activo })
      .eq('user_id', userId).eq('tenant_id', tenant.id)
    showToast(activo ? 'Usuario suspendido' : 'Usuario reactivado')
    cargar()
  }

  // ── Crear acceso ────────────────────────────────────────────
  function abrirCrear(prof = null) {
    setCreandoPara(prof)
    setFormEmail('')
    setFormPass(genPassword())
    setFormRol(prof ? 'profesional' : 'profesional')
    setCreError('')
  }

  async function crearAcceso() {
    if (!formEmail.trim() || !formPass.trim()) {
      setCreError('Email y contraseña requeridos'); return
    }
    setCreando(true); setCreError('')

    const { data: resultado, error } = await supabase.rpc('crear_acceso_tenant', {
      p_email:     formEmail.trim(),
      p_clave:     formPass.trim(),
      p_tenant_id: tenant.id,
      p_rol:       formRol,
      p_nombre:    creandoPara?.nombre || null,
    })

    if (error || !resultado?.ok) {
      const msg = resultado?.error || error?.message || 'Error creando acceso'
      setCreError(
        msg.includes('solo_admin') ? 'Solo el admin puede crear accesos'
        : msg.includes('clave_minimo') ? 'La clave debe tener al menos 6 caracteres'
        : msg
      )
      setCreando(false); return
    }

    // Vincular perfil de profesional si aplica
    if (creandoPara?.id) {
      await supabase.from('profesionales')
        .update({ user_id: resultado.user_id })
        .eq('id', creandoPara.id)
    }

    setCreando(false)
    setCreandoPara(null)
    showToast(`Acceso creado${creandoPara ? ` para ${creandoPara.nombre}` : ''}`)
    cargar()
  }

  // ── Resetear contraseña directamente (el admin ve y entrega la clave) ───────
  async function resetearClave() {
    if (!resetSheet?.email || !resetSheet?.nuevaClave?.trim()) return
    setResetLoading(true)
    const { data: resultado, error } = await supabase.rpc('resetear_clave_tenant', {
      p_email:     resetSheet.email,
      p_clave:     resetSheet.nuevaClave.trim(),
      p_tenant_id: tenant.id,
    })
    setResetLoading(false)
    if (error || !resultado?.ok) {
      showToast((resultado?.error || error?.message || 'Error'), false); return
    }
    setResetSent(true)
  }

  function copiarCreds() {
    const texto = `Acceso a Salón Pro\nURL: ${baseUrl}/salon\nEmail: ${formEmail}\nContraseña temporal: ${formPass}\n\nEl usuario puede cambiar su contraseña desde el login.`
    navigator.clipboard.writeText(texto).catch(() => {})
    showToast('Credenciales copiadas')
  }

  const activos = usuarios.filter(u => u.activo).length

  return (
    <div style={{ padding:'0 16px 80px' }}>
      {toast && <div className="sp-toast show" style={{ background:toast.color }}>{toast.msg}</div>}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:'var(--text)' }}>
          Accesos
        </h2>
        {activeTab === 'equipo' && (
          <button onClick={() => abrirCrear(null)} style={{
            padding:'8px 14px', borderRadius:10, border:'none', cursor:'pointer',
            background:col, color:'#fff', fontWeight:700, fontSize:13,
          }}>
            + Nuevo acceso
          </button>
        )}
      </div>

      {/* ── Tab switcher ── */}
      <div style={{ display:'flex', gap:4, marginBottom:18, background:'var(--surface)',
        borderRadius:12, padding:4, boxShadow:'0 1px 8px rgba(0,0,0,0.1)' }}>
        {[
          { key:'equipo',   label:'Equipo' },
          { key:'permisos', label:'Permisos por rol' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            flex:1, padding:'8px 12px', borderRadius:9, border:'none', cursor:'pointer',
            fontWeight:700, fontSize:13, transition:'all 0.15s',
            background: activeTab === t.key ? col : 'transparent',
            color:       activeTab === t.key ? '#fff' : 'var(--text-3)',
          }}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'equipo' && (
        <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:18 }}>
          {activos} usuario{activos !== 1 ? 's' : ''} activo{activos !== 1 ? 's' : ''} · {sinCuenta.length} sin cuenta
        </p>
      )}

      {/* ── Tab Permisos ── */}
      {activeTab === 'permisos' && (
        <div>
          <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:16, lineHeight:1.5 }}>
            Define qué módulos puede ver cada rol. <strong style={{ color:'var(--text-2)' }}>Admin</strong> y <strong style={{ color:'var(--text-2)' }}>Superadmin</strong> siempre tienen acceso total.
          </p>
          {!localPermisos ? (
            <div className="sp-skeleton" style={{ height:200, borderRadius:14 }} />
          ) : (
            <div style={{ overflowX:'auto', overflowY:'clip' }}>
              <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:'left', padding:'8px 12px', fontSize:11, fontWeight:700,
                      color:'var(--text-3)', letterSpacing:0.8, textTransform:'uppercase' }}>Módulo</th>
                    {ROLES_CONFIG.map(r => (
                      <th key={r.key} style={{ textAlign:'center', padding:'8px 10px', fontSize:11,
                        fontWeight:700, letterSpacing:0.8, textTransform:'uppercase', color:r.color }}>
                        {r.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULOS.map((mod, idx) => (
                    <tr key={mod.key} style={{
                      background: idx % 2 === 0 ? 'var(--card)' : 'transparent',
                    }}>
                      <td style={{ padding:'11px 12px', fontSize:13, fontWeight:600,
                        color:'var(--text-2)', borderRadius: idx === 0 ? '12px 0 0 0' : idx === MODULOS.length-1 ? '0 0 0 12px' : 0 }}>
                        {mod.label}
                      </td>
                      {ROLES_CONFIG.map(r => {
                        const activo = localPermisos?.[r.key]?.[mod.key] ?? false
                        return (
                          <td key={r.key} style={{ textAlign:'center', padding:'11px 10px' }}>
                            <button onClick={() => togglePermiso(r.key, mod.key)} style={{
                              width:40, height:22, borderRadius:11, border:'none', cursor:'pointer',
                              background: activo ? r.color : 'rgba(128,128,128,0.2)',
                              position:'relative', transition:'background 0.2s', flexShrink:0,
                              display:'inline-block',
                            }}>
                              <div style={{
                                position:'absolute', top:3,
                                left: activo ? 21 : 3,
                                width:16, height:16, borderRadius:8,
                                background:'#fff', transition:'left 0.18s',
                                boxShadow:'0 1px 4px rgba(0,0,0,0.25)',
                              }} />
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab Equipo ── */}
      {activeTab === 'equipo' && loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <div key={i} className="sp-skeleton" style={{ height:70, borderRadius:14 }} />)}
        </div>
      ) : activeTab === 'equipo' && (
        <>
          {/* ── Usuarios con acceso ── */}
          {usuarios.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:1,
                textTransform:'uppercase', marginBottom:10 }}>
                Con acceso — {usuarios.length}
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {usuarios.map(u => {
                  const r        = ROL[u.rol] || ROL.profesional
                  const nom      = u.profesional?.nombre || u.email || `...${u.user_id.slice(-6)}`
                  const abierto  = expandedUser === u.user_id
                  const modAcceso = MODULOS.filter(m => localPermisos?.[u.rol]?.[m.key] !== false)

                  return (
                    <div key={u.user_id} style={{
                      borderRadius:16, overflow:'hidden',
                      background:`linear-gradient(135deg,${r.color}10,var(--card))`,
                      boxShadow:'0 2px 12px rgba(0,0,0,0.1)',
                      opacity: u.activo ? 1 : 0.55,
                      transition:'opacity 0.2s',
                    }}>
                      {/* ── Fila principal ── */}
                      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', cursor:'pointer' }}
                        onClick={() => setExpandedUser(abierto ? null : u.user_id)}>
                        <div style={{
                          width:40, height:40, borderRadius:12, background:`${r.color}20`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontFamily:'Outfit', fontWeight:800, fontSize:17, color:r.color, flexShrink:0, overflow:'hidden',
                        }}>
                          {u.profesional?.foto_url
                            ? <img src={u.profesional.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : (nom[0] || '?').toUpperCase()
                          }
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                            {nom}
                          </div>
                          <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                            {u.email || 'Sin email'}
                          </div>
                        </div>
                        <span style={{ padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:700, background:`${r.color}18`, color:r.color, flexShrink:0 }}>
                          {r.label}
                        </span>
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={2}
                          strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, transition:'transform 0.2s', transform: abierto ? 'rotate(180deg)' : 'none' }}>
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>

                      {/* ── Panel expandido ── */}
                      {abierto && (
                        <div style={{ padding:'0 16px 16px', borderTop:`1px solid ${r.color}20` }}>

                          {/* Selector de rol */}
                          {u.rol !== 'superadmin' && (
                            <div style={{ marginBottom:14 }}>
                              <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, textTransform:'uppercase', margin:'12px 0 8px' }}>
                                Rol del integrante
                              </p>
                              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                                {['admin','contable','recepcion','profesional'].map(key => {
                                  const rk = ROL[key]
                                  const selec = u.rol === key
                                  return (
                                    <button key={key} onClick={() => cambiarRol(u.user_id, key)} style={{
                                      padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
                                      background: selec ? rk.color : `${rk.color}15`,
                                      color:      selec ? '#fff'    : rk.color,
                                      transition:'all 0.15s',
                                    }}>
                                      {rk.label}
                                    </button>
                                  )
                                })}
                              </div>
                              <p style={{ fontSize:11, color:'var(--text-3)', marginTop:5 }}>{r.desc}</p>
                            </div>
                          )}

                          {/* Módulos accesibles */}
                          <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, textTransform:'uppercase', marginBottom:8 }}>
                            Módulos con acceso
                          </p>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:14 }}>
                            {MODULOS.map(m => {
                              const tiene = localPermisos ? (localPermisos?.[u.rol]?.[m.key] !== false) : true
                              return (
                                <span key={m.key} style={{
                                  padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:600,
                                  background: tiene ? `${r.color}15` : 'rgba(239,68,68,0.08)',
                                  color:      tiene ? r.color        : '#f87171',
                                }}>
                                  {tiene ? '✓' : '✗'} {m.label}
                                </span>
                              )
                            })}
                          </div>

                          {/* Acciones */}
                          <div style={{ display:'flex', gap:8 }}>
                            <button onClick={() => { setResetSheet({ user_id:u.user_id, email:u.email, nuevaClave: genPassword() }); setResetSent(false) }} style={{
                              flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer',
                              background:'rgba(255,255,255,0.08)', color:'var(--text-2)', fontWeight:600, fontSize:12,
                            }}>
                              🔑 Cambiar clave
                            </button>
                            {u.rol !== 'superadmin' && (
                              <button onClick={() => toggleActivo(u.user_id, u.activo)} style={{
                                flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer',
                                fontWeight:600, fontSize:12,
                                background: u.activo ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                                color:      u.activo ? '#f87171'              : '#4ade80',
                              }}>
                                {u.activo ? '⊘ Suspender' : '✓ Reactivar'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Profesionales sin cuenta ── */}
          {sinCuenta.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:1,
                textTransform:'uppercase', marginBottom:10 }}>
                Profesionales sin cuenta — {sinCuenta.length}
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {sinCuenta.map(p => (
                  <div key={p.id} style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'14px 16px', borderRadius:14,
                    background:`linear-gradient(135deg,${col}0d,var(--card))`,
                    boxShadow:'0 2px 10px rgba(0,0,0,0.08)',
                  }}>
                    <div style={{
                      width:40, height:40, borderRadius:12, background:`${col}20`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'Outfit', fontWeight:800, fontSize:17, color:col, flexShrink:0, overflow:'hidden',
                    }}>
                      {p.foto_url
                        ? <img src={p.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : p.nombre[0]
                      }
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{p.nombre}</div>
                      <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>Sin acceso al panel</div>
                    </div>
                    <button onClick={() => abrirCrear(p)} style={{
                      padding:'7px 14px', borderRadius:9, fontSize:12, fontWeight:700,
                      background:col, border:'none', color:'#fff', cursor:'pointer', flexShrink:0,
                    }}>
                      + Crear acceso
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {usuarios.length === 0 && sinCuenta.length === 0 && (
            <div className="sp-empty">
              <span className="sp-empty-icon">🔑</span>
              <p className="sp-empty-title">Sin accesos</p>
              <p className="sp-empty-sub">Agrega profesionales en Equipo y créales acceso aquí</p>
            </div>
          )}

          {/* URL de acceso */}
          {linkAcceso && (
            <div style={{
              background:'var(--card)', borderRadius:14, padding:'14px 16px', marginTop:8,
              boxShadow:'0 1px 8px rgba(0,0,0,0.08)',
            }}>
              <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5,
                textTransform:'uppercase', marginBottom:8 }}>
                URL de acceso al panel
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ flex:1, fontSize:12, color:'var(--text-2)', fontFamily:'monospace',
                  overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                  {linkAcceso}
                </span>
                <button onClick={() => { navigator.clipboard.writeText(linkAcceso).catch(()=>{}); showToast('URL copiada') }}
                  style={{
                    padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:700,
                    background:`${col}20`, border:`1px solid ${col}40`,
                    color:col, cursor:'pointer', flexShrink:0,
                  }}>
                  Copiar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Sheet cambiar rol ── */}
      {rolSheet && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setRolSheet(null)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">Cambiar rol</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {['admin','contable','recepcion','profesional'].map(key => {
                const r = ROL[key]
                const activo = rolSheet.rol === key
                return (
                  <button key={key} onClick={() => cambiarRol(rolSheet.user_id, key)} style={{
                    display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                    borderRadius:14, cursor:'pointer', textAlign:'left',
                    background: activo ? `${r.color}12` : 'var(--card)',
                    border:`1px solid ${activo ? r.color + '50' : 'var(--border)'}`,
                  }}>
                    <div style={{
                      width:34, height:34, borderRadius:10, background:`${r.color}25`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'Outfit', fontWeight:800, fontSize:14, color:r.color,
                    }}>
                      {r.label[0]}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{r.label}</div>
                      <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{r.desc}</div>
                    </div>
                    {activo && <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px',
                      borderRadius:6, background:`${r.color}18`, color:r.color }}>Actual</span>}
                  </button>
                )
              })}
            </div>
            <button onClick={() => setRolSheet(null)} style={{
              width:'100%', padding:'13px', borderRadius:14,
              background:'var(--card)', border:'none', boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
              color:'var(--text-2)', fontWeight:600, fontSize:14, cursor:'pointer',
            }}>Cancelar</button>
          </div>
        </>
      )}

      {/* ── Sheet reset contraseña ── */}
      {resetSheet && (
        <>
          <div className="sp-sheet-overlay" onClick={() => { setResetSheet(null); setResetSent(false) }} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">Cambiar clave — {resetSheet.email}</p>
            {resetSent ? (
              <div style={{ textAlign:'center', padding:'12px 0 24px' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>✅</div>
                <p style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:12 }}>
                  Clave actualizada
                </p>
                <div style={{
                  padding:'14px 20px', borderRadius:14, marginBottom:12,
                  background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)',
                  fontFamily:'monospace', fontSize:20, fontWeight:800,
                  color:'#4ade80', letterSpacing:2,
                }}>
                  {resetSheet.nuevaClave}
                </div>
                <p style={{ fontSize:11, color:'var(--text-3)', marginBottom:16 }}>
                  Copia esta clave antes de cerrar
                </p>
                <button
                  onClick={() => { navigator.clipboard.writeText(resetSheet.nuevaClave).catch(()=>{}); showToast('Clave copiada') }}
                  style={{
                    width:'100%', padding:'11px', borderRadius:12, marginBottom:8, cursor:'pointer',
                    background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)',
                    color:'#4ade80', fontWeight:700, fontSize:13,
                  }}>Copiar clave</button>
                <button onClick={() => { setResetSheet(null); setResetSent(false) }} style={{
                  width:'100%', padding:'12px', borderRadius:12,
                  background:col, border:'none', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer',
                }}>Cerrar</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>
                    Nueva contraseña
                  </label>
                  <div style={{ display:'flex', gap:8 }}>
                    <input
                      value={resetSheet.nuevaClave || ''}
                      onChange={e => setResetSheet(s => ({ ...s, nuevaClave: e.target.value }))}
                      style={{
                        flex:1, padding:'10px 12px', borderRadius:12,
                        border:'none', background:'var(--card)',
                        color:'var(--text)', fontSize:14, outline:'none', fontFamily:'monospace',
                        boxShadow:'inset 0 1px 4px rgba(0,0,0,0.12)',
                      }}
                    />
                    <button
                      onClick={() => setResetSheet(s => ({ ...s, nuevaClave: genPassword() }))}
                      style={{
                        padding:'10px 12px', borderRadius:12, border:'none',
                        background:`${col}14`, color:col, cursor:'pointer', fontSize:16,
                      }}>↺</button>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => { setResetSheet(null); setResetSent(false) }} style={{
                    flex:1, padding:'12px', borderRadius:12, cursor:'pointer',
                    background:'var(--card)', border:'none', boxShadow:'0 1px 6px rgba(0,0,0,0.1)', color:'var(--text-2)', fontWeight:600,
                  }}>Cancelar</button>
                  <button onClick={resetearClave} disabled={resetLoading || !resetSheet.nuevaClave?.trim()} style={{
                    flex:2, padding:'12px', borderRadius:12, border:'none', cursor:'pointer',
                    background: col, color:'#fff', fontWeight:700, fontSize:14,
                    opacity: (resetLoading || !resetSheet.nuevaClave?.trim()) ? 0.7 : 1,
                  }}>
                    {resetLoading ? 'Cambiando…' : '🔑 Cambiar clave'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Sheet crear acceso ── */}
      {creandoPara !== null && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setCreandoPara(null)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">
              {creandoPara?.nombre ? `Crear acceso — ${creandoPara.nombre}` : 'Nuevo acceso'}
            </p>
            <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:18 }}>
              {creandoPara?.nombre
                ? 'El profesional podrá ingresar al panel con estas credenciales.'
                : 'Crea acceso para cualquier persona del equipo.'}
            </p>

            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:16 }}>
              <div>
                <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600,
                  letterSpacing:0.5, display:'block', marginBottom:6 }}>EMAIL</label>
                <input className="sp-input" type="email" placeholder="colaborador@email.com"
                  value={formEmail} onChange={e => setFormEmail(e.target.value)} autoFocus />
              </div>

              <div>
                <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600,
                  letterSpacing:0.5, display:'block', marginBottom:6 }}>CONTRASEÑA TEMPORAL</label>
                <div style={{ display:'flex', gap:8 }}>
                  <input className="sp-input" style={{ fontFamily:'monospace', flex:1, fontSize:13 }}
                    value={formPass} onChange={e => setFormPass(e.target.value)} />
                  <button onClick={() => setFormPass(genPassword())} style={{
                    padding:'0 12px', borderRadius:12, border:'none',
                    background:`${col}14`, color:col, cursor:'pointer', fontSize:16,
                  }}>↺</button>
                </div>
              </div>

              {!creandoPara?.nombre && (
                <div>
                  <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600,
                    letterSpacing:0.5, display:'block', marginBottom:6 }}>ROL</label>
                  <div style={{ display:'flex', gap:8 }}>
                    {['admin','contable','recepcion','profesional'].map(key => {
                      const r = ROL[key]
                      return (
                        <button key={key} type="button" onClick={() => setFormRol(key)} style={{
                          flex:1, padding:'9px 4px', borderRadius:10, cursor:'pointer',
                          border:`2px solid ${formRol === key ? r.color : 'var(--border)'}`,
                          background: formRol === key ? `${r.color}15` : 'var(--card)',
                          color: formRol === key ? r.color : 'var(--text-3)',
                          fontWeight:700, fontSize:12, transition:'all 0.15s',
                        }}>
                          {r.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <button onClick={copiarCreds} style={{
              width:'100%', padding:'12px', borderRadius:12, marginBottom:10,
              background:`${col}10`, border:'none',
              color:col, fontWeight:700, fontSize:14, cursor:'pointer',
            }}>
              📋 Copiar credenciales para compartir
            </button>

            {creError && (
              <p style={{ fontSize:12, color:'#f87171', marginBottom:10, padding:'8px 12px',
                borderRadius:8, background:'rgba(239,68,68,0.08)' }}>{creError}</p>
            )}

            <button onClick={crearAcceso} disabled={creando || !formEmail.trim()} style={{
              width:'100%', padding:'15px', borderRadius:14, cursor:'pointer',
              background: (creando || !formEmail.trim()) ? 'var(--border)' : col,
              border:'none', color: (creando || !formEmail.trim()) ? 'var(--text-3)' : '#fff',
              fontFamily:'Outfit', fontWeight:700, fontSize:15,
              opacity: (creando || !formEmail.trim()) ? 0.7 : 1,
            }}>
              {creando ? 'Creando acceso…' : 'Crear acceso'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
