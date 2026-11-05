import { SalesWorkspace } from "@/components/sales/sales-workspace"

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  return <SalesWorkspace view="klien" query={await searchParams} />
}
