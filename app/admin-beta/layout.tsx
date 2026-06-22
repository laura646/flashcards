import AdminSidebar from '@/components/AdminSidebar'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import WhatsNewBanner from '@/components/WhatsNewBanner'

// Shared chrome for every /admin-beta/* route (the 10B redesign). Mirrors
// app/admin/layout.tsx so the teacher menu (AdminSidebar) persists across the
// new pages. AdminSidebar now links to /admin-beta/* (the switch), so teachers
// navigate entirely within the redesigned experience.
export default function AdminBetaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface md:flex md:items-start">
      <AdminSidebar />
      <main className="min-w-0 flex-1">
        <ConfirmProvider>
          {/* Top padding on mobile to clear the hamburger button */}
          <div className="pt-12 md:pt-0">
            <WhatsNewBanner />
            {children}
          </div>
        </ConfirmProvider>
      </main>
    </div>
  )
}
