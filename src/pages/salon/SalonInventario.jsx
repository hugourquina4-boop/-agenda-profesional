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

function fmtCOP(n) {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

const CATEGORIAS = [
  { key:'todos',       label:'Todos'       },
  { key:'capilar',     label:'Capilar'     },
  { key:'color',       label:'Color'       },
  { key:'tratamiento', label:'Tratamiento' },
  { key:'retail',      label:'Retail'      },
  { key:'herramienta', label:'Herramienta' },
  { key:'otro',        label:'Otro'        },
]

const CAT_COLOR = {
  capilar:     '#3b82f6',
  color:       '#a855f7',
  tratamiento: '#22c55e',
  retail:      '#f59e0b',
  herramienta: '#06b6d4',
  otro:        '#71717a',
}

const FORM_VACIO = {
  nombre:'', categoria:'retail', precio_venta:'', precio_costo:'',
  stock:'', stock_minimo:'0', unidad:'unidad', notas:'',
}

export default function SalonInventario() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [productos,   setProductos]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [catFiltro,   setCatFiltro]   = useState('todos')
  const [busqueda,    setBusqueda]    = useState('')
  const [modal,       setModal]       = useState(null) // null | 'nuevo' | producto
  const [form,        setForm]        = useState(FORM_VACIO)
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState(null)
  const [confirmDel,  setConfirmDel]  = useState(null)

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2800)
  }

  const cargar = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('productos_salon')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('activo', true)
      .order('nombre')
    setProductos(data || [])
    setLoading(false)
  }, [tenant])

  useEffect(() => { cargar() }, [cargar])

  function abrirNuevo() {
    setForm(FORM_VACIO)
    setModal('nuevo')
  }

  function abrirEditar(p) {
    setForm({
      nombre:       p.nombre,
      categoria:    p.categoria,
      precio_venta: String(p.precio_venta),
      precio_costo: String(p.precio_costo),
      stock:        String(p.stock),
      stock_minimo: String(p.stock_minimo),
      unidad:       p.unidad,
      notas:        p.notas || '',
    })
    setModal(p)
  }

  function set(campo, val) { setForm(f => ({ ...f, [campo]: val })) }

  async function guardar() {
    if (!form.nombre.trim()) { showToast('El nombre es requerido', false); return }
    setSaving(true)
    const payload = {
      tenant_id:    tenant.id,
      nombre:       form.nombre.trim(),
      categoria:    form.categoria,
      precio_venta: parseFloat(form.precio_venta) || 0,
      precio_costo: parseFloat(form.precio_costo) || 0,
      stock:        parseInt(form.stock) || 0,
      stock_minimo: parseInt(form.stock_minimo) || 0,
      unidad:       form.unidad.trim() || 'unidad',
      notas:        form.notas.trim() || null,
    }
    let error
    if (modal === 'nuevo') {
      ({ error } = await supabase.from('productos_salon').insert(payload))
    } else {
      ({ error } = await supabase.from('productos_salon').update(payload).eq('id', modal.id))
    }
    setSaving(false)
    if (error) { showToast(error.message, false); return }
    showToast(modal === 'nuevo' ? 'Producto agregado ✓' : 'Guardado ✓')
    setModal(null)
    cargar()
  }

  async function ajustarStock(id, delta) {
    const prod = productos.find(p => p.id === id)
    if (!prod) return
    const nuevo = Math.max(0, prod.stock + delta)
    await supabase.from('productos_salon').update({ stock: nuevo }).eq('id', id)
    setProductos(ps => ps.map(p => p.id === id ? { ...p, stock: nuevo } : p))
  }

  async function eliminar(id) {
    await supabase.from('productos_salon').update({ activo: false }).eq('id', id)
    setConfirmDel(null)
    showToast('Producto eliminado')
    cargar()
  }

  const filtrados = productos.filter(p => {
    const catOk = catFiltro === 'todos' || p.categoria === catFiltro
    const busOk = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    return catOk && busOk
  })

  const valorTotal   = filtrados.reduce((s, p) => s + p.stock * p.precio_costo, 0)
  const bajosStock   = productos.filter(p => p.stock <= p.stock_minimo && p.stock_minimo > 0).length

  return (
    <div style={{ padding:'0 16px 80px' }}>
      {toast && (
        <div style={{
          position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', zIndex:200,
          background: toast.ok ? '#22c55e' : '#ef4444',
          color:'#fff', padding:'12px 20px', borderRadius:14, fontSize:14, fontWeight:600,
          boxShadow:'0 4px 20px rgba(0,0,0,0.2)', whiteSpace:'nowrap',
        }}>{toast.msg}</div>
      )}

      {/* ── KPIs rápidos ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:16, marginBottom:16 }}>
        <div style={{ padding:'14px 16px', borderRadius:16, background:'var(--card)', border:'1px solid var(--border)' }}>
          <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:700, letterSpacing:0.8, textTransform:'uppercase', marginBottom:6 }}>Valor inventario</div>
          <div style={{ fontSize:22, fontWeight:800, color:col, fontFamily:'Outfit' }}>{fmtCOP(valorTotal)}</div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{filtrados.length} productos</div>
        </div>
        <div style={{ padding:'14px 16px', borderRadius:16, background:'var(--card)', border:`1px solid ${bajosStock > 0 ? '#f59e0b44' : 'var(--border)'}` }}>
          <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:700, letterSpacing:0.8, textTransform:'uppercase', marginBottom:6 }}>Stock bajo</div>
          <div style={{ fontSize:22, fontWeight:800, color: bajosStock > 0 ? '#f59e0b' : '#22c55e', fontFamily:'Outfit' }}>{bajosStock}</div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>bajo mínimo</div>
        </div>
      </div>

      {/* ── Búsqueda + botón ── */}
      <div style={{ display:'flex', gap:10, marginBottom:12 }}>
        <div style={{ flex:1, position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }}>
            <Ico d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={16} />
          </span>
          <input
            className="sp-input"
            placeholder="Buscar producto…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ paddingLeft:36 }}
          />
        </div>
        <button onClick={abrirNuevo} style={{
          padding:'0 16px', borderRadius:12, border:'none', cursor:'pointer',
          background:`linear-gradient(135deg,${col},${col}cc)`,
          color:'#fff', fontWeight:700, fontSize:13, whiteSpace:'nowrap',
          display:'flex', alignItems:'center', gap:6,
        }}>
          <Ico d="M12 4v16m8-8H4" size={16} /> Agregar
        </button>
      </div>

      {/* ── Filtro categoría ── */}
      <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:8, marginBottom:4 }}>
        {CATEGORIAS.map(c => (
          <button key={c.key} onClick={() => setCatFiltro(c.key)} style={{
            padding:'6px 14px', borderRadius:20, cursor:'pointer', whiteSpace:'nowrap',
            border:`1px solid ${catFiltro === c.key ? (CAT_COLOR[c.key] || col) : 'var(--border)'}`,
            background: catFiltro === c.key ? `${CAT_COLOR[c.key] || col}18` : 'var(--card)',
            color: catFiltro === c.key ? (CAT_COLOR[c.key] || col) : 'var(--text-3)',
            fontWeight:700, fontSize:12,
          }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* ── Lista de productos ── */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:8 }}>
          {[1,2,3].map(i => <div key={i} className="sp-skeleton" style={{ height:80, borderRadius:14 }} />)}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon">📦</span>
          <p className="sp-empty-title">Sin productos</p>
          <p className="sp-empty-sub">Agrega tu primer producto al inventario</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
          {filtrados.map(p => {
            const clr   = CAT_COLOR[p.categoria] || col
            const bajo  = p.stock_minimo > 0 && p.stock <= p.stock_minimo
            return (
              <div key={p.id} style={{
                borderRadius:14, background:'var(--card)',
                border:`1px solid ${bajo ? '#f59e0b44' : 'var(--border)'}`,
                overflow:'hidden',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px' }}>
                  {/* Categoría dot */}
                  <div style={{ width:40, height:40, borderRadius:12, background:`${clr}20`,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:18 }}>
                      {p.categoria==='capilar'?'💇':p.categoria==='color'?'🎨':p.categoria==='tratamiento'?'✨':p.categoria==='retail'?'🛍️':p.categoria==='herramienta'?'✂️':'📦'}
                    </span>
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                      <span style={{ fontSize:14, fontWeight:700, color:'var(--text)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.nombre}
                      </span>
                      {bajo && (
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:8,
                          background:'rgba(245,158,11,0.15)', color:'#f59e0b', flexShrink:0 }}>
                          ⚠ Stock bajo
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-3)' }}>
                      {p.unidad} · costo {fmtCOP(p.precio_costo)} · venta {fmtCOP(p.precio_venta)}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                    <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:16, color: bajo ? '#f59e0b' : 'var(--text)' }}>
                      {p.stock} <span style={{ fontSize:11, fontWeight:500, color:'var(--text-3)' }}>{p.unidad}s</span>
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => ajustarStock(p.id, -1)} style={{
                        width:28, height:28, borderRadius:8, border:'1px solid var(--border)',
                        background:'var(--card)', color:'var(--text-2)', cursor:'pointer', fontSize:16, lineHeight:1,
                      }}>−</button>
                      <button onClick={() => ajustarStock(p.id, +1)} style={{
                        width:28, height:28, borderRadius:8, border:'1px solid var(--border)',
                        background:'var(--card)', color:'var(--text-2)', cursor:'pointer', fontSize:16, lineHeight:1,
                      }}>+</button>
                      <button onClick={() => abrirEditar(p)} style={{
                        width:28, height:28, borderRadius:8, border:'1px solid var(--border)',
                        background:'var(--card)', color:'var(--text-2)', cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        <Ico d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal nuevo / editar ── */}
      {modal !== null && (
        <div
          style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'flex-end',
            background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div style={{
            width:'100%', maxWidth:520, margin:'0 auto',
            background:'var(--bg)', borderRadius:'24px 24px 0 0',
            padding:'20px 20px 40px', maxHeight:'92dvh', overflowY:'auto',
          }}>
            <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', margin:'0 auto 20px' }} />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:18, color:'var(--text)' }}>
                {modal === 'nuevo' ? 'Nuevo producto' : 'Editar producto'}
              </h3>
              {modal !== 'nuevo' && (
                <button onClick={() => setConfirmDel(modal.id)} style={{
                  padding:'6px 12px', borderRadius:9, border:'1px solid rgba(239,68,68,0.3)',
                  background:'rgba(239,68,68,0.07)', color:'#f87171',
                  fontWeight:700, fontSize:12, cursor:'pointer',
                }}>Eliminar</button>
              )}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5,
                  display:'block', marginBottom:7, textTransform:'uppercase' }}>Nombre *</label>
                <input className="sp-input" value={form.nombre}
                  onChange={e => set('nombre', e.target.value)} placeholder="Ej: Shampoo Hidratante 500ml" />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5,
                    display:'block', marginBottom:7, textTransform:'uppercase' }}>Categoría</label>
                  <select className="sp-input" value={form.categoria}
                    onChange={e => set('categoria', e.target.value)}>
                    {CATEGORIAS.filter(c => c.key !== 'todos').map(c => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5,
                    display:'block', marginBottom:7, textTransform:'uppercase' }}>Unidad</label>
                  <input className="sp-input" value={form.unidad}
                    onChange={e => set('unidad', e.target.value)} placeholder="unidad, ml, kg…" />
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5,
                    display:'block', marginBottom:7, textTransform:'uppercase' }}>Precio costo ($)</label>
                  <input className="sp-input" type="number" min="0" step="100"
                    value={form.precio_costo} onChange={e => set('precio_costo', e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5,
                    display:'block', marginBottom:7, textTransform:'uppercase' }}>Precio venta ($)</label>
                  <input className="sp-input" type="number" min="0" step="100"
                    value={form.precio_venta} onChange={e => set('precio_venta', e.target.value)} placeholder="0" />
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5,
                    display:'block', marginBottom:7, textTransform:'uppercase' }}>Stock actual</label>
                  <input className="sp-input" type="number" min="0"
                    value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5,
                    display:'block', marginBottom:7, textTransform:'uppercase' }}>Stock mínimo</label>
                  <input className="sp-input" type="number" min="0"
                    value={form.stock_minimo} onChange={e => set('stock_minimo', e.target.value)} placeholder="0" />
                </div>
              </div>

              <div>
                <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5,
                  display:'block', marginBottom:7, textTransform:'uppercase' }}>Notas (opcional)</label>
                <textarea className="sp-input" rows={2} value={form.notas}
                  onChange={e => set('notas', e.target.value)}
                  placeholder="Proveedor, referencia, observaciones…"
                  style={{ resize:'none' }} />
              </div>

              <button onClick={guardar} disabled={saving} style={{
                marginTop:4, padding:'16px', borderRadius:16, border:'none', cursor:'pointer',
                background: saving ? 'var(--border)' : `linear-gradient(135deg,${col},${col}cc)`,
                color: saving ? 'var(--text-3)' : '#fff',
                fontFamily:'Outfit', fontWeight:800, fontSize:16,
              }}>
                {saving ? 'Guardando…' : modal === 'nuevo' ? 'Agregar producto' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm eliminar ── */}
      {confirmDel && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center',
          justifyContent:'center', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', padding:20 }}>
          <div style={{ background:'var(--bg)', borderRadius:20, padding:'24px 20px', width:'100%', maxWidth:340 }}>
            <h3 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:17, color:'var(--text)', marginBottom:8 }}>
              ¿Eliminar producto?
            </h3>
            <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:20 }}>
              Esta acción es irreversible y el producto desaparecerá del inventario.
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConfirmDel(null)} style={{
                flex:1, padding:'12px', borderRadius:12, cursor:'pointer',
                background:'var(--card)', border:'1px solid var(--border)', color:'var(--text-2)', fontWeight:700,
              }}>Cancelar</button>
              <button onClick={() => eliminar(confirmDel)} style={{
                flex:1, padding:'12px', borderRadius:12, cursor:'pointer',
                background:'#ef4444', border:'none', color:'#fff', fontWeight:700,
              }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
