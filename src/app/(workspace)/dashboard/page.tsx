import Link from "next/link"
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  CircleHelp,
  ShieldCheck,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { modules } from "@/lib/modules"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-brand">Workspace perusahaan</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Ringkasan terpadu</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Satu ruang kerja untuk operasi, keuangan, SDM, dan kepatuhan. Angka lintas modul akan
            ditampilkan setelah sumber data dan aksesnya disambungkan.
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/approvals"><CheckCheck size={16} /> Buka persetujuan</Link>
        </Button>
      </section>

      <Card className="grid gap-0 overflow-hidden md:grid-cols-[1fr_auto]">
        <div className="p-6 md:p-7">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ShieldCheck size={18} className="text-brand" />
            Check and balance aktif sebagai fondasi
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Data keuangan, SDM, dan operasional tidak dicampur tanpa batas. Persetujuan dipisahkan
            dari pengaju, akses mengikuti organisasi dan peran, dan keputusan penting disiapkan
            untuk jejak audit.
          </p>
        </div>
        <div className="flex items-center border-t border-line bg-canvas px-6 py-5 md:border-l md:border-t-0 md:px-7">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Status integrasi</p>
            <p className="mt-1 text-lg font-bold text-ink">Belum tersambung</p>
            <p className="mt-1 text-xs text-muted">Tidak ada angka dummy ditampilkan</p>
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Modul perusahaan</h2>
            <p className="mt-1 text-sm text-muted">Batas modul jelas, ringkasan akan mengikuti akses Anda.</p>
          </div>
          <Link href="/modul/crm" className="hidden items-center gap-1 text-sm font-semibold text-brand sm:inline-flex">
            Jelajahi modul <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ href, name, description, source, icon: Icon, status }) => (
            <Link key={href} href={href} className="group">
              <Card className="h-full p-5 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-brand/30 group-hover:shadow-md">
                <div className="flex items-start justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-brand-light text-brand">
                    <Icon size={19} />
                  </span>
                  <ArrowUpRight size={17} className="text-muted transition group-hover:text-brand" />
                </div>
                <h3 className="mt-5 text-base font-semibold text-ink">{name}</h3>
                <p className="mt-2 min-h-10 text-sm leading-5 text-muted">{description}</p>
                <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                  <span className="text-xs text-muted">Sumber: {source}</span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
                    {status === "foundation" ? "Fondasi" : "Menunggu integrasi"}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <CircleHelp size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-semibold text-ink">Belum ada data lintas sistem?</p>
            <p className="mt-1 text-sm text-muted">Mulai dengan menyiapkan migration dan mendaftarkan organisasi.</p>
          </div>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/setup">Lihat setup <ArrowRight size={15} /></Link>
        </Button>
      </Card>
    </div>
  )
}
