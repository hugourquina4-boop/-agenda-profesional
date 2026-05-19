import { useState, useEffect, useCallback, useMemo } from 'react'
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

const PERIODOS = [
  { key:'hoy',    label:'Hoy' },
  { key:'semana', label:'Semana' },
  { key:'mes',    label:'Mes' },
  { key:'rango',  label:'Rango' },
]

const METODOS = [
  { key:'efectivo',      label:'Efectivo' },
  { key:'nequi',         label:'Nequi' },
  { key:'daviplata',     label:'Daviplata' },
  { key:'transferencia', label:'Transferencia' },
  { key:'tarjeta',       label:'Tarjeta' },
]

const METODO_COLORS = {
  efectivo:      '#22c55e',
  nequi:         '#a855f7',
  daviplata:     '#f59e0b',
  transferencia: '#3b82f6',
  tarjeta:       '#06b6d4',
  wompi:         '#10b981',
}

const METODO_LABELS = {
  wompi: '🌐 Portal',
}

const CATS_GASTO = ['Insumos','Servicios','Arriendo','Nómina','Marketing','Equipos','Otros']

function rango(key) {
  const hoy = new Date()
  const desde = new Date(hoy)
  if (key === 'semana') desde.setDate(hoy.getDate() - 6)
  if (key === 'mes')    desde.setDate(1)
  return {
    desde: desde.toISOString().slice(0,10),
    hasta: hoy.toISOString().slice(0,10),
  }
}

function fmtCOP(n) {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}
function fmtCOPFull(n) {
  return `$${Number(n||0).toLocaleString('es-CO')}`
}
function fmtHora(iso) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
}
function fmtFecha(iso) {
  return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-CO', { day:'numeric', month:'short' })
}

export default function SalonCaja() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [periodo,      setPeriodo]      = useState('hoy')
  const [rangoDesde,   setRangoDesde]   = useState('')
  const [rangoHasta,   setRangoHasta]   = useState('')
  const [vista,        setVista]        = useState('cobrar')
  const [pendientes,   setPendientes]   = useState([])
  const [historial,    setHistorial]    = useState([])
  const [egresos,      setEgresos]      = useState([])
  const [totalCobrado, setTotalCobrado] = useState(0)
  const [totalEgresos, setTotalEgresos] = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [busqueda,     setBusqueda]     = useState('')

  const [modalCita,    setModalCita]    = useState(null)
  const [monto,        setMonto]        = useState('')
  const [metodo,       setMetodo]       = useState('efectivo')
  const [referencia,   setReferencia]   = useState('')
  const [descuento,    setDescuento]    = useState('')
  const [tipoDesc,     setTipoDesc]     = useState(null)   // null | 'descuento' | 'cortesia'
  const [lineas,       setLineas]       = useState([])      // [{producto_id,nombre,cantidad,precio_unitario}]
  const [propina,      setPropina]      = useState('')
  const [prodsDisp,    setProdsDisp]    = useState([])
  const [busqProd,     setBusqProd]     = useState('')
  const [showProdPick, setShowProdPick] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState(null)
  const [confirmAnular, setConfirmAnular] = useState(null)
  const [anulNota,      setAnulNota]      = useState('')
  const [paginaHist,    setPaginaHist]    = useState(20)

  // Modal egreso rápido
  const [modalEgreso,  setModalEgreso]  = useState(false)
  const [eMontoVal,    setEMontoVal]    = useState('')
  const [eConcepto,    setEConcepto]    = useState('')
  const [eCat,         setECat]         = useState('Otros')
  const [savingEg,     setSavingEg]     = useState(false)

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2800)
  }

  function descargarCSV() {
    const BOM = '﻿'
    const headers = ['Fecha','Cliente','Servicio','Profesional','Método','Monto','Referencia','Estado']
    const rows = histFiltrado.map(c => [
      new Date(c.pago.created_at).toLocaleDateString('es-CO'),
      c.clientes_agenda?.nombre || '',
      c.servicios?.nombre || '',
      c.profesionales?.nombre || '',
      METODO_LABELS[c.pago.metodo] || c.pago.metodo,
      Number(c.pago.monto),
      c.pago.referencia || '',
      c.pago.notas ? 'Anulado' : 'Pagado',
    ])
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const label = periodo === 'rango' ? `${rangoDesde}_${rangoHasta}` : periodo
    a.download = `caja-${label}-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function descargarEgresosCSV() {
    const BOM = '﻿'
    const headers = ['Fecha','Concepto','Categoría','Proveedor','Monto']
    const rows = egresos.map(g => [
      fmtFecha(g.fecha),
      g.concepto || '',
      g.categoria || '',
      g.proveedores?.nombre || '',
      Number(g.monto),
    ])
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const label = periodo === 'rango' ? `${rangoDesde}_${rangoHasta}` : periodo
    a.download = `egresos-${label}-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function descargarCierre() {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' })
    const [r, g, b] = [parseInt(col.slice(1,3),16), parseInt(col.slice(3,5),16), parseInt(col.slice(5,7),16)]
    const now = new Date()
    const fechaHora = now.toLocaleString('es-CO', { weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })

    doc.setFillColor(r,g,b); doc.rect(0,0,210,32,'F')
    doc.setTextColor(255,255,255)
    doc.setFontSize(9); doc.setFont('helvetica','normal')
    doc.text(tenant?.nombre || 'Salón', 14, 11)
    doc.setFontSize(18); doc.setFont('helvetica','bold')
    doc.text('CIERRE DE CAJA', 105, 18, { align:'center' })
    doc.setFontSize(9); doc.setFont('helvetica','normal')
    doc.text(fechaHora, 105, 26, { align:'center' })

    // Cajas KPI
    const bY = 40, bH = 22
    doc.setFillColor(Math.min(255,r+185),Math.min(255,g+185),Math.min(255,b+185))
    doc.rect(10,bY,57,bH,'F')
    doc.setTextColor(r,g,b); doc.setFontSize(8); doc.setFont('helvetica','bold')
    doc.text('INGRESOS',38,bY+6,{align:'center'})
    doc.setFontSize(14); doc.text(fmtCOP(totalCobrado),38,bY+16,{align:'center'})

    doc.setFillColor(254,226,226); doc.rect(77,bY,57,bH,'F')
    doc.setTextColor(220,38,38); doc.setFontSize(8)
    doc.text('EGRESOS',105,bY+6,{align:'center'})
    doc.setFontSize(14); doc.text(fmtCOP(totalEgresos),105,bY+16,{align:'center'})

    const saldoPos = (totalCobrado-totalEgresos) >= 0
    doc.setFillColor(saldoPos?220:254, saldoPos?252:226, saldoPos?231:226)
    doc.rect(144,bY,57,bH,'F')
    doc.setTextColor(saldoPos?21:220, saldoPos?128:38, saldoPos?61:38)
    doc.setFontSize(8); doc.text('SALDO NETO',172,bY+6,{align:'center'})
    doc.setFontSize(14); doc.text(fmtCOP(Math.abs(totalCobrado-totalEgresos)),172,bY+16,{align:'center'})

    let y = bY + bH + 10
    // Métodos
    const porM = {}
    historial.forEach(c => { porM[c.pago.metodo] = (porM[c.pago.metodo]||0)+Number(c.pago.monto) })
    doc.setFillColor(245,245,245); doc.rect(10,y-5,190,8,'F')
    doc.setTextColor(0,0,0); doc.setFontSize(9); doc.setFont('helvetica','bold')
    doc.text('MÉTODO DE PAGO',14,y); doc.text('MONTO',170,y); y+=8
    doc.setFont('helvetica','normal')
    Object.entries(porM).forEach(([m,t],i)=>{
      if(i%2===0){doc.setFillColor(252,252,252);doc.rect(10,y-4,190,7,'F')}
      doc.setTextColor(0,0,0); doc.text(m.charAt(0).toUpperCase()+m.slice(1),14,y)
      doc.setTextColor(34,197,94); doc.text(fmtCOPFull(t),170,y); y+=7
    })
    // Cobros
    y+=6
    if(historial.length>0){
      doc.setFillColor(r,g,b); doc.rect(10,y,190,8,'F')
      doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold')
      doc.text(`COBROS DEL DÍA (${historial.length})`,14,y+5.5); y+=14
      doc.setTextColor(0,0,0)
      doc.text('Cliente',14,y); doc.text('Servicio',70,y); doc.text('Método',135,y); doc.text('Monto',170,y)
      y+=7; doc.setFont('helvetica','normal')
      historial.slice(0,40).forEach((c,i)=>{
        if(y>268){doc.addPage();y=20}
        if(i%2===0){doc.setFillColor(252,252,252);doc.rect(10,y-4,190,7,'F')}
        doc.setTextColor(0,0,0)
        doc.text((c.clientes_agenda?.nombre||'—').substring(0,22),14,y)
        doc.text((c.servicios?.nombre||'—').substring(0,22),70,y)
        doc.text(c.pago.metodo,135,y)
        doc.setTextColor(34,197,94); doc.text(fmtCOPFull(c.pago.monto),170,y); y+=6
      })
    }
    // Firma
    if(y>254){doc.addPage();y=20}
    y+=10
    doc.setDrawColor(0,0,0); doc.setLineWidth(0.3); doc.line(14,y,90,y)
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(150,150,150)
    doc.text('Firma responsable de caja',14,y+5)
    doc.text(`Salón Pro · ${fechaHora}`,105,y+5,{align:'center'})
    doc.save(`cierre-caja-${now.toISOString().slice(0,10)}.pdf`)
  }

  async function descargarPDF() {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' })
    const [r, g, b] = [parseInt(col.slice(1,3),16), parseInt(col.slice(3,5),16), parseInt(col.slice(5,7),16)]

    doc.setFillColor(r, g, b)
    doc.rect(0, 0, 210, 28, 'F')
    doc.setTextColor(255,255,255)
    doc.setFontSize(16); doc.setFont('helvetica','bold')
    doc.text(tenant?.nombre || 'Salón', 14, 12)
    doc.setFontSize(10); doc.setFont('helvetica','normal')
    doc.text(`Reporte de Caja · ${PERIODOS.find(p => p.key === periodo)?.label} · ${new Date().toLocaleDateString('es-CO',{dateStyle:'long'})}`, 14, 20)

    doc.setTextColor(0,0,0)
    doc.setFontSize(22); doc.setFont('helvetica','bold')
    doc.text(`Ingresos: ${fmtCOPFull(totalCobrado)}`, 14, 44)
    doc.setFontSize(14)
    doc.text(`Egresos: ${fmtCOPFull(totalEgresos)}`, 14, 54)
    doc.setTextColor(r,g,b)
    doc.text(`Saldo: ${fmtCOPFull(totalCobrado - totalEgresos)}`, 14, 64)
    doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(100,100,100)
    doc.text(`${historial.length} cobros`, 14, 72)

    const porMetodo = {}
    historial.forEach(c => { porMetodo[c.pago.metodo] = (porMetodo[c.pago.metodo]||0) + Number(c.pago.monto) })
    let xm = 14
    Object.entries(porMetodo).forEach(([m, t]) => {
      doc.setTextColor(r,g,b); doc.setFont('helvetica','bold')
      doc.text(`${m}: ${fmtCOPFull(t)}`, xm, 80); xm += 55
    })

    let y = 94
    doc.setFillColor(245,245,245); doc.rect(10, y-5, 190, 9, 'F')
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
    doc.text('Cliente', 14, y); doc.text('Servicio', 68, y)
    doc.text('Método', 130, y); doc.text('Monto', 170, y); y += 8

    doc.setFont('helvetica','normal')
    historial.forEach((c, i) => {
      if (y > 270) { doc.addPage(); y = 20 }
      if (i % 2 === 0) { doc.setFillColor(252,252,252); doc.rect(10, y-4, 190, 7, 'F') }
      doc.setTextColor(0,0,0)
      doc.text((c.clientes_agenda?.nombre||'—').substring(0,24), 14, y)
      doc.text((c.servicios?.nombre||'—').substring(0,22), 68, y)
      doc.text(c.pago.metodo, 130, y)
      doc.setTextColor(34,197,94)
      doc.text(fmtCOPFull(c.pago.monto), 170, y); y += 7
    })

    // Sección egresos
    if (egresos.length > 0) {
      y += 8
      if (y > 250) { doc.addPage(); y = 20 }
      doc.setFillColor(239,68,68)
      doc.rect(10, y, 190, 8, 'F')
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
      doc.text(`Egresos del período: ${fmtCOPFull(totalEgresos)}`, 14, y+5.5)
      y += 14

      const porCat = {}
      egresos.forEach(g => { porCat[g.categoria] = (porCat[g.categoria]||0) + Number(g.monto) })
      doc.setFont('helvetica','normal'); doc.setFontSize(9)
      Object.entries(porCat).sort((a,b)=>b[1]-a[1]).forEach(([cat, tot], i) => {
        if (y > 270) { doc.addPage(); y = 20 }
        if (i % 2 === 0) { doc.setFillColor(254,242,242); doc.rect(10, y-4, 190, 7, 'F') }
        doc.setTextColor(0,0,0); doc.text(cat, 14, y)
        doc.setTextColor(239,68,68); doc.text(fmtCOPFull(tot), 170, y)
        y += 7
      })

      y += 4
      if (y < 270) {
        doc.setDrawColor(239,68,68); doc.setLineWidth(0.2)
        doc.line(10, y, 200, y)
        y += 6
        doc.setFont('helvetica','bold'); doc.setFontSize(10)
        doc.setTextColor(0,0,0); doc.text('Saldo neto:', 14, y)
        const saldoColor = totalCobrado - totalEgresos >= 0 ? [34,197,94] : [239,68,68]
        doc.setTextColor(...saldoColor)
        doc.text(fmtCOPFull(totalCobrado - totalEgresos), 170, y)
      }
    }

    const label = periodo === 'rango' ? `${rangoDesde}_${rangoHasta}` : periodo
    doc.save(`caja-${label}-${new Date().toISOString().slice(0,10)}.pdf`)
  }

  const cargar = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    if (periodo === 'rango' && (!rangoDesde || !rangoHasta)) { setLoading(false); return }
    setLoading(true)
    const { desde, hasta } = periodo === 'rango'
      ? { desde: rangoDesde, hasta: rangoHasta }
      : rango(periodo)

    const [citasRes, pagosRes, egresoRes] = await Promise.all([
      supabase.from('citas')
        .select('id, fecha_inicio, servicios(id,nombre,precio), profesionales(nombre), clientes_agenda(nombre)')
        .eq('tenant_id', tenant.id)
        .eq('estado', 'completada')
        .gte('fecha_inicio', `${desde}T00:00:00`)
        .lte('fecha_inicio', `${hasta}T23:59:59`)
        .order('fecha_inicio', { ascending: false }),
      supabase.from('pagos')
        .select('id, cita_id, monto, metodo, referencia, estado, notas, created_at')
        .eq('tenant_id', tenant.id)
        .gte('created_at', `${desde}T00:00:00`)
        .lte('created_at', `${hasta}T23:59:59`)
        .order('created_at', { ascending: false }),
      supabase.from('gastos')
        .select('id, fecha, monto, concepto, categoria, proveedores(nombre)')
        .eq('tenant_id', tenant.id)
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: false }),
    ])

    const citas = citasRes.data || []
    const pagosData = (pagosRes.data || []).filter(p => p.estado === 'pagado')
    const pagosMap = {}
    pagosData.forEach(p => { pagosMap[p.cita_id] = p })

    const sinPago = citas.filter(c => !pagosMap[c.id])
    const conPago = citas
      .filter(c => pagosMap[c.id])
      .map(c => ({ ...c, pago: pagosMap[c.id] }))
      .sort((a, b) => new Date(b.pago.created_at) - new Date(a.pago.created_at))

    const egresosData = egresoRes.data || []

    setPendientes(sinPago)
    setHistorial(conPago)
    setEgresos(egresosData)
    setTotalCobrado(conPago.reduce((s, c) => s + Number(c.pago.monto || 0), 0))
    setTotalEgresos(egresosData.reduce((s, g) => s + Number(g.monto || 0), 0))
    setLoading(false)
  }, [tenant, periodo, rangoDesde, rangoHasta])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { setPaginaHist(20); setBusqueda('') }, [periodo])

  function abrirModal(cita) {
    setModalCita(cita)
    setMonto(String(cita.servicios?.precio || ''))
    setMetodo('efectivo')
    setReferencia('')
    setDescuento('')
    setTipoDesc(null)
    setLineas([])
    setPropina('')
    setBusqProd('')
    setShowProdPick(false)
    if (tenant) {
      supabase.from('productos_salon')
        .select('id,nombre,categoria,precio_venta,stock')
        .eq('tenant_id', tenant.id).eq('activo', true).gt('stock', 0)
        .order('nombre')
        .then(({ data }) => setProdsDisp(data || []))
    }
  }

  async function anularPago(pago) {
    await supabase.from('pagos').update({ estado:'anulado', notas: anulNota.trim() || null }).eq('id', pago.id)
    setConfirmAnular(null); setAnulNota('')
    showToast('Pago anulado')
    cargar()
  }

  async function handleCobrar(e) {
    e.preventDefault()
    if (!modalCita || !monto) return
    setSaving(true)
    try {
      const base = parseFloat(monto) || 0
      const desc = tipoDesc === 'descuento' ? (parseFloat(descuento) || 0) : 0
      const montoServicio = tipoDesc === 'cortesia' ? 0 : Math.max(0, base - desc)
      const propinaN = parseFloat(propina) || 0
      const { data: pago, error: errIns } = await supabase.from('pagos')
        .insert({
          tenant_id:      tenant.id,
          cita_id:        modalCita.id,
          monto:          montoServicio,
          metodo,
          referencia:     referencia || null,
          estado:         'pendiente',
          descuento:      tipoDesc === 'cortesia' ? base : desc,
          tipo_descuento: tipoDesc || null,
          propina:        propinaN,
        })
        .select('id').single()
      if (errIns) throw errIns
      const { error: errUpd } = await supabase.from('pagos').update({ estado:'pagado' }).eq('id', pago.id)
      if (errUpd) throw errUpd
      // Guardar líneas de productos + reducir stock
      if (lineas.length > 0) {
        await supabase.from('pagos_lineas').insert(
          lineas.map(l => ({
            tenant_id: tenant.id, pago_id: pago.id,
            producto_id: l.producto_id, nombre: l.nombre,
            cantidad: l.cantidad, precio_unitario: l.precio_unitario,
          }))
        )
        for (const l of lineas) {
          const p = prodsDisp.find(x => x.id === l.producto_id)
          if (p) await supabase.from('productos_salon')
            .update({ stock: Math.max(0, p.stock - l.cantidad) }).eq('id', l.producto_id)
        }
      }
      showToast('Cobro registrado ✓')
      setModalCita(null)
      cargar()
    } catch (err) {
      console.error('[SalonCaja]', err)
      showToast('Error al registrar cobro', false)
    }
    setSaving(false)
  }

  async function handleEgreso(e) {
    e.preventDefault()
    if (!eMontoVal || !eConcepto.trim()) return
    setSavingEg(true)
    try {
      const hoy = new Date().toISOString().slice(0,10)
      const { error } = await supabase.from('gastos').insert({
        tenant_id: tenant.id, fecha: hoy,
        monto: parseFloat(eMontoVal), concepto: eConcepto.trim(), categoria: eCat,
      })
      if (error) throw error
      showToast('Egreso registrado ✓')
      setModalEgreso(false); setEMontoVal(''); setEConcepto(''); setECat('Otros')
      cargar()
    } catch (err) {
      showToast('Error: ' + err.message, false)
    }
    setSavingEg(false)
  }

  const histFiltrado = useMemo(() => {
    if (!busqueda.trim()) return historial
    const q = busqueda.toLowerCase()
    return historial.filter(c =>
      (c.clientes_agenda?.nombre||'').toLowerCase().includes(q) ||
      (c.servicios?.nombre||'').toLowerCase().includes(q) ||
      (c.pago.metodo||'').toLowerCase().includes(q)
    )
  }, [historial, busqueda])

  const saldo = totalCobrado - totalEgresos

  return (
    <div style={{ padding:'0 16px 16px' }}>
      {toast && (
        <div style={{
          position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', zIndex:200,
          background: toast.ok ? '#22c55e' : '#ef4444',
          color:'#fff', padding:'12px 20px', borderRadius:14, fontSize:14, fontWeight:600,
          boxShadow:'0 4px 20px rgba(0,0,0,0.2)', whiteSpace:'nowrap',
        }}>{toast.msg}</div>
      )}

      {/* Selector período */}
      <div style={{ display:'flex', gap:8, marginBottom: periodo === 'rango' ? 10 : 16 }}>
        {PERIODOS.map(p => (
          <button key={p.key} onClick={() => setPeriodo(p.key)} style={{
            flex:1, padding:'10px 0', borderRadius:12, cursor:'pointer', border:'none',
            background: periodo === p.key ? col : 'var(--card)',
            color: periodo === p.key ? '#fff' : 'var(--text-2)',
            fontWeight:700, fontSize:13,
          }}>{p.label}</button>
        ))}
      </div>
      {periodo === 'rango' && (
        <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center' }}>
          <input type="date" value={rangoDesde} onChange={e => setRangoDesde(e.target.value)}
            className="sp-input" style={{ flex:1, fontSize:13, padding:'9px 12px' }} />
          <span style={{ color:'var(--text-3)', fontSize:13, flexShrink:0 }}>→</span>
          <input type="date" value={rangoHasta} onChange={e => setRangoHasta(e.target.value)}
            className="sp-input" style={{ flex:1, fontSize:13, padding:'9px 12px' }} />
        </div>
      )}

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[1,2,3].map(i => <div key={i} className="sp-skeleton" style={{ height:80, borderRadius:16 }} />)}
        </div>
      ) : (
        <>
          {/* KPI grid 2×2 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            {/* Ingresos — ancho completo */}
            <div className="sp-kpi-card" style={{
              gridColumn:'1 / -1', flexDirection:'row', alignItems:'center', justifyContent:'space-between',
              background:`linear-gradient(135deg, ${col}28 0%, ${col}08 100%)`,
              boxShadow:`0 4px 24px ${col}18`,
            }}>
              <div>
                <div className="sp-kpi-val" style={{ color:col, fontSize:30 }}>{fmtCOP(totalCobrado)}</div>
                <div className="sp-kpi-lbl" style={{ color:col, opacity:0.7 }}>
                  Ingresos · {PERIODOS.find(p=>p.key===periodo)?.label}
                </div>
              </div>
              {historial.length > 0 && (
                <div style={{ display:'flex', gap:5, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
                  {periodo === 'hoy' && (
                    <button onClick={descargarCierre} style={{
                      padding:'8px 11px', borderRadius:10, border:'none', cursor:'pointer',
                      background:'rgba(99,102,241,0.12)', color:'#818cf8', fontWeight:700, fontSize:11,
                    }}>Z Cierre</button>
                  )}
                  <button onClick={descargarPDF} style={{
                    padding:'8px 11px', borderRadius:10, border:'none', cursor:'pointer',
                    background:`${col}20`, color:col, fontWeight:700, fontSize:12,
                  }}>↓ PDF</button>
                  <button onClick={descargarCSV} style={{
                    padding:'8px 11px', borderRadius:10, border:'none', cursor:'pointer',
                    background:'rgba(34,197,94,0.12)', color:'#4ade80', fontWeight:700, fontSize:12,
                  }}>↓ CSV</button>
                </div>
              )}
            </div>

            {/* Egresos */}
            <div className="sp-kpi-card" style={{ background:'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, transparent 100%)' }}>
              <div className="sp-kpi-val" style={{ color:'#f87171', fontSize:22 }}>{fmtCOP(totalEgresos)}</div>
              <div className="sp-kpi-lbl" style={{ color:'#f87171', opacity:0.8 }}>Egresos</div>
              <div className="sp-kpi-sub">{egresos.length} movimientos</div>
            </div>

            {/* Saldo */}
            <div className="sp-kpi-card" style={{
              background: saldo >= 0
                ? 'linear-gradient(135deg, rgba(34,197,94,0.13) 0%, transparent 100%)'
                : 'linear-gradient(135deg, rgba(239,68,68,0.10) 0%, transparent 100%)',
            }}>
              <div className="sp-kpi-val" style={{ color: saldo >= 0 ? '#4ade80' : '#f87171', fontSize:22 }}>
                {fmtCOP(Math.abs(saldo))}
              </div>
              <div className="sp-kpi-lbl" style={{ color: saldo >= 0 ? '#4ade80' : '#f87171', opacity:0.8 }}>
                {saldo >= 0 ? 'Saldo ✓' : 'Déficit ↓'}
              </div>
              <div className="sp-kpi-sub">{pendientes.length} por cobrar</div>
            </div>
          </div>

          {/* Gráfico semanal ingresos vs egresos */}
          {periodo === 'semana' && (historial.length > 0 || egresos.length > 0) && (() => {
            const hoy = new Date()
            const DIAS7 = ['D','L','M','X','J','V','S']
            const diasSem = Array.from({length:7}, (_,i) => {
              const d = new Date(hoy); d.setDate(hoy.getDate()-6+i)
              return d.toISOString().slice(0,10)
            })
            const ingPorDia = {}, egPorDia = {}
            historial.forEach(c => { const d=(c.pago.created_at||'').slice(0,10); ingPorDia[d]=(ingPorDia[d]||0)+Number(c.pago.monto) })
            egresos.forEach(g => { const d=(g.fecha||'').slice(0,10); egPorDia[d]=(egPorDia[d]||0)+Number(g.monto) })
            const maxVal = Math.max(...diasSem.map(d => Math.max(ingPorDia[d]||0, egPorDia[d]||0)), 1)
            const hoyIso = hoy.toISOString().slice(0,10)
            return (
              <div style={{ padding:'14px 16px', borderRadius:16, background:'var(--card)',
                marginBottom:14, boxShadow:'0 2px 12px rgba(0,0,0,0.08)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, textTransform:'uppercase' }}>Esta semana</span>
                  <div style={{ display:'flex', gap:10, fontSize:10, color:'var(--text-3)' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background:col }} />Ingresos
                    </span>
                    <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background:'#f87171' }} />Egresos
                    </span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:4, alignItems:'flex-end', height:80 }}>
                  {diasSem.map(d => {
                    const ing = ingPorDia[d] || 0
                    const eg  = egPorDia[d]  || 0
                    const hIng = Math.max(ing>0?4:0, Math.round((ing/maxVal)*70))
                    const hEg  = Math.max(eg>0?4:0,  Math.round((eg/maxVal)*70))
                    const esHoy = d === hoyIso
                    const fecha = new Date(d+'T12:00:00')
                    return (
                      <div key={d} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                        <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end', height:70 }}>
                          <div style={{ flex:1, height:hIng, background:col, borderRadius:'3px 3px 0 0', opacity:esHoy?1:0.5 }} />
                          <div style={{ flex:1, height:hEg, background:'#f87171', borderRadius:'3px 3px 0 0', opacity:esHoy?0.9:0.4 }} />
                        </div>
                        <div style={{ fontSize:9, fontWeight:700, color:esHoy?col:'var(--text-3)' }}>
                          {DIAS7[fecha.getDay()]}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Breakdown métodos */}
          {historial.length > 0 && (() => {
            const porM = {}
            historial.forEach(c => { porM[c.pago.metodo] = (porM[c.pago.metodo]||0) + Number(c.pago.monto) })
            return (
              <div style={{ display:'flex', gap:6, overflowX:'auto', overflowY:'clip', marginBottom:14, paddingBottom:2 }}>
                {Object.entries(porM).map(([m, total]) => (
                  <div key={m} style={{
                    flexShrink:0, padding:'9px 13px', borderRadius:12,
                    background:`linear-gradient(135deg, ${METODO_COLORS[m]||col}18, ${METODO_COLORS[m]||col}06)`,
                    minWidth:90,
                  }}>
                    <div style={{ fontSize:9, fontWeight:700, color:METODO_COLORS[m]||col, textTransform:'uppercase', letterSpacing:0.6, marginBottom:3 }}>
                      {m}
                    </div>
                    <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:15, color:'var(--text)' }}>
                      {fmtCOP(total)}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Tabs */}
          <div style={{ display:'flex', gap:4, marginBottom:14,
            background:'var(--card)', borderRadius:14, padding:4, boxShadow:'0 1px 8px rgba(0,0,0,0.1)' }}>
            {[
              { key:'cobrar',    label:`Por cobrar${pendientes.length > 0 ? ` (${pendientes.length})` : ''}` },
              { key:'historial', label:`Cobrado (${historial.length})` },
              { key:'egresos',   label:`Egresos (${egresos.length})` },
            ].map(t => (
              <button key={t.key} onClick={() => setVista(t.key)} style={{
                flex:1, padding:'9px 4px', borderRadius:10, cursor:'pointer', border:'none',
                background: vista === t.key ? col : 'transparent',
                color: vista === t.key ? '#fff' : 'var(--text-3)',
                fontWeight:700, fontSize:12, transition:'all 0.15s',
              }}>{t.label}</button>
            ))}
          </div>

          {/* ── Tab: Por cobrar ── */}
          {vista === 'cobrar' && (
            pendientes.length === 0 ? (
              <div className="sp-empty">
                <span className="sp-empty-icon">✅</span>
                <p className="sp-empty-title">Todo al día</p>
                <p className="sp-empty-sub">No hay servicios pendientes de cobro</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {pendientes.map(c => (
                  <div key={c.id} className="sp-tbl-row" style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:'#f59e0b', boxShadow:'0 0 6px rgba(245,158,11,0.5)' }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {c.clientes_agenda?.nombre || '—'}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                        {c.servicios?.nombre || '—'}
                        {c.profesionales?.nombre ? ` · ${c.profesionales.nombre.split(' ')[0]}` : ''}
                        {' · '}{fmtFecha(c.fecha_inicio)} {fmtHora(c.fecha_inicio)}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                      {c.servicios?.precio > 0 && (
                        <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:13, color:'var(--text-2)' }}>
                          {fmtCOPFull(c.servicios.precio)}
                        </span>
                      )}
                      <button onClick={() => abrirModal(c)} style={{
                        padding:'7px 14px', borderRadius:10, border:'none', cursor:'pointer',
                        background:col, color:'#fff', fontWeight:700, fontSize:12,
                      }}>Cobrar</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ── Tab: Historial cobros ── */}
          {vista === 'historial' && (
            <>
              {/* Buscador */}
              <div style={{ position:'relative', marginBottom:12 }}>
                <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)', pointerEvents:'none' }}>
                  <Ico d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={16} />
                </span>
                <input
                  type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar cliente, servicio, método…"
                  style={{ width:'100%', padding:'10px 12px 10px 36px', borderRadius:12,
                    border:'1px solid var(--border)', background:'var(--card)',
                    color:'var(--text)', fontSize:13, outline:'none', boxSizing:'border-box' }}
                />
                {busqueda && (
                  <button onClick={() => setBusqueda('')} style={{
                    position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                    border:'none', background:'none', cursor:'pointer', color:'var(--text-3)', fontSize:18, lineHeight:1,
                  }}>×</button>
                )}
              </div>

              {histFiltrado.length === 0 ? (
                <div className="sp-empty">
                  <span className="sp-empty-icon">💰</span>
                  <p className="sp-empty-title">{busqueda ? 'Sin resultados' : 'Sin cobros'}</p>
                  <p className="sp-empty-sub">{busqueda ? 'Intenta con otro término' : 'No hay pagos registrados en este período'}</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {histFiltrado.slice(0, paginaHist).map((c) => (
                    <div key={c.id} className="sp-tbl-row">
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                          background: c.pago.notas ? '#ef4444' : '#22c55e',
                          boxShadow:`0 0 6px ${c.pago.notas ? 'rgba(239,68,68,0.45)' : 'rgba(34,197,94,0.45)'}` }} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {c.clientes_agenda?.nombre || '—'}
                          </div>
                          <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                            {c.servicios?.nombre || '—'}
                            {c.profesionales?.nombre ? ` · ${c.profesionales.nombre.split(' ')[0]}` : ''}
                            {' · '}
                            <span style={{ color:METODO_COLORS[c.pago.metodo]||col, fontWeight:700 }}>{METODO_LABELS[c.pago.metodo] || c.pago.metodo}</span>
                            {' · '}{fmtFecha(c.pago.created_at)} {fmtHora(c.pago.created_at)}
                          </div>
                          {c.pago.referencia && (
                            <div style={{ fontSize:10, color:'var(--text-3)', fontStyle:'italic', marginTop:1 }}>Ref: {c.pago.referencia}</div>
                          )}
                          {c.pago.notas && (
                            <div style={{ fontSize:10, color:'#f87171', marginTop:1 }}>⚠ Anulado: {c.pago.notas}</div>
                          )}
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
                          <span style={{ fontFamily:'Outfit', fontWeight:800, fontSize:15,
                            color: c.pago.notas ? '#71717a' : '#22c55e',
                            textDecoration: c.pago.notas ? 'line-through' : 'none' }}>
                            {fmtCOPFull(c.pago.monto)}
                          </span>
                          {!c.pago.notas && confirmAnular?.id !== c.pago.id && (
                            <button onClick={() => { setConfirmAnular(c.pago); setAnulNota('') }} style={{
                              background:'none', border:'none', cursor:'pointer', color:'var(--text-3)',
                              fontSize:11, fontWeight:600, padding:'2px 4px', borderRadius:6,
                            }}>Anular</button>
                          )}
                        </div>
                      </div>
                      {confirmAnular?.id === c.pago.id && (
                        <div style={{ marginTop:10, paddingLeft:18, display:'flex', flexDirection:'column', gap:7 }}>
                          <input className="sp-input"
                            placeholder="Motivo de anulación (opcional)"
                            value={anulNota} onChange={e => setAnulNota(e.target.value)}
                            style={{ fontSize:12, padding:'8px 12px' }} autoFocus
                          />
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => anularPago(c.pago)} style={{
                              flex:1, padding:'8px', borderRadius:9, border:'none', cursor:'pointer',
                              background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', fontWeight:700, fontSize:12,
                            }}>Confirmar anulación</button>
                            <button onClick={() => { setConfirmAnular(null); setAnulNota('') }} style={{
                              padding:'8px 14px', borderRadius:9, border:'none', cursor:'pointer',
                              background:'var(--card)', color:'var(--text-3)', fontWeight:700, fontSize:12,
                              boxShadow:'0 1px 4px rgba(0,0,0,0.1)',
                            }}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {histFiltrado.length > paginaHist && (
                    <button onClick={() => setPaginaHist(p => p + 20)} style={{
                      width:'100%', padding:'12px', borderRadius:14, border:'none',
                      background:`${col}10`, color:col, fontWeight:700, fontSize:13, cursor:'pointer', marginTop:6,
                    }}>
                      Ver {Math.min(histFiltrado.length - paginaHist, 20)} más · {histFiltrado.length - paginaHist} restantes
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Tab: Egresos ── */}
          {vista === 'egresos' && (
            <>
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                <button onClick={() => setModalEgreso(true)} style={{
                  flex:1, padding:'12px', borderRadius:14, border:`1.5px dashed #ef444450`,
                  background:'rgba(239,68,68,0.05)', color:'#f87171', fontWeight:700, fontSize:13,
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                }}>
                  <Ico d="M20 12H4M12 4v16" size={16} /> Registrar egreso
                </button>
                {egresos.length > 0 && (
                  <button onClick={descargarEgresosCSV} style={{
                    padding:'12px 14px', borderRadius:14, border:'none', cursor:'pointer',
                    background:'rgba(34,197,94,0.12)', color:'#4ade80', fontWeight:700, fontSize:12, flexShrink:0,
                  }}>↓ CSV</button>
                )}
              </div>

              {egresos.length === 0 ? (
                <div className="sp-empty">
                  <span className="sp-empty-icon">📋</span>
                  <p className="sp-empty-title">Sin egresos</p>
                  <p className="sp-empty-sub">No hay gastos registrados en este período</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {egresos.map(g => (
                    <div key={g.id} className="sp-tbl-row" style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:'#f87171', boxShadow:'0 0 6px rgba(239,68,68,0.4)' }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {g.concepto || '—'}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                          {g.categoria}
                          {g.proveedores?.nombre ? ` · ${g.proveedores.nombre}` : ''}
                          {' · '}{fmtFecha(g.fecha)}
                        </div>
                      </div>
                      <span style={{ fontFamily:'Outfit', fontWeight:800, fontSize:15, color:'#f87171', flexShrink:0 }}>
                        -{fmtCOPFull(g.monto)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Modal: Cobrar cita ── */}
      {modalCita && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'flex-end',
          background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalCita(null) }}>
          <div style={{ width:'100%', maxWidth:480, margin:'0 auto',
            background:'var(--bg)', borderRadius:'24px 24px 0 0',
            padding:'20px 20px 32px', maxHeight:'90dvh', overflowY:'auto' }}>
            <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', margin:'0 auto 20px' }} />
            <h3 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:18, color:'var(--text)', marginBottom:4 }}>Registrar cobro</h3>
            <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:20 }}>
              {modalCita.clientes_agenda?.nombre} · {modalCita.servicios?.nombre}
            </p>
            <form onSubmit={handleCobrar} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', letterSpacing:0.5, display:'block', marginBottom:8 }}>MONTO</label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)', fontWeight:700, fontSize:14, pointerEvents:'none' }}>$</span>
                  <input type="number" min="0" step="100" required value={monto}
                    onChange={e => setMonto(e.target.value)}
                    className="sp-input" style={{ paddingLeft:28 }} placeholder="0" autoFocus />
                </div>
              </div>
              {/* ── Productos (opcional) ── */}
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', letterSpacing:0.5 }}>
                    PRODUCTOS <span style={{ fontWeight:400 }}>(opcional)</span>
                  </label>
                  <button type="button" onClick={() => setShowProdPick(true)} style={{
                    fontSize:12, fontWeight:700, padding:'5px 12px', borderRadius:8,
                    background:`${col}18`, color:col, border:'none', cursor:'pointer',
                  }}>+ Agregar</button>
                </div>
                {lineas.map((l, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.nombre}</div>
                      <div style={{ fontSize:11, color:'var(--text-3)' }}>${l.precio_unitario.toLocaleString('es-CO')} c/u</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                      <button type="button" onClick={() => {
                        if (l.cantidad <= 1) setLineas(p => p.filter((_,j) => j !== i))
                        else setLineas(p => p.map((x,j) => j===i ? {...x, cantidad:x.cantidad-1} : x))
                      }} style={{ width:24,height:24,borderRadius:5,border:'none',background:'var(--card)',color:'var(--text)',cursor:'pointer',fontWeight:800,fontSize:15,display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
                      <span style={{ fontSize:13,fontWeight:700,color:'var(--text)',minWidth:18,textAlign:'center' }}>{l.cantidad}</span>
                      <button type="button" onClick={() => setLineas(p => p.map((x,j) => j===i ? {...x, cantidad:x.cantidad+1} : x))}
                        style={{ width:24,height:24,borderRadius:5,border:'none',background:'var(--card)',color:'var(--text)',cursor:'pointer',fontWeight:800,fontSize:15,display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
                    </div>
                    <span style={{ fontSize:13,fontWeight:700,color:col,minWidth:60,textAlign:'right' }}>
                      ${(l.cantidad*l.precio_unitario).toLocaleString('es-CO')}
                    </span>
                  </div>
                ))}
              </div>

              {/* ── Propina ── */}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', letterSpacing:0.5, display:'block', marginBottom:8 }}>
                  PROPINA <span style={{ fontWeight:400 }}>(opcional)</span>
                </label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)', fontWeight:700, fontSize:14, pointerEvents:'none' }}>$</span>
                  <input type="number" min="0" step="1000" value={propina}
                    onChange={e => setPropina(e.target.value)}
                    className="sp-input" style={{ paddingLeft:28 }} placeholder="0" />
                </div>
              </div>

              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', letterSpacing:0.5, display:'block', marginBottom:8 }}>MÉTODO DE PAGO</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {METODOS.map(m => (
                    <button key={m.key} type="button" onClick={() => setMetodo(m.key)} style={{
                      padding:'9px 14px', borderRadius:12, cursor:'pointer',
                      border:`2px solid ${metodo === m.key ? col : 'var(--border)'}`,
                      background: metodo === m.key ? `${col}15` : 'var(--card)',
                      color: metodo === m.key ? col : 'var(--text-2)',
                      fontWeight:700, fontSize:13, transition:'all 0.15s',
                    }}>{m.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', letterSpacing:0.5, display:'block', marginBottom:8 }}>
                  REFERENCIA <span style={{ fontWeight:400 }}>(opcional)</span>
                </label>
                <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)}
                  className="sp-input" placeholder="Nro. de transacción, voucher…" />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', letterSpacing:0.5, display:'block', marginBottom:8 }}>
                  DESCUENTO <span style={{ fontWeight:400 }}>(opcional)</span>
                </label>
                <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                  {[['descuento','Descuento $'],['cortesia','Cortesía']].map(([t, label]) => (
                    <button key={t} type="button" onClick={() => { setTipoDesc(tipoDesc === t ? null : t); setDescuento('') }} style={{
                      flex:1, padding:'8px', borderRadius:10, cursor:'pointer',
                      border:`1.5px solid ${tipoDesc === t ? col : 'var(--border)'}`,
                      background: tipoDesc === t ? `${col}15` : 'var(--card)',
                      color: tipoDesc === t ? col : 'var(--text-2)',
                      fontWeight:700, fontSize:12, transition:'all 0.15s',
                    }}>{label}</button>
                  ))}
                </div>
                {tipoDesc === 'descuento' && (
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)', fontWeight:700, fontSize:14, pointerEvents:'none' }}>$</span>
                    <input type="number" min="0" max={Number(monto||0)} step="100" value={descuento}
                      onChange={e => setDescuento(e.target.value)}
                      className="sp-input" style={{ paddingLeft:28 }} placeholder="Monto a descontar" />
                  </div>
                )}
                {tipoDesc === 'cortesia' && (
                  <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', fontSize:12, color:'#fbbf24', fontWeight:600 }}>
                    Se registra como $0 — cliente no paga
                  </div>
                )}
              </div>
              {(() => {
                const _svc   = tipoDesc === 'cortesia' ? 0 : Math.max(0, (parseFloat(monto)||0) - (tipoDesc === 'descuento' ? (parseFloat(descuento)||0) : 0))
                const _prods = lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0)
                const _prop  = parseFloat(propina) || 0
                const _total = _svc + _prods + _prop
                return (
                  <>
                    {(tipoDesc || lineas.length > 0 || _prop > 0) && (
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                        padding:'12px 16px', borderRadius:12, background:`${col}10`, border:`1px solid ${col}20` }}>
                        <span style={{ fontSize:13, color:'var(--text-3)', fontWeight:600 }}>Total a cobrar</span>
                        <span style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:col }}>{fmtCOPFull(_total)}</span>
                      </div>
                    )}
                    <button type="submit" disabled={saving || !monto} style={{
                      marginTop:4, padding:'16px', borderRadius:16, border:'none', cursor:'pointer',
                      background: saving || !monto ? 'var(--border)' : col,
                      color: saving || !monto ? 'var(--text-3)' : '#fff',
                      fontFamily:'Outfit', fontWeight:800, fontSize:16, transition:'all 0.2s',
                    }}>
                      {saving ? 'Guardando…' : `Cobrar ${fmtCOPFull(_total)}`}
                    </button>
                  </>
                )
              })()}
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Egreso rápido ── */}
      {modalEgreso && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'flex-end',
          background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalEgreso(false) }}>
          <div style={{ width:'100%', maxWidth:480, margin:'0 auto',
            background:'var(--bg)', borderRadius:'24px 24px 0 0',
            padding:'20px 20px 32px', maxHeight:'90dvh', overflowY:'auto' }}>
            <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', margin:'0 auto 20px' }} />
            <h3 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:18, color:'var(--text)', marginBottom:20 }}>Registrar egreso</h3>
            <form onSubmit={handleEgreso} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', letterSpacing:0.5, display:'block', marginBottom:8 }}>MONTO</label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)', fontWeight:700, fontSize:14, pointerEvents:'none' }}>$</span>
                  <input type="number" min="0" step="100" required value={eMontoVal}
                    onChange={e => setEMontoVal(e.target.value)}
                    className="sp-input" style={{ paddingLeft:28 }} placeholder="0" autoFocus />
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', letterSpacing:0.5, display:'block', marginBottom:8 }}>CONCEPTO</label>
                <input type="text" required value={eConcepto} onChange={e => setEConcepto(e.target.value)}
                  className="sp-input" placeholder="Ej: Compra de insumos, arriendo…" />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', letterSpacing:0.5, display:'block', marginBottom:8 }}>CATEGORÍA</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {CATS_GASTO.map(c => (
                    <button key={c} type="button" onClick={() => setECat(c)} style={{
                      padding:'7px 12px', borderRadius:10, cursor:'pointer',
                      border:`1.5px solid ${eCat === c ? '#ef4444' : 'var(--border)'}`,
                      background: eCat === c ? 'rgba(239,68,68,0.10)' : 'var(--card)',
                      color: eCat === c ? '#f87171' : 'var(--text-2)',
                      fontWeight:700, fontSize:12,
                    }}>{c}</button>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button type="button" onClick={() => setModalEgreso(false)} style={{
                  flex:1, padding:'14px', borderRadius:14, border:'none', cursor:'pointer',
                  background:'var(--card)', color:'var(--text-2)', fontWeight:700, fontSize:14,
                }}>Cancelar</button>
                <button type="submit" disabled={savingEg || !eMontoVal || !eConcepto.trim()} style={{
                  flex:2, padding:'14px', borderRadius:14, border:'none', cursor:'pointer',
                  background: savingEg ? 'var(--border)' : '#ef4444',
                  color: savingEg ? 'var(--text-3)' : '#fff',
                  fontFamily:'Outfit', fontWeight:800, fontSize:15,
                }}>
                  {savingEg ? 'Guardando…' : `Registrar -${fmtCOPFull(Number(eMontoVal||0))}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Picker de productos ── */}
      {showProdPick && (
        <div style={{ position:'fixed', inset:0, zIndex:150, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowProdPick(false); setBusqProd('') } }}>
          <div style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'var(--bg)', borderRadius:'24px 24px 0 0', padding:'20px 20px 32px', maxHeight:'70dvh', overflowY:'auto' }}>
            <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', margin:'0 auto 16px' }} />
            <input
              value={busqProd} onChange={e => setBusqProd(e.target.value)}
              placeholder="Buscar producto…" autoFocus
              style={{ width:'100%', padding:'10px 14px', borderRadius:12, border:'1px solid var(--border)',
                background:'var(--card)', color:'var(--text)', fontSize:13, outline:'none', boxSizing:'border-box', marginBottom:12 }}
            />
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {(busqProd
                ? prodsDisp.filter(p => p.nombre.toLowerCase().includes(busqProd.toLowerCase()))
                : prodsDisp
              ).map(p => (
                <button key={p.id} type="button" onClick={() => {
                  const idx = lineas.findIndex(l => l.producto_id === p.id)
                  if (idx >= 0) setLineas(prev => prev.map((l, i) => i === idx ? {...l, cantidad: l.cantidad + 1} : l))
                  else setLineas(prev => [...prev, { producto_id: p.id, nombre: p.nombre, cantidad: 1, precio_unitario: p.precio_venta || 0 }])
                  setShowProdPick(false); setBusqProd('')
                }} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'12px 14px', borderRadius:12, border:'none', cursor:'pointer',
                  background:'var(--card)', textAlign:'left', gap:10,
                }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.nombre}</div>
                    <div style={{ fontSize:11, color:'var(--text-3)' }}>{p.categoria || ''} · Stock: {p.stock}</div>
                  </div>
                  <span style={{ fontFamily:'Outfit', fontWeight:800, fontSize:14, color:col, flexShrink:0 }}>
                    ${(p.precio_venta || 0).toLocaleString('es-CO')}
                  </span>
                </button>
              ))}
              {prodsDisp.length === 0 && (
                <p style={{ textAlign:'center', color:'var(--text-3)', fontSize:13, padding:20 }}>Sin productos con stock disponible</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
