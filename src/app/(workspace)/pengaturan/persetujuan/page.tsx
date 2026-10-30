import { requireWorkspace } from "@/lib/auth/context"
import { isWorkflowMissing } from "@/lib/workflow"
import { Card } from "@/components/ui/card"
import { MigrationNotice } from "@/components/workflow/migration-notice"
import {
  PolicyForm,
  type ApprovalPolicy,
} from "@/components/workflow/policy-form"

export default async function ApprovalPoliciesPage() {
  const { supabase, organizationId, role } = await requireWorkspace()
  const { data, error } = await supabase
    .from("approval_policies")
    .select(
      "record_type,reviewer_role,escalation_amount,escalation_role,version",
    )
    .eq("organization_id", organizationId)
    .order("record_type")
  if (isWorkflowMissing(error)) return <MigrationNotice />
  if (error) throw new Error("Kebijakan persetujuan gagal dimuat.")
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Kebijakan persetujuan</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Administrator sistem menentukan peran pemeriksa untuk setiap jenis dokumen. Pengaju
          selalu dilarang menyetujui sendiri. Harus ada anggota lain dengan
          peran pemeriksa yang ditentukan. Kebijakan awal menggunakan direksi;
          sesuaikan dengan kebijakan perusahaan.
        </p>
      </div>
      <Card className="bg-brand-light/40 p-5 text-sm leading-6">
        Perubahan kebijakan berlaku untuk pengajuan berikutnya. Dokumen yang
        sudah diajukan tetap memakai salinan kebijakan saat pengajuan.{" "}
        {role !== "owner" &&
          "Anda memiliki akses baca; perubahan hanya dapat dilakukan Superuser."}
      </Card>
      {((data ?? []) as ApprovalPolicy[]).map((policy) => (
        <Card key={policy.record_type} className="p-6">
          <PolicyForm
            key={`${policy.record_type}-${policy.version}`}
            policy={policy}
            canEdit={role === "owner"}
          />
        </Card>
      ))}
    </div>
  )
}
