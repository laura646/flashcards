-- Daily AI vocab-generation quota.
-- Tracks how many words each student has AI-generated per (UTC) day, so the
-- /api/vocab-srs `generate` action can enforce a durable daily cap (the
-- in-memory rate-limiter resets on every serverless cold start and can't).
-- The API fails OPEN if this table is absent, so running it simply switches
-- the daily limit on.

-- UP
create table if not exists vocab_ai_usage (
  user_email text    not null,
  used_on    date    not null,
  count      integer not null default 0,
  primary key (user_email, used_on)
);

-- DOWN
-- drop table if exists vocab_ai_usage;
