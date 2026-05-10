import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = 'https://unpxoamfyushsbyyziyn.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucHhvYW1meXVzaHNieXl6aXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTUyOTQsImV4cCI6MjA5MjU5MTI5NH0.MvtKlr9QDDc2sgUz6u424eAFiPFEcZvW5xTKbV8STV0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
})

// Cliente sin sesión para RPCs que requieren rol anon (salon_admin_*)
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
