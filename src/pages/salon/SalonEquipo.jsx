import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'
import ImageUploader from '../../components/ImageUploader'

function Ico({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const COLORS = ['#f43f5e','#a855f7','#3b82f6','#22c55e','#f59e0b','#06b6d4','#ec4899']

const DIAS_SEMANA = [
  { key:'lunes',     label:'Lunes' },
  { key:'martes',    label:'Martes' },
  { key:'miercoles', label:'Miércoles' },
  { key:'jueves',    label:'Jueves' },
  { key:'viernes',   label:'Viernes' },
  { key:'sabado',    label:'Sábado' },
  { key:'domingo',   label:'Domingo' },
]

function initHorarios(dbData) {
  const dbMap = {}
  ;(dbData || []).forEach(h => { dbMap[h.dia] = h })
  return DIAS_SEMANA.map(d => ({
    dia: d.key,
    activo:      dbMap[d.key] !== undefined ? dbMap[d.key].activo : d.key !== 'domingo',
    hora_inicio: dbMap[d.key] ? dbMap[d.key].hora_inicio.slice(0, 5) : '09:00',
    hora_fin:    dbMap[d.key] ? dbMap[d.key].hora_fin.slice(0, 5)    : '19:00',
  }))
}

export default function SalonEquipo() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [profs,       setProfs]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [toast,       setToast]       = useState(null)

  // Sheet editar profesional
  const [sel,         setSel]         = useState(null)
  const [form,        setForm]        = useState({})
  const [saving,      setSaving]      = useState(false)
  const [nuevo,       setNuevo]       = useState(false)
  const [elimConfirm, setElimConfirm] = useState(false)

  // Sheet horarios
  const [profH,    setProfH]    = useState(null)
  const [horarios, setHorarios] = useState([])
  const [savingH,  setSavingH]  = useState(false)

  const showToast = (msg, ok = true) => {
    setToast({ msg, color: ok ? '#22c55e' : '#ef4444' })
    setTimeout(() => setToast(null), 2500)
  }

  const cargar = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('profesionales')
      .select('*').eq('tenant_id', tenant.id).order('nombre')
    setProfs(data || [])
    setLoading(false)
  }, [tenant])

  useEffect(() => { cargar() }, [cargar])

  function cerrarSheet() {
    setSel(null)
    setElimConfirm(false)
  }

  // ── Horarios ─────────────────────────────────────────────────
  async function abrirHorarios(prof) {
    const { data } = await supabase.from('horarios')
      .select('dia, hora_inicio, hora_fin, activo')
      .eq('profesional_id', prof.id)
    setProfH(prof)
    setHorarios(initHorarios(data))
  }

  function toggleDia(dia) {
    setHorarios(hs => hs.map(h => h.dia === dia ? { ...h, activo: !h.activo } : h))
  }

  function setHora(dia, campo, valor) {
    setHorarios(hs => hs.map(h => h.dia === dia ? { ...h, [campo]: valor } : h))
  }

  async function guardarHorarios() {
    setSavingH(true)
    const { error } = await supabase.from('horarios').upsert(
      horarios.map(h => ({
        tenant_id:      tenant.id,
        profesional_id: profH.id,
        dia:            h.dia,
        hora_inicio:    h.hora_inicio,
        hora_fin:       h.hora_fin,
        activo:         h.activo,
      })),
      { onConflict: 'profesional_id,dia' }
    )
    setSavingH(false)
    if (error) { showToast(error.message, false); return }
    showToast('Horarios guardados')
    setProfH(null)
  }

  // ── Profesional edit ─────────────────────────────────────────
  function abrir(prof) {
    setSel(prof)
    setForm({ nombre: prof.nombre, especialidad: prof.especialidad || '', telefono: prof.telefono || '', foto_url: prof.foto_url || '', activo: prof.activo })
    setNuevo(false)
    setElimConfirm(false)
  }

  function abrirNuevo() {
    setSel({ id: null })
    setForm({ nombre:'', especialidad:'', telefono:'', foto_url:'', activo:true })
    setNuevo(true)
    setElimConfirm(false)
  }

  async function toggleActivo(prof) {
    const { error } = await supabase.from('profesionales')
      .update({ activo: !prof.activo }).eq('id', prof.id)
    if (error) { showToast(error.message, false); return }
    showToast(prof.activo ? 'Marcado inactivo' : 'Marcado activo')
    cargar()
  }

  async function guardar() {
    if (!form.nombre?.trim()) { showToast('Nombre requerido', false); return }
    setSaving(true)
    const payload = { nombre: form.nombre.trim(), especialidad: form.especialidad, telefono: form.telefono, foto_url: form.foto_url?.trim() || null, activo: form.activo }
    const { error } = nuevo
      ? await supabase.from('profesionales').insert({ ...payload, tenant_id: tenant.id })
      : await supabase.from('profesionales').update(payload).eq('id', sel.id)
    setSaving(false)
    if (error) { showToast(error.message, false); return }
    showToast(nuevo ? 'Profesional creado' : 'Cambios guardados')
    cerrarSheet()
    cargar()
  }

  async function eliminar() {
    setSaving(true)
    const { error } = await supabase.from('profesionales').delete().eq('id', sel.id)
    setSaving(false)
    if (error) {
      showToast('No se puede eliminar: tiene citas asociadas', false)
      setElimConfirm(false)
      return
    }
    showToast('Profesional eliminado')
    cerrarSheet()
    cargar()
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ padding:'0 16px 16px' }}>
      {toast && <div className="sp-toast show" style={{ background:toast.color }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:'var(--text)' }}>Equipo</h2>
        <button onClick={abrirNuevo} style={{
          display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:12,
          background:col, border:'none', color:'#fff', fontWeight:700, fontSize:13,
          cursor:'pointer', fontFamily:'Plus Jakarta Sans',
        }}>
          <Ico d="M12 4v16m8-8H4" size={15} />
          Agregar
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <div key={i} className="sp-skeleton" style={{ height:74, borderRadius:16 }} />)}
        </div>
      ) : profs.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon">💇</span>
          <p className="sp-empty-title">Sin profesionales</p>
          <p className="sp-empty-sub">Agrega el equipo de tu salón</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {profs.map((p, i) => {
            const color = COLORS[i % COLORS.length]
            return (
              <div key={p.id} style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'14px 16px', borderRadius:16,
                background:'var(--card)', border:'1px solid var(--border)',
              }}>
                {/* Avatar */}
                <div style={{
                  width:46, height:46, borderRadius:14, background:`${color}25`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'Outfit', fontWeight:800, fontSize:19, color, flexShrink:0,
                }}>
                  {p.foto_url
                    ? <img src={p.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit' }} />
                    : p.nombre[0]
                  }
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:15, color:'var(--text)',
                    overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                    {p.nombre}
                  </div>
                  {p.especialidad && (
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{p.especialidad}</div>
                  )}
                </div>

                {/* Badge activo — clic para toggle rápido */}
                <button
                  onClick={() => toggleActivo(p)}
                  title={p.activo ? 'Clic para desactivar' : 'Clic para activar'}
                  style={{
                    padding:'4px 9px', borderRadius:7, fontSize:11, fontWeight:700, flexShrink:0,
                    background: p.activo ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                    color:       p.activo ? '#4ade80' : '#f87171',
                    border:'none', cursor:'pointer',
                  }}>
                  {p.activo ? 'Activo' : 'Inactivo'}
                </button>

                {/* Botón horarios */}
                <button onClick={() => abrirHorarios(p)} title="Gestionar horarios" style={{
                  width:34, height:34, borderRadius:10, border:'1px solid var(--border)',
                  background:'var(--card)', color:'var(--text-2)', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                }}>
                  <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" size={15} />
                </button>

                {/* Botón editar */}
                <button onClick={() => abrir(p)} style={{
                  width:34, height:34, borderRadius:10, border:'1px solid var(--border)',
                  background:'var(--card)', color:'var(--text-2)', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                }}>
                  <Ico d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Sheet editar profesional ── */}
      {sel && (
        <>
          <div className="sp-sheet-overlay" onClick={cerrarSheet} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">{nuevo ? 'Nuevo profesional' : 'Editar profesional'}</p>

            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
              {[
                { key:'nombre',       label:'NOMBRE *',    placeholder:'' },
                { key:'especialidad', label:'ESPECIALIDAD',placeholder:'Ej: Colorista, Barbero…' },
                { key:'telefono',     label:'TELÉFONO',    placeholder:'', type:'tel' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>
                    {f.label}
                  </label>
                  <input className="sp-input" type={f.type || 'text'} placeholder={f.placeholder}
                    value={form[f.key] || ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}

              <ImageUploader
                label="FOTO"
                value={form.foto_url || ''}
                onChange={url => setForm(p => ({ ...p, foto_url: url }))}
                shape="circle"
                size={72}
                folder="profesionales"
                accent={col}
              />

              {/* Toggle activo */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'14px 16px', borderRadius:14, background:'var(--card)', border:'1px solid var(--border)' }}>
                <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>Activo</span>
                <button onClick={() => setForm(f => ({ ...f, activo: !f.activo }))} style={{
                  width:48, height:26, borderRadius:13, border:'none', cursor:'pointer',
                  background: form.activo ? col : 'var(--border)',
                  position:'relative', transition:'background 0.2s',
                }}>
                  <span style={{
                    position:'absolute', top:3, width:20, height:20, borderRadius:'50%',
                    background:'#fff', transition:'left 0.2s',
                    left: form.activo ? 25 : 4,
                  }} />
                </button>
              </div>
            </div>

            <button onClick={guardar} disabled={saving} style={{
              width:'100%', padding:'15px', borderRadius:14, cursor:'pointer',
              background:col, border:'none', color:'#fff',
              fontFamily:'Outfit', fontWeight:700, fontSize:15, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>

            {/* Eliminar (solo en edición) */}
            {!nuevo && (
              <div style={{ marginTop:14, borderTop:'1px solid var(--border)', paddingTop:14 }}>
                {!elimConfirm ? (
                  <button onClick={() => setElimConfirm(true)} style={{
                    width:'100%', padding:'12px', borderRadius:14, cursor:'pointer',
                    background:'transparent', border:'1px solid rgba(239,68,68,0.35)',
                    color:'#ef4444', fontFamily:'Outfit', fontWeight:600, fontSize:14,
                  }}>
                    Eliminar profesional
                  </button>
                ) : (
                  <div>
                    <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:10, textAlign:'center' }}>
                      ¿Confirmar eliminación? Esta acción es irreversible.
                    </p>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => setElimConfirm(false)} style={{
                        flex:1, padding:'12px', borderRadius:14, cursor:'pointer',
                        background:'var(--surface)', border:'1px solid var(--border)',
                        color:'var(--text-2)', fontWeight:600, fontSize:14,
                      }}>
                        Cancelar
                      </button>
                      <button onClick={eliminar} disabled={saving} style={{
                        flex:1, padding:'12px', borderRadius:14, cursor:'pointer',
                        background:'#ef4444', border:'none', color:'#fff',
                        fontWeight:700, fontSize:14, opacity: saving ? 0.7 : 1,
                      }}>
                        {saving ? 'Eliminando…' : 'Sí, eliminar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Sheet horarios ── */}
      {profH && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setProfH(null)} />
          <div className="sp-sheet" style={{ paddingBottom:80 }}>
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title" style={{ marginBottom:4 }}>
              Horarios · {profH.nombre.split(' ')[0]}
            </p>
            <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:20 }}>
              Días y horarios de atención
            </p>

            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
              {DIAS_SEMANA.map(d => {
                const h = horarios.find(x => x.dia === d.key) || { activo:false, hora_inicio:'09:00', hora_fin:'19:00' }
                return (
                  <div key={d.key} style={{
                    borderRadius:14, background:'var(--card)', border:'1px solid var(--border)',
                    overflow:'hidden',
                  }}>
                    {/* Fila día + toggle */}
                    <div style={{ display:'flex', alignItems:'center', padding:'12px 14px', gap:12 }}>
                      <span style={{
                        flex:1, fontWeight:600, fontSize:14,
                        color: h.activo ? 'var(--text)' : 'var(--text-3)',
                      }}>
                        {d.label}
                      </span>
                      {/* Toggle */}
                      <button onClick={() => toggleDia(d.key)} style={{
                        width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
                        background: h.activo ? col : 'rgba(128,128,128,0.2)',
                        position:'relative', transition:'background 0.2s', flexShrink:0,
                      }}>
                        <span style={{
                          position:'absolute', top:2, width:20, height:20, borderRadius:'50%',
                          background:'#fff', transition:'left 0.2s',
                          left: h.activo ? 22 : 2,
                        }} />
                      </button>
                    </div>

                    {/* Rangos horarios (solo si activo) */}
                    {h.activo && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:'0 14px 12px' }}>
                        <div>
                          <label style={{ fontSize:10, color:'var(--text-3)', fontWeight:600, display:'block', marginBottom:4, letterSpacing:0.5 }}>
                            DESDE
                          </label>
                          <input type="time" className="sp-input" style={{ padding:'8px 10px', fontSize:13 }}
                            value={h.hora_inicio}
                            onChange={e => setHora(d.key, 'hora_inicio', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontSize:10, color:'var(--text-3)', fontWeight:600, display:'block', marginBottom:4, letterSpacing:0.5 }}>
                            HASTA
                          </label>
                          <input type="time" className="sp-input" style={{ padding:'8px 10px', fontSize:13 }}
                            value={h.hora_fin}
                            onChange={e => setHora(d.key, 'hora_fin', e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button onClick={guardarHorarios} disabled={savingH} style={{
              width:'100%', padding:'15px', borderRadius:14, cursor:'pointer',
              background:col, border:'none', color:'#fff',
              fontFamily:'Outfit', fontWeight:700, fontSize:15, opacity: savingH ? 0.7 : 1,
            }}>
              {savingH ? 'Guardando…' : 'Guardar horarios'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
