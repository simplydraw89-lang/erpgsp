import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

const eslintConfig = [
  {
    ignores: [".next/**", ".next-*/**", "node_modules/**", "out/**", "coverage/**"],
  },
  ...nextVitals,
  ...nextTypescript,
]

export default eslintConfig
