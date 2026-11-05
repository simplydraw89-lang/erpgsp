import "server-only"
import type { requireWorkspace } from "@/lib/auth/context"
import type { SalesNotifications } from "@/lib/sales"

type Supabase = Awaited<ReturnType<typeof requireWorkspace>>["supabase"]

export type BusinessReviewItem = {
  id: string
  kind: "purchase" | "vendor" | "sph"
  title: string
  status: string
  branch_id: string
  amount: number | string
}

export type BranchPurchaseSummary = {
  branch_id: string
  branch_name: string
  submitted_count: number
  unpaid_amount: number | string
  paid_amount: number | string
}

// RPCs apply the same database permissions as the underlying document actions.
// A missing migration must stay visible rather than appearing as an empty queue.
export async function loadBusinessSummary(supabase: Supabase, organizationId: string, { includeReport = true } = {}) {
  const [queue, salesQueue, report, notifications] = await Promise.all([
    supabase.rpc("purchase_review_queue", { p_org: organizationId }),
    supabase.rpc("sph_review_queue", { p_org: organizationId }),
    includeReport ? supabase.rpc("purchase_branch_report", { p_org: organizationId }) : Promise.resolve({ data: [], error: null }),
    supabase.rpc("sales_notifications",{p_org:organizationId}),
  ])
  return {
    queue: [...(Array.isArray(queue.data) ? queue.data : []), ...(Array.isArray(salesQueue.data) ? salesQueue.data : [])] as BusinessReviewItem[],
    branches: (Array.isArray(report.data) ? report.data : []) as BranchPurchaseSummary[],
    queueError: queue.error || salesQueue.error,
    reportError: report.error,
    notifications: notifications.data as SalesNotifications | null,
    notificationsError: notifications.error,
  }
}
