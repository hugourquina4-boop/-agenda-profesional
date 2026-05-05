import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const VERTICAL_LABEL = { psicologo:'Psicólogo', peluqueria:'Peluquería', sso:'SSO', otro:'Otro' }
const BASE_URL = window.location.origin

const NEGOCIO_VACIO = {
  nombre:'', slug:'', vertical:'peluqueria',
  email:'', whatsapp:'', telefono:'',
  ciudad:'Cali', direccion:'', descripcion:'',
  color_primario:'#f43f5e', notas_admin:'',
  owner_nombre:'', owner_email:'', owner_telefono:'',
  links:{ instagram:'', web:'', google_calendar:'', otro:'' },
}

function slugify(t) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
}
function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#'
  return Array.from({ length:12 }, () => chars[Math.floor(Math.random()*chars.length)]).join('')
}
function copiar(texto) { navigator.clipboard.writeText(texto).catch(()=>{}) }

function Campo({ label, children }) {
  return (
    <div>
      <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block font-medium">{label}</label>
      {children}
    </div>
  )
}
const inp = `w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700
             rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white
             focus:outline-none focus:border-blue-500 transition-colors`


export default function Negocios() {
  const [negocios,    setNegocios]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [modal,       setModal]       = useState(null)   // {tipo:'nuevo'|'editar'|'plan'|'acceso'|'alerta', ...negocio}
  const [saving,      setSaving]      = useState(false)
  const [busqueda,    setBusqueda]    = useState('')
  const [error,       setError]       = useState('')
  const [form,        setForm]        = useState({ ...NEGOCIO_VACIO })
  const [slugManual,  setSlugManual]  = useState(false)
  const [copiado,     setCopiado]     = useState(null)

  // Estado modal crear acceso
  const [accesoEmail,    setAccesoEmail]    = useState('')
  const [accesoPass,     setAccesoPass]     = useState('')
  const [accesoCreado,   setAccesoCreado]   = useState(false)
  const [accesoError,    setAccesoError]    = useState('')

  // Estado modal alerta pago
  const [alertaMsg, setAlertaMsg] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.rpc('get_superadmin_negocios')
    setNegocios(data || [])
    setLoading(false)
  }

  function setF(key, value) {
    setForm(p => {
      const next = { ...p, [key]: value }
      if (key === 'nombre' && !slugManual) next.slug = slugify(value)
      return next
    })
  }
  function setLink(key, value) {
    setForm(p => ({ ...p, links: { ...(p.links||{}), [key]: value } }))
  }

  function abrirNuevo() {
    setForm({ ...NEGOCIO_VACIO })
    setSlugManual(false); setError('')
    setModal({ tipo:'nuevo' })
  }
  function abrirEditar(n) {
    setForm({
      id: n.id, nombre: n.nombre||'', slug: n.slug||'',
      vertical: n.vertical||'peluqueria', email: n.email||'',
      whatsapp: n.whatsapp||'', telefono: n.telefono||'',
      ciudad: n.ciudad||'', direccion: n.direccion||'',
      descripcion: n.descripcion||'', color_primario: n.color_primario||'#f43f5e',
      notas_admin: n.notas_admin||'',
      owner_nombre: n.owner_nombre||'', owner_email: n.owner_email||'',
      owner_telefono: n.owner_telefono||'',
      links: n.links||{ instagram:'', web:'', google_calendar:'', otro:'' },
    })
    setError('')
    setModal({ tipo:'editar', ...n })
  }
  function abrirPlan(n)   { setModal({ tipo:'plan', ...n }) }
  function abrirAcceso(n) {
    setAccesoEmail(n.owner_email || n.email || '')
    setAccesoPass(genPassword())
    setAccesoCreado(false); setAccesoError('')
    setModal({ tipo:'acceso', ...n })
  }
  function abrirAlerta(n) {
    setAlertaMsg(n.alerta_pago_msg || 'Tu suscripción está vencida. Contacta al administrador para renovarla.')
    setModal({ tipo:'alerta', ...n })
  }

  // ── Crear negocio ────────────────────────────────────────────────────────────
  async function crearNegocio() {
    if (!form.nombre.trim() || !form.slug.trim()) return
    setSaving(true); setError('')
    const { data: tenant, error: err } = await supabase.from('tenants').insert({
      nombre: form.nombre.trim(), slug: form.slug.trim(),
      vertical: form.vertical, email: form.email||null,
      whatsapp: form.whatsapp||null, telefono: form.telefono||null,
      ciudad: form.ciudad||'Cali', direccion: form.direccion||null,
      descripcion: form.descripcion||null, color_primario: form.color_primario,
      notas_admin: form.notas_admin||null, links: form.links||{},
      owner_nombre: form.owner_nombre||null, owner_email: form.owner_email||null,
      owner_telefono: form.owner_telefono||null,
      activo: true, verificado: false,
    }).select('id').single()
    if (err) {
      setSaving(false)
      setError(err.message.includes('slug') ? 'Ese slug ya está en uso.' : err.message)
      return
    }
    const { data: planFree } = await supabase.from('planes').select('id').eq('tipo','free').single()
    if (planFree) {
      await supabase.from('suscripciones').insert({
        tenant_id: tenant.id, plan_id: planFree.id, estado:'trial',
        fecha_inicio:      new Date().toISOString().split('T')[0],
        fecha_vencimiento: new Date(Date.now()+14*86400000).toISOString().split('T')[0],
      })
    }
    setSaving(false); setModal(null); cargar()
  }

  // ── Guardar edición ──────────────────────────────────────────────────────────
  async function guardarEdicion() {
    setSaving(true); setError('')
    const { error: err } = await supabase.from('tenants').update({
      nombre: form.nombre.trim(), slug: form.slug.trim(),
      vertical: form.vertical, email: form.email||null,
      whatsapp: form.whatsapp||null, telefono: form.telefono||null,
      ciudad: form.ciudad||null, direccion: form.direccion||null,
      descripcion: form.descripcion||null, color_primario: form.color_primario,
      notas_admin: form.notas_admin||null, links: form.links||{},
      owner_nombre: form.owner_nombre||null, owner_email: form.owner_email||null,
      owner_telefono: form.owner_telefono||null,
    }).eq('id', form.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setModal(null); cargar()
  }

  // ── Crear acceso (Edge Function con service_role — email pre-confirmado) ──────
  async function crearAcceso() {
    if (!accesoEmail.trim() || !accesoPass.trim()) { setAccesoError('Email y contraseña requeridos'); return }
    setSaving(true); setAccesoError('')
    const { data, error: fnErr } = await supabase.functions.invoke('admin-crear-usuario', {
      body: {
        email:     accesoEmail.trim(),
        password:  accesoPass.trim(),
        tenant_id: modal.id,
        rol:       'admin',
      },
    })
    setSaving(false)
    if (fnErr || data?.error) {
      const msg = data?.error || fnErr?.message || 'Error al crear el acceso'
      setAccesoError(msg.includes('already') || msg.includes('duplicate') ? 'Este email ya tiene acceso' : msg)
      return
    }
    setAccesoCreado(true)
    cargar()
  }

  // ── Toggle activo / verificado / alerta pago ─────────────────────────────────
  async function toggleActivo(id, activo)        { await supabase.from('tenants').update({ activo:     !activo     }).eq('id',id); cargar() }
  async function toggleVerificado(id, verificado){ await supabase.from('tenants').update({ verificado: !verificado }).eq('id',id); cargar() }
  async function toggleAlerta(id, alerta) {
    await supabase.from('tenants').update({ alerta_pago: !alerta }).eq('id', id)
    cargar()
  }
  async function guardarMensajeAlerta() {
    setSaving(true)
    await supabase.from('tenants').update({
      alerta_pago:     true,
      alerta_pago_msg: alertaMsg.trim() || null,
    }).eq('id', modal.id)
    setSaving(false); setModal(null); cargar()
  }

  // ── Plan + fechas ────────────────────────────────────────────────────────────
  async function guardarPlan(tenantId, planTipo, fechaInicio, fechaVenc) {
    setSaving(true)
    const { data: plan } = await supabase.from('planes').select('id').eq('tipo', planTipo).single()
    if (!plan) { setSaving(false); return }
    const { data: suscEx } = await supabase.from('suscripciones').select('id')
      .eq('tenant_id', tenantId).in('estado',['activa','trial']).maybeSingle()
    const payload = {
      tenant_id: tenantId, plan_id: plan.id, estado:'activa',
      fecha_inicio:      fechaInicio || new Date().toISOString().split('T')[0],
      fecha_vencimiento: fechaVenc   || new Date(Date.now()+30*86400000).toISOString().split('T')[0],
    }
    if (suscEx) await supabase.from('suscripciones').update(payload).eq('id', suscEx.id)
    else        await supabase.from('suscripciones').insert(payload)
    // Si pagó → quitar alerta automáticamente
    await supabase.from('tenants').update({ alerta_pago: false }).eq('id', tenantId)
    setSaving(false); setModal(null); cargar()
  }

  function handleCopiar(texto, key) {
    copiar(texto); setCopiado(key)
    setTimeout(() => setCopiado(null), 2000)
  }

  const filtrados = negocios.filter(n =>
    n.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    n.slug?.toLowerCase().includes(busqueda.toLowerCase()) ||
    n.owner_nombre?.toLowerCase().includes(busqueda.toLowerCase())
  )

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Negocios</h1>
        <div className="flex gap-3">
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..."
            className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                       rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white w-48 focus:outline-none focus:border-blue-500"/>
          <button onClick={abrirNuevo}
            className="text-xs px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors whitespace-nowrap">
            + Nuevo negocio
          </button>
        </div>
      </div>

      {/* Métricas */}
      {!loading && negocios.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label:'Total negocios', value:negocios.length,                                                color:'text-gray-900 dark:text-white' },
            { label:'Activos',        value:negocios.filter(n=>n.activo).length,                            color:'text-emerald-600 dark:text-emerald-400' },
            { label:'En trial',       value:negocios.filter(n=>n.suscripcion_estado==='trial').length,       color:'text-blue-600 dark:text-blue-400' },
            { label:'Alerta de pago', value:negocios.filter(n=>n.alerta_pago).length,                       color:'text-red-500 dark:text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 px-4 py-3">
              <p className="text-xs text-gray-400 dark:text-slate-500">{s.label}</p>
              <p className={`text-2xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(n => {
            const portalUrl = `${BASE_URL}/reservar/${n.slug}`
            return (
              <div key={n.id} className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 transition-colors ${
                n.alerta_pago ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-slate-800'
              }`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: n.color_primario||'#3b82f6' }}/>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{n.nombre}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        n.verificado ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                     : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'}`}>
                        {n.verificado ? 'Verificado' : 'Sin verificar'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        n.activo ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                                 : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                        {n.activo ? 'Activo' : 'Suspendido'}
                      </span>
                      {n.alerta_pago && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 animate-pulse">
                          ⚠ Pago pendiente
                        </span>
                      )}
                    </div>

                    {/* Datos plan y citas */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-slate-400 mb-1">
                      <span>{VERTICAL_LABEL[n.vertical]||n.vertical}</span>
                      <span>Plan: <b className="text-gray-800 dark:text-white capitalize">{n.plan||'—'}</b></span>
                      <span className={`font-medium capitalize ${
                        n.suscripcion_estado==='activa' ? 'text-emerald-600 dark:text-emerald-400' :
                        n.suscripcion_estado==='trial'  ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'
                      }`}>{n.suscripcion_estado||'sin suscripción'}</span>
                      {n.susc_vencimiento && (
                        <span>Vence: <b className="text-gray-700 dark:text-slate-300">{new Date(n.susc_vencimiento).toLocaleDateString('es-CO')}</b></span>
                      )}
                      <span>Citas 30d: <b className="text-gray-800 dark:text-white">{n.citas_30d||0}</b></span>
                    </div>

                    {/* Datos del dueño */}
                    {(n.owner_nombre || n.owner_email) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400 dark:text-slate-500 mb-2">
                        {n.owner_nombre && <span>👤 {n.owner_nombre}</span>}
                        {n.owner_email  && <span>✉ {n.owner_email}</span>}
                        {n.owner_telefono && <span>📱 {n.owner_telefono}</span>}
                      </div>
                    )}

                    {/* Link portal */}
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 rounded-xl px-3 py-2 max-w-sm">
                      <span className="text-xs text-gray-400 dark:text-slate-500 truncate flex-1 font-mono">{portalUrl}</span>
                      <button onClick={() => handleCopiar(portalUrl, n.id)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 flex-shrink-0 font-medium">
                        {copiado===n.id ? '✓' : 'Copiar'}
                      </button>
                      <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 flex-shrink-0">↗</a>
                    </div>

                    {n.notas_admin && (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg">
                        📌 {n.notas_admin}
                      </p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex flex-wrap gap-2 flex-shrink-0">
                    <button onClick={() => abrirEditar(n)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700
                                 text-gray-700 dark:text-slate-300 font-medium transition-colors">
                      Editar
                    </button>
                    <button onClick={() => toggleVerificado(n.id, n.verificado)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700
                                 text-gray-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors">
                      {n.verificado ? 'Desverificar' : 'Verificar'}
                    </button>
                    <button onClick={() => toggleActivo(n.id, n.activo)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700
                                 text-gray-600 dark:text-slate-300 hover:border-red-500 hover:text-red-500 transition-colors">
                      {n.activo ? 'Suspender' : 'Activar'}
                    </button>
                    <button onClick={() => abrirPlan(n)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
                      Plan / Fechas
                    </button>
                    <button onClick={() => abrirAcceso(n)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors">
                      Crear acceso
                    </button>
                    <button onClick={() => abrirAlerta(n)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                        n.alerta_pago
                          ? 'bg-red-100 dark:bg-red-500/20 border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-200'
                          : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-red-400 hover:text-red-500'
                      }`}>
                      {n.alerta_pago ? '⚠ Alerta activa' : 'Enviar alerta'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {filtrados.length===0 && !loading && (
            <div className="text-center py-20 text-gray-400 dark:text-slate-500 text-sm">
              {busqueda ? `Sin resultados para "${busqueda}"` : 'Aún no hay negocios'}
            </div>
          )}
        </div>
      )}

      {/* ── Modal Nuevo / Editar ─────────────────────────────────────────────── */}
      {(modal?.tipo==='nuevo' || modal?.tipo==='editar') && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 w-full max-w-2xl my-6">
            <h3 className="font-bold text-gray-900 dark:text-white mb-5 text-lg">
              {modal.tipo==='nuevo' ? 'Nuevo negocio' : `Editar — ${modal.nombre}`}
            </h3>

            <div className="space-y-4">
              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Negocio</p>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Nombre del negocio *">
                  <input value={form.nombre} onChange={e => setF('nombre', e.target.value)}
                    placeholder="Glamour Studio" className={inp}/>
                </Campo>
                <Campo label={`Color (${form.color_primario})`}>
                  <div className="flex gap-2">
                    <input type="color" value={form.color_primario} onChange={e => setF('color_primario', e.target.value)}
                      className="h-9 w-12 rounded-lg border border-gray-200 dark:border-slate-700 cursor-pointer bg-transparent p-0.5"/>
                    <input value={form.color_primario} onChange={e => setF('color_primario', e.target.value)}
                      className={`${inp} font-mono`}/>
                  </div>
                </Campo>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Slug (URL) *">
                  <input value={form.slug}
                    onChange={e => { setSlugManual(true); setF('slug', slugify(e.target.value)) }}
                    placeholder="glamour-studio" className={`${inp} font-mono`}/>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">/reservar/<b>{form.slug||'...'}</b></p>
                </Campo>
                <Campo label="Vertical">
                  <select value={form.vertical} onChange={e => setF('vertical', e.target.value)} className={inp}>
                    <option value="peluqueria">Peluquería / Estética</option>
                    <option value="psicologo">Psicólogo / Terapeuta</option>
                    <option value="sso">SSO</option>
                    <option value="otro">Otro</option>
                  </select>
                </Campo>
              </div>
              <Campo label="Descripción">
                <input value={form.descripcion} onChange={e => setF('descripcion', e.target.value)}
                  placeholder="Visible en el portal público" className={inp}/>
              </Campo>

              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider pt-2">Datos del dueño</p>
              <div className="grid grid-cols-3 gap-3">
                <Campo label="Nombre completo *">
                  <input value={form.owner_nombre} onChange={e => setF('owner_nombre', e.target.value)}
                    placeholder="María González" className={inp}/>
                </Campo>
                <Campo label="Email del dueño *">
                  <input type="email" value={form.owner_email} onChange={e => setF('owner_email', e.target.value)}
                    placeholder="maria@email.com" className={inp}/>
                </Campo>
                <Campo label="Teléfono / WhatsApp">
                  <input value={form.owner_telefono} onChange={e => setF('owner_telefono', e.target.value)}
                    placeholder="3001234567" className={inp}/>
                </Campo>
              </div>

              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider pt-2">Contacto del negocio</p>
              <div className="grid grid-cols-3 gap-3">
                <Campo label="Email negocio">
                  <input type="email" value={form.email} onChange={e => setF('email', e.target.value)}
                    placeholder="salon@email.com" className={inp}/>
                </Campo>
                <Campo label="WhatsApp">
                  <input value={form.whatsapp} onChange={e => setF('whatsapp', e.target.value)}
                    placeholder="3001234567" className={inp}/>
                </Campo>
                <Campo label="Teléfono fijo">
                  <input value={form.telefono} onChange={e => setF('telefono', e.target.value)}
                    placeholder="6021234567" className={inp}/>
                </Campo>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Ciudad">
                  <input value={form.ciudad} onChange={e => setF('ciudad', e.target.value)}
                    placeholder="Cali" className={inp}/>
                </Campo>
                <Campo label="Dirección">
                  <input value={form.direccion} onChange={e => setF('direccion', e.target.value)}
                    placeholder="Cl 9 C #49-45" className={inp}/>
                </Campo>
              </div>

              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider pt-2">Links</p>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Instagram">
                  <input value={form.links?.instagram||''} onChange={e => setLink('instagram', e.target.value)}
                    placeholder="https://instagram.com/..." className={inp}/>
                </Campo>
                <Campo label="Sitio web">
                  <input value={form.links?.web||''} onChange={e => setLink('web', e.target.value)}
                    placeholder="https://..." className={inp}/>
                </Campo>
              </div>

              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider pt-2">Notas internas</p>
              <Campo label="Solo visible para el superadmin">
                <textarea value={form.notas_admin} onChange={e => setF('notas_admin', e.target.value)}
                  rows={2} placeholder="Observaciones, acuerdos comerciales, pendientes..."
                  className={`${inp} resize-none`}/>
              </Campo>

              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-xl">{error}</p>}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModal(null); setError('') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700
                           text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors">
                Cancelar
              </button>
              <button onClick={modal.tipo==='nuevo' ? crearNegocio : guardarEdicion}
                disabled={saving || !form.nombre.trim() || !form.slug.trim()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500
                           text-white font-medium text-sm disabled:opacity-50 transition-colors">
                {saving ? 'Guardando…' : modal.tipo==='nuevo' ? 'Crear negocio' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Plan + Fechas ──────────────────────────────────────────────── */}
      {modal?.tipo==='plan' && (
        <ModalPlan negocio={modal} saving={saving} onClose={() => setModal(null)} onGuardar={guardarPlan}/>
      )}

      {/* ── Modal Crear acceso ───────────────────────────────────────────────── */}
      {modal?.tipo==='acceso' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">Crear acceso</h3>
            <p className="text-gray-500 dark:text-slate-400 text-xs mb-5">{modal.nombre}</p>

            {!accesoCreado ? (
              <>
                <div className="space-y-3 mb-4">
                  <Campo label="Email del dueño">
                    <input type="email" value={accesoEmail}
                      onChange={e => setAccesoEmail(e.target.value)}
                      placeholder="dueño@email.com" className={inp}/>
                  </Campo>
                  <Campo label="Contraseña temporal">
                    <div className="flex gap-2">
                      <input value={accesoPass} onChange={e => setAccesoPass(e.target.value)}
                        className={`${inp} font-mono flex-1`}/>
                      <button onClick={() => setAccesoPass(genPassword())}
                        title="Generar nueva"
                        className="px-3 rounded-xl border border-gray-200 dark:border-slate-700
                                   text-gray-500 dark:text-slate-400 hover:text-blue-600 transition-colors text-sm">
                        🔁
                      </button>
                    </div>
                  </Campo>
                </div>

                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2 mb-4">
                  <span className="text-amber-500 mt-0.5 text-xs">⚠</span>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Copia la contraseña antes de continuar y envíasela al cliente por WhatsApp. No se podrá ver de nuevo.
                  </p>
                </div>

                <button onClick={() => handleCopiar(`Email: ${accesoEmail}\nContraseña: ${accesoPass}\nURL: ${BASE_URL}/salon`, 'creds')}
                  className="w-full py-2 mb-3 rounded-xl border border-gray-200 dark:border-slate-700
                             text-gray-600 dark:text-slate-300 text-sm font-medium hover:border-blue-400 hover:text-blue-600 transition-colors">
                  {copiado==='creds' ? '✓ Copiado' : '📋 Copiar credenciales'}
                </button>

                {accesoError && <p className="text-xs text-red-500 mb-3">{accesoError}</p>}

                <div className="flex gap-3">
                  <button onClick={() => setModal(null)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700
                               text-gray-500 dark:text-slate-400 text-sm transition-colors">
                    Cancelar
                  </button>
                  <button onClick={crearAcceso} disabled={saving || !accesoEmail.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500
                               text-white font-medium text-sm disabled:opacity-50 transition-colors">
                    {saving ? 'Creando…' : 'Crear acceso'}
                  </button>
                </div>
              </>
            ) : (
              /* Pantalla de éxito */
              <div className="text-center">
                <div className="text-5xl mb-4">✅</div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-1">Acceso creado</h4>
                <p className="text-gray-400 dark:text-slate-500 text-xs mb-4">
                  El cliente ya puede entrar a su salón
                </p>
                <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 text-left space-y-1 mb-4">
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    <b className="text-gray-700 dark:text-white">URL:</b> {BASE_URL}/salon
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    <b className="text-gray-700 dark:text-white">Email:</b> {accesoEmail}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    <b className="text-gray-700 dark:text-white">Contraseña:</b> {accesoPass}
                  </p>
                </div>
                <button onClick={() => handleCopiar(
                  `Hola ${modal.owner_nombre||modal.nombre}! 👋\n\nYa tienes acceso a Salón Pro:\n\n🔗 URL: ${BASE_URL}/salon\n📧 Email: ${accesoEmail}\n🔑 Contraseña: ${accesoPass}\n\nIngresa y configura tu salón. ¡Cualquier duda me avisas!`,
                  'msg_wa'
                )}
                  className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium text-sm mb-2 transition-colors">
                  {copiado==='msg_wa' ? '✓ Copiado' : '📲 Copiar mensaje para WhatsApp'}
                </button>
                <button onClick={() => setModal(null)}
                  className="w-full py-2 text-sm text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Alerta de pago ─────────────────────────────────────────────── */}
      {modal?.tipo==='alerta' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">Alerta de pago</h3>
            <p className="text-gray-500 dark:text-slate-400 text-xs mb-4">{modal.nombre}</p>

            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              Este mensaje aparecerá en el banner de la app del cliente hasta que confirmes el pago o lo desactives.
            </p>

            <textarea value={alertaMsg} onChange={e => setAlertaMsg(e.target.value)} rows={3}
              className={`${inp} resize-none mb-4`}
              placeholder="Tu suscripción está vencida. Contacta al administrador…"/>

            {modal.alerta_pago && (
              <button onClick={async () => {
                await supabase.from('tenants').update({ alerta_pago: false }).eq('id', modal.id)
                setModal(null); cargar()
              }}
                className="w-full py-2 mb-2 rounded-xl border border-gray-200 dark:border-slate-700
                           text-gray-500 dark:text-slate-400 text-sm hover:text-gray-900 dark:hover:text-white transition-colors">
                Desactivar alerta
              </button>
            )}

            <div className="flex gap-3">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700
                           text-gray-500 dark:text-slate-400 text-sm transition-colors">
                Cancelar
              </button>
              <button onClick={guardarMensajeAlerta} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500
                           text-white font-medium text-sm disabled:opacity-50 transition-colors">
                {saving ? 'Enviando…' : 'Activar alerta'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Modal Plan ────────────────────────────────────────────────────────────────
function ModalPlan({ negocio, saving, onClose, onGuardar }) {
  const [planSel,   setPlanSel]   = useState(negocio.plan||'free')
  const [fechaIni,  setFechaIni]  = useState(negocio.susc_inicio?.split('T')[0]       || new Date().toISOString().split('T')[0])
  const [fechaVenc, setFechaVenc] = useState(negocio.susc_vencimiento?.split('T')[0]  || new Date(Date.now()+30*86400000).toISOString().split('T')[0])

  const PLANES = [
    { tipo:'free',       nombre:'Gratuito',   precio:'$0 / mes'        },
    { tipo:'basico',     nombre:'Básico',      precio:'$49.000 / mes'   },
    { tipo:'pro',        nombre:'Pro',         precio:'$99.000 / mes'   },
    { tipo:'enterprise', nombre:'Enterprise',  precio:'$199.000 / mes'  },
  ]

  const inp2 = `w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500`

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 w-full max-w-sm">
        <h3 className="font-bold text-gray-900 dark:text-white mb-1">{negocio.nombre}</h3>
        <p className="text-gray-500 dark:text-slate-400 text-xs mb-5">Plan y fechas de suscripción</p>

        <div className="space-y-2 mb-5">
          {PLANES.map(p => (
            <button key={p.tipo} onClick={() => setPlanSel(p.tipo)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                planSel===p.tipo
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-400'
              }`}>
              <span className="font-medium text-sm">{p.nombre}</span>
              <span className="text-xs text-gray-400 dark:text-slate-500">{p.precio}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Fecha inicio</label>
            <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)} className={inp2}/>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Fecha vencimiento</label>
            <input type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)} className={inp2}/>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-5">
          {[{label:'+30 días',dias:30},{label:'+3 meses',dias:90},{label:'+1 año',dias:365}].map(({label,dias}) => (
            <button key={label}
              onClick={() => setFechaVenc(new Date(Date.now()+dias*86400000).toISOString().split('T')[0])}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300
                         hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 transition-colors">
              {label}
            </button>
          ))}
        </div>

        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-3">
          ✓ Al guardar se desactiva automáticamente cualquier alerta de pago activa.
        </p>

        <button onClick={() => onGuardar(negocio.id, planSel, fechaIni, fechaVenc)} disabled={saving}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm disabled:opacity-50 transition-colors mb-2">
          {saving ? 'Guardando…' : 'Guardar plan y fechas'}
        </button>
        <button onClick={onClose}
          className="w-full py-2 text-sm text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}
