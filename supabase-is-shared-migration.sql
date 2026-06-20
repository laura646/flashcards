-- School Library (Phase 2): shared content flag on lessons
-- Run this in Supabase SQL Editor BEFORE deploying the School Library code.
--
-- Model recap:
--   created_by   = owner of the content (a lesson row)
--   is_template  = reusable template flag (My Library / template builder)
--   is_shared    = NEW: marks content shared to the whole school. Any trainer
--                  can share THEIR OWN content (created_by = me) by setting this
--                  true. The School Library page lists is_shared = true rows.
--
-- Existing templates are back-filled as shared so the current flat template
-- library (which became the School Library) keeps showing the same content.

-- UP
ALTER TABLE lessons ADD COLUMN is_shared boolean NOT NULL DEFAULT false;
UPDATE lessons SET is_shared = true WHERE is_template = true;
CREATE INDEX idx_lessons_is_shared ON lessons (is_shared) WHERE is_shared = true;

-- DOWN
-- DROP INDEX idx_lessons_is_shared;
-- ALTER TABLE lessons DROP COLUMN is_shared;
