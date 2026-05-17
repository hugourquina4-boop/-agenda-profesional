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
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

function fmtFechaHora(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day:'numeric', month:'short' }) +
    ' · ' + d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
}

function tiempoEspera(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000)
  if (mins < 1)  return 'ahora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`
}

const METODOS = ['efectivo','nequi','daviplata','transferencia','tarjeta']
const METODO_COLORS = {
  efectivo:'#22c55e', nequi:'#a855f7', daviplata:'#f59e0b',
  transferencia:'#3b82f6', tarjeta:'#06b6d4',
}

const PROF_COLORS = ['#f43f5e','#a855f7','#3b82f6','#22c55e','#f59e0b','#06b6d4','#ec4899']

export default function SalonOrdenes() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [ordenes,       setOrdenes]       = useState([])
  const [profesionales, setProfesionales] = useState([])
  const [servicios,     setServicios]     = useState([])
  const [clientes,      setClientes]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [toast,         setToast]         = useState(null)

  // Modal nueva orden
  const [nuevaOpen,   setNuevaOpen]   = useState(false)
  const [formCliente, setFormCliente] = useState('')       // cliente_nombre libre
  const [formClienteId, setFormClienteId] = useState('')  // cliente_id opcional
  const [formProf,    setFormProf]    = useState('')
  const [formItems,   setFormItems]   = useState([])      // [{ servicio_id, nombre, precio, cantidad }]
  const [formNotas,   setFormNotas]   = useState('')
  const [creando,     setCreando]     = useState(false)
  const [servicioQ,   setServicioQ]   = useState('')

  // Modal editar
  const [editOrden,   setEditOrden]   = useState(null)
  const [editItems,   setEditItems]   = useState([])
  const [editProf,    setEditProf]    = useState('')
  const [editNotas,   setEditNotas]   = useState('')
  const [editServQ,   setEditServQ]   = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)

  // Modal pagar
  const [pagarOrden,  setPagarOrden]  = useState(null)
  const [pagoMonto,   setPagoMonto]   = useState('')
  const [pagoMetodo,  setPagoMetodo]  = useState('efectivo')
  const [pagoRef,     setPagoRef]     = useState('')
  const [pagando,     setPagando]     = useState(false)

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2800)
  }

  const cargar = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    const [
      { data: ords },
      { data: profs },
      { data: servs },
      { data: clts },
    ] = await Promise.all([
      supabase.from('ordenes_espera')
        .select('*, profesionales(nombre), clientes_agenda(nombre)')
        .eq('tenant_id', tenant.id)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false }),
      supabase.from('profesionales').select('id, nombre').eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
      supabase.from('servicios').select('id, nombre, precio').eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
      supabase.from('clientes_agenda').select('id, nombre').eq('tenant_id', tenant.id).order('nombre').limit(200),
    ])
    setOrdenes(ords || [])
    setProfesionales(profs || [])
    setServicios(servs || [])
    setClientes(clts || [])
    setLoading(false)
  }, [tenant])

  useEffect(() => { cargar() }, [cargar])

  // ── Crear orden ──────────────────────────────────────────────
  function resetNueva() {
    setFormCliente(''); setFormClienteId(''); setFormProf('')
    setFormItems([]); setFormNotas(''); setServicioQ('')
  }

  function agregarServicio(serv) {
    setFormItems(prev => {
      const existe = prev.find(i => i.servicio_id === serv.id)
      if (existe) return prev.map(i => i.servicio_id === serv.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { servicio_id: serv.id, nombre: serv.nombre, precio: serv.precio, cantidad: 1 }]
    })
    setServicioQ('')
  }

  function quitarItem(servId) {
    setFormItems(prev => prev.filter(i => i.servicio_id !== servId))
  }

  function cambiarCantidad(servId, delta) {
    setFormItems(prev => prev.map(i => {
      if (i.servicio_id !== servId) return i
      const nueva = Math.max(1, i.cantidad + delta)
      return { ...i, cantidad: nueva }
    }))
  }

  const totalOrden = formItems.reduce((s, i) => s + i.precio * i.cantidad, 0)

  async function crearOrden() {
    if (formItems.length === 0) { showToast('Agrega al menos un servicio', false); return }
    if (!formCliente.trim() && !formClienteId) { showToast('Indica el cliente', false); return }
    setCreando(true)
    const { error } = await supabase.from('ordenes_espera').insert({
      tenant_id:      tenant.id,
      cliente_id:     formClienteId || null,
      cliente_nombre: formClienteId ? null : formCliente.trim(),
      profesional_id: formProf || null,
      items:          formItems,
      total:          totalOrden,
      notas:          formNotas.trim() || null,
    })
    setCreando(false)
    if (error) { showToast('Error al crear orden', false); return }
    showToast('Orden creada ✓')
    setNuevaOpen(false)
    resetNueva()
    cargar()
  }

  // ── Editar orden ─────────────────────────────────────────────
  function abrirEditar(ord) {
    setEditOrden(ord)
    setEditItems(Array.isArray(ord.items) ? [...ord.items] : [])
    setEditProf(ord.profesional_id || '')
    setEditNotas(ord.notas || '')
    setEditServQ('')
  }

  function editAgregarServicio(serv) {
    setEditItems(prev => {
      const existe = prev.find(i => i.servicio_id === serv.id)
      if (existe) return prev.map(i => i.servicio_id === serv.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { servicio_id: serv.id, nombre: serv.nombre, precio: serv.precio, cantidad: 1 }]
    })
    setEditServQ('')
  }

  function editCambiarCantidad(servId, delta) {
    setEditItems(prev => prev.map(i => {
      if (i.servicio_id !== servId) return i
      return { ...i, cantidad: Math.max(1, i.cantidad + delta) }
    }))
  }

  const totalEdit = editItems.reduce((s, i) => s + (i.precio||0) * (i.cantidad||1), 0)

  async function guardarEdicion() {
    if (!editOrden || editItems.length === 0) return
    setGuardandoEdit(true)
    const { error } = await supabase.from('ordenes_espera').update({
      profesional_id: editProf || null,
      items:          editItems,
      total:          totalEdit,
      notas:          editNotas.trim() || null,
    }).eq('id', editOrden.id)
    setGuardandoEdit(false)
    if (error) { showToast('Error al guardar', false); return }
    showToast('Orden actualizada ✓')
    setEditOrden(null)
    cargar()
  }

  const editServsFiltrados = editServQ.trim()
    ? servicios.filter(s => s.nombre.toLowerCase().includes(editServQ.toLowerCase()))
    : servicios.slice(0, 8)

  // ── Pagar orden ──────────────────────────────────────────────
  function abrirPagar(orden) {
    setPagarOrden(orden)
    setPagoMonto(String(orden.total))
    setPagoMetodo('efectivo')
    setPagoRef('')
  }

  async function cobrarOrden(e) {
    e.preventDefault()
    if (!pagarOrden || !pagoMonto) return
    setPagando(true)
    try {
      // INSERT pago pendiente
      const { data: pago, error: errP } = await supabase.from('pagos').insert({
        tenant_id:   tenant.id,
        cita_id:     null,           // orden directa, no desde cita
        monto:       parseFloat(pagoMonto),
        metodo:      pagoMetodo,
        referencia:  pagoRef || null,
        estado:      'pendiente',
        notas:       `Orden #${pagarOrden.id.slice(-6)}`,
      }).select('id').single()

      if (errP) throw errP

      // UPDATE pago a pagado (dispara trigger comisión si hay profesional+regla)
      const { error: errU } = await supabase.from('pagos')
        .update({ estado:'pagado' }).eq('id', pago.id)
      if (errU) throw errU

      // Marcar orden como pagada
      await supabase.from('ordenes_espera')
        .update({ estado:'pagado', pago_id: pago.id })
        .eq('id', pagarOrden.id)

      showToast('Orden cobrada ✓')
      setPagarOrden(null)
      cargar()
    } catch (err) {
      console.error('[SalonOrdenes]', err)
      showToast('Error al registrar pago', false)
    }
    setPagando(false)
  }

  // ── Cancelar orden ───────────────────────────────────────────
  async function cancelarOrden(id) {
    await supabase.from('ordenes_espera').update({ estado:'cancelado' }).eq('id', id)
    showToast('Orden cancelada')
    cargar()
  }

  // Servicios filtrados por búsqueda
  const servsFiltrados = servicioQ.trim()
    ? servicios.filter(s => s.nombre.toLowerCase().includes(servicioQ.toLowerCase()))
    : servicios.slice(0, 8)

  // Clientes filtrados
  const [clienteQ, setClienteQ] = useState('')
  const clientesFiltrados = clienteQ.length > 1
    ? clientes.filter(c => c.nombre.toLowerCase().includes(clienteQ.toLowerCase())).slice(0, 6)
    : []

  return (
    <div style={{ padding:'0 16px 80px' }}>
      {toast && (
        <div style={{
          position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', zIndex:200,
          background: toast.ok ? '#22c55e' : '#ef4444',
          color:'#fff', padding:'12px 20px', borderRadius:14, fontSize:14, fontWeight:600,
          boxShadow:'0 4px 20px rgba(0,0,0,0.2)', whiteSpace:'nowrap',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:'var(--text)', marginBottom:2 }}>
            Órdenes en espera
          </h2>
          <p style={{ fontSize:13, color:'var(--text-3)' }}>
            {loading ? '…' : `${ordenes.length} pendiente${ordenes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => { resetNueva(); setNuevaOpen(true) }} style={{
          padding:'10px 16px', borderRadius:12, border:'none', cursor:'pointer',
          background:col, color:'#fff', fontWeight:700, fontSize:13, fontFamily:'Outfit',
          display:'flex', alignItems:'center', gap:6,
        }}>
          <Ico d="M12 4v16m8-8H4" size={14} /> Nueva orden
        </button>
      </div>

      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[1,2,3,4].map(i => <div key={i} className="sp-skeleton" style={{ height:180, borderRadius:16 }} />)}
        </div>
      ) : ordenes.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon">🧾</span>
          <p className="sp-empty-title">Sin órdenes pendientes</p>
          <p className="sp-empty-sub">Crea una orden cuando un cliente llegue sin cita previa</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
          {ordenes.map(ord => {
            const profNombre = ord.profesionales?.nombre || '—'
            const clienteNombre = ord.clientes_agenda?.nombre || ord.cliente_nombre || 'Sin nombre'
            const items = Array.isArray(ord.items) ? ord.items : []

            return (
              <div key={ord.id} style={{
                background:'var(--card)', borderRadius:18, overflow:'hidden',
                display:'flex', flexDirection:'column',
                boxShadow:'0 2px 20px rgba(0,0,0,0.18)',
              }}>
                {/* Header */}
                <div style={{
                  padding:'14px 16px 12px',
                  borderBottom:'1px solid rgba(255,255,255,0.05)',
                  background:`linear-gradient(135deg, ${col}22 0%, ${col}08 100%)`,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{
                      width:38, height:38, borderRadius:11, background:`${col}30`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'Outfit', fontWeight:800, fontSize:16, color:col, flexShrink:0,
                      boxShadow:`0 2px 10px ${col}30`,
                    }}>
                      {clienteNombre[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--text)',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {clienteNombre}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>
                        {profNombre !== '—' ? profNombre : 'Sin asignar'}
                      </div>
                    </div>
                    <span style={{
                      fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:7,
                      background:'rgba(255,255,255,0.08)', color:'var(--text-2)', flexShrink:0,
                    }}>{tiempoEspera(ord.created_at)}</span>
                    <button onClick={() => abrirEditar(ord)}
                      style={{ background:'rgba(255,255,255,0.07)', border:'none', cursor:'pointer',
                        color:'var(--text-3)', padding:6, borderRadius:8 }}>
                      <Ico d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={13} />
                    </button>
                    <button onClick={() => cancelarOrden(ord.id)}
                      style={{ background:'rgba(239,68,68,0.1)', border:'none', cursor:'pointer',
                        color:'#f87171', padding:6, borderRadius:8 }}>
                      <Ico d="M6 18L18 6M6 6l12 12" size={13} />
                    </button>
                  </div>
                </div>

                {/* Items */}
                <div style={{ padding:'12px 16px', flex:1 }}>
                  {items.map((it, i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: i < items.length - 1 ? 7 : 0 }}>
                      <span style={{ fontSize:13, color:'var(--text)', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {it.nombre}
                        {it.cantidad > 1 && <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:5 }}>×{it.cantidad}</span>}
                      </span>
                      <span style={{ fontSize:13, color:'var(--text-2)', fontWeight:700, marginLeft:8, flexShrink:0 }}>
                        ${((it.precio || 0) * (it.cantidad || 1)).toLocaleString('es-CO')}
                      </span>
                    </div>
                  ))}
                  {ord.notas && (
                    <p style={{ fontSize:11, color:'var(--text-3)', marginTop:8, fontStyle:'italic', lineHeight:1.4 }}>{ord.notas}</p>
                  )}
                </div>

                {/* Footer */}
                <div style={{
                  padding:'12px 16px',
                  background:'rgba(0,0,0,0.12)',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                }}>
                  <div style={{ fontFamily:'Outfit', fontWeight:900, fontSize:24, color:'var(--text)' }}>
                    {fmtCOP(ord.total)}
                  </div>
                  <button onClick={() => abrirPagar(ord)} style={{
                    padding:'10px 20px', borderRadius:12, border:'none', cursor:'pointer',
                    background:`linear-gradient(135deg, ${col}, ${col}cc)`,
                    boxShadow:`0 4px 16px ${col}50`,
                    color:'#fff', fontWeight:800, fontSize:14, fontFamily:'Outfit',
                  }}>
                    Cobrar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal editar orden ───────────────────────────────────── */}
      {editOrden && (
        <div style={{
          position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'flex-end',
          background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)',
        }} onClick={e => { if (e.target === e.currentTarget) setEditOrden(null) }}>
          <div style={{
            width:'100%', maxWidth:520, margin:'0 auto',
            background:'var(--bg)', borderRadius:'24px 24px 0 0',
            padding:'20px 20px 32px', maxHeight:'92dvh', overflowY:'auto',
          }}>
            <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', margin:'0 auto 20px' }} />
            <h3 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:18, color:'var(--text)', marginBottom:20 }}>
              Editar orden
            </h3>

            {/* Profesional */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', letterSpacing:0.5, display:'block', marginBottom:8 }}>PROFESIONAL</label>
              <select className="sp-input" value={editProf} onChange={e => setEditProf(e.target.value)}>
                <option value="">Sin asignar</option>
                {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            {/* Agregar servicio */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', letterSpacing:0.5, display:'block', marginBottom:8 }}>SERVICIOS / PRODUCTOS</label>
              <input className="sp-input" placeholder="Buscar servicio…"
                value={editServQ} onChange={e => setEditServQ(e.target.value)} />
              {editServsFiltrados.length > 0 && editServQ.trim() && (
                <div style={{
                  marginTop:4, background:'var(--card)', border:'1px solid var(--border)',
                  borderRadius:12, overflow:'hidden', maxHeight:200, overflowY:'auto',
                }}>
                  {editServsFiltrados.map(s => (
                    <button key={s.id} onClick={() => editAgregarServicio(s)} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      width:'100%', padding:'11px 14px', textAlign:'left',
                      background:'transparent', border:'none', borderBottom:'1px solid var(--border)',
                      color:'var(--text)', fontSize:13, cursor:'pointer',
                    }}>
                      <span>{s.nombre}</span>
                      <span style={{ color:'var(--text-3)', fontSize:12 }}>${Number(s.precio).toLocaleString('es-CO')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items */}
            {editItems.length > 0 && (
              <div style={{
                background:'var(--card)', border:'1px solid var(--border)',
                borderRadius:14, overflow:'hidden', marginBottom:14,
              }}>
                {editItems.map((it, i) => (
                  <div key={it.servicio_id} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                    borderBottom: i < editItems.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ flex:1, fontSize:13, color:'var(--text)', fontWeight:600 }}>{it.nombre}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <button onClick={() => editCambiarCantidad(it.servicio_id, -1)} style={{
                        width:24, height:24, borderRadius:6, border:'1px solid var(--border)',
                        background:'var(--bg)', color:'var(--text)', cursor:'pointer', fontWeight:700,
                      }}>−</button>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', minWidth:16, textAlign:'center' }}>
                        {it.cantidad}
                      </span>
                      <button onClick={() => editCambiarCantidad(it.servicio_id, 1)} style={{
                        width:24, height:24, borderRadius:6, border:'1px solid var(--border)',
                        background:'var(--bg)', color:'var(--text)', cursor:'pointer', fontWeight:700,
                      }}>+</button>
                    </div>
                    <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:13, color:col, minWidth:56, textAlign:'right' }}>
                      ${((it.precio||0) * it.cantidad).toLocaleString('es-CO')}
                    </span>
                    <button onClick={() => setEditItems(prev => prev.filter(x => x.servicio_id !== it.servicio_id))}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#f87171', padding:2 }}>
                      <Ico d="M6 18L18 6M6 6l12 12" size={14} />
                    </button>
                  </div>
                ))}
                <div style={{ padding:'10px 14px', background:`${col}08`, display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--text-2)' }}>Total</span>
                  <span style={{ fontFamily:'Outfit', fontWeight:900, fontSize:18, color:col }}>
                    ${totalEdit.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            )}

            {/* Notas */}
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', letterSpacing:0.5, display:'block', marginBottom:8 }}>NOTAS</label>
              <input className="sp-input" placeholder="Instrucciones especiales…"
                value={editNotas} onChange={e => setEditNotas(e.target.value)} />
            </div>

            <button onClick={guardarEdicion} disabled={guardandoEdit || editItems.length === 0} style={{
              width:'100%', padding:'15px', borderRadius:14, border:'none', cursor:'pointer',
              background: (guardandoEdit || editItems.length === 0) ? 'var(--border)' : col,
              color: (guardandoEdit || editItems.length === 0) ? 'var(--text-3)' : '#fff',
              fontFamily:'Outfit', fontWeight:800, fontSize:15, transition:'all 0.2s',
            }}>
              {guardandoEdit ? 'Guardando…' : `Guardar cambios · ${fmtCOP(totalEdit)}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal nueva orden ─────────────────────────────────────── */}
      {nuevaOpen && (
        <div style={{
          position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'flex-end',
          background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)',
        }} onClick={e => { if (e.target === e.currentTarget) { setNuevaOpen(false); resetNueva() } }}>
          <div style={{
            width:'100%', maxWidth:520, margin:'0 auto',
            background:'var(--bg)', borderRadius:'24px 24px 0 0',
            padding:'20px 20px 32px', maxHeight:'92dvh', overflowY:'auto',
          }}>
            <div style={{ width:40, height:4, borderRadius:2,
              background:'var(--border)', margin:'0 auto 20px' }} />
            <h3 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:18,
              color:'var(--text)', marginBottom:20 }}>Nueva orden</h3>

            {/* Cliente */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)',
                letterSpacing:0.5, display:'block', marginBottom:8 }}>CLIENTE</label>
              <input
                className="sp-input"
                placeholder="Buscar cliente o escribir nombre…"
                value={clienteQ || formCliente}
                onChange={e => {
                  setClienteQ(e.target.value)
                  setFormCliente(e.target.value)
                  setFormClienteId('')
                }}
              />
              {clientesFiltrados.length > 0 && (
                <div style={{
                  marginTop:4, background:'var(--card)', border:'1px solid var(--border)',
                  borderRadius:12, overflow:'hidden',
                }}>
                  {clientesFiltrados.map(c => (
                    <button key={c.id} onClick={() => {
                      setFormClienteId(c.id)
                      setFormCliente(c.nombre)
                      setClienteQ('')
                    }} style={{
                      display:'block', width:'100%', padding:'11px 14px', textAlign:'left',
                      background:'transparent', border:'none', borderBottom:'1px solid var(--border)',
                      color:'var(--text)', fontSize:13, fontWeight:600, cursor:'pointer',
                    }}>
                      {c.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Profesional */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)',
                letterSpacing:0.5, display:'block', marginBottom:8 }}>PROFESIONAL</label>
              <select className="sp-input" value={formProf} onChange={e => setFormProf(e.target.value)}>
                <option value="">Sin asignar</option>
                {profesionales.map((p, i) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            {/* Servicios */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)',
                letterSpacing:0.5, display:'block', marginBottom:8 }}>SERVICIOS / PRODUCTOS</label>
              <input
                className="sp-input"
                placeholder="Buscar servicio…"
                value={servicioQ}
                onChange={e => setServicioQ(e.target.value)}
              />
              {servsFiltrados.length > 0 && (
                <div style={{
                  marginTop:4, background:'var(--card)', border:'1px solid var(--border)',
                  borderRadius:12, overflow:'hidden', maxHeight:220, overflowY:'auto',
                }}>
                  {servsFiltrados.map(s => {
                    const enCarrito = formItems.some(i => i.servicio_id === s.id)
                    return (
                      <button key={s.id} onClick={() => agregarServicio(s)} style={{
                        display:'flex', justifyContent:'space-between', alignItems:'center',
                        width:'100%', padding:'11px 14px', textAlign:'left',
                        background: enCarrito ? `${col}14` : 'transparent',
                        border:'none', borderBottom:'1px solid var(--border)',
                        color: enCarrito ? col : 'var(--text)', fontSize:13, cursor:'pointer',
                        transition:'background 0.15s',
                      }}>
                        <span style={{ fontWeight: enCarrito ? 700 : 400 }}>{s.nombre}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                          <span style={{ color: enCarrito ? col : 'var(--text-3)', fontWeight:700, fontSize:12 }}>
                            ${Number(s.precio).toLocaleString('es-CO')}
                          </span>
                          {enCarrito && (
                            <span style={{
                              width:18, height:18, borderRadius:5, background:col,
                              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                            }}>
                              <svg width={10} height={10} viewBox="0 0 24 24" fill="none"
                                stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Items seleccionados */}
            {formItems.length > 0 && (
              <div style={{
                background:'var(--card)', border:'1px solid var(--border)',
                borderRadius:14, overflow:'hidden', marginBottom:14,
              }}>
                {formItems.map((it, i) => (
                  <div key={it.servicio_id} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                    borderBottom: i < formItems.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ flex:1, fontSize:13, color:'var(--text)', fontWeight:600 }}>{it.nombre}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <button onClick={() => cambiarCantidad(it.servicio_id, -1)} style={{
                        width:24, height:24, borderRadius:6, border:'1px solid var(--border)',
                        background:'var(--bg)', color:'var(--text)', cursor:'pointer', fontWeight:700,
                      }}>−</button>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', minWidth:16, textAlign:'center' }}>
                        {it.cantidad}
                      </span>
                      <button onClick={() => cambiarCantidad(it.servicio_id, 1)} style={{
                        width:24, height:24, borderRadius:6, border:'1px solid var(--border)',
                        background:'var(--bg)', color:'var(--text)', cursor:'pointer', fontWeight:700,
                      }}>+</button>
                    </div>
                    <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:13, color:col, minWidth:56, textAlign:'right' }}>
                      ${(it.precio * it.cantidad).toLocaleString('es-CO')}
                    </span>
                    <button onClick={() => quitarItem(it.servicio_id)} style={{
                      background:'none', border:'none', cursor:'pointer', color:'#f87171', padding:2,
                    }}>
                      <Ico d="M6 18L18 6M6 6l12 12" size={14} />
                    </button>
                  </div>
                ))}
                <div style={{ padding:'10px 14px', background:`${col}08`, display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--text-2)' }}>Total</span>
                  <span style={{ fontFamily:'Outfit', fontWeight:900, fontSize:18, color:col }}>
                    ${totalOrden.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            )}

            {/* Notas */}
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)',
                letterSpacing:0.5, display:'block', marginBottom:8 }}>NOTAS (opcional)</label>
              <input className="sp-input" placeholder="Instrucciones especiales…"
                value={formNotas} onChange={e => setFormNotas(e.target.value)} />
            </div>

            <button onClick={crearOrden} disabled={creando || formItems.length === 0} style={{
              width:'100%', padding:'15px', borderRadius:14, border:'none', cursor:'pointer',
              background: (creando || formItems.length === 0) ? 'var(--border)' : col,
              color: (creando || formItems.length === 0) ? 'var(--text-3)' : '#fff',
              fontFamily:'Outfit', fontWeight:800, fontSize:15, transition:'all 0.2s',
            }}>
              {creando ? 'Creando…' : `Crear orden · ${fmtCOP(totalOrden)}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal pagar orden ─────────────────────────────────────── */}
      {pagarOrden && (
        <div style={{
          position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'flex-end',
          background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)',
        }} onClick={e => { if (e.target === e.currentTarget) setPagarOrden(null) }}>
          <div style={{
            width:'100%', maxWidth:480, margin:'0 auto',
            background:'var(--bg)', borderRadius:'24px 24px 0 0',
            padding:'20px 20px 32px',
          }}>
            <div style={{ width:40, height:4, borderRadius:2,
              background:'var(--border)', margin:'0 auto 20px' }} />
            <h3 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:18,
              color:'var(--text)', marginBottom:4 }}>Cobrar orden</h3>
            <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:20 }}>
              {pagarOrden.clientes_agenda?.nombre || pagarOrden.cliente_nombre || 'Sin nombre'} ·{' '}
              {Array.isArray(pagarOrden.items) ? pagarOrden.items.length : 0} item(s)
            </p>

            <form onSubmit={cobrarOrden} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)',
                  letterSpacing:0.5, display:'block', marginBottom:8 }}>MONTO</label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)',
                    color:'var(--text-3)', fontWeight:700, fontSize:14, pointerEvents:'none' }}>$</span>
                  <input type="number" min="0" step="100" required autoFocus
                    value={pagoMonto} onChange={e => setPagoMonto(e.target.value)}
                    className="sp-input" style={{ paddingLeft:28 }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)',
                  letterSpacing:0.5, display:'block', marginBottom:8 }}>MÉTODO</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {METODOS.map(m => (
                    <button key={m} type="button" onClick={() => setPagoMetodo(m)} style={{
                      padding:'9px 14px', borderRadius:12, cursor:'pointer',
                      border:`2px solid ${pagoMetodo === m ? col : 'var(--border)'}`,
                      background: pagoMetodo === m ? `${col}15` : 'var(--card)',
                      color: pagoMetodo === m ? col : 'var(--text-2)',
                      fontWeight:700, fontSize:13, transition:'all 0.15s',
                      textTransform:'capitalize',
                    }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)',
                  letterSpacing:0.5, display:'block', marginBottom:8 }}>
                  REFERENCIA <span style={{ fontWeight:400 }}>(opcional)</span>
                </label>
                <input type="text" value={pagoRef} onChange={e => setPagoRef(e.target.value)}
                  className="sp-input" placeholder="Nro. transacción, voucher…" />
              </div>

              <button type="submit" disabled={pagando || !pagoMonto} style={{
                marginTop:4, padding:'16px', borderRadius:16, border:'none', cursor:'pointer',
                background: (pagando || !pagoMonto) ? 'var(--border)' : col,
                color: (pagando || !pagoMonto) ? 'var(--text-3)' : '#fff',
                fontFamily:'Outfit', fontWeight:800, fontSize:16, transition:'all 0.2s',
              }}>
                {pagando ? 'Procesando…' : `Cobrar $${Number(pagoMonto||0).toLocaleString('es-CO')}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
