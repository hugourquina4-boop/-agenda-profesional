import { useState, useEffect } from 'react'
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

const STEP_LABELS = ['Profesional', 'Servicio', 'Fecha y hora', 'Cliente']

export default function SalonNuevaCita({ onClose, onCreada }) {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [step, setStep] = useState(0)
  const [profs,    setProfs]    = useState([])
  const [servs,    setServs]    = useState([])
  const [slots,     setSlots]     = useState([])
  const [sinHorario,setSinHorario]= useState(false)
  const [clientes, setClientes] = useState([])

  const [profId,   setProfId]   = useState(null)
  const [servId,   setServId]   = useState(null)
  const [fecha,    setFecha]    = useState(new Date().toISOString().slice(0,10))
  const [slot,     setSlot]     = useState(null)
  const [clienteId,setClienteId]= useState(null)
  const [busqCliente, setBusqCliente] = useState('')
  const [nuevoCliente, setNuevoCliente] = useState({ nombre:'', telefono:'' })
  const [modoNuevo, setModoNuevo] = useState(false)

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, color='#ef4444') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!tenant) return
    supabase.from('profesionales').select('id, nombre, especialidad, foto_url, activo').eq('tenant_id', tenant.id).order('nombre')
      .then(({ data }) => setProfs(data || []))
  }, [tenant])

  useEffect(() => {
    if (!profId || !tenant) return
    supabase.from('servicios').select('id, nombre, precio, duracion_min, categoria')
      .eq('tenant_id', tenant.id).eq('activo', true).order('nombre')
      .then(({ data }) => setServs(data || []))
  }, [profId])

  const DIA_KEY = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado']

  useEffect(() => {
    if (!profId || !servId || !fecha || !tenant) return
    const serv = servs.find(s => s.id === servId)
    if (!serv) return
    setSinHorario(false)
    setSlots([])
    generarSlots(profId, fecha, serv.duracion_min)
  }, [profId, servId, fecha])

  async function generarSlots(pId, f, durMin) {
    // Verificar horario configurado para ese día de la semana
    const diaSemana = DIA_KEY[new Date(f + 'T12:00:00').getDay()]
    const { data: horario } = await supabase
      .from('horarios')
      .select('hora_inicio, hora_fin')
      .eq('profesional_id', pId)
      .eq('dia', diaSemana)
      .eq('activo', true)
      .maybeSingle()

    if (!horario) { setSinHorario(true); return }

    const [hI, mI] = horario.hora_inicio.slice(0, 5).split(':').map(Number)
    const [hF, mF] = horario.hora_fin.slice(0, 5).split(':').map(Number)
    const inicioMin = hI * 60 + mI
    const finMin    = hF * 60 + mF

    // Citas ocupadas del día
    const { data: citasOcup } = await supabase
      .from('citas')
      .select('fecha_inicio, fecha_fin')
      .eq('profesional_id', pId)
      .gte('fecha_inicio', `${f}T00:00:00`)
      .lte('fecha_inicio', `${f}T23:59:59`)
      .neq('estado', 'cancelada')

    const generados = []
    for (let h = inicioMin; h + durMin <= finMin; h += durMin) {
      const hh = String(Math.floor(h / 60)).padStart(2, '0')
      const mm = String(h % 60).padStart(2, '0')
      const inicio = `${f}T${hh}:${mm}:00`
      const fin    = new Date(new Date(inicio).getTime() + durMin * 60000).toISOString().slice(0, 19)
      const ocupado = (citasOcup || []).some(c => c.fecha_inicio < fin && c.fecha_fin > inicio)
      if (!ocupado) generados.push({ inicio, fin, label: `${hh}:${mm}` })
    }
    setSlots(generados)
  }

  useEffect(() => {
    if (!tenant || busqCliente.length < 2) { setClientes([]); return }
    supabase.from('clientes_agenda').select('id, nombre, telefono')
      .eq('tenant_id', tenant.id).ilike('nombre', `%${busqCliente}%`).limit(8)
      .then(({ data }) => setClientes(data || []))
  }, [busqCliente, tenant])

  async function guardar() {
    setSaving(true)
    try {
      let cliId = clienteId
      if (modoNuevo) {
        if (!nuevoCliente.nombre.trim()) { showToast('Ingresa el nombre del cliente'); setSaving(false); return }
        const { data, error } = await supabase.from('clientes_agenda')
          .insert({ tenant_id: tenant.id, nombre: nuevoCliente.nombre.trim(), telefono: nuevoCliente.telefono })
          .select('id').single()
        if (error) throw error
        cliId = data.id
      }
      if (!cliId) { showToast('Selecciona un cliente'); setSaving(false); return }
      if (!slot)  { showToast('Selecciona un horario'); setSaving(false); return }

      const { error } = await supabase.from('citas').insert({
        tenant_id: tenant.id,
        profesional_id: profId,
        servicio_id: servId,
        cliente_id: cliId,
        fecha_inicio: slot.inicio,
        fecha_fin: slot.fin,
        estado: 'confirmada',
      })
      if (error) throw error
      onCreada?.()
      onClose()
    } catch (e) {
      showToast(e.message || 'Error al guardar')
    }
    setSaving(false)
  }

  const prof = profs.find(p => p.id === profId)
  const serv = servs.find(s => s.id === servId)

  const canNext = [
    !!profId,
    !!servId,
    !!slot,
    modoNuevo ? !!nuevoCliente.nombre.trim() : !!clienteId,
  ]

  return (
    <>
      {toast && (
        <div className="sp-toast show" style={{ background: toast.color }}>
          {toast.msg}
        </div>
      )}

      <div className="sp-sheet-overlay" onClick={onClose} />
      <div className="sp-sheet" style={{ paddingBottom: 80 }}>
        <div className="sp-sheet-handle" />

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <p className="sp-sheet-title" style={{ margin:0 }}>Nueva cita</p>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:10, border:'1px solid var(--border)',
            background:'var(--card)', color:'var(--text-2)', display:'flex',
            alignItems:'center', justifyContent:'center', cursor:'pointer'
          }}>
            <Ico d="M6 18L18 6M6 6l12 12" size={16} />
          </button>
        </div>

        {/* Progress */}
        <div style={{ display:'flex', gap:6, marginBottom:24 }}>
          {STEP_LABELS.map((lbl, i) => (
            <div key={i} style={{
              flex:1, height:3, borderRadius:2,
              background: i <= step ? col : 'var(--border)',
              transition:'background 0.3s',
            }} />
          ))}
        </div>

        <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:16, fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>
          {STEP_LABELS[step]}
        </p>

        {/* Step 0 — Profesional */}
        {step === 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {profs.map(p => (
              <button key={p.id} onClick={() => setProfId(p.id)}
                style={{
                  display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                  borderRadius:14, cursor:'pointer', textAlign:'left',
                  background: profId === p.id ? `${col}15` : 'var(--card)',
                  border: `1px solid ${profId === p.id ? col + '55' : 'var(--border)'}`,
                  color:'var(--text)',
                }}>
                <div style={{
                  width:42, height:42, borderRadius:13, background:`${col}25`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'Outfit', fontWeight:800, fontSize:18, color:col, flexShrink:0,
                }}>
                  {p.nombre[0]}
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:15 }}>{p.nombre}</div>
                  {p.especialidad && <div style={{ fontSize:12, color:'var(--text-3)', marginTop:1 }}>{p.especialidad}</div>}
                </div>
                {profId === p.id && (
                  <div style={{ marginLeft:'auto', color:col }}>
                    <Ico d="M5 13l4 4L19 7" size={18} />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Step 1 — Servicio */}
        {step === 1 && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {servs.map(s => (
              <button key={s.id} onClick={() => setServId(s.id)}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'14px 16px', borderRadius:14, cursor:'pointer', textAlign:'left',
                  background: servId === s.id ? `${col}15` : 'var(--card)',
                  border: `1px solid ${servId === s.id ? col + '55' : 'var(--border)'}`,
                  color:'var(--text)',
                }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15 }}>{s.nombre}</div>
                  <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                    {s.duracion_min}min
                    {s.categoria ? ` · ${s.categoria}` : ''}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {s.precio > 0 && (
                    <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:15, color:col }}>
                      ${Number(s.precio).toLocaleString('es-CO')}
                    </span>
                  )}
                  {servId === s.id && <Ico d="M5 13l4 4L19 7" size={18} />}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — Fecha y hora */}
        {step === 2 && (
          <div>
            <input type="date" value={fecha} min={new Date().toISOString().slice(0,10)}
              onChange={e => { setFecha(e.target.value); setSlot(null) }}
              className="sp-input" style={{ marginBottom:16 }}
            />
            {sinHorario ? (
              <div style={{ textAlign:'center', padding:'24px 0' }}>
                <p style={{ fontSize:22, marginBottom:8 }}>😴</p>
                <p style={{ color:'var(--text-3)', fontSize:14, fontWeight:600 }}>
                  {profs.find(p => p.id === profId)?.nombre?.split(' ')[0] || 'El profesional'} no trabaja este día
                </p>
                <p style={{ color:'var(--text-3)', fontSize:12, marginTop:4 }}>
                  Elige otra fecha o configura sus horarios en Equipo
                </p>
              </div>
            ) : slots.length === 0 ? (
              <p style={{ color:'var(--text-3)', fontSize:14, textAlign:'center', padding:'20px 0' }}>
                Sin disponibilidad — todos los horarios están ocupados
              </p>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {slots.map(s => (
                  <button key={s.inicio} onClick={() => setSlot(s)}
                    style={{
                      padding:'12px 8px', borderRadius:12, cursor:'pointer',
                      background: slot?.inicio === s.inicio ? col : 'var(--card)',
                      border: `1px solid ${slot?.inicio === s.inicio ? col : 'var(--border)'}`,
                      color: slot?.inicio === s.inicio ? '#fff' : 'var(--text-2)',
                      fontFamily:'Outfit', fontWeight:700, fontSize:14,
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Cliente */}
        {step === 3 && (
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <button onClick={() => setModoNuevo(false)}
                style={{
                  flex:1, padding:'10px', borderRadius:12, cursor:'pointer',
                  background: !modoNuevo ? `${col}20` : 'var(--card)',
                  border: `1px solid ${!modoNuevo ? col + '55' : 'var(--border)'}`,
                  color: !modoNuevo ? col : 'var(--text-2)',
                  fontWeight:600, fontSize:13,
                }}>
                Buscar cliente
              </button>
              <button onClick={() => setModoNuevo(true)}
                style={{
                  flex:1, padding:'10px', borderRadius:12, cursor:'pointer',
                  background: modoNuevo ? `${col}20` : 'var(--card)',
                  border: `1px solid ${modoNuevo ? col + '55' : 'var(--border)'}`,
                  color: modoNuevo ? col : 'var(--text-2)',
                  fontWeight:600, fontSize:13,
                }}>
                Nuevo cliente
              </button>
            </div>

            {!modoNuevo ? (
              <>
                <input className="sp-input" placeholder="Buscar por nombre…"
                  value={busqCliente} onChange={e => setBusqCliente(e.target.value)}
                  style={{ marginBottom:10 }}
                />
                {clientes.map(c => (
                  <button key={c.id} onClick={() => { setClienteId(c.id); setBusqCliente(c.nombre) }}
                    style={{
                      width:'100%', display:'flex', alignItems:'center', gap:12,
                      padding:'12px 14px', borderRadius:12, cursor:'pointer', textAlign:'left',
                      marginBottom:6,
                      background: clienteId === c.id ? `${col}15` : 'var(--card)',
                      border: `1px solid ${clienteId === c.id ? col + '55' : 'var(--border)'}`,
                      color:'var(--text)',
                    }}>
                    <div style={{
                      width:36, height:36, borderRadius:10, background:`${col}25`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'Outfit', fontWeight:800, color:col, fontSize:16, flexShrink:0,
                    }}>{c.nombre[0]}</div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{c.nombre}</div>
                      <div style={{ fontSize:12, color:'var(--text-3)' }}>{c.telefono}</div>
                    </div>
                    {clienteId === c.id && <div style={{ marginLeft:'auto', color:col }}><Ico d="M5 13l4 4L19 7" size={16} /></div>}
                  </button>
                ))}
                {busqCliente.length > 1 && clientes.length === 0 && (
                  <p style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', padding:'12px 0' }}>Sin resultados</p>
                )}
              </>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <input className="sp-input" placeholder="Nombre completo *"
                  value={nuevoCliente.nombre} onChange={e => setNuevoCliente(p => ({...p, nombre:e.target.value}))} />
                <input className="sp-input" placeholder="Teléfono (WhatsApp)"
                  type="tel" value={nuevoCliente.telefono} onChange={e => setNuevoCliente(p => ({...p, telefono:e.target.value}))} />
              </div>
            )}
          </div>
        )}

        {/* Resumen + botones */}
        {step > 0 && (
          <div style={{
            marginTop:16, padding:'12px 14px', borderRadius:14,
            background:'var(--card)', border:'1px solid var(--border)', marginBottom:16,
          }}>
            <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:8, fontWeight:600, letterSpacing:0.5 }}>RESUMEN</div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {prof && <span style={{ fontSize:13, color:'var(--text-2)' }}>👤 {prof.nombre}</span>}
              {serv && <span style={{ fontSize:13, color:'var(--text-2)' }}>✂️ {serv.nombre}</span>}
              {slot && <span style={{ fontSize:13, color:'var(--text-2)' }}>🕐 {fecha} {slot.label}</span>}
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:10 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              style={{
                flex:1, padding:'15px', borderRadius:14, cursor:'pointer',
                background:'var(--card)', border:'1px solid var(--border)',
                color:'var(--text-2)', fontWeight:700, fontSize:15,
              }}>
              Atrás
            </button>
          )}
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext[step]}
              style={{
                flex:2, padding:'15px', borderRadius:14, cursor: canNext[step] ? 'pointer' : 'not-allowed',
                background: canNext[step] ? col : 'var(--card)',
                border:'none', color:'#fff', fontWeight:700, fontSize:15,
                opacity: canNext[step] ? 1 : 0.4,
                fontFamily:'Outfit',
              }}>
              Siguiente
            </button>
          ) : (
            <button onClick={guardar} disabled={saving || !canNext[3]}
              style={{
                flex:2, padding:'15px', borderRadius:14, cursor:'pointer',
                background: col, border:'none', color:'#fff', fontWeight:700, fontSize:15,
                opacity: saving ? 0.7 : 1, fontFamily:'Outfit',
              }}>
              {saving ? 'Guardando…' : 'Confirmar cita'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
