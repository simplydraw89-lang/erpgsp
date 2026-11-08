import { randomUUID } from "node:crypto"
import { SalesMenu } from "./sales-menu"
import { requireWorkspace } from "@/lib/auth/context"
import { SalesForms } from "./sales-forms"
import { ProcurementMessage } from "@/components/procurement/section-nav"
import { AutoRefreshOnFocus } from "@/components/ui/auto-refresh-on-focus"
import type { BusinessUnit, SalesDocument } from "@/lib/procurement-ui"
import type { SphRegisterRow } from "@/lib/sales"

export async function SalesWorkspace({ view, query }: { view: "klien" | "sph" | "spk"; query: { error?: string; notice?: string; branch?: string; page?: string } }) {
  const { supabase, organizationId, actorRole, workAssignments, isReadOnlyPreview } = await requireWorkspace()
  const page = Math.max(1,Math.min(20001,Math.floor(Number(query.page) || 1)))
  const branch = query.branch && /^[0-9a-f-]{36}$/i.test(query.branch) ? query.branch : null
  const [register, read, units, documents, summaries] = await Promise.all([
    supabase.rpc("can_register_sales_client", { p_org: organizationId }),
    supabase.rpc("can_read_sales_clients", { p_org: organizationId }),
    view === "klien" ? Promise.resolve({ data: [], error: null }) : supabase.from("business_units").select("id,code,name,kind").eq("organization_id", organizationId).in("kind", ["branch", "center"]).order("code"),
    view !== "spk" ? Promise.resolve({ data: [], error: null }) : supabase.from("sales_documents").select("*").eq("organization_id", organizationId).eq("kind","spk").order("created_at", { ascending: false }).limit(200),
    view === "sph" ? supabase.rpc("sph_register",{p_org:organizationId,p_branch:branch,p_offset:(page-1)*50}) : Promise.resolve({data:{rows:[],total:0},error:null}),
  ])
  const errors = [register.error, read.error, units.error, documents.error,summaries.error]
  const missing = errors.some(error => error && ["42P01", "PGRST205", "PGRST202"].includes(error.code ?? ""))
  if (!missing && errors.some(Boolean)) throw new Error("Data penjualan gagal dimuat. Periksa koneksi dan izin akses database.")
  const branches = (units.data ?? []) as BusinessUnit[]
  const centralDirector = workAssignments.some(job => !job.branch_id && ["president", "finance_director", "technical_director"].includes(job.job_role))
  const writableBranches = actorRole === "owner" || centralDirector ? branches : branches.filter(branch => workAssignments.some(job => job.branch_id === branch.id))
  const filterBranches = branches.filter(branch => actorRole === "owner" || workAssignments.some(job => job.branch_id === branch.id || (!job.branch_id && ["president","finance_director","technical_director","accounting_tax","finance"].includes(job.job_role))))
  return <div className="space-y-6">
    <AutoRefreshOnFocus />
    <header><p className="text-sm font-medium text-brand">Penjualan</p><h1 className="mt-2 text-3xl font-bold">{view === "klien" ? "Klien" : view.toUpperCase()}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{view === "klien" ? "Master calon mitra bersama perusahaan; akses daftar mengikuti role pemasaran." : view === "sph" ? "Penawaran berdasarkan klien terdaftar, dengan draft dan pemeriksaan berjenjang." : "Perintah kerja berdasarkan SPH yang sudah disepakati."}</p></header>
    <SalesMenu active={view} />
    <ProcurementMessage error={query.error} notice={query.notice} />
    {isReadOnlyPreview && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Mode lihat sebagai aktif. Semua tindakan perubahan dinonaktifkan.</p>}
    {missing ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold">Struktur penjualan terbaru belum tersedia</h2><p className="mt-2 text-sm">Migration master klien bersama dan workflow SPH perlu diterapkan. Data tidak diganti dengan contoh.</p></div>
      : <>{view === "sph" && <form className="flex flex-wrap items-end gap-3"><label className="text-sm">Cabang<select name="branch" defaultValue={branch ?? ""} className="ml-2 rounded-lg border border-line p-2"><option value="">Semua cabang yang diizinkan</option>{filterBranches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="rounded-lg border border-line px-3 py-2 text-sm">Tampilkan</button></form>}<SalesForms view={view} branches={writableBranches} allBranches={branches} documents={(documents.data ?? []) as SalesDocument[]} register={(summaries.data?.rows ?? []) as SphRegisterRow[]} offset={(page-1)*50} canRegisterClient={Boolean(register.data)} canReadClients={Boolean(read.data)} canCreateDocuments={Boolean(read.data) && writableBranches.length > 0} draftId={randomUUID()} disabled={isReadOnlyPreview} />{view === "sph" && <nav aria-label="Halaman daftar SPH" className="flex gap-4 text-sm text-brand">{page>1 && <a href={`?${new URLSearchParams({branch:branch ?? "",page:String(page-1)})}`}>← Sebelumnya</a>}<span className="text-muted">{summaries.data?.total ?? 0} SPH</span>{page*50 < (summaries.data?.total ?? 0) && <a href={`?${new URLSearchParams({branch:branch ?? "",page:String(page+1)})}`}>Berikutnya →</a>}</nav>}</>}
  </div>
}
