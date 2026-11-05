import { PurchaseWorkspace } from "@/components/procurement/purchase-workspace"

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  return <PurchaseWorkspace view="vendor" query={await searchParams} />
}
