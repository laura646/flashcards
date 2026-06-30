-- ═══════════════════════════════════════════════════════════════
-- Reports — group-level manual progress %
-- "Where the group is" along the Current → Goal journey, set by hand.
-- Run in Supabase SQL editor. Safe to run more than once. Read fail-safe.
-- ═══════════════════════════════════════════════════════════════

-- UP
alter table public.courses add column if not exists group_progress_pct integer;

-- DOWN
-- alter table public.courses drop column if exists group_progress_pct;
