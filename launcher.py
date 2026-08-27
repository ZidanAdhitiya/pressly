"""Desktop entrypoint for the packaged Pressly application."""
from __future__ import annotations

import threading
import webbrowser

from backend import HOST, Handler, PORT, ThreadingHTTPServer, init_db


def main() -> None:
    init_db()
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError:
        # A stale instance or another local service may already use 8080.
        # A random local port keeps the desktop app launchable.
        server = ThreadingHTTPServer((HOST, 0), Handler)
    url = f"http://{HOST}:{server.server_port}"
    print(f"Pressly desktop: {url}")
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    server.serve_forever()


if __name__ == "__main__":
    main()
