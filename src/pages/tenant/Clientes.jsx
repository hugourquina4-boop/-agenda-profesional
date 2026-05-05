import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

const ESTADO_STYLE = {
  pendiente:  'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  confirmada: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  completada: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  cancelada:  'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  no_asistio: 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400',
}

const inp = 'w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-400 dark:placeholder-slate-500'

function fmt(d) {
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}
function hhmm(d) {
  return new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}
function initials(nombre) {
  return nombre.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
}

const VACIO = { nombre: '', email: '', telefono: '', whatsapp: '', fecha_nacimiento: '', notas: '' }

export default function Clientes() {
  const { tenant } = useTenant()
  const [lista,    setLista]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [detalle,  setDetalle]  = useState(null)
  const [historial,setHistorial]= useState([])
  const [puntos,   setPuntos]   = useState(null)    // { saldo, valor_cop, minimo_canje, puede_canjear }
  const [configP,  setConfigP]  = useState(null)    // config_puntos del tenant
  const [canje,    setCanje]    = useState('')
  const [canjeando,setCanjeando]= useState(false)
  const [canjeMsg, setCanjeMsg] = useState(null)
  const [loadHist, setLoadHist] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const col = tenant?.color_primario || '#3b82f6'

  useEffect(() => { if (tenant?.id) { cargar(); cargarConfigPuntos() } }, [tenant])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('clientes_agenda')
      .select('id, nombre, email, telefono, whatsapp, fecha_nacimiento, notas, created_at, saldo_puntos(saldo)')
      .eq('tenant_id', tenant.id).eq('activo', true).order('nombre')
    setLista(data || [])
    setLoading(false)
  }

  async function cargarConfigPuntos() {
    const { data } = await supabase
      .from('config_puntos').select('*').eq('tenant_id', tenant.id).eq('activo', true).single()
    setConfigP(data || null)
  }

  async function abrirDetalle(c) {
    setDetalle(c); setLoadHist(true); setCanjeMsg(null); setCanje('')
    const [{ data: citas }, puntosRes] = await Promise.all([
      supabase.from('citas')
        .select('id, fecha_inicio, estado, precio_cobrado, profesional:profesionales(nombre, color), servicio:servicios(nombre)')
        .eq('cliente_id', c.id).order('fecha_inicio', { ascending: false }).limit(20),
      supabase.rpc('get_puntos_cliente', { p_tenant_id: tenant.id, p_telefono: c.telefono || c.whatsapp || '' }),
    ])
    setHistorial(citas || [])
    setPuntos(puntosRes.data?.ok ? puntosRes.data : null)
    setLoadHist(false)
  }

  async function guardar() {
    if (!editando?.nombre?.trim()) return
    setSaving(true); setError('')
    const { id, created_at, saldo_puntos: _sp, ...payload } = editando
    const base = { ...payload, tenant_id: tenant.id, activo: true }
    const { error: e } = id
      ? await supabase.from('clientes_agenda').update(base).eq('id', id)
      : await supabase.from('clientes_agenda').insert(base)
    setSaving(false)
    if (e) { setError(e.message); return }
    setEditando(null); cargar()
  }

  async function ejecutarCanje() {
    const n = parseInt(canje, 10)
    if (!n || n <= 0 || !detalle) return
    setCanjeando(true); setCanjeMsg(null)
    const { data, error: e } = await supabase.rpc('canjear_puntos', {
      p_cliente_id: detalle.id, p_puntos_canje: n
    })
    setCanjeando(false)
    if (e || !data?.ok) {
      setCanjeMsg({ ok: false, msg: data?.error || e?.message })
    } else {
      setCanjeMsg({ ok: true, msg: `✅ ${n} pts canjeados = $${Number(data.descuento_cop).toLocaleString('es-CO')} de descuento` })
      setCanje('')
      // Refrescar puntos
      const pr = await supabase.rpc('get_puntos_cliente', { p_tenant_id: tenant.id, p_telefono: detalle.telefono || detalle.whatsapp || '' })
      if (pr.data?.ok) setPuntos(pr.data)
      cargar()
    }
  }

  const filtrados = lista.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.telefono?.includes(busqueda) ||
    c.email?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const totalCitas   = historial.length
  const completadas  = historial.filter(c => c.estado === 'completada').length
  const ingresos     = historial.filter(c => c.estado === 'completada').reduce((s, c) => s + (Number(c.precio_cobrado) || 0), 0)
  const pct          = puntos && configP ? Math.min(100, Math.round((puntos.saldo / configP.minimo_canje) * 100)) : 0

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clientes</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{lista.length} registrados</p>
        </div>
        <div className="flex gap-2">
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Nombre, teléfono, email..."
            className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors flex-1 sm:w-52 sm:flex-none" />
          <button onClick={() => { setEditando({ ...VACIO }); setError('') }}
            className="text-sm px-4 py-2 rounded-xl font-medium text-white shadow-md transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
            style={{ background: `linear-gradient(135deg, ${col}, ${col}bb)` }}>
            + Nuevo
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: col, borderTopColor: 'transparent' }} />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-3">👥</div>
          <p className="text-gray-400 dark:text-slate-500 text-sm">
            {busqueda ? `Sin resultados para "${busqueda}"` : 'Aún no hay clientes registrados'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800">
                {['Cliente', 'Contacto', configP ? 'Puntos' : '', 'Desde', ''].map((h, i) => (
                  <th key={i} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider first:rounded-tl-2xl">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800/80">
              {filtrados.map(c => {
                const saldo = c.saldo_puntos?.[0]?.saldo ?? 0
                return (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${col}, ${col}99)` }}>
                          {initials(c.nombre)}
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
                    <td className="px-5 py-3.5">
                      <p className="text-gray-700 dark:text-slate-300">{c.telefono || c.whatsapp || '—'}</p>
                      {c.email && <p className="text-xs text-gray-400 dark:text-slate-500 truncate max-w-[140px]">{c.email}</p>}
                    </td>
                    {configP && (
                      <td className="px-5 py-3.5">
                        {saldo > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: `${col}15`, color: col }}>
                            ⭐ {saldo} pts
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-slate-700">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-3.5 text-xs text-gray-400 dark:text-slate-500">{fmt(c.created_at)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => abrirDetalle(c)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap">
                          Ver
                        </button>
                        <button onClick={() => { setEditando({ ...c }); setError('') }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-500 transition-colors">
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal crear / editar ─────────────────────────────────────── */}
      {editando && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={e => e.target === e.currentTarget && setEditando(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border-0 sm:border border-gray-200 dark:border-slate-800 w-full max-w-md max-h-[92vh] overflow-y-auto px-5 pt-4 pb-6 sm:px-6">
            <div className="w-10 h-1 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-5">
              {editando.id ? 'Editar cliente' : 'Nuevo cliente'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Nombre completo *</label>
                <input autoFocus value={editando.nombre}
                  onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Nombre completo" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Teléfono</label>
                  <input value={editando.telefono || ''}
                    onChange={e => setEditando(p => ({ ...p, telefono: e.target.value }))}
                    placeholder="3001234567" className={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">WhatsApp</label>
                  <input value={editando.whatsapp || ''}
                    onChange={e => setEditando(p => ({ ...p, whatsapp: e.target.value }))}
                    placeholder="3001234567" className={inp} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Email</label>
                <input type="email" value={editando.email || ''}
                  onChange={e => setEditando(p => ({ ...p, email: e.target.value }))}
                  placeholder="cliente@email.com" className={inp} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Fecha de nacimiento</label>
                <input type="date" value={editando.fecha_nacimiento || ''}
                  onChange={e => setEditando(p => ({ ...p, fecha_nacimiento: e.target.value }))}
                  className={inp} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Notas internas</label>
                <textarea value={editando.notas || ''}
                  onChange={e => setEditando(p => ({ ...p, notas: e.target.value }))}
                  placeholder="Alergias, preferencias, observaciones..."
                  rows={3} className={`${inp} resize-none`} />
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-xl">{error}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditando(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm">
                Cancelar
              </button>
              <button onClick={guardar} disabled={saving || !editando.nombre?.trim()}
                className="flex-1 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 disabled:opacity-50 text-sm shadow-md"
                style={{ background: `linear-gradient(135deg, ${col}, ${col}bb)` }}>
                {saving ? 'Guardando...' : editando.id ? 'Guardar' : 'Crear cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Panel lateral: detalle + puntos ──────────────────────────── */}
      {detalle && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex justify-end z-50"
          onClick={e => e.target === e.currentTarget && setDetalle(null)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-md h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-3 flex-shrink-0">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${col}, ${col}99)` }}>
                {initials(detalle.nombre)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-white truncate">{detalle.nombre}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                  {detalle.telefono || detalle.email || 'Sin contacto'}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => { setEditando({ ...detalle }); setDetalle(null); setError('') }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Editar
                </button>
                <button onClick={() => setDetalle(null)}
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 p-1 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-slate-800 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
              {[
                { label: 'Citas', value: totalCitas },
                { label: 'Completadas', value: completadas },
                { label: 'Ingresos', value: ingresos > 0 ? `$${(ingresos/1000).toFixed(0)}k` : '$0' },
              ].map(s => (
                <div key={s.label} className="p-3.5 text-center">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Puntos de fidelidad */}
              {configP && (
                <div className="mx-4 mt-4 mb-2 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800"
                  style={{ background: `linear-gradient(135deg, ${col}10, ${col}06)` }}>
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Puntos de fidelidad</p>
                        {puntos ? (
                          <p className="text-2xl font-bold" style={{ color: col }}>
                            ⭐ {puntos.saldo} <span className="text-sm font-normal text-gray-500 dark:text-slate-400">pts</span>
                          </p>
                        ) : (
                          <p className="text-2xl font-bold text-gray-300 dark:text-slate-700">⭐ 0 pts</p>
                        )}
                      </div>
                      {puntos && puntos.saldo > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400 dark:text-slate-500">Valor</p>
                          <p className="text-sm font-bold text-gray-700 dark:text-slate-300">
                            ${Number(puntos.valor_cop).toLocaleString('es-CO')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    {configP && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mb-1">
                          <span>{puntos?.saldo || 0} pts</span>
                          <span>mínimo {configP.minimo_canje} pts</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: col }} />
                        </div>
                      </div>
                    )}

                    {/* Canje */}
                    {puntos?.puede_canjear ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input type="number" min="1" max={puntos.saldo}
                            value={canje} onChange={e => setCanje(e.target.value)}
                            placeholder={`1–${puntos.saldo} puntos`}
                            className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-400" />
                          <button onClick={ejecutarCanje} disabled={canjeando || !canje}
                            className="text-sm px-4 py-2 rounded-xl font-medium text-white shadow transition-all hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                            style={{ background: `linear-gradient(135deg, ${col}, ${col}bb)` }}>
                            {canjeando ? '...' : 'Canjear'}
                          </button>
                        </div>
                        {canje && Number(canje) > 0 && configP && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 text-center">
                            {canje} pts = ${(Number(canje) * configP.valor_punto_cop).toLocaleString('es-CO')} de descuento
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
                        Necesita {configP.minimo_canje - (puntos?.saldo || 0)} pts más para canjear
                      </p>
                    )}

                    {canjeMsg && (
                      <p className={`text-xs mt-2 px-3 py-2 rounded-xl ${canjeMsg.ok ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                        {canjeMsg.msg}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Notas */}
              {detalle.notas && (
                <div className="px-4 py-3 mx-4 mt-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 uppercase tracking-wider">📋 Notas</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">{detalle.notas}</p>
                </div>
              )}

              {/* Historial */}
              <p className="px-5 py-3 mt-2 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider border-b border-gray-100 dark:border-slate-800">
                Historial · {totalCitas} cita{totalCitas !== 1 ? 's' : ''}
              </p>
              {loadHist ? (
                <div className="flex justify-center py-10">
                  <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: col, borderTopColor: 'transparent' }} />
                </div>
              ) : historial.length === 0 ? (
                <p className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">Sin citas registradas</p>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-slate-800/60">
                  {historial.map(c => (
                    <div key={c.id} className="px-5 py-3.5 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: c.profesional?.color || col }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.servicio?.nombre}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {fmt(c.fecha_inicio)} · {hhmm(c.fecha_inicio)} · {c.profesional?.nombre}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ESTADO_STYLE[c.estado] || ''}`}>
                          {c.estado?.replace('_', ' ')}
                        </span>
                        {c.precio_cobrado > 0 && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
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
