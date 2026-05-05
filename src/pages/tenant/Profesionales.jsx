import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

const TIPO = {
  estilista:   { label: 'Estilista',   icon: '✂️' },
  colorista:   { label: 'Colorista',   icon: '🎨' },
  manicura:    { label: 'Manicura',    icon: '💅' },
  pedicura:    { label: 'Pedicura',    icon: '🦶' },
  barbero:     { label: 'Barbero',     icon: '🪒' },
  esteticista: { label: 'Esteticista', icon: '✨' },
  otro:        { label: 'Otro',        icon: '👤' },
}

const COLORES = [
  '#8b5cf6','#3b82f6','#ec4899','#f59e0b',
  '#10b981','#ef4444','#06b6d4','#f97316','#84cc16','#a855f7'
]

const VACIO = {
  nombre: '', especialidad: '', tipo_profesional: 'estilista',
  color: '#8b5cf6', bio: '', instagram: '', foto_url: '', activo: true
}

const inp = 'w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-400 dark:placeholder-slate-500'

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
      .from('profesionales').select('*')
      .eq('tenant_id', tenant.id).order('nombre')
    setLista(data || [])
    setLoading(false)
  }

  async function guardar() {
    if (!editando?.nombre?.trim()) return
    setSaving(true); setError('')
    const { id, created_at, updated_at, user_id, ...payload } = editando
    const base = { ...payload, tenant_id: tenant.id }
    const { error: e } = id
      ? await supabase.from('profesionales').update(base).eq('id', id)
      : await supabase.from('profesionales').insert(base)
    setSaving(false)
    if (e) { setError(e.message); return }
    setEditando(null); cargar()
  }

  const col = tenant?.color_primario || '#8b5cf6'
  const activos  = lista.filter(p => p.activo).length

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Equipo</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {activos} activo{activos !== 1 ? 's' : ''} · {lista.length} total
          </p>
        </div>
        <button
          onClick={() => { setEditando({ ...VACIO }); setError('') }}
          className="text-sm px-4 py-2 rounded-xl font-medium text-white transition-all hover:opacity-90 active:scale-95 shadow-md"
          style={{ background: `linear-gradient(135deg, ${col}, ${col}bb)` }}
        >
          + Agregar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: col, borderTopColor: 'transparent' }} />
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-3">✂️</div>
          <p className="text-gray-400 dark:text-slate-500 text-sm">Agrega el primer profesional para empezar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map(p => (
            <ProfCard key={p.id} prof={p}
              onEdit={() => { setEditando({ ...p }); setError('') }}
              onToggle={async () => {
                await supabase.from('profesionales').update({ activo: !p.activo }).eq('id', p.id)
                cargar()
              }}
            />
          ))}
        </div>
      )}

      {editando && (
        <Modal onClose={() => { setEditando(null); setError('') }}>
          <div className="w-10 h-1 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
          <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-5">
            {editando.id ? 'Editar profesional' : 'Nuevo profesional'}
          </h3>

          <div className="space-y-4">
            <Field label="Nombre completo *">
              <input autoFocus value={editando.nombre}
                onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Valentina Gómez" className={inp} />
            </Field>

            <Field label="Especialidad">
              <div className="flex flex-wrap gap-2">
                {Object.entries(TIPO).map(([key, { label, icon }]) => (
                  <button key={key} type="button"
                    onClick={() => setEditando(p => ({ ...p, tipo_profesional: key }))}
                    className={`text-xs px-3 py-1.5 rounded-xl border transition-all font-medium ${
                      editando.tipo_profesional === key
                        ? 'border-transparent text-white shadow-sm'
                        : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-gray-300'
                    }`}
                    style={editando.tipo_profesional === key ? { background: editando.color } : {}}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Color en la agenda">
              <div className="flex gap-2 flex-wrap">
                {COLORES.map(c => (
                  <button key={c} type="button"
                    onClick={() => setEditando(p => ({ ...p, color: c }))}
                    className="w-8 h-8 rounded-xl transition-transform hover:scale-110 relative flex items-center justify-center"
                    style={{ backgroundColor: c }}>
                    {editando.color === c && <span className="text-white text-xs font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Bio corta (visible en el portal)">
              <textarea value={editando.bio || ''} rows={2}
                onChange={e => setEditando(p => ({ ...p, bio: e.target.value }))}
                placeholder="Especialista en colorimetría con 8 años de experiencia..."
                className={`${inp} resize-none`} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Instagram">
                <input value={editando.instagram || ''}
                  onChange={e => setEditando(p => ({ ...p, instagram: e.target.value }))}
                  placeholder="@usuario" className={inp} />
              </Field>
              <Field label="Foto (URL)">
                <input value={editando.foto_url || ''}
                  onChange={e => setEditando(p => ({ ...p, foto_url: e.target.value }))}
                  placeholder="https://..." className={inp} />
              </Field>
            </div>

            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setEditando(p => ({ ...p, activo: !p.activo }))}>
              <Toggle on={editando.activo} />
              <span className="text-sm text-gray-700 dark:text-slate-300">Profesional activo</span>
            </label>

            {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-xl">{error}</p>}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => { setEditando(null); setError('') }}
              className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm">
              Cancelar
            </button>
            <button onClick={guardar} disabled={saving || !editando.nombre?.trim()}
              className="flex-1 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 disabled:opacity-50 text-sm shadow-md"
              style={{ background: `linear-gradient(135deg, ${col}, ${col}bb)` }}>
              {saving ? 'Guardando...' : editando.id ? 'Guardar cambios' : 'Crear profesional'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function ProfCard({ prof, onEdit, onToggle }) {
  const tipo = TIPO[prof.tipo_profesional] || TIPO.otro
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden group transition-all hover:shadow-lg dark:hover:shadow-black/30 ${
      prof.activo ? 'border-gray-200 dark:border-slate-800' : 'border-dashed border-gray-300 dark:border-slate-700 opacity-60'
    }`}>
      {/* Gradient top */}
      <div className="h-16 relative" style={{ background: `linear-gradient(135deg, ${prof.color}28, ${prof.color}55)` }}>
        {!prof.activo && (
          <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full bg-black/20 text-white/90 backdrop-blur-sm">
            Inactivo
          </span>
        )}
        {/* Avatar */}
        <div className="absolute -bottom-6 left-4 w-14 h-14 rounded-2xl border-2 border-white dark:border-slate-900 overflow-hidden flex items-center justify-center text-white font-bold text-xl shadow-md flex-shrink-0"
          style={{ background: !prof.foto_url ? `linear-gradient(135deg, ${prof.color}, ${prof.color}99)` : undefined }}>
          {prof.foto_url
            ? <img src={prof.foto_url} alt={prof.nombre} className="w-full h-full object-cover"
                onError={e => { e.target.style.display = 'none' }} />
            : prof.nombre[0]?.toUpperCase()
          }
        </div>
      </div>

      <div className="pt-8 px-4 pb-4">
        <div className="flex items-start justify-between gap-1 mb-1">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 dark:text-white leading-tight truncate">{prof.nombre}</p>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1 font-medium"
              style={{ backgroundColor: `${prof.color}1a`, color: prof.color }}>
              {tipo.icon} {tipo.label}
            </span>
          </div>
          {prof.instagram && (
            <a href={`https://instagram.com/${prof.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
              className="text-gray-300 hover:text-pink-500 dark:text-slate-600 dark:hover:text-pink-400 transition-colors mt-0.5 flex-shrink-0">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </a>
          )}
        </div>
        {prof.bio && <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 line-clamp-2">{prof.bio}</p>}

        <div className="flex gap-2 mt-3">
          <button onClick={onEdit}
            className="flex-1 text-xs py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            Editar
          </button>
          <button onClick={onToggle}
            className={`flex-1 text-xs py-2 rounded-xl border transition-colors ${
              prof.activo
                ? 'border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:border-red-300 hover:text-red-500'
                : 'border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
            }`}>
            {prof.activo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border-0 sm:border border-gray-200 dark:border-slate-800 w-full max-w-md max-h-[92vh] overflow-y-auto px-5 pt-4 pb-6 sm:px-6">
        {children}
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
