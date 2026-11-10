import type { SupabaseClient } from "@supabase/supabase-js"

export const submissionSources = [
  { table:"purchase_requests", fields:"id,invoice_number,status,created_at,vendor_snapshot,branch_id,vendor_id", title:"invoice_number", status:"status", label:"Pembelian", path:(id:string)=>`/pengajuan/${id}` },
  { table:"procurement_vendors", fields:"id,name,status,created_at,branch_id", title:"name", status:"status", label:"Usulan vendor", path:()=>"/vendor" },
  { table:"sales_clients", fields:"id,name,created_at,branch_id", title:"name", status:null, label:"Klien", path:()=>"/pengajuan/penjualan/klien" },
  { table:"sales_documents", fields:"id,title,kind,status,created_at,branch_id", title:"title", status:"status", label:"Penjualan", path:()=>"/pengajuan/penjualan" },
  { table:"workflow_documents", fields:"id,title,state,created_at", title:"title", status:"state", label:"Dokumen workflow", path:(id:string)=>`/dokumen/${id}` },
  { table:"operational_work_items", fields:"id,title,status,created_at", title:"title", status:"status", label:"Pekerjaan operasional", path:(id:string)=>`/modul/operasional?type=work_item&edit=${id}` },
] as const

export async function loadMySubmissions(supabase: SupabaseClient, organizationId: string, userId: string) {
  const { data: units } = await supabase.from("business_units").select("id,name").eq("organization_id", organizationId)
  const branchMap = new Map((units ?? []).map(u => [u.id, u.name]))

  // 1. Ambil seluruh pengajuan pembelian oleh user
  const purchaseRes = await supabase.from("purchase_requests")
    .select("id,invoice_number,status,created_at,vendor_snapshot,branch_id,vendor_id")
    .eq("organization_id", organizationId).eq("created_by", userId)
    .order("created_at", { ascending:false }).limit(100)

  const purchases = (purchaseRes.data ?? []).map(row => {
    const vName = (row.vendor_snapshot as { name?: string } | null)?.name || ""
    const bName = branchMap.get(row.branch_id) || "Cabang"
    return {
      id: String(row.id),
      purchaseId: String(row.id),
      vendorId: row.vendor_id ? String(row.vendor_id) : null,
      source: "purchase_requests",
      title: `${row.invoice_number || "Invoice"} ${vName ? `• ${vName}` : ""}`,
      branchId: String(row.branch_id || ""),
      branchName: bName,
      vendorName: vName,
      invoiceNumber: row.invoice_number,
      kind: "Pembelian",
      status: String(row.status || "draft"),
      createdAt: String(row.created_at),
      href: `/pengajuan/${row.id}`
    }
  })

  // 2. Ambil vendor yang diusulkan oleh user
  const vendorRes = await supabase.from("procurement_vendors")
    .select("id,name,status,created_at,branch_id")
    .eq("organization_id", organizationId).eq("created_by", userId)
    .order("created_at", { ascending:false }).limit(100)

  const vendors = (vendorRes.data ?? []).map(row => {
    const vName = String(row.name || "").trim()
    const vNorm = vName.toLowerCase()
    
    // Cari apakah vendor ini terikat dengan salah satu pengajuan pembelian user
    const matchedPurchase = purchases.find(p => 
      (p.vendorId && p.vendorId === String(row.id)) ||
      (p.vendorName && p.vendorName.toLowerCase().trim() === vNorm) ||
      (p.title && p.title.toLowerCase().includes(vNorm))
    )

    // JIKA vendor terhubung dengan pengajuan pembelian:
    // Tombol BUKA harus langsung membuka form pengajuan pembayaran (/pengajuan/[id])
    const href = matchedPurchase ? `/pengajuan/${matchedPurchase.id}` : `/pengajuan/pembelian/baru?vendor_id=${row.id}`

    return {
      id: String(row.id),
      purchaseId: matchedPurchase?.id || null,
      source: "procurement_vendors",
      title: vName,
      branchId: String(row.branch_id || ""),
      branchName: branchMap.get(row.branch_id) || "-",
      vendorName: vName,
      invoiceNumber: matchedPurchase?.invoiceNumber || "-",
      kind: "Usulan vendor",
      status: String(row.status || "pending"),
      createdAt: String(row.created_at),
      href: href
    }
  })

  // 3. Sumber dokumen lainnya (klien, sales SPH/SPK, dokumen operasional)
  const otherSources = submissionSources.filter(s => !["purchase_requests", "procurement_vendors"].includes(s.table))
  const others = await Promise.all(otherSources.map(async source => {
    const res = await supabase.from(source.table).select(source.fields)
      .eq("organization_id", organizationId).eq("created_by", userId)
      .order("created_at", { ascending:false }).limit(50)
    return ((res.data ?? []) as unknown as Record<string,unknown>[]).map(row => ({
      id: String(row.id),
      purchaseId: null,
      source: source.table,
      title: String(row[source.title]),
      branchId: String(row.branch_id || ""),
      branchName: branchMap.get(String(row.branch_id)) || "-",
      vendorName: "-",
      invoiceNumber: "-",
      kind: source.table === "sales_documents" ? String(row.kind).toUpperCase() : source.label,
      status: source.status ? String(row[source.status]) : "registered",
      createdAt: String(row.created_at),
      href: source.table === "sales_documents" ? (row.kind === "spk" ? `/pengajuan/penjualan/spk/${row.id}` : `/pengajuan/penjualan/sph/${row.id}`) : source.path(String(row.id))
    }))
  }))

  // 4. Proyek Cabang (khusus Admin Cabang & Manager Cabang pada cabang terkait atau pembuat proyek)
  const { data: assignments } = await supabase
    .from("work_assignments")
    .select("branch_id, job_role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)

  const branchRoleIds = Array.from(
    new Set(
      (assignments ?? [])
        .filter(a => a.branch_id && ["admin", "branch_manager", "project_manager"].includes(a.job_role))
        .map(a => String(a.branch_id))
    )
  )

  let projectQuery = supabase
    .from("crm_projects")
    .select("id, code, name, branch_id, approval_status, status, created_at, created_by, client:sales_clients(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (branchRoleIds.length > 0) {
    projectQuery = projectQuery.or(`created_by.eq.${userId},branch_id.in.(${branchRoleIds.join(",")})`)
  } else {
    projectQuery = projectQuery.eq("created_by", userId)
  }

  const projectRes = await projectQuery
  const projects = ((projectRes.data ?? []) as any[]).map(row => ({
    id: String(row.id),
    purchaseId: null,
    source: "crm_projects",
    title: `${row.code || "PRJ"} • ${row.name || "Proyek"}`,
    branchId: String(row.branch_id || ""),
    branchName: branchMap.get(String(row.branch_id)) || "-",
    vendorName: row.client?.name || "-",
    invoiceNumber: String(row.code || "-"),
    kind: "Proyek",
    status: String(row.approval_status || row.status || "draft"),
    createdAt: String(row.created_at),
    href: `/proyek/${row.id}`,
  }))

  return [...purchases, ...vendors, ...others.flat(), ...projects].sort((a,b) => b.createdAt.localeCompare(a.createdAt))
}
