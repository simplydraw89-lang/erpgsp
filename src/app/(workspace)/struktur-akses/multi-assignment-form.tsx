"use client"

import { useState } from "react"
import { Plus, X, ShieldAlert, Check } from "lucide-react"
import { SubmitButton } from "@/components/procurement/submit-button"
import {
  jobLabels,
  relationshipLabels,
  procurementInput as input,
  procurementLabel as label,
} from "@/lib/procurement-ui"
import { saveWorkAssignment } from "./actions"

interface Member {
  user_id: string
  role: string
  email?: string
  full_name?: string
}

interface Unit {
  id: string
  code: string
  name: string
  kind: string
}

interface SelectedRole {
  job_role: string
  branch_id: string | null
  branch_name: string
}

const centralJobs = new Set([
  "president",
  "finance_director",
  "technical_director",
  "finance",
  "accounting_tax",
])

const branchJobs = new Set([
  "branch_manager",
  "admin",
  "project_manager",
  "support",
  "other",
])

export function MultiAssignmentForm({
  members,
  branches,
}: {
  members: Member[]
  branches: Unit[]
}) {
  const [selectedUser, setSelectedUser] = useState("")
  const [relationship, setRelationship] = useState("permanent")
  const [currentBranch, setCurrentBranch] = useState("")
  const [currentJob, setCurrentJob] = useState("")
  const [selectedRoles, setSelectedRoles] = useState<SelectedRole[]>([])
  const [formError, setFormError] = useState("")

  function handleAddRole() {
    setFormError("")
    if (!currentJob) {
      setFormError("Silakan pilih jabatan terlebih dahulu.")
      return
    }

    if (branchJobs.has(currentJob) && !currentBranch) {
      setFormError(`Jabatan "${jobLabels[currentJob]}" memerlukan lokasi cabang.`)
      return
    }

    if (centralJobs.has(currentJob) && currentBranch) {
      setFormError(`Jabatan "${jobLabels[currentJob]}" adalah jabatan pusat (pilih cakupan Pusat).`)
      return
    }

    const branchId = centralJobs.has(currentJob) ? null : currentBranch || null
    const exists = selectedRoles.some(
      (r) => r.job_role === currentJob && r.branch_id === branchId,
    )

    if (exists) {
      setFormError("Jabatan dan cakupan ini sudah ada dalam daftar pilihan.")
      return
    }

    const branchName = branchId
      ? branches.find((b) => b.id === branchId)?.name ?? "Cabang"
      : "Pusat"

    setSelectedRoles((prev) => [
      ...prev,
      {
        job_role: currentJob,
        branch_id: branchId,
        branch_name: branchName,
      },
    ])
    setCurrentJob("")
  }

  function handleRemoveRole(index: number) {
    setSelectedRoles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <form action={saveWorkAssignment} className="mt-5 space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}>
          Akun Anggota
          <select
            name="user_id"
            required
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className={input}
          >
            <option value="">-- Pilih Akun --</option>
            {members.map((m) => (
              <option value={m.user_id} key={m.user_id}>
                {m.full_name ? m.full_name : (m.role === "owner" ? "Super Admin" : m.role)} {m.email ? `(${m.email})` : `· ${m.user_id.slice(0, 8)}...`}
              </option>
            ))}
          </select>
        </label>

        <label className={label}>
          Hubungan dengan Perusahaan
          <select
            name="relationship_status"
            required
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className={input}
          >
            {Object.entries(relationshipLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">
            Pilih & Tambahkan Jabatan (Bisa Lebih dari 1)
          </p>
          <span className="text-xs text-slate-500">
            {selectedRoles.length} jabatan dipilih
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-12 items-end">
          <div className="sm:col-span-5">
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Cakupan Wilayah / Cabang
            </label>
            <select
              value={currentBranch}
              onChange={(e) => setCurrentBranch(e.target.value)}
              className={input}
            >
              <option value="">Pusat – sesuai bidang tugas</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-5">
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Jabatan
            </label>
            <select
              value={currentJob}
              onChange={(e) => setCurrentJob(e.target.value)}
              className={input}
            >
              <option value="">-- Pilih Jabatan --</option>
              {Object.entries(jobLabels).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={handleAddRole}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 transition"
            >
              <Plus size={16} />
              Tambah
            </button>
          </div>
        </div>

        {formError && (
          <div className="mt-2.5 flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-lg">
            <ShieldAlert size={15} />
            <span>{formError}</span>
          </div>
        )}

        {/* Selected Roles List (Metadata / Tags) */}
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Daftar Jabatan yang Akan Diberikan:
          </p>
          {selectedRoles.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400 italic">
              Belum ada jabatan yang ditambahkan ke daftar. Pilih jabatan di atas lalu klik &quot;Tambah&quot;.
            </p>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {selectedRoles.map((r, idx) => (
                <div
                  key={`${r.job_role}-${r.branch_id}-${idx}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand shadow-sm"
                >
                  <span className="font-semibold">{jobLabels[r.job_role] ?? r.job_role}</span>
                  <span className="text-slate-500 font-normal">({r.branch_name})</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRole(idx)}
                    className="ml-1 rounded-full p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition"
                    title="Hapus jabatan ini"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <input
        type="hidden"
        name="roles_json"
        value={JSON.stringify(selectedRoles)}
      />

      <div>
        <SubmitButton disabled={selectedRoles.length === 0}>
          <Check size={16} className="inline mr-1.5" />
          Simpan Seluruh Penugasan Akun
        </SubmitButton>
      </div>
    </form>
  )
}
