export function ProcurementMessage({ error, notice }: { error?: string; notice?: string }) {
  return <>{error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}</>
}
export function ProcurementUnavailable() {
  return <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold text-amber-950">Struktur pengajuan belum tersedia di database</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">Modul membutuhkan migration pusat–cabang dan pengajuan pembelian. Data lama tetap tersedia di modul sebelumnya. Formulir akan aktif setelah migration diterapkan dan diverifikasi; belum ada pengajuan baru yang tersimpan melalui halaman ini.</p></div>
}
