import { execFile } from "node:child_process"
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

let ocrRunning = false

function isPlaceholderText(val: string | undefined): boolean {
  if (!val) return true
  const clean = val.trim().toLowerCase()
  if (!clean || clean === "-" || clean === "null" || clean === "undefined") return true
  return /\b(tidak\s+dicantumkan|tidak\s+tersedia|tidak\s+diverifikasi|data\s+dummy|dummy\s*-|belum\s+tersedia|tidak\s+ada)\b/i.test(
    clean
  )
}

function stripRightColumn(val: string): string {
  return val
    .split(/\s*\|\s*/)[0]
    .split(
      /\s+(?:DITAGIHKAN\s+KEPADA|TAGIHAN\s+KEPADA|KEPADA\s*:|BILL\s+TO|TANGGAL\s+INVOICE|REFERENSI\s+PO|CABANG\s+PROYEK|\d+\.\s+Untuk\s+konfirmasi|Untuk\s+konfirmasi\s+pembayaran|Mohon\s+cantumkan)/i
    )[0]
    .replace(/\s+(?:Ir\.|Dr\.|Drs\.|Bpk\.|Ibu)\s+[A-Z][a-zA-Z\s.,]+$/, "")
    .trim()
}

function splitFirstCompanyIfMerged(val: string): string {
  const cleaned = stripRightColumn(val)
  const secondCompanyMatch = cleaned.match(
    /^((?:PT\.?|CV\.?|UD\.?|PD\.?|FA\.?)\s+.+?)\s+((?:PT\.?|CV\.?|UD\.?|PD\.?|FA\.?)\s+.+)$/i
  )
  if (secondCompanyMatch?.[1]) {
    return secondCompanyMatch[1].trim()
  }
  return cleaned
}

export function normalizeIsoDate(value: string | undefined | null): string | undefined {
  if (!value) return undefined
  const clean = String(value)
    .trim()
    .replace(/^[|:.\s-]+|[|:.\s-]+$/g, "")
  if (!clean) return undefined

  // Jika sudah YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const ts = Date.parse(`${clean}T12:00:00Z`)
    return Number.isFinite(ts) ? clean : undefined
  }

  const parts = clean.split(/[-/.\s,]+/).filter(Boolean)
  if (parts.length < 3) return undefined

  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
  const translated: Record<string, string> = {
    januari: "jan",
    februari: "feb",
    pebruari: "feb",
    maret: "mar",
    april: "apr",
    mei: "may",
    juni: "jun",
    juli: "jul",
    agustus: "aug",
    agu: "aug",
    agt: "aug",
    september: "sep",
    sept: "sep",
    oktober: "oct",
    okt: "oct",
    november: "nov",
    nopember: "nov",
    desember: "dec",
    des: "dec",
  }

  const p0 = parts[0]
  let p1 = parts[1]
  let p2 = parts[2]

  const monthRaw = p1?.toLowerCase() ?? ""
  const monthClean = translated[monthRaw] ?? monthRaw.slice(0, 3)
  const monthIndex = months.indexOf(monthClean)
  if (monthIndex >= 0) {
    p1 = String(monthIndex + 1)
  }

  if (p0.length !== 4 && p2?.length === 2) {
    p2 = `20${p2}`
  }

  const iso =
    p0.length === 4
      ? `${p0}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`
      : `${p2}-${p1.padStart(2, "0")}-${p0.padStart(2, "0")}`

  const timestamp = Date.parse(`${iso}T12:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === iso ? iso : undefined
}

export function parseInvoiceText(text: string) {
  const isTaxInvoiceOnly =
    /^\s*faktur\s+pajak\b/im.test(text) &&
    !/\b(?:no\.?\s*invoice|nomor\s+invoice|tagihan\s+kepada|ditagihkan\s+kepada|invoice\s+no)\b/i.test(text)

  // 1. Nomor Faktur Pajak
  const taxPatterns = [
    /(?:kode\s+dan\s+)?nomor\s+seri\s+faktur\s+pajak[\s:.|#=-]+([0-9]{3}[0-9.-]{10,25})/i,
    /(?:nomor\s+|no\.?\s*)?faktur\s+pajak[\s:.|#=-]+([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})/i,
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
    /(?:tanggal\s+faktur\s+pajak|tempat\s+dan\s+tanggal[\s:.|]*[^\n\r,|]+,)[\s:.|]*(\d{1,2}[-/.\s]+[A-Za-z0-9]{2,10}[-/.\s]+\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i
  )
  const taxDate = normalizeIsoDate(taxDateMatch?.[1])

  // 3. Nomor Invoice
  const numberPatterns = [
    /(?:no\.?|nomor)\s*(?:inv(?:oice)?|tagihan|faktur)[\s:.|#=-]+([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})/i,
    /\b(INV[-/][A-Za-z0-9/_.-]{3,60})\b/i,
    /^[ \t]*(?:invoice|tagihan|faktur|debit\s+note|nota)\s*(?:no\.?|nomor|number|#)?[\s:.|#=-]+([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})/im,
    /\(?(?:referensi|ref)[\s:.|]*invoice[\s:.|]+([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})\)?/i,
    /^[ \t]*(?:no\.?|nomor|inv\.?)[\s:.|#=-]+([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})/im,
  ]
  let number: string | undefined
  if (!isTaxInvoiceOnly) {
    for (const pat of numberPatterns) {
      const m = text.match(pat)
      const val = m?.[1]?.trim()
      if (
        val &&
        !/^(tanggal|date|faktur\s*pajak|rekening|telepon|hp|npwp|po|spk|surat|tagihan|faktur|pembelian|inv|invoice|pajak|baris|barang|jasa)$/i.test(
          val
        )
      ) {
        number = val
        break
      }
    }
  } else {
    const refMatch = text.match(
      /\(?(?:referensi|ref|nomor\s+invoice)[\s:.|]*(?:invoice\s+)?([A-Za-z0-9][A-Za-z0-9/_.-]{2,80})\)?/i
    )
    if (refMatch?.[1]) number = refMatch[1].trim()
  }

  // 4. Tanggal Invoice & Jatuh Tempo (Due Date)
  // Catatan: gunakan [\s:.|#=-]+ agar tetap cocok walaupun ada pemisah kolom " : | "
  const dateTokenRegex =
    "(\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}|\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}|\\d{1,2}[-/.\\s]+[A-Za-z]{3,10}[-/.\\s]+\\d{2,4})"

  const datePatterns = [
    new RegExp(
      `(?:tanggal\\s+(?:invoice|tagihan)|invoice\\s+date|tgl\\.?\\s*inv(?:oice)?)[\\s:.|#=-]+${dateTokenRegex}`,
      "i"
    ),
    new RegExp(`(?:tanggal|tgl\\.?|date)[\\s:.|#=-]+${dateTokenRegex}`, "i"),
  ]
  let validDate: string | undefined
  for (const pat of datePatterns) {
    const m = text.match(pat)
    if (m?.[1]) {
      const parsed = normalizeIsoDate(m[1])
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
    new RegExp(
      `(?:jatuh\\s*tempo(?:\\s+pembayaran)?|due\\s*date|batas\\s+pembayaran|tgl\\.?\\s*jatuh\\s*tempo)[\\s:.|#=-]+${dateTokenRegex}`,
      "i"
    ),
  ]
  let dueDate: string | undefined
  for (const pat of duePatterns) {
    const m = text.match(pat)
    if (m?.[1]) {
      const parsed = normalizeIsoDate(m[1])
      if (parsed) {
        dueDate = parsed
        break
      }
    }
  }

  // 5. Deteksi Cabang Proyek (jika tertera di invoice, misal "Cabang proyek: Surabaya" atau "INV-SUR-...")
  let branchHint: string | undefined
  const branchMatch = text.match(/(?:cabang(?:\s+proyek)?|lokasi\s+cabang)[\s:.|#=-]+(Surabaya|Jakarta|Jogjakarta|Yogyakarta|Pusat)/i)
  if (branchMatch?.[1]) {
    branchHint = branchMatch[1].trim()
  } else if (number) {
    if (/\b(SUR|SBY)\b/i.test(number)) branchHint = "Surabaya"
    else if (/\bJKT\b/i.test(number)) branchHint = "Jakarta"
    else if (/\b(JOG|YGY)\b/i.test(number)) branchHint = "Jogjakarta"
  }

  // 6. Vendor Name, Address, NPWP, Bank Info
  let vendor: string | undefined
  let address: string | undefined
  let vendorNpwp: string | undefined
  let bankName: string | undefined
  let bankAccount: string | undefined
  let bankOwner: string | undefined

  const rows = text
    .split(/[\r\n]+/)
    .map((r) => r.trim())
    .filter(Boolean)

  if (isTaxInvoiceOnly || /Pengusaha\s+Kena\s+Pajak/i.test(text)) {
    const pkpBlock = text.match(/Pengusaha\s+Kena\s+Pajak\s*:?([\s\S]*?)(?:Pembeli\s+Barang|Penerima\s+Jasa|$)/i)?.[1]
    if (pkpBlock) {
      const rawV = pkpBlock.match(/Nama[\s:.|]+([^\n\r|]+)/i)?.[1]
      if (rawV) vendor = splitFirstCompanyIfMerged(rawV)
      const rawAddr = pkpBlock.match(/Alamat[\s:.|]+([^\n\r|]+)/i)?.[1]
      if (rawAddr && !isPlaceholderText(rawAddr)) address = stripRightColumn(rawAddr)
      const rawNpwp = pkpBlock.match(/NPWP[\s:.|]+([0-9.-]{15,25})/i)?.[1]
      if (rawNpwp && !isPlaceholderText(rawNpwp)) vendorNpwp = rawNpwp.trim()
    }
  }

  // Cek baris di bawah header "DITERBITKAN OLEH / VENDOR"
  if (!vendor) {
    for (let i = 0; i < rows.length - 1; i++) {
      const leftCell = rows[i].split(/\s*\|\s*/)[0].trim()
      if (/^(?:diterbitkan\s+oleh(?:\s*\/\s*vendor)?|vendor|penagih|dari\s+vendor)\b/i.test(leftCell)) {
        // Cari kandidat nama PT/CV di 1..3 baris berikutnya pada kolom kiri
        for (let offset = 1; offset <= 3 && i + offset < rows.length; offset++) {
          const candidateRow = rows[i + offset]
          const candidateLeft = candidateRow.split(/\s*\|\s*/)[0].trim()
          if (
            !candidateLeft ||
            /^(?:ditagihkan\s+kepada|tagihan\s+kepada|bill\s+to|kepada|nomor|tanggal|deskripsi|jatuh\s+tempo)/i.test(
              candidateLeft
            )
          ) {
            continue
          }
          const candidate = splitFirstCompanyIfMerged(candidateLeft)
          if (candidate.length >= 3) {
            vendor = candidate
            // Cek apakah baris di bawahnya adalah alamat vendor
            const addrRow = rows[i + offset + 1]?.split(/\s*\|\s*/)[0]?.trim()
            if (
              addrRow &&
              /^(?:alamat|jl\.|jalan|gedung|ruko|komp\.|kawasan)/i.test(addrRow) &&
              !/^(?:nomor|tanggal|jatuh\s+tempo)/i.test(addrRow)
            ) {
              const cleanedAddr = stripRightColumn(addrRow.replace(/^(?:alamat(?:\s*\/\s*npwp)?)\s*[:.]?\s*/i, ""))
              if (!isPlaceholderText(cleanedAddr)) {
                address = cleanedAddr
              }
            }
            break
          }
        }
        if (vendor) break
      }
    }
  }

  if (!vendor) {
    const vendorPatterns = [
      /(?:nama\s+)?(?:vendor|penagih|supplier|rekanan)[\s:.|#=-]+([^\n\r|]{2,160})/i,
      /(?:dari|from|penjual|diterbitkan\s+oleh)[\s:.|#=-]+([^\n\r|]{2,160})/i,
      /^[ \t]*((?:pt\.?|cv\.?|ud\.?|pd\.?|fa\.?)\s+[^\n\r|]{2,100})/im,
    ]
    for (const pat of vendorPatterns) {
      const m = text.match(pat)
      const val = (m?.[1] ?? m?.[0])?.trim()
      if (
        val &&
        !/^(tagihan\s+kepada|ditagihkan\s+kepada|kepada|ditujukan|bill\s+to|buyer|pembeli)/i.test(val)
      ) {
        vendor = splitFirstCompanyIfMerged(val.replace(/^(?:dari|vendor|penagih)[\s:#|]*/i, ""))
        break
      }
    }
  }

  if (vendor) {
    vendor = vendor.replace(/\s+\b(?:INVOICE|TAGIHAN|FAKTUR)\b.*$/i, "").trim()
  }

  // Jika alamat belum dapat, cek baris tepat di bawah nama vendor (misal "Jl. Raya Industri No. 88, Surabaya")
  if (!address && vendor) {
    for (let i = 0; i < rows.length - 1; i++) {
      const leftCell = rows[i].split(/\s*\|\s*/)[0].trim()
      if (leftCell.toLowerCase().includes(vendor.toLowerCase())) {
        const nextLeft = rows[i + 1]?.split(/\s*\|\s*/)[0]?.trim()
        if (
          nextLeft &&
          !isPlaceholderText(nextLeft) &&
          (/(?:jl\.|jalan|gedung|ruko|no\.|lt\.|lantai|rt\b|rw\b|kel\.|kec\.|surabaya|jakarta|jogja|yogyakarta|bandung|sidoarjo|gresik|malang|semarang|bekasi|tangerang|depok|bogor)/i.test(
            nextLeft
          ) ||
            /^alamat/i.test(nextLeft))
        ) {
          const cleaned = stripRightColumn(nextLeft.replace(/^(?:alamat(?:\s*\/\s*npwp)?)\s*[:.]?\s*/i, ""))
          if (!isPlaceholderText(cleaned)) {
            address = cleaned
            break
          }
        }
      }
    }
  }

  if (!address) {
    const rawAddr = text.match(/^[ \t]*(?:alamat(?:\s+vendor|\s+supplier)?|address)[\s:.|#=-]+([^\n\r|]{2,200})/im)?.[1]
    if (rawAddr) {
      const cleaned = stripRightColumn(rawAddr)
      if (!isPlaceholderText(cleaned)) address = cleaned
    }
  }

  if (!vendorNpwp) {
    const npwpMatch = text.match(/NPWP[\s:.|#=-]+([0-9]{2}[0-9.-]{11,22})/i)
    if (npwpMatch?.[1] && !isPlaceholderText(npwpMatch[1])) {
      vendorNpwp = npwpMatch[1].trim()
    }
  }

  // Informasi Rekening Pembayaran
  const bankMatch = text.match(
    /\b(?:Bank\s+(BCA|Mandiri|BNI|BRI|BSI|CIMB(?:\s+Niaga)?|Permata|Danamon|BTN|Jago|Panin|OCBC|Syariah\s+Indonesia)|(?:BCA|MANDIRI|BNI|BRI|BSI|CIMB\s+NIAGA|PERMATA|DANAMON))\b/i
  )
  if (bankMatch) {
    const rawBank = bankMatch[1] ? `Bank ${bankMatch[1].trim()}` : bankMatch[0].trim()
    if (!isPlaceholderText(rawBank)) bankName = rawBank
  }

  const accPatterns = [
    /(?:No\.?\s*Rekening|Nomor\s*Rekening|No\.?\s*Rek|Rekening\s+Bank|Account\s*No|A\/C\s*No)[\s:.|#=-]+([0-9][0-9 -]{4,30}[0-9])/i,
    /\b(?:BCA|Mandiri|BNI|BRI|BSI|CIMB|Permata|Danamon)[\s:|-]+([0-9]{3,4}[- ][0-9]{3,4}[- ][0-9]{3,6}|[0-9]{8,16})\b/i,
  ]
  for (const pat of accPatterns) {
    const accMatch = text.match(pat)
    if (accMatch?.[1] && !isPlaceholderText(accMatch[1])) {
      bankAccount = accMatch[1].trim()
      break
    }
  }

  const ownerMatch = text.match(/(?:Atas\s+Nama|a\.n\.?|a\/n)[\s:.|#=-]+([^\n\r|]{2,90})/i)
  if (ownerMatch?.[1]) {
    const cleanedOwner = stripRightColumn(ownerMatch[1])
    if (!isPlaceholderText(cleanedOwner)) {
      bankOwner = cleanedOwner
    }
  }
  // Jika ada nomor rekening atau nama bank tetapi pemilik rekening tidak ditulis terpisah, gunakan nama PT vendor
  if (!bankOwner && vendor && (bankAccount || bankName)) {
    bankOwner = vendor
  }

  // 7. Deteksi PPN & PPh dari Dokumen
  let detectedVatMode: "none" | "non_luxury" | "luxury" | undefined
  if (/\bPPN\b[^\n\r]{0,40}?(?:11\s*%|12\s*%|efektif|Rp\.?\s*[1-9])/i.test(text) || /Jumlah\s+PPN/i.test(text)) {
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

  // 8. Lines / Rincian Tagihan
  const lines: { description: string; amount: number }[] = []
  const warnings: string[] = []

  let insideItemTable = false

  for (let i = 0; i < rows.length; i++) {
    const trimmed = rows[i]
    if (!trimmed) continue

    if (
      /\b(deskripsi|uraian|keterangan|item|nama\s+barang)\b/i.test(trimmed) &&
      /\b(qty|kuantitas|volume|unit|harga|jumlah|total|nominal)\b/i.test(trimmed)
    ) {
      insideItemTable = true
      continue
    }

    if (
      /^\s*(?:subtotal|sub\s+total|total\s+tagihan|grand\s+total|jumlah\s+yang\s+harus\s+dibayar|informasi\s+pembayaran|metode\s*:)/i.test(
        trimmed
      )
    ) {
      insideItemTable = false
      continue
    }

    if (
      /\b(subtotal|total(?:\s+tagihan)?|jumlah\s+yang\s+harus\s+dibayar|jumlah\s+dibayar|ppn|pph|potongan|diskon|discount|balance|due|jatuh\s*tempo|uang\s+muka|dasar\s+pengenaan\s+pajak|dpp|nomor\s+invoice|tanggal\s+invoice|referensi\s+po)\b/i.test(
        trimmed
      )
    ) {
      continue
    }

    if (/\b(harga\s+jual|jumlah\s+ppn|jumlah\s+ppnbm|dikurangi\s+potongan|dikurangi\s+uang\s+muka)\b/i.test(trimmed)) {
      continue
    }

    if (
      /^\s*(?:proyek|lokasi|referensi\s+spk|periode|masa|jangka\s+waktu|kontak|tagihan\s+kepada|ditagihkan\s+kepada|diterbitkan\s+oleh|informasi\s+proyek|uraian\s+jasa|dokumen\s+ini|simulasi)\b/i.test(
        trimmed
      )
    ) {
      continue
    }

    const normalizedRow = trimmed.replace(/\s*\|\s*/g, " ").replace(/\s+/g, " ").trim()

    const item = normalizedRow.match(
      /^(?:\d{1,3}[.)]?\s+)?(.{3,160}?)\s+(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{5,15})$/i
    )
    const hasRpOrNumberPrefix = /Rp\.?\s*\d/i.test(normalizedRow) || /^\d{1,3}[.)]?\s/.test(normalizedRow)
    const hasFormattedThousand = /\d{1,3}(?:\.\d{3})+/.test(item?.[2] ?? "")

    if (!item || (!insideItemTable && !hasRpOrNumberPrefix && !hasFormattedThousand)) {
      continue
    }

    let desc = item[1].trim()
    let value = item[2]

    if (/,[0-9]{2}$/.test(value)) value = value.replace(/\./g, "").replace(",", ".")
    else if (/\.[0-9]{2}$/.test(value)) value = value.replace(/,/g, "")
    else value = value.replace(/[.,]/g, "")

    const amount = Number(value)
    if (!Number.isFinite(amount) || amount <= 0 || amount >= 1e14) continue

    desc = desc
      .replace(
        /\s+\d+(?:[.,]\d+)?\s*(?:paket|unit|lembar|set|orang|hari|bln|bulan|titik|sampel|ls|lot|jam|kali|ob|oh)?\s+(?:Rp\.?\s*)?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?$/i,
        ""
      )
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

  const formattedBankAccount =
    bankName && bankAccount && !bankAccount.toLowerCase().includes(bankName.toLowerCase())
      ? `${bankName} - ${bankAccount}`
      : bankAccount

  return {
    text,
    warnings: [...new Set(warnings)],
    ...(number ? { invoice_number: number } : {}),
    ...(validDate ? { invoice_date: validDate } : {}),
    ...(dueDate ? { due_date: dueDate } : {}),
    ...(branchHint ? { branch_hint: branchHint } : {}),
    ...(vendor ? { vendor_name: vendor } : {}),
    ...(address ? { vendor_address: address } : {}),
    ...(vendorNpwp ? { vendor_npwp: vendorNpwp } : {}),
    ...(bankName ? { bank_name: bankName } : {}),
    ...(formattedBankAccount ? { bank_account: formattedBankAccount } : {}),
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
  // Import pdf.worker.mjs langsung ke memori agar di Vercel Serverless tidak gagal mencari file worker di disk
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
    for (let n = 1; n <= Math.min(doc.numPages, 5); n++) {
      const content = await (await doc.getPage(n)).getTextContent()
      const words = content.items.filter(
        (item): item is import("pdfjs-dist/types/src/display/api").TextItem =>
          "str" in item && Boolean(item.str.trim())
      )
      const rows: { y: number; words: typeof words }[] = []
      for (const item of words.sort((a, b) => b.transform[5] - a.transform[5])) {
        const fontHeight = item.height || Math.abs(item.transform[3]) || 10
        let row = rows.find((r) => Math.abs(r.y - item.transform[5]) <= Math.max(3, fontHeight * 0.45))
        if (!row) {
          row = { y: item.transform[5], words: [] }
          rows.push(row)
        }
        row.words.push(item)
      }

      const formattedRows = rows
        .sort((a, b) => b.y - a.y)
        .map((r) => {
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
Tugas Anda adalah mengekstrak seluruh informasi dari dokumen Invoice / Faktur Pajak / Tagihan terlampir secara akurat ke dalam format JSON murni.

ATURAN SANGAT PENTING (JANGAN SAMPAI TERTUKAR / OVERLAP):
1. Bedakan dengan tegas antara kolom "DITERBITKAN OLEH / VENDOR / PENAGIH" (perusahaan penerbit invoice) dan "DITAGIHKAN KEPADA / KLIEN / PEMBELI" (penerima tagihan).
   - "vendor_name" WAJIB HANYA berisi nama perusahaan penerbit/vendor (contoh: "PT Nusantara Survey Teknologi" atau "PT Bumi Teknik Prima"), JANGAN PERNAH menggabungkan nama klien/pembeli, nama PIC klien, atau kalimat instruksi pembayaran ke dalam nama vendor atau nama pemilik rekening!
2. Jika pada dokumen tertulis placeholder seperti "dummy", "tidak diverifikasi", "tidak tersedia", atau "tidak dicantumkan", kembalikan string kosong "" untuk field tersebut.
3. Ekstrak seluruh field berikut dalam JSON:
   - text: transkripsi lengkap dan rapi dari isi dokumen
   - invoice_number: nomor invoice (contoh: "INV-SUR-202611-001" atau "INV/BTP/2026/09/001")
   - invoice_date: tanggal invoice dalam format YYYY-MM-DD (contoh: jika tertulis "10-11-2026" atau "10 November 2026", WAJIB ubah menjadi "2026-11-10")
   - due_date: tanggal jatuh tempo pembayaran dalam format YYYY-MM-DD jika ada (contoh: "10-12-2026" menjadi "2026-12-10")
   - branch_hint: nama cabang penerima/proyek jika tertulis (misal: "Surabaya", "Jakarta", atau "Jogjakarta")
   - vendor_name: nama resmi vendor penagih saja
   - vendor_address: alamat lengkap vendor jika nyata (kosongkan jika dummy/tidak tersedia)
   - vendor_npwp: nomor NPWP vendor jika berupa angka nyata
   - bank_name: nama bank tujuan transfer jika disebutkan nyata (misal: "Bank BCA", "Bank Mandiri")
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

  // Dukung kunci Vertex AI Express Mode (diawali "AQ.") maupun Google AI Studio ("AIza...")
  const isVertexKey = apiKey.startsWith("AQ.")

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
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
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

        const vendorName = parsed.vendor_name
          ? splitFirstCompanyIfMerged(String(parsed.vendor_name)).replace(/\s+\b(?:INVOICE|TAGIHAN|FAKTUR)\b.*$/i, "").trim()
          : undefined
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
        const rawBankAccount =
          parsed.bank_account && !isPlaceholderText(String(parsed.bank_account))
            ? String(parsed.bank_account).trim()
            : undefined
        const formattedBankAccount =
          bankName && rawBankAccount && !rawBankAccount.toLowerCase().includes(bankName.toLowerCase())
            ? `${bankName} - ${rawBankAccount}`
            : rawBankAccount
        const bankOwner =
          parsed.bank_owner && !isPlaceholderText(String(parsed.bank_owner))
            ? stripRightColumn(String(parsed.bank_owner))
            : vendorName && (rawBankAccount || bankName)
            ? vendorName
            : undefined

        const normalizedInvoiceDate = normalizeIsoDate(parsed.invoice_date)
        const normalizedDueDate = normalizeIsoDate(parsed.due_date)
        const normalizedTaxDate = normalizeIsoDate(parsed.tax_invoice_date)

        return {
          text: parsed.text || "Ekstraksi AI Gemini Vision",
          warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
          ...(parsed.invoice_number ? { invoice_number: String(parsed.invoice_number).trim() } : {}),
          ...(normalizedInvoiceDate ? { invoice_date: normalizedInvoiceDate } : {}),
          ...(normalizedDueDate ? { due_date: normalizedDueDate } : {}),
          ...(parsed.branch_hint ? { branch_hint: String(parsed.branch_hint).trim() } : {}),
          ...(vendorName ? { vendor_name: vendorName } : {}),
          ...(vendorAddress ? { vendor_address: vendorAddress } : {}),
          ...(vendorNpwp ? { vendor_npwp: vendorNpwp } : {}),
          ...(bankName ? { bank_name: bankName } : {}),
          ...(formattedBankAccount ? { bank_account: formattedBankAccount } : {}),
          ...(bankOwner ? { bank_owner: bankOwner } : {}),
          ...(parsed.tax_invoice_number ? { tax_invoice_number: String(parsed.tax_invoice_number).trim() } : {}),
          ...(normalizedTaxDate ? { tax_invoice_date: normalizedTaxDate } : {}),
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
        // Coba endpoint/model berikutnya
      }
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

  // Untuk berkas PDF, ekstrak juga teks berbasis koordinatnya agar bisa melengkapi (hybrid)
  // apabila ada field yang terlewat atau jika API Key AI belum aktif di server
  let pdfFallback: ReturnType<typeof parseInvoiceText> | null = null
  let pdfTruncated = false
  if (extension === "pdf") {
    try {
      const result = await extractPdfText(bytes)
      if (result.text.trim()) {
        pdfFallback = parseInvoiceText(result.text)
        pdfTruncated = result.truncated
      }
    } catch (err) {
      console.warn("PDF coordinate text extraction error:", err)
    }
  }

  // 1. Prioritaskan AI Gemini Vision (mendukung Vertex AI Express AQ. & AI Studio AIza)
  if (process.env.GEMINI_API_KEY?.trim() && mimeMap[extension]) {
    try {
      const geminiResult = await extractWithGemini(bytes, mimeMap[extension])
      if (geminiResult) {
        // Gabungkan (Hybrid): Jika ada field yang kosong di AI namun terbaca pasti di PDF coordinate parser, lengkapi!
        const merged = pdfFallback
          ? {
              ...pdfFallback,
              ...geminiResult,
              invoice_number: geminiResult.invoice_number || pdfFallback.invoice_number,
              invoice_date: geminiResult.invoice_date || pdfFallback.invoice_date,
              due_date: geminiResult.due_date || pdfFallback.due_date,
              branch_hint: geminiResult.branch_hint || pdfFallback.branch_hint,
              vendor_name: geminiResult.vendor_name || pdfFallback.vendor_name,
              vendor_address: geminiResult.vendor_address || pdfFallback.vendor_address,
              vendor_npwp: geminiResult.vendor_npwp || pdfFallback.vendor_npwp,
              bank_name: geminiResult.bank_name || pdfFallback.bank_name,
              bank_account: geminiResult.bank_account || pdfFallback.bank_account,
              bank_owner: geminiResult.bank_owner || pdfFallback.bank_owner,
              vat_mode:
                geminiResult.vat_mode && geminiResult.vat_mode !== "none"
                  ? geminiResult.vat_mode
                  : pdfFallback.vat_mode || "none",
              lines: geminiResult.lines?.length ? geminiResult.lines : pdfFallback.lines,
              warnings: [],
            }
          : geminiResult
        return { extracted: merged, method: "gemini_vision" }
      }
    } catch (e) {
      console.warn("Gemini Vision processing error, falling back:", e)
    }
  }

  // 2. Gunakan hasil Coordinate-Aware PDF Text Extraction jika PDF
  if (pdfFallback) {
    if (pdfTruncated) {
      pdfFallback.warnings.push("Hanya lima halaman pertama dibaca. Periksa halaman berikutnya secara manual.")
    }
    return { extracted: pdfFallback, method: "pdf_text" }
  }

  // 3. Fallback Local Windows OCR untuk gambar (PNG/JPG) di Windows
  if (process.platform !== "win32") {
    return {
      warning:
        "Dokumen tersimpan privat. Pembacaan foto/gambar di server cloud memerlukan GEMINI_API_KEY aktif pada Environment Variables Vercel.",
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
