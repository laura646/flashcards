import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { supabase } from './supabase'

export type UserRole = 'superadmin' | 'teacher' | 'student' | 'hr'

/**
 * Get the current user's session with role info.
 * Returns null if not authenticated.
 */
export async function getAuthUser(): Promise<{
  email: string
  name: string
  role: UserRole
} | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return {
    email: session.user.email,
    name: session.user.name || '',
    role: session.user.role || 'student',
  }
}

/**
 * Require that the current user has one of the specified roles.
 * Throws a structured error object if not authorized.
 */
export async function requireRole(
  ...allowedRoles: UserRole[]
): Promise<{ email: string; name: string; role: UserRole }> {
  const user = await getAuthUser()
  if (!user) {
    throw { status: 401, message: 'Unauthorized' }
  }
  if (!allowedRoles.includes(user.role)) {
    throw { status: 403, message: 'Forbidden' }
  }
  return user
}

/**
 * Get the course IDs that a teacher (or superadmin) can manage.
 * Superadmin gets ALL courses.
 */
export async function getTeacherCourseIds(
  email: string,
  role: UserRole
): Promise<string[]> {
  if (role === 'superadmin') {
    const { data } = await supabase.from('courses').select('id')
    return (data || []).map((c: { id: string }) => c.id)
  }

  // HR is assigned to courses via the read-only course_hr mapping.
  if (role === 'hr') {
    const { data } = await supabase
      .from('course_hr')
      .select('course_id')
      .eq('hr_email', email)
    return (data || []).map((c: { course_id: string }) => c.course_id)
  }

  const { data } = await supabase
    .from('course_teachers')
    .select('course_id')
    .eq('teacher_email', email)

  return (data || []).map((c: { course_id: string }) => c.course_id)
}

/**
 * Get the course IDs a student is enrolled in.
 */
export async function getStudentCourseIds(email: string): Promise<string[]> {
  const { data } = await supabase
    .from('course_students')
    .select('course_id')
    .eq('student_email', email)
    .is('removed_at', null)

  return (data || []).map((c: { course_id: string }) => c.course_id)
}

/**
 * Check if a user has access to a specific course.
 */
export async function hasAccessToCourse(
  email: string,
  role: UserRole,
  courseId: string
): Promise<boolean> {
  if (role === 'superadmin') return true

  if (role === 'teacher') {
    const { data } = await supabase
      .from('course_teachers')
      .select('id')
      .eq('course_id', courseId)
      .eq('teacher_email', email)
      .single()
    return !!data
  }

  // HR can read a course only if it's in their course_hr assignment.
  if (role === 'hr') {
    const { data } = await supabase
      .from('course_hr')
      .select('id')
      .eq('course_id', courseId)
      .eq('hr_email', email)
      .maybeSingle()
    return !!data
  }

  // student
  const { data } = await supabase
    .from('course_students')
    .select('id')
    .eq('course_id', courseId)
    .eq('student_email', email)
    .is('removed_at', null)
    .single()
  return !!data
}

/**
 * Get the course IDs that are accessible to the user (based on role).
 */
export async function getAccessibleCourseIds(
  email: string,
  role: UserRole
): Promise<string[]> {
  if (role === 'superadmin' || role === 'teacher' || role === 'hr') {
    return getTeacherCourseIds(email, role)
  }
  return getStudentCourseIds(email)
}

/**
 * Get the teacher emails for a given course (for notifications).
 */
export async function getCourseTeachers(courseId: string): Promise<string[]> {
  const { data } = await supabase
    .from('course_teachers')
    .select('teacher_email')
    .eq('course_id', courseId)

  return (data || []).map((t: { teacher_email: string }) => t.teacher_email)
}

/**
 * Editor permission — a teacher flagged is_editor may edit ANY shared School
 * Library lesson (not just ones they created). Fail-safe: if the column
 * doesn't exist yet (pre-migration) or the lookup errors, returns false so
 * the permission is never granted by accident.
 */
export async function isEditor(email: string): Promise<boolean> {
  if (!email) return false
  try {
    const { data, error } = await supabase.from('users').select('is_editor').eq('email', email).single()
    if (error) return false
    return data?.is_editor === true
  } catch {
    return false
  }
}
