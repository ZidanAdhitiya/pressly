-- Additive POS tables for the existing Operator / Cashier application.
-- Import as a database administrator in fazima_print_customer.
USE fazima_print_customer;

CREATE TABLE IF NOT EXISTS cashier_invoice_sequences (
  invoice_year SMALLINT UNSIGNED NOT NULL,
  invoice_month TINYINT UNSIGNED NOT NULL,
  last_number INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (invoice_year, invoice_month)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cashier_sales (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_number VARCHAR(32) NOT NULL,
  customer_name VARCHAR(160) NOT NULL DEFAULT '',
  cashier_id BIGINT UNSIGNED NOT NULL,
  cashier_name VARCHAR(120) NOT NULL,
  subtotal DECIMAL(14,2) NOT NULL,
  total DECIMAL(14,2) NOT NULL,
  amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  status ENUM('unpaid','partial','paid','void') NOT NULL DEFAULT 'unpaid',
  void_reason TEXT NULL,
  voided_at DATETIME NULL,
  voided_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_cashier_invoice (invoice_number),
  KEY ix_cashier_sales_created (created_at), KEY ix_cashier_sales_status (status),
  KEY ix_cashier_sales_actor (cashier_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cashier_sale_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  product_name VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT '',
  unit VARCHAR(20) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  specification TEXT NOT NULL,
  area_m2 DECIMAL(14,4) NOT NULL DEFAULT 0,
  unit_price DECIMAL(14,2) NOT NULL,
  line_total DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (id), KEY ix_cashier_sale_items_sale (sale_id),
  CONSTRAINT fk_cashier_sale_items_sale FOREIGN KEY (sale_id) REFERENCES cashier_sales(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cashier_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id BIGINT UNSIGNED NOT NULL,
  method ENUM('cash','qris','transfer','edc') NOT NULL,
  amount_applied DECIMAL(14,2) NOT NULL,
  tendered_amount DECIMAL(14,2) NOT NULL,
  change_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  processed_by BIGINT UNSIGNED NOT NULL,
  processed_by_name VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY ix_cashier_payments_sale (sale_id, id),
  CONSTRAINT fk_cashier_payments_sale FOREIGN KEY (sale_id) REFERENCES cashier_sales(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cashier_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  actor_name VARCHAR(120) NOT NULL,
  action VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL,
  details_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY ix_cashier_audit_sale (sale_id, id),
  CONSTRAINT fk_cashier_audit_sale FOREIGN KEY (sale_id) REFERENCES cashier_sales(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cashier_sessions (
  token_hash CHAR(64) NOT NULL,
  account_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  PRIMARY KEY (token_hash), KEY ix_cashier_sessions_account (account_id, revoked_at),
  CONSTRAINT fk_cashier_sessions_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;
