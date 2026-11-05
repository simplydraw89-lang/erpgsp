/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the real preview route across isolated auth and storage boundaries. */
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const ts = require("typescript")

function route({ authenticated = true, visible = true, storageFails = false, contentType = "application/pdf" } = {}) {
  let reads = 0
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "user" } : null }, error: null }) },
    from: () => ({ select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: visible ? { storage_path: "private/file", file_name: "Penawaran proyek 'A'.pdf", content_type: contentType, byte_size: 20 } : null, error: null }) }),
    storage: { from: () => ({ download: async () => { reads++; return { data: storageFails ? null : new Blob(["document-content"], { type: contentType }), error: storageFails ? { message: "unavailable" } : null } } }) },
  }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/app/api/invoice-documents/[id]/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Response, Buffer, require(name) {
    if (name === "@/lib/supabase/server") return { createClient: async () => client }
    if (name === "../extract") return {}
    if (name === "@/lib/auth/view-as") return {}
    return require(name)
  } })
  return {
    get: () => exports.GET(new Request("http://localhost:3000/api/invoice-documents/10000000-0000-4000-8000-000000000001"), { params: Promise.resolve({ id: "10000000-0000-4000-8000-000000000001" }) }),
    reads: () => reads,
  }
}

test("PDF and image previews return inline content without a download redirect", async () => {
  for (const contentType of ["application/pdf", "image/png", "image/jpeg"]) {
    const { get } = route({ contentType })
    const response = await get()
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("content-type"), contentType)
    assert.match(response.headers.get("content-disposition"), /^inline; filename\*=UTF-8''/)
    assert.match(response.headers.get("content-disposition"), /%27A%27/)
    assert.equal(response.headers.get("cache-control"), "private, no-store")
    assert.equal(response.headers.get("x-content-type-options"), "nosniff")
    assert.equal(response.headers.get("location"), null)
    assert.equal(await response.text(), "document-content")
  }
})

test("preview refuses anonymous or inaccessible attachments before reading storage", async () => {
  for (const [options, status] of [[{ authenticated: false }, 401], [{ visible: false }, 404], [{ contentType: "text/html" }, 415]]) {
    const { get, reads } = route(options)
    assert.equal((await get()).status, status)
    assert.equal(reads(), 0)
  }
})

test("storage failure is visible rather than returned as a successful preview", async () => {
  const { get } = route({ storageFails: true })
  const response = await get()
  assert.equal(response.status, 502)
  assert.match((await response.json()).error, /belum dapat ditampilkan/)
})
