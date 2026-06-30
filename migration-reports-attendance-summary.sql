-- ═══════════════════════════════════════════════════════════════
-- Reports — manual attendance summary (bulk backfill)
-- Run in Supabase SQL editor. Safe to run more than once.
-- The app reads these columns FAIL-SAFE (separate best-effort query), so
-- reports keep working even before this runs (attendance falls back to the
-- live session marks). The bulk-backfill WRITE needs these columns, so run
-- this before using the "Bulk attendance backfill" button.
-- ═══════════════════════════════════════════════════════════════

-- UP
alter table public.course_students
  add column if not exists att_present    integer,
  add column if not exists att_late       integer,
  add column if not exists att_absent     integer,
  add column if not exists att_excused    integer,
  add column if not exists att_total      integer,
  add column if not exists att_updated_at timestamptz,
  add column if not exists att_updated_by text;

-- DOWN (rollback)
-- alter table public.course_students
--   drop column if exists att_present,
--   drop column if exists att_late,
--   drop column if exists att_absent,
--   drop column if exists att_excused,
--   drop column if exists att_total,
--   drop column if exists att_updated_at,
--   drop column if exists att_updated_by;
