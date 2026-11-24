"use client"

import React from "react"
import {
  User,
  Building2,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react"
import { Card } from "@/components/ui/card"

export interface PersonalProfileData {
  id?: string
  employeeNumber?: string | null
  fullName: string
  email: string
  jobTitle?: string | null
  department?: string | null
  employmentStatus?: string | null
  startedOn?: string | null
  branchName?: string | null
  roleLabel?: string | null
}

export function PersonalEmployeeProfile({ profile }: { profile: PersonalProfileData }) {
  return (
    <Card className="overflow-hidden border-line p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand to-blue-600 text-white font-bold text-xl shadow-md shadow-brand/20">
            {profile.fullName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-ink">{profile.fullName}</h2>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {profile.employmentStatus === "permanent"
                  ? "Karyawan Tetap"
                  : profile.employmentStatus === "contract"
                  ? "Karyawan Kontrak"
                  : "Karyawan Aktif"}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              {profile.jobTitle || "Staf Teknis"} · {profile.department || "Operasional"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-slate-50 px-3.5 py-2 text-right dark:bg-slate-900">
          <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">ID Karyawan / NIK</span>
          <span className="font-mono text-xs font-bold text-brand">
            {profile.employeeNumber || "GSP-EMP-2026"}
          </span>
        </div>
      </div>

      {/* Grid Informasi Data Diri */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-5 text-xs">
        <div className="space-y-1 rounded-xl bg-slate-50/60 p-3.5 dark:bg-slate-900">
          <span className="text-muted flex items-center gap-1.5 text-[11px]">
            <Mail size={13} className="text-brand" />
            <span>Alamat Email Perusahaan</span>
          </span>
          <p className="font-semibold text-ink truncate">{profile.email}</p>
        </div>

        <div className="space-y-1 rounded-xl bg-slate-50/60 p-3.5 dark:bg-slate-900">
          <span className="text-muted flex items-center gap-1.5 text-[11px]">
            <Building2 size={13} className="text-brand" />
            <span>Cabang Penempatan</span>
          </span>
          <p className="font-semibold text-ink">{profile.branchName || "Kantor Pusat / Jakarta"}</p>
        </div>

        <div className="space-y-1 rounded-xl bg-slate-50/60 p-3.5 dark:bg-slate-900">
          <span className="text-muted flex items-center gap-1.5 text-[11px]">
            <Briefcase size={13} className="text-brand" />
            <span>Peran Akses Sistem</span>
          </span>
          <p className="font-semibold text-ink">{profile.roleLabel || "Staf Operasional"}</p>
        </div>

        <div className="space-y-1 rounded-xl bg-slate-50/60 p-3.5 dark:bg-slate-900">
          <span className="text-muted flex items-center gap-1.5 text-[11px]">
            <Calendar size={13} className="text-brand" />
            <span>Tanggal Bergabung</span>
          </span>
          <p className="font-semibold text-ink">
            {profile.startedOn
              ? new Date(profile.startedOn).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "01 Januari 2026"}
          </p>
        </div>
      </div>
    </Card>
  )
}
