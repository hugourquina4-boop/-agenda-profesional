import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

const ESTADO_COLOR = {
  pendiente:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  confirmada: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  completada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  cancelada:  'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  no_asistio: 'bg-gray-100 text-gray-500 dark:bg-slate-500/20 dark:text-slate-400',
}

export default function TenantDashboard() {
  const { tenant } = useTenant()
  const [citas, setCitas]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (tenant?.id) cargar() }, [tenant])

  async function cargar() {
    setLoading(true)
    const hoy = new Date()
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString()
    const finHoy    = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1).toISOString()

    const { data } = await supabase
      .from('citas')
      .select(`id, fecha_inicio, fecha_fin, estado,
               cliente:clientes_agenda(nombre, telefono),
               profesional:profesionales(nombre, color),
               servicio:servicios(nombre, duracion_min)`)
      .eq('tenant_id', tenant.id)
      .gte('fecha_inicio', inicioHoy)
      .lt('fecha_inicio', finHoy)
      .neq('estado', 'cancelada')
      .order('fecha_inicio')
    setCitas(data || [])
    setLoading(false)
  }

  const ahora = new Date()
  const proximas = citas.filter(c => new Date(c.fecha_inicio) > ahora)
  const enCurso  = citas.filter(c => new Date(c.fecha_inicio) <= ahora && new Date(c.fecha_fin) >= ahora)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{tenant?.nombre}</p>
      </div>

      {/* Stats del día */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Citas hoy',      value: citas.length,    color: 'blue' },
          { label: 'En curso',       value: enCurso.length,  color: 'emerald' },
          { label: 'Próximas',       value: proximas.length, color: 'purple' },
          { label: 'Completadas',    value: citas.filter(c => c.estado === 'completada').length, color: 'gray' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800">
            <p className="text-gray-500 dark:text-slate-400 text-xs font-medium">{s.label}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Agenda del día */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Agenda de hoy</h2>
          <button onClick={cargar} className="text-xs text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : citas.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Sin citas para hoy</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {citas.map(c => {
              const inicio = new Date(c.fecha_inicio)
              const fin    = new Date(c.fecha_fin)
              const activa = inicio <= ahora && fin >= ahora
              return (
                <div key={c.id} className={`px-6 py-4 flex items-center gap-4 ${activa ? 'bg-blue-50 dark:bg-blue-500/5' : ''}`}>
                  {/* Hora */}
                  <div className="text-center w-14 flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {inicio.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      {fin.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {/* Color profesional */}
                  <div
                    className="w-1 self-stretch rounded-full flex-shrink-0"
                    style={{ backgroundColor: c.profesional?.color || '#3b82f6' }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{c.cliente?.nombre}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {c.servicio?.nombre} · {c.profesional?.nombre}
                    </p>
                  </div>

                  {/* Estado */}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${ESTADO_COLOR[c.estado]}`}>
                    {activa ? 'En curso' : c.estado}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
