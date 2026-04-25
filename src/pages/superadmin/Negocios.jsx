import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const VERTICAL_LABEL = { psicologo: 'Psicólogo', peluqueria: 'Peluquería', sso: 'SSO', otro: 'Otro' }

const NUEVO_NEGOCIO = {
  nombre: '', slug: '', vertical: 'psicologo',
  email: '', whatsapp: '', telefono: '',
  ciudad: 'Cali', direccion: '', descripcion: '',
  color_primario: '#3b82f6',
}

function slugify(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function Negocios() {
  const [negocios, setNegocios]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(null)   // { tipo: 'plan' | 'nuevo', ...datos }
  const [saving, setSaving]       = useState(false)
  const [busqueda, setBusqueda]   = useState('')
  const [error, setError]         = useState('')
  const [nuevo, setNuevo]         = useState({ ...NUEVO_NEGOCIO })
  const [slugManual, setSlugManual] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('v_superadmin_negocios').select('*')
    setNegocios(data || [])
    setLoading(false)
  }

  function abrirNuevo() {
    setNuevo({ ...NUEVO_NEGOCIO })
    setSlugManual(false)
    setError('')
    setModal({ tipo: 'nuevo' })
  }

  function campoNuevo(key, value) {
    setNuevo(p => {
      const next = { ...p, [key]: value }
      // auto-slug desde nombre si el usuario no lo ha tocado manualmente
      if (key === 'nombre' && !slugManual) {
        next.slug = slugify(value)
      }
      return next
    })
  }

  async function crearNegocio() {
    if (!nuevo.nombre.trim() || !nuevo.slug.trim()) return
    setSaving(true)
    setError('')

    const { data: tenant, error: errTenant } = await supabase
      .from('tenants')
      .insert({
        nombre:          nuevo.nombre.trim(),
        slug:            nuevo.slug.trim(),
        vertical:        nuevo.vertical,
        email:           nuevo.email || null,
        whatsapp:        nuevo.whatsapp || null,
        telefono:        nuevo.telefono || null,
        ciudad:          nuevo.ciudad || 'Cali',
        direccion:       nuevo.direccion || null,
        descripcion:     nuevo.descripcion || null,
        color_primario:  nuevo.color_primario,
        activo:          true,
        verificado:      false,
      })
      .select('id')
      .single()

    if (errTenant) {
      setSaving(false)
      setError(errTenant.message.includes('slug') ? 'Ese slug ya está en uso, elige otro.' : errTenant.message)
      return
    }

    // Suscripción trial gratuita por defecto
    const { data: planFree } = await supabase
      .from('planes')
      .select('id')
      .eq('tipo', 'free')
      .single()

    if (planFree) {
      await supabase.from('suscripciones').insert({
        tenant_id:         tenant.id,
        plan_id:           planFree.id,
        estado:            'trial',
        fecha_inicio:      new Date().toISOString().split('T')[0],
        fecha_vencimiento: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      })
    }

    setSaving(false)
    setModal(null)
    cargar()
  }

  async function toggleActivo(id, activo) {
    await supabase.from('tenants').update({ activo: !activo }).eq('id', id)
    cargar()
  }

  async function toggleVerificado(id, verificado) {
    await supabase.from('tenants').update({ verificado: !verificado }).eq('id', id)
    cargar()
  }

  async function guardarPlan(tenantId, planTipo) {
    setSaving(true)
    const { data: plan } = await supabase.from('planes').select('id').eq('tipo', planTipo).single()
    if (!plan) { setSaving(false); return }

    const { data: suscExistente } = await supabase
      .from('suscripciones').select('id')
      .eq('tenant_id', tenantId).in('estado', ['activa', 'trial']).maybeSingle()

    const payload = {
      tenant_id: tenantId, plan_id: plan.id, estado: 'activa',
      fecha_inicio:      new Date().toISOString().split('T')[0],
      fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    }

    if (suscExistente) {
      await supabase.from('suscripciones').update(payload).eq('id', suscExistente.id)
    } else {
      await supabase.from('suscripciones').insert(payload)
    }
    setSaving(false)
    setModal(null)
    cargar()
  }

  const filtrados = negocios.filter(n =>
    n.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    n.slug?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Negocios</h1>
        <div className="flex gap-3">
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar..."
            className="bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                       rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white
                       placeholder-gray-400 dark:placeholder-slate-500
                       focus:outline-none focus:border-blue-500 w-48"
          />
          <button
            onClick={abrirNuevo}
            className="text-xs px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors whitespace-nowrap"
          >
            + Nuevo negocio
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(n => (
            <div key={n.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{n.nombre}</h3>
                    <span className="text-xs text-gray-400 dark:text-slate-500">/{n.slug}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      n.verificado
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                    }`}>
                      {n.verificado ? 'Verificado' : 'Sin verificar'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      n.activo
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                    }`}>
                      {n.activo ? 'Activo' : 'Suspendido'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-slate-400 flex-wrap">
                    <span>{VERTICAL_LABEL[n.vertical]}</span>
                    <span>Plan: <b className="text-gray-800 dark:text-white capitalize">{n.plan || 'Sin plan'}</b></span>
                    <span>Suscripción: <b className={`capitalize ${
                      n.suscripcion_estado === 'activa' ? 'text-emerald-600 dark:text-emerald-400' :
                      n.suscripcion_estado === 'trial'  ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'
                    }`}>{n.suscripcion_estado || '—'}</b></span>
                    <span>Citas 30d: <b className="text-gray-800 dark:text-white">{n.citas_30d || 0}</b></span>
                    {n.whatsapp && <span>{n.whatsapp}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleVerificado(n.id, n.verificado)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700
                               text-gray-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600
                               dark:hover:text-emerald-400 transition-colors"
                  >
                    {n.verificado ? 'Desverificar' : 'Verificar'}
                  </button>
                  <button
                    onClick={() => toggleActivo(n.id, n.activo)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700
                               text-gray-600 dark:text-slate-300 hover:border-red-500 hover:text-red-500
                               dark:hover:text-red-400 transition-colors"
                  >
                    {n.activo ? 'Suspender' : 'Activar'}
                  </button>
                  <button
                    onClick={() => setModal({ tipo: 'plan', ...n })}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                  >
                    Gestionar plan
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filtrados.length === 0 && !loading && (
            <div className="text-center py-20">
              <p className="text-gray-400 dark:text-slate-500 text-sm">
                {busqueda ? `Sin resultados para "${busqueda}"` : 'Aún no hay negocios — crea el primero'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Nuevo negocio ─────────────────────────────── */}
      {modal?.tipo === 'nuevo' && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 w-full max-w-lg my-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">Nuevo negocio</h3>
            <p className="text-gray-500 dark:text-slate-400 text-xs mb-5">
              Se crea con plan Gratuito en trial (14 días). Puedes cambiarlo después.
            </p>

            <div className="space-y-3">
              {/* Nombre */}
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Nombre del negocio *</label>
                <input
                  value={nuevo.nombre}
                  onChange={e => campoNuevo('nombre', e.target.value)}
                  placeholder="Consultorio Hugo Urquiña"
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white
                             focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">
                  Identificador único (URL pública del negocio)
                </label>
                <input
                  value={nuevo.slug}
                  onChange={e => { setSlugManual(true); campoNuevo('slug', slugify(e.target.value)) }}
                  placeholder="consultorio-hugo"
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white font-mono
                             focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  Se auto-genera del nombre. Es el "apellido" en la URL: <span className="font-mono">tuagenda.com/<b>{nuevo.slug || 'consultorio-hugo'}</b></span>
                </p>
              </div>

              {/* Vertical + Ciudad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Vertical</label>
                  <select
                    value={nuevo.vertical}
                    onChange={e => campoNuevo('vertical', e.target.value)}
                    className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                               rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white
                               focus:outline-none focus:border-blue-500"
                  >
                    <option value="psicologo">Psicólogo</option>
                    <option value="peluqueria">Peluquería</option>
                    <option value="sso">SSO</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Ciudad</label>
                  <input
                    value={nuevo.ciudad}
                    onChange={e => campoNuevo('ciudad', e.target.value)}
                    className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                               rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white
                               focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Email + WhatsApp */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Email</label>
                  <input
                    type="email"
                    value={nuevo.email}
                    onChange={e => campoNuevo('email', e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                               rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white
                               focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">WhatsApp</label>
                  <input
                    value={nuevo.whatsapp}
                    onChange={e => campoNuevo('whatsapp', e.target.value)}
                    placeholder="3001234567"
                    className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                               rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white
                               focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Descripción (opcional)</label>
                <input
                  value={nuevo.descripcion}
                  onChange={e => campoNuevo('descripcion', e.target.value)}
                  placeholder="Visible en el portal público del negocio"
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white
                             focus:outline-none focus:border-blue-500"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-xl">{error}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setModal(null); setError('') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700
                           text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={crearNegocio}
                disabled={saving || !nuevo.nombre.trim() || !nuevo.slug.trim()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500
                           text-white font-medium transition-colors text-sm disabled:opacity-50"
              >
                {saving ? 'Creando...' : 'Crear negocio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Gestión de plan ───────────────────────────── */}
      {modal?.tipo === 'plan' && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">{modal.nombre}</h3>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-5">Selecciona el plan a asignar</p>

            <div className="space-y-2">
              {[
                { tipo: 'free',       nombre: 'Gratuito',   precio: '$0/mes' },
                { tipo: 'basico',     nombre: 'Básico',     precio: '$49.000/mes' },
                { tipo: 'pro',        nombre: 'Pro',        precio: '$99.000/mes' },
                { tipo: 'enterprise', nombre: 'Enterprise', precio: '$199.000/mes' },
              ].map(p => (
                <button
                  key={p.tipo}
                  onClick={() => guardarPlan(modal.id, p.tipo)}
                  disabled={saving}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    modal.plan === p.tipo
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="font-medium text-sm">{p.nombre}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-400">{p.precio}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setModal(null)}
              className="mt-4 w-full text-sm text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white transition-colors py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
