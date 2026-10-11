"""MySQL POS persistence for the existing cashier workspace."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from operator_database import connect, transaction

MONEY = Decimal("0.01")
AREA_UNITS = {"m2", "m²", "mÂ²", "m^2"}
PAYMENT_METHODS = {"cash", "qris", "transfer", "edc"}
try:
    JAKARTA_TIMEZONE = ZoneInfo("Asia/Jakarta")
except ZoneInfoNotFoundError:
    # Windows may not ship the IANA timezone database. Jakarta stays UTC+7.
    JAKARTA_TIMEZONE = timezone(timedelta(hours=7), "WIB")


def web_orders() -> list[dict]:
    with transaction() as (_, cursor):
        cursor.execute("""SELECT o.id,o.order_number,o.customer_name,o.customer_phone,o.delivery_method,
            o.shipping_courier,o.address,o.location_label,o.address_detail,o.latitude,o.longitude,o.grand_total,o.status,o.workflow_status,
            o.created_at,p.transaction_status
            FROM orders o LEFT JOIN payments p ON p.order_id=o.id
            WHERE o.source='WEB' ORDER BY o.created_at DESC""")
        rows = list(cursor.fetchall())
        if rows:
            ids = [int(row["id"]) for row in rows]
            marks = ",".join(["%s"] * len(ids))
            cursor.execute(f"SELECT order_id,product_name,size_label,quantity,finishing,item_total FROM order_items WHERE order_id IN ({marks}) ORDER BY id", tuple(ids))
            items_by_order = {order_id: [] for order_id in ids}
            for item in cursor.fetchall():
                item["item_total"] = float(item["item_total"] or 0)
                items_by_order[int(item["order_id"])].append(item)
            for row in rows:
                row["items"] = items_by_order[int(row["id"])]
                row["grand_total"] = float(row["grand_total"] or 0)
                row["created_at"] = row["created_at"].isoformat(sep=" ") if row.get("created_at") else ""
    return rows


def web_order_notification_count() -> int:
    with transaction() as (_, cursor):
        cursor.execute("SELECT COUNT(*) AS count FROM dashboard_notifications WHERE target_team='KASIR' AND is_read=0")
        return int(cursor.fetchone()["count"])


def mark_web_order_notifications_read() -> int:
    with transaction() as (_, cursor):
        cursor.execute("UPDATE dashboard_notifications SET is_read=1,read_at=NOW() WHERE target_team='KASIR' AND is_read=0")
        return int(cursor.rowcount)


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)


def _num(value, label: str, minimum: Decimal = Decimal("0")) -> Decimal:
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f"{label} tidak valid") from None
    if not parsed.is_finite() or parsed < minimum:
        raise ValueError(f"{label} tidak valid")
    return parsed


def _as_json(value):
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, "isoformat"):
        return value.isoformat(sep=" ")
    return value


def _decode_json(value, fallback):
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value) if value else fallback
    except (TypeError, ValueError):
        return fallback


def catalog_rows() -> list[dict]:
    with transaction() as (_, cursor):
        cursor.execute("""SELECT id, nama AS name, jenis AS category, jenis AS product_type,
            '' AS kind, COALESCE(satuan,'pcs') AS unit, harga_jual AS base_price
            FROM material WHERE UPPER(TRIM(jenis))='PRODUK'
              AND UPPER(TRIM(status))='AKTIF' ORDER BY nama,id""")
        rows = list(cursor.fetchall())
    result = []
    for row in rows:
        result.append({
            "id": int(row["id"]), "name": row["name"], "category": row["category"],
            "product_type": row["product_type"], "kind": row["kind"], "unit": row["unit"],
            "base_price": float(row["base_price"]),
            "sizes": [],
            "materials": [],
        })
    return result


def _next_invoice(cursor, now: datetime) -> str:
    year, month = now.year, now.month
    cursor.execute("INSERT IGNORE INTO cashier_invoice_sequences(invoice_year,invoice_month,last_number) VALUES (%s,%s,0)", (year, month))
    cursor.execute("SELECT last_number FROM cashier_invoice_sequences WHERE invoice_year=%s AND invoice_month=%s FOR UPDATE", (year, month))
    number = int(cursor.fetchone()["last_number"]) + 1
    cursor.execute("UPDATE cashier_invoice_sequences SET last_number=%s WHERE invoice_year=%s AND invoice_month=%s", (number, year, month))
    return f"INV/{year:04d}/{month:02d}/{number:04d}"


def _area(item: dict, unit: str, kind: str = "") -> Decimal:
    if unit.strip().lower() not in AREA_UNITS:
        return Decimal("0")
    width = _num(item.get("width"), "Lebar", Decimal("0.001"))
    height = _num(item.get("height"), "Tinggi", Decimal("0.001"))
    dimension_unit = str(item.get("dimension_unit", "cm")).lower()
    factor = {"mm": Decimal("0.001"), "cm": Decimal("0.01"), "m": Decimal("1")}.get(dimension_unit)
    if factor is None or width > 100000 or height > 100000:
        raise ValueError("Ukuran harus memakai mm, cm, atau m dan berada dalam batas yang wajar")
    area = width * factor * height * factor
    if area <= 0 or area > Decimal("100000"):
        raise ValueError("Luas produk tidak valid")
    return area.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _create_payment(cursor, sale: dict, payment: dict, actor: dict) -> dict:
    if sale["status"] == "void":
        raise ValueError("Nota sudah dibatalkan")
    method = str(payment.get("method", "")).lower()
    if method not in PAYMENT_METHODS:
        raise ValueError("Metode pembayaran tidak valid")
    due = _money(Decimal(str(sale["total"])) - Decimal(str(sale["amount_paid"])))
    if due <= 0:
        raise ValueError("Nota sudah lunas")
    entered = _money(_num(payment.get("amount"), "Jumlah pembayaran", Decimal("0.01")))
    if method != "cash" and entered > due:
        raise ValueError("Pembayaran non-tunai tidak boleh melebihi sisa tagihan")
    applied = min(entered, due)
    change = entered - applied if method == "cash" else Decimal("0.00")
    paid = _money(Decimal(str(sale["amount_paid"])) + applied)
    status = "paid" if paid >= Decimal(str(sale["total"])) else "partial"
    cursor.execute("""INSERT INTO cashier_payments
        (sale_id,method,amount_applied,tendered_amount,change_amount,processed_by,processed_by_name,created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,UTC_TIMESTAMP())""",
        (sale["id"], method, applied, entered, change, actor["id"], actor["display_name"]))
    cursor.execute("UPDATE cashier_sales SET amount_paid=%s,status=%s WHERE id=%s", (paid, status, sale["id"]))
    cursor.execute("""INSERT INTO cashier_audit_log(sale_id,actor_id,actor_name,action,reason,details_json,created_at)
        VALUES (%s,%s,%s,'payment','',%s,UTC_TIMESTAMP())""",
        (sale["id"], actor["id"], actor["display_name"], json.dumps({"method": method, "applied": str(applied), "tendered": str(entered), "change": str(change)})))
    return {"method": method, "amount_applied": float(applied), "tendered_amount": float(entered), "change_amount": float(change), "status": status, "amount_paid": float(paid)}


def create_sale(payload: dict, actor: dict) -> dict:
    items = payload.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= 100:
        raise ValueError("Transaksi harus berisi 1 sampai 100 item")
    customer_name = str(payload.get("customer_name", "")).strip()[:160]
    with transaction() as (_, cursor):
        design_material_value = _num(payload.get("material_id"), "Material untuk desain", Decimal("1"))
        if design_material_value != design_material_value.to_integral_value():
            raise ValueError("Material untuk desain tidak valid")
        cursor.execute("SELECT id,kode_produk,nama FROM material WHERE id=%s AND UPPER(TRIM(status))='AKTIF' AND UPPER(TRIM(jenis))='MATERIAL' LIMIT 1", (int(design_material_value),))
        design_material = cursor.fetchone()
        if not design_material:
            raise ValueError("Pilih material aktif untuk desain sebelum menyimpan transaksi")
        calculated = []
        subtotal = Decimal("0")
        for item in items:
            if not isinstance(item, dict):
                raise ValueError("Item transaksi tidak valid")
            product_id = int(_num(item.get("product_id"), "Produk", Decimal("1")))
            quantity = _num(item.get("quantity"), "Jumlah", Decimal("0.001"))
            if quantity > Decimal("100000"):
                raise ValueError("Jumlah melebihi batas")
            cursor.execute("""SELECT id,nama AS name,jenis AS category,jenis AS kind,
                COALESCE(satuan,'pcs') AS unit,harga_jual AS base_price,status
                FROM material WHERE id=%s AND UPPER(TRIM(jenis))='PRODUK' LIMIT 1""", (product_id,))
            product = cursor.fetchone()
            if not product or str(product["status"]).strip().upper() != "AKTIF":
                raise ValueError("Produk tidak ditemukan atau sudah dinonaktifkan")
            is_area = product["unit"].strip().lower() in AREA_UNITS
            if not is_area and quantity != quantity.to_integral_value():
                raise ValueError(f"Jumlah {product['name']} harus berupa bilangan bulat")
            unit_price = _money(Decimal(str(product["base_price"])))
            if unit_price <= 0:
                raise ValueError(f"Harga {product['name']} belum diatur di Metadata")
            area = _area(item, product["unit"], product.get("kind", ""))
            basis = area if area else Decimal("1")
            line_total = _money(unit_price * basis * quantity)
            if line_total <= 0 or line_total > Decimal("999999999999.99"):
                raise ValueError("Subtotal item tidak valid")
            specification = str(item.get("specification", "")).strip()[:2000]
            if area:
                dimension_unit = str(item.get("dimension_unit", "cm")).lower()
                specification = f"{item.get('width')} x {item.get('height')} {dimension_unit}" + (f" · {specification}" if specification else "")
            material_note = f"Material desain: {design_material['nama']} ({design_material['kode_produk']})"
            specification = f"{specification} · {material_note}" if specification else material_note
            calculated.append({"product": product, "quantity": quantity, "unit_price": unit_price, "area": area, "specification": specification, "line_total": line_total})
            subtotal += line_total
        subtotal = _money(subtotal)
        if subtotal <= 0 or subtotal > Decimal("999999999999.99"):
            raise ValueError("Total transaksi tidak valid")
        invoice_date = datetime.now(JAKARTA_TIMEZONE)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        invoice = _next_invoice(cursor, invoice_date)
        cursor.execute("""INSERT INTO cashier_sales(invoice_number,customer_name,cashier_id,cashier_name,subtotal,total,created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (invoice, customer_name, actor["id"], actor["display_name"], subtotal, subtotal, now))
        sale_id = cursor.lastrowid
        for row in calculated:
            product = row["product"]
            cursor.execute("""INSERT INTO cashier_sale_items
                (sale_id,product_id,product_name,category,unit,quantity,specification,area_m2,unit_price,line_total)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (sale_id, product["id"], product["name"], product["category"], product["unit"], row["quantity"], row["specification"], row["area"], row["unit_price"], row["line_total"]))
        cursor.execute("INSERT INTO cashier_audit_log(sale_id,actor_id,actor_name,action,reason,created_at) VALUES (%s,%s,%s,'create','',UTC_TIMESTAMP())", (sale_id, actor["id"], actor["display_name"]))
        cursor.execute("SELECT * FROM cashier_sales WHERE id=%s", (sale_id,))
        sale = cursor.fetchone()
        payment = payload.get("payment")
        if payment is not None and not isinstance(payment, dict):
            raise ValueError("Data pembayaran tidak valid")
        first_payment = _create_payment(cursor, sale, payment, actor) if payment is not None else None
    result = sale_detail(sale_id)
    result["last_payment"] = first_payment
    return result


def add_payment(sale_id: int, payload: dict, actor: dict) -> dict:
    with transaction() as (_, cursor):
        cursor.execute("SELECT * FROM cashier_sales WHERE id=%s FOR UPDATE", (sale_id,))
        sale = cursor.fetchone()
        if not sale:
            raise ValueError("Nota tidak ditemukan")
        payment = _create_payment(cursor, sale, payload, actor)
    result = sale_detail(sale_id)
    result["last_payment"] = payment
    return result


def void_sale(sale_id: int, payload: dict, actor: dict) -> dict:
    reason = str(payload.get("reason", "")).strip()[:2000]
    if len(reason) < 3:
        raise ValueError("Alasan pembatalan minimal 3 karakter")
    with transaction() as (_, cursor):
        cursor.execute("SELECT * FROM cashier_sales WHERE id=%s FOR UPDATE", (sale_id,))
        sale = cursor.fetchone()
        if not sale:
            raise ValueError("Nota tidak ditemukan")
        if sale["status"] == "void":
            raise ValueError("Nota sudah dibatalkan")
        if int(sale["cashier_id"]) != int(actor["id"]):
            raise ValueError("Hanya kasir pembuat nota yang dapat membatalkannya")
        if Decimal(str(sale["amount_paid"])) > 0:
            raise ValueError("Nota sudah menerima pembayaran. Proses pengembalian dana belum tersedia, jadi nota tidak dapat dibatalkan dari POS.")
        cursor.execute("UPDATE cashier_sales SET status='void',void_reason=%s,voided_at=UTC_TIMESTAMP(),voided_by=%s WHERE id=%s", (reason, actor["id"], sale_id))
        cursor.execute("INSERT INTO cashier_audit_log(sale_id,actor_id,actor_name,action,reason,created_at) VALUES (%s,%s,%s,'void',%s,UTC_TIMESTAMP())", (sale_id, actor["id"], actor["display_name"], reason))
    return sale_detail(sale_id)


def _sale_list_row(row: dict) -> dict:
    return {key: _as_json(value) for key, value in row.items()}


def sales_rows(query: str = "", status: str = "", limit: int = 500) -> list[dict]:
    clauses, params = [], []
    if query.strip():
        term = f"%{query.strip()[:100]}%"
        clauses.append("(invoice_number LIKE %s OR customer_name LIKE %s OR cashier_name LIKE %s)")
        params.extend((term, term, term))
    if status in {"unpaid", "partial", "paid", "void"}:
        clauses.append("status=%s"); params.append(status)
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    params.append(max(1, min(int(limit), 500)))
    with transaction() as (_, cursor):
        cursor.execute(f"SELECT id,invoice_number,customer_name,cashier_name,subtotal,total,amount_paid,status,created_at FROM cashier_sales{where} ORDER BY id DESC LIMIT %s", tuple(params))
        rows = list(cursor.fetchall())
    return [_sale_list_row(row) for row in rows]


def summary_data(period: str = "7d") -> dict:
    """Return cashier KPIs and payment totals bucketed in Jakarta local time."""
    from datetime import date
    now = datetime.now(JAKARTA_TIMEZONE)
    configs = {"1d": (1, 3600), "7d": (7, 86400), "30d": (30, 86400), "1y": (365, 3 * 86400)}
    days, step = configs.get(period, configs["7d"])
    start = now.replace(hour=0, minute=0, second=0, microsecond=0) if period == "1d" else now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
    start_utc = start.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = now.astimezone(timezone.utc).replace(tzinfo=None)
    bucket_count = (24 if period == "1d" else (days + 2) // 3 if period == "1y" else days)
    labels = []
    totals = [0.0] * bucket_count
    for index in range(bucket_count):
        point = start + timedelta(seconds=step * index)
        labels.append(point.strftime("%H:00") if period == "1d" else point.strftime("%d %b"))
    with transaction() as (_, cursor):
        cursor.execute("""SELECT p.created_at, p.amount_applied FROM cashier_payments p
            JOIN cashier_sales s ON s.id=p.sale_id WHERE p.created_at >= %s AND p.created_at < %s
            AND s.status <> 'void' ORDER BY p.created_at""", (start_utc, end_utc + timedelta(microseconds=1)))
        payments = list(cursor.fetchall())
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc).replace(tzinfo=None)
        cursor.execute("""SELECT COUNT(*) AS count, COALESCE(SUM(amount_paid),0) AS received,
            COALESCE(SUM(status IN ('unpaid','partial')),0) AS awaiting_count
            FROM cashier_sales WHERE created_at >= %s AND created_at < %s AND status <> 'void'""",
            (today_start, now.astimezone(timezone.utc).replace(tzinfo=None) + timedelta(microseconds=1)))
        today = cursor.fetchone()
        cursor.execute("SELECT COUNT(*) AS count FROM cashier_sales WHERE status IN ('unpaid','partial')")
        pending = cursor.fetchone()
    for row in payments:
        local = row["created_at"].replace(tzinfo=timezone.utc).astimezone(JAKARTA_TIMEZONE)
        offset = max(0, int((local - start).total_seconds() // step))
        if offset < bucket_count:
            totals[offset] += float(row["amount_applied"])
    return {"period": period, "labels": labels, "values": totals, "today": {"count": int(today["count"] or 0), "received": float(today["received"] or 0), "awaiting": int(today["awaiting_count"] or 0)}, "pending": int(pending["count"] or 0)}


def sale_detail(sale_id: int) -> dict:
    with transaction() as (_, cursor):
        cursor.execute("SELECT * FROM cashier_sales WHERE id=%s LIMIT 1", (sale_id,))
        sale = cursor.fetchone()
        if not sale:
            raise ValueError("Nota tidak ditemukan")
        cursor.execute("SELECT id,product_id,product_name,category,unit,quantity,specification,area_m2,unit_price,line_total FROM cashier_sale_items WHERE sale_id=%s ORDER BY id", (sale_id,))
        items = list(cursor.fetchall())
        cursor.execute("SELECT id,method,amount_applied,tendered_amount,change_amount,processed_by_name,created_at FROM cashier_payments WHERE sale_id=%s ORDER BY id", (sale_id,))
        payments = list(cursor.fetchall())
        cursor.execute("SELECT id,actor_name,action,reason,details_json,created_at FROM cashier_audit_log WHERE sale_id=%s ORDER BY id", (sale_id,))
        audit = list(cursor.fetchall())
    result = {key: _as_json(value) for key, value in sale.items()}
    result["items"] = [{key: _as_json(value) for key, value in row.items()} for row in items]
    result["payments"] = [{key: _as_json(value) for key, value in row.items()} for row in payments]
    result["audit"] = [{**{key: _as_json(value) for key, value in row.items()}, "details_json": _decode_json(row.get("details_json"), {})} for row in audit]
    return result


def _ensure_material_receipts_table() -> None:
    """Create the cashier receiving ledger lazily so missing material schema does not block POS startup."""
    with transaction() as (_, cursor):
        cursor.execute("SELECT id FROM material LIMIT 0")
        cursor.execute("""CREATE TABLE IF NOT EXISTS cashier_material_receipts (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            material_id BIGINT UNSIGNED NOT NULL,
            material_code CHAR(4) NOT NULL,
            material_name VARCHAR(255) NOT NULL,
            unit VARCHAR(30) NOT NULL DEFAULT '',
            quantity DECIMAL(15,3) NOT NULL,
            balance_before DECIMAL(15,3) NOT NULL,
            balance_after DECIMAL(15,3) NOT NULL,
            reference VARCHAR(120) NOT NULL DEFAULT '',
            note VARCHAR(1000) NOT NULL DEFAULT '',
            receiver_id BIGINT UNSIGNED NOT NULL,
            receiver_name VARCHAR(120) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_material_receipts_created (created_at),
            KEY idx_material_receipts_material (material_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""")


def material_rows() -> list[dict]:
    _ensure_material_receipts_table()
    with transaction() as (_, cursor):
        cursor.execute("""SELECT id,kode_produk,nama,satuan,stok_akhir,status FROM material
            WHERE UPPER(TRIM(status))='AKTIF' AND UPPER(TRIM(jenis))='MATERIAL' ORDER BY nama,id""")
        rows = list(cursor.fetchall())
    result = []
    for row in rows:
        result.append({
            "id": int(row["id"]), "code": row["kode_produk"], "name": row["nama"],
            "unit": row["satuan"] or "", "stock": float(row["stok_akhir"] or 0),
        })
    return result


def material_receipt_rows(limit: int = 100) -> list[dict]:
    _ensure_material_receipts_table()
    with transaction() as (_, cursor):
        cursor.execute("""SELECT id,material_id,material_code,material_name,unit,quantity,
            balance_before,balance_after,reference,note,receiver_id,receiver_name,created_at
            FROM cashier_material_receipts ORDER BY id DESC LIMIT %s""", (max(1, min(int(limit), 500)),))
        rows = list(cursor.fetchall())
    return [{key: _as_json(value) for key, value in row.items()} for row in rows]


def material_stock_detail(material_id: int) -> dict:
    _ensure_material_receipts_table()
    with transaction() as (_, cursor):
        cursor.execute("""SELECT id,kode_produk,nama,satuan,stok_awal,stok_masuk,stok_keluar,
            stok_opname,stok_akhir,status,jenis FROM material WHERE id=%s LIMIT 1""", (material_id,))
        material = cursor.fetchone()
        if not material or str(material["jenis"]).strip().upper() != "MATERIAL":
            raise ValueError("Material tidak ditemukan")
        cursor.execute("""SELECT id,quantity,balance_before,balance_after,reference,note,
            receiver_name,created_at FROM cashier_material_receipts
            WHERE material_id=%s ORDER BY created_at DESC,id DESC""", (material_id,))
        receipts = list(cursor.fetchall())
    opening = Decimal(str(material["stok_awal"] or 0))
    total_in = Decimal(str(material["stok_masuk"] or 0))
    total_out = Decimal(str(material["stok_keluar"] or 0))
    adjustment = Decimal(str(material["stok_opname"] or 0))
    current = Decimal(str(material["stok_akhir"] or 0))
    recorded_receipts = sum((Decimal(str(row["quantity"])) for row in receipts), Decimal("0"))
    legacy_in = max(Decimal("0"), total_in - recorded_receipts)
    history = []
    if opening:
        history.append({"kind": "opening", "quantity": float(opening), "recorded_at": None,
                        "note": "Saldo awal dari data material; tanggal transaksi tidak tersedia."})
    if legacy_in:
        history.append({"kind": "in", "quantity": float(legacy_in), "recorded_at": None,
                        "note": "Akumulasi stok masuk dari data awal; tanggal transaksi tidak tersedia."})
    if total_out:
        history.append({"kind": "out", "quantity": float(total_out), "recorded_at": None,
                        "note": "Akumulasi stok keluar dari data material; rincian tanggal/transaksi lama tidak tersedia."})
    if adjustment:
        history.append({"kind": "adjustment", "quantity": float(adjustment), "recorded_at": None,
                        "note": "Akumulasi penyesuaian stok dari data material; tanggal transaksi tidak tersedia."})
    for row in receipts:
        history.append({
            "kind": "in", "quantity": float(row["quantity"]),
            "balance_before": float(row["balance_before"]), "balance_after": float(row["balance_after"]),
            "reference": row["reference"], "note": row["note"], "actor": row["receiver_name"],
            "recorded_at": _as_json(row["created_at"]), "source": "Penerimaan kasir",
        })
    return {
        "material": {
            "id": int(material["id"]), "code": material["kode_produk"], "name": material["nama"],
            "unit": material["satuan"] or "", "status": material["status"],
            "opening": float(opening), "incoming": float(total_in), "outgoing": float(total_out),
            "adjustment": float(adjustment), "current": float(current),
        },
        "history": history,
    }


def create_material_receipt(payload: dict, actor: dict) -> dict:
    _ensure_material_receipts_table()
    material_id_value = _num(payload.get("material_id"), "Material", Decimal("1"))
    if material_id_value != material_id_value.to_integral_value():
        raise ValueError("Material tidak valid")
    material_id = int(material_id_value)
    quantity = _num(payload.get("quantity"), "Jumlah diterima", Decimal("0.001"))
    max_stock = Decimal("999999999999.999")
    if quantity > max_stock:
        raise ValueError("Jumlah diterima melebihi batas")
    normalized_quantity = quantity.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    if quantity != normalized_quantity:
        raise ValueError("Jumlah maksimal memiliki 3 angka desimal")
    reference = str(payload.get("reference", "")).strip()[:120]
    note = str(payload.get("note", "")).strip()[:1000]
    with transaction() as (_, cursor):
        cursor.execute("""SELECT id,kode_produk,nama,satuan,stok_masuk,stok_akhir,status,jenis
            FROM material WHERE id=%s FOR UPDATE""", (material_id,))
        material = cursor.fetchone()
        if not material or str(material["status"]).strip().upper() != "AKTIF" or str(material["jenis"]).strip().upper() != "MATERIAL":
            raise ValueError("Material tidak ditemukan atau tidak aktif")
        before = Decimal(str(material["stok_akhir"] or 0))
        incoming = Decimal(str(material["stok_masuk"] or 0))
        after = before + quantity
        total_incoming = incoming + quantity
        if after > max_stock or total_incoming > max_stock:
            raise ValueError("Stok material akan melewati kapasitas kolom")
        cursor.execute("UPDATE material SET stok_masuk=%s,stok_akhir=%s WHERE id=%s", (total_incoming, after, material_id))
        cursor.execute("""INSERT INTO cashier_material_receipts
            (material_id,material_code,material_name,unit,quantity,balance_before,balance_after,
             reference,note,receiver_id,receiver_name,created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,UTC_TIMESTAMP())""",
            (material_id, material["kode_produk"], material["nama"], material["satuan"] or "",
             quantity, before, after, reference, note, actor["id"], actor["display_name"]))
        receipt_id = cursor.lastrowid
        cursor.execute("SELECT * FROM cashier_material_receipts WHERE id=%s", (receipt_id,))
        receipt = cursor.fetchone()
    return {key: _as_json(value) for key, value in receipt.items()}
