import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setSuser]         = useState(undefined) // undefined = cargando
  const [isSuperadmin, setIsSuper] = useState(false)
  const [loading, setLoading]    = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSuser(session?.user ?? null)
      if (session?.user) checkSuperadmin(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSuser(session?.user ?? null)
      if (session?.user) {
        setLoading(true)
        checkSuperadmin(session.user.id)
      } else {
        setIsSuper(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function checkSuperadmin(uid) {
    const { data } = await supabase
      .from('superadmins')
      .select('id')
      .eq('id', uid)
      .maybeSingle()
    setIsSuper(!!data)
    setLoading(false)
  }

  async function login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  return { user, isSuperadmin, loading, login, logout }
}
