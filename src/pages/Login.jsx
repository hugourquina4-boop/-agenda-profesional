import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (authError) { setError(authError.message); setLoading(false); return }

    const userId = data.user.id

    // ¿Superadmin?
    const { data: sa } = await supabase
      .from('superadmins').select('id').eq('id', userId).maybeSingle()

    if (sa) { navigate('/superadmin', { replace: true }); return }

    // ¿Tiene tenant?
    const { data: ut } = await supabase
      .from('usuarios_tenant').select('tenant_id').eq('user_id', userId).eq('activo', true).maybeSingle()

    if (ut) { navigate('/panel', { replace: true }); return }

    setError('Tu cuenta no tiene acceso a ningún panel.')
    await supabase.auth.signOut()
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agendas Pro</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Ingresa a tu panel</p>
        </div>

        <form onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com" required
              className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                         rounded-xl px-4 py-2.5 text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-slate-500
                         focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Contraseña</label>
            <input
              type="password" value={pass} onChange={e => setPass(e.target.value)}
              placeholder="••••••••" required
              className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                         rounded-xl px-4 py-2.5 text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-slate-500
                         focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-2.5">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                       text-white font-semibold rounded-xl py-2.5 transition-colors text-sm">
            {loading ? 'Entrando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 dark:text-slate-500 mt-4">
          ¿Eres nuevo?{' '}
          <Link to="/registro" className="text-blue-600 hover:underline font-medium">Crea tu agenda gratis</Link>
        </p>

        <div className="text-center text-xs text-gray-400 dark:text-slate-400 mt-6 space-x-3">
          <a href="/terminos.html" target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-blue-600 dark:hover:text-blue-400">Términos de Servicio</a>
          <span>•</span>
          <a href="https://www.iubenda.com/privacy-policy/XXXXXXXX" target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-blue-600 dark:hover:text-blue-400">Política de Privacidad</a>
        </div>
      </div>
    </div>
  )
}
