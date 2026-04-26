import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DSEM  = ['Do','Lu','Ma','Mi','Ju','Vi','Sá']
const DMAP  = {0:'domingo',1:'lunes',2:'martes',3:'miercoles',4:'jueves',5:'viernes',6:'sabado'}

const EDADES = [
  'Menor de 5 años','5–12 años','13–17 años','18–25 años',
  '26–35 años','36–45 años','46–55 años','56–65 años','Mayor de 65 años',
]
const MOTIVOS_PSICO = [
  'Problemas de memoria o concentración','Evaluación de desarrollo en niños',
  'TDAH / Dificultades de atención','Ansiedad / Depresión',
  'Secuelas de ACV o lesión cerebral','Demencia / Alzheimer (familiar)',
  'Peritaje laboral / Incapacidad cognitiva','Seguimiento de tratamiento',
  'Orientación a familia','Otro',
]

function dLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function tToMin(t) {
  const [h, m] = String(t).substring(0,5).split(':').map(Number)
  return h*60 + (m||0)
}

// ─── Icono SVG genérico ───────────────────────────────────────────────────────
function Icon({ d, size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <path d={d}/>
    </svg>
  )
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, children, icon, required }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        {icon && <Icon d={icon} size={13} />}
        {label}{required && <span className="text-rose-400">*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Chip de info ─────────────────────────────────────────────────────────────
function Chip({ icon, children, color }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ backgroundColor: `${color}18`, color }}>
      {icon && <Icon d={icon} size={12} />}
      {children}
    </span>
  )
}

// ─── Portal principal ─────────────────────────────────────────────────────────
export default function Portal() {
  const { slug } = useParams()
  const [tenant, setTenant]     = useState(null)
  const [profs, setProfs]       = useState([])
  const [servs, setServs]       = useState([])
  const [hors, setHors]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [step, setStep]           = useState(1)
  const [profId, setProfId]       = useState(null)
  const [servId, setServId]       = useState(null)
  const [modalidad, setModalidad] = useState(null)
  const [mOff, setMOff]           = useState(0)
  const [fecha, setFecha]         = useState(null)
  const [hora, setHora]           = useState(null)
  const [ocupados, setOcupados]   = useState([])

  const [nombre, setNombre]   = useState('')
  const [edad, setEdad]       = useState('')
  const [tel, setTel]         = useState('')
  const [mail, setMail]       = useState('')
  const [motivo, setMotivo]   = useState('')
  const [asiste, setAsiste]   = useState('El mismo paciente')
  const [notas, setNotas]     = useState('')

  const [saving, setSaving]         = useState(false)
  const [confirmada, setConfirmada] = useState(false)
  const [err, setErr]               = useState('')

  useEffect(() => { cargar() }, [slug])

  async function cargar() {
    const { data: t } = await supabase
      .from('tenants').select('*').eq('slug', slug).eq('activo', true).maybeSingle()
    if (!t) { setNotFound(true); setLoading(false); return }
    setTenant(t)
    const [{ data: p }, { data: s }, { data: h }] = await Promise.all([
      supabase.from('profesionales')
        .select('id,nombre,especialidad,color')
        .eq('tenant_id', t.id).eq('activo', true).order('nombre'),
      supabase.from('servicios')
        .select('id,nombre,descripcion,duracion_min,precio,profesional_servicios(profesional_id)')
        .eq('tenant_id', t.id).eq('activo', true).order('nombre'),
      supabase.from('horarios')
        .select('*').eq('tenant_id', t.id).eq('activo', true),
    ])
    const ps = p || []
    setProfs(ps); setServs(s || []); setHors(h || [])
    setLoading(false)
    if (ps.length === 1) { setProfId(ps[0].id); setStep(2) }
  }

  useEffect(() => {
    if (!profId || !fecha) { setOcupados([]); return }
    supabase.rpc('get_slots_ocupados', { p_profesional_id: profId, p_fecha: dLocal(fecha) })
      .then(({ data }) => setOcupados(data || []))
      .catch(() => setOcupados([]))
  }, [profId, fecha])

  const profSel  = profs.find(p => p.id === profId)
  const servSel  = servs.find(s => s.id === servId)
  const color    = tenant?.color_primario || '#3b82f6'
  const isPsico  = tenant?.vertical === 'psicologo'
  const soloProf = profs.length === 1

  // Color de acento: el teal del logo cuando el primario es muy oscuro
  const accent   = isPsico ? '#0d9488' : color

  const servsP = useMemo(() =>
    servs.filter(s => s.profesional_servicios?.some(x => x.profesional_id === profId)),
    [servs, profId]
  )

  const { dias, calMes, calAnio } = useMemo(() => {
    const hoy = new Date()
    const ref = new Date(hoy.getFullYear(), hoy.getMonth() + mOff, 1)
    const mes = ref.getMonth(), anio = ref.getFullYear()
    const enMes = new Date(anio, mes+1, 0).getDate()
    const diasHor = new Set(hors.filter(h => h.profesional_id === profId).map(h => h.dia))
    const hoyStr = dLocal(hoy)
    const celdas = Array(new Date(anio, mes, 1).getDay()).fill(null)
    for (let d = 1; d <= enMes; d++) {
      const dt = new Date(anio, mes, d)
      const k = dLocal(dt), dow = dt.getDay()
      const pasado = dt < hoy && k !== hoyStr
      celdas.push({
        n:d, dt, k,
        disp: !pasado && dow!==0 && dow!==6 && diasHor.has(DMAP[dow]),
        esHoy: k === hoyStr,
        sel: fecha ? dLocal(fecha) === k : false,
      })
    }
    return { dias: celdas, calMes: mes, calAnio: anio }
  }, [mOff, hors, profId, fecha])

  const slots = useMemo(() => {
    if (!profId || !fecha || !servSel) return []
    const h = hors.find(x => x.profesional_id === profId && x.dia === DMAP[fecha.getDay()])
    if (!h) return []
    const [hI,mI] = h.hora_inicio.split(':').map(Number)
    const [hF,mF] = h.hora_fin.split(':').map(Number)
    const dur  = servSel.duracion_min || 60
    const ocup = ocupados.map(o => ({ ini:tToMin(o.hora_inicio), fin:tToMin(o.hora_fin) }))
    const res  = []
    for (let t = hI*60+mI; t+dur <= hF*60+mF; t += 30) {
      if (!ocup.some(o => t < o.fin && (t+dur) > o.ini))
        res.push(`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`)
    }
    return res
  }, [profId, fecha, servSel, hors, ocupados])

  const slotsAM = slots.filter(s => parseInt(s) < 12)
  const slotsPM = slots.filter(s => parseInt(s) >= 12)

  async function confirmar() {
    setSaving(true); setErr('')
    const [h, m] = hora.split(':').map(Number)
    const ini = new Date(fecha); ini.setHours(h, m, 0, 0)
    const fin = new Date(ini.getTime() + servSel.duracion_min * 60000)
    const { data, error: rpcErr } = await supabase.rpc('crear_cita_publica', {
      p_tenant_id:        tenant.id,
      p_profesional_id:   profId,
      p_servicio_id:      servId,
      p_fecha_inicio:     ini.toISOString(),
      p_fecha_fin:        fin.toISOString(),
      p_cliente_nombre:   nombre.trim(),
      p_cliente_telefono: tel.trim() || null,
      p_cliente_email:    mail.trim() || null,
      p_modalidad:        modalidad || 'Presencial',
      p_edad:             edad || null,
      p_motivo:           motivo || null,
      p_quien_asiste:     isPsico ? asiste : null,
      p_notas:            notas || null,
    })
    setSaving(false)
    if (rpcErr || !data?.ok) { setErr(rpcErr?.message || data?.error || 'Error al confirmar'); return }
    setConfirmada(true)
  }

  function reiniciar() {
    setStep(soloProf ? 2 : 1)
    setProfId(soloProf ? profs[0].id : null)
    setServId(null); setModalidad(null); setFecha(null); setHora(null); setMOff(0)
    setNombre(''); setEdad(''); setTel(''); setMail('')
    setMotivo(''); setAsiste('El mismo paciente'); setNotas('')
    setConfirmada(false); setErr('')
  }

  const fechaLbl = fecha
    ? fecha.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })
    : ''

  const LABELS = soloProf
    ? ['Servicio','Modalidad','Horario','Datos','Confirmar']
    : ['Profesional','Servicio','Modalidad','Horario','Datos','Confirmar']
  const displayStep = soloProf ? step-1 : step
  const totalSteps  = LABELS.length

  // ── Estilos base input ──────────────────────────────────────────────────────
  const inputCls = `w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm
    text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white
    focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all`
  const selectCls = `${inputCls} appearance-none cursor-pointer`

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: isPsico ? '#0f172a' : '#f8fafc' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
             style={{ borderColor: accent }} />
        <p className="text-xs text-slate-400">Cargando agenda...</p>
      </div>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-xs">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Icon d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={28} className="text-slate-400" />
        </div>
        <p className="text-base font-bold text-slate-700">Agenda no encontrada</p>
        <p className="text-sm text-slate-400 mt-1">El enlace puede estar desactivado o ser incorrecto.</p>
      </div>
    </div>
  )

  // ── Pantalla de éxito ───────────────────────────────────────────────────────
  if (confirmada) {
    const [h2, m2] = hora.split(':').map(Number)
    const ini = new Date(fecha); ini.setHours(h2, m2)
    const fLbl = ini.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })
    const telNum = tel.replace(/\D/g,'')
    const waMsg = encodeURIComponent(
      `✅ *Cita confirmada — ${tenant.nombre}*\n\n` +
      `Hola ${nombre}, tu cita quedó agendada 🎉\n\n` +
      `📋 *Servicio:* ${servSel?.nombre}\n` +
      `📅 *Fecha:* ${fLbl}\n🕐 *Hora:* ${hora}\n` +
      (modalidad === 'Presencial'
        ? `📍 *Lugar:* ${tenant.direccion || tenant.ciudad || 'Consultorio'}`
        : '💻 *Modalidad:* Virtual — El link llegará antes de la cita') +
      `\n\n📱 Dudas: wa.me/57${tenant.whatsapp || ''}`
    )
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Ticket de cita */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            {/* Header del ticket */}
            <div className="px-6 pt-8 pb-6 text-center"
                 style={{ background: `linear-gradient(135deg, ${color} 0%, ${accent} 100%)` }}>
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h2 className="text-xl font-black text-white">¡Cita confirmada!</h2>
              <p className="text-white/70 text-sm mt-1">{tenant.nombre}</p>
            </div>

            {/* Separador diente de sierra */}
            <div className="flex">
              {Array.from({length: 12}).map((_,i) => (
                <div key={i} className="flex-1 h-3 bg-slate-50"
                     style={{
                       clipPath: i%2===0 ? 'polygon(0 100%, 50% 0, 100% 100%)' : 'polygon(0 0, 50% 100%, 100% 0)',
                       backgroundColor: i%2===0 ? '#f8fafc' : 'white'
                     }} />
              ))}
            </div>

            {/* Detalles */}
            <div className="px-6 py-5 space-y-3">
              {[
                { icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', label:'Paciente', value: nombre },
                { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', label:'Servicio', value: servSel?.nombre },
                { icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label:'Fecha', value: fLbl },
                { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label:'Hora', value: hora },
                { icon: modalidad==='Presencial'
                    ? 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z'
                    : 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
                  label:'Modalidad', value: modalidad },
                ...(servSel?.precio > 0 ? [{ icon:'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label:'Valor', value:`$${Number(servSel.precio).toLocaleString('es-CO')}` }] : []),
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 py-2 border-b border-dashed border-slate-100 last:border-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ backgroundColor: `${accent}15` }}>
                    <Icon d={icon} size={14} className="text-teal-600" />
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">{label}</span>
                    <span className="text-sm font-bold text-slate-800 text-right max-w-[60%]">{value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Acciones */}
            <div className="px-6 pb-7 pt-2 space-y-3">
              {telNum && (
                <a href={`https://wa.me/57${telNum}?text=${waMsg}`}
                   target="_blank" rel="noopener noreferrer"
                   className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl text-white font-bold text-sm bg-emerald-500 hover:bg-emerald-600 transition-colors active:scale-[0.98]">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Ver confirmación en WhatsApp
                </a>
              )}
              <button onClick={reiniciar}
                className="w-full py-3 rounded-2xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Reservar otra cita
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Layout principal ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f1f5f9' }}>

      {/* ── Header negocio ─────────────────────────────────────────────────── */}
      {isPsico ? (
        <div>
          <div className="bg-slate-900/95 backdrop-blur px-5 py-2.5 flex flex-wrap justify-center gap-x-6 gap-y-1.5">
            {tenant.direccion && (
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Icon d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" size={11} className="text-teal-500" />
                <span className="text-slate-300">{tenant.direccion}</span>
              </span>
            )}
            {tenant.whatsapp && (
              <a href={`https://wa.me/57${tenant.whatsapp}`} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-teal-400 transition-colors">
                <Icon d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" size={11} className="text-teal-500" />
                <span className="text-slate-300">{tenant.whatsapp}</span>
              </a>
            )}
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" size={11} className="text-teal-500" />
              <span className="text-slate-300">Lun–Vie · 8am–6pm</span>
            </span>
          </div>

          <div className="px-5 pt-10 pb-14 text-center relative overflow-hidden"
               style={{ background: 'linear-gradient(160deg, #0f172a 0%, #0f2d40 60%, #0d3d36 100%)' }}>
            {/* Anillo decorativo */}
            <div className="absolute inset-0 opacity-5"
                 style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #0d9488 0%, transparent 60%)' }} />

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"/>
              <span className="text-xs text-white/60 tracking-widest uppercase font-medium">
                Neuropsicología · Psicología Clínica
              </span>
            </div>

            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">{tenant.nombre}</h1>
            {tenant.descripcion && (
              <p className="text-white/55 text-sm max-w-sm mx-auto leading-relaxed">{tenant.descripcion}</p>
            )}

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {[
                { icon:'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', txt:'Atención profesional' },
                { icon:'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', txt:'Datos protegidos' },
              ].map(b => (
                <span key={b.txt} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-xs text-white/50">
                  <Icon d={b.icon} size={11} className="text-teal-400" /> {b.txt}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-10 px-4 text-center relative overflow-hidden"
             style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)` }}>
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 text-white text-2xl font-black">
            {tenant.nombre[0]}
          </div>
          <h1 className="text-2xl font-black text-white">{tenant.nombre}</h1>
          {tenant.descripcion && <p className="text-white/75 text-sm mt-1.5 max-w-xs mx-auto leading-relaxed">{tenant.descripcion}</p>}
          {tenant.ciudad && <p className="text-white/50 text-xs mt-1.5">{tenant.ciudad}</p>}
        </div>
      )}

      {/* ── Contenido del wizard ─────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* Progress indicator */}
        <div className="mb-5">
          {/* Barra visual */}
          <div className="relative h-1.5 bg-slate-200 rounded-full overflow-hidden mb-3">
            <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                 style={{ width: `${(displayStep/totalSteps)*100}%`, backgroundColor: accent }} />
          </div>
          {/* Labels */}
          <div className="flex justify-between">
            {LABELS.map((label, i) => (
              <div key={label} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mb-0.5 transition-all ${
                  displayStep > i+1 ? 'text-white' :
                  displayStep === i+1 ? 'text-white' :
                  'text-slate-300'
                }`}
                style={{
                  backgroundColor: displayStep > i+1 ? accent : displayStep === i+1 ? accent : '#e2e8f0'
                }}>
                  {displayStep > i+1
                    ? <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    : i+1
                  }
                </div>
                <span className={`text-[9px] font-semibold uppercase tracking-wide hidden sm:block ${
                  displayStep === i+1 ? 'text-slate-600' : 'text-slate-300'
                }`}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tarjeta del paso actual ──────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/80 overflow-hidden">

          {/* ── Paso 1: Profesional ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="p-6">
              <StepHeader
                icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                title="¿Con quién deseas tu cita?"
                subtitle="Selecciona el profesional"
                accent={accent}
              />
              <div className="space-y-3 mt-5">
                {profs.map(p => (
                  <button key={p.id}
                    onClick={() => { setProfId(p.id); setServId(null); setFecha(null); setHora(null); setStep(2) }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left hover:shadow-md active:scale-[0.99]"
                    style={{
                      borderColor: profId === p.id ? accent : '#f1f5f9',
                      backgroundColor: profId === p.id ? `${accent}08` : '#f8fafc'
                    }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-black flex-shrink-0 shadow-sm"
                         style={{ backgroundColor: p.color || accent }}>
                      {p.nombre[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm">{p.nombre}</p>
                      {p.especialidad && <p className="text-xs text-slate-400 mt-0.5">{p.especialidad}</p>}
                    </div>
                    <div className="flex-shrink-0">
                      {profId === p.id
                        ? <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: accent }}>
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                            </svg>
                          </div>
                        : <Icon d="M9 5l7 7-7 7" size={18} className="text-slate-300" />
                      }
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Paso 2: Servicio ─────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="p-6">
              <StepHeader
                icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                title="¿Qué servicio necesitas?"
                subtitle={profSel ? `Con ${profSel.nombre}` : 'Selecciona un servicio'}
                accent={accent}
              />
              <div className="space-y-2.5 mt-5">
                {servsP.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-sm">
                    Este profesional no tiene servicios disponibles
                  </div>
                ) : servsP.map(s => (
                  <button key={s.id}
                    onClick={() => { setServId(s.id); setFecha(null); setHora(null); setStep(3) }}
                    className="w-full flex items-start gap-3 p-4 rounded-2xl border-2 transition-all text-left hover:shadow-sm active:scale-[0.99]"
                    style={{
                      borderColor: servId === s.id ? accent : '#f1f5f9',
                      backgroundColor: servId === s.id ? `${accent}08` : '#f8fafc'
                    }}>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm leading-snug">{s.nombre}</p>
                      {s.descripcion && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{s.descripcion}</p>}
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5 ml-2 mt-0.5">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: `${accent}15`, color: accent }}>
                        {s.duracion_min} min
                      </span>
                      {s.precio > 0 && (
                        <span className="text-xs text-slate-400">${Number(s.precio).toLocaleString('es-CO')}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {!soloProf && (
                <BackBtn onClick={() => setStep(1)}>Cambiar profesional</BackBtn>
              )}
            </div>
          )}

          {/* ── Paso 3: Modalidad ────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="p-6">
              <StepHeader
                icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                title="Modalidad de atención"
                subtitle={servSel?.nombre}
                accent={accent}
              />
              <div className="grid grid-cols-2 gap-3 mt-5 mb-5">
                {[
                  {
                    key:'Presencial',
                    icon:'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
                    desc: tenant.direccion || (tenant.ciudad ? `Consultorio en ${tenant.ciudad}` : 'Atención en consultorio'),
                  },
                  {
                    key:'Virtual',
                    icon:'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
                    desc:'Videollamada (Google Meet / Zoom)',
                  },
                ].map(({ key, icon, desc }) => {
                  const sel = modalidad === key
                  return (
                    <button key={key} onClick={() => setModalidad(key)}
                      className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all active:scale-[0.98]"
                      style={{
                        borderColor: sel ? accent : '#f1f5f9',
                        backgroundColor: sel ? `${accent}08` : '#f8fafc',
                      }}>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors"
                           style={{ backgroundColor: sel ? `${accent}20` : '#e2e8f0' }}>
                        <Icon d={icon} size={22}
                              className={sel ? '' : 'text-slate-400'}
                              style={sel ? { color: accent } : {}} />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-slate-800 text-sm">{key}</p>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</p>
                      </div>
                      {sel && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center"
                             style={{ backgroundColor: accent }}>
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              <ContinueBtn onClick={() => { setFecha(null); setHora(null); setStep(4) }}
                           disabled={!modalidad} accent={accent}>
                Continuar
              </ContinueBtn>
              <BackBtn onClick={() => setStep(2)}>Cambiar servicio</BackBtn>
            </div>
          )}

          {/* ── Paso 4: Fecha + Hora ─────────────────────────────────────────── */}
          {step === 4 && (
            <div className="p-6">
              <StepHeader
                icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                title="Elige fecha y hora"
                subtitle={`${servSel?.nombre} · ${servSel?.duracion_min} min · ${modalidad}`}
                accent={accent}
              />

              {/* Nav mes */}
              <div className="flex items-center justify-between mt-5 mb-4">
                <button onClick={() => { if (mOff > 0) setMOff(v => v-1) }}
                  disabled={mOff === 0}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 disabled:opacity-30 transition-colors">
                  <Icon d="M15 19l-7-7 7-7" size={16} />
                </button>
                <span className="text-sm font-black text-slate-700 capitalize tracking-tight">
                  {MESES[calMes]} {calAnio}
                </span>
                <button onClick={() => setMOff(v => v+1)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 transition-colors">
                  <Icon d="M9 5l7 7-7 7" size={16} />
                </button>
              </div>

              {/* Días semana header */}
              <div className="grid grid-cols-7 mb-2">
                {DSEM.map(d => (
                  <p key={d} className="text-center text-[11px] font-bold text-slate-300 uppercase tracking-wide py-1">
                    {d}
                  </p>
                ))}
              </div>

              {/* Calendario */}
              <div className="grid grid-cols-7 gap-1 mb-5">
                {dias.map((d, i) => {
                  if (!d) return <div key={`e-${i}`} />
                  return (
                    <button key={d.k}
                      onClick={() => { if (d.disp) { setFecha(d.dt); setHora(null) } }}
                      disabled={!d.disp}
                      className="aspect-square flex items-center justify-center rounded-xl text-sm font-bold transition-all relative"
                      style={
                        d.sel
                          ? { backgroundColor: accent, color:'#fff', boxShadow:`0 4px 12px ${accent}40` }
                          : d.disp && d.esHoy
                            ? { border:`2px solid ${accent}`, color:accent }
                            : d.disp
                              ? { color:'#334155', backgroundColor:'#f8fafc' }
                              : { color:'#cbd5e1' }
                      }>
                      {d.n}
                    </button>
                  )
                })}
              </div>

              {/* Slots de hora */}
              {fecha && (
                <div className="mb-5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 capitalize">
                    {fechaLbl}
                  </p>
                  {slots.length === 0 ? (
                    <div className="py-6 text-center bg-slate-50 rounded-2xl border border-slate-100">
                      <Icon d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={24} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">Sin horarios disponibles para este día</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {slotsAM.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                            <Icon d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" size={12} />
                            Mañana
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {slotsAM.map(s => (
                              <SlotBtn key={s} hora={s} sel={hora===s} accent={accent} onClick={() => setHora(s)} />
                            ))}
                          </div>
                        </div>
                      )}
                      {slotsPM.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                            <Icon d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" size={12} />
                            Tarde
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {slotsPM.map(s => (
                              <SlotBtn key={s} hora={s} sel={hora===s} accent={accent} onClick={() => setHora(s)} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <ContinueBtn onClick={() => setStep(5)} disabled={!fecha || !hora} accent={accent}>
                Continuar
              </ContinueBtn>
              <BackBtn onClick={() => setStep(3)}>Cambiar modalidad</BackBtn>
            </div>
          )}

          {/* ── Paso 5: Datos ────────────────────────────────────────────────── */}
          {step === 5 && (
            <div className="p-6">
              <StepHeader
                icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                title="Tus datos de contacto"
                subtitle="Para confirmar y recordarte tu cita"
                accent={accent}
              />

              <div className="space-y-4 mt-5">
                <Field label="Nombre completo" required
                  icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z">
                  <input value={nombre} onChange={e => setNombre(e.target.value)}
                    placeholder="Nombres y apellidos completos"
                    autoFocus maxLength={200} className={inputCls} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Rango de edad"
                    icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857">
                    <div className="relative">
                      <select value={edad} onChange={e => setEdad(e.target.value)} className={selectCls}>
                        <option value="">Selecciona...</option>
                        {EDADES.map(e => <option key={e}>{e}</option>)}
                      </select>
                      <Icon d="M19 9l-7 7-7-7" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </Field>
                  <Field label="WhatsApp" required
                    icon="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z">
                    <input value={tel} onChange={e => setTel(e.target.value)}
                      placeholder="3XX XXX XXXX" type="tel" maxLength={20} className={inputCls} />
                  </Field>
                </div>

                <Field label="Email"
                  icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z">
                  <input value={mail} onChange={e => setMail(e.target.value)}
                    placeholder="tu@email.com" type="email" maxLength={200} className={inputCls} />
                </Field>

                {isPsico ? (
                  <Field label="Motivo de consulta"
                    icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                    <div className="relative">
                      <select value={motivo} onChange={e => setMotivo(e.target.value)} className={selectCls}>
                        <option value="">Selecciona el motivo principal...</option>
                        {MOTIVOS_PSICO.map(m => <option key={m}>{m}</option>)}
                      </select>
                      <Icon d="M19 9l-7 7-7-7" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </Field>
                ) : (
                  <Field label="Motivo de la visita"
                    icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                    <input value={motivo} onChange={e => setMotivo(e.target.value)}
                      placeholder="¿En qué te podemos ayudar?" className={inputCls} />
                  </Field>
                )}

                {isPsico && (
                  <Field label="¿Quién asiste a la cita?"
                    icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857">
                    <div className="grid grid-cols-3 gap-2">
                      {['El mismo paciente','Un menor de edad','Adulto mayor con familiar'].map(op => (
                        <button key={op} onClick={() => setAsiste(op)}
                          className="py-2.5 px-2 text-xs font-semibold rounded-xl border-2 transition-all text-center leading-tight"
                          style={{
                            borderColor: asiste === op ? accent : '#e2e8f0',
                            backgroundColor: asiste === op ? `${accent}10` : '#f8fafc',
                            color: asiste === op ? accent : '#94a3b8',
                          }}>
                          {op}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}

                <Field label="Información adicional (opcional)"
                  icon="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z">
                  <textarea value={notas} onChange={e => setNotas(e.target.value)}
                    placeholder="Ej: remitido por neurólogo, usa silla de ruedas, alguna alergia..."
                    rows={3} maxLength={2000} className={`${inputCls} resize-none`} />
                </Field>
              </div>

              <div className="mt-5">
                <ContinueBtn onClick={() => {
                  if (!nombre.trim()) { setErr('El nombre es requerido'); return }
                  if (!tel.trim()) { setErr('El WhatsApp es requerido'); return }
                  setErr(''); setStep(6)
                }} disabled={!nombre.trim() || !tel.trim()} accent={accent}>
                  Revisar y confirmar
                </ContinueBtn>
                {err && (
                  <p className="mt-2 text-xs text-rose-500 text-center font-medium">{err}</p>
                )}
              </div>
              <BackBtn onClick={() => setStep(4)}>Cambiar horario</BackBtn>
            </div>
          )}

          {/* ── Paso 6: Confirmar ────────────────────────────────────────────── */}
          {step === 6 && (
            <div className="p-6">
              <StepHeader
                icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                title="Revisa tu cita"
                subtitle="Todo listo para confirmar"
                accent={accent}
              />

              {/* Resumen visual */}
              <div className="mt-5 rounded-2xl overflow-hidden border border-slate-100">
                {/* Header del resumen */}
                <div className="px-4 py-3 flex items-center gap-3"
                     style={{ background: `linear-gradient(135deg, ${color} 0%, ${accent} 100%)` }}>
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                    <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-white/70 font-medium">Resumen de cita</p>
                    <p className="text-sm font-black text-white">{servSel?.nombre}</p>
                  </div>
                </div>

                {/* Items */}
                <div className="divide-y divide-slate-50">
                  {[
                    { icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label:'Fecha y hora', value:`${fechaLbl} · ${hora}` },
                    { icon:'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', label:'Modalidad', value: modalidad },
                    { icon:'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', label:'Paciente', value: nombre },
                    { icon:'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', label:'WhatsApp', value: tel },
                    ...(motivo ? [{ icon:'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label:'Motivo', value: motivo }] : []),
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 px-4 py-3">
                      <Icon d={icon} size={15} className="text-slate-300 flex-shrink-0" />
                      <span className="text-xs text-slate-400 w-24 flex-shrink-0">{label}</span>
                      <span className="text-sm font-semibold text-slate-700 flex-1 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aviso WhatsApp */}
              {tel && (
                <div className="mt-4 flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5">
                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Recibirás la confirmación por WhatsApp al número <b>{tel}</b>
                  </p>
                </div>
              )}

              {err && (
                <div className="mt-3 flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                  <Icon d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={14} className="text-rose-400 flex-shrink-0" />
                  <p className="text-xs text-rose-600">{err}</p>
                </div>
              )}

              <div className="mt-5">
                <button onClick={confirmar} disabled={saving}
                  className="w-full py-4 rounded-2xl text-white font-black text-sm disabled:opacity-60 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ backgroundColor: accent, boxShadow: `0 4px 20px ${accent}40` }}>
                  {saving ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Confirmando...</>
                  ) : (
                    <><Icon d="M5 13l4 4L19 7" size={16} /> Confirmar mi cita</>
                  )}
                </button>
              </div>
              <BackBtn onClick={() => setStep(5)}>Editar mis datos</BackBtn>
            </div>
          )}
        </div>
      </div>

      <div className="text-center pb-8 text-[11px] text-slate-300 tracking-wide">
        Agendas Pro · Soluciones digitales para profesionales de la salud
      </div>
    </div>
  )
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function StepHeader({ icon, title, subtitle, accent }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ backgroundColor: `${accent}15` }}>
        <Icon d={icon} size={20} style={{ color: accent }} />
      </div>
      <div>
        <h2 className="font-black text-slate-800 text-lg leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
    </div>
  )
}

function ContinueBtn({ onClick, disabled, children, accent }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full py-4 rounded-2xl text-white font-black text-sm disabled:opacity-35 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      style={!disabled ? { backgroundColor: accent, boxShadow:`0 4px 16px ${accent}35` } : { backgroundColor: accent }}>
      {children}
      {!disabled && <Icon d="M9 5l7 7-7 7" size={16} />}
    </button>
  )
}

function BackBtn({ onClick, children }) {
  return (
    <button onClick={onClick}
      className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors py-2">
      <Icon d="M15 19l-7-7 7-7" size={12} />
      {children}
    </button>
  )
}

function SlotBtn({ hora, sel, accent, onClick }) {
  return (
    <button onClick={onClick}
      className="py-3 rounded-xl text-sm font-bold border-2 transition-all active:scale-[0.96] text-center"
      style={sel
        ? { backgroundColor: accent, color:'#fff', borderColor: accent, boxShadow:`0 4px 12px ${accent}35` }
        : { backgroundColor:'#f8fafc', color:'#475569', borderColor:'#f1f5f9' }
      }>
      {hora}
    </button>
  )
}
