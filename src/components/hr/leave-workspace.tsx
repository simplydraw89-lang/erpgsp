import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { reviewLeaveAction, submitLeaveAction } from "@/app/(workspace)/pengajuan/cuti/actions"

export type LeaveBalanceRow = {
  leave_year: number
  annual_quota: number
  used_days: number
}

export type LeaveRequestRow = {
  id: string
  user_id: string
  branch_id: string | null
  leave_type: string
  starts_on: string
  ends_on: string
  total_days: number
  reason: string
  status: string
  review_note: string | null
  created_at: string
}

type BranchOption = { id: string; code: string; name: string }

const leaveTypeLabels: Record<string, string> = {
  annual: "Cuti Tahunan",
  sick: "Cuti Sakit",
  important: "Izin Alasan Penting",
  maternity: "Cuti Melahirkan",
  unpaid: "Cuti di Luar Tanggungan",
}

const statusBadges: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-700",
}

export function LeaveWorkspace({
  currentUserId,
  canReview,
  isOwner,
  isReadOnly,
  balance,
  branches,
  requests,
}: {
  currentUserId: string
  canReview: boolean
  isOwner: boolean
  isReadOnly: boolean
  balance: LeaveBalanceRow | null
  branches: BranchOption[]
  requests: LeaveRequestRow[]
}) {
  const quota = balance?.annual_quota ?? 12
  const used = balance?.used_days ?? 0
  const remaining = Math.max(0, quota - used)
  const branchMap = new Map(branches.map((b) => [b.id, `${b.code} · ${b.name}`]))

  const myRequests = requests.filter((r) => r.user_id === currentUserId)
  const pendingReview = canReview
    ? requests.filter(
        (r) => r.status === "submitted" && (r.user_id !== currentUserId || isOwner),
      )
    : []

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted">Kuota Cuti Tahunan ({new Date().getFullYear()})</p>
          <p className="mt-2 text-2xl font-bold">{quota} hari</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Terpakai</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{used} hari</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Sisa Saldo Cuti</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{remaining} hari</p>
        </Card>
      </section>

      {!isReadOnly && (
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Ajukan Cuti Baru</h2>
          <form action={submitLeaveAction} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Jenis Cuti</label>
              <select
                name="leave_type"
                required
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              >
                <option value="annual">Cuti Tahunan (memotong saldo)</option>
                <option value="sick">Cuti Sakit</option>
                <option value="important">Izin Alasan Penting</option>
                <option value="maternity">Cuti Melahirkan</option>
                <option value="unpaid">Cuti di Luar Tanggungan</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Cabang Penugasan (opsional)</label>
              <select
                name="branch_id"
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              >
                <option value="">Pusat / Umum</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Tanggal Mulai</label>
              <input
                type="date"
                name="starts_on"
                required
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Tanggal Selesai</label>
              <input
                type="date"
                name="ends_on"
                required
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">Alasan / Keterangan</label>
              <textarea
                name="reason"
                rows={2}
                required
                placeholder="Tuliskan alasan cuti dan PIC pengganti sementara bila ada..."
                className="w-full rounded-md border border-border bg-white p-3 text-sm"
              />
            </div>
            <div>
              <Button type="submit">Kirim Pengajuan Cuti</Button>
            </div>
          </form>
        </Card>
      )}

      {pendingReview.length > 0 && (
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Antrean Persetujuan Cuti ({pendingReview.length})</h2>
          <div className="space-y-3">
            {pendingReview.map((req) => (
              <div key={req.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {leaveTypeLabels[req.leave_type] ?? req.leave_type} · {req.total_days} hari
                    </p>
                    <p className="text-xs text-muted">
                      {req.starts_on} s.d. {req.ends_on} ·{" "}
                      {req.branch_id ? branchMap.get(req.branch_id) ?? "Cabang" : "Pusat"}
                    </p>
                    <p className="mt-1 text-sm">{req.reason}</p>
                  </div>
                  {!isReadOnly && (
                    <form action={reviewLeaveAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="request_id" value={req.id} />
                      <input
                        type="text"
                        name="review_note"
                        placeholder="Catatan (wajib jika tolak)"
                        className="h-9 rounded-md border border-border bg-white px-2 text-xs"
                      />
                      <Button type="submit" name="decision" value="approved" className="h-9 px-3 text-xs">
                        Setujui
                      </Button>
                      <Button
                        type="submit"
                        name="decision"
                        value="rejected"
                        variant="secondary"
                        className="h-9 border-red-300 px-3 text-xs text-red-700 hover:bg-red-50"
                      >
                        Tolak
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="space-y-4 p-5">
        <h2 className="text-lg font-semibold">Riwayat Pengajuan Cuti Saya</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Jenis</th>
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2">Durasi</th>
                <th className="px-3 py-2">Alasan</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Catatan Pemeriksa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {myRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-xs text-muted">
                    Belum ada pengajuan cuti.
                  </td>
                </tr>
              ) : (
                myRequests.map((req) => (
                  <tr key={req.id}>
                    <td className="px-3 py-2 font-medium">
                      {leaveTypeLabels[req.leave_type] ?? req.leave_type}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {req.starts_on} – {req.ends_on}
                    </td>
                    <td className="px-3 py-2">{req.total_days} hari</td>
                    <td className="px-3 py-2">{req.reason}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          statusBadges[req.status] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{req.review_note ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
