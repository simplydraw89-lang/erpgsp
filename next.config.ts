import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pdfjs-dist"],
  distDir: process.env.GSP_TEST_DIST_DIR || ".next",
}

export default nextConfig
