import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'
import ImageUploader from '../../components/ImageUploader'
import HorarioGrid, { rangeToSlots, slotsToRange } from '../../components/HorarioGrid'

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
  return DIAS_SEMANA.map(d => {
    const inicio = dbMap[d.key] ? dbMap[d.key].hora_inicio.slice(0, 5) : '09:00'
    const fin    = dbMap[d.key] ? dbMap[d.key].hora_fin.slice(0, 5)    : '19:00'
    return {
      dia:         d.key,
      activo:      dbMap[d.key] !== undefined ? dbMap[d.key].activo : d.key !== 'domingo',
      hora_inicio: inicio,
      hora_fin:    fin,
      slots:       rangeToSlots(inicio, fin),
    }
  })
}

export default function SalonEquipo() {
  const { tenant, recargar } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [profs,       setProfs]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [toast,       setToast]       = useState(null)

  // Sheet editar propietario
  const [editOwner,    setEditOwner]    = useState(false)
  const [ownerForm,    setOwnerForm]    = useState({})
  const [savingOwner,  setSavingOwner]  = useState(false)

  // Sheet editar profesional
  const [sel,         setSel]         = useState(null)
  const [form,        setForm]        = useState({})
  const [saving,      setSaving]      = useState(false)
  const [nuevo,       setNuevo]       = useState(false)
  const [elimTarget,  setElimTarget]  = useState(null)

  // Sheet horarios
  const [profH,       setProfH]       = useState(null)
  const [horarios,    setHorarios]    = useState([])
  const [savingH,     setSavingH]     = useState(false)
  const [expandedDia, setExpandedDia] = useState(null)

  // Sheet excepciones
  const [excProf,     setExcProf]     = useState(null)
  const [excepciones, setExcepciones] = useState([])
  const [excMes,      setExcMes]      = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 } })
  const [excForm,     setExcForm]     = useState(null)
  const [savingExc,   setSavingExc]   = useState(false)

  const showToast = (msg, ok = true) => {
    setToast({ msg, color: ok ? '#22c55e' : '#ef4444' })
    setTimeout(() => setToast(null), ok ? 2500 : 6000)
  }

  async function verificarAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      showToast('Sesión expirada — recarga e inicia sesión', false)
      return false
    }
    return true
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
  }

  // ── Horarios ─────────────────────────────────────────────────
  async function abrirHorarios(prof) {
    const { data } = await supabase.from('horarios')
      .select('dia, hora_inicio, hora_fin, activo')
      .eq('profesional_id', prof.id)
    setProfH(prof)
    setHorarios(initHorarios(data))
    setExpandedDia(null)
  }

  function toggleDia(dia) {
    setHorarios(hs => hs.map(h => h.dia === dia ? { ...h, activo: !h.activo } : h))
    setExpandedDia(null)
  }

  function setDiaSlots(dia, newSlots) {
    setHorarios(hs => hs.map(h => {
      if (h.dia !== dia) return h
      const { hora_inicio, hora_fin } = slotsToRange(newSlots)
      return { ...h, slots: newSlots, hora_inicio, hora_fin }
    }))
  }

  // ── Excepciones ───────────────────────────────────────────────
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  function formatFecha(fechaStr) {
    const [y, m, d] = fechaStr.split('-').map(Number)
    const fecha = new Date(y, m - 1, d)
    const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    return `${dias[fecha.getDay()]} ${d} ${MESES[m - 1].slice(0, 3)}`
  }

  async function cargarExcepciones(profId, year, month) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const nextM = month === 12 ? 1 : month + 1
    const nextY = month === 12 ? year + 1 : year
    const end   = `${nextY}-${String(nextM).padStart(2, '0')}-01`
    const { data } = await supabase
      .from('horarios_excepcion')
      .select('id, fecha, activo, hora_inicio, hora_fin, nota')
      .eq('profesional_id', profId)
      .gte('fecha', start)
      .lt('fecha', end)
      .order('fecha')
    setExcepciones(data || [])
  }

  async function abrirExcepciones(prof) {
    setExcProf(prof)
    setExcForm(null)
    await cargarExcepciones(prof.id, excMes.year, excMes.month)
  }

  function cambiarMes(delta) {
    setExcMes(prev => {
      let m = prev.month + delta
      let y = prev.year
      if (m > 12) { m = 1; y++ }
      if (m < 1)  { m = 12; y-- }
      if (excProf) cargarExcepciones(excProf.id, y, m)
      return { year: y, month: m }
    })
  }

  function abrirNuevaExcepcion() {
    const today = new Date().toISOString().split('T')[0]
    setExcForm({ id: null, fecha: today, activo: true, slots: rangeToSlots('09:00', '19:00'), hora_inicio: '09:00', hora_fin: '19:00', nota: '', isNew: true })
  }

  function abrirEditarExcepcion(exc) {
    const inicio = exc.hora_inicio ? exc.hora_inicio.slice(0, 5) : '09:00'
    const fin    = exc.hora_fin    ? exc.hora_fin.slice(0, 5)    : '19:00'
    setExcForm({ id: exc.id, fecha: exc.fecha, activo: exc.activo, slots: exc.activo ? rangeToSlots(inicio, fin) : [], hora_inicio: inicio, hora_fin: fin, nota: exc.nota || '', isNew: false })
  }

  function setExcSlots(newSlots) {
    const { hora_inicio, hora_fin } = slotsToRange(newSlots)
    setExcForm(f => ({ ...f, slots: newSlots, hora_inicio, hora_fin }))
  }

  async function guardarExcepcion() {
    setSavingExc(true)
    const payload = {
      tenant_id:      tenant.id,
      profesional_id: excProf.id,
      fecha:          excForm.fecha,
      activo:         excForm.activo,
      hora_inicio:    excForm.activo ? excForm.hora_inicio : null,
      hora_fin:       excForm.activo ? excForm.hora_fin    : null,
      nota:           excForm.nota || null,
    }
    const { error } = excForm.isNew
      ? await supabase.from('horarios_excepcion').insert(payload)
      : await supabase.from('horarios_excepcion').update(payload).eq('id', excForm.id)
    setSavingExc(false)
    if (error) { showToast(error.message, false); return }
    showToast(excForm.isNew ? 'Excepción creada' : 'Excepción actualizada')
    setExcForm(null)
    cargarExcepciones(excProf.id, excMes.year, excMes.month)
  }

  async function eliminarExcepcion(id) {
    const { error } = await supabase.from('horarios_excepcion').delete().eq('id', id)
    if (error) { showToast(error.message, false); return }
    showToast('Excepción eliminada')
    cargarExcepciones(excProf.id, excMes.year, excMes.month)
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
  }

  function abrirNuevo() {
    setSel({ id: null })
    setForm({ nombre:'', especialidad:'', telefono:'', foto_url:'', activo:true })
    setNuevo(true)
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
    if (!elimTarget) return
    if (!await verificarAuth()) { setElimTarget(null); return }
    setSaving(true)
    const id  = elimTarget.id
    const tid = tenant.id
    await supabase.from('lista_espera').delete().eq('profesional_id', id).eq('tenant_id', tid)
    await supabase.from('horarios').delete().eq('profesional_id', id).eq('tenant_id', tid)
    await supabase.from('citas').delete().eq('profesional_id', id).eq('tenant_id', tid)
    const { error, count } = await supabase
      .from('profesionales')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('tenant_id', tid)
    setSaving(false)
    if (error) { showToast('Error: ' + error.message, false); return }
    if (!count || count === 0) {
      showToast('No se eliminó — sin permisos o sesión expirada', false)
      setElimTarget(null)
      return
    }
    showToast('Profesional eliminado')
    setElimTarget(null)
    if (sel?.id === id) cerrarSheet()
    cargar()
  }

  // ── Propietario ──────────────────────────────────────────────
  function abrirEditOwner() {
    setOwnerForm({
      nombre_representante: tenant?.nombre_representante || '',
      foto_representante:   tenant?.foto_representante   || '',
    })
    setEditOwner(true)
  }

  async function guardarOwner() {
    if (!tenant) return
    setSavingOwner(true)
    const { error } = await supabase.from('tenants')
      .update({
        nombre_representante: ownerForm.nombre_representante.trim() || null,
        foto_representante:   ownerForm.foto_representante.trim()   || null,
      })
      .eq('id', tenant.id)
    setSavingOwner(false)
    if (error) { showToast(error.message, false); return }
    await recargar()
    setEditOwner(false)
    showToast('Datos del propietario actualizados')
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
      {/* ── Card propietario ─────────────────────────────── */}
      {(tenant?.nombre_representante || tenant?.admin_email) && (
        <div style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'14px 16px', borderRadius:16, marginBottom:8,
          background:`linear-gradient(135deg,${col}10,${col}06)`,
          border:`1px solid ${col}35`,
        }}>
          {/* Avatar */}
          <div style={{
            width:46, height:46, borderRadius:14, background:`${col}25`, flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'Outfit', fontWeight:800, fontSize:19, color:col, overflow:'hidden',
          }}>
            {tenant?.foto_representante
              ? <img src={tenant.foto_representante} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit' }} />
              : (tenant?.nombre_representante?.[0] || '?').toUpperCase()
            }
          </div>

          {/* Info */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
              <span style={{ fontWeight:700, fontSize:15, color:'var(--text)',
                overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                {tenant?.nombre_representante || tenant?.admin_email || 'Propietario'}
              </span>
              <span style={{
                padding:'2px 7px', borderRadius:20, fontSize:10, fontWeight:700,
                background:`${col}20`, color:col, flexShrink:0,
              }}>Propietario</span>
            </div>
            {tenant?.admin_email && (
              <div style={{ fontSize:12, color:'var(--text-3)',
                overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                {tenant.admin_email}
              </div>
            )}
          </div>

          {/* Editar */}
          <button onClick={abrirEditOwner} title="Editar propietario" style={{
            width:34, height:34, borderRadius:10, border:`1px solid ${col}35`,
            background:`${col}10`, color:col, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <Ico d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={15} />
          </button>
        </div>
      )}

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

                {/* Botones de acción — agrupados para que nunca se corten */}
                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  <button
                    onClick={() => toggleActivo(p)}
                    title={p.activo ? 'Desactivar' : 'Activar'}
                    style={{
                      padding:'4px 9px', borderRadius:7, fontSize:11, fontWeight:700,
                      background: p.activo ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                      color:       p.activo ? '#4ade80' : '#f87171',
                      border:'none', cursor:'pointer', whiteSpace:'nowrap',
                    }}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </button>

                  <button onClick={() => abrirHorarios(p)} title="Horarios" style={{
                    width:32, height:32, borderRadius:9, border:'1px solid var(--border)',
                    background:'transparent', color:'var(--text-2)', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" size={14} />
                  </button>

                  <button onClick={() => abrir(p)} title="Editar" style={{
                    width:32, height:32, borderRadius:9, border:'1px solid var(--border)',
                    background:'transparent', color:'var(--text-2)', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <Ico d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={14} />
                  </button>

                  <button onClick={() => setElimTarget(p)} title="Eliminar" style={{
                    width:32, height:32, borderRadius:9, border:'1px solid rgba(239,68,68,0.35)',
                    background:'rgba(239,68,68,0.06)', color:'#ef4444', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <Ico d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={14} />
                  </button>
                </div>
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

            {/* Eliminar — ANTES de Guardar para que siempre sea visible */}
            {!nuevo && (
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
                <button onClick={() => { setElimTarget(sel); cerrarSheet() }} style={{
                  width:'100%', padding:'13px', borderRadius:14, cursor:'pointer',
                  background:'rgba(239,68,68,0.08)', border:'1.5px solid rgba(239,68,68,0.4)',
                  color:'#ef4444', fontFamily:'Outfit', fontWeight:700, fontSize:15,
                }}>
                  🗑 Eliminar profesional
                </button>
              </div>
            )}

            <button onClick={guardar} disabled={saving} style={{
              width:'100%', padding:'15px', borderRadius:14, cursor:'pointer',
              background:col, border:'none', color:'#fff',
              fontFamily:'Outfit', fontWeight:700, fontSize:15, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </>
      )}

      {/* Confirmar eliminación */}
      {elimTarget && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setElimTarget(null)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <div style={{ textAlign:'center', padding:'8px 0 20px' }}>
              <div style={{ fontSize:44, marginBottom:12 }}>🗑️</div>
              <p style={{ fontFamily:'Outfit', fontWeight:800, fontSize:18, color:'var(--text)', marginBottom:8 }}>
                ¿Eliminar a {elimTarget.nombre}?
              </p>
              <p style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.6 }}>
                Se borrarán sus citas y horarios.<br />Esta acción es irreversible.
              </p>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setElimTarget(null)} style={{
                flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                background:'var(--surface)', border:'1px solid var(--border)',
                color:'var(--text-2)', fontWeight:600, fontSize:14,
              }}>Cancelar</button>
              <button onClick={eliminar} disabled={saving} style={{
                flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                background:'#ef4444', border:'none', color:'#fff', fontWeight:700, fontSize:14,
                opacity: saving ? 0.7 : 1,
              }}>{saving ? 'Eliminando…' : 'Sí, eliminar'}</button>
            </div>
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

                    {/* Selector táctil de horario */}
                    {h.activo && (
                      <div>
                        {/* Expand button — shows range and toggles grid */}
                        <button
                          onClick={() => setExpandedDia(expandedDia === d.key ? null : d.key)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', padding: '8px 14px',
                            background: 'none', border: 'none', borderTop: '1px solid var(--border)',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                            {h.slots.length > 0 ? `${h.hora_inicio} — ${h.hora_fin}` : 'Sin horario'}
                          </span>
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                            stroke="var(--text-3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                            style={{ transform: expandedDia === d.key ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>

                        {/* Tactile grid — only rendered when expanded */}
                        {expandedDia === d.key && (
                          <div style={{ padding: '4px 14px 14px', maxHeight: 380, overflowY: 'auto' }}>
                            <HorarioGrid
                              value={h.slots}
                              onChange={slots => setDiaSlots(d.key, slots)}
                              accentColor={col}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => { const p = profH; setProfH(null); abrirExcepciones(p) }}
              style={{
                width:'100%', padding:'12px', borderRadius:14, cursor:'pointer',
                marginBottom:10, background:'var(--surface)',
                border:'1px solid var(--border)', color:'var(--text-2)',
                fontFamily:'Plus Jakarta Sans', fontWeight:600, fontSize:14,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              }}
            >
              <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" size={15} />
              Excepciones por fecha
            </button>

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

      {/* ── Sheet excepciones ── */}
      {excProf && (
        <>
          <div className="sp-sheet-overlay" onClick={() => { setExcProf(null); setExcForm(null) }} />
          <div className="sp-sheet" style={{ paddingBottom:80 }}>
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title" style={{ marginBottom:4 }}>
              {excForm
                ? (excForm.isNew ? 'Nueva excepción' : 'Editar excepción')
                : `Excepciones · ${excProf.nombre.split(' ')[0]}`
              }
            </p>
            <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:16 }}>
              {excForm ? 'Ajuste para una fecha específica' : 'Días con horario diferente o ausencia'}
            </p>

            {!excForm ? (
              <>
                {/* Navegador de mes */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                  <button onClick={() => cambiarMes(-1)} style={{
                    width:36, height:36, borderRadius:10, border:'1px solid var(--border)',
                    background:'transparent', color:'var(--text-2)', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <Ico d="M15 18l-6-6 6-6" size={16} />
                  </button>
                  <span style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>
                    {MESES[excMes.month - 1]} {excMes.year}
                  </span>
                  <button onClick={() => cambiarMes(1)} style={{
                    width:36, height:36, borderRadius:10, border:'1px solid var(--border)',
                    background:'transparent', color:'var(--text-2)', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <Ico d="M9 18l6-6-6-6" size={16} />
                  </button>
                </div>

                {/* Lista de excepciones */}
                {excepciones.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'28px 0 24px', color:'var(--text-3)', fontSize:13 }}>
                    Sin excepciones en {MESES[excMes.month - 1]}
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                    {excepciones.map(exc => (
                      <div key={exc.id} style={{
                        display:'flex', alignItems:'center', gap:10,
                        padding:'12px 14px', borderRadius:12,
                        background:'var(--card)', border:'1px solid var(--border)',
                      }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>
                            {formatFecha(exc.fecha)}
                          </div>
                          <div style={{ fontSize:12, marginTop:2 }}>
                            {exc.activo
                              ? <span style={{ color:'#22c55e' }}>{exc.hora_inicio?.slice(0,5)} — {exc.hora_fin?.slice(0,5)}</span>
                              : <span style={{ color:'#ef4444' }}>Ausente</span>
                            }
                            {exc.nota && <span style={{ color:'var(--text-3)', marginLeft:8 }}>{exc.nota}</span>}
                          </div>
                        </div>
                        <button onClick={() => abrirEditarExcepcion(exc)} style={{
                          width:30, height:30, borderRadius:8, border:'1px solid var(--border)',
                          background:'transparent', color:'var(--text-2)', cursor:'pointer',
                          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                        }}>
                          <Ico d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={13} />
                        </button>
                        <button onClick={() => eliminarExcepcion(exc.id)} style={{
                          width:30, height:30, borderRadius:8,
                          border:'1px solid rgba(239,68,68,0.35)',
                          background:'rgba(239,68,68,0.06)', color:'#ef4444', cursor:'pointer',
                          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                        }}>
                          <Ico d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={abrirNuevaExcepcion} style={{
                  width:'100%', padding:'13px', borderRadius:14, cursor:'pointer',
                  background:col, border:'none', color:'#fff',
                  fontFamily:'Outfit', fontWeight:700, fontSize:15,
                }}>
                  + Agregar excepción
                </button>
              </>
            ) : (
              /* Formulario de excepción */
              <>
                <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:20 }}>
                  {/* Fecha */}
                  <div>
                    <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>FECHA</label>
                    <input type="date" className="sp-input"
                      value={excForm.fecha}
                      onChange={e => setExcForm(f => ({ ...f, fecha: e.target.value }))} />
                  </div>

                  {/* Toggle trabaja ese día */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'14px 16px', borderRadius:14, background:'var(--card)', border:'1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>Trabaja ese día</div>
                      <div style={{ fontSize:12, color:'var(--text-3)' }}>Desactivar = ausencia completa</div>
                    </div>
                    <button onClick={() => setExcForm(f => ({ ...f, activo: !f.activo }))} style={{
                      width:48, height:26, borderRadius:13, border:'none', cursor:'pointer',
                      background: excForm.activo ? col : 'var(--border)',
                      position:'relative', transition:'background 0.2s',
                    }}>
                      <span style={{
                        position:'absolute', top:3, width:20, height:20, borderRadius:'50%',
                        background:'#fff', transition:'left 0.2s',
                        left: excForm.activo ? 25 : 4,
                      }} />
                    </button>
                  </div>

                  {/* Grid horario si trabaja */}
                  {excForm.activo && (
                    <div>
                      <div style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, marginBottom:8 }}>
                        HORARIO — {excForm.slots.length > 0 ? `${excForm.hora_inicio} — ${excForm.hora_fin}` : 'Sin selección'}
                      </div>
                      <div style={{ maxHeight:280, overflowY:'auto' }}>
                        <HorarioGrid
                          value={excForm.slots}
                          onChange={setExcSlots}
                          accentColor={col}
                        />
                      </div>
                    </div>
                  )}

                  {/* Nota */}
                  <div>
                    <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>NOTA (opcional)</label>
                    <input type="text" className="sp-input" placeholder="Ej: Vacaciones, cita médica…"
                      value={excForm.nota}
                      onChange={e => setExcForm(f => ({ ...f, nota: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setExcForm(null)} style={{
                    flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                    background:'var(--surface)', border:'1px solid var(--border)',
                    color:'var(--text-2)', fontWeight:600, fontSize:14,
                  }}>Cancelar</button>
                  <button onClick={guardarExcepcion} disabled={savingExc} style={{
                    flex:2, padding:'14px', borderRadius:14, cursor:'pointer',
                    background:col, border:'none', color:'#fff',
                    fontFamily:'Outfit', fontWeight:700, fontSize:14,
                    opacity: savingExc ? 0.7 : 1,
                  }}>{savingExc ? 'Guardando…' : 'Guardar'}</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
      {/* ── Sheet editar propietario ─────────────────────── */}
      {editOwner && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setEditOwner(false)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">Propietario del negocio</p>

            <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:16 }}>
              {/* Foto */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                <div style={{
                  width:72, height:72, borderRadius:20, background:`${col}25`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'Outfit', fontWeight:800, fontSize:28, color:col,
                  overflow:'hidden', flexShrink:0,
                }}>
                  {ownerForm.foto_representante
                    ? <img src={ownerForm.foto_representante} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : (ownerForm.nombre_representante?.[0] || '?').toUpperCase()
                  }
                </div>
                <ImageUploader
                  bucket="salon-fotos"
                  path={`${tenant?.id}/propietario`}
                  currentUrl={ownerForm.foto_representante}
                  onUploaded={url => setOwnerForm(f => ({ ...f, foto_representante: url }))}
                  label="Subir foto"
                />
              </div>

              <div>
                <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>
                  NOMBRE DEL PROPIETARIO
                </label>
                <input
                  autoFocus
                  className="sp-input"
                  placeholder="María García"
                  value={ownerForm.nombre_representante}
                  onChange={e => setOwnerForm(f => ({ ...f, nombre_representante: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setEditOwner(false)} style={{
                flex:1, padding:'13px', borderRadius:14, cursor:'pointer',
                background:'transparent', border:'1px solid var(--border)',
                color:'var(--text-2)', fontWeight:600, fontSize:14,
              }}>Cancelar</button>
              <button onClick={guardarOwner} disabled={savingOwner} style={{
                flex:2, padding:'13px', borderRadius:14, cursor:'pointer',
                background:`linear-gradient(135deg,${col},${col}cc)`,
                border:'none', color:'#fff', fontFamily:'Outfit', fontWeight:700, fontSize:15,
                opacity: savingOwner ? 0.7 : 1,
              }}>{savingOwner ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
