# AquaGrid Operator — mockup aplikasi

Mockup aplikasi operator untuk **AquaGrid C50**, jaringan generator air dari udara bertenaga surya untuk wilayah krisis air.
Dibuat berdasarkan proposal Tim SHANI (SMA Kolese Kanisius) untuk Business Plan Competition UI Innovation War 2026, terutama Lampiran A (Rancangan Produk) dan Lampiran B (Mockup Dasbor).

> Semua angka adalah **data simulasi**, bukan hasil pengukuran prototipe.

## Cara menjalankan

Buka `index.html` langsung di browser. Tidak perlu instalasi atau server.
Website tampil penuh layar dan responsif: tata letak beberapa kolom di desktop, satu kolom di ponsel.

## Fitur

| Layar | Isi |
|---|---|
| Masuk | Halaman masuk operator; lokasi diganti lewat pemilih di header (3 lokasi demo dengan kondisi berbeda) |
| Dasbor | Bagian atas mengikuti Lampiran B: produksi hari ini, status pengolahan, uji laboratorium, riwayat produksi 7 hari, tindakan operator. Di bawahnya ringkasan hari ini, tangki, modul, energi, aktivitas, dan semua lokasi |
| Modul | 10 modul sorpsi dengan sisa umur kartrid, data energi (kolektor panas, PV, baterai), riwayat servis |
| Servis kartrid | 6 langkah servis lapangan; kartrid lama disegel dan diberi kode pengembalian (strategi sirkular) |
| Distribusi | Catat volume pengambilan per rumah tangga; **diblokir** jika uji lab belum lulus atau pengolahan bermasalah |
| Pembayaran | Pilih volume → tarif sosial Rp500/L + dukungan sponsor → tunai/kanal setempat → bukti pembayaran (bisa dicetak) |
| Hasil laboratorium | Unggah hasil mikrobiologi & kimia; menentukan apakah air boleh diklaim aman |
| Laporan gangguan | Warga melapor melalui operator; laporan bisa ditutup |
| Sinkronisasi | Tombol Online/Offline di header untuk simulasi jaringan putus; data antre lokal lalu dikirim ulang |
| Rancangan C50 | Diagram Lampiran A (bisa diklik untuk penjelasan), angka rencana, dan model bisnis |

Prinsip utama tampilan: **volume produksi dipisahkan dari status keamanan air** — sensor normal tidak otomatis berarti air aman diminum.

Data disimpan di `localStorage` browser. Menu *Lainnya → Atur ulang data simulasi* mengembalikan kondisi awal.

## File

- `index.html` — kerangka halaman dan ikon SVG
- `app.css` — tampilan
- `app.js` — data simulasi, layar, dan logika
