import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

const VACIO = { nombre: '', email: '', telefono: '', whatsapp: '', fecha_nacimiento: '', notas: '' }

function fmt(date) {
  return new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}
function hhmm(date) {
  return new Date(date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

const ESTADO_COLOR = {
  pendiente:  'bg-yellow-100 text-yellow-700',
  confirmada: 'bg-blue-100 text-blue-700',
  completada: 'bg-emerald-100 text-emerald-700',
  cancelada:  'bg-red-100 text-red-600',
  no_asistio: 'bg-gray-100 text-gray-500',
}

export default function Clientes() {
  const { tenant } = useTenant()
  const [lista, setLista]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [busqueda, setBusqueda]   = useState('')
  const [editando, setEditando]   = useState(null)
  const [detalle, setDetalle]     = useState(null)   // cliente seleccionado
  const [historial, setHistorial] = useState([])
  const [loadHist, setLoadHist]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => { if (tenant?.id) cargar() }, [tenant])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('clientes_agenda')
      .select('id, nombre, email, telefono, whatsapp, fecha_nacimiento, notas, created_at')
      .eq('tenant_id', tenant.id)
      .eq('activo', true)
      .order('nombre')
    setLista(data || [])
    setLoading(false)
  }

  async function abrirDetalle(cliente) {
    setDetalle(cliente)
    setLoadHist(true)
    const { data } = await supabase
      .from('citas')
      .select(`id, fecha_inicio, fecha_fin, estado, precio_cobrado,
               profesional:profesionales(nombre, color),
               servicio:servicios(nombre)`)
      .eq('cliente_id', cliente.id)
      .order('fecha_inicio', { ascending: false })
      .limit(20)
    setHistorial(data || [])
    setLoadHist(false)
  }

  async function guardar() {
    if (!editando?.nombre?.trim()) return
    setSaving(true)
    setError('')
    const { id, created_at, ...payload } = editando
    const base = { ...payload, tenant_id: tenant.id, activo: true }
    const { error: e } = id
      ? await supabase.from('clientes_agenda').update(base).eq('id', id)
      : await supabase.from('clientes_agenda').insert(base)
    setSaving(false)
    if (e) { setError(e.message); return }
    setEditando(null)
    cargar()
  }

  const filtrados = lista.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.telefono?.includes(busqueda) ||
    c.email?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const totalCitas = historial.length
  const completadas = historial.filter(c => c.estado === 'completada').length
  const ingresos = historial.filter(c => c.estado === 'completada')
    .reduce((s, c) => s + (Number(c.precio_cobrado) || 0), 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clientes</h1>
          <p className="text-gray-500 dark:text-slate-400 text-xs mt-1">{lista.length} registrados</p>
        </div>
        <div className="flex gap-3">
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, tel, email..."
            className="bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                       rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white
                       placeholder-gray-400 dark:placeholder-slate-500
                       focus:outline-none focus:border-blue-500 w-56"
          />
          <button
            onClick={() => { setEditando({ ...VACIO }); setError('') }}
            className="text-xs px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors whitespace-nowrap"
          >
            + Nuevo cliente
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-slate-500">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <p className="text-sm">{busqueda ? `Sin resultados para "${busqueda}"` : 'Aún no hay clientes registrados'}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-800">
                {['Cliente','Contacto','Registrado',''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filtrados.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-bold flex-shrink-0">
                        {c.nombre[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{c.nombre}</p>
                        {c.fecha_nacimiento && (
                          <p className="text-xs text-gray-400 dark:text-slate-500">
                            {new Date().getFullYear() - new Date(c.fecha_nacimiento).getFullYear()} años
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-gray-700 dark:text-slate-300">{c.telefono || c.whatsapp || '—'}</p>
                    {c.email && <p className="text-xs text-gray-400 dark:text-slate-500">{c.email}</p>}
                  </td>
                  <td className="px-5 py-4 text-gray-400 dark:text-slate-500 text-xs">
                    {fmt(c.created_at)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => abrirDetalle(c)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700
                                   text-gray-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600
                                   dark:hover:text-blue-400 transition-colors"
                      >
                        Ver historial
                      </button>
                      <button
                        onClick={() => { setEditando({ ...c }); setError('') }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700
                                   text-gray-600 dark:text-slate-300 hover:border-gray-400 dark:hover:border-slate-500
                                   transition-colors"
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal editar / crear cliente ──────────────────────────────── */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 w-full max-w-md my-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-5">
              {editando.id ? 'Editar cliente' : 'Nuevo cliente'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Nombre completo *</label>
                <input
                  value={editando.nombre}
                  onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Nombre completo"
                  autoFocus
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Teléfono</label>
                  <input
                    value={editando.telefono || ''}
                    onChange={e => setEditando(p => ({ ...p, telefono: e.target.value }))}
                    placeholder="3001234567"
                    className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                               rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">WhatsApp</label>
                  <input
                    value={editando.whatsapp || ''}
                    onChange={e => setEditando(p => ({ ...p, whatsapp: e.target.value }))}
                    placeholder="3001234567"
                    className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                               rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Email</label>
                <input
                  type="email"
                  value={editando.email || ''}
                  onChange={e => setEditando(p => ({ ...p, email: e.target.value }))}
                  placeholder="cliente@email.com"
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Fecha de nacimiento</label>
                <input
                  type="date"
                  value={editando.fecha_nacimiento || ''}
                  onChange={e => setEditando(p => ({ ...p, fecha_nacimiento: e.target.value }))}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Notas internas</label>
                <textarea
                  value={editando.notas || ''}
                  onChange={e => setEditando(p => ({ ...p, notas: e.target.value }))}
                  placeholder="Observaciones, alergias, preferencias..."
                  rows={3}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-xl">{error}</p>}
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

      {/* ── Panel lateral: historial ──────────────────────────────────── */}
      {detalle && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex justify-end z-50">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md h-full flex flex-col shadow-xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-800 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">
                {detalle.nombre[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-white">{detalle.nombre}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {detalle.telefono || detalle.email || 'Sin contacto'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditando({ ...detalle }); setDetalle(null); setError('') }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700
                             text-gray-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600
                             dark:hover:text-blue-400 transition-colors"
                >
                  Editar
                </button>
                <button onClick={() => setDetalle(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Stats rápidas */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-slate-800 border-b border-gray-200 dark:border-slate-800">
              {[
                { label: 'Total citas', value: totalCitas },
                { label: 'Completadas', value: completadas },
                { label: 'Ingresos',    value: ingresos > 0 ? `$${ingresos.toLocaleString('es-CO')}` : '$0' },
              ].map(s => (
                <div key={s.label} className="p-4 text-center">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Notas */}
            {detalle.notas && (
              <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-1 uppercase tracking-wider">Notas</p>
                <p className="text-sm text-gray-700 dark:text-slate-300">{detalle.notas}</p>
              </div>
            )}

            {/* Historial de citas */}
            <div className="flex-1 overflow-y-auto">
              <p className="px-6 py-3 text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider border-b border-gray-100 dark:border-slate-800">
                Historial de citas
              </p>
              {loadHist ? (
                <div className="flex justify-center py-10">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                </div>
              ) : historial.length === 0 ? (
                <p className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">Sin citas registradas</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {historial.map(c => (
                    <div key={c.id} className="px-6 py-4 flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: c.profesional?.color || '#3b82f6' }}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{c.servicio?.nombre}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {fmt(c.fecha_inicio)} · {hhmm(c.fecha_inicio)} · {c.profesional?.nombre}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ESTADO_COLOR[c.estado] || ''}`}>
                          {c.estado?.replace('_', ' ')}
                        </span>
                        {c.precio_cobrado > 0 && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                            ${Number(c.precio_cobrado).toLocaleString('es-CO')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
