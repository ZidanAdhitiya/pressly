#!/usr/bin/env python3
"""Ephemeral customer-facing Fazima Print layout service.

This service deliberately has no local database, dashboard, history, or
permanent storage. Each request gets a temporary workspace with a short TTL.
"""
from __future__ import annotations

import base64
import json
import hashlib
import hmac
import mimetypes
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from email.parser import BytesParser
from email.policy import default
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
from prepress_engine import convert_layout, detect_colorspace, image_magick  # noqa: E402
from database import (DatabaseNotConfigured, catalog_rows, category_rows, cashier_decision, complete_production, create_category, create_manual_order, create_order, create_product, dashboard_notifications, dashboard_order_detail, dashboard_order_rows, delete_category, delete_product, mark_dashboard_notification, order_by_number, production_job_rows, production_usage_rows, record_production_usage, save_layout_for_order, setting_decision, start_production, transfer_order_to_cashier, update_category, configured as database_configured,
                      save_chat_message, chat_session_rows, chat_messages, save_payment_status, order_rows,
                      update_product, update_promotion, promo_timer_settings, update_promo_timer_settings)  # noqa: E402

def load_local_env() -> None:
    """Load only local, git-ignored secrets without adding a dotenv dependency."""
    env_path = Path(os.environ.get("MIDTRANS_ENV_FILE", Path(__file__).with_name(".env")))
    if not env_path.is_file():
        return
    if hasattr(os, "getuid") and env_path.stat().st_mode & 0o077:
        raise RuntimeError(f"Refusing insecure secret file permissions on {env_path}; run chmod 600 {env_path}")
    allowed = {"MIDTRANS_SERVER_KEY", "MIDTRANS_CLIENT_KEY", "MIDTRANS_IS_PRODUCTION", "MIDTRANS_FINISH_URL", "MIDTRANS_ENABLED_PAYMENTS", "MYSQL_HOST", "MYSQL_PORT", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE", "FIREBASE_API_KEY", "FIREBASE_AUTH_DOMAIN", "FIREBASE_PROJECT_ID", "FIREBASE_STORAGE_BUCKET", "FIREBASE_MESSAGING_SENDER_ID", "FIREBASE_APP_ID"}
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

load_local_env()
NOMINATIM_LOCK = threading.Lock()
NOMINATIM_LAST_REQUEST = 0.0
MIDTRANS_SERVER_KEY = os.environ.get("MIDTRANS_SERVER_KEY", "").strip()
MIDTRANS_CLIENT_KEY = os.environ.get("MIDTRANS_CLIENT_KEY", "").strip()
FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY", "").strip()
FIREBASE_AUTH_DOMAIN = os.environ.get("FIREBASE_AUTH_DOMAIN", "").strip()
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "").strip()
FIREBASE_STORAGE_BUCKET = os.environ.get("FIREBASE_STORAGE_BUCKET", "").strip()
FIREBASE_MESSAGING_SENDER_ID = os.environ.get("FIREBASE_MESSAGING_SENDER_ID", "").strip()
FIREBASE_APP_ID = os.environ.get("FIREBASE_APP_ID", "").strip()
MIDTRANS_PRODUCTION = os.environ.get("MIDTRANS_IS_PRODUCTION", "false").lower() in {"1", "true", "yes", "on"}
MIDTRANS_FINISH_URL = os.environ.get("MIDTRANS_FINISH_URL", "http://localhost:8090/order-history.html").strip()
MIDTRANS_API_URL = "https://api.midtrans.com/snap/v1/transactions" if MIDTRANS_PRODUCTION else "https://app.sandbox.midtrans.com/snap/v1/transactions"
MIDTRANS_SNAP_JS = "https://app.midtrans.com/snap/snap.js" if MIDTRANS_PRODUCTION else "https://app.sandbox.midtrans.com/snap/snap.js"
DEFAULT_ENABLED_PAYMENTS = ["credit_card", "dana", "other_qris", "bca_va", "bri_va", "bni_va", "permata_va", "echannel", "cimb_va", "indomaret", "alfamart"]
MIDTRANS_ENABLED_PAYMENTS = [item.strip() for item in os.environ.get("MIDTRANS_ENABLED_PAYMENTS", ",".join(DEFAULT_ENABLED_PAYMENTS)).split(",") if item.strip()]
ALLOWED_MIDTRANS_PAYMENTS = set(DEFAULT_ENABLED_PAYMENTS)
MIDTRANS_ENABLED_PAYMENTS = [item for item in MIDTRANS_ENABLED_PAYMENTS if item in ALLOWED_MIDTRANS_PAYMENTS] or DEFAULT_ENABLED_PAYMENTS
MIDTRANS_PAYMENT_LABELS = {
    "credit_card": "Credit/debit card", "gopay": "GoPay", "shopeepay": "ShopeePay", "dana": "DANA", "other_qris": "QRIS",
    "bca_va": "BCA Virtual Account", "bri_va": "BRI Virtual Account", "bni_va": "BNI Virtual Account", "permata_va": "Permata Virtual Account",
    "echannel": "Mandiri Bill Payment", "cimb_va": "CIMB Virtual Account", "indomaret": "Indomaret", "alfamart": "Alfamart",
}
MIDTRANS_SANDBOX_GUIDES = {
    "credit_card": {"label": "Kartu", "simulator": "https://docs.midtrans.com/docs/testing-payment-on-sandbox", "instruction": "Gunakan nomor kartu, expiry, CVV, dan OTP Sandbox dari panduan resmi."},
    "gopay": {"label": "GoPay", "simulator": "https://simulator.sandbox.midtrans.com/openapi/qris/index", "instruction": "Di desktop, salin URL QR ke QRIS Simulator; jangan scan dengan aplikasi GoPay asli."},
    "shopeepay": {"label": "ShopeePay", "simulator": "https://simulator.sandbox.midtrans.com/openapi/qris/index", "instruction": "Di desktop, salin URL QR ke QRIS Simulator; jangan gunakan ShopeePay asli."},
    "dana": {"label": "DANA", "simulator": "https://docs.midtrans.com/docs/testing-payment-on-sandbox", "instruction": "Ikuti simulator/credential DANA yang tersedia pada akun Sandbox."},
    "other_qris": {"label": "QRIS", "simulator": "https://simulator.sandbox.midtrans.com/openapi/qris/index", "instruction": "Salin URL QR ke QRIS Simulator, klik Scan QR, lalu selesaikan simulasi."},
    "bca_va": {"label": "BCA Virtual Account", "simulator": "https://simulator.sandbox.midtrans.com/bca/va/index", "instruction": "Masukkan nomor VA ke BCA VA Simulator lalu selesaikan simulasi."},
    "bri_va": {"label": "BRI Virtual Account", "simulator": "https://simulator.sandbox.midtrans.com/openapi/va/index?bank=bri", "instruction": "Masukkan nomor VA ke BRI VA Simulator lalu selesaikan simulasi."},
    "bni_va": {"label": "BNI Virtual Account", "simulator": "https://simulator.sandbox.midtrans.com/bni/va/index", "instruction": "Masukkan nomor VA ke BNI VA Simulator lalu selesaikan simulasi."},
    "permata_va": {"label": "Permata Virtual Account", "simulator": "https://simulator.sandbox.midtrans.com/openapi/va/index?bank=permata", "instruction": "Masukkan nomor VA ke Permata VA Simulator lalu selesaikan simulasi."},
    "echannel": {"label": "Mandiri Bill Payment", "simulator": "https://simulator.sandbox.midtrans.com/openapi/va/index?bank=mandiri", "instruction": "Masukkan company code dan bill key ke Mandiri Simulator."},
    "cimb_va": {"label": "CIMB Virtual Account", "simulator": "https://simulator.sandbox.midtrans.com/openapi/va/index?bank=cimb", "instruction": "Masukkan nomor VA ke CIMB VA Simulator lalu selesaikan simulasi."},
    "indomaret": {"label": "Indomaret", "simulator": "https://docs.midtrans.com/docs/testing-payment-on-sandbox", "instruction": "Gunakan payment code pada Indomaret Simulator dari panduan Sandbox."},
    "alfamart": {"label": "Alfamart", "simulator": "https://docs.midtrans.com/docs/testing-payment-on-sandbox", "instruction": "Gunakan payment code pada Alfamart Simulator dari panduan Sandbox."},
}
PAYMENT_STATUSES: dict[str, dict] = {}
PAYMENT_STATUSES_LOCK = threading.Lock()
LAYOUT_STORAGE_ROOT = Path(os.environ.get("FAZIMA_LAYOUT_STORAGE", Path(__file__).with_name("layout_storage"))).resolve()

PRODUCTS = {
    "Banner": ["3x1 m", "4x1 m", "Custom"],
    "X-Banner": ["0.6x1.6 m", "0.8x1.8 m", "Custom"],
    "Spanduk": ["1x3 m", "1x4 m", "Custom"],
    "Sticker": ["A3"],
    "Poster": ["A4", "A3", "A2", "Custom"],
    "Kartu Nama": ["9x5.5 cm", "Custom"],
    "Cetak Sertifikat": ["A4", "A3", "Custom"],
    "Stiker Chromo A3+": ["A3"],
    "Cetak Flyer/Brosur": ["A4", "A3", "Custom"],
    "Canvas Custom": ["A4", "A3", "Custom"],
    "Spanduk Banner": ["1x3 m", "1x4 m", "Custom"],
    "Cetak Kertas Kado": ["A4", "A3", "Custom"],
    "Gantungan Kunci": ["Custom"],
    "ID Card": ["Custom"],
    "Mini Banner": ["0.6x1.6 m", "Custom"],
    "Mug Custom": ["Custom"],
    "Roll Up Banner": ["0.8x2 m", "Custom"],
    "Stiker Meteran": ["A3"],
    "Stiker One Way": ["Custom"],
    "Stiker Transparan A3": ["A3"],
    "Stiker Vinyl A3+": ["A3"],
    "X/Y Banner": ["0.6x1.6 m", "Custom"],
    "Art Paper 120gsm": ["A4", "A3", "Custom"],
    "Art Paper 210gsm": ["A4", "A3", "Custom"],
    "Art Paper 150gsm": ["A4", "A3", "Custom"],
    "Art Paper 260gsm": ["A4", "A3", "Custom"],
    "Art Paper 310gsm": ["A4", "A3", "Custom"],
    "Tripod Banner": ["0.6x1.6 m", "Custom"],
}
PRODUCT_KINDS = {
    "Banner": "banner", "X-Banner": "banner", "Spanduk": "banner", "Spanduk Banner": "banner", "Mini Banner": "banner", "Roll Up Banner": "banner", "X/Y Banner": "banner", "Tripod Banner": "banner",
    "Sticker": "sticker", "Stiker Chromo A3+": "sticker", "Stiker Meteran": "sticker", "Stiker One Way": "sticker", "Stiker Transparan A3": "sticker", "Stiker Vinyl A3+": "sticker",
    "Cetak Kertas Kado": "paper", "Art Paper 120gsm": "paper", "Art Paper 150gsm": "paper", "Art Paper 210gsm": "paper", "Art Paper 260gsm": "paper", "Art Paper 310gsm": "paper", "Cetak Sertifikat": "paper", "Cetak Flyer/Brosur": "paper",
    "Canvas Custom": "canvas", "Poster": "poster", "Kartu Nama": "card", "ID Card": "card", "Gantungan Kunci": "merchandise", "Mug Custom": "merchandise",
}
STICKER_BULK_PRODUCTS = {"Sticker", "Stiker Chromo A3+", "Stiker Meteran", "Stiker Transparan A3", "Stiker Vinyl A3+"}
STICKER_SINGLE_PRODUCTS = {"Stiker One Way"}
FINISHINGS = {
    "Matik": {"top_cm": 2.5}, "Selongsong": {"top_cm": 8.0}, "Roll Banner": {"top_cm": 2.5},
}
FINISHING_PRODUCTS = {name for name, kind in PRODUCT_KINDS.items() if kind == "banner"}
OUTPUT_FORMATS = {"PDF": "pdf", "JPG": "jpg", "PNG": "png"}
ALLOWED = {"jpg", "jpeg", "png", "pdf"}
SIZE_NAME_PRESETS = {"A2", "A3", "A4"}
SIZE_LIMITS_M2 = {
    "Banner": (0.25, 1000), "X-Banner": (0.3, 100), "Spanduk": (0.25, 1000),
    "Sticker": (0.0004, 10), "Poster": (0.01, 100), "Kartu Nama": (0.0002, 0.1),
}
for _product in PRODUCTS:
    SIZE_LIMITS_M2.setdefault(_product, (0.0001, 1000))
STICKER_GAP_CM = 0.3
MOCKUPS = {
    # mockup, source width/height, destination corners (TL, TR, BR, BL)
    "Banner": ("banner.png", 1536, 1024, 1285, 614, ((126, 184), (1411, 184), (1411, 798), (126, 798))),
    "Spanduk": ("spanduk.png", 1536, 1024, 1290, 492, ((123, 256), (1413, 256), (1413, 748), (123, 748))),
    # Realistic three-quarter X-banner mockup. The calibrated panel corners
    # keep customer artwork visible while preserving the stand and shadows.
    "X-Banner": ("x-banner.png", 1024, 1536, 390, 1240, ((323, 125), (701, 98), (641, 1360), (258, 1320))),
    "Sticker": ("sticker.png", 1024, 1536, 800, 1185, ((110, 145), (910, 145), (910, 1330), (110, 1330))),
    # Inner print area of the photographed frame, not the surrounding wall.
    "Poster": ("poster.png", 1024, 1536, 558, 904, ((229, 221), (786, 177), (787, 1125), (230, 1080))),
    "Kartu Nama": ("kartu-nama.png", 1536, 1024, 800, 275, ((566, 322), (1367, 496), (1350, 771), (570, 602))),
}
# Tuned independently from the surface polygon: stronger fabric movement
# without changing the artwork's calibrated placement.
MOCKUP_WAVES = {"Banner": (9, 520), "Spanduk": (7, 520)}
MOCKUP_TEXTURE_STRENGTH = {
    "Banner": 22, "Spanduk": 22, "X-Banner": 15,
    "Sticker": 38, "Poster": 36, "Kartu Nama": 34,
}


def valid_dimension(value: str) -> bool:
    if value in SIZE_NAME_PRESETS:
        return True
    return bool(re.fullmatch(r"\s*\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:cm|mm|m)?\s*", value, re.IGNORECASE))


def dimension_area_m2(value: str) -> float | None:
    match = re.fullmatch(r"\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?\s*", value, re.IGNORECASE)
    if not match:
        return None
    factor = {"mm": 0.001, "cm": 0.01, "m": 1.0}.get((match.group(3) or "cm").lower(), 0.01)
    return float(match.group(1).replace(",", ".")) * factor * float(match.group(2).replace(",", ".")) * factor


def valid_product_dimension(product: str, size: str) -> bool:
    area = dimension_area_m2(size)
    if area is None:
        return size in SIZE_NAME_PRESETS
    minimum, maximum = SIZE_LIMITS_M2[product]
    return minimum <= area <= maximum


def sticker_sheet_dimensions(size: str) -> tuple[float, float]:
    return {"A3": (29.7, 42.0)}.get(size, (29.7, 42.0))


def sticker_capacity(size: str, sticker_size: str) -> tuple[int, int, int]:
    sheet_width, sheet_height = sticker_sheet_dimensions(size)
    match = re.fullmatch(r"\s*(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*cm\s*", sticker_size, re.IGNORECASE)
    if not match:
        raise ValueError("Ukuran sticker tidak valid")
    sticker_width = float(match.group(1).replace(",", "."))
    sticker_height = float(match.group(2).replace(",", "."))
    across = int((sheet_width + STICKER_GAP_CM) // (sticker_width + STICKER_GAP_CM))
    down = int((sheet_height + STICKER_GAP_CM) // (sticker_height + STICKER_GAP_CM))
    return across, down, across * down


def make_sticker_sheet(design: Path, output: Path, size: str, sticker_size: str, shape: str = "Kotak") -> int:
    """Tile the client design onto one physical sheet without large gaps."""
    magick = image_magick()
    if not magick:
        raise RuntimeError("ImageMagick tidak ditemukan")
    sheet_width, sheet_height = sticker_sheet_dimensions(size)
    across, down, capacity = sticker_capacity(size, sticker_size)
    if capacity < 1:
        raise ValueError("Ukuran sticker terlalu besar untuk kanvas yang dipilih")
    count = capacity
    longest = 1800
    ratio = sheet_width / sheet_height
    canvas_width = longest if ratio >= 1 else max(1, round(longest * ratio))
    canvas_height = max(1, round(longest / ratio)) if ratio >= 1 else longest
    parsed = re.fullmatch(r"\s*(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*cm\s*", sticker_size, re.IGNORECASE)
    assert parsed is not None
    sticker_width = float(parsed.group(1).replace(",", ".")); sticker_height = float(parsed.group(2).replace(",", "."))
    tile_width = max(1, round(canvas_width * sticker_width / sheet_width))
    tile_height = max(1, round(canvas_height * sticker_height / sheet_height))
    gap_width = max(1, round(canvas_width * STICKER_GAP_CM / sheet_width))
    gap_height = max(1, round(canvas_height * STICKER_GAP_CM / sheet_height))
    used_width = across * tile_width + (across - 1) * gap_width
    used_height = down * tile_height + (down - 1) * gap_height
    start_x = max(0, (canvas_width - used_width) // 2)
    start_y = max(0, (canvas_height - used_height) // 2)
    command = [magick, "-size", f"{canvas_width}x{canvas_height}", "xc:white"]
    shape = shape.strip().lower()
    for index in range(count):
        x = start_x + (index % across) * (tile_width + gap_width)
        y = start_y + (index // across) * (tile_height + gap_height)
        tile = ["(", str(design), "-background", "none", "-resize", f"{tile_width}x{tile_height}!", "-alpha", "set", "-bordercolor", "white", "-border", "8", "-resize", f"{tile_width}x{tile_height}!"]
        if shape == "bulat":
            tile.extend(["-alpha", "set", "-channel", "A", "-fx", "((i-w/2)^2+(j-h/2)^2 <= (min(w,h)/2)^2) ? 1 : 0", "+channel"])
        tile.extend([")", "-geometry", f"+{x}+{y}", "-composite"])
        command.extend(tile)
    command.extend(["-units", "PixelsPerCentimeter", "-density", f"{canvas_width / sheet_width:.6f}", "-quality", "92", str(output)])
    subprocess.run(command, check=True, capture_output=True)
    return count

HOST = os.environ.get("PRESSLY_CUSTOMER_HOST", "0.0.0.0")
PORT = int(os.environ.get("PRESSLY_CUSTOMER_PORT", os.environ.get("PORT", "8090")))
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_PROJECT_NUMBER = os.environ.get("GEMINI_PROJECT_NUMBER", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash").strip()
# Google has retired Gemini 2.5 Flash for newly enabled users. Keep old local
# shell configurations working while using the currently available model.
if GEMINI_MODEL == "gemini-2.5-flash":
    GEMINI_MODEL = "gemini-3.6-flash"
MAX_UPLOAD = 50 * 1024 * 1024
JOB_TTL = 30 * 60
JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.RLock()


def gemini_reply(message: str, history: list[dict]) -> str:
    """Call Gemini server-side without ever exposing the API key to clients."""
    if not GEMINI_API_KEY:
        raise RuntimeError("Chat AI belum dikonfigurasi. Set GEMINI_API_KEY di environment server.")
    clean_message = message.strip()
    if not clean_message or len(clean_message) > 2000:
        raise ValueError("Pesan harus berisi 1-2000 karakter")
    contents = []
    for item in history[-10:]:
        role = "model" if item.get("role") == "model" else "user"
        text = str(item.get("text", "")).strip()
        if text and len(text) <= 2000:
            contents.append({"role": role, "parts": [{"text": text}]})
    contents.append({"role": "user", "parts": [{"text": clean_message}]})
    payload = {
        "systemInstruction": {"parts": [{"text": (
            "Kamu adalah asisten customer Fazima Print di Bandung. "
            "Jawab dalam Bahasa Indonesia yang ramah, ringkas, dan jelas. "
            "Bantu menjelaskan Banner, X-Banner, Spanduk, Sticker, Poster, Kartu Nama, "
            "ukuran, finishing, upload desain, preview, keranjang, dan pengantaran. "
            "Jangan mengarang harga final, stok, status produksi, atau janji waktu. "
            "Harga yang tampil di situs adalah estimasi demo dan file akan diperiksa operator. "
            "Jika pertanyaan membutuhkan keputusan operator, arahkan customer untuk chat CS."
        )}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.65, "maxOutputTokens": 500},
    }
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        # Keep provider details and credentials out of the customer response/log.
        if exc.code in {401, 403}:
            raise RuntimeError("Konfigurasi Gemini API key tidak valid atau belum memiliki akses.") from None
        if exc.code == 429:
            raise RuntimeError("Chat sedang ramai. Coba lagi beberapa saat lagi.") from None
        if exc.code == 400:
            raise RuntimeError("Gemini menolak request. Periksa konfigurasi model atau format request.") from None
        if exc.code == 404:
            raise RuntimeError(f"Model Gemini tidak ditemukan: {GEMINI_MODEL}") from None
        if exc.code >= 500:
            raise RuntimeError("Layanan Gemini sedang bermasalah. Coba lagi nanti.") from None
        raise RuntimeError(f"Gemini mengembalikan error HTTP {exc.code}.") from None
    except (urllib.error.URLError, TimeoutError):
        raise RuntimeError("Koneksi ke Gemini gagal. Periksa internet, DNS, atau firewall server.") from None
    candidates = result.get("candidates", [])
    parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
    answer = "".join(str(part.get("text", "")) for part in parts).strip()
    if not answer:
        raise RuntimeError("Gemini tidak mengembalikan jawaban.")
    return answer[:4000]


def slug(value: str) -> str:
    result = "_".join("".join(c.lower() if c.isalnum() else " " for c in value).split())
    return result or "layout"


def save_product_image(payload: dict) -> str | None:
    raw = str(payload.get("image_data", "")).strip()
    if not raw:
        return None
    match = re.fullmatch(r"data:image/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)", raw, re.IGNORECASE)
    if not match:
        raise ValueError("Foto harus PNG, JPG, atau WEBP")
    content = base64.b64decode(match.group(2), validate=True)
    if len(content) > 10 * 1024 * 1024:
        raise ValueError("Foto maksimal 10 MB")
    extension = "jpg" if match.group(1).lower() in {"jpg", "jpeg"} else match.group(1).lower()
    category = re.sub(r"[^a-z0-9_-]+", "-", str(payload.get("category", "custom")).lower()).strip("-") or "custom"
    filename = f"{slug(str(payload.get('name', 'produk')))}.{extension}"
    folder = Path(__file__).parent / "assets" / "products" / category
    folder.mkdir(parents=True, exist_ok=True)
    (folder / filename).write_bytes(content)
    return f"assets/products/{category}/{filename}"


DEFAULT_HERO_SLIDES = [
    {"image": "assets/real/gallery/gallery-2.jpeg", "alt": "Contoh hasil digital printing Fazima Print"},
    {"image": "assets/real/gallery/gallery-1.jpeg", "alt": "Hasil cetak Fazima Print"},
    {"image": "assets/real/gallery/gallery-3.jpeg", "alt": "Inspirasi produk printing"},
    {"image": "assets/real/gallery/gallery-4.jpeg", "alt": "Contoh hasil produksi Fazima Print"},
    {"image": "assets/real/products/banner.jpg", "alt": "Banner printing Fazima Print"},
]
CUSTOMER_ROOT = Path(__file__).parent.resolve()
HERO_CONFIG_PATH = CUSTOMER_ROOT / "hero_images.json"
CATEGORY_BOX_CONFIG_PATH = CUSTOMER_ROOT / "category_box_visuals.json"
MAX_HERO_SLIDES = 8
MAX_HERO_IMAGE_BYTES = 3 * 1024 * 1024


def hero_images_payload() -> dict:
    try:
        saved = json.loads(HERO_CONFIG_PATH.read_text(encoding="utf-8"))
        slides = saved.get("slides") if isinstance(saved, dict) else None
        if not isinstance(slides, list) or not slides:
            raise ValueError("Invalid hero configuration")
        return {"slides": slides}
    except (OSError, ValueError, json.JSONDecodeError):
        return {"slides": DEFAULT_HERO_SLIDES}


def update_hero_images(payload: dict) -> dict:
    requested = payload.get("slides")
    if not isinstance(requested, list) or not 1 <= len(requested) <= MAX_HERO_SLIDES:
        raise ValueError(f"Hero harus memiliki 1 sampai {MAX_HERO_SLIDES} gambar.")
    saved_slides = []
    for slide in requested:
        if not isinstance(slide, dict):
            raise ValueError("Data gambar hero tidak valid.")
        alt = str(slide.get("alt", "")).strip()[:180] or "Fazima Print"
        raw = str(slide.get("image_data", "")).strip()
        if raw:
            match = re.fullmatch(r"data:image/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)", raw, re.IGNORECASE)
            if not match:
                raise ValueError("Gambar hero harus PNG, JPG, atau WEBP.")
            content = base64.b64decode(match.group(2), validate=True)
            if not content or len(content) > MAX_HERO_IMAGE_BYTES:
                raise ValueError("Ukuran gambar hero maksimal 3 MB.")
            extension = "jpg" if match.group(1).lower() in {"jpg", "jpeg"} else match.group(1).lower()
            filename = f"hero-{secrets.token_hex(12)}.{extension}"
            folder = CUSTOMER_ROOT / "assets" / "real" / "gallery"
            (folder / filename).write_bytes(content)
            image = f"assets/real/gallery/{filename}"
        else:
            image = str(slide.get("image", "")).strip().replace("\\", "/")
            if (not image.startswith(("assets/real/gallery/", "assets/real/products/", "assets/hero/"))
                    or any(part in {".", ".."} for part in image.split("/"))):
                raise ValueError("Pilih file gambar yang valid untuk setiap slide hero.")
            resolved = (CUSTOMER_ROOT / image).resolve()
            if CUSTOMER_ROOT not in resolved.parents or not resolved.is_file():
                raise ValueError("File gambar hero tidak ditemukan.")
        saved_slides.append({"image": image, "alt": alt})
    config = {"slides": saved_slides}
    temporary = HERO_CONFIG_PATH.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(HERO_CONFIG_PATH)
    return config


def category_box_visuals_payload() -> dict:
    try:
        saved = json.loads(CATEGORY_BOX_CONFIG_PATH.read_text(encoding="utf-8"))
        saved_categories = saved.get("categories", {}) if isinstance(saved, dict) else {}
        if not isinstance(saved_categories, dict):
            saved_categories = {}
    except (OSError, ValueError, json.JSONDecodeError):
        saved_categories = {}
    items = []
    for category in category_rows():
        slug = str(category.get("slug") or "").strip()
        name = str(category.get("name") or slug).strip()
        default_image = "assets/real/products/banner.jpg" if slug.lower() == "outdoor" else "assets/real/gallery/gallery-2.jpeg"
        setting = saved_categories.get(slug, {})
        image = str(setting.get("image") or default_image) if isinstance(setting, dict) else default_image
        if (not image.startswith(("assets/real/gallery/", "assets/real/products/"))
                or any(part in {".", ".."} for part in image.split("/"))
                or not (CUSTOMER_ROOT / image).is_file()):
            image = default_image
        items.append({"slug": slug, "name": name, "image": image,
                      "shadow": bool(setting.get("shadow", True)) if isinstance(setting, dict) else True})
    return {"items": items}


def update_category_box_visual(slug: str, payload: dict) -> dict:
    category = next((row for row in category_rows() if str(row.get("slug") or "") == slug), None)
    if not category:
        raise ValueError("Kategori tidak ditemukan.")
    try:
        config = json.loads(CATEGORY_BOX_CONFIG_PATH.read_text(encoding="utf-8"))
        saved_categories = config.get("categories", {}) if isinstance(config, dict) else {}
        if not isinstance(saved_categories, dict):
            saved_categories = {}
    except (OSError, ValueError, json.JSONDecodeError):
        saved_categories = {}
    raw = str(payload.get("image_data", "")).strip()
    image = str(payload.get("image", "")).strip().replace("\\", "/")
    if raw:
        match = re.fullmatch(r"data:image/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)", raw, re.IGNORECASE)
        if not match:
            raise ValueError("Gambar harus PNG, JPG, atau WEBP.")
        content = base64.b64decode(match.group(2), validate=True)
        if not content or len(content) > MAX_HERO_IMAGE_BYTES:
            raise ValueError("Ukuran gambar maksimal 3 MB.")
        extension = "jpg" if match.group(1).lower() in {"jpg", "jpeg"} else match.group(1).lower()
        filename = f"category-box-{slug}-{secrets.token_hex(10)}.{extension}"
        image = f"assets/real/gallery/{filename}"
        (CUSTOMER_ROOT / image).write_bytes(content)
    if (not image.startswith(("assets/real/gallery/", "assets/real/products/"))
            or any(part in {".", ".."} for part in image.split("/"))
            or not (CUSTOMER_ROOT / image).is_file()):
        raise ValueError("Pilih gambar kategori yang valid.")
    setting = {"image": image, "shadow": payload.get("shadow") is True}
    saved_categories[slug] = setting
    config = {"categories": saved_categories}
    temporary = CATEGORY_BOX_CONFIG_PATH.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(CATEGORY_BOX_CONFIG_PATH)
    return {"slug": slug, "name": str(category.get("name") or slug), **setting}


def cleanup_expired() -> None:
    cutoff = time.time() - JOB_TTL
    with JOBS_LOCK:
        expired = [token for token, job in JOBS.items() if job["created"] < cutoff]
        for token in expired:
            job = JOBS.pop(token)
            for path in job["files"]:
                try:
                    Path(path).unlink(missing_ok=True)
                except OSError:
                    pass


def customer_temp_file(token: str, role: str, suffix: str) -> Path:
    """Create a unique temporary file directly in the writable Temp directory."""
    descriptor, name = tempfile.mkstemp(prefix=f"fazima-customer-{token}-{role}-", suffix=suffix)
    os.close(descriptor)
    return Path(name)


def remove_customer_temp_files(paths: list[Path]) -> None:
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


def products_payload() -> list[dict]:
    if database_configured():
        return [{"name": row["name"], "sizes": row["sizes"], "materials": row.get("materials", []), "kind": row["kind"]} for row in catalog_rows()]
    return [{"name": name, "sizes": sizes, "materials": ["Flexi China 260", "Flexi China 330", "Korea 440"] if name == "Spanduk Banner" else [], "kind": PRODUCT_KINDS.get(name, "custom")} for name, sizes in PRODUCTS.items()]


def catalog_payload() -> list[dict]:
    """Return the customer catalog and effective prices from MySQL."""
    rows = catalog_rows()
    for row in rows:
        row["price"] = row["promo_price"] if row.get("promo_id") else row["base_price"]
        row["original_price"] = row["base_price"] if row.get("promo_id") else None
        row["discount"] = row.get("discount_percent") if row.get("promo_id") else 0
    return rows


def engine_size(product: str, size: str) -> str:
    """Use landscape paper orientation for certificate output."""
    if product != "Cetak Sertifikat" or size not in {"A4", "A3"}:
        return size
    return {"A4": "29.7x21 cm", "A3": "42x29.7 cm"}[size]


def make_preview(output: Path, preview: Path, product: str = "") -> None:
    magick = image_magick()
    if not magick:
        raise RuntimeError("ImageMagick tidak ditemukan")
    source = str(output) + "[0]" if output.suffix.lower() == ".pdf" else str(output)
    command = [magick]
    if output.suffix.lower() == ".pdf":
        command += ["-density", "120"]
    command += [source, "-resize", "1200x1200>", "-strip", str(preview)]
    subprocess.run(command, check=True, capture_output=True)


def oriented_size(size: str, orientation: str) -> str:
    """Normalize the long side to the selected horizontal/vertical axis."""
    match = re.fullmatch(r"\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?\s*", size, re.IGNORECASE)
    if not match:
        return size
    first = float(match.group(1).replace(",", "."))
    second = float(match.group(2).replace(",", "."))
    if orientation == "horizontal":
        width, height = max(first, second), min(first, second)
    else:
        width, height = min(first, second), max(first, second)
    unit = f" {match.group(3)}" if match.group(3) else ""
    return f"{width:g}x{height:g}{unit}"


def make_mockup_preview(layout_preview: Path, preview: Path, product: str, fields: dict | None = None) -> None:
    """Perspective-map the clean artwork onto the mockup surface."""
    mockup_name, canvas_width, canvas_height, width, height, corners = MOCKUPS[product]
    mockup = Path(__file__).parent / "assets" / "mockups" / mockup_name
    magick = image_magick()
    if not magick or not mockup.is_file():
        raise RuntimeError("Asset mockup tidak ditemukan")
    source_for_mapping = layout_preview
    if product == "Sticker":
        # A sticker order is a sheet, not one giant A4 sticker. Show six
        # repeated pieces so the customer can understand the physical result.
        source_for_mapping = preview.with_name("sticker-sheet.png")
        sticker_size = 260
        positions = ((105, 90), (435, 90), (105, 455), (435, 455), (105, 820), (435, 820))
        tile_command = [magick, "-size", f"{width}x{height}", "xc:white"]
        for x, y in positions:
            tile_command.extend(["(", str(layout_preview), "-resize", f"{sticker_size}x{sticker_size}!", ")", "-geometry", f"+{x}+{y}", "-composite"])
        subprocess.run(tile_command + [str(source_for_mapping)], check=True, capture_output=True)
        width, height = 800, 1185
    source_points = ((0, 0), (width, 0), (width, height), (0, height))
    perspective = " ".join(
        f"{sx},{sy} {dx},{dy}" for (sx, sy), (dx, dy) in zip(source_points, corners)
    )
    artwork = [str(source_for_mapping), "-resize", f"{width}x{height}!", "-alpha", "set"]
    if product in MOCKUP_WAVES:
        amplitude, wavelength = MOCKUP_WAVES[product]
        artwork += ["-virtual-pixel", "transparent", "-wave", f"{amplitude}x{wavelength}", "-crop", f"{width}x{height}+0+{amplitude}", "+repage"]
    command = [
        # The photograph must be the base layer. Starting with transparent
        # pixels makes multiply turn the entire canvas black.
        magick, str(mockup), "(", *artwork,
        "-virtual-pixel", "transparent", "-set", "option:distort:viewport", f"{canvas_width}x{canvas_height}+0+0",
        "-distort", "Perspective", perspective, "-channel", "A", "-evaluate", "multiply", "0.90",
        "-blur", "0x0.55", "+channel", "-background", "none", ")",
        "-compose", "over", "-composite", "-strip", str(preview),
    ]
    subprocess.run(command, check=True, capture_output=True)
    # Add a restrained luminance pass from the same mockup. This restores the
    # broad highlights and folds over the printed artwork without changing
    # its calibrated geometry.
    texture = preview.with_name("mockup-texture.png")
    texture_strength = MOCKUP_TEXTURE_STRENGTH.get(product, 32)
    subprocess.run([
        magick, str(mockup), "-colorspace", "gray", "-contrast-stretch", "18%x18%",
        "-blur", "0x0.65", "-alpha", "set", "-channel", "A", "-evaluate", "set", f"{texture_strength}%", "+channel", str(texture),
    ], check=True, capture_output=True)
    subprocess.run([
        magick, str(preview), str(texture), "-compose", "multiply", "-composite", "-strip", str(preview),
    ], check=True, capture_output=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "Fazima PrintCustomer/1.0"

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

    def read_json(self, limit: int = 128000) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > limit:
            raise ValueError("Payload JSON tidak valid")
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("Payload JSON harus object")
        return payload

    def do_GET(self):
        cleanup_expired()
        path = urlparse(self.path).path
        if path == "/api/location/reverse":
            query = parse_qs(urlparse(self.path).query)
            try:
                latitude = float(query.get("lat", [""])[0])
                longitude = float(query.get("lon", [""])[0])
                if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                    raise ValueError
            except (TypeError, ValueError):
                return self.send_json({"error": "Koordinat lokasi tidak valid."}, HTTPStatus.BAD_REQUEST)
            reverse_url = "https://nominatim.openstreetmap.org/reverse?" + urlencode({"format": "jsonv2", "lat": latitude, "lon": longitude, "zoom": 18, "addressdetails": 1, "namedetails": 1})
            try:
                request = urllib.request.Request(reverse_url, headers={"User-Agent": "FazimaPrintCustomer/1.0 (reverse geocoding)"})
                global NOMINATIM_LAST_REQUEST
                with NOMINATIM_LOCK:
                    delay = 1.0 - (time.monotonic() - NOMINATIM_LAST_REQUEST)
                    if delay > 0:
                        time.sleep(delay)
                    NOMINATIM_LAST_REQUEST = time.monotonic()
                    with urllib.request.urlopen(request, timeout=8) as response:
                        place = json.loads(response.read().decode("utf-8"))
                address = place.get("address") or {}
                return self.send_json({"display_name": place.get("display_name", ""), "name": (place.get("namedetails") or {}).get("name") or place.get("name", ""), "address": address})
            except Exception:
                return self.send_json({"error": "Alamat lokasi belum dapat ditemukan. Koordinat tetap bisa disimpan."}, HTTPStatus.BAD_GATEWAY)
        if path == "/api/firebase-config":
            configured = bool(FIREBASE_API_KEY and FIREBASE_AUTH_DOMAIN and FIREBASE_PROJECT_ID and FIREBASE_APP_ID)
            return self.send_json({"configured": configured, "config": {"apiKey": FIREBASE_API_KEY, "authDomain": FIREBASE_AUTH_DOMAIN, "projectId": FIREBASE_PROJECT_ID, "storageBucket": FIREBASE_STORAGE_BUCKET, "messagingSenderId": FIREBASE_MESSAGING_SENDER_ID, "appId": FIREBASE_APP_ID} if configured else None})
        if path == "/api/health":
            return self.send_json({
                "ok": True,
                "service": "Fazima Print-customer",
                "mode": "mysql" if database_configured() else "ephemeral",
                "database_configured": database_configured(),
                "gemini_configured": bool(GEMINI_API_KEY),
                "gemini_model": GEMINI_MODEL,
                "gemini_project_configured": bool(GEMINI_PROJECT_NUMBER),
            })
        if path == "/api/products":
            try:
                return self.send_json(products_payload())
            except DatabaseNotConfigured as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.SERVICE_UNAVAILABLE)
            except Exception:
                return self.send_json({"error": "Database customer tidak dapat diakses."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/catalog":
            try:
                return self.send_json(catalog_payload())
            except DatabaseNotConfigured as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.SERVICE_UNAVAILABLE)
            except Exception:
                return self.send_json({"error": "Database customer tidak dapat diakses."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path in {"/api/hero-images", "/api/admin/hero-images"}:
            return self.send_json(hero_images_payload())
        if path in {"/api/category-box-visuals", "/api/admin/category-box-visuals"}:
            try:
                return self.send_json(category_box_visuals_payload())
            except Exception:
                return self.send_json({"error": "Pengaturan gambar kategori tidak dapat dimuat."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/promo-settings":
            try:
                return self.send_json(promo_timer_settings())
            except DatabaseNotConfigured as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/categories":
            try:
                return self.send_json(category_rows())
            except Exception:
                return self.send_json({"error": "Kategori customer belum dapat diakses."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/admin/catalog":
            try:
                return self.send_json(catalog_rows(include_inactive=True, ignore_timer=True))
            except Exception:
                return self.send_json({"error": "Katalog admin belum dapat diakses."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/admin/promo-settings":
            try:
                return self.send_json(promo_timer_settings())
            except DatabaseNotConfigured as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/admin/categories":
            try:
                return self.send_json(category_rows())
            except Exception:
                return self.send_json({"error": "Kategori belum dapat diakses. Jalankan migrate_catalog.sql."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/chat/sessions":
            try:
                return self.send_json(chat_session_rows())
            except Exception:
                return self.send_json({"error": "Riwayat sesi chat belum dapat diakses."}, HTTPStatus.SERVICE_UNAVAILABLE)
        match = re.fullmatch(r"/api/chat/sessions/([^/]+)", path)
        if match:
            try:
                return self.send_json(chat_messages(match.group(1)))
            except Exception:
                return self.send_json({"error": "Pesan sesi chat belum dapat diakses."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/orders":
            try:
                return self.send_json(order_rows())
            except Exception:
                return self.send_json({"error": "Order belum dapat diakses."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/dashboard/orders":
            try:
                query = parse_qs(urlparse(self.path).query)
                return self.send_json(dashboard_order_rows(
                    query.get("limit", [100])[0], query.get("workflow_status", [""])[0], query.get("source", [""])[0]))
            except (ValueError, DatabaseNotConfigured) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Order dashboard belum dapat diakses."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/dashboard/notifications":
            try:
                query = parse_qs(urlparse(self.path).query)
                unread = query.get("unread_only", ["true"])[0].lower() not in {"0", "false", "no"}
                return self.send_json(dashboard_notifications(query.get("team", ["SETTING"])[0], unread, query.get("limit", [100])[0]))
            except (ValueError, DatabaseNotConfigured) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Notifikasi dashboard belum dapat diakses."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/operator/production":
            try:
                query = parse_qs(urlparse(self.path).query)
                return self.send_json(production_job_rows(query.get("category", [""])[0], query.get("limit", [100])[0]))
            except (ValueError, DatabaseNotConfigured) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Antrean produksi belum dapat diakses."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/operator/production-usage":
            try:
                query=parse_qs(urlparse(self.path).query)
                filters={key:query.get(key,[""])[0] for key in ("date_from","date_to","group","channel","operator")}
                return self.send_json(production_usage_rows(filters,query.get("limit",[500])[0]))
            except (ValueError,DatabaseNotConfigured) as exc:
                return self.send_json({"error":str(exc)},HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error":"Ringkasan pemakaian bahan belum dapat dimuat."},HTTPStatus.SERVICE_UNAVAILABLE)
        match = re.fullmatch(r"/api/dashboard/orders/([A-Za-z0-9_.~-]{1,50})", path)
        if match:
            try:
                order = dashboard_order_detail(match.group(1))
                if not order:
                    return self.send_json({"error": "Order tidak ditemukan."}, HTTPStatus.NOT_FOUND)
                return self.send_json(order)
            except Exception:
                return self.send_json({"error": "Detail order dashboard belum dapat diakses."}, HTTPStatus.SERVICE_UNAVAILABLE)
        match = re.fullmatch(r"/api/dashboard/orders/([A-Za-z0-9_.~-]{1,50})/layout", path)
        if match:
            return self.serve_saved_layout(match.group(1))
        match = re.fullmatch(r"/api/orders/([A-Za-z0-9_.~-]{1,50})", path)
        if match:
            try:
                order = order_by_number(match.group(1))
                if not order:
                    return self.send_json({"error": "Order tidak ditemukan."}, HTTPStatus.NOT_FOUND)
                return self.send_json(order)
            except Exception:
                return self.send_json({"error": "Order belum dapat dilacak."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/payments/config":
            return self.send_json({"configured": bool(MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY), "environment": "production" if MIDTRANS_PRODUCTION else "sandbox", "snap_js": MIDTRANS_SNAP_JS, "client_key": MIDTRANS_CLIENT_KEY or None, "payment_methods": [{"id": item, "label": MIDTRANS_PAYMENT_LABELS[item], "sandbox": MIDTRANS_SANDBOX_GUIDES.get(item)} for item in MIDTRANS_ENABLED_PAYMENTS], "status_endpoint": "/api/payments/status/<order_id>"})
        match = re.fullmatch(r"/api/payments/status/([A-Za-z0-9_.~-]{1,50})", path)
        if match:
            return self.get_midtrans_status(match.group(1))
        match = re.fullmatch(r"/api/layouts/([A-Fa-f0-9]+)/((?:preview)|(?:output))", path)
        if match:
            return self.serve_job_file(match.group(1), match.group(2))
        relative = "index.html" if path in ("", "/") else path.lstrip("/")
        if not (relative in {"index.html", "about.html", "catalog.html", "product.html", "order.html", "payment.html", "cart.html", "login.html", "order-history.html", "dashboard.html", "app.js", "dashboard.js", "firebase-auth.js", "styles.css", "mockups.css", "cart-fixes.css", "theme-fixes.css", "cosmic-theme.css", "custom-select.css", "layout-fixes.css", "home-revamp.css", "about-revamp.css", "arc-ui.css", "promo-responsive-final.css", "catalog-listing-final.css", "catalog-page.css"} or relative.startswith("assets/mockups/") or relative.startswith("assets/real/") or relative.startswith("assets/products/") or relative.startswith("assets/hero/")):
            return self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        candidate = (Path(__file__).parent / relative).resolve()
        if Path(__file__).parent.resolve() not in candidate.parents:
            return self.send_json({"error": "Forbidden"}, HTTPStatus.FORBIDDEN)
        if not candidate.is_file():
            return self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        content = candidate.read_bytes()
        if candidate.suffix.lower() == ".html":
            content = content.replace(b"app.js?v=20260829-pages", b"app.js?v=20260831-dropdown1")
            content = content.replace(b"app.js?v=20260830-spider1", b"app.js?v=20260831-dropdown1")
            content = content.replace(b"Preview mockup akan muncul di sini", b"Preview akan muncul di sini")
            content = content.replace(b"Preview desain pada mockup produk", b"Preview desain pada produk")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mimetypes.guess_type(str(candidate))[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.end_headers()
        self.wfile.write(content)

    def serve_job_file(self, token: str, kind: str):
        with JOBS_LOCK:
            job = JOBS.get(token)
        if not job:
            return self.send_json({"error": "Preview sudah kedaluwarsa. Silakan proses ulang."}, HTTPStatus.NOT_FOUND)
        path = job[kind]
        if not path.is_file():
            return self.send_json({"error": "File tidak ditemukan"}, HTTPStatus.NOT_FOUND)
        content = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mimetypes.guess_type(str(path))[0] or "application/octet-stream")
        if kind == "output":
            self.send_header("Content-Disposition", f'attachment; filename="{job["output_name"]}"')
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def serve_saved_layout(self, order_number: str):
        order = dashboard_order_detail(order_number)
        if not order or not order.get("layout_file_path"):
            return self.send_json({"error": "Layout final belum tersedia."}, HTTPStatus.NOT_FOUND)
        path = Path(order["layout_file_path"]).resolve()
        if LAYOUT_STORAGE_ROOT not in path.parents or not path.is_file():
            return self.send_json({"error": "File layout tidak ditemukan."}, HTTPStatus.NOT_FOUND)
        content = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mimetypes.guess_type(str(path))[0] or "application/octet-stream")
        self.send_header("Content-Disposition", f'attachment; filename="{order.get("layout_output_name") or path.name}"')
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/admin/categories":
            try:
                return self.send_json(create_category(self.read_json()), HTTPStatus.CREATED)
            except (ValueError, DatabaseNotConfigured, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Kategori baru tidak dapat disimpan. Jalankan migrate_catalog.sql."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/admin/products":
            try:
                payload = self.read_json(limit=15 * 1024 * 1024)
                image_path = save_product_image(payload)
                if image_path:
                    payload["image_path"] = image_path
                return self.send_json(create_product(payload), HTTPStatus.CREATED)
            except (ValueError, DatabaseNotConfigured, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Produk baru tidak dapat disimpan."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/chat":
            return self.chat()
        if path == "/api/payments/snap-token":
            try:
                return self.create_snap_token()
            except (ValueError, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except urllib.error.URLError:
                return self.send_json({"error": "Midtrans tidak dapat dihubungi."}, HTTPStatus.BAD_GATEWAY)
            except Exception:
                return self.send_json({"error": "Midtrans gagal menyiapkan transaksi."}, HTTPStatus.BAD_GATEWAY)
        if path == "/api/orders":
            return self.create_order()
        if path == "/api/dashboard/orders/manual":
            try:
                return self.send_json(create_manual_order(self.read_json(128000)), HTTPStatus.CREATED)
            except (ValueError, DatabaseNotConfigured, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Order manual tidak dapat disimpan."}, HTTPStatus.SERVICE_UNAVAILABLE)
        match = re.fullmatch(r"/api/dashboard/orders/([A-Za-z0-9_.~-]{1,50})/setting-decision", path)
        if match:
            try:
                return self.send_json(setting_decision(match.group(1), self.read_json(32000)))
            except (ValueError, DatabaseNotConfigured, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Keputusan Team Setting tidak dapat disimpan."}, HTTPStatus.SERVICE_UNAVAILABLE)
        match = re.fullmatch(r"/api/dashboard/orders/([A-Za-z0-9_.~-]{1,50})/transfer-cashier", path)
        if match:
            try:
                return self.send_json(transfer_order_to_cashier(match.group(1), self.read_json(32000)))
            except (ValueError, DatabaseNotConfigured, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Transfer order ke Kasir tidak dapat disimpan."}, HTTPStatus.SERVICE_UNAVAILABLE)
        match = re.fullmatch(r"/api/dashboard/orders/([A-Za-z0-9_.~-]{1,50})/cashier-decision", path)
        if match:
            try:
                return self.send_json(cashier_decision(match.group(1), self.read_json(32000)))
            except (ValueError, DatabaseNotConfigured, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Keputusan Kasir tidak dapat disimpan."}, HTTPStatus.SERVICE_UNAVAILABLE)
        match = re.fullmatch(r"/api/operator/production/([A-Za-z0-9_.~-]{1,50})/start", path)
        if match:
            try:
                return self.send_json(start_production(match.group(1), self.read_json(32000)))
            except (ValueError, DatabaseNotConfigured, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Produksi tidak dapat dimulai."}, HTTPStatus.SERVICE_UNAVAILABLE)
        match = re.fullmatch(r"/api/operator/production/([A-Za-z0-9_.~-]{1,50})/complete", path)
        if match:
            try:
                return self.send_json(complete_production(match.group(1), self.read_json(32000)))
            except (ValueError, DatabaseNotConfigured, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Produksi tidak dapat diselesaikan."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/operator/production-usage":
            try:
                return self.send_json(record_production_usage(self.read_json(32000)),HTTPStatus.CREATED)
            except (ValueError,DatabaseNotConfigured,json.JSONDecodeError) as exc:
                return self.send_json({"error":str(exc)},HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error":"Pencatatan pemakaian bahan gagal disimpan."},HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/payments/notification":
            return self.midtrans_notification()
        if path != "/api/layouts":
            return self.send_json({"error": "Endpoint tidak ditemukan"}, HTTPStatus.NOT_FOUND)
        try:
            return self.create_layout()
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_PUT(self):
        path = urlparse(self.path).path
        if path == "/api/admin/hero-images":
            try:
                return self.send_json(update_hero_images(self.read_json(36 * 1024 * 1024)))
            except (ValueError, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Gambar hero tidak dapat disimpan."}, HTTPStatus.INTERNAL_SERVER_ERROR)
        category_visual_match = re.fullmatch(r"/api/admin/category-box-visuals/([a-z0-9_-]{1,100})", path)
        if category_visual_match:
            try:
                return self.send_json(update_category_box_visual(category_visual_match.group(1), self.read_json(5 * 1024 * 1024)))
            except (ValueError, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Pengaturan gambar kategori tidak dapat disimpan."}, HTTPStatus.INTERNAL_SERVER_ERROR)
        match = re.fullmatch(r"/api/dashboard/notifications/(\d+)/read", path)
        if match:
            try:
                return self.send_json(mark_dashboard_notification(int(match.group(1))))
            except (ValueError, DatabaseNotConfigured, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Notifikasi tidak dapat diperbarui."}, HTTPStatus.SERVICE_UNAVAILABLE)
        if path == "/api/admin/promo-settings":
            try:
                return self.send_json(update_promo_timer_settings(self.read_json(32000)))
            except (ValueError, DatabaseNotConfigured, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Pengaturan timer promo tidak dapat disimpan."}, HTTPStatus.SERVICE_UNAVAILABLE)
        category_match = re.fullmatch(r"/api/admin/categories/(\d+)", path)
        if category_match:
            try:
                return self.send_json(update_category(int(category_match.group(1)), self.read_json(32000)))
            except (ValueError, DatabaseNotConfigured, json.JSONDecodeError) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Kategori tidak dapat diubah."}, HTTPStatus.SERVICE_UNAVAILABLE)
        match = re.fullmatch(r"/api/admin/(products|promotions)/(\d+)", path)
        if not match:
            return self.send_json({"error": "Endpoint tidak ditemukan"}, HTTPStatus.NOT_FOUND)
        try:
            payload = self.read_json(32000)
            if match.group(1) == "products":
                image_path = save_product_image(payload)
                if image_path:
                    payload["image_path"] = image_path
                result = update_product(int(match.group(2)), payload)
            else:
                result = update_promotion(int(match.group(2)), payload)
            return self.send_json(result)
        except (ValueError, DatabaseNotConfigured, json.JSONDecodeError) as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception:
            return self.send_json({"error": "Perubahan website tidak dapat disimpan."}, HTTPStatus.SERVICE_UNAVAILABLE)

    def do_DELETE(self):
        path = urlparse(self.path).path
        category_match = re.fullmatch(r"/api/admin/categories/(\d+)", path)
        if category_match:
            try:
                return self.send_json(delete_category(int(category_match.group(1))))
            except (ValueError, DatabaseNotConfigured) as exc:
                return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception:
                return self.send_json({"error": "Kategori tidak dapat dihapus."}, HTTPStatus.SERVICE_UNAVAILABLE)
        match = re.fullmatch(r"/api/admin/products/(\d+)", path)
        if not match:
            return self.send_json({"error": "Endpoint tidak ditemukan"}, HTTPStatus.NOT_FOUND)
        try:
            return self.send_json(delete_product(int(match.group(1))))
        except (ValueError, DatabaseNotConfigured) as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception:
            return self.send_json({"error": "Produk tidak dapat dihapus."}, HTTPStatus.SERVICE_UNAVAILABLE)

    def create_snap_token(self):
        if not MIDTRANS_SERVER_KEY or not MIDTRANS_CLIENT_KEY:
            return self.send_json({"error": "Midtrans belum dikonfigurasi. Set MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY di backend."}, HTTPStatus.SERVICE_UNAVAILABLE)
        payload = self.read_json()
        finish_url = MIDTRANS_FINISH_URL
        request_host = self.headers.get("X-Forwarded-Host", self.headers.get("Host", "")).strip()
        if request_host and re.fullmatch(r"[A-Za-z0-9.-]+(?::\d{1,5})?", request_host):
            is_local_host = request_host.startswith(("localhost", "127.0.0.1"))
            if finish_url.startswith(("http://localhost", "https://localhost", "http://127.0.0.1", "https://127.0.0.1")) and not is_local_host:
                forwarded_proto = self.headers.get("X-Forwarded-Proto", "https").split(",", 1)[0].strip()
                scheme = forwarded_proto if forwarded_proto in {"http", "https"} else "https"
                finish_url = f"{scheme}://{request_host}/order-history.html"
        order_id = str(payload.get("order_id", "")).strip()
        try:
            amount = int(payload.get("gross_amount", 0))
        except (TypeError, ValueError):
            amount = 0
        items = payload.get("item_details", [])
        if not isinstance(items, list) or not items or len(items) > 50:
            raise ValueError("item_details tidak valid")
        item_total = 0
        for item in items:
            if not isinstance(item, dict):
                raise ValueError("Detail item tidak valid")
            item_id = str(item.get("id", "")).strip()
            item_name = str(item.get("name", "")).strip()
            try:
                item_price = int(item.get("price", 0)); item_quantity = int(item.get("quantity", 0))
            except (TypeError, ValueError):
                raise ValueError("Harga atau jumlah item tidak valid") from None
            if not item_id or len(item_id) > 50 or not item_name or len(item_name) > 100 or item_price <= 0 or not 1 <= item_quantity <= 100:
                raise ValueError("Detail item tidak valid")
            item_total += item_price * item_quantity
        if not re.fullmatch(r"[A-Za-z0-9_.~-]{1,50}", order_id) or amount < 1000 or amount > 100000000 or item_total != amount:
            raise ValueError("order_id atau gross_amount tidak valid")
        request_payload = {
            "transaction_details": {"order_id": order_id, "gross_amount": amount},
            "item_details": payload.get("item_details", []),
            "customer_details": payload.get("customer_details", {}),
            "enabled_payments": MIDTRANS_ENABLED_PAYMENTS,
            "callbacks": {"finish": finish_url},
        }
        body = json.dumps(request_payload).encode()
        auth = (MIDTRANS_SERVER_KEY + ":").encode("utf-8")
        request = urllib.request.Request(MIDTRANS_API_URL, data=body, method="POST", headers={"Accept": "application/json", "Content-Type": "application/json", "Authorization": "Basic " + __import__("base64").b64encode(auth).decode()})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            return self.send_json({"error": f"Midtrans menolak transaksi: {detail[:500]}"}, HTTPStatus.BAD_GATEWAY)
        return self.send_json({"order_id": order_id, "token": result.get("token"), "redirect_url": result.get("redirect_url"), "finish_url": finish_url, "client_key": MIDTRANS_CLIENT_KEY, "snap_js": MIDTRANS_SNAP_JS}, HTTPStatus.CREATED)

    def get_midtrans_status(self, order_id: str):
        if not MIDTRANS_SERVER_KEY:
            return self.send_json({"error": "MIDTRANS_SERVER_KEY belum dikonfigurasi"}, HTTPStatus.SERVICE_UNAVAILABLE)
        url = ("https://api.midtrans.com" if MIDTRANS_PRODUCTION else "https://api.sandbox.midtrans.com") + f"/v2/{order_id}/status"
        auth = (MIDTRANS_SERVER_KEY + ":").encode("utf-8")
        request = urllib.request.Request(url, headers={"Accept": "application/json", "Authorization": "Basic " + __import__("base64").b64encode(auth).decode()})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            if exc.code == HTTPStatus.NOT_FOUND:
                return self.send_json({"order_id": order_id, "transaction_status": "not_found", "message": "Midtrans belum menerima status payment. Selesaikan payment di Sandbox Simulator terlebih dahulu."}, HTTPStatus.NOT_FOUND)
            return self.send_json({"error": f"Status Midtrans gagal diambil: {detail[:300]}"}, HTTPStatus.BAD_GATEWAY)
        except urllib.error.URLError:
            return self.send_json({"error": "Midtrans tidak dapat dihubungi."}, HTTPStatus.BAD_GATEWAY)
        if str(result.get("status_code", "")) == "404":
            return self.send_json({"order_id": order_id, "transaction_status": "not_found", "message": "Midtrans belum menerima status payment. Selesaikan payment di Sandbox Simulator terlebih dahulu."}, HTTPStatus.NOT_FOUND)
        if database_configured() and result.get("transaction_status"):
            try:
                save_payment_status(result)
            except (DatabaseNotConfigured, ValueError):
                pass
        return self.send_json(result)

    def create_order(self):
        try:
            result = create_order(self.read_json())
            return self.send_json(result, HTTPStatus.CREATED)
        except DatabaseNotConfigured as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.SERVICE_UNAVAILABLE)
        except ValueError as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception:
            return self.send_json({"error": "Order tidak dapat disimpan ke database."}, HTTPStatus.SERVICE_UNAVAILABLE)

    def midtrans_notification(self):
        if not MIDTRANS_SERVER_KEY:
            return self.send_json({"error": "MIDTRANS_SERVER_KEY belum dikonfigurasi"}, HTTPStatus.SERVICE_UNAVAILABLE)
        notification = self.read_json()
        order_id = str(notification.get("order_id", ""))
        status_code = str(notification.get("status_code", ""))
        gross_amount = str(notification.get("gross_amount", ""))
        signature = str(notification.get("signature_key", ""))
        expected = hashlib.sha512((order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY).encode()).hexdigest()
        if not signature or not hmac.compare_digest(signature, expected):
            return self.send_json({"error": "Signature notification tidak valid"}, HTTPStatus.FORBIDDEN)
        with PAYMENT_STATUSES_LOCK:
            PAYMENT_STATUSES[order_id] = {"transaction_status": notification.get("transaction_status"), "fraud_status": notification.get("fraud_status"), "updated": time.time()}
        if database_configured():
            try:
                save_payment_status(notification)
            except (DatabaseNotConfigured, ValueError):
                return self.send_json({"error": "Status pembayaran tidak dapat disimpan."}, HTTPStatus.SERVICE_UNAVAILABLE)
        return self.send_json({"ok": True})

    def chat(self):
        content_type = self.headers.get("Content-Type", "")
        if "application/json" not in content_type:
            return self.send_json({"error": "Gunakan application/json"}, HTTPStatus.BAD_REQUEST)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 32000:
                raise ValueError("Payload chat tidak valid")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            message = str(payload.get("message", ""))
            history = payload.get("history", [])
            if not isinstance(history, list):
                history = []
            answer = gemini_reply(message, history)
            session_id = str(payload.get("session_id", "")).strip()[:80]
            if database_configured() and session_id:
                save_chat_message(session_id, "user", message)
                save_chat_message(session_id, "model", answer)
            return self.send_json({"answer": answer})
        except (ValueError, json.JSONDecodeError) as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except RuntimeError as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.SERVICE_UNAVAILABLE)

    def create_layout(self):
        content_type = self.headers.get("Content-Type", "")
        length = int(self.headers.get("Content-Length", "0"))
        if "multipart/form-data" not in content_type:
            raise ValueError("Gunakan multipart/form-data")
        if length <= 0 or length > MAX_UPLOAD + 1024 * 1024:
            raise ValueError("Ukuran upload melebihi batas 50 MB")
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
        size = str(fields.get("size", "")).strip()
        if product not in PRODUCTS:
            raise ValueError("Pilih tipe produk terlebih dahulu")
        if not file_name or Path(file_name).suffix.lower().lstrip(".") not in ALLOWED:
            raise ValueError("Format file harus JPG, PNG, atau PDF")
        if len(file_bytes) > MAX_UPLOAD:
            raise ValueError("Ukuran file melebihi batas 50 MB")
        if not size or not valid_dimension(size):
            raise ValueError("Ukuran harus dipilih atau diisi dengan format seperti 60x160 cm")
        if product in STICKER_BULK_PRODUCTS and size != "A3":
            raise ValueError("Produk sticker ini hanya diproses pada kertas A3")
        if not valid_product_dimension(product, size):
            raise ValueError("Ukuran terlalu kecil atau terlalu besar untuk produk ini")
        finishing = str(fields.get("finishing", "")).strip()
        if finishing and finishing not in FINISHINGS:
            raise ValueError("Finishing tidak valid")
        if finishing and product not in FINISHING_PRODUCTS:
            raise ValueError("Finishing hanya tersedia untuk Banner, X-Banner, dan Spanduk")
        preview_orientation = str(fields.get("preview_orientation", "horizontal")).strip().lower()
        if preview_orientation not in {"horizontal", "vertical"}:
            raise ValueError("Orientasi preview tidak valid")
        color_mode = str(fields.get("color_mode", "Original")).strip() or "Original"
        if color_mode not in {"Original", "RGB", "CMYK", "Grayscale"}:
            raise ValueError("Setting warna tidak valid")
        output_format = str(fields.get("output_format", "PNG")).upper() or "PNG"
        if output_format not in OUTPUT_FORMATS:
            raise ValueError("Format output tidak valid")
        customer = str(fields.get("customer", "customer")).strip() or "customer"
        scale_up = str(fields.get("scale_up", "true")).lower() in {"1", "true", "on", "yes"}
        output_name_parts = [slug(customer), slug(product), slug(size)]
        if finishing:
            output_name_parts.append(slug(finishing))
        output_name = "_".join(output_name_parts) + "." + OUTPUT_FORMATS[output_format]
        token = secrets.token_hex(16)
        source_suffix = Path(file_name).suffix.lower()
        raw = customer_temp_file(token, "input", source_suffix)
        output = customer_temp_file(token, "output", Path(output_name).suffix.lower())
        preview = customer_temp_file(token, "preview", ".png")
        design_preview = customer_temp_file(token, "design-preview", ".png")
        temp_files = [raw, output, preview, design_preview]
        try:
            raw.write_bytes(file_bytes)
            render_size = oriented_size(engine_size(product, size), preview_orientation) if product in FINISHING_PRODUCTS else engine_size(product, size)
            convert_layout(raw, output, product, render_size, color_mode, finishing, scale_up, output_name.rsplit(".", 1)[0])
            sticker_count = 0
            if product in STICKER_BULK_PRODUCTS:
                sticker_size = str(fields.get("sticker_size", "")).strip()
                if not re.fullmatch(r"(?:5x5|7x7|10x10)\s*cm", sticker_size.replace("×", "x"), re.IGNORECASE):
                    raise ValueError("Pilih ukuran sticker yang tersedia")
                make_preview(raw, design_preview, product)
                sticker_shape = str(fields.get("sticker_shape", "Kotak")).strip()
                if sticker_shape not in {"Kotak", "Bulat", "Custom"}:
                    raise ValueError("Bentuk sticker tidak valid")
                sticker_count = make_sticker_sheet(design_preview, output, size, sticker_size, sticker_shape)
            elif product in STICKER_SINGLE_PRODUCTS:
                # One Way is sold as one physical sticker/design, never as an
                # automatically repeated A3 sheet.
                sticker_count = 1
            # Preview is rendered from the actual generated output, not a
            # photographed mockup.
            make_preview(output, preview, product)
        except Exception:
            remove_customer_temp_files(temp_files)
            raise
        order_number = str(fields.get("order_id", "")).strip()
        saved_layout = None
        if order_number:
            if not re.fullmatch(r"[A-Za-z0-9_.~-]{1,50}", order_number):
                remove_customer_temp_files(temp_files)
                raise ValueError("Nomor order tidak valid")
            if not database_configured():
                remove_customer_temp_files(temp_files)
                raise DatabaseNotConfigured("Database wajib aktif untuk menyimpan layout order")
            storage_dir = LAYOUT_STORAGE_ROOT / order_number / token
            storage_dir.mkdir(parents=True, exist_ok=True)
            stored_output = storage_dir / output_name
            stored_input = storage_dir / raw.name
            shutil.copy2(output, stored_output)
            shutil.copy2(raw, stored_input)
            try:
                saved_layout = save_layout_for_order(order_number, {
                    "token": token, "output_name": output_name, "file_path": str(stored_output),
                    "input_file": str(stored_input), "product_name": product,
                    "actor_name": str(fields.get("actor_name", "")).strip(),
                    "note": str(fields.get("note", "")).strip(),
                })
            except Exception:
                shutil.rmtree(storage_dir, ignore_errors=True)
                raise
        with JOBS_LOCK:
            JOBS[token] = {"created": time.time(), "files": temp_files, "preview": preview, "output": output, "output_name": output_name}
        return self.send_json({"id": token, "output_name": output_name, "preview_url": f"/api/layouts/{token}/preview", "download_url": f"/api/layouts/{token}/output", "colorspace": detect_colorspace(output), "sticker_count": sticker_count, "order_id": order_number or None, "saved_layout": saved_layout}, HTTPStatus.CREATED)


if __name__ == "__main__":
    print(f"Fazima Print customer online-ready: http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
