// Run with Playwright available in Node's module search path.
// No real credentials are used; authentication responses are intercepted.
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS test supports optional tooling through NODE_PATH. */
const { chromium } = require("playwright")
const assert = require("node:assert/strict")

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true })
  try {
    const page = await browser.newPage()
    const errors = []
    page.on("console", (message) => {
      if (message.type() === "error" && /hydrat|didn't match/i.test(message.text())) {
        errors.push(message.text())
      }
    })
    page.on("pageerror", (error) => errors.push(error.message))

    // Simulate the reported extension at HTML parsing time, before app scripts.
    await page.addInitScript(() => {
      const mark = () => {
        if (!document.body) return false
        document.body.setAttribute("bis_register", "extension-test")
        document.body.setAttribute("__processed_c6992ccc-d404-4bce-8d2c-3c2c582dabb4__", "true")
        for (const element of document.querySelectorAll("div")) {
          element.setAttribute("bis_skin_checked", "1")
        }
        return true
      }
      if (!mark()) {
        const observer = new MutationObserver(() => {
          if (mark()) observer.disconnect()
        })
        observer.observe(document, { childList: true, subtree: true })
      }
    })

    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" })
    await page.getByRole("button", { name: "Masuk ke workspace" }).waitFor()
    assert.equal(await page.locator("[bis_skin_checked], [bis_register]").count(), 0)
    assert.equal(await page.locator("body").getAttribute("__processed_c6992ccc-d404-4bce-8d2c-3c2c582dabb4__"), null)
    assert.equal(await page.locator("html").getAttribute("lang"), "id")
    assert.deepEqual(errors, [], "Hydration must tolerate the reported extension markers")
    console.log("PASS: extension injection before hydration; app attributes preserved")

    await page.evaluate(() => {
      document.body.setAttribute("data-legitimate", "preserve")
      document.body.setAttribute("bis_register", "late-injection")
      const streamed = document.createElement("div")
      streamed.setAttribute("bis_skin_checked", "1")
      streamed.setAttribute("data-test-streamed", "true")
      document.body.append(streamed)
    })
    await page.waitForFunction(() => !document.querySelector("[bis_register], [bis_skin_checked]"))
    assert.equal(await page.locator("body").getAttribute("data-legitimate"), "preserve")
    console.log("PASS: late extension attributes and newly inserted subtrees cleaned")

    let releaseAuth
    const authGate = new Promise((resolve) => { releaseAuth = resolve })
    await page.route("**/auth/v1/token**", async (route) => {
      await authGate
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ code: "invalid_credentials", msg: "Invalid login credentials" }),
      })
    })
    await page.getByLabel("Email", { exact: true }).fill("browser-test@example.invalid")
    await page.getByLabel("Kata sandi", { exact: true }).fill("test-only-no-real-password")
    await page.getByRole("button", { name: "Masuk ke workspace" }).click()
    await page.getByText("Memverifikasi akun", { exact: true }).waitFor()
    assert.equal(await page.getByRole("button", { name: "Mohon tunggu..." }).isDisabled(), true)
    releaseAuth()
    await page.getByRole("alert").filter({ hasText: "Login gagal" }).waitFor()
    assert.equal(await page.getByText("Memverifikasi akun", { exact: true }).count(), 0)
    assert.equal(await page.getByRole("button", { name: "Masuk ke workspace" }).isEnabled(), true)
    console.log("PASS: login loading, duplicate-submit prevention and failure recovery")

    // A delayed route must show the navigation progress, then clear on arrival.
    let releaseNavigation
    const navigationGate = new Promise((resolve) => { releaseNavigation = resolve })
    // Exercise the existing branded NavigationLink without requiring an account.
    const brandLink = page.getByRole("link", { name: /GSP Group/ })
    // Delay its root request, which redirects unauthenticated users to login.
    await page.route(/^http:\/\/localhost:3000\/(\?.*)?$/, async (route) => {
      await navigationGate
      await route.continue()
    })
    await brandLink.click()
    await page.getByRole("status").filter({ hasText: "Halaman sedang dimuat..." }).waitFor()
    releaseNavigation()
    await page.waitForURL("**/login")
    await page.getByRole("status").filter({ hasText: "Halaman sedang dimuat..." }).waitFor({ state: "detached" })
    assert.deepEqual(errors, [])
    console.log("PASS: selected-link loading clears after navigation")

    // Simulate successful authentication, but hold the destination request to
    // prove loading survives the gap between authentication and route commit.
    await page.unroute("**/auth/v1/token**")
    const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "browser-test@example.invalid", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url")
    const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: user.aud, role: user.role, exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`
    await page.route("**/auth/v1/token**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: token, refresh_token: "test-refresh-token", token_type: "bearer", expires_in: 3600, user }),
    }))
    let releaseDashboard
    const dashboardGate = new Promise((resolve) => { releaseDashboard = resolve })
    await page.route("**/dashboard**", async (route) => {
      await dashboardGate
      await route.abort().catch(() => {})
    })
    await page.getByRole("button", { name: "Masuk ke workspace" }).click()
    await page.getByText("Membuka workspace", { exact: true }).waitFor()
    assert.equal(await page.getByRole("button", { name: "Mohon tunggu..." }).isDisabled(), true)
    assert.deepEqual(errors, [])
    await page.close()
    releaseDashboard()
    console.log("PASS: successful-login redirect keeps loading until the destination is ready (mock auth)")
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
