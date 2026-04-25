import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const PLAN_BORDER = {
  free:       'border-gray-300 dark:border-slate-600',
  basico:     'border-blue-400 dark:border-blue-500',
  pro:        'border-purple-400 dark:border-purple-500',
  enterprise: 'border-amber-400 dark:border-amber-500',
}

const PLAN_BADGE = {
  free:       'bg-gray-100 text-gray-600 dark:bg-slate-500/20 dark:text-slate-400',
  basico:     'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  pro:        'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  enterprise: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
}

const PLAN_VACIO = {
  nombre: '',
  tipo: 'basico',
  precio_mes: 0,
  max_citas_mes: 150,
  max_profesionales: 2,
  tiene_recordatorios: true,
  tiene_whatsapp: false,
  tiene_reportes: true,
  tiene_multisede: false,
  descripcion: '',
  activo: true,
}

export default function Planes() {
  const [planes, setPlanes]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [editando, setEditando] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('planes')
      .select('*')
      .order('precio_mes', { ascending: true })
    setPlanes(data || [])
    setLoading(false)
  }

  async function guardar() {
    if (!editando?.nombre?.trim()) return
    setSaving(true)
    setError('')
    const { id, created_at, updated_at, ...payload } = editando
    let err
    if (id) {
      const { error: e } = await supabase.from('planes').update(payload).eq('id', id)
      err = e
    } else {
      const { error: e } = await supabase.from('planes').insert(payload)
      err = e
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    setEditando(null)
    cargar()
  }

  function campo(key, value) {
    setEditando(p => ({ ...p, [key]: value }))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planes</h1>
          <p className="text-gray-500 dark:text-slate-400 text-xs mt-1">
            Ajusta precios y límites a tu criterio — los cambios aplican de inmediato
          </p>
        </div>
        <button
          onClick={() => setEditando({ ...PLAN_VACIO })}
          className="text-xs px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
        >
          + Nuevo plan
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {planes.map(p => (
            <div key={p.id} className={`bg-white dark:bg-slate-900 rounded-2xl border-2 ${PLAN_BORDER[p.tipo] || 'border-gray-200 dark:border-slate-700'} p-5`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 dark:text-white">{p.nombre}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PLAN_BADGE[p.tipo]}`}>
                      {p.tipo}
                    </span>
                    {!p.activo && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 dark:text-slate-400 text-xs mt-0.5">{p.descripcion || 'Sin descripción'}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-900 dark:text-white font-bold text-lg">
                    {p.precio_mes === 0 ? 'Gratis' : `$${Number(p.precio_mes).toLocaleString('es-CO')}`}
                  </p>
                  {p.precio_mes > 0 && <p className="text-gray-400 dark:text-slate-500 text-xs">/mes</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400 mb-4">
                <span>Profesionales: <b className="text-gray-800 dark:text-white">{p.max_profesionales ?? '∞'}</b></span>
                <span>Citas/mes: <b className="text-gray-800 dark:text-white">{p.max_citas_mes ?? '∞'}</b></span>
                <span>Recordatorios: <b className={p.tiene_recordatorios ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}>{p.tiene_recordatorios ? 'Sí' : 'No'}</b></span>
                <span>WhatsApp: <b className={p.tiene_whatsapp ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}>{p.tiene_whatsapp ? 'Sí' : 'No'}</b></span>
                <span>Reportes: <b className={p.tiene_reportes ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}>{p.tiene_reportes ? 'Sí' : 'No'}</b></span>
                <span>Multi-sede: <b className={p.tiene_multisede ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}>{p.tiene_multisede ? 'Sí' : 'No'}</b></span>
              </div>

              <button
                onClick={() => setEditando({ ...p })}
                className="w-full text-xs py-2 rounded-xl border border-gray-200 dark:border-slate-700
                           text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white
                           hover:border-gray-400 dark:hover:border-slate-500 transition-colors"
              >
                Editar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 w-full max-w-md my-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-5">
              {editando.id ? 'Editar plan' : 'Nuevo plan'}
            </h3>

            <div className="space-y-4">
              {/* Nombre */}
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Nombre</label>
                <input
                  value={editando.nombre}
                  onChange={e => campo('nombre', e.target.value)}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white
                             focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Tipo</label>
                <select
                  value={editando.tipo}
                  onChange={e => campo('tipo', e.target.value)}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white
                             focus:outline-none focus:border-blue-500"
                >
                  {['free','basico','pro','enterprise'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Precio */}
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Precio/mes (COP)</label>
                <input
                  type="number"
                  min="0"
                  value={editando.precio_mes}
                  onChange={e => campo('precio_mes', Number(e.target.value))}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white
                             focus:outline-none focus:border-blue-500"
                />
                {editando.precio_mes > 0 && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    = ${Number(editando.precio_mes).toLocaleString('es-CO')} COP
                  </p>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Descripción</label>
                <input
                  value={editando.descripcion || ''}
                  onChange={e => campo('descripcion', e.target.value)}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white
                             focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Límites numéricos */}
              <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-3 uppercase tracking-wider">Límites</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'max_profesionales', label: 'Profesionales' },
                    { key: 'max_citas_mes',     label: 'Citas/mes' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">{f.label}</label>
                      <input
                        type="number"
                        min="0"
                        value={editando[f.key] ?? ''}
                        placeholder="∞ ilimitado"
                        onChange={e => campo(f.key, e.target.value === '' ? null : Number(e.target.value))}
                        className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                                   rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white
                                   focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { key: 'tiene_recordatorios', label: 'Recordatorios' },
                  { key: 'tiene_whatsapp',      label: 'WhatsApp bot' },
                  { key: 'tiene_reportes',      label: 'Reportes' },
                  { key: 'tiene_multisede',     label: 'Multi-sede' },
                ].map(f => (
                  <label key={f.key} className="flex items-center gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <div
                      onClick={() => campo(f.key, !editando[f.key])}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
                        editando[f.key] ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        editando[f.key] ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </div>
                    <span className="text-xs text-gray-700 dark:text-slate-300">{f.label}</span>
                  </label>
                ))}
              </div>

              {/* Activo */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => campo('activo', !editando.activo)}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
                    editando.activo ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    editando.activo ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </div>
                <span className="text-xs text-gray-700 dark:text-slate-300">Plan activo (visible para clientes)</span>
              </label>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-xl">{error}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setEditando(null); setError('') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700
                           text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={saving || !editando.nombre?.trim()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500
                           text-white font-medium transition-colors text-sm disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
