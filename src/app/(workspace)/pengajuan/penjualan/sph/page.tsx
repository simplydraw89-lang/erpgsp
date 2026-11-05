import { SalesWorkspace } from "@/components/sales/sales-workspace"

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  return <SalesWorkspace view="sph" query={await searchParams} />
}
