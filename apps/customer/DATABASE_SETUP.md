# MySQL dan phpMyAdmin — Fazima Print Customer

Customer app memakai MySQL sebagai sumber katalog, harga, promo, dan order. phpMyAdmin bukan koneksi terpisah: phpMyAdmin adalah panel administrasi yang masuk ke server MySQL yang sama.

## 1. Buat database dan user aplikasi

Di phpMyAdmin, masuk sebagai administrator lalu buka tab SQL dan jalankan:

```sql
CREATE DATABASE fazima_print_customer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'fazima_customer_app'@'127.0.0.1' IDENTIFIED BY 'ganti-dengan-password-random-panjang';
GRANT SELECT, INSERT, UPDATE, DELETE ON fazima_print_customer.* TO 'fazima_customer_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Jika MySQL berjalan di host lain, sesuaikan host user dan `MYSQL_HOST`. Jangan memakai user `root` untuk web app.

## 2. Import skema dan migrasi

Untuk database baru, jalankan urutan ini sebagai administrator:

1. Import `migrate_operator_mysql.sql` terlebih dahulu. `schema.sql` membuat foreign key produksi ke `stock_items`, yang dibuat oleh migrasi Operator ini.
2. Import `schema.sql` untuk tabel Customer, workflow produksi, promo timer, akun customer dan employee, serta seed katalog awal.
3. Import `migrate_catalog.sql` untuk mengisi kategori aktif dan deskripsi katalog.
4. Import `migrate_spanduk_banner.sql` untuk merapikan produk Spanduk Banner dan bahan yang dipakai.
5. Import `migrate_account_roles.sql` untuk memastikan tabel akun internal Operator/Kasir ada. Tabel ini terpisah dari tabel `users` milik customer.

Skema saat ini sudah memuat tabel dan kolom dari `migrate_dashboard_step1.sql`, `migrate_dashboard_step2.sql`, dan `migrate_dashboard_step3.sql`. Jangan jalankan ketiga file `ALTER` itu lagi setelah `schema.sql`; file tersebut hanya untuk upgrade database lama yang belum memiliki kolom terkait, dengan urutan step 1, 2, lalu 3. `migrate_promo_timer.sql` juga sudah dicakup oleh `schema.sql` dan aman dipakai untuk upgrade lama.

Setelah semua migrasi administrator selesai, akun aplikasi cukup memerlukan `SELECT, INSERT, UPDATE, DELETE`. Untuk instalasi lokal ini, `MYSQL_HOST` adalah `127.0.0.1` dan user aplikasi dibatasi ke koneksi lokal.

## 3. Isi konfigurasi backend

```bash
cp .env.example .env
chmod 600 .env
```

Isi `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, dan `MYSQL_PASSWORD`. Password hanya boleh berada di `.env`/secret manager backend; jangan ditaruh di JavaScript, HTML, atau commit.

### Windows EXE

Versi `Fazima Print.exe` membuka aplikasi dalam jendela desktop dan membaca konfigurasi MySQL dari file `.env` di samping EXE atau `%LOCALAPPDATA%\Pressly\.env`. Windows harus memiliki Microsoft Edge WebView2 Runtime. Untuk paket hasil build di folder `dist`, cara paling mudah adalah membuat file `dist/.env` dengan isi berikut, lalu mengganti user dan password sesuai database:

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=fazima_print_customer
MYSQL_USER=fazima_customer_app
MYSQL_PASSWORD=ganti_dengan_password_database
```

Gunakan `127.0.0.1` hanya jika MySQL berjalan di komputer yang sama. Untuk database di server lain, isi `MYSQL_HOST` dengan hostname/IP server dan pastikan user MySQL diizinkan terhubung dari komputer yang menjalankan EXE. Jangan mengirim atau meng-commit file `.env` karena berisi password.

Install dependency dan jalankan:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python backend.py
```

Validasi:

```bash
curl http://127.0.0.1:8090/api/health
curl http://127.0.0.1:8090/api/catalog
```

`/api/health` harus menunjukkan `database_configured: true`, dan `/api/catalog` harus mengembalikan produk beserta `base_price`, harga efektif promo, dan data promo.

Pengaturan timer tersedia dari Website Control → Promotions. Untuk mode random, dashboard menampilkan durasi random yang sedang tergenerate serta waktu reset berikutnya.

## Kurir pengiriman order web

Sebelum menjalankan Customer App yang sudah diperbarui, terapkan migrasi satu kali pada database `fazima_print_customer`:

```sql
ALTER TABLE orders ADD COLUMN shipping_courier VARCHAR(16) NULL AFTER delivery_method;
```

File `migrate_web_shipping_courier.sql` berisi perintah yang sama. Migrasi sudah diterapkan pada database lokal proyek.
## Lokasi dan detail alamat order web

Migrasikan tabel order satu kali agar lokasi otomatis dan detail alamat manual tersimpan sebagai kolom terpisah. Kolom `address` tetap berisi gabungan keduanya untuk kompatibilitas dashboard lama.

```sql
ALTER TABLE orders
  ADD COLUMN location_label TEXT NULL AFTER address,
  ADD COLUMN address_detail TEXT NULL AFTER location_label;
```

File migrasi: `migrate_web_order_location_detail.sql`.
