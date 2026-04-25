import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

const COLORES = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444','#06b6d4','#84cc16']

const VACIO = { nombre: '', especialidad: '', color: '#3b82f6', activo: true }

export default function Profesionales() {
  const { tenant } = useTenant()
  const [lista, setLista]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [editando, setEditando] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => { if (tenant?.id) cargar() }, [tenant])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('profesionales')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('nombre')
    setLista(data || [])
    setLoading(false)
  }

  async function guardar() {
    if (!editando?.nombre?.trim()) return
    setSaving(true)
    setError('')
    const { id, created_at, updated_at, user_id, ...payload } = editando
    const base = { ...payload, tenant_id: tenant.id }
    const { error: e } = id
      ? await supabase.from('profesionales').update(base).eq('id', id)
      : await supabase.from('profesionales').insert(base)
    setSaving(false)
    if (e) { setError(e.message); return }
    setEditando(null)
    cargar()
  }

  async function toggleActivo(prof) {
    await supabase.from('profesionales').update({ activo: !prof.activo }).eq('id', prof.id)
    cargar()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profesionales</h1>
          <p className="text-gray-500 dark:text-slate-400 text-xs mt-1">
            Cada profesional tiene su agenda y horario independiente
          </p>
        </div>
        <button
          onClick={() => { setEditando({ ...VACIO }); setError('') }}
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
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">Agrega el primer profesional para empezar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {lista.map(p => (
            <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: p.color }}
                >
                  {p.nombre[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">{p.nombre}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{p.especialidad || 'Sin especialidad'}</p>
                </div>
                {!p.activo && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                    Inactivo
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditando({ ...p }); setError('') }}
                  className="flex-1 text-xs py-2 rounded-xl border border-gray-200 dark:border-slate-700
                             text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white
                             hover:border-gray-400 dark:hover:border-slate-500 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => toggleActivo(p)}
                  className={`flex-1 text-xs py-2 rounded-xl border transition-colors ${
                    p.activo
                      ? 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-red-400 hover:text-red-500'
                      : 'border-emerald-200 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                  }`}
                >
                  {p.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-5">
              {editando.id ? 'Editar profesional' : 'Nuevo profesional'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Nombre completo *</label>
                <input
                  value={editando.nombre}
                  onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Dr. Carlos Pérez"
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white
                             focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Especialidad / rol</label>
                <input
                  value={editando.especialidad || ''}
                  onChange={e => setEditando(p => ({ ...p, especialidad: e.target.value }))}
                  placeholder="Ej: Neuropsicólogo, Estilista senior..."
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white
                             focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-2 block">Color en la agenda</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORES.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditando(p => ({ ...p, color: c }))}
                      className="w-8 h-8 rounded-lg transition-transform hover:scale-110"
                      style={{ backgroundColor: c, outline: editando.color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }}
                    />
                  ))}
                </div>
              </div>

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
