import { redirect } from 'next/navigation'

// /admin has no dashboard of its own — send teachers to My Courses.
export default function AdminBetaIndex() {
  redirect('/admin/courses')
}
