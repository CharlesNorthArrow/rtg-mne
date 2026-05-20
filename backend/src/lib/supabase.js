import { createClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS for admin write operations
// NEVER expose SUPABASE_SERVICE_KEY to the frontend
export const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Public client — respects RLS, for read operations
export const publicSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)
