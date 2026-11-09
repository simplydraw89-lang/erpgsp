"use client"

import { useActionState, useState, useRef } from "react"
import {
  Plus,
  Trash2,
  Users,
  Calendar,
  Calculator,
  FileText,
  CheckCircle2,
  Send,
  Save,
  Sparkles,
  UploadCloud,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  Receipt,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { saveProjectPlanningAction } from "@/app/(workspace)/proyek/actions"
import { DocumentUpload } from "@/components/sales/document-upload"
import { rupiah } from "@/lib/procurement-ui"
import { MoneyInput } from "@/components/ui/money-input"

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

export type PaymentTermItem = {
  id: string
  index: number
  name: string
  percentage: number
  amount: number
  trigger: string
  estimated_date: string
  status?: string
}

const rabCategories = [
  { value: "personil", label: "Biaya Personil (Tenaga Ahli & Surveyor)" },
  { value: "non_personil", label: "Biaya Non-Personil / Akomodasi & Transportasi" },
  { value: "lab_sampling", label: "Uji Laboratorium & Pengukuran Sampel" },
  { value: "sidang_perizinan", label: "Biaya Sidang Komisi & Koordinasi Teknis" },
  { value: "operasional", label: "Perlengkapan Lapangan & Laporan Teknis" },
]

type TargetedTab = "manpower" | "technical" | "schedule" | "rab"

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
    payment_terms?: PaymentTermItem[]
    attachment_ids: string[]
    approval_status: string
  }
  disabled?: boolean
}) {
  const [state, formAction, isPending] = useActionState(saveProjectPlanningAction, undefined)
  const [activeTab, setActiveTab] = useState<"sdm" | "teknis" | "jadwal" | "rab" | "lampiran" | "termin">("sdm")
  const [uploadBusy, setUploadBusy] = useState(false)

  // Targeted OCR State & Ref
  const targetFileInputRef = useRef<HTMLInputElement>(null)
  const [selectedTarget, setSelectedTarget] = useState<TargetedTab>("manpower")
  const [activeOcrLoading, setActiveOcrLoading] = useState<TargetedTab | null>(null)
  const [tabNotices, setTabNotices] = useState<Record<string, { type: "success" | "error"; message: string }>>({})

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
    project.rab_breakdown?.length > 0 ? project.rab_breakdown : []
  )
  const initialBreakdownSum = (project.rab_breakdown || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0)
  const [directRabTotal, setDirectRabTotal] = useState<number>(
    project.rab_total && Number(project.rab_total) > 0 ? Number(project.rab_total) : initialBreakdownSum
  )
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState<boolean>(Boolean(project.rab_breakdown && project.rab_breakdown.length > 0))
  const [attachments, setAttachments] = useState<string[]>(project.attachment_ids || [])

  // Calculations
  const contractAmount = Number(project.contract_amount) || 0
  const breakdownSum = rab.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
  const rabTotal = rab.length > 0 && breakdownSum > 0 ? breakdownSum : directRabTotal
  const projectedMargin = contractAmount > 0 ? ((contractAmount - rabTotal) / contractAmount) * 100 : 0

  // Payment terms (Termin Pembayaran)
  const [paymentTerms, setPaymentTerms] = useState<PaymentTermItem[]>(
    project.payment_terms && project.payment_terms.length > 0
      ? project.payment_terms
      : [
          {
            id: "term-1",
            index: 1,
            name: "Termin 1 (Uang Muka / DP)",
            percentage: 30,
            amount: Math.round(contractAmount * 0.3),
            trigger: "Setelah Penandatanganan SPK & Kick-off Meeting",
            estimated_date: "",
            status: "planned",
          },
          {
            id: "term-2",
            index: 2,
            name: "Termin 2 (Progress Lapangan & Draft)",
            percentage: 40,
            amount: Math.round(contractAmount * 0.4),
            trigger: "Setelah Survey Lapangan, Pengujian Lab & Draft Laporan",
            estimated_date: "",
            status: "planned",
          },
          {
            id: "term-3",
            index: 3,
            name: "Termin 3 (Pelunasan & BAST Final)",
            percentage: 30,
            amount: Math.round(contractAmount * 0.3),
            trigger: "Setelah Terbit SK Persetujuan Teknis & BAST Final",
            estimated_date: "",
            status: "planned",
          },
        ]
  )

  const totalTermPercentage = paymentTerms.reduce((sum, t) => sum + (Number(t.percentage) || 0), 0)
  const totalTermAmount = paymentTerms.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const remainingTermAmount = contractAmount - totalTermAmount

  function addPaymentTerm() {
    const nextIdx = paymentTerms.length + 1
    const currentTotalPercent = paymentTerms.reduce((sum, t) => sum + (Number(t.percentage) || 0), 0)
    const remainingPercent = Math.max(0, 100 - currentTotalPercent)
    const remainingAmt = Math.round((remainingPercent / 100) * contractAmount)

    setPaymentTerms([
      ...paymentTerms,
      {
        id: `term-${Date.now()}`,
        index: nextIdx,
        name: `Termin ${nextIdx}`,
        percentage: remainingPercent,
        amount: remainingAmt,
        trigger: "Capaian tahapan pengerjaan proyek",
        estimated_date: "",
        status: "planned",
      },
    ])
  }

  function removePaymentTerm(id: string) {
    if (paymentTerms.length <= 1) return
    setPaymentTerms(paymentTerms.filter((t) => t.id !== id))
  }

  function updatePaymentTerm(id: string, field: keyof PaymentTermItem, val: any) {
    setPaymentTerms(
      paymentTerms.map((t) => {
        if (t.id !== id) return t
        if (field === "percentage") {
          const pct = Number(val) || 0
          const amt = Math.round((pct / 100) * contractAmount)
          return { ...t, percentage: pct, amount: amt }
        }
        if (field === "amount") {
          const amt = Number(val) || 0
          const pct = contractAmount > 0 ? Number(((amt / contractAmount) * 100).toFixed(2)) : 0
          return { ...t, amount: amt, percentage: pct }
        }
        return { ...t, [field]: val }
      })
    )
  }

  // Trigger targeted OCR upload from each tab
  function triggerTargetedOcr(target: TargetedTab) {
    if (busy) return
    setSelectedTarget(target)
    if (targetFileInputRef.current) {
      targetFileInputRef.current.value = ""
      targetFileInputRef.current.click()
    }
  }

  // Handle targeted file upload and extraction
  async function handleTargetedUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setTabNotices((prev) => ({
        ...prev,
        [selectedTarget]: {
          type: "error",
          message: "Ukuran berkas maksimal 10 MB. Silakan unggah dokumen yang lebih ringkas.",
        },
      }))
      return
    }

    const currentTarget = selectedTarget
    setActiveOcrLoading(currentTarget)
    setTabNotices((prev) => {
      const next = { ...prev }
      delete next[currentTarget]
      return next
    })

    try {
      const body = new FormData()
      body.set("file", file)
      body.set("branch_id", project.branch_id)
      body.set("project_id", project.id)
      body.set("target", currentTarget)

      const response = await fetch("/api/project-documents", {
        method: "POST",
        body,
      })

      if (response.redirected || !response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Sesi telah berakhir. Silakan muat ulang halaman dan masuk kembali.")
      }

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Gagal memproses dokumen.")
      }

      // 1. Berkas otomatis terdaftar sebagai lampiran dokumen kelengkapan proyek
      if (result.id) {
        setAttachments((prev) => (prev.includes(result.id) ? prev : [...prev, result.id]))
      }

      const extracted = result.extracted || {}

      // 2. Isi HANYA pada bagian yang ditargetkan (tidak menyentuh form lain)
      if (currentTarget === "manpower") {
        if (Array.isArray(extracted.manpower) && extracted.manpower.length > 0) {
          const newMp: ManpowerItem[] = extracted.manpower.map((m: any, idx: number) => ({
            id: `mp-${Date.now()}-${idx}`,
            name: m.name || "",
            role: m.role || "Tenaga Ahli",
            certification: m.certification || "",
            duration: m.duration || "1 Bulan",
          }))
          setManpower((prev) => {
            const isInitial = prev.length === 1 && !prev[0].name && !prev[0].certification
            return isInitial ? newMp : [...prev, ...newMp]
          })
          setTabNotices((prev) => ({
            ...prev,
            manpower: {
              type: "success",
              message: `Berhasil mengekstrak ${newMp.length} personil SDM dari "${file.name}". Berkas otomatis tersimpan di Lampiran Dokumen. Silakan periksa atau sesuaikan jika diperlukan.`,
            },
          }))
        } else {
          setTabNotices((prev) => ({
            ...prev,
            manpower: {
              type: "success",
              message: `Berkas "${file.name}" tersimpan di Lampiran. Teks personil tidak terbaca spesifik, silakan lengkapi tabel personil.`,
            },
          }))
        }
      } else if (currentTarget === "technical") {
        let updatedFields = 0
        if (extracted.work_details) {
          setWorkDetails(extracted.work_details)
          updatedFields++
        }
        if (extracted.starts_on) {
          setStartsOn(extracted.starts_on)
          updatedFields++
        }
        if (extracted.ends_on) {
          setEndsOn(extracted.ends_on)
          updatedFields++
        }
        setTabNotices((prev) => ({
          ...prev,
          technical: {
            type: "success",
            message: `Rincian teknis & lingkup kerja berhasil diekstrak dari "${file.name}". Berkas otomatis tersimpan di Lampiran Dokumen. Silakan periksa atau sesuaikan isian di bawah.`,
          },
        }))
      } else if (currentTarget === "schedule") {
        if (Array.isArray(extracted.timesheet_schedule) && extracted.timesheet_schedule.length > 0) {
          const newSch: ScheduleItem[] = extracted.timesheet_schedule.map((s: any, idx: number) => ({
            id: `sch-${Date.now()}-${idx}`,
            phase: s.phase || "Tahapan Proyek",
            start_date: s.start_date || "",
            end_date: s.end_date || "",
            pic: s.pic || "",
          }))
          setSchedule((prev) => {
            const isInitial = prev.length === 1 && !prev[0].phase && !prev[0].pic
            return isInitial ? newSch : [...prev, ...newSch]
          })
          setTabNotices((prev) => ({
            ...prev,
            schedule: {
              type: "success",
              message: `Berhasil mengekstrak ${newSch.length} tahapan jadwal dari "${file.name}". Berkas otomatis tersimpan di Lampiran Dokumen. Silakan periksa atau sesuaikan tanggal pelaksanaan.`,
            },
          }))
        } else {
          setTabNotices((prev) => ({
            ...prev,
            schedule: {
              type: "success",
              message: `Berkas "${file.name}" tersimpan di Lampiran. Tahapan jadwal tidak terbaca otomatis, silakan lengkapi secara manual.`,
            },
          }))
        }
      } else if (currentTarget === "rab") {
        if (Array.isArray(extracted.rab_breakdown) && extracted.rab_breakdown.length > 0) {
          const newRab: RabItem[] = extracted.rab_breakdown.map((r: any, idx: number) => {
            const vol = Number(r.volume) || 1
            const price = Number(r.unit_price) || 0
            return {
              id: `rab-${Date.now()}-${idx}`,
              category: r.category || "operasional",
              description: r.description || "Pos Biaya Proyek",
              volume: vol,
              unit: r.unit || "Paket",
              unit_price: price,
              total: Number(r.total) || Math.round(vol * price),
            }
          })
          setRab((prev) => {
            const isInitial = prev.length === 1 && !prev[0].description && prev[0].unit_price === 0
            return isInitial ? newRab : [...prev, ...newRab]
          })
          setTabNotices((prev) => ({
            ...prev,
            rab: {
              type: "success",
              message: `Berhasil membaca ${newRab.length} pos anggaran RAB dari "${file.name}". Berkas otomatis tersimpan di Lampiran Dokumen. Silakan periksa volume dan harga satuan.`,
            },
          }))
        } else {
          setTabNotices((prev) => ({
            ...prev,
            rab: {
              type: "success",
              message: `Berkas "${file.name}" tersimpan di Lampiran. Pos biaya tidak terbaca terstruktur, silakan lengkapi tabel RAB.`,
            },
          }))
        }
      }
    } catch (err) {
      setTabNotices((prev) => ({
        ...prev,
        [currentTarget]: {
          type: "error",
          message: err instanceof Error ? err.message : "Terjadi kesalahan saat memproses OCR dokumen.",
        },
      }))
    } finally {
      setActiveOcrLoading(null)
      if (targetFileInputRef.current) targetFileInputRef.current.value = ""
    }
  }

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

  const busy = disabled || isPending || uploadBusy || activeOcrLoading !== null

  return (
    <div className="space-y-6">
      {state?.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {state.error}
        </div>
      )}

      {/* Hidden File Input for Targeted OCR */}
      <input
        ref={targetFileInputRef}
        type="file"
        accept=".pdf,image/png,image/jpeg,image/webp"
        onChange={handleTargetedUpload}
        className="hidden"
        disabled={busy}
      />

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
          <p
            className={`mt-1 text-xl font-bold ${
              projectedMargin >= 25 ? "text-emerald-600" : projectedMargin > 0 ? "text-amber-600" : "text-red-600"
            }`}
          >
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
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition whitespace-nowrap ${
            activeTab === "sdm" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Users className="size-4" />
          1. Tim SDM / Man Power ({manpower.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("teknis")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition whitespace-nowrap ${
            activeTab === "teknis" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <FileText className="size-4" />
          2. Rincian Teknis & Deliverables
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("jadwal")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition whitespace-nowrap ${
            activeTab === "jadwal" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Calendar className="size-4" />
          3. Jadwal & Timesheet ({schedule.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("rab")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition whitespace-nowrap ${
            activeTab === "rab" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Calculator className="size-4" />
          4. Berkas & Pagu RAB ({attachments.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("lampiran")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition whitespace-nowrap ${
            activeTab === "lampiran" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <FileText className="size-4" />
          5. Lampiran Dokumen ({attachments.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("termin")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition whitespace-nowrap ${
            activeTab === "termin" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Receipt className="size-4" />
          6. Termin Pembayaran ({paymentTerms.length})
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
        <input type="hidden" name="rab_total" value={rabTotal} />
        <input type="hidden" name="rab_breakdown" value={JSON.stringify(rab)} />
        <input type="hidden" name="payment_terms" value={JSON.stringify(paymentTerms)} />
        <input type="hidden" name="attachment_ids" value={JSON.stringify(attachments)} />

        {/* TAB 1: SDM / MANPOWER */}
        {activeTab === "sdm" && (
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-ink">Alokasi Tim SDM / Man Power Proyek</h3>
                <p className="text-xs text-muted mt-1">
                  Daftarkan Project Manager, Tenaga Ahli, dan tim pendukung lapangan.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => triggerTargetedOcr("manpower")}
                  disabled={busy}
                  className="gap-2 border-indigo-200 bg-indigo-50/80 text-indigo-900 hover:bg-indigo-100 text-xs font-semibold"
                >
                  {activeOcrLoading === "manpower" ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-indigo-600" /> Membaca Dokumen SDM...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5 text-indigo-600" /> Upload Berkas Tim SDM (OCR)
                    </>
                  )}
                </Button>
                <Button type="button" onClick={addManpower} disabled={busy} variant="secondary" className="gap-1 text-xs">
                  <Plus className="size-3.5" /> Tambah Personil
                </Button>
              </div>
            </div>

            {/* Tab Notice */}
            {tabNotices.manpower && (
              <div
                className={`rounded-xl border p-3 text-xs flex items-start gap-2 ${
                  tabNotices.manpower.type === "success"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                    : "border-red-300 bg-red-50 text-red-950"
                }`}
              >
                {tabNotices.manpower.type === "success" ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
                )}
                <p className="leading-relaxed">{tabNotices.manpower.message}</p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas text-muted text-xs">
                  <tr>
                    <th className="px-3 py-2">Nama Personil</th>
                    <th className="px-3 py-2">Peran / Jabatan Proyek</th>
                    <th className="px-3 py-2">Sertifikasi / Keahlian</th>
                    <th className="px-3 py-2">Durasi Penugasan</th>
                    <th className="px-3 py-2 text-right w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {manpower.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          required
                          value={item.name}
                          disabled={busy}
                          placeholder="e.g. Ir. Ahmad Syahid"
                          onChange={(e) => updateManpower(item.id, "name", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs font-medium text-ink"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          required
                          value={item.role}
                          disabled={busy}
                          placeholder="e.g. Ahli Lingkungan / AMDAL"
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-ink">Rincian Teknis & Deliverables Pekerjaan</h3>
                <p className="text-xs text-muted mt-1">
                  Jelaskan lingkup detail pengerjaan, metode teknis, logistik/alat yang diperlukan, dan dokumen hasil akhir proyek.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => triggerTargetedOcr("technical")}
                disabled={busy}
                className="gap-2 border-indigo-200 bg-indigo-50/80 text-indigo-900 hover:bg-indigo-100 text-xs font-semibold"
              >
                {activeOcrLoading === "technical" ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin text-indigo-600" /> Membaca Dokumen KAK...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5 text-indigo-600" /> Upload Dokumen Teknis / KAK (OCR)
                  </>
                )}
              </Button>
            </div>

            {/* Tab Notice */}
            {tabNotices.technical && (
              <div
                className={`rounded-xl border p-3 text-xs flex items-start gap-2 ${
                  tabNotices.technical.type === "success"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                    : "border-red-300 bg-red-50 text-red-950"
                }`}
              >
                {tabNotices.technical.type === "success" ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
                )}
                <p className="leading-relaxed">{tabNotices.technical.message}</p>
              </div>
            )}

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
              <span className="font-medium text-slate-700">Deskripsi Lingkup Pekerjaan, Metodologi, dan Dokumen Laporan</span>
              <textarea
                required
                rows={9}
                value={workDetails}
                disabled={busy}
                placeholder="Tuliskan ruang lingkup detail pengerjaan, metodologi, standar baku mutu, serta dokumen hasil akhir yang diserahkan ke klien..."
                onChange={(e) => setWorkDetails(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-line p-3 text-xs leading-relaxed"
              />
            </label>
          </Card>
        )}

        {/* TAB 3: JADWAL & TIMESHEET */}
        {activeTab === "jadwal" && (
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-ink">Jadwal & Timesheet Pelaksanaan</h3>
                <p className="text-xs text-muted mt-1">
                  Uraikan tahapan pengerjaan proyek dari kick-off hingga penyerahan laporan akhir.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => triggerTargetedOcr("schedule")}
                  disabled={busy}
                  className="gap-2 border-indigo-200 bg-indigo-50/80 text-indigo-900 hover:bg-indigo-100 text-xs font-semibold"
                >
                  {activeOcrLoading === "schedule" ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-indigo-600" /> Membaca Jadwal / Kurva S...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5 text-indigo-600" /> Upload Jadwal / Kurva S (OCR)
                    </>
                  )}
                </Button>
                <Button type="button" onClick={addSchedule} disabled={busy} variant="secondary" className="gap-1 text-xs">
                  <Plus className="size-3.5" /> Tambah Tahapan
                </Button>
              </div>
            </div>

            {/* Tab Notice */}
            {tabNotices.schedule && (
              <div
                className={`rounded-xl border p-3 text-xs flex items-start gap-2 ${
                  tabNotices.schedule.type === "success"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                    : "border-red-300 bg-red-50 text-red-950"
                }`}
              >
                {tabNotices.schedule.type === "success" ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
                )}
                <p className="leading-relaxed">{tabNotices.schedule.message}</p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas text-muted text-xs">
                  <tr>
                    <th className="px-3 py-2">Tahapan Pengerjaan</th>
                    <th className="px-3 py-2">Mulai</th>
                    <th className="px-3 py-2">Target Selesai</th>
                    <th className="px-3 py-2">Penanggung Jawab (PIC)</th>
                    <th className="px-3 py-2 text-right w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {schedule.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          required
                          value={item.phase}
                          disabled={busy}
                          placeholder="e.g. Sampling Uji Emisi & Air"
                          onChange={(e) => updateSchedule(item.id, "phase", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs font-medium text-ink"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={item.start_date}
                          disabled={busy}
                          onChange={(e) => updateSchedule(item.id, "start_date", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={item.end_date}
                          disabled={busy}
                          onChange={(e) => updateSchedule(item.id, "end_date", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs"
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
          <Card className="p-5 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <h3 className="font-bold text-ink text-base">Dokumen & Pagu Rencana Anggaran Biaya (RAB)</h3>
                <p className="text-xs text-muted mt-1 max-w-2xl">
                  Cukup unggah berkas dokumen RAB resmi (PDF / Excel / Scan) dan tentukan Total Pagu Anggaran RAB. Pagu ini akan otomatis menjadi batas acuan serapan biaya proyek yang di-ACC Direktur Utama.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => triggerTargetedOcr("rab")}
                  disabled={busy}
                  className="gap-2 border-indigo-200 bg-indigo-50/80 text-indigo-900 hover:bg-indigo-100 text-xs font-semibold"
                >
                  {activeOcrLoading === "rab" ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-indigo-600" /> Membaca Berkas RAB...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="size-3.5 text-indigo-600" /> Upload Berkas RAB (Auto-Extract OCR)
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Tab Notice */}
            {tabNotices.rab && (
              <div
                className={`rounded-xl border p-3 text-xs flex items-start gap-2 ${
                  tabNotices.rab.type === "success"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                    : "border-red-300 bg-red-50 text-red-950"
                }`}
              >
                {tabNotices.rab.type === "success" ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
                )}
                <p className="leading-relaxed">{tabNotices.rab.message}</p>
              </div>
            )}

            {/* Section 1: Upload Berkas Dokumen RAB Proyek */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-white shrink-0 mt-0.5">
                  <UploadCloud className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-950">1. Unggah Berkas Dokumen RAB Proyek (Utama)</h4>
                  <p className="text-xs text-blue-800 mt-0.5">
                    Unggah file lembar kerja RAB resmi (Excel .xlsx, .xls, PDF, atau scan bertandatangan). Berkas ini akan otomatis terlampir sebagai dasar verifikasi Direktur Utama.
                  </p>
                </div>
              </div>

              <DocumentUpload
                branchId={project.branch_id}
                label="Unggah Berkas Dokumen RAB (PDF, Excel, Scan Gambar, Max 10MB)"
                attachments={attachments}
                onChange={setAttachments}
                onBusyChange={setUploadBusy}
                disabled={busy}
              />
            </div>

            {/* Section 2: Input Total Pagu Anggaran RAB */}
            <div className="rounded-xl border border-line bg-canvas/60 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-ink">2. Total Nominal Pagu Anggaran RAB (Rp)</h4>
                  <p className="text-xs text-muted mt-0.5">
                    Tentukan total pagu biaya yang disepakati untuk proyek ini. Angka ini yang akan otomatis dipotong oleh realisasi pembelian vendor dan kasbon SPPD lapangan.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 font-mono text-xs font-bold text-emerald-900">
                  Pagu Terkunci: {rupiah(rabTotal)}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 pt-2">
                <label className="text-xs font-semibold text-ink">
                  Total Pagu Anggaran RAB (Rp)
                  <MoneyInput
                    name="direct_rab_total"
                    value={directRabTotal ? String(directRabTotal) : ""}
                    onValueChange={(val: string) => setDirectRabTotal(Number(val) || 0)}
                    disabled={busy || (rab.length > 0 && breakdownSum > 0)}
                    min="1000"
                    placeholder="Contoh: 50.000.000"
                    className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold text-ink"
                  />
                  {rab.length > 0 && breakdownSum > 0 && (
                    <span className="mt-1 block text-[11px] text-brand">
                      * Dihitung otomatis dari subtotal rincian pos biaya di bawah.
                    </span>
                  )}
                </label>

                <div className="rounded-lg border border-line bg-white p-3 space-y-1">
                  <span className="text-[11px] text-muted block">Estimasi Gross Margin Berdasarkan Pagu:</span>
                  <div className="flex items-center justify-between">
                    <span className={`text-base font-bold ${
                      projectedMargin >= 25 ? "text-emerald-600" : projectedMargin > 0 ? "text-amber-600" : "text-red-600"
                    }`}>
                      {projectedMargin.toFixed(2)}%
                    </span>
                    <span className="text-xs text-muted">
                      Selisih Laba: {rupiah(contractAmount - rabTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Rincian Pos Biaya RAB (Opsional) */}
            <div className="rounded-xl border border-line p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                    3. Rincian Pos Biaya Detail (Opsional)
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    Jika ingin merincikan pos personil, uji lab sampel, dll ke dalam sistem secara detail, Anda dapat menambahkannya di bawah ini.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowDetailedBreakdown(!showDetailedBreakdown)}
                    className="text-xs text-brand font-semibold"
                  >
                    {showDetailedBreakdown ? "Sembunyikan Rincian Pos ▲" : "Tampilkan Rincian Pos Detail ▼"}
                  </Button>
                  {showDetailedBreakdown && (
                    <Button type="button" onClick={addRab} disabled={busy} variant="secondary" className="gap-1 text-xs">
                      <Plus className="size-3.5" /> Tambah Pos Biaya
                    </Button>
                  )}
                </div>
              </div>

              {showDetailedBreakdown && (
                <div className="overflow-x-auto pt-2">
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
                      {rab.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-xs text-muted">
                            Belum ada pos biaya rinci. Cukup isi Total Pagu RAB di atas dan unggah dokumen berkas RAB.
                          </td>
                        </tr>
                      ) : (
                        rab.map((item) => (
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
                                disabled={busy}
                                className="text-red-500 hover:text-red-700 disabled:opacity-40"
                              >
                                <Trash2 className="size-4 inline" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {rab.length > 0 && (
                      <tfoot className="border-t-2 border-slate-300 font-semibold text-slate-800">
                        <tr>
                          <td colSpan={5} className="px-3 py-3 text-right">
                            Subtotal Pos Biaya:
                          </td>
                          <td className="px-2 py-3 text-right text-brand">{rupiah(breakdownSum)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* TAB 5: LAMPIRAN PENDUKUNG */}
        {activeTab === "lampiran" && (
          <Card className="p-5 space-y-5">
            <div>
              <h3 className="font-semibold text-ink">Lampiran Dokumen Kelengkapan Proyek</h3>
              <p className="text-xs text-muted mt-1">
                Seluruh dokumen yang diunggah dari tab SDM, Teknis, Jadwal, dan RAB otomatis terkumpul di sini sebagai berkas lampiran resmi proyek. Anda juga dapat mengunggah dokumen pendukung lainnya secara manual.
              </p>
            </div>

            <DocumentUpload
              branchId={project.branch_id}
              label="Unggah Berkas Pendukung Tambahan (PDF, PNG, JPG, Max 10MB)"
              attachments={attachments}
              onChange={setAttachments}
              onBusyChange={setUploadBusy}
              disabled={busy}
            />
          </Card>
        )}

        {/* TAB 6: TERMIN PEMBAYARAN */}
        {activeTab === "termin" && (
          <Card className="p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <h3 className="font-semibold text-ink">6. Rencana Termin Pembayaran & Penagihan Proyek</h3>
                <p className="text-xs text-muted mt-1">
                  Bagi nilai kontrak SPK ({rupiah(contractAmount)}) ke dalam beberapa tahapan termin pembayaran berdasarkan
                  capaian pengerjaan di lapangan.
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={addPaymentTerm}
                disabled={busy}
                className="gap-1.5 bg-brand text-white hover:bg-brand/90 text-xs"
              >
                <Plus className="size-3.5" /> Tambah Tahap Termin
              </Button>
            </div>

            {/* Status Balance Banner */}
            {totalTermPercentage === 100 ? (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3.5 text-xs text-emerald-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Alokasi Termin Sempurna (100%)</strong>: Total termin telah sesuai dengan nilai kontrak SPK ({rupiah(contractAmount)}).
                  </span>
                </div>
                <span className="font-bold text-emerald-800">Seimbang</span>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 text-xs text-amber-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Alokasi Belum Seimbang ({totalTermPercentage}%)</strong>: Sisa belum dialokasikan sebesar{" "}
                    <strong>{rupiah(remainingTermAmount)}</strong> ({100 - totalTermPercentage}%).
                  </span>
                </div>
                <span className="font-bold text-amber-800">{100 - totalTermPercentage}% Sisa</span>
              </div>
            )}

            {/* List Termin Items */}
            <div className="space-y-3">
              {paymentTerms.map((term, idx) => (
                <div
                  key={term.id}
                  className="rounded-xl border border-line bg-slate-50/60 p-4 space-y-3 text-xs transition hover:border-brand/40"
                >
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-bold text-ink">Tahap {idx + 1}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-brand text-sm">{rupiah(term.amount)}</span>
                      {paymentTerms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePaymentTerm(term.id)}
                          disabled={busy}
                          className="text-muted hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block text-slate-700 font-medium">
                      Nama / Keterangan Termin
                      <input
                        type="text"
                        value={term.name}
                        disabled={busy}
                        onChange={(e) => updatePaymentTerm(term.id, "name", e.target.value)}
                        placeholder="Contoh: Termin 1 (Uang Muka / DP)"
                        className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
                      />
                    </label>

                    <label className="block text-slate-700 font-medium">
                      Bobot Persentase (%)
                      <input
                        type="number"
                        min={1}
                        max={100}
                        step="0.01"
                        value={term.percentage}
                        disabled={busy}
                        onChange={(e) => updatePaymentTerm(term.id, "percentage", e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs font-bold"
                      />
                    </label>

                    <label className="block text-slate-700 font-medium">
                      Nominal Tagihan (Rp)
                      <input
                        type="number"
                        min={0}
                        value={term.amount}
                        disabled={busy}
                        onChange={(e) => updatePaymentTerm(term.id, "amount", e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs font-bold"
                      />
                    </label>

                    <label className="block text-slate-700 font-medium">
                      Estimasi Tanggal Penagihan
                      <input
                        type="date"
                        value={term.estimated_date || ""}
                        disabled={busy}
                        onChange={(e) => updatePaymentTerm(term.id, "estimated_date", e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
                      />
                    </label>
                  </div>

                  <label className="block text-slate-700 font-medium">
                    Syarat / Pemicu Tagihan (Deliverable Trigger)
                    <input
                      type="text"
                      value={term.trigger}
                      disabled={busy}
                      onChange={(e) => updatePaymentTerm(term.id, "trigger", e.target.value)}
                      placeholder="Contoh: Setelah Laporan Draft Disetujui atau setelah BAST Tahap I ditandatangani"
                      className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
                    />
                  </label>
                </div>
              ))}
            </div>

            {/* Summary Footer */}
            <div className="rounded-xl border border-line bg-white p-4 space-y-2 text-xs">
              <div className="flex justify-between font-medium">
                <span className="text-muted">Nilai Kontrak SPK:</span>
                <span className="font-bold text-ink">{rupiah(contractAmount)}</span>
              </div>
              <div className="flex justify-between font-medium text-brand">
                <span>Total Rencana Termin:</span>
                <span className="font-bold">
                  {rupiah(totalTermAmount)} ({totalTermPercentage}%)
                </span>
              </div>
              {remainingTermAmount !== 0 && (
                <div className="flex justify-between font-semibold text-amber-700 border-t border-line pt-2">
                  <span>Selisih Belum Dialokasikan:</span>
                  <span>{rupiah(remainingTermAmount)}</span>
                </div>
              )}
            </div>
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
              <Send className="size-4" /> Ajukan Langsung ke Direktur Utama
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
