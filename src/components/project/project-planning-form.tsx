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
  CheckSquare,
  Square,
  Clock,
  Layers,
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

export type DeliverableItem = {
  id: string
  stage: string
  deliverable: string
  acceptance_criteria?: string
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
  category: string
  description: string
  volume: number
  unit: string
  unit_price: number
  total: number
  proportion?: string
}

export type SupportingDocumentItem = {
  id: string
  name: string
  checked: boolean
  notes?: string
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
  { value: "Tenaga ahli dan tim pelaksana", label: "Tenaga Ahli dan Tim Pelaksana (Biaya Personil)" },
  { value: "Survei lapangan dan sampling", label: "Survei Lapangan dan Sampling" },
  { value: "Pengujian laboratorium / data", label: "Pengujian Laboratorium / Data Pengukuran" },
  { value: "Perjalanan dan akomodasi", label: "Perjalanan Dinas & Akomodasi Tim" },
  { value: "Penyusunan dokumen dan rapat", label: "Penyusunan Dokumen Laporan & Rapat Koordinasi" },
  { value: "GIS, administrasi dan QA", label: "GIS, Pemetaan, Administrasi & QA" },
  { value: "Overhead internal", label: "Overhead Internal Kantor" },
  { value: "Cadangan risiko", label: "Cadangan Risiko Proyek" },
  { value: "personil", label: "Biaya Personil Umum" },
  { value: "non_personil", label: "Biaya Non-Personil / Akomodasi Umum" },
  { value: "lab_sampling", label: "Uji Laboratorium Umum" },
  { value: "sidang_perizinan", label: "Sidang Komisi & Perizinan Dinas" },
  { value: "operasional", label: "Operasional & ATK Umum" },
]

const defaultChecklist: SupportingDocumentItem[] = [
  { id: "chk-1", name: "SPH dan persetujuan komersial", checked: true, notes: "Otomatis dari SPH" },
  { id: "chk-2", name: "Kontrak / SPK / PO klien", checked: true, notes: "Otomatis dari SPK" },
  { id: "chk-3", name: "KAK / TOR dan data teknis awal", checked: false, notes: "Spesifikasi pekerjaan" },
  { id: "chk-4", name: "Peta lokasi dan dokumen kegiatan", checked: false, notes: "Koordinat & batas area" },
  { id: "chk-5", name: "Surat penugasan dan CV tenaga ahli", checked: false, notes: "Kelengkapan tim SDM" },
  { id: "chk-6", name: "Sertifikat kompetensi relevan (diverifikasi)", checked: false, notes: "KTPA, ATPA, SKA" },
  { id: "chk-7", name: "Rencana survei dan bukti akses lokasi", checked: false, notes: "Izin survei lapangan" },
  { id: "chk-8", name: "Penawaran vendor / laboratorium", checked: false, notes: "Mitra uji sampel" },
  { id: "chk-9", name: "Berita acara kick-off dan notulen", checked: false, notes: "Kick-off meeting" },
  { id: "chk-10", name: "Laporan kemajuan dan berita acara serah terima", checked: false, notes: "Draft BAST akhir" },
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
  const [jobType, setJobType] = useState("AMDAL")
  const [durationPlan, setDurationPlan] = useState("28 minggu")
  const [workDetails, setWorkDetails] = useState(project.work_details || "")
  const [startsOn, setStartsOn] = useState(project.starts_on || "")
  const [endsOn, setEndsOn] = useState(project.ends_on || "")

  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([
    {
      id: "deliv-1",
      stage: "Kick-off, penapisan dan rencana kerja",
      deliverable: "Notulen kick-off, daftar data, rencana kerja",
      acceptance_criteria: "Persetujuan review internal / klien",
    },
    {
      id: "deliv-2",
      stage: "Pengumpulan data dan rencana survei",
      deliverable: "Laporan kerja, data pendukung dan bukti review tahap 2",
      acceptance_criteria: "Persetujuan review internal / klien",
    },
    {
      id: "deliv-3",
      stage: "Survei rona awal, sampling dan analisis",
      deliverable: "Laporan kerja, data pendukung dan bukti review tahap 3",
      acceptance_criteria: "Persetujuan review internal / klien",
    },
    {
      id: "deliv-4",
      stage: "Analisis dampak dan rencana pengelolaan",
      deliverable: "Laporan kerja, data pendukung dan bukti review tahap 4",
      acceptance_criteria: "Persetujuan review internal / klien",
    },
    {
      id: "deliv-5",
      stage: "Konsultasi dan review dokumen",
      deliverable: "Laporan kerja, data pendukung dan bukti review tahap 5",
      acceptance_criteria: "Persetujuan review internal / klien",
    },
    {
      id: "deliv-6",
      stage: "Revisi, finalisasi dan serah terima",
      deliverable: "Dokumen AMDAL final, daftar revisi, berita acara serah terima (draft)",
      acceptance_criteria: "Persetujuan review internal / klien",
    },
  ])

  const [checklist, setChecklist] = useState<SupportingDocumentItem[]>(defaultChecklist)

  const [manpower, setManpower] = useState<ManpowerItem[]>(
    project.manpower?.length > 0
      ? project.manpower
      : [{ id: "mp-1", name: "", role: "Manajer proyek", certification: "", duration: "28 minggu" }]
  )

  const [schedule, setSchedule] = useState<ScheduleItem[]>(
    project.timesheet_schedule?.length > 0
      ? project.timesheet_schedule
      : [{ id: "sch-1", phase: "Kick-off, penapisan dan rencana kerja", start_date: "", end_date: "", pic: "" }]
  )

  const [rab, setRab] = useState<RabItem[]>(
    project.rab_breakdown?.length > 0 ? project.rab_breakdown : []
  )

  const initialBreakdownSum = (project.rab_breakdown || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0)
  const [directRabTotal, setDirectRabTotal] = useState<number>(
    project.rab_total && Number(project.rab_total) > 0 ? Number(project.rab_total) : initialBreakdownSum
  )
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState<boolean>(
    Boolean(project.rab_breakdown && project.rab_breakdown.length > 0)
  )
  const [attachments, setAttachments] = useState<string[]>(project.attachment_ids || [])

  // Calculations
  const contractAmount = Number(project.contract_amount) || 0
  const breakdownSum = rab.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
  const rabTotal = rab.length > 0 && breakdownSum > 0 ? breakdownSum : directRabTotal
  const projectedMargin = contractAmount > 0 ? ((contractAmount - rabTotal) / contractAmount) * 100 : 0

  // Payment terms (Termin Pembayaran - Bersifat Opsional)
  const [paymentTerms, setPaymentTerms] = useState<PaymentTermItem[]>(
    project.payment_terms && Array.isArray(project.payment_terms) && project.payment_terms.length > 0
      ? project.payment_terms
      : []
  )

  const totalTermPercentage = paymentTerms.reduce((sum, t) => sum + (Number(t.percentage) || 0), 0)
  const totalTermAmount = paymentTerms.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const remainingTermAmount = contractAmount - totalTermAmount

  function addPaymentTerm() {
    const nextIdx = paymentTerms.length + 1
    const currentTotalPercent = paymentTerms.reduce((sum, t) => sum + (Number(t.percentage) || 0), 0)
    const remainingPercent = Math.max(0, 100 - currentTotalPercent)
    const fallbackPercent = remainingPercent > 0 ? remainingPercent : 25
    const fallbackAmt = Math.round((fallbackPercent / 100) * contractAmount)

    setPaymentTerms([
      ...paymentTerms,
      {
        id: `term-${Date.now()}`,
        index: nextIdx,
        name: `Termin ${nextIdx}`,
        percentage: fallbackPercent,
        amount: fallbackAmt,
        trigger: "Capaian tahapan pengerjaan proyek",
        estimated_date: "",
        status: "planned",
      },
    ])
  }

  function removePaymentTerm(id: string) {
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

      // 2. Isi HANYA pada bagian yang ditargetkan (Auto-Expand / Mengganti row dummy dengan jumlah personil aktual)
      if (currentTarget === "manpower") {
        if (Array.isArray(extracted.manpower) && extracted.manpower.length > 0) {
          const newMp: ManpowerItem[] = extracted.manpower.map((m: any, idx: number) => ({
            id: `mp-${Date.now()}-${idx}`,
            name: m.name || "",
            role: m.role || "Tenaga Ahli",
            certification: m.certification || "",
            duration: m.duration || "28 minggu",
          }))
          // Otomatis menambah/mengganti menjadi seluruh personil yang terbaca (misal 7, 10, atau lebih)
          setManpower(newMp)
          setTabNotices((prev) => ({
            ...prev,
            manpower: {
              type: "success",
              message: `Berhasil mengekstrak & mendaftarkan seluruh ${newMp.length} personil tim SDM secara otomatis dari "${file.name}". Seluruh kolom nama, peran, sertifikasi, dan durasi telah terisi. Berkas tersimpan di Lampiran.`,
            },
          }))
        } else {
          setTabNotices((prev) => ({
            ...prev,
            manpower: {
              type: "error",
              message: `Berkas "${file.name}" tersimpan di Lampiran, namun daftar personil tidak terdeteksi. Silakan tambah personil secara manual.`,
            },
          }))
        }
      } else if (currentTarget === "technical") {
        if (extracted.starts_on) setStartsOn(extracted.starts_on)
        if (extracted.ends_on) setEndsOn(extracted.ends_on)
        if (extracted.duration_plan) setDurationPlan(extracted.duration_plan)
        if (extracted.job_type) setJobType(extracted.job_type)
        if (extracted.work_details) setWorkDetails(extracted.work_details)
        if (Array.isArray(extracted.deliverables) && extracted.deliverables.length > 0) {
          setDeliverables(
            extracted.deliverables.map((d: any, idx: number) => ({
              id: `deliv-${Date.now()}-${idx}`,
              stage: d.stage || "",
              deliverable: d.deliverable || "",
              acceptance_criteria: d.acceptance_criteria || "Persetujuan review internal / klien",
            }))
          )
        }
        setTabNotices((prev) => ({
          ...prev,
          technical: {
            type: "success",
            message: `Rincian teknis, jadwal kick-off, dan ${extracted.deliverables?.length || 0} tahapan deliverable berhasil diekstrak dari "${file.name}". Berkas tersimpan di Lampiran.`,
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
          // Otomatis mereplace/mengisi seluruh tahapan jadwal yang terbaca
          setSchedule(newSch)
          setTabNotices((prev) => ({
            ...prev,
            schedule: {
              type: "success",
              message: `Berhasil mengekstrak & mengisi ${newSch.length} tahapan jadwal pelaksanaan dari "${file.name}". Tanggal dan PIC terisi otomatis. Berkas tersimpan di Lampiran.`,
            },
          }))
        } else {
          setTabNotices((prev) => ({
            ...prev,
            schedule: {
              type: "error",
              message: `Berkas "${file.name}" tersimpan di Lampiran, namun tahapan jadwal tidak terbaca terstruktur. Silakan lengkapi secara manual.`,
            },
          }))
        }
      } else if (currentTarget === "rab") {
        if (extracted.rab_total && extracted.rab_total > 0) {
          setDirectRabTotal(extracted.rab_total)
        }
        if (Array.isArray(extracted.rab_breakdown) && extracted.rab_breakdown.length > 0) {
          const newRab: RabItem[] = extracted.rab_breakdown.map((r: any, idx: number) => {
            const vol = Number(r.volume) || 1
            const price = Number(r.unit_price) || 0
            return {
              id: `rab-${Date.now()}-${idx}`,
              category: r.category || "operasional",
              description: r.description || "Pos Biaya",
              volume: vol,
              unit: r.unit || "paket",
              unit_price: price,
              total: Number(r.total) || Math.round(vol * price),
              proportion: r.proportion || "",
            }
          })
          setRab(newRab)
          setShowDetailedBreakdown(true)
        }
        if (Array.isArray(extracted.supporting_documents_checklist) && extracted.supporting_documents_checklist.length > 0) {
          setChecklist((prev) =>
            prev.map((item) => {
              const found = extracted.supporting_documents_checklist.find(
                (c: any) => c.name?.toLowerCase().includes(item.name.toLowerCase().slice(0, 10))
              )
              return found ? { ...item, checked: true, notes: found.notes || item.notes } : item
            })
          )
        }
        setTabNotices((prev) => ({
          ...prev,
          rab: {
            type: "success",
            message: `Berhasil membaca pagu RAB${extracted.rab_breakdown?.length ? ` dan ${extracted.rab_breakdown.length} komponen rincian biaya` : ""} dari "${file.name}". Berkas tersimpan di Lampiran.`,
          },
        }))
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
      {
        id: `mp-${Date.now()}`,
        name: "",
        role: "Tenaga Ahli",
        certification: "",
        duration: durationPlan || "1 Bulan",
      },
    ])
  }
  function removeManpower(id: string) {
    if (manpower.length <= 1) return
    setManpower(manpower.filter((m) => m.id !== id))
  }
  function updateManpower(id: string, field: keyof ManpowerItem, value: string) {
    setManpower(manpower.map((m) => (m.id === id ? { ...m, [field]: value } : m)))
  }

  // Handlers for Deliverables
  function addDeliverable() {
    setDeliverables([
      ...deliverables,
      {
        id: `deliv-${Date.now()}`,
        stage: "",
        deliverable: "",
        acceptance_criteria: "Persetujuan review internal / klien",
      },
    ])
  }
  function removeDeliverable(id: string) {
    if (deliverables.length <= 1) return
    setDeliverables(deliverables.filter((d) => d.id !== id))
  }
  function updateDeliverable(id: string, field: keyof DeliverableItem, value: string) {
    setDeliverables(deliverables.map((d) => (d.id === id ? { ...d, [field]: value } : d)))
  }

  // Handlers for Schedule
  function addSchedule() {
    setSchedule([
      ...schedule,
      { id: `sch-${Date.now()}`, phase: "", start_date: startsOn || "", end_date: endsOn || "", pic: "" },
    ])
  }
  function removeSchedule(id: string) {
    if (schedule.length <= 1) return
    setSchedule(schedule.filter((s) => s.id !== id))
  }
  function updateSchedule(id: string, field: keyof ScheduleItem, value: string) {
    setSchedule(schedule.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  // Handlers for RAB
  function addRab() {
    setRab([
      ...rab,
      { id: `rab-${Date.now()}`, category: "Survei lapangan dan sampling", description: "", volume: 1, unit: "paket", unit_price: 0, total: 0 },
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

  function toggleChecklist(id: string) {
    setChecklist(checklist.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)))
  }

  const busy = disabled || isPending || uploadBusy || activeOcrLoading !== null

  // Serialized work details combining job type, duration, deliverables, and description
  const serializedWorkDetails = workDetails
    ? workDetails
    : [
        `Jenis Pekerjaan: ${jobType}`,
        `Durasi Rencana: ${durationPlan}`,
        deliverables.length > 0
          ? `\nDeliverables Terukur:\n` +
            deliverables
              .map((d, i) => `${i + 1}. ${d.stage} -> ${d.deliverable} (${d.acceptance_criteria || "Persetujuan klien"})`)
              .join("\n")
          : "",
      ]
        .filter(Boolean)
        .join("\n")

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
          <p className="mt-1 text-xs text-muted">
            {rab.length > 0 ? `${rab.length} pos komponen anggaran` : "Pagu anggaran langsung"}
          </p>
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
          2. Rincian Teknis & Deliverables ({deliverables.length})
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
          4. Pagu Anggaran RAB ({rab.length || (directRabTotal > 0 ? 1 : 0)})
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
          6. Termin Pembayaran {paymentTerms.length > 0 ? `(${paymentTerms.length})` : "(Opsional)"}
        </button>
      </div>

      {/* Form Content */}
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="id" value={project.id} />
        <input type="hidden" name="version" value={project.version} />
        <input type="hidden" name="work_details" value={serializedWorkDetails} />
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
                <h3 className="font-semibold text-ink text-base">01 Tim SDM Manpower</h3>
                <p className="text-xs text-muted mt-1">
                  Daftarkan Project Manager, Ketua Tim, Tenaga Ahli, dan tim pendukung sesuai lampiran proyek.
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
                      <Sparkles className="size-3.5 text-indigo-600" /> Upload Berkas Tim SDM (Auto-Extract OCR)
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
                    <th className="px-3 py-2 w-10 text-center">No</th>
                    <th className="px-3 py-2">Nama</th>
                    <th className="px-3 py-2">Peran / Jabatan proyek</th>
                    <th className="px-3 py-2">Sertifikasi dan keahlian</th>
                    <th className="px-3 py-2">Durasi keterlibatan</th>
                    <th className="px-3 py-2 text-right w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {manpower.map((item, index) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-center text-xs font-semibold text-muted">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          required
                          value={item.name}
                          disabled={busy}
                          placeholder="e.g. Personel Dummy 01 / Ir. Ahmad Syahid"
                          onChange={(e) => updateManpower(item.id, "name", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs font-medium text-ink bg-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          required
                          value={item.role}
                          disabled={busy}
                          placeholder="e.g. Manajer proyek / Ketua tim AMDAL"
                          onChange={(e) => updateManpower(item.id, "role", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs bg-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.certification || ""}
                          disabled={busy}
                          placeholder="e.g. Pengendalian proyek AMDAL (verifikasi sertifikat)"
                          onChange={(e) => updateManpower(item.id, "certification", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs bg-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.duration || ""}
                          disabled={busy}
                          placeholder="e.g. 28 minggu (alokasi parsial)"
                          onChange={(e) => updateManpower(item.id, "duration", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs bg-white"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeManpower(item.id)}
                          disabled={busy || manpower.length <= 1}
                          className="text-red-500 hover:text-red-700 disabled:opacity-40"
                          title="Hapus baris personil"
                        >
                          <Trash2 className="size-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-muted italic pt-2">
              * Lampirkan CV, sertifikat yang relevan, surat penugasan, dan persetujuan ketersediaan tenaga ahli sebelum proyek disetujui (ACC) Direktur Utama.
            </p>
          </Card>
        )}

        {/* TAB 2: TEKNIS & DELIVERABLES */}
        {activeTab === "teknis" && (
          <Card className="p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h3 className="font-semibold text-ink text-base">02 Rincian Teknis Deliverables</h3>
                <p className="text-xs text-muted mt-0.5">
                  Tentukan parameter durasi, jenis pekerjaan, dan deliverables terukur yang wajib diserahkan.
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
                    <Loader2 className="size-3.5 animate-spin text-indigo-600" /> Membaca Dokumen Teknis...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5 text-indigo-600" /> Upload Berkas Teknis / KAK (Auto-Extract OCR)
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

            {/* Parameter Isian (Sesuai Halaman 2 PDF) */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-line bg-canvas/60 p-4">
              <label className="block text-xs">
                <span className="font-semibold text-slate-700">Tanggal Mulai (Kick-off)</span>
                <input
                  type="date"
                  value={startsOn}
                  disabled={busy}
                  onChange={(e) => setStartsOn(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-1.5 text-xs"
                />
              </label>
              <label className="block text-xs">
                <span className="font-semibold text-slate-700">Target Selesai</span>
                <input
                  type="date"
                  value={endsOn}
                  disabled={busy}
                  onChange={(e) => setEndsOn(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-1.5 text-xs"
                />
              </label>
              <label className="block text-xs">
                <span className="font-semibold text-slate-700">Durasi Rencana</span>
                <input
                  type="text"
                  value={durationPlan}
                  disabled={busy}
                  placeholder="Contoh: 28 minggu"
                  onChange={(e) => setDurationPlan(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-1.5 text-xs"
                />
              </label>
              <label className="block text-xs">
                <span className="font-semibold text-slate-700">Jenis Pekerjaan</span>
                <input
                  type="text"
                  value={jobType}
                  disabled={busy}
                  placeholder="Contoh: AMDAL / UKL-UPL"
                  onChange={(e) => setJobType(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold"
                />
              </label>
            </div>

            {/* Tabel Rincian Teknis & Deliverables Terukur */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Tabel Deliverables Terukur & Kriteria Penerimaan
                </h4>
                <Button type="button" onClick={addDeliverable} disabled={busy} variant="secondary" className="gap-1 text-xs">
                  <Plus className="size-3.5" /> Tambah Tahapan Deliverable
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="bg-canvas text-muted text-xs">
                    <tr>
                      <th className="px-3 py-2 w-10 text-center">No</th>
                      <th className="px-3 py-2">Rincian teknis / tahapan</th>
                      <th className="px-3 py-2">Deliverable terukur</th>
                      <th className="px-3 py-2">Kriteria penerimaan</th>
                      <th className="px-3 py-2 text-right w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {deliverables.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-center text-xs font-semibold text-muted">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            required
                            value={item.stage}
                            disabled={busy}
                            placeholder="e.g. Kick-off, penapisan dan rencana kerja"
                            onChange={(e) => updateDeliverable(item.id, "stage", e.target.value)}
                            className="w-full rounded border border-line px-2.5 py-1.5 text-xs bg-white font-medium"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            required
                            value={item.deliverable}
                            disabled={busy}
                            placeholder="e.g. Notulen kick-off, daftar data, rencana kerja"
                            onChange={(e) => updateDeliverable(item.id, "deliverable", e.target.value)}
                            className="w-full rounded border border-line px-2.5 py-1.5 text-xs bg-white"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.acceptance_criteria || ""}
                            disabled={busy}
                            placeholder="e.g. Persetujuan review internal / klien"
                            onChange={(e) => updateDeliverable(item.id, "acceptance_criteria", e.target.value)}
                            className="w-full rounded border border-line px-2.5 py-1.5 text-xs bg-white"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeDeliverable(item.id)}
                            disabled={busy || deliverables.length <= 1}
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
            </div>

            <label className="block text-sm pt-2">
              <span className="font-semibold text-slate-700 text-xs">Catatan Ruang Lingkup & Metodologi Tambahan (Opsional)</span>
              <textarea
                rows={4}
                value={workDetails}
                disabled={busy}
                placeholder="Tambahkan catatan khusus mengenai ruang lingkup sampling, konsultasi dinas, perizinan, atau standar teknis..."
                onChange={(e) => setWorkDetails(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-line p-3 text-xs leading-relaxed"
              />
            </label>
          </Card>
        )}

        {/* TAB 3: JADWAL & TIMESHEET */}
        {activeTab === "jadwal" && (
          <Card className="p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h3 className="font-semibold text-ink text-base">03 Jadwal Timesheet</h3>
                <p className="text-xs text-muted mt-0.5">
                  Susun jadwal tahapan pengerjaan proyek dari kick-off hingga penyerahan laporan akhir dan tentukan penanggung jawabnya.
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
                      <Loader2 className="size-3.5 animate-spin text-indigo-600" /> Membaca Jadwal...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5 text-indigo-600" /> Upload Jadwal / Timesheet (Auto-Extract OCR)
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

            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas text-muted text-xs">
                  <tr>
                    <th className="px-3 py-2 w-10 text-center">No</th>
                    <th className="px-3 py-2">Tahapan pengerjaan</th>
                    <th className="px-3 py-2 w-40">Mulai</th>
                    <th className="px-3 py-2 w-40">Target selesai</th>
                    <th className="px-3 py-2">PIC (mengacu manpower)</th>
                    <th className="px-3 py-2 text-right w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {schedule.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-center text-xs font-semibold text-muted">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          required
                          value={item.phase}
                          disabled={busy}
                          placeholder="e.g. Kick-off, penapisan dan rencana kerja"
                          onChange={(e) => updateSchedule(item.id, "phase", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs font-medium text-ink bg-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={item.start_date}
                          disabled={busy}
                          onChange={(e) => updateSchedule(item.id, "start_date", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs bg-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={item.end_date}
                          disabled={busy}
                          onChange={(e) => updateSchedule(item.id, "end_date", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs bg-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.pic}
                          disabled={busy}
                          placeholder="e.g. Manajer proyek / Personel Dummy 01"
                          onChange={(e) => updateSchedule(item.id, "pic", e.target.value)}
                          className="w-full rounded border border-line px-2.5 py-1.5 text-xs bg-white"
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

            {/* Template Timesheet Pelaksanaan Info Box (Sesuai Halaman 3 PDF) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Clock className="size-4 text-brand" />
                <span>TEMPLATE LOG TIMESHEET — DIISI SAAT PELAKSANAAN</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                Log timesheet harian (Tanggal, Nama / PIC, Tahapan / kegiatan, Jam kerja, Output / bukti) akan otomatis aktif bagi tim personil di Portal Lapangan setelah proyek disetujui Direktur Utama.
              </p>
            </div>
          </Card>
        )}

        {/* TAB 4: RENCANA ANGGARAN BIAYA (RAB) & BERKAS */}
        {activeTab === "rab" && (
          <Card className="p-5 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <h3 className="font-bold text-ink text-base">04 Berkas dan Pagu RAB</h3>
                <p className="text-xs text-muted mt-1 max-w-2xl">
                  Unggah dokumen RAB resmi, tentukan Total Pagu Anggaran RAB, dan periksa checklist berkas pendukung komersial.
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

            {/* Section 1: Input Total Pagu Anggaran RAB */}
            <div className="rounded-xl border border-line bg-canvas/60 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-ink">1. Total Nominal Pagu Anggaran RAB (Rp)</h4>
                  <p className="text-xs text-muted mt-0.5">
                    Tentukan total pagu biaya yang disetujui. Pagu ini menjadi batas pemotongan anggaran pembelian vendor dan kasbon operasional.
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
                    placeholder="Contoh: 1.896.000.000"
                    className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold text-ink"
                  />
                  {rab.length > 0 && breakdownSum > 0 && (
                    <span className="mt-1 block text-[11px] text-brand">
                      * Dihitung otomatis dari subtotal rincian pos komponen anggaran di bawah.
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

            {/* Section 2: Rincian Komponen Pos Biaya RAB */}
            <div className="rounded-xl border border-line p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                    2. Komponen Pos Anggaran RAB (Sesuai Lampiran)
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    Rincian pos komponen biaya (Tenaga ahli, survei lapangan, uji laboratorium, perjalanan dinas, overhead, dll).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowDetailedBreakdown(!showDetailedBreakdown)}
                    className="text-xs text-brand font-semibold"
                  >
                    {showDetailedBreakdown ? "Sembunyikan Komponen ▲" : "Tampilkan Komponen Detail ▼"}
                  </Button>
                  {showDetailedBreakdown && (
                    <Button type="button" onClick={addRab} disabled={busy} variant="secondary" className="gap-1 text-xs">
                      <Plus className="size-3.5" /> Tambah Komponen
                    </Button>
                  )}
                </div>
              </div>

              {showDetailedBreakdown && (
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-canvas text-muted text-xs">
                      <tr>
                        <th className="px-2 py-2">Komponen RAB</th>
                        <th className="px-2 py-2">Uraian / Keterangan</th>
                        <th className="px-2 py-2 w-20">Volume</th>
                        <th className="px-2 py-2 w-24">Satuan</th>
                        <th className="px-2 py-2 w-36">Pagu Anggaran (Rp)</th>
                        <th className="px-2 py-2 w-32 text-right">Subtotal</th>
                        <th className="px-2 py-2 text-right w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rab.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-xs text-muted">
                            Belum ada pos biaya rinci. Cukup isi Total Pagu RAB di atas atau unggah dokumen berkas RAB untuk ekstrak otomatis.
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
                                className="w-full rounded border border-line px-2 py-1.5 text-xs bg-white font-medium"
                              >
                                {rabCategories.map((c) => (
                                  <option key={c.value} value={c.value}>
                                    {c.label}
                                  </option>
                                ))}
                                {!rabCategories.some((c) => c.value === item.category) && (
                                  <option value={item.category}>{item.category}</option>
                                )}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={item.description}
                                disabled={busy}
                                placeholder="e.g. Sampling Uji Kualitas Udara & Air"
                                onChange={(e) => updateRab(item.id, "description", e.target.value)}
                                className="w-full rounded border border-line px-2 py-1.5 text-xs bg-white"
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
                                className="w-full rounded border border-line px-2 py-1.5 text-xs bg-white"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={item.unit}
                                disabled={busy}
                                placeholder="e.g. paket, titik, OB"
                                onChange={(e) => updateRab(item.id, "unit", e.target.value)}
                                className="w-full rounded border border-line px-2 py-1.5 text-xs bg-white"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <MoneyInput
                                min="0"
                                value={item.unit_price ? String(item.unit_price) : ""}
                                disabled={busy}
                                onValueChange={(val: string) => updateRab(item.id, "unit_price", Number(val) || 0)}
                                className="w-full rounded border border-line px-2 py-1.5 text-xs bg-white font-mono font-medium"
                              />
                            </td>
                            <td className="px-2 py-2 text-right font-bold text-slate-900 text-xs font-mono">
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
                            Total Pagu Komponen:
                          </td>
                          <td className="px-2 py-3 text-right text-brand font-bold font-mono">{rupiah(breakdownSum)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>

            {/* Section 3: CHECKLIST BERKAS PENDUKUNG (Sesuai Halaman 4 PDF) */}
            <div className="rounded-xl border border-line bg-canvas/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                    3. Checklist Berkas Pendukung (Pra-Eksekusi Proyek)
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    Centang berkas resmi yang telah tersedia sebelum diajukan ke Direktur Utama.
                  </p>
                </div>
                <span className="text-xs font-semibold text-brand">
                  {checklist.filter((c) => c.checked).length} dari {checklist.length} Lengkap
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 pt-1">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleChecklist(item.id)}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer text-xs transition ${
                      item.checked
                        ? "border-emerald-300 bg-emerald-50/70 text-emerald-950 font-medium"
                        : "border-line bg-white text-muted hover:border-slate-300"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 text-emerald-600">
                      {item.checked ? <CheckSquare className="size-4" /> : <Square className="size-4 text-slate-300" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={item.checked ? "text-ink font-semibold" : "text-slate-600"}>{item.name}</p>
                      {item.notes && <p className="text-[10px] text-muted">{item.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* TAB 5: LAMPIRAN PENDUKUNG */}
        {activeTab === "lampiran" && (
          <Card className="p-5 space-y-5">
            <div>
              <h3 className="font-semibold text-ink text-base">05 Lampiran Dokumen Kelengkapan Proyek</h3>
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
                <h3 className="font-semibold text-ink text-base">06 Rencana Termin Pembayaran & Penagihan Proyek</h3>
                <p className="text-xs text-muted mt-1">
                  Bagi nilai kontrak SPK ({rupiah(contractAmount)}) ke dalam beberapa tahapan termin pembayaran berdasarkan capaian pengerjaan di lapangan.
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

            {paymentTerms.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center space-y-3">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-200/80 text-slate-500">
                  <Receipt className="size-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Termin Pembayaran Bersifat Opsional</h4>
                  <p className="text-xs text-muted max-w-md mx-auto mt-1 leading-relaxed">
                    Pengisian termin tidak wajib untuk mengajukan proyek. Jika penagihan dilakukan lunas di akhir atau diatur fleksibel pada invoice penagihan, Anda dapat melewati bagian ini.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={addPaymentTerm}
                  disabled={busy}
                  className="gap-1.5 bg-brand text-white hover:bg-brand/90 text-xs mt-1"
                >
                  <Plus className="size-3.5" /> Atur Rencana Termin (Opsional)
                </Button>
              </div>
            ) : (
              <>
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
                          <button
                            type="button"
                            onClick={() => removePaymentTerm(term.id)}
                            disabled={busy}
                            className="text-muted hover:text-red-600"
                            title="Hapus termin ini"
                          >
                            <Trash2 className="size-4" />
                          </button>
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
                          <MoneyInput
                            min="0"
                            value={term.amount ? String(term.amount) : ""}
                            disabled={busy}
                            onValueChange={(val: string) => updatePaymentTerm(term.id, "amount", Number(val) || 0)}
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
              </>
            )}
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
