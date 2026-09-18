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

## 2. Import tabel dan data katalog

Import `schema.sql` dari menu Import phpMyAdmin pada database `fazima_print_customer`. File ini membuat tabel accounts, products, promotions, `promo_timer_settings`, orders, order_items, payments, layout_jobs, dan chat_messages, lalu memasukkan katalog awal.

Setelah itu import `migrate_operator_mysql.sql` sebagai administrator. Migration ini membuat tabel persistence Operator dan seed stok A3/Indoor/Outdoor pada database yang sama. Akun aplikasi tidak membutuhkan izin `CREATE TABLE`; setelah import cukup `SELECT, INSERT, UPDATE, DELETE`.

Jika database sudah pernah dibuat sebelumnya, import `migrate_promo_timer.sql` satu kali. Tabel `promo_timer_settings` menyimpan timer global box promo, mode loop tetap/random, durasi random yang sedang aktif, dan aksi saat timer selesai.

## 3. Isi konfigurasi backend

```bash
cp .env.example .env
chmod 600 .env
```

Isi `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, dan `MYSQL_PASSWORD`. Password hanya boleh berada di `.env`/secret manager backend; jangan ditaruh di JavaScript, HTML, atau commit.

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
