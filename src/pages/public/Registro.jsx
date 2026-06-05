import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function slugify(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const VERTICALES = [
  { key: 'psicologo',  label: 'Psicólogo / Terapeuta' },
  { key: 'peluqueria', label: 'Peluquería / Estética' },
  { key: 'sso',        label: 'Salud Ocupacional (SSO)' },
  { key: 'otro',       label: 'Otro tipo de negocio' },
]

export default function Registro() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: datos negocio, 2: cuenta
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [enviado, setEnviado] = useState(false)

  // Paso 1 — negocio
  const [nombre,   setNombre]   = useState('')
  const [slug,     setSlug]     = useState('')
  const [vertical, setVertical] = useState('psicologo')
  const [ciudad,   setCiudad]   = useState('Cali')
  const [whatsapp, setWhatsapp] = useState('')
  const [slugManual, setSlugManual] = useState(false)

  // Paso 2 — cuenta
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [nombreOwner, setNombreOwner] = useState('')

  function campoNombre(v) {
    setNombre(v)
    if (!slugManual) setSlug(slugify(v))
  }

  async function registrar(e) {
    e.preventDefault()
    if (password !== password2) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8)    { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (!/[0-9]/.test(password)){ setError('La contraseña debe incluir al menos un número'); return }
    if (!slug.trim())           { setError('El identificador del negocio es requerido'); return }

    setSaving(true)
    setError('')

    // 1 — Crear cuenta en Supabase Auth
    const { data: auth, error: authErr } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre: nombreOwner } }
    })

    if (authErr) { setSaving(false); setError(authErr.message); return }

    const userId = auth.user?.id
    if (!userId) {
      // Supabase requiere confirmación de email
      setSaving(false)
      setEnviado(true)
      return
    }

    await crearTenant(userId)
  }

  async function crearTenant(userId) {
    // 2 — Crear tenant
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .insert({
        nombre:    nombre.trim(),
        slug:      slug.trim(),
        vertical,
        ciudad:    ciudad || 'Cali',
        whatsapp:  whatsapp || null,
        email,
        activo:    true,
        verificado: false,
      })
      .select('id').single()

    if (tErr) {
      setSaving(false)
      setError(tErr.message.includes('slug') ? 'Ese identificador ya está en uso, elige otro.' : tErr.message)
      return
    }

    // 3 — Vincular usuario como admin del tenant
    await supabase.from('usuarios_tenant').insert({
      tenant_id: tenant.id,
      user_id:   userId,
      rol:       'admin',
      nombre:    nombreOwner || nombre,
      email,
    })

    // 4 — Suscripción trial gratuita 14 días
    const { data: planFree } = await supabase
      .from('planes').select('id').eq('tipo', 'free').single()

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
    navigate('/panel')
  }

  // ── Pantalla: email enviado ───────────────────────────────────────────────
  if (enviado) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Revisa tu email</h2>
        <p className="text-gray-500 text-sm mb-2">
          Enviamos un link de confirmación a <b>{email}</b>
        </p>
        <p className="text-gray-400 text-xs">
          Haz clic en el link del email para activar tu cuenta y acceder a tu panel.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Crea tu agenda</h1>
          <p className="text-gray-500 text-sm mt-1">14 días gratis, sin tarjeta de crédito</p>
        </div>

        {/* Steps indicator */}
        <div className="flex gap-2 mb-6">
          {['Tu negocio','Tu cuenta'].map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1 rounded-full mb-1 transition-colors ${step > i ? 'bg-blue-600' : step === i+1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
              <p className={`text-xs ${step === i+1 ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>{label}</p>
            </div>
          ))}
        </div>

        <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setError(''); setStep(2) } : registrar}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">

          {/* ── Paso 1: datos del negocio ────────────────────── */}
          {step === 1 && (<>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nombre del negocio *</label>
              <input
                value={nombre}
                onChange={e => campoNombre(e.target.value)}
                placeholder="Consultorio Psicología Integral"
                required
                className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900
                           focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Tipo de negocio *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {VERTICALES.map(v => (
                  <label key={v.key} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors text-sm ${
                    vertical === v.key
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                    <input type="radio" name="vertical" value={v.key} checked={vertical === v.key}
                      onChange={() => setVertical(v.key)} className="sr-only" />
                    {v.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Ciudad</label>
                <input
                  value={ciudad}
                  onChange={e => setCiudad(e.target.value)}
                  placeholder="Cali"
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900
                             focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">WhatsApp</label>
                <input
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="3001234567"
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900
                             focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                URL de tu agenda pública
              </label>
              <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">agendas.pro/agenda/</span>
                <input
                  value={slug}
                  onChange={e => { setSlugManual(true); setSlug(slugify(e.target.value)) }}
                  placeholder="mi-negocio"
                  className="flex-1 bg-transparent text-sm text-gray-900 font-mono focus:outline-none min-w-0"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

            <button
              type="submit"
              disabled={!nombre.trim() || !slug.trim()}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold
                         text-sm transition-colors disabled:opacity-50"
            >
              Continuar
            </button>
          </>)}

          {/* ── Paso 2: cuenta ───────────────────────────────── */}
          {step === 2 && (<>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tu nombre *</label>
              <input
                value={nombreOwner}
                onChange={e => setNombreOwner(e.target.value)}
                placeholder="Tu nombre completo"
                required
                autoFocus
                className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900
                           focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900
                           focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Contraseña *</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900
                           focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Repetir contraseña *</label>
              <input
                type="password"
                value={password2}
                onChange={e => setPassword2(e.target.value)}
                placeholder="Repite la contraseña"
                required
                className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900
                           focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-start gap-2.5 py-1">
              <input
                type="checkbox"
                id="acepta-politicas"
                required
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="acepta-politicas" className="text-xs text-gray-500 select-none cursor-pointer leading-tight">
                Acepto los <a href="/terminos.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">Términos de Servicio</a> y la <a href="https://www.iubenda.com/privacy-policy/XXXXXXXX" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">Política de Privacidad</a>.
              </label>
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

            <button
              type="submit"
              disabled={saving || !email || !password || !nombreOwner}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold
                         text-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Creando tu agenda...' : 'Crear cuenta gratis'}
            </button>

            <button type="button" onClick={() => { setStep(1); setError('') }}
              className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1">
              ← Volver
            </button>
          </>)}
        </form>

        <p className="text-center text-sm text-gray-400 mt-4">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">Inicia sesión</Link>
        </p>

        <div className="text-center text-xs text-gray-400 dark:text-slate-500 mt-6 space-x-3">
          <a href="/terminos.html" target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-gray-600">Términos de Servicio</a>
          <span>•</span>
          <a href="https://www.iubenda.com/privacy-policy/XXXXXXXX" target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-gray-600">Política de Privacidad</a>
        </div>
      </div>
    </div>
  )
}
