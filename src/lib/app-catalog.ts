import {
  BookOpen,
  BriefcaseBusiness,
  Calculator,
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  ContactRound,
  CreditCard,
  FilePenLine,
  FileText,
  Landmark,
  ReceiptText,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react"
import type { OrganizationRole } from "@/lib/auth/context"

export const roleLabels: Record<OrganizationRole, string> = {
  owner: "Superuser",
  director: "Direksi",
  finance: "Keuangan",
  hr: "SDM",
  operations: "Operasional",
  auditor: "Auditor",
  staff: "Staf",
}
const everyone: OrganizationRole[] = [
  "owner",
  "director",
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
        name: "Pengajuan saya",
        href: "/approvals?scope=mine",
        icon: FileText,
        roles: everyone,
        description: "Pantau pengajuan dan keputusan Anda",
      },
      {
        name: "Persetujuan",
        href: "/approvals?scope=review",
        icon: ClipboardCheck,
        roles: everyone,
        description: "Permintaan yang perlu Anda periksa",
      },
      {
        name: "Draft saya",
        href: "/approvals?scope=drafts",
        icon: FilePenLine,
        roles: everyone,
        description: "Lanjutkan dokumen yang belum diajukan",
      },
    ],
  },
  {
    id: "finance",
    name: "Keuangan",
    tone: "blue",
    apps: [
      {
        name: "Accounting",
        href: "/modul/keuangan",
        icon: Calculator,
        roles: ["owner", "director", "finance", "auditor"],
        description: "Bagan akun keuangan",
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
    name: "SDM",
    tone: "pink",
    apps: [
      {
        name: "Data Karyawan",
        href: "/modul/sdm",
        icon: UsersRound,
        roles: ["owner", "director", "hr"],
        description: "Data dasar dan status karyawan",
      },
    ],
  },
  {
    id: "operations",
    name: "Operasional",
    tone: "green",
    apps: [
      {
        name: "Pekerjaan",
        href: "/modul/operasional",
        icon: ClipboardList,
        roles: everyone,
        description: "Pekerjaan, prioritas, dan penanggung jawab",
      },
      {
        name: "Proyek",
        href: "/modul/crm?type=project",
        icon: BriefcaseBusiness,
        roles: everyone,
        description: "Daftar proyek dan klien terkait",
      },
      {
        name: "CRM & Klien",
        href: "/modul/crm?type=client",
        icon: ContactRound,
        roles: everyone,
        description: "Kontak, prospek, dan klien perusahaan",
      },
    ],
  },
  {
    id: "system",
    name: "Bantuan dan sistem",
    tone: "slate",
    apps: [
      {
        name: "Kebijakan Approval",
        href: "/pengaturan/persetujuan",
        icon: Settings2,
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

export function getApplicationGroups(role: OrganizationRole) {
  return applicationGroups
    .map((group) => ({
      ...group,
      apps: group.apps.filter((app) =>
        (app.roles as readonly string[]).includes(role),
      ),
    }))
    .filter((group) => group.apps.length > 0)
}

export function getApplications(role: OrganizationRole) {
  return getApplicationGroups(role).flatMap((group) =>
    group.apps.map((app) => ({ ...app, group: group.name })),
  )
}
