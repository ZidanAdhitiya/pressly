-- Step 1: intake order, Team Setting validation, double verification, audit,
-- and dashboard notifications. Run once as a database administrator.
USE fazima_print_customer;

ALTER TABLE orders
  ADD COLUMN source VARCHAR(24) NOT NULL DEFAULT 'WEB' AFTER account_id,
  ADD COLUMN workflow_status VARCHAR(48) NOT NULL DEFAULT 'MENUNGGU_VALIDASI_SETTING' AFTER status,
  ADD COLUMN deadline_at DATETIME NULL AFTER notes,
  ADD COLUMN rejection_reason TEXT NULL AFTER deadline_at,
  ADD COLUMN setting_note TEXT NULL AFTER rejection_reason,
  ADD KEY ix_orders_workflow_status (workflow_status),
  ADD KEY ix_orders_source (source);

CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(48) NULL,
  to_status VARCHAR(48) NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  actor_name VARCHAR(120) NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_order_status_history_order (order_id, created_at),
  CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_verifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  target_status VARCHAR(48) NOT NULL,
  verifier_name VARCHAR(120) NOT NULL,
  verifier_role VARCHAR(32) NOT NULL DEFAULT 'setting',
  verification_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_verification (order_id, target_status, verifier_name),
  KEY ix_order_verification_order (order_id, target_status),
  CONSTRAINT fk_order_verification_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dashboard_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NULL,
  target_team VARCHAR(32) NOT NULL,
  notification_type VARCHAR(48) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY ix_dashboard_notifications_team (target_team, is_read, created_at),
  KEY ix_dashboard_notifications_order (order_id),
  CONSTRAINT fk_dashboard_notifications_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Existing WEB orders remain traceable and enter the Setting queue.
UPDATE orders
SET source = 'WEB'
WHERE source IS NULL OR source = '';

UPDATE orders
SET workflow_status = 'MENUNGGU_VALIDASI_SETTING'
WHERE workflow_status IS NULL OR workflow_status = '';
