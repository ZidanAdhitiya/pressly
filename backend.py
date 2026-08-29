#!/usr/bin/env python3
"""Local operator workspace for quick prepress layout jobs."""
from __future__ import annotations

import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import threading
import uuid
from datetime import datetime, timezone
from email.parser import BytesParser
from email.policy import default
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from prepress_engine import convert_layout, detect_colorspace

SOURCE_ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
if getattr(sys, "frozen", False):
    if os.environ.get("PRESSLY_DATA_DIR"):
        ROOT = Path(os.environ["PRESSLY_DATA_DIR"]).expanduser().resolve()
    elif os.name == "nt":
        ROOT = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Pressly"
    else:
        ROOT = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "Pressly"
else:
    ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "pressly.db"
STORAGE = ROOT / "storage"
HOST = os.environ.get("PRESSLY_HOST", "127.0.0.1")
PORT = int(os.environ.get("PRESSLY_PORT", "8080"))
MAX_UPLOAD = 50 * 1024 * 1024
DB_LOCK = threading.RLock()

PRODUCTS = {
    "Banner": ["300x100 cm", "400x100 cm", "Custom"],
    "X-Banner": ["60x160 cm", "80x180 cm", "Custom"],
    "Spanduk": ["100x300 cm", "100x400 cm", "Custom"],
    "Sticker": ["A4", "A3", "Custom"],
    "Poster": ["A4", "A3", "A2", "Custom"],
    "Kartu Nama": ["9x5.5 cm", "Custom"],
}
FINISHINGS = {
    "Matik": {"left_cm": 2.5, "right_cm": 2.5, "top_cm": 2.5, "bottom_cm": 2.5},
    "Selongsong": {"left_cm": 2.5, "right_cm": 2.5, "top_cm": 8.0, "bottom_cm": 8.0},
    "Roll Banner": {"left_cm": 2.5, "right_cm": 2.5, "top_cm": 2.5, "bottom_cm": 8.0},
}
SIZE_NAME_PRESETS = {"A2", "A3", "A4"}
OUTPUT_FORMATS = {"PDF": "pdf", "JPG": "jpg", "PNG": "png"}
SIZE_UNITS = {"cm", "mm", "m"}
ALLOWED = {"jpg", "jpeg", "png", "pdf"}
STATIC_FILES = {"index.html", "app.js", "dashboard.html", "dashboard.js", "styles.css", "ui-overrides.css", "modal.css"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    STORAGE.mkdir(parents=True, exist_ok=True)
    with DB_LOCK, get_db() as db:
        db.execute(
            """CREATE TABLE IF NOT EXISTS layout_jobs (
                id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, product TEXT NOT NULL,
                size TEXT NOT NULL, finishing TEXT NOT NULL DEFAULT '', color_mode TEXT NOT NULL DEFAULT 'Original',
                pack TEXT NOT NULL DEFAULT '', rename_enabled INTEGER NOT NULL,
                raw_name TEXT NOT NULL, output_name TEXT NOT NULL, raw_path TEXT NOT NULL,
                output_path TEXT NOT NULL, detail_path TEXT NOT NULL, status TEXT NOT NULL,
                error_message TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
                scale_up INTEGER NOT NULL DEFAULT 1,
                output_format TEXT NOT NULL DEFAULT 'PDF',
                FOREIGN KEY(product) REFERENCES products(name)
            )"""
        )
        # Existing databases from the earlier prototype may not have products.
        db.execute("CREATE TABLE IF NOT EXISTS products (name TEXT PRIMARY KEY)")
        for product in PRODUCTS:
            db.execute("INSERT OR IGNORE INTO products(name) VALUES (?)", (product,))
        db.execute(
            """CREATE TABLE IF NOT EXISTS product_size_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product TEXT NOT NULL,
                size TEXT NOT NULL,
                unit TEXT NOT NULL DEFAULT 'cm',
                created_at TEXT NOT NULL,
                UNIQUE(product, size),
                FOREIGN KEY(product) REFERENCES products(name)
            )"""
        )
        preset_columns = {row[1] for row in db.execute("PRAGMA table_info(product_size_presets)")}
        if "unit" not in preset_columns:
            db.execute("ALTER TABLE product_size_presets ADD COLUMN unit TEXT NOT NULL DEFAULT 'cm'")
        for product, sizes in PRODUCTS.items():
            for size in sizes:
                if size != "Custom":
                    db.execute(
                        "INSERT OR IGNORE INTO product_size_presets (product, size, unit, created_at) VALUES (?, ?, ?, ?)",
                        (product, size, "cm", now()),
                    )
        columns = {row[1] for row in db.execute("PRAGMA table_info(layout_jobs)")}
        if "color_mode" not in columns:
            db.execute("ALTER TABLE layout_jobs ADD COLUMN color_mode TEXT NOT NULL DEFAULT 'Original'")
        if "pack" not in columns:
            db.execute("ALTER TABLE layout_jobs ADD COLUMN pack TEXT NOT NULL DEFAULT ''")
        if "scale_up" not in columns:
            db.execute("ALTER TABLE layout_jobs ADD COLUMN scale_up INTEGER NOT NULL DEFAULT 1")
        if "output_format" not in columns:
            db.execute("ALTER TABLE layout_jobs ADD COLUMN output_format TEXT NOT NULL DEFAULT 'PDF'")
        db.commit()


def list_products() -> list[dict]:
    with DB_LOCK, get_db() as db:
        rows = db.execute("SELECT product, size FROM product_size_presets ORDER BY product, id").fetchall()
    sizes_by_product = {name: [] for name in PRODUCTS}
    for row in rows:
        sizes_by_product.setdefault(row["product"], []).append(row["size"])
    return [{"name": name, "sizes": sizes_by_product[name] + ["Custom"]} for name in PRODUCTS]


def list_size_presets() -> list[dict]:
    with DB_LOCK, get_db() as db:
        rows = db.execute("SELECT id, product, size, unit, created_at FROM product_size_presets ORDER BY product, id").fetchall()
    return [dict(row) for row in rows]


def parse_dimension(value: str) -> tuple[float, float, str] | None:
    match = re.fullmatch(r"\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?\s*", value, re.IGNORECASE)
    if not match:
        return None
    width = float(match.group(1).replace(",", "."))
    height = float(match.group(2).replace(",", "."))
    unit = (match.group(3) or "cm").lower()
    if width <= 0 or height <= 0 or unit not in SIZE_UNITS:
        return None
    return width, height, unit


def valid_dimension(value: str) -> bool:
    if value in SIZE_NAME_PRESETS:
        return True
    return parse_dimension(value) is not None


def slug(value: str) -> str:
    result = "_".join("".join(c.lower() if c.isalnum() else " " for c in value).split())
    return result or "untitled"


def safe_component(value: str) -> str:
    return Path(slug(value)).name[:80]


def unique_file_path(folder: Path, stem: str, extension: str) -> Path:
    """Return a non-overwriting path for a repeated customer/job."""
    candidate = folder / f"{stem}.{extension}"
    counter = 2
    while candidate.exists():
        candidate = folder / f"{stem}-{counter}.{extension}"
        counter += 1
    return candidate


def next_client_label() -> str:
    with DB_LOCK, get_db() as db:
        used = db.execute("SELECT COUNT(*) FROM layout_jobs WHERE rename_enabled=0").fetchone()[0]
    return f"client {used + 1}"


def row_dict(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["rename_enabled"] = bool(data["rename_enabled"])
    data["created"] = datetime.fromisoformat(data["created_at"]).astimezone().strftime("%d %b %Y · %H:%M")
    return data


def list_layouts() -> list[dict]:
    with DB_LOCK, get_db() as db:
        rows = db.execute("SELECT * FROM layout_jobs ORDER BY created_at DESC").fetchall()
    return [row_dict(row) for row in rows]


def get_layout(layout_id: str) -> dict | None:
    with DB_LOCK, get_db() as db:
        row = db.execute("SELECT * FROM layout_jobs WHERE id=?", (layout_id,)).fetchone()
    return row_dict(row) if row else None


class Handler(BaseHTTPRequestHandler):
    server_version = "Fazima PrintLocal/2.0"

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {fmt % args}")

    def send_json(self, value: dict | list, status=HTTPStatus.OK):
        payload = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            return self.send_json({"ok": True, "service": "Fazima Print-local", "mode": "operator-only"})
        if parsed.path == "/api/products":
            return self.send_json(list_products())
        if parsed.path == "/api/size-presets":
            return self.send_json(list_size_presets())
        if parsed.path == "/api/layouts":
            return self.send_json(list_layouts())
        if parsed.path.startswith("/api/layouts/"):
            parts = parsed.path.strip("/").split("/")
            # /api/layouts/<layout_id>/files/<raw|output|detail>
            if len(parts) == 5 and parts[3] == "files":
                return self.serve_layout_file(parts[2], parts[4])
            layout = get_layout(parts[-1])
            return self.send_json(layout or {"error": "Layout tidak ditemukan"}, HTTPStatus.OK if layout else HTTPStatus.NOT_FOUND)
        return self.serve_static(parsed.path)

    def serve_layout_file(self, layout_id: str, kind: str):
        layout = get_layout(layout_id)
        if not layout or kind not in {"raw", "output", "detail"}:
            return self.send_json({"error": "File tidak ditemukan"}, HTTPStatus.NOT_FOUND)
        path_key = {"raw": "raw_path", "output": "output_path", "detail": "detail_path"}[kind]
        candidate = (ROOT / layout[path_key]).resolve()
        if ROOT not in candidate.parents or not candidate.is_file():
            return self.send_json({"error": "File tidak ditemukan"}, HTTPStatus.NOT_FOUND)
        content = candidate.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mimetypes.guess_type(str(candidate))[0] or "application/octet-stream")
        self.send_header("Content-Disposition", f'attachment; filename="{candidate.name}"')
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/size-presets":
            try:
                return self.create_size_preset()
            except (ValueError, KeyError, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        if path != "/api/layouts":
            return self.send_json({"error": "Endpoint tidak ditemukan"}, HTTPStatus.NOT_FOUND)
        try:
            return self.create_layout()
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_DELETE(self):
        parts = urlparse(self.path).path.strip("/").split("/")
        if len(parts) != 3 or parts[:2] != ["api", "size-presets"]:
            return self.send_json({"error": "Endpoint tidak ditemukan"}, HTTPStatus.NOT_FOUND)
        try:
            preset_id = int(parts[2])
        except ValueError:
            return self.send_json({"error": "ID preset tidak valid"}, HTTPStatus.BAD_REQUEST)
        with DB_LOCK, get_db() as db:
            cursor = db.execute("DELETE FROM product_size_presets WHERE id=?", (preset_id,))
            db.commit()
        if cursor.rowcount == 0:
            return self.send_json({"error": "Preset ukuran tidak ditemukan"}, HTTPStatus.NOT_FOUND)
        return self.send_json({"ok": True, "deleted_id": preset_id})

    def create_size_preset(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 16 * 1024:
            return self.send_json({"error": "Data preset tidak valid"}, HTTPStatus.BAD_REQUEST)
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        product = str(payload.get("product", "")).strip()
        width = str(payload.get("width", "")).strip()
        height = str(payload.get("height", "")).strip()
        unit = str(payload.get("unit", "cm")).strip().lower()
        size = f"{width}x{height} {unit}" if width and height else str(payload.get("size", "")).strip()
        if product not in PRODUCTS:
            raise ValueError("Tipe produk tidak valid")
        if not valid_dimension(size) or size in SIZE_NAME_PRESETS:
            raise ValueError("Ukuran harus berupa angka dan unit cm, mm, atau m")
        parsed = parse_dimension(size)
        assert parsed is not None
        width_value, height_value, normalized_unit = parsed
        size = f"{width_value:g}x{height_value:g} {normalized_unit}"
        with DB_LOCK, get_db() as db:
            try:
                cursor = db.execute(
                    "INSERT INTO product_size_presets (product, size, unit, created_at) VALUES (?, ?, ?, ?)",
                    (product, size, normalized_unit, now()),
                )
                db.commit()
            except sqlite3.IntegrityError:
                raise ValueError("Preset ukuran tersebut sudah ada")
        return self.send_json({"id": cursor.lastrowid, "product": product, "size": size, "unit": normalized_unit}, HTTPStatus.CREATED)

    def create_layout(self):
        content_type = self.headers.get("Content-Type", "")
        length = int(self.headers.get("Content-Length", "0"))
        if "multipart/form-data" not in content_type:
            return self.send_json({"error": "Gunakan multipart/form-data"}, HTTPStatus.BAD_REQUEST)
        if length <= 0 or length > MAX_UPLOAD + 1024 * 1024:
            return self.send_json({"error": "Ukuran upload melebihi batas 50 MB"}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        raw_request = self.rfile.read(length)
        message = BytesParser(policy=default).parsebytes((f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n").encode() + raw_request)
        fields, file_name, file_bytes = {}, "", b""
        for part in message.iter_parts():
            name = part.get_param("name", header="Content-Disposition")
            filename = part.get_filename()
            if filename:
                file_name, file_bytes = filename, part.get_payload(decode=True) or b""
            elif name:
                fields[name] = part.get_content()

        product = str(fields.get("product", "")).strip()
        if product not in PRODUCTS:
            raise ValueError("Pilih tipe produk terlebih dahulu")
        if not file_name:
            raise ValueError("File desain wajib dipilih")
        extension = Path(file_name).suffix.lower().lstrip(".")
        if extension not in ALLOWED:
            raise ValueError("Format file harus JPG, PNG, atau PDF")
        if len(file_bytes) > MAX_UPLOAD:
            return self.send_json({"error": "Ukuran file melebihi batas 50 MB"}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)

        requested_customer = str(fields.get("customer", "")).strip()
        rename_enabled = bool(requested_customer)
        customer = requested_customer or next_client_label()
        size = str(fields.get("size", "")).strip() or "belum diisi"
        if size == "belum diisi" or not valid_dimension(size):
            raise ValueError("Ukuran harus dipilih atau diisi dengan format seperti 160x200 cm")
        finishing = str(fields.get("finishing", "")).strip()
        if finishing and finishing not in FINISHINGS:
            raise ValueError("Finishing harus Matik, Selongsong, atau Roll Banner")
        color_mode = str(fields.get("color_mode", "Original")).strip() or "Original"
        if color_mode not in {"Original", "RGB", "CMYK", "Grayscale"}:
            raise ValueError("Setting warna tidak valid")
        output_format = str(fields.get("output_format", "PDF")).strip().upper() or "PDF"
        if output_format not in OUTPUT_FORMATS:
            raise ValueError("Format output harus PDF, JPG, atau PNG")
        pack = str(fields.get("pack", "")).strip()
        scale_up = str(fields.get("scale_up", "true")).lower() in {"1", "true", "on", "yes"}
        customer_dir = safe_component(customer)
        folder = STORAGE / product / customer_dir
        folder.mkdir(parents=True, exist_ok=True)
        layout_id = f"LYT-{secrets.token_hex(4).upper()}"
        raw_path = unique_file_path(folder, "raw", extension)
        name_parts = [slug(customer), slug(product), slug(size)]
        if finishing:
            name_parts.append(slug(finishing))
        output_extension = OUTPUT_FORMATS[output_format]
        output_path = unique_file_path(folder, "_".join(name_parts), output_extension)
        detail_path = unique_file_path(folder, "detail", "txt")
        raw_path.write_bytes(file_bytes)
        output_label = output_path.stem
        convert_layout(raw_path, output_path, product, size, color_mode, finishing, scale_up, output_label)
        output_colorspace = detect_colorspace(output_path)
        timestamp = now()
        detail_path.write_text(
            "Fazima Print LOCAL LAYOUT DETAIL\n"
            f"layout_id: {layout_id}\ncreated_at_utc: {timestamp}\ncustomer: {customer}\n"
            f"product: {product}\nsize: {size}\nfinishing: {finishing or 'belum diisi / dilewati'}\n"
            f"color_mode: {color_mode}\npack: {pack or 'belum diisi / dilewati'}\n"
            f"finishing_allowance_cm: {FINISHINGS.get(finishing, 'none')}\n"
            f"scale_up: {'yes' if scale_up else 'no'}\noutput_colorspace: {output_colorspace}\n"
            "guide_lines: thin black line at the design boundary and final outer edge; included within finishing allowance\n"
            f"top_label: {output_label if FINISHINGS.get(finishing, {}).get('top_cm', 0) else 'not rendered; no top finishing space'}\n"
            f"rename_enabled: {'yes' if rename_enabled else 'no'}\ninput_name: {Path(file_name).name}\n"
            f"raw_file: {raw_path.name}\noutput_file: {output_path.name}\n"
            f"input_extension: .{extension}\noutput_format: {output_format}\noutput_extension: .{output_extension}\n"
            "engine: ImageMagick canvas layout; finishing is added outside the product area\n",
            encoding="utf-8",
        )
        with DB_LOCK, get_db() as db:
            db.execute(
                "INSERT INTO layout_jobs (id,customer_name,product,size,finishing,color_mode,pack,rename_enabled,raw_name,output_name,raw_path,output_path,detail_path,status,error_message,created_at,scale_up,output_format) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (layout_id, customer, product, size, finishing, color_mode, pack, int(rename_enabled), raw_path.name, output_path.name,
                 str(raw_path.relative_to(ROOT)), str(output_path.relative_to(ROOT)), str(detail_path.relative_to(ROOT)),
                 "DONE", "", timestamp, int(scale_up), output_format),
            )
            db.commit()
        return self.send_json(get_layout(layout_id), HTTPStatus.CREATED)

    def serve_static(self, path: str):
        relative = "index.html" if path in ("", "/") else path.lstrip("/")
        if relative not in STATIC_FILES:
            return self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        candidate = (SOURCE_ROOT / relative).resolve()
        if SOURCE_ROOT not in candidate.parents and candidate != SOURCE_ROOT:
            return self.send_json({"error": "Forbidden"}, HTTPStatus.FORBIDDEN)
        if not candidate.is_file():
            return self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        content = candidate.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mimetypes.guess_type(str(candidate))[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


if __name__ == "__main__":
    init_db()
    print(f"Fazima Print operator local: http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
