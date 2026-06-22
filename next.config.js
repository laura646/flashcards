/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // The teacher/admin redesign was promoted from /admin-beta/* to the
      // canonical /admin/*. Keep old /admin-beta links + bookmarks working.
      {
        source: '/admin-beta/:path*',
        destination: '/admin/:path*',
        permanent: true,
      },
    ]
  },
}
module.exports = nextConfig
