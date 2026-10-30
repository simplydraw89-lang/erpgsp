import { Card } from "@/components/ui/card"
import { NavigationLink as Link } from "@/components/ui/navigation-link"

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-semibold text-brand">Bantuan workspace</p>
        <h1 className="mt-2 text-3xl font-bold">Panduan ERP GSP</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Mulai dari aplikasi yang sesuai pekerjaan Anda. Setiap perubahan
          mengikuti kewenangan dan pemeriksaan perusahaan.
        </p>
      </div>
      <Card className="p-6">
        <h2 className="text-lg font-semibold">
          Membuat dan mengajukan dokumen
        </h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted">
          <li>
            Buka modul dari beranda, isi data, lalu pilih{" "}
            <strong>Simpan draft</strong>.
          </li>
          <li>
            Periksa isi tersimpan pada detail dokumen. Gunakan{" "}
            <strong>Edit draft</strong> bila ada perubahan, lalu simpan.
          </li>
          <li>
            Pilih <strong>Ajukan pemeriksaan</strong>. Setelah diajukan, isi dan
            versinya terkunci.
          </li>
          <li>
            Pemeriksa yang ditentukan kebijakan membaca dokumen dan memberi
            catatan persetujuan atau penolakan. Pengaju tidak dapat memeriksa
            sendiri.
          </li>
          <li>
            Setelah disetujui, pilih <strong>Eksekusi</strong> agar perubahan
            masuk ke daftar resmi. Dokumen ditolak dapat direvisi dan diajukan
            ulang.
          </li>
        </ol>
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-semibold">Memantau aset</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Buka Assets untuk melihat lokasi, penanggung jawab, kondisi, status,
            dan nilai perolehan. Gunakan Usulkan perubahan untuk perpindahan
            atau pembaruan data aset.
          </p>
          <Link
            href="/modul/asset"
            className="mt-4 inline-block text-sm font-semibold text-brand"
          >
            Buka Assets →
          </Link>
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold">Mengelola tagihan pembayaran</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Catat tagihan keluar beserta penerima, nilai dan jatuh temponya.
            Tagihan baru dimulai sebagai belum lunas. Untuk menandai lunas,
            usulkan perubahan dengan tanggal dan metode pembayaran lalu ajukan
            pemeriksaan. Tagihan lewat jatuh tempo ditandai otomatis.
          </p>
          <Link
            href="/modul/pembayaran"
            className="mt-4 inline-block text-sm font-semibold text-brand"
          >
            Buka Pembayaran â†’
          </Link>
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold">Menemukan aplikasi</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Beranda mengelompokkan aplikasi berdasarkan bidang kerja. Gunakan
            pencarian atau Ctrl+K untuk mencari aplikasi. Menu kubus membuka
            daftar aplikasi; menu akun menyediakan informasi peran dan tombol
            keluar.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm font-semibold text-brand"
          >
            Kembali ke beranda →
          </Link>
        </Card>
      </div>
      <Card className="p-6">
        <h2 className="font-semibold">Jika pengajuan belum bisa dikirim</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Pastikan ada anggota lain yang memiliki peran pemeriksa sesuai
          kebijakan. Administrator sistem dapat menyesuaikan pemeriksa dan batas eskalasi.
          Akses modul yang belum tersedia untuk peran Anda perlu dibicarakan
          dengan administrator perusahaan.
        </p>
        <Link
          href="/pengaturan/persetujuan"
          className="mt-4 inline-block text-sm font-semibold text-brand"
        >
          Lihat kebijakan persetujuan →
        </Link>
      </Card>
    </div>
  )
}
