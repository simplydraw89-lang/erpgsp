import path from "node:path"
import { pathToFileURL } from "node:url"

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
  work_details?: string
  starts_on?: string
  ends_on?: string
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
  rab_breakdown?: Array<{
    category: "personil" | "non_personil" | "lab_sampling" | "operasional" | "sidang_perizinan"
    description: string
    volume: number
    unit: string
    unit_price: number
    total: number
  }>
  summary?: string
  raw_text?: string
}

async function extractPdfText(bytes: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 })
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

function buildTargetedPrompt(target: ProjectOcrTarget): string {
  if (target === "manpower") {
    return `Anda adalah asisten cerdas sistem ERP Manajemen Proyek Konsultasi Lingkungan & Perizinan (PT Global Solusi Prima).
Tugas Anda adalah membaca dokumen daftar personil / tim ahli / CV / susunan tenaga pelaksana proyek yang terlampir dengan teliti.
FOKUS HANYA PADA EKSTRAKSI TIM SDM / MANPOWER.
Hasilkan JSON murni tanpa pembungkus markdown apapun:
{
  "manpower": [
    {
      "name": "Nama lengkap personil jika ada, atau nama posisi (misal: Ir. Ahmad Syahid)",
      "role": "Peran / jabatan proyek (misal: Team Leader, Tenaga Ahli AMDAL, Ahli K3, Surveyor Lapangan, GIS/Drafter)",
      "certification": "Sertifikasi atau keahlian jika tertera (misal: KTPA, ATPA, SKA Lingkungan, Ahli K3)",
      "duration": "Estimasi durasi penugasan jika ada (misal: 1 Bulan, 2 Minggu, 5 Hari)"
    }
  ],
  "summary": "Ringkasan jumlah personil yang berhasil diekstrak dari dokumen"
}`
  }

  if (target === "technical") {
    return `Anda adalah asisten cerdas sistem ERP Manajemen Proyek Konsultasi Lingkungan & Perizinan (PT Global Solusi Prima).
Tugas Anda adalah membaca dokumen teknis / Kerangka Acuan Kerja (KAK) / TOR / Spesifikasi Teknis proyek yang terlampir.
FOKUS HANYA PADA RINCIAN TEKNIS, TANGGAL PELAKSANAAN, DAN DELIVERABLES LAPORAN.
Hasilkan JSON murni tanpa pembungkus markdown apapun:
{
  "starts_on": "Tanggal mulai pelaksanaan jika ada (format YYYY-MM-DD), atau null jika tidak ada",
  "ends_on": "Target tanggal selesai/penyerahan jika ada (format YYYY-MM-DD), atau null jika tidak ada",
  "work_details": "Rincian menyeluruh tentang ruang lingkup pekerjaan, metodologi teknis pelaksanaan, standar baku mutu, dan deliverables dokumen akhir yang wajib diserahkan",
  "summary": "Ringkasan ruang lingkup teknis dan target pengerjaan"
}`
  }

  if (target === "schedule") {
    return `Anda adalah asisten cerdas sistem ERP Manajemen Proyek Konsultasi Lingkungan & Perizinan (PT Global Solusi Prima).
Tugas Anda adalah membaca dokumen jadwal kerja / Kurva S / tahapan waktu pelaksanaan / timesheet proyek yang terlampir.
FOKUS HANYA PADA TAHAPAN PELAKSANAAN DAN JADWAL WAKTU.
Hasilkan JSON murni tanpa pembungkus markdown apapun:
{
  "timesheet_schedule": [
    {
      "phase": "Nama tahapan pengerjaan (misal: Mobilisasi Tim, Uji Laboratorium Sampel, Penyusunan Dokumen Andal, Sidang Komisi, Penyerahan Laporan Akhir)",
      "start_date": "Tanggal mulai tahapan (format YYYY-MM-DD), atau string kosong",
      "end_date": "Target tanggal selesai tahapan (format YYYY-MM-DD), atau string kosong",
      "pic": "PIC / penanggung jawab tahapan jika ada"
    }
  ],
  "summary": "Ringkasan jumlah tahapan jadwal yang berhasil diidentifikasi"
}`
  }

  if (target === "rab") {
    return `Anda adalah asisten cerdas sistem ERP Manajemen Proyek Konsultasi Lingkungan & Perizinan (PT Global Solusi Prima).
Tugas Anda adalah membaca dokumen Rencana Anggaran Biaya (RAB) / Bill of Quantities (BoQ) / rincian biaya penawaran proyek yang terlampir.
FOKUS HANYA PADA RINCIAN POS ANGGARAN BIAYA (RAB).
Hasilkan JSON murni tanpa pembungkus markdown apapun:
{
  "rab_breakdown": [
    {
      "category": "PILIH PERSIS SALAH SATU: 'personil' (biaya honor/gaji ahli & surveyor), 'non_personil' (akomodasi & transportasi), 'lab_sampling' (uji laboratorium sampel air/udara/tanah), 'sidang_perizinan' (biaya sidang dinas/komisi), atau 'operasional' (laporan, ATK, perlengkapan lapangan)",
      "description": "Uraian kebutuhan pos biaya secara jelas",
      "volume": angka_numerik_volume (default 1 jika tidak ada),
      "unit": "Satuan biaya (misal: OB, Titik, Paket, Hari, Kali, Rim)",
      "unit_price": angka_numerik_harga_satuan,
      "total": angka_numerik_total_subtotal (volume * unit_price)
    }
  ],
  "summary": "Ringkasan jumlah pos anggaran dan total pagu yang terbaca"
}
Aturan penting: Volume, unit_price, dan total WAJIB angka numerik murni tanpa simbol 'Rp' atau titik pemisah ribuan.`
  }

  if (target === "mom") {
    return `Anda adalah asisten cerdas sistem ERP Manajemen Proyek Konsultasi Lingkungan & Perizinan (PT Global Solusi Prima).
Tugas Anda adalah membaca dokumen notulensi rapat / Minutes of Meeting (MoM) / Berita Acara Rapat koordinasi proyek yang terlampir.
FOKUS PADA EKSTRAKSI HASIL RAPAT & KESEPAKATAN:
Hasilkan JSON murni tanpa pembungkus markdown apapun:
{
  "title": "Topik atau agenda utama rapat (misal: Rapat Koordinasi Pembahasan AMDAL & Kebutuhan Data Amdalnet)",
  "meeting_date": "Tanggal rapat jika ada (format YYYY-MM-DD), atau null jika tidak tertera",
  "agreed_points": [
    "Poin kesepakatan 1",
    "Poin kesepakatan 2"
  ],
  "action_items": [
    {
      "task": "Tugas tindak lanjut (misal: Menyerahkan data layout IPAL terbaru ke konsultan)",
      "pic": "Pihak yang bertanggung jawab (Klien / Konsultan / PIC)",
      "deadline": "Batas waktu atau tenggat jika ada"
    }
  ],
  "summary": "Ringkasan lengkap notulensi rapat dan poin penting yang disepakati bersama"
}`
  }

  // Fallback: all fields
  return `Anda adalah asisten cerdas sistem ERP Manajemen Proyek Konsultasi Lingkungan & Perizinan (PT Global Solusi Prima).
Tugas Anda adalah membaca dokumen perencanaan proyek yang terlampir dan mengekstrak data terstruktur dalam format JSON murni:
{
  "work_details": "Rincian ruang lingkup pekerjaan dan deliverables",
  "starts_on": "YYYY-MM-DD atau null",
  "ends_on": "YYYY-MM-DD atau null",
  "manpower": [{ "name": "...", "role": "...", "certification": "...", "duration": "..." }],
  "timesheet_schedule": [{ "phase": "...", "start_date": "...", "end_date": "...", "pic": "..." }],
  "rab_breakdown": [{ "category": "personil|non_personil|lab_sampling|operasional|sidang_perizinan", "description": "...", "volume": 1, "unit": "...", "unit_price": 0, "total": 0 }],
  "summary": "Ringkasan data"
}`
}

async function extractWithGeminiProject(
  bytes: Buffer,
  mimeType: string,
  target: ProjectOcrTarget = "all"
): Promise<ExtractedProjectPlanning | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return null

  try {
    const base64Data = bytes.toString("base64")
    const prompt = buildTargetedPrompt(target)

    const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash"
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.1,
          },
        }),
      }
    )

    if (!response.ok) {
      console.warn("Gemini Project OCR API status:", response.status)
      return null
    }

    const data = await response.json()
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) return null

    const cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim()
    const parsed = JSON.parse(cleaned)

    return {
      title: parsed.title ? String(parsed.title).trim() : undefined,
      meeting_date: parsed.meeting_date ? String(parsed.meeting_date).trim() : undefined,
      agreed_points: Array.isArray(parsed.agreed_points) ? parsed.agreed_points.map((p: any) => String(p).trim()).filter(Boolean) : undefined,
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items.map((a: any) => ({
        task: String(a.task || "").trim(),
        pic: a.pic ? String(a.pic).trim() : undefined,
        deadline: a.deadline ? String(a.deadline).trim() : undefined,
      })) : undefined,
      work_details: parsed.work_details || undefined,
      starts_on: parsed.starts_on || undefined,
      ends_on: parsed.ends_on || undefined,
      manpower: Array.isArray(parsed.manpower)
        ? parsed.manpower.map((m: any) => ({
            name: String(m.name || "").trim(),
            role: String(m.role || "").trim(),
            certification: m.certification ? String(m.certification).trim() : undefined,
            duration: m.duration ? String(m.duration).trim() : undefined,
          }))
        : undefined,
      timesheet_schedule: Array.isArray(parsed.timesheet_schedule)
        ? parsed.timesheet_schedule.map((s: any) => ({
            phase: String(s.phase || "").trim(),
            start_date: s.start_date ? String(s.start_date).trim() : "",
            end_date: s.end_date ? String(s.end_date).trim() : "",
            pic: s.pic ? String(s.pic).trim() : "",
          }))
        : undefined,
      rab_breakdown: Array.isArray(parsed.rab_breakdown)
        ? parsed.rab_breakdown.map((r: any) => {
            const vol = Number(r.volume) || 1
            const price = Number(r.unit_price) || 0
            const validCategories = ["personil", "non_personil", "lab_sampling", "operasional", "sidang_perizinan"]
            const cat = validCategories.includes(r.category) ? r.category : "operasional"
            return {
              category: cat as any,
              description: String(r.description || "").trim(),
              volume: vol,
              unit: String(r.unit || "Paket").trim(),
              unit_price: price,
              total: Number(r.total) || Math.round(vol * price),
            }
          })
        : undefined,
      summary: parsed.summary || "Dokumen berhasil dianalisis dengan AI Gemini Vision.",
    }
  } catch (err) {
    console.warn("Gemini Project OCR failed:", err)
    return null
  }
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

  // 1. Prioritize Gemini AI Vision with targeted prompt
  if (process.env.GEMINI_API_KEY?.trim() && mimeMap[extension]) {
    try {
      const geminiResult = await extractWithGeminiProject(bytes, mimeMap[extension], target)
      if (geminiResult) {
        return geminiResult
      }
    } catch (e) {
      console.warn("Gemini Project OCR processing error, falling back:", e)
    }
  }

  // 2. Fallback: Native PDF Text Extraction if available
  if (extension === "pdf") {
    try {
      const pdfText = await extractPdfText(bytes)
      const text = pdfText.text.trim()
      if (text) {
        const dates = text.match(/\b\d{4}-\d{2}-\d{2}\b/g)
        return {
          work_details: target === "technical" || target === "all" ? text.slice(0, 1500) : undefined,
          starts_on: dates?.[0],
          ends_on: dates?.[1],
          summary: "Teks PDF terbaca secara lokal. Periksa dan lengkapi rincian form.",
          raw_text: text,
        }
      }
    } catch (err) {
      console.warn("PDF local text extraction failed:", err)
    }
  }

  return {
    summary: "Dokumen berhasil disimpan sebagai lampiran resmi proyek.",
  }
}
