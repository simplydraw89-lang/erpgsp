import type { OrganizationRole } from "@/lib/auth/context"

export const previewRoles: Exclude<OrganizationRole, "owner">[] = [
  "director",
  "manager",
  "finance",
  "hr",
  "operations",
  "auditor",
  "staff",
]
