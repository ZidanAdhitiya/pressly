"""Optional local backup for completed operator layout folders."""
from __future__ import annotations

import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

from backend import ROOT, STORAGE
from operator_database import layouts as mysql_layouts

BACKUP = ROOT / "backup"
RETENTION_DAYS = 5


def run() -> tuple[int, int]:
    BACKUP.mkdir(exist_ok=True)
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    rows = [{"raw_path": row.get("raw_path", ""), "created_at": row.get("created_at", "")} for row in mysql_layouts()]
    folders = {}
    for row in rows:
        raw = ROOT / row["raw_path"]
        if raw.exists():
            created = datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00"))
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
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
