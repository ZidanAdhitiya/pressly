#!/usr/bin/env python3
"""Ephemeral customer-facing Pressly layout service.

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
    "Banner": ["300x100 cm", "400x100 cm", "Custom"],
    "X-Banner": ["60x160 cm", "80x180 cm", "Custom"],
    "Spanduk": ["100x300 cm", "100x400 cm", "Custom"],
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

HOST = os.environ.get("PRESSLY_CUSTOMER_HOST", "0.0.0.0")
PORT = int(os.environ.get("PRESSLY_CUSTOMER_PORT", "8090"))
MAX_UPLOAD = 50 * 1024 * 1024
JOB_TTL = 30 * 60
JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.RLock()


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
    server_version = "PresslyCustomer/1.0"

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
            return self.send_json({"ok": True, "service": "pressly-customer", "mode": "ephemeral"})
        if path == "/api/products":
            return self.send_json(products_payload())
        match = re.fullmatch(r"/api/layouts/([A-Fa-f0-9]+)/((?:preview)|(?:output))", path)
        if match:
            return self.serve_job_file(match.group(1), match.group(2))
        relative = "index.html" if path in ("", "/") else path.lstrip("/")
        if not (relative in {"index.html", "app.js", "styles.css", "mockups.css"} or relative.startswith("assets/mockups/")):
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
        if urlparse(self.path).path != "/api/layouts":
            return self.send_json({"error": "Endpoint tidak ditemukan"}, HTTPStatus.NOT_FOUND)
        try:
            return self.create_layout()
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            return self.send_json({"error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

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
        directory = Path(tempfile.mkdtemp(prefix="pressly-customer-"))
        raw = directory / ("input." + Path(file_name).suffix.lower().lstrip("."))
        output = directory / output_name
        preview = directory / "preview.png"
        try:
            raw.write_bytes(file_bytes)
            convert_layout(raw, output, product, size, color_mode, finishing, scale_up, output_name.rsplit(".", 1)[0])
            # The customer mockup should show the clean artwork. Production
            # guides and the filename label belong only in the downloadable
            # layout, otherwise they look like a fake sticker on the photo.
            design_preview = directory / "design-preview.png"
            make_preview(raw, design_preview)
            make_mockup_preview(design_preview, preview, product, fields)
        except Exception:
            shutil.rmtree(directory, ignore_errors=True)
            raise
        with JOBS_LOCK:
            JOBS[token] = {"created": time.time(), "directory": directory, "preview": preview, "output": output, "output_name": output_name}
        return self.send_json({"id": token, "output_name": output_name, "preview_url": f"/api/layouts/{token}/preview", "download_url": f"/api/layouts/{token}/output", "colorspace": detect_colorspace(output)}, HTTPStatus.CREATED)


if __name__ == "__main__":
    print(f"Pressly customer online-ready: http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
