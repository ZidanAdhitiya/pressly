# PyInstaller one-file build. Build this on Windows with Windows Python.
from pathlib import Path
import os

project = Path(SPECPATH)
asset_names = [
    "index.html",
    "dashboard.html",
    "app.js",
    "dashboard.js",
    "styles.css",
    "ui-overrides.css",
    "modal.css",
]
datas = [(str(project / name), ".") for name in asset_names]

# Set PRESSLY_IMAGEMAGICK_DIR to the extracted portable ImageMagick folder.
# The complete folder is bundled so clients do not install ImageMagick.
imagemagick_dir = os.environ.get("PRESSLY_IMAGEMAGICK_DIR", "")
if imagemagick_dir:
    image_root = Path(imagemagick_dir).resolve()
    for source in image_root.rglob("*"):
        if source.is_file():
            destination = Path("imagemagick") / source.relative_to(image_root).parent
            datas.append((str(source), str(destination)))

a = Analysis(
    [str(project / "launcher.py")],
    pathex=[str(project)],
    binaries=[],
    datas=datas,
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="Pressly",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
)
