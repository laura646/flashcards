-- ════════════════════════════════════════════════════════════════════
-- AI summaries cache: on-demand, cached teacher-facing student summaries
-- ════════════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL editor. Safe to re-run (uses IF NOT EXISTS).
--
-- Creates:
--   - student_ai_summaries table: one cached AI summary per student per
--     course. The teacher Reports view generates a summary on demand
--     (POST /api/student-summary) and we upsert it here; reopening the
--     report reads the cached row (GET /api/student-summary) for free.
--     One row per (student_email, course_id) — regenerating overwrites.
-- ════════════════════════════════════════════════════════════════════

-- ─── UP ───

create table if not exists public.student_ai_summaries (
  id              uuid primary key default gen_random_uuid(),
  student_email   text not null,
  course_id       uuid not null references public.courses(id) on delete cascade,
  summary         text not null,
  time_range_days integer not null,
  generated_by    text not null,
  generated_at    timestamptz not null default now(),
  unique (student_email, course_id)
);

alter table public.student_ai_summaries enable row level security;

-- ════════════════════════════════════════════════════════════════════
-- DOWN (only if you need to roll back — DO NOT RUN unless reverting)
-- ════════════════════════════════════════════════════════════════════
--
-- drop table if exists public.student_ai_summaries;
