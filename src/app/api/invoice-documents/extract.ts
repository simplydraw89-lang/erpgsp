import { execFile } from "node:child_process"
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

let ocrRunning = false

function isPlaceholderText(val: string | undefined): boolean {
  if (!val) return true
  const clean = val.trim().toLowerCase()
  if (!clean || clean === "-" || clean === "null" || clean === "undefined") return true
  return /\b(tidak\s+dicantumkan|tidak\s+tersedia|tidak\s+diverifikasi|data\s+dummy|dummy\s*-|belum\s+tersedia)\b/i.test(clean)
}

function stripRightColumn(val: string): string {
  // Potong jika ada pemisah kolom "|" atau label kolom kanan yang ikut terbawa di baris yang sama
  return val
    .split(/\s+\|\s+/)[0]
    .split(/\s+(?:DITAGIHKAN\s+KEPADA|TAGIHAN\s+KEPADA|KEPADA\s*:|BILL\s+TO|TANGGAL\s+INVOICE|REFERENSI\s+PO|CABANG\s+PROYEK|\d+\.\s+Untuk\s+konfirmasi)/i)[0]
    .trim()
}

function splitFirstCompanyIfMerged(val: string): string {
  const cleaned = stripRightColumn(val)
  // Jika dalam 1 baris ada 2 nama PT/CV karena layout 2 kolom tanpa garis (misal: "PT Nusantara Survey Teknologi PT. Bara Prima Mandiri")
  const secondCompanyMatch = cleaned.match(/^((?:PT\.?|CV\.?|UD\.?|PD\.?|FA\.?)\s+.+?)\s+((?:PT\.?|CV\.?|UD\.?|PD\.?|FA\.?)\s+.+)$/i)
  if (secondCompanyMatch?.[1]) {
    return secondCompanyMatch[1].trim()
  }
  return cleaned
}

export function parseInvoiceText(text: string) {
  const isTaxInvoiceOnly =
    /^\s*faktur\s+pajak\b/im.test(text) &&
    !/\b(?:no\.?\s*invoice|nomor\s+invoice|tagihan\s+kepada|ditagihkan\s+kepada|invoice\s+no)\b/i.test(text)

  // Helper konversi tanggal ke YYYY-MM-DD
  function dateValue(value: string | undefined) {
    if (!value) return undefined
    const parts = value.trim().split(/[-/\s,]+/).filter(Boolean)
    if (parts.length < 3) return undefined
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    const translated: Record<string, string> = {
      januari: "jan", februari: "feb", pebruari: "feb", maret: "mar", april: "apr",
      mei: "may", juni: "jun", juli: "jul", agustus: "aug", agu: "aug", agt: "aug",
      september: "sep", sept: "sep", oktober: "oct", okt: "oct",
      november: "nov", nopember: "nov", desember: "dec", des: "dec",
    }
    const monthRaw = parts[1]?.toLowerCase() ?? ""
    const monthClean = translated[monthRaw] ?? monthRaw.slice(0, 3)
    const monthIndex = months.indexOf(monthClean)
    if (monthIndex >= 0) parts[1] = String(monthIndex + 1)
    if (parts[0].length !== 4 && parts[2]?.length === 2) parts[2] = `20${parts[2]}`
    const iso =
      parts[0].length === 4
        ? `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`
        : `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
    const timestamp = Date.parse(`${iso}T12:00:00Z`)
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === iso ? iso : undefined
  }

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
  const taxDateMatch = text.match(
    /(?:tanggal\s+faktur\s+pajak|tempat\s+dan\s+tanggal\s*:[^\n\r,]+,)\s*(\d{1,2}[-/\s][A-Za-z0-9]{3,9}[-/\s]\d{2,4}|\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i
  )
  const taxDate = dateValue(taxDateMatch?.[1])

  // 3. Nomor Invoice
  const numberPatterns = [
    /(?:no\.?|nomor)\s*(?:inv(?:oice)?|tagihan|faktur)\s*[:#=\s|]+\s*([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})/i,
    /\b(INV[-/][A-Za-z0-9/_.-]{3,60})\b/i,
    /^[ \t]*(?:invoice|tagihan|faktur|debit\s+note|nota)\s*(?:no\.?|nomor|number|#)?\s*[:#=\s]\s*([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})/im,
    /\(?(?:referensi|ref)\s*[:.]?\s*invoice\s+([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})\)?/i,
    /^[ \t]*(?:no\.?|nomor|inv\.?)\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})/im,
  ]
  let number: string | undefined
  if (!isTaxInvoiceOnly) {
    for (const pat of numberPatterns) {
      const m = text.match(pat)
      const val = m?.[1]?.trim()
      if (
        val &&
        !/^(tanggal|date|faktur\s*pajak|rekening|telepon|hp|npwp|po|spk|surat|tagihan|faktur|pembelian|inv|invoice|pajak|baris|barang|jasa)$/i.test(val)
      ) {
        number = val
        break
      }
    }
  } else {
    const refMatch = text.match(/\(?(?:referensi|ref|nomor\s+invoice)\s*[:.]?\s*(?:invoice\s+)?([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})\)?/i)
    if (refMatch?.[1]) number = refMatch[1].trim()
  }

  // 4. Tanggal Invoice & Jatuh Tempo (Due Date)
  const datePatterns = [
    /(?:tanggal\s+(?:invoice|tagihan)|invoice\s+date|tgl\.?\s*inv(?:oice)?)\s*[:.|]*\s*(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{1,2}[-/\s](?:[A-Za-z]{3,9})[-/\s]\d{2,4})/i,
    /^[ \t]*(?:tanggal|tgl\.?|date)\s*[:.|]*\s*(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{1,2}[-/\s](?:[A-Za-z]{3,9})[-/\s]\d{2,4})/im,
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
  if (!validDate && taxDate) {
    validDate = taxDate
  }

  const duePatterns = [
    /(?:jatuh\s+tempo|due\s+date|batas\s+pembayaran|tgl\.?\s*jatuh\s+tempo)\s*[:.|]*\s*(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{1,2}[-/\s](?:[A-Za-z]{3,9})[-/\s]\d{2,4})/i,
  ]
  let dueDate: string | undefined
  for (const pat of duePatterns) {
    const m = text.match(pat)
    if (m?.[1]) {
      const parsed = dateValue(m[1])
      if (parsed) {
        dueDate = parsed
        break
      }
    }
  }

  // 5. Vendor Name, Address, NPWP, Bank Info
  let vendor: string | undefined
  let address: string | undefined
  let vendorNpwp: string | undefined
  let bankName: string | undefined
  let bankAccount: string | undefined
  let bankOwner: string | undefined

  const rows = text.split(/[\r\n]+/).map((r) => r.trim()).filter(Boolean)

  if (isTaxInvoiceOnly || /Pengusaha\s+Kena\s+Pajak/i.test(text)) {
    const pkpBlock = text.match(/Pengusaha\s+Kena\s+Pajak\s*:?([\s\S]*?)(?:Pembeli\s+Barang|Penerima\s+Jasa|$)/i)?.[1]
    if (pkpBlock) {
      const rawV = pkpBlock.match(/Nama\s*:\s*([^\n\r]+)/i)?.[1]
      if (rawV) vendor = splitFirstCompanyIfMerged(rawV)
      const rawAddr = pkpBlock.match(/Alamat\s*:\s*([^\n\r]+)/i)?.[1]
      if (rawAddr && !isPlaceholderText(rawAddr)) address = stripRightColumn(rawAddr)
      const rawNpwp = pkpBlock.match(/NPWP\s*:\s*([0-9.-]{15,25})/i)?.[1]
      if (rawNpwp && !isPlaceholderText(rawNpwp)) vendorNpwp = rawNpwp.trim()
    }
  }

  // Cek baris di bawah header "DITERBITKAN OLEH / VENDOR" atau "VENDOR"
  if (!vendor) {
    for (let i = 0; i < rows.length - 1; i++) {
      if (/^(?:diterbitkan\s+oleh(?:\s*\/\s*vendor)?|vendor|penagih|dari\s+vendor)\b/i.test(rows[i])) {
        const nextLine = rows[i + 1]
        if (nextLine && !/^(?:nomor|tanggal|deskripsi|jatuh\s+tempo)/i.test(nextLine)) {
          const candidate = splitFirstCompanyIfMerged(nextLine)
          if (candidate.length >= 3) {
            vendor = candidate
            // Cek apakah baris setelahnya adalah alamat
            const addrLine = rows[i + 2]
            if (addrLine && /^(?:alamat|jl\.|jalan|gedung|ruko)/i.test(addrLine)) {
              const cleanedAddr = stripRightColumn(addrLine.replace(/^(?:alamat(?:\s*\/\s*npwp)?)\s*[:.]?\s*/i, ""))
              if (!isPlaceholderText(cleanedAddr)) {
                address = cleanedAddr
              }
            }
            break
          }
        }
      }
    }
  }

  if (!vendor) {
    const vendorPatterns = [
      /(?:nama\s+)?(?:vendor|penagih|supplier|rekanan)\s*[:]\s*([^\n\r|]{2,160})/i,
      /(?:dari|from|penjual|diterbitkan\s+oleh)\s*[:]\s*([^\n\r|]{2,160})/i,
      /^[ \t]*((?:pt\.?|cv\.?|ud\.?|pd\.?|fa\.?)\s+[^\n\r|]{2,100})/im,
    ]
    for (const pat of vendorPatterns) {
      const m = text.match(pat)
      const val = (m?.[1] ?? m?.[0])?.trim()
      if (val && !/^(tagihan\s+kepada|ditagihkan\s+kepada|kepada|ditujukan|bill\s+to|buyer|pembeli)/i.test(val)) {
        vendor = splitFirstCompanyIfMerged(val.replace(/^(?:dari|vendor|penagih)\s*[:#\s]*/i, ""))
        break
      }
    }
  }

  // Bersihkan nama vendor jika ada kata "INVOICE" yang menempel dari header sebelah kanan
  if (vendor) {
    vendor = vendor.replace(/\s+\b(?:INVOICE|TAGIHAN|FAKTUR)\b.*$/i, "").trim()
  }

  if (!address) {
    const rawAddr = text.match(/^[ \t]*(?:alamat(?:\s+vendor|\s+supplier)?|address)\s*[:]\s*([^\n\r|]{2,200})/im)?.[1]
    if (rawAddr) {
      const cleaned = stripRightColumn(rawAddr)
      if (!isPlaceholderText(cleaned)) address = cleaned
    }
  }

  if (!vendorNpwp) {
    const headerSlice = text.split(/DITAGIHKAN\s+KEPADA|TAGIHAN\s+KEPADA|PEMBELI/i)[0] || text
    const npwpMatch = headerSlice.match(/NPWP\s*[:.]?\s*([0-9][0-9.-]{13,24})/i)
    if (npwpMatch?.[1] && !isPlaceholderText(npwpMatch[1])) {
      vendorNpwp = npwpMatch[1].trim()
    }
  }

  // Informasi Rekening Pembayaran (abaikan jika tertulis dummy / tidak dicantumkan)
  const bankMatch = text.match(/\b(?:Bank\s+(BCA|Mandiri|BNI|BRI|BSI|CIMB(?:\s+Niaga)?|Permata|Danamon|BTN|Jago|Panin|OCBC)|(?:BCA|MANDIRI|BNI|BRI|BSI|CIMB|PERMATA|DANAMON))\b/i)
  if (bankMatch) {
    const rawBank = bankMatch[1] ? `Bank ${bankMatch[1].trim()}` : bankMatch[0].trim()
    if (!isPlaceholderText(rawBank)) bankName = rawBank
  }

  const accMatch = text.match(/(?:No\.?\s*Rekening|Nomor\s*Rekening|No\.?\s*Rek)\s*[:.]?\s*([0-9][0-9 -]{4,30}[0-9])/i)
  if (accMatch?.[1] && !isPlaceholderText(accMatch[1])) {
    bankAccount = accMatch[1].trim()
  }

  const ownerMatch = text.match(/(?:Atas\s+Nama|a\.n\.?)\s*[:.]?\s*([^\n\r|]{2,90})/i)
  if (ownerMatch?.[1]) {
    const cleanedOwner = stripRightColumn(ownerMatch[1])
    if (!isPlaceholderText(cleanedOwner)) {
      bankOwner = cleanedOwner
    }
  }

  // 6. Deteksi PPN & PPh dari Dokumen
  let detectedVatMode: "none" | "non_luxury" | "luxury" | undefined
  if (/\bPPN\b[^\n\r]{0,35}?(?:11\s*%|12\s*%|efektif)/i.test(text) || /Jumlah\s+PPN/i.test(text)) {
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

  let insideItemTable = false

  for (let i = 0; i < rows.length; i++) {
    const trimmed = rows[i]
    if (!trimmed) continue

    // Deteksi awal tabel rincian
    if (/\b(deskripsi|uraian|keterangan|item|nama\s+barang)\b/i.test(trimmed) && /\b(qty|kuantitas|volume|unit|harga|jumlah|total|nominal)\b/i.test(trimmed)) {
      insideItemTable = true
      continue
    }

    // Deteksi akhir tabel rincian
    if (/^\s*(?:subtotal|sub\s+total|total\s+tagihan|grand\s+total|jumlah\s+yang\s+harus\s+dibayar|informasi\s+pembayaran|metode\s*:)/i.test(trimmed)) {
      insideItemTable = false
      continue
    }

    // Abaikan baris ringkasan/total/pajak
    if (/\b(subtotal|total(?:\s+tagihan)?|jumlah\s+yang\s+harus\s+dibayar|jumlah\s+dibayar|ppn|pph|potongan|diskon|discount|balance|due|jatuh\s*tempo|uang\s+muka|dasar\s+pengenaan\s+pajak|dpp|nomor\s+invoice|tanggal\s+invoice|referensi\s+po)\b/i.test(trimmed)) {
      continue
    }

    if (/\b(harga\s+jual|jumlah\s+ppn|jumlah\s+ppnbm|dikurangi\s+potongan|dikurangi\s+uang\s+muka)\b/i.test(trimmed)) {
      continue
    }

    if (/^\s*(?:proyek|lokasi|referensi\s+spk|periode|masa|jangka\s+waktu|kontak|tagihan\s+kepada|ditagihkan\s+kepada|diterbitkan\s+oleh|informasi\s+proyek|uraian\s+jasa|dokumen\s+ini|simulasi)\b/i.test(trimmed)) {
      continue
    }

    // Normalisasi pemisah "|" menjadi spasi untuk ekstraksi item baris tabel
    const normalizedRow = trimmed.replace(/\s*\|\s*/g, " ").replace(/\s+/g, " ").trim()

    // Tangkap baris item yang berakhiran nominal ribuan (misal 46.000.000 atau Rp 46.000.000)
    const item = normalizedRow.match(/^(?:\d{1,3}[.)]?\s+)?(.{3,160}?)\s+(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{5,15})$/i)
    const hasRpOrNumberPrefix = /Rp\.?\s*\d/i.test(normalizedRow) || /^\d{1,3}[.)]?\s/.test(normalizedRow)
    const hasFormattedThousand = /\d{1,3}(?:\.\d{3})+/.test(item?.[2] ?? "")

    if (!item || (!insideItemTable && !hasRpOrNumberPrefix && !hasFormattedThousand)) {
      continue
    }

    let desc = item[1].trim()
    let value = item[2]

    // Normalisasi angka desimal/ribuan
    if (/,[0-9]{2}$/.test(value)) value = value.replace(/\./g, "").replace(",", ".")
    else if (/\.[0-9]{2}$/.test(value)) value = value.replace(/,/g, "")
    else value = value.replace(/[.,]/g, "")

    const amount = Number(value)
    if (!Number.isFinite(amount) || amount <= 0 || amount >= 1e14) continue

    // Bersihkan deskripsi dari kolom qty + unit + harga satuan di ujung kanan
    // Contoh: "Jasa survei lapangan & mobilisasi tim 1 paket 46.000.000" -> "Jasa survei lapangan & mobilisasi tim"
    desc = desc
      .replace(/\s+\d+(?:[.,]\d+)?\s*(?:paket|unit|lembar|set|orang|hari|bln|bulan|titik|sampel|ls|lot|jam|kali|ob|oh)?\s+(?:Rp\.?\s*)?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?$/i, "")
      .replace(/\s+\d+\s*(?:paket|unit|lembar|set|orang|hari|bln|bulan|titik|sampel|ls|lot|jam|kali|ob|oh)$/i, "")
      .trim()

    if (desc.length >= 2) {
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
    ...(dueDate ? { due_date: dueDate } : {}),
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
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 })
  try {
    const doc = await task.promise
    const pages: string[] = []
    for (let n = 1; n <= Math.min(doc.numPages, 5); n++) {
      const content = await (await doc.getPage(n)).getTextContent()
      const words = content.items.filter(
        (item): item is import("pdfjs-dist/types/src/display/api").TextItem =>
          "str" in item && Boolean(item.str.trim())
      )
      const rows: { y: number; words: typeof words }[] = []
      for (const item of words.sort((a, b) => b.transform[5] - a.transform[5])) {
        let row = rows.find((r) => Math.abs(r.y - item.transform[5]) <= Math.max(2.5, item.height * 0.45))
        if (!row) {
          row = { y: item.transform[5], words: [] }
          rows.push(row)
        }
        row.words.push(item)
      }

      // Urutkan kata dari kiri ke kanan, namun pisahkan dengan " | " apabila terdapat
      // jarak horizontal antar kolom yang lebar (> 25pt) agar kolom kiri (Vendor)
      // TIDAK bertabrakan/menyatu dengan kolom kanan (Ditagihkan Kepada / Klien).
      const formattedRows = rows.map((r) => {
        const sorted = r.words.sort((a, b) => a.transform[4] - b.transform[4])
        let line = ""
        for (let i = 0; i < sorted.length; i++) {
          const curr = sorted[i]
          if (i === 0) {
            line += curr.str.trim()
          } else {
            const prev = sorted[i - 1]
            const prevEnd = prev.transform[4] + (prev.width || prev.str.length * 4.5)
            const gap = curr.transform[4] - prevEnd
            line += (gap > 25 ? " | " : " ") + curr.str.trim()
          }
        }
        return line
      })
      pages.push(formattedRows.join("\n"))
    }
    return { text: pages.join("\n\n"), truncated: doc.numPages > 5 }
  } finally {
    await task.destroy()
  }
}

async function extractWithGemini(
  bytes: Buffer,
  mimeType: string
): Promise<ReturnType<typeof parseInvoiceText> | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return null

  const base64Data = bytes.toString("base64")
  const prompt = `Anda adalah sistem AI OCR cerdas khusus ERP Akuntansi & Perpajakan Indonesia.
Tugas Anda adalah mengekstrak data dari dokumen Invoice / Faktur Pajak / Tagihan terlampir secara akurat ke dalam format JSON murni.

ATURAN SANGAT PENTING (JANGAN SAMPAI TERTUKAR / OVERLAP):
1. Bedakan dengan tegas antara kolum "DITERBITKAN OLEH / VENDOR / PENAGIH" (pihak yang menerbitkan invoice) dan "DITAGIHKAN KEPADA / KLIEN / PEMBELI" (pihak penerima tagihan).
   - "vendor_name" WAJIB HANYA berisi nama perusahaan penerbit/vendor (contoh: "PT Nusantara Survey Teknologi"), JANGAN PERNAH menggabungkan nama klien/pembeli atau teks instruksi pembayaran ke dalam nama vendor atau nama pemilik rekening!
2. Jika pada dokumen tertulis placeholder seperti "dummy", "tidak diverifikasi", "tidak tersedia", atau "tidak dicantumkan" pada alamat/NPWP/rekening, kembalikan string kosong "" untuk field tersebut (jangan masukkan teks "tidak dicantumkan" sebagai nilai).
3. Ekstrak field berikut dalam JSON:
   - text: transkripsi rapi isi dokumen
   - invoice_number: nomor invoice (contoh: "INV-SUR-202611-001")
   - invoice_date: tanggal invoice dalam format YYYY-MM-DD (contoh: "10-11-2026" menjadi "2026-11-10")
   - due_date: tanggal jatuh tempo pembayaran dalam format YYYY-MM-DD jika ada (contoh: "10-12-2026" menjadi "2026-12-10")
   - vendor_name: nama resmi vendor penagih saja
   - vendor_address: alamat vendor jika nyata (kosongkan jika dummy/tidak tersedia)
   - vendor_npwp: nomor NPWP vendor jika berupa angka nyata
   - bank_name: nama bank tujuan transfer jika disebutkan nyata
   - bank_account: nomor rekening bank tujuan jika disebutkan nyata
   - bank_owner: nama pemilik rekening saja (tanpa kalimat instruksi/catatan kaki)
   - tax_invoice_number: nomor seri faktur pajak jika ada
   - tax_invoice_date: tanggal faktur pajak YYYY-MM-DD jika ada
   - vat_mode: "non_luxury" jika terdapat PPN 11% (termasuk PPN simulasi 11%), "luxury" jika 12% barang mewah, atau "none" jika tanpa PPN
   - withholding_code: "pph23_service", "pph23_rental", "pph_final_construction", "pph_final_rental", atau "none"
   - lines: array rincian barang/jasa sebelum PPN, format: [{ "description": "uraian bersih tanpa qty/satuan", "amount": angka_nominal_sebelum_ppn }]
   - warnings: array string jika ada peringatan penting

Kembalikan JSON valid saja.`

  const candidateModels = [
    process.env.GEMINI_MODEL?.trim(),
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ].filter((m): m is string => Boolean(m))

  for (const modelName of [...new Set(candidateModels)]) {
    try {
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
        continue
      }

      const data = await response.json()
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!content) continue

      const cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim()
      const parsed = JSON.parse(cleaned)

      const vendorName = parsed.vendor_name ? splitFirstCompanyIfMerged(String(parsed.vendor_name)) : undefined
      const vendorAddress =
        parsed.vendor_address && !isPlaceholderText(String(parsed.vendor_address))
          ? stripRightColumn(String(parsed.vendor_address))
          : undefined
      const vendorNpwp =
        parsed.vendor_npwp && !isPlaceholderText(String(parsed.vendor_npwp))
          ? String(parsed.vendor_npwp).trim()
          : undefined
      const bankName =
        parsed.bank_name && !isPlaceholderText(String(parsed.bank_name))
          ? String(parsed.bank_name).trim()
          : undefined
      const bankAccount =
        parsed.bank_account && !isPlaceholderText(String(parsed.bank_account))
          ? String(parsed.bank_account).trim()
          : undefined
      const bankOwner =
        parsed.bank_owner && !isPlaceholderText(String(parsed.bank_owner))
          ? stripRightColumn(String(parsed.bank_owner))
          : undefined

      return {
        text: parsed.text || "Ekstraksi AI Gemini Vision",
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        ...(parsed.invoice_number ? { invoice_number: String(parsed.invoice_number).trim() } : {}),
        ...(parsed.invoice_date ? { invoice_date: String(parsed.invoice_date).trim() } : {}),
        ...(parsed.due_date ? { due_date: String(parsed.due_date).trim() } : {}),
        ...(vendorName ? { vendor_name: vendorName } : {}),
        ...(vendorAddress ? { vendor_address: vendorAddress } : {}),
        ...(vendorNpwp ? { vendor_npwp: vendorNpwp } : {}),
        ...(bankName ? { bank_name: bankName } : {}),
        ...(bankAccount ? { bank_account: bankAccount } : {}),
        ...(bankOwner ? { bank_owner: bankOwner } : {}),
        ...(parsed.tax_invoice_number ? { tax_invoice_number: String(parsed.tax_invoice_number).trim() } : {}),
        ...(parsed.tax_invoice_date ? { tax_invoice_date: String(parsed.tax_invoice_date).trim() } : {}),
        vat_mode: parsed.vat_mode || "none",
        withholding_code: parsed.withholding_code || "none",
        ...(typeof parsed.withholding_rate === "number" ? { withholding_rate: parsed.withholding_rate } : {}),
        lines: Array.isArray(parsed.lines)
          ? parsed.lines
              .map((l: any) => ({
                description: String(l.description || "").trim(),
                amount: Number(l.amount || 0),
              }))
              .filter((l: { description: string; amount: number }) => l.description && l.amount > 0)
          : [],
      }
    } catch {
      // Coba model kandidat berikutnya
    }
  }

  return null
}

export async function extractDocument(bytes: Buffer, extension: string) {
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  }

  // 1. Prioritaskan AI Gemini Vision (gemini-2.5-flash / gemini-2.0-flash)
  if (process.env.GEMINI_API_KEY?.trim() && mimeMap[extension]) {
    try {
      const geminiResult = await extractWithGemini(bytes, mimeMap[extension])
      if (geminiResult) {
        return { extracted: geminiResult, method: "gemini_vision" }
      }
    } catch (e) {
      console.warn("Gemini Vision processing error, falling back:", e)
    }
  }

  // 2. Native Coordinate-Aware PDF Text Extraction (memisahkan kolom kiri & kanan)
  if (extension === "pdf") {
    try {
      const result = await extractPdfText(bytes)
      if (result.text.trim()) {
        const extracted = parseInvoiceText(result.text)
        if (result.truncated) {
          extracted.warnings.push("Hanya lima halaman pertama dibaca. Periksa halaman berikutnya secara manual.")
        }
        return { extracted, method: "pdf_text" }
      }
    } catch {
      /* Scanned or unsupported PDFs use the local raster OCR below. */
    }
  }

  // 3. Fallback Local Windows OCR
  if (process.platform !== "win32") {
    return {
      warning:
        "Dokumen tersimpan privat. Untuk membaca foto/scan di server cloud, pastikan GEMINI_API_KEY sudah dipasang di Environment Variables.",
    }
  }
  if (ocrRunning) {
    return {
      warning:
        "Dokumen tersimpan privat. OCR lokal sedang membaca dokumen lain; gunakan Baca ulang setelah proses selesai.",
    }
  }
  ocrRunning = true
  let directory: string | undefined
  try {
    directory = await mkdtemp(path.join(tmpdir(), "gsp-ocr-"))
    const image = path.join(directory, `document.${extension}`)
    await writeFile(image, bytes)
    const script = await readFile(path.join(process.cwd(), "src/app/api/invoice-documents/ocr.ps1"), "utf8")
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", "& ([scriptblock]::Create([Console]::In.ReadToEnd()))"],
        { timeout: 45000, maxBuffer: 1024 * 1024, windowsHide: true, env: { ...process.env, GSP_OCR_FILE: image } },
        (error, output) => (error ? reject(error) : resolve(output))
      )
      child.stdin?.end(script)
    })
    const output = JSON.parse(stdout.replace(/^\uFEFF/, "")) as { text: string }
    if (!output.text?.trim()) {
      return {
        warning:
          "Dokumen tersimpan, tetapi OCR tidak menemukan teks. Isi data manual atau unggah gambar yang lebih jelas.",
      }
    }
    return { extracted: parseInvoiceText(output.text), method: "windows_ocr" }
  } catch {
    return {
      warning:
        "Dokumen tersimpan privat, tetapi OCR lokal tidak tersedia atau gagal membaca gambar. Isi data manual; tidak ada isian yang disetujui otomatis.",
    }
  } finally {
    ocrRunning = false
    if (
      directory &&
      path.dirname(path.resolve(directory)) === path.resolve(tmpdir()) &&
      path.basename(directory).startsWith("gsp-ocr-")
    ) {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}
