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
  admin:       { label:'Admin',      color:'#8b5cf6', desc:'Acceso total al panel' },
  profesional: { label:'Profesional',color:'#3b82f6', desc:'Solo su propia agenda' },
  recepcion:   { label:'Recepción',  color:'#10b981', desc:'Agenda y clientes, sin config' },
}

function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function SalonAccesos() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [usuarios,   setUsuarios]   = useState([])  // { user_id, email, rol, activo, profesional }
  const [sinCuenta,  setSinCuenta]  = useState([])  // profesionales sin user_id
  const [loading,    setLoading]    = useState(true)
  const [toast,      setToast]      = useState(null)
  const [copiado,    setCopiado]    = useState(false)

  // Sheet crear acceso para un profesional
  const [creandoPara, setCreandoPara] = useState(null)  // profesional object
  const [formEmail,   setFormEmail]   = useState('')
  const [formPass,    setFormPass]    = useState('')
  const [creando,     setCreando]     = useState(false)
  const [creError,    setCreError]    = useState('')

  // Sheet cambiar rol
  const [rolSheet,   setRolSheet]   = useState(null)   // { user_id, rol_actual }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const linkRegistro = tenant?.slug ? `${baseUrl}/salon` : null

  const showToast = (msg, ok = true) => {
    setToast({ msg, color: ok ? '#22c55e' : '#ef4444' })
    setTimeout(() => setToast(null), 2500)
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
      email:       emailMap[u.user_id] || `...${u.user_id.slice(-6)}`,
      profesional: profMap[u.user_id] || null,
    }))

    setUsuarios(usrs)
    setSinCuenta((profs || []).filter(p => !p.user_id && p.activo))
    setLoading(false)
  }, [tenant])

  useEffect(() => { cargar() }, [cargar])

  // ── Cambiar rol ───────────────────────────────────────────────────
  async function cambiarRol(userId, nuevoRol) {
    await supabase.from('usuarios_tenant')
      .update({ rol: nuevoRol })
      .eq('user_id', userId).eq('tenant_id', tenant.id)
    setRolSheet(null)
    showToast('Rol actualizado')
    cargar()
  }

  // ── Suspender / Reactivar ─────────────────────────────────────────
  async function toggleActivo(userId, activo) {
    await supabase.from('usuarios_tenant')
      .update({ activo: !activo })
      .eq('user_id', userId).eq('tenant_id', tenant.id)
    showToast(activo ? 'Usuario suspendido' : 'Usuario reactivado')
    cargar()
  }

  // ── Crear acceso para un profesional ─────────────────────────────
  function abrirCrear(prof) {
    setCreandoPara(prof)
    setFormEmail('')
    setFormPass(genPassword())
    setCreError('')
  }

  async function crearAcceso() {
    if (!formEmail.trim() || !formPass.trim()) { setCreError('Email y contraseña requeridos'); return }
    setCreando(true); setCreError('')

    const { data, error: fnErr } = await supabase.functions.invoke('admin-crear-usuario', {
      body: {
        email:     formEmail.trim(),
        password:  formPass.trim(),
        tenant_id: tenant.id,
        rol:       'profesional',
      },
    })

    if (fnErr || data?.error) {
      const msg = data?.error || fnErr?.message || 'Error al crear acceso'
      setCreError(msg.includes('already') ? 'Este email ya tiene cuenta' : msg)
      setCreando(false); return
    }

    // Vincular al perfil del profesional
    await supabase.from('profesionales')
      .update({ user_id: data.user_id })
      .eq('id', creandoPara.id)

    setCreando(false)
    setCreandoPara(null)
    showToast(`Acceso creado para ${creandoPara.nombre}`)
    cargar()
  }

  function copiarLink() {
    if (!linkRegistro) return
    navigator.clipboard.writeText(linkRegistro).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function copiarCreds() {
    navigator.clipboard.writeText(
      `Acceso a Salón Pro\nURL: ${baseUrl}/salon\nEmail: ${formEmail}\nContraseña: ${formPass}`
    ).catch(() => {})
    showToast('Credenciales copiadas')
  }

  const activos = usuarios.filter(u => u.activo).length

  return (
    <div style={{ padding:'0 16px 80px' }}>
      {toast && <div className="sp-toast show" style={{ background:toast.color }}>{toast.msg}</div>}

      <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:'var(--text)', marginBottom:4 }}>
        Accesos
      </h2>
      <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:18 }}>
        {activos} usuario{activos !== 1 ? 's' : ''} activo{activos !== 1 ? 's' : ''} · {sinCuenta.length} profesional{sinCuenta.length !== 1 ? 'es' : ''} sin cuenta
      </p>

      {/* Qué es este módulo */}
      <div style={{
        background:`${col}0d`, border:`1px solid ${col}30`, borderRadius:14,
        padding:'14px 16px', marginBottom:20, fontSize:13, color:'var(--text-2)', lineHeight:1.6,
      }}>
        <b style={{ color:col }}>Gestión de accesos</b> — controla quién puede entrar al panel,
        con qué rol y qué puede hacer. Cada profesional puede tener su propia cuenta
        para ver solo su agenda.
      </div>

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
                  const nom = u.profesional?.nombre || u.email
                  return (
                    <div key={u.user_id} style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'14px 16px', borderRadius:14,
                      background:'var(--card)', border:'1px solid var(--border)',
                      opacity: u.activo ? 1 : 0.5,
                    }}>
                      {/* Avatar */}
                      <div style={{
                        width:40, height:40, borderRadius:12, background:`${r.color}20`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontFamily:'Outfit', fontWeight:800, fontSize:17, color:r.color, flexShrink:0,
                      }}>
                        {u.profesional?.foto_url
                          ? <img src={u.profesional.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit' }} />
                          : nom[0]?.toUpperCase()
                        }
                      </div>

                      {/* Info */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:'var(--text)',
                          overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                          {nom}
                        </div>
                        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2,
                          overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                          {u.profesional ? u.email : 'Sin perfil vinculado'}
                        </div>
                      </div>

                      {/* Role badge */}
                      <span style={{
                        padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:700,
                        background:`${r.color}18`, color:r.color, flexShrink:0,
                      }}>
                        {r.label}
                      </span>

                      {/* Acciones */}
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        <button
                          onClick={() => setRolSheet({ user_id:u.user_id, rol:u.rol })}
                          title="Cambiar rol"
                          style={{
                            width:32, height:32, borderRadius:9, border:'1px solid var(--border)',
                            background:'var(--card)', color:'var(--text-2)', cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}>
                          <Ico d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" size={15} />
                        </button>
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
                          } size={15} />
                        </button>
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
                Sin cuenta aún — {sinCuenta.length}
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
                      fontFamily:'Outfit', fontWeight:800, fontSize:17, color:col, flexShrink:0,
                    }}>
                      {p.foto_url
                        ? <img src={p.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit' }} />
                        : p.nombre[0]
                      }
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{p.nombre}</div>
                      <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>Sin acceso al panel</div>
                    </div>
                    <button onClick={() => abrirCrear(p)} style={{
                      padding:'7px 14px', borderRadius:9, fontSize:12, fontWeight:700,
                      background:col, border:'none', color:'#fff', cursor:'pointer',
                      fontFamily:'Plus Jakarta Sans', flexShrink:0,
                    }}>
                      + Crear acceso
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estado vacío */}
          {usuarios.length === 0 && sinCuenta.length === 0 && (
            <div className="sp-empty">
              <span className="sp-empty-icon">🔑</span>
              <p className="sp-empty-title">Sin accesos</p>
              <p className="sp-empty-sub">Agrega profesionales en Equipo y luego créales acceso aquí</p>
            </div>
          )}

          {/* Link de acceso */}
          {linkRegistro && (
            <div style={{
              background:'rgba(128,128,128,0.06)', border:'1px solid var(--border)',
              borderRadius:14, padding:'14px 16px',
            }}>
              <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5,
                textTransform:'uppercase', marginBottom:8 }}>
                URL de acceso al panel
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ flex:1, fontSize:12, color:'var(--text-2)', fontFamily:'monospace',
                  overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                  {linkRegistro}
                </span>
                <button onClick={copiarLink} style={{
                  padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:700,
                  background: copiado ? 'rgba(34,197,94,0.12)' : `${col}20`,
                  border:`1px solid ${copiado ? 'rgba(34,197,94,0.3)' : `${col}40`}`,
                  color: copiado ? '#4ade80' : col, cursor:'pointer', flexShrink:0,
                }}>
                  {copiado ? '✓ Copiada' : 'Copiar'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Sheet cambiar rol ─────────────────────────────────── */}
      {rolSheet && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setRolSheet(null)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">Cambiar rol</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
              {Object.entries(ROL).map(([key, r]) => {
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
                    {activo && (
                      <span style={{
                        fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:6,
                        background:`${r.color}18`, color:r.color,
                      }}>
                        Actual
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <button onClick={() => setRolSheet(null)} style={{
              width:'100%', padding:'13px', borderRadius:14,
              background:'var(--surface)', border:'1px solid var(--border)',
              color:'var(--text-2)', fontWeight:600, fontSize:14, cursor:'pointer',
            }}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {/* ── Sheet crear acceso para profesional ──────────────── */}
      {creandoPara && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setCreandoPara(null)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">Crear acceso — {creandoPara.nombre}</p>
            <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:18 }}>
              El profesional podrá entrar al panel y ver solo su propia agenda.
            </p>

            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:16 }}>
              <div>
                <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600,
                  letterSpacing:0.5, display:'block', marginBottom:6 }}>
                  EMAIL
                </label>
                <input className="sp-input" type="email" placeholder="profesional@email.com"
                  value={formEmail} onChange={e => setFormEmail(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600,
                  letterSpacing:0.5, display:'block', marginBottom:6 }}>
                  CONTRASEÑA TEMPORAL
                </label>
                <div style={{ display:'flex', gap:8 }}>
                  <input className="sp-input" style={{ fontFamily:'monospace', flex:1 }}
                    value={formPass} onChange={e => setFormPass(e.target.value)} />
                  <button onClick={() => setFormPass(genPassword())} style={{
                    padding:'0 12px', borderRadius:12, border:'1px solid var(--border)',
                    background:'var(--card)', color:'var(--text-2)', cursor:'pointer', fontSize:16,
                  }}>
                    🔁
                  </button>
                </div>
              </div>
            </div>

            <button onClick={copiarCreds} style={{
              width:'100%', padding:'12px', borderRadius:12, marginBottom:10,
              background:'rgba(128,128,128,0.08)', border:'1px solid var(--border)',
              color:'var(--text-2)', fontWeight:600, fontSize:14, cursor:'pointer',
            }}>
              📋 Copiar credenciales para enviar
            </button>

            {creError && (
              <p style={{ fontSize:12, color:'#f87171', marginBottom:10 }}>{creError}</p>
            )}

            <button onClick={crearAcceso} disabled={creando || !formEmail.trim()} style={{
              width:'100%', padding:'15px', borderRadius:14, cursor:'pointer',
              background:col, border:'none', color:'#fff',
              fontFamily:'Outfit', fontWeight:700, fontSize:15,
              opacity: (creando || !formEmail.trim()) ? 0.7 : 1,
            }}>
              {creando ? 'Creando…' : 'Crear acceso y vincular'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
