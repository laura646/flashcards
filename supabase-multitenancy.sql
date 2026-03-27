-- ============================================
-- Multi-Tenancy: Courses, Roles, Teachers
-- Run this in Supabase SQL Editor
-- ============================================

-- ── 1. Add role column to users ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';

-- Set Laura as superadmin
UPDATE users SET role = 'superadmin' WHERE email = 'laura@englishwithlaura.com';

-- ── 2. Create courses table ──
CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  invite_code TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 3. Course-teacher join table (many-to-many) ──
CREATE TABLE IF NOT EXISTS course_teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  teacher_email TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, teacher_email)
);

-- ── 4. Course-student join table (many-to-many) ──
CREATE TABLE IF NOT EXISTS course_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_email TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, student_email)
);

-- ── 5. Add course_id to lessons ──
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id);

-- ── 6. Enable RLS with permissive policies (app-layer scoping for now) ──
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on courses" ON courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on course_teachers" ON course_teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on course_students" ON course_students FOR ALL USING (true) WITH CHECK (true);

-- ── 7. Seed: create "Benivo Elementary" course ──
INSERT INTO courses (name, description, invite_code, created_by)
VALUES ('Benivo Elementary', 'English course for Benivo team', 'BENIVO2024', 'laura@englishwithlaura.com');

-- ── 8. Assign Laura as teacher of that course (so she can manage it) ──
INSERT INTO course_teachers (course_id, teacher_email)
SELECT id, 'laura@englishwithlaura.com' FROM courses WHERE invite_code = 'BENIVO2024';

-- ── 9. Backfill: assign all existing lessons to that course ──
UPDATE lessons SET course_id = (SELECT id FROM courses WHERE invite_code = 'BENIVO2024')
WHERE course_id IS NULL;

-- ── 10. Enroll all existing students into that course ──
INSERT INTO course_students (course_id, student_email)
SELECT c.id, u.email FROM courses c, users u
WHERE c.invite_code = 'BENIVO2024'
  AND u.email != 'laura@englishwithlaura.com'
  AND u.role = 'student'
ON CONFLICT (course_id, student_email) DO NOTHING;
