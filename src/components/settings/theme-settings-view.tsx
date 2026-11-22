"use client"

import React from "react"
import {
  Sun,
  Moon,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Sliders,
  Laptop,
  ArrowRight,
  Info,
} from "lucide-react"
import { useTheme, type ThemePreference } from "@/lib/theme-context"
import { Card } from "@/components/ui/card"
import { NavigationLink as Link } from "@/components/ui/navigation-link"

interface ThemeSettingsViewProps {
  userName: string
  email: string
  roleLabel: string
  organizationName: string
}

export function ThemeSettingsView({
  userName,
  email,
  roleLabel,
  organizationName,
}: ThemeSettingsViewProps) {
  const { preference, resolvedTheme, setPreference } = useTheme()

  const themeOptions: {
    id: ThemePreference
    title: string
    subtitle: string
    description: string
    icon: typeof Sun
    accentColor: string
    badgeText?: string
    previewBg: string
    previewBorder: string
  }[] = [
    {
      id: "light",
      title: "1. Mode Terang",
      subtitle: "Standar Default (Direkomendasikan)",
      description:
        "Tampilan visual cerah dengan latar belakang putih bersih dan kontras standar. Sangat nyaman untuk aktivitas operasional harian, akuntansi, dan penginputan data.",
      icon: Sun,
      accentColor: "text-amber-500",
      badgeText: "Default Sistem",
      previewBg: "bg-gradient-to-br from-slate-50 to-white",
      previewBorder: "border-amber-300",
    },
    {
      id: "dark",
      title: "2. Mode Gelap",
      subtitle: "Deep Slate (Nyaman di Mata)",
      description:
        "Tampilan visual bernuansa deep slate modern yang teduh di mata dan hemat daya. Mengurangi ketegangan mata saat bekerja di ruangan redup tanpa merusak kontras formulir.",
      icon: Moon,
      accentColor: "text-indigo-400",
      previewBg: "bg-gradient-to-br from-slate-900 to-slate-950",
      previewBorder: "border-indigo-500",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="rounded-2xl border border-line bg-gradient-to-r from-teal-500/10 via-emerald-50/40 to-transparent p-6 shadow-sm dark:border-slate-800 dark:from-teal-950/40 dark:via-slate-900/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800 dark:bg-teal-950/80 dark:text-teal-300">
                <Sliders className="size-3.5" />
                Bantuan & Sistem
              </span>
              <span className="text-xs text-muted">· Konfigurasi Pengguna</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-3xl">
              Pengaturan Tampilan & Sistem
            </h1>
            <p className="mt-1 text-sm text-muted max-w-2xl leading-relaxed">
              Sesuaikan preferensi visual (mode terang atau mode gelap) untuk kenyamanan kerja optimal Anda di seluruh modul ERP GSP.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-line bg-white/80 px-4 py-2 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <Sparkles className="size-4 text-teal-600 dark:text-teal-400" />
            <div>
              <p className="font-semibold text-ink">Status Tampilan:</p>
              <p className="text-muted capitalize">Mode {resolvedTheme === "dark" ? "Gelap (Dark)" : "Terang (Light)"} Aktif</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bagian 1: Pengaturan Mode Tampilan (Tema) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-ink flex items-center gap-2">
            <span>Mode Tampilan (Tema Antarmuka)</span>
            <span className="text-xs font-normal text-muted">
              · Pilih salah satu mode di bawah ini
            </span>
          </h2>
          <p className="text-xs text-muted">
            Perubahan diterapkan secara instan tanpa perlu memuat ulang halaman secara manual.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {themeOptions.map((opt) => {
            const isSelected = preference === opt.id
            const Icon = opt.icon

            return (
              <div
                key={opt.id}
                role="button"
                tabIndex={0}
                onClick={() => setPreference(opt.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setPreference(opt.id)
                  }
                }}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 cursor-pointer text-left select-none ${
                  isSelected
                    ? "border-teal-600 bg-teal-50/40 shadow-lg shadow-teal-500/10 ring-2 ring-teal-500/30 dark:border-teal-500 dark:bg-teal-950/30"
                    : "border-line bg-white hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex size-11 items-center justify-center rounded-xl border ${opt.previewBorder} ${opt.previewBg} shadow-sm`}
                      >
                        <Icon className={`size-5 ${opt.accentColor}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-ink text-sm sm:text-base">
                          {opt.title}
                        </h3>
                        <p className="text-xs text-muted">{opt.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {opt.badgeText && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {opt.badgeText}
                        </span>
                      )}
                      {isSelected ? (
                        <CheckCircle2 className="size-5 text-teal-600 dark:text-teal-400" />
                      ) : (
                        <div className="size-5 rounded-full border border-slate-300 dark:border-slate-700" />
                      )}
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-muted leading-relaxed">
                    {opt.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-line/60 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-muted">
                    {isSelected ? "Sedang Digunakan" : "Klik untuk memilih"}
                  </span>
                  <span
                    className={`font-semibold ${
                      isSelected ? "text-teal-600 dark:text-teal-400" : "text-muted"
                    }`}
                  >
                    {isSelected ? "Aktif ✓" : "Pilih Mode"}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Info Box Kenyamanan Tampilan */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-200/80 bg-blue-50/70 p-4 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
          <Info className="size-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
          <div className="space-y-1">
            <p className="font-semibold">Catatan Kenyamanan Penggunaan:</p>
            <p className="text-blue-800/90 dark:text-blue-300/90 leading-relaxed">
              Preferensi mode tampilan disimpan otomatis pada browser Anda. Anda juga dapat mengganti tema kapan saja melalui ikon matahari/bulan pada bilah atas (topbar) di setiap halaman.
            </p>
          </div>
        </div>
      </section>

      {/* Bagian 2: Profil & Hak Akses Pengguna */}
      <section className="space-y-4 pt-2">
        <div>
          <h2 className="text-lg font-bold text-ink">Informasi Akun & Peran Pengguna</h2>
          <p className="text-xs text-muted">
            Informasi akun yang saat ini terautentikasi pada workspace ERP.
          </p>
        </div>

        <Card className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-line dark:border-slate-700/60">
              <span className="text-muted block text-[11px]">Nama Pengguna:</span>
              <span className="font-bold text-ink text-sm mt-0.5 block">{userName}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-line dark:border-slate-700/60">
              <span className="text-muted block text-[11px]">Email Terdaftar:</span>
              <span className="font-bold text-ink text-sm mt-0.5 block truncate">{email}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-line dark:border-slate-700/60">
              <span className="text-muted block text-[11px]">Peran Utama (Role):</span>
              <span className="font-bold text-ink text-sm mt-0.5 block">{roleLabel}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-line dark:border-slate-700/60">
              <span className="text-muted block text-[11px]">Perusahaan / Cabang:</span>
              <span className="font-bold text-ink text-sm mt-0.5 block">{organizationName}</span>
            </div>
          </div>
        </Card>
      </section>

      {/* Bagian 3: Navigasi Pengaturan & Kebijakan Terkait */}
      <section className="space-y-4 pt-2">
        <div>
          <h2 className="text-lg font-bold text-ink">Pengaturan Sistem Terkait</h2>
          <p className="text-xs text-muted">
            Pusat konfigurasi aturan operasional, alur verifikasi dokumen, dan buku panduan kerja.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <Link
            href="/pengaturan/persetujuan"
            className="flex flex-col justify-between rounded-xl border border-line bg-white p-4 shadow-sm transition hover:border-teal-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold">
                <Sliders className="size-4" />
                <span>Kebijakan Approval</span>
              </div>
              <p className="mt-1 text-muted text-[11px] leading-relaxed">
                Kelola pemeriksa dokumen pengajuan (SPH, SPK, invoice vendor) dan aturan eskalasi nominal.
              </p>
            </div>
            <span className="mt-3 text-teal-700 dark:text-teal-400 font-medium inline-flex items-center gap-1">
              Buka aturan approval <ArrowRight className="size-3" />
            </span>
          </Link>

          <Link
            href="/struktur-akses"
            className="flex flex-col justify-between rounded-xl border border-line bg-white p-4 shadow-sm transition hover:border-teal-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold">
                <ShieldCheck className="size-4" />
                <span>Struktur & Hak Akses</span>
              </div>
              <p className="mt-1 text-muted text-[11px] leading-relaxed">
                Pengaturan penugasan multi-cabang, delegasi wewenang individu, dan otorisasi manajemen.
              </p>
            </div>
            <span className="mt-3 text-blue-700 dark:text-blue-400 font-medium inline-flex items-center gap-1">
              Kelola struktur akses <ArrowRight className="size-3" />
            </span>
          </Link>

          <Link
            href="/panduan"
            className="flex flex-col justify-between rounded-xl border border-line bg-white p-4 shadow-sm transition hover:border-teal-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
                <Laptop className="size-4" />
                <span>Buku Panduan ERP</span>
              </div>
              <p className="mt-1 text-muted text-[11px] leading-relaxed">
                Dokumentasi langkah demi langkah penggunaan modul pengajuan, persetujuan, dan portal proyek.
              </p>
            </div>
            <span className="mt-3 text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1">
              Baca panduan <ArrowRight className="size-3" />
            </span>
          </Link>
        </div>
      </section>
    </div>
  )
}
