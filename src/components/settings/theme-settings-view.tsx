"use client"

import React from "react"
import {
  Sun,
  Moon,
  Clock,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  User,
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
  const { preference, resolvedTheme, setPreference, currentHour, isDaytime } = useTheme()

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
      subtitle: "Selalu Cerah (Light Mode)",
      description:
        "Tampilan visual cerah dengan latar belakang putih bersih dan kontras standar. Direkomendasikan untuk aktivitas kerja di siang hari atau ruangan dengan pencahayaan terang.",
      icon: Sun,
      accentColor: "text-amber-500",
      previewBg: "bg-gradient-to-br from-slate-50 to-white",
      previewBorder: "border-amber-300",
    },
    {
      id: "dark",
      title: "2. Mode Gelap",
      subtitle: "Selalu Gelap (Dark Mode)",
      description:
        "Tampilan visual bernuansa deep slate yang teduh di mata dan hemat daya. Mengurangi ketegangan mata saat lembur atau penggunaan di ruangan redup.",
      icon: Moon,
      accentColor: "text-indigo-400",
      previewBg: "bg-gradient-to-br from-slate-900 to-slate-950",
      previewBorder: "border-indigo-500",
    },
    {
      id: "time",
      title: "3. Mode Sesuai Waktu",
      subtitle: "Otomatis Siang & Malam",
      description:
        "Sistem berpindah secara dinamis mengikuti jam lokal Anda: Mode Terang dari pukul 06:00 s/d 18:00, dan otomatis berganti ke Mode Gelap dari pukul 18:00 s/d 06:00.",
      icon: Clock,
      accentColor: "text-teal-600 dark:text-teal-400",
      badgeText: isDaytime ? "Sedang Siang (Terang)" : "Sedang Malam (Gelap)",
      previewBg: "bg-gradient-to-br from-teal-900/30 via-slate-900/40 to-amber-900/20",
      previewBorder: "border-teal-500",
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
              Sesuaikan preferensi visual (mode terang, mode gelap, atau otomatis sesuai waktu) untuk kenyamanan kerja optimal Anda di seluruh modul ERP GSP.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-line bg-white/80 px-4 py-2 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <Sparkles className="size-4 text-teal-600 dark:text-teal-400" />
            <div>
              <p className="font-semibold text-ink">Waktu Sistem Lokal:</p>
              <p className="text-muted">{String(currentHour).padStart(2, "0")}:00 WIB ({isDaytime ? "Siang" : "Malam"})</p>
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
            Perubahan diterapkan secara instan tanpa perlu memuat ulang halaman dan tersimpan permanen di perangkat ini.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {themeOptions.map((opt) => {
            const isSelected = preference === opt.id
            const Icon = opt.icon

            return (
              <div
                key={opt.id}
                onClick={() => {
                  setPreference(opt.id)
                  setTimeout(() => {
                    window.location.reload()
                  }, 120)
                }}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all cursor-pointer select-none ${
                  isSelected
                    ? "border-teal-600 bg-white shadow-md ring-2 ring-teal-500/30 dark:border-teal-400 dark:bg-slate-900"
                    : "border-line bg-white/70 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                }`}
              >
                <div>
                  {/* Top Header of Card */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-line dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex size-9 items-center justify-center rounded-xl border ${opt.previewBorder} ${opt.previewBg}`}
                      >
                        <Icon className={`size-5 ${opt.accentColor}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-ink">{opt.title}</h3>
                        <p className="text-[11px] text-muted">{opt.subtitle}</p>
                      </div>
                    </div>

                    <div
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isSelected
                          ? "border-teal-600 bg-teal-600 text-white dark:border-teal-400 dark:bg-teal-400 dark:text-slate-950"
                          : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="size-4" />}
                    </div>
                  </div>

                  {/* Narasi Penjelasan */}
                  <p className="mt-3 text-xs leading-relaxed text-muted">
                    {opt.description}
                  </p>

                  {/* Info Khusus Mode Waktu */}
                  {opt.id === "time" && (
                    <div className="mt-3 rounded-xl border border-teal-200/80 bg-teal-50/70 p-2.5 text-[11px] text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-200">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1">
                          <Clock className="size-3.5" /> Status Otomatis:
                        </span>
                        <span className="font-bold">
                          {isDaytime ? "☀️ Terang (06-18)" : "🌙 Gelap (18-06)"}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-teal-700 dark:text-teal-300">
                        Jam saat ini: <strong>{String(currentHour).padStart(2, "0")}:00 WIB</strong>. Tampilan aktif: <strong>{resolvedTheme === "light" ? "Mode Terang" : "Mode Gelap"}</strong>.
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer status button */}
                <div className="mt-4 pt-3 border-t border-line dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-medium text-muted">
                    {isSelected ? "Sedang Digunakan" : "Klik untuk Pilih"}
                  </span>
                  <span
                    className={`font-semibold text-xs ${
                      isSelected ? "text-teal-600 dark:text-teal-400" : "text-slate-400"
                    }`}
                  >
                    {isSelected ? "Aktif ✓" : "Gunakan →"}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
          <Info className="size-4 shrink-0 text-teal-600 dark:text-teal-400" />
          <span>
            <strong>Tips:</strong> Anda juga dapat mengganti tema secara cepat kapan saja melalui <strong>tombol tema</strong> yang ada di bar navigasi kanan atas.
          </span>
        </div>
      </section>

      {/* Bagian 2: Profil & Lingkup Akun */}
      <section className="space-y-4 pt-2">
        <div>
          <h2 className="text-lg font-bold text-ink">Profil & Status Akses</h2>
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
