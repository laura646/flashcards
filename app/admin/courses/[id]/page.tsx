import { redirect } from 'next/navigation'

// Deep-link target for a specific course's detail view.
//
// For v1, this redirects to /admin?courseDetail=<id> where the existing
// course-detail view lives inside the legacy /admin tabbed page. This
// keeps the URL bookmarkable while we defer the full extraction of the
// course-detail view into a standalone page (~265 lines of JSX +
// modals + state). That extraction is queued for a follow-up release.
//
// The redirect happens server-side (307) so it's instant — no client
// flicker, no extra round-trip beyond what a regular route would do.
export default async function CourseDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/admin?courseDetail=${encodeURIComponent(id)}`)
}
