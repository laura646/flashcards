-- ============================================
-- Admin Features: Student Management
-- Run this in Supabase SQL Editor
-- ============================================

-- Add blocked and notes columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Create student_assignments table for content assignment
CREATE TABLE IF NOT EXISTS student_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  set_name TEXT NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_email, set_name)
);

-- Enable RLS
ALTER TABLE student_assignments ENABLE ROW LEVEL SECURITY;

-- Allow all operations (same pattern as existing tables)
CREATE POLICY "Allow all on student_assignments"
  ON student_assignments FOR ALL
  USING (true)
  WITH CHECK (true);
