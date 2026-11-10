import { AlertTriangle, ArrowRight, BellRing } from "lucide-react"
import { formatCurrency as money } from "@/lib/money"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { Card } from "@/components/ui/card"
import type { loadBusinessSummary } from "@/lib/business-summary"

export function BusinessSummary({ summary, queueOnly = false }: {
  summary: Awaited<ReturnType<typeof loadBusinessSummary>>
  queueOnly?: boolean
}) {
  const reminders = summary.branchProjectReminders ?? []

  return <section aria-label={queueOnly ? "Verifikasi dan pelaksanaan saya" : "Pengajuan bisnis dan laporan cabang"} className="space-y-4">
    {reminders.length > 0 && (
      <div
        role="region"
        aria-label="Reminder Proyek Cabang dari SPK yang Disetujui Direktur Utama"
        className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/70 to-amber-50 p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <BellRing size={20} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                  Reminder Cabang ({reminders.length} Proyek)
                </span>
                <span className="text-xs font-semibold text-amber-900">
                  Notifikasi Khusus Admin Cabang &amp; Manager Cabang
                </span>
              </div>
              <h3 className="mt-1.5 text-base font-bold text-slate-900">
                SPK Telah Disetujui Direktur Utama — Segera Buat &amp; Ajukan Kelengkapan Dokumen Proyek
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-700">
                Direktur Utama telah menyetujui SPK berikut untuk dijadikan Proyek. <strong>Admin Cabang</strong> dan <strong>Manager Cabang</strong> wajib segera menyusun rincian RAB, jadwal pelaksanaan, penugasan tim/SDM, serta mengunggah kelengkapan dokumen proyek untuk diajukan kembali ke Direktur Utama.
              </p>
            </div>
          </div>
          <Link
            href="/proyek?tab=draft"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700"
          >
            Buka Daftar Proyek Cabang <ArrowRight size={14} />
          </Link>
        </div>

        <ul className="mt-4 divide-y divide-amber-200/80 rounded-xl border border-amber-200 bg-white/90 px-4">
          {reminders.map((proj) => {
            const isRevision = proj.approval_status === "revision_requested"
            return (
              <li key={proj.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                      {proj.code}
                    </span>
                    <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                      Cabang {proj.branch_name}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isRevision
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {isRevision ? "Perlu Revisi Dokumen & RAB" : "Menunggu Kelengkapan Dokumen & RAB Cabang"}
                    </span>
                  </div>
                  <p className="mt-1 font-semibold text-slate-900">
                    {proj.name}
                    {proj.spk_number ? <span className="ml-2 text-xs font-normal text-muted">(SPK: {proj.spk_number})</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Nilai Kontrak SPK: <strong className="text-slate-900">{money(proj.contract_amount)}</strong>
                    {" · "}Ditujukan ke: <strong>{proj.user_branch_roles.join(" & ")} {proj.branch_name}</strong>
                  </p>
                  {proj.review_note && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-900">
                      <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                      Catatan: {proj.review_note}
                    </p>
                  )}
                </div>
                <Link
                  href={`/proyek/${proj.id}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand bg-brand/5 px-3 py-1.5 text-xs font-bold text-brand transition hover:bg-brand hover:text-white"
                >
                  Lengkapi Dokumen &amp; RAB →
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    )}

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold">{queueOnly ? "Verifikasi dan pelaksanaan saya" : "Pengajuan bisnis"}</h2><p className="mt-1 text-xs text-muted">{queueOnly ? "Permintaan yang perlu Anda periksa atau jalankan sesuai kewenangan." : "Pemeriksaan Anda dan ringkasan pembelian sesuai cakupan akses."}</p></div>
      {!queueOnly && <Link href="/pengajuan/pembelian" className="text-sm font-semibold text-brand">Buka pembelian →</Link>}
    </div>
    <div className={`grid gap-4 ${queueOnly ? "" : "lg:grid-cols-2"}`}>
      <Card className="p-5">
        <h3 className="font-semibold">Butuh verifikasi &amp; tindak lanjut saya</h3>
        {summary.queueError ? <p role="status" className="mt-3 text-sm text-amber-800">Antrean bisnis belum tersedia. Periksa penerapan database di Pengajuan.</p>
          : summary.queue.length ? <ul className="mt-3 divide-y divide-line">{summary.queue.map(item => <li key={`${item.kind}-${item.id}`}>
            <Link
              href={
                item.kind === "project"
                  ? `/proyek/${item.id}`
                  : item.kind === "sph"
                  ? `/pengajuan/penjualan/sph/${item.id}`
                  : item.kind === "spk"
                  ? `/pengajuan/penjualan/spk/${item.id}`
                  : item.kind === "purchase"
                  ? `/pengajuan/${item.id}`
                  : "/vendor"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <span>
                <span className="block font-medium">{item.title}</span>
                <span className="mt-1 block text-xs text-muted">
                  {item.kind === "project"
                    ? item.status === "draft"
                      ? "⚡ SPK Disetujui Dirut — Wajib Lengkapi Dokumen & RAB Proyek (Admin & Manager Cabang)"
                      : item.status === "revision_requested"
                      ? "⚠️ Perlu Revisi Dokumen & RAB Proyek (Admin & Manager Cabang)"
                      : "Persetujuan Perencanaan Proyek & RAB (Direktur Utama)"
                    : item.kind === "sph"
                    ? "Pemeriksaan SPH (Direktur Keuangan)"
                    : item.kind === "spk"
                    ? "Persetujuan SPK (Direktur Utama)"
                    : item.kind === "vendor"
                    ? "Validasi vendor"
                    : "Pemeriksaan Pembelian (Direktur Keuangan)"}
                </span>
              </span>
              <span className="shrink-0 text-brand font-semibold">
                {item.kind === "project" && (item.status === "draft" || item.status === "revision_requested")
                  ? "Lengkapi Proyek →"
                  : "Periksa →"}
              </span>
            </Link>
          </li>)}</ul> : <p className="mt-3 text-sm text-muted">Tidak ada pengajuan bisnis yang menunggu tindakan Anda.</p>}
        {summary.notificationsError ? <p role="alert" className="mt-4 text-sm text-amber-800">Notifikasi tindak lanjut SPH/SPK gagal dimuat.</p> : Boolean(summary.notifications?.items.some(item=>item.category === "follow_up")) && <div className="mt-5 border-t border-line pt-4"><h3 className="font-semibold">Dokumen perlu tindak lanjut</h3><ul className="mt-2 divide-y divide-line">{summary.notifications!.items.filter(item=>item.category === "follow_up").map(item=><li key={`${item.kind}-${item.id}`} className="py-3"><Link href={item.kind === "project" ? `/proyek/${item.id}` : item.kind === "spk" ? `/pengajuan/penjualan/spk/${item.id}` : `/pengajuan/penjualan/sph/${item.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand">{item.document_number || (item.kind === "project" ? "Proyek" : item.kind === "spk" ? "SPK" : `SPH ${item.sph_number}`)} · {item.status === "rejected" ? "Ditolak" : item.status === "revision_requested" ? "Perlu revisi" : item.status === "draft" && item.kind === "project" ? "SPK Disetujui Dirut — Wajib Lengkapi Dokumen & RAB Proyek" : item.status === "ready" || item.status === "active" ? "Disetujui" : "Perlu tindak lanjut"}</Link>{item.review_note && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{item.review_note}</p>}</li>)}</ul></div>}
      </Card>
      {!queueOnly && <Card className="overflow-hidden">
        <div className="p-5"><h3 className="font-semibold">Pembelian per cabang</h3><p className="mt-1 text-xs text-muted">Utang dan pembayaran dari pengajuan yang telah melalui pemeriksaan akuntansi.</p></div>
        {summary.reportError ? <p role="status" className="px-5 pb-5 text-sm text-amber-800">Ringkasan belum tersedia. Tidak ada saldo yang diasumsikan nol.</p>
          : summary.branches.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs">
            <caption className="sr-only">Ringkasan utang dan pembayaran cabang yang boleh diakses</caption>
            <thead className="bg-canvas"><tr><th scope="col" className="p-3">Cabang</th><th scope="col" className="p-3 text-right">Belum dibayar</th><th scope="col" className="p-3 text-right">Dibayar</th></tr></thead>
            <tbody>{summary.branches.map(branch => <tr key={branch.branch_id} className="border-t border-line transition-colors hover:bg-slate-50"><th scope="row" className="p-3 font-medium"><Link href="/pengajuan/pembelian" className="block text-ink hover:text-brand hover:underline">{branch.branch_name}</Link></th><td className="p-3 text-right"><Link href="/pengajuan/pembelian" className="block">{money(branch.unpaid_amount)}</Link></td><td className="p-3 text-right"><Link href="/pengajuan/pembelian" className="block">{money(branch.paid_amount)}</Link></td></tr>)}</tbody>
          </table></div> : <p className="px-5 pb-5 text-sm text-muted">Belum ada laporan pembelian dalam cakupan akses Anda.</p>}
      </Card>}
    </div>
  </section>
}
