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

const CATEGORIAS = ['Insumos', 'Equipos', 'Servicios', 'Arriendo', 'Publicidad', 'Nómina', 'Otros']
const METODOS    = ['efectivo', 'nequi', 'daviplata', 'transferencia', 'tarjeta']

const CAT_COLORS = {
  Insumos:    '#f43f5e',
  Equipos:    '#3b82f6',
  Servicios:  '#a855f7',
  Arriendo:   '#f59e0b',
  Publicidad: '#ec4899',
  Nómina:     '#22c55e',
  Otros:      '#6b7280',
}

const MET_COLORS = {
  efectivo:      '#22c55e',
  nequi:         '#a855f7',
  daviplata:     '#f59e0b',
  transferencia: '#3b82f6',
  tarjeta:       '#06b6d4',
}

function fmtCOP(n) {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

function fmtFecha(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function showToastFn() {
  let timer = null
  return function(msg, ok = true, setter) {
    if (timer) clearTimeout(timer)
    setter({ msg, ok })
    timer = setTimeout(() => setter(null), 3000)
  }
}
const _showToast = showToastFn()

// ── Form vacío ──────────────────────────────────────────────────────────────
function emptyProv()  { return { nombre:'', contacto:'', telefono:'', email:'', notas:'' } }
function emptyGasto() {
  return {
    concepto:'', monto:'', categoria:'Insumos', metodo_pago:'efectivo',
    fecha: new Date().toISOString().split('T')[0],
    proveedor_id:'', notas:'',
  }
}

export default function SalonProveedores() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [tab,        setTab]        = useState('gastos')
  const [provs,      setProvs]      = useState([])
  const [gastos,     setGastos]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [toast,      setToast]      = useState(null)

  // Filtro mes gastos
  const hoyDate = new Date()
  const [filtroMes, setFiltroMes] = useState({
    y: hoyDate.getFullYear(),
    m: hoyDate.getMonth() + 1,
  })

  // Sheets
  const [sheetProv,  setSheetProv]  = useState(false)
  const [sheetGasto, setSheetGasto] = useState(false)
  const [editProv,   setEditProv]   = useState(null)
  const [editGasto,  setEditGasto]  = useState(null)
  const [formProv,   setFormProv]   = useState(emptyProv())
  const [formGasto,  setFormGasto]  = useState(emptyGasto())
  const [saving,     setSaving]     = useState(false)

  function toast_(msg, ok = true) { _showToast(msg, ok, setToast) }

  const cargarProvs = useCallback(async () => {
    if (!tenant?.id) return
    const { data } = await supabase
      .from('proveedores')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('activo', true)
      .order('nombre')
    setProvs(data || [])
  }, [tenant?.id])

  const cargarGastos = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    const desde = `${filtroMes.y}-${String(filtroMes.m).padStart(2,'0')}-01`
    const lastDay = new Date(filtroMes.y, filtroMes.m, 0).getDate()
    const hasta   = `${filtroMes.y}-${String(filtroMes.m).padStart(2,'0')}-${lastDay}`
    const { data } = await supabase
      .from('gastos')
      .select('*, proveedores(nombre)')
      .eq('tenant_id', tenant.id)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: false })
    setGastos(data || [])
    setLoading(false)
  }, [tenant?.id, filtroMes])

  useEffect(() => { cargarProvs() }, [cargarProvs])
  useEffect(() => { cargarGastos() }, [cargarGastos])

  // ── Proveedor ───────────────────────────────────────────────────────────
  function abrirNuevoProv() {
    setEditProv(null); setFormProv(emptyProv()); setSheetProv(true)
  }
  function abrirEditProv(p) {
    setEditProv(p)
    setFormProv({ nombre:p.nombre, contacto:p.contacto||'', telefono:p.telefono||'',
      email:p.email||'', notas:p.notas||'' })
    setSheetProv(true)
  }
  async function guardarProv() {
    if (!formProv.nombre.trim()) { toast_('Nombre requerido', false); return }
    if (!tenant?.id) { toast_('Error de sesión', false); return }
    setSaving(true)
    try {
      const payload = {
        nombre:   formProv.nombre.trim(),
        contacto: formProv.contacto || null,
        telefono: formProv.telefono || null,
        email:    formProv.email    || null,
        notas:    formProv.notas    || null,
      }
      const { error } = editProv
        ? await supabase.from('proveedores').update(payload).eq('id', editProv.id)
        : await supabase.from('proveedores').insert({ ...payload, tenant_id: tenant.id })
      if (error) { toast_(error.message, false); return }
      toast_(editProv ? 'Proveedor actualizado' : 'Proveedor creado')
      setSheetProv(false); cargarProvs()
    } catch (e) { toast_('Error: ' + e.message, false) }
    finally { setSaving(false) }
  }
  async function eliminarProv(id) {
    if (!window.confirm('¿Eliminar proveedor?')) return
    await supabase.from('proveedores').update({ activo: false }).eq('id', id)
    toast_('Proveedor eliminado')
    cargarProvs()
  }

  // ── Gasto ───────────────────────────────────────────────────────────────
  function abrirNuevoGasto() {
    setEditGasto(null); setFormGasto(emptyGasto()); setSheetGasto(true)
  }
  function abrirEditGasto(g) {
    setEditGasto(g)
    setFormGasto({
      concepto:    g.concepto,
      monto:       String(g.monto),
      categoria:   g.categoria,
      metodo_pago: g.metodo_pago,
      fecha:       g.fecha,
      proveedor_id: g.proveedor_id || '',
      notas:       g.notas || '',
    })
    setSheetGasto(true)
  }
  async function guardarGasto() {
    if (!formGasto.concepto.trim()) { toast_('Concepto requerido', false); return }
    const monto = parseFloat(formGasto.monto)
    if (!monto || monto <= 0) { toast_('Monto inválido', false); return }
    if (!tenant?.id) { toast_('Error de sesión', false); return }
    setSaving(true)
    try {
      const payload = {
        concepto:    formGasto.concepto.trim(),
        monto,
        categoria:   formGasto.categoria,
        metodo_pago: formGasto.metodo_pago,
        fecha:       formGasto.fecha,
        proveedor_id: formGasto.proveedor_id || null,
        notas:       formGasto.notas || null,
      }
      const { error } = editGasto
        ? await supabase.from('gastos').update(payload).eq('id', editGasto.id)
        : await supabase.from('gastos').insert({ ...payload, tenant_id: tenant.id })
      if (error) { toast_(error.message, false); return }
      toast_(editGasto ? 'Gasto actualizado' : 'Gasto registrado')
      setSheetGasto(false); cargarGastos()
    } catch (e) { toast_('Error: ' + e.message, false) }
    finally { setSaving(false) }
  }
  async function eliminarGasto(id) {
    if (!window.confirm('¿Eliminar este gasto?')) return
    await supabase.from('gastos').delete().eq('id', id)
    toast_('Gasto eliminado')
    cargarGastos()
  }

  // ── Totales ─────────────────────────────────────────────────────────────
  const totalMes = gastos.reduce((s, g) => s + Number(g.monto), 0)
  const porCat   = CATEGORIAS.map(c => ({
    cat:   c,
    total: gastos.filter(g => g.categoria === c).reduce((s,g) => s + Number(g.monto), 0),
  })).filter(x => x.total > 0)

  // ── Navegación mes ──────────────────────────────────────────────────────
  function cambiarMes(delta) {
    setFiltroMes(p => {
      let m = p.m + delta, y = p.y
      if (m > 12) { m = 1;  y++ }
      if (m < 1)  { m = 12; y-- }
      return { y, m }
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '0 0 20px' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, padding: '10px 20px', borderRadius: 12,
          background: toast.ok ? '#22c55e' : '#ef4444', color: '#fff',
          fontWeight: 600, fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header + tabs */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:22,
              color:'var(--text)', margin:0, letterSpacing:'-0.3px' }}>Proveedores</h2>
            <p style={{ fontSize:13, color:'var(--text-3)', margin:'4px 0 0' }}>
              Gestiona proveedores y controla gastos
            </p>
          </div>
          <button
            onClick={tab === 'gastos' ? abrirNuevoGasto : abrirNuevoProv}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'9px 16px', borderRadius:12,
              background:`linear-gradient(135deg,${col},${col}bb)`,
              border:'none', color:'#fff', fontWeight:700, fontSize:13,
              cursor:'pointer', flexShrink:0,
            }}>
            <Ico d="M12 4v16m8-8H4" size={15} />
            {tab === 'gastos' ? 'Gasto' : 'Proveedor'}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:16 }}>
          {[['gastos','Gastos'],['proveedores','Proveedores']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding:'8px 18px', borderRadius:10, border:'none', cursor:'pointer',
              fontWeight:700, fontSize:13,
              background: tab===k ? col : 'rgba(128,128,128,0.08)',
              color: tab===k ? '#fff' : 'var(--text-3)',
              transition: 'all 0.15s',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── TAB GASTOS ── */}
      {tab === 'gastos' && (
        <>
          {/* Nav mes */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'0 16px 14px',
          }}>
            <button onClick={() => cambiarMes(-1)} style={{
              width:34, height:34, borderRadius:9, border:'none',
              background:`${col}12`, cursor:'pointer', color:col,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Ico d="M15 19l-7-7 7-7" size={16} />
            </button>
            <span style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>
              {MESES[filtroMes.m - 1]} {filtroMes.y}
            </span>
            <button onClick={() => cambiarMes(1)} style={{
              width:34, height:34, borderRadius:9, border:'none',
              background:`${col}12`, cursor:'pointer', color:col,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Ico d="M9 5l7 7-7 7" size={16} />
            </button>
          </div>

          {/* Resumen mes */}
          {gastos.length > 0 && (
            <div style={{ padding:'0 16px 14px' }}>
              <div style={{
                background:`linear-gradient(135deg,${col}18,${col}08)`,
                border:`1px solid ${col}30`, borderRadius:16,
                padding:'16px 18px',
              }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:10 }}>
                  <span style={{ fontFamily:'Outfit', fontWeight:900, fontSize:26, color:col }}>
                    {fmtCOP(totalMes)}
                  </span>
                  <span style={{ fontSize:12, color:'var(--text-3)' }}>total del mes</span>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {porCat.map(x => (
                    <div key={x.cat} style={{
                      display:'flex', alignItems:'center', gap:5,
                      padding:'4px 10px', borderRadius:20,
                      background: CAT_COLORS[x.cat] + '18',
                      border: `1px solid ${CAT_COLORS[x.cat]}40`,
                    }}>
                      <span style={{ width:6, height:6, borderRadius:'50%',
                        background: CAT_COLORS[x.cat], flexShrink:0 }} />
                      <span style={{ fontSize:11, fontWeight:700, color: CAT_COLORS[x.cat] }}>
                        {x.cat}
                      </span>
                      <span style={{ fontSize:11, color:'var(--text-3)' }}>
                        {fmtCOP(x.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Lista gastos */}
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}>
              <div className="sp-spinner" />
            </div>
          ) : gastos.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 24px', color:'var(--text-3)', fontSize:14 }}>
              No hay gastos en este mes.
              <br /><br />
              <button onClick={abrirNuevoGasto} style={{
                padding:'10px 20px', borderRadius:12, border:`1.5px dashed ${col}60`,
                background:'transparent', color:col, fontWeight:700, fontSize:13, cursor:'pointer',
              }}>
                + Registrar primer gasto
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6, padding:'0 16px' }}>
              {gastos.map(g => (
                <div key={g.id} style={{
                  display:'flex', alignItems:'flex-start', gap:12,
                  padding:'13px 14px', borderRadius:14,
                  background:`linear-gradient(135deg,${(CAT_COLORS[g.categoria]||'#6b7280')}10,var(--card))`,
                  boxShadow:'0 2px 12px rgba(0,0,0,0.1)',
                }}>
                  {/* Dot categoría */}
                  <div style={{
                    width:36, height:36, borderRadius:10, flexShrink:0, marginTop:1,
                    background: (CAT_COLORS[g.categoria] || '#6b7280') + '18',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <span style={{ width:10, height:10, borderRadius:'50%',
                      background: CAT_COLORS[g.categoria] || '#6b7280' }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{
                      fontWeight:700, fontSize:14, color:'var(--text)',
                      overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                    }}>
                      {g.concepto}
                    </div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
                      <span style={{
                        fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5,
                        background:(CAT_COLORS[g.categoria]||'#6b7280')+'18',
                        color: CAT_COLORS[g.categoria]||'#6b7280',
                      }}>
                        {g.categoria}
                      </span>
                      <span style={{
                        fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5,
                        background:(MET_COLORS[g.metodo_pago]||'#6b7280')+'18',
                        color: MET_COLORS[g.metodo_pago]||'#6b7280',
                      }}>
                        {g.metodo_pago}
                      </span>
                      {g.proveedores?.nombre && (
                        <span style={{
                          fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:5,
                          background:'rgba(128,128,128,0.08)', color:'var(--text-3)',
                        }}>
                          {g.proveedores.nombre}
                        </span>
                      )}
                      <span style={{ fontSize:10, color:'var(--text-3)' }}>
                        {fmtFecha(g.fecha)}
                      </span>
                    </div>
                  </div>

                  {/* Monto + acciones */}
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:15, color:col }}>
                      {fmtCOP(g.monto)}
                    </div>
                    <div style={{ display:'flex', gap:4, marginTop:4 }}>
                      <button onClick={() => abrirEditGasto(g)} style={{
                        width:28, height:28, borderRadius:7, border:'none',
                        background:'rgba(255,255,255,0.08)', cursor:'pointer', color:'var(--text-3)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        <Ico d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={13} />
                      </button>
                      <button onClick={() => eliminarGasto(g.id)} style={{
                        width:28, height:28, borderRadius:7, border:'1px solid rgba(239,68,68,0.2)',
                        background:'rgba(239,68,68,0.06)', cursor:'pointer', color:'#f87171',
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        <Ico d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TAB PROVEEDORES ── */}
      {tab === 'proveedores' && (
        <div style={{ padding:'0 16px' }}>
          {provs.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 24px', color:'var(--text-3)', fontSize:14 }}>
              No hay proveedores registrados.
              <br /><br />
              <button onClick={abrirNuevoProv} style={{
                padding:'10px 20px', borderRadius:12, border:`1.5px dashed ${col}60`,
                background:'transparent', color:col, fontWeight:700, fontSize:13, cursor:'pointer',
              }}>
                + Añadir primer proveedor
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {provs.map(p => (
                <div key={p.id} style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'13px 14px', borderRadius:14,
                  background:`linear-gradient(135deg,${col}10,var(--card))`,
                  boxShadow:'0 2px 12px rgba(0,0,0,0.1)',
                }}>
                  <div style={{
                    width:40, height:40, borderRadius:12, flexShrink:0,
                    background:`${col}18`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'Outfit', fontWeight:800, fontSize:16, color:col,
                  }}>
                    {p.nombre[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{
                      fontWeight:700, fontSize:14, color:'var(--text)',
                      overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                    }}>
                      {p.nombre}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                      {[p.contacto, p.telefono].filter(Boolean).join(' · ') || 'Sin contacto'}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    <button onClick={() => abrirEditProv(p)} style={{
                      width:34, height:34, borderRadius:9, border:'none',
                      background:'rgba(255,255,255,0.08)', cursor:'pointer', color:'var(--text-3)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <Ico d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={15} />
                    </button>
                    <button onClick={() => eliminarProv(p.id)} style={{
                      width:34, height:34, borderRadius:9, border:'1px solid rgba(239,68,68,0.2)',
                      background:'rgba(239,68,68,0.06)', cursor:'pointer', color:'#f87171',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <Ico d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SHEET Proveedor ── */}
      {sheetProv && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setSheetProv(false)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">
              {editProv ? 'Editar proveedor' : 'Nuevo proveedor'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:16 }}>
              {[
                ['nombre',   'NOMBRE *',   'text',  'Ej: Distribuidora Belleza SA'],
                ['contacto', 'CONTACTO',   'text',  'Nombre del contacto'],
                ['telefono', 'TELÉFONO',   'tel',   '3001234567'],
                ['email',    'EMAIL',       'email', 'proveedor@email.com'],
              ].map(([k, lbl, type, ph]) => (
                <div key={k}>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
                    letterSpacing:0.5, display:'block', marginBottom:6 }}>{lbl}</label>
                  <input className="sp-input" type={type} placeholder={ph}
                    value={formProv[k]}
                    onChange={e => setFormProv(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
                  letterSpacing:0.5, display:'block', marginBottom:6 }}>NOTAS</label>
                <textarea className="sp-input" rows={2} placeholder="Productos, condiciones, etc."
                  value={formProv.notas}
                  onChange={e => setFormProv(f => ({ ...f, notas: e.target.value }))}
                  style={{ resize:'none' }} />
              </div>
            </div>
            <button disabled={saving} onClick={guardarProv} style={{
              width:'100%', padding:'15px', borderRadius:14, border:'none', cursor:'pointer',
              background:`linear-gradient(135deg,${col},${col}bb)`, color:'#fff',
              fontWeight:700, fontSize:15, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Guardando…' : (editProv ? 'Guardar cambios' : 'Crear proveedor')}
            </button>
            <button onClick={() => setSheetProv(false)} style={{
              marginTop:8, width:'100%', padding:'12px', borderRadius:12,
              background:'var(--card)', border:'none', boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
              color:'var(--text-3)', fontWeight:600, fontSize:13, cursor:'pointer',
            }}>Cancelar</button>
          </div>
        </>
      )}

      {/* ── SHEET Gasto ── */}
      {sheetGasto && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setSheetGasto(false)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">
              {editGasto ? 'Editar gasto' : 'Registrar gasto'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:16 }}>

              {/* Concepto */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
                  letterSpacing:0.5, display:'block', marginBottom:6 }}>CONCEPTO *</label>
                <input className="sp-input" placeholder="Ej: Tinte Wella 60g rubio"
                  value={formGasto.concepto}
                  onChange={e => setFormGasto(f => ({ ...f, concepto: e.target.value }))} />
              </div>

              {/* Monto + Fecha */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
                    letterSpacing:0.5, display:'block', marginBottom:6 }}>MONTO *</label>
                  <input className="sp-input" type="number" placeholder="0"
                    value={formGasto.monto}
                    onChange={e => setFormGasto(f => ({ ...f, monto: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
                    letterSpacing:0.5, display:'block', marginBottom:6 }}>FECHA</label>
                  <input className="sp-input" type="date"
                    value={formGasto.fecha}
                    onChange={e => setFormGasto(f => ({ ...f, fecha: e.target.value }))} />
                </div>
              </div>

              {/* Categoría */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
                  letterSpacing:0.5, display:'block', marginBottom:6 }}>CATEGORÍA</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {CATEGORIAS.map(c => (
                    <button key={c} onClick={() => setFormGasto(f => ({ ...f, categoria:c }))}
                      style={{
                        padding:'6px 12px', borderRadius:20, border:'1.5px solid',
                        borderColor: formGasto.categoria===c ? CAT_COLORS[c] : 'var(--border)',
                        background: formGasto.categoria===c ? CAT_COLORS[c]+'18' : 'transparent',
                        color: formGasto.categoria===c ? CAT_COLORS[c] : 'var(--text-3)',
                        fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.12s',
                      }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Método pago */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
                  letterSpacing:0.5, display:'block', marginBottom:6 }}>MÉTODO DE PAGO</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {METODOS.map(m => (
                    <button key={m} onClick={() => setFormGasto(f => ({ ...f, metodo_pago:m }))}
                      style={{
                        padding:'6px 12px', borderRadius:20, border:'1.5px solid',
                        borderColor: formGasto.metodo_pago===m ? MET_COLORS[m] : 'var(--border)',
                        background: formGasto.metodo_pago===m ? MET_COLORS[m]+'18' : 'transparent',
                        color: formGasto.metodo_pago===m ? MET_COLORS[m] : 'var(--text-3)',
                        fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.12s',
                      }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Proveedor */}
              {provs.length > 0 && (
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
                    letterSpacing:0.5, display:'block', marginBottom:6 }}>PROVEEDOR</label>
                  <select className="sp-input"
                    value={formGasto.proveedor_id}
                    onChange={e => setFormGasto(f => ({ ...f, proveedor_id: e.target.value }))}>
                    <option value="">Sin proveedor</option>
                    {provs.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notas */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
                  letterSpacing:0.5, display:'block', marginBottom:6 }}>NOTAS</label>
                <textarea className="sp-input" rows={2} placeholder="Opcional"
                  value={formGasto.notas}
                  onChange={e => setFormGasto(f => ({ ...f, notas: e.target.value }))}
                  style={{ resize:'none' }} />
              </div>
            </div>

            <button disabled={saving} onClick={guardarGasto} style={{
              width:'100%', padding:'15px', borderRadius:14, border:'none', cursor:'pointer',
              background:`linear-gradient(135deg,${col},${col}bb)`, color:'#fff',
              fontWeight:700, fontSize:15, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Guardando…' : (editGasto ? 'Guardar cambios' : 'Registrar gasto')}
            </button>
            <button onClick={() => setSheetGasto(false)} style={{
              marginTop:8, width:'100%', padding:'12px', borderRadius:12,
              background:'var(--card)', border:'none', boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
              color:'var(--text-3)', fontWeight:600, fontSize:13, cursor:'pointer',
            }}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  )
}
