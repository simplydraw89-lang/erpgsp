import type { SupabaseClient } from "@supabase/supabase-js"

export const submissionSources = [
  { table:"purchase_requests", fields:"id,invoice_number,status,created_at", title:"invoice_number", status:"status", label:"Pembelian", path:(id:string)=>`/pengajuan/${id}` },
  { table:"procurement_vendors", fields:"id,name,status,created_at", title:"name", status:"status", label:"Usulan vendor", path:()=>"/vendor" },
  { table:"sales_clients", fields:"id,name,created_at", title:"name", status:null, label:"Klien", path:()=>"/pengajuan/penjualan/klien" },
  { table:"sales_documents", fields:"id,title,kind,status,created_at", title:"title", status:"status", label:"Penjualan", path:()=>"/pengajuan/penjualan" },
  { table:"workflow_documents", fields:"id,title,state,created_at", title:"title", status:"state", label:"Dokumen workflow", path:(id:string)=>`/dokumen/${id}` },
  { table:"operational_work_items", fields:"id,title,status,created_at", title:"title", status:"status", label:"Pekerjaan operasional", path:(id:string)=>`/modul/operasional?type=work_item&edit=${id}` },
] as const

export async function loadMySubmissions(supabase: SupabaseClient, organizationId: string, userId: string) {
  const results = await Promise.all(submissionSources.map(async source => {
    const result = await supabase.from(source.table).select(source.fields)
      .eq("organization_id", organizationId).eq("created_by", userId)
      .order("created_at", { ascending:false }).limit(50)
    if (result.error) throw new Error(`Daftar pengajuan pribadi gagal dimuat (${source.label}).`)
    return ((result.data ?? []) as unknown as Record<string,unknown>[]).map(row => ({
      id:String(row.id), source:source.table, title:String(row[source.title]),
      kind:source.table==="sales_documents"?String(row.kind).toUpperCase():source.label,
      status:source.status?String(row[source.status]):"registered", createdAt:String(row.created_at), href:source.table==="sales_documents" ? row.kind === "spk" ? "/pengajuan/penjualan/spk" : `/pengajuan/penjualan/sph/${row.id}` : source.path(String(row.id)),
    }))
  }))
  return results.flat().sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
}
