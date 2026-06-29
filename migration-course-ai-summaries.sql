-- Course-level AI overview cache (one row per course).
-- Optional: /api/course-summary is fail-safe and works without this table
-- (it just regenerates each time instead of serving a cached overview).
-- Run in the Supabase SQL editor.

-- UP
create table if not exists public.course_ai_summaries (
  course_id        text primary key,
  summary          text not null,
  needs            text,
  ready            text,
  time_range_days  int  not null default 0,
  generated_by     text,
  generated_at     timestamptz not null default now()
);

-- DOWN
-- drop table if exists public.course_ai_summaries;
