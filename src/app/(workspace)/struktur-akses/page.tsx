import Link from "next/link"
import { Card } from "@/components/ui/card"
import { requireWorkspace } from "@/lib/auth/context"
import { ProcurementMessage, ProcurementUnavailable } from "@/components/procurement/section-nav"
import { SubmitButton } from "@/components/procurement/submit-button"
import { jobLabels, relationshipLabels, isProcurementMissing, procurementInput as input, procurementLabel as label } from "@/lib/procurement-ui"
import { linkBusinessUnit, removeWorkAssignment, syncAuthUsersAction, updateMemberRelationshipAction } from "./actions"
import { MultiAssignmentForm } from "./multi-assignment-form"

export default async function AccessStructurePage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const q = await searchParams
  const { supabase, organizationId, organizationName, actorRole, isReadOnlyPreview } = await requireWorkspace()
  
  const [units, members, profiles, assignments, entities, orgUsersRes, publicProfilesRes] = await Promise.all([
    supabase.from("business_units").select("id,code,name,kind,entity_id").eq("organization_id", organizationId).order("code"),
    supabase.from("organization_members").select("user_id,role").eq("organization_id", organizationId),
    supabase.from("person_profiles").select("user_id,relationship_status").eq("organization_id", organizationId),
    supabase.from("work_assignments").select("id,user_id,branch_id,job_role").eq("organization_id", organizationId),
    supabase.from("company_entities").select("id,entity_code,legal_name,entity_type,parent_entity_id").eq("organization_id", organizationId).order("entity_code"),
    supabase.rpc("list_organization_users", { p_org: organizationId }),
    supabase.from("profiles").select("id,full_name,employment_type"),
  ])

  const errors = [units.error, members.error, profiles.error, assignments.error, entities.error]
  const missing = errors.some(isProcurementMissing)
  if (!missing && errors.some(Boolean)) throw new Error("Struktur akses gagal dimuat.")

  const branches = (units.data ?? []).filter(u => u.kind === "branch")
  const canEdit = actorRole === "owner" && !isReadOnlyPreview

  // Peta data profil pengguna (email & nama)
  const userMap = new Map<string, { email: string; fullName: string; role: string }>()
  
  // 1. Dari RPC list_organization_users jika tersedia
  if (orgUsersRes.data && Array.isArray(orgUsersRes.data)) {
    for (const u of orgUsersRes.data) {
      userMap.set(u.user_id, {
        email: u.email || "",
        fullName: u.full_name || "",
        role: u.role || "",
      })
    }
  }

  // 2. Fallback / gabungkan dengan public.profiles
  if (publicProfilesRes.data && Array.isArray(publicProfilesRes.data)) {
    for (const p of publicProfilesRes.data) {
      const existing = userMap.get(p.id)
      if (existing) {
        if (!existing.fullName && p.full_name) existing.fullName = p.full_name
      } else {
        userMap.set(p.id, {
          email: "",
          fullName: p.full_name || "",
          role: "",
        })
      }
    }
  }

  // Kelompokkan data penugasan berdasarkan pengguna
  type UserAssignmentGroup = {
    userId: string
    fullName: string
    email: string
    memberRole: string
    relationshipStatus: string
    roles: Array<{
      id: string
      jobRole: string
      branchId: string | null
      branchName: string
    }>
  }

  const userGroupMap = new Map<string, UserAssignmentGroup>()

  for (const a of assignments.data ?? []) {
    if (!userGroupMap.has(a.user_id)) {
      const uInfo = userMap.get(a.user_id)
      const pProfile = profiles.data?.find(p => p.user_id === a.user_id)
      const mMember = members.data?.find(m => m.user_id === a.user_id)
      userGroupMap.set(a.user_id, {
        userId: a.user_id,
        fullName: uInfo?.fullName || "User " + a.user_id.slice(0, 8),
        email: uInfo?.email || "",
        memberRole: mMember?.role || uInfo?.role || "staff",
        relationshipStatus: pProfile?.relationship_status || "",
        roles: [],
      })
    }
    const group = userGroupMap.get(a.user_id)!
    const bName = a.branch_id ? branches.find(b => b.id === a.branch_id)?.name ?? "Cabang" : "Pusat (Holding)"
    group.roles.push({
      id: a.id,
      jobRole: a.job_role,
      branchId: a.branch_id,
      branchName: bName,
    })
  }

  const userGroups = Array.from(userGroupMap.values()).sort((a, b) => a.fullName.localeCompare(b.fullName))

  // Siapkan data anggota untuk dropdown MultiAssignmentForm
  const enrichedMembers = (members.data ?? []).map(m => {
    const info = userMap.get(m.user_id)
    return {
      ...m,
      email: info?.email || "",
      full_name: info?.fullName || "",
    }
  })

  return (
    <div className="space-y-6">
      <Link href="/pengajuan" className="text-sm text-brand">← Pengajuan perusahaan</Link>
      <header>
        <p className="text-sm font-medium text-brand">Organisasi & kewenangan</p>
        <h1 className="mt-2 text-3xl font-bold">Pusat, cabang & akses pengguna</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          {organizationName} adalah satu perusahaan dengan pusat nonoperasional dan tiga lokasi usaha. Laporan cabang digabungkan di pusat; pelaporan pajak berada pada satu perusahaan.
        </p>
      </header>
      <ProcurementMessage error={q.error} notice={q.notice} />
      {missing ? <ProcurementUnavailable /> : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {(units.data ?? []).map(u => (
              <Card key={u.id} className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-brand">{u.code}</p>
                <h2 className="mt-2 text-lg font-semibold">{u.name}</h2>
                <p className="mt-2 text-sm text-muted">
                  {u.kind === "center" ? "Pusat pemantauan, laporan gabungan & pajak. Tidak menjalankan usaha sendiri." : "Lokasi operasional dengan pengajuan dan laporan cabang terpisah."}
                </p>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-semibold">Dua lapisan akses untuk satu akun</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted">
                <li>Hubungan dengan perusahaan: probation, kontrak, tetap, konsultan, vendor atau klien; menjadi dasar layanan pribadi.</li>
                <li>Penugasan pekerjaan: satu atau beberapa jabatan dengan cakupan pusat atau cabang. Status karyawan sendiri tidak otomatis memberi akses Finance, SDM atau cabang lain.</li>
              </ol>
            </Card>
            <Card className="p-5">
              <h2 className="font-semibold">Super Admin / pemilik sistem</h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Akun Super Admin memiliki akses penuh lintas cabang untuk memeriksa, memantau dan mengedit sistem. Penugasan pekerjaan dan status kepegawaian tidak mengurangi akses Super Admin. Tindakan dan keputusan tetap tercatat dalam jejak audit.
              </p>
              <p className="mt-3 text-sm leading-6 text-muted">
                Klien, vendor dan konsultan tidak mendapat akses seluruh cabang. Portal proyek menggunakan penugasan khusus pada proyek aktif melalui menu Portal proyek.
              </p>
            </Card>
          </div>

          {/* SINKRONISASI AKUN SUPABASE AUTH & DAFTAR ANGGOTA */}
          <Card className="p-5 border-brand/20 bg-gradient-to-r from-slate-50 to-blue-50/20 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Sinkronisasi Otomatis Pengguna Supabase Auth
                </h2>
                <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
                  Semua akun yang baru dibuat di Supabase Auth (misal akun klien seperti <strong className="text-slate-800">bara@bara.test</strong> atau akun tim penguji) kini otomatis terhubung ke organisasi. Jika akun baru belum muncul, klik tombol di sebelah kanan untuk menyinkronkan langsung tanpa query SQL manual.
                </p>
              </div>

              {canEdit && (
                <form action={syncAuthUsersAction}>
                  <SubmitButton>
                    🔄 Sinkronkan Akun dari Auth
                  </SubmitButton>
                </form>
              )}
            </div>

            {/* DAFTAR SELURUH ANGGOTA & PENGATURAN STATUS KLIEN / STAF */}
            <div className="mt-4 border-t border-line/60 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Daftar Pengguna Terdaftar ({enrichedMembers.length} Akun)
                </span>
                <span className="text-[11px] text-muted">
                  Kelola status hubungan (Klien, Karyawan, Vendor, Konsultan)
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-line bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-line">
                    <tr>
                      <th className="px-3.5 py-2.5 font-semibold">Pengguna / Email</th>
                      <th className="px-3.5 py-2.5 font-semibold">Nama Lengkap</th>
                      <th className="px-3.5 py-2.5 font-semibold">Peran Organisasi</th>
                      <th className="px-3.5 py-2.5 font-semibold">Status Hubungan</th>
                      {canEdit && <th className="px-3.5 py-2.5 font-semibold text-right">Ubah Status</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {enrichedMembers.map((m) => {
                      const rel = profiles.data?.find((p) => p.user_id === m.user_id)?.relationship_status || "permanent"
                      const isClient = rel === "client"
                      return (
                        <tr key={m.user_id} className="border-b border-line/60 last:border-0 hover:bg-slate-50/50">
                          <td className="px-3.5 py-2.5">
                            <span className="font-semibold text-ink">{m.email || m.user_id}</span>
                            <span className="block font-mono text-[10px] text-muted">{m.user_id}</span>
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-700 font-medium">
                            {m.full_name || "-"}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-800">
                              {m.role}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                isClient
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : "bg-blue-100 text-blue-900 border border-blue-200"
                              }`}
                            >
                              {relationshipLabels[rel] ?? rel}
                            </span>
                          </td>
                          {canEdit && (
                            <td className="px-3.5 py-2.5 text-right">
                              <form action={updateMemberRelationshipAction} className="inline-flex items-center gap-1.5 justify-end">
                                <input type="hidden" name="user_id" value={m.user_id} />
                                <select
                                  name="relationship_status"
                                  defaultValue={rel}
                                  className="h-7 rounded border border-line bg-white px-2 text-[11px] text-slate-800"
                                >
                                  <option value="client">Klien</option>
                                  <option value="permanent">Karyawan Tetap</option>
                                  <option value="contract">Kontrak</option>
                                  <option value="probation">Probation</option>
                                  <option value="consultant">Konsultan</option>
                                  <option value="vendor">Vendor</option>
                                </select>
                                <button
                                  type="submit"
                                  className="h-7 rounded bg-slate-800 px-2.5 text-[11px] font-medium text-white hover:bg-slate-900"
                                >
                                  Simpan
                                </button>
                              </form>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">Penugasan Pengguna & Multi-Jabatan</h2>
            <p className="mt-2 text-sm text-muted">
              Gunakan akun Auth yang sudah terdaftar sebagai anggota perusahaan. Satu akun dapat memegang beberapa penugasan sekaligus (misalnya: Accounting & Tax serta Finance).
            </p>
            
            {canEdit && (
              <MultiAssignmentForm
                members={enrichedMembers}
                branches={branches}
              />
            )}

            <div className="mt-8 border-t border-line pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Daftar Penugasan Aktif Saat Ini</h3>
                  <p className="mt-0.5 text-xs text-muted">Pengelompokan berdasarkan Nama & Email Pengguna</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {userGroups.length} Pengguna Terdaftar
                </span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-canvas text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">No.</th>
                      <th className="px-4 py-3 font-medium">Pengguna (Nama & Email)</th>
                      <th className="px-4 py-3 font-medium">Hubungan Kerja</th>
                      <th className="px-4 py-3 font-medium">Daftar Jabatan / Role Akses</th>
                      <th className="px-4 py-3 font-medium">Cakupan Cabang</th>
                      {canEdit && <th className="px-4 py-3 font-medium text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {userGroups.map((group, groupIdx) => (
                      <tr key={group.userId} className="border-t border-line align-top hover:bg-slate-50/50">
                        <td className="px-4 py-4 text-xs font-semibold text-muted">
                          {groupIdx + 1}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">{group.fullName}</div>
                          {group.email && (
                            <div className="mt-0.5 text-xs text-brand font-medium">{group.email}</div>
                          )}
                          <div className="mt-1 font-mono text-[11px] text-muted">{group.userId}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {relationshipLabels[group.relationshipStatus] ?? "Belum ditentukan"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {group.roles.map((r, rIdx) => (
                              <span
                                key={`${r.id}-${rIdx}`}
                                className="inline-flex items-center rounded-md bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand"
                              >
                                {jobLabels[r.jobRole] ?? r.jobRole}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-muted">
                          <div className="space-y-1">
                            {group.roles.map((r, rIdx) => (
                              <div key={`${r.id}-branch-${rIdx}`}>
                                • {r.branchName}
                              </div>
                            ))}
                          </div>
                        </td>
                        {canEdit && (
                          <td className="px-4 py-4 text-right">
                            <div className="space-y-1.5">
                              {group.roles.map((r) => (
                                <form key={r.id} action={removeWorkAssignment} className="inline-block ml-1">
                                  <input type="hidden" name="assignment_id" value={r.id} />
                                  <input type="hidden" name="user_id" value={group.userId} />
                                  <input type="hidden" name="branch_id" value={r.branchId ?? ""} />
                                  <input type="hidden" name="job_role" value={r.jobRole} />
                                  <button
                                    type="submit"
                                    className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100"
                                    title={`Cabut role ${jobLabels[r.jobRole] ?? r.jobRole} (${r.branchName})`}
                                  >
                                    Cabut {jobLabels[r.jobRole] ?? r.jobRole} ×
                                  </button>
                                </form>
                              ))}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!userGroups.length && (
                  <p className="p-5 text-center text-sm text-muted">Belum ada penugasan pekerjaan. Akun Super Admin tetap memiliki akses penuh.</p>
                )}
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div>
              <h2 className="font-semibold">Hubungan cabang dengan pembukuan</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Hubungkan cabang operasional ke unit cabang di pembukuan perusahaan yang sama. Ini diperlukan untuk jurnal utang, pelunasan dan laporan cabang. Pusat tetap menjadi induk pelaporan. Kelola unit pembukuan dan periode melalui <Link href="/modul/akuntansi" className="text-brand">Akuntansi</Link>.
              </p>
            </div>
            {branches.map(b => (
              <div key={b.id} className="rounded-lg border border-line p-4">
                <p className="font-medium">{b.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {entities.data?.find(e => e.id === b.entity_id)?.legal_name ?? "Belum terhubung ke pembukuan"}
                </p>
                {canEdit && (
                  <form action={linkBusinessUnit} className="mt-3 flex flex-wrap items-end gap-3">
                    <input type="hidden" name="branch_id" value={b.id} />
                    <label className={`${label} min-w-60 flex-1`}>
                      Unit pembukuan cabang
                      <select name="entity_id" defaultValue={b.entity_id ?? ""} required className={input}>
                        <option value="">Pilih unit cabang</option>
                        {(entities.data ?? []).filter(e => e.entity_type === "branch").map(e => (
                          <option key={e.id} value={e.id}>{e.entity_code} · {e.legal_name}</option>
                        ))}
                      </select>
                    </label>
                    <SubmitButton>Hubungkan</SubmitButton>
                  </form>
                )}
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}
