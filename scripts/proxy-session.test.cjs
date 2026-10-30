/* eslint-disable @typescript-eslint/no-require-imports -- Node's built-in test runner with a CommonJS transpilation harness. */
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
const { NextRequest } = require("next/server")

function loadProxy(authResult, changedCookies) {
  const file = path.join(__dirname, "../src/proxy.ts")
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, {
    exports,
    URL,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://test.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public-key" } },
    require(name) {
      if (name === "@/lib/supabase/config") return { isSupabaseConfigured: () => true, getSupabaseConfig: () => ({url:"https://test.invalid",key:"test-public-key"}) }
      if (name === "@supabase/ssr") {
        return {
          createServerClient(_url, _key, options) {
            return {
              auth: {
                async getUser() {
                  options.cookies.setAll(changedCookies)
                  return authResult
                },
              },
            }
          },
        }
      }
      return require(name)
    },
  }, { filename: file })
  return exports.proxy
}

const refreshedCookie = { name: "sb-test-auth-token", value: "refreshed-test-session", options: { path: "/", sameSite: "lax", maxAge: 3600 } }

test("Supabase configuration accepts the publishable key and legacy alias", () => {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,"../src/lib/supabase/config.ts"),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
  const load = env => { const exports={};vm.runInNewContext(code,{exports,process:{env}});return exports }
  const modern=load({NEXT_PUBLIC_SUPABASE_URL:"https://test.invalid",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"modern",NEXT_PUBLIC_SUPABASE_ANON_KEY:"legacy"})
  assert.equal(modern.isSupabaseConfigured(),true)
  assert.equal(modern.getSupabaseConfig().key,"modern")
  const legacy=load({NEXT_PUBLIC_SUPABASE_URL:"https://test.invalid",NEXT_PUBLIC_SUPABASE_ANON_KEY:"legacy"})
  assert.equal(legacy.getSupabaseConfig().key,"legacy")
  const missing=load({NEXT_PUBLIC_SUPABASE_URL:"https://test.invalid"})
  assert.equal(missing.isSupabaseConfigured(),false)
  assert.throws(()=>missing.getSupabaseConfig(),/PUBLISHABLE_KEY/)
})

test("authenticated login redirect retains refreshed session cookies", async () => {
  const proxy = loadProxy({ data: { user: { id: "test-user" } }, error: null }, [refreshedCookie])
  const response = await proxy(new NextRequest("http://localhost:3000/login"))
  assert.equal(response.headers.get("location"), "http://localhost:3000/dashboard")
  assert.equal(response.cookies.get(refreshedCookie.name).value, refreshedCookie.value)
  assert.equal(response.cookies.get(refreshedCookie.name).sameSite, "lax")
})

test("protected-page redirect clears an invalid session in the browser", async () => {
  const clearedCookie = { ...refreshedCookie, value: "", options: { path: "/", maxAge: 0 } }
  const proxy = loadProxy({ data: { user: null }, error: { name: "AuthSessionMissingError" } }, [clearedCookie])
  const response = await proxy(new NextRequest("http://localhost:3000/dashboard"))
  assert.equal(response.headers.get("location"), "http://localhost:3000/login")
  assert.equal(response.cookies.get(clearedCookie.name).value, "")
  assert.equal(response.cookies.get(clearedCookie.name).maxAge, 0)
})

test("verification-error redirect preserves cookie updates", async () => {
  const proxy = loadProxy({ data: { user: null }, error: { name: "AuthApiError" } }, [refreshedCookie])
  const response = await proxy(new NextRequest("http://localhost:3000/dashboard"))
  assert.equal(response.headers.get("location"), "http://localhost:3000/login?error=session_verification")
  assert.equal(response.cookies.get(refreshedCookie.name).value, refreshedCookie.value)
})

test("authorized page receives refreshed cookies without a redirect", async () => {
  const proxy = loadProxy({ data: { user: { id: "test-user" } }, error: null }, [refreshedCookie])
  const response = await proxy(new NextRequest("http://localhost:3000/dashboard"))
  assert.equal(response.headers.get("location"), null)
  assert.equal(response.cookies.get(refreshedCookie.name).value, refreshedCookie.value)
})
