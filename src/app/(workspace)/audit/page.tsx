import { ShieldAlert, ShieldCheck, Lock, UserCheck, AlertTriangle, Globe, MonitorSmartphone } from "lucide-react"
import { requireWorkspace } from "@/lib/auth/context"
import { Card } from "@/components/ui/card"

type SecuritySummary = {
  success_24h: number
  failed_24h: number
  outsider_attempts_7d: number
  active_users_7d: number
}

type SecurityAttemptRow = {
  log_id: string
  created_at: string
  email: string
  full_name: string
  member_role: string
  status: "success" | "failed"
  method: string
  failure_reason: string | null
  ip_address: string
  user_agent: string
  is_known_member: boolean
}

type UserSessionRow = {
  user_id: string
  email: string
  full_name: string
  member_role: string
  job_roles: string
  last_sign_in_at: string | null
  registered_at: string
  is_demo: boolean
  success_count_7d: number
  failed_count_7d: number
  last_ip_address: string | null
}

type SecurityOverviewPayload = {
  summary: SecuritySummary
  recent_attempts: SecurityAttemptRow[]
  user_sessions: UserSessionRow[]
}

function summarizeUserAgent(ua: string | null | undefined): string {
  if (!ua || ua === "-" || ua === "unknown") return "-"
  const lower = ua.toLowerCase()
  const os = lower.includes("windows")
    ? "Windows"
    : lower.includes("android")
    ? "Android"
    : lower.includes("iphone") || lower.includes("ipad")
    ? "iOS"
    : lower.includes("mac os") || lower.includes("macintosh")
    ? "macOS"
    : lower.includes("linux")
    ? "Linux"
    : "Perangkat Lain"

  const browser = lower.includes("edg/")
    ? "Edge"
    : lower.includes("opr/") || lower.includes("opera")
    ? "Opera"
    : lower.includes("chrome/") && !lower.includes("edg/")
    ? "Chrome"
    : lower.includes("firefox/")
    ? "Firefox"
    : lower.includes("safari/") && !lower.includes("chrome/")
    ? "Safari"
    : "Browser"

  return `${os} · ${browser}`
}

function formatMethodLabel(method: string): string {
  const m = (method || "").toLowerCase()
  if (m === "password" || m === "email") return "Email & Password"
  if (m === "demo_button") return "Tombol Pratinjau Demo"
  if (m === "google" || m === "google_oauth") return "Google OAuth"
  if (m === "login") return "Login Auth"
  if (m === "token_revoked") return "Logout / Cabut Sesi"
  if (m === "user_recovery_requested") return "Reset Password"
  return method
}

export default async function AuditPage() {
  const { supabase, organizationId, isSuperAdmin } = await requireWorkspace()

  const { data: events, error } = await supabase
    .from("audit_events")
    .select("id, action, entity_type, entity_id, actor_id, details, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Gagal memuat jejak audit: ${error.message}`)
  }

  // Hanya dieksekusi jika pengguna adalah SUPER ADMIN murni (role = 'owner', bukan Direksi/Admin/Demo)
  let securityData: SecurityOverviewPayload | null = null
  let securityMigrationPending = false

  if (isSuperAdmin) {
    const { data: rawSecurity, error: secError } = await supabase.rpc(
      "api_super_admin_security_overview",
      { p_org: organizationId }
    )
    if (secError) {
      securityMigrationPending = true
    } else if (rawSecurity) {
      securityData = rawSecurity as SecurityOverviewPayload
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-brand">Akuntabilitas & Keamanan</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Jejak Audit</h1>
        <p className="mt-2 text-sm text-muted">
          Catatan keputusan lintas modul yang tersedia untuk peran berwenang.
        </p>
      </div>

      {/* ====================================================================
          PANEL EKSKLUSIF SUPER ADMIN: PANTAUAN LOGIN & PERCOBAAN MASUK
          (Tingkat Admin hingga Direktur sama sekali tidak dapat melihat ini)
         ==================================================================== */}
      {isSuperAdmin && (
        <section className="space-y-4 rounded-2xl border-2 border-slate-900/15 bg-slate-950/[0.02] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                <Lock className="size-3.5" />
                <span>Khusus Super Admin · Rahasia</span>
              </div>
              <h2 className="text-xl font-bold text-ink">
                Pantauan Login & Deteksi Percobaan Masuk
              </h2>
              <p className="text-xs text-muted">
                Panel ini hanya terlihat oleh <strong>Super Admin</strong>. Tingkat Admin, Manager, Finance, hingga Direksi tidak memiliki akses ke panel maupun data ini.
              </p>
            </div>
          </div>

          {securityMigrationPending ? (
            <Card className="border-amber-300 bg-amber-50/70 p-4 text-xs text-amber-900">
              <p className="font-semibold">
                Migrasi Tabel Pantauan Keamanan Belum Dijalankan di Supabase
              </p>
              <p className="mt-1">
                Jalankan file migrasi{" "}
                <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono">
                  supabase/migrations/20261110050000_super_admin_login_security_monitor.sql
                </code>{" "}
                di Supabase SQL Editor untuk mengaktifkan pencatatan riwayat login, deteksi percobaan gagal, dan pelacakan alamat IP.
              </p>
            </Card>
          ) : securityData ? (
            <div className="space-y-6">
              {/* 4 Indikator Keamanan Utama */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between text-xs font-medium text-muted">
                    <span>Login Berhasil (24 Jam)</span>
                    <UserCheck className="size-4 text-emerald-600" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-emerald-700">
                    {securityData.summary?.success_24h ?? 0}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Sesi autentikasi valid dalam 24 jam terakhir
                  </p>
                </Card>

                <Card
                  className={`p-4 ${
                    (securityData.summary?.failed_24h ?? 0) > 0
                      ? "border-red-300 bg-red-50/40"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-medium text-muted">
                    <span>Percobaan Gagal / Ditolak (24 Jam)</span>
                    <ShieldAlert className="size-4 text-red-600" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-red-600">
                    {securityData.summary?.failed_24h ?? 0}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Salah kata sandi atau kredensial ditolak sistem
                  </p>
                </Card>

                <Card
                  className={`p-4 ${
                    (securityData.summary?.outsider_attempts_7d ?? 0) > 0
                      ? "border-amber-300 bg-amber-50/40"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-medium text-muted">
                    <span>Percobaan Email Asing / Luar (7 Hari)</span>
                    <AlertTriangle className="size-4 text-amber-600" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-amber-700">
                    {securityData.summary?.outsider_attempts_7d ?? 0}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Percobaan masuk memakai email di luar organisasi
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between text-xs font-medium text-muted">
                    <span>Akun Internal Aktif (7 Hari)</span>
                    <ShieldCheck className="size-4 text-blue-600" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-ink">
                    {securityData.summary?.active_users_7d ?? 0}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Jumlah anggota organisasi yang login minggu ini
                  </p>
                </Card>
              </div>

              {/* Tabel 1: Status Login Terakhir Seluruh Akun Terdaftar */}
              <Card className="overflow-hidden">
                <div className="border-b border-line bg-slate-50/60 px-5 py-3.5">
                  <h3 className="text-sm font-bold text-ink">
                    Status Login Terakhir Akun Organisasi
                  </h3>
                  <p className="text-xs text-muted">
                    Memantau siapa saja anggota yang pernah login, waktu akses terakhir, dan indikasi gagal password per akun.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-line bg-slate-50/40 text-[11px] uppercase tracking-wider text-muted">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Pengguna</th>
                        <th className="px-4 py-3 font-semibold">Peran / Jabatan</th>
                        <th className="px-4 py-3 font-semibold">Terakhir Login (WIB)</th>
                        <th className="px-4 py-3 font-semibold">IP Terakhir</th>
                        <th className="px-4 py-3 text-center font-semibold">Login 7 Hari</th>
                        <th className="px-4 py-3 text-center font-semibold">Gagal 7 Hari</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {securityData.user_sessions?.map((u) => (
                        <tr key={u.user_id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-semibold text-ink">{u.full_name}</p>
                                <p className="font-mono text-[11px] text-muted">{u.email}</p>
                              </div>
                              {u.is_demo && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                  DEMO READ-ONLY
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {u.member_role === "owner" ? "Super Admin" : u.job_roles}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-ink">
                            {u.last_sign_in_at ? (
                              <span className="font-medium text-emerald-700">
                                {new Date(u.last_sign_in_at).toLocaleString("id-ID", {
                                  dateStyle: "medium",
                                  timeStyle: "medium",
                                })}
                              </span>
                            ) : (
                              <span className="text-muted">Belum pernah login</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-muted">
                            {u.last_ip_address ?? "-"}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-emerald-700">
                            {u.success_count_7d}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {u.failed_count_7d > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                                {u.failed_count_7d}x gagal
                              </span>
                            ) : (
                              <span className="text-muted">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Tabel 2: Log Real-Time Aktivitas Login & Percobaan Masuk (Berhasil & Gagal) */}
              <Card className="overflow-hidden">
                <div className="border-b border-line bg-slate-50/60 px-5 py-3.5">
                  <h3 className="text-sm font-bold text-ink">
                    Log Real-Time Aktivitas Login & Percobaan Masuk (100 Terakhir)
                  </h3>
                  <p className="text-xs text-muted">
                    Mencatat seluruh login yang berhasil maupun percobaan gagal (salah kata sandi / email tidak dikenal dari pihak luar).
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-line bg-slate-50/40 text-[11px] uppercase tracking-wider text-muted">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Waktu (WIB)</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Email / Identitas yang Dicoba</th>
                        <th className="px-4 py-3 font-semibold">Metode</th>
                        <th className="px-4 py-3 font-semibold">IP & Perangkat</th>
                        <th className="px-4 py-3 font-semibold">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {!securityData.recent_attempts?.length && (
                        <tr>
                          <td colSpan={6} className="px-5 py-10 text-center text-muted">
                            Belum ada catatan percobaan login.
                          </td>
                        </tr>
                      )}
                      {securityData.recent_attempts?.map((attempt) => {
                        const isFailed = attempt.status === "failed"
                        const isOutsider = !attempt.is_known_member
                        return (
                          <tr
                            key={attempt.log_id}
                            className={
                              isFailed
                                ? "bg-red-50/40 hover:bg-red-50/70"
                                : "hover:bg-slate-50/50"
                            }
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-[11px] text-ink">
                              {new Date(attempt.created_at).toLocaleString("id-ID", {
                                dateStyle: "medium",
                                timeStyle: "medium",
                              })}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {isFailed ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                                  <ShieldAlert className="size-3" />
                                  GAGAL / DITOLAK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                                  <ShieldCheck className="size-3" />
                                  BERHASIL
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-ink">
                                  {attempt.full_name}
                                </span>
                                {isOutsider && (
                                  <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                                    Pihak Luar / Email Asing
                                  </span>
                                )}
                              </div>
                              <p className="font-mono text-[11px] text-muted">
                                {attempt.email}
                              </p>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-[11px] text-ink">
                              {formatMethodLabel(attempt.method)}
                            </td>
                            <td className="px-4 py-3 text-[11px]">
                              <div className="flex items-center gap-1 font-mono text-ink">
                                <Globe className="size-3 text-muted" />
                                <span>{attempt.ip_address || "-"}</span>
                              </div>
                              <div
                                className="mt-0.5 flex items-center gap-1 text-muted"
                                title={attempt.user_agent || undefined}
                              >
                                <MonitorSmartphone className="size-3 shrink-0" />
                                <span>{summarizeUserAgent(attempt.user_agent)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[11px]">
                              {attempt.failure_reason ? (
                                <span className="font-medium text-red-700">
                                  {attempt.failure_reason}
                                </span>
                              ) : (
                                <span className="text-muted">Autentikasi berhasil</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : null}
        </section>
      )}

      {/* ====================================================================
          JEJAK AUDIT KEPUTUSAN MODUL (Tersedia untuk Peran Berwenang)
         ==================================================================== */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Riwayat Keputusan & Aktivitas Modul</h2>
          <p className="text-xs text-muted">
            Jejak perubahan dokumen, persetujuan pengajuan, dan penjurnalan sistem.
          </p>
        </div>
        <Card className="divide-y divide-line">
          {!events?.length && (
            <p className="px-6 py-14 text-center text-sm text-muted">Belum ada aktivitas audit.</p>
          )}
          {events?.map((event) => (
            <article key={event.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold capitalize text-ink">
                  {event.action.replaceAll("_", " ")} · {event.entity_type}
                </p>
                <p className="mt-1 font-mono text-xs text-muted">{event.entity_id}</p>
                {event.details?.note && (
                  <p className="mt-2 text-sm text-muted">{event.details.note}</p>
                )}
              </div>
              <time className="shrink-0 text-xs text-muted">
                {new Date(event.created_at).toLocaleString("id-ID")}
              </time>
            </article>
          ))}
        </Card>
      </section>
    </div>
  )
}
