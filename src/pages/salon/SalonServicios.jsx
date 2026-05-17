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

const CATEGORIAS = [
  'Cortes','Color','Tratamientos','Manicura','Pedicura','Uñas Acrílicas / Gel',
  'Maquillaje','Cejas y Pestañas','Masajes','Barba y Afeitado','Depilación',
  'Spa','Extensiones','Alisado / Keratina',
]

const DURACIONES = [15,20,30,45,60,75,90,120,150,180]

const RECORD_DEFAULT =
  'Hola {{nombre_cliente}} 👋 Te recordamos tu cita de {{servicio}} el {{fecha}} a las {{hora}} con {{profesional}} en {{negocio}}. ¡Te esperamos! Si necesitas cambiarla escríbenos.'

export default function SalonServicios() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [servicios,    setServicios]    = useState([])
  const [profesionales,setProfesionales]= useState([])
  const [productos,    setProductos]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [sel,          setSel]          = useState(null)
  const [tab,          setTab]          = useState('detalles')
  const [form,         setForm]         = useState({})
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState(null)
  const [nuevo,        setNuevo]        = useState(false)
  const [elimConfirm,  setElimConfirm]  = useState(false)
  const [elimTarget,   setElimTarget]   = useState(null)

  const showToast = (msg, ok = true) => {
    setToast({ msg, color: ok ? '#22c55e' : '#ef4444' })
    setTimeout(() => setToast(null), ok ? 2500 : 6000)
  }

  const cargar = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    const [{ data: servs }, { data: profs }, { data: prods }] = await Promise.all([
      supabase.from('servicios').select('*').eq('tenant_id', tenant.id).order('categoria').order('nombre'),
      supabase.from('profesionales').select('id,nombre,color').eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
      supabase.from('productos_salon').select('id,nombre,categoria').eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
    ])
    setServicios(servs || [])
    setProfesionales(profs || [])
    setProductos(prods || [])
    setLoading(false)
  }, [tenant])

  useEffect(() => { cargar() }, [cargar])

  const porCategoria = {}
  servicios.forEach(s => {
    const cat = s.categoria || 'General'
    if (!porCategoria[cat]) porCategoria[cat] = []
    porCategoria[cat].push(s)
  })

  function cerrarSheet() { setSel(null); setElimConfirm(false); setTab('detalles') }

  function abrir(serv) {
    setSel(serv)
    setTab('detalles')
    setForm({
      nombre:             serv.nombre,
      categoria:          serv.categoria || '',
      precio:             serv.precio || '',
      precio_oferta:      serv.precio_oferta || '',
      duracion_min:       serv.duracion_min || 30,
      descripcion:        serv.descripcion || '',
      activo:             serv.activo,
      recordatorio_texto: serv.recordatorio_texto || RECORD_DEFAULT,
      profesionales_ids:  serv.profesionales_ids || [],
      productos_ids:      serv.productos_ids || [],
    })
    setNuevo(false)
    setElimConfirm(false)
  }

  function abrirNuevo() {
    setSel({ id: null })
    setTab('detalles')
    setForm({
      nombre:'', categoria:'', precio:'', precio_oferta:'',
      duracion_min:30, descripcion:'', activo:true,
      recordatorio_texto: RECORD_DEFAULT,
      profesionales_ids: [], productos_ids: [],
    })
    setNuevo(true)
    setElimConfirm(false)
  }

  function toggleProf(id) {
    setForm(f => {
      const ids = f.profesionales_ids || []
      return { ...f, profesionales_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] }
    })
  }

  function toggleProducto(id) {
    setForm(f => {
      const ids = f.productos_ids || []
      return { ...f, productos_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] }
    })
  }

  async function guardar() {
    if (!form.nombre?.trim()) { showToast('Nombre requerido', false); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { showToast('Sesión expirada', false); return }
    setSaving(true)
    const payload = {
      nombre:             form.nombre.trim(),
      categoria:          form.categoria || null,
      precio:             form.precio ? Number(form.precio) : null,
      precio_oferta:      form.precio_oferta ? Number(form.precio_oferta) : null,
      duracion_min:       Number(form.duracion_min) || 30,
      descripcion:        form.descripcion || null,
      activo:             form.activo,
      recordatorio_texto: form.recordatorio_texto || null,
      profesionales_ids:  form.profesionales_ids?.length ? form.profesionales_ids : null,
      productos_ids:      form.productos_ids?.length ? form.productos_ids : null,
    }
    const { error } = nuevo
      ? await supabase.from('servicios').insert({ ...payload, tenant_id: tenant.id })
      : await supabase.from('servicios').update(payload).eq('id', sel.id).eq('tenant_id', tenant.id)
    setSaving(false)
    if (error) { showToast(error.message, false); return }
    showToast(nuevo ? 'Servicio creado' : 'Guardado')
    cerrarSheet()
    cargar()
  }

  async function eliminar(id) {
    const targetId = id || sel?.id
    if (!targetId) return
    setSaving(true)
    const { error, count } = await supabase
      .from('servicios').delete({ count: 'exact' })
      .eq('id', targetId).eq('tenant_id', tenant.id)
    setSaving(false)
    if (error || !count) { showToast(error?.message || 'Sin permisos', false); setElimConfirm(false); return }
    showToast('Servicio eliminado')
    setElimTarget(null)
    cerrarSheet()
    cargar()
  }

  // Precio final visible
  const precioFinal = form.precio_oferta ? Number(form.precio_oferta)
    : form.precio ? Number(form.precio) : null

  const TABS = [
    { key:'detalles',     label:'Detalles' },
    { key:'precio',       label:'Precio' },
    { key:'especialistas',label:'Equipo' },
    { key:'productos',    label:'Productos' },
    { key:'recordatorio', label:'Recordatorio' },
  ]

  return (
    <div style={{ padding:'0 16px 16px' }}>
      {toast && <div className="sp-toast show" style={{ background: toast.color }}>{toast.msg}</div>}

      {/* Confirmar borrado rápido */}
      {elimTarget && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setElimTarget(null)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <div style={{ textAlign:'center', padding:'8px 0 20px' }}>
              <div style={{ fontSize:44, marginBottom:12 }}>🗑️</div>
              <p style={{ fontFamily:'Outfit', fontWeight:800, fontSize:18, color:'var(--text)', marginBottom:8 }}>
                ¿Eliminar "{elimTarget.nombre}"?
              </p>
              <p style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.6 }}>Esta acción es irreversible.</p>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setElimTarget(null)} style={{
                flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                background:'var(--card)', border:'1px solid var(--border)',
                color:'var(--text-2)', fontWeight:600, fontSize:14,
              }}>Cancelar</button>
              <button onClick={() => eliminar(elimTarget.id)} disabled={saving} style={{
                flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                background:'#ef4444', border:'none', color:'#fff', fontWeight:700, fontSize:14,
                opacity: saving ? 0.7 : 1,
              }}>{saving ? 'Eliminando…' : 'Sí, eliminar'}</button>
            </div>
          </div>
        </>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:'var(--text)' }}>Servicios</h2>
        <button onClick={abrirNuevo} style={{
          display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:12,
          background:col, border:'none', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer',
        }}>
          <Ico d="M12 4v16m8-8H4" size={15} /> Agregar
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
              textTransform:'uppercase', marginBottom:8 }}>{cat}</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {items.map(s => (
                <div key={s.id} className="sp-tbl-row" style={{
                  display:'flex', alignItems:'center', gap:12,
                  opacity: s.activo ? 1 : 0.55, cursor:'pointer',
                }} onClick={() => abrir(s)}>
                  <div style={{
                    width:36, height:36, borderRadius:10, flexShrink:0,
                    background:`linear-gradient(135deg, ${col}28, ${col}10)`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:col, boxShadow:`0 2px 8px ${col}20`,
                  }}>
                    <Ico d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" size={16} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{s.nombre}</span>
                      {s.precio_oferta && (
                        <span style={{ fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:5,
                          background:'rgba(34,197,94,0.15)', color:'#22c55e', letterSpacing:0.4 }}>
                          OFERTA
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-3)', marginTop:3 }}>
                      {s.duracion_min}min
                      {s.precio_oferta
                        ? <> · <span style={{ textDecoration:'line-through', opacity:0.5 }}>${Number(s.precio).toLocaleString('es-CO')}</span> · <span style={{ color:'#22c55e', fontWeight:700 }}>${Number(s.precio_oferta).toLocaleString('es-CO')}</span></>
                        : s.precio ? ` · $${Number(s.precio).toLocaleString('es-CO')}` : ''
                      }
                      {s.profesionales_ids?.length ? ` · ${s.profesionales_ids.length} prof.` : ''}
                      {s.productos_ids?.length ? ` · ${s.productos_ids.length} prod.` : ''}
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setElimTarget(s) }} title="Eliminar" style={{
                    width:30, height:30, borderRadius:8, border:'none',
                    background:'rgba(239,68,68,0.08)', color:'#f87171', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                  }}>
                    <Ico d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* ── Sheet edición multi-tab ── */}
      {sel && (
        <>
          <div className="sp-sheet-overlay" onClick={cerrarSheet} />
          <div className="sp-sheet" style={{ maxHeight:'95dvh' }}>
            <div className="sp-sheet-handle" />

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <p className="sp-sheet-title" style={{ margin:0 }}>{nuevo ? 'Nuevo servicio' : 'Editar servicio'}</p>
              {!nuevo && (
                <button onClick={() => setForm(f => ({...f, activo: !f.activo}))} style={{
                  padding:'5px 12px', borderRadius:8, border:`1px solid ${form.activo ? col : 'var(--border)'}`,
                  background: form.activo ? `${col}18` : 'transparent',
                  color: form.activo ? col : 'var(--text-3)',
                  fontWeight:700, fontSize:11, cursor:'pointer',
                }}>
                  {form.activo ? '● Activo' : '○ Inactivo'}
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="sp-tabs-scroll" style={{ marginBottom:20 }}>
              {TABS.map(t => (
                <button key={t.key} className={`sp-tab-btn${tab === t.key ? ' active' : ''}`}
                  onClick={() => setTab(t.key)}
                  style={{ '--tab-col': col }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Tab: Detalles ── */}
            {tab === 'detalles' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5, display:'block', marginBottom:6, textTransform:'uppercase' }}>
                    Nombre *
                  </label>
                  <input className="sp-input" placeholder="Ej: Corte de cabello"
                    value={form.nombre || ''} onChange={e => setForm(p => ({...p, nombre:e.target.value}))} />
                </div>

                <div>
                  <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5, display:'block', marginBottom:6, textTransform:'uppercase' }}>
                    Categoría
                  </label>
                  <input className="sp-input" list="cats-list"
                    placeholder="Selecciona o escribe una categoría"
                    value={form.categoria || ''}
                    onChange={e => setForm(p => ({...p, categoria: e.target.value}))} />
                  <datalist id="cats-list">
                    {CATEGORIAS.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div>
                  <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5, display:'block', marginBottom:6, textTransform:'uppercase' }}>
                    Descripción
                  </label>
                  <textarea className="sp-input" rows={3} placeholder="Describe el servicio (opcional)…"
                    value={form.descripcion || ''} onChange={e => setForm(p => ({...p, descripcion:e.target.value}))}
                    style={{ resize:'none' }} />
                </div>

                {nuevo && (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'14px 16px', borderRadius:14, background:'var(--card)', border:'1px solid var(--border)' }}>
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
                )}
              </div>
            )}

            {/* ── Tab: Precio ── */}
            {tab === 'precio' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5, display:'block', marginBottom:6, textTransform:'uppercase' }}>
                      Precio base
                    </label>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)',
                        color:'var(--text-3)', fontWeight:700, fontSize:14, pointerEvents:'none' }}>$</span>
                      <input className="sp-input" type="number" min={0} step={1000}
                        placeholder="0" style={{ paddingLeft:26 }}
                        value={form.precio || ''} onChange={e => setForm(p => ({...p, precio:e.target.value}))} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5, display:'block', marginBottom:6, textTransform:'uppercase' }}>
                      Precio oferta
                    </label>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)',
                        color:'#22c55e', fontWeight:700, fontSize:14, pointerEvents:'none' }}>$</span>
                      <input className="sp-input" type="number" min={0} step={1000}
                        placeholder="Sin oferta" style={{ paddingLeft:26 }}
                        value={form.precio_oferta || ''} onChange={e => setForm(p => ({...p, precio_oferta:e.target.value}))} />
                    </div>
                  </div>
                </div>

                {form.precio && form.precio_oferta && (
                  <div className="sp-alert success" style={{ margin:0 }}>
                    <div>
                      <div style={{ fontWeight:700, color:'#22c55e', fontSize:14 }}>
                        Descuento {Math.round((1 - Number(form.precio_oferta)/Number(form.precio)) * 100)}%
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                        El cliente ahorra ${(Number(form.precio) - Number(form.precio_oferta)).toLocaleString('es-CO')}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5, display:'block', marginBottom:10, textTransform:'uppercase' }}>
                    Duración
                  </label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {DURACIONES.map(d => (
                      <button key={d} onClick={() => setForm(f => ({...f, duracion_min: d}))} style={{
                        padding:'8px 14px', borderRadius:10, cursor:'pointer',
                        border:`1.5px solid ${form.duracion_min === d ? col : 'var(--border)'}`,
                        background: form.duracion_min === d ? `${col}16` : 'var(--card)',
                        color: form.duracion_min === d ? col : 'var(--text-2)',
                        fontWeight:700, fontSize:13, transition:'all 0.12s',
                      }}>
                        {d < 60 ? `${d}min` : `${d/60}h${d%60 ? `${d%60}min` : ''}`}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop:10 }}>
                    <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, display:'block', marginBottom:6 }}>
                      Personalizado (min)
                    </label>
                    <input className="sp-input" type="number" min={5} step={5}
                      value={form.duracion_min || 30}
                      onChange={e => setForm(p => ({...p, duracion_min: Number(e.target.value)}))}
                      style={{ maxWidth:120 }} />
                  </div>
                </div>

                {precioFinal && (
                  <div className="sp-kpi-card" style={{ background:`linear-gradient(135deg, ${col}22 0%, ${col}08 100%)`, textAlign:'center', alignItems:'center' }}>
                    <div className="sp-kpi-lbl" style={{ color:col, opacity:0.7 }}>Precio que ve el cliente</div>
                    <div className="sp-kpi-val" style={{ color:col, fontSize:30 }}>${precioFinal.toLocaleString('es-CO')}</div>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Especialistas ── */}
            {tab === 'especialistas' && (
              <div>
                <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:16, lineHeight:1.5 }}>
                  Selecciona quiénes pueden realizar este servicio. Si no seleccionas ninguno, todos lo pueden hacer.
                </p>
                {profesionales.length === 0 ? (
                  <div style={{ padding:'20px', textAlign:'center', color:'var(--text-3)', fontSize:13 }}>
                    No hay profesionales activos en este negocio.
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {profesionales.map(p => {
                      const activo = (form.profesionales_ids || []).includes(p.id)
                      return (
                        <button key={p.id} onClick={() => toggleProf(p.id)} style={{
                          display:'flex', alignItems:'center', gap:12,
                          padding:'13px 14px', borderRadius:14, width:'100%', textAlign:'left',
                          background: activo ? `${col}10` : 'var(--card)',
                          border:`1.5px solid ${activo ? col : 'var(--border)'}`,
                          cursor:'pointer', transition:'all 0.12s',
                        }}>
                          <div style={{
                            width:34, height:34, borderRadius:10,
                            background:`${p.color || col}22`,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontFamily:'Outfit', fontWeight:800, fontSize:14, color: p.color || col, flexShrink:0,
                          }}>
                            {p.nombre?.[0]}
                          </div>
                          <span style={{ flex:1, fontWeight:600, fontSize:14, color:'var(--text)' }}>{p.nombre}</span>
                          <div style={{
                            width:22, height:22, borderRadius:6, flexShrink:0,
                            background: activo ? col : 'var(--card)',
                            border:`1.5px solid ${activo ? col : 'var(--border)'}`,
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}>
                            {activo && (
                              <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
                                stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
                {(form.profesionales_ids?.length > 0) && (
                  <button onClick={() => setForm(f => ({...f, profesionales_ids:[]}))}
                    style={{ marginTop:12, fontSize:12, color:'var(--text-3)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
                    Limpiar selección (permitir todos)
                  </button>
                )}
              </div>
            )}

            {/* ── Tab: Productos ── */}
            {tab === 'productos' && (
              <div>
                <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:14, lineHeight:1.5 }}>
                  Productos del inventario que se consumen al realizar este servicio (para control de stock).
                </p>
                {productos.length === 0 ? (
                  <div style={{ textAlign:'center', color:'var(--text-3)', padding:'24px 0', fontSize:13 }}>
                    No hay productos activos en el inventario. Agrégalos desde el módulo Inventario.
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {productos.map(p => {
                      const activo = (form.productos_ids || []).includes(p.id)
                      return (
                        <button key={p.id} onClick={() => toggleProducto(p.id)} style={{
                          display:'flex', alignItems:'center', gap:12,
                          padding:'11px 14px', borderRadius:12, width:'100%', textAlign:'left',
                          background: activo ? `${col}10` : 'rgba(255,255,255,0.025)',
                          border:'none', cursor:'pointer', transition:'background 0.12s',
                        }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:700, fontSize:13, color: activo ? 'var(--text)' : 'var(--text-2)' }}>{p.nombre}</div>
                            {p.categoria && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>{p.categoria}</div>}
                          </div>
                          <div style={{
                            width:20, height:20, borderRadius:5, flexShrink:0,
                            background: activo ? col : 'rgba(255,255,255,0.07)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}>
                            {activo && (
                              <svg width={11} height={11} viewBox="0 0 24 24" fill="none"
                                stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
                {form.productos_ids?.length > 0 && (
                  <button onClick={() => setForm(f => ({...f, productos_ids:[]}))}
                    style={{ marginTop:10, fontSize:12, color:'var(--text-3)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
                    Limpiar selección
                  </button>
                )}
              </div>
            )}

            {/* ── Tab: Recordatorio ── */}
            {tab === 'recordatorio' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <p style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.6, marginBottom:4 }}>
                  Mensaje que se envía automáticamente por WhatsApp como recordatorio de cita. Usa las variables entre dobles llaves.
                </p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:4 }}>
                  {['{{nombre_cliente}}','{{fecha}}','{{hora}}','{{servicio}}','{{profesional}}','{{negocio}}'].map(v => (
                    <button key={v} onClick={() => {
                      const txt = form.recordatorio_texto || ''
                      setForm(f => ({...f, recordatorio_texto: txt + v }))
                    }} style={{
                      padding:'4px 10px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:600,
                      background:`${col}14`, border:`1px solid ${col}30`, color:col,
                    }}>{v}</button>
                  ))}
                </div>
                <textarea className="sp-input" rows={7}
                  placeholder={RECORD_DEFAULT}
                  value={form.recordatorio_texto || ''}
                  onChange={e => setForm(p => ({...p, recordatorio_texto:e.target.value}))}
                  style={{ resize:'vertical', fontFamily:'inherit', lineHeight:1.6 }} />
                <button onClick={() => setForm(f => ({...f, recordatorio_texto: RECORD_DEFAULT}))}
                  style={{ fontSize:12, color:'var(--text-3)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', alignSelf:'flex-start' }}>
                  Restaurar texto por defecto
                </button>

                {/* Preview */}
                {form.recordatorio_texto && (
                  <div style={{ padding:'14px', borderRadius:14, background:'#22c55e0f', border:'1px solid #22c55e25' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#22c55e', letterSpacing:0.5, marginBottom:8 }}>
                      VISTA PREVIA (WhatsApp)
                    </div>
                    <p style={{ fontSize:13, color:'var(--text)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>
                      {form.recordatorio_texto
                        .replace('{{nombre_cliente}}','María García')
                        .replace('{{fecha}}','viernes 23 de mayo')
                        .replace('{{hora}}','3:00pm')
                        .replace('{{servicio}}', form.nombre || 'Corte de cabello')
                        .replace('{{profesional}}','Andrea')
                        .replace('{{negocio}}', tenant?.nombre || 'Salón Pro')
                      }
                    </p>
                  </div>
                )}
              </div>
            )}

            <div style={{ height:20 }} />

            {/* Eliminar (solo edición) */}
            {!nuevo && (
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:14, marginBottom:14 }}>
                {!elimConfirm ? (
                  <button onClick={() => setElimConfirm(true)} style={{
                    width:'100%', padding:'13px', borderRadius:14, cursor:'pointer',
                    background:'rgba(239,68,68,0.08)', border:'1.5px solid rgba(239,68,68,0.4)',
                    color:'#ef4444', fontFamily:'Outfit', fontWeight:700, fontSize:15,
                  }}>
                    🗑 Eliminar servicio
                  </button>
                ) : (
                  <div>
                    <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:10, textAlign:'center' }}>
                      ¿Confirmar eliminación? Esta acción es irreversible.
                    </p>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => setElimConfirm(false)} style={{
                        flex:1, padding:'12px', borderRadius:14, cursor:'pointer',
                        background:'var(--card)', border:'1px solid var(--border)',
                        color:'var(--text-2)', fontWeight:600, fontSize:14,
                      }}>Cancelar</button>
                      <button onClick={() => eliminar(sel?.id)} disabled={saving} style={{
                        flex:1, padding:'12px', borderRadius:14, cursor:'pointer',
                        background:'#ef4444', border:'none', color:'#fff',
                        fontWeight:700, fontSize:14, opacity: saving ? 0.7 : 1,
                      }}>{saving ? 'Eliminando…' : 'Sí, eliminar'}</button>
                    </div>
                  </div>
                )}
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
    </div>
  )
}
