import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

// Cliente temporal sin sesión persistente — solo para crear usuarios nuevos
// No afecta la sesión del admin logueado
const supabaseTemp = createClient(
  'https://unpxoamfyushsbyyziyn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucHhvYW1meXVzaHNieXl6aXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTUyOTQsImV4cCI6MjA5MjU5MTI5NH0.MvtKlr9QDDc2sgUz6u424eAFiPFEcZvW5xTKbV8STV0',
  { auth: { persistSession: false, autoRefreshToken: false } }
)

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
  recepcion:  { label:'Recepción',  color:'#10b981', desc:'Agenda y clientes, sin config' },
  profesional:{ label:'Profesional',color:'#3b82f6', desc:'Solo su propia agenda' },
}

function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function SalonAccesos() {
  const { tenant, esSuperadmin } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

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

    const usrs = (uts || []).map(u => ({
      ...u,
      email:       emailMap[u.user_id] || '',
      profesional: profMap[u.user_id] || null,
    }))

    setUsuarios(usrs)
    setSinCuenta((profs || []).filter(p => !p.user_id && p.activo))
    setLoading(false)
  }, [tenant])

  useEffect(() => { cargar() }, [cargar])

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
    setFormRol('profesional')
    setCreError('')
  }

  async function crearAcceso() {
    if (!formEmail.trim() || !formPass.trim()) {
      setCreError('Email y contraseña requeridos'); return
    }
    setCreando(true); setCreError('')

    // 1. Crear usuario en Supabase Auth con cliente temporal (no afecta sesión del admin)
    const { data, error: signUpErr } = await supabaseTemp.auth.signUp({
      email:    formEmail.trim(),
      password: formPass.trim(),
    })

    if (signUpErr) {
      setCreError(
        signUpErr.message.includes('already') ? 'Este email ya tiene cuenta en el sistema'
        : signUpErr.message
      )
      setCreando(false); return
    }

    const newUserId = data?.user?.id
    if (!newUserId) {
      setCreError('No se pudo obtener el ID del usuario creado')
      setCreando(false); return
    }

    // 2. Vincular al tenant usando función segura (SECURITY DEFINER)
    const { error: linkErr } = await supabase.rpc('crear_usuario_tenant', {
      p_user_id:  newUserId,
      p_tenant_id: tenant.id,
      p_rol:      formRol,
    })

    if (linkErr) {
      setCreError('Usuario creado pero no se pudo vincular al negocio: ' + linkErr.message)
      setCreando(false); return
    }

    // 3. Si se crea para un profesional específico, vincular su perfil
    if (creandoPara?.id) {
      await supabase.from('profesionales')
        .update({ user_id: newUserId })
        .eq('id', creandoPara.id)
    }

    setCreando(false)
    setCreandoPara(null)
    showToast(`Acceso creado${creandoPara ? ` para ${creandoPara.nombre}` : ''}`)
    cargar()
  }

  // ── Enviar reset de contraseña ──────────────────────────────
  async function enviarReset() {
    if (!resetSheet?.email) return
    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetSheet.email, {
      redirectTo: `${baseUrl}/salon`,
    })
    setResetLoading(false)
    if (error) { showToast('Error: ' + error.message, false); return }
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

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
        <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:'var(--text)' }}>
          Accesos
        </h2>
        <button onClick={() => abrirCrear(null)} style={{
          padding:'8px 14px', borderRadius:10, border:'none', cursor:'pointer',
          background:col, color:'#fff', fontWeight:700, fontSize:13,
        }}>
          + Nuevo acceso
        </button>
      </div>
      <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:18 }}>
        {activos} usuario{activos !== 1 ? 's' : ''} activo{activos !== 1 ? 's' : ''} · {sinCuenta.length} sin cuenta
      </p>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <div key={i} className="sp-skeleton" style={{ height:70, borderRadius:14 }} />)}
        </div>
      ) : (
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
                  const r   = ROL[u.rol] || ROL.profesional
                  const nom = u.profesional?.nombre || u.email || `...${u.user_id.slice(-6)}`
                  return (
                    <div key={u.user_id} style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'14px 16px', borderRadius:14,
                      background:'var(--card)', border:'1px solid var(--border)',
                      opacity: u.activo ? 1 : 0.5,
                    }}>
                      <div style={{
                        width:40, height:40, borderRadius:12, background:`${r.color}20`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontFamily:'Outfit', fontWeight:800, fontSize:17, color:r.color, flexShrink:0,
                        overflow:'hidden',
                      }}>
                        {u.profesional?.foto_url
                          ? <img src={u.profesional.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : (nom[0] || '?').toUpperCase()
                        }
                      </div>

                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:'var(--text)',
                          overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                          {nom}
                        </div>
                        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2,
                          overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                          {u.email || 'Sin email'}
                        </div>
                      </div>

                      <span style={{
                        padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:700,
                        background:`${r.color}18`, color:r.color, flexShrink:0,
                      }}>
                        {r.label}
                      </span>

                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        {/* Reset contraseña */}
                        <button
                          onClick={() => { setResetSheet({ user_id:u.user_id, email:u.email }); setResetSent(false) }}
                          title="Resetear contraseña"
                          style={{
                            width:32, height:32, borderRadius:9, border:'1px solid var(--border)',
                            background:'var(--card)', color:'var(--text-3)', cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}>
                          <Ico d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" size={14} />
                        </button>

                        {/* Cambiar rol */}
                        {u.rol !== 'superadmin' && (
                          <button
                            onClick={() => setRolSheet({ user_id:u.user_id, rol:u.rol })}
                            title="Cambiar rol"
                            style={{
                              width:32, height:32, borderRadius:9, border:'1px solid var(--border)',
                              background:'var(--card)', color:'var(--text-2)', cursor:'pointer',
                              display:'flex', alignItems:'center', justifyContent:'center',
                            }}>
                            <Ico d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" size={14} />
                          </button>
                        )}

                        {/* Suspender/Reactivar */}
                        {u.rol !== 'superadmin' && (
                          <button
                            onClick={() => toggleActivo(u.user_id, u.activo)}
                            title={u.activo ? 'Suspender' : 'Reactivar'}
                            style={{
                              width:32, height:32, borderRadius:9,
                              border:`1px solid ${u.activo ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                              background:'transparent',
                              color: u.activo ? '#f87171' : '#4ade80',
                              cursor:'pointer',
                              display:'flex', alignItems:'center', justifyContent:'center',
                            }}>
                            <Ico d={u.activo
                              ? 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
                              : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                            } size={14} />
                          </button>
                        )}
                      </div>
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
                    background:'var(--card)', border:'1px solid var(--border)',
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
              background:'rgba(128,128,128,0.06)', border:'1px solid var(--border)',
              borderRadius:14, padding:'14px 16px', marginTop:8,
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
              {['admin','recepcion','profesional'].map(key => {
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
              background:'var(--surface)', border:'1px solid var(--border)',
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
            <p className="sp-sheet-title">Restablecer contraseña</p>
            {resetSent ? (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📨</div>
                <p style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:6 }}>Email enviado</p>
                <p style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.6 }}>
                  Se envió un link de restablecimiento a <b>{resetSheet.email}</b>.
                  El usuario debe hacer click en el link para crear su nueva contraseña.
                </p>
                <button onClick={() => { setResetSheet(null); setResetSent(false) }} style={{
                  marginTop:20, width:'100%', padding:'13px', borderRadius:14,
                  background:col, border:'none', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer',
                }}>Listo</button>
              </div>
            ) : (
              <>
                <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:20, lineHeight:1.6 }}>
                  Se enviará un email a <b style={{ color:'var(--text)' }}>{resetSheet.email}</b> con un link
                  para que el usuario pueda crear una nueva contraseña.
                </p>
                <button onClick={enviarReset} disabled={resetLoading} style={{
                  width:'100%', padding:'15px', borderRadius:14, cursor:'pointer',
                  background: resetLoading ? 'var(--border)' : col,
                  border:'none', color:'#fff',
                  fontFamily:'Outfit', fontWeight:700, fontSize:15,
                  opacity: resetLoading ? 0.7 : 1,
                }}>
                  {resetLoading ? 'Enviando…' : 'Enviar link de restablecimiento'}
                </button>
                <button onClick={() => setResetSheet(null)} style={{
                  width:'100%', marginTop:8, padding:'13px', borderRadius:14,
                  background:'transparent', border:'1px solid var(--border)',
                  color:'var(--text-2)', fontWeight:600, fontSize:14, cursor:'pointer',
                }}>Cancelar</button>
              </>
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
                    padding:'0 12px', borderRadius:12, border:'1px solid var(--border)',
                    background:'var(--card)', color:'var(--text-2)', cursor:'pointer', fontSize:16,
                  }}>↺</button>
                </div>
              </div>

              {!creandoPara?.nombre && (
                <div>
                  <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600,
                    letterSpacing:0.5, display:'block', marginBottom:6 }}>ROL</label>
                  <div style={{ display:'flex', gap:8 }}>
                    {['admin','recepcion','profesional'].map(key => {
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
              background:'rgba(128,128,128,0.08)', border:'1px solid var(--border)',
              color:'var(--text-2)', fontWeight:600, fontSize:14, cursor:'pointer',
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
