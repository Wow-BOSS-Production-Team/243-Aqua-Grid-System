# AquaGrid Operator — mockup aplikasi

Mockup aplikasi operator untuk **AquaGrid C50**, jaringan generator air dari udara bertenaga surya untuk wilayah krisis air.
Dibuat berdasarkan proposal Tim SHANI (SMA Kolese Kanisius) untuk Business Plan Competition UI Innovation War 2026, terutama Lampiran A (Rancangan Produk) dan Lampiran B (Mockup Dasbor).

> Semua angka adalah **data simulasi**, bukan hasil pengukuran prototipe.

## Cara menjalankan

Buka `index.html` langsung di browser. Tidak perlu instalasi atau server.
Di layar lebar tampil dalam bingkai ponsel; di ponsel tampil penuh layar.

## Fitur

| Layar | Isi |
|---|---|
| Masuk & pilih lokasi | Operator masuk lalu memilih sistem C50 (3 lokasi demo dengan kondisi berbeda) |
| Dasbor | Produksi hari ini vs target 50 L, tangki, status pengolahan (interlock & sensor), uji laboratorium, riwayat 7 hari, tindakan operator |
| Modul | 10 modul sorpsi dengan sisa umur kartrid, data energi (kolektor panas, PV, baterai), riwayat servis |
| Servis kartrid | 6 langkah servis lapangan; kartrid lama disegel dan diberi kode pengembalian (strategi sirkular) |
| Distribusi | Catat volume pengambilan per rumah tangga; **diblokir** jika uji lab belum lulus atau pengolahan bermasalah |
| Pembayaran | Pilih volume → tarif sosial Rp500/L + dukungan sponsor → tunai/kanal setempat → bukti pembayaran |
| Hasil laboratorium | Unggah hasil mikrobiologi & kimia; menentukan apakah air boleh diklaim aman |
| Laporan gangguan | Warga melapor melalui operator; laporan bisa ditutup |
| Sinkronisasi | Tombol Online/Offline untuk simulasi jaringan putus; data antre lokal lalu dikirim ulang |
| Rancangan C50 | Alur energi → modul → kondensasi → pengolahan → tangki, plus angka rencana |

Prinsip utama tampilan: **volume produksi dipisahkan dari status keamanan air** — sensor normal tidak otomatis berarti air aman diminum.

Data disimpan di `localStorage` browser. Menu *Lainnya → Atur ulang data simulasi* mengembalikan kondisi awal.

## File

- `index.html` — kerangka halaman dan ikon SVG
- `app.css` — tampilan
- `app.js` — data simulasi, layar, dan logika
