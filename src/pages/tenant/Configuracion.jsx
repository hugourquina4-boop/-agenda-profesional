import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

// ── Constantes ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'general',    label: 'General' },
  { key: 'apariencia', label: 'Apariencia' },
  { key: 'horarios',   label: 'Horarios' },
  { key: 'puntos',     label: 'Fidelización' },
]

const DIAS_KEY   = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo']
const DIAS_LABEL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']

const COLORES = [
  '#3b82f6','#6366f1','#8b5cf6','#a855f7','#ec4899',
  '#db2777','#ef4444','#f97316','#f59e0b','#10b981',
  '#06b6d4','#0ea5e9','#14b8a6','#64748b','#1e293b',
]

// ── Componentes de utilidad ───────────────────────────────────────────────────
function Card({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 ${className}`}>
      {children}
    </div>
  )
}

function FieldRow({ label, hint, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4 py-4
                    border-b border-gray-50 dark:border-slate-800/60 last:border-0">
      <div className="sm:w-44 flex-shrink-0">
        <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">{label}</p>
        {hint && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 leading-snug">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

const inputCls = `w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700
  rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white
  placeholder-gray-400 dark:placeholder-slate-500
  focus:outline-none focus:bg-white dark:focus:bg-slate-700
  focus:border-blue-400 dark:focus:border-blue-500
  focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all`

function Input({ value, onChange, placeholder, type = 'text', maxLength }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} maxLength={maxLength}
      className={inputCls} />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      className={`${inputCls} resize-none`} />
  )
}

function SaveBtn({ onClick, saving, saved, col }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold
                 disabled:opacity-60 transition-all active:scale-[0.98]"
      style={{ backgroundColor: saved ? '#10b981' : col }}>
      {saving ? (
        <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando</>
      ) : saved ? (
        <><CheckIcon /> Guardado</>
      ) : 'Guardar cambios'}
    </button>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function Toggle({ checked, onChange, col }) {
  return (
    <button onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0"
      style={{ backgroundColor: checked ? col : '#d1d5db' }}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  )
}

function Alert({ msg, type = 'error', onClose }) {
  if (!msg) return null
  const styles = type === 'error'
    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
    : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm mb-4 ${styles}`}>
      <span>{msg}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  )
}

// ── Módulo principal ──────────────────────────────────────────────────────────
export default function Configuracion() {
  const { tenant, recargar } = useTenant()
  const [tab, setTab] = useState('general')
  const col = tenant?.color_primario || '#3b82f6'

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración</h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{tenant?.nombre}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-1 ${
              tab === t.key
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general'    && <TabGeneral    tenant={tenant} recargar={recargar} col={col} />}
      {tab === 'apariencia' && <TabApariencia tenant={tenant} recargar={recargar} col={col} />}
      {tab === 'horarios'   && <TabHorarios   tenant={tenant} col={col} />}
      {tab === 'puntos'     && <TabPuntos     tenant={tenant} col={col} />}
    </div>
  )
}

// ── Tab General ───────────────────────────────────────────────────────────────
function TabGeneral({ tenant, recargar, col }) {
  const [form, setForm]   = useState({})
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [err,    setErr]    = useState('')

  useEffect(() => {
    if (!tenant) return
    setForm({
      nombre:      tenant.nombre      || '',
      descripcion: tenant.descripcion || '',
      ciudad:      tenant.ciudad      || '',
      direccion:   tenant.direccion   || '',
      whatsapp:    tenant.whatsapp    || '',
      email:       tenant.email       || '',
      sitio_web:   tenant.sitio_web   || '',
    })
  }, [tenant])

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); setSaved(false) }

  async function guardar() {
    setSaving(true); setErr('')
    const { error } = await supabase.from('tenants')
      .update({
        nombre:      form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        ciudad:      form.ciudad.trim()      || null,
        direccion:   form.direccion.trim()   || null,
        whatsapp:    form.whatsapp.trim()    || null,
        email:       form.email.trim()       || null,
        sitio_web:   form.sitio_web.trim()   || null,
      })
      .eq('id', tenant.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setSaved(true)
    recargar()
    setTimeout(() => setSaved(false), 3000)
  }

  async function solicitarEliminacion() {
    const confirmar = window.confirm(
      "¿Estás seguro de que deseas solicitar la eliminación permanente de tu cuenta y todos tus datos personales asociados? Esta acción es irreversible, cerrará tu sesión y eliminará todos tus registros de la plataforma."
    )
    if (!confirmar) return

    setSaving(true); setErr('')
    const { error } = await supabase.auth.updateUser({
      data: { 
        solicitud_eliminacion: true, 
        fecha_solicitud_eliminacion: new Date().toISOString() 
      }
    })
    setSaving(false)

    if (error) {
      setErr("Error al registrar la solicitud: " + error.message)
      return
    }

    alert("Tu solicitud de eliminación ha sido registrada con éxito. Se cerrará tu sesión y tus datos se borrarán en un plazo máximo de 7 días hábiles conforme a la Ley 1581.")
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <div className="space-y-4">
      <Alert msg={err} onClose={() => setErr('')} />
      <Card className="px-5 py-1">
        <FieldRow label="Nombre del negocio" hint="Visible para los clientes">
          <Input value={form.nombre || ''} onChange={v => set('nombre', v)}
            placeholder="Ej: Peluquería Estilo" maxLength={200} />
        </FieldRow>
        <FieldRow label="Descripción" hint="Breve presentación del negocio">
          <Textarea value={form.descripcion || ''} onChange={v => set('descripcion', v)}
            placeholder="Ej: Especialistas en coloración y corte de tendencia..." rows={3} />
        </FieldRow>
        <FieldRow label="Ciudad">
          <Input value={form.ciudad || ''} onChange={v => set('ciudad', v)}
            placeholder="Ej: Bogotá, Medellín..." maxLength={100} />
        </FieldRow>
        <FieldRow label="Dirección">
          <Input value={form.direccion || ''} onChange={v => set('direccion', v)}
            placeholder="Calle, número, barrio..." maxLength={300} />
        </FieldRow>
        <FieldRow label="WhatsApp" hint="Sin código de país ni espacios">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-slate-400 flex-shrink-0">+57</span>
            <Input value={form.whatsapp || ''} onChange={v => set('whatsapp', v)}
              placeholder="3001234567" type="tel" maxLength={15} />
          </div>
        </FieldRow>
        <FieldRow label="Email de contacto">
          <Input value={form.email || ''} onChange={v => set('email', v)}
            placeholder="contacto@tunegocio.com" type="email" maxLength={200} />
        </FieldRow>
        <FieldRow label="Sitio web">
          <Input value={form.sitio_web || ''} onChange={v => set('sitio_web', v)}
            placeholder="https://..." maxLength={300} />
        </FieldRow>
      </Card>
      
      <Card className="px-5 py-4 border border-red-200/50 dark:border-red-900/30 bg-red-50/10 dark:bg-red-950/10 rounded-2xl">
        <h3 className="text-sm font-bold text-red-600 dark:text-red-400 border-none m-0 p-0 mb-1 flex items-center gap-2">
          ⚠️ Zona de Peligro
        </h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-3 leading-relaxed">
          De conformidad con la Ley 1581 de 2012 de Protección de Datos Personales y las políticas de la tienda, tienes derecho a solicitar la supresión total de tu información. Esta acción desactivará tu cuenta y todos tus datos personales asociados de forma permanente en un plazo máximo de 7 días hábiles.
        </p>
        <button onClick={solicitarEliminacion}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-all active:scale-[0.98]">
          Solicitar eliminación permanente de mi cuenta
        </button>
      </Card>

      <div className="flex justify-end">
        <SaveBtn onClick={guardar} saving={saving} saved={saved} col={col} />
      </div>
    </div>
  )
}

// ── Tab Apariencia ────────────────────────────────────────────────────────────
function TabApariencia({ tenant, recargar, col }) {
  const [color,    setColor]    = useState(tenant?.color_primario || '#3b82f6')
  const [logoUrl,  setLogoUrl]  = useState(tenant?.logo_url || '')
  const [hex,      setHex]      = useState(tenant?.color_primario || '#3b82f6')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [err,      setErr]      = useState('')

  function pickColor(c) { setColor(c); setHex(c); setSaved(false) }

  function onHex(v) {
    setHex(v)
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { setColor(v); setSaved(false) }
  }

  async function guardar() {
    setSaving(true); setErr('')
    const { error } = await supabase.from('tenants')
      .update({ color_primario: color, logo_url: logoUrl.trim() || null })
      .eq('id', tenant.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setSaved(true)
    recargar()
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-4">
      <Alert msg={err} onClose={() => setErr('')} />
      <Card className="px-5 py-1">
        <FieldRow label="Color principal" hint="Afecta botones, badges y el portal público">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {COLORES.map(c => (
                <button key={c} onClick={() => pickColor(c)}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110 flex-shrink-0"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2,
                    boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none',
                  }} />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex-shrink-0 shadow"
                   style={{ backgroundColor: color }} />
              <input value={hex} onChange={e => onHex(e.target.value)}
                placeholder="#3b82f6" maxLength={7}
                className={`${inputCls} font-mono w-36`} />
              <span className="text-xs text-gray-400 dark:text-slate-500">HEX personalizado</span>
            </div>
          </div>
        </FieldRow>
        <FieldRow label="Logo URL" hint="URL directa a la imagen (PNG o JPG)">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden border border-gray-200 dark:border-slate-700
                            flex items-center justify-center bg-gray-50 dark:bg-slate-800">
              {logoUrl
                ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover"
                       onError={e => { e.target.style.display = 'none' }} />
                : <span className="text-xl font-black text-gray-300 dark:text-slate-600">
                    {tenant?.nombre?.[0] || '?'}
                  </span>
              }
            </div>
            <div className="flex-1">
              <Input value={logoUrl} onChange={v => { setLogoUrl(v); setSaved(false) }}
                placeholder="https://..." />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Sube tu logo a Imgur, Cloudinary o similar y pega la URL aquí
              </p>
            </div>
          </div>
        </FieldRow>
        <FieldRow label="Vista previa" hint="Así verán el header del portal tus clientes">
          <div className="rounded-xl overflow-hidden">
            <div className="px-4 py-5 flex items-center gap-3"
                 style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}bb 100%)` }}>
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center
                              bg-white/20 text-white font-black text-lg">
                {logoUrl
                  ? <img src={logoUrl} alt="" className="w-full h-full object-cover"
                         onError={e => { e.target.style.display = 'none' }} />
                  : tenant?.nombre?.[0] || '?'
                }
              </div>
              <div>
                <p className="font-black text-white text-sm">{tenant?.nombre}</p>
                <p className="text-white/60 text-xs">{tenant?.ciudad || 'Tu ciudad'}</p>
              </div>
            </div>
          </div>
        </FieldRow>
      </Card>
      <div className="flex justify-end">
        <SaveBtn onClick={guardar} saving={saving} saved={saved} col={col} />
      </div>
    </div>
  )
}

// ── Tab Horarios ──────────────────────────────────────────────────────────────
function TabHorarios({ tenant, col }) {
  const [profs,    setProfs]   = useState([])
  const [grid,     setGrid]    = useState({})   // { profId: { dia: { activo, ini, fin } } }
  const [loading,  setLoading] = useState(true)
  const [saving,   setSaving]  = useState(false)
  const [saved,    setSaved]   = useState(false)
  const [err,      setErr]     = useState('')

  useEffect(() => { if (tenant?.id) cargar() }, [tenant])

  async function cargar() {
    setLoading(true)
    const [{ data: ps }, { data: hs }] = await Promise.all([
      supabase.from('profesionales').select('id, nombre, color')
        .eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
      supabase.from('horarios').select('*')
        .eq('tenant_id', tenant.id).eq('activo', true),
    ])
    const profesionales = ps || []
    const horarios      = hs || []

    // Construir grid inicial
    const g = {}
    profesionales.forEach(p => {
      g[p.id] = {}
      DIAS_KEY.forEach(dia => {
        const h = horarios.find(x => x.profesional_id === p.id && x.dia === dia)
        g[p.id][dia] = h
          ? { activo: true, ini: h.hora_inicio.slice(0,5), fin: h.hora_fin.slice(0,5), _id: h.id }
          : { activo: false, ini: '08:00', fin: '18:00', _id: null }
      })
    })
    setProfs(profesionales)
    setGrid(g)
    setLoading(false)
  }

  function toggleDia(profId, dia) {
    setGrid(g => ({
      ...g,
      [profId]: { ...g[profId], [dia]: { ...g[profId][dia], activo: !g[profId][dia].activo } }
    }))
    setSaved(false)
  }

  function setHora(profId, dia, campo, val) {
    setGrid(g => ({
      ...g,
      [profId]: { ...g[profId], [dia]: { ...g[profId][dia], [campo]: val } }
    }))
    setSaved(false)
  }

  async function guardar() {
    setSaving(true); setErr('')
    try {
      for (const p of profs) {
        for (const dia of DIAS_KEY) {
          const cell = grid[p.id]?.[dia]
          if (!cell) continue
          if (cell.activo) {
            if (cell._id) {
              await supabase.from('horarios')
                .update({ hora_inicio: cell.ini, hora_fin: cell.fin })
                .eq('id', cell._id)
            } else {
              await supabase.from('horarios').insert({
                tenant_id: tenant.id, profesional_id: p.id,
                dia, hora_inicio: cell.ini, hora_fin: cell.fin, activo: true,
              })
            }
          } else if (cell._id) {
            await supabase.from('horarios').delete().eq('id', cell._id)
          }
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      cargar()
    } catch (e) {
      setErr(e.message)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
           style={{ borderColor: col, borderTopColor: 'transparent' }} />
    </div>
  )

  if (!profs.length) return (
    <Card className="p-8 text-center">
      <p className="text-gray-400 dark:text-slate-500 text-sm">
        Agrega profesionales en la sección Equipo primero
      </p>
    </Card>
  )

  return (
    <div className="space-y-4">
      <Alert msg={err} onClose={() => setErr('')} />

      {/* Tabla de horarios */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 dark:text-slate-500
                               uppercase tracking-wider w-24">
                  Día
                </th>
                {profs.map(p => (
                  <th key={p.id} className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                           style={{ background: `linear-gradient(135deg, ${p.color || col}, ${p.color || col}99)` }}>
                        {p.nombre[0]}
                      </div>
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 truncate max-w-[80px]">
                        {p.nombre.split(' ')[0]}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIAS_KEY.map((dia, di) => (
                <tr key={dia}
                    className="border-b border-gray-50 dark:border-slate-800/60 last:border-0
                               hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-700 dark:text-slate-300 text-sm w-24">
                    {DIAS_LABEL[di]}
                  </td>
                  {profs.map(p => {
                    const cell = grid[p.id]?.[dia] || { activo: false, ini: '08:00', fin: '18:00' }
                    return (
                      <td key={p.id} className="px-3 py-2.5 text-center align-middle">
                        <div className="flex flex-col items-center gap-1.5">
                          {/* Toggle activo */}
                          <button onClick={() => toggleDia(p.id, dia)}
                            className="w-10 h-5 rounded-full transition-colors flex-shrink-0 relative"
                            style={{ backgroundColor: cell.activo ? col : '#e2e8f0' }}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                              cell.activo ? 'right-0.5' : 'left-0.5'
                            }`} />
                          </button>

                          {/* Horas (solo si activo) */}
                          {cell.activo && (
                            <div className="flex items-center gap-1">
                              <input type="time" value={cell.ini}
                                onChange={e => setHora(p.id, dia, 'ini', e.target.value)}
                                className="text-[11px] bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                                           rounded-lg px-1.5 py-1 w-20 text-gray-700 dark:text-slate-300
                                           focus:outline-none focus:border-blue-400 transition-colors" />
                              <span className="text-[10px] text-gray-300 dark:text-slate-600">–</span>
                              <input type="time" value={cell.fin}
                                onChange={e => setHora(p.id, dia, 'fin', e.target.value)}
                                className="text-[11px] bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                                           rounded-lg px-1.5 py-1 w-20 text-gray-700 dark:text-slate-300
                                           focus:outline-none focus:border-blue-400 transition-colors" />
                            </div>
                          )}
                          {!cell.activo && (
                            <span className="text-[10px] text-gray-300 dark:text-slate-600">—</span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Leyenda */}
      <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
        Activa cada día por profesional y ajusta el rango de horas. Los cambios aplican al portal de reservas.
      </p>

      <div className="flex justify-end">
        <SaveBtn onClick={guardar} saving={saving} saved={saved} col={col} />
      </div>
    </div>
  )
}

// ── Tab Puntos / Fidelización ─────────────────────────────────────────────────
function TabPuntos({ tenant, col }) {
  const [cfg,    setCfg]    = useState(null)
  const [form,   setForm]   = useState({})
  const [loading,setLoading]= useState(true)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [err,    setErr]    = useState('')

  useEffect(() => { if (tenant?.id) cargar() }, [tenant])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('config_puntos')
      .select('*').eq('tenant_id', tenant.id).maybeSingle()
    setCfg(data)
    if (data) {
      setForm({
        activo:             data.activo,
        puntos_por_cita:    data.puntos_por_cita    ?? 10,
        valor_por_punto:    data.valor_por_punto    ?? 100,
        minimo_canje:       data.minimo_canje        ?? 50,
        puntos_bienvenida:  data.puntos_bienvenida   ?? 0,
      })
    } else {
      setForm({ activo: false, puntos_por_cita: 10, valor_por_punto: 100, minimo_canje: 50, puntos_bienvenida: 0 })
    }
    setLoading(false)
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  async function guardar() {
    setSaving(true); setErr('')
    const payload = {
      tenant_id:          tenant.id,
      activo:             form.activo,
      puntos_por_cita:    Number(form.puntos_por_cita),
      valor_por_punto:    Number(form.valor_por_punto),
      minimo_canje:       Number(form.minimo_canje),
      puntos_bienvenida:  Number(form.puntos_bienvenida),
    }
    const { error } = cfg
      ? await supabase.from('config_puntos').update(payload).eq('tenant_id', tenant.id)
      : await supabase.from('config_puntos').insert(payload)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setSaved(true)
    cargar()
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
           style={{ borderColor: col, borderTopColor: 'transparent' }} />
    </div>
  )

  // Calculadora de ejemplo
  const puntosPorCita   = Number(form.puntos_por_cita) || 0
  const valorPorPunto   = Number(form.valor_por_punto) || 0
  const minimoCanje     = Number(form.minimo_canje) || 0
  const citasParaCanje  = minimoCanje > 0 && puntosPorCita > 0
    ? Math.ceil(minimoCanje / puntosPorCita) : 0
  const valorMinimoCanje = minimoCanje * valorPorPunto

  return (
    <div className="space-y-4">
      <Alert msg={err} onClose={() => setErr('')} />
      <Card className="px-5 py-1">

        {/* Activar / desactivar */}
        <FieldRow label="Programa de puntos" hint="Activa el sistema de fidelización para tus clientes">
          <div className="flex items-center gap-3">
            <Toggle checked={!!form.activo} onChange={v => set('activo', v)} col={col} />
            <span className={`text-sm font-semibold ${form.activo ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}`}>
              {form.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </FieldRow>

        {form.activo && (
          <>
            <FieldRow label="Puntos por cita" hint="Puntos que gana el cliente al completar una cita">
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="9999" value={form.puntos_por_cita}
                  onChange={e => set('puntos_por_cita', e.target.value)}
                  className={`${inputCls} w-28`} />
                <span className="text-sm text-gray-500 dark:text-slate-400">puntos / cita</span>
              </div>
            </FieldRow>

            <FieldRow label="Valor por punto" hint="Cuánto vale cada punto en pesos colombianos">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-slate-400">$</span>
                <input type="number" min="1" max="99999" value={form.valor_por_punto}
                  onChange={e => set('valor_por_punto', e.target.value)}
                  className={`${inputCls} w-28`} />
                <span className="text-sm text-gray-500 dark:text-slate-400">COP / punto</span>
              </div>
            </FieldRow>

            <FieldRow label="Mínimo para canjear" hint="Cantidad mínima de puntos para hacer un canje">
              <div className="flex items-center gap-2">
                <input type="number" min="1" max="99999" value={form.minimo_canje}
                  onChange={e => set('minimo_canje', e.target.value)}
                  className={`${inputCls} w-28`} />
                <span className="text-sm text-gray-500 dark:text-slate-400">puntos</span>
              </div>
            </FieldRow>

            <FieldRow label="Puntos de bienvenida" hint="Puntos que recibe el cliente al registrarse por primera vez">
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="9999" value={form.puntos_bienvenida}
                  onChange={e => set('puntos_bienvenida', e.target.value)}
                  className={`${inputCls} w-28`} />
                <span className="text-sm text-gray-500 dark:text-slate-400">puntos al registrarse</span>
              </div>
            </FieldRow>

            {/* Simulador */}
            {puntosPorCita > 0 && minimoCanje > 0 && (
              <div className="my-2 p-4 rounded-xl"
                   style={{ background: `${col}08`, border: `1px solid ${col}20` }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: col }}>
                  Simulador
                </p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'Citas para canjear', value: `${citasParaCanje} citas` },
                    { label: 'Puntos mínimos',      value: `${minimoCanje} pts` },
                    { label: 'Valor del canje',     value: `$${valorMinimoCanje.toLocaleString('es-CO')}` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-lg font-black" style={{ color: col }}>{value}</p>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-3 text-center">
                  Con {puntosPorCita} puntos por cita, el cliente canjea tras {citasParaCanje} visitas
                </p>
              </div>
            )}
          </>
        )}
      </Card>

      <div className="flex justify-end">
        <SaveBtn onClick={guardar} saving={saving} saved={saved} col={col} />
      </div>
    </div>
  )
}
