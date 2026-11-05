"use client"
import { useState } from "react"
import { reviewSphRequest } from "@/app/(workspace)/pengajuan/penjualan/actions"
import { SubmitButton } from "@/components/procurement/submit-button"
import { procurementInput as input, procurementLabel as label } from "@/lib/procurement-ui"

export function SphReviewForm({ id, version, disabled }: {id:string;version:number;disabled:boolean}) {
  const [decision,setDecision] = useState("approve")
  return <form action={reviewSphRequest} className="mt-4"><fieldset disabled={disabled} className="space-y-4"><input type="hidden" name="document_id" value={id} /><input type="hidden" name="version" value={version} /><label className={label}>Keputusan<select name="decision" value={decision} onChange={event=>setDecision(event.target.value)} className={input}><option value="approve">Setujui / Approve</option><option value="revise">Revisi</option><option value="reject">Tolak</option></select></label><label className={label}>{decision === "approve" ? "Catatan / arahan khusus (opsional)" : "Alasan revisi / penolakan (wajib)"}<textarea name="note" required={decision!=="approve"} maxLength={5000} rows={3} className={input} /></label><SubmitButton>Simpan keputusan</SubmitButton></fieldset></form>
}
