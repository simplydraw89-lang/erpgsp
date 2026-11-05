import { SalesWorkspace } from "@/components/sales/sales-workspace"

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  return <SalesWorkspace view="spk" query={await searchParams} />
}
