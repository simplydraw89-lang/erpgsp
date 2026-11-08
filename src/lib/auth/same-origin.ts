export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  const requestUrl = new URL(request.url)
  const host = request.headers.get("host")

  // 1. Verifikasi Origin jika dikirimkan oleh browser
  if (origin) {
    try {
      const originUrl = new URL(origin)
      if (originUrl.origin === requestUrl.origin) return true
      if (host && originUrl.host === host) return true

      // Mendukung akses jaringan lokal / dev server (misal dari HP via LAN IP 192.168.x.x atau localhost)
      const isLocalOrigin =
        originUrl.hostname === "localhost" ||
        originUrl.hostname === "127.0.0.1" ||
        originUrl.hostname.startsWith("192.168.") ||
        originUrl.hostname.startsWith("10.") ||
        originUrl.hostname.startsWith("172.")

      const isLocalHost =
        requestUrl.hostname === "0.0.0.0" ||
        requestUrl.hostname === "localhost" ||
        requestUrl.hostname === "127.0.0.1" ||
        requestUrl.hostname.startsWith("192.168.") ||
        requestUrl.hostname.startsWith("10.") ||
        requestUrl.hostname.startsWith("172.")

      if (isLocalOrigin && isLocalHost) {
        return true
      }
    } catch {
      return false
    }
  }

  // 2. Fallback ke Referer
  const referer = request.headers.get("referer")
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      if (refererUrl.origin === requestUrl.origin) return true
      if (host && refererUrl.host === host) return true

      const isLocalReferer =
        refererUrl.hostname === "localhost" ||
        refererUrl.hostname === "127.0.0.1" ||
        refererUrl.hostname.startsWith("192.168.") ||
        refererUrl.hostname.startsWith("10.") ||
        refererUrl.hostname.startsWith("172.")

      if (isLocalReferer) {
        return true
      }
    } catch {
      return false
    }
  }

  // 3. Fallback ke sec-fetch-site (dikirim oleh browser modern untuk request dari aplikasi sendiri)
  const secFetchSite = request.headers.get("sec-fetch-site")
  if (secFetchSite === "same-origin") {
    return true
  }

  // 4. Fallback ke Host
  if (host) {
    return (
      host === requestUrl.host ||
      host.includes("localhost") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("127.0.0.1")
    )
  }

  return false
}
