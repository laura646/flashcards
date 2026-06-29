-- ═══════════════════════════════════════════════════════════════
-- Reports P5 — manual test entry (offline / written / oral tests)
-- Run in Supabase SQL editor. Safe to run more than once.
-- Reports read this FAIL-SAFE, so they keep working before this runs
-- (the Tests card just shows platform tests + no manual ones yet).
-- ═══════════════════════════════════════════════════════════════

-- UP
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  course_id text not null,
  student_email text not null,
  name text not null,
  test_date date,
  score numeric,
  max_score numeric default 100,
  source text default 'Written',
  created_by text,
  created_at timestamptz default now()
);
create index if not exists assessments_course_student_idx
  on public.assessments (course_id, student_email);

-- DOWN (rollback)
-- drop table if exists public.assessments;
