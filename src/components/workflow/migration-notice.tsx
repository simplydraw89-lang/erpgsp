import { Card } from "@/components/ui/card"

export function MigrationNotice() {
  return (
    <Card className="border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
      <p className="font-semibold">Pembaruan database diperlukan</p>
      <p>
        Schema workflow atau modul yang dipilih belum tersedia di database ini.
        Administrator perlu menerapkan migration database yang diperlukan
        secara berurutan. Data lama tetap dipertahankan.
      </p>
    </Card>
  )
}
