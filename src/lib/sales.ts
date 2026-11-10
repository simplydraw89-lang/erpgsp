export const salesIndustries = ["Mining", "Migas", "Industri", "Umum"] as const
export const sphWorkScopes = ["Pertek", "UKL/UPL", "Amdal", "DELH", "DPLH", "Andalalin", "LB 3", "Lainnya"] as const
export const sphStatusLabels: Record<string, string> = {
  draft: "Draft", branch_review: "Menunggu persetujuan Manager Cabang", director_review: "Menunggu persetujuan Direktur Keuangan",
  accounting_review: "Pemeriksaan Accounting–Tax", finance_review: "Pemeriksaan Finance",
  ready: "Disetujui", revision_requested: "Perlu revisi", rejected: "Ditolak", accepted: "Disepakati kedua pihak",
}

export const spkStatusLabels: Record<string, string> = {
  draft: "Draft SPK",
  director_review: "Menunggu Persetujuan Direktur Utama",
  ready: "Disetujui (Proyek Resmi Dibuat)",
  revision_requested: "Perlu Revisi",
  rejected: "Ditolak",
}

export type SphRegisterRow = {
  id: string; sph_number: number; document_number?: string | null; branch_id: string; branch_name: string; created_at: string;
  title: string; work_scopes: string[]; amount: number | string | null; status: string;
  can_open: boolean; can_create_spk: boolean;
  client_snapshot?: { name?: string | null } | null;
  client_name?: string | null;
}

export function sanitizeClientCodeName(rawName?: string | null): string {
  if (!rawName || !rawName.trim()) return "UMUM"
  let clean = rawName
    .toUpperCase()
    .replace(/\b(PT\.?|CV\.?|UD\.?|TBK\.?|PERSERO|PERUM|YAYASAN|KOPERASI|FIRMA|INC\.?|LTD\.?|CORP\.?)\b/gi, " ")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!clean) {
    clean = rawName.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  }
  clean = clean.slice(0, 15).replace(/-+$/g, "")
  return clean || "UMUM"
}

export function formatOfficialSalesNumber(
  doc: {
    id?: string | null
    document_number?: string | null
    sph_number?: number | string | null
    created_at?: string | null
    client_snapshot?: { name?: string | null } | null
    client_name?: string | null
  },
  kind: "sph" | "spk" = "sph"
): string {
  const prefix = kind === "spk" ? "SPK" : "SPH"
  const rawDocNum = (doc.document_number || "").trim()

  // Jika sudah sesuai standar resmi {PREFIX}/{CLIENT}/GSP/{MMYY}.{SEQ} (memiliki minimal 3 garis miring)
  if (rawDocNum && (rawDocNum.includes("/GSP/") || rawDocNum.split("/").length >= 4)) {
    if (kind === "spk" && rawDocNum.startsWith("SPH/")) {
      return rawDocNum.replace(/^SPH\//, "SPK/")
    }
    if (kind === "sph" && rawDocNum.startsWith("SPK/")) {
      return rawDocNum.replace(/^SPK\//, "SPH/")
    }
    return rawDocNum
  }

  const clientRaw = doc.client_snapshot?.name || doc.client_name || "KLIEN"
  const clientCode = sanitizeClientCodeName(clientRaw)

  const dateObj = doc.created_at ? new Date(doc.created_at) : new Date()
  const validDate = Number.isNaN(dateObj.getTime()) ? new Date() : dateObj
  const mmyy = `${String(validDate.getMonth() + 1).padStart(2, "0")}${String(validDate.getFullYear()).slice(-2)}`

  // Ambil nomor urut dari sph_number atau ekstrak angka dari document_number pendek (misal "SPH/1")
  let seqNum = doc.sph_number != null && String(doc.sph_number).trim() !== "" ? Number(doc.sph_number) : NaN
  if (Number.isNaN(seqNum) && rawDocNum) {
    const match = rawDocNum.match(/(\d+)$/)
    if (match) seqNum = Number(match[1])
  }

  if (!Number.isNaN(seqNum) && seqNum > 0) {
    const seq = String(Math.floor(seqNum)).padStart(6, "0")
    return `${prefix}/${clientCode}/GSP/${mmyy}.${seq}`
  }

  if (rawDocNum) return rawDocNum
  return `${prefix}/${clientCode}/GSP/${mmyy}.000001`
}

export type SalesNotifications = {
  total: number
  items: Array<{
    id: string
    kind?: "sph" | "spk" | "project"
    sph_number?: number
    document_number?: string | null
    status: string
    review_note?: string
    created_at: string
    category: "approval" | "follow_up"
    label: string
  }>
}

export const projectStatusLabels: Record<string, string> = {
  draft: "SPK Disetujui Dirut — Wajib Lengkapi Dokumen & RAB Proyek",
  director_review: "Menunggu Persetujuan Direktur Utama",
  active: "Proyek Aktif & Berjalan",
  revision_requested: "Perlu Revisi Dokumen & RAB Proyek",
  rejected: "Ditolak Direktur Utama",
  completed: "Pekerjaan Selesai",
}
