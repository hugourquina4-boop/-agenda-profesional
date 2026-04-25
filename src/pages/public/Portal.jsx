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
  const [h, m] = String(t).substring(0, 5).split(':').map(Number)
  return h * 60 + (m || 0)
}

// ─── Portal público ────────────────────────────────────────────────────────────
export default function Portal() {
  const { slug } = useParams()
  const [tenant, setTenant]     = useState(null)
  const [profs, setProfs]       = useState([])
  const [servs, setServs]       = useState([])
  const [hors, setHors]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Wizard
  const [step, setStep]           = useState(1)
  const [profId, setProfId]       = useState(null)
  const [servId, setServId]       = useState(null)
  const [modalidad, setModalidad] = useState(null)
  const [mOff, setMOff]           = useState(0)
  const [fecha, setFecha]         = useState(null)
  const [hora, setHora]           = useState(null)
  const [ocupados, setOcupados]   = useState([])

  // Formulario
  const [nombre, setNombre]   = useState('')
  const [edad, setEdad]       = useState('')
  const [tel, setTel]         = useState('')
  const [mail, setMail]       = useState('')
  const [motivo, setMotivo]   = useState('')
  const [asiste, setAsiste]   = useState('El mismo paciente')
  const [notas, setNotas]     = useState('')

  const [saving, setSaving]   = useState(false)
  const [confirmada, setConfirmada] = useState(false)
  const [err, setErr]         = useState('')

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

  // Cargar slots ocupados al seleccionar fecha
  useEffect(() => {
    if (!profId || !fecha) { setOcupados([]); return }
    supabase.rpc('get_slots_ocupados', { p_profesional_id: profId, p_fecha: dLocal(fecha) })
      .then(({ data }) => setOcupados(data || []))
      .catch(() => setOcupados([]))
  }, [profId, fecha])

  const profSel = profs.find(p => p.id === profId)
  const servSel = servs.find(s => s.id === servId)
  const color   = tenant?.color_primario || '#3b82f6'
  const isPsico = tenant?.vertical === 'psicologo'
  const soloProf = profs.length === 1

  const servsP = useMemo(() =>
    servs.filter(s => s.profesional_servicios?.some(x => x.profesional_id === profId)),
    [servs, profId]
  )

  // Calendario mensual
  const { dias, calMes, calAnio } = useMemo(() => {
    const hoy = new Date()
    const ref = new Date(hoy.getFullYear(), hoy.getMonth() + mOff, 1)
    const mes = ref.getMonth(), anio = ref.getFullYear()
    const enMes = new Date(anio, mes + 1, 0).getDate()
    const diasHor = new Set(hors.filter(h => h.profesional_id === profId).map(h => h.dia))
    const hoyStr = dLocal(hoy)
    const celdas = Array(new Date(anio, mes, 1).getDay()).fill(null)
    for (let d = 1; d <= enMes; d++) {
      const dt = new Date(anio, mes, d)
      const k = dLocal(dt), dow = dt.getDay()
      const pasado = dt < hoy && k !== hoyStr
      celdas.push({
        n: d, dt, k,
        disp: !pasado && dow !== 0 && dow !== 6 && diasHor.has(DMAP[dow]),
        esHoy: k === hoyStr,
        sel: fecha ? dLocal(fecha) === k : false,
      })
    }
    return { dias: celdas, calMes: mes, calAnio: anio }
  }, [mOff, hors, profId, fecha])

  // Slots disponibles (excluyendo ocupados)
  const slots = useMemo(() => {
    if (!profId || !fecha || !servSel) return []
    const h = hors.find(x => x.profesional_id === profId && x.dia === DMAP[fecha.getDay()])
    if (!h) return []
    const [hI, mI] = h.hora_inicio.split(':').map(Number)
    const [hF, mF] = h.hora_fin.split(':').map(Number)
    const dur  = servSel.duracion_min || 60
    const ocup = ocupados.map(o => ({ ini: tToMin(o.hora_inicio), fin: tToMin(o.hora_fin) }))
    const res  = []
    for (let t = hI*60+mI; t + dur <= hF*60+mF; t += 30) {
      if (!ocup.some(o => t < o.fin && (t + dur) > o.ini))
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

  // Estilos reutilizables
  const inp = 'w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 focus:outline-none shadow-sm transition-colors'
  const sel = 'w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 focus:outline-none shadow-sm appearance-none'

  const fechaLbl = fecha
    ? fecha.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })
    : ''

  // Progress bar
  const LABELS = soloProf
    ? ['Servicio','Modalidad','Horario','Datos','Confirmar']
    : ['Profesional','Servicio','Modalidad','Horario','Datos','Confirmar']
  const displayStep = soloProf ? step - 1 : step

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: color }}/>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center text-gray-500">
        <p className="text-lg font-semibold">Agenda no encontrada</p>
        <p className="text-sm mt-1">El enlace puede estar desactivado o ser incorrecto.</p>
      </div>
    </div>
  )

  // ── Pantalla de confirmación exitosa ─────────────────────────────────────────
  if (confirmada) {
    const [h2, m2] = hora.split(':').map(Number)
    const ini = new Date(fecha); ini.setHours(h2, m2)
    const fLbl = ini.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })
    const telNum = tel.replace(/\D/g, '')
    const waMsg  = encodeURIComponent(
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-sm w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: color }}>
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">¡Cita confirmada!</h2>
            <p className="text-gray-500 text-sm">Te esperamos pronto en {tenant.nombre}</p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm mb-5">
            {[
              ['Paciente', nombre],
              ['Servicio', servSel?.nombre],
              ['Modalidad', modalidad],
              ['Fecha', fLbl],
              ['Hora', hora],
              ...(servSel?.precio > 0 ? [['Valor', `$${Number(servSel.precio).toLocaleString('es-CO')}`]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-start gap-2 py-1 border-b border-gray-100 last:border-0">
                <span className="text-gray-400 flex-shrink-0">{k}:</span>
                <span className="font-semibold text-gray-800 text-right">{v}</span>
              </div>
            ))}
          </div>

          {telNum && (
            <a
              href={`https://wa.me/57${telNum}?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-bold mb-3"
              style={{ backgroundColor: '#25d366' }}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Ver confirmación en WhatsApp
            </a>
          )}

          <button onClick={reiniciar}
            className="w-full py-3 rounded-2xl text-white text-sm font-semibold"
            style={{ backgroundColor: color }}>
            Reservar otra cita
          </button>
        </div>
      </div>
    )
  }

  // ── Layout del wizard ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header negocio */}
      {isPsico ? (
        <div>
          {/* Topbar info */}
          <div className="bg-slate-900 px-4 py-2 flex flex-wrap justify-center gap-x-5 gap-y-1">
            {tenant.direccion && (
              <span className="flex items-center gap-1.5 text-xs text-white/60">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <strong className="text-white/80">{tenant.direccion}</strong>
              </span>
            )}
            {tenant.whatsapp && (
              <span className="flex items-center gap-1.5 text-xs text-white/60">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                <strong className="text-white/80">{tenant.whatsapp}</strong>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-white/60">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <strong className="text-white/80">Lun–Vie 8am–6pm</strong>
            </span>
          </div>
          {/* Hero */}
          <div className="px-4 pt-10 pb-16 text-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)' }}>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs text-white/70 uppercase tracking-widest mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"/>
              Neuropsicología · Psicología Clínica
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{tenant.nombre}</h1>
            {tenant.descripcion && <p className="text-white/70 text-sm max-w-sm mx-auto leading-relaxed">{tenant.descripcion}</p>}
          </div>
        </div>
      ) : (
        <div className="py-8 px-4 text-center" style={{ backgroundColor: color }}>
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3 text-white text-2xl font-bold">
            {tenant.nombre[0]}
          </div>
          <h1 className="text-xl font-bold text-white">{tenant.nombre}</h1>
          {tenant.descripcion && <p className="text-white/80 text-sm mt-1 max-w-xs mx-auto">{tenant.descripcion}</p>}
          {tenant.ciudad && <p className="text-white/60 text-xs mt-1">{tenant.ciudad}</p>}
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* Progress bar */}
        <div className="flex gap-1 mb-6">
          {LABELS.map((label, i) => (
            <div key={label} className="flex-1">
              <div className="h-1 rounded-full mb-1 transition-all"
                style={{
                  backgroundColor: displayStep > i+1 ? color : displayStep === i+1 ? color : '#e5e7eb',
                  opacity: displayStep === i+1 ? 1 : displayStep > i+1 ? 0.5 : 0.25,
                }}/>
              <p className="text-xs text-center hidden sm:block"
                style={{ color: displayStep === i+1 ? color : '#9ca3af', fontWeight: displayStep === i+1 ? 700 : 400 }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Paso 1: Profesional ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">¿Con quién deseas tu cita?</h2>
            <div className="space-y-3">
              {profs.map(p => (
                <button key={p.id}
                  onClick={() => { setProfId(p.id); setServId(null); setFecha(null); setHora(null); setStep(2) }}
                  className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border-2 shadow-sm transition-all text-left hover:shadow-md"
                  style={{ borderColor: profId === p.id ? color : 'transparent' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                    style={{ backgroundColor: p.color || color }}>
                    {p.nombre[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{p.nombre}</p>
                    {p.especialidad && <p className="text-sm text-gray-400">{p.especialidad}</p>}
                  </div>
                  <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Paso 2: Servicio ────────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">¿Qué servicio necesitas?</h2>
            {profSel && <p className="text-sm text-gray-400 mb-4">Con {profSel.nombre}</p>}
            <div className="space-y-3">
              {servsP.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Este profesional no tiene servicios disponibles</p>
              ) : servsP.map(s => (
                <button key={s.id}
                  onClick={() => { setServId(s.id); setFecha(null); setHora(null); setStep(3) }}
                  className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border-2 shadow-sm transition-all text-left hover:shadow-md"
                  style={{ borderColor: servId === s.id ? color : 'transparent' }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{s.nombre}</p>
                    {s.descripcion && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{s.descripcion}</p>}
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-sm font-bold" style={{ color }}>{s.duracion_min} min</p>
                    {s.precio > 0 && <p className="text-xs text-gray-400">${Number(s.precio).toLocaleString('es-CO')}</p>}
                  </div>
                </button>
              ))}
            </div>
            {!soloProf && (
              <button onClick={() => setStep(1)} className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                ← Cambiar profesional
              </button>
            )}
          </div>
        )}

        {/* ── Paso 3: Modalidad ───────────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Modalidad de atención</h2>
            <p className="text-sm text-gray-400 mb-5">{servSel?.nombre}</p>

            <div className="grid grid-cols-2 gap-4 mb-5">
              {[
                { key: 'Presencial', icon: '🏥', desc: tenant.direccion || (tenant.ciudad ? `Consultorio en ${tenant.ciudad}` : 'Atención en consultorio') },
                { key: 'Virtual',    icon: '💻', desc: 'Videollamada (Google Meet / Zoom)' },
              ].map(({ key, icon, desc }) => (
                <button key={key}
                  onClick={() => setModalidad(key)}
                  className="flex flex-col items-center gap-3 p-5 bg-white rounded-2xl border-2 shadow-sm transition-all"
                  style={{
                    borderColor: modalidad === key ? color : 'transparent',
                    boxShadow: modalidad === key ? `0 0 0 3px ${color}20` : undefined,
                  }}>
                  <span className="text-4xl">{icon}</span>
                  <div className="text-center">
                    <p className="font-bold text-gray-900 text-sm">{key}</p>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => { setFecha(null); setHora(null); setStep(4) }}
              disabled={!modalidad}
              className="w-full py-4 rounded-2xl text-white font-bold text-sm disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: color }}>
              Continuar → Elegir horario
            </button>
            <button onClick={() => setStep(2)} className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Cambiar servicio
            </button>
          </div>
        )}

        {/* ── Paso 4: Fecha + Hora ────────────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Elige fecha y hora</h2>
            <p className="text-sm text-gray-400 mb-5">
              {servSel?.nombre} · {servSel?.duracion_min} min · {modalidad}
            </p>

            {/* Nav mes */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => { if (mOff > 0) setMOff(v => v-1) }}
                disabled={mOff === 0}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:border-gray-300 disabled:opacity-30 transition-colors">
                ‹
              </button>
              <span className="text-sm font-semibold text-gray-800 capitalize">
                {MESES[calMes]} {calAnio}
              </span>
              <button
                onClick={() => setMOff(v => v+1)}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:border-gray-300 transition-colors">
                ›
              </button>
            </div>

            {/* Encabezado días semana */}
            <div className="grid grid-cols-7 mb-1">
              {DSEM.map(d => (
                <p key={d} className="text-center text-xs font-bold text-gray-300 py-1">{d}</p>
              ))}
            </div>

            {/* Grilla días */}
            <div className="grid grid-cols-7 gap-1 mb-5">
              {dias.map((d, i) => {
                if (!d) return <div key={`e-${i}`}/>
                return (
                  <button key={d.k}
                    onClick={() => { if (d.disp) { setFecha(d.dt); setHora(null) } }}
                    disabled={!d.disp}
                    className="aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all relative"
                    style={
                      d.sel ? { backgroundColor: color, color: '#fff' } :
                      d.disp && d.esHoy ? { border: `1.5px solid ${color}`, color } :
                      d.disp ? { color: '#374151' } :
                      { color: '#d1d5db' }
                    }>
                    {d.n}
                    {d.disp && !d.sel && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full"
                        style={{ backgroundColor: color, opacity: 0.6 }}/>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Slots de hora */}
            {fecha && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 capitalize">
                  {fechaLbl}
                </p>
                {slots.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-4 bg-white rounded-2xl border border-gray-100">
                    Sin horarios disponibles para este día
                  </p>
                ) : (
                  <div className="space-y-3">
                    {slotsAM.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-2">🌅 Mañana</p>
                        <div className="grid grid-cols-4 gap-2">
                          {slotsAM.map(s => (
                            <button key={s} onClick={() => setHora(s)}
                              className="py-2.5 rounded-xl text-sm font-semibold border-2 transition-all shadow-sm"
                              style={hora === s
                                ? { backgroundColor: color, color: '#fff', borderColor: color }
                                : { backgroundColor: '#fff', color: '#374151', borderColor: 'transparent' }}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {slotsPM.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-2">🌇 Tarde</p>
                        <div className="grid grid-cols-4 gap-2">
                          {slotsPM.map(s => (
                            <button key={s} onClick={() => setHora(s)}
                              className="py-2.5 rounded-xl text-sm font-semibold border-2 transition-all shadow-sm"
                              style={hora === s
                                ? { backgroundColor: color, color: '#fff', borderColor: color }
                                : { backgroundColor: '#fff', color: '#374151', borderColor: 'transparent' }}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setStep(5)}
              disabled={!fecha || !hora}
              className="w-full py-4 rounded-2xl text-white font-bold text-sm disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: color }}>
              Continuar → Mis datos
            </button>
            <button onClick={() => setStep(3)} className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Cambiar modalidad
            </button>
          </div>
        )}

        {/* ── Paso 5: Datos del cliente ────────────────────────────────────────── */}
        {step === 5 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Tus datos de contacto</h2>
            <p className="text-sm text-gray-400 mb-5">Para confirmar y recordarte tu cita</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block font-semibold uppercase tracking-wide">Nombre completo *</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Nombres y apellidos" autoFocus className={inp}
                  onFocus={e => e.target.style.borderColor = color}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block font-semibold uppercase tracking-wide">Edad</label>
                  <select value={edad} onChange={e => setEdad(e.target.value)} className={sel}
                    onFocus={e => e.target.style.borderColor = color}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}>
                    <option value="">Selecciona...</option>
                    {EDADES.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block font-semibold uppercase tracking-wide">WhatsApp *</label>
                  <input value={tel} onChange={e => setTel(e.target.value)}
                    placeholder="3XX XXX XXXX" type="tel" className={inp}
                    onFocus={e => e.target.style.borderColor = color}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}/>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block font-semibold uppercase tracking-wide">Email</label>
                <input value={mail} onChange={e => setMail(e.target.value)}
                  placeholder="tu@email.com" type="email" className={inp}
                  onFocus={e => e.target.style.borderColor = color}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}/>
              </div>

              {isPsico ? (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block font-semibold uppercase tracking-wide">Motivo de consulta</label>
                  <select value={motivo} onChange={e => setMotivo(e.target.value)} className={sel}
                    onFocus={e => e.target.style.borderColor = color}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}>
                    <option value="">Selecciona...</option>
                    {MOTIVOS_PSICO.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block font-semibold uppercase tracking-wide">Motivo de la visita</label>
                  <input value={motivo} onChange={e => setMotivo(e.target.value)}
                    placeholder="¿En qué te podemos ayudar?" className={inp}
                    onFocus={e => e.target.style.borderColor = color}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}/>
                </div>
              )}

              {isPsico && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block font-semibold uppercase tracking-wide">¿Quién asiste?</label>
                  <select value={asiste} onChange={e => setAsiste(e.target.value)} className={sel}
                    onFocus={e => e.target.style.borderColor = color}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}>
                    <option>El mismo paciente</option>
                    <option>Un menor de edad</option>
                    <option>Adulto mayor con familiar</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-500 mb-1 block font-semibold uppercase tracking-wide">Información adicional (opcional)</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)}
                  placeholder="Ej: remitido por neurólogo, silla de ruedas, etc."
                  rows={3} className={`${inp} resize-none`}
                  onFocus={e => e.target.style.borderColor = color}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}/>
              </div>
            </div>

            <button
              onClick={() => {
                if (!nombre.trim()) { setErr('El nombre es requerido'); return }
                if (!tel.trim()) { setErr('El WhatsApp es requerido'); return }
                setErr(''); setStep(6)
              }}
              disabled={!nombre.trim() || !tel.trim()}
              className="mt-5 w-full py-4 rounded-2xl text-white font-bold text-sm disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: color }}>
              Continuar → Revisar cita
            </button>
            {err && <p className="mt-2 text-xs text-red-500 text-center">{err}</p>}
            <button onClick={() => setStep(4)} className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Cambiar horario
            </button>
          </div>
        )}

        {/* ── Paso 6: Revisar y confirmar ─────────────────────────────────────── */}
        {step === 6 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Revisa y confirma</h2>
            <p className="text-sm text-gray-400 mb-5">Verifica que todo esté correcto antes de agendar</p>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Resumen de tu cita</p>
              <div className="space-y-2 text-sm">
                {[
                  ['Servicio',    servSel?.nombre],
                  ['Profesional', profSel?.nombre],
                  ['Modalidad',   modalidad],
                  ['Fecha',       fechaLbl],
                  ['Hora',        hora],
                  ...(servSel?.precio > 0 ? [['Valor', `$${Number(servSel.precio).toLocaleString('es-CO')}`]] : []),
                  ['Paciente',    nombre],
                  ...(edad   ? [['Edad',   edad]]   : []),
                  ['WhatsApp', tel],
                  ...(mail   ? [['Email',  mail]]   : []),
                  ...(motivo ? [['Motivo', motivo]] : []),
                  ...(isPsico ? [['Asiste', asiste]] : []),
                  ...(notas  ? [['Notas',  notas]]  : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-start gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-gray-400 flex-shrink-0">{k}:</span>
                    <span className="font-semibold text-gray-800 text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {tel && (
              <div className="bg-green-50 border border-green-100 rounded-2xl p-3 text-sm text-green-700 mb-4">
                📱 Recibirás la confirmación por WhatsApp al número <b>{tel}</b>
              </div>
            )}

            {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl mb-3">{err}</p>}

            <button onClick={confirmar} disabled={saving}
              className="w-full py-4 rounded-2xl text-white font-bold text-sm disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: color }}>
              {saving ? 'Confirmando...' : '✅ Confirmar mi cita'}
            </button>
            <button onClick={() => setStep(5)} className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Editar mis datos
            </button>
          </div>
        )}

      </div>

      <div className="text-center py-6 text-xs text-gray-300">
        Powered by <span className="font-semibold">Agendas Pro</span>
      </div>
    </div>
  )
}
