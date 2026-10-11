"""Desktop entrypoint for the packaged Fazima Print application."""
from __future__ import annotations

import threading
import os
import subprocess
import sys
from pathlib import Path

from backend import HOST, Handler, PORT, ROOT, ThreadingHTTPServer, init_db


def search_shortcut_path() -> Path:
    roaming = Path(os.environ.get("APPDATA", Path.home() / "AppData/Roaming"))
    return roaming / "Microsoft/Windows/Start Menu/Programs/Fazima Print.lnk"


def offer_search_shortcut() -> None:
    """Ask packaged Windows users once whether to add the app to Windows Search."""
    if os.name != "nt" or not getattr(sys, "frozen", False):
        return
    shortcut_path = search_shortcut_path()
    if shortcut_path.is_file():
        return

    import tkinter as tk

    root = tk.Tk()
    root.title("Fazima Print")
    root.resizable(False, False)
    root.attributes("-topmost", True)
    root.protocol("WM_DELETE_WINDOW", root.destroy)
    root.geometry("390x175")

    tk.Label(
        root,
        text="Tambahkan Fazima Print ke Windows Search?",
        font=("Segoe UI", 11, "bold"),
        wraplength=350,
        justify="left",
    ).pack(anchor="w", padx=20, pady=(20, 8))
    tk.Label(
        root,
        text="Aplikasi akan muncul di pencarian Start Menu.",
        font=("Segoe UI", 9),
    ).pack(anchor="w", padx=20)
    pin = tk.BooleanVar(value=False)
    tk.Checkbutton(root, text="Pin to search", variable=pin, font=("Segoe UI", 9)).pack(
        anchor="w", padx=16, pady=(8, 4)
    )

    def continue_launch() -> None:
        if pin.get():
            try:
                shortcut_path.parent.mkdir(parents=True, exist_ok=True)
                env = os.environ.copy()
                env.update({
                    "PRESSLY_SHORTCUT_PATH": str(shortcut_path),
                    "PRESSLY_TARGET_PATH": str(Path(sys.executable).resolve()),
                    "PRESSLY_WORKING_DIR": str(Path(sys.executable).resolve().parent),
                })
                script = (
                    "$shell = New-Object -ComObject WScript.Shell; "
                    "$shortcut = $shell.CreateShortcut($env:PRESSLY_SHORTCUT_PATH); "
                    "$shortcut.TargetPath = $env:PRESSLY_TARGET_PATH; "
                    "$shortcut.WorkingDirectory = $env:PRESSLY_WORKING_DIR; "
                    "$shortcut.IconLocation = $env:PRESSLY_TARGET_PATH + ',0'; "
                    "$shortcut.Description = 'Fazima Print'; $shortcut.Save()"
                )
                subprocess.run(
                    ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                    timeout=15,
                    env=env,
                )
            except Exception as exc:
                from tkinter import messagebox
                messagebox.showerror(
                    "Tidak dapat menambahkan ke Search",
                    f"Shortcut Windows Search gagal dibuat. Anda dapat mencoba lagi saat membuka aplikasi berikutnya.\n\n{exc}",
                    parent=root,
                )
        root.destroy()

    tk.Button(root, text="Lanjutkan", command=continue_launch, width=12).pack(
        anchor="e", padx=20, pady=(0, 14)
    )
    root.mainloop()


def write_startup_log(message: str) -> None:
    """Leave a useful diagnostic behind when the GUI subsystem hides stdout."""
    try:
        ROOT.mkdir(parents=True, exist_ok=True)
        (ROOT / "pressly-startup.log").write_text(message + "\n", encoding="utf-8")
    except Exception:
        pass


def show_startup_error(message: str) -> None:
    write_startup_log(message)
    if __import__("os").name == "nt":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, message, "Fazima Print tidak dapat dijalankan", 0x10)
        except Exception:
            pass


def create_server() -> ThreadingHTTPServer:
    """Prefer 8080, then a nearby predictable port, then an OS-selected port."""
    candidates = [PORT] + [port for port in range(8081, 8091) if port != PORT]
    for port in candidates:
        try:
            return ThreadingHTTPServer((HOST, port), Handler)
        except OSError:
            continue
    return ThreadingHTTPServer((HOST, 0), Handler)


def main() -> None:
    try:
        offer_search_shortcut()
        init_db()
        server = create_server()
        url = f"http://{HOST}:{server.server_port}/"
        import webview

        server_thread = threading.Thread(target=server.serve_forever, name="fazimaprint-http", daemon=True)
        server_thread.start()
        write_startup_log(f"Fazima Print desktop aktif dalam jendela aplikasi: {url}")
        webview.create_window(
            "Fazima Print",
            url,
            width=1440,
            height=920,
            min_size=(1024, 680),
        )
        try:
            webview.start(gui="edgechromium")
        except Exception as exc:
            raise RuntimeError(
                "Jendela Fazima Print memerlukan Microsoft Edge WebView2 Runtime. "
                "Pasang runtime tersebut, lalu buka aplikasi kembali."
            ) from exc
        finally:
            server.shutdown()
            server.server_close()
    except Exception as exc:
        show_startup_error(f"{exc}\n\nLog: {ROOT / 'pressly-startup.log'}")
        raise


if __name__ == "__main__":
    main()
