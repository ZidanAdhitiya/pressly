"""Desktop entrypoint for the packaged Fazima Print application."""
from __future__ import annotations

import threading
import webbrowser

from backend import HOST, Handler, PORT, ROOT, ThreadingHTTPServer, init_db


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
        init_db()
        server = create_server()
        url = f"http://{HOST}:{server.server_port}/"
        write_startup_log(f"Fazima Print desktop aktif: {url}")
        print(f"Fazima Print desktop: {url}")
        threading.Timer(0.8, lambda: webbrowser.open(url, new=2, autoraise=True)).start()
        server.serve_forever()
    except Exception as exc:
        show_startup_error(f"{exc}\n\nLog: {ROOT / 'pressly-startup.log'}")
        raise


if __name__ == "__main__":
    main()
