# Rencana Migrasi Web Customer ke Laravel

## Tujuan

Memindahkan **web Customer (CS/customer-facing website)** dari backend Python bawaan ke Laravel tanpa mengubah UI, alur pengguna, maupun hasil bisnis yang sudah berjalan. Database MySQL pusat tetap menjadi sumber data bersama.

Rencana ini tidak memigrasikan Operator App desktop, EXE kasir/operator, atau dashboard Python. Selama masa transisi, komponen tersebut tetap berjalan dan mengakses database yang sama.

## Kondisi awal yang teridentifikasi

- Web Customer berada di `apps/customer/`: halaman HTML, CSS, JavaScript, aset produk, dan backend Python.
- Backend Customer menyajikan frontend dan API pada satu origin. API meliputi katalog/promo, order, pembayaran Midtrans, chat, lokasi, administrasi katalog, notifikasi/dashboard order, dan produksi.
- Data Customer tersimpan di MySQL `fazima_print_customer`, yang juga digunakan komponen Python lain.
- Proses layout memakai Python dan ImageMagick untuk validasi file, konversi, preview, dan output cetak. Sebagian file bersifat sementara; layout order tertentu disimpan untuk dipakai pada workflow berikutnya.
- Integrasi eksternal mencakup Midtrans, Gemini, Firebase config/auth frontend, dan reverse geocoding lokasi.
- Database telah memiliki tabel order, order item, payment, product, category, promotion, notification, layout job, production, material usage, dan chat. Ada beberapa skrip migrasi historis yang perlu direkonsiliasi sebelum deployment.

## Keputusan arsitektur

1. Laravel menjadi web server dan backend utama untuk web Customer: halaman, API, validasi, koneksi MySQL, order, katalog, promo, pembayaran, chat, dan administrasi web.
2. Frontend yang ada dipakai kembali terlebih dahulu. HTML/CSS/JavaScript dan aset dipindahkan atau disajikan dari `public/` dengan URL dan urutan stylesheet yang tetap. Jangan melakukan redesign bersamaan dengan migrasi backend.
3. Kontrak endpoint lama dipertahankan pada tahap awal, termasuk URL, metode HTTP, bentuk request/response, status error, serta URL file preview/download. Frontend tidak perlu dirombak untuk berpindah backend.
4. MySQL pusat tetap dipakai. Tahap awal **tidak mengganti nama tabel, menghapus kolom, atau mengimpor ulang seed**. Laravel dipetakan ke skema aktual yang sudah ada.
5. Pemrosesan prepress tetap di Python/ImageMagick pada layanan internal terpisah. Laravel memanggilnya melalui jaringan privat/API internal dengan autentikasi layanan; server Python tidak diekspos langsung ke publik. Jangan menulis ulang algoritme prepress sebagai bagian dari migrasi awal.
6. Backend Python yang sekarang dipertahankan selama cutover sebagai jalur rollback. Rute CS hanya boleh dilayani oleh satu backend aktif pada satu waktu agar tidak terjadi perilaku berbeda.

## Cakupan

### Termasuk

- Halaman CS: home, about, katalog, detail produk, form order, cart, payment, login/customer entry, dan riwayat order yang ada.
- API publik: health, katalog, kategori, lokasi, order, status order, konfigurasi/status pembayaran, Snap token, dan webhook Midtrans.
- API admin website yang digunakan untuk kategori, produk, promo, hero image, visual kategori, serta timer promo.
- Chat AI server-side, penyimpanan percakapan jika aktif, dan konfigurasi Firebase yang memang diperlukan frontend.
- Upload, preview, unduh layout, dan penyimpanan berkas order dengan Python prepress sebagai layanan terpisah.
- Alur order web menuju notifikasi dashboard/kasir yang sudah terhubung ke database bersama.

### Di luar cakupan migrasi ini

- UI dan backend Operator App desktop serta pembuatan EXE.
- Migrasi dashboard Operator/Kasir Python ke Laravel.
- Perubahan desain, fitur, aturan harga, alur pembayaran, atau restrukturisasi database yang tidak diperlukan untuk kompatibilitas.
- Penggantian Midtrans, Gemini, Firebase, atau ImageMagick.

## Tahapan kerja

### 1. Bekukan acuan perilaku saat ini

- Buat daftar semua halaman, interaksi, validasi form, state loading/error, responsive behavior, dan request API dari frontend Customer.
- Ekstrak kontrak lengkap setiap route dari `apps/customer/backend.py`: method, auth/otorisasi, validasi input, response sukses/gagal, batas ukuran upload, serta efek database/file.
- Catat alur end-to-end: katalog → detail → spesifikasi/upload → cart → checkout → Midtrans/webhook → order masuk dashboard.
- Dokumentasikan perilaku reverse geocoding, auto-fill, pengiriman, detail alamat, serta order yang dibuat melalui CS/admin.
- Simpan contoh request/response aman tanpa kredensial atau data pribadi produksi sebagai acuan kompatibilitas.

**Hasil:** spesifikasi perilaku dan route parity yang dapat ditinjau sebelum implementasi.

### 2. Persiapan Laravel dan lingkungan deployment

- Buat aplikasi Laravel baru di direktori terpisah, dengan versi Laravel/PHP yang cocok dengan hosting target.
- Konfigurasi document root ke `public/`; jangan menyajikan root proyek yang berisi `.env`, source, atau dependency.
- Siapkan konfigurasi environment untuk MySQL, URL aplikasi, Midtrans, Gemini, Firebase, penyimpanan file, dan layanan prepress.
- Pastikan koneksi keluar HTTPS, ekstensi PHP yang dibutuhkan, izin tulis `storage/` dan `bootstrap/cache`, serta batas upload cukup untuk file desain.
- Siapkan URL staging dan salinan database staging yang terisolasi; secret produksi tidak digunakan di staging.

### 3. Bawa UI tanpa mengubah tampilannya

- Pindahkan halaman, stylesheet, JavaScript, font, gambar, dan aset lain ke struktur publik Laravel dengan mempertahankan nama/urutan file terlebih dahulu.
- Pastikan routing URL halaman lama tetap bekerja, termasuk query string yang dipakai detail produk/order.
- Pertahankan satu origin untuk halaman dan `/api/*`, agar fetch, cookie/session, CORS, dan URL callback tidak berubah tanpa alasan.
- Pertahankan ukuran, nama field, dan batas file upload serta mekanisme penyajian aset/preview.
- Bandingkan tampilan desktop dan mobile terhadap aplikasi lama pada viewport dan state yang sama sebelum backend diganti.

### 4. Implementasi API Laravel secara kompatibel

- Buat routes/controllers/service layer terpisah berdasarkan domain: catalog, checkout/orders, payments, location, chat, website admin, dan dashboard integration.
- Pindahkan validasi bisnis ke Laravel Form Requests/services; jangan hanya menyalin validasi browser.
- Gunakan transaksi database untuk pembuatan order beserta item, pembayaran, audit/notifikasi yang terkait.
- Jadikan webhook Midtrans aman dan idempotent: verifikasi signature/status, validasi nilai/status, dan cegah notifikasi ulang membuat transaksi ganda.
- Simpan semua secret hanya pada environment server/secret store; server key Midtrans dan API key Gemini tidak boleh masuk bundle frontend atau log.
- Batasi dan validasi input admin. Terapkan autentikasi/otorisasi server untuk route admin; jangan menganggap login demo/frontend sebagai proteksi API.
- Terapkan rate limit dan batas body untuk chat, reverse geocoding, checkout, serta endpoint upload.

### 5. Pisahkan prepress Python

- Tentukan kontrak internal untuk membuat layout: input file, produk/ukuran/finishing, opsi sticker/shape, order terkait, dan response token/preview/output.
- Pindahkan fungsi prepress dari handler web ke service Python internal yang mempertahankan `prepress_engine.py`, ImageMagick, Ghostscript/font bila diperlukan, dan algoritme yang ada.
- Laravel mengirim berkas ke service tersebut melalui channel privat; gunakan autentikasi antar-service, timeout, validasi ukuran/MIME, dan batas konkurensi.
- Tentukan penyimpanan bersama untuk upload sementara, preview, output, dan file order yang harus bertahan. Untuk beberapa instance/server, gunakan object storage atau volume persisten bersama; jangan mengandalkan disk ephemeral.
- Pertahankan TTL cleanup untuk berkas sementara dan aturan retensi file yang melekat pada order.
- Bila hosting target tidak dapat menjalankan layanan Python/ImageMagick, tempatkan prepress pada service/container terpisah. Jangan menghapus fitur layout hanya untuk menyesuaikan hosting.

### 6. Pemetaan database dan kompatibilitas lintas aplikasi

- Cocokkan model Laravel dengan skema database aktual, termasuk tabel/kolom yang berasal dari migrasi lama.
- Buat baseline dokumentasi skema. Hindari menjalankan `migrate:fresh`, seed ulang, atau migrasi yang menjatuhkan/mengganti data produksi.
- Pertahankan format order number, status, enum/string, relasi order item, shipping/location fields, payment identifiers, dan timestamp yang dipakai dashboard Python.
- Beri Laravel database user terpisah dengan hak minimum yang diperlukan. Kunci akses MySQL jaringan hanya untuk host aplikasi yang disetujui.
- Perubahan skema harus backward-compatible: tambah kolom nullable/default terlebih dahulu, deploy code yang memahami kolom baru, lalu baru pertimbangkan penghapusan kolom lama setelah semua klien Python diperbarui.
- Jalankan migration database satu kali melalui proses deployment/admin, bukan saat setiap komputer atau request pengguna membuka aplikasi.
- Periksa timezone dan charset/collation agar harga, waktu promo, pencarian, emoji/nama lokasi, dan teks Indonesia konsisten.

### 7. Pengujian kompatibilitas dan penerimaan

- Jalankan perbandingan kontrak API lama vs Laravel untuk semua route dalam daftar inventaris.
- Uji flow browser utama pada desktop/mobile: katalog dan promo, cari/filter, detail produk, upload/layout, lokasi dan detail alamat, metode kirim, checkout, status order.
- Uji callback Midtrans sandbox, signature tidak valid, callback duplikat, status gagal/pending/berhasil, dan pembaruan order dashboard.
- Uji endpoint admin dengan akses sah/tanpa akses, input invalid, serta pastikan secret tidak dikirim ke browser.
- Uji prepress dengan sampel JPG/PNG/PDF dan kasus sticker/produk khusus; cocokkan dimensi, jumlah, warna, preview, dan output dengan hasil lama.
- Verifikasi order CS/web terlihat satu kali pada dashboard/kasir Python dan perubahan status tetap terbaca kedua sisi.
- Lakukan visual regression desktop/mobile pada halaman lama dan Laravel; perbaiki selisih sebelum cutover.
- Uji backup/restore dan prosedur rollback menggunakan lingkungan staging.

### 8. Cutover bertahap dan rollback

1. Deploy Laravel dan prepress service ke staging, gunakan salinan skema/data yang representatif.
2. Selesaikan pemeriksaan kontrak, UI, order/pembayaran sandbox, dashboard Python, dan log/error.
3. Siapkan backup database dan file sebelum cutover; pastikan backup dapat dipulihkan.
4. Alihkan domain CS ke Laravel. Pertahankan URL API yang sama dan jangan jalankan dua backend yang menerima checkout pada route publik bersamaan.
5. Pantau health check, error log, koneksi MySQL, webhook Midtrans, performa upload, dan order yang masuk ke dashboard.
6. Jika ada masalah kritis, arahkan domain kembali ke backend Python dan pulihkan versi database hanya jika perubahan skema memang tidak backward-compatible. Utamakan schema changes yang tidak memerlukan restore data.
7. Hapus backend Python Customer lama hanya setelah periode stabilitas yang disepakati dan seluruh jalur rollback tidak lagi dibutuhkan.

## Peta domain dan route yang harus diinventarisasi

Daftar ini berasal dari route backend saat ini; kontrak final harus diambil dari setiap handler dan pemanggil frontend sebelum implementasi.

| Domain | Route/kemampuan yang ada |
|---|---|
| Health/config | `/api/health`, `/api/firebase-config`, `/api/payments/config` |
| Catalog/site content | `/api/products`, `/api/catalog`, `/api/categories`, hero images, category visuals, promo settings |
| Customer/location | reverse geocoding `/api/location/reverse`, order lookup/history, order create |
| Checkout/payment | `/api/orders`, `/api/payments/snap-token`, `/api/payments/notification`, `/api/payments/status/{order_id}` |
| Layout/prepress | `POST /api/layouts`, preview/output file routes, saved order layout |
| Chat | `/api/chat`, chat sessions and session messages |
| Website admin | CRUD category/product/promotion, hero/category visuals, promo timer settings |
| Dashboard handoff | dashboard orders/detail/layout/notifications/read, manual orders, setting/cashier decisions, transfer to cashier |
| Production | production list/start/complete, production usage read/write |

Route dashboard/produksi dicantumkan karena backend Customer saat ini menyediakan route tersebut dan data terkait dikonsumsi komponen Python. Sebelum memigrasikan domain itu, pastikan apakah target migrasi memang mencakupnya atau Laravel cukup menjaga kontraknya/berbagi database.

## Risiko dan cara menanganinya

| Risiko | Penanganan |
|---|---|
| UI bergeser saat perpindahan asset atau routing | Reuse aset, urutan CSS dan JS, serta visual comparison sebelum cutover. |
| Bentuk response Laravel berbeda dari yang diharapkan frontend/dashboard | Pertahankan kontrak lama dan uji route parity. |
| Python dashboard membaca status/skema berbeda | Pertahankan kolom/status/order identifier dan gunakan schema changes backward-compatible. |
| Order/payment tercatat ganda atau status tidak sinkron | DB transactions, idempotency, webhook signature validation, dan uji callback duplikat. |
| File upload hilang saat deploy/restart | Storage persisten/shared, TTL cleanup terkontrol, backup untuk file order permanen. |
| Hosting bersama tidak mendukung ImageMagick/Python worker atau batas upload cukup | Pisahkan prepress ke host/container yang mendukungnya; cek kemampuan hosting sebelum memilih target. |
| Endpoint admin lama tidak memiliki kontrol server memadai | Tambahkan auth/authorization/rate limit tanpa mengekspos secret; jangan bergantung pada UI hide/show. |
| Cutover memutus checkout berjalan | Deploy staging, backup, alihkan saat siap, monitor, serta pertahankan rollback ke backend lama. |

## Kriteria selesai

- Seluruh halaman CS berfungsi dengan tampilan desktop/mobile yang setara dengan baseline.
- Semua route yang digunakan frontend mempertahankan kontrak atau punya perubahan yang disetujui dan dikoordinasikan.
- Order, item, lokasi/alamat, metode pengiriman, pembayaran, dan notifikasi tersimpan sekali di MySQL pusat.
- Order dari web terlihat benar di dashboard/kasir Python dan perubahan status di sana tetap konsisten.
- Pemrosesan layout, preview, output, cleanup, dan retensi file bekerja setara dengan layanan lama.
- Midtrans webhook, chat, lokasi, serta konfigurasi eksternal hanya memakai secret server-side.
- Prosedur deployment, backup, migrasi DB, pemantauan, dan rollback terdokumentasi serta telah dicoba pada staging.

## Urutan implementasi yang disarankan

1. Selesaikan inventory perilaku/API dan cek skema produksi tanpa mengubah data.
2. Siapkan aplikasi Laravel dan staging; tampilkan frontend lama melalui Laravel tanpa mengubah UI.
3. Migrasikan katalog, konten, dan baca-only API dahulu.
4. Migrasikan cart/order dan pastikan integrasi dengan dashboard Python.
5. Migrasikan payment dan webhook setelah order parity terbukti.
6. Pisahkan dan sambungkan prepress service, lalu migrasikan admin/chat/lokasi.
7. Jalankan acceptance, cutover terbatas, monitor, lalu cutover penuh.

**Catatan:** dokumen ini adalah rencana kerja, bukan perubahan aplikasi atau database. Implementasi sebaiknya dimulai setelah hosting tujuan, versi PHP/Laravel, akses staging, dan kepemilikan proses deployment dipastikan.
