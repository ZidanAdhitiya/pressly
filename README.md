# Fazima Print — Project Handoff

> Baca dokumen ini sebelum mengubah code. Ini adalah sumber konteks utama untuk agent berikutnya.

## 1. Identitas dan batas project

Project ini adalah workspace prepress percetakan bernama **Fazima Print**. Repository memiliki dua aplikasi berbeda:

1. **Operator app** di root repository: aplikasi lokal untuk operator, input order manual, layout fisik nyata, ImageMagick, SQLite, storage, riwayat, dan dashboard.
2. **Customer app** di apps/customer/: aplikasi customer terpisah dengan katalog, detail pesanan, upload, preview, cart, login demo, checkout demo, alamat/lokasi, dan chat CS AI demo.

Jangan mencampur customer app ke operator app atau executable operator. Operator tetap local/operator-first; customer service sengaja ephemeral dan tidak memakai database operator.

Nama visible saat ini Fazima Print. Environment variable lama PRESSLY_*, pressly.db, folder data desktop Pressly, spec Pressly.spec, dan log pressly-startup.log dipertahankan untuk kompatibilitas teknis/data lama. Jangan mengganti nama internal tanpa migrasi.

## 2. Status implementasi

### Sudah ada

- Operator backend standard-library Python + SQLite.
- Customer backend standard-library Python + ImageMagick.
- Produk: Banner, X-Banner, Spanduk, Sticker, Poster, Kartu Nama.
- Preset/custom size dengan unit cm, mm, m pada operator; customer memiliki width, height, unit terpisah.
- Finishing Matik, Selongsong, Roll Banner; customer hanya menampilkan finishing untuk Banner, X-Banner, Spanduk.
- Output layout aktual dengan canvas fisik, stretch sesuai ukuran, optional 2x Lanczos/sharpening, colorspace, density, guide line, dan finishing allowance.
- Customer preview memakai output layout aktual, bukan foto mockup.
- Customer katalog, halaman order terpisah, quantity, summary, upload JPG/JPEG/PNG/PDF sampai 50 MB, cart browser, login demo, chat demo, checkout demo.
- Cart memiliki mode ambil di toko/diantar. Mode diantar menampilkan address; geolocation menyimpan koordinat pada locked read-only box.
- Cosmic dark UI menyeluruh: navy-black, gradient indigo/gold, cyan heading, gold CTA, starfield/constellation, glow, pill controls, glass cards, custom dropdown, responsive styling.
- Sticker packing otomatis dengan gap 0,3 cm: 10x10 cm menghasilkan A4 = 4 pcs dan A3 = 8 pcs. Tidak ada input jumlah pcs per lembar.
- Sticker Bulat memakai alpha circle mask. Sticker Custom meminta PNG background transparan sehingga kontur file dipakai sebagai bentuk visual.
- Harga demo sticker A4 Rp15.000/lembar dan A3 Rp30.000/lembar. Produk non-sticker memakai tarif demo per m2 di frontend.
- Public demo pernah dijalankan dengan Cloudflare Quick Tunnel dari laptop dan multipart upload publik berhasil.

### Belum production-ready

- Login belum autentikasi/server account.
- Chat belum memanggil AI; respons lokal placeholder.
- Checkout/payment hanya simulasi; tidak ada payment gateway atau order submission nyata.
- Cart hanya localStorage; tidak ada customer order database.
- Customer job temporary dan kadaluarsa sekitar 30 menit.
- Quick Tunnel sementara; URL berubah/mati jika proses tunnel atau laptop mati.
- Belum ada domain permanen, auth, rate limit, CSRF, notification, payment, persistent order, dan observability.
- Native Windows executable belum divalidasi final di Windows native.
- Cutting path sticker, business-card imposition, bleed product-specific, dan aturan print-house lanjutan belum ada.

## 3. Struktur lengkap

    project001try/
    ├── README.md                         handoff ini
    ├── backend.py                        backend operator + SQLite API
    ├── app.js                            JavaScript form operator
    ├── index.html                        halaman buat layout operator
    ├── styles.css                        CSS operator
    ├── dashboard.html                    dashboard operator
    ├── dashboard.js                      JavaScript dashboard
    ├── prepress_engine.py                engine layout ImageMagick bersama
    ├── worker.py                         compatibility entry point; tidak ada queue
    ├── maintenance.py                    backup/retention operator
    ├── launcher.py                       desktop/PyInstaller entry point
    ├── Pressly.spec                      spec PyInstaller operator
    ├── build_windows.ps1                 script build Windows
    ├── Dockerfile.customer               image deployment customer
    ├── render.yaml                       Render blueprint customer
    ├── modal.css                         modal CSS operator
    ├── ui-overrides.css                  override kecil operator
    ├── docs/Dokumentasi_Sistem_Prepress_Percetakan.docx
    └── apps/customer/
        ├── backend.py                    backend customer ephemeral
        ├── app.js                        semua logic customer
        ├── index.html                    home/catalog
        ├── order.html                    detail/upload/preview
        ├── cart.html                     cart/checkout demo
        ├── login.html                    login demo
        ├── styles.css                    base CSS customer lama
        ├── theme-fixes.css               dark/accessibility fixes
        ├── cosmic-theme.css              visual theme Fazima Print
        ├── custom-select.css             dropdown non-native
        ├── layout-fixes.css              custom size/finishing
        ├── cart-fixes.css                address/location/cart
        ├── mockups.css                   mockup CSS legacy
        └── assets/mockups/
            ├── banner.png
            ├── kartu-nama.png
            ├── poster.png
            ├── spanduk.png
            ├── sticker.png
            └── x-banner.png

Runtime/generated: pressly.db, storage/, backup/, graphify-out/, __pycache__/. Semuanya bukan source feature. .gitignore mengabaikan database, storage, backup, pycache, graph output, build, dist, dan Windows artifacts.

## 4. Operator app

Jalankan dari root dengan python3 backend.py. Default bind 127.0.0.1:8080. backend.py menjalankan init_db(), membuat pressly.db/storage, lalu ThreadingHTTPServer. Frozen build memakai PRESSLY_DATA_DIR atau folder data OS.

index.html menampilkan form; root app.js memuat product/preset, drag/drop, dan mengirim POST /api/layouts. backend.py memvalidasi multipart/product/file/size/finishing/color/format, menyimpan raw, memanggil convert_layout(), mendeteksi colorspace, menulis detail.txt, dan insert layout_jobs.

dashboard.html + dashboard.js membaca /api/layouts, /api/products, /api/size-presets. Operator dapat melihat riwayat, download output/detail, menambah dan menghapus preset.

Preset operator:
- Banner: 300x100 cm, 400x100 cm, Custom.
- X-Banner: 60x160 cm, 80x180 cm, Custom.
- Spanduk: 100x300 cm, 100x400 cm, Custom.
- Sticker: A4, A3, Custom.
- Poster: A4, A3, A2, Custom.
- Kartu Nama: 9x5.5 cm, Custom.

Finishing: Matik 2,5 cm setiap sisi; Selongsong 2,5 cm kiri/kanan dan 8 cm atas/bawah; Roll Banner 2,5 cm kiri/kanan/atas dan 8 cm bawah.

File operator ada di storage/<Product>/<Customer>/. Nama raw/output/detail dibuat unik dengan -2, -3, dst. Customer kosong menjadi client 1, client 2, dst. detail.txt mencatat layout, timestamp, customer, product, size, finishing, color mode, pack, allowance, scale-up, colorspace, guide, rename state, dan nama file.

Operator API:
- GET /api/health
- GET /api/products
- GET /api/size-presets
- GET /api/layouts
- POST /api/layouts multipart
- POST /api/size-presets JSON
- DELETE /api/size-presets/<id>
- GET /api/layouts/<id>
- GET /api/layouts/<id>/files/raw|output|detail

## 5. Customer app

Jalankan dari apps/customer dengan python3 backend.py. Default bind 0.0.0.0:8090. Env PRESSLY_CUSTOMER_HOST dan PRESSLY_CUSTOMER_PORT tetap dipakai. Backend satu origin menyajikan HTML, CSS, JS, assets, dan API. Tidak ada SQLite/dashboard/permanent history. Upload memakai temp directory dan TTL 30 menit.

index.html: hero Cetak dari mana saja, katalog enam product, cara kerja tiga langkah, footer, chat.
order.html: product/size/quantity, finishing, sticker shape/size, upload, preview, summary, add-to-cart.
cart.html: localStorage item, total, nama, WhatsApp, pickup/delivery, address, geolocation, demo modal.
login.html: email/password form demo; submit hanya toast lokal.

Logic app.js:
- api(): fetch JSON/error wrapper.
- renderCatalog(): product cards dari catalog.
- renderSizes(), ensureCustomSizeFields(), syncSize(): preset/custom width-height-unit.
- parseSize(), sizeAreaM2(), sizeWarning(): parsing unit dan extreme dimension validation.
- renderFinishing(): finishing hanya tiga produk spanduk.
- renderProductExtras(): shape, sticker size, custom sticker size, transparent PNG hint, automatic capacity.
- getStickerSizeValue(), syncStickerCapacity(): packing dengan gap 0,3 cm.
- getOrderData(), updateSummary(): data dan harga demo.
- preparePreview(): POST multipart ke /api/layouts, menampilkan output aktual.
- addCurrentToCart(): menyimpan item/URL ke cart.
- renderCart(), initCart(): cart, delivery, geolocation, checkout demo.
- setupChat(): chat customer ke backend `/api/chat`; backend memanggil Gemini secara server-side dan mempertahankan konteks percakapan pendek di memory halaman.
- setupAnimations(): reveal-on-scroll dan pointer tilt.
- setupTheme(): memuat theme-fixes, cosmic-theme, custom-select, layout-fixes, cart CSS.

Customer API:
- GET /api/health -> ok/service/mode.
- GET /api/products -> product/preset JSON.
- POST /api/chat JSON `{message, history}` -> `{answer}` dari Gemini; API key tidak pernah dikirim ke browser.
- POST /api/layouts -> multipart product, size, quantity, customer, finishing, color_mode, output_format, scale_up, file; sticker menambah sticker_shape/sticker_size.
- GET /api/layouts/<token>/preview -> temporary PNG.
- GET /api/layouts/<token>/output -> temporary download.

Sticker engine:
sticker_sheet_dimensions() memakai A4 21x29,7 cm dan A3 29,7x42 cm. sticker_capacity() menghitung horizontal/vertical memakai ukuran sticker + gap. make_sticker_sheet() membuat kanvas putih portrait, menghitung tile fisik, memusatkan grid, dan menempelkan kapasitas maksimum. Kotak rectangular; Bulat alpha circle; Custom tanpa mask standar dan mempertahankan transparansi PNG. Ukuran sticker Custom meminta width/height cm. quantity adalah jumlah lembar/unit order, bukan jumlah sticker per lembar.

## 6. Shared prepress engine

prepress_engine.py adalah boundary ImageMagick dan jangan diganti dengan mockup saat user meminta output nyata.

- _magick(): bundled binary pada frozen build, lalu system magick/convert.
- _identify(): binary identify.
- _canvas(): bounded pixel canvas dari numeric size atau rasio preset.
- _physical_dimensions(): size ke cm.
- _finishing_pixels(): finishing fisik ke pixel.
- convert_layout(): stretch desain, optional 2x Lanczos/sharpening, splice finishing, guide line, top label, density, format, colorspace.
- detect_colorspace(): membaca colorspace.
- process(): compatibility path; PDF production masih dipertahankan sampai pipeline PDF product-specific tersedia.

Ukuran operator authoritative. Stretch boleh terjadi bila rasio artwork berbeda. Blank hanya berasal dari finishing. Guide berada di area yang sudah dipilih dan tidak menambah allowance.

## 7. Deployment

Operator: dari root, python3 backend.py, lalu buka http://127.0.0.1:8080; dashboard /dashboard.html.

Customer lokal: dari apps/customer, python3 backend.py; buka http://127.0.0.1:8090.

Customer online dari laptop:

    cd /home/adit/Documents/project001try/apps/customer
    PRESSLY_CUSTOMER_PORT=8090 python3 -u backend.py
    cloudflared tunnel --url http://127.0.0.1:8090

URL trycloudflare.com dapat dibuka dari kota/Wi-Fi lain. Laptop, backend, dan tunnel harus tetap hidup. Validasi harus GET /api/health, halaman, CSS, dan multipart upload dari jaringan eksternal. Quick Tunnel temporary, bukan domain production.

Quick Tunnel terakhir: https://endif-mobiles-elsewhere-warned.trycloudflare.com. Anggap stale setelah proses berhenti; ambil URL baru dari output cloudflared.

Dockerfile.customer memakai Python slim, ImageMagick, fonts-dejavu, Ghostscript, menyalin prepress_engine.py + apps/customer, lalu menjalankan backend. render.yaml mendefinisikan Docker web service customer, health /api/health, host 0.0.0.0, dan platform PORT. Git push bukan public deployment terverifikasi.

Windows: build_windows.ps1 membutuhkan Windows Python launcher py, PyInstaller, dan PRESSLY_IMAGEMAGICK_DIR. Pressly.spec membundel root frontend dan portable ImageMagick. launcher.py memilih port 8080 lalu 8081–8090 lalu OS port, membuka browser, dan menulis pressly-startup.log. Validasi wajib native Windows.

## 8. Branding

Visible branding Fazima Print diterapkan pada root operator, dashboard, customer home/order/cart/login/footer/chat, backend display strings, dan executable display name.

Technical compatibility yang sengaja lama:
- PRESSLY_HOST, PRESSLY_PORT, PRESSLY_DATA_DIR
- PRESSLY_CUSTOMER_HOST, PRESSLY_CUSTOMER_PORT
- PRESSLY_IMAGEMAGICK_DIR
- pressly.db, folder data Pressly, Pressly.spec, pressly-startup.log

Jika ingin rename teknis juga, siapkan migration database/storage/env/build dan update .gitignore.

## 9. Testing contract

Syntax:

    node --check apps/customer/app.js
    python3 -m py_compile apps/customer/backend.py
    python3 -m py_compile backend.py prepress_engine.py launcher.py maintenance.py worker.py

Customer smoke:
1. Start backend port kosong.
2. GET /api/health harus 200.
3. GET /api/products harus enam product.
4. Upload PNG multipart Banner/Poster/Sticker.
5. Sticker A4 + 10x10 cm -> sticker_count 4.
6. Sticker A3 + 10x10 cm -> sticker_count 8.
7. Bulat harus circular, bukan square.
8. cosmic-theme.css, custom-select.css, layout-fixes.css harus 200.
9. Test cart pickup/delivery, address, geolocation, login, chat, mobile, dropdown, dark colors.

Public smoke ulangi endpoint/upload melalui URL tunnel dari jaringan eksternal. Syntax/source check tidak membuktikan browser-visible UI. Setelah UI diubah, review home, order, cart, login, footer, mobile, dropdown, upload, preview, chat, dan modal.

## 10. Cautions

- Ada dua app.js dan dua backend.py; selalu cek path.
- Root operator memakai SQLite; customer tidak.
- Customer backend masih memiliki MOCKUPS dan make_mockup_preview() dari fase lama, tetapi POST flow terbaru tidak memanggilnya.
- CSS customer terdiri dari legacy base + override; cosmic-theme.css dimuat dinamis terakhir.
- DOCX di docs adalah referensi kebutuhan lama. Graphify tidak mengekstrak isi DOCX penuh; gunakan ZIP/XML atau DOCX parser jika diperlukan.
- Repository pada audit terakhir banyak untracked; jangan destructive reset/checkout.
- graphify-out/GRAPH_REPORT.md adalah artefak analisis, bukan runtime app.

## 11. Customer UI lock dan Gemini chat

UI customer sudah diselesaikan dan dikunci sebagai baseline produk. Agent/developer dilarang mengubah visual, layout, warna, typography, animasi, responsive behavior, asset placement, markup presentasional, atau stylesheet di `apps/customer/` tanpa permintaan eksplisit baru dari pemilik project. Jangan mengubah UI sebagai bagian dari perbaikan backend, API, authentication, atau chat. Jika ada konflik, functionality harus dipertahankan dan perubahan UI harus diminta/ditinjau terpisah.

Chat AI customer menggunakan Gemini melalui backend, bukan dari browser. Konfigurasi lokal/server:

    export GEMINI_API_KEY='isi API key melalui secret manager atau environment lokal'
    export GEMINI_PROJECT_NUMBER='isi project number Google Cloud'
    export GEMINI_MODEL='gemini-3.6-flash'
    python3 backend.py

`GEMINI_PROJECT_NUMBER` dicatat untuk identitas project, tetapi jalur Gemini API key memakai `GEMINI_API_KEY` pada request `generateContent`. Jangan commit key, menaruhnya di HTML/JavaScript, mencetaknya ke log, atau menulisnya ke README. API key yang pernah dibagikan di chat/terminal sebaiknya segera di-rotate.

Jika key tidak tersedia, `/api/chat` mengembalikan HTTP 503 yang aman dan UI menampilkan pesan konfigurasi; fitur layout, cart, preview, dan checkout tidak bergantung pada chat.

## 12. Protocol agent berikutnya

1. Baca README ini.
2. Tentukan scope operator root atau customer.
3. Gunakan rg untuk referensi dan cek process/port untuk masalah live.
4. Gunakan Graphify untuk pertanyaan arsitektur.
5. Edit dengan apply_patch; pertahankan perubahan user yang tidak terkait.
6. Jalankan syntax dan smoke test.
7. Bedakan bukti source, syntax, local HTTP, public HTTP, dan browser-visible.
8. Jika menjalankan server/tunnel, laporkan URL, port, proses yang harus hidup, dan sifat temporary/permanent.
