-- Per-student word removals.
-- When a student removes a word, its vocab_srs row is hard-deleted. For a
-- lesson-derived word that isn't enough — the next `sync` would re-import it
-- from the lesson. This table records the removal (by the sync dedup key, a
-- lowercased word) so `sync` skips it and the My Vocabulary list hides it.
-- The API fails OPEN if this table is absent, so running it simply makes
-- removals of lesson words stick.

-- UP
create table if not exists vocab_removed (
  user_email text not null,
  word       text not null,
  primary key (user_email, word)
);

-- DOWN
-- drop table if exists vocab_removed;
