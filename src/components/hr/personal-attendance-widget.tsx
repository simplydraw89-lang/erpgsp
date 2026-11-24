"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  Clock,
  Camera,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Building2,
  HardHat,
  Calendar,
  LogIn,
  LogOut,
  ChevronRight,
  ShieldCheck,
  X,
  Navigation,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { recordAttendanceAction } from "@/app/(workspace)/modul/hr-actions"

export interface SimpleAttendanceDay {
  work_date: string
  clock_in: string | null
  clock_out: string | null
  attendance_status: string
  attendance_type?: string | null
  work_summary?: string | null
  location_note?: string | null
  photo_data?: string | null
  reason?: string | null
}

interface PersonalAttendanceWidgetProps {
  todayAttendance: SimpleAttendanceDay | null
  yesterdayAttendance: SimpleAttendanceDay | null
  userName: string
}

export function PersonalAttendanceWidget({
  todayAttendance,
  yesterdayAttendance,
  userName,
}: PersonalAttendanceWidgetProps) {
  const [showModal, setShowModal] = useState(false)
  const [currentTime, setCurrentTime] = useState("")

  // Form State
  const [attendanceType, setAttendanceType] = useState<"office" | "site">("office")
  const [status, setStatus] = useState<string>("present")
  const [locationNote, setLocationNote] = useState<string>("")
  const [reason, setReason] = useState<string>("")
  const [workSummary, setWorkSummary] = useState<string>("")
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // Geolocation State
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  })
  const [geoStatus, setGeoStatus] = useState<string>("Mencari koordinat GPS...")
  const [geoAllowed, setGeoAllowed] = useState<boolean>(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  function requestLocation() {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      setGeoStatus("Mendeteksi titik koordinat HP/Laptop...")
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setGeoStatus(
            `📍 GPS Aktif (Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}) · Radius Kantor Terpenuhi (< 100m)`
          )
          setGeoAllowed(true)
        },
        (err) => {
          setGeoStatus("Izin GPS tidak diberikan. Pastikan GPS/Lokasi browser diaktifkan.")
          setGeoAllowed(false)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    } else {
      setGeoStatus("Perangkat tidak mendukung sensor Geolocation.")
    }
  }

  function handleOpenModal() {
    setShowModal(true)
    requestLocation()
  }

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setPhotoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const hasClockedIn = Boolean(todayAttendance?.clock_in)
  const hasClockedOut = Boolean(todayAttendance?.clock_out)

  return (
    <div className="space-y-4">
      {/* Kartu Ringkas Presensi Personal */}
      <Card className="overflow-hidden border-brand/20 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                Presensi Mandiri Karyawan
              </span>
              <span className="text-xs text-slate-400">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <h3 className="text-xl font-bold tracking-tight">Presensi Hari Ini: {userName}</h3>
            <p className="text-xs text-slate-300">
              Isi kehadiran mandiri langsung dari smartphone atau laptop Anda.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-2xl font-mono font-bold text-emerald-400 block">
                {currentTime || "--:--:--"}
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Waktu Lokal (WIB)</span>
            </div>

            <div>
              {!hasClockedIn ? (
                <Button
                  type="button"
                  onClick={handleOpenModal}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/30 px-4 py-2.5"
                >
                  <LogIn size={15} />
                  <span>Absen Masuk Sekarang</span>
                </Button>
              ) : !hasClockedOut ? (
                <Button
                  type="button"
                  onClick={handleOpenModal}
                  className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-md shadow-amber-600/30 px-4 py-2.5"
                >
                  <LogOut size={15} />
                  <span>Absen Pulang Sekarang</span>
                </Button>
              ) : (
                <div className="rounded-xl bg-white/10 px-3.5 py-2 text-center text-xs">
                  <span className="text-emerald-400 font-bold block">✓ Sudah Lengkap</span>
                  <span className="text-[10px] text-slate-300">Presensi hari ini selesai</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Ringkasan 2 Hari Terakhir Simpel (Hari Ini & Kemarin) */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Hari Ini */}
        <div className="rounded-xl border border-line bg-white p-4 space-y-2 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Calendar size={14} className="text-brand" />
              <span>Hari Ini ({new Date().toISOString().slice(0, 10)})</span>
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                hasClockedOut
                  ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  : hasClockedIn
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {hasClockedOut ? "Selesai Kerja" : hasClockedIn ? "Aktif Masuk" : "Belum Masuk"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
              <span className="text-[10px] text-muted block">Jam Masuk</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {todayAttendance?.clock_in
                  ? new Date(todayAttendance.clock_in).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--:--"}
              </span>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
              <span className="text-[10px] text-muted block">Jam Pulang</span>
              <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                {todayAttendance?.clock_out
                  ? new Date(todayAttendance.clock_out).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--:--"}
              </span>
            </div>
          </div>

          {todayAttendance?.location_note && (
            <p className="text-[11px] text-muted truncate">
              📍 {todayAttendance.attendance_type === "site" ? "[Site Lapangan] " : "[Kantor] "}
              {todayAttendance.location_note}
            </p>
          )}
        </div>

        {/* Kemarin (1 Hari Sebelumnya) */}
        <div className="rounded-xl border border-line bg-white p-4 space-y-2 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-400" />
              <span>Kemarin ({yesterdayAttendance?.work_date || "Hari Kerja Sebelumnya"})</span>
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Tercatat
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
              <span className="text-[10px] text-muted block">Jam Masuk</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {yesterdayAttendance?.clock_in
                  ? new Date(yesterdayAttendance.clock_in).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--:--"}
              </span>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
              <span className="text-[10px] text-muted block">Jam Pulang</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {yesterdayAttendance?.clock_out
                  ? new Date(yesterdayAttendance.clock_out).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--:--"}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-muted truncate">
            {yesterdayAttendance?.work_summary || "Presensi harian tercatat dalam sistem."}
          </p>
        </div>
      </div>

      {/* Modal Interaktif Pengisian Absen (Kamera Selfie & Geofencing GPS) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl text-slate-900 dark:bg-slate-900 dark:text-white space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Navigation size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">
                    {!hasClockedIn ? "Konfirmasi Absen Masuk" : "Konfirmasi Absen Pulang"}
                  </h3>
                  <p className="text-[11px] text-muted">Ambil foto selfie dan pilih lokasi kerja Anda</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-muted hover:text-ink p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form action={recordAttendanceAction} className="space-y-4">
              <input type="hidden" name="latitude" value={coords.lat || ""} />
              <input type="hidden" name="longitude" value={coords.lng || ""} />
              <input type="hidden" name="photo_data" value={photoPreview || ""} />

              {/* Pilihan Lokasi Kerja: Di Kantor vs Di Site */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-ink">
                  Pilih Lokasi Kerja Anda:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAttendanceType("office")
                      setStatus("present")
                    }}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3.5 text-center transition ${
                      attendanceType === "office"
                        ? "border-blue-600 bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:border-blue-500 dark:text-blue-300 ring-2 ring-blue-500/20"
                        : "border-line bg-white hover:bg-slate-50 dark:bg-slate-800"
                    }`}
                  >
                    <Building2 size={24} className={attendanceType === "office" ? "text-blue-600" : "text-muted"} />
                    <div>
                      <span className="text-xs font-bold block">Di Kantor</span>
                      <span className="text-[10px] text-muted">Radius 100m Kantor</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAttendanceType("site")
                      setStatus("field_trip")
                    }}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3.5 text-center transition ${
                      attendanceType === "site"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-500 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                        : "border-line bg-white hover:bg-slate-50 dark:bg-slate-800"
                    }`}
                  >
                    <HardHat size={24} className={attendanceType === "site" ? "text-emerald-600" : "text-muted"} />
                    <div>
                      <span className="text-xs font-bold block">Di Site / Lapangan</span>
                      <span className="text-[10px] text-muted">Seluruh Indonesia</span>
                    </div>
                  </button>
                </div>
                <input type="hidden" name="attendance_type" value={attendanceType} />
                <input type="hidden" name="attendance_status" value={status} />
              </div>

              {/* Status GPS Indikator */}
              <div className="rounded-xl border border-line bg-slate-50 p-3 text-xs space-y-1 dark:bg-slate-800">
                <div className="flex items-center gap-2 font-medium text-ink">
                  <MapPin size={14} className="text-brand shrink-0" />
                  <span>{geoStatus}</span>
                </div>
                {attendanceType === "office" ? (
                  <p className="text-[11px] text-blue-700 dark:text-blue-400">
                    ✓ Di kantor: Lokasi otomatis terkunci pada radius 100 meter dari smartphone/laptop. Tidak perlu mengisi alasan khusus.
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    ✓ Di site: Lokasi bebas di seluruh Indonesia (proyek/survei klien). Wajib mengisi nama site & alasan di bawah.
                  </p>
                )}
              </div>

              {/* Form Khusus Site Lapangan */}
              {attendanceType === "site" && (
                <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <div>
                    <label className="block text-xs font-bold text-emerald-950 dark:text-emerald-300">
                      Nama Site / Lokasi Proyek <span className="text-red-500">*</span>
                      <input
                        type="text"
                        name="location_note"
                        value={locationNote}
                        onChange={(e) => setLocationNote(e.target.value)}
                        required={attendanceType === "site"}
                        placeholder="Contoh: Site Tambang Kaltim / Kilang Balongan Pertamina"
                        className="mt-1 block w-full rounded-lg border border-emerald-300 bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-950 dark:text-emerald-300">
                      Alasan & Agenda Pekerjaan di Site <span className="text-red-500">*</span>
                      <textarea
                        name="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required={attendanceType === "site"}
                        rows={2}
                        placeholder="Tuliskan alasan penugasan / agenda teknis di site..."
                        className="mt-1 block w-full rounded-lg border border-emerald-300 bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Rencana Aktivitas / Catatan Singkat */}
              <div>
                <label className="block text-xs font-medium text-ink">
                  Ringkasan Aktivitas Kerja Hari Ini (Opsional)
                  <input
                    type="text"
                    name="work_summary"
                    value={workSummary}
                    onChange={(e) => setWorkSummary(e.target.value)}
                    placeholder="Contoh: Koordinasi teknis, penyusunan laporan, audit data"
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                  />
                </label>
              </div>

              {/* Kamera Selfie / Ambil Foto */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-ink">
                  Foto Selfie / Bukti Kehadiran (Kamera HP/Laptop):
                </label>

                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  ref={fileInputRef}
                  onChange={handlePhotoCapture}
                  className="hidden"
                />

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2 text-xs font-semibold"
                  >
                    <Camera size={15} />
                    <span>{photoPreview ? "Ambil Ulang Foto" : "Buka Kamera & Foto Selfie"}</span>
                  </Button>

                  {photoPreview && (
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={13} /> Foto Siap
                    </span>
                  )}
                </div>

                {photoPreview && (
                  <div className="relative mt-2 size-28 overflow-hidden rounded-xl border border-line shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt="Selfie Presensi"
                      className="size-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Tombol Simpan Presensi */}
              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowModal(false)}
                >
                  Batal
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  className={`gap-1.5 text-white ${
                    !hasClockedIn
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  <CheckCircle2 size={14} />
                  <span>
                    {!hasClockedIn
                      ? "Kirim & Verifikasi Absen Masuk"
                      : "Kirim & Verifikasi Absen Pulang"}
                  </span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
