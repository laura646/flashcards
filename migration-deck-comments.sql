-- Comments on Live Session Content decks (teacher name + date + text),
-- so teachers can flag typos/mistakes on shared class materials.
-- Keyed by the deck's lesson id. The API fails OPEN on reads if this
-- table is absent (comments simply show as none until the SQL is run).

-- UP
create table if not exists deck_comments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null,
  author_email text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists deck_comments_lesson_idx on deck_comments (lesson_id, created_at);

-- DOWN
-- drop table if exists deck_comments;
