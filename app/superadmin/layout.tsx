import AdminSidebar from '@/components/AdminSidebar'
import { ConfirmProvider } from '@/components/ConfirmDialog'

// Same chrome as /admin — Superadmin reuses the sidebar (and gets the
// extra Superadmin nav item shown automatically based on session role).
export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <AdminSidebar />
      <main className="md:pl-[240px]">
        <ConfirmProvider>
          <div className="pt-12 md:pt-0">{children}</div>
        </ConfirmProvider>
      </main>
    </div>
  )
}
