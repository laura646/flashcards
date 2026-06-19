import type { MetadataRoute } from 'next'

// Keep internal / prototype surfaces out of search results. This only guides
// compliant crawlers — it is NOT access control (those routes are role-gated
// server-side). Post-launch cleanup: delete the *-preview scratch routes.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: ['/admin', '/admin-beta', '/admin-preview', '/student-ui-preview', '/superadmin', '/api'],
    },
  }
}
