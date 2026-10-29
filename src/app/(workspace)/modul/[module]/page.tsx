import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Cable, ShieldCheck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getModule } from "@/lib/modules"

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>
}) {
  const { module: key } = await params
  const moduleDefinition = getModule(key)
  if (!moduleDefinition) notFound()
  const Icon = moduleDefinition.icon

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard"><ArrowLeft size={15} /> Kembali ke ringkasan</Link>
      </Button>
      <Card className="overflow-hidden">
        <div className="border-b border-line bg-white p-7 md:p-9">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brand-light text-brand">
            <Icon size={23} />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-brand">Modul perusahaan</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">{moduleDefinition.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{moduleDefinition.description}</p>
        </div>
        <div className="grid gap-4 bg-canvas p-6 md:grid-cols-2 md:p-8">
          <div className="rounded-lg border border-line bg-white p-5">
            <Cable size={19} className="text-brand" />
            <h2 className="mt-4 text-sm font-semibold text-ink">Sumber sistem</h2>
            <p className="mt-1 text-sm text-muted">{moduleDefinition.source}</p>
            <p className="mt-3 text-xs leading-5 text-muted">
              Modul sumber tetap berjalan terpisah sampai kontrak API, skema identitas, dan pemetaan
              organisasi disetujui.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-white p-5">
            <ShieldCheck size={19} className="text-brand" />
            <h2 className="mt-4 text-sm font-semibold text-ink">Status akses & kontrol</h2>
            <p className="mt-1 text-sm text-muted">Menunggu integrasi yang diaudit</p>
            <p className="mt-3 text-xs leading-5 text-muted">
              Kredensial layanan tidak disimpan di browser atau tabel konfigurasi. Akses akan
              dibatasi di server dan Supabase Row Level Security.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
