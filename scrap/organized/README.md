# Struktur hasil scrape Fazima Print

Folder ini adalah salinan terstruktur dari mirror mentah di `../website-scrape/`.

## Struktur folder

```text
organized/
├── pages/                 HTML, RSS, dan feed komentar
├── site-metadata/         robots.txt dan osd.xml
└── assets/
    ├── images/
    │   ├── branding/      logo Fazima
    │   ├── about/         gambar Tentang Kami
    │   ├── products/      gambar katalog produk
    │   ├── gallery/       foto galeri
    │   ├── clients/       logo klien
    │   ├── partners/      logo marketplace/partner
    │   └── uncategorized/ cadangan untuk gambar yang belum dipetakan
    ├── styles/             CSS dan stylesheet WordPress
    ├── scripts/            JavaScript WordPress
    ├── fonts/              Noticons
    └── other/              aset non-standar lainnya
```

## Cara membaca aset gambar

Setiap identitas gambar memiliki folder sendiri. File `original.*` adalah file tanpa parameter ukuran jika tersedia. Folder `variants/` berisi respons thumbnail WordPress, misalnya `variant-w-300-h-300.jpg`.

Hasil penghitungan yang benar:

- 46 identitas/nama gambar unik setelah query ukuran dihapus
- 44 file original tersedia
- 165 file thumbnail/varian ukuran
- 209 file gambar secara total

Dua identitas hanya tersedia sebagai varian: `logo_fazima-panjang-1` dan `font-ms-logo`.

## Inventaris

- `../metadata/image-inventory.csv` — ringkasan per identitas gambar, kategori, original, dan jumlah varian.
- `../metadata/manifest.csv` — seluruh file mirror mentah dengan MIME, ukuran, URL sumber, dan SHA-256.
- `../metadata/content-summary.md` — ringkasan teks, produk, tautan, dan batas cakupan.

## Catatan cakupan

Ini adalah snapshot aset publik yang dapat diakses tanpa login. Link WhatsApp, Tokopedia, Shopee, dan Google Maps tetap berada sebagai referensi di halaman; isi situs eksternal tersebut tidak ikut disalin. `website-scrape/` dipertahankan sebagai sumber mentah apabila diperlukan audit ulang.

