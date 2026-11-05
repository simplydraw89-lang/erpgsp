import {
  BriefcaseBusiness,
  Calculator,
  ChartNoAxesCombined,
  GitBranch,
  ClipboardCheck,
  CreditCard,
  ContactRound,
  Package,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

export type ModuleKey =
  | "crm"
  | "operasional"
  | "keuangan"
  | "sdm"
  | "perpajakan"
  | "manajemen"
  | "asset"
  | "pembayaran"
  | "akuntansi"
  | "struktur-perusahaan"

export type ModuleDefinition = {
  key: ModuleKey
  name: string
  description: string
  source: string
  href: string
  icon: LucideIcon
  status: "foundation" | "mvp"
}

export const modules: ModuleDefinition[] = [
  {
    key: "asset",
    name: "Asset Perusahaan",
    description: "Pantau lokasi, penanggung jawab, nilai perolehan, kondisi, dan status aset.",
    source: "ERP GSP · Supabase",
    href: "/modul/asset",
    icon: Package,
    status: "mvp",
  },
  {
    key: "crm",
    name: "CRM & Proyek",
    description: "Klien dan proyek; alur klien–SPH–SPK tersedia pada Penjualan.",
    source: "ERP GSP · Supabase",
    href: "/modul/crm",
    icon: ContactRound,
    status: "mvp",
  },
  {
    key: "operasional",
    name: "Operasional",
    description: "Pekerjaan dan proyek; mulai pengadaan dari Pembelian.",
    source: "ERP GSP · Supabase",
    href: "/modul/operasional",
    icon: BriefcaseBusiness,
    status: "mvp",
  },
  {
    key: "keuangan",
    name: "Keuangan & Akuntansi",
    description: "Bagan akun yang digunakan pada jurnal dan pengajuan pembelian.",
    source: "ERP GSP · Supabase",
    href: "/modul/keuangan",
    icon: Calculator,
    status: "mvp",
  },
  {
    key: "sdm",
    name: "SDM",
    description: "Kelola direktori karyawan, departemen, jabatan, dan status kepegawaian.",
    source: "ERP GSP · Supabase",
    href: "/modul/sdm",
    icon: UsersRound,
    status: "mvp",
  },
  {
    key: "perpajakan",
    name: "Perpajakan",
    description: "Catat masa dan nilai pajak; kalkulasi dan pelaporan menyusul.",
    source: "ERP GSP · Supabase",
    href: "/modul/perpajakan",
    icon: ClipboardCheck,
    status: "mvp",
  },
  {
    key: "pembayaran",
    name: "Pembayaran",
    description: "Kelola tagihan perusahaan, jatuh tempo, dan status pembayarannya.",
    source: "ERP GSP - Supabase",
    href: "/modul/pembayaran",
    icon: CreditCard,
    status: "mvp",
  },
  {
    key: "akuntansi",
    name: "Akuntansi & Buku Besar",
    description: "Jurnal umum, buku besar, subledger, bank, dan laporan keuangan berbasis posting.",
    source: "ERP GSP · Supabase",
    href: "/modul/akuntansi",
    icon: Calculator,
    status: "foundation",
  },
  {
    key: "manajemen",
    name: "Manajemen & Laporan",
    description: "Ringkasan lintas unit dengan akses sesuai wewenang.",
    source: "ERP GSP · Supabase",
    href: "/modul/manajemen",
    icon: ChartNoAxesCombined,
    status: "foundation",
  },
  {
    key: "struktur-perusahaan",
    name: "Struktur Perusahaan",
    description: "Satu perusahaan, pusat pengawasan, tiga cabang, dan penugasan akses.",
    source: "ERP GSP · Supabase",
    href: "/struktur-akses",
    icon: GitBranch,
    status: "foundation",
  },
]

export function getModule(key: string) {
  return modules.find((module) => module.key === key)
}
