import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ESTADO_COLOR = {
  activa:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  trial:      'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  vencida:    'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  suspendida: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  cancelada:  'bg-gray-100 text-gray-500 dark:bg-slate-500/20 dark:text-slate-400',
}

export default function Suscripciones() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState('todos')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('suscripciones')
      .select(`id, estado, fecha_inicio, fecha_vencimiento, created_at,
               tenant:tenants(id, nombre, slug),
               plan:planes(nombre, tipo, precio_mes)`)
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('suscripciones').update({ estado }).eq('id', id)
    cargar()
  }

  const filtrados = filtro === 'todos' ? items : items.filter(s => s.estado === filtro)

  const conteo = {
    todos:   items.length,
    activa:  items.filter(s => s.estado === 'activa').length,
    trial:   items.filter(s => s.estado === 'trial').length,
    vencida: items.filter(s => s.estado === 'vencida').length,
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Suscripciones</h1>
        <button onClick={cargar} className="text-xs text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'todos',   label: `Todos (${conteo.todos})` },
          { key: 'activa',  label: `Activas (${conteo.activa})` },
          { key: 'trial',   label: `Trial (${conteo.trial})` },
          { key: 'vencida', label: `Vencidas (${conteo.vencida})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`text-xs px-4 py-1.5 rounded-full border transition-colors ${
              filtro === f.key
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
          {filtrados.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-slate-500 text-sm">Sin suscripciones</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800">
                  {['Negocio','Plan','Estado','Inicio','Vencimiento','Acciones'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filtrados.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">{s.tenant?.nombre || '—'}</p>
                      <p className="text-gray-400 dark:text-slate-500 text-xs">/{s.tenant?.slug}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-gray-700 dark:text-slate-300 capitalize">{s.plan?.nombre || '—'}</p>
                      <p className="text-gray-400 dark:text-slate-500 text-xs">
                        {s.plan?.precio_mes ? `$${Number(s.plan.precio_mes).toLocaleString('es-CO')}/mes` : ''}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ESTADO_COLOR[s.estado] || 'text-gray-400'}`}>
                        {s.estado}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 dark:text-slate-400 text-xs">
                      {s.fecha_inicio ? new Date(s.fecha_inicio).toLocaleDateString('es-CO') : '—'}
                    </td>
                    <td className="px-5 py-4 text-gray-500 dark:text-slate-400 text-xs">
                      {s.fecha_vencimiento ? new Date(s.fecha_vencimiento).toLocaleDateString('es-CO') : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        {s.estado !== 'activa' && (
                          <button
                            onClick={() => cambiarEstado(s.id, 'activa')}
                            className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700
                                       text-gray-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600
                                       dark:hover:text-emerald-400 transition-colors"
                          >
                            Activar
                          </button>
                        )}
                        {s.estado !== 'cancelada' && (
                          <button
                            onClick={() => cambiarEstado(s.id, 'cancelada')}
                            className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700
                                       text-gray-600 dark:text-slate-300 hover:border-red-500 hover:text-red-500
                                       dark:hover:text-red-400 transition-colors"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
