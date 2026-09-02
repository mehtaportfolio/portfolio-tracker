import { createClient } from '@supabase/supabase-js'

// ✅ Read from environment variables exposed by Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check your .env file for the frontend.');
}

// ✅ Use memory storage to prevent session persistence across page refreshes
// This ensures users see the login screen on every app restart (npm start)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: (key) => null,
      setItem: () => {},
      removeItem: () => {},
    },
    autoRefreshToken: false,
    persistSession: false,
  },
})
