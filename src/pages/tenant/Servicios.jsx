import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

const CATEGORIAS = ['Corte','Color','Tratamiento','Uñas','Cejas','Maquillaje','Barbería','Keratina','Facial','Otro']
const CAT_COLOR  = {
  Corte:'#3b82f6', Color:'#a855f7', Tratamiento:'#10b981', Uñas:'#ec4899',
  Cejas:'#f59e0b', Maquillaje:'#ef4444', Barbería:'#6b7280',
  Keratina:'#8b5cf6', Facial:'#06b6d4', Otro:'#94a3b8'
}
const DURACIONES = [10,15,20,30,45,60,75,90,120,150,180]
const COLORES    = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444','#06b6d4','#f97316','#84cc16']

const VACIO_SVC = { nombre:'', descripcion:'', duracion_min:30, precio:0, color:'#3b82f6', categoria:'Corte', imagen_url:'', activo:true }
const VACIO_VAR = { nombre:'', duracion_modificador:0, precio_modificador:0 }

const inp = 'w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-400 dark:placeholder-slate-500'

export default function Servicios() {
  const { tenant } = useTenant()
  const [lista,    setLista]    = useState([])
  const [profs,    setProfs]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [catFiltro,setCatFiltro]= useState('Todas')
  const [editando, setEditando] = useState(null)
  const [profsEdit,setProfsEdit]= useState([])
  const [variantes,setVariantes]= useState([])
  const [varForm,  setVarForm]  = useState(null) // null = cerrado
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const catBar = useRef(null)

  useEffect(() => { if (tenant?.id) cargar() }, [tenant])

  async function cargar() {
    setLoading(true)
    const [{ data: svcs }, { data: ps }] = await Promise.all([
      supabase.from('servicios')
        .select('*, profesional_servicios(profesional_id), variantes_servicio(id)')
        .eq('tenant_id', tenant.id).order('orden').order('nombre'),
      supabase.from('profesionales')
        .select('id, nombre, color').eq('tenant_id', tenant.id)
        .eq('activo', true).order('nombre'),
    ])
    setLista(svcs || [])
    setProfs(ps  || [])
    setLoading(false)
  }

  async function abrir(s = null) {
    setError('')
    if (s) {
      setEditando({ ...s })
      setProfsEdit(s.profesional_servicios?.map(x => x.profesional_id) || [])
      const { data: vars } = await supabase
        .from('variantes_servicio').select('*')
        .eq('servicio_id', s.id).order('orden')
      setVariantes(vars || [])
    } else {
      setEditando({ ...VACIO_SVC })
      setProfsEdit(profs.map(p => p.id))
      setVariantes([])
    }
    setVarForm(null)
  }

  async function guardar() {
    if (!editando?.nombre?.trim()) return
    setSaving(true); setError('')
    const { id, created_at, updated_at, profesional_servicios: _ps, variantes_servicio: _vs, ...payload } = editando
    const base = { ...payload, tenant_id: tenant.id }

    let svcId = id
    if (id) {
      const { error: e } = await supabase.from('servicios').update(base).eq('id', id)
      if (e) { setSaving(false); setError(e.message); return }
    } else {
      const { data, error: e } = await supabase.from('servicios').insert(base).select('id').single()
      if (e) { setSaving(false); setError(e.message); return }
      svcId = data.id
    }

    // Sincronizar profesional_servicios
    await supabase.from('profesional_servicios').delete().eq('servicio_id', svcId)
    if (profsEdit.length > 0)
      await supabase.from('profesional_servicios').insert(profsEdit.map(pid => ({ profesional_id: pid, servicio_id: svcId })))

    // Sincronizar variantes
    const toDelete = variantes.filter(v => v._deleted && v.id)
    for (const v of toDelete) await supabase.from('variantes_servicio').delete().eq('id', v.id)
    const toSave = variantes.filter(v => !v._deleted)
    for (let i = 0; i < toSave.length; i++) {
      const { id: vid, _new, _deleted, ...vp } = toSave[i]
      const vBase = { ...vp, servicio_id: svcId, tenant_id: tenant.id, orden: i }
      if (_new) await supabase.from('variantes_servicio').insert(vBase)
      else      await supabase.from('variantes_servicio').update(vp).eq('id', vid)
    }

    setSaving(false); setEditando(null); cargar()
  }

  const cats    = ['Todas', ...new Set(lista.map(s => s.categoria || 'Otro').filter(Boolean))]
  const filtrada = catFiltro === 'Todas' ? lista : lista.filter(s => (s.categoria || 'Otro') === catFiltro)
  const grupos   = CATEGORIAS.reduce((acc, cat) => {
    const items = filtrada.filter(s => (s.categoria || 'Otro') === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})
  const sinCat = filtrada.filter(s => !s.categoria)
  if (sinCat.length) grupos['Sin categoría'] = sinCat

  const col = tenant?.color_primario || '#3b82f6'

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Servicios</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {lista.filter(s => s.activo).length} activos · {lista.length} total
          </p>
        </div>
        <button onClick={() => abrir()}
          className="text-sm px-4 py-2 rounded-xl font-medium text-white shadow-md transition-all hover:opacity-90 active:scale-95"
          style={{ background: `linear-gradient(135deg, ${col}, ${col}bb)` }}>
          + Agregar
        </button>
      </div>

      {/* Category filter tabs */}
      {cats.length > 2 && (
        <div ref={catBar} className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
          {cats.map(cat => {
            const c = CAT_COLOR[cat] || col
            const active = catFiltro === cat
            return (
              <button key={cat} onClick={() => setCatFiltro(cat)}
                className="flex-shrink-0 text-xs px-3.5 py-1.5 rounded-xl font-medium border transition-all"
                style={active
                  ? { background: `${c}22`, color: c, borderColor: `${c}55` }
                  : { borderColor: 'transparent', color: undefined }
                }
                data-class={active ? '' : 'text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-800 hover:border-gray-300'}>
                {cat}
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: col, borderTopColor: 'transparent' }} />
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-3">💆</div>
          <p className="text-gray-400 dark:text-slate-500 text-sm">Agrega servicios para que los clientes puedan reservar</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grupos).map(([cat, items]) => {
            const c = CAT_COLOR[cat] || '#94a3b8'
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                  <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{cat}</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-slate-800" />
                  <span className="text-xs text-gray-400 dark:text-slate-600">{items.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map(s => (
                    <SvcCard key={s.id} svc={s}
                      profs={profs.filter(p => s.profesional_servicios?.some(x => x.profesional_id === p.id))}
                      numVariantes={(s.variantes_servicio || []).length}
                      onEdit={() => abrir(s)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {editando && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={e => e.target === e.currentTarget && setEditando(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border-0 sm:border border-gray-200 dark:border-slate-800 w-full max-w-lg max-h-[92vh] overflow-y-auto px-5 pt-4 pb-6 sm:px-6">
            <div className="w-10 h-1 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-5">
              {editando.id ? 'Editar servicio' : 'Nuevo servicio'}
            </h3>

            <div className="space-y-4">
              <Field label="Nombre *">
                <input autoFocus value={editando.nombre}
                  onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Tinte completo, Corte degradado..." className={inp} />
              </Field>

              <Field label="Categoría">
                <div className="flex flex-wrap gap-2">
                  {CATEGORIAS.map(cat => {
                    const c = CAT_COLOR[cat]
                    const active = editando.categoria === cat
                    return (
                      <button key={cat} type="button"
                        onClick={() => setEditando(p => ({ ...p, categoria: cat }))}
                        className="text-xs px-3 py-1.5 rounded-xl border transition-all font-medium"
                        style={active
                          ? { background: `${c}22`, color: c, borderColor: `${c}55` }
                          : { borderColor: '#e2e8f0', color: '#6b7280' }}>
                        {cat}
                      </button>
                    )
                  })}
                </div>
              </Field>

              <Field label="Descripción">
                <input value={editando.descripcion || ''}
                  onChange={e => setEditando(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Descripción breve del servicio" className={inp} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Duración base">
                  <select value={editando.duracion_min}
                    onChange={e => setEditando(p => ({ ...p, duracion_min: Number(e.target.value) }))}
                    className={inp}>
                    {DURACIONES.map(d => (
                      <option key={d} value={d}>{d >= 60 ? `${d/60}h${d%60?` ${d%60}min`:''}` : `${d} min`}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Precio base (COP)">
                  <input type="number" min="0" value={editando.precio}
                    onChange={e => setEditando(p => ({ ...p, precio: Number(e.target.value) }))}
                    className={inp} />
                </Field>
              </div>

              <Field label="Color en la agenda">
                <div className="flex gap-2 flex-wrap">
                  {COLORES.map(c => (
                    <button key={c} type="button"
                      onClick={() => setEditando(p => ({ ...p, color: c }))}
                      className="w-7 h-7 rounded-lg transition-transform hover:scale-110 flex items-center justify-center"
                      style={{ backgroundColor: c }}>
                      {editando.color === c && <span className="text-white text-xs font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Imagen URL (opcional)">
                <input value={editando.imagen_url || ''}
                  onChange={e => setEditando(p => ({ ...p, imagen_url: e.target.value }))}
                  placeholder="https://..." className={inp} />
              </Field>

              {/* Profesionales */}
              {profs.length > 0 && (
                <Field label="Profesionales que lo realizan">
                  <div className="flex flex-wrap gap-2">
                    {profs.map(p => {
                      const sel = profsEdit.includes(p.id)
                      return (
                        <button key={p.id} type="button"
                          onClick={() => setProfsEdit(pp => pp.includes(p.id) ? pp.filter(x => x !== p.id) : [...pp, p.id])}
                          className="text-xs px-3 py-1.5 rounded-xl border transition-all font-medium"
                          style={sel
                            ? { background: `${p.color}22`, color: p.color, borderColor: `${p.color}55` }
                            : { borderColor: '#e2e8f0', color: '#6b7280' }}>
                          {p.nombre.split(' ')[0]}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              )}

              {/* Variantes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Variantes / Opciones de precio</label>
                  <button type="button" onClick={() => setVarForm({ ...VACIO_VAR })}
                    className="text-xs px-2.5 py-1 rounded-lg border border-dashed border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                    + Agregar
                  </button>
                </div>

                {variantes.filter(v => !v._deleted).length > 0 && (
                  <div className="space-y-2 mb-2">
                    {variantes.filter(v => !v._deleted).map((v, i) => (
                      <div key={v.id || i} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{v.nombre}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">
                            {v.duracion_modificador !== 0 && `${v.duracion_modificador > 0 ? '+' : ''}${v.duracion_modificador} min`}
                            {v.duracion_modificador !== 0 && v.precio_modificador !== 0 && ' · '}
                            {v.precio_modificador !== 0 && `${v.precio_modificador > 0 ? '+' : ''}$${Number(v.precio_modificador).toLocaleString('es-CO')}`}
                          </p>
                        </div>
                        <button type="button"
                          onClick={() => setVariantes(vv => vv.map((x, j) => j === variantes.indexOf(v) ? { ...x, _deleted: true } : x))}
                          className="text-gray-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {varForm && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 space-y-2">
                    <input value={varForm.nombre}
                      onChange={e => setVarForm(v => ({ ...v, nombre: e.target.value }))}
                      placeholder="Nombre (ej: Raíz, Completo, Largo...)" className={inp} autoFocus />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">+/- minutos</label>
                        <input type="number" value={varForm.duracion_modificador}
                          onChange={e => setVarForm(v => ({ ...v, duracion_modificador: Number(e.target.value) }))}
                          className={inp} placeholder="0" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">+/- precio COP</label>
                        <input type="number" value={varForm.precio_modificador}
                          onChange={e => setVarForm(v => ({ ...v, precio_modificador: Number(e.target.value) }))}
                          className={inp} placeholder="0" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setVarForm(null)}
                        className="flex-1 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500">
                        Cancelar
                      </button>
                      <button type="button"
                        disabled={!varForm.nombre.trim()}
                        onClick={() => {
                          if (!varForm.nombre.trim()) return
                          setVariantes(vv => [...vv, { ...varForm, _new: true }])
                          setVarForm(null)
                        }}
                        className="flex-1 py-1.5 text-xs rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50">
                        Agregar variante
                      </button>
                    </div>
                  </div>
                )}

                {variantes.filter(v => !v._deleted).length === 0 && !varForm && (
                  <p className="text-xs text-gray-400 dark:text-slate-600 text-center py-2">
                    Sin variantes — el cliente verá el precio base
                  </p>
                )}
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                onClick={() => setEditando(p => ({ ...p, activo: !p.activo }))}>
                <Toggle on={editando.activo} />
                <span className="text-sm text-gray-700 dark:text-slate-300">Servicio activo</span>
              </label>

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
                {saving ? 'Guardando...' : editando.id ? 'Guardar cambios' : 'Crear servicio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SvcCard({ svc, profs, numVariantes, onEdit }) {
  const cat  = svc.categoria || 'Otro'
  const col  = svc.color || CAT_COLOR[cat] || '#94a3b8'
  const min  = svc.duracion_min
  const durStr = min >= 60 ? `${Math.floor(min/60)}h${min%60 ? ` ${min%60}min` : ''}` : `${min} min`
  const price  = svc.precio > 0 ? `$${Number(svc.precio).toLocaleString('es-CO')}` : 'Gratis'

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden transition-all hover:shadow-md dark:hover:shadow-black/20 group ${
      svc.activo ? 'border-gray-200 dark:border-slate-800' : 'opacity-60 border-dashed border-gray-200 dark:border-slate-800'
    }`}>
      <div className="flex">
        {/* Left color bar */}
        <div className="w-1 flex-shrink-0 rounded-l-2xl" style={{ backgroundColor: col }} />

        <div className="flex-1 p-4 min-w-0">
          {/* Image + name row */}
          <div className="flex items-start gap-3">
            {svc.imagen_url ? (
              <img src={svc.imagen_url} alt={svc.nombre}
                className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-gray-100 dark:border-slate-800"
                onError={e => e.target.style.display = 'none'} />
            ) : (
              <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-xl"
                style={{ background: `${col}18` }}>
                {cat === 'Corte' ? '✂️' : cat === 'Color' ? '🎨' : cat === 'Uñas' ? '💅'
                  : cat === 'Cejas' ? '⚡' : cat === 'Facial' ? '💆' : cat === 'Barbería' ? '🪒'
                  : cat === 'Keratina' ? '✨' : cat === 'Maquillaje' ? '💄' : cat === 'Tratamiento' ? '🌿' : '💫'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">{svc.nombre}</p>
                {!svc.activo && (
                  <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-400 flex-shrink-0">off</span>
                )}
              </div>
              {svc.descripcion && (
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 line-clamp-1">{svc.descripcion}</p>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
              <span className="font-medium text-gray-700 dark:text-slate-300">{price}</span>
              <span>·</span>
              <span>{durStr}</span>
              {numVariantes > 0 && (
                <>
                  <span>·</span>
                  <span className="px-1.5 py-0.5 rounded-md text-xs font-medium"
                    style={{ background: `${col}18`, color: col }}>
                    {numVariantes} {numVariantes === 1 ? 'opción' : 'opciones'}
                  </span>
                </>
              )}
            </div>

            {/* Prof dots */}
            {profs.length > 0 && (
              <div className="flex -space-x-1">
                {profs.slice(0, 4).map(p => (
                  <div key={p.id} title={p.nombre}
                    className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: p.color }}>
                    {p.nombre[0]}
                  </div>
                ))}
                {profs.length > 4 && (
                  <div className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-slate-300 text-xs font-bold">
                    +{profs.length - 4}
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={onEdit}
            className="w-full mt-3 text-xs py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors opacity-0 group-hover:opacity-100">
            Editar
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ on }) {
  return (
    <div className={`w-10 h-6 rounded-full relative transition-colors ${on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}`}>
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-5' : 'left-1'}`} />
    </div>
  )
}
