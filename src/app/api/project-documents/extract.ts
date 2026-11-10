import { normalizeIsoDate } from "@/app/api/invoice-documents/extract"

export type ProjectOcrTarget = "manpower" | "technical" | "schedule" | "rab" | "mom" | "all"

export type ExtractedProjectPlanning = {
  title?: string
  meeting_date?: string
  agreed_points?: string[]
  action_items?: Array<{
    task: string
    pic?: string
    deadline?: string
  }>
  job_type?: string
  duration_plan?: string
  work_details?: string
  starts_on?: string
  ends_on?: string
  deliverables?: Array<{
    stage: string
    deliverable: string
    acceptance_criteria?: string
  }>
  manpower?: Array<{
    name: string
    role: string
    certification?: string
    duration?: string
  }>
  timesheet_schedule?: Array<{
    phase: string
    start_date?: string
    end_date?: string
    pic?: string
  }>
  rab_total?: number
  contract_amount?: number
  rab_breakdown?: Array<{
    category: string
    description: string
    volume: number
    unit: string
    unit_price: number
    total: number
    proportion?: string
  }>
  supporting_documents_checklist?: Array<{
    name: string
    status: string
    notes?: string
  }>
  summary?: string
  raw_text?: string
}

async function extractPdfText(bytes: Buffer) {
  // @ts-expect-error pdfjs-dist worker module does not expose a TypeScript declaration file
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs")
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    verbosity: 0,
    useSystemFonts: true,
  })
  try {
    const doc = await task.promise
    const pages: string[] = []
    for (let n = 1; n <= Math.min(doc.numPages, 10); n++) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      const words = content.items.filter((item): item is import("pdfjs-dist/types/src/display/api").TextItem => "str" in item)
      const rows: { y: number; words: typeof words }[] = []
      for (const item of words.sort((a, b) => b.transform[5] - a.transform[5])) {
        let row = rows.find((r) => Math.abs(r.y - item.transform[5]) <= Math.max(2, item.height * 0.4))
        if (!row) {
          row = { y: item.transform[5], words: [] }
          rows.push(row)
        }
        row.words.push(item)
      }
      pages.push(rows.map((r) => r.words.sort((a, b) => a.transform[4] - b.transform[4]).map((w) => w.str).join(" ")).join("\n"))
    }
    return { text: pages.join("\n\n"), truncated: doc.numPages > 10 }
  } finally {
    await task.destroy()
  }
}

function buildTargetedPrompt(target: ProjectOcrTarget, extractedText?: string): string {
  const contextInstruction = extractedText
    ? `\nBERIKUT ADALAH TEKS DOKUMEN:\n"""\n${extractedText}\n"""\n`
    : ""

  if (target === "manpower") {
    return `Anda adalah asisten cerdas sistem ERP Manajemen Proyek Konsultasi Lingkungan & Perizinan (PT Global Solusi Prima).
Tugas Anda adalah membaca dokumen daftar personil / tim ahli / CV / susunan tenaga pelaksana proyek yang terlampir dengan teliti.
FOKUS HANYA PADA EKSTRAKSI TIM SDM / MANPOWER.

ATURAN WAJIB:
1. Ekstrak SEMUA personil yang ada di tabel tanpa terkecuali (jika ada 7, 10, atau 20 personil, masukkan semuanya).
2. Jangan potong atau hilangkan satu personil pun.
3. Hasilkan JSON murni tanpa pembungkus markdown apapun:
{
  "manpower": [
    {
      "name": "Nama lengkap personil (misal: Personel Dummy 01, Ir. Ahmad Syahid)",
      "role": "Peran / jabatan proyek (misal: Manajer proyek, Ketua tim AMDAL, Ahli fisik-kimia, Ahli biologi, Ahli sosial, Surveyor/GIS, QA/dokumentasi)",
      "certification": "Sertifikasi dan keahlian (misal: Pengendalian proyek AMDAL, Penyusunan AMDAL, Air/udara/kebisingan)",
      "duration": "Durasi keterlibatan (misal: 28 minggu (alokasi parsial), 1 Bulan)"
    }
  ],
  "summary": "Ringkasan jumlah personil yang berhasil diekstrak (contoh: 'Berhasil membaca 7 personil tim proyek')"
}${contextInstruction}`
  }

  if (target === "technical") {
    return `Anda adalah asisten cerdas sistem ERP Manajemen Proyek Konsultasi Lingkungan & Perizinan (PT Global Solusi Prima).
Tugas Anda adalah membaca dokumen rincian teknis / deliverables / Kerangka Acuan Kerja (KAK) / TOR proyek yang terlampir.
FOKUS PADA RINCIAN TEKNIS, PARAMETER JADWAL, DAN DELIVERABLES TERUKUR.

ATURAN WAJIB:
1. Tanggal mulai dan selesai WAJIB dikonversi ke format ISO YYYY-MM-DD (misal 16-11-2026 menjadi 2026-11-16).
2. Ekstrak tabel rincian teknis / tahapan dan deliverable terukur beserta kriteria penerimaannya secara lengkap.
3. Hasilkan JSON murni tanpa pembungkus markdown apapun:
{
  "starts_on": "YYYY-MM-DD",
  "ends_on": "YYYY-MM-DD",
  "job_type": "Jenis pekerjaan (misal: AMDAL, UKL-UPL, Audit Lingkungan)",
  "duration_plan": "Durasi rencana (misal: 28 minggu)",
  "deliverables": [
    {
      "stage": "Tahapan / rincian teknis (misal: Kick-off, penapisan dan rencana kerja)",
      "deliverable": "Deliverable terukur (misal: Notulen kick-off, daftar data, rencana kerja)",
      "acceptance_criteria": "Kriteria penerimaan (misal: Persetujuan review internal / klien)"
    }
  ],
  "work_details": "Rangkuman menyeluruh tentang ruang lingkup teknis, tahapan, metodologi, dan deliverables dokumen akhir",
  "summary": "Ringkasan parameter teknis dan deliverables"
}${contextInstruction}`
  }

  if (target === "schedule") {
    return `Anda adalah asisten cerdas sistem ERP Manajemen Proyek Konsultasi Lingkungan & Perizinan (PT Global Solusi Prima).
Tugas Anda adalah membaca dokumen jadwal kerja / Kurva S / tahapan waktu pelaksanaan / timesheet proyek yang terlampir.
FOKUS HANYA PADA TAHAPAN PELAKSANAAN DAN JADWAL WAKTU.

ATURAN WAJIB:
1. Format tanggal mulai (start_date) dan target selesai (end_date) WAJIB berupa ISO YYYY-MM-DD (misal 16-11-2026 menjadi 2026-11-16).
2. Ekstrak SEMUA tahapan pekerjaan secara berurutan.
3. Hasilkan JSON murni tanpa pembungkus markdown apapun:
{
  "timesheet_schedule": [
    {
      "phase": "Nama tahapan pengerjaan (misal: Kick-off, penapisan dan rencana kerja)",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "pic": "PIC / personil penanggung jawab (misal: Manajer proyek / Personel Dummy 01)"
    }
  ],
  "summary": "Ringkasan jumlah tahapan jadwal yang berhasil diidentifikasi"
}${contextInstruction}`
  }

  if (target === "rab") {
    return `Anda adalah asisten cerdas sistem ERP Manajemen Proyek Konsultasi Lingkungan & Perizinan (PT Global Solusi Prima).
Tugas Anda adalah membaca dokumen Rencana Anggaran Biaya (RAB) / Pagu Anggaran / Berkas Pendukung proyek yang terlampir.
FOKUS PADA PAGU ANGGARAN, KOMPONEN RAB, DAN CHECKLIST BERKAS.

ATURAN WAJIB:
1. Semua angka nominal uang berupa integer angka murni tanpa simbol 'Rp' atau titik pemisah ribuan.
2. rab_total diisi total pagu biaya atau nilai SPH sumber.
3. Ekstrak seluruh komponen biaya dan checklist dokumen pendukung jika tersedia.
4. Hasilkan JSON murni tanpa pembungkus markdown apapun:
{
  "rab_total": angka_nominal_total_pagu,
  "contract_amount": angka_nominal_sph_sumber_jika_ada,
  "rab_breakdown": [
    {
      "category": "Kategori / nama komponen (misal: Tenaga ahli dan tim pelaksana, Survei lapangan, Uji lab, Overhead, dll)",
      "description": "Uraian kebutuhan pos biaya",
      "volume": 1,
      "unit": "paket",
      "unit_price": angka_nominal_harga_satuan,
      "total": angka_nominal_total,
      "proportion": "Persentase dari SPH (misal: 31% dari SPH)"
    }
  ],
  "supporting_documents_checklist": [
    {
      "name": "Nama berkas (misal: SPH, Kontrak/SPK, KAK/TOR, Peta lokasi, Surat penugasan)",
      "status": "status centang / belum dilampirkan",
      "notes": "Keterangan jika ada"
    }
  ],
  "summary": "Ringkasan total pagu anggaran dan komponen RAB yang berhasil dibaca"
}${contextInstruction}`
  }

  // Fallback: all fields
  return `Anda adalah asisten cerdas sistem ERP Manajemen Proyek Konsultasi Lingkungan & Perizinan (PT Global Solusi Prima).
Tugas Anda adalah membaca dokumen perencanaan proyek yang terlampir dan mengekstrak seluruh data:
{
  "job_type": "string",
  "duration_plan": "string",
  "starts_on": "YYYY-MM-DD",
  "ends_on": "YYYY-MM-DD",
  "work_details": "string",
  "deliverables": [{ "stage": "...", "deliverable": "...", "acceptance_criteria": "..." }],
  "manpower": [{ "name": "...", "role": "...", "certification": "...", "duration": "..." }],
  "timesheet_schedule": [{ "phase": "...", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "pic": "..." }],
  "rab_total": 0,
  "rab_breakdown": [{ "category": "...", "description": "...", "volume": 1, "unit": "paket", "unit_price": 0, "total": 0 }],
  "summary": "Ringkasan data perencanaan proyek"
}${contextInstruction}`
}

async function extractWithGeminiProject(
  bytes: Buffer | null,
  mimeType: string,
  target: ProjectOcrTarget = "all",
  extractedText?: string
): Promise<ExtractedProjectPlanning | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return null

  const prompt = buildTargetedPrompt(target, extractedText)
  const isVertexKey = apiKey.startsWith("AQ.")

  // Daftar model yang aktif & didukung saat ini (termasuk gemini-3.1-flash-lite & gemini-flash-latest)
  const candidateModels = [
    process.env.GEMINI_MODEL?.trim(),
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-flash-latest",
    "gemini-3.8-flash",
  ].filter((m): m is string => Boolean(m))

  // Siapkan isi request: jika ada teks ekstrak, gunakan parts teks agar ekstra cepat & hemat kuota.
  // Jika tidak ada teks (misal scan gambar PNG/JPG), kirim inline base64.
  const parts: Array<Record<string, any>> = [{ text: prompt }]
  if (bytes && (!extractedText || extractedText.length < 50)) {
    parts.push({
      inlineData: {
        mimeType,
        data: bytes.toString("base64"),
      },
    })
  }

  for (const modelName of [...new Set(candidateModels)]) {
    const endpoints = isVertexKey
      ? [
          `https://aiplatform.googleapis.com/v1/publishers/google/models/${modelName}:generateContent?key=${apiKey}`,
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        ]
      : [
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          `https://aiplatform.googleapis.com/v1/publishers/google/models/${modelName}:generateContent?key=${apiKey}`,
        ]

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
        })

        if (!response.ok) {
          continue
        }

        const data = await response.json()
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (!content) continue

        const cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim()
        const parsed = JSON.parse(cleaned)

        const normalizedStartsOn = normalizeIsoDate(parsed.starts_on)
        const normalizedEndsOn = normalizeIsoDate(parsed.ends_on)

        return {
          title: parsed.title ? String(parsed.title).trim() : undefined,
          meeting_date: normalizeIsoDate(parsed.meeting_date),
          agreed_points: Array.isArray(parsed.agreed_points) ? parsed.agreed_points.map((p: any) => String(p).trim()).filter(Boolean) : undefined,
          action_items: Array.isArray(parsed.action_items) ? parsed.action_items.map((a: any) => ({
            task: String(a.task || "").trim(),
            pic: a.pic ? String(a.pic).trim() : undefined,
            deadline: normalizeIsoDate(a.deadline) || (a.deadline ? String(a.deadline).trim() : undefined),
          })) : undefined,
          job_type: parsed.job_type ? String(parsed.job_type).trim() : undefined,
          duration_plan: parsed.duration_plan ? String(parsed.duration_plan).trim() : undefined,
          work_details: parsed.work_details ? String(parsed.work_details).trim() : undefined,
          starts_on: normalizedStartsOn,
          ends_on: normalizedEndsOn,
          deliverables: Array.isArray(parsed.deliverables)
            ? parsed.deliverables.map((d: any) => ({
                stage: String(d.stage || "").trim(),
                deliverable: String(d.deliverable || "").trim(),
                acceptance_criteria: d.acceptance_criteria ? String(d.acceptance_criteria).trim() : undefined,
              }))
            : undefined,
          manpower: Array.isArray(parsed.manpower)
            ? parsed.manpower
                .map((m: any) => ({
                  name: String(m.name || "").trim(),
                  role: String(m.role || "Tenaga Ahli").trim(),
                  certification: m.certification ? String(m.certification).trim() : undefined,
                  duration: m.duration ? String(m.duration).trim() : undefined,
                }))
                .filter((m: { name: string; role: string }) => m.name || m.role)
            : undefined,
          timesheet_schedule: Array.isArray(parsed.timesheet_schedule)
            ? parsed.timesheet_schedule
                .map((s: any) => ({
                  phase: String(s.phase || "").trim(),
                  start_date: normalizeIsoDate(s.start_date) || "",
                  end_date: normalizeIsoDate(s.end_date) || "",
                  pic: s.pic ? String(s.pic).trim() : "",
                }))
                .filter((s: { phase: string }) => Boolean(s.phase))
            : undefined,
          rab_total: typeof parsed.rab_total === "number" ? parsed.rab_total : Number(parsed.rab_total) || undefined,
          contract_amount: typeof parsed.contract_amount === "number" ? parsed.contract_amount : Number(parsed.contract_amount) || undefined,
          rab_breakdown: Array.isArray(parsed.rab_breakdown)
            ? parsed.rab_breakdown.map((r: any) => {
                const vol = Number(r.volume) || 1
                const price = Number(r.unit_price) || 0
                return {
                  category: String(r.category || "operasional").trim(),
                  description: String(r.description || r.category || "Pos Biaya").trim(),
                  volume: vol,
                  unit: String(r.unit || "paket").trim(),
                  unit_price: price,
                  total: Number(r.total) || Math.round(vol * price),
                  proportion: r.proportion ? String(r.proportion).trim() : undefined,
                }
              })
            : undefined,
          supporting_documents_checklist: Array.isArray(parsed.supporting_documents_checklist)
            ? parsed.supporting_documents_checklist.map((c: any) => ({
                name: String(c.name || "").trim(),
                status: String(c.status || "Belum").trim(),
                notes: c.notes ? String(c.notes).trim() : undefined,
              }))
            : undefined,
          summary: parsed.summary || "Dokumen berhasil dianalisis dengan AI Gemini Vision.",
        }
      } catch {
        // Coba model berikutnya
      }
    }
  }

  return null
}

// ============================================================================
// PARSER LOKAL FALLBACK (Untuk PDF teks jika AI mengalami kendala jaringan)
// ============================================================================
function parseLocalManpower(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const manpower: Array<{ name: string; role: string; certification?: string; duration?: string }> = []

  for (const line of lines) {
    // Pola baris: No Nama Peran Sertifikasi Durasi
    const match = line.match(
      /^(\d+)\s+(Personel\s+[A-Za-z0-9\s._-]+?|Ir\.\s+[A-Za-z\s._-]+|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(Manajer\s+proyek|Ketua\s+tim\s+[A-Za-z]+|Ahli\s+[A-Za-z-]+|Surveyor\/?[A-Za-z]*|QA\/?[A-Za-z]*|Tenaga\s+Ahli\s+[A-Za-z]+|Koordinator\s+[A-Za-z]+|Drafter\/?[A-Za-z]*|Field\s+Officer|[A-Za-z\s/]+?)\s+((?:Pengendalian|Penyusunan|Air|Ekologi|Sosial|Sampling|Review|KTPA|ATPA|SKA|K3|Sertifikat).+?)\s+(\d+\s+(?:minggu|bulan|hari)(?:\s*\([^)]+\))?)$/i
    )
    if (match) {
      manpower.push({
        name: match[2].trim(),
        role: match[3].trim(),
        certification: match[4].trim(),
        duration: match[5].trim(),
      })
    } else {
      const numMatch = line.match(/^(\d+)\s+([A-Za-z0-9\s._-]+?)\s{2,}([A-Za-z\s/]+?)\s{2,}(.+?)\s{2,}(\d+\s+[A-Za-z\s()]+)$/)
      if (numMatch) {
        manpower.push({
          name: numMatch[2].trim(),
          role: numMatch[3].trim(),
          certification: numMatch[4].trim(),
          duration: numMatch[5].trim(),
        })
      }
    }
  }
  return manpower
}

function parseLocalSchedule(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const schedule: Array<{ phase: string; start_date?: string; end_date?: string; pic?: string }> = []

  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(.+?)\s+(\d{2}-\d{2}-\d{4})\s+(\d{2}-\d{2}-\d{4})\s+(.+)$/)
    if (match) {
      schedule.push({
        phase: match[2].trim(),
        start_date: normalizeIsoDate(match[3]),
        end_date: normalizeIsoDate(match[4]),
        pic: match[5].trim(),
      })
    }
  }
  return schedule
}

function parseLocalTechnical(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let starts_on: string | undefined
  let ends_on: string | undefined
  let duration_plan: string | undefined
  let job_type: string | undefined
  const deliverables: Array<{ stage: string; deliverable: string; acceptance_criteria?: string }> = []

  for (const line of lines) {
    const startMatch = line.match(/Tanggal mulai[^:]*:\s*(\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})/i) || line.match(/Tanggal mulai[^\d]*(\d{2}-\d{2}-\d{4})/i)
    if (startMatch) starts_on = normalizeIsoDate(startMatch[1])

    const endMatch = line.match(/Target selesai[^:]*:\s*(\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})/i) || line.match(/Target selesai[^\d]*(\d{2}-\d{2}-\d{4})/i)
    if (endMatch) ends_on = normalizeIsoDate(endMatch[1])

    const durMatch = line.match(/Durasi rencana\s*([0-9]+\s*minggu|[0-9]+\s*bulan)/i)
    if (durMatch) duration_plan = durMatch[1].trim()

    const typeMatch = line.match(/Jenis pekerjaan\s*([A-Za-z0-9\s/-]+)/i)
    if (typeMatch) job_type = typeMatch[1].trim()

    const delivMatch = line.match(/^(\d+)\s+(.+?)\s{2,}(.+?)\s{2,}(Persetujuan.+|Review.+|Diterima.+)$/i)
    if (delivMatch) {
      deliverables.push({
        stage: delivMatch[2].trim(),
        deliverable: delivMatch[3].trim(),
        acceptance_criteria: delivMatch[4].trim(),
      })
    }
  }

  return { starts_on, ends_on, duration_plan, job_type, deliverables }
}

function parseLocalRab(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const rab: Array<{ category: string; description: string; volume: number; unit: string; unit_price: number; total: number; proportion?: string }> = []
  let rabTotal = 0
  let contractAmount = 0

  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9\s,\/&]+?)\s+(?:Pagu\s+estimasi\s+)?Rp\s*([\d.,]+)\s*(\d+%\s*dari\s*SPH)?$/i)
    if (match) {
      const desc = match[1].trim()
      const numStr = match[2].replace(/\./g, "").replace(/,/g, ".")
      const amount = Number(numStr) || 0
      const prop = match[3] ? match[3].trim() : undefined

      if (desc.toUpperCase().includes("TOTAL PAGU BIAYA")) {
        rabTotal = amount
      } else if (!desc.toUpperCase().includes("TOTAL") && !desc.toUpperCase().includes("ESTIMASI LABA")) {
        rab.push({
          category: desc,
          description: desc,
          volume: 1,
          unit: "paket",
          unit_price: amount,
          total: amount,
          proportion: prop,
        })
      }
    }
    const sphMatch = line.match(/Nilai SPH sumber:\s*Rp\s*([\d.,]+)/i)
    if (sphMatch) {
      contractAmount = Number(sphMatch[1].replace(/\./g, "")) || 0
      if (!rabTotal) rabTotal = contractAmount
    }
  }
  return { rab, rabTotal, contractAmount }
}

export async function extractProjectPlanningDocument(
  bytes: Buffer,
  extension: string,
  target: ProjectOcrTarget = "all"
): Promise<ExtractedProjectPlanning> {
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  }

  let pdfText = ""
  if (extension === "pdf") {
    try {
      const parsed = await extractPdfText(bytes)
      pdfText = parsed.text.trim()
    } catch (err) {
      console.warn("PDF coordinate text extraction error:", err)
    }
  }

  // 1. Ekstraksi AI Gemini Vision Cerdas (Text-First jika PDF, atau Base64 Image)
  if (process.env.GEMINI_API_KEY?.trim() && mimeMap[extension]) {
    try {
      const geminiResult = await extractWithGeminiProject(
        pdfText ? null : bytes,
        mimeMap[extension],
        target,
        pdfText || undefined
      )
      if (geminiResult) {
        return geminiResult
      }
    } catch (e) {
      console.warn("Gemini Project OCR processing error, falling back to local text parser:", e)
    }
  }

  // 2. Fallback Lokal Berbasis Teks PDF (100% Cepat & Berjalan Tanpa Token)
  if (pdfText) {
    const localManpower = parseLocalManpower(pdfText)
    const localSchedule = parseLocalSchedule(pdfText)
    const localTech = parseLocalTechnical(pdfText)
    const localRab = parseLocalRab(pdfText)

    return {
      job_type: localTech.job_type,
      duration_plan: localTech.duration_plan,
      starts_on: localTech.starts_on,
      ends_on: localTech.ends_on,
      deliverables: localTech.deliverables.length ? localTech.deliverables : undefined,
      work_details: pdfText.slice(0, 2000),
      manpower: localManpower.length ? localManpower : undefined,
      timesheet_schedule: localSchedule.length ? localSchedule : undefined,
      rab_total: localRab.rabTotal || undefined,
      contract_amount: localRab.contractAmount || undefined,
      rab_breakdown: localRab.rab.length ? localRab.rab : undefined,
      summary: `Berhasil mengekstrak ${localManpower.length} personil, ${localSchedule.length} jadwal tahapan, dan ${localRab.rab.length} pos pagu RAB secara otomatis dari dokumen PDF.`,
      raw_text: pdfText,
    }
  }

  return {
    summary: "Dokumen berhasil disimpan sebagai lampiran resmi proyek.",
  }
}
