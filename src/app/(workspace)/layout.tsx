import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { requireWorkspace } from "@/lib/auth/context"

export const dynamic = "force-dynamic"

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { organizationName, role } = await requireWorkspace()

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-[252px]">
        <Topbar organizationName={organizationName} role={role} />
        <MobileNav />
        <main className="mx-auto max-w-[1500px] px-5 py-7 md:px-8 md:py-9">
          {children}
        </main>
      </div>
    </div>
  )
}
