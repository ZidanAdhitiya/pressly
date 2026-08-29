#!/usr/bin/env python3
"""Ephemeral customer-facing Fazima Print layout service.

This service deliberately has no SQLite database, dashboard, history, or
permanent storage. Each request gets a temporary workspace with a short TTL.
"""
from __future__ import annotations

import json
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
from urllib.parse import urlparse

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
from prepress_engine import convert_layout, detect_colorspace  # noqa: E402

PRODUCTS = {
    "Banner": ["3x1 m", "4x1 m", "Custom"],
    "X-Banner": ["0.6x1.6 m", "0.8x1.8 m", "Custom"],
    "Spanduk": ["1x3 m", "1x4 m", "Custom"],
    "Sticker": ["A4", "A3", "Custom"],
    "Poster": ["A4", "A3", "A2", "Custom"],
    "Kartu Nama": ["9x5.5 cm", "Custom"],
}
FINISHINGS = {
    "Matik": {"top_cm": 2.5}, "Selongsong": {"top_cm": 8.0}, "Roll Banner": {"top_cm": 2.5},
}
FINISHING_PRODUCTS = {"Banner", "X-Banner", "Spanduk"}
OUTPUT_FORMATS = {"PDF": "pdf", "JPG": "jpg", "PNG": "png"}
ALLOWED = {"jpg", "jpeg", "png", "pdf"}
SIZE_NAME_PRESETS = {"A2", "A3", "A4"}
SIZE_LIMITS_M2 = {
    "Banner": (0.25, 1000), "X-Banner": (0.3, 100), "Spanduk": (0.25, 1000),
    "Sticker": (0.0004, 10), "Poster": (0.01, 100), "Kartu Nama": (0.0002, 0.1),
}
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
    return {"A4": (21.0, 29.7), "A3": (29.7, 42.0)}.get(size, (21.0, 29.7))


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
    magick = shutil.which("magick") or shutil.which("convert")
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
        tile = ["(", str(design), "-resize", f"{tile_width}x{tile_height}!", "-alpha", "off"]
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
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip()
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


def cleanup_expired() -> None:
    cutoff = time.time() - JOB_TTL
    with JOBS_LOCK:
        expired = [token for token, job in JOBS.items() if job["created"] < cutoff]
        for token in expired:
            job = JOBS.pop(token)
            shutil.rmtree(job["directory"], ignore_errors=True)


def products_payload() -> list[dict]:
    return [{"name": name, "sizes": sizes} for name, sizes in PRODUCTS.items()]


def make_preview(output: Path, preview: Path) -> None:
    magick = shutil.which("magick") or shutil.which("convert")
    if not magick:
        raise RuntimeError("ImageMagick tidak ditemukan")
    source = str(output) + "[0]" if output.suffix.lower() == ".pdf" else str(output)
    command = [magick]
    if output.suffix.lower() == ".pdf":
        command += ["-density", "120"]
    command += [source, "-resize", "1200x1200>", "-strip", str(preview)]
    subprocess.run(command, check=True, capture_output=True)


def make_mockup_preview(layout_preview: Path, preview: Path, product: str, fields: dict | None = None) -> None:
    """Perspective-map the clean artwork onto the mockup surface."""
    mockup_name, canvas_width, canvas_height, width, height, corners = MOCKUPS[product]
    mockup = Path(__file__).parent / "assets" / "mockups" / mockup_name
    magick = shutil.which("magick") or shutil.which("convert")
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

    def do_GET(self):
        cleanup_expired()
        path = urlparse(self.path).path
        if path == "/api/health":
            return self.send_json({
                "ok": True,
                "service": "Fazima Print-customer",
                "mode": "ephemeral",
                "gemini_configured": bool(GEMINI_API_KEY),
                "gemini_model": GEMINI_MODEL,
                "gemini_project_configured": bool(GEMINI_PROJECT_NUMBER),
            })
        if path == "/api/products":
            return self.send_json(products_payload())
        match = re.fullmatch(r"/api/layouts/([A-Fa-f0-9]+)/((?:preview)|(?:output))", path)
        if match:
            return self.serve_job_file(match.group(1), match.group(2))
        relative = "index.html" if path in ("", "/") else path.lstrip("/")
        if not (relative in {"index.html", "about.html", "order.html", "cart.html", "login.html", "app.js", "styles.css", "mockups.css", "cart-fixes.css", "theme-fixes.css", "cosmic-theme.css", "custom-select.css", "layout-fixes.css", "home-revamp.css", "about-revamp.css", "arc-ui.css"} or relative.startswith("assets/mockups/") or relative.startswith("assets/real/")):
            return self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        candidate = (Path(__file__).parent / relative).resolve()
        if Path(__file__).parent.resolve() not in candidate.parents:
            return self.send_json({"error": "Forbidden"}, HTTPStatus.FORBIDDEN)
        if not candidate.is_file():
            return self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        content = candidate.read_bytes()
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

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/chat":
            return self.chat()
        if path != "/api/layouts":
            return self.send_json({"error": "Endpoint tidak ditemukan"}, HTTPStatus.NOT_FOUND)
        try:
            return self.create_layout()
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

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
        if not valid_product_dimension(product, size):
            raise ValueError("Ukuran terlalu kecil atau terlalu besar untuk produk ini")
        finishing = str(fields.get("finishing", "")).strip()
        if finishing and finishing not in FINISHINGS:
            raise ValueError("Finishing tidak valid")
        if finishing and product not in FINISHING_PRODUCTS:
            raise ValueError("Finishing hanya tersedia untuk Banner, X-Banner, dan Spanduk")
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
        directory = Path(tempfile.mkdtemp(prefix="Fazima Print-customer-"))
        raw = directory / ("input." + Path(file_name).suffix.lower().lstrip("."))
        output = directory / output_name
        preview = directory / "preview.png"
        try:
            raw.write_bytes(file_bytes)
            convert_layout(raw, output, product, size, color_mode, finishing, scale_up, output_name.rsplit(".", 1)[0])
            sticker_count = 0
            if product == "Sticker":
                sticker_size = str(fields.get("sticker_size", "10 × 10 cm")).strip()
                design_preview = directory / "design-preview.png"
                make_preview(raw, design_preview)
                sticker_shape = str(fields.get("sticker_shape", "Kotak")).strip()
                if sticker_shape not in {"Kotak", "Bulat", "Custom"}:
                    raise ValueError("Bentuk sticker tidak valid")
                sticker_count = make_sticker_sheet(design_preview, output, size, sticker_size, sticker_shape)
            # Preview is rendered from the actual generated output, not a
            # photographed mockup.
            make_preview(output, preview)
        except Exception:
            shutil.rmtree(directory, ignore_errors=True)
            raise
        with JOBS_LOCK:
            JOBS[token] = {"created": time.time(), "directory": directory, "preview": preview, "output": output, "output_name": output_name}
        return self.send_json({"id": token, "output_name": output_name, "preview_url": f"/api/layouts/{token}/preview", "download_url": f"/api/layouts/{token}/output", "colorspace": detect_colorspace(output), "sticker_count": sticker_count}, HTTPStatus.CREATED)


if __name__ == "__main__":
    print(f"Fazima Print customer online-ready: http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
