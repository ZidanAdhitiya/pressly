"""Shared MySQL persistence for the root operator application.

The operator and customer services intentionally use the same configured
MySQL-only persistence for the operator application.
"""
from __future__ import annotations

import json
import hashlib
import hmac
import os
import sys
from contextlib import contextmanager
from pathlib import Path

# The root launcher is commonly started with `python3 backend.py`, while the
# shared MySQL dependency is installed in the customer application's venv.
# Reuse that pure-Python dependency instead of requiring a second environment.
_venv_packages = sorted((Path(__file__).parent / "apps/customer/.venv/lib").glob("python*/site-packages"))
if _venv_packages and str(_venv_packages[-1]) not in sys.path:
    sys.path.insert(0, str(_venv_packages[-1]))

try:
    import pymysql
    from pymysql.cursors import DictCursor
except ImportError as exc:  # pragma: no cover - startup message is actionable
    raise RuntimeError("PyMySQL wajib terpasang. Jalankan apps/customer/.venv/bin/pip install -r apps/customer/requirements.txt") from exc


def load_env() -> None:
    env_path = Path(os.environ.get("MIDTRANS_ENV_FILE", Path(__file__).parent / "apps/customer/.env"))
    if not env_path.is_file():
        return
    if hasattr(os, "getuid") and env_path.stat().st_mode & 0o077:
        raise RuntimeError(f"Refusing insecure secret file permissions on {env_path}; run chmod 600 .env")
    allowed = {"MYSQL_HOST", "MYSQL_PORT", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"}
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name, value = name.strip(), value.strip()
        if name not in allowed or name in os.environ:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ[name] = value


load_env()


def configured() -> bool:
    return bool(os.environ.get("MYSQL_HOST") and os.environ.get("MYSQL_USER") and os.environ.get("MYSQL_DATABASE"))


def connect():
    if not configured():
        raise RuntimeError("MYSQL_HOST, MYSQL_USER, dan MYSQL_DATABASE wajib dikonfigurasi")
    return pymysql.connect(host=os.environ["MYSQL_HOST"], port=int(os.environ.get("MYSQL_PORT", "3306")), user=os.environ["MYSQL_USER"], password=os.environ.get("MYSQL_PASSWORD", ""), database=os.environ["MYSQL_DATABASE"], charset="utf8mb4", cursorclass=DictCursor, autocommit=False, connect_timeout=5)


@contextmanager
def transaction():
    connection = connect()
    try:
        with connection.cursor() as cursor:
            yield connection, cursor
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def ensure_schema() -> None:
    required = (
        "operator_size_presets",
        "operator_layout_jobs",
        "stock_items",
        "stock_item_categories",
        "stock_movements",
    )
    try:
        with transaction() as (_, cursor):
            for table in required:
                cursor.execute(f"SELECT 1 FROM `{table}` LIMIT 1")
    except pymysql.err.ProgrammingError as exc:
        if getattr(exc, "args", [None])[0] == 1146:
            raise RuntimeError(
                "Schema MySQL operator belum diimport. Jalankan apps/customer/migrate_operator_mysql.sql "
                "sebagai database administrator terlebih dahulu."
            ) from exc
        raise


def account_table() -> str:
    with transaction() as (_, cursor):
        cursor.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='accounts' LIMIT 1")
        row = cursor.fetchone()
    if not row:
        raise RuntimeError("Tabel accounts belum tersedia. Jalankan apps/customer/migrate_account_roles.sql sebagai administrator MySQL.")
    return row["TABLE_NAME"]


def _cashier_password_hash(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000).hex()


def users_by_role(role: str) -> list[dict]:
    table = account_table()
    with transaction() as (_, cursor):
        cursor.execute(f"SELECT id, username, display_name, role, is_active, created_at, updated_at FROM `{table}` WHERE role=%s ORDER BY id", (role,))
        rows = list(cursor.fetchall())
    for row in rows:
        row["is_active"] = bool(row["is_active"])
        for field in ("created_at", "updated_at"):
            if hasattr(row.get(field), "isoformat"):
                row[field] = row[field].isoformat(sep=" ")
    return rows


def _employee_login(username: str, password: str, expected_role: str) -> dict:
    table = account_table()
    with transaction() as (_, cursor):
        cursor.execute(f"SELECT id, username, display_name, role, password_salt, password_hash, is_active FROM `{table}` WHERE username=%s AND role=%s LIMIT 1", (username.strip(), expected_role))
        row = cursor.fetchone()
    if not row or not row["is_active"] or not hmac.compare_digest(_cashier_password_hash(password, row["password_salt"]), row["password_hash"]):
        raise ValueError("Nama akun atau password kasir salah")
    return {"id": row["id"], "username": row["username"], "display_name": row["display_name"], "role": row["role"]}


def cashier_login(username: str, password: str) -> dict:
    return _employee_login(username, password, "cashier")


def update_cashier_user(user_id: int, payload: dict) -> dict:
    display_name = str(payload.get("display_name", "")).strip()
    password = str(payload.get("password", "")).strip()
    if not display_name:
        raise ValueError("Nama akun wajib diisi")
    table = account_table()
    with transaction() as (_, cursor):
        cursor.execute(f"SELECT id FROM `{table}` WHERE id=%s LIMIT 1", (user_id,))
        if cursor.fetchone() is None:
            raise ValueError("Akun kasir tidak ditemukan")
        if password:
            salt = os.urandom(16).hex()
            cursor.execute(f"UPDATE `{table}` SET display_name=%s, password_salt=%s, password_hash=%s WHERE id=%s", (display_name, salt, _cashier_password_hash(password, salt), user_id))
        else:
            cursor.execute(f"UPDATE `{table}` SET display_name=%s WHERE id=%s", (display_name, user_id))
        cursor.execute(f"SELECT id, username, display_name, role, is_active FROM `{table}` WHERE id=%s", (user_id,))
        row = cursor.fetchone()
    row["is_active"] = bool(row["is_active"])
    return row


def operator_users() -> list[dict]:
    return users_by_role("operator")


def operator_login(username: str, password: str) -> dict:
    return _employee_login(username, password, "operator")


def products() -> list[dict]:
    with transaction() as (_, cursor):
        cursor.execute("SELECT name FROM products WHERE is_active=1 ORDER BY id")
        products = [{"name": row["name"], "sizes": []} for row in cursor.fetchall()]
        cursor.execute("SELECT product_name, size FROM operator_size_presets ORDER BY product_name, id")
        sizes = {}
        for row in cursor.fetchall(): sizes.setdefault(row["product_name"], []).append(row["size"])
    for product in products: product["sizes"] = sizes.get(product["name"], []) + ["Custom"]
    return products


def seed_operator_catalog(product_sizes: dict[str, list[str]]) -> None:
    with transaction() as (_, cursor):
        for product, sizes in product_sizes.items():
            slug = product.lower().replace(" ", "-")
            cursor.execute("""INSERT INTO products(name, slug, category, product_type, kind, unit, base_price, image_path, sizes_json, is_active)
                VALUES (%s,%s,'operator','Operator product','custom','pcs',0,'',%s,1)
                ON DUPLICATE KEY UPDATE is_active=1""", (product, slug, json.dumps(sizes, ensure_ascii=False)))
            for size in sizes:
                if size == "Custom":
                    continue
                cursor.execute("INSERT IGNORE INTO operator_size_presets(product_name, size, unit) VALUES (%s,%s,'cm')", (product, size))


def presets() -> list[dict]:
    with transaction() as (_, cursor):
        cursor.execute("SELECT id, product_name AS product, size, unit, created_at FROM operator_size_presets ORDER BY product_name, id")
        return list(cursor.fetchall())


def layouts() -> list[dict]:
    with transaction() as (_, cursor):
        cursor.execute("SELECT id, customer_name, product_name AS product, size, finishing, color_mode, pack, rename_enabled, raw_name, output_name, raw_path, output_path, detail_path, status, error_message, created_at, scale_up, output_format FROM operator_layout_jobs ORDER BY created_at DESC")
        rows = list(cursor.fetchall())
    for row in rows:
        if hasattr(row.get("created_at"), "isoformat"):
            row["created_at"] = row["created_at"].isoformat(sep=" ")
        row["created"] = row["created_at"]
    return rows


def layout(layout_id: str) -> dict | None:
    with transaction() as (_, cursor):
        cursor.execute("SELECT id, customer_name, product_name AS product, size, finishing, color_mode, pack, rename_enabled, raw_name, output_name, raw_path, output_path, detail_path, status, error_message, created_at, scale_up, output_format FROM operator_layout_jobs WHERE id=%s", (layout_id,))
        row = cursor.fetchone()
    if row and hasattr(row.get("created_at"), "isoformat"):
        row["created_at"] = row["created_at"].isoformat(sep=" ")
    return row


def next_client_number() -> int:
    with transaction() as (_, cursor):
        cursor.execute("SELECT COUNT(*) AS total FROM operator_layout_jobs WHERE rename_enabled=0")
        return int(cursor.fetchone()["total"]) + 1


def insert_layout(row: dict) -> None:
    with transaction() as (_, cursor):
        cursor.execute("""INSERT INTO operator_layout_jobs
            (id, customer_name, product_name, size, finishing, color_mode, pack, rename_enabled, raw_name, output_name, raw_path, output_path, detail_path, status, error_message, created_at, scale_up, output_format)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (row["id"], row["customer_name"], row["product"], row["size"], row["finishing"], row["color_mode"], row["pack"], row["rename_enabled"], row["raw_name"], row["output_name"], row["raw_path"], row["output_path"], row["detail_path"], row["status"], row["error_message"], row["created_at"], row["scale_up"], row["output_format"]))


def add_preset(product: str, size: str, unit: str) -> dict:
    with transaction() as (_, cursor):
        cursor.execute("INSERT INTO operator_size_presets(product_name, size, unit) VALUES (%s,%s,%s)", (product, size, unit))
        return {"id": cursor.lastrowid, "product": product, "size": size, "unit": unit}


def delete_preset(preset_id: int) -> bool:
    with transaction() as (_, cursor):
        cursor.execute("DELETE FROM operator_size_presets WHERE id=%s", (preset_id,))
        return cursor.rowcount > 0


def stock_rows(category: str = "") -> list[dict]:
    params: list[str] = []
    where = ""
    if category in {"A3", "Indoor", "Outdoor"}:
        where = "WHERE EXISTS (SELECT 1 FROM stock_item_categories cx WHERE cx.item_id=s.id AND cx.category=%s)"
        params.append(category)
    with transaction() as (_, cursor):
        cursor.execute(f"SELECT s.id, s.name, s.unit, s.quantity, s.reorder_level, s.active, GROUP_CONCAT(c.category ORDER BY c.category SEPARATOR ', ') AS categories FROM stock_items s LEFT JOIN stock_item_categories c ON c.item_id=s.id {where} GROUP BY s.id ORDER BY s.name", tuple(params))
        rows = list(cursor.fetchall())
    for row in rows:
        row["quantity"] = float(row["quantity"])
        row["reorder_level"] = float(row["reorder_level"])
        row["active"] = bool(row["active"])
        row["categories"] = [value.strip() for value in (row.get("categories") or "").split(",") if value.strip()]
        row["low_stock"] = row["quantity"] <= row["reorder_level"]
    return rows


def stock_movements(limit: int = 100, category: str = "") -> list[dict]:
    params: list[object] = []
    where = ""
    if category in {"A3", "Indoor", "Outdoor"}:
        where = "WHERE m.category=%s"; params.append(category)
    params.append(max(1, min(int(limit), 500)))
    with transaction() as (_, cursor):
        cursor.execute(f"SELECT m.id, m.item_id, s.name, s.unit, m.category, m.movement_type, m.quantity, m.balance_after, m.reference, m.note, m.created_at FROM stock_movements m JOIN stock_items s ON s.id=m.item_id {where} ORDER BY m.id DESC LIMIT %s", tuple(params))
        rows = list(cursor.fetchall())
    for row in rows:
        row["quantity"] = float(row["quantity"])
        row["balance_after"] = float(row["balance_after"])
        if hasattr(row.get("created_at"), "isoformat"): row["created_at"] = row["created_at"].isoformat(sep=" ")
    return rows


def stock_summary() -> dict:
    with transaction() as (_, cursor):
        cursor.execute("SELECT COUNT(*) AS items, COALESCE(SUM(quantity),0) AS quantity, SUM(quantity <= reorder_level) AS low_stock FROM stock_items WHERE active=1")
        summary = cursor.fetchone()
        cursor.execute("SELECT COUNT(*) AS movements FROM stock_movements")
        summary["movements"] = cursor.fetchone()["movements"]
    return {"items": int(summary["items"]), "quantity": float(summary["quantity"]), "low_stock": int(summary["low_stock"] or 0), "movements": int(summary["movements"])}


def seed_stock(seed: dict, units: dict) -> None:
    with transaction() as (_, cursor):
        for category, names in seed.items():
            for name in names:
                cursor.execute("INSERT INTO stock_items(name, unit) VALUES (%s,%s) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)", (name, units[category]))
                item_id = cursor.lastrowid
                cursor.execute("INSERT IGNORE INTO stock_item_categories(item_id, category) VALUES (%s,%s)", (item_id, category))


def add_stock_item(payload: dict) -> dict:
    name = str(payload.get("name", "")).strip(); unit = str(payload.get("unit", "pcs")).strip() or "pcs"
    categories = [value for value in payload.get("categories", []) if value in {"A3", "Indoor", "Outdoor"}]
    if not name or not categories: raise ValueError("Nama bahan dan minimal satu kategori wajib diisi")
    with transaction() as (_, cursor):
        cursor.execute("INSERT INTO stock_items(name, unit, reorder_level) VALUES (%s,%s,%s)", (name, unit, float(payload.get("reorder_level", 0) or 0)))
        item_id = cursor.lastrowid
        cursor.executemany("INSERT INTO stock_item_categories(item_id, category) VALUES (%s,%s)", [(item_id, category) for category in categories])
    return next(row for row in stock_rows() if row["id"] == item_id)


def add_stock_movement(payload: dict) -> dict:
    item_id = int(payload.get("item_id")); quantity = float(payload.get("quantity")); movement_type = str(payload.get("movement_type", "in"))
    if quantity <= 0 or movement_type not in {"in", "out", "adjustment"}: raise ValueError("Jenis atau jumlah pergerakan stok tidak valid")
    with transaction() as (_, cursor):
        cursor.execute("SELECT quantity FROM stock_items WHERE id=%s AND active=1 FOR UPDATE", (item_id,)); item = cursor.fetchone()
        if not item: raise ValueError("Bahan stok tidak ditemukan")
        current = float(item["quantity"]); balance = current + quantity if movement_type == "in" else quantity if movement_type == "adjustment" else current - quantity
        if balance < 0: raise ValueError("Stok tidak cukup")
        category = str(payload.get("category", "")); cursor.execute("UPDATE stock_items SET quantity=%s WHERE id=%s", (balance, item_id))
        cursor.execute("INSERT INTO stock_movements(item_id,category,movement_type,quantity,balance_after,reference,note) VALUES (%s,%s,%s,%s,%s,%s,%s)", (item_id, category, movement_type, quantity, balance, str(payload.get("reference", "")), str(payload.get("note", ""))))
        movement_id = cursor.lastrowid
    return next(row for row in stock_movements(500) if row["id"] == movement_id)
