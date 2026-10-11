#!/usr/bin/env python3
"""Local operator workspace for quick prepress layout jobs."""
from __future__ import annotations

import json
import mimetypes
import os
import re
import secrets
import sys
import threading
import uuid
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.parser import BytesParser
from email.policy import default
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from prepress_engine import convert_layout, detect_colorspace
from operator_database import (add_preset, add_stock_item, add_stock_movement, configured as mysql_configured,
                               cashier_login, cashier_session_actor, create_cashier_session, revoke_cashier_session,
                               operator_login, operator_users, update_cashier_user, users_by_role,
                               delete_preset, ensure_schema, layouts as mysql_layouts, layout as mysql_layout,
                               next_client_number, presets as mysql_presets, products as mysql_products,
                               seed_operator_catalog, seed_stock, stock_movements as mysql_stock_movements,
                               stock_rows as mysql_stock_rows, stock_summary as mysql_stock_summary, insert_layout)
from cashier_database import (add_payment as cashier_add_payment, catalog_rows as cashier_catalog,
                              create_sale as cashier_create_sale, sale_detail as cashier_sale_detail,
                              sales_rows as cashier_sales, summary_data as cashier_summary,
                              void_sale as cashier_void_sale, material_rows as cashier_materials,
                              material_receipt_rows as cashier_material_receipts,
                              create_material_receipt as cashier_create_material_receipt,
                              material_stock_detail as cashier_material_stock_detail)
from cashier_database import web_order_notification_count, web_orders, mark_web_order_notifications_read

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
STORAGE = ROOT / "storage"
HOST = os.environ.get("PRESSLY_HOST", "127.0.0.1")
PORT = int(os.environ.get("PRESSLY_PORT", "8080"))
MAX_UPLOAD = 50 * 1024 * 1024
DB_LOCK = threading.RLock()
def issue_cashier_session(actor: dict) -> str:
    token = secrets.token_urlsafe(32)
    create_cashier_session(token, actor)
    return token


def cashier_actor_from_request(handler):
    authorization = handler.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None, None
    return token, cashier_session_actor(token)

PRODUCTS = {
    "Banner": ["300x100 cm", "400x100 cm", "Custom"],
    "X-Banner": ["60x160 cm", "80x180 cm", "Custom"],
    "Spanduk": ["100x300 cm", "100x400 cm", "Custom"],
    "Sticker": ["A4", "A3", "Custom"],
    "Poster": ["A4", "A3", "A2", "Custom"],
    "Kartu Nama": ["9x5.5 cm", "Custom"],
}
STOCK_CATEGORIES = ("A3", "Indoor", "Outdoor")
STOCK_SEED = {
    "A3": [
        "Stiker Hologram", "Stiker Vinyl Doff", "Stiker Vinyl Glossy", "Stiker Cromo", "Stiker HVS",
        "Stiker Silver", "Stiker Gold", "Artpaper 120", "Artpaper 150", "Artpaper 260", "Artpaper 310",
        "Artcarton 260", "Linen", "Concorde", "BC", "Jasmine",
    ],
    "Indoor": [
        "Stiker China", "Quantac/Camel", "Ritrama", "Graftac", "Transparan", "Hologram", "Blockout",
        "Oneway", "Backlite", "Miror", "Kulit Jeruk", "Albatros", "Luster",
    ],
    "Outdoor": ["Flexy China 260", "Flexy China 280", "Flexy China 340", "Korea 440", "Backlite", "Oneway"],
}
STOCK_DEFAULT_UNITS = {"A3": "lembar", "Indoor": "m³", "Outdoor": "m³"}
FINISHINGS = {
    "Matik": {"left_cm": 2.5, "right_cm": 2.5, "top_cm": 2.5, "bottom_cm": 2.5},
    "Selongsong": {"left_cm": 2.5, "right_cm": 2.5, "top_cm": 8.0, "bottom_cm": 8.0},
    "Roll Banner": {"left_cm": 2.5, "right_cm": 2.5, "top_cm": 2.5, "bottom_cm": 8.0},
}
SIZE_NAME_PRESETS = {"A2", "A3", "A4"}
OUTPUT_FORMATS = {"PDF": "pdf", "JPG": "jpg", "PNG": "png"}
SIZE_UNITS = {"cm", "mm", "m"}
ALLOWED = {"jpg", "jpeg", "png", "pdf"}
STATIC_FILES = {"index.html", "dashboard.html", "setting.html", "operator-dashboard.html", "website-dashboard.html", "app.js", "dashboard.js", "operator-dashboard.js", "operator-auth.js", "website-dashboard.js", "global-nav.js", "master-data.html", "cashier.html", "master-data.js", "cashier.js", "cashier-auth.js", "cashier-pages.js", "master-export.js", "master-stock.js", "master-stock-live.js", "master-cashier.js", "operator-dashboard.css", "operator-login.css", "global-nav.css", "cashier-login.css", "workflow.js", "icons.css", "styles.css", "hub.css", "workflow.css", "cashier.css", "cashier-redesign.css", "cashier-material.css", "cashier-pages.css", "master-data.css", "master-editor.css", "master-export.css", "master-stock.css", "website-dashboard.css", "website-dashboard-final.css", "website-dashboard-table.css", "ui-overrides.css", "modal.css", "assets/branding/fazima-print-logo.png", "assets/branding/fazima-print-icon.png"}
STATIC_FILES.add("cashier-web-orders.css")


def customer_api(path: str):
    """Read customer data through its existing API; never duplicate MySQL credentials here."""
    request = urllib.request.Request(f"http://127.0.0.1:8090{path}", headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=4) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError("Customer backend di port 8090 belum tersedia.") from exc


def customer_api_write(path: str, payload: dict | None = None, method: str = "PUT"):
    body = json.dumps(payload or {}, ensure_ascii=False).encode("utf-8") if method != "DELETE" else None
    request = urllib.request.Request(f"http://127.0.0.1:8090{path}", data=body, method=method, headers={"Accept": "application/json", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=6) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = json.loads(exc.read().decode("utf-8", errors="replace"))
        raise RuntimeError(detail.get("error", "Perubahan website ditolak.")) from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError("Customer backend di port 8090 belum tersedia.") from exc


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


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


# MySQL is the only persistence layer for the operator application.
def init_db() -> None:
    STORAGE.mkdir(parents=True, exist_ok=True)
    if not mysql_configured():
        raise RuntimeError("MySQL operator database belum dikonfigurasi")
    ensure_schema()
    seed_operator_catalog(PRODUCTS)
    seed_stock(STOCK_SEED, STOCK_DEFAULT_UNITS)


def list_products() -> list[dict]:
    return mysql_products()


def list_size_presets() -> list[dict]:
    return mysql_presets()


def list_stock(category: str = "") -> list[dict]:
    return mysql_stock_rows(category)


def list_stock_movements(limit: int = 100, category: str = "") -> list[dict]:
    return mysql_stock_movements(limit, category)


def stock_summary() -> dict:
    return mysql_stock_summary()


def create_stock_item(payload: dict) -> dict:
    return add_stock_item(payload)


def create_stock_movement(payload: dict) -> dict:
    return add_stock_movement(payload)


def next_client_label() -> str:
    return f"client {next_client_number()}"


def list_layouts() -> list[dict]:
    return mysql_layouts()


def get_layout(layout_id: str) -> dict | None:
    return mysql_layout(layout_id)


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

    def read_json(self, maximum=1024 * 1024):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > maximum:
            raise ValueError("Ukuran permintaan tidak valid")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self):
        parsed = urlparse(self.path)
        cashier_match = re.fullmatch(r"/api/cashier/(catalog|summary|sales(?:/\d+)?|materials(?:/\d+/history)?|receipts|web-orders|web-notifications)", parsed.path)
        if parsed.path == "/api/cashier/session" or cashier_match:
            try:
                _, actor = cashier_actor_from_request(self)
            except Exception as exc:
                print(f"Cashier session lookup error: {exc}")
                return self.send_json({"error": "Sesi Kasir sementara tidak dapat diperiksa karena database tidak tersedia."}, HTTPStatus.SERVICE_UNAVAILABLE)
            if not actor:
                return self.send_json({"error": "Sesi kasir berakhir. Silakan masuk kembali."}, HTTPStatus.UNAUTHORIZED)
            if parsed.path == "/api/cashier/session":
                return self.send_json(actor)
            if parsed.path == "/api/cashier/catalog":
                try:
                    return self.send_json(cashier_catalog())
                except Exception as exc:
                    print(f"Cashier catalog error: {exc}")
                    return self.send_json({"error": "Katalog kasir belum dapat dimuat. Periksa koneksi database dan Metadata."}, HTTPStatus.SERVICE_UNAVAILABLE)
            if parsed.path == "/api/cashier/web-orders":
                try:
                    return self.send_json(web_orders())
                except Exception as exc:
                    print(f"Cashier web order lookup error: {exc}")
                    return self.send_json({"error": "Daftar order web belum dapat dimuat."}, HTTPStatus.SERVICE_UNAVAILABLE)
            if parsed.path == "/api/cashier/web-notifications":
                try:
                    return self.send_json({"unread": web_order_notification_count()})
                except Exception as exc:
                    print(f"Cashier web notification lookup error: {exc}")
                    return self.send_json({"error": "Notifikasi order web belum dapat dimuat."}, HTTPStatus.SERVICE_UNAVAILABLE)
            if parsed.path == "/api/cashier/summary":
                try:
                    return self.send_json(cashier_summary(parse_qs(parsed.query).get("period", ["7d"])[0]))
                except Exception as exc:
                    print(f"Cashier summary error: {exc}")
                    return self.send_json({"error": "Ringkasan Kasir belum dapat dimuat. Periksa koneksi database."}, HTTPStatus.SERVICE_UNAVAILABLE)
            if parsed.path == "/api/cashier/materials":
                try:
                    return self.send_json(cashier_materials())
                except Exception as exc:
                    print(f"Cashier material list error: {exc}")
                    return self.send_json({"error": "Daftar material belum dapat dimuat. Periksa tabel material dan koneksi database."}, HTTPStatus.SERVICE_UNAVAILABLE)
            material_history_match = re.fullmatch(r"/api/cashier/materials/(\d+)/history", parsed.path)
            if material_history_match:
                try:
                    return self.send_json(cashier_material_stock_detail(int(material_history_match.group(1))))
                except ValueError as exc:
                    return self.send_json({"error": str(exc)}, HTTPStatus.NOT_FOUND)
                except Exception as exc:
                    print(f"Cashier material stock detail error: {exc}")
                    return self.send_json({"error": "Detail stok material belum dapat dimuat."}, HTTPStatus.SERVICE_UNAVAILABLE)
            if parsed.path == "/api/cashier/receipts":
                try:
                    return self.send_json(cashier_material_receipts())
                except Exception as exc:
                    print(f"Cashier material receipt history error: {exc}")
                    return self.send_json({"error": "Riwayat penerimaan material belum dapat dimuat."}, HTTPStatus.SERVICE_UNAVAILABLE)
            if cashier_match.group(1) == "sales":
                query = parse_qs(parsed.query)
                try:
                    return self.send_json(cashier_sales(query.get("q", [""])[0], query.get("status", [""])[0]))
                except Exception as exc:
                    print(f"Cashier history error: {exc}")
                    return self.send_json({"error": "Riwayat Kasir belum siap. Pastikan migrasi cashier POS sudah diterapkan."}, HTTPStatus.SERVICE_UNAVAILABLE)
            try:
                return self.send_json(cashier_sale_detail(int(cashier_match.group(1).split("/")[1])))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.NOT_FOUND)
            except Exception as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.SERVICE_UNAVAILABLE)
        if parsed.path == "/api/website/category-box-image":
            relative = parse_qs(parsed.query).get("path", [""])[0].lstrip("/")
            allowed = ("assets/real/gallery/", "assets/real/products/")
            candidate = (SOURCE_ROOT / "apps" / "customer" / relative).resolve()
            customer_root = (SOURCE_ROOT / "apps" / "customer").resolve()
            if not relative.startswith(allowed) or customer_root not in candidate.parents or not candidate.is_file():
                return self.send_json({"error": "Gambar kategori tidak ditemukan"}, HTTPStatus.NOT_FOUND)
            content = candidate.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", mimetypes.guess_type(str(candidate))[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(content)
            return
        if parsed.path == "/api/website/hero-image":
            relative = parse_qs(parsed.query).get("path", [""])[0].lstrip("/")
            allowed = ("assets/real/gallery/", "assets/real/products/", "assets/hero/")
            candidate = (SOURCE_ROOT / "apps" / "customer" / relative).resolve()
            customer_root = (SOURCE_ROOT / "apps" / "customer").resolve()
            if not relative.startswith(allowed) or customer_root not in candidate.parents or not candidate.is_file():
                return self.send_json({"error": "Gambar hero tidak ditemukan"}, HTTPStatus.NOT_FOUND)
            content = candidate.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", mimetypes.guess_type(str(candidate))[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(content)
            return
        if parsed.path == "/api/website/product-image":
            relative = parse_qs(parsed.query).get("path", [""])[0].lstrip("/")
            candidate = (SOURCE_ROOT / "apps" / "customer" / relative).resolve()
            customer_root = (SOURCE_ROOT / "apps" / "customer").resolve()
            if not relative.startswith("assets/products/") or customer_root not in candidate.parents or not candidate.is_file():
                return self.send_json({"error": "Gambar produk tidak ditemukan"}, HTTPStatus.NOT_FOUND)
            content = candidate.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", mimetypes.guess_type(str(candidate))[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(content)
            return
        if parsed.path == "/api/website/health":
            try:
                health = customer_api("/api/health")
                catalog = customer_api("/api/catalog")
                return self.send_json({**health, "catalog_count": len(catalog) if isinstance(catalog, list) else 0})
            except RuntimeError as exc:
                return self.send_json({"ok": False, "database_configured": False, "error": str(exc)}, HTTPStatus.SERVICE_UNAVAILABLE)
        website_routes = {
            "/api/website/catalog": "/api/catalog",
            "/api/website/admin-catalog": "/api/admin/catalog",
            "/api/website/hero-images": "/api/admin/hero-images",
            "/api/website/category-box-visuals": "/api/admin/category-box-visuals",
            "/api/website/categories": "/api/admin/categories",
            "/api/website/promo-settings": "/api/admin/promo-settings",
            "/api/website/orders": "/api/orders",
            "/api/website/chat-sessions": "/api/chat/sessions",
        }
        if parsed.path in website_routes:
            try:
                return self.send_json(customer_api(website_routes[parsed.path]))
            except RuntimeError as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.SERVICE_UNAVAILABLE)
        if parsed.path in {"/api/operator/production", "/api/operator/production-usage"}:
            try:
                return self.send_json(customer_api(self.path))
            except RuntimeError as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.SERVICE_UNAVAILABLE)
        if parsed.path.startswith("/api/website/chat-sessions/"):
            session_id = parsed.path.split("/", 4)[-1]
            try:
                return self.send_json(customer_api("/api/chat/sessions/" + session_id))
            except RuntimeError as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.SERVICE_UNAVAILABLE)
        if parsed.path == "/api/health":
            return self.send_json({"ok": True, "service": "Fazima Print-local", "mode": "operator-only"})
        if parsed.path == "/api/products":
            return self.send_json(list_products())
        if parsed.path == "/api/size-presets":
            return self.send_json(list_size_presets())
        if parsed.path == "/api/stock":
            category = parse_qs(parsed.query).get("category", [""])[0]
            return self.send_json(list_stock(category))
        if parsed.path == "/api/stock/summary":
            return self.send_json(stock_summary())
        if parsed.path == "/api/stock/movements":
            query = parse_qs(parsed.query)
            return self.send_json(list_stock_movements(query.get("limit", [100])[0], query.get("category", [""])[0]))
        if parsed.path == "/api/cashier/users":
            return self.send_json(users_by_role("cashier"))
        if parsed.path == "/api/operator/users":
            return self.send_json(operator_users())
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

    def do_PUT(self):
        parsed = urlparse(self.path)
        category_visual_match = re.fullmatch(r"/api/website/category-box-visuals/([a-z0-9_-]{1,100})", parsed.path)
        if category_visual_match:
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > 5 * 1024 * 1024:
                    return self.send_json({"error": "Ukuran gambar kategori tidak valid."}, HTTPStatus.BAD_REQUEST)
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                return self.send_json(customer_api_write(f"/api/admin/category-box-visuals/{category_visual_match.group(1)}", payload))
            except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        if parsed.path == "/api/website/hero-images":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > 36 * 1024 * 1024:
                    return self.send_json({"error": "Ukuran data gambar hero tidak valid."}, HTTPStatus.BAD_REQUEST)
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                return self.send_json(customer_api_write("/api/admin/hero-images", payload))
            except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        match = re.fullmatch(r"/api/cashier/users/(\d+)", parsed.path)
        if match:
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                return self.send_json(update_cashier_user(int(match.group(1)), payload))
            except (RuntimeError, ValueError, KeyError, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        if parsed.path == "/api/website/promo-settings":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                return self.send_json(customer_api_write("/api/admin/promo-settings", payload))
            except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        match = re.fullmatch(r"/api/website/(products|promotions|categories)/(\d+)", parsed.path)
        if not match:
            return self.send_json({"error": "Endpoint tidak ditemukan"}, HTTPStatus.NOT_FOUND)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            result = customer_api_write(f"/api/admin/{match.group(1)}/{match.group(2)}", payload)
            return self.send_json(result)
        except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)

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
        if path == "/api/cashier/login":
            try:
                payload = self.read_json(32000)
                actor = cashier_login(str(payload.get("username", "")), str(payload.get("password", "")))
                return self.send_json({**actor, "token": issue_cashier_session(actor)})
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.UNAUTHORIZED)
            except (RuntimeError, KeyError, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        if path in {"/api/cashier/logout", "/api/cashier/sales", "/api/cashier/receipts", "/api/cashier/web-notifications/read"} or re.fullmatch(r"/api/cashier/sales/\d+/(payments|void)", path):
            try:
                token, actor = cashier_actor_from_request(self)
            except Exception as exc:
                print(f"Cashier session lookup error: {exc}")
                return self.send_json({"error": "Sesi Kasir sementara tidak dapat diperiksa karena database tidak tersedia."}, HTTPStatus.SERVICE_UNAVAILABLE)
            if not actor:
                return self.send_json({"error": "Sesi kasir berakhir. Silakan masuk kembali."}, HTTPStatus.UNAUTHORIZED)
            if path == "/api/cashier/logout":
                try:
                    revoke_cashier_session(token)
                except Exception as exc:
                    print(f"Cashier logout error: {exc}")
                    return self.send_json({"error": "Logout gagal disimpan ke database. Coba lagi."}, HTTPStatus.SERVICE_UNAVAILABLE)
                return self.send_json({"ok": True})
            if path == "/api/cashier/web-notifications/read":
                try:
                    return self.send_json({"ok": True, "updated": mark_web_order_notifications_read()})
                except Exception as exc:
                    print(f"Cashier web notification update error: {exc}")
                    return self.send_json({"error": "Notifikasi order web belum dapat diperbarui."}, HTTPStatus.SERVICE_UNAVAILABLE)
            try:
                payload = self.read_json()
                if path == "/api/cashier/sales":
                    return self.send_json(cashier_create_sale(payload, actor), HTTPStatus.CREATED)
                if path == "/api/cashier/receipts":
                    return self.send_json(cashier_create_material_receipt(payload, actor), HTTPStatus.CREATED)
                match = re.fullmatch(r"/api/cashier/sales/(\d+)/(payments|void)", path)
                sale_id = int(match.group(1))
                if match.group(2) == "payments":
                    return self.send_json(cashier_add_payment(sale_id, payload, actor))
                return self.send_json(cashier_void_sale(sale_id, payload, actor))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception as exc:
                print(f"Cashier transaction error: {type(exc).__name__}: {exc}", flush=True)
                return self.send_json({"error": "Terjadi kesalahan internal saat menyimpan nota. Coba lagi; jika berulang, hubungi admin dengan waktu kejadian."}, HTTPStatus.INTERNAL_SERVER_ERROR)
        if path == "/api/operator/login":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                return self.send_json(operator_login(str(payload.get("username", "")), str(payload.get("password", ""))))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.UNAUTHORIZED)
            except (RuntimeError, KeyError, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        if path == "/api/operator/production-usage":
            try:
                length=int(self.headers.get("Content-Length","0"));payload=json.loads(self.rfile.read(length).decode("utf-8"))
                return self.send_json(customer_api_write(self.path,payload,"POST"),HTTPStatus.CREATED)
            except (RuntimeError,ValueError,KeyError,json.JSONDecodeError) as exc:
                return self.send_json({"error":str(exc)},HTTPStatus.BAD_REQUEST)
        match = re.fullmatch(r"/api/operator/production/([A-Za-z0-9_.~-]{1,50})/(start|complete)", path)
        if match:
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                return self.send_json(customer_api_write(self.path, payload, "POST"))
            except (RuntimeError, ValueError, KeyError, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        match = re.fullmatch(r"/api/website/products", path)
        if match:
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                return self.send_json(customer_api_write("/api/admin/products", payload, "POST"), HTTPStatus.CREATED)
            except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        if path == "/api/website/categories":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                return self.send_json(customer_api_write("/api/admin/categories", payload, "POST"), HTTPStatus.CREATED)
            except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        if path == "/api/size-presets":
            try:
                return self.create_size_preset()
            except (ValueError, KeyError, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        if path in {"/api/stock/items", "/api/stock/movements"}:
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                result = create_stock_item(payload) if path.endswith("/items") else create_stock_movement(payload)
                return self.send_json(result, HTTPStatus.CREATED)
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
        match = re.fullmatch(r"/api/website/products/(\d+)", urlparse(self.path).path)
        if match:
            try:
                return self.send_json(customer_api_write(f"/api/admin/products/{match.group(1)}", method="DELETE"))
            except (RuntimeError, ValueError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        match = re.fullmatch(r"/api/website/categories/(\d+)", urlparse(self.path).path)
        if match:
            try:
                return self.send_json(customer_api_write(f"/api/admin/categories/{match.group(1)}", method="DELETE"))
            except (RuntimeError, ValueError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        parts = urlparse(self.path).path.strip("/").split("/")
        if len(parts) != 3 or parts[:2] != ["api", "size-presets"]:
            return self.send_json({"error": "Endpoint tidak ditemukan"}, HTTPStatus.NOT_FOUND)
        try:
            preset_id = int(parts[2])
        except ValueError:
            return self.send_json({"error": "ID preset tidak valid"}, HTTPStatus.BAD_REQUEST)
        if not delete_preset(preset_id):
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
        try:
            result = add_preset(product, size, normalized_unit)
        except Exception as exc:
            if getattr(exc, "args", [None])[0] == 1062:
                raise ValueError("Preset ukuran tersebut sudah ada") from exc
            raise
        return self.send_json(result, HTTPStatus.CREATED)

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
        insert_layout({"id": layout_id, "customer_name": customer, "product": product, "size": size,
                       "finishing": finishing, "color_mode": color_mode, "pack": pack,
                       "rename_enabled": int(rename_enabled), "raw_name": raw_path.name,
                       "output_name": output_path.name, "raw_path": str(raw_path.relative_to(ROOT)),
                       "output_path": str(output_path.relative_to(ROOT)), "detail_path": str(detail_path.relative_to(ROOT)),
                       "status": "DONE", "error_message": "", "created_at": timestamp,
                       "scale_up": int(scale_up), "output_format": output_format})
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
