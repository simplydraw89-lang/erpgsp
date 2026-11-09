/**
 * Konversi angka rupiah ke teks terbilang Bahasa Indonesia resmi
 * Contoh: 150000000 -> "Seratus Lima Puluh Juta Rupiah"
 */
export function terbilang(n: number): string {
  const nominal = Math.abs(Math.floor(n))
  if (nominal === 0) return "Nol Rupiah"

  const satuan = [
    "",
    "Satu",
    "Dua",
    "Tiga",
    "Empat",
    "Lima",
    "Enam",
    "Tujuh",
    "Delapan",
    "Sembilan",
    "Sepuluh",
    "Sebelas",
  ]

  function bilangan(x: number): string {
    if (x < 12) {
      return satuan[x]
    } else if (x < 20) {
      return bilangan(x - 10) + " Belas"
    } else if (x < 100) {
      return bilangan(Math.floor(x / 10)) + " Puluh " + bilangan(x % 10)
    } else if (x < 200) {
      return "Seratus " + bilangan(x - 100)
    } else if (x < 1000) {
      return bilangan(Math.floor(x / 100)) + " Ratus " + bilangan(x % 100)
    } else if (x < 2000) {
      return "Seribu " + bilangan(x - 1000)
    } else if (x < 1000000) {
      return bilangan(Math.floor(x / 1000)) + " Ribu " + bilangan(x % 1000)
    } else if (x < 1000000000) {
      return bilangan(Math.floor(x / 1000000)) + " Juta " + bilangan(x % 1000000)
    } else if (x < 1000000000000) {
      return bilangan(Math.floor(x / 1000000000)) + " Miliar " + bilangan(x % 1000000000)
    } else {
      return bilangan(Math.floor(x / 1000000000000)) + " Triliun " + bilangan(x % 1000000000000)
    }
  }

  const hasil = bilangan(nominal).replace(/\s+/g, " ").trim()
  return `${hasil} Rupiah`
}
