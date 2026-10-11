"""Move the legacy product catalog into material with explicit record types.

Run once from the repository root with the configured MYSQL_* environment.
The source table is dropped only after every source row is present and verified
in material. Unique business keys and names are checked before any write.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from operator_database import connect


SOURCE_FIELDS = (
    "no_excel", "jenis", "kode_produk", "kode_asal", "barcode", "nama",
    "satuan", "harga_beli", "harga_jual",
)
DEST_FIELDS = (
    "no_excel", "jenis", "kode_produk", "kode_asal", "barcode", "nama",
    "satuan", "harga_beli", "harga_jual", "stok_awal", "stok_masuk",
    "stok_keluar", "stok_opname", "stok_akhir", "status",
)


def main() -> None:
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SHOW TABLES LIKE %s", ("product",))
            if not cursor.fetchone():
                cursor.execute("SELECT COUNT(*) AS total FROM material")
                print(f"product table already absent; material rows={cursor.fetchone()['total']}")
                return

            cursor.execute("SHOW COLUMNS FROM product")
            source_columns = {row["Field"] for row in cursor.fetchall()}
            cursor.execute("SHOW COLUMNS FROM material")
            material_columns = {row["Field"] for row in cursor.fetchall()}
            if not set(SOURCE_FIELDS).issubset(source_columns) or not set(DEST_FIELDS).issubset(material_columns):
                raise RuntimeError("Struktur product/material berbeda dari skema yang sudah diperiksa; migrasi dibatalkan.")

            cursor.execute("SELECT COUNT(*) AS total FROM product")
            source_count = int(cursor.fetchone()["total"])
            cursor.execute("SELECT COUNT(*) AS total FROM material")
            material_count = int(cursor.fetchone()["total"])
            cursor.execute("SELECT DISTINCT UPPER(TRIM(jenis)) AS jenis FROM product")
            product_types = {row["jenis"] for row in cursor.fetchall()}
            cursor.execute("SELECT DISTINCT UPPER(TRIM(jenis)) AS jenis FROM material")
            material_types = {row["jenis"] for row in cursor.fetchall()}
            if product_types - {"PRODUK", "JASA"}:
                raise RuntimeError(f"Ada jenis product yang belum dipetakan: {sorted(product_types)}")

            # The restricted application account may be able to merge rows but
            # not DROP the source table. If a prior run committed the verified
            # copy and stopped at DROP, resume safely without inserting twice.
            cursor.execute("""SELECT COUNT(*) AS total FROM product p LEFT JOIN material m
                ON p.kode_produk=m.kode_produk
                WHERE m.id IS NULL OR m.no_excel<>p.no_excel OR m.nama<>p.nama
                  OR m.harga_beli<>p.harga_beli OR m.harga_jual<>p.harga_jual
                  OR m.satuan<>p.satuan
                  OR m.jenis<>CASE WHEN UPPER(TRIM(p.jenis))='JASA' THEN 'JASA' ELSE 'PRODUK' END""")
            not_copied = int(cursor.fetchone()["total"])
            if material_types == {"MATERIAL", "PRODUK", "JASA"} and not not_copied:
                cursor.execute("DROP TABLE product")
                print(f"Migration resumed: verified {source_count} copied rows; product table dropped.")
                return
            if material_types != {"PRODUK"}:
                raise RuntimeError(f"Jenis material berubah sebelum merge selesai: {sorted(material_types)}")

            for key in ("no_excel", "kode_produk"):
                cursor.execute(f"SELECT COUNT(*) AS total FROM product p JOIN material m ON p.{key}=m.{key}")
                collisions = int(cursor.fetchone()["total"])
                if collisions:
                    raise RuntimeError(f"Ditemukan {collisions} tabrakan {key}; migrasi dibatalkan agar tidak ada data ganda.")
            cursor.execute("SELECT COUNT(*) AS total FROM product p JOIN material m ON LOWER(TRIM(p.nama))=LOWER(TRIM(m.nama))")
            name_collisions = int(cursor.fetchone()["total"])
            if name_collisions:
                raise RuntimeError(f"Ditemukan {name_collisions} nama yang sudah ada di material; migrasi dibatalkan agar tidak ada data ganda.")
            cursor.execute("""SELECT COUNT(*) AS total FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='product'
                  AND TABLE_NAME<>'product'""")
            if int(cursor.fetchone()["total"]):
                raise RuntimeError("Ada foreign key dari tabel lain ke product; migrasi dibatalkan.")

            cursor.execute("SELECT " + ",".join(SOURCE_FIELDS) + " FROM product ORDER BY no_excel")
            source_rows = cursor.fetchall()
            print(f"Preflight OK: product={source_count}, material={material_count}; jenis={sorted(product_types)}")

            connection.begin()
            try:
                cursor.execute("UPDATE material SET jenis='MATERIAL' WHERE UPPER(TRIM(jenis))='PRODUK'")
                if cursor.rowcount != material_count:
                    raise RuntimeError("Jumlah material yang diberi label MATERIAL tidak sesuai; perubahan dibatalkan.")
                cursor.execute("""INSERT INTO material
                    (no_excel,jenis,kode_produk,kode_asal,barcode,nama,satuan,harga_beli,harga_jual,
                     stok_awal,stok_masuk,stok_keluar,stok_opname,stok_akhir,status)
                    SELECT p.no_excel,
                      CASE WHEN UPPER(TRIM(p.jenis))='JASA' THEN 'JASA' ELSE 'PRODUK' END,
                      p.kode_produk,p.kode_asal,p.barcode,p.nama,p.satuan,p.harga_beli,p.harga_jual,
                      0,0,0,0,0,p.status
                    FROM product p ORDER BY p.no_excel""")
                if cursor.rowcount != source_count:
                    raise RuntimeError(f"Hanya {cursor.rowcount}/{source_count} row product tersalin; perubahan dibatalkan.")

                cursor.execute("SELECT COUNT(*) AS total FROM material")
                expected_total = material_count + source_count
                if int(cursor.fetchone()["total"]) != expected_total:
                    raise RuntimeError("Jumlah row material setelah penyalinan tidak sesuai; perubahan dibatalkan.")
                cursor.execute("""SELECT COUNT(*) AS total FROM product p LEFT JOIN material m
                    ON p.kode_produk=m.kode_produk
                    WHERE m.id IS NULL OR m.no_excel<>p.no_excel OR m.nama<>p.nama
                      OR m.harga_beli<>p.harga_beli OR m.harga_jual<>p.harga_jual
                      OR m.satuan<>p.satuan
                      OR m.jenis<>CASE WHEN UPPER(TRIM(p.jenis))='JASA' THEN 'JASA' ELSE 'PRODUK' END""")
                if int(cursor.fetchone()["total"]):
                    raise RuntimeError("Verifikasi isi product ke material gagal; perubahan dibatalkan.")
                connection.commit()
            except Exception:
                connection.rollback()
                raise

            cursor.execute("DROP TABLE product")
            cursor.execute("SHOW TABLES LIKE %s", ("product",))
            if cursor.fetchone():
                raise RuntimeError("Tabel product masih ada setelah migrasi.")
            cursor.execute("SELECT jenis,COUNT(*) AS total FROM material GROUP BY jenis ORDER BY jenis")
            print(f"Migration complete: product dropped; material rows={expected_total}; types={cursor.fetchall()}")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
