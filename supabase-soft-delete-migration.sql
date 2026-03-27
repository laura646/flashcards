-- Soft delete for course_students: add removed_at column
-- Run this in Supabase SQL Editor BEFORE deploying

-- UP: Add removed_at column (null = active, timestamp = soft-deleted)
ALTER TABLE course_students ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for fast filtering of active students
CREATE INDEX IF NOT EXISTS idx_course_students_active ON course_students (course_id) WHERE removed_at IS NULL;
