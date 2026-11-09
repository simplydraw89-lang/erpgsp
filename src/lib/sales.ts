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
  draft: "Draft Perencanaan",
  director_review: "Menunggu Persetujuan Direktur Utama",
  active: "Proyek Aktif & Berjalan",
  revision_requested: "Perlu Revisi Dokumen & RAB",
  rejected: "Ditolak Direktur Utama",
  completed: "Pekerjaan Selesai",
}
