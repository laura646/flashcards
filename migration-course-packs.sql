-- Course Packs: ready-made curricula assembled from School Library lessons.
--   course_packs       — the pack + its About info (description, time-frame,
--                        audience, prerequisites, outcomes, materials).
--                        Authoring is superadmin/editor-only (enforced in API).
--   course_pack_items  — ordered lessons of a pack.
--   pack_comments      — teacher comment thread per pack (like deck_comments).
-- Lessons gain syllabus_order + source_pack_id: set on import so the course
-- Syllabus tab (next phase) can show pack lessons in teaching order.
-- API reads fail OPEN where sensible; pack creation/import REQUIRE these tables.

-- UP
create table if not exists course_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  time_frame text,
  level text,
  audience text,
  prerequisites text,
  outcomes text,
  materials text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists course_pack_items (
  pack_id uuid not null,
  lesson_id uuid not null,
  order_index integer not null default 0,
  primary key (pack_id, lesson_id)
);

create table if not exists pack_comments (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null,
  author_email text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists pack_comments_pack_idx on pack_comments (pack_id, created_at);

alter table lessons add column if not exists syllabus_order integer;
alter table lessons add column if not exists source_pack_id uuid;

-- DOWN
-- alter table lessons drop column if exists source_pack_id;
-- alter table lessons drop column if exists syllabus_order;
-- drop table if exists pack_comments;
-- drop table if exists course_pack_items;
-- drop table if exists course_packs;
