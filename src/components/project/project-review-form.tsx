"use client"

import { useActionState } from "react"
import { CheckCircle2, RotateCcw, XCircle, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { decideProjectAction } from "@/app/(workspace)/proyek/actions"

export function ProjectReviewForm({
  projectId,
  version,
  disabled,
}: {
  projectId: string
  version: number
  disabled?: boolean
}) {
  const [state, formAction, isPending] = useActionState(decideProjectAction, undefined)

  return (
    <Card className="border-amber-200 bg-amber-50/40 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="size-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-semibold text-ink">Verifikasi & Pengesahan Proyek (Direktur Utama)</h3>
          <p className="text-xs text-muted mt-1 leading-5">
            Periksa kesiapan tim SDM, rincian teknis pengerjaan, timesheet jadwal, serta pos anggaran RAB.
            Persetujuan akan mengaktifkan proyek secara resmi dan mengunci pagu anggaran biaya.
          </p>
        </div>
      </div>

      {state?.error && (
        <div role="alert" className="rounded-lg bg-red-100 p-3 text-xs text-red-800">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={projectId} />
        <input type="hidden" name="version" value={version} />

        <label className="block text-sm">
          <span className="font-medium text-slate-700">Catatan Verifikasi / Arahan Direksi</span>
          <textarea
            name="note"
            rows={3}
            disabled={disabled || isPending}
            placeholder="Tuliskan arahan pelaksanaan proyek, catatan pagu anggaran, atau alasan jika meminta revisi..."
            className="mt-1 block w-full rounded-lg border border-line bg-white p-2.5 text-xs text-ink leading-5"
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button
            type="submit"
            name="decision"
            value="revise"
            variant="secondary"
            disabled={disabled || isPending}
            className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-100"
          >
            <RotateCcw className="size-4" /> Minta Revisi ke Cabang
          </Button>
          <Button
            type="submit"
            name="decision"
            value="approve"
            disabled={disabled || isPending}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="size-4" /> Setujui & Aktifkan Proyek (ACC)
          </Button>
        </div>
      </form>
    </Card>
  )
}
