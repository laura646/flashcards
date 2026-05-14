import AdminSidebar from '@/components/AdminSidebar'

// Shared chrome for every /admin/* route. The sidebar persists across
// navigation (no flicker between pages). On mobile, the sidebar becomes
// a hamburger-triggered drawer instead.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <AdminSidebar />
      <main className="md:pl-[240px]">
        {/* Page content gets a top padding on mobile to clear the hamburger button */}
        <div className="pt-12 md:pt-0">{children}</div>
      </main>
    </div>
  )
}
