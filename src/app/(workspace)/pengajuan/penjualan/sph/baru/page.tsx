import { randomUUID } from "node:crypto"
import { requireWorkspace } from "@/lib/auth/context"
import { SphForm } from "@/components/sales/sph-form"
import { SalesMenu } from "@/components/sales/sales-menu"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import type { BusinessUnit } from "@/lib/procurement-ui"

export default async function NewSphPage() {
  const w = await requireWorkspace()
  const [permission,units] = await Promise.all([
    w.supabase.rpc("can_read_sales_clients",{p_org:w.organizationId}),
    w.supabase.from("business_units").select("id,code,name,kind").eq("organization_id",w.organizationId).eq("kind","branch").order("code"),
  ])
  if (permission.error || units.error) throw new Error("Form SPH gagal dimuat. Periksa koneksi dan izin akses.")
  const central = w.actorRole === "owner" || w.workAssignments.some(job => !job.branch_id && ["president","finance_director","technical_director"].includes(job.job_role))
  const branches = (units.data ?? []).filter(branch => central || w.workAssignments.some(job => job.branch_id === branch.id)) as BusinessUnit[]
  return <div className="space-y-6"><Link href="/pengajuan/penjualan/sph" className="text-sm text-brand">← Daftar SPH</Link><h1 className="text-3xl font-bold">Buat SPH</h1><SalesMenu active="sph" />{permission.data && branches.length ? <SphForm branches={branches} draftId={randomUUID()} disabled={w.isReadOnlyPreview} /> : <p role="alert">Pembuatan SPH memerlukan role penjualan dan penugasan cabang yang sesuai.</p>}</div>
}
