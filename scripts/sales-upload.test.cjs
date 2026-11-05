/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the route with isolated storage/auth boundaries. */
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const ts = require("typescript")

function loadRoute({ authenticated = true, permitted = true, preview = false } = {}) {
  const calls = { extraction: 0, upload: 0, metadata: null, domain: null }
  const branch = { id: "10000000-0000-4000-8000-000000000001", organization_id: "10000000-0000-4000-8000-000000000002" }
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "10000000-0000-4000-8000-000000000003" } : null } }) },
    rpc: async (_name, args) => { if (args.p_domain) calls.domain = args.p_domain; return { data: permitted, error: null } },
    from: table => table === "business_units" ? { select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: branch }) }
      : { insert: async value => { calls.metadata = value; return { error: null } } },
    storage: { from: () => ({ upload: async () => { calls.upload++; return { error: null } } }) },
  }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/app/api/invoice-documents/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Buffer, File, Response, URL,
    require(name) {
      if (name === "@/lib/supabase/server") return { createClient: async () => client }
      if (name === "@/lib/auth/view-as") return { readViewAsState: async () => ({ isActive: preview }) }
      if (name === "./extract") return { extractDocument: async () => { calls.extraction++; return { extracted: { text: "read" } } } }
      return require(name)
    },
  })
  const request = mode => {
    const body = new FormData()
    body.set("file", new File(["%PDF-1.7 manual document"], "offer.pdf", { type: "application/pdf" }))
    body.set("branch_id", branch.id); body.set("mode", mode)
    return new Request("http://localhost:3000/api/invoice-documents", { method: "POST", headers: { origin: "http://localhost:3000" }, body })
  }
  return { post: mode => exports.POST(request(mode)), calls }
}

test("manual sales upload registers a private sales attachment without OCR", async () => {
  const { post, calls } = loadRoute()
  const response = await post("sales-manual")
  assert.equal(response.status, 200)
  assert.ok((await response.json()).id)
  assert.equal(calls.extraction, 0)
  assert.equal(calls.domain, "sales")
  assert.equal(calls.metadata.domain, "sales")
  assert.equal(calls.metadata.file_name, "offer.pdf")
  assert.equal(calls.upload, 1)
})

test("invoice upload retains its procurement domain and extraction", async () => {
  const { post, calls } = loadRoute()
  assert.equal((await post("invoice")).status, 200)
  assert.equal(calls.domain, "procurement")
  assert.equal(calls.extraction, 1)
})

test("unauthenticated, unauthorized and preview users cannot upload manual sales documents", async () => {
  for (const [options, status] of [[{ authenticated: false }, 401], [{ permitted: false }, 403], [{ preview: true }, 403]]) {
    const { post, calls } = loadRoute(options)
    assert.equal((await post("sales-manual")).status, status)
    assert.equal(calls.upload, 0)
  }
})
