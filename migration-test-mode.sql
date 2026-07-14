-- Exam mode for test lessons (mid_course_test / final_test / review_test).
--
-- Adds per-test settings on lessons (teacher-configured in the editor):
--   time_limit_minutes  — countdown length; timer starts at "Agree & Start"
--   test_reveal_answers — after submit, also show the correct answer for
--                         missed questions (off = right/wrong only, so the
--                         answer key can't circulate between cohorts)
--   test_rules_lang     — language of the rules popup & disclaimers
--                         ('hy' Armenian default, 'en' English for higher levels)
--
-- test_sessions: one row per (lesson, student) attempt. The DEADLINE lives
-- here — the server rejects answer saves after it, and the cron sweeper
-- auto-submits expired sessions even if the student never returns.
--
-- test_session_answers: per-exercise results saved continuously DURING the
-- attempt (score/total/per-question booleans, clamped server-side). Finalize
-- aggregates these into the regular `progress` rows so accuracy and reports
-- pick the test up automatically.

-- UP
alter table lessons add column if not exists time_limit_minutes integer;
alter table lessons add column if not exists test_reveal_answers boolean not null default true;
alter table lessons add column if not exists test_rules_lang text not null default 'hy';

create table if not exists test_sessions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null,
  user_email text not null,
  started_at timestamptz not null default now(),
  deadline timestamptz not null,
  submitted_at timestamptz,
  auto_submitted boolean not null default false,
  score integer,
  total integer,
  unique (lesson_id, user_email)
);

-- The sweeper polls for open, expired sessions.
create index if not exists test_sessions_open_idx
  on test_sessions (deadline) where submitted_at is null;

create table if not exists test_session_answers (
  session_id uuid not null,
  exercise_id uuid not null,
  score integer not null default 0,
  total integer not null default 0,
  per_question_results jsonb,
  updated_at timestamptz not null default now(),
  primary key (session_id, exercise_id)
);

-- DOWN
-- drop table if exists test_session_answers;
-- drop table if exists test_sessions;
-- alter table lessons drop column if exists test_rules_lang;
-- alter table lessons drop column if exists test_reveal_answers;
-- alter table lessons drop column if exists time_limit_minutes;
