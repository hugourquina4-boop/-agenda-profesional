import { useState, useEffect, useCallback, useRef } from 'react'
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
  { key:'unas',        label:'Uñas'        },
  { key:'insumos',     label:'Insumos'     },
  { key:'herramienta', label:'Herramienta' },
  { key:'otro',        label:'Otro'        },
]

const CAT_COLOR = {
  capilar:     '#3b82f6',
  color:       '#a855f7',
  tratamiento: '#22c55e',
  retail:      '#f59e0b',
  unas:        '#ec4899',
  insumos:     '#84cc16',
  herramienta: '#06b6d4',
  otro:        '#71717a',
}

const CAT_EMOJI = {
  capilar:'💇', color:'🎨', tratamiento:'✨',
  retail:'🛍️', unas:'💅', insumos:'🧴', herramienta:'✂️', otro:'📦',
}

const CAT_OPTS = CATEGORIAS.filter(c => c.key !== 'todos')

const FORM_VACIO = {
  nombre:'', categoria:'retail', subcategoria:'', marca:'',
  codigo:'', contenido:'', unidad:'unidad', proveedor:'',
  precio_venta:'', precio_costo:'', stock:'', stock_minimo:'0', notas:'',
}

const CSV_HEADERS = 'nombre,categoria,subcategoria,marca,contenido,unidad,precio_costo,precio_venta,stock,stock_minimo,codigo,proveedor,notas'
const CSV_EJEMPLO = 'Shampoo Hidratante,capilar,shampoo,Wella,500,ml,15000,25000,10,3,SH-WL-500,Distribuidora Norte,Para cabello seco'

// ── CSV parser ───────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

function parseCSV(text, tenantId) {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n').filter(l => l.trim())
  if (lines.length < 2) return { rows: [], errors: ['El archivo está vacío o solo tiene encabezados'] }

  const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  if (!headers.includes('nombre')) return { rows: [], errors: ['Columna requerida faltante: nombre'] }

  const validCats = CAT_OPTS.map(c => c.key)
  const rows = [], errors = []

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i])
    const o = {}
    headers.forEach((h, idx) => { o[h] = vals[idx]?.trim().replace(/^"|"$/g, '') || '' })

    if (!o.nombre) { errors.push(`Fila ${i + 1}: nombre vacío — omitida`); continue }

    let cat = o.categoria?.toLowerCase() || 'otro'
    if (!validCats.includes(cat)) {
      errors.push(`Fila ${i + 1}: categoría '${o.categoria}' desconocida → 'otro'`)
      cat = 'otro'
    }

    rows.push({
      tenant_id:    tenantId,
      nombre:       o.nombre,
      categoria:    cat,
      subcategoria: o.subcategoria || null,
      marca:        o.marca || null,
      codigo:       o.codigo || null,
      contenido:    parseFloat(o.contenido) || null,
      unidad:       o.unidad || 'unidad',
      proveedor:    o.proveedor || null,
      precio_costo: parseFloat(o.precio_costo) || 0,
      precio_venta: parseFloat(o.precio_venta) || 0,
      stock:        parseInt(o.stock) || 0,
      stock_minimo: parseInt(o.stock_minimo) || 0,
      notas:        o.notas || null,
      activo:       true,
    })
  }

  return { rows, errors }
}

export default function SalonInventario() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [productos,     setProductos]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [catFiltro,     setCatFiltro]     = useState('todos')
  const [busqueda,      setBusqueda]      = useState('')
  const [modal,         setModal]         = useState(null)
  const [form,          setForm]          = useState(FORM_VACIO)
  const [saving,        setSaving]        = useState(false)
  const [toast,         setToast]         = useState(null)
  const [confirmDel,    setConfirmDel]    = useState(null)
  const [csvModal,      setCsvModal]      = useState(null)
  const [csvImporting,  setCsvImporting]  = useState(false)
  const fileInputRef = useRef(null)

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
      subcategoria: p.subcategoria || '',
      marca:        p.marca || '',
      codigo:       p.codigo || '',
      contenido:    p.contenido != null ? String(p.contenido) : '',
      unidad:       p.unidad,
      proveedor:    p.proveedor || '',
      precio_venta: String(p.precio_venta),
      precio_costo: String(p.precio_costo),
      stock:        String(p.stock),
      stock_minimo: String(p.stock_minimo),
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
      subcategoria: form.subcategoria.trim() || null,
      marca:        form.marca.trim() || null,
      codigo:       form.codigo.trim() || null,
      contenido:    parseFloat(form.contenido) || null,
      unidad:       form.unidad.trim() || 'unidad',
      proveedor:    form.proveedor.trim() || null,
      precio_venta: parseFloat(form.precio_venta) || 0,
      precio_costo: parseFloat(form.precio_costo) || 0,
      stock:        parseInt(form.stock) || 0,
      stock_minimo: parseInt(form.stock_minimo) || 0,
      notas:        form.notas.trim() || null,
    }
    let error
    if (modal === 'nuevo') {
      ;({ error } = await supabase.from('productos_salon').insert(payload))
    } else {
      ;({ error } = await supabase.from('productos_salon').update(payload).eq('id', modal.id))
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

  // ── CSV import ───────────────────────────────────────────────────────────
  function onFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = ev => {
      const result = parseCSV(ev.target.result, tenant.id)
      setCsvModal(result)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function descargarPlantilla() {
    const csv = `${CSV_HEADERS}\n${CSV_EJEMPLO}`
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'plantilla_inventario.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function confirmarImportCSV() {
    if (!csvModal?.rows?.length) return
    setCsvImporting(true)

    const conCodigo  = csvModal.rows.filter(r => r.codigo)
    const sinCodigo  = csvModal.rows.filter(r => !r.codigo)
    const errs = []

    if (conCodigo.length) {
      const { error } = await supabase.from('productos_salon')
        .upsert(conCodigo, { onConflict: 'tenant_id,codigo' })
      if (error) errs.push(error.message)
    }
    if (sinCodigo.length) {
      const { error } = await supabase.from('productos_salon').insert(sinCodigo)
      if (error) errs.push(error.message)
    }

    setCsvImporting(false)
    if (errs.length) { showToast(errs[0], false); return }
    showToast(`${csvModal.rows.length} productos importados ✓`)
    setCsvModal(null)
    cargar()
  }

  // ── Filtros ──────────────────────────────────────────────────────────────
  const filtrados = productos.filter(p => {
    const catOk = catFiltro === 'todos' || p.categoria === catFiltro
    const q = busqueda.toLowerCase()
    const busOk = !busqueda ||
      p.nombre.toLowerCase().includes(q) ||
      (p.marca        && p.marca.toLowerCase().includes(q)) ||
      (p.codigo       && p.codigo.toLowerCase().includes(q)) ||
      (p.subcategoria && p.subcategoria.toLowerCase().includes(q)) ||
      (p.proveedor    && p.proveedor.toLowerCase().includes(q))
    return catOk && busOk
  })

  const valorTotal = filtrados.reduce((s, p) => s + p.stock * p.precio_costo, 0)
  const bajosStock = productos.filter(p => p.stock <= p.stock_minimo && p.stock_minimo > 0).length

  // ── Shared label style ──────────────────────────────────────────────────
  const lbl = {
    fontSize:11, color:'var(--text-3)', fontWeight:700,
    letterSpacing:0.5, display:'block', marginBottom:7, textTransform:'uppercase',
  }

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

      {/* ── KPIs ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:16, marginBottom:16 }}>
        <div className="sp-kpi-card" style={{ background:`linear-gradient(135deg,${col}28,${col}08)` }}>
          <div style={{ fontSize:22, fontWeight:800, color:col, fontFamily:'Outfit' }}>{fmtCOP(valorTotal)}</div>
          <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5 }}>INVENTARIO · {filtrados.length} productos</div>
        </div>
        <div className="sp-kpi-card" style={{ background: bajosStock > 0 ? 'linear-gradient(135deg,rgba(245,158,11,0.2),transparent)' : 'linear-gradient(135deg,rgba(34,197,94,0.15),transparent)' }}>
          <div style={{ fontSize:22, fontWeight:800, color: bajosStock > 0 ? '#f59e0b' : '#22c55e', fontFamily:'Outfit' }}>{bajosStock}</div>
          <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5 }}>STOCK BAJO MÍNIMO</div>
        </div>
      </div>

      {/* ── Búsqueda + botones ── */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <div style={{ flex:1, position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }}>
            <Ico d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={16} />
          </span>
          <input
            className="sp-input"
            placeholder="Buscar por nombre, marca, SKU…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ paddingLeft:36 }}
          />
        </div>
        <button onClick={() => fileInputRef.current?.click()} style={{
          padding:'0 12px', borderRadius:12, border:'none',
          background:`${col}12`, color:col,
          fontWeight:700, fontSize:12, cursor:'pointer', whiteSpace:'nowrap',
          display:'flex', alignItems:'center', gap:5,
        }}>
          <Ico d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" size={15} />
          CSV
        </button>
        <input ref={fileInputRef} type="file" accept=".csv" style={{ display:'none' }} onChange={onFileChange} />
        <button onClick={abrirNuevo} style={{
          padding:'0 14px', borderRadius:12, border:'none', cursor:'pointer',
          background:`linear-gradient(135deg,${col},${col}cc)`,
          color:'#fff', fontWeight:700, fontSize:13, whiteSpace:'nowrap',
          display:'flex', alignItems:'center', gap:5,
        }}>
          <Ico d="M12 4v16m8-8H4" size={15} /> Agregar
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

      {/* ── Lista ── */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:8 }}>
          {[1,2,3].map(i => <div key={i} className="sp-skeleton" style={{ height:80, borderRadius:14 }} />)}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon">📦</span>
          <p className="sp-empty-title">Sin productos</p>
          <p className="sp-empty-sub">Agrega tu primer producto o importa desde CSV</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
          {filtrados.map(p => {
            const clr  = CAT_COLOR[p.categoria] || col
            const bajo = p.stock_minimo > 0 && p.stock <= p.stock_minimo
            const desc = [
              p.marca,
              p.contenido ? `${p.contenido} ${p.unidad}` : p.unidad,
              `costo ${fmtCOP(p.precio_costo)}`,
              `venta ${fmtCOP(p.precio_venta)}`,
            ].filter(Boolean).join(' · ')
            return (
              <div key={p.id} style={{
                borderRadius:14,
                background: bajo ? 'linear-gradient(135deg,rgba(245,158,11,0.1),var(--card))' : `linear-gradient(135deg,${clr}0d,var(--card))`,
                boxShadow: bajo ? '0 2px 12px rgba(245,158,11,0.15)' : '0 2px 10px rgba(0,0,0,0.08)',
                overflow:'hidden',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px' }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:`${clr}20`,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:18 }}>{CAT_EMOJI[p.categoria] || '📦'}</span>
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
                    <div style={{ fontSize:11, color:'var(--text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {desc}
                    </div>
                    {(p.codigo || p.subcategoria) && (
                      <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>
                        {[p.subcategoria, p.codigo].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                    <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:16, color: bajo ? '#f59e0b' : 'var(--text)' }}>
                      {p.stock} <span style={{ fontSize:11, fontWeight:500, color:'var(--text-3)' }}>{p.unidad}s</span>
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => ajustarStock(p.id, -1)} style={{
                        width:28, height:28, borderRadius:8, border:'none',
                        background:'rgba(255,255,255,0.08)', color:'var(--text-2)', cursor:'pointer', fontSize:16, lineHeight:1,
                      }}>−</button>
                      <button onClick={() => ajustarStock(p.id, +1)} style={{
                        width:28, height:28, borderRadius:8, border:'none',
                        background:'rgba(255,255,255,0.08)', color:'var(--text-2)', cursor:'pointer', fontSize:16, lineHeight:1,
                      }}>+</button>
                      <button onClick={() => abrirEditar(p)} style={{
                        width:28, height:28, borderRadius:8, border:'none',
                        background:'rgba(255,255,255,0.08)', color:'var(--text-2)', cursor:'pointer',
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
              {/* Nombre */}
              <div>
                <label style={lbl}>Nombre *</label>
                <input className="sp-input" value={form.nombre}
                  onChange={e => set('nombre', e.target.value)} placeholder="Ej: Shampoo Hidratante" />
              </div>

              {/* Categoría + Subcategoría */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Categoría</label>
                  <select className="sp-input" value={form.categoria}
                    onChange={e => set('categoria', e.target.value)}>
                    {CAT_OPTS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Subcategoría</label>
                  <input className="sp-input" value={form.subcategoria}
                    onChange={e => set('subcategoria', e.target.value)} placeholder="shampoo, tinte…" />
                </div>
              </div>

              {/* Marca + Código */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Marca</label>
                  <input className="sp-input" value={form.marca}
                    onChange={e => set('marca', e.target.value)} placeholder="Wella, L'Oreal…" />
                </div>
                <div>
                  <label style={lbl}>Código / SKU</label>
                  <input className="sp-input" value={form.codigo}
                    onChange={e => set('codigo', e.target.value)} placeholder="SH-WL-500" />
                </div>
              </div>

              {/* Contenido + Unidad */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Contenido (cantidad)</label>
                  <input className="sp-input" type="number" min="0" step="0.1"
                    value={form.contenido} onChange={e => set('contenido', e.target.value)} placeholder="500" />
                </div>
                <div>
                  <label style={lbl}>Unidad</label>
                  <input className="sp-input" value={form.unidad}
                    onChange={e => set('unidad', e.target.value)} placeholder="ml, g, unidad…" />
                </div>
              </div>

              {/* Proveedor */}
              <div>
                <label style={lbl}>Proveedor</label>
                <input className="sp-input" value={form.proveedor}
                  onChange={e => set('proveedor', e.target.value)} placeholder="Distribuidora Norte…" />
              </div>

              {/* Precios */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Precio costo ($)</label>
                  <input className="sp-input" type="number" min="0" step="100"
                    value={form.precio_costo} onChange={e => set('precio_costo', e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label style={lbl}>Precio venta ($)</label>
                  <input className="sp-input" type="number" min="0" step="100"
                    value={form.precio_venta} onChange={e => set('precio_venta', e.target.value)} placeholder="0" />
                </div>
              </div>

              {/* Stock */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Stock actual</label>
                  <input className="sp-input" type="number" min="0"
                    value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label style={lbl}>Stock mínimo</label>
                  <input className="sp-input" type="number" min="0"
                    value={form.stock_minimo} onChange={e => set('stock_minimo', e.target.value)} placeholder="0" />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label style={lbl}>Notas (opcional)</label>
                <textarea className="sp-input" rows={2} value={form.notas}
                  onChange={e => set('notas', e.target.value)}
                  placeholder="Observaciones…" style={{ resize:'none' }} />
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

      {/* ── Modal CSV preview ── */}
      {csvModal !== null && (
        <div
          style={{ position:'fixed', inset:0, zIndex:110, display:'flex', alignItems:'flex-end',
            background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget && !csvImporting) setCsvModal(null) }}
        >
          <div style={{
            width:'100%', maxWidth:600, margin:'0 auto',
            background:'var(--bg)', borderRadius:'24px 24px 0 0',
            padding:'20px 20px 40px', maxHeight:'88dvh', overflowY:'auto',
          }}>
            <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', margin:'0 auto 18px' }} />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:17, color:'var(--text)' }}>
                Importar CSV
              </h3>
              <button onClick={descargarPlantilla} style={{
                padding:'6px 12px', borderRadius:9, border:'none',
                background:`${col}12`, color:col, fontSize:12, fontWeight:700, cursor:'pointer',
                display:'flex', alignItems:'center', gap:5,
              }}>
                <Ico d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" size={14} />
                Plantilla
              </button>
            </div>

            {/* Errores de parseo */}
            {csvModal.errors?.length > 0 && (
              <div style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)',
                borderRadius:12, padding:'10px 14px', marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>
                  Advertencias ({csvModal.errors.length})
                </div>
                {csvModal.errors.map((e, i) => (
                  <div key={i} style={{ fontSize:11, color:'var(--text-3)', marginBottom:2 }}>• {e}</div>
                ))}
              </div>
            )}

            {csvModal.rows.length === 0 ? (
              <div style={{ textAlign:'center', padding:'30px 0', color:'var(--text-3)', fontSize:14 }}>
                No se encontraron filas válidas en el archivo.
              </div>
            ) : (
              <>
                <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:10 }}>
                  <strong style={{ color:'var(--text)' }}>{csvModal.rows.length}</strong> productos listos para importar.
                  Los que tienen código SKU se actualizarán si ya existen.
                </div>

                {/* Preview tabla */}
                <div style={{ overflowX:'auto', borderRadius:12, boxShadow:'0 1px 8px rgba(0,0,0,0.1)', marginBottom:16 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                    <thead>
                      <tr style={{ background:'var(--card)' }}>
                        {['Nombre','Categoría','Marca','Contenido','Costo','Venta','Stock','SKU'].map(h => (
                          <th key={h} style={{ padding:'8px 10px', textAlign:'left', color:'var(--text-3)',
                            fontWeight:700, letterSpacing:0.5, whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvModal.rows.slice(0, 20).map((r, i) => (
                        <tr key={i} style={{ borderTop:'1px solid var(--border)' }}>
                          <td style={{ padding:'7px 10px', color:'var(--text)', fontWeight:600, maxWidth:140,
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.nombre}</td>
                          <td style={{ padding:'7px 10px', color:'var(--text-2)' }}>{r.categoria}</td>
                          <td style={{ padding:'7px 10px', color:'var(--text-2)' }}>{r.marca || '—'}</td>
                          <td style={{ padding:'7px 10px', color:'var(--text-2)' }}>{r.contenido ? `${r.contenido} ${r.unidad}` : r.unidad}</td>
                          <td style={{ padding:'7px 10px', color:'var(--text-2)' }}>{fmtCOP(r.precio_costo)}</td>
                          <td style={{ padding:'7px 10px', color:'var(--text-2)' }}>{fmtCOP(r.precio_venta)}</td>
                          <td style={{ padding:'7px 10px', color:'var(--text-2)' }}>{r.stock}</td>
                          <td style={{ padding:'7px 10px', color:'var(--text-3)', fontFamily:'monospace' }}>{r.codigo || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvModal.rows.length > 20 && (
                    <div style={{ padding:'8px 12px', fontSize:11, color:'var(--text-3)', textAlign:'center',
                      borderTop:'1px solid var(--border)' }}>
                      …y {csvModal.rows.length - 20} más
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setCsvModal(null)} disabled={csvImporting} style={{
                flex:1, padding:'13px', borderRadius:12, cursor:'pointer',
                background:'var(--card)', border:'none', color:'var(--text-2)', fontWeight:700, boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
              }}>Cancelar</button>
              {csvModal.rows.length > 0 && (
                <button onClick={confirmarImportCSV} disabled={csvImporting} style={{
                  flex:2, padding:'13px', borderRadius:12, border:'none', cursor:'pointer',
                  background: csvImporting ? 'var(--border)' : `linear-gradient(135deg,${col},${col}cc)`,
                  color: csvImporting ? 'var(--text-3)' : '#fff',
                  fontFamily:'Outfit', fontWeight:800, fontSize:15,
                }}>
                  {csvImporting ? 'Importando…' : `Importar ${csvModal.rows.length} productos`}
                </button>
              )}
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
                background:'var(--card)', border:'none', color:'var(--text-2)', fontWeight:700, boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
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
