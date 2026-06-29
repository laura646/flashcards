-- ═══════════════════════════════════════════════════════════════
-- Reports P4 — CEFR current/goal + manual course progress
-- Run in Supabase SQL editor. Safe to run more than once.
-- The app reads these columns FAIL-SAFE, so reports keep working even
-- before this runs (current/goal show "—", progress shows "Not set").
-- ═══════════════════════════════════════════════════════════════

-- UP
alter table public.courses
  add column if not exists current_level text,
  add column if not exists goal_level text;

alter table public.course_students
  add column if not exists course_progress_pct integer,
  add column if not exists course_progress_updated_at timestamptz;

-- DOWN (rollback)
-- alter table public.courses
--   drop column if exists current_level,
--   drop column if exists goal_level;
-- alter table public.course_students
--   drop column if exists course_progress_pct,
--   drop column if exists course_progress_updated_at;
