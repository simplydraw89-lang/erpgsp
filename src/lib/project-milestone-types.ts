export type ProjectMilestoneItem = {
  id: number
  milestone_number: number
  title: string
  subtitle: string
  status: "completed" | "in_progress" | "upcoming"
  progress: number
  pic: string
  period: string
  description: string
  deliverables: string[]
  clientActions: string[]
  attachment_ids: string[]
  attachment_names?: Record<string, string>
  updated_at?: string
}

export const DEFAULT_PROJECT_MILESTONES: ProjectMilestoneItem[] = [
  {
    id: 1,
    milestone_number: 1,
    title: "1. Kontrak SPK & Administrasi",
    status: "completed",
    progress: 100,
    subtitle: "Penerbitan & pengesahan SPK resmi oleh Direktur Utama",
    pic: "Legal & Branch Manager",
    period: "Tahap Awal (Selesai)",
    description:
      "Surat Perintah Kerja (SPK) dan Kerangka Acuan Kerja (KAK) telah diverifikasi dan disahkan secara resmi oleh Direksi PT. Global Solusi Prima. Dasar hukum penugasan operasional telah aktif dan terkunci pada sistem ERP.",
    deliverables: ["Berkas SPK Resmi Bertandatangan", "Lembar Pagu Anggaran RAB Terkunci", "Pakta Integritas Pelaksanaan"],
    clientActions: ["Menerima salinan resmi SPK", "Menunjuk PIC teknis pendamping dari pihak klien"],
    attachment_ids: [],
  },
  {
    id: 2,
    milestone_number: 2,
    title: "2. Tim SDM Ahli & Manpower",
    status: "completed",
    progress: 100,
    subtitle: "Penugasan tenaga ahli tersertifikasi & kesiapan lapangan",
    pic: "Project Manager (PM) & Tim Teknis",
    period: "Mobilisasi Lapangan (Selesai)",
    description:
      "Penetapan susunan tim tenaga ahli lingkungan (Ketua Tim Ahli Amdal, Ahli Geologi, Ahli Kualitas Udara, Ahli Flora-Fauna, dan Surveyor Lapangan) beserta sertifikasi kompetensi resmi KLHK/BNSP.",
    deliverables: ["Surat Tugas Resmi Tim Ahli", "Matriks Kualifikasi Personil", "Jadwal Timesheet Kerja Lapangan"],
    clientActions: ["Konfirmasi akses masuk ke area tapak kegiatan", "Pemberitahuan kepada tim keamanan lokal klien"],
    attachment_ids: [],
  },
  {
    id: 3,
    milestone_number: 3,
    title: "3. Kajian Lapangan & Uji Laboratorium",
    status: "in_progress",
    progress: 75,
    subtitle: "Pengambilan sampel rona awal & uji parameter lingkungan",
    pic: "Koordinator Tim Lapangan & Lab Terakreditasi KAN",
    period: "Sedang Berjalan (Estimasi Selesai: 7 Hari Kerja)",
    description:
      "Tahapan pengambilan sampel kualitas air permukaan, air tanah, udara ambien, kebisingan, dan getaran di sekitar tapak proyek. Sampel diuji pada laboratorium lingkungan independen terakreditasi KAN untuk penyusunan rona lingkungan awal.",
    deliverables: ["Berita Acara Sampling Lapangan", "Sertifikat Hasil Uji Laboratorium (CoA)", "Peta Titik Koordinat Sampling"],
    clientActions: ["Meninjau log sampel dan titik koordinat", "Menyediakan data penunjang operasional tapak"],
    attachment_ids: [],
  },
  {
    id: 4,
    milestone_number: 4,
    title: "4. Koordinasi Amdalnet & Notulensi MoM",
    status: "in_progress",
    progress: 40,
    subtitle: "Integrasi sistem Amdalnet KLHK & risalah rapat berkala",
    pic: "Spesialis Regulasi & Asisten PM",
    period: "Berjalan Seiring Progres Lapangan",
    description:
      "Penginputan checklist dokumen lingkungan ke dalam portal Amdalnet KLHK serta pelaksanaan rapat koordinasi berkala bersama PIC klien. Seluruh hasil kesepakatan dicatat permanen dalam Notulensi Rapat Resmi (MoM) di portal ini.",
    deliverables: ["Notulensi Rapat Resmi (MoM)", "Tanda Terima Pengajuan Amdalnet", "Matriks Dampak Lingkungan"],
    clientActions: ["Mengunggah data legalitas lahan via portal ini", "Memberikan tanggapan / persetujuan pada draf MoM"],
    attachment_ids: [],
  },
  {
    id: 5,
    milestone_number: 5,
    title: "5. Laporan Akhir & Serah Terima",
    status: "upcoming",
    progress: 0,
    subtitle: "Finalisasi dokumen lengkap & Berita Acara Serah Terima (BAST)",
    pic: "Project Manager & Direktur Teknis",
    period: "Tahap Finalisasi",
    description:
      "Penyusunan draf final Dokumen Kajian Lingkungan (ANDAL, RKL-RPL), konsultasi publik / penilaian teknis, serta penyerahan laporan resmi yang telah dijilid dan disahkan beserta Berita Acara Serah Terima (BAST).",
    deliverables: ["Laporan Akhir Kajian Lingkungan (Hardcopy & Softcopy)", "Rekomendasi / Persetujuan Teknis", "Berita Acara Serah Terima (BAST)"],
    clientActions: ["Penandatanganan Berita Acara Serah Terima (BAST)", "Pemberian evaluasi kepuasan layanan proyek"],
    attachment_ids: [],
  },
]

export const MILESTONE_ENTRY_PREFIX = "MILESTONE_SYNC_V1:"

export function isMilestoneSyncEntry(entry: { title?: string | null }): boolean {
  return Boolean(entry?.title && entry.title.startsWith(MILESTONE_ENTRY_PREFIX))
}

export function normalizeMilestoneRow(
  m: Record<string, unknown>,
  idx: number,
  updatedFallback?: string
): ProjectMilestoneItem {
  const progress = Math.min(100, Math.max(0, Number(m.progress) || 0))
  const status =
    m.status === "completed" || m.status === "in_progress" || m.status === "upcoming"
      ? m.status
      : progress >= 100
      ? "completed"
      : progress > 0
      ? "in_progress"
      : "upcoming"

  const rawAttNames = m.attachment_names
  const attachmentNames =
    rawAttNames && typeof rawAttNames === "object" && !Array.isArray(rawAttNames)
      ? (rawAttNames as Record<string, string>)
      : undefined

  return {
    id: Number(m.milestone_number) || idx + 1,
    milestone_number: Number(m.milestone_number) || idx + 1,
    title: String(m.title || `Tahap ${idx + 1}`),
    subtitle: String(m.subtitle || ""),
    status,
    progress,
    pic: String(m.pic_name ?? m.pic ?? ""),
    period: String(m.period || ""),
    description: String(m.description || ""),
    deliverables: Array.isArray(m.deliverables) ? m.deliverables.map(String) : [],
    clientActions: Array.isArray(m.client_actions)
      ? m.client_actions.map(String)
      : Array.isArray(m.clientActions)
      ? m.clientActions.map(String)
      : [],
    attachment_ids: Array.isArray(m.attachment_ids) ? m.attachment_ids.map(String) : [],
    attachment_names: attachmentNames,
    updated_at: typeof m.updated_at === "string" ? m.updated_at : updatedFallback,
  }
}
