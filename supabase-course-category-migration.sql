-- Course Format + Category migration
-- Run once in the Supabase SQL editor.

-- UP
-- 1. New Category dimension (IELTS / GE / BE / ESP / Other), optional.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_category text;

-- 2. Format rename: existing "Individual" courses become "1-on-1"
--    (matches the new Format option set: Group / 1-on-1 / Small Group / Self Study).
UPDATE courses SET course_type = '1-on-1' WHERE course_type = 'Individual';

-- DOWN (rollback)
-- UPDATE courses SET course_type = 'Individual' WHERE course_type = '1-on-1';
-- ALTER TABLE courses DROP COLUMN IF EXISTS course_category;
