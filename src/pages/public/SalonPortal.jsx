import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const DIA_KEY = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado']

function fmtHora(iso) {
  if (!iso) return ''
  const [h, m] = iso.substring(11, 16).split(':')
  const hh = parseInt(h)
  return `${hh > 12 ? hh - 12 : hh || 12}:${m}${hh < 12 ? 'am' : 'pm'}`
}

function Spinner({ col = '#f43f5e' }) {
  return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#09090f' }}>
      <div style={{ width:36, height:36, border:`3px solid rgba(255,255,255,0.08)`, borderTopColor:col, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function SalonPortal() {
  const { slug } = useParams()

  const [tenant,    setTenant]    = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)

  // Datos del booking
  const [profs,      setProfs]      = useState([])
  const [servs,      setServs]      = useState([])
  const [slots,      setSlots]      = useState([])
  const [sinHorario, setSinHorario] = useState(false)
  const [cargandoSlots, setCargandoSlots] = useState(false)

  // Selecciones
  const [step,      setStep]     = useState(0)
  const [profId,    setProfId]   = useState(null)
  const [servId,    setServId]   = useState(null)
  const [fecha,     setFecha]    = useState(new Date().toISOString().slice(0, 10))
  const [slot,      setSlot]     = useState(null)

  // Datos cliente
  const [nombre,    setNombre]   = useState('')
  const [telefono,  setTelefono] = useState('')
  const [saving,    setSaving]   = useState(false)
  const [error,     setError]    = useState(null)
  const [confirmada, setConfirmada] = useState(null)

  // Lista de espera
  const [wlMode,    setWlMode]   = useState(false)  // mostrar form waitlist
  const [wlOk,      setWlOk]     = useState(false)  // confirmación enviada
  const [wlNombre,  setWlNombre] = useState('')
  const [wlTel,     setWlTel]    = useState('')
  const [wlSaving,  setWlSaving] = useState(false)

  // ── Cargar tenant ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: t } = await supabase.from('tenants')
        .select('*').eq('slug', slug).eq('activo', true).maybeSingle()
      if (!t) { setNotFound(true); setLoading(false); return }
      setTenant(t)
      const { data: ps } = await supabase.from('profesionales')
        .select('id, nombre, especialidad, foto_url')
        .eq('tenant_id', t.id).eq('activo', true).order('nombre')
      setProfs(ps || [])
      setLoading(false)
    }
    load()
  }, [slug])

  // ── Cargar servicios al elegir profesional ─────────────────────
  useEffect(() => {
    if (!profId || !tenant) return
    supabase.from('servicios')
      .select('id, nombre, precio, duracion_min, categoria')
      .eq('tenant_id', tenant.id).eq('activo', true).order('nombre')
      .then(({ data }) => setServs(data || []))
  }, [profId, tenant])

  // ── Generar slots al cambiar fecha/servicio ────────────────────
  useEffect(() => {
    if (!profId || !servId || !fecha) return
    const s = servs.find(x => x.id === servId)
    if (!s) return
    setSinHorario(false)
    setSlots([])
    setSlot(null)
    generarSlots(profId, fecha, s.duracion_min)
  }, [profId, servId, fecha])

  async function generarSlots(pId, f, durMin) {
    setCargandoSlots(true)
    const diaSemana = DIA_KEY[new Date(f + 'T12:00:00').getDay()]

    const { data: horario } = await supabase.from('horarios')
      .select('hora_inicio, hora_fin')
      .eq('profesional_id', pId).eq('dia', diaSemana).eq('activo', true)
      .maybeSingle()

    if (!horario) { setSinHorario(true); setCargandoSlots(false); return }

    const [hI, mI] = horario.hora_inicio.slice(0, 5).split(':').map(Number)
    const [hF, mF] = horario.hora_fin.slice(0, 5).split(':').map(Number)
    const inicioMin = hI * 60 + mI
    const finMin    = hF * 60 + mF

    const { data: ocupadas } = await supabase.from('citas')
      .select('fecha_inicio, fecha_fin')
      .eq('profesional_id', pId)
      .gte('fecha_inicio', `${f}T00:00:00`)
      .lte('fecha_inicio', `${f}T23:59:59`)
      .neq('estado', 'cancelada')

    const generados = []
    for (let h = inicioMin; h + durMin <= finMin; h += durMin) {
      const hh  = String(Math.floor(h / 60)).padStart(2, '0')
      const mm  = String(h % 60).padStart(2, '0')
      const ini = `${f}T${hh}:${mm}:00`
      const fin = new Date(new Date(ini).getTime() + durMin * 60000).toISOString().slice(0, 19)
      const ocupado = (ocupadas || []).some(c => c.fecha_inicio < fin && c.fecha_fin > ini)
      if (!ocupado) generados.push({ inicio: ini, fin, label: `${hh}:${mm}` })
    }
    setSlots(generados)
    setCargandoSlots(false)
  }

  // ── Confirmar cita ─────────────────────────────────────────────
  async function confirmar() {
    if (!nombre.trim()) { setError('Ingresa tu nombre'); return }
    if (!slot)          { setError('Selecciona un horario'); return }
    setSaving(true)
    setError(null)

    // Buscar o crear cliente por teléfono
    let clienteId
    if (telefono.trim()) {
      const { data: ex } = await supabase.from('clientes_agenda')
        .select('id').eq('tenant_id', tenant.id).eq('telefono', telefono.trim()).maybeSingle()
      if (ex) {
        clienteId = ex.id
      }
    }

    if (!clienteId) {
      const { data: nc, error: eCli } = await supabase.from('clientes_agenda')
        .insert({ tenant_id: tenant.id, nombre: nombre.trim(), telefono: telefono.trim() || null })
        .select('id').single()
      if (eCli) { setError('Error al registrar. Intenta de nuevo.'); setSaving(false); return }
      clienteId = nc.id
    }

    const { data: citaCreada, error: eCita } = await supabase.from('citas').insert({
      tenant_id:      tenant.id,
      profesional_id: profId,
      servicio_id:    servId,
      cliente_id:     clienteId,
      fecha_inicio:   slot.inicio,
      fecha_fin:      slot.fin,
      estado:         'confirmada',
    }).select('id').single()

    if (eCita) { setError('Error al agendar. Intenta de nuevo.'); setSaving(false); return }

    // Notificación WhatsApp al cliente y al salón (fire-and-forget)
    supabase.functions.invoke('notificacion-cita', {
      body: { cita_id: citaCreada.id },
    }).catch(() => {})

    setConfirmada({
      prof: profs.find(p => p.id === profId),
      serv: servs.find(s => s.id === servId),
      slot, fecha, nombre: nombre.trim(),
    })
    setStep(4)
    setSaving(false)
  }

  // ── Helpers ────────────────────────────────────────────────────
  const col  = tenant?.color_primario || '#f43f5e'
  const prof = profs.find(p => p.id === profId)
  const serv = servs.find(s => s.id === servId)

  function resetAll() {
    setStep(0); setProfId(null); setServId(null); setSlot(null)
    setFecha(new Date().toISOString().slice(0, 10))
    setNombre(''); setTelefono(''); setError(null); setConfirmada(null)
    setWlMode(false); setWlOk(false); setWlNombre(''); setWlTel('')
  }

  async function unirseEspera() {
    if (!wlNombre.trim()) return
    setWlSaving(true)
    // Buscar o crear cliente por teléfono
    let clienteId = null
    if (wlTel.trim()) {
      const { data: ex } = await supabase.from('clientes_agenda')
        .select('id').eq('tenant_id', tenant.id).eq('telefono', wlTel.trim()).maybeSingle()
      if (ex) clienteId = ex.id
    }
    if (!clienteId && wlNombre.trim()) {
      const { data: nc } = await supabase.from('clientes_agenda')
        .insert({ tenant_id: tenant.id, nombre: wlNombre.trim(), telefono: wlTel.trim() || null })
        .select('id').single()
      if (nc) clienteId = nc.id
    }
    await supabase.from('lista_espera').insert({
      tenant_id:        tenant.id,
      profesional_id:   profId,
      servicio_id:      servId,
      cliente_id:       clienteId,
      nombre_temporal:  clienteId ? null : wlNombre.trim(),
      telefono_temporal: clienteId ? null : wlTel.trim() || null,
      fecha_preferida:  fecha || null,
    })
    setWlSaving(false)
    setWlOk(true)
  }

  const inputStyle = {
    width:'100%', padding:'15px 16px', borderRadius:14,
    background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
    color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box',
    fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",
  }

  // ── Renders ────────────────────────────────────────────────────
  if (loading)  return <Spinner col="#f43f5e" />
  if (notFound) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#09090f', padding:24 }}>
      <div style={{ textAlign:'center', color:'#fff' }}>
        <p style={{ fontSize:44, marginBottom:16 }}>🔍</p>
        <p style={{ fontFamily:'Outfit', fontWeight:800, fontSize:22 }}>Salón no encontrado</p>
        <p style={{ fontSize:14, color:'rgba(255,255,255,0.4)', marginTop:8 }}>Verifica el link que te compartieron</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100dvh', background:'#09090f', color:'#fff', fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>

      {/* ── Header salón ── */}
      <div style={{ background:`linear-gradient(160deg, ${col}28, ${col}08)`, borderBottom:`1px solid ${col}25`, padding:'20px 20px 18px', position:'sticky', top:0, zIndex:10, backdropFilter:'blur(12px)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, maxWidth:520, margin:'0 auto' }}>
          <div style={{ width:48, height:48, borderRadius:15, background:`linear-gradient(135deg,${col},${col}99)`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Outfit', fontWeight:900, fontSize:20, color:'#fff', boxShadow:`0 4px 18px ${col}44`, flexShrink:0, overflow:'hidden' }}>
            {tenant.logo_url
              ? <img src={tenant.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : tenant.nombre[0]
            }
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:18, color:'#fff', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
              {tenant.nombre}
            </div>
            {tenant.descripcion && (
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:2, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                {tenant.descripcion}
              </div>
            )}
            {!tenant.descripcion && tenant.ciudad && (
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:2 }}>📍 {tenant.ciudad}</div>
            )}
          </div>
          {step > 0 && step < 4 && (
            <div style={{ fontSize:12, color:`${col}cc`, fontWeight:700, flexShrink:0 }}>{step}/3</div>
          )}
        </div>
      </div>

      {/* ── Banner de promoción ── */}
      {tenant.config_vertical?.promo && step < 4 && (
        <div style={{ background:`linear-gradient(90deg,${col}22,${col}10)`, borderBottom:`1px solid ${col}20`, padding:'10px 20px' }}>
          <p style={{ maxWidth:520, margin:'0 auto', fontSize:13, color:`${col}ee`, fontWeight:600, textAlign:'center' }}>
            {tenant.config_vertical.promo}
          </p>
        </div>
      )}

      {/* ── Barra de progreso ── */}
      {step > 0 && step < 4 && (
        <div style={{ display:'flex', gap:4, padding:'0 20px', background:'rgba(0,0,0,0.3)' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ flex:1, height:2, background: i <= step ? col : 'rgba(255,255,255,0.08)', transition:'background 0.3s' }} />
          ))}
        </div>
      )}

      <div style={{ maxWidth:520, margin:'0 auto', padding:'28px 20px 40px' }}>

        {/* ── STEP 4: Confirmación ── */}
        {step === 4 && confirmada && (
          <div style={{ textAlign:'center' }}>
            <div style={{ width:80, height:80, borderRadius:24, background:`${col}18`, border:`2px solid ${col}50`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px', fontSize:38 }}>
              ✅
            </div>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:26, marginBottom:8 }}>
              ¡Cita confirmada!
            </h2>
            <p style={{ color:'rgba(255,255,255,0.45)', marginBottom:32, fontSize:15 }}>
              Te esperamos, {confirmada.nombre.split(' ')[0]} 🙌
            </p>

            {/* Resumen confirmación */}
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'20px 20px', textAlign:'left', marginBottom:28 }}>
              {[
                { emoji:'👤', txt: confirmada.prof?.nombre },
                { emoji:'✂️', txt: confirmada.serv?.nombre },
                {
                  emoji:'📅',
                  txt: new Date(confirmada.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' }),
                },
                { emoji:'🕐', txt: fmtHora(confirmada.slot.inicio) },
                ...(confirmada.serv?.precio > 0
                  ? [{ emoji:'💰', txt: `$${Number(confirmada.serv.precio).toLocaleString('es-CO')}` }]
                  : []),
              ].map((row, i, arr) => (
                <div key={i} style={{
                  display:'flex', gap:14, padding:'11px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  alignItems:'center',
                }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{row.emoji}</span>
                  <span style={{ fontSize:14, color:'rgba(255,255,255,0.8)', lineHeight:1.4 }}>{row.txt}</span>
                </div>
              ))}
            </div>

            {/* WhatsApp CTA post-confirmación */}
            {tenant.whatsapp && (
              <a href={`https://wa.me/57${tenant.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${tenant.nombre}, acabo de agendar una cita para el ${new Date(confirmada.fecha+'T12:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})} a las ${confirmada.slot.label} con ${confirmada.prof?.nombre}. Mi nombre es ${confirmada.nombre}.`)}`}
                target="_blank" rel="noopener noreferrer" style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                  width:'100%', padding:'16px', borderRadius:16, marginBottom:12,
                  background:'rgba(37,211,102,0.12)', border:'1px solid rgba(37,211,102,0.3)',
                  color:'#25d166', fontFamily:'Outfit', fontWeight:700, fontSize:15,
                  textDecoration:'none', boxSizing:'border-box',
                }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="#25d166">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.556 4.126 1.527 5.857L0 24l6.305-1.654A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.907 0-3.687-.512-5.217-1.406l-.374-.222-3.744.982.999-3.648-.244-.375A9.778 9.778 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
                </svg>
                Confirmar por WhatsApp
              </a>
            )}

            <button onClick={resetAll} style={{
              width:'100%', padding:'16px', borderRadius:16,
              background:`${col}15`, border:`1px solid ${col}35`,
              color:col, fontFamily:'Outfit', fontWeight:700, fontSize:15, cursor:'pointer',
            }}>
              Agendar otra cita
            </button>
          </div>
        )}

        {/* ── STEP 0: Elegir profesional ── */}
        {step === 0 && (
          <>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:24, marginBottom:6 }}>
              ¿Con quién quieres tu cita?
            </h2>
            <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, marginBottom:28 }}>
              Elige tu profesional favorito
            </p>

            {profs.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <p style={{ fontSize:32, marginBottom:12 }}>🚧</p>
                <p style={{ color:'rgba(255,255,255,0.5)', fontSize:15 }}>Sin profesionales disponibles</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {profs.map(p => (
                  <button key={p.id} onClick={() => { setProfId(p.id); setStep(1) }} style={{
                    display:'flex', alignItems:'center', gap:16, padding:'18px 20px', borderRadius:20,
                    background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)',
                    color:'#fff', cursor:'pointer', textAlign:'left', width:'100%',
                    transition:'all 0.12s',
                  }}>
                    <div style={{ width:52, height:52, borderRadius:16, background:`${col}28`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Outfit', fontWeight:800, fontSize:22, color:col, flexShrink:0 }}>
                      {p.foto_url
                        ? <img src={p.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit' }} />
                        : p.nombre[0]
                      }
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:16 }}>{p.nombre}</div>
                      {p.especialidad && (
                        <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginTop:3 }}>{p.especialidad}</div>
                      )}
                    </div>
                    <span style={{ color:`${col}90`, fontSize:22, flexShrink:0 }}>›</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── STEP 1: Elegir servicio ── */}
        {step === 1 && (
          <>
            <button onClick={() => setStep(0)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.45)', cursor:'pointer', marginBottom:20, fontSize:14, padding:0, display:'flex', alignItems:'center', gap:4 }}>
              ‹ Volver
            </button>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:24, marginBottom:6 }}>
              ¿Qué servicio quieres?
            </h2>
            <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, marginBottom:28 }}>
              Con {prof?.nombre?.split(' ')[0]}
            </p>

            {servs.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <p style={{ fontSize:32, marginBottom:12 }}>✂️</p>
                <p style={{ color:'rgba(255,255,255,0.5)', fontSize:15 }}>Sin servicios disponibles</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {servs.map(s => (
                  <button key={s.id} onClick={() => { setServId(s.id); setStep(2) }} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between', gap:14,
                    padding:'18px 20px', borderRadius:18, cursor:'pointer', textAlign:'left', width:'100%',
                    background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)',
                    color:'#fff', transition:'all 0.12s',
                  }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:15 }}>{s.nombre}</div>
                      <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginTop:3 }}>
                        {s.duracion_min}min{s.categoria ? ` · ${s.categoria}` : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                      {s.precio > 0 && (
                        <span style={{ fontFamily:'Outfit', fontWeight:800, fontSize:17, color:col }}>
                          ${Number(s.precio).toLocaleString('es-CO')}
                        </span>
                      )}
                      <span style={{ color:`${col}90`, fontSize:22 }}>›</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── STEP 2: Fecha y hora ── */}
        {step === 2 && (
          <>
            <button onClick={() => setStep(1)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.45)', cursor:'pointer', marginBottom:20, fontSize:14, padding:0, display:'flex', alignItems:'center', gap:4 }}>
              ‹ Volver
            </button>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:24, marginBottom:6 }}>¿Cuándo?</h2>
            <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, marginBottom:24 }}>
              {serv?.nombre} · {serv?.duracion_min}min
            </p>

            <input type="date" value={fecha} min={new Date().toISOString().slice(0, 10)}
              onChange={e => { setFecha(e.target.value); setSlot(null) }}
              style={{ ...inputStyle, marginBottom:24 }}
            />

            {cargandoSlots ? (
              <div style={{ display:'flex', justifyContent:'center', padding:'32px 0' }}>
                <div style={{ width:28, height:28, border:`3px solid rgba(255,255,255,0.08)`, borderTopColor:col, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
              </div>
            ) : sinHorario ? (
              <div style={{ textAlign:'center', padding:'32px 0' }}>
                <p style={{ fontSize:36, marginBottom:12 }}>😴</p>
                <p style={{ fontWeight:700, fontSize:16 }}>{prof?.nombre?.split(' ')[0]} no trabaja este día</p>
                <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginTop:8 }}>Elige otra fecha</p>
              </div>
            ) : slots.length === 0 && fecha ? (
              <div>
                {wlOk ? (
                  /* ── Confirmación lista de espera ── */
                  <div style={{ textAlign:'center', padding:'32px 0' }}>
                    <div style={{ fontSize:56, marginBottom:16 }}>🔔</div>
                    <p style={{ fontFamily:'Outfit', fontWeight:800, fontSize:22, marginBottom:8 }}>¡Te anotamos!</p>
                    <p style={{ fontSize:14, color:'rgba(255,255,255,0.45)', marginBottom:28, lineHeight:1.6 }}>
                      En cuanto haya un espacio disponible para{' '}
                      <strong style={{ color:'rgba(255,255,255,0.75)' }}>{serv?.nombre}</strong>{' '}
                      con <strong style={{ color:'rgba(255,255,255,0.75)' }}>{prof?.nombre?.split(' ')[0]}</strong>,
                      te enviamos un WhatsApp.
                    </p>
                    <button onClick={() => { setWlMode(false); setWlOk(false); setWlNombre(''); setWlTel('') }}
                      style={{ padding:'13px 28px', borderRadius:14, background:'rgba(255,255,255,0.06)',
                        border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)',
                        fontWeight:600, fontSize:14, cursor:'pointer' }}>
                      Buscar otra fecha
                    </button>
                  </div>
                ) : wlMode ? (
                  /* ── Formulario lista de espera ── */
                  <div>
                    <button onClick={() => setWlMode(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.45)', cursor:'pointer', marginBottom:20, fontSize:14, padding:0, display:'flex', alignItems:'center', gap:4 }}>
                      ‹ Volver
                    </button>
                    <div style={{ fontSize:40, marginBottom:16, textAlign:'center' }}>🔔</div>
                    <h3 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:22, marginBottom:8, textAlign:'center' }}>
                      Lista de espera
                    </h3>
                    <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginBottom:28, textAlign:'center', lineHeight:1.6 }}>
                      Te avisamos cuando {prof?.nombre?.split(' ')[0]} tenga un espacio libre para {serv?.nombre}
                      {fecha ? ` el ${new Date(fecha+'T12:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'long'})}` : ''}.
                    </p>
                    <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:24 }}>
                      <div>
                        <label style={{ fontSize:12, color:'rgba(255,255,255,0.4)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:8 }}>TU NOMBRE *</label>
                        <input value={wlNombre} onChange={e => setWlNombre(e.target.value)}
                          placeholder="Nombre completo" style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize:12, color:'rgba(255,255,255,0.4)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:8 }}>WHATSAPP (para avisarte)</label>
                        <input value={wlTel} onChange={e => setWlTel(e.target.value)}
                          placeholder="Ej: 3001234567" type="tel" style={inputStyle} />
                      </div>
                    </div>
                    <button onClick={unirseEspera} disabled={!wlNombre.trim() || wlSaving} style={{
                      width:'100%', padding:'17px', borderRadius:16,
                      background: wlNombre.trim() ? `linear-gradient(135deg,${col},${col}cc)` : 'rgba(255,255,255,0.07)',
                      border:'none', color:'#fff', fontFamily:'Outfit', fontWeight:700, fontSize:16,
                      cursor: wlNombre.trim() ? 'pointer' : 'not-allowed',
                      opacity: wlNombre.trim() ? 1 : 0.5,
                      boxShadow: wlNombre.trim() ? `0 6px 24px ${col}44` : 'none',
                    }}>
                      {wlSaving ? 'Guardando…' : '🔔 Avisarme cuando haya espacio'}
                    </button>
                    <p style={{ fontSize:12, color:'rgba(255,255,255,0.2)', textAlign:'center', marginTop:14 }}>
                      No te haremos spam. Solo un aviso cuando haya disponibilidad.
                    </p>
                  </div>
                ) : (
                  /* ── Sin slots + botón unirse ── */
                  <div style={{ textAlign:'center', padding:'32px 0' }}>
                    <p style={{ fontSize:40, marginBottom:14 }}>😕</p>
                    <p style={{ fontFamily:'Outfit', fontWeight:700, fontSize:18, marginBottom:8 }}>Sin disponibilidad</p>
                    <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginTop:0, marginBottom:28, lineHeight:1.6 }}>
                      Todos los horarios están ocupados.
                      <br />Elige otra fecha o te avisamos cuando se libere un espacio.
                    </p>
                    <button onClick={() => setWlMode(true)} style={{
                      width:'100%', padding:'16px', borderRadius:16,
                      background:`${col}15`, border:`1px solid ${col}45`,
                      color:col, fontFamily:'Outfit', fontWeight:700, fontSize:15,
                      cursor:'pointer', marginBottom:12,
                    }}>
                      🔔 Avisarme cuando haya espacio
                    </button>
                    <p style={{ fontSize:12, color:'rgba(255,255,255,0.25)' }}>
                      o elige otra fecha arriba
                    </p>
                  </div>
                )}
              </div>
            ) : slots.length > 0 ? (
              <>
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:700, letterSpacing:1, marginBottom:14, textTransform:'uppercase' }}>
                  Horarios disponibles
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:28 }}>
                  {slots.map(s => (
                    <button key={s.inicio} onClick={() => setSlot(s)} style={{
                      padding:'14px 6px', borderRadius:14, cursor:'pointer',
                      background: slot?.inicio === s.inicio ? col : 'rgba(255,255,255,0.05)',
                      border:     `1px solid ${slot?.inicio === s.inicio ? col : 'rgba(255,255,255,0.09)'}`,
                      color:      slot?.inicio === s.inicio ? '#fff' : 'rgba(255,255,255,0.65)',
                      fontFamily:'Outfit', fontWeight:700, fontSize:14, transition:'all 0.12s',
                    }}>
                      {s.label}
                    </button>
                  ))}
                </div>
                {slot && (
                  <button onClick={() => setStep(3)} style={{
                    width:'100%', padding:'17px', borderRadius:16,
                    background:`linear-gradient(135deg,${col},${col}cc)`,
                    border:'none', color:'#fff', fontFamily:'Outfit', fontWeight:700, fontSize:16,
                    cursor:'pointer', boxShadow:`0 6px 24px ${col}44`,
                  }}>
                    Continuar con las {slot.label}
                  </button>
                )}
              </>
            ) : null}
          </>
        )}

        {/* ── STEP 3: Datos del cliente ── */}
        {step === 3 && (
          <>
            <button onClick={() => setStep(2)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.45)', cursor:'pointer', marginBottom:20, fontSize:14, padding:0, display:'flex', alignItems:'center', gap:4 }}>
              ‹ Volver
            </button>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:24, marginBottom:6 }}>Tus datos</h2>
            <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, marginBottom:24 }}>Para confirmar tu cita</p>

            {/* Resumen de la reserva */}
            <div style={{ background:`${col}12`, border:`1px solid ${col}28`, borderRadius:20, padding:'16px 18px', marginBottom:28 }}>
              <div style={{ fontSize:11, color:col, fontWeight:700, letterSpacing:1, marginBottom:12 }}>TU RESERVA</div>
              {[
                { emoji:'👤', txt: prof?.nombre },
                { emoji:'✂️', txt: `${serv?.nombre} · ${serv?.duracion_min}min` },
                {
                  emoji:'📅',
                  txt: new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' }) + ' a las ' + slot?.label,
                },
                ...(serv?.precio > 0
                  ? [{ emoji:'💰', txt: `$${Number(serv.precio).toLocaleString('es-CO')}` }]
                  : []),
              ].map((r, i, arr) => (
                <div key={i} style={{
                  display:'flex', gap:12, padding:'8px 0',
                  borderBottom: i < arr.length - 1 ? `1px solid ${col}18` : 'none',
                  alignItems:'center',
                }}>
                  <span>{r.emoji}</span>
                  <span style={{ fontSize:14, color:'rgba(255,255,255,0.75)' }}>{r.txt}</span>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:24 }}>
              <div>
                <label style={{ fontSize:12, color:'rgba(255,255,255,0.4)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:8 }}>TU NOMBRE *</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Nombre completo" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize:12, color:'rgba(255,255,255,0.4)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:8 }}>TELÉFONO / WHATSAPP</label>
                <input value={telefono} onChange={e => setTelefono(e.target.value)}
                  placeholder="Ej: 3001234567" type="tel" style={inputStyle} />
              </div>
            </div>

            {error && (
              <p style={{ color:'#f87171', fontSize:13, marginBottom:16, textAlign:'center', padding:'10px 14px', background:'rgba(239,68,68,0.08)', borderRadius:10 }}>
                {error}
              </p>
            )}

            <button onClick={confirmar} disabled={saving || !nombre.trim()} style={{
              width:'100%', padding:'17px', borderRadius:16,
              background: `linear-gradient(135deg,${col},${col}cc)`,
              border:'none', color:'#fff', fontFamily:'Outfit', fontWeight:700, fontSize:16,
              cursor: (saving || !nombre.trim()) ? 'not-allowed' : 'pointer',
              opacity: (saving || !nombre.trim()) ? 0.55 : 1,
              boxShadow: (saving || !nombre.trim()) ? 'none' : `0 6px 24px ${col}44`,
              transition:'all 0.15s',
            }}>
              {saving ? 'Confirmando…' : '¡Confirmar cita!'}
            </button>

            <p style={{ fontSize:12, color:'rgba(255,255,255,0.25)', textAlign:'center', marginTop:16 }}>
              Al confirmar aceptas que el salón guarde tus datos de contacto
            </p>
          </>
        )}
      </div>

      {/* ── Footer del negocio ── */}
      {step < 4 && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', padding:'28px 20px', textAlign:'center' }}>
          <div style={{ maxWidth:520, margin:'0 auto', display:'flex', flexDirection:'column', gap:10 }}>
            {tenant.config_vertical?.horario_texto && (
              <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>
                🕐 {tenant.config_vertical.horario_texto}
              </p>
            )}
            {(tenant.direccion || tenant.ciudad) && (
              <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>
                📍 {[tenant.direccion, tenant.ciudad].filter(Boolean).join(', ')}
              </p>
            )}
            {tenant.email && (
              <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)' }}>
                ✉️ {tenant.email}
              </p>
            )}
            {tenant.whatsapp && (
              <a href={`https://wa.me/57${tenant.whatsapp.replace(/\D/g,'')}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, padding:'11px 22px', borderRadius:12, background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.25)', color:'#25d166', textDecoration:'none', fontWeight:700, fontSize:14, margin:'4px auto 0' }}>
                <svg width={17} height={17} viewBox="0 0 24 24" fill="#25d166">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.556 4.126 1.527 5.857L0 24l6.305-1.654A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.907 0-3.687-.512-5.217-1.406l-.374-.222-3.744.982.999-3.648-.244-.375A9.778 9.778 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
                </svg>
                {tenant.whatsapp}
              </a>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
        input::placeholder { color: rgba(255,255,255,0.25); }
        button:hover { opacity: 0.88; }
        a:hover { opacity: 0.85; }
      `}</style>
    </div>
  )
}
