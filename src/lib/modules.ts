import {
  BriefcaseBusiness,
  Calculator,
  ChartNoAxesCombined,
  ClipboardCheck,
  ContactRound,
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
    key: "crm",
    name: "CRM & Proyek",
    description: "Catat kontak/prospek dan proyek; penawaran dan dokumen menyusul.",
    source: "ERP GSP · Supabase",
    href: "/modul/crm",
    icon: ContactRound,
    status: "mvp",
  },
  {
    key: "operasional",
    name: "Operasional",
    description: "Catat pekerjaan, prioritas, dan tenggat; workflow lanjutan menyusul.",
    source: "ERP GSP · Supabase",
    href: "/modul/operasional",
    icon: BriefcaseBusiness,
    status: "mvp",
  },
  {
    key: "keuangan",
    name: "Keuangan & Akuntansi",
    description: "Kelola bagan akun dasar; jurnal dan posting akuntansi menyusul.",
    source: "ERP GSP · Supabase",
    href: "/modul/keuangan",
    icon: Calculator,
    status: "mvp",
  },
  {
    key: "sdm",
    name: "SDM",
    description: "Catat data dasar karyawan; payroll dan absensi menyusul.",
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
    key: "manajemen",
    name: "Manajemen & Laporan",
    description: "Ringkasan lintas unit dengan akses sesuai wewenang.",
    source: "ERP GSP · Supabase",
    href: "/modul/manajemen",
    icon: ChartNoAxesCombined,
    status: "foundation",
  },
]

export function getModule(key: string) {
  return modules.find((module) => module.key === key)
}
