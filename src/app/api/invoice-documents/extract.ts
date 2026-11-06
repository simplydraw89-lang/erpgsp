import { execFile } from "node:child_process"
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
let ocrRunning = false

export function parseInvoiceText(text: string) {
  const isTaxInvoiceOnly = /^\s*faktur\s+pajak\b/im.test(text) && !/\b(?:no\.?\s*invoice|tagihan\s+kepada|invoice\s+no)\b/i.test(text)

  // 1. Nomor Faktur Pajak
  const taxPatterns = [
    /(?:kode\s+dan\s+)?nomor\s+seri\s+faktur\s+pajak\s*[:.]?\s*([0-9]{3}[0-9.-]{10,25})/i,
    /(?:nomor\s+|no\.?\s*)?faktur\s+pajak\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})/i,
  ]
  let taxNumber: string | undefined
  for (const pat of taxPatterns) {
    const m = text.match(pat)
    if (m?.[1]) {
      taxNumber = m[1].trim()
      break
    }
  }

  // 2. Tanggal Faktur Pajak
  function dateValue(value: string | undefined) {
    if (!value) return undefined
    const parts = value.split(/[-/\s,]+/).filter(Boolean)
    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]
    const translated: Record<string,string> = {
      januari:"jan", februari:"feb", pebruari:"feb", maret:"mar", april:"apr",
      mei:"may", juni:"jun", juli:"jul", agustus:"aug", agu:"aug", agt:"aug",
      september:"sep", sept:"sep", oktober:"oct", okt:"oct",
      november:"nov", nopember:"nov", desember:"dec", des:"dec"
    }
    const monthRaw = parts[1]?.toLowerCase() ?? ""
    const monthClean = translated[monthRaw] ?? monthRaw.slice(0,3)
    const monthIndex = months.indexOf(monthClean)
    if (monthIndex >= 0) parts[1] = String(monthIndex + 1)
    if (parts[0].length !== 4 && parts[2]?.length === 2) parts[2] = `20${parts[2]}`
    const iso = parts[0].length === 4 ? parts.join("-") : `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
    const timestamp = Date.parse(`${iso}T12:00:00Z`)
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === iso ? iso : undefined
  }

  const taxDateMatch = text.match(/(?:tanggal\s+faktur\s+pajak|tempat\s+dan\s+tanggal\s*:[^\n\r,]+,)\s*(\d{1,2}[-/\s][A-Za-z0-9]{3,9}[-/\s]\d{2,4}|\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i)
  const taxDate = dateValue(taxDateMatch?.[1])

  // 3. Nomor Invoice
  const numberPatterns = [
    // Standar No. Invoice: INV/BTP/2026/09/001
    /^[ \t]*(?:no\.?|nomor)\s*(?:inv(?:oice)?|tagihan|faktur)\s*[:#=\s]\s*([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})/im,
    /^[ \t]*(?:invoice|tagihan|faktur|debit\s+note|nota)\s*(?:no\.?|nomor|number|#)?\s*[:#=\s]\s*([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})/im,
    // Referensi pada Faktur Pajak: "(Referensi: Invoice 123/ABC/VII/2025)"
    /\(?(?:referensi|ref)\s*[:.]?\s*invoice\s+([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})\)?/i,
    /^[ \t]*(?:no\.?|nomor|inv\.?)\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})/im,
    /(?:invoice|tagihan|debit\s+note)\s*(?:no\.?|number|nomor|#)?\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})/i,
  ]
  let number: string | undefined
  if (!isTaxInvoiceOnly) {
    for (const pat of numberPatterns) {
      const m = text.match(pat)
      const val = m?.[1]?.trim()
      if (val && !/^(tanggal|date|faktur\s*pajak|rekening|telepon|hp|npwp|po|spk|surat|tagihan|faktur|pembelian|inv|invoice|pajak)$/i.test(val)) {
        number = val
        break
      }
    }
  } else {
    // Pada Faktur Pajak, cek apakah ada baris Referensi Invoice
    const refMatch = text.match(/\(?(?:referensi|ref|nomor\s+invoice)\s*[:.]?\s*(?:invoice\s+)?([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})\)?/i)
    if (refMatch?.[1]) number = refMatch[1].trim()
  }

  // 4. Tanggal Invoice
  const datePatterns = [
    /^[ \t]*(?:tanggal(?:\s+invoice|\s+tagihan)?|invoice\s+date|tgl(?:\.?|\s+inv)?|date)\s*[:.]?\s*(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{1,2}[-/\s](?:[A-Za-z]{3,9})[-/\s]\d{2,4})/im,
    /(?:tanggal(?:\s+invoice|\s+tagihan)?|invoice\s+date|date)\s*[:.]?\s*(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{1,2}[-/\s](?:[A-Za-z]{3,9})[-/\s]\d{2,4})/i,
  ]
  let validDate: string | undefined
  for (const pat of datePatterns) {
    const m = text.match(pat)
    if (m?.[1]) {
      const parsed = dateValue(m[1])
      if (parsed) {
        validDate = parsed
        break
      }
    }
  }
  // Fallback tanggal pada Faktur Pajak
  if (!validDate && taxDate) {
    validDate = taxDate
  }

  // 5. Vendor Name, Address, NPWP, Bank Info
  let vendor: string | undefined
  let address: string | undefined
  let vendorNpwp: string | undefined
  let bankName: string | undefined
  let bankAccount: string | undefined
  let bankOwner: string | undefined

  if (isTaxInvoiceOnly || /Pengusaha\s+Kena\s+Pajak/i.test(text)) {
    // Pola e-Faktur: Pengusaha Kena Pajak: Nama : ... Alamat : ... NPWP : ...
    const pkpBlock = text.match(/Pengusaha\s+Kena\s+Pajak\s*:?([\s\S]*?)(?:Pembeli\s+Barang|Penerima\s+Jasa|$)/i)?.[1]
    if (pkpBlock) {
      vendor = pkpBlock.match(/Nama\s*:\s*([^\n\r]+)/i)?.[1]?.trim()
      address = pkpBlock.match(/Alamat\s*:\s*([^\n\r]+(?:\n[^\n\r]+)?)/i)?.[1]?.trim()
      vendorNpwp = pkpBlock.match(/NPWP\s*:\s*([0-9.-]{15,25})/i)?.[1]?.trim()
    }
  }

  if (!vendor) {
    // Invoice umum: header atas atau label Vendor: / Dari:
    const vendorPatterns = [
      /(?:nama\s+)?(?:vendor|penagih|supplier|rekanan)\s*[:]\s*([^\n\r]{2,160})/i,
      /(?:dari|from|penjual|diterbitkan\s+oleh)\s*[:]\s*([^\n\r]{2,160})/i,
      /^[ \t]*(?:pt\.?|cv\.?|ud\.?|pd\.?|fa\.?)\s+[^\n\r]{2,100}/im,
    ]
    for (const pat of vendorPatterns) {
      const m = text.match(pat)
      const val = (m?.[1] ?? m?.[0])?.trim()
      if (val && !/^(tagihan\s+kepada|kepada|ditujukan|bill\s+to|buyer|pembeli)/i.test(val)) {
        vendor = val.replace(/^dari\s*[:#\s]*/i, "").trim()
        break
      }
    }
  }

  if (!address) {
    address = text.match(/^[ \t]*(?:alamat(?:\s+vendor|\s+supplier)?|address)\s*[:]\s*([^\n\r]{2,240})/im)?.[1]?.trim()
  }

  if (!vendorNpwp) {
    // Cari NPWP di bagian vendor (sebelum TAGIHAN KEPADA)
    const headerSlice = text.split(/TAGIHAN\s+KEPADA|PEMBELI/i)[0] || text
    const npwpMatch = headerSlice.match(/NPWP\s*[:.]?\s*([0-9.-]{15,25})/i)
    if (npwpMatch?.[1]) vendorNpwp = npwpMatch[1].trim()
  }

  // Informasi Rekening Pembayaran jika ada
  const bankMatch = text.match(/(?:Bank\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)|(?:BCA|MANDIRI|BNI|BRI|BSI|CIMB|PERMATA|DANAMON))/i)
  if (bankMatch) {
    bankName = bankMatch[1] ? `Bank ${bankMatch[1].trim()}` : bankMatch[0].trim()
  }
  const accMatch = text.match(/(?:No\.?\s*Rekening|Rekening|No\.?\s*Rek)\s*[:.]?\s*([0-9 -]{5,35})/i)
  if (accMatch?.[1]) bankAccount = accMatch[1].trim()

  const ownerMatch = text.match(/(?:Atas\s+Nama|a\.n\.?)\s*[:.]?\s*([^\n\r]{2,100})/i)
  if (ownerMatch?.[1]) bankOwner = ownerMatch[1].trim()

  // 6. Deteksi PPN & PPh dari Dokumen
  let detectedVatMode: "none" | "non_luxury" | "luxury" | undefined
  if (/PPN\s*(?:11%|12%|efektif)/i.test(text) || /Jumlah\s+PPN/i.test(text)) {
    detectedVatMode = "non_luxury"
  }

  let detectedPphCode: string | undefined
  let detectedPphRate: number | undefined
  if (/PPh\s*(?:Pasal\s*)?Final\s*4\(?2\)?/i.test(text)) {
    detectedPphCode = "pph_final_construction"
    const pphRateMatch = text.match(/PPh\s*(?:Pasal\s*)?Final\s*4\(?2\)?\s*\(?([0-9,.]+)\s*%\)?/i)
    if (pphRateMatch?.[1]) detectedPphRate = Number(pphRateMatch[1].replace(",", "."))
  } else if (/PPh\s*(?:Pasal\s*)?23/i.test(text)) {
    detectedPphCode = "pph23_service"
    detectedPphRate = 2
  }

  // 7. Lines / Rincian Tagihan
  const lines: { description: string; amount: number }[] = []
  const warnings: string[] = []

  const rows = text.split(/[\r\n]+/)
  for (let i = 0; i < rows.length; i++) {
    const trimmed = rows[i].trim()
    if (!trimmed) continue

    // Abaikan header tabel atau baris ringkasan/total
    if (/\b(subtotal|total(?:\s+tagihan)?|jumlah\s+yang\s+harus\s+dibayar|jumlah\s+dibayar|ppn|pph|potongan|diskon|discount|balance|due|jatuh\s*tempo|uang\s+muka|dasar\s+pengenaan\s+pajak|dpp)\b/i.test(trimmed)) {
      continue
    }

    if (/\b(harga\s+jual|jumlah\s+ppn|jumlah\s+ppnbm|dikurangi\s+potongan|dikurangi\s+uang\s+muka)\b/i.test(trimmed)) {
      continue
    }

    // Abaikan baris metadata/keterangan proyek & periode
    if (/^\s*(?:proyek|lokasi|referensi\s+spk|periode|masa|jangka\s+waktu|kontak|tagihan\s+kepada|informasi\s+proyek|uraian\s+jasa)\b/i.test(trimmed)) {
      continue
    }

    // Tangkap baris item (misal: "1 Jasa Pemetaan Lahan Rp 150.000.000" atau "Jasa Konstruksi 1 paket Rp 150.000.000 Rp 150.000.000")
    // Ambil nominal angka terakhir di baris tersebut
    const item = trimmed.match(/^\s*(?:\d{1,3}[.)]?\s+)?(.{3,160}?)\s+(?:Rp\.?\s*)?([\d][\d.,]*\d|\d)\s*$/i)
    if (!item || (!/Rp\.?\s*\d/i.test(trimmed) && !/^\s*\d{1,3}[.)]?\s/.test(trimmed))) {
      continue
    }

    let desc = item[1].trim()
    let value = item[2]

    // Jika baris adalah nomor urut + deskripsi dan memiliki sub-baris penjelasan di bawahnya,
    // gabungkan jika baris berikutnya adalah uraian deskripsi tanpa nominal
    if (/^\d{1,3}[.)]?\s/.test(trimmed) && i + 1 < rows.length) {
      const nextRow = rows[i + 1].trim()
      if (nextRow && !/Rp\.?\s*\d/i.test(nextRow) && !/^\d{1,3}[.)]/.test(nextRow) && !/subtotal|total|ppn|pph/i.test(nextRow)) {
        // Cukup ambil judul utama item agar rapi di tabel form
      }
    }

    // Abaikan baris periode kalender murni
    if (/^(202[0-9]|203[0-9])$/.test(value) && !/Rp\.?\s*\d/i.test(trimmed)) {
      if (/\b(periode|bulan|tahun|jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)\b/i.test(desc)) {
        continue
      }
    }

    // Normalisasi angka desimal/ribuan
    if (/,[0-9]{2}$/.test(value)) value = value.replace(/\./g, "").replace(",", ".")
    else if (/\.[0-9]{2}$/.test(value)) value = value.replace(/,/g, "")
    else value = value.replace(/[.,]/g, "")

    const amount = Number(value)

    if (amount >= 2020 && amount <= 2035 && !/Rp\.?\s*\d/i.test(trimmed)) {
      if (/\b(periode|tahun|thn)\b/i.test(desc)) continue
    }

    // Bersihkan deskripsi dari sisa kolom unit/qty (misal "1 paket Rp 150.000.000" jika ada harga satuan)
    desc = desc.replace(/\s+(?:\d+\s*(?:paket|unit|lembar|set|orang|hari|bln|bulan)?)\s*(?:Rp\.?\s*[\d.,]+)?$/i, "").trim()

    if (Number.isFinite(amount) && amount > 0 && amount < 1e14) {
      lines.push({ description: desc, amount })
    }
  }

  if (!number && !taxNumber) warnings.push("Nomor invoice atau Faktur Pajak belum terdeteksi pasti.")
  if (!validDate) warnings.push("Tanggal dokumen belum terdeteksi.")
  if (!vendor) warnings.push("Nama vendor belum terdeteksi.")
  if (!lines.length) warnings.push("Rincian tagihan belum terdeteksi.")

  return {
    text,
    warnings: [...new Set(warnings)],
    ...(number ? { invoice_number: number } : {}),
    ...(validDate ? { invoice_date: validDate } : {}),
    ...(vendor ? { vendor_name: vendor } : {}),
    ...(address ? { vendor_address: address } : {}),
    ...(vendorNpwp ? { vendor_npwp: vendorNpwp } : {}),
    ...(bankName ? { bank_name: bankName } : {}),
    ...(bankAccount ? { bank_account: bankAccount } : {}),
    ...(bankOwner ? { bank_owner: bankOwner } : {}),
    ...(taxNumber ? { tax_invoice_number: taxNumber } : {}),
    ...(taxDate ? { tax_invoice_date: taxDate } : {}),
    ...(detectedVatMode ? { vat_mode: detectedVatMode } : {}),
    ...(detectedPphCode ? { withholding_code: detectedPphCode } : {}),
    ...(detectedPphRate !== undefined ? { withholding_rate: detectedPphRate } : {}),
    ...(lines.length ? { lines } : {}),
  }
}

async function extractPdfText(bytes: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")).href
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 })
  try {
    const doc = await task.promise
    const pages: string[] = []
    for (let n = 1; n <= Math.min(doc.numPages, 5); n++) {
      const content = await (await doc.getPage(n)).getTextContent()
      const words = content.items.filter((item): item is import("pdfjs-dist/types/src/display/api").TextItem => "str" in item)
      const rows: { y: number; words: typeof words }[] = []
      for (const item of words.sort((a,b) => b.transform[5]-a.transform[5])) {
        let row = rows.find(r => Math.abs(r.y-item.transform[5]) <= Math.max(2, item.height*.4))
        if (!row) { row = { y:item.transform[5],words:[] }; rows.push(row) }
        row.words.push(item)
      }
      pages.push(rows.map(r => r.words.sort((a,b)=>a.transform[4]-b.transform[4]).map(w=>w.str).join(" ")).join("\n"))
    }
    return { text:pages.join("\n\n"), truncated:doc.numPages>5 }
  } finally { await task.destroy() }
}


async function extractWithGemini(bytes: Buffer, mimeType: string): Promise<ReturnType<typeof parseInvoiceText> | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return null

  try {
    const base64Data = bytes.toString("base64")
    const prompt = `Anda adalah asisten cerdas sistem ERP akuntansi dan perpajakan Indonesia.
Tugas Anda adalah membaca dokumen invoice / kuitansi / faktur pajak yang terlampir dengan sangat teliti dan mengekstrak data terstruktur dalam format JSON murni tanpa markdown/backticks.

Ekstrak bidang-bidang berikut jika ditemukan:
- text: ringkasan teks atau transkripsi dokumen
- invoice_number: nomor invoice / tagihan
- invoice_date: tanggal invoice dalam format YYYY-MM-DD
- vendor_name: nama perusahaan/vendor penagih (misal: PT Bumi Teknik Prima)
- vendor_address: alamat lengkap vendor
- vendor_npwp: NPWP vendor (format 15 atau 16 digit jika ada)
- bank_name: nama bank untuk pembayaran (misal: BCA, Mandiri, BRI)
- bank_account: nomor rekening bank tujuan
- bank_owner: nama pemilik rekening bank
- tax_invoice_number: nomor seri faktur pajak (NSFP) jika ada
- tax_invoice_date: tanggal faktur pajak (YYYY-MM-DD) jika ada
- vat_mode: "non_luxury" jika ada PPN 11%, "luxury" jika ada PPnBM 12%, atau "none" jika tidak ada PPN
- withholding_code: jenis pemotongan PPh jika tertera (misal: "pph23_service", "pph23_rental", "pph_final_construction", "pph_final_rental", atau "none")
- lines: rincian barang/jasa sebagai array objek [{ "description": "nama barang/jasa", "amount": nominal_angka }]
- warnings: array string jika ada bagian dokumen yang buram atau meragukan

Hanya berikan JSON valid tanpa pembungkus markdown apapun.`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
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
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.1
        }
      })
    })

    if (!response.ok) {
      console.warn("Gemini API returned status:", response.status)
      return null
    }

    const data = await response.json()
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) return null

    const parsed = JSON.parse(content)
    return {
      text: parsed.text || "Ekstraksi AI Gemini 1.5 Flash",
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      invoice_number: parsed.invoice_number || undefined,
      invoice_date: parsed.invoice_date || undefined,
      vendor_name: parsed.vendor_name || undefined,
      vendor_address: parsed.vendor_address || undefined,
      vendor_npwp: parsed.vendor_npwp || undefined,
      bank_name: parsed.bank_name || undefined,
      bank_account: parsed.bank_account || undefined,
      bank_owner: parsed.bank_owner || undefined,
      tax_invoice_number: parsed.tax_invoice_number || undefined,
      tax_invoice_date: parsed.tax_invoice_date || undefined,
      vat_mode: parsed.vat_mode || "none",
      withholding_code: parsed.withholding_code || "none",
      withholding_rate: typeof parsed.withholding_rate === "number" ? parsed.withholding_rate : undefined,
      lines: Array.isArray(parsed.lines) ? parsed.lines.map((l: any) => ({
        description: String(l.description || ""),
        amount: Number(l.amount || 0)
      })) : []
    }
  } catch (err) {
    console.warn("Gemini OCR extraction failed, falling back to local OCR:", err)
    return null
  }
}

export async function extractDocument(bytes: Buffer, extension: string) {
  if (extension === "pdf") {
    try {
      const result = await extractPdfText(bytes)
      if (result.text.trim()) {
        const extracted = parseInvoiceText(result.text)
        if (result.truncated) extracted.warnings.push("Hanya lima halaman pertama dibaca. Periksa halaman berikutnya secara manual.")
        return { extracted, method:"pdf_text" }
      }
    } catch { /* Scanned or unsupported PDFs use the local raster OCR below. */ }
  }
  if (process.platform !== "win32") return { warning: "Dokumen tersimpan privat. OCR lokal memerlukan Windows dengan bahasa OCR terpasang; isi data manual." }
  if (ocrRunning) return { warning: "Dokumen tersimpan privat. OCR lokal sedang membaca dokumen lain; gunakan Baca ulang setelah proses selesai." }
  ocrRunning = true
  let directory: string | undefined
  try {
    directory = await mkdtemp(path.join(tmpdir(), "gsp-ocr-"))
    const image = path.join(directory, `document.${extension}`)
    await writeFile(image, bytes)
    const script = await readFile(path.join(process.cwd(), "src/app/api/invoice-documents/ocr.ps1"), "utf8")
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "& ([scriptblock]::Create([Console]::In.ReadToEnd()))"], { timeout: 45000, maxBuffer: 1024 * 1024, windowsHide: true, env: { ...process.env, GSP_OCR_FILE: image } }, (error, output) => error ? reject(error) : resolve(output))
      child.stdin?.end(script)
    })
    const output = JSON.parse(stdout.replace(/^\uFEFF/, "")) as { text: string }
    if (!output.text?.trim()) return { warning: "Dokumen tersimpan, tetapi OCR tidak menemukan teks. Isi data manual atau unggah gambar yang lebih jelas." }
    return { extracted: parseInvoiceText(output.text) }
  } catch {
    return { warning: "Dokumen tersimpan privat, tetapi OCR lokal tidak tersedia atau gagal membaca gambar. Isi data manual; tidak ada isian yang disetujui otomatis." }
  } finally {
    ocrRunning = false
    if (directory && path.dirname(path.resolve(directory)) === path.resolve(tmpdir()) && path.basename(directory).startsWith("gsp-ocr-")) await rm(directory, { recursive: true, force: true }).catch(() => undefined)
  }
}
