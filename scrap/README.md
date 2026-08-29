# Fazima Print — website scrape

Snapshot publik `https://fazimaprint.com/` yang diambil pada 2026-08-29.

## Isi

- `website-scrape/` — mirror mentah hasil crawler; path dan nama file mengikuti hasil unduhan.
- `organized/pages/` — halaman HTML/XML yang terdeteksi dari root dan sitemap.
- `organized/assets/images/` — 46 identitas gambar unik yang dipisah menjadi branding, about, products, gallery, clients, dan partners; original dan thumbnail berada di subfolder masing-masing.
- `organized/assets/styles/` — CSS.
- `organized/assets/scripts/` — JavaScript.
- `organized/assets/fonts/` — font/icon Noticons.
- `organized/assets/other/` — aset non-standar yang tidak masuk kategori utama.
- `organized/site-metadata/` — `robots.txt` dan `osd.xml`.
- `metadata/manifest.csv` — inventaris file terorganisasi dengan ukuran, MIME, SHA-256, dan URL sumber.
- `metadata/image-inventory.csv` — inventaris khusus gambar tanpa menghitung thumbnail sebagai gambar unik.
- `metadata/sitemap.xml` — salinan sitemap yang menjadi acuan URL halaman.

## Cakupan

Crawler mengikuti `robots.txt`, tetap pada domain `fazimaprint.com`, dan mengambil URL yang dirujuk oleh landing page serta URL yang tercantum di sitemap publik. Link eksternal seperti WhatsApp, Tokopedia, Shopee, dan Google Maps dicatat sebagai referensi di HTML, tetapi tidak dicrawl sebagai bagian situs Fazima Print.

WordPress menghasilkan banyak thumbnail dengan query `?w=...`; semuanya dipertahankan karena merupakan respons aset publik yang berbeda.
