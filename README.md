# Fazima Print — Project Handoff

> Dokumen ini diperbarui 2026-09-05 berdasarkan source tree saat ini. Baca sebelum mengubah code.

## 1. Batas project

Workspace ini berisi dua aplikasi yang berbeda:

1. **Operator App** di root repository: aplikasi lokal untuk operator, MySQL, ImageMagick, storage, riwayat layout, dashboard, kasir, master data, dan workflow produksi.
2. **Customer App** di `apps/customer/`: aplikasi customer dengan katalog, promo, detail produk, upload desain, preview, cart, order, pembayaran Midtrans, login, lokasi, dan chat AI.

Jangan mencampur kedua aplikasi. Customer App tidak boleh mengubah workflow Operator App atau executable operator.

Nama visible resmi adalah **Fazima Print**. Identifier kompatibilitas lama berikut tetap dipertahankan: `PRESSLY_*`, `Pressly.spec`, `pressly-startup.log`, dan folder data Pressly.

## 2. Status aktual

### Operator App

- Python backend dengan MySQL yang sama dengan Customer App (`fazima_print_customer`).
- Default: `http://127.0.0.1:8080`.
- Hub root mengarah ke Operator, Kasir, dan Master Data.
- Operator membuat layout dengan validasi produk, preset/custom size, finishing, warna, format output, dan scale-up.
- Dashboard membaca layout, produk, serta preset dan menyediakan download raw/output/detail.
- Kasir, Master Data, Stok/BOM, dan Workflow Sistem masih merupakan frontend/mockup pada area yang ditandai; jangan menganggapnya sebagai persistence production.

### Customer App

- Default: `http://127.0.0.1:8090` dengan `PRESSLY_CUSTOMER_HOST` dan `PRESSLY_CUSTOMER_PORT`.
- Satu origin menyajikan HTML, CSS, JavaScript, assets, dan API.
- Mendukung dua mode katalog:
  - **MySQL mode** jika `MYSQL_HOST`, `MYSQL_USER`, dan `MYSQL_DATABASE` dikonfigurasi.
  - **Ephemeral fallback** jika MySQL tidak dikonfigurasi; katalog fallback berasal dari data backend.
- Katalog, harga dasar, promo, dan order customer memakai MySQL jika mode database aktif.
- Job layout tetap temporary dengan TTL sekitar 30 menit.
- Cart draft dan file draft browser memakai localStorage/IndexedDB sesuai flow halaman.
- Login masih demo; belum menjadi autentikasi account production.
- Chat memakai Gemini server-side jika `GEMINI_API_KEY` tersedia; tanpa key, chat mengembalikan setup/error state yang jelas.
- Checkout memiliki order persistence dan Midtrans Snap flow jika database serta credentials dikonfigurasi; tanpa konfigurasi payment, tidak mengarang data pembayaran.

### Update so far — 2026-09-06

- Midtrans Sandbox sudah diverifikasi dari backend saat ini: request Snap minimal berhasil `201 Created` dan menghasilkan token.
- Endpoint customer `POST /api/payments/snap-token` juga berhasil diuji secara lokal dengan payload payment methods penuh: `201 Created` dan token Snap valid.
- Status `502` yang dilaporkan belum terbukti berasal dari Midtrans atau payload source. Indikasi terkuat adalah backend customer yang mati/stale atau Cloudflare Quick Tunnel yang tidak lagi dapat menjangkau origin.
- Jika memakai URL publik, backend dan tunnel harus dijalankan bersamaan dari `apps/customer`; URL Quick Tunnel lama tidak boleh dianggap masih aktif setelah proses berhenti.
- `MIDTRANS_FINISH_URL` lokal masih menggunakan `http://localhost:8090/`. Untuk deployment publik, ubah nilainya ke URL customer publik agar redirect setelah pembayaran tidak kembali ke localhost.
- Verifikasi interaksi checkout di browser publik dan webhook settlement masih pending; hasil `201` hanya membuktikan pembuatan token, bukan pembayaran berhasil.

## 3. Struktur utama

```text
project001try/
├── README.md
├── backend.py                 # Operator backend + MySQL
├── app.js                     # Operator frontend logic
├── index.html                 # Operator hub
├── setting.html               # Setting workspace
├── operator-dashboard.html    # Dashboard Operator: material & stock control
├── dashboard.html / dashboard.js
├── cashier.html / cashier.js
├── master-data.html / master-data.js
├── master-stock.js
├── launcher.py
├── maintenance.py
├── worker.py
├── prepress_engine.py         # Shared ImageMagick prepress engine
├── Pressly.spec
├── build_windows.ps1
├── Dockerfile.customer
├── render.yaml
├── docs/
├── assets/                    # Asset operator/root
└── apps/customer/
    ├── backend.py             # Customer backend
    ├── database.py            # MySQL connection/catalog/order repository
    ├── schema.sql             # MySQL schema + seed catalog/promo
    ├── DATABASE_SETUP.md
    ├── requirements.txt       # pymysql
    ├── .env.example
    ├── app.js                 # Semua customer frontend logic
    ├── index.html             # Home, hero, promo, catalog
    ├── about.html
    ├── product.html           # Product description/detail
    ├── order.html             # Specification/upload/review draft
    ├── payment.html           # Midtrans checkout
    ├── cart.html
    ├── login.html
    ├── styles.css             # Base/reset customer
    ├── arc-ui.css             # Final customer presentation layer
    ├── custom-select.css      # Compatibility/custom selector styles
    ├── layout-fixes.css
    ├── cart-fixes.css
    ├── theme-fixes.css
    ├── mockups.css            # Legacy allowlisted asset/style
    ├── about-revamp.css       # Legacy file retained in tree
    ├── assets/real/            # Branding, gallery, clients, partners, products, payment
    └── assets/products/        # Product catalog thumbnails by category
```

Generated/runtime paths such as `storage/`, `backup/`, temporary customer jobs, `__pycache__/`, and `graphify-out/` are not product features.

## 4. Customer routes and user flow

| Route | Fungsi |
|---|---|
| `/` | Hero, search, kategori, promo, product catalog, cara pesan, footer |
| `/about.html` | About, gallery, lokasi, Google Maps |
| `/product.html?product=...` | Detail produk, harga, rating/sold metadata, mulai order |
| `/order.html?product=...` | Pilih ukuran, quantity, finishing, opsi sticker/banner, upload, preview draft |
| `/payment.html` | Order summary dan Midtrans Snap checkout |
| `/cart.html` | Cart, customer data, pickup/delivery, address, geolocation, order submit |
| `/login.html` | Login demo/customer entry state |

Flow utama:

```text
Home/search/category
        ↓
Product detail
        ↓
Order specification + upload
        ↓
Review preview
        ↓
Cart
        ↓
POST /api/orders
        ↓
Payment / Midtrans Snap jika configured
```

Frontend Customer UI terbaru mencakup fixed floating Macintosh-inspired navbar, responsive mobile menu, early loading screen dengan favicon mark, dynamic promo countdown, product-first catalog, search suggestions, custom dropdown, chat panel anchored, dan responsive product/order/cart layout. `arc-ui.css` adalah presentation layer final; jangan menambahkan override acak tanpa memeriksa cascade-nya.

## 5. Customer backend API

### Public/catalog

- `GET /api/health` — status service, mode database, Gemini configuration, model.
- `GET /api/products` — produk dan size untuk order form.
- `GET /api/catalog` — katalog aktif, base price, effective promo price, discount, image, sizes; membutuhkan MySQL.
- `GET /api/payments/config` — status Midtrans, environment, Snap URL, client key, enabled payment methods; tidak pernah mengirim server key.

### Layout and chat

- `POST /api/layouts` — multipart upload JPG/JPEG/PNG/PDF sampai 50 MB, validasi product/size/finishing/options, menghasilkan temporary layout.
- `GET /api/layouts/<token>/preview` — preview temporary.
- `GET /api/layouts/<token>/output` — download output temporary.
- `POST /api/chat` — Gemini server-side dengan payload `{message, history}`; API key tidak dikirim ke browser.

### Order and payment

- `POST /api/orders` — menyimpan order customer ke MySQL jika database dikonfigurasi.
- `POST /api/payments/snap-token` — membuat Midtrans Snap token server-side.
- `POST /api/payments/notification` — menerima webhook Midtrans dan memverifikasi SHA-512 signature.

Semua job layout memiliki TTL sekitar 30 menit dan dibersihkan oleh backend. Payment/order production bergantung pada konfigurasi MySQL dan Midtrans; source code tidak boleh mengarang keberhasilan payment jika credentials tidak aktif.

## 6. Database Customer dan secrets

`apps/customer/schema.sql` membuat tabel:

- `products`
- `promotions`
- `accounts`
- `orders`
- `order_items`
- `payments`
- `layout_jobs`
- `chat_messages`

Setup:

```bash
cd apps/customer
cp .env.example .env
chmod 600 .env
.venv/bin/pip install -r requirements.txt
.venv/bin/python backend.py
```

Isi `.env` hanya dengan secret backend:

- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
- `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`
- `GEMINI_API_KEY`, `GEMINI_MODEL`, optional `GEMINI_PROJECT_NUMBER`

Jangan commit `.env`, server key, password database, atau API key. Backend menolak local secret file yang permission-nya terlalu terbuka. Detail import schema dan phpMyAdmin ada di `apps/customer/DATABASE_SETUP.md`.

## 7. Product and prepress behavior

Customer catalog saat ini berasal dari seed/data database dan mencakup produk seperti Cetak Sertifikat, Stiker Chromo A3+, Flyer/Brosur, Canvas, Flexi, ID Card, Mini Banner, Mug, Roll Up Banner, berbagai sticker, Art Paper, Tripod Banner, serta fallback product legacy Banner, X-Banner, Spanduk, Sticker, Poster, dan Kartu Nama.

- Product kind membedakan banner, sticker, paper, canvas, card, dan merchandise.
- Size dapat preset atau custom width/height/unit.
- Finishing aktif untuk Banner, X-Banner, dan Spanduk sesuai backend.
- Sticker bulk memakai A3 dan menghitung packing otomatis dengan gap 0,3 cm.
- Sticker 10×10 cm menghasilkan 4 pcs pada A4 dan 8 pcs pada A3.
- Sticker mendukung shape Kotak, Bulat, dan Custom; Custom meminta PNG transparan.
- Layout preview berasal dari output aktual ImageMagick, bukan foto mockup.
- Output menyimpan colorspace, orientation, finishing allowance, optional scale-up, dan format output.

`prepress_engine.py` adalah boundary prepress bersama. Jangan mengganti output nyata dengan mockup ketika flow meminta layout aktual.

## 8. Operator backend

Jalankan dari root:

```bash
python3 backend.py
```

Default endpoint:

- `GET /api/health`
- `GET /api/products`
- `GET /api/size-presets`
- `GET /api/layouts`
- `POST /api/layouts`
- `POST /api/size-presets`
- `DELETE /api/size-presets/<id>`
- `GET /api/stock?category=A3|Indoor|Outdoor` — daftar bahan gabungan dengan filter kategori.
- `GET /api/stock/summary` — ringkasan jumlah bahan, saldo, stok minimum, dan histori.
- `GET /api/stock/movements` — histori pergerakan stok.
- `POST /api/stock/items` — tambah bahan dan relasi kategori.
- `POST /api/stock/movements` — catat stok masuk, stok keluar, atau koreksi saldo.
- `GET /api/layouts/<id>`
- `GET /api/layouts/<id>/files/raw|output|detail`

Operator dan Customer App sekarang menggunakan database MySQL `fazima_print_customer` yang sama. Operator menyimpan job, preset ukuran, stok, dan pergerakan stok di tabel MySQL `operator_*`/`stock_*`.

Dashboard Operator di `/operator-dashboard.html` memakai tabel MySQL `stock_items`, `stock_item_categories`, dan `stock_movements`. Daftar bahan disimpan satu kali; A3, Indoor, dan Outdoor hanya menjadi relasi pemakaian sehingga bahan lintas kategori tidak terduplikasi.

## 9. Running and public demo

Customer lokal:

```bash
cd /home/adit/Documents/project001try/apps/customer
.venv/bin/python -u backend.py
```

Buka `http://127.0.0.1:8090`.

Customer public sementara:

```bash
cd /home/adit/Documents/project001try/apps/customer
.venv/bin/python -u backend.py
cloudflared tunnel --url http://127.0.0.1:8090
```

Quick Tunnel menghasilkan URL `trycloudflare.com` sementara. Backend, tunnel, dan laptop harus tetap hidup. URL lama tidak boleh dianggap aktif setelah proses berhenti. Untuk public smoke test, cek `/api/health`, halaman, CSS/JS, catalog, dan multipart upload dari jaringan eksternal.

## 10. Testing contract

Syntax:

```bash
node --check apps/customer/app.js
python3 -m py_compile apps/customer/backend.py apps/customer/database.py
python3 -m py_compile backend.py prepress_engine.py launcher.py maintenance.py worker.py
```

Customer smoke minimum:

1. Jalankan backend pada port kosong/8090.
2. `GET /api/health` harus HTTP 200.
3. `GET /api/products` dan, bila MySQL aktif, `GET /api/catalog`.
4. Cek semua route: home, about, product, order, payment, cart, login.
5. Cek desktop dan mobile: fixed navbar, menu mobile, hero/search dropdown, category, promo timer, product cards, footer.
6. Cek product detail → order draft → upload → preview → cart.
7. Cek sticker A4/A3 packing, shape Bulat/Custom, dan output aktual.
8. Cek cart pickup/delivery, address, geolocation, order submit, dan payment setup state.
9. Cek login demo, Gemini chat/error state, modal, custom dropdown, dan loading screen.
10. Untuk UI, source check/HTTP 200 saja tidak cukup; review halaman yang benar-benar dirender pada port yang sedang aktif.

## 11. Cautions for future agents

- Ada dua `backend.py` dan dua `app.js`; selalu pastikan path sebelum mengedit atau menjalankan.
- Root operator dan Customer App memakai MySQL `fazima_print_customer`; Customer App tetap memiliki fallback ephemeral hanya bila konfigurasi MySQL tidak tersedia.
- Jangan mengubah backend/API/database saat permintaan hanya redesign UI.
- `arc-ui.css` adalah layer visual final customer dan sudah memuat banyak compatibility selector. Periksa specificity dan urutan cascade sebelum menambah rule.
- Jangan menghapus `product.html`, `payment.html`, `database.py`, `schema.sql`, `DATABASE_SETUP.md`, atau `.env.example` sebagai “legacy”; semuanya bagian dari flow terbaru.
- Jangan menyimpan secret di frontend, README, log, atau git.
- Setelah perubahan customer source, restart proses `python3 backend.py` yang benar dari `apps/customer`; pastikan tidak ada proses customer lama yang masih memegang port 8090.
- Jangan menyatakan UI selesai hanya dari `node --check`, `py_compile`, atau HTTP 200. Lakukan rendered review dan interaction smoke.
