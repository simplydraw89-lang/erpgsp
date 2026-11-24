"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireWorkspace } from "@/lib/auth/context"
import { sendWhatsAppNotification, generateWhatsAppLink } from "@/lib/notifications/service"

export async function createCrossBranchTaskAction(formData: FormData) {
  const { supabase, organizationId, user, isReadOnlyPreview } = await requireWorkspace()

  if (isReadOnlyPreview) {
    redirect("/pekerjaan-saya?error=" + encodeURIComponent("Mode lihat saja: pemberian tugas dinonaktifkan."))
  }

  const title = String(formData.get("title") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const priority = String(formData.get("priority") ?? "normal")
  const dueOn = String(formData.get("due_on") ?? "").trim() || null
  const projectId = String(formData.get("project_id") ?? "").trim() || null
  const assignedTo = String(formData.get("assigned_to") ?? "").trim() || null
  const targetBranchName = String(formData.get("target_branch_name") ?? "Cabang")
  const targetPhone = String(formData.get("target_phone") ?? "").trim()

  if (!title) {
    redirect("/pekerjaan-saya?error=" + encodeURIComponent("Judul instruksi tugas wajib diisi."))
  }

  const { data: inserted, error } = await supabase
    .from("operational_work_items")
    .insert({
      organization_id: organizationId,
      project_id: projectId,
      title: `[Dari Jakarta ke ${targetBranchName}] ${title}`,
      description: description || null,
      priority,
      due_on: dueOn,
      assigned_to: assignedTo,
      created_by: user.id,
      status: "todo",
    })
    .select("id")
    .single()

  if (error) {
    redirect("/pekerjaan-saya?error=" + encodeURIComponent(`Gagal menyimpan instruksi tugas: ${error.message}`))
  }

  // Jika ada nomor telepon penerima tugas, kirimkan notifikasi WhatsApp otomatis
  if (targetPhone) {
    const message = `📋 *Instruksi Tugas Baru dari Cabang Jakarta*\n\n*Judul:* ${title}\n*Prioritas:* ${priority.toUpperCase()}\n*Tenggat:* ${dueOn || "Fleksibel"}\n*Keterangan:* ${description || "-"}\n\nSilakan cek portal ERP GSP (Pekerjaan Saya) untuk melihat rincian pekerjaan.`
    await sendWhatsAppNotification({
      phone: targetPhone,
      message,
    })
  }

  revalidatePath("/pekerjaan-saya")
  redirect("/pekerjaan-saya?notice=" + encodeURIComponent(`Instruksi tugas untuk ${targetBranchName} berhasil dikirim.`))
}

export async function updateWorkItemStatusAction(formData: FormData) {
  const { supabase, organizationId, isReadOnlyPreview } = await requireWorkspace()

  if (isReadOnlyPreview) {
    redirect("/pekerjaan-saya?error=" + encodeURIComponent("Mode lihat saja: perubahan status dinonaktifkan."))
  }

  const id = String(formData.get("task_id") ?? "").trim()
  const nextStatus = String(formData.get("status") ?? "todo")

  if (!id) {
    redirect("/pekerjaan-saya?error=" + encodeURIComponent("ID tugas tidak valid."))
  }

  const { error } = await supabase
    .from("operational_work_items")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    redirect("/pekerjaan-saya?error=" + encodeURIComponent(`Gagal memperbarui status: ${error.message}`))
  }

  revalidatePath("/pekerjaan-saya")
  redirect("/pekerjaan-saya?notice=" + encodeURIComponent("Status tugas berhasil diperbarui."))
}
