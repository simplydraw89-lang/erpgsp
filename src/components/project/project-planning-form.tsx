"use client"

import { useActionState, useState } from "react"
import { Plus, Trash2, Users, Calendar, Calculator, FileText, CheckCircle2, Send, Save, ArrowLeft } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { saveProjectPlanningAction } from "@/app/(workspace)/proyek/actions"
import { DocumentUpload } from "@/components/sales/document-upload"
import { rupiah, formatDateID } from "@/lib/procurement-ui"

export type ManpowerItem = {
  id: string
  name: string
  role: string
  certification?: string
  duration?: string
}

export type ScheduleItem = {
  id: string
  phase: string
  start_date: string
  end_date: string
  pic: string
}

export type RabItem = {
  id: string
  category: "personil" | "non_personil" | "lab_sampling" | "operasional" | "sidang_perizinan"
  description: string
  volume: number
  unit: string
  unit_price: number
  total: number
}

const rabCategories = [
  { value: "personil", label: "Biaya Personil (Tenaga Ahli & Surveyor)" },
  { value: "non_personil", label: "Biaya Non-Personil / Akomodasi & Transportasi" },
  { value: "lab_sampling", label: "Uji Laboratorium & Pengukuran Sampel" },
  { value: "sidang_perizinan", label: "Biaya Sidang Komisi & Koordinasi Teknis" },
  { value: "operasional", label: "Perlengkapan Lapangan & Laporan Teknis" },
]

export function ProjectPlanningForm({
  project,
  disabled,
}: {
  project: {
    id: string
    version: number
    code: string
    name: string
    branch_id: string
    contract_amount: number
    work_details: string | null
    starts_on: string | null
    ends_on: string | null
    manpower: ManpowerItem[]
    timesheet_schedule: ScheduleItem[]
    rab_breakdown: RabItem[]
    rab_total: number
    attachment_ids: string[]
    approval_status: string
  }
  disabled?: boolean
}) {
  const [state, formAction, isPending] = useActionState(saveProjectPlanningAction, undefined)
  const [activeTab, setActiveTab] = useState<"sdm" | "teknis" | "jadwal" | "rab" | "lampiran">("sdm")
  const [uploadBusy, setUploadBusy] = useState(false)

  // Form states
  const [workDetails, setWorkDetails] = useState(project.work_details || "")
  const [startsOn, setStartsOn] = useState(project.starts_on || "")
  const [endsOn, setEndsOn] = useState(project.ends_on || "")
  const [manpower, setManpower] = useState<ManpowerItem[]>(
    project.manpower?.length > 0
      ? project.manpower
      : [{ id: "mp-1", name: "", role: "Project Manager / Team Leader", certification: "", duration: "1 Bulan" }]
  )
  const [schedule, setSchedule] = useState<ScheduleItem[]>(
    project.timesheet_schedule?.length > 0
      ? project.timesheet_schedule
      : [{ id: "sch-1", phase: "Persiapan & Pengumpulan Data Sekunder", start_date: "", end_date: "", pic: "" }]
  )
  const [rab, setRab] = useState<RabItem[]>(
    project.rab_breakdown?.length > 0
      ? project.rab_breakdown
      : [{ id: "rab-1", category: "personil", description: "Tenaga Ahli Lingkungan", volume: 1, unit: "OB", unit_price: 0, total: 0 }]
  )
  const [attachments, setAttachments] = useState<string[]>(project.attachment_ids || [])

  // Calculations
  const contractAmount = Number(project.contract_amount) || 0
  const rabTotal = rab.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
  const projectedMargin = contractAmount > 0 ? ((contractAmount - rabTotal) / contractAmount) * 100 : 0

  // Handlers for Manpower
  function addManpower() {
    setManpower([
      ...manpower,
      { id: `mp-${Date.now()}`, name: "", role: "Tenaga Ahli", certification: "", duration: "" },
    ])
  }
  function removeManpower(id: string) {
    setManpower(manpower.filter((m) => m.id !== id))
  }
  function updateManpower(id: string, field: keyof ManpowerItem, value: string) {
    setManpower(manpower.map((m) => (m.id === id ? { ...m, [field]: value } : m)))
  }

  // Handlers for Schedule
  function addSchedule() {
    setSchedule([
      ...schedule,
      { id: `sch-${Date.now()}`, phase: "", start_date: "", end_date: "", pic: "" },
    ])
  }
  function removeSchedule(id: string) {
    setSchedule(schedule.filter((s) => s.id !== id))
  }
  function updateSchedule(id: string, field: keyof ScheduleItem, value: string) {
    setSchedule(schedule.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  // Handlers for RAB
  function addRab() {
    setRab([
      ...rab,
      { id: `rab-${Date.now()}`, category: "non_personil", description: "", volume: 1, unit: "Paket", unit_price: 0, total: 0 },
    ])
  }
  function removeRab(id: string) {
    setRab(rab.filter((r) => r.id !== id))
  }
  function updateRab(id: string, field: keyof RabItem, value: any) {
    setRab(
      rab.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r, [field]: value }
        if (field === "volume" || field === "unit_price") {
          const vol = field === "volume" ? Number(value) || 0 : Number(r.volume) || 0
          const price = field === "unit_price" ? Number(value) || 0 : Number(r.unit_price) || 0
          updated.total = Math.round(vol * price)
        }
        return updated
      })
    )
  }

  const busy = disabled || isPending || uploadBusy

  return (
    <div className="space-y-6">
      {state?.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {state.error}
        </div>
      )}

      {/* Metric Cards Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Nilai Kontrak (SPK)</p>
          <p className="mt-1 text-xl font-bold text-ink">{rupiah(contractAmount)}</p>
          <p className="mt-1 text-xs text-muted">Pagu pendapatan disetujui</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Total Rencana Anggaran (RAB)</p>
          <p className="mt-1 text-xl font-bold text-brand">{rupiah(rabTotal)}</p>
          <p className="mt-1 text-xs text-muted">{rab.length} pos rincian anggaran</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Estimasi Gross Margin</p>
          <p className={`mt-1 text-xl font-bold ${projectedMargin >= 25 ? "text-emerald-600" : projectedMargin > 0 ? "text-amber-600" : "text-red-600"}`}>
            {projectedMargin.toFixed(2)}%
          </p>
          <p className="mt-1 text-xs text-muted">Selisih: {rupiah(contractAmount - rabTotal)}</p>
        </Card>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-line overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("sdm")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "sdm" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Users className="size-4" />
          1. Tim SDM / Man Power ({manpower.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("teknis")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "teknis" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <FileText className="size-4" />
          2. Rincian Teknis & Deliverables
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("jadwal")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "jadwal" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Calendar className="size-4" />
          3. Jadwal & Timesheet ({schedule.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("rab")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "rab" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Calculator className="size-4" />
          4. Rencana Anggaran Biaya (RAB)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("lampiran")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "lampiran" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <FileText className="size-4" />
          5. Lampiran Pendukung ({attachments.length})
        </button>
      </div>

      {/* Form Content */}
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="id" value={project.id} />
        <input type="hidden" name="version" value={project.version} />
        <input type="hidden" name="work_details" value={workDetails} />
        <input type="hidden" name="starts_on" value={startsOn} />
        <input type="hidden" name="ends_on" value={endsOn} />
        <input type="hidden" name="manpower" value={JSON.stringify(manpower)} />
        <input type="hidden" name="timesheet_schedule" value={JSON.stringify(schedule)} />
        <input type="hidden" name="rab_breakdown" value={JSON.stringify(rab)} />
        <input type="hidden" name="attachment_ids" value={JSON.stringify(attachments)} />

        {/* TAB 1: SDM / MANPOWER */}
        {activeTab === "sdm" && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-ink">Alokasi SDM & Tim Ahli Proyek</h3>
                <p className="text-xs text-muted mt-1">
                  Tentukan Project Manager, Tenaga Ahli (KTPA/ATPA/Sipil/dll.), serta tim surveyor/drafter.
                </p>
              </div>
              <Button type="button" onClick={addManpower} disabled={busy} variant="secondary" className="gap-1 text-xs">
                <Plus className="size-3.5" /> Tambah Personil
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas text-muted text-xs">
                  <tr>
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2">Nama Personil</th>
                    <th className="px-3 py-2">Peran di Proyek</th>
                    <th className="px-3 py-2">Sertifikasi / Keahlian</th>
                    <th className="px-3 py-2">Durasi Kerja</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {manpower.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-muted">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          required
                          value={item.name}
                          disabled={busy}
                          placeholder="Nama lengkap"
                          onChange={(e) => updateManpower(item.id, "name", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          required
                          value={item.role}
                          disabled={busy}
                          placeholder="e.g. Project Manager, Ahli Lingkungan"
                          onChange={(e) => updateManpower(item.id, "role", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.certification || ""}
                          disabled={busy}
                          placeholder="e.g. KTPA, ATPA, SKA"
                          onChange={(e) => updateManpower(item.id, "certification", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.duration || ""}
                          disabled={busy}
                          placeholder="e.g. 2 Bulan, 10 Hari Lapangan"
                          onChange={(e) => updateManpower(item.id, "duration", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeManpower(item.id)}
                          disabled={busy || manpower.length <= 1}
                          className="text-red-500 hover:text-red-700 disabled:opacity-40"
                        >
                          <Trash2 className="size-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* TAB 2: TEKNIS & DELIVERABLES */}
        {activeTab === "teknis" && (
          <Card className="p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-ink">Rincian Teknis & Deliverables Pekerjaan</h3>
              <p className="text-xs text-muted mt-1">
                Jelaskan lingkup detail pengerjaan, metode teknis, logistik/alat yang diperlukan, dan dokumen hasil akhir proyek.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Tanggal Rencana Mulai (Kick-off)</span>
                <input
                  type="date"
                  value={startsOn}
                  disabled={busy}
                  onChange={(e) => setStartsOn(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Target Tanggal Selesai</span>
                <input
                  type="date"
                  value={endsOn}
                  disabled={busy}
                  onChange={(e) => setEndsOn(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="font-medium text-slate-700">Deskripsi Rincian Pekerjaan & Kebutuhan Teknis *</span>
              <textarea
                required
                rows={8}
                value={workDetails}
                disabled={busy}
                placeholder="Rincikan tahapan pengerjaan teknis, misalnya:&#10;1. Sampling kualitas udara, air, dan tanah di 5 titik lokasi proyek&#10;2. Pengujian lab bersertifikasi KAN&#10;3. Analisis dampak lingkungan dan penyusunan draf dokumen UKL-UPL&#10;4. Kebutuhan alat: High Volume Air Sampler, Sound Level Meter, GPS Geodetik&#10;5. Konsultasi publik dan sidang teknis dinas lingkungan hidup"
                onChange={(e) => setWorkDetails(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-line p-3 text-sm leading-6"
              />
            </label>
          </Card>
        )}

        {/* TAB 3: JADWAL & TIMESHEET */}
        {activeTab === "jadwal" && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-ink">Jadwal Tahapan & Milestones Proyek</h3>
                <p className="text-xs text-muted mt-1">
                  Atur alokasi tahapan waktu pengerjaan dan penanggung jawab per tahap (Timesheet WBS).
                </p>
              </div>
              <Button type="button" onClick={addSchedule} disabled={busy} variant="secondary" className="gap-1 text-xs">
                <Plus className="size-3.5" /> Tambah Tahap
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas text-muted text-xs">
                  <tr>
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2">Nama Tahapan / Milestone</th>
                    <th className="px-3 py-2">Mulai</th>
                    <th className="px-3 py-2">Target Selesai</th>
                    <th className="px-3 py-2">PIC Pelaksana</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {schedule.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-muted">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          required
                          value={item.phase}
                          disabled={busy}
                          placeholder="e.g. Sampling Udara & Air Lapangan"
                          onChange={(e) => updateSchedule(item.id, "phase", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={item.start_date}
                          disabled={busy}
                          onChange={(e) => updateSchedule(item.id, "start_date", e.target.value)}
                          className="w-full rounded border border-line px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={item.end_date}
                          disabled={busy}
                          onChange={(e) => updateSchedule(item.id, "end_date", e.target.value)}
                          className="w-full rounded border border-line px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.pic}
                          disabled={busy}
                          placeholder="e.g. Budi (Surveyor)"
                          onChange={(e) => updateSchedule(item.id, "pic", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeSchedule(item.id)}
                          disabled={busy || schedule.length <= 1}
                          className="text-red-500 hover:text-red-700 disabled:opacity-40"
                        >
                          <Trash2 className="size-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* TAB 4: RENCANA ANGGARAN BIAYA (RAB) */}
        {activeTab === "rab" && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-ink">Rencana Anggaran Biaya (RAB) Proyek</h3>
                <p className="text-xs text-muted mt-1">
                  Rincikan biaya personil, non-personil, laboratorium, dan operasional. Pagu ini akan terkunci setelah di-ACC Direktur Utama.
                </p>
              </div>
              <Button type="button" onClick={addRab} disabled={busy} variant="secondary" className="gap-1 text-xs">
                <Plus className="size-3.5" /> Tambah Pos Biaya
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas text-muted text-xs">
                  <tr>
                    <th className="px-2 py-2">Kategori</th>
                    <th className="px-2 py-2">Uraian Kebutuhan</th>
                    <th className="px-2 py-2 w-20">Volume</th>
                    <th className="px-2 py-2 w-24">Satuan</th>
                    <th className="px-2 py-2 w-32">Harga Satuan (Rp)</th>
                    <th className="px-2 py-2 w-36 text-right">Subtotal</th>
                    <th className="px-2 py-2 text-right w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rab.map((item) => (
                    <tr key={item.id}>
                      <td className="px-2 py-2">
                        <select
                          value={item.category}
                          disabled={busy}
                          onChange={(e) => updateRab(item.id, "category", e.target.value)}
                          className="w-full rounded border border-line px-2 py-1.5 text-xs"
                        >
                          {rabCategories.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          required
                          value={item.description}
                          disabled={busy}
                          placeholder="e.g. Sampling Parameter Air Limbah"
                          onChange={(e) => updateRab(item.id, "description", e.target.value)}
                          className="w-full rounded border border-line px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={item.volume}
                          disabled={busy}
                          onChange={(e) => updateRab(item.id, "volume", e.target.value)}
                          className="w-full rounded border border-line px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.unit}
                          disabled={busy}
                          placeholder="e.g. Titik, OB, Hari"
                          onChange={(e) => updateRab(item.id, "unit", e.target.value)}
                          className="w-full rounded border border-line px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={item.unit_price}
                          disabled={busy}
                          onChange={(e) => updateRab(item.id, "unit_price", e.target.value)}
                          className="w-full rounded border border-line px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2 text-right font-medium text-slate-800 text-xs">
                        {rupiah(item.total)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeRab(item.id)}
                          disabled={busy || rab.length <= 1}
                          className="text-red-500 hover:text-red-700 disabled:opacity-40"
                        >
                          <Trash2 className="size-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 font-semibold text-slate-800">
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-right">
                      Total Rencana Anggaran Biaya (RAB):
                    </td>
                    <td className="px-2 py-3 text-right text-brand">{rupiah(rabTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}

        {/* TAB 5: LAMPIRAN PENDUKUNG */}
        {activeTab === "lampiran" && (
          <Card className="p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-ink">Lampiran Dokumen Teknis & RAB Pendukung</h3>
              <p className="text-xs text-muted mt-1">
                Unggah dokumen pendukung seperti KAK/TOR, RAB detail format Excel, surat penawaran lab, atau izin teknis.
              </p>
            </div>

            <DocumentUpload
              branchId={project.branch_id}
              label="Unggah Berkas Pendukung Proyek (PDF, PNG, JPG, Max 10MB)"
              attachments={attachments}
              onChange={setAttachments}
              onBusyChange={setUploadBusy}
              disabled={busy}
            />
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
          <p className="text-xs text-muted">
            Status saat ini:{" "}
            <span className="font-semibold text-amber-700 uppercase">
              {project.approval_status === "revision_requested" ? "Perlu Revisi" : "Draft Mobilisasi Cabang"}
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              type="submit"
              name="submit"
              value="false"
              variant="secondary"
              disabled={busy}
              className="gap-2"
            >
              <Save className="size-4" /> Simpan Draft Perencanaan
            </Button>
            <Button
              type="submit"
              name="submit"
              value="true"
              disabled={busy}
              className="gap-2 bg-brand text-white hover:bg-brand/90"
            >
              <Send className="size-4" /> Ajukan ke Direktur Utama
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
