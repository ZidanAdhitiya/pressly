"""Optional local backup for completed operator layout folders."""
from __future__ import annotations

import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

from backend import DB_LOCK, ROOT, STORAGE, get_db

BACKUP = ROOT / "backup"
RETENTION_DAYS = 5


def run() -> tuple[int, int]:
    BACKUP.mkdir(exist_ok=True)
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    with DB_LOCK, get_db() as db:
        rows = db.execute("SELECT raw_path, created_at FROM layout_jobs").fetchall()
    folders = {}
    for row in rows:
        raw = ROOT / row["raw_path"]
        if raw.exists():
            created = datetime.fromisoformat(row["created_at"])
            # A customer folder can contain several jobs. Keep it until every
            # job in that folder is outside the retention window.
            folders.setdefault(raw.parent, []).append(created)
    backed_up = removed = 0
    for folder, created_dates in folders.items():
        if any(created >= cutoff for created in created_dates):
            continue
        destination = BACKUP / folder.relative_to(STORAGE)
        if not destination.exists():
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(folder, destination)
            backed_up += 1
        shutil.rmtree(folder)
        removed += 1
    print(f"backup folders created: {backed_up}; working folders removed: {removed}")
    return backed_up, removed


if __name__ == "__main__":
    run()
