USE fazima_print_customer;

CREATE TABLE IF NOT EXISTS production_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  production_category VARCHAR(20) NOT NULL DEFAULT 'A3',
  status ENUM('queued','in_progress','completed','blocked') NOT NULL DEFAULT 'queued',
  operator_name VARCHAR(120) NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_production_order (order_id),
  KEY ix_production_queue (production_category, status, created_at),
  CONSTRAINT fk_production_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS production_material_usage (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  production_job_id BIGINT UNSIGNED NOT NULL,
  stock_item_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  note VARCHAR(500) NOT NULL DEFAULT '',
  stock_movement_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY ix_usage_job (production_job_id),
  CONSTRAINT fk_usage_job FOREIGN KEY (production_job_id) REFERENCES production_jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_usage_stock FOREIGN KEY (stock_item_id) REFERENCES stock_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE orders MODIFY workflow_status VARCHAR(48) NOT NULL DEFAULT 'MENUNGGU_VALIDASI_SETTING';
