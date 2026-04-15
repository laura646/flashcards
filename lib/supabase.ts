import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client. Uses the service role key which bypasses RLS.
// NEVER import this file from client components — it will leak the service key.
// All API routes run server-side, so this is safe for our architecture.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // fallback during transition

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
