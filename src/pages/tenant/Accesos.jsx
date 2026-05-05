import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

const ROL_CONFIG = {
  admin:       { label: 'Admin',      color: '#8b5cf6', desc: 'Acceso total' },
  profesional: { label: 'Profesional',color: '#3b82f6', desc: 'Solo su agenda' },
  recepcion:   { label: 'Recepción',  color: '#10b981', desc: 'Agenda y clientes' },
}

const ROLES = Object.entries(ROL_CONFIG).map(([k, v]) => ({ key: k, ...v }))

export default function Accesos() {
  const { tenant }             = useTenant()
  const [usuarios, setUsuarios]= useState([])
  const [profs,    setProfs]   = useState([])
  const [loading,  setLoading] = useState(true)
  const [copiado,  setCopiado] = useState(false)
  const [modal,    setModal]   = useState(null) // { user_id, rol } para editar

  const col     = tenant?.color_primario || '#3b82f6'
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const linkRegistro = tenant?.slug ? `${baseUrl}/registro?tenant=${tenant.slug}` : null

  useEffect(() => { if (tenant?.id) cargar() }, [tenant])

  async function cargar() {
    setLoading(true)
    const [{ data: uts }, { data: ps }] = await Promise.all([
      supabase.from('usuarios_tenant')
        .select('user_id, rol, activo, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at'),
      supabase.from('profesionales')
        .select('id, nombre, tipo_profesional, color, foto_url, user_id, activo')
        .eq('tenant_id', tenant.id)
        .order('nombre'),
    ])
    setUsuarios(uts || [])
    setProfs(ps   || [])
    setLoading(false)
  }

  async function cambiarRol(userId, nuevoRol) {
    await supabase.from('usuarios_tenant')
      .update({ rol: nuevoRol })
      .eq('user_id', userId).eq('tenant_id', tenant.id)
    cargar()
    setModal(null)
  }

  async function desactivar(userId) {
    await supabase.from('usuarios_tenant')
      .update({ activo: false })
      .eq('user_id', userId).eq('tenant_id', tenant.id)
    cargar()
  }

  async function reactivar(userId) {
    await supabase.from('usuarios_tenant')
      .update({ activo: true })
      .eq('user_id', userId).eq('tenant_id', tenant.id)
    cargar()
  }

  function copiarLink() {
    if (!linkRegistro) return
    navigator.clipboard.writeText(linkRegistro).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // Enriquecer: para cada usuario_tenant, buscar el profesional vinculado
  const usuariosRich = usuarios.map(u => ({
    ...u,
    profesional: profs.find(p => p.user_id === u.user_id) || null,
  }))

  // Profesionales sin acceso
  const sinAcceso = profs.filter(p => !p.user_id && p.activo)

  const activos   = usuarios.filter(u => u.activo).length
  const totalProfs= profs.filter(p => p.activo).length

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Accesos</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {activos} usuarios activos · {totalProfs} profesionales
          </p>
        </div>
      </div>

      {/* Enlace de registro */}
      {linkRegistro && (
        <div className="mb-6 rounded-2xl border p-4"
          style={{ background: `${col}0c`, borderColor: `${col}30` }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: col }}>
                Enlace de registro para el equipo
              </p>
              <p className="text-sm text-gray-700 dark:text-slate-300 font-mono truncate">{linkRegistro}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Comparte este enlace con cada profesional para que creen su cuenta
              </p>
            </div>
            <button onClick={copiarLink}
              className="flex-shrink-0 text-sm px-4 py-2 rounded-xl font-medium text-white shadow transition-all hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${col}, ${col}bb)` }}>
              {copiado ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: col, borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="space-y-4">

          {/* Usuarios con acceso */}
          {usuariosRich.length > 0 && (
            <Section title={`Con acceso — ${usuarios.length}`}>
              <div className="divide-y divide-gray-50 dark:divide-slate-800/60">
                {usuariosRich.map(u => {
                  const r   = ROL_CONFIG[u.rol] || ROL_CONFIG.profesional
                  const p   = u.profesional
                  const nom = p?.nombre || `Usuario ${u.user_id.slice(0, 8)}`
                  const ini = nom[0]?.toUpperCase() || '?'
                  return (
                    <div key={u.user_id} className={`flex items-center gap-3 py-3.5 ${!u.activo ? 'opacity-50' : ''}`}>
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0"
                        style={{ background: p?.foto_url ? undefined : `linear-gradient(135deg, ${p?.color || col}, ${p?.color || col}99)` }}>
                        {p?.foto_url
                          ? <img src={p.foto_url} className="w-full h-full object-cover" alt="" />
                          : ini
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{nom}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: `${r.color}18`, color: r.color }}>
                            {r.label}
                          </span>
                          {!u.activo && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500">
                              Inactivo
                            </span>
                          )}
                          <span className="text-xs text-gray-400 dark:text-slate-500">{r.desc}</span>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => setModal({ user_id: u.user_id, rol: u.rol })}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          Rol
                        </button>
                        {u.activo
                          ? <button onClick={() => desactivar(u.user_id)}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:border-red-400 hover:text-red-500 transition-colors">
                              Suspender
                            </button>
                          : <button onClick={() => reactivar(u.user_id)}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                              Reactivar
                            </button>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Profesionales sin acceso */}
          {sinAcceso.length > 0 && (
            <Section title={`Sin acceso aún — ${sinAcceso.length}`}>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
                Estos profesionales no tienen cuenta en el sistema. Comparte el enlace de registro para que se registren.
              </p>
              <div className="divide-y divide-gray-50 dark:divide-slate-800/60">
                {sinAcceso.map(p => (
                  <div key={p.id} className="flex items-center gap-3 py-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}99)` }}>
                      {p.nombre[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{p.nombre}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 capitalize">{p.tipo_profesional}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500">
                      Sin cuenta
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {usuariosRich.length === 0 && sinAcceso.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🔑</div>
              <p className="text-gray-400 dark:text-slate-500 text-sm">
                Agrega profesionales en el panel de Equipo y luego comparte el enlace de registro
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal cambio de rol */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border-0 sm:border border-gray-200 dark:border-slate-800 w-full max-w-sm px-5 pt-5 pb-6 sm:px-6">
            <div className="w-10 h-1 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-4">Cambiar rol</h3>
            <div className="space-y-2">
              {ROLES.map(r => (
                <button key={r.key} onClick={() => cambiarRol(modal.user_id, r.key)}
                  className={`w-full flex items-start gap-3 p-3.5 rounded-xl border transition-all text-left ${
                    modal.rol === r.key
                      ? 'border-transparent'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                  }`}
                  style={modal.rol === r.key ? { background: `${r.color}12`, borderColor: `${r.color}44` } : undefined}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: r.color }}>
                    {r.label[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{r.label}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{r.desc}</p>
                  </div>
                  {modal.rol === r.key && (
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{ background: `${r.color}18`, color: r.color }}>
                      Actual
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button onClick={() => setModal(null)}
              className="w-full mt-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5">
      <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  )
}
