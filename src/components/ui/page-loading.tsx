import { Activity } from "lucide-react"
import { cn } from "@/lib/utils"

export function PageLoading({
  title = "Menyiapkan halaman",
  description = "Mohon tunggu, halaman pilihan Anda sedang dimuat.",
  overlay = false,
}: {
  title?: string
  description?: string
  overlay?: boolean
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "flex items-center justify-center px-6 py-16 text-center",
        overlay && "fixed inset-0 z-50 bg-canvas/95 backdrop-blur-sm",
      )}
    >
      <div className="w-full max-w-xs">
        <div className="relative mx-auto flex size-20 items-center justify-center">
          <div aria-hidden="true" className="absolute inset-0 animate-spin rounded-full border-[3px] border-brand/15 border-t-brand motion-reduce:animate-none" />
          <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-brand-light text-brand">
            <Activity size={28} />
          </span>
        </div>
        <p className="mt-6 text-base font-semibold text-ink">{title}</p>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        <div aria-hidden="true" className="mt-6 h-1 overflow-hidden rounded-full bg-brand/10">
          <div className="loading-progress h-full w-1/3 rounded-full bg-brand" />
        </div>
      </div>
    </div>
  )
}
