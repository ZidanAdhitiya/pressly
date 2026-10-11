# PyInstaller one-file build. Build this on Windows with Windows Python.
from pathlib import Path
import os

project = Path(SPECPATH)
asset_names = [
    "index.html",
    "dashboard.html",
    "setting.html",
    "operator-dashboard.html",
    "website-dashboard.html",
    "cashier.html",
    "master-data.html",
    "app.js",
    "dashboard.js",
    "operator-dashboard.js",
    "website-dashboard.js",
    "master-data.js",
    "cashier.js",
    "cashier-pages.js",
    "cashier-material.css",
    "master-export.js",
    "master-stock.js",
    "master-stock-live.js",
    "operator-dashboard.css",
    "global-nav.js",
    "global-nav.css",
    "cashier-auth.js",
    "cashier-login.css",
    "master-cashier.js",
    "operator-auth.js",
    "operator-login.css",
    "styles.css",
    "website-dashboard.css",
    "website-dashboard-final.css",
    "website-dashboard-table.css",
    "hub.css",
    "workflow.css",
    "workflow.js",
    "icons.css",
    "cashier.css",
    "cashier-pages.css",
    "cashier-web-orders.css",
    "master-data.css",
    "master-export.css",
    "master-stock.css",
    "master-editor.css",
    "ui-overrides.css",
    "modal.css",
    "assets/branding/fazima-print-logo.png",
    "assets/branding/fazima-print-icon.png",
]
datas = [(str(project / name), str(Path(name).parent)) for name in asset_names]

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
    hiddenimports=["pymysql", "pymysql.cursors"],
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
    name="Fazima Print",
    # Keep the GUI experience clean, but launcher.py shows a native error dialog
    # and writes pressly-startup.log when startup fails.
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
)
