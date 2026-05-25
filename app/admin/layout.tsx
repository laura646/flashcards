import AdminSidebar from '@/components/AdminSidebar'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import WhatsNewBanner from '@/components/WhatsNewBanner'

// Shared chrome for every /admin/* route. The sidebar persists across
// navigation (no flicker between pages). On mobile, the sidebar becomes
// a hamburger-triggered drawer instead.
//
// Wrapped in ConfirmProvider so any admin page can call useConfirm()
// for branded confirmation dialogs (instead of native window.confirm).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <AdminSidebar />
      <main className="md:pl-[240px]">
        <ConfirmProvider>
          {/* Page content gets a top padding on mobile to clear the hamburger button */}
          <div className="pt-12 md:pt-0">
            <WhatsNewBanner />
            {children}
          </div>
        </ConfirmProvider>
      </main>
    </div>
  )
}
