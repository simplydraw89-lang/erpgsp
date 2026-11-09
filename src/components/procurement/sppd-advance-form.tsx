"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { MoneyInput } from "@/components/ui/money-input"
import { DatePicker } from "@/components/ui/date-picker"
import { SubmitButton } from "@/components/procurement/submit-button"
import { saveSppdCashAdvance } from "@/app/(workspace)/pengajuan/actions"
import { type BusinessUnit, procurementInput as input, procurementLabel as label } from "@/lib/procurement-ui"
import { Plane, Calendar, MapPin, Briefcase, AlertCircle, CheckCircle2 } from "lucide-react"

export type SppdProjectOption = {
  id: string
  code: string
  name: string
  branch_id: string
  contract_amount: number
  rab_total: number
}

export function SppdAdvanceForm({
  branches,
  projects,
  disabled = false,
}: {
  branches: BusinessUnit[]
  projects: SppdProjectOption[]
  disabled?: boolean
}) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "")
  const [projectId, setProjectId] = useState("")
  const [neededOn, setNeededOn] = useState(new Date().toISOString().slice(0, 10))
  const [departureOn, setDepartureOn] = useState("")
  const [returnOn, setReturnOn] = useState("")

  const filteredProjects = projects.filter(p => !p.branch_id || p.branch_id === branchId)
  const selectedProject = projects.find(p => p.id === projectId)

  return (
    <Card className="p-5 md:p-6 space-y-5">
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand text-white">
          <Plane className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink">Formulir Pengajuan SPPD & Kasbon Operasional</h2>
          <p className="text-xs text-muted">
            Penerbitan Surat Perintah Perjalanan Dinas (SPPD) dan pencairan uang muka kasbon lapangan yang otomatis memotong pagu anggaran RAB proyek.
          </p>
        </div>
      </div>

      <form action={saveSppdCashAdvance} className="space-y-4">
        <fieldset disabled={disabled || !branches.length} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Cabang Penugasan
              <select
                name="branch_id"
                required
                value={branchId}
                onChange={e => {
                  setBranchId(e.target.value)
                  setProjectId("")
                }}
                className={input}
              >
                <option value="">Pilih Cabang</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={label}>
              Proyek Terkait (Project Costing RAB)
              <select
                name="project_id"
                required
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className={input}
              >
                <option value="">-- Pilih Proyek yang Sedang Berjalan --</option>
                {filteredProjects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedProject && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-1 text-xs text-blue-950">
              <p className="font-semibold flex items-center gap-1.5">
                <Briefcase className="size-4 text-brand" />
                <span>Alokasi Pagu Anggaran Proyek: {selectedProject.name}</span>
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] sm:grid-cols-3">
                <div>
                  <span className="text-muted block">Kode Proyek:</span>
                  <span className="font-mono font-semibold">{selectedProject.code}</span>
                </div>
                <div>
                  <span className="text-muted block">Total Pagu RAB:</span>
                  <span className="font-semibold text-emerald-800">
                    Rp {Number(selectedProject.rab_total).toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-muted block">Dampak Kasbon:</span>
                  <span className="text-blue-800 font-medium">Realisasi langsung memotong pagu RAB</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <label className={label}>
              Tujuan Perjalanan Dinas / Site
              <input
                name="trip_destination"
                required
                placeholder="Contoh: Lokasi Pabrik PT Klien, Balikpapan"
                className={input}
              />
            </label>

            <label className={label}>
              Tanggal Berangkat
              <DatePicker
                name="departure_on"
                value={departureOn}
                onValueChange={setDepartureOn}
                required
                className={input}
              />
            </label>

            <label className={label}>
              Tanggal Kembali (Estimasi)
              <DatePicker
                name="return_on"
                value={returnOn}
                onValueChange={setReturnOn}
                required
                className={input}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Nominal Kasbon Dibutuhkan (Rp)
              <MoneyInput
                name="amount"
                required
                min="1000"
                placeholder="Masukkan nominal kasbon"
                className={input}
              />
            </label>

            <label className={label}>
              Tanggal Dana Diperlukan
              <DatePicker
                name="needed_on"
                value={neededOn}
                onValueChange={setNeededOn}
                required
                className={input}
              />
            </label>
          </div>

          <label className={label}>
            Keperluan Tugas / Rincian Pengeluaran Lapangan
            <textarea
              name="description"
              required
              rows={3}
              placeholder="Contoh: Transportasi darat, BBM, sampling emisi udara, dan akomodasi tim surveyor selama 3 hari di lapangan..."
              className={input}
            />
          </label>

          <div className="flex items-center justify-end border-t border-line pt-4">
            <SubmitButton disabled={disabled || !projectId}>
              Ajukan SPPD & Kasbon Operasional
            </SubmitButton>
          </div>
        </fieldset>
      </form>
    </Card>
  )
}
