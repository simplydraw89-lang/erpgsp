export const salesIndustries = ["Mining", "Migas", "Industri", "Umum"] as const
export const sphWorkScopes = ["Pertek", "UKL/UPL", "Amdal", "DELH", "DPLH", "Andalalin", "LB 3", "Lainnya"] as const
export const sphStatusLabels: Record<string, string> = {
  draft: "Draft", branch_review: "Menunggu persetujuan Manager Cabang", director_review: "Menunggu persetujuan Direktur Keuangan",
  accounting_review: "Pemeriksaan Accounting–Tax", finance_review: "Pemeriksaan Finance",
  ready: "Disetujui", revision_requested: "Perlu revisi", rejected: "Ditolak", accepted: "Disepakati kedua pihak",
}

export const spkStatusLabels: Record<string, string> = {
  draft: "Draft SPK",
  director_review: "Menunggu Validasi Direktur Utama / Direktur Teknis",
  ready: "Disetujui (Proyek Resmi Dibuat)",
  revision_requested: "Perlu Revisi",
  rejected: "Ditolak",
}

export type SphRegisterRow = {
  id: string; sph_number: number; branch_id: string; branch_name: string; created_at: string;
  title: string; work_scopes: string[]; amount: number | string | null; status: string;
  can_open: boolean; can_create_spk: boolean;
}
export type SalesNotification = {
  id: string
  sph_number?: number
  document_number?: string
  status: string
  review_note: string | null
  category: "approval" | "follow_up"
  label: string
  kind?: "sph" | "spk"
}
export type SalesNotifications = { total: number; items: SalesNotification[] }
