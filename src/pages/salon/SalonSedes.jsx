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

const EMPTY = { nombre:'', direccion:'', ciudad:'', telefono:'' }

export default function SalonSedes() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [sedes,       setSedes]       = useState([])
  const [profs,       setProfs]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [sheet,       setSheet]       = useState(null)  // null | 'nueva' | sede-obj
  const [form,        setForm]        = useState(EMPTY)
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState(null)
  const [asignando,   setAsignando]   = useState(null)  // sede.id siendo asignado

  const showToast = (msg, color='#22c55e') => {
    setToast({msg,color})
    setTimeout(() => setToast(null), 2600)
  }

  const cargar = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    const [{ data: sedesData }, { data: profsData }] = await Promise.all([
      supabase.from('sedes').select('*').eq('tenant_id', tenant.id).order('principal', {ascending:false}).order('nombre'),
      supabase.from('profesionales').select('id, nombre, foto_url, sede_id').eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
    ])
    setSedes(sedesData || [])
    setProfs(profsData || [])
    setLoading(false)
  }, [tenant?.id])

  useEffect(() => { cargar() }, [cargar])

  function abrirNueva() { setForm(EMPTY); setSheet('nueva') }
  function abrirEditar(s) { setForm({ nombre:s.nombre, direccion:s.direccion||'', ciudad:s.ciudad||'', telefono:s.telefono||'' }); setSheet(s) }

  async function guardar(e) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setSaving(true)
    const payload = { tenant_id: tenant.id, nombre: form.nombre.trim(),
      direccion: form.direccion.trim() || null, ciudad: form.ciudad.trim() || null,
      telefono: form.telefono.trim() || null }

    if (sheet === 'nueva') {
      const { error } = await supabase.from('sedes').insert({ ...payload, principal: sedes.length === 0 })
      if (error) { showToast('Error al guardar', '#ef4444'); setSaving(false); return }
      showToast('Sede creada ✓')
    } else {
      const { error } = await supabase.from('sedes').update(payload).eq('id', sheet.id)
      if (error) { showToast('Error al guardar', '#ef4444'); setSaving(false); return }
      showToast('Sede actualizada ✓')
    }
    setSaving(false)
    setSheet(null)
    cargar()
  }

  async function toggleActivo(s) {
    await supabase.from('sedes').update({ activo: !s.activo }).eq('id', s.id)
    cargar()
  }

  async function marcarPrincipal(s) {
    await supabase.from('sedes').update({ principal: false }).eq('tenant_id', tenant.id)
    await supabase.from('sedes').update({ principal: true }).eq('id', s.id)
    showToast(`${s.nombre} es ahora la sede principal ✓`)
    cargar()
  }

  async function eliminar(s) {
    if (!confirm(`¿Eliminar "${s.nombre}"? Los profesionales asignados quedarán sin sede.`)) return
    await supabase.from('sedes').delete().eq('id', s.id)
    showToast('Sede eliminada')
    cargar()
  }

  async function asignarProf(profId, sedeId) {
    await supabase.from('profesionales').update({ sede_id: sedeId || null }).eq('id', profId)
    setProfs(p => p.map(x => x.id === profId ? {...x, sede_id: sedeId || null} : x))
  }

  const inp = { className:'sp-input', style:{marginTop:6} }

  return (
    <div className="sp-page" style={{ padding:'0 0 40px' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)',
          zIndex:999, background:toast.color, color:'#fff', padding:'10px 20px',
          borderRadius:20, fontSize:13, fontWeight:700, boxShadow:'0 4px 20px rgba(0,0,0,0.2)',
          whiteSpace:'nowrap' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'20px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:22, color:'var(--text)', margin:0 }}>Sedes</h2>
          <p style={{ fontSize:13, color:'var(--text-3)', margin:'2px 0 0' }}>
            {sedes.length === 0 ? 'Gestiona tus sucursales' : `${sedes.filter(s=>s.activo).length} activas`}
          </p>
        </div>
        <button onClick={abrirNueva} style={{
          display:'flex', alignItems:'center', gap:7, padding:'10px 16px',
          borderRadius:12, border:'none', cursor:'pointer',
          background:`linear-gradient(135deg,${col},${col}cc)`,
          color:'#fff', fontWeight:700, fontSize:13,
          boxShadow:`0 4px 14px ${col}40`,
        }}>
          <Ico d="M12 4v16m8-8H4" size={16} /> Nueva sede
        </button>
      </div>

      <div style={{ padding:'16px 16px 0', display:'flex', flexDirection:'column', gap:12 }}>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:48 }}>
            <div className="sp-spinner" />
          </div>
        ) : sedes.length === 0 ? (
          <div style={{
            textAlign:'center', padding:'48px 24px',
            background:'var(--card)', borderRadius:20,
            border:'1.5px dashed var(--border)',
          }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🏪</div>
            <p style={{ fontWeight:700, color:'var(--text)', marginBottom:6 }}>Sin sedes registradas</p>
            <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:20 }}>
              Si tienes varias sucursales, agrégalas aquí para filtrar la agenda por local.
            </p>
            <button onClick={abrirNueva} style={{
              padding:'11px 24px', borderRadius:12, border:'none', cursor:'pointer',
              background:`linear-gradient(135deg,${col},${col}cc)`,
              color:'#fff', fontWeight:700, fontSize:13,
            }}>
              Agregar primera sede
            </button>
          </div>
        ) : (
          sedes.map(s => {
            const profsEnSede = profs.filter(p => p.sede_id === s.id)
            const sinSede     = profs.filter(p => !p.sede_id)
            return (
              <div key={s.id} style={{
                background:'var(--card)', borderRadius:18,
                border:`1.5px solid ${s.activo ? `${col}25` : 'var(--border)'}`,
                overflow:'hidden', opacity: s.activo ? 1 : 0.55,
              }}>
                {/* Cabecera sede */}
                <div style={{ padding:'16px 16px 12px', display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div style={{
                    width:44, height:44, borderRadius:12, flexShrink:0,
                    background: s.principal ? `linear-gradient(135deg,${col},${col}bb)` : `${col}18`,
                    display:'flex', alignItems:'center', justifyContent:'center', color: s.principal ? '#fff' : col,
                  }}>
                    <Ico d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" size={20} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:800, fontSize:15, color:'var(--text)' }}>{s.nombre}</span>
                      {s.principal && (
                        <span style={{ fontSize:10, fontWeight:700, background:`${col}20`,
                          color:col, padding:'2px 8px', borderRadius:6 }}>Principal</span>
                      )}
                    </div>
                    {(s.ciudad || s.direccion) && (
                      <p style={{ fontSize:12, color:'var(--text-3)', margin:'3px 0 0' }}>
                        {[s.direccion, s.ciudad].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {s.telefono && (
                      <p style={{ fontSize:12, color:'var(--text-3)', margin:'1px 0 0' }}>{s.telefono}</p>
                    )}
                  </div>
                  {/* Acciones */}
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    <button onClick={() => abrirEditar(s)} style={{
                      padding:'7px 12px', borderRadius:9, border:'none', cursor:'pointer',
                      background:'var(--bg)', fontSize:12, color:'var(--text-2)', fontWeight:600,
                    }}>
                      Editar
                    </button>
                    <button onClick={() => toggleActivo(s)} style={{
                      padding:'7px 10px', borderRadius:9, border:'none', cursor:'pointer',
                      background: s.activo ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
                      fontSize:11, color: s.activo ? '#ef4444' : '#22c55e', fontWeight:600,
                    }}>
                      {s.activo ? 'Pausar' : 'Activar'}
                    </button>
                  </div>
                </div>

                {/* Profesionales asignados */}
                <div style={{ borderTop:`1px solid ${col}12`, padding:'10px 16px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
                      letterSpacing:0.5, textTransform:'uppercase' }}>
                      Profesionales ({profsEnSede.length})
                    </span>
                    <button onClick={() => setAsignando(asignando === s.id ? null : s.id)}
                      style={{ background:'none', border:'none', cursor:'pointer',
                        fontSize:11, color:col, fontWeight:700 }}>
                      {asignando === s.id ? '✓ Listo' : '+ Asignar'}
                    </button>
                  </div>

                  {asignando === s.id ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {profs.map(p => {
                        const enEsta = p.sede_id === s.id
                        return (
                          <label key={p.id} style={{
                            display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                            padding:'8px 10px', borderRadius:10,
                            background: enEsta ? `${col}10` : 'var(--bg)',
                            border:`1px solid ${enEsta ? col+'40' : 'var(--border)'}`,
                          }}>
                            <input type="checkbox" checked={enEsta}
                              onChange={() => asignarProf(p.id, enEsta ? null : s.id)}
                              style={{ accentColor:col }} />
                            <span style={{ fontSize:13, color:'var(--text)', fontWeight: enEsta ? 600 : 400 }}>
                              {p.nombre}
                            </span>
                            {p.sede_id && p.sede_id !== s.id && (
                              <span style={{ fontSize:10, color:'var(--text-3)', marginLeft:'auto' }}>
                                en otra sede
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  ) : profsEnSede.length === 0 ? (
                    <p style={{ fontSize:12, color:'var(--text-3)', fontStyle:'italic' }}>
                      Sin profesionales asignados
                    </p>
                  ) : (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {profsEnSede.map(p => (
                        <span key={p.id} style={{
                          fontSize:12, fontWeight:600, padding:'4px 10px', borderRadius:8,
                          background:`${col}15`, color:col,
                        }}>
                          {p.nombre}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer: acciones extra */}
                {!s.principal && s.activo && (
                  <div style={{ borderTop:`1px solid ${col}10`, padding:'8px 16px',
                    display:'flex', gap:12 }}>
                    <button onClick={() => marcarPrincipal(s)} style={{
                      background:'none', border:'none', cursor:'pointer',
                      fontSize:12, color:'var(--text-3)', fontWeight:600, padding:0,
                    }}>
                      Marcar como principal
                    </button>
                    <button onClick={() => eliminar(s)} style={{
                      background:'none', border:'none', cursor:'pointer',
                      fontSize:12, color:'#ef4444', fontWeight:600, padding:0, marginLeft:'auto',
                    }}>
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Profesionales sin sede */}
        {!loading && sedes.length > 0 && profs.some(p => !p.sede_id) && (
          <div style={{ background:'var(--card)', borderRadius:14,
            border:'1px solid var(--border)', padding:'12px 16px' }}>
            <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
              letterSpacing:0.5, textTransform:'uppercase', marginBottom:8 }}>
              Sin sede asignada ({profs.filter(p=>!p.sede_id).length})
            </p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {profs.filter(p=>!p.sede_id).map(p => (
                <span key={p.id} style={{ fontSize:12, padding:'4px 10px', borderRadius:8,
                  background:'var(--bg)', color:'var(--text-2)', fontWeight:500 }}>
                  {p.nombre}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sheet nueva / editar sede */}
      {sheet && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setSheet(null)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">
              {sheet === 'nueva' ? 'Nueva sede' : `Editar — ${sheet.nombre}`}
            </p>
            <form onSubmit={guardar} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, letterSpacing:0.5,
                  color:'var(--text-3)', textTransform:'uppercase' }}>Nombre *</label>
                <input {...inp} value={form.nombre}
                  onChange={e => setForm(f=>({...f,nombre:e.target.value}))}
                  placeholder="Sede Centro" required autoFocus />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, letterSpacing:0.5,
                  color:'var(--text-3)', textTransform:'uppercase' }}>Dirección</label>
                <input {...inp} value={form.direccion}
                  onChange={e => setForm(f=>({...f,direccion:e.target.value}))}
                  placeholder="Calle 15 #23-45" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, letterSpacing:0.5,
                    color:'var(--text-3)', textTransform:'uppercase' }}>Ciudad</label>
                  <input {...inp} value={form.ciudad}
                    onChange={e => setForm(f=>({...f,ciudad:e.target.value}))}
                    placeholder="Cali" />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, letterSpacing:0.5,
                    color:'var(--text-3)', textTransform:'uppercase' }}>Teléfono</label>
                  <input {...inp} value={form.telefono}
                    onChange={e => setForm(f=>({...f,telefono:e.target.value}))}
                    placeholder="3001234567" />
                </div>
              </div>

              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button type="button" onClick={() => setSheet(null)} style={{
                  flex:1, padding:'13px', borderRadius:12, border:'none', cursor:'pointer',
                  background:'var(--bg)', color:'var(--text-2)', fontWeight:600, fontSize:14,
                }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving || !form.nombre.trim()} style={{
                  flex:2, padding:'13px', borderRadius:12, border:'none', cursor:'pointer',
                  background:`linear-gradient(135deg,${col},${col}cc)`,
                  color:'#fff', fontWeight:700, fontSize:14, opacity: saving ? 0.7 : 1,
                }}>
                  {saving ? 'Guardando…' : sheet === 'nueva' ? 'Crear sede' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
