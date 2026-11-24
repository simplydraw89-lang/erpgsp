"use client"

import React, { useState } from "react"
import {
  Compass,
  Building2,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  PlusCircle,
  FolderKanban,
  UserCheck,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createCrossBranchTaskAction, updateWorkItemStatusAction } from "@/app/(workspace)/pekerjaan-saya/actions"
import { generateWhatsAppLink } from "@/lib/notifications/service"

export interface MonitoredBranch {
  id: string
  code: string
  name: string
}

export interface MonitoredProject {
  id: string
  code: string
  name: string
  branch_id: string | null
  client_name?: string
  status: string
}

export interface MonitoredTask {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_on: string | null
  project_id: string | null
  assigned_to: string | null
  created_at: string
}

export interface StaffOption {
  id: string
  name: string
  phone?: string
  branch_id?: string | null
}

interface JakartaCrossBranchHubProps {
  branches: MonitoredBranch[]
  projects: MonitoredProject[]
  tasks: MonitoredTask[]
  staffList: StaffOption[]
  canManage: boolean
}

export function JakartaCrossBranchHub({
  branches,
  projects,
  tasks,
  staffList,
  canManage,
}: JakartaCrossBranchHubProps) {
  // Filter cabang aktif (default: semua cabang selain Jakarta atau spesifik SBY / JOG)
  const otherBranches = branches.filter((b) => b.code !== "JKT" && b.code !== "PUSAT")
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all")
  const [showTaskModal, setShowTaskModal] = useState(false)

  // State form penugasan
  const [formBranchId, setFormBranchId] = useState<string>(otherBranches[0]?.id || "")
  const [formProjectId, setFormProjectId] = useState<string>("")
  const [formAssignedTo, setFormAssignedTo] = useState<string>("")
  const [targetPhone, setTargetPhone] = useState<string>("")

  // Filter projects & tasks sesuai tab
  const filteredProjects = projects.filter((p) => {
    if (selectedBranchId === "all") {
      return otherBranches.some((b) => b.id === p.branch_id)
    }
    return p.branch_id === selectedBranchId
  })

  const filteredTasks = tasks.filter((t) => {
    // Tugas yang berasal dari penugasan Jakarta atau berada di proyek cabang terpilih
    if (!t.title.includes("[Dari Jakarta") && !t.project_id) return true
    if (selectedBranchId === "all") return true
    const proj = projects.find((p) => p.id === t.project_id)
    return proj?.branch_id === selectedBranchId
  })

  // Update target phone saat staff dipilih
  function handleStaffChange(staffId: string) {
    setFormAssignedTo(staffId)
    const staff = staffList.find((s) => s.id === staffId)
    if (staff?.phone) {
      setTargetPhone(staff.phone)
    }
  }

  const selectedBranchName =
    branches.find((b) => b.id === formBranchId)?.name || "Cabang Terpilih"

  return (
    <section
      aria-label="Hub Pemantauan & Delegasi Tugas Cabang Jakarta"
      className="space-y-6 rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/40 via-white to-slate-50/50 p-6 shadow-sm dark:border-indigo-900/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950"
    >
      {/* Header Hub Jakarta */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-100 pb-5 dark:border-indigo-950">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
            <Compass size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                Hub Cabang Jakarta
              </span>
              <span className="text-xs text-muted">Pemantauan & Delegasi Multi-Cabang</span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-ink">
              Pusat Kendali & Penugasan Tugas ke Cabang Surabaya & Jogjakarta
            </h2>
          </div>
        </div>

        {canManage && (
          <Button
            type="button"
            onClick={() => setShowTaskModal(!showTaskModal)}
            className="gap-2 bg-indigo-600 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <PlusCircle size={15} />
            <span>Beri Instruksi Tugas Baru</span>
          </Button>
        )}
      </div>

      {/* Form Dialog / Drawer Pemberian Tugas Baru */}
      {showTaskModal && (
        <Card className="border-indigo-300 bg-white p-5 shadow-md dark:border-indigo-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Send size={15} className="text-indigo-600" />
              <span>Kirim Informasi / Instruksi Tugas dari Jakarta ke Cabang Lain</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowTaskModal(false)}
              className="text-xs text-muted hover:text-ink font-semibold"
            >
              Tutup ✕
            </button>
          </div>

          <form action={createCrossBranchTaskAction} className="mt-4 space-y-4">
            <input type="hidden" name="target_branch_name" value={selectedBranchName} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-ink">
                  Cabang Tujuan <span className="text-red-500">*</span>
                  <select
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                  >
                    {otherBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">
                  Proyek Terkait (Opsional)
                  <select
                    name="project_id"
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                  >
                    <option value="">-- Tanpa Proyek Spesifik --</option>
                    {projects
                      .filter((p) => !formBranchId || p.branch_id === formBranchId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} · {p.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink">
                  PIC Penerima Tugas di Cabang
                  <select
                    name="assigned_to"
                    value={formAssignedTo}
                    onChange={(e) => handleStaffChange(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                  >
                    <option value="">-- Pilih Karyawan Cabang (Atau delegasikan umum) --</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.phone ? `(${s.phone})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">
                  Nomor WhatsApp PIC (Notifikasi Otomatis)
                  <input
                    type="text"
                    name="target_phone"
                    value={targetPhone}
                    onChange={(e) => setTargetPhone(e.target.value)}
                    placeholder="08123456789"
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink">
                Judul Instruksi Tugas <span className="text-red-500">*</span>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="Contoh: Kirimkan laporan progres uji beban dan berita acara serah terima"
                  className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-ink">
                  Prioritas
                  <select
                    name="priority"
                    defaultValue="normal"
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                  >
                    <option value="low">Rendah</option>
                    <option value="normal">Normal</option>
                    <option value="high">Tinggi</option>
                    <option value="urgent">Mendesak / Urgent</option>
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">
                  Tenggat Waktu (Due Date)
                  <input
                    type="date"
                    name="due_on"
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink">
                Rincian Instruksi / Catatan Penting
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Tuliskan petunjuk teknis atau dokumen spesifik yang dibutuhkan..."
                  className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowTaskModal(false)}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700">
                <Send size={13} />
                <span>Kirimkan Instruksi Tugas</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Filter Tab Cabang */}
      <div className="flex border-b border-indigo-200/80 gap-2 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setSelectedBranchId("all")}
          className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs font-semibold transition ${
            selectedBranchId === "all"
              ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Building2 size={13} />
          <span>Semua Cabang Pantauan (Surabaya & Jogjakarta)</span>
        </button>

        {otherBranches.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelectedBranchId(b.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs font-semibold transition ${
              selectedBranchId === b.id
                ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <span>Cabang {b.name} ({b.code})</span>
          </button>
        ))}
      </div>

      {/* Ringkasan Proyek Cabang Aktif */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <FolderKanban size={14} className="text-indigo-600" />
            <span>Proyek Aktif dalam Pemantauan ({filteredProjects.length})</span>
          </h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.length ? (
            filteredProjects.map((p) => {
              const branch = branches.find((b) => b.id === p.branch_id)
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-line bg-white p-3.5 shadow-sm space-y-2 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      {p.code}
                    </span>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {branch?.name || "Cabang"}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-ink line-clamp-1">{p.name}</h4>
                  <p className="text-[11px] text-muted line-clamp-1">Klien: {p.client_name || "Klien Rekanan"}</p>
                </div>
              )
            })
          ) : (
            <div className="col-span-full rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">
              Tidak ada proyek aktif pada filter cabang ini.
            </div>
          )}
        </div>
      </div>

      {/* Antrean Tugas & Riwayat Instruksi Lintas Cabang */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <Clock size={14} className="text-indigo-600" />
          <span>Antrean & Status Tugas Cabang ({filteredTasks.length})</span>
        </h3>

        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-muted dark:bg-slate-800">
                <tr>
                  <th scope="col" className="p-3 font-semibold">Tugas / Instruksi</th>
                  <th scope="col" className="p-3 font-semibold">Prioritas</th>
                  <th scope="col" className="p-3 font-semibold">Tenggat</th>
                  <th scope="col" className="p-3 font-semibold">Status</th>
                  <th scope="col" className="p-3 text-right font-semibold">Aksi / Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredTasks.length ? (
                  filteredTasks.map((task) => {
                    const waMessage = `Halo rekan cabang, mengenai tugas "${task.title}" pada ERP GSP: mohon konfirmasi update progres pekerjaannya. Terima kasih.`
                    const waLink = generateWhatsAppLink("08123456789", waMessage)

                    return (
                      <tr key={task.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="p-3 max-w-xs">
                          <p className="font-medium text-ink line-clamp-1">{task.title}</p>
                          {task.description && (
                            <p className="text-[11px] text-muted line-clamp-1">{task.description}</p>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              task.priority === "urgent"
                                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                : task.priority === "high"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {task.priority}
                          </span>
                        </td>
                        <td className="p-3 text-muted">{task.due_on || "Fleksibel"}</td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              task.status === "done"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : task.status === "in_progress"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {task.status === "done"
                              ? "Selesai"
                              : task.status === "in_progress"
                              ? "Dikerjakan"
                              : "Menunggu"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Tombol WhatsApp Cepat */}
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Kirim pesan WhatsApp ke PIC"
                              className="rounded-lg border border-line p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                            >
                              <MessageSquare size={13} />
                            </a>

                            {/* Form Ganti Status Cepat */}
                            <form action={updateWorkItemStatusAction} className="inline-block">
                              <input type="hidden" name="task_id" value={task.id} />
                              <select
                                name="status"
                                defaultValue={task.status}
                                onChange={(e) => e.target.form?.requestSubmit()}
                                className="rounded border border-line bg-white p-1 text-[11px] text-ink dark:bg-slate-800"
                              >
                                <option value="todo">Menunggu</option>
                                <option value="in_progress">Dikerjakan</option>
                                <option value="done">Selesai</option>
                                <option value="blocked">Tertahan</option>
                              </select>
                            </form>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted">
                      Belum ada instruksi tugas lintas cabang.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
