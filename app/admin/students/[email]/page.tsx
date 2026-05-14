import { redirect } from 'next/navigation'

// Deep-link target for a specific student's profile.
//
// For v1, this redirects to /admin?studentDetail=<email> where the
// existing student-detail view lives inside the legacy /admin tabbed
// page. This keeps the URL bookmarkable while we defer the full
// extraction of the student-detail view (~250 lines including profile
// editing, notes, progress, reminder modal) into a standalone page.
// That extraction is queued for a follow-up release.
export default async function StudentDetailRedirect({
  params,
}: {
  params: Promise<{ email: string }>
}) {
  const { email } = await params
  // The dynamic segment is URL-decoded by Next so we re-encode for the
  // query-string target. view=students also added so the sidebar
  // highlights the My Students item.
  redirect(`/admin?view=students&studentDetail=${encodeURIComponent(email)}`)
}
