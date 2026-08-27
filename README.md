# Pressly — local operator layout workspace

Pressly is a local-only operator tool for quickly preparing print-layout files. There is no customer portal, checkout, account, or external service. The operator receives the order and design, enters the known production data, and runs the layout from one workspace.

## Run

Terminal:

```bash
python3 backend.py
```

Open `http://127.0.0.1:8080` in a browser.

The main page is for creating layouts. The operator dashboard is available at `http://127.0.0.1:8080/dashboard.html` and contains local history plus size-preset management.

The backend is intentionally bound to `127.0.0.1`, so this first implementation is local-only. Orders are stored in `pressly.db`; uploaded files are stored under `storage/`. Both are local development data and should not be committed.

## Customer app

The separate customer-facing app lives under `apps/customer/`. It keeps only the layouting function: customer input, upload, processing, preview, and download. It has no operator dashboard, SQLite history, preset management, or permanent storage. Each job uses a temporary directory and expires automatically.

Run it from the project root:

```bash
cd apps/customer
python3 backend.py
```

Open `http://127.0.0.1:8090`. For online deployment, put it behind HTTPS/reverse proxy and set `PRESSLY_CUSTOMER_HOST` and `PRESSLY_CUSTOMER_PORT`; the default host is `0.0.0.0` for deployment compatibility. Temporary job files are held for 30 minutes so the preview and download can work, then are deleted.

## Flow

1. Enter the optional customer name, product type, preset/custom size, color mode, optional pack, finishing option, and whether scale-up enhancement is enabled.
2. If the customer name is blank, Pressly automatically uses `client 1`, `client 2`, etc.
3. Upload JPG, PNG, or PDF up to 50 MB.
4. Press `Buat layout`.
5. Open the operator dashboard when you need local history or want to add/remove size presets.
6. The app creates `storage/Tipe/Nama Customer/` containing `raw.ext`, the same-extension output, and `detail.txt`.

The old worker entry point is retained only as a compatibility message; processing is now synchronous:

```bash
python3 worker.py
```

Optional retention/backup job:

```bash
python3 maintenance.py
```

It copies working order folders to `backup/` and removes working folders older than five days. Run it daily with your desktop scheduler.

## Customer app deployment boundary

The customer app under `apps/customer/` still uses its Python backend and ImageMagick processing. GitHub Pages or Vercel static hosting can serve its HTML, CSS, JavaScript, and mockup assets, but cannot run this backend or ImageMagick by themselves. Keep the customer backend on a Python-capable host and point the frontend at that service before advertising the preview and output flow online. The customer service remains database-free and keeps jobs only in temporary storage.

Customer finishing is available only for Banner, X-Banner, and Spanduk. Finishing has no extra charge in the customer estimate. The customer name, print notes, pickup/delivery note, color mode, output format, and scale-up setting are marked optional where applicable; product, size, quantity, file, contact name, and WhatsApp remain required for the current form flow.

### Deploy customer app with Render

The repository includes `Dockerfile.customer` and `render.yaml` for the customer service. In Render, choose **New Blueprint** and connect this repository, or create a Docker Web Service using `Dockerfile.customer`. Render supplies the public `PORT`; the customer backend reads it automatically and binds to `0.0.0.0`. The service exposes the customer UI and API from one origin, so preview and download keep working without CORS configuration. The filesystem is temporary by design and no database is required.

## Windows desktop build

`artifacts/windows/dist/Pressly.exe` is a one-file Windows x64 build. It bundles the Python runtime, frontend assets, and portable ImageMagick, so a client does not need to install Python or ImageMagick. The packaged executable does not ship the project `.py` files as editable files; this is packaging protection, not absolute protection against a technically capable reverse engineer on a computer they control.

On first run, the packaged app keeps the existing storage model under `%LOCALAPPDATA%\\Pressly`:

```text
pressly.db
storage\\Tipe\\Nama Customer\\raw.ext
storage\\Tipe\\Nama Customer\\output.ext
storage\\Tipe\\Nama Customer\\detail.txt
```

To rebuild on Windows, set `PRESSLY_IMAGEMAGICK_DIR` to an extracted portable ImageMagick folder and run `build_windows.ps1`. The build machine needs Python and PyInstaller; client machines do not.

## Important boundary

Preset orientation is defined consistently: `Banner` uses horizontal sizes `300x100 cm` and `400x100 cm`, `X-Banner` remains vertical at `60x160 cm` and `80x180 cm`, and `Spanduk` uses the reversed vertical sizes `100x300 cm` and `100x400 cm`. A4/A3/A2 presets use their real portrait ratios, while Kartu Nama remains landscape at `9x5.5 cm`. Operators can manage recommended numeric presets from the dashboard using centimeters, millimeters, or meters; changes are stored in SQLite and immediately appear in the layout form. The layout form supports PDF, JPG, and PNG output. The engine normalizes cm/mm/m into centimeters, writes output density metadata, and forces the design to exactly fill the operator-selected physical dimensions, including deliberate stretching when the source ratio differs. No extra blank margin is invented. Scale up is optional: when enabled, the output canvas is rendered at 2× resolution with Lanczos resizing and light sharpening; when disabled, the normal canvas resolution is used. The generated `detail.txt` records the requested color mode, output format, detected output colorspace, scale-up setting, and guide-line behavior. Finishing is structured: `Matik` adds 2.5 cm on every side, `Selongsong` adds 2.5 cm left/right and 8 cm top/bottom, and `Roll Banner` adds 2.5 cm left/right/top and 8 cm bottom. Thin black guide lines mark the design boundary and the final outer edge. They are drawn inside the existing canvas and finishing allowance, so they do not add to the selected 2.5 cm or 8 cm finishing measurements. The added area is the only intentional blank stock outside the design area. Product-specific bleed, business-card composition, and sticker cutting paths still need separate print-house rules; `pack` remains operator-entered metadata.
