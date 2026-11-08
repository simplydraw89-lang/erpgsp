import path from "node:path"
import { pathToFileURL } from "node:url"

export type ExtractedProjectPlanning = {
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

async function extractWithGeminiProject(bytes: Buffer, mimeType: string): Promise<ExtractedProjectPlanning | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return null

  try {
    const base64Data = bytes.toString("base64")
    const prompt = `Anda adalah asisten cerdas sistem ERP Manajemen Proyek Konsultasi Lingkungan & Perizinan (PT Global Solusi Prima).
Tugas Anda adalah menganalisis dokumen perencanaan proyek (seperti Kerangka Acuan Kerja / TOR / KAK, Dokumen Rencana Kerja Teknis, Jadwal Pelaksanaan / Kurva S, atau Rincian Anggaran Biaya / RAB / BoQ / Penawaran Biaya) yang terlampir dengan sangat teliti dan mengekstrak data terstruktur ke dalam format JSON murni tanpa pembungkus markdown apapun.

Format JSON yang wajib dihasilkan:
{
  "work_details": "Rincian ruang lingkup pekerjaan, metodologi pengerjaan, standar teknis, dan deliverables/dokumen hasil akhir yang harus disusun",
  "starts_on": "YYYY-MM-DD atau null jika tidak tertera",
  "ends_on": "YYYY-MM-DD atau null jika tidak tertera",
  "manpower": [
    {
      "name": "Nama personil jika ada, atau jabatan (misal: Ir. Budi Santoso, ST)",
      "role": "Peran di proyek (misal: Team Leader, Tenaga Ahli AMDAL, Ahli K3, Surveyor Lapangan, GIS/Drafter)",
      "certification": "Sertifikasi atau keahlian jika ada (misal: KTPA, ATPA, SKA Lingkungan)",
      "duration": "Estimasi durasi penugasan (misal: 1 Bulan, 3 Bulan, 14 Hari)"
    }
  ],
  "timesheet_schedule": [
    {
      "phase": "Nama tahapan pekerjaan (misal: Mobilisasi & Sosialisasi, Uji Sampling Lingkungan, Penyusunan Dokumen Andal & RKL-RPL, Sidang Komisi Amdal, Penyerahan Dokumen Akhir)",
      "start_date": "YYYY-MM-DD atau string kosong",
      "end_date": "YYYY-MM-DD atau string kosong",
      "pic": "PIC atau penanggung jawab tahapan jika ada"
    }
  ],
  "rab_breakdown": [
    {
      "category": "PILIH PERSIS SALAH SATU: 'personil' (biaya gaji/honor ahli), 'non_personil' (transportasi & akomodasi), 'lab_sampling' (uji laboratorium sampel air/udara/tanah), 'sidang_perizinan' (biaya sidang komisi amdal/pembahasan dinas), atau 'operasional' (laporan, ATK, perlengkapan lapangan)",
      "description": "Uraian kebutuhan pos biaya secara jelas",
      "volume": angka_numerik_volume (default 1 jika tidak ada),
      "unit": "Satuan biaya (misal: OB, Titik, Paket, Hari, Kali, Rim)",
      "unit_price": angka_numerik_harga_satuan,
      "total": angka_numerik_total_subtotal (volume * unit_price)
    }
  ],
  "summary": "Ringkasan singkat data yang berhasil dibaca dan diidentifikasi dari berkas ini"
}

Aturan penting:
1. Volume, unit_price, dan total WAJIB angka numerik bulat/desimal murni (misal: 2500000, BUKAN 'Rp 2.500.000').
2. Jika dokumen berfokus pada RAB, usahakan mengurai pos-pos anggarannya selengkap mungkin.
3. Kategori RAB hanya boleh salah satu dari 5 pilihan di atas.
4. Hanya berikan JSON murni tanpa \`\`\`json atau teks pengantar.`

    const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash"
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
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
    })

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
        : [],
      timesheet_schedule: Array.isArray(parsed.timesheet_schedule)
        ? parsed.timesheet_schedule.map((s: any) => ({
            phase: String(s.phase || "").trim(),
            start_date: s.start_date ? String(s.start_date).trim() : "",
            end_date: s.end_date ? String(s.end_date).trim() : "",
            pic: s.pic ? String(s.pic).trim() : "",
          }))
        : [],
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
        : [],
      summary: parsed.summary || "Dokumen perencanaan berhasil dianalisis dengan AI Gemini Vision.",
    }
  } catch (err) {
    console.warn("Gemini Project OCR failed:", err)
    return null
  }
}

export async function extractProjectPlanningDocument(bytes: Buffer, extension: string): Promise<ExtractedProjectPlanning> {
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  }

  // 1. Prioritize Gemini AI Vision when configured
  if (process.env.GEMINI_API_KEY?.trim() && mimeMap[extension]) {
    try {
      const geminiResult = await extractWithGeminiProject(bytes, mimeMap[extension])
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
        // Simple heuristic fallback on text
        const dates = text.match(/\b\d{4}-\d{2}-\d{2}\b/g)
        return {
          work_details: text.slice(0, 1500),
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
    summary: "Dokumen berhasil disimpan sebagai lampiran. Lengkapi isian form secara manual jika diperlukan.",
  }
}
