"use client"

import React, { useState } from "react"
import { Sliders, BellRing, KeyRound } from "lucide-react"
import { ThemeSettingsView } from "@/components/settings/theme-settings-view"
import { NotificationSettingsView } from "@/components/settings/notification-settings-view"
import { GoogleAuthSettingsView } from "@/components/settings/google-auth-settings-view"

interface SettingsTabShellProps {
  userName: string
  email: string
  roleLabel: string
  organizationName: string
}

export function SettingsTabShell({
  userName,
  email,
  roleLabel,
  organizationName,
}: SettingsTabShellProps) {
  const [activeTab, setActiveTab] = useState<"theme" | "notifications" | "google">("theme")

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-line gap-2 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("theme")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === "theme"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <Sliders size={14} />
          <span>Tampilan & Tema</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("notifications")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === "notifications"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <BellRing size={14} />
          <span>Notifikasi Email & WhatsApp</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("google")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === "google"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <KeyRound size={14} />
          <span>Login via Google</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "theme" && (
        <ThemeSettingsView
          userName={userName}
          email={email}
          roleLabel={roleLabel}
          organizationName={organizationName}
        />
      )}

      {activeTab === "notifications" && <NotificationSettingsView />}

      {activeTab === "google" && <GoogleAuthSettingsView />}
    </div>
  )
}
