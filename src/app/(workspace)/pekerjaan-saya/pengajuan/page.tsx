import Link from "next/link"
import { Card } from "@/components/ui/card"
import { PersonalNav } from "@/components/workflow/personal-nav"
import { TableFilterBar } from "@/components/ui/table-filter-bar"
import { requireWorkspace } from "@/lib/auth/context"
import { loadMySubmissions } from "@/lib/my-submissions"
import { labels } from "@/lib/workflow"
import { purchaseStatusLabels, formatDateID } from "@/lib/procurement-ui"
import { sphStatusLabels } from "@/lib/sales"

export default async function MySubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; branch_id?: string; status?: string; kind?: string; date?: string }>
}) {
  const query = await searchParams
  const { supabase, organizationId, user, actorRole, workAssignments } = await requireWorkspace()
  
  // Dapatkan daftar cabang
  const { data: units } = await supabase.from("business_units").select("id,name").eq("organization_id", organizationId).eq("kind", "branch").order("name")
  const branches = units ?? []
  
  const isCentralUser = actorRole === "owner" || workAssignments.some(j => !j.branch_id && ["president", "finance_director", "accounting_tax", "finance"].includes(j.job_role))
  const userBranchId = workAssignments.find(j => j.branch_id)?.branch_id ?? null

  const allRows = await loadMySubmissions(supabase, organizationId, user.id)
  
  // Filter di sisi server
  const rows = allRows.filter((row) => {
    if (query.branch_id && row.branchId && row.branchId !== query.branch_id) return false
    if (query.kind && row.kind.toLowerCase() !== query.kind.toLowerCase()) return false
    if (query.status && row.status !== query.status) return false
    if (query.date && !row.createdAt.startsWith(query.date)) return false
    if (query.q) {
      const q = query.q.toLowerCase()
      const title = row.title.toLowerCase()
      const inv = (row.invoiceNumber || "").toLowerCase()
      const vName = (row.vendorName || "").toLowerCase()
      if (!title.includes(q) && !inv.includes(q) && !vName.includes(q)) return false
    }
    return true
  })

  const statuses: Record<string, string> = { 
    ...labels, 
    ...purchaseStatusLabels, 
    draft: "Draft",
    pending: "Menunggu verifikasi", 
    approved: "Disetujui", 
    rejected: "Ditolak / perlu revisi", 
    accepted: "Disetujui kedua pihak", 
    registered: "Terdaftar" 
  }
  
  const statusLabel = (row: typeof rows[number]) => {
    if (row.kind === "SPH") return sphStatusLabels[row.status] ?? row.status
    return statuses[row.status] ?? row.status
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-brand">Pekerjaan saya</p>
        <h1 className="mt-2 text-3xl font-bold">Pengajuan saya</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Dokumen dan pengajuan yang Anda buat sendiri. Permintaan yang perlu Anda verifikasi tersedia di antrean Persetujuan.
        </p>
      </header>

      <PersonalNav active="mine" />

      {/* Komponen Filter Bar Pencarian */}
      <TableFilterBar
        branches={branches}
        isCentralUser={isCentralUser}
        userBranchId={userBranchId}
        fields={[
          { key: "q", label: "Nomor Dokumen / Vendor / Judul", placeholder: "Cari nomor dokumen atau nama..." },
          { key: "date", label: "Tanggal Pengajuan", type: "date" },
          {
            key: "kind",
            label: "Jenis Dokumen",
            type: "select",
            options: [
              { value: "Pembelian", label: "Pembelian" },
              { value: "SPH", label: "SPH (Penawaran)" },
              { value: "SPK", label: "SPK (Perintah Kerja)" },
              { value: "Usulan vendor", label: "Usulan Vendor" },
              { value: "Klien", label: "Klien" },
            ],
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: Object.entries(statuses).map(([val, lbl]) => ({ value: val, label: lbl })),
          },
        ]}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">No.</th>
                <th className="px-4 py-3 font-medium">Invoice / Judul</th>
                <th className="px-4 py-3 font-medium">Cabang</th>
                <th className="px-4 py-3 font-medium">Vendor / Klien</th>
                <th className="px-4 py-3 font-medium">Jenis</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.source}-${row.id}`} className="border-t border-line">
                  <td className="px-4 py-4 text-xs font-semibold text-muted">{index + 1}</td>
                  <td className="px-4 py-4 font-medium">
                    {row.title}
                    <span className="mt-1 block text-xs text-muted">
                      Dibuat: {formatDateID(row.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-muted">{row.branchName || "-"}</td>
                  <td className="px-4 py-4 text-muted">{row.vendorName || "-"}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {row.kind}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-medium text-brand">
                      {statusLabel(row)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={row.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                    >
                      {["draft", "rejected"].includes(row.status) ? "Edit ✎" : "Buka →"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="p-8 text-center text-sm text-muted">
              Belum ada dokumen atau pengajuan yang sesuai dengan kriteria filter saat ini.
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
