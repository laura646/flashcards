-- ═══════════════════════════════════════════════════════════════
-- Editor permission — lets designated teachers edit ANY shared
-- School Library lesson (not just ones they created).
-- Run in Supabase SQL editor. Safe to run more than once.
-- The app reads this FAIL-SAFE (missing column ⇒ treated as false),
-- so nothing breaks before this runs — the permission just isn't
-- grantable until the column exists.
-- ═══════════════════════════════════════════════════════════════

-- UP
alter table public.users
  add column if not exists is_editor boolean not null default false;

-- DOWN (rollback)
-- alter table public.users drop column if exists is_editor;
