import { Card } from "@/components/ui/card"
import { requireWorkspace } from "@/lib/auth/context"

export default async function Page() {
  await requireWorkspace()
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-brand">Pengajuan</p>
        <h1 className="mt-2 text-3xl font-bold">Perjalanan dinas</h1>
      </header>
      <Card className="space-y-2 p-6">
        <h2 className="font-semibold">Pengajuan perjalanan dinas segera tersedia</h2>
        <p className="text-sm leading-6 text-muted">Menu sudah disiapkan. Formulir akan tersedia setelah ketentuan perjalanan, biaya dan alur persetujuan ditentukan.</p>
        <p className="text-sm text-muted">Belum ada pengajuan perjalanan dinas yang dapat dikirim melalui halaman ini.</p>
      </Card>
    </div>
  )
}
