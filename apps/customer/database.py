"""Small MySQL repository for the customer application.

The web process uses a restricted application user. phpMyAdmin is only an
administration client; it connects to the same MySQL database server.
"""
from __future__ import annotations

import json
import os
import re
import random
import math
from datetime import datetime, timedelta
from contextlib import contextmanager

try:
    import pymysql
    from pymysql.cursors import DictCursor
except ImportError:  # Keep import errors actionable when the app starts.
    pymysql = None
    DictCursor = None


class DatabaseNotConfigured(RuntimeError):
    pass


def configured() -> bool:
    return bool(os.environ.get("MYSQL_HOST") and os.environ.get("MYSQL_USER") and os.environ.get("MYSQL_DATABASE"))


def connect():
    if pymysql is None:
        raise DatabaseNotConfigured("Dependency pymysql belum terpasang. Jalankan pip install -r requirements.txt.")
    if not configured():
        raise DatabaseNotConfigured("MYSQL_HOST, MYSQL_USER, dan MYSQL_DATABASE wajib dikonfigurasi di environment backend.")
    return pymysql.connect(
        host=os.environ["MYSQL_HOST"], port=int(os.environ.get("MYSQL_PORT", "3306")),
        user=os.environ["MYSQL_USER"], password=os.environ.get("MYSQL_PASSWORD", ""),
        database=os.environ["MYSQL_DATABASE"], charset="utf8mb4", cursorclass=DictCursor,
        autocommit=False, connect_timeout=5,
    )


@contextmanager
def transaction():
    connection = connect()
    try:
        with connection.cursor() as cursor:
            yield connection, cursor
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


PROMO_TIMER_DEFAULTS = {
    "enabled": True,
    "mode": "one_time",
    "duration_seconds": 8 * 60 * 60,
    "reset_threshold_seconds": 4 * 60 * 60,
    "random_min_seconds": 4 * 60 * 60,
    "random_max_seconds": 12 * 60 * 60,
    "end_action": "hide_box",
}


def _timer_iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value.replace(" ", "T") + ("Z" if "T" not in value or not value.endswith("Z") else "")
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


def _timer_defaults() -> dict:
    now = datetime.utcnow()
    return {**PROMO_TIMER_DEFAULTS, "visible": True, "started_at": _timer_iso(now),
            "ends_at": _timer_iso(now + timedelta(seconds=PROMO_TIMER_DEFAULTS["duration_seconds"])),
            "generated_duration_seconds": PROMO_TIMER_DEFAULTS["duration_seconds"], "persisted": False}


def _new_cycle(row: dict, now: datetime) -> tuple[datetime, int]:
    mode = row["mode"]
    if mode == "random_loop":
        minimum = max(60, int(row["random_min_seconds"]))
        maximum = max(minimum, int(row["random_max_seconds"]))
        duration = random.randint(minimum, maximum)
    else:
        duration = max(60, int(row["duration_seconds"]))
    return now + timedelta(seconds=duration), duration


def _reconcile_promo_timer(cursor) -> dict:
    try:
        cursor.execute("SELECT * FROM promo_timer_settings WHERE id=1 FOR UPDATE")
        row = cursor.fetchone()
    except Exception as exc:
        if getattr(exc, "args", [None])[0] == 1146:
            return _timer_defaults()
        raise
    if not row:
        return _timer_defaults()
    row = dict(row)
    now = datetime.utcnow()
    ends_at = row.get("ends_at")
    threshold = max(0, int(row.get("reset_threshold_seconds") or 0))
    should_reset = row["enabled"] and row["mode"] in {"fixed_loop", "random_loop"} and ends_at is not None
    if should_reset and (ends_at - now).total_seconds() <= threshold:
        new_end, duration = _new_cycle(row, now)
        cursor.execute("UPDATE promo_timer_settings SET started_at=%s, ends_at=%s, generated_duration_seconds=%s, updated_at=CURRENT_TIMESTAMP WHERE id=1", (now, new_end, duration))
        row["started_at"], row["ends_at"], row["generated_duration_seconds"] = now, new_end, duration
    elif row["enabled"] and ends_at is not None and ends_at <= now and row["mode"] == "one_time":
        action = row["end_action"]
        if action == "reset_timer":
            new_end, duration = _new_cycle(row, now)
            cursor.execute("UPDATE promo_timer_settings SET started_at=%s, ends_at=%s, generated_duration_seconds=%s, updated_at=CURRENT_TIMESTAMP WHERE id=1", (now, new_end, duration))
            row["started_at"], row["ends_at"], row["generated_duration_seconds"] = now, new_end, duration
        else:
            cursor.execute("UPDATE promo_timer_settings SET enabled=0, updated_at=CURRENT_TIMESTAMP WHERE id=1")
            if action == "deactivate_promos":
                cursor.execute("UPDATE promotions SET is_active=0")
            row["enabled"] = 0
    row["visible"] = bool(row.get("enabled")) and bool(row.get("ends_at")) and row["ends_at"] > now
    row["persisted"] = True
    for key in ("started_at", "ends_at", "updated_at"):
        if key in row:
            row[key] = _timer_iso(row[key])
    for key in ("enabled", "duration_seconds", "reset_threshold_seconds", "random_min_seconds", "random_max_seconds", "generated_duration_seconds"):
        if key in row and row[key] is not None:
            row[key] = int(row[key])
    return row


def promo_timer_settings() -> dict:
    with transaction() as (_, cursor):
        return _reconcile_promo_timer(cursor)


def update_promo_timer_settings(payload: dict) -> dict:
    mode = str(payload.get("mode", "one_time")).strip()
    end_action = str(payload.get("end_action", "hide_box")).strip()
    if mode not in {"one_time", "fixed_loop", "random_loop"}:
        raise ValueError("Mode timer tidak valid")
    if end_action not in {"reset_timer", "hide_box", "deactivate_promos"}:
        raise ValueError("Aksi akhir timer tidak valid")
    enabled = 1 if payload.get("enabled", True) else 0
    duration = max(60, int(payload.get("duration_seconds", PROMO_TIMER_DEFAULTS["duration_seconds"])))
    threshold = max(0, int(payload.get("reset_threshold_seconds", PROMO_TIMER_DEFAULTS["reset_threshold_seconds"])))
    random_min = max(60, int(payload.get("random_min_seconds", PROMO_TIMER_DEFAULTS["random_min_seconds"])))
    random_max = max(random_min, int(payload.get("random_max_seconds", PROMO_TIMER_DEFAULTS["random_max_seconds"])))
    with transaction() as (_, cursor):
        try:
            cursor.execute("SELECT * FROM promo_timer_settings WHERE id=1 FOR UPDATE")
            existing = cursor.fetchone()
        except Exception as exc:
            if getattr(exc, "args", [None])[0] == 1146:
                raise DatabaseNotConfigured("Tabel promo_timer_settings belum ada. Import migrate_promo_timer.sql lewat phpMyAdmin.") from exc
            raise
        now = datetime.utcnow()
        current_end = existing.get("ends_at") if existing else None
        keep_cycle = bool(existing and existing.get("mode") == mode and existing.get("enabled") and current_end and current_end > now and not payload.get("restart_cycle"))
        if keep_cycle:
            started_at, ends_at, generated = existing["started_at"], existing["ends_at"], existing.get("generated_duration_seconds") or duration
        else:
            draft = {"mode": mode, "duration_seconds": duration, "random_min_seconds": random_min, "random_max_seconds": random_max}
            ends_at, generated = _new_cycle(draft, now)
            started_at = now
        cursor.execute("""INSERT INTO promo_timer_settings
            (id, enabled, mode, duration_seconds, reset_threshold_seconds, random_min_seconds, random_max_seconds, end_action, started_at, ends_at, generated_duration_seconds)
            VALUES (1,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), mode=VALUES(mode), duration_seconds=VALUES(duration_seconds), reset_threshold_seconds=VALUES(reset_threshold_seconds), random_min_seconds=VALUES(random_min_seconds), random_max_seconds=VALUES(random_max_seconds), end_action=VALUES(end_action), started_at=VALUES(started_at), ends_at=VALUES(ends_at), generated_duration_seconds=VALUES(generated_duration_seconds), updated_at=CURRENT_TIMESTAMP""",
            (enabled, mode, duration, threshold, random_min, random_max, end_action, started_at if enabled else None, ends_at if enabled else None, generated if enabled else None))
        if not enabled or end_action == "deactivate_promos":
            cursor.execute("UPDATE promotions SET is_active=0")
        elif enabled and payload.get("reactivate_promos"):
            cursor.execute("UPDATE promotions SET is_active=1")
        return _reconcile_promo_timer(cursor)


def catalog_rows(include_inactive: bool = False, ignore_timer: bool = False) -> list[dict]:
    with transaction() as (_, cursor):
        cursor.execute("SHOW COLUMNS FROM products LIKE 'description'")
        has_description = bool(cursor.fetchone())
        cursor.execute("SHOW COLUMNS FROM products LIKE 'materials_json'")
        has_materials = bool(cursor.fetchone())
        timer_enabled = True if ignore_timer else bool(_reconcile_promo_timer(cursor).get("visible"))
        where_clause = "1=1" if include_inactive else "p.is_active=1"
        promo_join = "LEFT JOIN promotions pr ON pr.product_id=p.id AND pr.is_active=1 AND (pr.starts_at IS NULL OR pr.starts_at <= NOW()) AND (pr.ends_at IS NULL OR pr.ends_at >= NOW())" if timer_enabled else "LEFT JOIN promotions pr ON 1=0"
        cursor.execute(f"""
            SELECT p.id, p.name, p.slug, p.category, p.product_type, p.kind, p.unit,
                   p.base_price, p.image_path, {"p.description" if has_description else "''"} AS description, p.sizes_json,
                   {"p.materials_json" if has_materials else "'[]'"} AS materials_json,
                   COALESCE(s.sales_count, 0) AS sales_count,
                   pr.id AS promo_id, pr.title AS promo_title, pr.discount_percent, pr.promo_price,
                   pr.starts_at AS promo_starts_at, pr.ends_at AS promo_ends_at
            FROM products p
            LEFT JOIN (SELECT sold.product_id, SUM(sold.quantity) AS sales_count FROM (
                         SELECT oi.product_id, oi.quantity FROM order_items oi JOIN orders o ON o.id=oi.order_id
                         WHERE o.status IN ('paid','processing','ready','completed') AND oi.product_id IS NOT NULL
                         UNION ALL
                         SELECT ci.product_id, ci.quantity FROM cashier_sale_items ci JOIN cashier_sales cs ON cs.id=ci.sale_id
                         WHERE cs.status IN ('paid','partial') AND ci.product_id IS NOT NULL
                       ) sold GROUP BY sold.product_id) s ON s.product_id=p.id
            {promo_join}
            WHERE {where_clause} ORDER BY p.category, p.id
        """)
        rows = cursor.fetchall()
    result = []
    for row in rows:
        row["sizes"] = json.loads(row.pop("sizes_json") or "[]")
        row["materials"] = json.loads(row.pop("materials_json") or "[]")
        row["base_price"] = float(row["base_price"])
        row["sales_count"] = int(row.get("sales_count") or 0)
        if row["promo_id"] is not None:
            row["discount_percent"] = float(row["discount_percent"])
            row["promo_price"] = float(row["promo_price"])
        result.append(row)
    return result


def save_chat_message(session_id: str, role: str, message: str, account_id: int | None = None) -> None:
    """Persist anonymous or authenticated chat messages by session."""
    session_id = str(session_id or "").strip()[:80]
    role = str(role or "").strip().lower()
    message = str(message or "").strip()
    if not session_id or role not in {"user", "model", "system"} or not message:
        raise ValueError("Sesi chat atau pesan tidak valid")
    with transaction() as (_, cursor):
        cursor.execute(
            "INSERT INTO chat_messages (account_id, session_id, role, message) VALUES (%s,%s,%s,%s)",
            (account_id, session_id, role, message[:12000]),
        )


def chat_session_rows(limit: int = 100) -> list[dict]:
    """Return recent anonymous/customer chat sessions for operator review."""
    with transaction() as (_, cursor):
        cursor.execute("""
            SELECT session_id, MAX(created_at) AS updated_at,
                   MIN(created_at) AS started_at, COUNT(*) AS message_count,
                   SUBSTRING_INDEX(GROUP_CONCAT(message ORDER BY created_at DESC SEPARATOR ' || '), ' || ', 1) AS latest_message
            FROM chat_messages
            GROUP BY session_id ORDER BY updated_at DESC LIMIT %s
        """, (max(1, min(int(limit), 500)),))
        return list(cursor.fetchall())


def chat_messages(session_id: str, limit: int = 200) -> list[dict]:
    with transaction() as (_, cursor):
        cursor.execute("""
            SELECT session_id, role, message, created_at
            FROM chat_messages WHERE session_id=%s ORDER BY created_at ASC LIMIT %s
        """, (str(session_id)[:80], max(1, min(int(limit), 500))))
        return list(cursor.fetchall())


def save_payment_status(notification: dict) -> None:
    """Upsert Midtrans status and keep the customer order status queryable."""
    order_number = str(notification.get("order_id", "")).strip()
    if not order_number:
        raise ValueError("Order ID pembayaran tidak valid")
    transaction_status = str(notification.get("transaction_status", "pending"))[:40]
    fraud_status = str(notification.get("fraud_status", ""))[:40] or None
    gross_amount = float(notification.get("gross_amount") or 0)
    mapped_status = {
        "settlement": "paid", "capture": "paid", "pending": "pending_payment",
        "expire": "cancelled", "cancel": "cancelled", "deny": "cancelled", "failure": "cancelled",
    }.get(transaction_status, "pending_payment")
    raw_payload = json.dumps(notification, ensure_ascii=False)
    with transaction() as (_, cursor):
        cursor.execute("SELECT id, grand_total FROM orders WHERE order_number=%s", (order_number,))
        order = cursor.fetchone()
        if not order:
            raise ValueError("Order pembayaran tidak ditemukan")
        cursor.execute("""
            INSERT INTO payments (order_id, provider, provider_order_id, transaction_status, fraud_status, gross_amount, raw_payload)
            VALUES (%s,'midtrans',%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE transaction_status=VALUES(transaction_status), fraud_status=VALUES(fraud_status), gross_amount=VALUES(gross_amount), raw_payload=VALUES(raw_payload)
        """, (order["id"], order_number, transaction_status, fraud_status, gross_amount, raw_payload))
        cursor.execute("UPDATE orders SET status=%s WHERE id=%s", (mapped_status, order["id"]))


def order_rows(limit: int = 100) -> list[dict]:
    with transaction() as (_, cursor):
        cursor.execute("""
            SELECT o.id, o.order_number, o.customer_name, o.customer_phone,
                   o.grand_total, o.status, o.source, o.workflow_status,
                   o.rejection_reason, o.setting_note, o.deadline_at,
                   o.created_at, o.updated_at,
                   p.transaction_status, p.fraud_status
            FROM orders o LEFT JOIN payments p ON p.order_id=o.id
            ORDER BY o.created_at DESC LIMIT %s
        """, (max(1, min(int(limit), 500)),))
        rows = list(cursor.fetchall())
    for row in rows:
        if row.get("grand_total") is not None:
            row["grand_total"] = float(row["grand_total"])
        if row.get("created_at") is not None:
            row["created_at"] = row["created_at"].isoformat(sep=" ")
        if row.get("updated_at") is not None:
            row["updated_at"] = row["updated_at"].isoformat(sep=" ")
    return rows


def order_by_number(order_number: str) -> dict | None:
    with transaction() as (_, cursor):
        cursor.execute("""
            SELECT o.order_number, o.customer_name, o.customer_phone, o.source,
                   o.grand_total, o.status, o.workflow_status, o.rejection_reason,
                   o.setting_note, o.deadline_at, o.layout_token, o.layout_output_name,
                   o.layout_saved_at, o.cashier_note, o.created_at, o.updated_at,
                   p.transaction_status, p.fraud_status
            FROM orders o LEFT JOIN payments p ON p.order_id=o.id
            WHERE o.order_number=%s LIMIT 1
        """, (order_number,))
        order = cursor.fetchone()
        if not order:
            return None
        cursor.execute("""
            SELECT product_name, size_label, quantity, unit_price, item_total, finishing
            FROM order_items WHERE order_id=(SELECT id FROM orders WHERE order_number=%s LIMIT 1)
            ORDER BY id
        """, (order_number,))
        items = list(cursor.fetchall())
    order = dict(order)
    order["grand_total"] = float(order["grand_total"] or 0)
    for field in ("created_at", "updated_at", "deadline_at", "layout_saved_at"):
        if order.get(field) is not None:
            order[field] = order[field].isoformat(sep=" ")
    for item in items:
        item["unit_price"] = float(item["unit_price"] or 0)
        item["item_total"] = float(item["item_total"] or 0)
    order["items"] = items
    return order


WORKFLOW_STATUSES = {
    "DRAFT_MANUAL", "MENUNGGU_VALIDASI_SETTING", "MENUNGGU_DOUBLE_VERIFIKASI",
    "DITOLAK_SETTING", "DITERIMA_SETTING", "SIAP_AUTO_LAYOUT", "LAYOUT_TERSEDIA",
    "MENUNGGU_VALIDASI_KASIR", "DITOLAK_KASIR", "PERLU_PERBAIKAN_SETTING", "DITERIMA_KASIR",
    "MENUNGGU_OPERATOR", "SEDANG_DIPRODUKSI", "SELESAI_PRODUKSI",
}
ORDER_SOURCES = {"WEB", "SHOPEE", "ECOMMERCE_LAIN"}


def _clean_actor(value: object, label: str) -> str:
    actor = str(value or "").strip()[:120]
    if not actor:
        raise ValueError(f"{label} wajib diisi")
    return actor


def _audit_status(cursor, order_id: int, from_status: str | None, to_status: str,
                  actor_role: str, actor_name: str, note: str = "") -> None:
    cursor.execute("""
        INSERT INTO order_status_history
            (order_id, from_status, to_status, actor_role, actor_name, note)
        VALUES (%s,%s,%s,%s,%s,%s)
    """, (order_id, from_status, to_status, actor_role[:32], actor_name[:120], note[:5000]))


def _notify(cursor, order_id: int | None, team: str, notification_type: str,
            title: str, message: str) -> None:
    cursor.execute("""
        INSERT INTO dashboard_notifications
            (order_id, target_team, notification_type, title, message)
        VALUES (%s,%s,%s,%s,%s)
    """, (order_id, team[:32], notification_type[:48], title[:180], message[:5000]))


def dashboard_order_rows(limit: int = 100, workflow_status: str = "", source: str = "") -> list[dict]:
    clauses = []
    params: list[object] = []
    if workflow_status:
        if workflow_status not in WORKFLOW_STATUSES:
            raise ValueError("Status workflow tidak valid")
        clauses.append("o.workflow_status=%s")
        params.append(workflow_status)
    if source:
        source = source.upper()
        if source not in ORDER_SOURCES:
            raise ValueError("Sumber order tidak valid")
        clauses.append("o.source=%s")
        params.append(source)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(max(1, min(int(limit), 500)))
    with transaction() as (_, cursor):
        cursor.execute(f"""
            SELECT o.id, o.order_number, o.customer_name, o.customer_phone,
                   o.source, o.grand_total, o.status, o.workflow_status,
                   o.rejection_reason, o.setting_note, o.deadline_at,
                   o.created_at, o.updated_at, p.transaction_status, p.fraud_status
            FROM orders o LEFT JOIN payments p ON p.order_id=o.id
            {where}
            ORDER BY o.created_at DESC LIMIT %s
        """, tuple(params))
        rows = list(cursor.fetchall())
    for row in rows:
        for field in ("grand_total",):
            if row.get(field) is not None:
                row[field] = float(row[field])
        for field in ("created_at", "updated_at", "deadline_at"):
            if row.get(field) is not None:
                row[field] = row[field].isoformat(sep=" ")
    return rows


def dashboard_order_detail(order_number: str) -> dict | None:
    order = order_by_number(order_number)
    if not order:
        return None
    with transaction() as (_, cursor):
        cursor.execute("""
            SELECT from_status, to_status, actor_role, actor_name, note, created_at
            FROM order_status_history
            WHERE order_id=(SELECT id FROM orders WHERE order_number=%s LIMIT 1)
            ORDER BY created_at ASC, id ASC
        """, (order_number,))
        history = list(cursor.fetchall())
        cursor.execute("""
            SELECT target_status, verifier_name, verifier_role, verification_note, created_at
            FROM order_verifications
            WHERE order_id=(SELECT id FROM orders WHERE order_number=%s LIMIT 1)
            ORDER BY created_at ASC, id ASC
        """, (order_number,))
        verifications = list(cursor.fetchall())
    for collection in (history, verifications):
        for row in collection:
            if row.get("created_at") is not None:
                row["created_at"] = row["created_at"].isoformat(sep=" ")
    order["history"] = history
    order["verifications"] = verifications
    return order


def create_manual_order(payload: dict) -> dict:
    source = str(payload.get("source", "")).strip().upper()
    if source not in {"SHOPEE", "ECOMMERCE_LAIN"}:
        raise ValueError("Order manual harus bersumber dari SHOPEE atau ECOMMERCE_LAIN")
    items = payload.get("items")
    if not isinstance(items, list) or not items or len(items) > 50:
        raise ValueError("Minimal satu item order wajib diisi")
    actor = _clean_actor(payload.get("actor_name"), "Nama Team Setting")
    customer = str(payload.get("customer_name", "")).strip()[:120]
    phone = str(payload.get("customer_phone", "")).strip()[:40]
    if not customer or not phone:
        raise ValueError("Nama customer dan nomor WhatsApp wajib diisi")
    subtotal = 0.0
    clean_items = []
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Format item order tidak valid")
        name = str(item.get("product_name", "")).strip()[:120]
        size = str(item.get("size_label", "")).strip()[:80]
        quantity = int(item.get("quantity", 0))
        unit_price = float(item.get("unit_price", 0))
        if not name or not size or not 1 <= quantity <= 100000 or unit_price < 0:
            raise ValueError("Detail item order tidak valid")
        line_total = round(unit_price * quantity, 2)
        subtotal += line_total
        clean_items.append((name, size, str(item.get("material", ""))[:80], quantity,
                            unit_price, str(item.get("finishing", ""))[:80],
                            str(item.get("design_file", ""))[:255], line_total))
    order_number = str(payload.get("order_number", "")).strip()[:40] or f"FZ-M-{__import__('time').time_ns()}"
    note = str(payload.get("note", "")).strip()[:5000]
    with transaction() as (_, cursor):
        cursor.execute("""
            INSERT INTO orders
                (order_number, source, customer_name, customer_phone, delivery_method,
                 address, subtotal, discount_total, grand_total, status, workflow_status,
                 notes, deadline_at, setting_note)
            VALUES (%s,%s,%s,%s,%s,%s,%s,0,%s,'draft','DRAFT_MANUAL',%s,%s,%s)
        """, (order_number, source, customer, phone,
              "delivery" if payload.get("delivery_method") == "delivery" else "pickup",
              str(payload.get("address", ""))[:5000], subtotal, subtotal, note,
              payload.get("deadline_at") or None, note))
        order_id = cursor.lastrowid
        for item in clean_items:
            cursor.execute("""
                INSERT INTO order_items
                    (order_id, product_name, size_label, material, quantity, unit_price,
                     original_unit_price, finishing, design_file, item_total)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (order_id, item[0], item[1], item[2], item[3], item[4], item[4],
                  item[5], item[6], item[7]))
        _audit_status(cursor, order_id, None, "DRAFT_MANUAL", "setting", actor, note)
        _notify(cursor, order_id, "SETTING", "MANUAL_ORDER_CREATED",
                "Order manual baru", f"{order_number} dari {source} menunggu validasi Team Setting.")
    return {"id": order_id, "order_id": order_number, "source": source,
            "subtotal": subtotal, "grand_total": subtotal, "workflow_status": "DRAFT_MANUAL"}


def setting_decision(order_number: str, payload: dict) -> dict:
    action = str(payload.get("action", "")).strip().lower()
    if action not in {"accept", "reject"}:
        raise ValueError("Aksi Team Setting harus accept atau reject")
    actor = _clean_actor(payload.get("actor_name"), "Nama validator pertama")
    verifier = _clean_actor(payload.get("verifier_name"), "Nama verifier kedua")
    if actor.casefold() == verifier.casefold():
        raise ValueError("Validator pertama dan verifier kedua harus berbeda")
    note = str(payload.get("note", "")).strip()[:5000]
    if action == "reject" and not note:
        raise ValueError("Alasan penolakan wajib diisi")
    target = "SIAP_AUTO_LAYOUT" if action == "accept" else "DITOLAK_SETTING"
    with transaction() as (_, cursor):
        cursor.execute("SELECT id, workflow_status, customer_name FROM orders WHERE order_number=%s FOR UPDATE", (order_number,))
        order = cursor.fetchone()
        if not order:
            raise ValueError("Order tidak ditemukan")
        if order["workflow_status"] not in {"DRAFT_MANUAL", "MENUNGGU_VALIDASI_SETTING", "MENUNGGU_DOUBLE_VERIFIKASI"}:
            raise ValueError("Order tidak berada pada antrean validasi Team Setting")
        cursor.execute("SELECT COUNT(*) AS total FROM order_verifications WHERE order_id=%s AND target_status=%s", (order["id"], target))
        if int(cursor.fetchone()["total"]):
            raise ValueError("Keputusan order ini sudah diverifikasi")
        cursor.execute("UPDATE orders SET workflow_status=%s, rejection_reason=%s, setting_note=%s WHERE id=%s",
                       (target, note if action == "reject" else None, note, order["id"]))
        for name in (actor, verifier):
            cursor.execute("""
                INSERT INTO order_verifications
                    (order_id, target_status, verifier_name, verifier_role, verification_note)
                VALUES (%s,%s,%s,'setting',%s)
            """, (order["id"], target, name, note))
        _audit_status(cursor, order["id"], order["workflow_status"], target, "setting",
                      f"{actor} + {verifier}", note)
        if action == "accept":
            _notify(cursor, order["id"], "SETTING", "SETTING_ACCEPTED",
                    "Order diterima Team Setting", f"{order_number} siap masuk Auto Layout.")
        else:
            _notify(cursor, order["id"], "SETTING", "SETTING_REJECTED",
                    "Order ditolak Team Setting", f"{order_number} ditolak: {note}")
    return {"order_id": order_number, "workflow_status": target, "verified_by": [actor, verifier], "note": note}


def save_layout_for_order(order_number: str, layout: dict) -> dict:
    actor = _clean_actor(layout.get("actor_name"), "Nama Team Setting")
    token = str(layout.get("token", "")).strip()[:32]
    output_name = str(layout.get("output_name", "")).strip()[:255]
    file_path = str(layout.get("file_path", "")).strip()[:500]
    if not token or not output_name or not file_path:
        raise ValueError("Data layout final belum lengkap")
    with transaction() as (_, cursor):
        cursor.execute("SELECT id, workflow_status FROM orders WHERE order_number=%s FOR UPDATE", (order_number,))
        order = cursor.fetchone()
        if not order:
            raise ValueError("Order tidak ditemukan")
        if order["workflow_status"] not in {"SIAP_AUTO_LAYOUT", "PERLU_PERBAIKAN_SETTING"}:
            raise ValueError("Order belum siap diproses Auto Layout")
        cursor.execute("""
            UPDATE orders
            SET workflow_status='LAYOUT_TERSEDIA', layout_token=%s, layout_output_name=%s,
                layout_file_path=%s, layout_saved_at=NOW(), setting_note=%s
            WHERE id=%s
        """, (token, output_name, file_path, str(layout.get("note", ""))[:5000], order["id"]))
        cursor.execute("""
            INSERT INTO layout_jobs
                (order_id, token, product_name, input_file, output_file, output_name,
                 storage_path, status, expires_at, saved_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,'ready',DATE_ADD(NOW(), INTERVAL 30 DAY),NOW())
        """, (order["id"], token, str(layout.get("product_name", ""))[:120],
              str(layout.get("input_file", ""))[:255], output_name, output_name,
              file_path))
        _audit_status(cursor, order["id"], order["workflow_status"], "LAYOUT_TERSEDIA",
                      "setting", actor, str(layout.get("note", "")))
        _notify(cursor, order["id"], "SETTING", "LAYOUT_READY",
                "Auto Layout selesai", f"{order_number} sudah memiliki file layout final.")
    return {"order_id": order_number, "workflow_status": "LAYOUT_TERSEDIA",
            "layout_token": token, "output_name": output_name}


def transfer_order_to_cashier(order_number: str, payload: dict) -> dict:
    actor = _clean_actor(payload.get("actor_name"), "Nama Team Setting")
    note = str(payload.get("note", "")).strip()[:5000]
    with transaction() as (_, cursor):
        cursor.execute("SELECT id, workflow_status FROM orders WHERE order_number=%s FOR UPDATE", (order_number,))
        order = cursor.fetchone()
        if not order:
            raise ValueError("Order tidak ditemukan")
        if order["workflow_status"] != "LAYOUT_TERSEDIA":
            raise ValueError("Order belum memiliki layout final yang tersimpan")
        cursor.execute("UPDATE orders SET workflow_status='MENUNGGU_VALIDASI_KASIR', setting_note=%s WHERE id=%s", (note, order["id"]))
        _audit_status(cursor, order["id"], order["workflow_status"], "MENUNGGU_VALIDASI_KASIR", "setting", actor, note)
        _notify(cursor, order["id"], "KASIR", "ORDER_TRANSFERRED",
                "Order baru untuk Kasir", f"{order_number} sudah ditransfer Team Setting beserta file layout final.")
    return {"order_id": order_number, "workflow_status": "MENUNGGU_VALIDASI_KASIR"}


def cashier_decision(order_number: str, payload: dict) -> dict:
    action = str(payload.get("action", "")).strip().lower()
    if action not in {"accept", "reject"}:
        raise ValueError("Aksi Kasir harus accept atau reject")
    actor = _clean_actor(payload.get("actor_name"), "Nama Kasir")
    note = str(payload.get("note", "")).strip()[:5000]
    if action == "reject" and not note:
        raise ValueError("Alasan penolakan Kasir wajib diisi")
    target = "DITERIMA_KASIR" if action == "accept" else "PERLU_PERBAIKAN_SETTING"
    with transaction() as (_, cursor):
        cursor.execute("SELECT id, workflow_status FROM orders WHERE order_number=%s FOR UPDATE", (order_number,))
        order = cursor.fetchone()
        if not order or order["workflow_status"] != "MENUNGGU_VALIDASI_KASIR":
            raise ValueError("Order belum berada di antrean Kasir")
        cursor.execute("UPDATE orders SET workflow_status=%s, cashier_note=%s WHERE id=%s", (target, note, order["id"]))
        audit_target = target
        if action == "accept":
            cursor.execute("SELECT material, product_name FROM order_items WHERE order_id=%s ORDER BY id LIMIT 1", (order["id"],))
            item = cursor.fetchone() or {}
            material = str(item.get("material") or "").lower()
            category = "Outdoor" if any(word in material for word in ("flexy", "korea", "backlite", "oneway")) else "Indoor" if any(word in material for word in ("ritrama", "graftac", "blockout", "albatros", "luster", "quantac", "camel")) else "A3"
            cursor.execute("INSERT INTO production_jobs (order_id, production_category, status) VALUES (%s,%s,'queued') ON DUPLICATE KEY UPDATE production_category=VALUES(production_category), status='queued'", (order["id"], category))
            cursor.execute("UPDATE orders SET workflow_status='MENUNGGU_OPERATOR' WHERE id=%s", (order["id"],))
            audit_target = "MENUNGGU_OPERATOR"
            _notify(cursor, order["id"], "DASHBOARD", "CASHIER_ACCEPTED",
                    "Order diterima Kasir", f"{order_number} diterima Kasir dan siap diteruskan ke produksi.")
            _notify(cursor, order["id"], "OPERATOR", "PRODUCTION_ASSIGNED",
                    "Order masuk antrean produksi", f"{order_number} siap diproses Operator {category}.")
        else:
            _notify(cursor, order["id"], "SETTING", "CASHIER_REJECTED",
                    "Order ditolak Kasir", f"{order_number} perlu diperbaiki: {note}")
        _audit_status(cursor, order["id"], order["workflow_status"], audit_target, "cashier", actor, note)
    return {"order_id": order_number, "workflow_status": "MENUNGGU_OPERATOR" if action == "accept" else target, "note": note}


def production_job_rows(category: str = "", limit: int = 100) -> list[dict]:
    clauses, params = [], []
    if category:
        clauses.append("p.production_category=%s"); params.append(str(category)[:20])
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    params.append(max(1, min(int(limit), 500)))
    with transaction() as (_, cursor):
        cursor.execute(f"""
            SELECT p.id, p.order_id, p.production_category, p.status, p.operator_name,
                   p.started_at, p.completed_at, p.notes, p.created_at, p.updated_at,
                   o.order_number, o.customer_name, o.customer_phone, o.workflow_status,
                   o.layout_token, o.layout_output_name, o.layout_file_path, o.deadline_at,
                   o.grand_total, o.source
            FROM production_jobs p JOIN orders o ON o.id=p.order_id
            {where} ORDER BY FIELD(p.status,'in_progress','queued','blocked','completed'), p.created_at ASC LIMIT %s
        """, tuple(params))
        rows = list(cursor.fetchall())
        for row in rows:
            cursor.execute("SELECT u.id, u.stock_item_id, s.name, u.quantity, u.unit, u.note, u.usage_type, u.order_group, u.channel, u.operator_name FROM production_material_usage u JOIN stock_items s ON s.id=u.stock_item_id WHERE u.production_job_id=%s ORDER BY u.id", (row["id"],))
            row["materials"] = list(cursor.fetchall())
    for row in rows:
        row["grand_total"] = float(row["grand_total"] or 0)
        for material in row.get("materials", []):
            material["quantity"] = float(material["quantity"] or 0)
        for field in ("started_at", "completed_at", "created_at", "updated_at", "deadline_at"):
            if row.get(field) is not None: row[field] = row[field].isoformat(sep=" ")
    return rows


def start_production(order_number: str, payload: dict) -> dict:
    actor = _clean_actor(payload.get("operator_name"), "Nama Operator")
    with transaction() as (_, cursor):
        cursor.execute("SELECT p.id, p.status, o.id AS order_id, o.workflow_status FROM production_jobs p JOIN orders o ON o.id=p.order_id WHERE o.order_number=%s FOR UPDATE", (order_number,))
        job = cursor.fetchone()
        if not job: raise ValueError("Order belum masuk antrean produksi")
        if job["status"] not in {"queued", "blocked"}: raise ValueError("Order tidak dapat dimulai dari status ini")
        cursor.execute("UPDATE production_jobs SET status='in_progress', operator_name=%s, started_at=COALESCE(started_at,NOW()), notes=%s WHERE id=%s", (actor, str(payload.get("note", ""))[:5000], job["id"]))
        cursor.execute("UPDATE orders SET workflow_status='SEDANG_DIPRODUKSI', status='processing' WHERE id=%s", (job["order_id"],))
        _audit_status(cursor, job["order_id"], job["workflow_status"], "SEDANG_DIPRODUKSI", "operator", actor, str(payload.get("note", "")))
        _notify(cursor, job["order_id"], "DASHBOARD", "PRODUCTION_STARTED", "Produksi dimulai", f"{order_number} sedang dikerjakan oleh {actor}.")
    return {"order_id": order_number, "workflow_status": "SEDANG_DIPRODUKSI", "status": "in_progress"}


def complete_production(order_number: str, payload: dict) -> dict:
    actor = _clean_actor(payload.get("operator_name"), "Nama Operator")
    usages = payload.get("materials", [])
    if not isinstance(usages, list) or not usages: raise ValueError("Minimal satu bahan yang digunakan wajib dicatat")
    with transaction() as (_, cursor):
        cursor.execute("SELECT p.id, p.status, o.id AS order_id, o.workflow_status FROM production_jobs p JOIN orders o ON o.id=p.order_id WHERE o.order_number=%s FOR UPDATE", (order_number,))
        job = cursor.fetchone()
        if not job or job["status"] != "in_progress": raise ValueError("Order belum berstatus sedang diproduksi")
        clean = []
        aggregated: dict[int, dict] = {}
        cursor.execute("SELECT source FROM orders WHERE id=%s", (job["order_id"],)); source_row=cursor.fetchone()
        source = str((source_row or {}).get("source") or "WEB").upper()
        order_group = "offline" if source in {"OFFLINE", "CASHIER"} else "online"
        channel = "Fazima" if source in {"WEB", "FAZIMA"} else source.title()
        for item in usages:
            stock_id = int(item.get("stock_item_id", 0))
            components=item.get("components") or {"good":item.get("quantity",0)}
            clean_components={key:float(components.get(key,0) or 0) for key in ("good","machine_reject","operator_error","other_reprint")}
            if stock_id <= 0 or any(value < 0 or not math.isfinite(value) for value in clean_components.values()) or sum(clean_components.values()) <= 0: raise ValueError("Jumlah pemakaian bahan harus valid")
            entry=aggregated.setdefault(stock_id,{"components":{key:0.0 for key in clean_components},"notes":[]})
            for key,value in clean_components.items():entry["components"][key]+=value
            note=str(item.get("note", ""))[:500]
            if note:entry["notes"].append(note)
        for stock_id,entry in aggregated.items():
            clean_components=entry["components"]
            quantity=sum(clean_components.values())
            cursor.execute("SELECT id, name, unit, quantity FROM stock_items WHERE id=%s AND active=1 FOR UPDATE", (stock_id,))
            stock = cursor.fetchone()
            if not stock: raise ValueError("Bahan stok tidak ditemukan")
            if float(stock["quantity"]) < quantity: raise ValueError(f"Stok {stock['name']} tidak mencukupi")
            clean.append((stock, quantity, clean_components, "; ".join(entry["notes"])[:500]))
        for stock, quantity, components, note in clean:
            balance = float(stock["quantity"]) - quantity
            cursor.execute("UPDATE stock_items SET quantity=%s WHERE id=%s", (balance, stock["id"]))
            cursor.execute("INSERT INTO stock_movements (item_id,category,movement_type,quantity,balance_after,reference,note) VALUES (%s,%s,'out',%s,%s,%s,%s)", (stock["id"], "PRODUKSI", quantity, balance, order_number, note or f"Pemakaian produksi oleh {actor}"))
            movement_id = cursor.lastrowid
            for usage_type, amount in components.items():
                if amount > 0:
                    cursor.execute("INSERT INTO production_material_usage (production_job_id,stock_item_id,order_group,channel,operator_name,reference,usage_type,quantity,unit,note,stock_movement_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", (job["id"], stock["id"], order_group, channel, actor, order_number, usage_type, amount, stock["unit"], note, movement_id))
        cursor.execute("UPDATE production_jobs SET status='completed', operator_name=%s, completed_at=NOW(), notes=%s WHERE id=%s", (actor, str(payload.get("note", ""))[:5000], job["id"]))
        cursor.execute("UPDATE orders SET workflow_status='SELESAI_PRODUKSI', status='ready' WHERE id=%s", (job["order_id"],))
        _audit_status(cursor, job["order_id"], job["workflow_status"], "SELESAI_PRODUKSI", "operator", actor, str(payload.get("note", "")))
        _notify(cursor, job["order_id"], "DASHBOARD", "PRODUCTION_COMPLETED", "Produksi selesai", f"{order_number} selesai diproduksi dan stok telah dimutasi.")
    return {"order_id": order_number, "workflow_status": "SELESAI_PRODUKSI", "status": "completed", "materials_used": len(clean), "total_consumption": sum(item[1] for item in clean)}


def production_usage_rows(filters: dict | None = None, limit: int = 500) -> list[dict]:
    filters = filters or {}
    clauses, params = [], []
    if filters.get("date_from"):
        clauses.append("DATE(u.created_at)>=%s"); params.append(str(filters["date_from"])[:10])
    if filters.get("date_to"):
        clauses.append("DATE(u.created_at)<=%s"); params.append(str(filters["date_to"])[:10])
    if filters.get("group") in {"offline", "online", "internal"}:
        clauses.append("u.order_group=%s"); params.append(filters["group"])
    if filters.get("channel"):
        clauses.append("u.channel=%s"); params.append(str(filters["channel"])[:60])
    if filters.get("operator"):
        clauses.append("u.operator_name LIKE %s"); params.append(f"%{str(filters['operator'])[:120]}%")
    where="WHERE "+" AND ".join(clauses) if clauses else ""
    params.append(max(1,min(int(limit),2000)))
    with transaction() as (_, cursor):
        cursor.execute(f"""SELECT u.id,u.production_job_id,u.order_group,u.channel,u.operator_name,u.reference,u.usage_type,
            u.stock_item_id,s.name AS material_name,u.quantity,u.unit,u.note,u.created_at,
            o.order_number,o.source
            FROM production_material_usage u JOIN stock_items s ON s.id=u.stock_item_id
            LEFT JOIN production_jobs p ON p.id=u.production_job_id
            LEFT JOIN orders o ON o.id=p.order_id {where}
            ORDER BY u.created_at DESC,u.id DESC LIMIT %s""",tuple(params))
        rows=list(cursor.fetchall())
    result=[]
    for row in rows:
        row["quantity"]=float(row["quantity"] or 0)
        if row.get("created_at") is not None:row["created_at"]=row["created_at"].isoformat(sep=" ")
        result.append(row)
    return result


def record_production_usage(payload: dict) -> dict:
    group=str(payload.get("order_group", "")).strip().lower()
    if group not in {"offline","online","internal"}:raise ValueError("Kelompok pesanan tidak valid")
    channel=str(payload.get("channel", "" if group=="internal" else "Fazima")).strip()[:60]
    if group=="online" and not channel:raise ValueError("Pilih kanal online")
    actor=_clean_actor(payload.get("operator_name"),"Nama Operator")
    reference=str(payload.get("reference", "")).strip()[:120]
    note=str(payload.get("note", "")).strip()[:500]
    stock_id=int(payload.get("stock_item_id",0))
    components=payload.get("components") or {}
    types=("good","machine_reject","operator_error","other_reprint")
    try:amounts={key:float(components.get(key,0) or 0) for key in types}
    except (TypeError,ValueError):raise ValueError("Jumlah hasil dan reject harus berupa angka") from None
    if stock_id<=0 or any(value<0 or not math.isfinite(value) for value in amounts.values()) or sum(amounts.values())<=0:raise ValueError("Bahan dan minimal satu jumlah pemakaian wajib diisi")
    total=sum(amounts.values())
    with transaction() as (_,cursor):
        cursor.execute("SELECT id,name,unit,quantity FROM stock_items WHERE id=%s AND active=1 FOR UPDATE",(stock_id,))
        stock=cursor.fetchone()
        if not stock:raise ValueError("Bahan stok tidak ditemukan")
        if float(stock["quantity"])<total:raise ValueError(f"Stok {stock['name']} tidak mencukupi")
        balance=float(stock["quantity"])-total
        cursor.execute("UPDATE stock_items SET quantity=%s WHERE id=%s",(balance,stock_id))
        cursor.execute("INSERT INTO stock_movements (item_id,category,movement_type,quantity,balance_after,reference,note) VALUES (%s,'PRODUKSI','out',%s,%s,%s,%s)",(stock_id,total,balance,reference or group,note or f"Pemakaian produksi oleh {actor}"))
        movement_id=cursor.lastrowid
        for usage_type,quantity in amounts.items():
            if quantity>0:
                cursor.execute("INSERT INTO production_material_usage (production_job_id,stock_item_id,order_group,channel,operator_name,reference,usage_type,quantity,unit,note,stock_movement_id) VALUES (NULL,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",(stock_id,group,channel or "Internal",actor,reference,usage_type,quantity,stock["unit"],note,movement_id))
    return {"ok":True,"material":stock["name"],"total_consumption":total,"unit":stock["unit"],"balance_after":balance}


def dashboard_notifications(team: str = "SETTING", unread_only: bool = True, limit: int = 100) -> list[dict]:
    team = str(team or "SETTING").strip().upper()[:32]
    params: list[object] = [team]
    unread_clause = "AND is_read=0" if unread_only else ""
    params.append(max(1, min(int(limit), 500)))
    with transaction() as (_, cursor):
        cursor.execute(f"""
            SELECT id, order_id, notification_type, title, message, is_read, created_at, read_at
            FROM dashboard_notifications
            WHERE target_team=%s {unread_clause}
            ORDER BY created_at DESC LIMIT %s
        """, tuple(params))
        rows = list(cursor.fetchall())
    for row in rows:
        if row.get("created_at") is not None:
            row["created_at"] = row["created_at"].isoformat(sep=" ")
        if row.get("read_at") is not None:
            row["read_at"] = row["read_at"].isoformat(sep=" ")
    return rows


def mark_dashboard_notification(notification_id: int) -> dict:
    with transaction() as (_, cursor):
        cursor.execute("UPDATE dashboard_notifications SET is_read=1, read_at=NOW() WHERE id=%s", (int(notification_id),))
        if cursor.rowcount != 1:
            raise ValueError("Notifikasi tidak ditemukan")
    return {"ok": True, "id": int(notification_id)}


def update_product(product_id: int, payload: dict) -> dict:
    requested_image_path = str(payload.get("image_path", "")).strip()[:255]
    fields = {
        "name": str(payload.get("name", "")).strip()[:120],
        "category": str(payload.get("category", "")).strip()[:40],
        "product_type": str(payload.get("product_type", "")).strip()[:80],
        "unit": str(payload.get("unit", "pcs")).strip()[:20] or "pcs",
        "base_price": float(payload.get("base_price", 0)),
        "description": str(payload.get("description", "")).strip()[:4000],
        "image_path": requested_image_path,
        "sizes_json": json.dumps(payload.get("sizes", []), ensure_ascii=False),
        "materials_json": json.dumps(payload.get("materials", []), ensure_ascii=False),
        "is_active": 1 if payload.get("is_active", True) else 0,
    }
    if not fields["name"] or not fields["category"] or fields["base_price"] < 0:
        raise ValueError("Data produk tidak valid")
    sizes = [str(value).strip()[:80] for value in payload.get("sizes", []) if str(value).strip()]
    fields["sizes_json"] = json.dumps(sizes, ensure_ascii=False)
    with transaction() as (_, cursor):
        # Editing metadata must never erase an existing product image. An image
        # is replaced only when a new path/upload is explicitly provided.
        if not fields["image_path"]:
            cursor.execute("SELECT image_path FROM products WHERE id=%s", (int(product_id),))
            existing = cursor.fetchone()
            if not existing:
                raise ValueError("Produk tidak ditemukan")
            fields["image_path"] = str(existing.get("image_path") or "")[:255]
        cursor.execute("SHOW COLUMNS FROM products LIKE 'description'")
        has_description = bool(cursor.fetchone())
        cursor.execute("SHOW COLUMNS FROM products LIKE 'materials_json'")
        has_materials = bool(cursor.fetchone())
        if has_description and has_materials:
            cursor.execute("""UPDATE products SET name=%s, category=%s, product_type=%s, unit=%s,
                base_price=%s, image_path=%s, description=%s, sizes_json=%s, materials_json=%s, is_active=%s WHERE id=%s""",
                (fields["name"], fields["category"], fields["product_type"], fields["unit"], fields["base_price"], fields["image_path"], fields["description"], fields["sizes_json"], fields["materials_json"], fields["is_active"], int(product_id)))
        elif has_description:
            cursor.execute("""UPDATE products SET name=%s, category=%s, product_type=%s, unit=%s,
                base_price=%s, image_path=%s, description=%s, sizes_json=%s, is_active=%s WHERE id=%s""",
                (fields["name"], fields["category"], fields["product_type"], fields["unit"], fields["base_price"], fields["image_path"], fields["description"], fields["sizes_json"], fields["is_active"], int(product_id)))
        else:
            cursor.execute("""UPDATE products SET name=%s, category=%s, product_type=%s, unit=%s,
                base_price=%s, image_path=%s, sizes_json=%s, is_active=%s WHERE id=%s""",
                (fields["name"], fields["category"], fields["product_type"], fields["unit"], fields["base_price"], fields["image_path"], fields["sizes_json"], fields["is_active"], int(product_id)))
        if cursor.rowcount == 0:
            raise ValueError("Produk tidak ditemukan")
    return {"ok": True, "id": int(product_id)}


def create_product(payload: dict) -> dict:
    name = str(payload.get("name", "")).strip()[:120]
    category = str(payload.get("category", "")).strip()[:40]
    product_type = str(payload.get("product_type", "")).strip()[:80]
    kind = str(payload.get("kind", "custom")).strip()[:40] or "custom"
    unit = str(payload.get("unit", "pcs")).strip()[:20] or "pcs"
    image_path = str(payload.get("image_path", "")).strip()[:255]
    description = str(payload.get("description", "")).strip()[:4000]
    base_price = float(payload.get("base_price", 0))
    sizes = [str(value).strip()[:80] for value in payload.get("sizes", []) if str(value).strip()]
    materials = [str(value).strip()[:120] for value in payload.get("materials", []) if str(value).strip()]
    if not name or not category or not product_type or base_price < 0:
        raise ValueError("Nama, kategori, tipe, dan harga produk wajib diisi")
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:140] or "produk-baru"
    with transaction() as (_, cursor):
        cursor.execute("SHOW COLUMNS FROM products LIKE 'description'")
        has_description = bool(cursor.fetchone())
        cursor.execute("SHOW COLUMNS FROM products LIKE 'materials_json'")
        has_materials = bool(cursor.fetchone())
        columns = ["name", "slug", "category", "product_type", "kind", "unit", "base_price", "image_path"]
        values = [name, slug, category, product_type, kind, unit, base_price, image_path]
        if has_description:
            columns.append("description")
            values.append(description)
        if has_materials:
            columns.append("materials_json")
            values.append(json.dumps(materials, ensure_ascii=False))
        columns.extend(["sizes_json", "is_active"])
        values.extend([json.dumps(sizes, ensure_ascii=False), 1])
        placeholders = ",".join(["%s"] * len(values))
        cursor.execute(f"INSERT INTO products ({','.join(columns)}) VALUES ({placeholders})", values)
        product_id = cursor.lastrowid
    return {"ok": True, "id": int(product_id), "slug": slug}


def delete_product(product_id: int) -> dict:
    with transaction() as (_, cursor):
        cursor.execute("UPDATE products SET is_active=0 WHERE id=%s", (int(product_id),))
        if cursor.rowcount == 0:
            raise ValueError("Produk tidak ditemukan")
    return {"ok": True, "id": int(product_id), "deleted": True}


def category_rows() -> list[dict]:
    with transaction() as (_, cursor):
        try:
            cursor.execute("SELECT id, slug, name, sort_order, is_active FROM product_categories WHERE is_active=1 ORDER BY sort_order, name")
            rows = list(cursor.fetchall())
        except Exception as exc:
            if getattr(exc, "args", [None])[0] != 1146:
                raise
            cursor.execute("SELECT category AS slug, category AS name, 0 AS sort_order FROM products GROUP BY category ORDER BY category")
            rows = list(cursor.fetchall())
    return [dict(row) for row in rows]


def create_category(payload: dict) -> dict:
    name = str(payload.get("name", "")).strip()[:80]
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40]
    if not name or not slug:
        raise ValueError("Nama kategori wajib diisi")
    with transaction() as (_, cursor):
        cursor.execute("INSERT INTO product_categories (slug, name, sort_order, is_active) VALUES (%s,%s,%s,1)", (slug, name, int(payload.get("sort_order", 0))))
        category_id = cursor.lastrowid
    return {"ok": True, "id": int(category_id), "slug": slug}


def update_category(category_id: int, payload: dict) -> dict:
    name = str(payload.get("name", "")).strip()[:80]
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40]
    if not name or not slug:
        raise ValueError("Nama kategori wajib diisi")
    with transaction() as (_, cursor):
        cursor.execute("SELECT slug FROM product_categories WHERE id=%s", (int(category_id),))
        old = cursor.fetchone()
        if not old:
            raise ValueError("Kategori tidak ditemukan")
        cursor.execute("UPDATE product_categories SET slug=%s, name=%s, sort_order=%s WHERE id=%s", (slug, name, int(payload.get("sort_order", 0)), int(category_id)))
        cursor.execute("UPDATE products SET category=%s WHERE category=%s", (slug, old["slug"]))
    return {"ok": True, "id": int(category_id), "slug": slug}


def delete_category(category_id: int) -> dict:
    with transaction() as (_, cursor):
        cursor.execute("SELECT slug FROM product_categories WHERE id=%s", (int(category_id),))
        row = cursor.fetchone()
        if not row:
            raise ValueError("Kategori tidak ditemukan")
        cursor.execute("SELECT COUNT(*) AS total FROM products WHERE category=%s AND is_active=1", (row["slug"],))
        if int(cursor.fetchone()["total"]) > 0:
            raise ValueError("Kategori masih dipakai produk aktif")
        cursor.execute("UPDATE product_categories SET is_active=0 WHERE id=%s", (int(category_id),))
    return {"ok": True, "id": int(category_id), "deleted": True}


def update_promotion(product_id: int, payload: dict) -> dict:
    active = bool(payload.get("is_active", False))
    title = str(payload.get("title", "Promo katalog")).strip()[:160] or "Promo katalog"
    discount = float(payload.get("discount_percent", 0))
    starts_at = str(payload.get("starts_at", "")).strip() or None
    ends_at = str(payload.get("ends_at", "")).strip() or None
    if not 0 <= discount <= 100:
        raise ValueError("Nilai promo tidak valid")
    with transaction() as (_, cursor):
        cursor.execute("SELECT id, base_price FROM products WHERE id=%s", (int(product_id),))
        product = cursor.fetchone()
        if not product:
            raise ValueError("Produk tidak ditemukan")
        # Discount is the only editable source of truth. Never accept a
        # conflicting client-side promo price; compute it from the DB price.
        promo_price = round(float(product["base_price"]) * (1 - discount / 100), 2)
        cursor.execute("""INSERT INTO promotions (product_id,title,discount_percent,promo_price,starts_at,ends_at,is_active)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE title=VALUES(title), discount_percent=VALUES(discount_percent), promo_price=VALUES(promo_price), starts_at=VALUES(starts_at), ends_at=VALUES(ends_at), is_active=VALUES(is_active)""",
            (int(product_id), title, discount, promo_price, starts_at, ends_at, int(active)))
    return {"ok": True, "product_id": int(product_id)}


def create_order(payload: dict) -> dict:
    """Create an order and price its lines from the current DB catalog."""
    items = payload.get("items")
    if not isinstance(items, list) or not items or len(items) > 50:
        raise ValueError("Item order tidak valid")
    requested = {str(item.get("product", "")).strip() for item in items if isinstance(item, dict)}
    if len(requested) != len(items) or not requested:
        raise ValueError("Produk order tidak valid")
    with transaction() as (_, cursor):
        placeholders = ",".join(["%s"] * len(requested))
        cursor.execute(f"""
            SELECT p.id, p.name, p.base_price, p.kind, p.unit, pr.id AS promo_id, pr.promo_price
            FROM products p LEFT JOIN promotions pr ON pr.product_id=p.id AND pr.is_active=1
              AND (pr.starts_at IS NULL OR pr.starts_at <= NOW()) AND (pr.ends_at IS NULL OR pr.ends_at >= NOW())
            WHERE p.is_active=1 AND p.name IN ({placeholders})
        """, tuple(requested))
        products = {row["name"]: row for row in cursor.fetchall()}
        if len(products) != len(requested):
            raise ValueError("Ada produk order yang sudah tidak aktif")
        order_number = str(payload.get("order_id", "")).strip() or f"FZ-{__import__('time').time_ns()}"
        subtotal = discount_total = grand_total = 0.0
        priced_items = []
        for item in items:
            product = products[item["product"]]
            quantity = int(item.get("quantity", 1))
            if not 1 <= quantity <= 1000:
                raise ValueError("Jumlah order tidak valid")
            original = float(product["base_price"])
            price = float(product["promo_price"] if product["promo_id"] else product["base_price"])
            unit = str(product.get("unit") or "").lower().replace(chr(194), "")
            size = str(item.get("size", ""))
            area = 1.0
            if unit in {"m2", "m^2", "m" + chr(178)}:
                match = re.match(r"^\s*([\d.,]+)\s*[x×]\s*([\d.,]+)\s*(mm|cm|m)?\s*$", size, re.I)
                if size.upper() in {"A4", "A3", "A2"}:
                    area = {"A4": .21 * .297, "A3": .297 * .42, "A2": .42 * .594}[size.upper()]
                elif match:
                    factor = {"m": 1, "cm": .01, "mm": .001, None: .01}[match.group(3).lower() if match.group(3) else None]
                    area = float(match.group(1).replace(",", ".")) * float(match.group(2).replace(",", ".")) * factor * factor
                if area <= 0:
                    raise ValueError(f"Ukuran produk {product['name']} tidak valid")
            line = price * quantity * area
            subtotal += original * quantity * area; grand_total += line; discount_total += (original - price) * quantity * area
            priced_items.append((product, item, quantity, original, price * area, line))
        item_notes = [f"{item.get('product', '')}: {str(item.get('note', '')).strip()}" for item in items if str(item.get("note", "")).strip()]
        order_notes = "\n".join(([str(payload.get("notes", "")).strip()] if str(payload.get("notes", "")).strip() else []) + item_notes)[:5000]
        delivery = "delivery" if payload.get("delivery") == "delivery" else "pickup"
        courier = str(payload.get("courier", "")).strip().upper() if delivery == "delivery" else ""
        if delivery == "delivery" and courier not in {"JNE", "JNT", "GOSEND"}:
            raise ValueError("Pilih kurir JNE, JNT, atau GoSend")
        latitude = payload.get("latitude")
        longitude = payload.get("longitude")
        try:
            latitude = float(latitude) if latitude not in (None, "") else None
            longitude = float(longitude) if longitude not in (None, "") else None
        except (TypeError, ValueError):
            raise ValueError("Koordinat lokasi tidak valid") from None
        if (latitude is None) != (longitude is None) or (latitude is not None and not (-90 <= latitude <= 90 and -180 <= longitude <= 180)):
            raise ValueError("Koordinat lokasi tidak valid")
        if delivery == "delivery" and latitude is None:
            raise ValueError("Lokasi saat ini wajib dipilih untuk pengantaran")
        location_label = str(payload.get("location_label", "")).strip()[:3000] if delivery == "delivery" else ""
        if delivery == "delivery" and not location_label:
            location_label = f"Koordinat {latitude:.6f}, {longitude:.6f}"
        address_detail = str(payload.get("address_detail", "")).strip()[:2000] if delivery == "delivery" else ""
        full_address = "\n".join(value for value in (location_label, address_detail) if value)
        cursor.execute("""INSERT INTO orders (order_number, source, customer_name, customer_phone, delivery_method, shipping_courier, address, location_label, address_detail, latitude, longitude, subtotal, discount_total, grand_total, status, workflow_status, notes)
            VALUES (%s,'WEB',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending_payment','MENUNGGU_VALIDASI_SETTING',%s)""", (
            order_number, str(payload.get("customer", ""))[:120], str(payload.get("phone", ""))[:40],
            delivery, courier or None, full_address[:5000], location_label or None, address_detail or None, latitude, longitude,
            subtotal, discount_total, grand_total, order_notes))
        order_id = cursor.lastrowid
        _audit_status(cursor, order_id, None, "MENUNGGU_VALIDASI_SETTING", "system", "website", "Order WEB masuk otomatis ke antrean Team Setting.")
        _notify(cursor, order_id, "SETTING", "WEB_ORDER_CREATED", "Order WEB baru", f"{order_number} masuk otomatis ke antrean Team Setting.")
        _notify(cursor, order_id, "KASIR", "WEB_ORDER_CREATED", "Order web baru", f"{order_number} dari {str(payload.get('customer', '')).strip() or 'Customer'} baru saja checkout.")
        cursor.execute("SHOW COLUMNS FROM order_items LIKE 'material'")
        has_material = bool(cursor.fetchone())
        for product, item, quantity, original, price, line in priced_items:
            if has_material:
                cursor.execute("""INSERT INTO order_items (order_id, product_id, product_name, size_label, material, quantity, unit_price, original_unit_price, promo_id, finishing, design_file, layout_token, item_total)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""", (order_id, product["id"], product["name"], str(item.get("size", ""))[:80], str(item.get("material", ""))[:80], quantity, price, original, product["promo_id"], str(item.get("finish", ""))[:80], str(item.get("file", ""))[:255], str(item.get("id", ""))[:32] or None, line))
            else:
                cursor.execute("""INSERT INTO order_items (order_id, product_id, product_name, size_label, quantity, unit_price, original_unit_price, promo_id, finishing, design_file, layout_token, item_total)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""", (order_id, product["id"], product["name"], str(item.get("size", ""))[:80], quantity, price, original, product["promo_id"], str(item.get("finish", ""))[:80], str(item.get("file", ""))[:255], str(item.get("id", ""))[:32] or None, line))
    return {"id": order_id, "order_id": order_number, "subtotal": subtotal, "discount_total": discount_total, "grand_total": grand_total, "status": "pending_payment"}
