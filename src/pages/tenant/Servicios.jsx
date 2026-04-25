import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

const VACIO = { nombre: '', descripcion: '', duracion_min: 30, precio: 0, activo: true, color: '#3b82f6' }

export default function Servicios() {
  const { tenant } = useTenant()
  const [lista, setLista]       = useState([])
  const [profs, setProfs]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [editando, setEditando] = useState(null)
  const [profsEdit, setProfsEdit] = useState([]) // IDs seleccionados en el modal
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => { if (tenant?.id) cargar() }, [tenant])

  async function cargar() {
    setLoading(true)
    const [{ data: svcs }, { data: ps }] = await Promise.all([
      supabase.from('servicios')
        .select('*, profesional_servicios(profesional_id)')
        .eq('tenant_id', tenant.id)
        .order('orden').order('nombre'),
      supabase.from('profesionales')
        .select('id, nombre, color')
        .eq('tenant_id', tenant.id)
        .eq('activo', true)
        .order('nombre'),
    ])
    setLista(svcs || [])
    setProfs(ps || [])
    setLoading(false)
  }

  function abrir(s = null) {
    if (s) {
      setEditando({ ...s })
      setProfsEdit(s.profesional_servicios?.map(x => x.profesional_id) || [])
    } else {
      setEditando({ ...VACIO })
      setProfsEdit(profs.map(p => p.id)) // todos seleccionados por defecto
    }
    setError('')
  }

  async function guardar() {
    if (!editando?.nombre?.trim()) return
    setSaving(true)
    setError('')
    const { id, created_at, updated_at, profesional_servicios: _ps, ...payload } = editando
    const base = { ...payload, tenant_id: tenant.id }

    let servicioId = id
    if (id) {
      const { error: e } = await supabase.from('servicios').update(base).eq('id', id)
      if (e) { setSaving(false); setError(e.message); return }
    } else {
      const { data, error: e } = await supabase.from('servicios').insert(base).select('id').single()
      if (e) { setSaving(false); setError(e.message); return }
      servicioId = data.id
    }

    // Sincronizar profesional_servicios
    await supabase.from('profesional_servicios').delete().eq('servicio_id', servicioId)
    if (profsEdit.length > 0) {
      await supabase.from('profesional_servicios').insert(
        profsEdit.map(pid => ({ profesional_id: pid, servicio_id: servicioId }))
      )
    }

    setSaving(false)
    setEditando(null)
    cargar()
  }

  function toggleProf(id) {
    setProfsEdit(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  const DURACIONES = [15, 20, 30, 45, 60, 90, 120]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Servicios</h1>
          <p className="text-gray-500 dark:text-slate-400 text-xs mt-1">
            Qué se ofrece, cuánto dura y quién lo realiza
          </p>
        </div>
        <button
          onClick={() => abrir()}
          className="text-xs px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
        >
          + Agregar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-slate-500">
          <p className="text-sm">Agrega servicios para que los clientes puedan reservar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map(s => {
            const profsDelServicio = profs.filter(p =>
              s.profesional_servicios?.some(x => x.profesional_id === p.id)
            )
            return (
              <div key={s.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white">{s.nombre}</p>
                        {!s.activo && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                            Inactivo
                          </span>
                        )}
                      </div>
                      {s.descripcion && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{s.descripcion}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-slate-400">
                        <span>{s.duracion_min} min</span>
                        <span>·</span>
                        <span>{s.precio > 0 ? `$${Number(s.precio).toLocaleString('es-CO')}` : 'Sin costo'}</span>
                        {profsDelServicio.length > 0 && (
                          <>
                            <span>·</span>
                            <div className="flex gap-1">
                              {profsDelServicio.map(p => (
                                <span
                                  key={p.id}
                                  className="px-1.5 py-0.5 rounded text-white text-xs"
                                  style={{ backgroundColor: p.color }}
                                >
                                  {p.nombre.split(' ')[0]}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => abrir(s)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700
                               text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white
                               hover:border-gray-400 dark:hover:border-slate-500 transition-colors flex-shrink-0"
                  >
                    Editar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 w-full max-w-md my-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-5">
              {editando.id ? 'Editar servicio' : 'Nuevo servicio'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Nombre *</label>
                <input
                  value={editando.nombre}
                  onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Consulta inicial, Corte de cabello..."
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Descripción</label>
                <input
                  value={editando.descripcion || ''}
                  onChange={e => setEditando(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Duración</label>
                  <select
                    value={editando.duracion_min}
                    onChange={e => setEditando(p => ({ ...p, duracion_min: Number(e.target.value) }))}
                    className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                               rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    {DURACIONES.map(d => (
                      <option key={d} value={d}>{d} min{d >= 60 ? ` (${d/60}h)` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Precio (COP)</label>
                  <input
                    type="number"
                    min="0"
                    value={editando.precio}
                    onChange={e => setEditando(p => ({ ...p, precio: Number(e.target.value) }))}
                    className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                               rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Profesionales */}
              {profs.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 mb-2 block">
                    Profesionales que ofrecen este servicio
                  </label>
                  <div className="space-y-2">
                    {profs.map(p => (
                      <label key={p.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                        <input
                          type="checkbox"
                          checked={profsEdit.includes(p.id)}
                          onChange={() => toggleProf(p.id)}
                          className="accent-blue-500 w-4 h-4"
                        />
                        <div className="w-5 h-5 rounded" style={{ backgroundColor: p.color }} />
                        <span className="text-sm text-gray-700 dark:text-slate-300">{p.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

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
