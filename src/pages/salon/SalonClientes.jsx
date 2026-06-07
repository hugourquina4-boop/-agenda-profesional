import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'
import SalonNuevaCita from './SalonNuevaCita'
import TiqueteraCard from '../../components/TiqueteraCard'

function Ico({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const COLORS = ['#f43f5e','#a855f7','#3b82f6','#22c55e','#f59e0b','#06b6d4','#ec4899']

const SEGMENTO = {
  vip:        { label:'VIP',        color:'#f59e0b', bg:'rgba(245,158,11,0.14)'  },
  recurrente: { label:'Recurrente', color:'#22c55e', bg:'rgba(34,197,94,0.12)'   },
  en_riesgo:  { label:'En riesgo',  color:'#f43f5e', bg:'rgba(244,63,94,0.12)'   },
  inactivo:   { label:'Inactivo',   color:'#94a3b8', bg:'rgba(148,163,184,0.12)' },
  nuevo:      { label:'Nuevo',      color:'#3b82f6', bg:'rgba(59,130,246,0.12)'  },
}

const TIER = {
  oro:    { label:'Oro',    color:'#f59e0b', emoji:'🥇' },
  plata:  { label:'Plata',  color:'#9ca3af', emoji:'🥈' },
  bronce: { label:'Bronce', color:'#cd7f32', emoji:'🥉' },
}

const TAGS_OPCIONES = [
  { key:'star',     label:'STAR',    icon:'⭐', color:'#f59e0b' },
  { key:'vip',      label:'VIP',     icon:'💎', color:'#a855f7' },
  { key:'referido', label:'Refiere', icon:'🤝', color:'#22c55e' },
  { key:'dificil',  label:'Difícil', icon:'⚠️', color:'#ef4444' },
]

const FILTROS = [
  { key:'todos',      label:'Todos'      },
  { key:'vip',        label:'VIP'        },
  { key:'recurrente', label:'Recurrentes'},
  { key:'en_riesgo',  label:'En riesgo'  },
  { key:'inactivo',   label:'Inactivos'  },
  { key:'nuevo',      label:'Nuevos'     },
]

function SegBadge({ segmento }) {
  const cfg = SEGMENTO[segmento]
  if (!cfg) return null
  return (
    <span style={{
      padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:700,
      background: cfg.bg, color: cfg.color, whiteSpace:'nowrap', flexShrink:0,
    }}>
      {cfg.label}
    </span>
  )
}

function cumpleProximo(fechaNac) {
  if (!fechaNac) return false
  const hoy = new Date()
  const cumple = new Date(fechaNac + 'T12:00:00')
  const esteAnio = new Date(hoy.getFullYear(), cumple.getMonth(), cumple.getDate())
  const diff = (esteAnio - hoy) / 86400000
  return diff >= 0 && diff <= 7
}

function fmtCOP(n) {
  if (!n || n <= 0) return '—'
  return '$' + Number(n).toLocaleString('es-CO')
}

const FORM_VACIO = { nombre:'', telefono:'', email:'', fecha_nacimiento:'', servicios_interes:'', notas:'', tipo_precio:'normal', fuente_captacion:'', barrio:'' }

export default function SalonClientes() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [clientes,   setClientes]  = useState([])
  const [busq,       setBusq]      = useState('')
  const [loading,    setLoading]   = useState(true)
  const [filtroSeg,  setFiltroSeg] = useState('todos')
  const [filtroTag,  setFiltroTag] = useState(null) // key de TAGS_OPCIONES o null
  const [sel,        setSel]       = useState(null)
  const [saldo,      setSaldo]     = useState(null)
  const [historial,  setHistorial] = useState([])
  const [loadHist,   setLoadHist]  = useState(false)
  const [elimTarget,  setElimTarget]  = useState(null)
  const [toast,       setToast]       = useState(null)
  const [showNuevo,   setShowNuevo]   = useState(false)
  const [nuevoForm,   setNuevoForm]   = useState(FORM_VACIO)
  const [guardando,   setGuardando]   = useState(false)
  const [nuevoTab,    setNuevoTab]    = useState('contacto')
  const [editNotas,   setEditNotas]   = useState(false)
  const [notasEdit,   setNotasEdit]   = useState('')
  const [guardandoN,  setGuardandoN]  = useState(false)
  const [tabCliente,  setTabCliente]  = useState('historial')
  const [fotos,       setFotos]       = useState([])
  const [loadFotos,   setLoadFotos]   = useState(false)

  // Fidelidad
  const [puntos,       setPuntos]       = useState([])
  const [loadPuntos,   setLoadPuntos]   = useState(false)
  const [puntosForm,   setPuntosForm]   = useState({ tipo:'ganados', puntos:'', motivo:'' })
  const [savingPts,    setSavingPts]    = useState(false)

  // Próxima cita
  const [proximaCita,   setProximaCita]   = useState(null)

  // Agendar desde ficha
  const [showAgendarCita, setShowAgendarCita] = useState(false)

  // Préstamos
  const [prestamos,     setPrestamos]     = useState([])
  const [loadPrest,     setLoadPrest]     = useState(false)
  const [sheetPrest,    setSheetPrest]    = useState(false)
  const [formPrest,     setFormPrest]     = useState({ tipo:'prestamo', monto:'', concepto:'', fecha: new Date().toISOString().slice(0,10) })
  const [savingPrest,   setSavingPrest]   = useState(false)

  // Paquetes prepagados
  const [paquetesCli,   setPaquetesCli]   = useState([])
  const [loadPaq,       setLoadPaq]       = useState(false)
  const [sheetPaq,      setSheetPaq]      = useState(false)
  const [formPaq,       setFormPaq]       = useState({ nombre:'', servicio_id:'', sesiones_total:'4', precio_total:'', vencimiento:'', notas:'' })
  const [savingPaq,     setSavingPaq]     = useState(false)
  const [serviciosList, setServiciosList] = useState([])
  const [subiendoFoto,setSubiendoFoto]= useState(false)
  const [tipoFoto,    setTipoFoto]    = useState('resultado')
  const fotoInputRef  = useRef(null)

  // Tiquetera virtual
  const [tiqueteraData, setTiqueteraData] = useState(null)
  const [loadTiquetera, setLoadTiquetera] = useState(false)
  const [canjeando,     setCanjeando]     = useState(false)

  // Consentimiento digital
  const [consentData,    setConsentData]    = useState(null)
  const [loadConsent,    setLoadConsent]    = useState(false)
  const [consentModal,   setConsentModal]   = useState(false)
  const [consentNombre,  setConsentNombre]  = useState('')
  const [consentTipo,    setConsentTipo]    = useState('servicio')
  const [savingConsent,  setSavingConsent]  = useState(false)
  const csvInputRef   = useRef(null)

  const [importModal,   setImportModal]   = useState(false)
  const [importData,    setImportData]    = useState([])
  const [importando,    setImportando]    = useState(false)

  const [hayMas,        setHayMas]        = useState(false)
  const [cargandoMas,   setCargandoMas]   = useState(false)
  const offsetRef = useRef(0)
  const PAGE_SIZE = 50

  function parseCSVRow(line) {
    const result = []; let cur = ''; let inQ = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (line[i] === ',' && !inQ) { result.push(cur); cur = '' }
      else cur += line[i]
    }
    result.push(cur)
    return result
  }

  function handleCSVFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target.result.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { showToast('El archivo no tiene datos', false); return }
      const rawHeaders = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g,'_'))
      const rows = lines.slice(1).map(line => {
        const vals = parseCSVRow(line)
        const obj = {}
        rawHeaders.forEach((h, i) => { obj[h] = vals[i]?.trim() || '' })
        return obj
      }).filter(r => r.nombre?.trim())
      if (!rows.length) { showToast('No se encontraron filas con nombre', false); return }
      setImportData(rows)
      setImportModal(true)
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function importarClientes() {
    if (!importData.length) return
    setImportando(true)
    const rows = importData.map(r => ({
      tenant_id:         tenant.id,
      nombre:            r.nombre?.trim(),
      telefono:          r.telefono?.trim()          || null,
      email:             r.email?.trim()             || null,
      fecha_nacimiento:  r.fecha_nacimiento?.match(/^\d{4}-\d{2}-\d{2}$/) ? r.fecha_nacimiento : null,
      servicios_interes: r.servicios_interes?.trim() || null,
      notas:             r.notas?.trim()             || null,
      segmento:          'nuevo',
      num_visitas:       0,
      total_gastado:     0,
      puntos_fidelizacion: 0,
    }))
    const { error } = await supabase.from('clientes_agenda').insert(rows)
    setImportando(false)
    if (error) { showToast('Error al importar: ' + error.message, false); return }
    showToast(`${rows.length} clientes importados ✓`)
    setImportModal(false)
    setImportData([])
    cargar()
  }

  function exportarCSV() {
    const cols = ['nombre','telefono','email','fecha_nacimiento','segmento','num_visitas','total_gastado','ticket_promedio','ultima_visita','servicios_interes','notas']
    const header = cols.join(',')
    const rows = clientesFiltrados.map(c =>
      cols.map(k => {
        const v = c[k] ?? ''
        const s = String(v).replace(/"/g, '""')
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
      }).join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type:'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clientes-${tenant?.slug || 'salon'}-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportarHistorialPDF() {
    if (!sel || historial.length === 0) return
    const { default: jsPDF } = await import('jspdf')
    const { drawHeader, drawFooter, drawPageHeader, hex2rgb } = await import('../../lib/pdfBrand')
    const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' })
    const [r,g,b] = hex2rgb(col)
    const ESTADO_ES = { completada:'Completada', confirmada:'Confirmada', pendiente:'Pendiente', cancelada:'Cancelada', no_asistio:'No asistió' }

    let y = drawHeader(doc, { tenant, titulo:'Historial de Cliente', subtitulo: sel.nombre })
    let pagina = 1

    // ── Ficha del cliente ─────────────────────────────────────────────────
    doc.setFillColor(248,249,250); doc.roundedRect(10,y,190,24,3,3,'F')
    doc.setFillColor(r,g,b);       doc.roundedRect(10,y,4,24,2,2,'F')
    doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(18,18,18)
    doc.text(sel.nombre, 20, y+8)
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80)
    const ficha = [
      sel.telefono && `Tel: ${sel.telefono}`,
      sel.email    && `Email: ${sel.email}`,
      sel.cumpleanos && `Cumpleaños: ${sel.cumpleanos}`,
    ].filter(Boolean).join('   ·   ')
    if (ficha) doc.text(ficha, 20, y+15)
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(r,g,b)
    const totalHist = historial.reduce((s,c) => s+(Number(c.precio_cobrado)||0), 0)
    doc.text(`${sel.num_visitas||historial.length} visitas  ·  $${totalHist.toLocaleString('es-CO')} total`, 20, y+22)
    y += 32

    // ── Tabla historial ────────────────────────────────────────────────────
    doc.setFillColor(r,g,b); doc.rect(10,y,190,7,'F')
    doc.setTextColor(255,255,255); doc.setFontSize(7.5); doc.setFont('helvetica','bold')
    doc.text('FECHA',14,y+5); doc.text('SERVICIO',46,y+5)
    doc.text('PROFESIONAL',114,y+5); doc.text('ESTADO',152,y+5); doc.text('COBRADO',192,y+5,{align:'right'})
    y+=9; doc.setFont('helvetica','normal')

    historial.forEach((c,i) => {
      if(y>272){ drawFooter(doc,{tenant,titulo:'Historial de Cliente',pagina}); doc.addPage(); pagina++; y=drawPageHeader(doc,{tenant,titulo:'Historial de Cliente',pagina}) }
      if(i%2===0){doc.setFillColor(248,249,250);doc.rect(10,y-4,190,8,'F')}
      const fecha = new Date(c.fecha_inicio).toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'2-digit'})
      doc.setFontSize(8); doc.setTextColor(50,50,50)
      doc.text(fecha,14,y)
      doc.text((c.servicios?.nombre||'—').slice(0,28),46,y)
      doc.text((c.profesionales?.nombre?.split(' ')[0]||'—').slice(0,16),114,y)
      const ec = c.estado==='completada'?[34,197,94]:c.estado==='cancelada'?[239,68,68]:[100,100,100]
      doc.setTextColor(...ec); doc.text(ESTADO_ES[c.estado]||c.estado,152,y)
      if(c.precio_cobrado>0){doc.setTextColor(34,197,94); doc.setFont('helvetica','bold'); doc.text(`$${Number(c.precio_cobrado).toLocaleString('es-CO')}`,198,y,{align:'right'}); doc.setFont('helvetica','normal')}
      y+=8
    })

    // Total final
    doc.setFillColor(r,g,b); doc.rect(10,y,190,9,'F')
    doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont('helvetica','bold')
    doc.text(`TOTAL HISTÓRICO`,14,y+6); doc.text(`$${totalHist.toLocaleString('es-CO')}`,198,y+6,{align:'right'})

    drawFooter(doc,{tenant,titulo:'Historial de Cliente',pagina})
    doc.save(`historial-${sel.nombre.replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.pdf`)
  }

  const cargar = useCallback(async (append = false) => {
    if (!tenant) { setLoading(false); return }
    if (!append) { setLoading(true); offsetRef.current = 0 }
    else setCargandoMas(true)

    const offset = offsetRef.current
    const q = supabase.from('clientes_agenda')
      .select('id, nombre, telefono, email, notas, servicios_interes, puntos_fidelizacion, fecha_nacimiento, created_at, num_visitas, total_gastado, ticket_promedio, ultima_visita, segmento, tipo_precio, tags, fuente_captacion, barrio, contador_noshow, bloqueado_noshow')
      .eq('tenant_id', tenant.id)
      .order('nombre')
      .range(offset, offset + PAGE_SIZE - 1)
    if (busq.trim()) {
      const s = busq.trim().replace(/[%_]/g, '\\$&')
      q.or(`nombre.ilike.%${s}%,telefono.ilike.%${s}%,email.ilike.%${s}%`)
    }
    const [res, resPrest] = await Promise.all([
      q,
      supabase.from('prestamos_cliente').select('cliente_id, tipo, monto').eq('tenant_id', tenant.id),
    ])
    if (res.error) {
      showToast('Error al cargar: ' + res.error.message, false)
      setLoading(false); setCargandoMas(false)
      return
    }
    const saldoMap = {}
    ;(resPrest.data || []).forEach(p => {
      saldoMap[p.cliente_id] = (saldoMap[p.cliente_id] || 0) + (p.tipo === 'prestamo' ? p.monto : -p.monto)
    })
    const merged = (res.data || []).map(c => ({ ...c, saldo_prestamos: saldoMap[c.id] || 0 }))
    setClientes(prev => append ? [...prev, ...merged] : merged)
    offsetRef.current = offset + merged.length
    setHayMas(merged.length === PAGE_SIZE)
    setLoading(false); setCargandoMas(false)
  }, [tenant, busq])

  useEffect(() => { cargar() }, [cargar])

  const clientesFiltrados = clientes
    .filter(c => filtroSeg === 'todos' || c.segmento === filtroSeg)
    .filter(c => !filtroTag || (c.tags || []).includes(filtroTag))

  const conteos = clientes.reduce((acc, c) => {
    acc[c.segmento || 'nuevo'] = (acc[c.segmento || 'nuevo'] || 0) + 1
    return acc
  }, {})

  function showToast(msg, ok = true) {
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

  async function guardarCliente() {
    if (!nuevoForm.nombre.trim()) { showToast('El nombre es requerido', false); return }
    setGuardando(true)
    const { error } = await supabase.from('clientes_agenda').insert({
      tenant_id:            tenant.id,
      nombre:               nuevoForm.nombre.trim(),
      telefono:             nuevoForm.telefono.trim() || null,
      email:                nuevoForm.email.trim() || null,
      fecha_nacimiento:     nuevoForm.fecha_nacimiento || null,
      servicios_interes:    nuevoForm.servicios_interes.trim() || null,
      notas:                nuevoForm.notas.trim() || null,
      segmento:             'nuevo',
      num_visitas:          0,
      total_gastado:        0,
      puntos_fidelizacion:  0,
      tipo_precio:          nuevoForm.tipo_precio || 'normal',
      fuente_captacion:     nuevoForm.fuente_captacion || null,
      barrio:               nuevoForm.barrio.trim() || null,
    })
    setGuardando(false)
    if (error) { showToast('Error al crear cliente', false); return }
    showToast('Cliente creado')
    setShowNuevo(false)
    setNuevoForm(FORM_VACIO)
    cargar()
  }

  async function eliminarCliente() {
    if (!elimTarget) return
    if (!await verificarAuth()) { setElimTarget(null); return }
    const id = elimTarget.id
    const tid = tenant.id
    await supabase.from('lista_espera').delete().eq('cliente_id', id).eq('tenant_id', tid)
    await supabase.from('saldo_puntos').delete().eq('cliente_id', id).eq('tenant_id', tid)
    await supabase.from('citas').delete().eq('cliente_id', id).eq('tenant_id', tid)
    const { error, count } = await supabase
      .from('clientes_agenda')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('tenant_id', tid)
    if (error) { showToast('Error: ' + error.message, false); return }
    if (!count || count === 0) {
      showToast('No se eliminó — sin permisos o sesión expirada', false)
      setElimTarget(null)
      return
    }
    showToast('Cliente eliminado')
    setElimTarget(null)
    if (sel?.id === id) { setSel(null); setSaldo(null) }
    cargar()
  }

  async function guardarNotas() {
    if (!sel) return
    setGuardandoN(true)
    const { error } = await supabase.from('clientes_agenda')
      .update({ notas: notasEdit.trim() || null })
      .eq('id', sel.id).eq('tenant_id', tenant.id)
    setGuardandoN(false)
    if (error) { showToast('Error al guardar notas', false); return }
    setSel(s => ({ ...s, notas: notasEdit.trim() || null }))
    setEditNotas(false)
    showToast('Notas guardadas')
    cargar()
  }

  async function desbloquearNoshow() {
    if (!sel) return
    const { error } = await supabase.from('clientes_agenda')
      .update({ contador_noshow: 0, bloqueado_noshow: false })
      .eq('id', sel.id).eq('tenant_id', tenant.id)
    if (error) { showToast('Error al desbloquear', false); return }
    setSel(s => ({ ...s, contador_noshow: 0, bloqueado_noshow: false }))
    showToast('Cliente desbloqueado')
    cargar()
  }

  async function cargarFotos(clienteId) {
    setLoadFotos(true)
    const { data } = await supabase.from('fotos_cliente')
      .select('*').eq('cliente_id', clienteId).eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
    setFotos(data || [])
    setLoadFotos(false)
  }

  async function subirFoto(e) {
    const file = e.target.files?.[0]
    if (!file || !sel) return
    e.target.value = ''
    if (file.size > 10 * 1024 * 1024) { showToast('La foto supera 10 MB', false); return }
    setSubiendoFoto(true)
    const ext  = file.name.split('.').pop().toLowerCase() || 'jpg'
    const path = `fotos-clientes/${tenant.id}/${sel.id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('imagenes').upload(path, file, { cacheControl:'3600', upsert:false })
    if (uploadErr) { showToast('Error al subir: ' + uploadErr.message, false); setSubiendoFoto(false); return }
    const { data: urlData } = supabase.storage.from('imagenes').getPublicUrl(path)
    await supabase.from('fotos_cliente').insert({ tenant_id:tenant.id, cliente_id:sel.id, foto_url:urlData.publicUrl, tipo:tipoFoto })
    setSubiendoFoto(false)
    cargarFotos(sel.id)
    showToast('Foto subida ✓')
  }

  async function eliminarFoto(fotoId, fotoUrl) {
    await supabase.from('fotos_cliente').delete().eq('id', fotoId)
    const storagePath = fotoUrl.split('/imagenes/')[1]
    if (storagePath) await supabase.storage.from('imagenes').remove([storagePath])
    setFotos(fs => fs.filter(f => f.id !== fotoId))
    showToast('Foto eliminada')
  }

  async function cargarPrestamos(clienteId) {
    if (!tenant) return
    setLoadPrest(true)
    const { data } = await supabase.from('prestamos_cliente')
      .select('*').eq('cliente_id', clienteId).eq('tenant_id', tenant.id)
      .order('fecha', { ascending: false })
    setPrestamos(data || [])
    setLoadPrest(false)
  }

  async function guardarPrestamo() {
    const m = parseFloat(formPrest.monto)
    if (!m || m <= 0) { showToast('Monto inválido', false); return }
    setSavingPrest(true)
    const { error } = await supabase.from('prestamos_cliente').insert({
      tenant_id: tenant.id,
      cliente_id: sel.id,
      tipo: formPrest.tipo,
      monto: m,
      concepto: formPrest.concepto || null,
      fecha: formPrest.fecha,
    })
    setSavingPrest(false)
    if (error) { showToast('Error al guardar', false); return }
    setSheetPrest(false)
    setFormPrest({ tipo:'prestamo', monto:'', concepto:'', fecha: new Date().toISOString().slice(0,10) })
    showToast('Movimiento registrado ✓')
    cargarPrestamos(sel.id)
  }

  async function cargarPuntos(clienteId) {
    if (!tenant) return
    setLoadPuntos(true)
    const { data } = await supabase.from('puntos_cliente')
      .select('*').eq('cliente_id', clienteId).eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
    setPuntos(data || [])
    setLoadPuntos(false)
  }

  async function registrarPuntos() {
    const pts = parseInt(puntosForm.puntos)
    if (!pts || pts <= 0) { showToast('Ingresa puntos válidos', false); return }
    setSavingPts(true)
    // Compute new saldo
    const saldoActual = puntos[0]?.saldo ?? (sel?.puntos_fidelizacion || 0)
    const delta = puntosForm.tipo === 'canjeados' ? -pts : pts
    const nuevoSaldo = Math.max(0, saldoActual + delta)
    const { error } = await supabase.from('puntos_cliente').insert({
      tenant_id: tenant.id,
      cliente_id: sel.id,
      tipo: puntosForm.tipo,
      puntos: puntosForm.tipo === 'canjeados' ? -pts : pts,
      saldo: nuevoSaldo,
      motivo: puntosForm.motivo || null,
    })
    if (!error) {
      await supabase.from('clientes_agenda').update({ puntos_fidelizacion: nuevoSaldo }).eq('id', sel.id)
      setPuntosForm({ tipo:'ganados', puntos:'', motivo:'' })
      showToast('Puntos registrados ✓')
      cargarPuntos(sel.id)
    } else {
      showToast('Error al guardar', false)
    }
    setSavingPts(false)
  }

  async function eliminarPrestamo(id) {
    await supabase.from('prestamos_cliente').delete().eq('id', id).eq('tenant_id', tenant.id)
    showToast('Eliminado')
    cargarPrestamos(sel.id)
  }

  async function cargarTiquetera(clienteId) {
    if (!tenant) return
    setLoadTiquetera(true)
    setTiqueteraData(null)
    const { data, error } = await supabase.rpc('tiquetera_cliente', {
      p_tenant_id:  tenant.id,
      p_cliente_id: clienteId,
    })
    setLoadTiquetera(false)
    if (!error && data) setTiqueteraData(data)
  }

  async function canjearTiquetera() {
    if (!sel || !tiqueteraData?.listo || !tenant) return
    setCanjeando(true)
    const { error } = await supabase.from('tiquetera_premios').insert({
      tenant_id:    tenant.id,
      cliente_id:   sel.id,
      visitas_base: tiqueteraData.total,
      premio:       tiqueteraData.premio,
    })
    setCanjeando(false)
    if (error) { showToast('Error al registrar canje', false); return }
    showToast('Premio canjeado ✓')
    cargarTiquetera(sel.id)
  }

  async function cargarConsentimiento(clienteId) {
    if (!tenant) return
    setLoadConsent(true)
    setConsentData(null)
    const { data } = await supabase.from('consentimientos')
      .select('*').eq('cliente_id', clienteId).eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
    setLoadConsent(false)
    setConsentData(data || [])
  }

  async function registrarConsentimiento() {
    if (!consentNombre.trim()) { showToast('Escribe el nombre del firmante', false); return }
    if (!sel || !tenant) return
    setSavingConsent(true)
    const textoDefault = tenant.texto_consentimiento ||
      `Yo, el/la cliente, autorizo a ${tenant.nombre} a prestar los servicios solicitados, ` +
      `al tratamiento de mis datos personales conforme a la ley 1581/2012, y a la toma de fotografías ` +
      `con fines de seguimiento del servicio. He sido informado/a sobre los procedimientos, productos ` +
      `y posibles reacciones.`

    const existing = consentData?.find(c => c.tipo === consentTipo)
    const payload = {
      tenant_id:      tenant.id,
      cliente_id:     sel.id,
      tipo:           consentTipo,
      texto_version:  textoDefault,
      nombre_firmante: consentNombre.trim(),
      aceptado_en:    new Date().toISOString(),
      revocado_en:    null,
    }

    const { error } = existing
      ? await supabase.from('consentimientos').update(payload).eq('id', existing.id)
      : await supabase.from('consentimientos').insert(payload)

    setSavingConsent(false)
    if (error) { showToast('Error al registrar: ' + error.message, false); return }
    showToast('Consentimiento registrado ✓')
    setConsentModal(false)
    setConsentNombre('')
    cargarConsentimiento(sel.id)
  }

  async function revocarConsentimiento(id) {
    if (!confirm('¿Revocar este consentimiento?')) return
    await supabase.from('consentimientos').update({ revocado_en: new Date().toISOString() }).eq('id', id)
    showToast('Consentimiento revocado')
    cargarConsentimiento(sel.id)
  }

  async function cargarPaquetes(clienteId) {
    if (!tenant) return
    setLoadPaq(true)
    const [{ data: paqData }, { data: servsData }] = await Promise.all([
      supabase.from('paquetes_cliente')
        .select('*, servicios(nombre)')
        .eq('cliente_id', clienteId).eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false }),
      supabase.from('servicios')
        .select('id, nombre').eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
    ])
    setPaquetesCli(paqData || [])
    setServiciosList(servsData || [])
    setLoadPaq(false)
  }

  async function guardarPaquete() {
    if (!formPaq.nombre.trim()) { showToast('Nombre requerido', false); return }
    const sesTot = parseInt(formPaq.sesiones_total)
    if (!sesTot || sesTot < 1) { showToast('Sesiones inválidas', false); return }
    setSavingPaq(true)
    const { error } = await supabase.from('paquetes_cliente').insert({
      tenant_id:      tenant.id,
      cliente_id:     sel.id,
      servicio_id:    formPaq.servicio_id || null,
      nombre:         formPaq.nombre.trim(),
      sesiones_total: sesTot,
      sesiones_usadas: 0,
      precio_total:   formPaq.precio_total ? Number(formPaq.precio_total) : null,
      vencimiento:    formPaq.vencimiento || null,
      notas:          formPaq.notas || null,
      activo:         true,
    })
    setSavingPaq(false)
    if (error) { showToast('Error al guardar', false); return }
    setSheetPaq(false)
    setFormPaq({ nombre:'', servicio_id:'', sesiones_total:'4', precio_total:'', vencimiento:'', notas:'' })
    showToast('Plan creado ✓')
    cargarPaquetes(sel.id)
  }

  async function usarSesion(paq) {
    if (paq.sesiones_usadas >= paq.sesiones_total) { showToast('Plan agotado', false); return }
    const { error } = await supabase.from('paquetes_cliente')
      .update({ sesiones_usadas: paq.sesiones_usadas + 1 })
      .eq('id', paq.id).eq('tenant_id', tenant.id)
    if (error) { showToast('Error', false); return }
    showToast('Sesión registrada ✓')
    cargarPaquetes(sel.id)
  }

  async function cancelarPaquete(id) {
    await supabase.from('paquetes_cliente').update({ activo: false }).eq('id', id).eq('tenant_id', tenant.id)
    showToast('Plan cancelado')
    cargarPaquetes(sel.id)
  }

  async function abrirCliente(cli) {
    setSel(cli)
    setTabCliente('historial')
    setNotasEdit(cli.notas || '')
    setEditNotas(false)
    setSaldo(null)
    setFotos([])
    setPrestamos([])
    setLoadHist(true)
    setProximaCita(null)
    const [{ data: hist }, { data: sp }, { data: prox }] = await Promise.all([
      supabase.from('citas')
        .select('id, fecha_inicio, estado, precio_cobrado, servicios(nombre, precio), profesionales(nombre)')
        .eq('cliente_id', cli.id)
        .eq('tenant_id', tenant.id)
        .order('fecha_inicio', { ascending: false })
        .limit(10),
      supabase.from('saldo_puntos')
        .select('saldo, total_ganado, tier')
        .eq('tenant_id', tenant.id)
        .eq('cliente_id', cli.id)
        .maybeSingle(),
      supabase.from('citas')
        .select('fecha_inicio, servicios(nombre), profesionales(nombre)')
        .eq('cliente_id', cli.id)
        .eq('tenant_id', tenant.id)
        .neq('estado', 'cancelada')
        .gte('fecha_inicio', new Date().toISOString())
        .order('fecha_inicio')
        .limit(1)
        .maybeSingle(),
    ])
    setHistorial(hist || [])
    setSaldo(sp || null)
    setProximaCita(prox || null)
    setLoadHist(false)
    cargarFotos(cli.id)
  }

  function fmtFecha(iso) {
    return new Date(iso).toLocaleDateString('es-CO', { day:'numeric', month:'short', year:'numeric' })
  }
  function fmtFechaCorta(iso) {
    return new Date(iso).toLocaleDateString('es-CO', { day:'numeric', month:'short' })
  }

  const ESTADO_COLOR = {
    completada:  '#22c55e', confirmada: '#3b82f6',
    pendiente:   '#f59e0b', cancelada:  '#6b7280', no_asistio: '#f43f5e',
  }

  return (
    <div style={{ padding:'0 0 16px' }}>
      {toast && <div className="sp-toast show" style={{ background:toast.color }}>{toast.msg}</div>}

      {/* ── Confirmar eliminación ── */}
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
                Se borrarán todas sus citas e historial.<br />Esta acción es irreversible.
              </p>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setElimTarget(null)} style={{
                flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                background:'var(--card)', border:'none', boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
                color:'var(--text-2)', fontWeight:600, fontSize:14,
              }}>Cancelar</button>
              <button onClick={eliminarCliente} style={{
                flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                background:'#ef4444', border:'none', color:'#fff', fontWeight:700, fontSize:14,
              }}>Sí, eliminar</button>
            </div>
          </div>
        </>
      )}

      {/* ── Import CSV preview ── */}
      {importModal && (
        <>
          <div className="sp-sheet-overlay" onClick={() => { setImportModal(false); setImportData([]) }} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">Importar clientes — CSV</p>

            <div className="sp-alert success" style={{ marginBottom:16, marginLeft:0, marginRight:0, fontSize:13, color:'#4ade80', fontWeight:600 }}>
              <span>✓ {importData.length} cliente{importData.length !== 1 ? 's' : ''} listos para importar</span>
            </div>

            <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:700,
              letterSpacing:0.8, textTransform:'uppercase', marginBottom:8 }}>
              Vista previa (primeros 5)
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20, maxHeight:220, overflowY:'auto' }}>
              {importData.slice(0, 5).map((r, i) => (
                <div key={i} style={{
                  padding:'10px 12px', borderRadius:10,
                  background:'var(--card)', boxShadow:'0 1px 6px rgba(0,0,0,0.08)',
                }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>{r.nombre}</div>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginTop:3 }}>
                    {[r.telefono, r.email].filter(Boolean).join(' · ') || 'Sin contacto'}
                  </div>
                </div>
              ))}
              {importData.length > 5 && (
                <div style={{ textAlign:'center', fontSize:12, color:'var(--text-3)', padding:'6px 0' }}>
                  y {importData.length - 5} más…
                </div>
              )}
            </div>

            <div className="sp-alert info" style={{ marginLeft:0, marginRight:0, marginBottom:20, fontSize:11, color:'#93c5fd', lineHeight:1.6, alignItems:'center' }}>
              <span>Columnas reconocidas: <b>nombre</b>, telefono, email, fecha_nacimiento (YYYY-MM-DD), servicios_interes, notas</span>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => { setImportModal(false); setImportData([]) }} style={{
                flex:1, padding:'12px', borderRadius:14, cursor:'pointer',
                background:'var(--card)', border:'none', boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
                color:'var(--text-2)', fontWeight:600, fontSize:14,
              }}>
                Cancelar
              </button>
              <button onClick={importarClientes} disabled={importando} style={{
                flex:2, padding:'12px', borderRadius:14, border:'none', cursor:'pointer',
                background:`linear-gradient(135deg,${col},${col}cc)`,
                color:'#fff', fontWeight:700, fontSize:14,
                opacity: importando ? 0.7 : 1,
              }}>
                {importando ? 'Importando…' : `Importar ${importData.length} clientes`}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Nuevo cliente ── */}
      {showNuevo && (
        <>
          <div className="sp-sheet-overlay" onClick={() => { setShowNuevo(false); setNuevoForm(FORM_VACIO) }} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">Nuevo cliente</p>

            {/* Tabs */}
            <div style={{ display:'flex', gap:4, marginBottom:18,
              background:'var(--card)', boxShadow:'0 1px 8px rgba(0,0,0,0.1)', borderRadius:12, padding:4 }}>
              {[['contacto','Contacto'],['perfil','Perfil'],['notas','Notas']].map(([t, label]) => (
                <button key={t} onClick={() => setNuevoTab(t)} style={{
                  flex:1, padding:'8px 0', borderRadius:8, cursor:'pointer', border:'none',
                  background: nuevoTab === t ? col : 'transparent',
                  color: nuevoTab === t ? '#fff' : 'var(--text-3)',
                  fontWeight:700, fontSize:13, transition:'all 0.15s',
                }}>{label}</button>
              ))}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
              {nuevoTab === 'contacto' && <>
                {[
                  { key:'nombre',   label:'NOMBRE *', type:'text',  placeholder:'' },
                  { key:'telefono', label:'TELÉFONO',  type:'tel',   placeholder:'Ej: 3001234567' },
                  { key:'email',    label:'EMAIL',     type:'email', placeholder:'' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>
                      {f.label}
                    </label>
                    <input className="sp-input" type={f.type} placeholder={f.placeholder}
                      value={nuevoForm[f.key]}
                      onChange={e => setNuevoForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </>}

              {nuevoTab === 'perfil' && <>
                <div>
                  <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>
                    FECHA DE NACIMIENTO
                  </label>
                  <input className="sp-input" type="date"
                    value={nuevoForm.fecha_nacimiento}
                    onChange={e => setNuevoForm(p => ({ ...p, fecha_nacimiento: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>
                    SERVICIOS DE INTERÉS
                  </label>
                  <input className="sp-input" type="text"
                    placeholder="Ej: Tinte, Corte, Manicura…"
                    value={nuevoForm.servicios_interes}
                    onChange={e => setNuevoForm(p => ({ ...p, servicios_interes: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:8 }}>
                    TIPO DE PRECIO
                  </label>
                  <div style={{ display:'flex', gap:8 }}>
                    {[{ k:'normal', label:'Normal', color:'var(--text-2)' }, { k:'mayorista', label:'Mayorista', color:'#f59e0b' }].map(opt => (
                      <button key={opt.k} type="button" onClick={() => setNuevoForm(p => ({...p, tipo_precio: opt.k}))} style={{
                        flex:1, padding:'10px', borderRadius:12, cursor:'pointer',
                        border:`1.5px solid ${nuevoForm.tipo_precio === opt.k ? opt.color : 'var(--border)'}`,
                        background: nuevoForm.tipo_precio === opt.k ? `${opt.color}14` : 'var(--card)',
                        color: nuevoForm.tipo_precio === opt.k ? opt.color : 'var(--text-3)',
                        fontWeight:700, fontSize:13, transition:'all 0.12s',
                      }}>{opt.label}</button>
                    ))}
                  </div>
                </div>
              </>}

              {nuevoTab === 'notas' && <>
                <div>
                  <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>
                    BARRIO / ZONA
                  </label>
                  <input className="sp-input" placeholder="Ej: Laureles, Centro, Chapinero…"
                    value={nuevoForm.barrio}
                    onChange={e => setNuevoForm(p => ({ ...p, barrio: e.target.value }))}
                    style={{ marginBottom:14 }} />
                  <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>
                    ¿CÓMO NOS CONOCISTE?
                  </label>
                  <select className="sp-input" value={nuevoForm.fuente_captacion}
                    onChange={e => setNuevoForm(p => ({ ...p, fuente_captacion: e.target.value }))}>
                    <option value="">Sin especificar</option>
                    <option value="instagram">📸 Instagram</option>
                    <option value="facebook">👍 Facebook</option>
                    <option value="tiktok">🎵 TikTok</option>
                    <option value="google">🔍 Google</option>
                    <option value="referido">🤝 Referido de cliente</option>
                    <option value="paso_por_aqui">🚶 Pasó por aquí</option>
                    <option value="otro">💬 Otro</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>
                    NOTAS / ALERGIAS
                  </label>
                  <textarea className="sp-input"
                    placeholder="Alergias, preferencias, referencias…"
                    value={nuevoForm.notas}
                    onChange={e => setNuevoForm(p => ({ ...p, notas: e.target.value }))}
                    rows={5} style={{ resize:'vertical', minHeight:120 }} autoFocus />
                </div>
                <div className="sp-alert info" style={{ marginLeft:0, marginRight:0, alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'#93c5fd', lineHeight:1.6 }}>
                    <b style={{ color:'#60a5fa' }}>⭐ Fidelización</b> — puntos, tier y estadísticas se calculan automáticamente al registrar citas.
                  </span>
                </div>
              </>}
            </div>
            <button onClick={guardarCliente} disabled={guardando} style={{
              width:'100%', padding:'15px', borderRadius:14, cursor:'pointer',
              background:col, border:'none', color:'#fff',
              fontFamily:'Outfit', fontWeight:700, fontSize:15, opacity: guardando ? 0.7 : 1,
            }}>
              {guardando ? 'Guardando…' : 'Guardar cliente'}
            </button>
          </div>
        </>
      )}

      {/* ── Search + filtros (sticky, siempre visible) ── */}
      <div style={{ padding:'12px 16px 12px', position:'sticky', top:0, background:'var(--bg)', zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:'var(--text)', margin:0 }}>Clientes</h2>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => csvInputRef.current?.click()} title="Importar CSV"
              style={{
                display:'flex', alignItems:'center', gap:5, padding:'9px 13px', borderRadius:12,
                background:`${col}12`, border:'none',
                color:col, fontWeight:600, fontSize:13, cursor:'pointer',
              }}>
              <Ico d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" size={15} />
              Importar
            </button>
            {clientes.length > 0 && (
              <button onClick={exportarCSV} title="Exportar CSV"
                style={{
                  display:'flex', alignItems:'center', gap:5, padding:'9px 13px', borderRadius:12,
                  background:`${col}12`, border:'none',
                  color:col, fontWeight:600, fontSize:13, cursor:'pointer',
                }}>
                <Ico d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" size={15} />
                CSV
              </button>
            )}
            <input ref={csvInputRef} type="file" accept=".csv,text/csv"
              onChange={handleCSVFile} style={{ display:'none' }} />
            <button onClick={() => { setShowNuevo(true); setNuevoTab('contacto') }} style={{
              display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:12,
              background:col, border:'none', color:'#fff', fontWeight:700, fontSize:13,
              cursor:'pointer', fontFamily:'Plus Jakarta Sans',
            }}>
              <Ico d="M12 4v16m8-8H4" size={15} />
              Agregar
            </button>
          </div>
        </div>
        <div style={{ position:'relative', marginBottom:10 }}>
          <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }}>
            <Ico d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={17} />
          </div>
          <input className="sp-input" placeholder="Buscar cliente…"
            value={busq} onChange={e => setBusq(e.target.value)}
            style={{ paddingLeft:42 }}
          />
        </div>
        <div style={{ display:'flex', gap:6, overflowX:'auto', overflowY:'clip', paddingBottom:2 }}>
          {FILTROS.map(f => {
            const activo = filtroSeg === f.key
            const cnt = f.key === 'todos' ? clientes.length : (conteos[f.key] || 0)
            const cfg = SEGMENTO[f.key]
            return (
              <button key={f.key} onClick={() => setFiltroSeg(f.key)}
                style={{
                  flexShrink:0, padding:'5px 11px', borderRadius:8, fontSize:12,
                  fontWeight:700, cursor:'pointer', border:'1px solid',
                  whiteSpace:'nowrap',
                  background: activo ? (cfg ? cfg.bg : `${col}18`) : 'transparent',
                  borderColor: activo ? (cfg ? cfg.color : col) : 'var(--border)',
                  color: activo ? (cfg ? cfg.color : col) : 'var(--text-3)',
                }}>
                {f.label} {cnt > 0 && <span style={{ opacity:0.7 }}>· {cnt}</span>}
              </button>
            )
          })}
        </div>
        {/* Tags filter row */}
        <div style={{ display:'flex', gap:5, overflowX:'auto', overflowY:'clip', paddingBottom:2, marginTop:4 }}>
          {TAGS_OPCIONES.map(t => {
            const activo = filtroTag === t.key
            const cnt = clientes.filter(c => (c.tags || []).includes(t.key)).length
            if (!cnt) return null
            return (
              <button key={t.key} onClick={() => setFiltroTag(activo ? null : t.key)}
                style={{
                  flexShrink:0, padding:'3px 9px', borderRadius:8, fontSize:11,
                  fontWeight:700, cursor:'pointer', border:'1px solid',
                  background: activo ? `${t.color}20` : 'transparent',
                  borderColor: activo ? t.color : 'var(--border)',
                  color: activo ? t.color : 'var(--text-3)',
                }}>
                {t.icon} {t.label} · {cnt}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="sp-skeleton" style={{ height:72, borderRadius:16 }} />
          ))}
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon">👥</span>
          <p className="sp-empty-title">Sin clientes</p>
          <p className="sp-empty-sub">
            {busq ? 'No se encontraron resultados'
              : filtroSeg !== 'todos' ? `Sin clientes ${SEGMENTO[filtroSeg]?.label?.toLowerCase()}s`
              : 'Toca "Agregar" para registrar el primer cliente'}
          </p>
        </div>
      ) : (
        <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:6 }}>
          {clientesFiltrados.map((c, i) => {
            const color = COLORS[i % COLORS.length]
            const cumple = cumpleProximo(c.fecha_nacimiento)
            return (
              <div key={c.id} onClick={() => abrirCliente(c)}
                className="sp-client-row"
                style={{ background: cumple ? 'rgba(251,191,36,0.07)' : undefined }}>
                <div style={{
                  width:46, height:46, borderRadius:14, background:`${color}25`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'Outfit', fontWeight:800, fontSize:20, color, flexShrink:0,
                }}>
                  {c.nombre[0]}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:3, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    {c.nombre}
                    {cumple && <span title="Cumpleaños próximo">🎂</span>}
                  </div>
                  {c.tags?.length > 0 && (
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:3 }}>
                      {c.tags.map(tag => {
                        const t = TAGS_OPCIONES.find(o => o.key === tag)
                        if (!t) return null
                        return (
                          <span key={tag} style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5,
                            background:`${t.color}20`, color:t.color }}>
                            {t.icon} {t.label}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <div style={{ fontSize:12, color:'var(--text-3)', display:'flex', flexDirection:'column', gap:2 }}>
                    {c.telefono && <span>📞 {c.telefono}</span>}
                    {c.ultima_visita
                      ? <span>Última visita: {fmtFechaCorta(c.ultima_visita)}</span>
                      : c.num_visitas === 0 && <span style={{ color:'var(--text-3)' }}>Sin visitas aún</span>
                    }
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
                  {c.tipo_precio === 'mayorista' && (
                    <span style={{ padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700,
                      background:'rgba(245,158,11,0.15)', color:'#f59e0b' }}>
                      MAYOR
                    </span>
                  )}
                  {c.saldo_prestamos > 0 && (
                    <span style={{ padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700,
                      background:'rgba(239,68,68,0.12)', color:'#f87171',
                      whiteSpace:'nowrap',
                    }}>
                      Debe {fmtCOP(c.saldo_prestamos)}
                    </span>
                  )}
                  <SegBadge segmento={c.segmento} />
                  {c.puntos_fidelizacion > 0 && (
                    <span style={{
                      padding:'2px 7px', borderRadius:6, background:`${col}20`,
                      fontSize:11, fontWeight:700, color:col,
                    }}>
                      ⭐ {c.puntos_fidelizacion}
                    </span>
                  )}
                </div>
                {/* Botón eliminar directo en la tarjeta */}
                <button onClick={e => { e.stopPropagation(); setElimTarget(c) }}
                  title="Eliminar cliente"
                  style={{
                    width:34, height:34, borderRadius:10, border:'1px solid rgba(239,68,68,0.25)',
                    background:'transparent', color:'#ef4444', cursor:'pointer', flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                  <Ico d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={15} />
                </button>
              </div>
            )
          })}

          {hayMas && (
            <button
              onClick={() => cargar(true)}
              disabled={cargandoMas}
              style={{
                width:'100%', padding:'13px', borderRadius:14, border:'1px solid var(--border)',
                background:'transparent', color:'var(--text-2)', fontWeight:600, fontSize:13,
                cursor:'pointer', fontFamily:'inherit', marginTop:4,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                opacity: cargandoMas ? 0.6 : 1,
              }}
            >
              {cargandoMas
                ? <><span style={{ width:16,height:16,borderRadius:'50%',border:'2px solid var(--border)',borderTopColor:'var(--text-2)',animation:'sp-spin 0.7s linear infinite', display:'inline-block' }} /> Cargando…</>
                : 'Cargar más clientes'}
            </button>
          )}
        </div>
      )}

      {/* ── Sheet detalle cliente ── */}
      {sel && (
        <>
          <div className="sp-sheet-overlay" onClick={() => { setSel(null); setSaldo(null) }} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />

            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
              <div style={{
                width:56, height:56, borderRadius:18, background:`${col}25`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'Outfit', fontWeight:800, fontSize:24, color:col,
              }}>
                {sel.nombre[0]}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:'var(--text)' }}>{sel.nombre}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, flexWrap:'wrap' }}>
                  <SegBadge segmento={sel.segmento} />
                  {sel.tipo_precio === 'mayorista' && (
                    <span style={{ padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700,
                      background:'rgba(245,158,11,0.15)', color:'#f59e0b' }}>MAYORISTA</span>
                  )}
                  {(sel.puntos_fidelizacion > 0) && (
                    <span style={{ padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700,
                      background:'rgba(234,179,8,0.15)', color:'#ca8a04' }}>⭐ {sel.puntos_fidelizacion} pts</span>
                  )}
                  {sel.bloqueado_noshow && (
                    <span style={{ padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700,
                      background:'rgba(239,68,68,0.15)', color:'#ef4444' }}>🚫 Bloqueado{sel.contador_noshow ? ` (${sel.contador_noshow})` : ''}</span>
                  )}
                  {!sel.bloqueado_noshow && sel.contador_noshow > 0 && (
                    <span style={{ padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700,
                      background:'rgba(113,113,122,0.15)', color:'#71717a' }}>No-show ×{sel.contador_noshow}</span>
                  )}
                  <span style={{ fontSize:12, color:'var(--text-3)' }}>
                    desde {fmtFecha(sel.created_at)}
                  </span>
                </div>
              </div>
              <button onClick={async () => {
                const nuevo = sel.tipo_precio === 'mayorista' ? 'normal' : 'mayorista'
                await supabase.from('clientes_agenda').update({ tipo_precio: nuevo }).eq('id', sel.id).eq('tenant_id', tenant.id)
                setSel(s => ({...s, tipo_precio: nuevo}))
                showToast(nuevo === 'mayorista' ? 'Cambiado a Mayorista' : 'Cambiado a Normal')
                cargar()
              }} style={{
                padding:'6px 12px', borderRadius:10, border:`1px solid ${sel.tipo_precio === 'mayorista' ? '#f59e0b' : 'var(--border)'}`,
                background: sel.tipo_precio === 'mayorista' ? 'rgba(245,158,11,0.12)' : 'transparent',
                color: sel.tipo_precio === 'mayorista' ? '#f59e0b' : 'var(--text-3)',
                fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0,
              }}>
                {sel.tipo_precio === 'mayorista' ? 'Mayor.' : 'Normal'}
              </button>
            </div>

            {sel.bloqueado_noshow && (
              <div style={{
                display:'flex', alignItems:'center', gap:10, marginBottom:14,
                padding:'10px 14px', borderRadius:12,
                background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
              }}>
                <span style={{ fontSize:18 }}>🚫</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:'#ef4444', fontWeight:700 }}>Bloqueado por inasistencias</div>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                    No puede reservar por el portal en línea ({sel.contador_noshow || 0} no-shows).
                  </div>
                </div>
                <button onClick={desbloquearNoshow} style={{
                  padding:'6px 12px', borderRadius:10, border:'1px solid #ef4444',
                  background:'transparent', color:'#ef4444', fontSize:11, fontWeight:700,
                  cursor:'pointer', flexShrink:0,
                }}>
                  Desbloquear
                </button>
              </div>
            )}

            {/* Agendar cita */}
            <button onClick={() => setShowAgendarCita(true)} style={{
              width:'100%', padding:'10px', borderRadius:12, border:`1.5px solid ${col}`,
              background:`${col}12`, color:col, fontSize:13, fontWeight:700,
              cursor:'pointer', marginBottom:14, display:'flex', alignItems:'center',
              justifyContent:'center', gap:6,
            }}>
              📅 Agendar cita
            </button>

            {/* Tags */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
              {TAGS_OPCIONES.map(tag => {
                const activo = sel.tags?.includes(tag.key)
                return (
                  <button key={tag.key} onClick={async () => {
                    const tags = sel.tags || []
                    const nuevos = activo ? tags.filter(t => t !== tag.key) : [...tags, tag.key]
                    await supabase.from('clientes_agenda').update({ tags: nuevos }).eq('id', sel.id).eq('tenant_id', tenant.id)
                    setSel(s => ({ ...s, tags: nuevos }))
                    cargar()
                  }} style={{
                    padding:'5px 11px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:700,
                    border:`1px solid ${activo ? tag.color : 'var(--border)'}`,
                    background: activo ? `${tag.color}20` : 'transparent',
                    color: activo ? tag.color : 'var(--text-3)',
                    transition:'all 0.15s',
                  }}>
                    {tag.icon} {tag.label}
                  </button>
                )
              })}
            </div>

            {proximaCita && (
              <div style={{
                display:'flex', alignItems:'center', gap:8, marginBottom:14,
                padding:'10px 14px', borderRadius:12,
                background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.25)',
              }}>
                <span style={{ fontSize:16 }}>📅</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, color:'#818cf8', fontWeight:700, letterSpacing:0.5, textTransform:'uppercase' }}>Próxima visita</div>
                  <div style={{ fontSize:13, color:'var(--text)', fontWeight:600, marginTop:2 }}>
                    {new Date(proximaCita.fecha_inicio).toLocaleDateString('es-CO', { weekday:'short', day:'numeric', month:'short' })}
                    {' · '}
                    {new Date(proximaCita.fecha_inicio).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })}
                    {proximaCita.servicios?.nombre ? ` · ${proximaCita.servicios.nombre}` : ''}
                    {proximaCita.profesionales?.nombre ? ` con ${proximaCita.profesionales.nombre}` : ''}
                  </div>
                </div>
                {sel.telefono && (() => {
                  const tel = sel.telefono.replace(/\D/g, '')
                  const fecha = new Date(proximaCita.fecha_inicio).toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })
                  const hora  = new Date(proximaCita.fecha_inicio).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
                  const serv  = proximaCita.servicios?.nombre || 'tu cita'
                  const msg   = encodeURIComponent(`Hola ${sel.nombre} 👋 Te recordamos que tienes ${serv} el ${fecha} a las ${hora} en ${tenant?.nombre || 'el salón'}. ¡Te esperamos! 💇`)
                  return (
                    <a href={`https://wa.me/${tel}?text=${msg}`} target="_blank" rel="noreferrer" style={{
                      padding:'6px 10px', borderRadius:8, background:'#25d366',
                      color:'#fff', fontSize:11, fontWeight:700, textDecoration:'none',
                      display:'flex', alignItems:'center', gap:4, flexShrink:0,
                    }}>
                      📲 WA
                    </a>
                  )
                })()}
              </div>
            )}

            {sel.num_visitas >= 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                {[
                  { label:'Visitas', value: sel.num_visitas || 0,        bg:`linear-gradient(135deg,${col}28,${col}08)`, c:col },
                  { label:'Gastado', value: fmtCOP(sel.total_gastado),   bg:'linear-gradient(135deg,rgba(34,197,94,0.15),transparent)', c:'#22c55e' },
                  { label:'Ticket',  value: fmtCOP(sel.ticket_promedio), bg:'linear-gradient(135deg,rgba(245,158,11,0.15),transparent)', c:'#f59e0b' },
                ].map(s => (
                  <div key={s.label} className="sp-kpi-card" style={{ background:s.bg, textAlign:'center', padding:'10px 8px', gap:2 }}>
                    <div style={{ fontSize:15, fontWeight:800, color:s.c, fontFamily:'Outfit' }}>{s.value}</div>
                    <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:600, letterSpacing:0.3 }}>{s.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              background:`linear-gradient(135deg,${col}0d,transparent)`,
              borderRadius:16, padding:'14px 16px', marginBottom:14,
              display:'flex', flexDirection:'column', gap:10,
              boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}>
              {sel.telefono && (
                <a href={`tel:${sel.telefono}`} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'var(--text-2)', textDecoration:'none' }}>
                  <Ico d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" size={16} />
                  {sel.telefono}
                </a>
              )}
              {sel.email && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'var(--text-2)' }}>
                  <Ico d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" size={16} />
                  {sel.email}
                </div>
              )}
              {sel.ultima_visita && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'var(--text-2)' }}>
                  <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" size={16} />
                  Última visita: {fmtFecha(sel.ultima_visita)}
                </div>
              )}
              {saldo && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:14 }}>
                  <span style={{ fontSize:18 }}>{TIER[saldo.tier]?.emoji || '⭐'}</span>
                  <div>
                    <span style={{ fontWeight:700, color: TIER[saldo.tier]?.color || '#f59e0b' }}>
                      {TIER[saldo.tier]?.label || 'Bronce'}
                    </span>
                    <span style={{ color:'var(--text-3)', marginLeft:6 }}>
                      · {saldo.saldo} pts · {saldo.total_ganado} ganados
                    </span>
                  </div>
                </div>
              )}
              {sel.fecha_nacimiento && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'var(--text-2)' }}>
                  <span style={{ fontSize:16 }}>🎂</span>
                  {new Date(sel.fecha_nacimiento + 'T12:00:00').toLocaleDateString('es-CO', { day:'numeric', month:'long' })}
                  {(() => {
                    const hoy = new Date()
                    const nac = new Date(sel.fecha_nacimiento + 'T12:00:00')
                    let edad = hoy.getFullYear() - nac.getFullYear()
                    if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--
                    return edad >= 0 && edad < 120 ? (
                      <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:600 }}>({edad} años)</span>
                    ) : null
                  })()}
                  {cumpleProximo(sel.fecha_nacimiento) && (
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:6,
                      background:'rgba(251,191,36,0.15)', color:'#fbbf24' }}>Próximo</span>
                  )}
                </div>
              )}
              {sel.servicios_interes && (
                <div style={{ display:'flex', alignItems:'flex-start', gap:10, fontSize:14, color:'var(--text-2)' }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>✂️</span>
                  <span style={{ lineHeight:1.5 }}>{sel.servicios_interes}</span>
                </div>
              )}
              {sel.barrio && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--text-3)' }}>
                  <span style={{ fontSize:15 }}>📍</span>
                  {sel.barrio}
                </div>
              )}
              {sel.fuente_captacion && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--text-3)' }}>
                  <span style={{ fontSize:15 }}>
                    {sel.fuente_captacion === 'instagram' ? '📸' : sel.fuente_captacion === 'facebook' ? '👍' : sel.fuente_captacion === 'tiktok' ? '🎵' : sel.fuente_captacion === 'google' ? '🔍' : sel.fuente_captacion === 'referido' ? '🤝' : sel.fuente_captacion === 'paso_por_aqui' ? '🚶' : '💬'}
                  </span>
                  {{instagram:'Instagram', facebook:'Facebook', tiktok:'TikTok', google:'Google', referido:'Referido de cliente', paso_por_aqui:'Pasó por aquí', otro:'Otro'}[sel.fuente_captacion] || sel.fuente_captacion}
                </div>
              )}
            </div>

            {/* ── Notas ── */}
            <div style={{
              background:'var(--card)', boxShadow:'0 1px 8px rgba(0,0,0,0.08)',
              borderRadius:16, padding:'14px 16px', marginBottom:14,
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--text-2)' }}>📝 Notas de atención</span>
                <button onClick={() => { setEditNotas(e => !e); setNotasEdit(sel.notas || '') }}
                  style={{ background:'none', border:'none', fontSize:12, color:'var(--accent)',
                    fontWeight:700, cursor:'pointer', padding:'2px 8px', borderRadius:6 }}>
                  {editNotas ? 'Cancelar' : 'Editar'}
                </button>
              </div>
              {editNotas ? (
                <>
                  <textarea className="sp-input"
                    value={notasEdit}
                    onChange={e => setNotasEdit(e.target.value)}
                    placeholder="Color de cabello, alergias, preferencias, referencias…"
                    rows={4} style={{ resize:'vertical', minHeight:90, marginBottom:10, width:'100%' }}
                    autoFocus
                  />
                  <button onClick={guardarNotas} disabled={guardandoN} style={{
                    width:'100%', padding:'12px', borderRadius:12, cursor:'pointer',
                    background:col, border:'none', color:'#fff', fontWeight:700, fontSize:14,
                    opacity: guardandoN ? 0.7 : 1,
                  }}>
                    {guardandoN ? 'Guardando…' : 'Guardar notas'}
                  </button>
                </>
              ) : (
                <p style={{ fontSize:14, color: sel.notas ? 'var(--text-2)' : 'var(--text-3)',
                  lineHeight:1.6, margin:0, whiteSpace:'pre-wrap' }}>
                  {sel.notas || 'Sin notas. Toca "Editar" para agregar.'}
                </p>
              )}
            </div>

            {sel.telefono && (
              <button onClick={() => window.open(`https://wa.me/${sel.telefono.replace(/\D/g,'')}`, '_blank')}
                style={{
                  width:'100%', padding:'14px', borderRadius:14, marginBottom:14,
                  background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.25)',
                  color:'#4ade80', fontWeight:700, fontSize:14, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  fontFamily:'Plus Jakarta Sans',
                }}>
                <Ico d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 12.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" size={16} />
                Enviar mensaje
              </button>
            )}

            <div style={{ borderTop:'1px solid var(--border)', paddingTop:14, marginBottom:14 }}>
              <button onClick={() => { setElimTarget(sel); setSel(null); setSaldo(null) }} style={{
                width:'100%', padding:'12px', borderRadius:14, cursor:'pointer',
                background:'transparent', border:'1px solid rgba(239,68,68,0.35)',
                color:'#ef4444', fontFamily:'Outfit', fontWeight:600, fontSize:14,
              }}>
                Eliminar cliente
              </button>
            </div>

            {/* ── Tabs Historial / Fotos ── */}
            <div style={{ display:'flex', gap:4, marginBottom:14,
              background:'var(--card)', boxShadow:'0 1px 8px rgba(0,0,0,0.1)', borderRadius:12, padding:4 }}>
              {[['historial','Historial'],['fotos','Fotos 📷'],['credito','Crédito'],['puntos','⭐'],['paquetes','🎟️ Planes'],['tiquetera','🏷️ Sello'],['consentimiento','📋 Consent.']].map(([t, label]) => (
                <button key={t} onClick={() => {
                  setTabCliente(t)
                  if (t === 'credito'       && sel?.id) cargarPrestamos(sel.id)
                  if (t === 'puntos'        && sel?.id) cargarPuntos(sel.id)
                  if (t === 'paquetes'      && sel?.id) cargarPaquetes(sel.id)
                  if (t === 'tiquetera'     && sel?.id) cargarTiquetera(sel.id)
                  if (t === 'consentimiento'&& sel?.id) cargarConsentimiento(sel.id)
                }} style={{
                  flex:1, padding:'8px 0', borderRadius:8, cursor:'pointer', border:'none',
                  background: tabCliente === t ? col : 'transparent',
                  color: tabCliente === t ? '#fff' : 'var(--text-3)',
                  fontWeight:700, fontSize:12, transition:'all 0.15s',
                }}>{label}</button>
              ))}
            </div>

            {tabCliente === 'historial' && (
              loadHist ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[1,2,3].map(i => <div key={i} className="sp-skeleton" style={{ height:56, borderRadius:12 }} />)}
                </div>
              ) : historial.length === 0 ? (
                <p style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', padding:'16px 0' }}>Sin citas anteriores</p>
              ) : (
              <>
                <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
                  <button onClick={exportarHistorialPDF} style={{
                    display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:9,
                    background:`${col}12`, border:`1px solid ${col}35`,
                    color:col, fontSize:11, fontWeight:700, cursor:'pointer',
                  }}>
                    ↓ PDF
                  </button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {historial.map(c => (
                    <div key={c.id} className="sp-tbl-row" style={{ padding:'11px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
                        <span style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, background: ESTADO_COLOR[c.estado] || '#6b7280' }} />
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontWeight:600, fontSize:13, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {c.servicios?.nombre || '—'}
                          </div>
                          <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>
                            {c.profesionales?.nombre?.split(' ')[0] || '—'} · {fmtFechaCorta(c.fecha_inicio)}
                          </div>
                        </div>
                      </div>
                      {c.precio_cobrado > 0 && (
                        <span style={{ fontSize:13, fontWeight:700, color:'var(--text-2)', flexShrink:0 }}>
                          ${Number(c.precio_cobrado).toLocaleString('es-CO')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>)
            )}

            {tabCliente === 'fotos' && (
              <>
                {/* Tipo + botón subir */}
                <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', gap:6, flex:1, flexWrap:'wrap' }}>
                    {[['antes','Antes'],['despues','Después'],['resultado','Resultado']].map(([t, label]) => (
                      <button key={t} onClick={() => setTipoFoto(t)} style={{
                        padding:'6px 12px', borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:700,
                        border:`1px solid ${tipoFoto === t ? col : 'var(--border)'}`,
                        background: tipoFoto === t ? `${col}18` : 'transparent',
                        color: tipoFoto === t ? col : 'var(--text-3)',
                      }}>{label}</button>
                    ))}
                  </div>
                  <input ref={fotoInputRef} type="file" accept="image/*" capture="environment"
                    style={{ display:'none' }} onChange={subirFoto} />
                  <button onClick={() => fotoInputRef.current?.click()} disabled={subiendoFoto} style={{
                    padding:'8px 16px', borderRadius:10, border:'none', cursor:'pointer', flexShrink:0,
                    background: subiendoFoto ? 'var(--border)' : `linear-gradient(135deg,${col},${col}cc)`,
                    color: subiendoFoto ? 'var(--text-3)' : '#fff', fontWeight:700, fontSize:13,
                  }}>
                    {subiendoFoto ? 'Subiendo…' : '+ Foto'}
                  </button>
                </div>

                {loadFotos ? (
                  <div style={{ display:'flex', justifyContent:'center', padding:'20px 0' }}>
                    <div className="sp-spinner" style={{ borderTopColor:col }} />
                  </div>
                ) : fotos.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'28px 0', color:'var(--text-3)' }}>
                    <div style={{ fontSize:40, marginBottom:10 }}>📷</div>
                    <p style={{ fontSize:13 }}>Sin fotos aún · Elige tipo y toca "+ Foto"</p>
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {fotos.map(f => (
                      <div key={f.id} style={{ borderRadius:14, overflow:'hidden', position:'relative',
                        aspectRatio:'1', background:'var(--card)', boxShadow:'0 1px 6px rgba(0,0,0,0.1)' }}>
                        <img src={f.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        <div style={{ position:'absolute', top:6, left:6, padding:'3px 8px', borderRadius:7,
                          background:'rgba(0,0,0,0.6)', fontSize:10, fontWeight:700, color:'#fff' }}>
                          {f.tipo === 'antes' ? 'Antes' : f.tipo === 'despues' ? 'Después' : 'Resultado'}
                        </div>
                        <button onClick={() => eliminarFoto(f.id, f.foto_url)} style={{
                          position:'absolute', top:6, right:6, width:26, height:26, borderRadius:8,
                          background:'rgba(239,68,68,0.85)', border:'none', color:'#fff',
                          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                          <Ico d="M6 18L18 6M6 6l12 12" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Tab Crédito ── */}
            {tabCliente === 'credito' && (() => {
              const totalPrest = prestamos.filter(p => p.tipo === 'prestamo').reduce((s,p) => s+Number(p.monto||0), 0)
              const totalAbonos = prestamos.filter(p => p.tipo === 'abono').reduce((s,p) => s+Number(p.monto||0), 0)
              const saldoPend = Math.max(0, totalPrest - totalAbonos)
              return (
                <>
                  {/* Resumen */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                    {[
                      { label:'Préstamos', val:totalPrest, color:'#f87171' },
                      { label:'Abonos', val:totalAbonos, color:'#22c55e' },
                      { label:'Saldo', val:saldoPend, color: saldoPend > 0 ? '#f87171' : '#22c55e' },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ padding:'10px', borderRadius:12,
                        background:`linear-gradient(135deg,${color}14,transparent)`, textAlign:'center' }}>
                        <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:15, color }}>
                          ${val.toLocaleString('es-CO')}
                        </div>
                        <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => setSheetPrest(true)} style={{
                    width:'100%', padding:'10px', borderRadius:12, border:`1.5px dashed ${col}60`,
                    background:'transparent', color:col, fontWeight:700, fontSize:13, cursor:'pointer', marginBottom:14,
                  }}>+ Registrar movimiento</button>

                  {loadPrest ? (
                    <div style={{ display:'flex', justifyContent:'center', padding:'20px 0' }}>
                      <div className="sp-spinner" style={{ borderTopColor:col }} />
                    </div>
                  ) : prestamos.length === 0 ? (
                    <p style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', padding:'16px 0' }}>Sin movimientos</p>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {prestamos.map(p => {
                        const isPrest = p.tipo === 'prestamo'
                        const clr = isPrest ? '#f87171' : '#22c55e'
                        return (
                          <div key={p.id} className="sp-tbl-row" style={{ padding:'10px 14px' }}>
                            <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6,
                              background:`${clr}15`, color:clr, flexShrink:0, textTransform:'uppercase' }}>
                              {isPrest ? 'Préstamo' : 'Abono'}
                            </span>
                            <div style={{ flex:1, minWidth:0, marginLeft:8 }}>
                              <div style={{ fontSize:12, color:'var(--text)' }}>{p.concepto || '—'}</div>
                              <div style={{ fontSize:10, color:'var(--text-3)' }}>{p.fecha}</div>
                            </div>
                            <span style={{ fontFamily:'Outfit', fontWeight:800, fontSize:13, color:clr }}>
                              {isPrest ? '-' : '+'}${Number(p.monto).toLocaleString('es-CO')}
                            </span>
                            <button onClick={() => eliminarPrestamo(p.id)} style={{
                              background:'none', border:'none', cursor:'pointer', color:'var(--text-3)',
                              fontSize:18, padding:'0 4px', flexShrink:0,
                            }}>×</button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Sheet nuevo movimiento */}
                  {sheetPrest && (
                    <>
                      <div className="sp-sheet-overlay" onClick={() => setSheetPrest(false)} />
                      <div className="sp-sheet">
                        <div className="sp-sheet-handle" />
                        <p className="sp-sheet-title">Registrar movimiento</p>
                        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:16 }}>
                          <div style={{ display:'flex', gap:6 }}>
                            {[{ k:'prestamo', label:'Préstamo' }, { k:'abono', label:'Abono' }].map(opt => (
                              <button key={opt.k} type="button" onClick={() => setFormPrest(f => ({...f, tipo:opt.k}))} style={{
                                flex:1, padding:'8px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:13,
                                border:`1.5px solid ${formPrest.tipo === opt.k ? col : 'var(--border)'}`,
                                background: formPrest.tipo === opt.k ? `${col}14` : 'transparent',
                                color: formPrest.tipo === opt.k ? col : 'var(--text-3)',
                              }}>{opt.label}</button>
                            ))}
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                            <div>
                              <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, display:'block', marginBottom:6 }}>MONTO *</label>
                              <input className="sp-input" type="number" min="0" placeholder="0"
                                value={formPrest.monto} onChange={e => setFormPrest(f => ({...f, monto:e.target.value}))} />
                            </div>
                            <div>
                              <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, display:'block', marginBottom:6 }}>FECHA</label>
                              <input className="sp-input" type="date" value={formPrest.fecha}
                                onChange={e => setFormPrest(f => ({...f, fecha:e.target.value}))} />
                            </div>
                          </div>
                          <div>
                            <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, display:'block', marginBottom:6 }}>CONCEPTO</label>
                            <input className="sp-input" placeholder="Ej: Anticipo servicio, Abono cuota…"
                              value={formPrest.concepto} onChange={e => setFormPrest(f => ({...f, concepto:e.target.value}))} />
                          </div>
                        </div>
                        <button disabled={savingPrest} onClick={guardarPrestamo} style={{
                          width:'100%', padding:'15px', borderRadius:14, border:'none', cursor:'pointer',
                          background:`linear-gradient(135deg,${col},${col}bb)`, color:'#fff',
                          fontWeight:700, fontSize:15, opacity: savingPrest ? 0.7 : 1,
                        }}>
                          {savingPrest ? 'Guardando…' : 'Registrar'}
                        </button>
                        <button onClick={() => setSheetPrest(false)} style={{
                          marginTop:8, width:'100%', padding:'12px', borderRadius:12,
                          background:'var(--card)', border:'none', color:'var(--text-3)', fontWeight:600, fontSize:13, cursor:'pointer',
                        }}>Cancelar</button>
                      </div>
                    </>
                  )}
                </>
              )
            })()}

            {tabCliente === 'puntos' && (() => {
              const saldoActual = puntos[0]?.saldo ?? (sel?.puntos_fidelizacion || 0)
              return (
                <>
                  {/* Saldo prominente */}
                  <div style={{
                    textAlign:'center', padding:'20px 0 16px',
                    background:`linear-gradient(135deg,${col}18,${col}06)`,
                    borderRadius:16, marginBottom:14,
                  }}>
                    <div style={{ fontSize:40, lineHeight:1 }}>⭐</div>
                    <div style={{ fontFamily:'Outfit', fontWeight:900, fontSize:36, color:col, lineHeight:1.1, marginTop:6 }}>
                      {saldoActual.toLocaleString('es-CO')}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:4 }}>puntos disponibles</div>
                  </div>

                  {/* Form rápido */}
                  <div style={{ background:'var(--card)', borderRadius:14, padding:'14px', marginBottom:14, boxShadow:'0 2px 12px rgba(0,0,0,0.08)' }}>
                    <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                      {[{ k:'ganados', label:'Dar puntos' }, { k:'canjeados', label:'Canjear' }, { k:'ajuste', label:'Ajuste' }].map(opt => (
                        <button key={opt.k} onClick={() => setPuntosForm(f => ({...f, tipo:opt.k}))} style={{
                          flex:1, padding:'7px 4px', borderRadius:9, cursor:'pointer', fontWeight:700, fontSize:11,
                          border:`1.5px solid ${puntosForm.tipo === opt.k ? col : 'var(--border)'}`,
                          background: puntosForm.tipo === opt.k ? `${col}14` : 'transparent',
                          color: puntosForm.tipo === opt.k ? col : 'var(--text-3)',
                        }}>{opt.label}</button>
                      ))}
                    </div>
                    <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                      <input className="sp-input" type="number" min="1" placeholder="Puntos"
                        value={puntosForm.puntos} onChange={e => setPuntosForm(f => ({...f, puntos:e.target.value}))}
                        style={{ flex:'0 0 90px' }} />
                      <input className="sp-input" placeholder="Motivo (opcional)"
                        value={puntosForm.motivo} onChange={e => setPuntosForm(f => ({...f, motivo:e.target.value}))}
                        style={{ flex:1 }} />
                    </div>
                    <button disabled={savingPts} onClick={registrarPuntos} style={{
                      width:'100%', padding:'11px', borderRadius:12, border:'none', cursor:'pointer',
                      background:`linear-gradient(135deg,${col},${col}bb)`, color:'#fff',
                      fontWeight:700, fontSize:14, opacity: savingPts ? 0.7 : 1,
                    }}>
                      {savingPts ? 'Guardando…' : 'Registrar'}
                    </button>
                  </div>

                  {/* Historial de movimientos */}
                  {loadPuntos ? (
                    <div style={{ display:'flex', justifyContent:'center', padding:'20px 0' }}>
                      <div className="sp-spinner" style={{ borderTopColor:col }} />
                    </div>
                  ) : puntos.length === 0 ? (
                    <p style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', padding:'16px 0' }}>Sin movimientos</p>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {puntos.map(p => {
                        const esPos = p.puntos > 0
                        const clr = esPos ? '#22c55e' : '#f87171'
                        return (
                          <div key={p.id} className="sp-tbl-row" style={{ padding:'10px 14px' }}>
                            <span style={{ fontSize:18, flexShrink:0 }}>{esPos ? '⭐' : '🎁'}</span>
                            <div style={{ flex:1, minWidth:0, marginLeft:8 }}>
                              <div style={{ fontSize:12, color:'var(--text)' }}>{p.motivo || p.tipo}</div>
                              <div style={{ fontSize:10, color:'var(--text-3)' }}>
                                {new Date(p.created_at).toLocaleDateString('es-CO')} · saldo: {p.saldo}
                              </div>
                            </div>
                            <span style={{ fontFamily:'Outfit', fontWeight:800, fontSize:13, color:clr, flexShrink:0 }}>
                              {esPos ? '+' : ''}{p.puntos}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )
            })()}

            {tabCliente === 'paquetes' && (() => {
              const activos  = paquetesCli.filter(p => p.activo)
              const inactivos = paquetesCli.filter(p => !p.activo)
              return (
                <>
                  {/* Resumen */}
                  {activos.length > 0 && (
                    <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                      <div style={{ flex:1, background:'var(--card)', borderRadius:12, padding:'10px 14px', border:'1px solid var(--border)' }}>
                        <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Planes activos</div>
                        <div style={{ fontSize:20, fontWeight:800, color:'var(--text)', fontFamily:'Outfit' }}>{activos.length}</div>
                      </div>
                      <div style={{ flex:1, background:'var(--card)', borderRadius:12, padding:'10px 14px', border:'1px solid var(--border)' }}>
                        <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Sesiones disponibles</div>
                        <div style={{ fontSize:20, fontWeight:800, color:col, fontFamily:'Outfit' }}>
                          {activos.reduce((s, p) => s + (p.sesiones_total - p.sesiones_usadas), 0)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botón nuevo plan */}
                  <button onClick={async () => {
                    if (!serviciosList.length && tenant) {
                      const { data } = await supabase.from('servicios').select('id,nombre').eq('tenant_id', tenant.id).eq('activo', true).order('nombre')
                      setServiciosList(data || [])
                    }
                    setFormPaq({ nombre:'', servicio_id:'', sesiones_total:'4', precio_total:'', vencimiento:'', notas:'' })
                    setSheetPaq(true)
                  }} style={{
                    width:'100%', padding:'10px', borderRadius:12, border:`1.5px dashed ${col}66`,
                    background:'transparent', color:col, fontWeight:700, fontSize:13, cursor:'pointer',
                    marginBottom:12,
                  }}>
                    + Nuevo plan
                  </button>

                  {loadPaq ? (
                    <div style={{ display:'flex', justifyContent:'center', padding:'20px 0' }}>
                      <div className="sp-spinner" style={{ borderTopColor:col }} />
                    </div>
                  ) : activos.length === 0 && inactivos.length === 0 ? (
                    <p style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', padding:'16px 0' }}>
                      Sin planes prepagados aún
                    </p>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {[...activos, ...inactivos].map(paq => {
                        const pct   = Math.min(100, Math.round(paq.sesiones_usadas / paq.sesiones_total * 100))
                        const resta = paq.sesiones_total - paq.sesiones_usadas
                        const venc  = paq.vencimiento ? new Date(paq.vencimiento + 'T12:00:00') : null
                        const vencida = venc && venc < new Date()
                        const barColor = !paq.activo || vencida ? '#6b7280' : resta === 0 ? '#f87171' : col
                        return (
                          <div key={paq.id} style={{
                            background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'14px',
                            opacity: paq.activo && !vencida ? 1 : 0.55,
                          }}>
                            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                              <div>
                                <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', lineHeight:1.2 }}>{paq.nombre}</div>
                                {paq.servicio_id && serviciosList.find(s => s.id === paq.servicio_id) && (
                                  <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                                    {serviciosList.find(s => s.id === paq.servicio_id)?.nombre}
                                  </div>
                                )}
                              </div>
                              <div style={{ textAlign:'right', flexShrink:0, marginLeft:10 }}>
                                <div style={{ fontSize:18, fontWeight:800, color: barColor, fontFamily:'Outfit' }}>
                                  {resta}
                                  <span style={{ fontSize:11, fontWeight:500, color:'var(--text-3)' }}>/{paq.sesiones_total}</span>
                                </div>
                                <div style={{ fontSize:10, color:'var(--text-3)' }}>sesiones</div>
                              </div>
                            </div>

                            {/* Barra de progreso */}
                            <div style={{ height:6, borderRadius:6, background:'var(--border)', marginBottom:8 }}>
                              <div style={{ height:6, borderRadius:6, background:barColor, width:`${pct}%`, transition:'width 0.3s' }} />
                            </div>

                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
                              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                                {paq.precio_total && (
                                  <span style={{ fontSize:11, color:'var(--text-3)' }}>
                                    ${Number(paq.precio_total).toLocaleString('es-CO')}
                                  </span>
                                )}
                                {venc && (
                                  <span style={{ fontSize:11, color: vencida ? '#f87171' : 'var(--text-3)' }}>
                                    {vencida ? 'Vencida' : `Vence ${venc.toLocaleDateString('es-CO')}`}
                                  </span>
                                )}
                              </div>
                              <div style={{ display:'flex', gap:6 }}>
                                {paq.activo && !vencida && resta > 0 && (
                                  <button onClick={() => usarSesion(paq)} style={{
                                    padding:'5px 12px', borderRadius:8, border:`1px solid ${col}55`,
                                    background:`${col}15`, color:col, fontSize:11, fontWeight:700, cursor:'pointer',
                                  }}>
                                    Usar sesión
                                  </button>
                                )}
                                {paq.activo && (
                                  <button onClick={() => cancelarPaquete(paq.id)} style={{
                                    padding:'5px 10px', borderRadius:8, border:'1px solid var(--border)',
                                    background:'transparent', color:'var(--text-3)', fontSize:11, cursor:'pointer',
                                  }}>
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )
            })()}

            {tabCliente === 'tiquetera' && (() => {
              const tq = tiqueteraData
              return (
                <>
                  {loadTiquetera ? (
                    <div style={{ display:'flex', justifyContent:'center', padding:'24px 0' }}>
                      <div className="sp-spinner" style={{ borderTopColor:col }} />
                    </div>
                  ) : !tq ? (
                    <p style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', padding:'16px 0' }}>
                      Sin datos de tiquetera
                    </p>
                  ) : !tq.activa ? (
                    <div style={{ padding:'20px 16px', borderRadius:14,
                      background:'var(--card)', border:'1px solid var(--border)',
                      textAlign:'center' }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>🎟️</div>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:8 }}>
                        Tiquetera no activada
                      </div>
                      <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:16, lineHeight:1.5 }}>
                        Para usar la tiquetera de sellos ve a<br/>
                        <strong>Configuración → sección "Tiquetera Virtual"</strong><br/>
                        y activa el programa.
                      </div>
                      <button
                        style={{ padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer',
                          background:'var(--accent)', color:'#fff', fontSize:13, fontWeight:500 }}
                        onClick={() => {
                          document.querySelector('[data-nav="config"]')?.click()
                        }}>
                        Ir a Configuración
                      </button>
                    </div>
                  ) : (
                    <TiqueteraCard
                      progreso={tq.progreso ?? 0}
                      meta={tq.meta ?? 10}
                      premio={tq.premio ?? 'Servicio gratis'}
                      canjeados={tq.canjeados ?? 0}
                      listo={tq.listo ?? false}
                      color={col}
                      onCanjear={canjearTiquetera}
                      canjeando={canjeando}
                    />
                  )}
                </>
              )
            })()}

            {tabCliente === 'consentimiento' && (() => {
              const firmado = consentData?.find(c => c.activo)
              const historial = consentData || []
              const fmtFecha = (iso) => {
                if (!iso) return '—'
                const d = new Date(iso)
                return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) +
                  ' ' + d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
              }
              return (
                <>
                  {loadConsent ? (
                    <div style={{ display:'flex', justifyContent:'center', padding:'24px 0' }}>
                      <div className="sp-spinner" style={{ borderTopColor:col }} />
                    </div>
                  ) : (
                    <>
                      {/* Estado actual */}
                      <div style={{ padding:'16px 18px', borderRadius:14, marginBottom:16,
                        background: firmado ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
                        border: `1px solid ${firmado ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <span style={{ fontSize:22 }}>{firmado ? '✅' : '⚠️'}</span>
                          <div>
                            <div style={{ fontWeight:700, fontSize:14,
                              color: firmado ? '#16a34a' : '#d97706' }}>
                              {firmado ? 'Consentimiento firmado' : 'Sin consentimiento registrado'}
                            </div>
                            {firmado && (
                              <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                                Firmado por <strong style={{ color:'var(--text)' }}>{firmado.nombre_firmante}</strong>
                                {' · '}{fmtFecha(firmado.aceptado_en)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
                        <button onClick={() => {
                            setConsentTipo('servicio')
                            setConsentNombre(firmado?.nombre_firmante || sel?.nombre || '')
                            setConsentModal(true)
                          }}
                          style={{ flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer',
                            background:`linear-gradient(135deg,${col},${col}bb)`, color:'#fff',
                            fontWeight:700, fontSize:13 }}>
                          {firmado ? '🔄 Actualizar firma' : '✍️ Registrar consentimiento'}
                        </button>
                        {firmado && (
                          <button onClick={() => revocarConsentimiento(firmado.id)}
                            style={{ padding:'10px 14px', borderRadius:10, border:'1px solid rgba(239,68,68,0.3)',
                              background:'rgba(239,68,68,0.06)', color:'#ef4444', cursor:'pointer', fontSize:13 }}>
                            Revocar
                          </button>
                        )}
                      </div>

                      {/* Historial */}
                      {historial.length > 0 && (
                        <>
                          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
                            textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Historial</div>
                          {historial.map(c => (
                            <div key={c.id} style={{ padding:'10px 14px', borderRadius:10, marginBottom:6,
                              background:'var(--card)', border:'1px solid var(--border)',
                              fontSize:13, color:'var(--text-2)' }}>
                              <span style={{ fontWeight:600, color:'var(--text)', marginRight:8 }}>
                                {c.activo ? '✅' : '❌'} {c.nombre_firmante}
                              </span>
                              {fmtFecha(c.aceptado_en)}
                              {c.revocado_en && <span style={{ color:'#ef4444', marginLeft:8 }}>— Revocado {fmtFecha(c.revocado_en)}</span>}
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </>
              )
            })()}

          </div>
        </>
      )}

      {/* Sheet: nuevo plan prepagado */}
      {sheetPaq && (
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'flex-end', background:'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setSheetPaq(false) }}>
          <div style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'var(--bg)', borderRadius:'20px 20px 0 0', padding:'24px 20px 32px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'var(--text)' }}>Nuevo plan prepagado</h3>
              <button onClick={() => setSheetPaq(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--text-3)' }}>×</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Nombre del plan *</label>
                <input className="sp-input" placeholder="Ej: Pack 10 cortes" value={formPaq.nombre}
                  onChange={e => setFormPaq(f => ({...f, nombre:e.target.value}))}
                  style={{ marginTop:4, width:'100%' }} />
              </div>

              <div>
                <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Servicio (opcional)</label>
                <select className="sp-input" value={formPaq.servicio_id}
                  onChange={e => setFormPaq(f => ({...f, servicio_id:e.target.value}))}
                  style={{ marginTop:4, width:'100%' }}>
                  <option value="">— Cualquier servicio —</option>
                  {serviciosList.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Sesiones</label>
                  <input className="sp-input" type="number" min="1" placeholder="4"
                    value={formPaq.sesiones_total}
                    onChange={e => setFormPaq(f => ({...f, sesiones_total:e.target.value}))}
                    style={{ marginTop:4, width:'100%' }} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Precio total</label>
                  <input className="sp-input" type="number" min="0" placeholder="0"
                    value={formPaq.precio_total}
                    onChange={e => setFormPaq(f => ({...f, precio_total:e.target.value}))}
                    style={{ marginTop:4, width:'100%' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Vencimiento (opcional)</label>
                <input className="sp-input" type="date"
                  value={formPaq.vencimiento}
                  onChange={e => setFormPaq(f => ({...f, vencimiento:e.target.value}))}
                  style={{ marginTop:4, width:'100%' }} />
              </div>

              <div>
                <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Notas</label>
                <textarea className="sp-input" rows={2} placeholder="Observaciones…"
                  value={formPaq.notas}
                  onChange={e => setFormPaq(f => ({...f, notas:e.target.value}))}
                  style={{ marginTop:4, width:'100%', resize:'vertical' }} />
              </div>

              <button disabled={savingPaq} onClick={guardarPaquete} style={{
                width:'100%', padding:'13px', borderRadius:12, border:'none', cursor:'pointer',
                background:`linear-gradient(135deg,${col},${col}bb)`, color:'#fff',
                fontWeight:700, fontSize:14, marginTop:4, opacity: savingPaq ? 0.7 : 1,
              }}>
                {savingPaq ? 'Guardando…' : 'Guardar plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAgendarCita && sel && (
        <SalonNuevaCita
          onClose={() => setShowAgendarCita(false)}
          onCreada={() => { setShowAgendarCita(false); setProximaCita(null); abrirCliente(sel) }}
          clientePreId={sel.id}
          clientePreNombre={sel.nombre}
        />
      )}

      {/* Modal: registrar consentimiento */}
      {consentModal && (
        <div style={{ position:'fixed', inset:0, zIndex:400, display:'flex', alignItems:'flex-end',
          background:'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setConsentModal(false) }}>
          <div style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'var(--bg)',
            borderRadius:'20px 20px 0 0', padding:'28px 24px 40px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:'var(--text)' }}>Consentimiento informado</h3>
              <button onClick={() => setConsentModal(false)}
                style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--text-3)' }}>×</button>
            </div>

            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12,
              padding:'14px 16px', marginBottom:18, fontSize:12, color:'var(--text-2)', lineHeight:1.6 }}>
              Yo, el/la cliente, autorizo a <strong style={{ color:'var(--text)' }}>{tenant?.nombre}</strong> a prestar
              los servicios solicitados, al tratamiento de mis datos personales conforme a la ley 1581/2012,
              y a la toma de fotografías con fines de seguimiento del servicio. He sido informado/a sobre
              los procedimientos, productos y posibles reacciones.
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase',
                letterSpacing:0.5, display:'block', marginBottom:6 }}>Nombre completo del firmante *</label>
              <input className="sp-input" placeholder="Nombre del cliente"
                value={consentNombre}
                onChange={e => setConsentNombre(e.target.value)}
                style={{ width:'100%' }} />
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase',
                letterSpacing:0.5, display:'block', marginBottom:6 }}>Tipo de consentimiento</label>
              <select className="sp-input" value={consentTipo} onChange={e => setConsentTipo(e.target.value)}
                style={{ width:'100%' }}>
                <option value="servicio">Servicios de belleza / estética</option>
                <option value="datos">Tratamiento de datos personales</option>
                <option value="foto">Fotografías y uso de imagen</option>
                <option value="general">General (todos los anteriores)</option>
              </select>
            </div>

            <button disabled={savingConsent} onClick={registrarConsentimiento}
              style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', cursor:'pointer',
                background:`linear-gradient(135deg,${col},${col}bb)`, color:'#fff',
                fontWeight:700, fontSize:14, opacity: savingConsent ? 0.7 : 1 }}>
              {savingConsent ? 'Guardando…' : '✍️ Confirmar firma digital'}
            </button>
            <p style={{ fontSize:11, color:'var(--text-3)', textAlign:'center', marginTop:10 }}>
              Al confirmar, se registra fecha, hora y nombre como firma digital
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
