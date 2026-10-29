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
  status: "foundation" | "integration"
}

export const modules: ModuleDefinition[] = [
  {
    key: "crm",
    name: "CRM & Proyek",
    description: "Prospek, klien, penawaran, proyek, dan dokumen operasional.",
    source: "GSP-staging",
    href: "/modul/crm",
    icon: ContactRound,
    status: "integration",
  },
  {
    key: "operasional",
    name: "Operasional",
    description: "Alur kerja, persetujuan, aktivitas proyek, dan kontrol proses.",
    source: "GSP-staging",
    href: "/modul/operasional",
    icon: BriefcaseBusiness,
    status: "integration",
  },
  {
    key: "keuangan",
    name: "Keuangan & Akuntansi",
    description: "COA, jurnal, kas-bank, laporan keuangan, dan konsolidasi.",
    source: "bindex-main",
    href: "/modul/keuangan",
    icon: Calculator,
    status: "integration",
  },
  {
    key: "sdm",
    name: "SDM",
    description: "Data karyawan, peran, penugasan, dan fondasi pengelolaan SDM.",
    source: "bindex-main · GSP-staging",
    href: "/modul/sdm",
    icon: UsersRound,
    status: "integration",
  },
  {
    key: "perpajakan",
    name: "Perpajakan",
    description: "Kalkulasi pajak, rekonsiliasi, pelaporan, dan ekspor Coretax.",
    source: "aplikasi-pajak",
    href: "/modul/perpajakan",
    icon: ClipboardCheck,
    status: "integration",
  },
  {
    key: "manajemen",
    name: "Manajemen & Laporan",
    description: "Ringkasan lintas unit dengan akses sesuai wewenang.",
    source: "Fondasi baru",
    href: "/modul/manajemen",
    icon: ChartNoAxesCombined,
    status: "foundation",
  },
]

export function getModule(key: string) {
  return modules.find((module) => module.key === key)
}
