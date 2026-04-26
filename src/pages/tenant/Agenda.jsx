import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

// ─── constantes ───────────────────────────────────────────────────────────────
const DIAS_ES  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIA_DB   = { Dom:'domingo', Lun:'lunes', Mar:'martes', 'Mié':'miercoles',
                   Jue:'jueves', Vie:'viernes', 'Sáb':'sabado' }
const HORA_INI = 7
const HORA_FIN = 20
const PX_MIN   = 1.5   // px por minuto → 60min = 90px

const ESTADO = {
  pendiente:  { label:'Pendiente',   dot:'#f59e0b', bar:'#fef3c7', text:'#92400e',
                 dk_bar:'rgba(245,158,11,0.15)', dk_text:'#fcd34d' },
  confirmada: { label:'Confirmada',  dot:'#3b82f6', bar:'#dbeafe', text:'#1e40af',
                 dk_bar:'rgba(59,130,246,0.15)', dk_text:'#93c5fd' },
  completada: { label:'Completada',  dot:'#10b981', bar:'#d1fae5', text:'#065f46',
                 dk_bar:'rgba(16,185,129,0.15)', dk_text:'#6ee7b7' },
  cancelada:  { label:'Cancelada',   dot:'#ef4444', bar:'#fee2e2', text:'#991b1b',
                 dk_bar:'rgba(239,68,68,0.15)',  dk_text:'#fca5a5' },
  no_asistio: { label:'No asistió',  dot:'#94a3b8', bar:'#f1f5f9', text:'#475569',
                 dk_bar:'rgba(148,163,184,0.1)', dk_text:'#94a3b8' },
}
const ACCIONES_ESTADO = [
  { key:'confirmada', label:'Confirmar',   icon:'M5 13l4 4L19 7' },
  { key:'completada', label:'Completada',  icon:'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key:'no_asistio', label:'No asistió',  icon:'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
  { key:'cancelada',  label:'Cancelar',    icon:'M6 18L18 6M6 6l12 12' },
]

// ─── helpers ──────────────────────────────────────────────────────────────────
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function startOfWeek(d) {
  const r = new Date(d); const wd = r.getDay()
  r.setDate(r.getDate() - (wd === 0 ? 6 : wd - 1)); return r
}
function hhmm(ts) {
  return new Date(ts).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', hour12:false })
}
function minsDiff(a, b) { return Math.round((new Date(b) - new Date(a)) / 60000) }

function topPx(ts) {
  const d = new Date(ts)
  return Math.max(0, (d.getHours() * 60 + d.getMinutes() - HORA_INI * 60) * PX_MIN)
}
function heightPx(inicio, fin) {
  return Math.max(minsDiff(inicio, fin) * PX_MIN, 30)
}
const TL_HEIGHT = (HORA_FIN - HORA_INI) * 60 * PX_MIN
const HORAS = Array.from({ length: HORA_FIN - HORA_INI + 1 }, (_, i) => HORA_INI + i)

// ─── CitaBloque ────────────────────────────────────────────────────────────────
function CitaBloque({ cita, onClick, isSelected, dark }) {
  const meta   = ESTADO[cita.estado] || ESTADO.pendiente
  const inicio = hhmm(cita.fecha_inicio)
  const fin    = hhmm(cita.fecha_fin)
  const mins   = minsDiff(cita.fecha_inicio, cita.fecha_fin)
  const h      = heightPx(cita.fecha_inicio, cita.fecha_fin)
  const compact = h < 52

  return (
    <div
      onClick={() => onClick(cita)}
      className="absolute left-1 right-1 rounded-xl cursor-pointer select-none overflow-hidden transition-all duration-150"
      style={{
        top: topPx(cita.fecha_inicio),
        height: h,
        backgroundColor: dark ? meta.dk_bar : meta.bar,
        borderLeft: `3px solid ${meta.dot}`,
        boxShadow: isSelected
          ? `0 0 0 2px ${meta.dot}, 0 4px 12px ${meta.dot}44`
          : '0 1px 3px rgba(0,0,0,0.08)',
        zIndex: isSelected ? 10 : 2,
        transform: isSelected ? 'scale(1.01)' : 'scale(1)',
      }}
    >
      <div className="px-2 py-1.5 h-full flex flex-col justify-between">
        <div>
          <p className="font-semibold leading-tight truncate"
             style={{ color: dark ? meta.dk_text : meta.text, fontSize: compact ? 11 : 12 }}>
            {cita.clientes_agenda?.nombre || 'Paciente'}
          </p>
          {!compact && (
            <p className="text-xs leading-tight truncate mt-0.5 opacity-75"
               style={{ color: dark ? meta.dk_text : meta.text }}>
              {cita.servicios?.nombre || ''}
            </p>
          )}
        </div>
        {!compact && (
          <p className="text-xs opacity-60 mt-auto"
             style={{ color: dark ? meta.dk_text : meta.text }}>
            {inicio} – {fin} · {mins}min
          </p>
        )}
        {compact && (
          <span className="text-xs opacity-60" style={{ color: dark ? meta.dk_text : meta.text }}>
            {inicio}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── TimelineDay ──────────────────────────────────────────────────────────────
function TimelineDay({ citas, ahoraTop, esHoy, onCitaClick, citaSelId, horaIni, horaFin, dark }) {
  const workTop    = (horaIni - HORA_INI) * 60 * PX_MIN
  const workHeight = (horaFin - horaIni) * 60 * PX_MIN

  return (
    <div className="relative flex">
      {/* Columna de horas */}
      <div className="flex-shrink-0 w-12 relative" style={{ height: TL_HEIGHT }}>
        {HORAS.map(h => (
          <div key={h} className="absolute right-2 -translate-y-2"
               style={{ top: (h - HORA_INI) * 60 * PX_MIN }}>
            <span className="text-xs text-gray-400 dark:text-slate-600 font-mono select-none">
              {String(h).padStart(2,'0')}
            </span>
          </div>
        ))}
      </div>

      {/* Área de contenido */}
      <div className="flex-1 relative border-l border-gray-200 dark:border-slate-800"
           style={{ height: TL_HEIGHT }}>

        {/* Líneas de hora */}
        {HORAS.map(h => (
          <div key={h} className="absolute left-0 right-0 border-t border-dashed border-gray-100 dark:border-slate-800/60"
               style={{ top: (h - HORA_INI) * 60 * PX_MIN }} />
        ))}

        {/* Zona de trabajo (fondo) */}
        <div className="absolute left-0 right-0 bg-blue-500/3 dark:bg-blue-400/5"
             style={{ top: workTop, height: workHeight }} />

        {/* Citas */}
        {citas.map(c => (
          <CitaBloque key={c.id} cita={c} onClick={onCitaClick}
                      isSelected={c.id === citaSelId} dark={dark} />
        ))}

        {/* Indicador hora actual */}
        {esHoy && ahoraTop >= 0 && ahoraTop <= TL_HEIGHT && (
          <div className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
               style={{ top: ahoraTop }}>
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 flex-shrink-0 shadow-sm" />
            <div className="flex-1 border-t-2 border-red-500" />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── WeekStrip ────────────────────────────────────────────────────────────────
function WeekStrip({ fechaSel, setFechaSel, citas, hoy }) {
  const lunes = startOfWeek(fechaSel)
  const dias  = Array.from({ length: 7 }, (_, i) => addDays(lunes, i))
  const citasSet = useMemo(() => {
    const s = {}
    citas.forEach(c => { s[ymd(new Date(c.fecha_inicio))] = true })
    return s
  }, [citas])

  return (
    <div className="flex gap-1 mt-3">
      {dias.map(d => {
        const key  = ymd(d)
        const sel  = key === ymd(fechaSel)
        const esHoy = key === ymd(hoy)
        const tiene = !!citasSet[key]
        return (
          <button key={key} onClick={() => setFechaSel(d)}
            className={`flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all ${
              sel ? 'bg-slate-900 dark:bg-white' : 'hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}>
            <span className={`text-xs font-medium ${
              sel ? 'text-gray-300 dark:text-slate-500' : 'text-gray-400 dark:text-slate-500'
            }`}>
              {DIAS_ES[d.getDay()]}
            </span>
            <span className={`text-sm font-bold leading-none mt-0.5 ${
              sel ? 'text-white dark:text-slate-900'
                  : esHoy ? 'text-blue-600 dark:text-blue-400'
                           : 'text-gray-700 dark:text-slate-300'
            }`}>
              {d.getDate()}
            </span>
            <div className={`w-1 h-1 rounded-full mt-1 ${
              tiene
                ? sel ? 'bg-white/60 dark:bg-slate-700' : 'bg-blue-500 dark:bg-blue-400'
                : 'bg-transparent'
            }`} />
          </button>
        )
      })}
    </div>
  )
}

// ─── VistaSemana ──────────────────────────────────────────────────────────────
function VistaSemana({ fechaSel, setFechaSel, citasSemana, onCitaClick, setVista }) {
  const lunes = startOfWeek(fechaSel)
  const dias  = Array.from({ length: 5 }, (_, i) => addDays(lunes, i))
  const hoy   = ymd(new Date())

  return (
    <div className="p-4">
      <div className="grid grid-cols-5 gap-2">
        {dias.map(d => {
          const key    = ymd(d)
          const dcitas = citasSemana[key] || []
          const esHoy  = key === hoy
          const esSel  = key === ymd(fechaSel)
          return (
            <div key={key}
              onClick={() => { setFechaSel(d); setVista('dia') }}
              className={`rounded-2xl p-3 cursor-pointer transition-all border ${
                esHoy
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                  : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700'
              }`}>
              {/* Header día */}
              <p className={`text-xs font-semibold mb-0.5 ${
                esHoy ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'
              }`}>{DIAS_ES[d.getDay()]}</p>
              <p className={`text-2xl font-black leading-none mb-2 ${
                esHoy ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
              }`}>{d.getDate()}</p>

              {/* Citas mini */}
              <div className="space-y-1">
                {dcitas.slice(0, 4).map(c => {
                  const meta = ESTADO[c.estado] || ESTADO.pendiente
                  return (
                    <div key={c.id}
                      onClick={e => { e.stopPropagation(); onCitaClick(c) }}
                      className="rounded-lg px-1.5 py-1 cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: meta.bar, borderLeft: `2px solid ${meta.dot}` }}>
                      <p className="text-xs font-semibold truncate" style={{ color: meta.text }}>
                        {hhmm(c.fecha_inicio)}
                      </p>
                      <p className="text-xs truncate opacity-70" style={{ color: meta.text }}>
                        {c.clientes_agenda?.nombre?.split(' ')[0]}
                      </p>
                    </div>
                  )
                })}
                {dcitas.length > 4 && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 pl-1">
                    +{dcitas.length - 4} más
                  </p>
                )}
                {dcitas.length === 0 && (
                  <p className="text-xs text-gray-300 dark:text-slate-700 pl-0.5">Libre</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── StatsBar ─────────────────────────────────────────────────────────────────
function StatsBar({ citas, horario }) {
  const stats = useMemo(() => {
    const total   = citas.length
    const activas = citas.filter(c => !['cancelada','no_asistio'].includes(c.estado)).length
    const mins    = citas
      .filter(c => !['cancelada','no_asistio'].includes(c.estado))
      .reduce((acc, c) => acc + minsDiff(c.fecha_inicio, c.fecha_fin), 0)
    const [h1,m1] = (horario.hora_inicio||'07:00').split(':').map(Number)
    const [h2,m2] = (horario.hora_fin||'19:00').split(':').map(Number)
    const laboralMins = (h2*60+m2) - (h1*60+m1)
    const libre = Math.max(0, laboralMins - mins)
    return { total, activas, mins, libre }
  }, [citas, horario])

  function fmtMins(m) {
    if (m <= 0) return '0m'
    const h = Math.floor(m/60), mn = m%60
    return h > 0 ? `${h}h${mn > 0 ? mn+'m' : ''}` : `${mn}m`
  }

  return (
    <div className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 px-4 py-3 flex-shrink-0">
      <div className="flex gap-4 justify-around">
        <Stat label="Citas" value={stats.activas} />
        <div className="w-px bg-gray-200 dark:bg-slate-800" />
        <Stat label="Ocupado" value={fmtMins(stats.mins)} />
        <div className="w-px bg-gray-200 dark:bg-slate-800" />
        <Stat label="Libre" value={fmtMins(stats.libre)} accent />
      </div>
    </div>
  )
}
function Stat({ label, value, accent }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-lg font-black leading-none ${
        accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
      }`}>{value}</span>
      <span className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{label}</span>
    </div>
  )
}

// ─── DrawerDetalle ────────────────────────────────────────────────────────────
function DrawerDetalle({ cita, onClose, onEstado, updatingId }) {
  const meta = ESTADO[cita.estado] || ESTADO.pendiente
  const mins = minsDiff(cita.fecha_inicio, cita.fecha_fin)

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[1px]" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl
                      shadow-2xl max-h-[85vh] overflow-y-auto
                      animate-[slideUp_0.25s_cubic-bezier(0.32,0.72,0,1)]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-700" />
        </div>

        <div className="px-5 pb-8">
          {/* Estado badge */}
          <div className="flex items-center justify-between mb-4 mt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  style={{ backgroundColor: meta.bar, color: meta.text }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.dot }} />
              {meta.label}
            </span>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center
                         text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Nombre */}
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-0.5">
            {cita.clientes_agenda?.nombre || 'Paciente'}
          </h2>
          {cita.clientes_agenda?.telefono && (
            <a href={`tel:${cita.clientes_agenda.telefono}`}
               className="text-sm text-blue-500 dark:text-blue-400 hover:underline">
              {cita.clientes_agenda.telefono}
            </a>
          )}

          {/* Detalles principales */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <InfoCard icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      label="Fecha" value={new Date(cita.fecha_inicio).toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'})} />
            <InfoCard icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      label="Hora" value={`${hhmm(cita.fecha_inicio)} – ${hhmm(cita.fecha_fin)}`} />
            <InfoCard icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      label="Servicio" value={cita.servicios?.nombre || '—'} />
            <InfoCard icon="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      label="Modalidad" value={cita.modalidad || 'Presencial'} />
          </div>

          {/* Campos psicología */}
          {(cita.edad || cita.motivo || cita.quien_asiste) && (
            <div className="mt-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-2.5">
              {cita.edad && (
                <Row icon="M16 7a4 4 0 11-8 0 4 4 0 018 0z M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" label="Edad" value={cita.edad} />
              )}
              {cita.motivo && (
                <Row icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" label="Motivo" value={cita.motivo} />
              )}
              {cita.quien_asiste && (
                <Row icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857" label="Asiste" value={cita.quien_asiste} />
              )}
            </div>
          )}

          {cita.notas && (
            <div className="mt-3 bg-amber-50 dark:bg-amber-500/10 rounded-2xl p-4">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">Notas</p>
              <p className="text-sm text-gray-700 dark:text-slate-300">{cita.notas}</p>
            </div>
          )}

          {/* Duración */}
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 bg-gray-100 dark:bg-slate-800 rounded-full h-2">
              <div className="h-2 rounded-full" style={{
                backgroundColor: meta.dot,
                width: `${Math.min(100, (mins / 120) * 100)}%`
              }} />
            </div>
            <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">{mins}min</span>
          </div>

          {/* Acciones de estado */}
          {!['completada','cancelada'].includes(cita.estado) && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-3 uppercase tracking-wider">
                Cambiar estado
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ACCIONES_ESTADO.filter(a => a.key !== cita.estado).map(a => {
                  const am = ESTADO[a.key]
                  return (
                    <button key={a.key}
                      disabled={updatingId === cita.id}
                      onClick={() => onEstado(cita.id, a.key)}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                      style={{ backgroundColor: am.bar, color: am.text }}>
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={a.icon} />
                      </svg>
                      {a.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* WhatsApp rápido */}
          {cita.clientes_agenda?.telefono && (
            <a href={`https://wa.me/57${cita.clientes_agenda.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${cita.clientes_agenda.nombre?.split(' ')[0]}, le confirmamos su cita del ${new Date(cita.fecha_inicio).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})} a las ${hhmm(cita.fecha_inicio)}.`)}`}
               target="_blank" rel="noopener noreferrer"
               className="mt-4 flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl font-bold text-sm
                          bg-emerald-500 text-white hover:bg-emerald-600 transition-colors active:scale-95">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Confirmar por WhatsApp
            </a>
          )}
        </div>
      </div>
    </>
  )
}

function InfoCard({ icon, label, value }) {
  return (
    <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <svg className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
        <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">{label}</span>
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{value}</p>
    </div>
  )
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <svg className="w-4 h-4 text-gray-400 dark:text-slate-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
      </svg>
      <div>
        <span className="text-xs text-gray-400 dark:text-slate-500">{label}: </span>
        <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{value}</span>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Agenda() {
  const { tenant }    = useTenant()
  const [profs, setProfs]         = useState([])
  const [profSel, setProfSel]     = useState(null)
  const [fechaSel, setFechaSel]   = useState(new Date())
  const [citas, setCitas]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [citaSel, setCitaSel]     = useState(null)
  const [horario, setHorario]     = useState({ hora_inicio:'08:00', hora_fin:'18:00' })
  const [vista, setVista]         = useState('dia')
  const [updatingId, setUpdatingId] = useState(null)
  const tlRef  = useRef(null)
  const hoy    = useMemo(() => new Date(), [])
  const dark   = document.documentElement.classList.contains('dark')

  useEffect(() => { if (tenant?.id) cargarProfs() }, [tenant])
  useEffect(() => { if (profSel) { cargarCitas(); cargarHorario() } }, [profSel, fechaSel, vista])

  // Auto-scroll to current time
  useEffect(() => {
    if (!tlRef.current || loading) return
    const now  = new Date()
    const top  = Math.max(0, ((now.getHours() - HORA_INI) * 60 + now.getMinutes()) * PX_MIN - 120)
    tlRef.current.scrollTop = top
  }, [loading, vista])

  async function cargarProfs() {
    const { data } = await supabase
      .from('profesionales').select('id, nombre, color, especialidad')
      .eq('tenant_id', tenant.id).eq('activo', true).order('nombre')
    setProfs(data || [])
    if (data?.length) setProfSel(data[0])
  }

  async function cargarHorario() {
    const diaSel = DIAS_ES[fechaSel.getDay()]
    const diaDB  = DIA_DB[diaSel]
    if (!diaDB) return
    const { data } = await supabase.from('horarios')
      .select('hora_inicio, hora_fin, activo')
      .eq('profesional_id', profSel.id).eq('dia', diaDB).maybeSingle()
    if (data?.activo) setHorario(data)
    else setHorario({ hora_inicio:'08:00', hora_fin:'18:00' })
  }

  async function cargarCitas() {
    setLoading(true)
    let desde, hasta
    if (vista === 'dia') {
      desde = ymd(fechaSel) + 'T00:00:00'
      hasta = ymd(fechaSel) + 'T23:59:59'
    } else {
      const l = startOfWeek(fechaSel)
      desde   = ymd(l) + 'T00:00:00'
      hasta   = ymd(addDays(l, 6)) + 'T23:59:59'
    }
    const { data } = await supabase.from('citas')
      .select('id,fecha_inicio,fecha_fin,estado,notas,modalidad,edad,motivo,quien_asiste,clientes_agenda(nombre,telefono,email),servicios(nombre,duracion_min)')
      .eq('tenant_id', tenant.id)
      .eq('profesional_id', profSel.id)
      .gte('fecha_inicio', desde).lte('fecha_inicio', hasta)
      .order('fecha_inicio')
    setCitas(data || [])
    setLoading(false)
  }

  async function cambiarEstado(id, estado) {
    setUpdatingId(id)
    await supabase.from('citas').update({ estado }).eq('id', id)
    setCitas(cs => cs.map(c => c.id === id ? { ...c, estado } : c))
    if (citaSel?.id === id) setCitaSel(c => ({ ...c, estado }))
    setUpdatingId(null)
  }

  const citasHoy = useMemo(() => {
    const d = ymd(fechaSel)
    return citas.filter(c => ymd(new Date(c.fecha_inicio)) === d)
  }, [citas, fechaSel])

  const citasSemana = useMemo(() => {
    const lunes = startOfWeek(fechaSel)
    const map   = {}
    for (let i = 0; i < 7; i++) map[ymd(addDays(lunes, i))] = []
    citas.forEach(c => {
      const d = ymd(new Date(c.fecha_inicio))
      if (map[d]) map[d].push(c)
    })
    return map
  }, [citas, fechaSel])

  const horaIniN = parseInt((horario.hora_inicio||'08:00').split(':')[0], 10)
  const horaFinN = parseInt((horario.hora_fin||'18:00').split(':')[0], 10)

  const ahoraTop = useMemo(() => {
    const n = new Date()
    return (n.getHours() * 60 + n.getMinutes() - HORA_INI * 60) * PX_MIN
  }, [])
  const esHoy = ymd(fechaSel) === ymd(hoy)

  if (!profs.length && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <svg className="w-12 h-12 text-gray-200 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-400 dark:text-slate-500 text-sm text-center">
          Configura profesionales en la sección Profesionales primero
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 overflow-hidden">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 pt-4 pb-0 flex-shrink-0">

        {/* Profesional + vista toggle */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1.5 flex-wrap">
            {profs.map(p => (
              <button key={p.id} onClick={() => setProfSel(p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                style={profSel?.id === p.id
                  ? { backgroundColor: p.color||'#3b82f6', borderColor: p.color||'#3b82f6', color:'#fff' }
                  : { borderColor:'#e5e7eb', color:'#6b7280' }
                }>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                {p.nombre.split(' ').slice(0,2).join(' ')}
              </button>
            ))}
          </div>
          <div className="flex border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden flex-shrink-0">
            {['dia','semana'].map(v => (
              <button key={v} onClick={() => setVista(v)}
                className={`px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  vista === v
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'text-gray-400 dark:text-slate-500 hover:text-gray-700'
                }`}>{v}</button>
            ))}
          </div>
        </div>

        {/* Fecha nav */}
        <div className="flex items-center gap-2">
          <button onClick={() => setFechaSel(d => addDays(d, vista==='semana'?-7:-1))}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
              {vista === 'dia'
                ? `${DIAS_ES[fechaSel.getDay()]} ${fechaSel.getDate()} ${MESES_ES[fechaSel.getMonth()]} ${fechaSel.getFullYear()}`
                : (() => {
                    const l = startOfWeek(fechaSel), v = addDays(l, 4)
                    return `${l.getDate()} – ${v.getDate()} ${MESES_ES[v.getMonth()]} ${v.getFullYear()}`
                  })()
              }
            </p>
            {esHoy && vista === 'dia' && (
              <p className="text-xs text-blue-500 dark:text-blue-400 font-semibold">Hoy</p>
            )}
          </div>
          <button onClick={() => setFechaSel(d => addDays(d, vista==='semana'?7:1))}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button onClick={() => setFechaSel(new Date())}
            className="px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded-lg hover:bg-blue-100 transition-colors flex-shrink-0">
            Hoy
          </button>
        </div>

        {/* Week strip (solo vista día) */}
        {vista === 'dia' && (
          <WeekStrip fechaSel={fechaSel} setFechaSel={setFechaSel} citas={citas} hoy={hoy} />
        )}
      </div>

      {/* ── Contenido ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : vista === 'dia' ? (
        <div ref={tlRef} className="flex-1 overflow-y-auto py-2 px-2"
             style={{ minHeight: 0 }}>
          <TimelineDay
            citas={citasHoy}
            ahoraTop={ahoraTop}
            esHoy={esHoy}
            onCitaClick={setCitaSel}
            citaSelId={citaSel?.id}
            horaIni={horaIniN}
            horaFin={horaFinN}
            dark={dark}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          <VistaSemana
            fechaSel={fechaSel}
            setFechaSel={setFechaSel}
            citasSemana={citasSemana}
            onCitaClick={setCitaSel}
            setVista={setVista}
          />
        </div>
      )}

      {/* ── Stats bar (solo día) ── */}
      {vista === 'dia' && (
        <StatsBar citas={citasHoy} horario={horario} />
      )}

      {/* ── Drawer ── */}
      {citaSel && (
        <DrawerDetalle
          cita={citaSel}
          onClose={() => setCitaSel(null)}
          onEstado={cambiarEstado}
          updatingId={updatingId}
        />
      )}
    </div>
  )
}
