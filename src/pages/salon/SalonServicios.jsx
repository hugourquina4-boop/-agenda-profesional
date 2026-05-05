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

export default function SalonServicios() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [servicios, setServicios] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [sel,       setSel]       = useState(null)
  const [form,      setForm]      = useState({})
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState(null)
  const [nuevo,     setNuevo]     = useState(false)

  const showToast = (msg, ok = true) => {
    setToast({ msg, color: ok ? '#22c55e' : '#ef4444' })
    setTimeout(() => setToast(null), 2500)
  }

  const cargar = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('servicios')
      .select('*').eq('tenant_id', tenant.id).order('categoria').order('nombre')
    setServicios(data || [])
    setLoading(false)
  }, [tenant])

  useEffect(() => { cargar() }, [cargar])

  // Agrupar por categoría
  const porCategoria = {}
  servicios.forEach(s => {
    const cat = s.categoria || 'General'
    if (!porCategoria[cat]) porCategoria[cat] = []
    porCategoria[cat].push(s)
  })

  function abrir(serv) {
    setSel(serv)
    setForm({
      nombre: serv.nombre, categoria: serv.categoria || '',
      precio: serv.precio || '', duracion_min: serv.duracion_min || 30,
      descripcion: serv.descripcion || '', activo: serv.activo,
    })
    setNuevo(false)
  }

  function abrirNuevo() {
    setSel({ id: null })
    setForm({ nombre:'', categoria:'', precio:'', duracion_min:30, descripcion:'', activo:true })
    setNuevo(true)
  }

  async function guardar() {
    if (!form.nombre?.trim()) { showToast('Nombre requerido', false); return }
    setSaving(true)
    const payload = {
      nombre: form.nombre.trim(),
      categoria: form.categoria || null,
      precio: form.precio ? Number(form.precio) : null,
      duracion_min: Number(form.duracion_min) || 30,
      descripcion: form.descripcion || null,
      activo: form.activo,
    }
    let err
    if (nuevo) {
      const { error } = await supabase.from('servicios').insert({ ...payload, tenant_id: tenant.id })
      err = error
    } else {
      const { error } = await supabase.from('servicios').update(payload).eq('id', sel.id)
      err = error
    }
    setSaving(false)
    if (err) { showToast(err.message, false); return }
    showToast(nuevo ? 'Servicio creado' : 'Guardado')
    setSel(null)
    cargar()
  }

  return (
    <div style={{ padding:'0 16px 16px' }}>
      {toast && <div className="sp-toast show" style={{ background: toast.color }}>{toast.msg}</div>}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:'var(--text)' }}>Servicios</h2>
        <button onClick={abrirNuevo} style={{
          display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:12,
          background:col, border:'none', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer',
          fontFamily:'Plus Jakarta Sans',
        }}>
          <Ico d="M12 4v16m8-8H4" size={15} />
          Agregar
        </button>
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <div key={i} className="sp-skeleton" style={{ height:66, borderRadius:14 }} />)}
        </div>
      ) : servicios.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon">✂️</span>
          <p className="sp-empty-title">Sin servicios</p>
          <p className="sp-empty-sub">Agrega los servicios que ofrece tu salón</p>
        </div>
      ) : (
        Object.entries(porCategoria).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom:20 }}>
            <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:1,
              textTransform:'uppercase', marginBottom:8 }}>
              {cat}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {items.map(s => (
                <div key={s.id} style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'13px 14px', borderRadius:14,
                  background:'var(--card)', border:'1px solid var(--border)',
                }}>
                  <div style={{
                    width:38, height:38, borderRadius:11, background:`${col}20`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:col, flexShrink:0,
                  }}>
                    <Ico d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" size={17} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14, color: s.activo ? 'var(--text)' : 'var(--text-3)' }}>
                      {s.nombre}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                      {s.duracion_min}min
                      {s.precio ? ` · $${Number(s.precio).toLocaleString('es-CO')}` : ''}
                    </div>
                  </div>
                  {!s.activo && (
                    <span style={{ fontSize:10, color:'var(--text-3)', fontWeight:600 }}>Inactivo</span>
                  )}
                  <button onClick={() => abrir(s)} style={{
                    width:32, height:32, borderRadius:9, border:'1px solid var(--border)',
                    background:'transparent', color:'var(--text-2)', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <Ico d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Sheet edición */}
      {sel && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setSel(null)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">{nuevo ? 'Nuevo servicio' : 'Editar servicio'}</p>

            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
              {[
                { key:'nombre',       label:'NOMBRE *',    placeholder:'Ej: Corte de cabello' },
                { key:'categoria',    label:'CATEGORÍA',   placeholder:'Ej: Cortes, Color, Tratamientos' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>
                    {f.label}
                  </label>
                  <input className="sp-input" placeholder={f.placeholder}
                    value={form[f.key] || ''} onChange={e => setForm(p => ({...p, [f.key]:e.target.value}))} />
                </div>
              ))}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>
                    PRECIO (COP)
                  </label>
                  <input className="sp-input" type="number" placeholder="0"
                    value={form.precio || ''} onChange={e => setForm(p => ({...p, precio:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>
                    DURACIÓN (min)
                  </label>
                  <input className="sp-input" type="number" min={5} step={5}
                    value={form.duracion_min || 30} onChange={e => setForm(p => ({...p, duracion_min:e.target.value}))} />
                </div>
              </div>

              <div>
                <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>
                  DESCRIPCIÓN
                </label>
                <textarea className="sp-input" rows={2} placeholder="Opcional…"
                  value={form.descripcion || ''} onChange={e => setForm(p => ({...p, descripcion:e.target.value}))}
                  style={{ resize:'none' }} />
              </div>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'14px 16px', borderRadius:14, background:'var(--card)', border:'1px solid var(--border)',
              }}>
                <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>Activo</span>
                <button onClick={() => setForm(f => ({...f, activo: !f.activo}))} style={{
                  width:48, height:26, borderRadius:13, border:'none', cursor:'pointer',
                  background: form.activo ? col : 'var(--text-3)', position:'relative', transition:'background 0.2s',
                }}>
                  <span style={{
                    position:'absolute', top:3, width:20, height:20, borderRadius:'50%',
                    background:'#fff', transition:'left 0.2s', left: form.activo ? 25 : 4,
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
          </div>
        </>
      )}
    </div>
  )
}
