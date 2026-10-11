#!/usr/bin/env python3
"""Small local prepress engine. Uses ImageMagick when available; fails closed otherwise."""
from __future__ import annotations

import shutil
import subprocess
import re
import sys
import os
from pathlib import Path


FINISHING_RULES = {
    "Matik": (2.5, 2.5, 2.5, 2.5),       # kiri, kanan, atas, bawah (cm)
    "Selongsong": (2.5, 2.5, 8.0, 8.0),
    "Roll Banner": (2.5, 2.5, 2.5, 8.0),
}


def image_magick() -> str | None:
    """Find ImageMagick without mistaking Windows' file conversion tool for it."""
    bundle_root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    bundled = bundle_root / "imagemagick" / ("magick.exe" if sys.platform == "win32" else "magick")
    if bundled.is_file():
        return str(bundled)
    magick = shutil.which("magick")
    if magick:
        return magick
    if sys.platform == "win32":
        program_files = Path(os.environ.get("ProgramFiles", r"C:\Program Files"))
        installed = sorted(program_files.glob("ImageMagick*/magick.exe"), reverse=True)
        if installed:
            return str(installed[0])
    # On Windows, convert.exe is a system utility for converting FAT volumes.
    # It accepts none of ImageMagick's arguments and must never be used here.
    return None if sys.platform == "win32" else shutil.which("convert")


def _magick() -> str | None:
    return image_magick()


def _identify() -> str | None:
    magick = _magick()
    if magick and Path(magick).name.lower().startswith("magick"):
        return magick
    return shutil.which("identify")


def process(original: Path, preview: Path, production: Path, product: str) -> tuple[str, str]:
    """Return preview and production paths. No fake production output is created."""
    magick = _magick()
    if not magick:
        raise RuntimeError("ImageMagick tidak ditemukan; install ImageMagick sebelum processing")
    preview.parent.mkdir(parents=True, exist_ok=True)
    production.parent.mkdir(parents=True, exist_ok=True)
    suffix = original.suffix.lower()
    if suffix == ".pdf":
        # Preserve the customer's PDF as production input until a product-specific PDF pipeline is configured.
        shutil.copy2(original, production)
        subprocess.run([magick, "-density", "120", str(original) + "[0]", "-resize", "1200x1200>", "-strip", str(preview)], check=True, capture_output=True)
    else:
        subprocess.run([magick, str(original), "-auto-orient", "-strip", "-resize", "1200x1200>", str(preview)], check=True, capture_output=True)
        subprocess.run([magick, str(original), "-auto-orient", "-colorspace", "CMYK", "-strip", "-compress", "Zip", str(production)], check=True, capture_output=True)
    return str(preview), str(production)


def _canvas(size: str, product: str) -> tuple[int, int, str]:
    """Return a bounded pixel canvas from operator-entered dimensions."""
    match = re.search(r"(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)", size.lower())
    if match:
        width_cm, height_cm = (float(value.replace(",", ".")) for value in match.groups())
        ratio = width_cm / height_cm if height_cm else 1.0
        source = f"size {width_cm:g}x{height_cm:g} cm"
    else:
        named_ratios = {"A4": 21 / 29.7, "A3": 29.7 / 42, "A2": 42 / 59.4}
        ratios = {
            "Banner": 300 / 100,
            "X-Banner": 60 / 160,
            "Spanduk": 100 / 300,
            "Poster": 1 / 1.414,
            "Kartu Nama": 9 / 5.5,
        }
        ratio = named_ratios.get(size, ratios.get(product, 4 / 3))
        source = f"default ratio for {product}"
    longest = 1800
    if ratio >= 1:
        return longest, max(1, round(longest / ratio)), source
    return max(1, round(longest * ratio)), longest, source


def _physical_dimensions(size: str, product: str) -> tuple[float, float]:
    """Return physical dimensions in cm for converting finishing to pixels."""
    match = re.fullmatch(r"\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?\s*", size.lower())
    if match:
        factor = {"mm": 0.1, "cm": 1.0, "m": 100.0}.get(match.group(3) or "cm", 1.0)
        return tuple(float(value.replace(",", ".")) * factor for value in match.groups()[:2])
    named = {
        "A4": (21.0, 29.7),
        "A3": (29.7, 42.0),
        "A2": (42.0, 59.4),
    }
    if size in named:
        return named[size]
    defaults = {
        "Banner": (300.0, 100.0),
        "X-Banner": (60.0, 160.0),
        "Spanduk": (100.0, 300.0),
        "Sticker": (100.0, 75.0),
        "Poster": (21.0, 29.7),
        "Kartu Nama": (9.0, 5.5),
    }
    return defaults.get(product, (100.0, 100.0))


def _finishing_pixels(size: str, product: str, canvas_w: int, canvas_h: int, finishing: str) -> tuple[int, int, int, int]:
    """Convert the selected physical finishing allowance into canvas pixels."""
    if not finishing:
        return 0, 0, 0, 0
    if finishing not in FINISHING_RULES:
        raise ValueError("Finishing harus Matik, Selongsong, atau Roll Banner")
    physical_w, physical_h = _physical_dimensions(size, product)
    pixels_per_cm = max(canvas_w / physical_w, canvas_h / physical_h)
    return tuple(max(0, round(value * pixels_per_cm)) for value in FINISHING_RULES[finishing])


def detect_colorspace(image: Path) -> str:
    """Read the colorspace recorded in the generated file for operator verification."""
    magick = _identify()
    if magick:
        command = [magick, "identify", "-format", "%[colorspace]", str(image)]
    else:
        if not magick:
            return "unknown"
        command = [magick, "identify", "-format", "%[colorspace]", str(image)]
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
    except (OSError, subprocess.CalledProcessError):
        return "unknown"
    return result.stdout.strip() or "unknown"


def convert_layout(original: Path, output: Path, product: str, size: str = "", color_mode: str = "Original", finishing: str = "", scale_up: bool = True, file_label: str = "") -> str:
    """Put the design on a real output canvas with guides and a top label."""
    output.parent.mkdir(parents=True, exist_ok=True)
    magick = _magick()
    if not magick:
        raise RuntimeError("ImageMagick tidak ditemukan; install ImageMagick sebelum layout")
    canvas_w, canvas_h, _ = _canvas(size, product)
    if scale_up:
        # Make the setting observable in the production file as well as in
        # the interpolation filter: the enabled path renders a 2x canvas.
        canvas_w *= 2
        canvas_h *= 2
    left, right, top, bottom = _finishing_pixels(size, product, canvas_w, canvas_h, finishing)
    physical_w, physical_h = _physical_dimensions(size, product)
    pixels_per_cm = max(canvas_w / physical_w, canvas_h / physical_h)
    # The operator-selected size is the real design area. Do not invent an
    # additional blank margin; only the selected finishing may add blank stock.
    inner_w, inner_h = canvas_w, canvas_h
    source = str(original) + "[0]" if original.suffix.lower() == ".pdf" else str(original)
    density = ["-density", "150"] if original.suffix.lower() == ".pdf" else []
    colorspace = {"RGB": "sRGB", "CMYK": "CMYK", "Grayscale": "Gray"}.get(color_mode)
    color_args = ["-colorspace", colorspace] if colorspace else []
    # `!` intentionally allows stretching: the operator's physical dimensions
    # are authoritative, even when the uploaded artwork has another ratio.
    resize_geometry = f"{inner_w}x{inner_h}!"
    command = [
        magick, *density, source, "-auto-orient", "-background", "white", "-alpha", "remove",
        "-alpha", "off", "-strip",
    ]
    if scale_up:
        command.extend(["-filter", "Lanczos"])
    command.extend(["-resize", resize_geometry, "-gravity", "center", "-extent", f"{canvas_w}x{canvas_h}"])
    if finishing:
        # The design occupies the original product area; finishing becomes
        # intentional extra material on the specified sides.
        command.extend([
            "-gravity", "northwest", "-splice", f"{left}x{top}",
            "-gravity", "southeast", "-splice", f"{right}x{bottom}",
        ])
    if scale_up:
        command.extend(["-unsharp", "0x0.75+0.75+0.02"])
    # The thin black guides are drawn after finishing is spliced in. The
    # inner guide marks the design boundary and the outer guide marks the
    # final sheet edge. Neither guide changes the canvas or finishing size;
    # both occupy pixels inside the already selected allowance.
    final_w, final_h = canvas_w + left + right, canvas_h + top + bottom
    # Keep both guides visibly thin while making them readable in large
    # exports. Both start at the canvas edge; there is no extra margin outside
    # the outer guide and therefore no change to the finishing allowance.
    guide_width = 4

    def guide_rectangles(x: int, y: int, width: int, height: int) -> str:
        """Return crisp filled strips, keeping every guide inside the canvas."""
        x2, y2 = x + width - 1, y + height - 1
        right_x, bottom_y = x2 - guide_width + 1, y2 - guide_width + 1
        return " ".join([
            f"rectangle {x},{y} {x + guide_width - 1},{y2}",
            f"rectangle {right_x},{y} {x2},{y2}",
            f"rectangle {x},{y} {x2},{y + guide_width - 1}",
            f"rectangle {x},{bottom_y} {x2},{y2}",
        ])

    guides = guide_rectangles(0, 0, final_w, final_h)
    if finishing:
        guides += " " + guide_rectangles(left, top, canvas_w, canvas_h)
    # Draw while the image is still in its source/RGB-like colorspace. Drawing
    # black after a CMYK conversion can be interpreted as zero ink (white) by
    # ImageMagick. Convert the complete result, including these guides, after
    # the drawing step.
    command.extend(["-fill", "black", "-stroke", "none", "-draw", guides])
    if file_label and top:
        label = " ".join(str(file_label).split()).strip()
        if len(label) > 50:
            label = label[:47].rstrip() + "..."
        # Scale the text from the available blank height. The larger minimum
        # keeps short names such as "images (1)" readable in a 2.5cm allowance.
        font_size = max(28, min(56, round(top * 0.32)))
        label_offset = max(guide_width + 2, round((top - font_size) / 2))
        command.extend([
            "-font", "DejaVu-Sans", "-pointsize", str(font_size),
            "-fill", "black", "-stroke", "none", "-gravity", "north",
            "-annotate", f"+0+{label_offset}", label,
        ])
    command.extend(color_args)
    command.extend(["-units", "PixelsPerCentimeter", "-density", f"{pixels_per_cm:.6f}", "-quality", "92", str(output)])
    subprocess.run(
        command,
        check=True,
        capture_output=True,
    )
    return str(output)
