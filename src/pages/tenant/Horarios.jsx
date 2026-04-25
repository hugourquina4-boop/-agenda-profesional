import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

const DIAS = [
  { key: 'lunes',     label: 'Lunes' },
  { key: 'martes',    label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves',    label: 'Jueves' },
  { key: 'viernes',   label: 'Viernes' },
  { key: 'sabado',    label: 'Sábado' },
  { key: 'domingo',   label: 'Domingo' },
]

export default function Horarios() {
  const { tenant } = useTenant()
  const [profs, setProfs]           = useState([])
  const [profSel, setProfSel]       = useState(null)
  const [horarios, setHorarios]     = useState({}) // { lunes: { activo, hora_inicio, hora_fin } }
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [guardado, setGuardado]     = useState(false)

  useEffect(() => { if (tenant?.id) cargarProfs() }, [tenant])
  useEffect(() => { if (profSel) cargarHorarios() }, [profSel])

  async function cargarProfs() {
    const { data } = await supabase
      .from('profesionales')
      .select('id, nombre, color')
      .eq('tenant_id', tenant.id)
      .eq('activo', true)
      .order('nombre')
    setProfs(data || [])
    if (data?.length > 0) setProfSel(data[0])
    setLoading(false)
  }

  async function cargarHorarios() {
    const { data } = await supabase
      .from('horarios')
      .select('*')
      .eq('profesional_id', profSel.id)

    const mapa = {}
    DIAS.forEach(d => {
      const h = data?.find(x => x.dia === d.key)
      mapa[d.key] = h
        ? { activo: h.activo, hora_inicio: h.hora_inicio.slice(0, 5), hora_fin: h.hora_fin.slice(0, 5), id: h.id }
        : { activo: false, hora_inicio: '08:00', hora_fin: '17:00', id: null }
    })
    setHorarios(mapa)
  }

  function cambiar(dia, campo, valor) {
    setHorarios(h => ({ ...h, [dia]: { ...h[dia], [campo]: valor } }))
  }

  async function guardar() {
    if (!profSel) return
    setSaving(true)

    for (const d of DIAS) {
      const h = horarios[d.key]
      if (!h) continue
      const payload = {
        tenant_id:      tenant.id,
        profesional_id: profSel.id,
        dia:            d.key,
        hora_inicio:    h.hora_inicio,
        hora_fin:       h.hora_fin,
        activo:         h.activo,
      }
      if (h.id) {
        await supabase.from('horarios').update(payload).eq('id', h.id)
      } else if (h.activo) {
        const { data } = await supabase.from('horarios').insert(payload).select('id').single()
        if (data) cambiar(d.key, 'id', data.id)
      }
    }

    setSaving(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (profs.length === 0) {
    return (
      <div className="p-6 text-center py-20 text-gray-400 dark:text-slate-500">
        <p className="text-sm">Primero agrega profesionales en la sección Profesionales</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Horarios</h1>
        <p className="text-gray-500 dark:text-slate-400 text-xs mt-1">
          Disponibilidad semanal por profesional
        </p>
      </div>

      {/* Selector de profesional */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {profs.map(p => (
          <button
            key={p.id}
            onClick={() => setProfSel(p)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              profSel?.id === p.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
            {p.nombre}
          </button>
        ))}
      </div>

      {/* Grilla de horarios */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800">
          <p className="font-semibold text-gray-900 dark:text-white text-sm">
            Horario de {profSel?.nombre}
          </p>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {DIAS.map(d => {
            const h = horarios[d.key] || { activo: false, hora_inicio: '08:00', hora_fin: '17:00' }
            return (
              <div key={d.key} className={`px-6 py-4 flex items-center gap-4 ${!h.activo ? 'opacity-50' : ''}`}>
                {/* Toggle día */}
                <div
                  onClick={() => cambiar(d.key, 'activo', !h.activo)}
                  className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
                    h.activo ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    h.activo ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </div>

                {/* Día */}
                <span className="w-24 text-sm font-medium text-gray-700 dark:text-slate-300 flex-shrink-0">
                  {d.label}
                </span>

                {/* Horas */}
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={h.hora_inicio}
                    disabled={!h.activo}
                    onChange={e => cambiar(d.key, 'hora_inicio', e.target.value)}
                    className="bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                               rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white
                               focus:outline-none focus:border-blue-500 disabled:cursor-not-allowed"
                  />
                  <span className="text-gray-400 dark:text-slate-500 text-sm">a</span>
                  <input
                    type="time"
                    value={h.hora_fin}
                    disabled={!h.activo}
                    onChange={e => cambiar(d.key, 'hora_fin', e.target.value)}
                    className="bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                               rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white
                               focus:outline-none focus:border-blue-500 disabled:cursor-not-allowed"
                  />
                  {h.activo && (
                    <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">
                      {calcHoras(h.hora_inicio, h.hora_fin)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <button
        onClick={guardar}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                   text-white font-semibold transition-colors"
      >
        {saving ? 'Guardando...' : guardado ? '¡Guardado!' : 'Guardar horarios'}
      </button>
    </div>
  )
}

function calcHoras(inicio, fin) {
  if (!inicio || !fin) return ''
  const [h1, m1] = inicio.split(':').map(Number)
  const [h2, m2] = fin.split(':').map(Number)
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`
}
