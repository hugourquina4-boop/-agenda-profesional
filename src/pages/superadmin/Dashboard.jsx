import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const VERTICAL_LABEL = { psicologo: 'Psicólogo', peluqueria: 'Peluquería', sso: 'SSO', otro: 'Otro' }
const VERTICAL_COLOR = { psicologo: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300', peluqueria: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300', sso: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300', otro: 'bg-gray-100 text-gray-600 dark:bg-slate-500/20 dark:text-slate-300' }
const ESTADO_COLOR   = { activa: 'text-emerald-600 dark:text-emerald-400', trial: 'text-blue-600 dark:text-blue-400', vencida: 'text-red-500 dark:text-red-400', suspendida: 'text-yellow-600 dark:text-yellow-400', cancelada: 'text-gray-400 dark:text-slate-500' }

export default function SuperadminDashboard() {
  const [negocios, setNegocios] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.rpc('get_superadmin_negocios')
    setNegocios(data || [])
    setLoading(false)
  }

  const total    = negocios.length
  const activos  = negocios.filter(n => n.activo).length
  const ingresos = negocios.reduce((s, n) => s + (n.precio_mes || 0), 0)
  const citas30d = negocios.reduce((s, n) => s + (Number(n.citas_30d) || 0), 0)

  return (
    <div className="p-6 max-w-6xl mx-auto">

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Negocios totales',  value: total,    sub: `${activos} activos` },
          { label: 'Ingresos/mes',      value: `$${ingresos.toLocaleString('es-CO')}`, sub: 'COP estimado' },
          { label: 'Citas últimos 30d', value: citas30d, sub: 'todos los negocios' },
          { label: 'Por verificar',     value: negocios.filter(n => !n.verificado).length, sub: 'pendientes de activar' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800">
            <p className="text-gray-500 dark:text-slate-400 text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1.5">{s.value}</p>
            <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabla negocios */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Negocios registrados</h2>
          <button onClick={cargar} className="text-xs text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : negocios.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500">
            <p className="text-sm">Aún no hay negocios registrados</p>
            <p className="text-xs mt-1">Cuando un cliente se registre aparecerá aquí</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800">
                  {['Negocio','Vertical','Plan','Suscripción','Citas 30d','Total citas','Registrado'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {negocios.map(n => (
                  <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{n.nombre}</p>
                        <p className="text-gray-400 dark:text-slate-500 text-xs">/{n.slug}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${VERTICAL_COLOR[n.vertical]}`}>
                        {VERTICAL_LABEL[n.vertical]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-gray-700 dark:text-slate-300 capitalize">{n.plan || '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-medium capitalize ${ESTADO_COLOR[n.suscripcion_estado] || 'text-gray-400'}`}>
                        {n.suscripcion_estado || 'Sin plan'}
                      </span>
                      {n.fecha_vencimiento && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                          vence {new Date(n.fecha_vencimiento).toLocaleDateString('es-CO')}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-slate-300">{n.citas_30d || 0}</td>
                    <td className="px-5 py-4 text-gray-700 dark:text-slate-300">{n.total_citas || 0}</td>
                    <td className="px-5 py-4 text-gray-400 dark:text-slate-500 text-xs">
                      {n.registrado_en ? new Date(n.registrado_en).toLocaleDateString('es-CO') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
