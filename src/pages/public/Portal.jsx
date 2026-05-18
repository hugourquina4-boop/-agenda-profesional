import { useEffect, useState, useMemo, useRef } from 'react'
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

const TIPO_LABELS = {
  estilista: 'Estilista', colorista: 'Colorista', manicura: 'Manicura',
  pedicura: 'Pedicura', barbero: 'Barbero', esteticista: 'Esteticista', otro: 'Especialista',
}

function dLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function tToMin(t) {
  const [h, m] = String(t).substring(0,5).split(':').map(Number)
  return h*60 + (m||0)
}
function fmtPrecio(n) {
  return `$${Number(n).toLocaleString('es-CO')}`
}
function fmtDur(min) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min/60), m = min%60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function Icon({ d, size = 18, className = '', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}>
      <path d={d}/>
    </svg>
  )
}

function Field({ label, children, icon, required }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        {icon && <Icon d={icon} size={13} />}
        {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ── Carrusel horizontal de tarjetas ───────────────────────────────────────────
function HScroll({ children }) {
  return (
    <div className="overflow-x-auto -mx-6 px-6 scrollbar-hide"
         style={{ scrollbarWidth:'none', msOverflowStyle:'none' }}>
      <div className="flex gap-3 pb-2" style={{ width:'max-content' }}>
        {children}
      </div>
    </div>
  )
}

export default function Portal() {
  const { slug } = useParams()
  const [tenant, setTenant]     = useState(null)
  const [profs, setProfs]       = useState([])
  const [servs, setServs]       = useState([])
  const [hors, setHors]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [step, setStep]             = useState(0)
  const [catTab, setCatTab]         = useState(null)
  const [profId, setProfId]         = useState(null)
  const [servId, setServId]         = useState(null)
  const [varianteId, setVarianteId] = useState(null)
  const [modalidad, setModalidad]   = useState(null)
  const [mOff, setMOff]             = useState(0)
  const [fecha, setFecha]           = useState(null)
  const [hora, setHora]             = useState(null)
  const [ocupados, setOcupados]     = useState([])

  const [nombre, setNombre] = useState('')
  const [edad, setEdad]     = useState('')
  const [tel, setTel]       = useState('')
  const [mail, setMail]     = useState('')
  const [motivo, setMotivo] = useState('')
  const [asiste, setAsiste] = useState('El mismo paciente')
  const [notas, setNotas]   = useState('')

  const [paquetes,     setPaquetes]     = useState([])
  const [paqueteSelId, setPaqueteSelId] = useState(null)

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
        .select('id,nombre,especialidad,tipo_profesional,color,foto_url,bio,instagram')
        .eq('tenant_id', t.id).eq('activo', true).order('nombre'),
      supabase.from('servicios')
        .select('id,nombre,descripcion,duracion_min,precio,categoria,imagen_url,profesional_servicios(profesional_id),variantes_servicio(id,nombre,duracion_modificador,precio_modificador,orden)')
        .eq('tenant_id', t.id).eq('activo', true).order('categoria').order('nombre'),
      supabase.from('horarios')
        .select('*').eq('tenant_id', t.id).eq('activo', true),
    ])
    const ps = p || []
    setProfs(ps); setServs(s || []); setHors(h || [])
    const { data: paq } = await supabase
      .from('paquetes_salon')
      .select('id, nombre, precio_paquete, precio_normal, paquetes_servicios(servicio_id, orden)')
      .eq('tenant_id', t.id).eq('visible_portal', true).order('precio_paquete')
    setPaquetes(paq || [])
    setLoading(false)
    const esP = t?.vertical === 'peluqueria'
    if (!esP) {
      if (ps.length === 1) { setProfId(ps[0].id); setStep(2) }
      else setStep(1)
    }
    // peluquería → stays at step 0 (landing)
  }

  useEffect(() => {
    if (!profId || !fecha) { setOcupados([]); return }
    supabase.rpc('get_slots_ocupados', { p_profesional_id: profId, p_fecha: dLocal(fecha) })
      .then(({ data }) => setOcupados(data || []))
      .catch(() => setOcupados([]))
  }, [profId, fecha])

  const profSel    = profs.find(p => p.id === profId)
  const servSel    = servs.find(s => s.id === servId)
  const varianteSel = servSel?.variantes_servicio?.find(v => v.id === varianteId)
  const color      = tenant?.color_primario || '#3b82f6'
  const isPsico    = tenant?.vertical === 'psicologo'
  const isPelu     = tenant?.vertical === 'peluqueria'
  const soloProf   = profs.length === 1
  const accent     = isPsico ? '#0d9488' : isPelu ? '#db2777' : color

  // Variantes del servicio seleccionado (ordenadas)
  const variantes = useMemo(() =>
    [...(servSel?.variantes_servicio || [])].sort((a,b) => a.orden - b.orden),
    [servSel]
  )
  const tieneVariantes = variantes.length > 0

  // Duración y precio efectivos (base + modificador de variante)
  const duracionEfectiva = useMemo(() => {
    const base = servSel?.duracion_min || 0
    return tieneVariantes && varianteSel ? base + (varianteSel.duracion_modificador || 0) : base
  }, [servSel, varianteSel, tieneVariantes])

  const precioEfectivo = useMemo(() => {
    const base = servSel?.precio || 0
    return tieneVariantes && varianteSel ? base + (varianteSel.precio_modificador || 0) : base
  }, [servSel, varianteSel, tieneVariantes])

  const servsP = useMemo(() =>
    servs.filter(s => s.profesional_servicios?.some(x => x.profesional_id === profId)),
    [servs, profId]
  )

  // Servicios agrupados por categoría
  const servsGrupos = useMemo(() => {
    const grupos = {}
    servsP.forEach(s => {
      const cat = s.categoria || 'Otros'
      if (!grupos[cat]) grupos[cat] = []
      grupos[cat].push(s)
    })
    return grupos
  }, [servsP])

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
    if (!profId || !fecha || !duracionEfectiva) return []
    const h = hors.find(x => x.profesional_id === profId && x.dia === DMAP[fecha.getDay()])
    if (!h) return []
    const [hI,mI] = h.hora_inicio.split(':').map(Number)
    const [hF,mF] = h.hora_fin.split(':').map(Number)
    const dur  = duracionEfectiva
    const ocup = ocupados.map(o => ({ ini:tToMin(o.hora_inicio), fin:tToMin(o.hora_fin) }))
    const res  = []
    for (let t = hI*60+mI; t+dur <= hF*60+mF; t += 30) {
      if (!ocup.some(o => t < o.fin && (t+dur) > o.ini))
        res.push(`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`)
    }
    return res
  }, [profId, fecha, duracionEfectiva, hors, ocupados])

  const slotsAM = slots.filter(s => parseInt(s) < 12)
  const slotsPM = slots.filter(s => parseInt(s) >= 12)

  // ── Variables para landing (step 0) ─────────────────────────────────────
  const DIAS_SEMANA = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo']
  const DIAS_NAMES  = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
  const horariosSalon = DIAS_SEMANA.map((dia, i) => {
    const del = hors.filter(h => h.dia === dia)
    if (!del.length) return null
    const minIni = Math.min(...del.map(h => tToMin(h.hora_inicio)))
    const maxFin = Math.max(...del.map(h => tToMin(h.hora_fin)))
    const fmtM = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
    return { dia, label: DIAS_NAMES[i], ini: fmtM(minIni), fin: fmtM(maxFin) }
  }).filter(Boolean)

  const CAT_EMOJI = { Coloración:'🎨', Corte:'✂️', Tratamiento:'💆', Manicura:'💅',
    Pedicura:'🦶', Maquillaje:'💄', Piel:'🌿', 'Cejas & Pestañas':'✨', Otros:'⭐' }

  const todasCats = useMemo(() => {
    const g = {}
    servs.forEach(s => { const c = s.categoria || 'Otros'; if (!g[c]) g[c] = []; g[c].push(s) })
    return g
  }, [servs])
  const catKeys = Object.keys(todasCats)

  function seleccionarServicio(s) {
    setServId(s.id)
    setVarianteId(null)
    setFecha(null)
    setHora(null)
    const tieneVars = (s.variantes_servicio || []).length > 0
    if (isPelu) {
      setModalidad('Presencial')
      if (tieneVars) {
        setStep(3) // paso de variante (reutilizamos step 3 que psico usa para modalidad)
      } else {
        setStep(4)
      }
    } else {
      setStep(3) // modalidad para psico/otro
    }
  }

  async function confirmar() {
    setSaving(true); setErr('')
    const [h, m] = hora.split(':').map(Number)
    const ini = new Date(fecha); ini.setHours(h, m, 0, 0)
    const fin = new Date(ini.getTime() + duracionEfectiva * 60000)
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
      p_variante_id:      varianteId || null,
    })
    setSaving(false)
    if (rpcErr || !data?.ok) { setErr(rpcErr?.message || data?.error || 'Error al confirmar'); return }
    setConfirmada(true)
  }

  function reiniciar() {
    setStep(isPelu ? 0 : soloProf ? 2 : 1)
    setProfId(soloProf ? profs[0].id : null)
    setServId(null); setVarianteId(null)
    setModalidad(isPelu ? 'Presencial' : null)
    setFecha(null); setHora(null); setMOff(0)
    setNombre(''); setEdad(''); setTel(''); setMail('')
    setMotivo(''); setAsiste('El mismo paciente'); setNotas('')
    setConfirmada(false); setErr('')
  }

  const fechaLbl = fecha
    ? fecha.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })
    : ''

  // Labels del progress bar
  const LABELS_BASE = isPelu
    ? ['Servicio', ...(tieneVariantes && servId ? ['Variante'] : []), 'Horario', 'Datos', 'Confirmar']
    : ['Servicio','Modalidad','Horario','Datos','Confirmar']
  const LABELS = soloProf ? LABELS_BASE : ['Profesional', ...LABELS_BASE]

  // step → índice en LABELS (para progress bar)
  function stepToDisplay(s) {
    if (soloProf) {
      if (isPelu) {
        if (tieneVariantes && servId) {
          // steps: 2=serv(1), 3=var(2), 4=hor(3), 5=datos(4), 6=confirm(5)
          return s - 1
        }
        return s <= 2 ? s - 1 : s - 2
      }
      return s - 1
    }
    if (isPelu) {
      if (tieneVariantes && servId) return s
      return s <= 2 ? s : s - 1
    }
    return s
  }
  const displayStep = stepToDisplay(step)
  const totalSteps  = LABELS.length

  const inputCls = `w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm
    text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white
    focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all`
  const selectCls = `${inputCls} appearance-none cursor-pointer`

  // ── Loading ────────────────────────────────────────────────────────────
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

  // ── Pantalla confirmación ────────────────────────────────────────────
  if (confirmada) {
    const [h2, m2] = hora.split(':').map(Number)
    const ini = new Date(fecha); ini.setHours(h2, m2)
    const fLbl = ini.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })
    const telNum = tel.replace(/\D/g,'')
    const servLabel = varianteSel ? `${servSel?.nombre} — ${varianteSel.nombre}` : servSel?.nombre
    const waMsg = encodeURIComponent(
      `✅ *Cita confirmada — ${tenant.nombre}*\n\n` +
      `Hola ${nombre}, tu cita quedó agendada 🎉\n\n` +
      `✂️ *Servicio:* ${servLabel}\n` +
      `📅 *Fecha:* ${fLbl}\n🕐 *Hora:* ${hora}\n` +
      (isPsico && modalidad === 'Virtual'
        ? '💻 *Modalidad:* Virtual — El link llegará antes de la cita'
        : `📍 *Lugar:* ${tenant.direccion || tenant.ciudad || 'Instalaciones'}`) +
      `\n\n📱 Dudas: wa.me/57${tenant.whatsapp || ''}`
    )
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
           style={{ backgroundColor: '#f1f5f9' }}>
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
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
            {/* Corte de ticket */}
            <div className="flex">
              {Array.from({length: 12}).map((_,i) => (
                <div key={i} className="flex-1 h-3"
                     style={{
                       clipPath: i%2===0 ? 'polygon(0 100%, 50% 0, 100% 100%)' : 'polygon(0 0, 50% 100%, 100% 0)',
                       backgroundColor: i%2===0 ? '#f8fafc' : 'white'
                     }} />
              ))}
            </div>
            <div className="px-6 py-5 space-y-3">
              {[
                { icon:'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', label:'Cliente', value: nombre },
                { icon:'M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z', label:'Servicio', value: servLabel },
                { icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label:'Fecha', value: fLbl },
                { icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label:'Hora', value: `${hora} · ${fmtDur(duracionEfectiva)}` },
                ...(precioEfectivo > 0 ? [{ icon:'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label:'Valor', value: fmtPrecio(precioEfectivo) }] : []),
                ...(profSel ? [{ icon:'M16 7a4 4 0 11-8 0 4 4 0 018 0z', label:'Profesional', value: profSel.nombre }] : []),
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 py-2 border-b border-dashed border-slate-100 last:border-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ backgroundColor: `${accent}15` }}>
                    <Icon d={icon} size={14} style={{ color: accent }} />
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">{label}</span>
                    <span className="text-sm font-bold text-slate-800 text-right max-w-[60%]">{value}</span>
                  </div>
                </div>
              ))}
            </div>
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

  // ── Header del negocio ───────────────────────────────────────────────
  const HeaderNegocio = () => {
    if (isPsico) return (
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
        </div>
        <div className="px-5 pt-10 pb-14 text-center relative overflow-hidden"
             style={{ background:'linear-gradient(160deg,#0f172a 0%,#0f2d40 60%,#0d3d36 100%)' }}>
          <div className="absolute inset-0 opacity-5"
               style={{ backgroundImage:'radial-gradient(circle at 70% 50%,#0d9488 0%,transparent 60%)' }} />
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"/>
            <span className="text-xs text-white/60 tracking-widest uppercase font-medium">Neuropsicología · Psicología Clínica</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">{tenant.nombre}</h1>
          {tenant.descripcion && <p className="text-white/55 text-sm max-w-sm mx-auto leading-relaxed">{tenant.descripcion}</p>}
        </div>
      </div>
    )

    if (isPelu) return (
      <div>
        {(tenant.direccion || tenant.whatsapp) && (
          <div className="px-5 py-2 flex flex-wrap justify-center gap-x-6 gap-y-1"
               style={{ backgroundColor:`${accent}12` }}>
            {tenant.direccion && (
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color:`${accent}bb` }}>
                <Icon d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" size={11} style={{ color: accent }} />
                {tenant.direccion}
              </span>
            )}
            {tenant.whatsapp && (
              <a href={`https://wa.me/57${tenant.whatsapp}`} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-1.5 text-[11px] transition-opacity hover:opacity-80"
                 style={{ color:`${accent}bb` }}>
                <Icon d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" size={11} style={{ color: accent }} />
                {tenant.whatsapp}
              </a>
            )}
          </div>
        )}
        <div className="px-5 pt-10 pb-14 text-center relative overflow-hidden"
             style={{ background:'linear-gradient(160deg,#1a0a1e 0%,#2d0a2e 50%,#1a0a1e 100%)' }}>
          <div className="absolute inset-0 opacity-10"
               style={{ backgroundImage:`radial-gradient(circle at 70% 50%,${accent} 0%,transparent 60%)` }} />
          {/* Logo si existe */}
          {tenant.logo_url ? (
            <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-4 shadow-xl shadow-black/30 ring-2 ring-white/10">
              <img src={tenant.logo_url} alt={tenant.nombre} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-black/30 text-white text-3xl font-black ring-2 ring-white/10"
                 style={{ background:`linear-gradient(135deg,${accent} 0%,${accent}88 100%)` }}>
              {tenant.nombre[0]}
            </div>
          )}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-4"
               style={{ borderColor:`${accent}40`, backgroundColor:`${accent}18` }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accent }} />
            <span className="text-xs tracking-widest uppercase font-medium" style={{ color:`${accent}99` }}>
              Peluquería & Estética
            </span>
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">{tenant.nombre}</h1>
          {tenant.descripcion && <p className="text-white/55 text-sm max-w-sm mx-auto leading-relaxed">{tenant.descripcion}</p>}
          {tenant.ciudad && <p className="text-white/30 text-xs mt-2 flex items-center justify-center gap-1">
            <Icon d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" size={10} />
            {tenant.ciudad}
          </p>}
        </div>
      </div>
    )

    return (
      <div className="py-10 px-4 text-center relative overflow-hidden"
           style={{ background:`linear-gradient(135deg,${color} 0%,${color}dd 100%)` }}>
        <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 text-white text-2xl font-black">
          {tenant.logo_url
            ? <img src={tenant.logo_url} alt="" className="w-full h-full object-cover rounded-2xl" />
            : tenant.nombre[0]
          }
        </div>
        <h1 className="text-2xl font-black text-white">{tenant.nombre}</h1>
        {tenant.descripcion && <p className="text-white/75 text-sm mt-1.5 max-w-xs mx-auto leading-relaxed">{tenant.descripcion}</p>}
        {tenant.ciudad && <p className="text-white/50 text-xs mt-1.5">{tenant.ciudad}</p>}
      </div>
    )
  }

  // ── Layout principal ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ backgroundColor: step === 0 ? '#0f0a14' : '#f1f5f9' }}>
      <HeaderNegocio />

      {/* ── LANDING (step 0, solo peluquería) ──────────────────────────── */}
      {step === 0 && isPelu && (
        <div className="pb-32">

          {/* Equipo */}
          {profs.length > 0 && (
            <section className="px-5 pt-8 pb-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4"
                 style={{ color: `${accent}80` }}>
                Nuestro Equipo
              </p>
              <div className="overflow-x-auto -mx-5 px-5" style={{ scrollbarWidth:'none' }}>
                <div className="flex gap-3 pb-1" style={{ width:'max-content' }}>
                  {profs.map(p => (
                    <div key={p.id}
                      className="flex flex-col items-center rounded-2xl border overflow-hidden flex-shrink-0"
                      style={{ width: 130, borderColor: `${accent}20`, backgroundColor: `${accent}08` }}>
                      {p.foto_url ? (
                        <div className="w-full h-28 overflow-hidden">
                          <img src={p.foto_url} alt={p.nombre} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-full h-28 flex items-center justify-center text-white text-4xl font-black"
                             style={{ background: `linear-gradient(160deg, ${p.color || accent}, ${p.color || accent}66)` }}>
                          {p.nombre[0]}
                        </div>
                      )}
                      <div className="p-3 w-full">
                        <p className="font-bold text-white text-xs leading-tight truncate">{p.nombre}</p>
                        {p.tipo_profesional && (
                          <p className="text-[10px] font-semibold mt-0.5 truncate" style={{ color: accent }}>
                            {TIPO_LABELS[p.tipo_profesional] || p.tipo_profesional}
                          </p>
                        )}
                        {p.bio && (
                          <p className="text-[10px] text-white/40 mt-1 leading-relaxed line-clamp-2">{p.bio}</p>
                        )}
                        {p.instagram && (
                          <a href={`https://instagram.com/${p.instagram.replace('@','')}`}
                             target="_blank" rel="noopener noreferrer"
                             className="flex items-center gap-1 mt-2 text-[10px] font-medium transition-opacity hover:opacity-70"
                             style={{ color: accent }}>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                            </svg>
                            {p.instagram.startsWith('@') ? p.instagram : `@${p.instagram}`}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Divisor */}
          <div className="mx-5 h-px" style={{ background: `${accent}20` }} />

          {/* Servicios */}
          {servs.length > 0 && (
            <section className="px-5 pt-6 pb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4"
                 style={{ color: `${accent}80` }}>
                Servicios & Precios
              </p>
              {/* Tabs de categoría */}
              {catKeys.length > 1 && (
                <div className="overflow-x-auto -mx-5 px-5 mb-4" style={{ scrollbarWidth:'none' }}>
                  <div className="flex gap-2 pb-1" style={{ width:'max-content' }}>
                    <button onClick={() => setCatTab(null)}
                      className="px-4 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0"
                      style={!catTab
                        ? { backgroundColor: accent, color: '#fff' }
                        : { backgroundColor: `${accent}18`, color: `${accent}99` }}>
                      Todos
                    </button>
                    {catKeys.map(c => (
                      <button key={c} onClick={() => setCatTab(catTab === c ? null : c)}
                        className="px-4 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0 flex items-center gap-1"
                        style={catTab === c
                          ? { backgroundColor: accent, color: '#fff' }
                          : { backgroundColor: `${accent}18`, color: `${accent}99` }}>
                        <span>{CAT_EMOJI[c] || '⭐'}</span>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2.5">
                {(catTab ? (todasCats[catTab] || []) : servs).map(s => {
                  const vars = s.variantes_servicio || []
                  return (
                    <div key={s.id}
                      className="flex items-center gap-3 p-4 rounded-2xl"
                      style={{ backgroundColor: `${accent}08`, border: `1px solid ${accent}18` }}>
                      {s.imagen_url ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                          <img src={s.imagen_url} alt={s.nombre} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                             style={{ backgroundColor: `${accent}20` }}>
                          {CAT_EMOJI[s.categoria] || '⭐'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm leading-tight">{s.nombre}</p>
                        {s.descripcion && (
                          <p className="text-white/40 text-xs mt-0.5 leading-relaxed line-clamp-1">{s.descripcion}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: `${accent}25`, color: accent }}>
                            {fmtDur(s.duracion_min)}
                          </span>
                          {vars.length > 0 && (
                            <span className="text-[10px] text-white/30">{vars.length} opciones</span>
                          )}
                        </div>
                      </div>
                      {s.precio > 0 && (
                        <div className="flex-shrink-0 text-right">
                          <p className="text-base font-black" style={{ color: accent }}>{fmtPrecio(s.precio)}</p>
                          {vars.length > 0 && <p className="text-[10px] text-white/30">desde</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Paquetes / Combos */}
          {paquetes.length > 0 && (
            <>
              <div className="mx-5 h-px" style={{ background: `${accent}20` }} />
              <section className="px-5 pt-6 pb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4"
                   style={{ color: `${accent}80` }}>
                  Paquetes & Combos
                </p>
                <div className="space-y-3">
                  {paquetes.map(paq => {
                    const off = paq.precio_normal > 0
                      ? Math.round((1 - paq.precio_paquete / paq.precio_normal) * 100)
                      : 0
                    return (
                      <div key={paq.id} className="rounded-2xl p-4 relative overflow-hidden"
                        style={{ backgroundColor:`${accent}10`, border:`1.5px solid ${accent}28` }}>
                        {off > 0 && (
                          <span className="absolute top-3 right-3 text-[10px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: accent, color:'#fff' }}>
                            {off}% OFF
                          </span>
                        )}
                        <p className="font-bold text-white text-sm pr-14">{paq.nombre}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-lg font-black" style={{ color: accent }}>
                            {fmtPrecio(paq.precio_paquete)}
                          </span>
                          {paq.precio_normal > 0 && (
                            <span className="text-sm text-white/35 line-through">
                              {fmtPrecio(paq.precio_normal)}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => { setPaqueteSelId(paq.id); setStep(isPelu || profs.length > 1 ? 1 : 2) }}
                          className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                          style={{ background:`${accent}30`, color: accent }}>
                          Reservar este paquete →
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>
            </>
          )}

          {/* Divisor */}
          {horariosSalon.length > 0 && (
            <div className="mx-5 h-px" style={{ background: `${accent}20` }} />
          )}

          {/* Horarios */}
          {horariosSalon.length > 0 && (
            <section className="px-5 pt-6 pb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4"
                 style={{ color: `${accent}80` }}>
                Horario de Atención
              </p>
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${accent}20` }}>
                {horariosSalon.map((h, i) => (
                  <div key={h.dia}
                    className="flex items-center justify-between px-4 py-3"
                    style={{
                      backgroundColor: i % 2 === 0 ? `${accent}06` : 'transparent',
                      borderBottom: i < horariosSalon.length - 1 ? `1px solid ${accent}12` : 'none'
                    }}>
                    <p className="text-sm font-semibold text-white/70">{h.label}</p>
                    <p className="text-sm font-bold" style={{ color: accent }}>
                      {h.ini} – {h.fin}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Dirección y contacto */}
          {(tenant.direccion || tenant.whatsapp) && (
            <section className="px-5 pt-2 pb-4">
              <div className="rounded-2xl p-4 space-y-3" style={{ border:`1px solid ${accent}20`, backgroundColor:`${accent}06` }}>
                {tenant.direccion && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ backgroundColor: `${accent}20` }}>
                      <Icon d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" size={15} style={{ color: accent }} />
                    </div>
                    <p className="text-sm text-white/60">{tenant.direccion}</p>
                  </div>
                )}
                {tenant.whatsapp && (
                  <a href={`https://wa.me/57${tenant.whatsapp}`} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ backgroundColor: '#25D36620' }}>
                      <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </div>
                    <p className="text-sm text-emerald-400 font-medium">{tenant.whatsapp}</p>
                  </a>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Botón sticky para landing */}
      {step === 0 && isPelu && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-50"
             style={{ background: 'linear-gradient(to top, #0f0a14 55%, transparent)' }}>
          <button
            onClick={() => setStep(soloProf ? 2 : 1)}
            className="w-full max-w-lg mx-auto flex items-center justify-center gap-2.5 py-4 rounded-2xl text-white font-black text-base transition-all active:scale-[0.98]"
            style={{ backgroundColor: accent, boxShadow:`0 6px 28px ${accent}55`, display:'flex' }}>
            <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" size={18} />
            Reservar cita
          </button>
        </div>
      )}

      {step > 0 && (
      <>
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Progress bar */}
        <div className="mb-5">
          <div className="relative h-1.5 bg-slate-200 rounded-full overflow-hidden mb-3">
            <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                 style={{ width:`${(displayStep/totalSteps)*100}%`, backgroundColor: accent }} />
          </div>
          <div className="flex justify-between">
            {LABELS.map((label, i) => (
              <div key={label} className="flex flex-col items-center" style={{ flex:1 }}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mb-0.5 transition-all ${
                  displayStep > i+1 ? 'text-white' : displayStep === i+1 ? 'text-white' : 'text-slate-300'
                }`}
                style={{ backgroundColor: displayStep > i+1 ? accent : displayStep === i+1 ? accent : '#e2e8f0' }}>
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

        <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/80 overflow-hidden">

          {/* ── Paso 1: Profesional ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="p-6">
              <StepHeader
                icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                title={isPelu ? '¿Con quién quieres tu cita?' : '¿Con quién deseas tu cita?'}
                subtitle={isPelu ? 'Elige tu estilista o especialista' : 'Selecciona el profesional'}
                accent={accent}
              />

              {/* Carousel horizontal en mobile, grid en desktop */}
              <div className="mt-5">
                {profs.length <= 3 ? (
                  <div className="space-y-3">
                    {profs.map(p => <ProfCard key={p.id} p={p} profId={profId} accent={accent} isPelu={isPelu}
                      onClick={() => { setProfId(p.id); setServId(null); setVarianteId(null); setFecha(null); setHora(null); setStep(2) }} />)}
                  </div>
                ) : (
                  <HScroll>
                    {profs.map(p => (
                      <div key={p.id} style={{ width: 160 }}>
                        <ProfCardCompact p={p} profId={profId} accent={accent} isPelu={isPelu}
                          onClick={() => { setProfId(p.id); setServId(null); setVarianteId(null); setFecha(null); setHora(null); setStep(2) }} />
                      </div>
                    ))}
                  </HScroll>
                )}
              </div>
            </div>
          )}

          {/* ── Paso 2: Servicio ─────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="p-6">
              <StepHeader
                icon="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"
                title="¿Qué servicio necesitas?"
                subtitle={profSel ? `Con ${profSel.nombre}${profSel.tipo_profesional ? ` · ${TIPO_LABELS[profSel.tipo_profesional] || profSel.tipo_profesional}` : ''}` : 'Selecciona un servicio'}
                accent={accent}
              />

              {/* Paquetes disponibles */}
              {paquetes.length > 0 && (
                <div className="mt-5">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3 px-1" style={{ color:`${accent}80` }}>Paquetes & Combos</p>
                  <div className="space-y-2.5 mb-6">
                    {paquetes.map(paq => {
                      const off = paq.precio_normal > 0 ? Math.round((1 - paq.precio_paquete/paq.precio_normal)*100) : 0
                      const firstSvcId = [...(paq.paquetes_servicios||[])].sort((a,b)=>a.orden-b.orden)[0]?.servicio_id
                      const firstSvc = servs.find(s => s.id === firstSvcId)
                      const sel = paqueteSelId === paq.id
                      return (
                        <button key={paq.id}
                          onClick={() => { setPaqueteSelId(paq.id); seleccionarServicio(firstSvc || { id:firstSvcId||'', nombre:paq.nombre, precio:paq.precio_paquete, duracion_min:60, variantes_servicio:[] }) }}
                          className="w-full text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.99] relative"
                          style={{ borderColor: sel ? accent : '#f1f5f9', backgroundColor: sel ? `${accent}08` : '#f8fafc' }}>
                          {off > 0 && (
                            <span className="absolute top-3 right-3 text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background:accent, color:'#fff' }}>{off}% OFF</span>
                          )}
                          <p className="font-bold text-slate-800 text-sm pr-12">{paq.nombre}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-black" style={{ color:accent }}>{fmtPrecio(paq.precio_paquete)}</span>
                            {paq.precio_normal > 0 && <span className="text-xs text-slate-400 line-through">{fmtPrecio(paq.precio_normal)}</span>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {servsP.length > 0 && <p className="text-[10px] font-black uppercase tracking-widest mb-3 px-1" style={{ color:`${accent}80` }}>Servicios individuales</p>}
                </div>
              )}

              {servsP.length === 0 && paquetes.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm mt-5">
                  Este profesional no tiene servicios disponibles
                </div>
              ) : servsP.length === 0 ? null : (
                <div className={paquetes.length > 0 ? 'space-y-5' : 'mt-5 space-y-5'}>
                  {Object.entries(servsGrupos).map(([cat, items]) => (
                    <div key={cat}>
                      {Object.keys(servsGrupos).length > 1 && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-2 px-1"
                           style={{ color: `${accent}80` }}>
                          {cat}
                        </p>
                      )}
                      <div className="space-y-2.5">
                        {items.map(s => {
                          const sel = servId === s.id
                          const vars = [...(s.variantes_servicio || [])].sort((a,b) => a.orden - b.orden)
                          return (
                            <div key={s.id}>
                              <button onClick={() => seleccionarServicio(s)}
                                className="w-full text-left rounded-2xl border-2 transition-all active:scale-[0.99] overflow-hidden"
                                style={{
                                  borderColor: sel ? accent : '#f1f5f9',
                                  backgroundColor: sel ? `${accent}08` : '#f8fafc'
                                }}>
                                <div className="flex items-start gap-3 p-4">
                                  {/* Imagen o ícono del servicio */}
                                  {s.imagen_url ? (
                                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
                                      <img src={s.imagen_url} alt={s.nombre} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                                         style={{ backgroundColor: sel ? `${accent}18` : '#e2e8f0' }}>
                                      <Icon d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"
                                           size={22} style={{ color: sel ? accent : '#94a3b8' }} />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-sm leading-snug">{s.nombre}</p>
                                    {s.descripcion && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{s.descripcion}</p>}
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor:`${accent}15`, color: accent }}>
                                        {fmtDur(s.duracion_min)}
                                      </span>
                                      {s.precio > 0 && (
                                        <span className="text-xs text-slate-500 font-semibold">{fmtPrecio(s.precio)}</span>
                                      )}
                                      {vars.length > 0 && (
                                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                          <Icon d="M19 9l-7 7-7-7" size={10} />
                                          {vars.length} opciones
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex-shrink-0 mt-1">
                                    {sel
                                      ? <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: accent }}>
                                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                                          </svg>
                                        </div>
                                      : <Icon d="M9 5l7 7-7 7" size={18} className="text-slate-300" />
                                    }
                                  </div>
                                </div>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!soloProf && <BackBtn onClick={() => setStep(1)}>Cambiar profesional</BackBtn>}
            </div>
          )}

          {/* ── Paso 3: Variante (peluquería) o Modalidad (psicólogo) ──────── */}
          {step === 3 && isPelu && (
            <div className="p-6">
              <StepHeader
                icon="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                title="Elige una opción"
                subtitle={servSel?.nombre}
                accent={accent}
              />
              <div className="space-y-3 mt-5">
                {variantes.map(v => {
                  const sel = varianteId === v.id
                  const durTotal = (servSel?.duracion_min || 0) + (v.duracion_modificador || 0)
                  const precioTotal = (servSel?.precio || 0) + (v.precio_modificador || 0)
                  return (
                    <button key={v.id} onClick={() => setVarianteId(v.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left active:scale-[0.99]"
                      style={{
                        borderColor: sel ? accent : '#f1f5f9',
                        backgroundColor: sel ? `${accent}08` : '#f8fafc'
                      }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                           style={{ backgroundColor: sel ? `${accent}20` : '#e2e8f0' }}>
                        <Icon d="M5 3l14 9-14 9V3z" size={18} style={{ color: sel ? accent : '#94a3b8' }} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-sm">{v.nombre}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-semibold" style={{ color: accent }}>{fmtDur(durTotal)}</span>
                          {precioTotal > 0 && <span className="text-xs text-slate-500">{fmtPrecio(precioTotal)}</span>}
                        </div>
                      </div>
                      {sel && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                             style={{ backgroundColor: accent }}>
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              <div className="mt-5">
                <ContinueBtn onClick={() => { setFecha(null); setHora(null); setStep(4) }}
                             disabled={!varianteId} accent={accent}>
                  Continuar
                </ContinueBtn>
              </div>
              <BackBtn onClick={() => { setVarianteId(null); setStep(2) }}>Cambiar servicio</BackBtn>
            </div>
          )}

          {/* ── Paso 3: Modalidad (psicólogo / otro) ────────────────────────── */}
          {step === 3 && !isPelu && (
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
                        <Icon d={icon} size={22} style={sel ? { color: accent } : {}} className={sel ? '' : 'text-slate-400'} />
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
                subtitle={`${servSel?.nombre}${varianteSel ? ` · ${varianteSel.nombre}` : ''} · ${fmtDur(duracionEfectiva)}${precioEfectivo > 0 ? ` · ${fmtPrecio(precioEfectivo)}` : ''}`}
                accent={accent}
              />

              {/* Navegación de mes */}
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

              <div className="grid grid-cols-7 mb-2">
                {DSEM.map(d => (
                  <p key={d} className="text-center text-[11px] font-bold text-slate-300 uppercase tracking-wide py-1">{d}</p>
                ))}
              </div>

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
                            ? { border:`2px solid ${accent}`, color: accent }
                            : d.disp
                              ? { color:'#334155', backgroundColor:'#f8fafc' }
                              : { color:'#cbd5e1' }
                      }>
                      {d.n}
                    </button>
                  )
                })}
              </div>

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
                            {slotsAM.map(s => <SlotBtn key={s} hora={s} sel={hora===s} accent={accent} onClick={() => setHora(s)} />)}
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
                            {slotsPM.map(s => <SlotBtn key={s} hora={s} sel={hora===s} accent={accent} onClick={() => setHora(s)} />)}
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
              <BackBtn onClick={() => {
                if (isPelu && tieneVariantes) setStep(3)
                else if (isPelu) setStep(2)
                else setStep(3)
              }}>
                {isPelu && tieneVariantes ? 'Cambiar opción' : 'Cambiar servicio'}
              </BackBtn>
            </div>
          )}

          {/* ── Paso 5: Datos ─────────────────────────────────────────────────── */}
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
                    placeholder="Nombres y apellidos"
                    autoFocus maxLength={200} className={inputCls} />
                </Field>

                {!isPelu ? (
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
                ) : (
                  <Field label="WhatsApp" required
                    icon="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z">
                    <input value={tel} onChange={e => setTel(e.target.value)}
                      placeholder="3XX XXX XXXX" type="tel" maxLength={20} className={inputCls} />
                  </Field>
                )}

                <Field label="Email"
                  icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z">
                  <input value={mail} onChange={e => setMail(e.target.value)}
                    placeholder="tu@email.com" type="email" maxLength={200} className={inputCls} />
                </Field>

                {isPsico && (
                  <>
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
                  </>
                )}

                <Field label={isPelu ? 'Notas (alergias, preferencias…)' : 'Información adicional (opcional)'}
                  icon="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z">
                  <textarea value={notas} onChange={e => setNotas(e.target.value)}
                    placeholder={isPelu ? 'Ej: alergia a amoniaco, cabello teñido antes, largo aproximado...' : 'Ej: remitido por neurólogo, usa silla de ruedas...'}
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
                {err && <p className="mt-2 text-xs text-rose-500 text-center font-medium">{err}</p>}
              </div>
              <BackBtn onClick={() => setStep(4)}>Cambiar horario</BackBtn>
            </div>
          )}

          {/* ── Paso 6: Confirmar ─────────────────────────────────────────────── */}
          {step === 6 && (
            <div className="p-6">
              <StepHeader
                icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                title="Revisa tu cita"
                subtitle="Todo listo para confirmar"
                accent={accent}
              />
              <div className="mt-5 rounded-2xl overflow-hidden border border-slate-100">
                <div className="px-4 py-3 flex items-center gap-3"
                     style={{ background:`linear-gradient(135deg,${color} 0%,${accent} 100%)` }}>
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                    <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-white/70 font-medium">Resumen de cita</p>
                    <p className="text-sm font-black text-white">
                      {servSel?.nombre}{varianteSel ? ` · ${varianteSel.nombre}` : ''}
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {[
                    { icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label:'Fecha y hora', value:`${fechaLbl} · ${hora}` },
                    { icon:'M12 8v4l3 3', label:'Duración', value: fmtDur(duracionEfectiva) },
                    ...(!isPelu ? [{ icon:'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', label:'Modalidad', value: modalidad }] : []),
                    { icon:'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', label:'Cliente', value: nombre },
                    { icon:'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', label:'WhatsApp', value: tel },
                    ...(precioEfectivo > 0 ? [{ icon:'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label:'Valor', value: fmtPrecio(precioEfectivo) }] : []),
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 px-4 py-3">
                      <Icon d={icon} size={15} className="text-slate-300 flex-shrink-0" />
                      <span className="text-xs text-slate-400 w-24 flex-shrink-0">{label}</span>
                      <span className="text-sm font-semibold text-slate-700 flex-1 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

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
                  style={{ backgroundColor: accent, boxShadow:`0 4px 20px ${accent}40` }}>
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
        Agendas Pro · Plataforma de agendamiento profesional
      </div>
      </>
      )}
    </div>
  )
}

// ─── Tarjeta de profesional grande (≤3 profesionales) ───────────────────────
function ProfCard({ p, profId, accent, isPelu, onClick }) {
  const sel = profId === p.id
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left hover:shadow-md active:scale-[0.99]"
      style={{
        borderColor: sel ? accent : '#f1f5f9',
        backgroundColor: sel ? `${accent}08` : '#f8fafc'
      }}>
      {p.foto_url ? (
        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-sm ring-2"
             style={{ ringColor: sel ? accent : 'transparent' }}>
          <img src={p.foto_url} alt={p.nombre} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-black flex-shrink-0 shadow-sm"
             style={{ backgroundColor: p.color || accent }}>
          {p.nombre[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 text-sm">{p.nombre}</p>
        {isPelu && p.tipo_profesional && (
          <p className="text-xs font-semibold mt-0.5" style={{ color: accent }}>
            {TIPO_LABELS[p.tipo_profesional] || p.tipo_profesional}
          </p>
        )}
        {!isPelu && p.especialidad && (
          <p className="text-xs text-slate-400 mt-0.5">{p.especialidad}</p>
        )}
        {p.bio && <p className="text-xs text-slate-400 mt-1 leading-relaxed truncate">{p.bio}</p>}
      </div>
      <div className="flex-shrink-0">
        {sel
          ? <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: accent }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
          : <Icon d="M9 5l7 7-7 7" size={18} className="text-slate-300" />
        }
      </div>
    </button>
  )
}

// ─── Tarjeta compacta para carrusel (>3 profesionales) ──────────────────────
function ProfCardCompact({ p, profId, accent, isPelu, onClick }) {
  const sel = profId === p.id
  return (
    <button onClick={onClick}
      className="flex flex-col items-center p-4 rounded-2xl border-2 transition-all w-full active:scale-[0.97]"
      style={{
        borderColor: sel ? accent : '#f1f5f9',
        backgroundColor: sel ? `${accent}08` : '#f8fafc',
        minHeight: 160
      }}>
      {p.foto_url ? (
        <div className="w-16 h-16 rounded-2xl overflow-hidden mb-3 shadow-md"
             style={{ outline: sel ? `3px solid ${accent}` : '3px solid transparent', outlineOffset: 2 }}>
          <img src={p.foto_url} alt={p.nombre} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black mb-3 shadow-md"
             style={{ backgroundColor: p.color || accent,
                      outline: sel ? `3px solid ${accent}` : 'none', outlineOffset: 2 }}>
          {p.nombre[0]}
        </div>
      )}
      <p className="font-bold text-slate-800 text-xs text-center leading-tight">{p.nombre}</p>
      {isPelu && p.tipo_profesional && (
        <p className="text-[10px] font-semibold mt-1 text-center" style={{ color: accent }}>
          {TIPO_LABELS[p.tipo_profesional] || p.tipo_profesional}
        </p>
      )}
      {sel && (
        <div className="mt-2 w-5 h-5 rounded-full flex items-center justify-center"
             style={{ backgroundColor: accent }}>
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
      )}
    </button>
  )
}

// ─── Sub-componentes UI ──────────────────────────────────────────────────────
function StepHeader({ icon, title, subtitle, accent }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ backgroundColor:`${accent}15` }}>
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
