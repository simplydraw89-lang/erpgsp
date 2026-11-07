import { requireWorkspace } from "@/lib/auth/context"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { SalesMenu } from "@/components/sales/sales-menu"
import { SpkForm } from "@/components/sales/spk-form"
import type { BusinessUnit, SalesDocument } from "@/lib/procurement-ui"

export default async function NewSpkPage({ searchParams }: { searchParams: Promise<{ sph?: string }> }) {
  const { sph } = await searchParams
  const w = await requireWorkspace()

  const [units, sphResult] = await Promise.all([
    w.supabase
      .from("business_units")
      .select("id,code,name,kind")
      .eq("organization_id", w.organizationId)
      .in("kind", ["branch", "center"])
      .order("code"),
    w.supabase
      .from("sales_documents")
      .select("*")
      .eq("organization_id", w.organizationId)
      .eq("kind", "sph")
      .in("status", ["ready", "accepted"])
      .order("sph_number", { ascending: false })
      .limit(200),
  ])

  const branches = (units.data ?? []) as BusinessUnit[]
  const centralDirector = w.workAssignments.some(
    job => !job.branch_id && ["president", "finance_director", "technical_director"].includes(job.job_role)
  )
  const writableBranches =
    w.actorRole === "owner" || centralDirector
      ? branches
      : branches.filter(branch => w.workAssignments.some(job => job.branch_id === branch.id))

  const documents = (sphResult.data ?? []) as SalesDocument[]

  return (
    <div className="space-y-6">
      <Link href="/pengajuan/penjualan/spk" className="text-sm text-brand">
        ← Kembali ke Daftar SPK
      </Link>
      <header>
        <p className="text-sm font-medium text-brand">Penjualan</p>
        <h1 className="mt-2 text-3xl font-bold">Buat SPK</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Penerbitan Surat Perintah Kerja (SPK) berdasarkan SPH yang telah disetujui internal oleh Direktur Keuangan.
        </p>
      </header>
      <SalesMenu active="spk" />
      <SpkForm
        branches={writableBranches}
        documents={documents}
        disabled={w.isReadOnlyPreview}
        initialSphId={sph}
      />
    </div>
  )
}
