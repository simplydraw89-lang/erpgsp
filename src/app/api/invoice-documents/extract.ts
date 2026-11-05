import { execFile } from "node:child_process"
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
let ocrRunning = false

export function parseInvoiceText(text: string) {
  const number = text.match(/(?:invoice|tagihan|debit\s+note)\s*(?:no\.?|number|nomor|#)?\s*[:#]\s*([A-Z0-9][A-Z0-9/_.-]{2,80})/i)?.[1]
  function dateValue(value: string | undefined) {
    if (!value) return undefined
    const parts = value.split(/[-/\s]+/)
    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]
    const translated: Record<string,string> = { mei:"may", agu:"aug", agustus:"aug", okt:"oct", des:"dec" }
    const month = parts[1]?.toLowerCase() ?? ""
    const monthIndex = months.indexOf(translated[month] ?? month.slice(0,3))
    if (monthIndex >= 0) parts[1] = String(monthIndex+1)
    if (parts[0].length !== 4 && parts[2]?.length === 2) parts[2] = `20${parts[2]}`
    const iso = parts[0].length === 4 ? parts.join("-") : `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
    const timestamp = Date.parse(`${iso}T12:00:00Z`)
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === iso ? iso : undefined
  }
  const date = text.match(/(?:tanggal(?:\s+invoice)?|invoice\s+date|date)\s*[:.]?\s*(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{1,2}[- ](?:[A-Za-z]{3,9})[- ]\d{2,4})/i)?.[1]
  const validDate = dateValue(date)
  const taxNumber = text.match(/(?:nomor\s+|no\.?\s*)?faktur\s+pajak\s*[:#]\s*([A-Z0-9][A-Z0-9/_.-]{2,80})/i)?.[1]
  const taxDate = dateValue(text.match(/tanggal\s+faktur\s+pajak\s*[:.]?\s*(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i)?.[1])
  const vendor = text.match(/(?:nama\s+)?(?:vendor|penagih|supplier)\s*[:]\s*([^\n\r]{2,160})/i)?.[1]?.trim()
  const address = text.match(/(?:alamat|address)\s*[:]\s*([^\n\r]{2,240})/i)?.[1]?.trim()
  const lines: { description: string; amount: number }[] = []
  const warnings: string[] = []
  for (const row of text.split(/[\r\n]+/)) {
    if (/\b(total|subtotal|ppn|pph|pajak|invoice|faktur|tanggal|date|rekening|bank|npwp|alamat|address|vendor|penagih|supplier|discount|diskon|balance|due)\b/i.test(row)) continue
    const item = row.match(/^\s*(?:\d{1,3}[.)]?\s+)?(.{3,160}?)\s+(?:Rp\.?\s*)?([\d][\d.,]*\d|\d)\s*$/i)
    if (!item || (!/Rp\.?\s*\d/i.test(row) && !/^\s*\d{1,3}[.)]?\s/.test(row))) {
      if (/\bRp\.?\s*\S/i.test(row)) warnings.push("Ada nominal rincian yang tidak terbaca pasti. Cocokkan dengan dokumen dan isi nominal tersebut secara manual.")
      continue
    }
    let value = item[2]
    if (/,[0-9]{2}$/.test(value)) value = value.replace(/\./g, "").replace(",", ".")
    else if (/\.[0-9]{2}$/.test(value)) value = value.replace(/,/g, "")
    else value = value.replace(/[.,]/g, "")
    const amount = Number(value)
    if (Number.isFinite(amount) && amount > 0 && amount < 1e14) lines.push({ description: item[1].trim(), amount })
    else warnings.push("Ada nominal rincian yang tidak terbaca pasti. Cocokkan dengan dokumen dan isi nominal tersebut secara manual.")
  }
  if (!number || !validDate || !vendor || !lines.length) warnings.push(`Belum terbaca: ${[!number && "nomor invoice", !validDate && "tanggal invoice", !vendor && "nama vendor", !lines.length && "rincian nominal"].filter(Boolean).join(", ")}. Periksa teks hasil pembacaan dan lengkapi manual.`)
  return { text, warnings: [...new Set(warnings)], ...(number ? { invoice_number: number } : {}), ...(validDate ? { invoice_date: validDate } : {}), ...(vendor ? { vendor_name: vendor } : {}), ...(address ? { vendor_address: address } : {}), ...(taxNumber ? { tax_invoice_number: taxNumber } : {}), ...(taxDate ? { tax_invoice_date: taxDate } : {}), ...(lines.length ? { lines } : {}) }
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
