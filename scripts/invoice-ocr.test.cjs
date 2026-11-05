/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node verification loads TypeScript with the installed compiler. */
const { test } = require("node:test")
const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { mkdtemp, rm, readFile } = require("node:fs/promises")
const { tmpdir } = require("node:os")
const path = require("node:path")
const { execFile } = require("node:child_process")
const ts = require("typescript")
const Module = require("node:module")
const source = path.resolve("src/app/api/invoice-documents/extract.ts")
const compiled = ts.transpileModule(readFileSync(source, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
const mod = new Module(source, module)
mod.filename = source; mod.paths = module.paths; mod._compile(compiled, source)
const { parseInvoiceText, extractDocument } = mod.exports

test("invoice parser extracts only labeled fields and rejects invalid dates", () => {
  assert.equal(parseInvoiceText("Invoice No: INV/2026/001\nDate: 2026-11-04\nVendor: PT Contoh\nAddress: Jalan Satu").invoice_number, "INV/2026/001")
  assert.equal(parseInvoiceText("Date: 2026-13-40").invoice_date, undefined)
  assert.equal(parseInvoiceText("Date: 2026-02-30").invoice_date, undefined)
  assert.equal(parseInvoiceText("Vendor: PT Contoh").vendor_name, "PT Contoh")
  assert.equal(parseInvoiceText("unknown text").invoice_number, undefined)
  assert.equal(parseInvoiceText("Tanggal: 4/11/2026").invoice_date, "2026-11-04")
  assert.equal(parseInvoiceText("Tanggal: 31/02/2026").invoice_date, undefined)
  assert.equal(parseInvoiceText("Date: 12-Aug-26").invoice_date, "2026-08-12")
  assert.equal(parseInvoiceText("Tanggal: 4 November 2026").invoice_date, "2026-11-04")
  assert.equal(parseInvoiceText("DEBIT NOTE No: DN/2026/001").invoice_number, "DN/2026/001")
  const rows = parseInvoiceText("1 Jasa survei Rp 1.000.000,00\n2 Peralatan 1,250,000.00\nTotal Rp 2.250.000,00\nPPN Rp 247.500").lines
  assert.deepEqual(rows, [{ description: "Jasa survei", amount: 1000000 }, { description: "Peralatan", amount: 1250000 }])
  const uncertain = parseInvoiceText("1 Jasa konsultasi Rp I.ooo.ooo,oo")
  assert.equal(uncertain.lines, undefined)
  assert.ok(uncertain.warnings.some(message => /manual/.test(message)))
})

function ps(script, env) {
  return new Promise((resolve, reject) => {
    const child = execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "-"], { windowsHide: true, timeout: 45000, env: { ...process.env, ...env } }, (error, stdout, stderr) => error ? reject(new Error(`${error.message} ${stderr}`)) : resolve(stdout))
    child.stdin.end(script)
  })
}

test("Windows OCR reads a real generated invoice image locally", { skip: process.platform !== "win32", timeout: 60000 }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gsp-ocr-fixture-"))
  try {
    const file = path.join(dir, "invoice.png")
    await ps(`Add-Type -AssemblyName System.Drawing\n$b = [System.Drawing.Bitmap]::new(1400,600)\n$g = [System.Drawing.Graphics]::FromImage($b)\n$g.Clear([System.Drawing.Color]::White)\n$f = [System.Drawing.Font]::new('Arial',40)\n$g.DrawString("Invoice No: INV-2026-001",$f,[System.Drawing.Brushes]::Black,40,40)\n$g.DrawString("Date: 2026-11-04",$f,[System.Drawing.Brushes]::Black,40,140)\n$g.DrawString("Vendor: PT Contoh",$f,[System.Drawing.Brushes]::Black,40,240)\n$g.DrawString("1 Jasa konsultasi Rp 1.000.000,00",$f,[System.Drawing.Brushes]::Black,40,340)\n$b.Save($env:GSP_FIXTURE,[System.Drawing.Imaging.ImageFormat]::Png)\n$f.Dispose(); $g.Dispose(); $b.Dispose()\n`, { GSP_FIXTURE: file })
    const result = await extractDocument(await readFile(file), "png")
    assert.ok(result.extracted, JSON.stringify(result))
    assert.match(result.extracted.text, /INV.?2026.?001/i)
    assert.equal(result.extracted.invoice_date, "2026-11-04")
    assert.equal(result.extracted.vendor_name, "PT Contoh")
    // OCR may confuse 1/I and 0/o. It must either extract the exact amount or
    // explicitly request correction, never silently invent a numeric value.
    if (result.extracted.lines?.length) assert.equal(result.extracted.lines[0].amount, 1000000)
    else assert.ok(result.extracted.warnings?.some(message => /manual/.test(message)), JSON.stringify(result.extracted))
    // Embed the image into a PDF with no text layer to exercise the raster path.
    const jpg=path.join(dir,"invoice.jpg")
    await ps("Add-Type -AssemblyName System.Drawing\n$b=[System.Drawing.Bitmap]::FromFile($env:GSP_FIXTURE)\ntry { $b.Save($env:GSP_JPEG,[System.Drawing.Imaging.ImageFormat]::Jpeg) } finally { $b.Dispose() }",{GSP_FIXTURE:file,GSP_JPEG:jpg})
    const image=await readFile(jpg)
    const contents="q 1400 0 0 600 0 0 cm /Im0 Do Q"
    const objects=[Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1400 600] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>"),Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1400 /Height 600 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`),image,Buffer.from("\nendstream")]),Buffer.from(`<< /Length ${contents.length} >>\nstream\n${contents}\nendstream`)]
    const parts=[Buffer.from("%PDF-1.4\n")],offsets=[]
    for(const [i,object] of objects.entries()) { offsets.push(Buffer.concat(parts).length);parts.push(Buffer.from(`${i+1} 0 obj\n`),object,Buffer.from("\nendobj\n")) }
    const xref=Buffer.concat(parts).length
    parts.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`))
    const scanned=await extractDocument(Buffer.concat(parts),"pdf")
    assert.ok(scanned.extracted,JSON.stringify(scanned))
    assert.match(scanned.extracted.text,/INV.?2026.?001/i)
    assert.equal(scanned.extracted.invoice_date,"2026-11-04")
    assert.notEqual(scanned.method,"pdf_text")
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test("Digital PDF text is extracted locally without Windows OCR", { timeout: 60000 }, async () => {
  const stream = "BT /F1 28 Tf 40 750 Td (Invoice No: INV-2026-002) Tj 0 -50 Td (Date: 2026-11-04) Tj ET"
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`]
  let pdf = "%PDF-1.4\n", offsets = [0]
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  const result = await extractDocument(Buffer.from(pdf), "pdf")
  assert.ok(result.extracted, JSON.stringify(result))
  assert.match(result.extracted.text, /INV.?2026.?002/i)
  assert.equal(result.method,"pdf_text")
})
