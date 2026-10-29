import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17212b",
        muted: "#687783",
        canvas: "#f4f6f7",
        line: "#e5eaed",
        brand: {
          DEFAULT: "#116a61",
          dark: "#0c514b",
          light: "#e5f3f0",
        },
      },
      boxShadow: {
        panel: "0 2px 12px rgba(20, 42, 48, 0.045)",
      },
    },
  },
  plugins: [],
}

export default config
