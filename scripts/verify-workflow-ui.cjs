/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS browser harness supports optional Playwright through NODE_PATH. */
// Isolated local Supabase-compatible fixture backed by PostgreSQL/PGlite.
// Both the browser and Next.js server use it; no production credentials/data.
const { createServer } = require("node:http")
const { spawn } = require("node:child_process")
const { readFileSync, readdirSync, writeFileSync } = require("node:fs")
const path = require("node:path")
const { tmpdir } = require("node:os")
const assert = require("node:assert/strict")
const { PGlite } = require("@electric-sql/pglite")
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto")
const { chromium } = require("playwright")

const root = path.resolve(__dirname, "..")
const rpcTypes = {
  save_workflow_draft: {
    p_org: "uuid",
    p_type: "text",
    p_payload: "jsonb",
    p_document_id: "uuid",
    p_expected_version: "integer",
    p_target_id: "uuid",
    p_target_version: "integer",
  },
  submit_workflow_document: {
    p_document_id: "uuid",
    p_expected_version: "integer",
  },
  review_approval_request: {
    p_request_id: "uuid",
    p_decision: "text",
    p_note: "text",
  },
  execute_workflow_document: {
    p_document_id: "uuid",
    p_expected_version: "integer",
  },
  revise_workflow_document: {
    p_document_id: "uuid",
    p_expected_version: "integer",
  },
  set_approval_policy: {
    p_org: "uuid",
    p_type: "text",
    p_reviewer: "text",
    p_threshold: "numeric",
    p_escalation: "text",
    p_expected_version: "integer",
  },
}
const allowedTables = [
  "organization_members",
  "organizations",
  "company_assets",
  "workflow_documents",
  "approval_requests",
  "approval_policies",
  "workflow_executions",
  "crm_clients",
  "crm_projects",
  "operational_work_items",
  "finance_accounts",
  "hr_employees",
  "tax_records",
  "audit_events",
]
const ident = (value) => {
  if (!/^[a-z_]+$/.test(value)) throw Error("Invalid identifier")
  return `"${value}"`
}

async function main() {
  const db = new PGlite({ extensions: { pgcrypto } })
  let server, child, browser
  let serverOutput = ""
  const originalTsconfig = readFileSync(path.join(root, "tsconfig.json"))
  const originalNextEnv = readFileSync(path.join(root, "next-env.d.ts"))
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`)
    for (const file of readdirSync(path.join(root, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(
        readFileSync(path.join(root, "supabase/migrations", file), "utf8"),
      )
    const org = (
      await db.query(
        "insert into public.organizations(name,slug) values('GSP Local Test','gsp-ui-test') returning id",
      )
    ).rows[0].id
    const users = {}
    for (const [index, role] of [
      "owner",
      "director",
      "operations",
      "finance",
      "hr",
      "staff",
    ].entries()) {
      const id = `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
      const encode = (value) =>
        Buffer.from(JSON.stringify(value)).toString("base64url")
      const user = {
        id,
        email: `${role}@example.invalid`,
        role: "authenticated",
        aud: "authenticated",
        app_metadata: {},
        user_metadata: {
          full_name: role === "owner" ? "Ardie Kumara" : `${role} Pengguna`,
        },
        created_at: new Date().toISOString(),
      }
      const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`
      users[role] = { user, token }
      await db.query("insert into auth.users(id) values($1)", [id])
      await db.query(
        "insert into public.organization_members(organization_id,user_id,role) values($1,$2,$3)",
        [org, id, role],
      )
    }
    const tomorrow = new Date(Date.now() + 31 * 3600000)
      .toISOString()
      .slice(0, 10)
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        users.owner.user.id,
      ])
      await tx.query(
        "insert into public.tax_records(organization_id,tax_period,tax_type,tax_base,tax_amount,due_on,created_by) values($1,'2026-10','ppn',1000,100,$2,$3)",
        [org, tomorrow, users.owner.user.id],
      )
    })
    server = createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "http://localhost:3100")
      res.setHeader("Access-Control-Allow-Headers", "*")
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS")
      res.setHeader("Access-Control-Expose-Headers", "content-range")
      res.setHeader("Content-Type", "application/json")
      const send = (status, value) => {
        res.statusCode = status
        res.end(JSON.stringify(value,(key,item)=>key.endsWith("_on")&&typeof item==="string"?item.slice(0,10):item))
      }
      if (req.method === "OPTIONS") {
        res.statusCode = 204
        res.end()
        return
      }
      try {
        const url = new URL(req.url, "http://127.0.0.1:54329")
        let text = ""
        for await (const chunk of req) text += chunk
        const body = text ? JSON.parse(text) : {}
        if (url.pathname === "/auth/v1/token") {
          const fixture = Object.values(users).find(
            (value) => value.user.email === body.email,
          )
          if (!fixture || body.password !== "local-test-password")
            return send(400, {
              code: "invalid_credentials",
              msg: "Invalid credentials",
            })
          return send(200, {
            access_token: fixture.token,
            refresh_token: "fixture-refresh",
            expires_in: 3600,
            token_type: "bearer",
            user: fixture.user,
          })
        }
        const fixture = Object.values(users).find(
          (value) => req.headers.authorization === `Bearer ${value.token}`,
        )
        if (!fixture)
          return send(401, {
            code: "bad_jwt",
            message: "Fixture session required",
          })
        if (url.pathname === "/auth/v1/user") return send(200, fixture.user)
        if (url.pathname === "/auth/v1/logout") {
          res.statusCode = 204
          res.end()
          return
        }
        const result = await db.transaction(async (tx) => {
          await tx.exec("set local role authenticated")
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
            fixture.user.id,
          ])
          if (url.pathname.startsWith("/rest/v1/rpc/")) {
            const name = url.pathname.split("/").pop()
            if (!rpcTypes[name]) throw Error("Unknown RPC")
            const entries = Object.entries(body)
            const parameters = entries.map(([key], index) => {
              if (!rpcTypes[name][key]) throw Error("Unknown RPC argument")
              return `${ident(key)} => $${index + 1}::${rpcTypes[name][key]}`
            })
            const values = entries.map(([key, value]) =>
              rpcTypes[name][key] === "jsonb" ? JSON.stringify(value) : value,
            )
            return {
              value: (
                await tx.query(
                  `select public.${ident(name)}(${parameters.join(",")}) result`,
                  values,
                )
              ).rows[0].result,
            }
          }
          const table = url.pathname.split("/").pop()
          if (
            !allowedTables.includes(table) ||
            !["GET", "HEAD"].includes(req.method)
          )
            throw Error("Unsupported fixture endpoint")
          const columns = url.searchParams.get("select") ?? "*"
          const nested =
            table === "organization_members" &&
            columns.includes("organizations(")
          const selection = nested
            ? "organization_id,role,(select jsonb_build_object('id',o.id,'name',o.name) from public.organizations o where o.id=t.organization_id) organizations"
            : columns === "*"
              ? "t.*"
              : columns.split(",").map(ident).join(",")
          const clauses = [],
            values = []
          for (const [key, value] of url.searchParams) {
            if (["select", "order", "limit"].includes(key)) continue
            const dot = value.indexOf(".")
            const operator = value.slice(0, dot)
            const operand = value.slice(dot + 1)
            if (!["eq", "neq", "ilike", "gte", "lt", "in"].includes(operator))
              throw Error("Unsupported fixture filter")
            if (operator === "in") {
              const terms = operand.slice(1, -1).split(",")
              const placeholders = terms.map((term) => {
                values.push(term)
                return `$${values.length}`
              })
              clauses.push(`t.${ident(key)} in (${placeholders.join(",")})`)
              continue
            }
            values.push(operand)
            clauses.push(
              `t.${ident(key)} ${{ eq: "=", neq: "<>", ilike: "ilike", gte: ">=", lt: "<" }[operator]} $${values.length}`,
            )
          }
          const order = url.searchParams
            .get("order")
            ?.split(",")
            .map((value) => {
              const [key, direction] = value.split(".")
              return `t.${ident(key)} ${direction === "desc" ? "desc" : "asc"}`
            })
            .join(",")
          const limit = Math.min(
            Number(url.searchParams.get("limit") ?? 500),
            500,
          )
          const rows = (
            await tx.query(
              `select ${selection} from public.${ident(table)} t ${clauses.length ? `where ${clauses.join(" and ")}` : ""} ${order ? `order by ${order}` : ""} limit ${limit}`,
              values,
            )
          ).rows
          if (String(req.headers.prefer).includes("count=exact"))
            res.setHeader(
              "Content-Range",
              `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
            )
          return {
            value: String(req.headers.accept).includes(
              "application/vnd.pgrst.object+json",
            )
              ? (rows[0] ?? null)
              : rows,
          }
        })
        send(200, result.value)
      } catch (error) {
        send(400, { code: error.code ?? "FIXTURE", message: error.message })
      }
    })
    await new Promise((resolve) => server.listen(54329, "127.0.0.1", resolve))
    child = spawn(
      process.execPath,
      [
        path.join(root, "node_modules/next/dist/bin/next"),
        "dev",
        "--port",
        "3100",
      ],
      {
        cwd: root,
        windowsHide: true,
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-public-key",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public-key",
          GSP_TEST_DIST_DIR: ".next-workflow-test",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    child.stdout.on("data", (chunk) => {
      serverOutput += chunk
    })
    child.stderr.on("data", (chunk) => {
      serverOutput += chunk
    })
    await new Promise((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(Error(`Test server startup timed out\n${serverOutput}`)),
        60000,
      )
      const onData = () => {
        if (serverOutput.includes("Ready")) {
          clearTimeout(deadline)
          resolve()
        }
      }
      child.stdout.on("data", onData)
      child.once("exit", (code) => {
        clearTimeout(deadline)
        reject(Error(`Test server exited ${code}\n${serverOutput}`))
      })
    })
    browser = await chromium.launch({ channel: "chrome", headless: true })
    const errors = []
    const login = async (role) => {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      })
      page.on("pageerror", (error) => errors.push(error.message))
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          /hydrated|hydration|didn't match/i.test(message.text())
        )
          errors.push(message.text())
      })
      await page.goto("http://localhost:3100/login")
      await page
        .getByLabel("Email", { exact: true })
        .fill(`${role}@example.invalid`)
      await page
        .getByLabel("Kata sandi", { exact: true })
        .fill("local-test-password")
      await page.getByRole("button", { name: "Masuk ke workspace" }).click()
      await page.waitForURL("**/dashboard")
      return page
    }
    const operations = await login("operations")
    await operations.getByRole("heading", { name: /Selamat/ }).waitFor()
    assert.equal(
      await operations
        .getByRole("link", { name: "Accounting", exact: true })
        .count(),
      0,
    )
    await operations
      .getByRole("link", { name: "Draft saya", exact: true })
      .click()
    await operations.waitForURL("**/approvals?scope=drafts")
    assert.equal(
      await operations
        .getByRole("link", { name: "Draft saya", exact: true })
        .getAttribute("aria-current"),
      "page",
    )
    await operations.goto("http://localhost:3100/dashboard")
    await operations.getByRole("link", { name: "Assets", exact: true }).click()
    await operations
      .getByLabel("Kode aset", { exact: false })
      .fill("AST-UI-001")
    await operations
      .getByLabel("Nama aset", { exact: false })
      .fill("Laptop UI Workflow")
    await operations
      .getByLabel("Kategori", { exact: false })
      .fill("Perangkat IT")
    await operations.getByLabel("Lokasi", { exact: true }).fill("Kantor utama")
    await operations
      .getByLabel("Nilai perolehan (IDR)", { exact: false })
      .fill("12500000.50")
    await operations
      .getByRole("button", { name: "Simpan draft", exact: true })
      .click()
    await operations.waitForURL("**/dokumen/*")
    const docUrl = operations.url()
    assert.equal(
      (await db.query("select count(*)::int n from public.company_assets"))
        .rows[0].n,
      0,
    )
    await operations
      .getByRole("link", { name: "Edit draft", exact: true })
      .click()
    await operations.getByLabel("Lokasi", { exact: true }).fill("Kantor pusat")
    assert.equal(
      await operations
        .getByRole("button", { name: "Ajukan pemeriksaan" })
        .count(),
      0,
    )
    await operations
      .getByRole("button", { name: "Simpan perubahan draft" })
      .click()
    await operations.waitForURL(docUrl)
    await operations.getByRole("button", { name: "Ajukan pemeriksaan" }).click()
    await operations
      .getByText("Isi dokumen terkunci.", { exact: false })
      .waitFor()
    assert.equal(
      await operations
        .getByRole("link", { name: "Edit draft", exact: true })
        .count(),
      0,
    )
    assert.equal(
      await operations.getByRole("button", { name: /Setujui versi/ }).count(),
      0,
    )
    console.log(
      "PASS: asset draft/edit/submit; no live insert; submitted version locked",
    )

    const director = await login("director")
    await director.goto(docUrl)
    await director
      .getByLabel("Catatan keputusan (wajib)")
      .fill("Disetujui sesuai inventaris perusahaan")
    await director
      .getByRole("button", { name: "Setujui versi 2", exact: true })
      .click()
    await director
      .getByRole("button", { name: "Eksekusi versi 2", exact: true })
      .waitFor()
    await operations.reload()
    await operations
      .getByRole("button", { name: "Eksekusi versi 2", exact: true })
      .click()
    await operations
      .getByText("Data resmi telah diperbarui", { exact: false })
      .waitFor()
    assert.equal(
      (await db.query("select count(*)::int n from public.company_assets"))
        .rows[0].n,
      1,
    )
    assert.equal(
      (await db.query("select location from public.company_assets")).rows[0]
        .location,
      "Kantor pusat",
    )
    await operations
      .getByRole("link", { name: "Kembali ke modul", exact: false })
      .click()
    await operations
      .getByRole("heading", { name: "Daftar aset perusahaan" })
      .waitFor()
    await operations
      .getByText("Laptop UI Workflow", { exact: true })
      .first()
      .waitFor()
    console.log(
      "PASS: separate reviewer approves; requester executes; asset appears in official inventory",
    )

    await operations
      .getByRole("link", { name: "Usulkan perubahan", exact: false })
      .click()
    await operations
      .getByRole("heading", { name: "Usulan perubahan aset", exact: true })
      .waitFor()
    await operations
      .getByLabel("Lokasi", { exact: true })
      .fill("Cabang Bandung")
    await operations
      .getByRole("button", { name: "Simpan draft", exact: true })
      .click()
    await operations.waitForURL("**/dokumen/*")
    const changeUrl = operations.url()
    await operations.getByRole("button", { name: "Ajukan pemeriksaan" }).click()
    await operations
      .getByText("Isi dokumen terkunci.", { exact: false })
      .waitFor()
    await director.goto(changeUrl)
    await director
      .getByLabel("Catatan keputusan (wajib)")
      .fill("Lokasi belum sesuai, mohon revisi")
    await director.getByRole("button", { name: "Tolak", exact: true }).click()
    await director.getByText("Dokumen ditolak.", { exact: false }).waitFor()
    await operations.reload()
    await operations.getByRole("button", { name: "Buat revisi draft" }).click()
    await operations
      .getByRole("button", { name: "Ajukan pemeriksaan" })
      .waitFor()
    await operations.getByRole("button", { name: "Ajukan pemeriksaan" }).click()
    await operations
      .getByText("Isi dokumen terkunci.", { exact: false })
      .waitFor()
    await director.goto(changeUrl)
    await director
      .getByLabel("Catatan keputusan (wajib)")
      .fill("Revisi diterima")
    await director
      .getByRole("button", { name: "Setujui versi 2", exact: true })
      .click()
    await director
      .getByRole("button", { name: "Eksekusi versi 2", exact: true })
      .waitFor()
    await operations.reload()
    await operations
      .getByRole("button", { name: "Eksekusi versi 2", exact: true })
      .click()
    await operations
      .getByText("Data resmi telah diperbarui", { exact: false })
      .waitFor()
    const asset = (
      await db.query("select location,row_version from public.company_assets")
    ).rows[0]
    assert.equal(asset.location, "Cabang Bandung")
    assert.equal(asset.row_version, 2)
    assert.deepEqual(errors, [])
    console.log(
      "PASS: asset change rejected, revised, resubmitted, approved and executed with version history",
    )
    await operations.goto("http://localhost:3100/modul/asset")
    await operations
      .getByRole("heading", { name: "Daftar aset perusahaan" })
      .waitFor()
    await operations.screenshot({
      path: path.join(tmpdir(), "gsp-asset-workflow-ui.png"),
      fullPage: true,
      caret: "initial",
    })
    const ownerPage = await login("owner")
    await ownerPage.setViewportSize({ width: 1920, height: 1080 })
    await ownerPage.getByRole("heading", { name: /Ardie/ }).waitFor()
    await ownerPage.getByText("hari lagi", { exact: true }).waitFor()
    assert.equal(await ownerPage.locator("aside").count(), 0)
    await ownerPage
      .getByRole("button", { name: "Cari aplikasi", exact: true })
      .click()
    await ownerPage
      .getByPlaceholder("Cari aplikasi, modul, atau pengajuan...")
      .fill("Assets")
    assert.equal(
      await ownerPage.getByRole("dialog").getByRole("link").count(),
      1,
    )
    await ownerPage.keyboard.press("Escape")
    await ownerPage.keyboard.press("Control+k")
    await ownerPage.getByRole("dialog").waitFor({ state: "visible" })
    await ownerPage.keyboard.press("Escape")
    await ownerPage.screenshot({
      path: path.join(tmpdir(), "gsp-dashboard-desktop.png"),
      fullPage: true,
      caret: "initial",
    })
    await ownerPage.setViewportSize({ width: 390, height: 844 })
    assert.equal(
      await ownerPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    )
    await ownerPage.screenshot({
      path: path.join(tmpdir(), "gsp-dashboard-mobile.png"),
      fullPage: true,
      caret: "initial",
    })
    await ownerPage.setViewportSize({ width: 1440, height: 1000 })
    const staffPage = await login("staff")
    assert.equal(
      await staffPage
        .getByRole("link", { name: "Accounting", exact: true })
        .count(),
      0,
    )
    assert.equal(
      await staffPage
        .getByRole("link", { name: "Data Karyawan", exact: true })
        .count(),
      0,
    )
    await staffPage.getByRole("link", { name: "Assets", exact: true }).waitFor()
    const hrPage = await login("hr")
    await hrPage
      .getByRole("link", { name: "Data Karyawan", exact: true })
      .waitFor()
    assert.equal(
      await hrPage.getByRole("link", { name: "Assets", exact: true }).count(),
      0,
    )
    console.log(
      "PASS: personal dashboard, deadline data, Ctrl+K search, role-based applications and mobile layout",
    )
    await ownerPage.goto("http://localhost:3100/pengaturan/persetujuan")
    const assetPolicy = ownerPage
      .locator("form")
      .filter({
        has: ownerPage.getByRole("heading", { name: "Aset", exact: true }),
      })
    await assetPolicy
      .getByLabel("Pemeriksa utama", { exact: true })
      .selectOption("finance")
    await assetPolicy
      .getByLabel("Eskalasi mulai nominal (IDR)", { exact: true })
      .fill("1000000")
    await assetPolicy
      .getByLabel("Pemeriksa eskalasi", { exact: true })
      .selectOption("owner")
    await assetPolicy
      .getByRole("button", { name: "Simpan kebijakan", exact: true })
      .click()
    await assetPolicy.getByText("Kebijakan versi 2", { exact: true }).waitFor()
    const policy = (
      await db.query(
        "select reviewer_role,version from public.approval_policies where record_type='asset'",
      )
    ).rows[0]
    assert.equal(policy.reviewer_role, "finance")
    assert.equal(policy.version, 2)
    await director.goto("http://localhost:3100/pengaturan/persetujuan")
    assert.equal(
      await director.getByRole("button", { name: "Simpan kebijakan" }).count(),
      0,
    )
    assert.deepEqual(errors, [])
    console.log(
      "PASS: owner configures reviewer and amount escalation; other roles are read-only",
    )
  } catch (error) {
    console.error(serverOutput.slice(-5000))
    throw error
  } finally {
    if (browser) await browser.close()
    if (child) {
      if (process.platform === "win32") {
        await new Promise((resolve) => {
          const cleanup = spawn(
            "taskkill",
            ["/PID", String(child.pid), "/T", "/F"],
            { windowsHide: true, stdio: "ignore" },
          )
          cleanup.once("exit", resolve)
        })
      } else child.kill()
    }
    if (server) await new Promise((resolve) => server.close(resolve))
    await db.close()
    writeFileSync(path.join(root, "tsconfig.json"), originalTsconfig)
    writeFileSync(path.join(root, "next-env.d.ts"), originalNextEnv)
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
