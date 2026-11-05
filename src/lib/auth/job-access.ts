import type { OrganizationRole } from "./context"

const jobRoles: Record<string, OrganizationRole> = {
  president: "director", finance_director: "director", technical_director: "director",
  accounting_tax: "finance", finance: "finance", hr: "hr", branch_manager: "manager",
  project_manager: "operations", admin: "staff", marketing: "staff", support: "staff", other: "staff",
}
const priority: OrganizationRole[] = ["director", "finance", "hr", "manager", "operations", "staff"]

// This controls navigation only. Database policies/RPCs remain authoritative.
export function navigationForJobs(actorRole: OrganizationRole, relationship: string | null,
  jobs: { job_role: string }[], preview: OrganizationRole | null = null): OrganizationRole[] {
  if (preview) return [preview]
  if (actorRole === "owner") return ["owner"]
  if (relationship && ["client", "vendor", "consultant"].includes(relationship)) return []
  if (!relationship || !["probation", "contract", "permanent"].includes(relationship)) return ["staff"]
  const granted = new Set(jobs.map(job => jobRoles[job.job_role]).filter(Boolean))
  return priority.filter(role => role === "staff" || granted.has(role))
}
