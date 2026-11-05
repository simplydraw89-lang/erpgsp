import { formatCurrency } from "@/lib/money"
export type BusinessUnit = { id: string; code: string; name: string; kind: string }
export type WorkAssignment = { user_id: string; branch_id: string | null; job_role: string }
export type ProcurementVendor = { id: string; branch_id: string; name: string; address: string; npwp: string; bank_owner: string; bank_account: string; payment_method: string; status: string; created_by: string }
export type ProcurementAccount = { id: string; code: string; name: string; account_type: string; posting_category: string; is_postable: boolean }
export type PurchaseLine = { description: string; account_id: string; amount: number }
export type PurchaseRequest = {
  id: string; branch_id: string; created_by: string; invoice_number: string; invoice_date: string;
  tax_invoice_number: string | null; tax_invoice_date: string | null; vendor_id: string | null;
  vendor_snapshot: Partial<ProcurementVendor>; lines: PurchaseLine[]; vat_mode: string;
  withholding_code: string; withholding_rate: number | string; withholding_base: number | string; withholding_timing: "invoice" | "payment";
  vat_creditable: boolean; requested_payment_date: string | null; status: string; version: number;
  subtotal: number | string; vat_amount: number | string; withholding_amount: number | string;
  total: number | string; payable_amount: number | string; review_note: string | null;
  journal_id: string | null; payment_journal_id: string | null; payment_reference: string | null;
  paid_on: string | null; created_at: string; notes: string; attachment_ids: string[];
}
export type SalesClient = { id: string; branch_id?: string | null; name: string; address: string; npwp: string; contact: string; phone: string; email: string; industry: string; additional_information?: string | null }
export type SalesDocument = { amount?: number | string | null; created_at: string; id: string; branch_id: string; client_id: string; created_by: string; kind: string; title: string; source: string; sph_number: number | null; accepted_sph_id: string | null; status: string; notes: string; attachment_ids: string[]; version: number; work_area: string | null; work_scopes: string[]; deal_status: string | null; valid_until: string | null; client_snapshot: Partial<SalesClient>; review_note?: string | null }
export const jobLabels: Record<string, string> = {
  president: "Direktur Utama", finance_director: "Direktur Keuangan", technical_director: "Direktur Teknis",
  finance: "Finance", accounting_tax: "Accounting & Tax", hr: "SDM", branch_manager: "Manager Cabang",
  admin: "Admin", project_manager: "Project Manager", marketing: "Marketing", support: "Support", other: "Lainnya",
}
export const relationshipLabels: Record<string, string> = { probation: "Probation", contract: "Kontrak", permanent: "Tetap", consultant: "Konsultan / tenaga ahli", vendor: "Vendor", client: "Klien" }
export const purchaseStatusLabels: Record<string, string> = {
  draft: "Draft", branch_review: "Verifikasi Manager Cabang", director_review: "Persetujuan Direktur Keuangan",
  accounting_review: "Pemeriksaan Accounting & Tax", payment_ready: "Siap dibayar Finance", paid: "Lunas", rejected: "Ditolak / perlu revisi",
}
export const rupiah = formatCurrency
export function isProcurementMissing(error: { code?: string; message?: string } | null) { return Boolean(error && (["42P01", "PGRST205", "PGRST202"].includes(error.code ?? "") || /schema cache.*(purchase_requests|business_units|procurement_vendors)/i.test(error.message ?? ""))) }
export const procurementInput = "mt-1 block min-h-10 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:bg-canvas"
export const procurementLabel = "block text-sm font-medium text-ink"
