import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client. Uses the service role key which bypasses RLS.
// NEVER import this file from client components — it will leak the service key.
// All API routes run server-side, so this is safe for our architecture.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// The service-role key bypasses RLS and is what all our app-layer authorization
// assumes. If it's missing in PRODUCTION, fail loudly rather than silently
// falling back to the PUBLIC anon key — with permissive RLS that would hand the
// whole database to anyone holding the (public) anon key. Local/dev may fall
// back with a warning so development still works.
if (!serviceKey) {
  // VERCEL_ENV is set on every Vercel deployment (production AND preview) but
  // NOT on a local `next dev`/`next build`. So this fails loudly on any deployed
  // environment missing the key, while local dev still falls back with a warning.
  if (process.env.VERCEL_ENV) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required on Vercel (production and preview)')
  }
  console.warn(
    '[supabase] SUPABASE_SERVICE_ROLE_KEY not set — falling back to the public anon key (local dev only).',
  )
}

const supabaseServiceKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
