import {
  BookOpen,
  CalendarDays,
  BriefcaseBusiness,
  Calculator,
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  Clock,
  ContactRound,
  CreditCard,
  FileText,
  Landmark,
  Plane,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Sliders,
  UsersRound,
} from "lucide-react"
import type { OrganizationRole } from "@/lib/auth/context"

export const roleLabels: Record<OrganizationRole, string> = {
  owner: "Super Admin",
  director: "Direksi",
  manager: "Manager",
  finance: "Keuangan",
  hr: "SDM",
  operations: "Operasional",
  auditor: "Auditor",
  staff: "Staf",
}
const everyone: OrganizationRole[] = [
  "owner",
  "director",
  "manager",
  "finance",
  "hr",
  "operations",
  "auditor",
  "staff",
]
export const applicationGroups = [
  {
    id: "requests",
    name: "Pengajuan",
    tone: "amber",
    apps: [
      {
        name: "Penjualan",
        href: "/pengajuan/penjualan",
        icon: BriefcaseBusiness,
        roles: everyone,
        description: "Daftar klien, draft SPH dan SPK sesuai urutan persetujuan",
      },
      {
        name: "Pembelian",
        href: "/pengajuan/pembelian",
        icon: ReceiptText,
        roles: everyone,
        description: "Invoice vendor, pemeriksaan berjenjang, utang dan pembayaran per cabang",
      },
      {
        name: "Perjalanan dinas",
        href: "/modul/sdm",
        icon: Plane,
        roles: everyone,
        description: "Surat tugas SPPD penugasan luar kota, per diem, dan kasbon dinas",
      },
      {
        name: "Cuti & Izin",
        href: "/modul/sdm",
        icon: CalendarDays,
        roles: everyone,
        description: "Pengajuan cuti tahunan, izin sakit, dan pantau kuota saldo 1 tahun",
      },
    ],
  },
  {
    id: "my-work",
    name: "Pekerjaan saya",
    tone: "blue",
    apps: [
      {
        name: "Pengajuan saya",
        href: "/pekerjaan-saya/pengajuan",
        icon: FileText,
        roles: everyone,
        description: "Dokumen dan pengajuan yang Anda buat sendiri",
      },
      {
        name: "Persetujuan",
        href: "/approvals?scope=review",
        icon: ClipboardCheck,
        roles: everyone,
        description: "Permintaan yang perlu Anda verifikasi sesuai kewenangan",
      },
      {
        name: "Pekerjaan saya",
        href: "/pekerjaan-saya",
        icon: ClipboardList,
        roles: everyone,
        description: "Tugas, persetujuan, dan pekerjaan sesuai peran Anda",
      },
    ],
  },
  {
    id: "finance",
    name: "Keuangan",
    tone: "blue",
    apps: [
      {
        name: "Bagan Akun",
        href: "/modul/keuangan",
        icon: Calculator,
        roles: ["owner", "director", "finance", "auditor"],
        description: "COA berjenjang dan pengelompokan akun",
      },
      {
        name: "Accounting",
        href: "/modul/akuntansi",
        icon: Calculator,
        roles: ["owner", "director", "finance", "auditor"],
        description: "Jurnal dan buku besar perusahaan",
      },
      {
        name: "Assets",
        href: "/modul/asset",
        icon: Landmark,
        roles: [
          "owner",
          "director",
          "finance",
          "operations",
          "auditor",
          "staff",
        ],
        description: "Inventaris dan pemantauan aset perusahaan",
      },
      {
        name: "Perpajakan",
        href: "/modul/perpajakan",
        icon: ReceiptText,
        roles: ["owner", "director", "finance", "auditor"],
        description: "Catatan pajak dan tenggat pelaporan",
      },
      {
        name: "Pembayaran",
        href: "/modul/pembayaran",
        icon: CreditCard,
        roles: ["owner", "director", "finance", "auditor"],
        description: "Tagihan perusahaan, jatuh tempo, dan pembayaran lunas",
      },
      {
        name: "Dashboard Eksekutif",
        href: "/modul/manajemen",
        icon: ChartNoAxesCombined,
        roles: ["owner", "director"],
        description: "Ringkasan lintas modul perusahaan",
      },
    ],
  },
  {
    id: "people",
    name: "SDM & Presensi",
    tone: "pink",
    apps: [
      {
        name: "Modul SDM",
        href: "/modul/sdm",
        icon: UsersRound,
        roles: everyone,
        description: "Portal absensi GPS & selfie, slip gaji, rekap pekerjaan, izin & cuti mandiri",
      },
      {
        name: "Absen Sekarang",
        href: "/modul/sdm",
        icon: Clock,
        roles: everyone,
        description: "Presensi live kamera selfie & GPS kantor (100m) atau site se-Indonesia",
      },
      {
        name: "Slip Gaji Saya",
        href: "/modul/sdm",
        icon: CreditCard,
        roles: everyone,
        description: "Rekap penerimaan gaji bulanan personal 1 tahun dan cetak format resmi",
      },
    ],
  },
  {
    id: "operations",
    name: "Operasional",
    tone: "green",
    apps: [
      {
        name: "Vendor",
        href: "/vendor",
        icon: ContactRound,
        roles: everyone,
        description: "Daftar vendor proyek dan nonproyek, termasuk lab dan subkon",
      },
      {
        name: "Portal proyek",
        href: "/portal-proyek",
        icon: FileText,
        roles: everyone,
        description: "Informasi proyek yang dibagikan, permintaan data, MoM, surat dan ringkasan tagihan",
      },
      {
        name: "Pekerjaan",
        href: "/modul/operasional",
        icon: ClipboardList,
        roles: everyone,
        description: "Pekerjaan, prioritas, dan penanggung jawab",
      },
      {
        name: "Proyek",
        href: "/proyek",
        icon: BriefcaseBusiness,
        roles: everyone,
        description: "Manajemen perencanaan proyek, SDM, timesheet, RAB, dan eksekusi lapangan",
      },
      {
        name: "Kontak",
        href: "/modul/crm?type=client",
        icon: ContactRound,
        roles: everyone,
        description: "Direktori kontak perusahaan; klien penawaran dikelola di Penjualan",
      },
    ],
  },
  {
    id: "system",
    name: "Bantuan dan sistem",
    tone: "slate",
    apps: [
      {
        name: "Pengaturan",
        href: "/pengaturan",
        icon: Settings2,
        roles: everyone,
        description: "Pengaturan mode tampilan (terang, gelap, sesuai waktu) dan preferensi sistem",
      },
      {
        name: "Struktur & akses",
        href: "/struktur-akses",
        icon: UsersRound,
        roles: ["owner", "director"],
        description: "Pusat, cabang, status individu dan penugasan pekerjaan",
      },
      {
        name: "Kebijakan Approval",
        href: "/pengaturan/persetujuan",
        icon: Sliders,
        roles: everyone,
        description: "Aturan pemeriksa dan eskalasi nominal",
      },
      {
        name: "Jejak Audit",
        href: "/audit",
        icon: ShieldCheck,
        roles: ["owner", "director", "auditor"],
        description: "Riwayat keputusan dan perubahan data",
      },
      {
        name: "Panduan ERP",
        href: "/panduan",
        icon: BookOpen,
        roles: everyone,
        description: "Cara menggunakan modul dan pengajuan",
      },
    ],
  },
] as const

export function getApplicationGroups(role: OrganizationRole | OrganizationRole[]) {
  const roles = Array.isArray(role) ? role : [role]
  const portalOnly = roles.length === 0
  return applicationGroups
    .map((group) => ({
      ...group,
      apps: group.apps.filter((app) =>
        portalOnly ? ["/portal-proyek"].includes(app.href)
          : roles.some(role => (app.roles as readonly string[]).includes(role)),
      ),
    }))
    .filter((group) => group.apps.length > 0)
}

export function getApplications(role: OrganizationRole | OrganizationRole[]) {
  return getApplicationGroups(role).flatMap((group) =>
    group.apps.map((app) => ({ ...app, group: group.name })),
  )
}
