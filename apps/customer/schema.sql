-- Fazima Print customer database.
-- Import this file in phpMyAdmin, then configure MYSQL_* in apps/customer/.env.
CREATE DATABASE IF NOT EXISTS fazima_print_customer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fazima_print_customer;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  category VARCHAR(40) NOT NULL,
  product_type VARCHAR(80) NOT NULL,
  kind VARCHAR(40) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  base_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  image_path VARCHAR(255) NOT NULL,
  description TEXT NULL,
  sizes_json JSON NOT NULL,
  materials_json JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_products_slug (slug), UNIQUE KEY uq_products_name (name), KEY ix_products_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(40) NOT NULL,
  name VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id), UNIQUE KEY uq_product_categories_slug (slug), UNIQUE KEY uq_product_categories_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS promotions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL DEFAULT 'Promo',
  discount_percent DECIMAL(5,2) NOT NULL,
  promo_price DECIMAL(12,2) NOT NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_promotions_product (product_id), KEY ix_promotions_active (is_active, starts_at, ends_at),
  CONSTRAINT fk_promotions_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS promo_timer_settings (
  id TINYINT UNSIGNED NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  mode VARCHAR(20) NOT NULL DEFAULT 'one_time',
  duration_seconds INT UNSIGNED NOT NULL DEFAULT 28800,
  reset_threshold_seconds INT UNSIGNED NOT NULL DEFAULT 14400,
  random_min_seconds INT UNSIGNED NOT NULL DEFAULT 14400,
  random_max_seconds INT UNSIGNED NOT NULL DEFAULT 43200,
  end_action VARCHAR(24) NOT NULL DEFAULT 'hide_box',
  started_at DATETIME NULL,
  ends_at DATETIME NULL,
  generated_duration_seconds INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT INTO promo_timer_settings (id, enabled, mode, duration_seconds, reset_threshold_seconds, random_min_seconds, random_max_seconds, end_action, started_at, ends_at, generated_duration_seconds)
VALUES (1, 1, 'one_time', 28800, 14400, 14400, 43200, 'hide_box', UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), 28800)
ON DUPLICATE KEY UPDATE id=id;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL DEFAULT '',
  phone VARCHAR(40) NOT NULL DEFAULT '',
  role ENUM('customer','admin','operator') NOT NULL DEFAULT 'customer',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(40) NOT NULL,
  account_id BIGINT UNSIGNED NULL,
  source VARCHAR(24) NOT NULL DEFAULT 'WEB',
  customer_name VARCHAR(120) NOT NULL DEFAULT '',
  customer_phone VARCHAR(40) NOT NULL DEFAULT '',
  delivery_method ENUM('pickup','delivery') NOT NULL DEFAULT 'pickup',
  address TEXT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('draft','pending_payment','paid','processing','ready','completed','cancelled') NOT NULL DEFAULT 'draft',
  workflow_status VARCHAR(48) NOT NULL DEFAULT 'MENUNGGU_VALIDASI_SETTING',
  notes TEXT NULL,
  deadline_at DATETIME NULL,
  rejection_reason TEXT NULL,
  setting_note TEXT NULL,
  layout_token CHAR(32) NULL,
  layout_output_name VARCHAR(255) NULL,
  layout_file_path VARCHAR(500) NULL,
  layout_saved_at DATETIME NULL,
  cashier_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_orders_number (order_number), KEY ix_orders_account (account_id), KEY ix_orders_status (status), KEY ix_orders_workflow_status (workflow_status), KEY ix_orders_source (source), KEY ix_orders_layout_token (layout_token),
  CONSTRAINT fk_orders_account FOREIGN KEY (account_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  product_name VARCHAR(120) NOT NULL,
  size_label VARCHAR(80) NOT NULL,
  material VARCHAR(80) NOT NULL DEFAULT '',
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  original_unit_price DECIMAL(12,2) NULL,
  promo_id BIGINT UNSIGNED NULL,
  finishing VARCHAR(80) NOT NULL DEFAULT '',
  design_file VARCHAR(255) NOT NULL DEFAULT '',
  layout_token CHAR(32) NULL,
  item_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id), KEY ix_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_items_promo FOREIGN KEY (promo_id) REFERENCES promotions(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(48) NULL,
  to_status VARCHAR(48) NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  actor_name VARCHAR(120) NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY ix_order_status_history_order (order_id, created_at),
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
  PRIMARY KEY (id), UNIQUE KEY uq_order_verification (order_id, target_status, verifier_name),
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
  PRIMARY KEY (id), KEY ix_dashboard_notifications_team (target_team, is_read, created_at), KEY ix_dashboard_notifications_order (order_id),
  CONSTRAINT fk_dashboard_notifications_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'midtrans',
  provider_order_id VARCHAR(80) NOT NULL,
  transaction_status VARCHAR(40) NOT NULL DEFAULT 'pending',
  fraud_status VARCHAR(40) NULL,
  gross_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  raw_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_payments_provider_order (provider, provider_order_id), KEY ix_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS layout_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NULL,
  token CHAR(32) NOT NULL,
  product_name VARCHAR(120) NOT NULL,
  input_file VARCHAR(255) NOT NULL,
  output_file VARCHAR(255) NOT NULL,
  output_name VARCHAR(255) NULL,
  storage_path VARCHAR(500) NULL,
  saved_at DATETIME NULL,
  status ENUM('processing','ready','failed','expired') NOT NULL DEFAULT 'processing',
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_layout_jobs_token (token), KEY ix_layout_jobs_expiry (expires_at),
  CONSTRAINT fk_layout_jobs_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB;

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
  PRIMARY KEY (id), UNIQUE KEY uq_production_jobs_order (order_id),
  KEY ix_production_jobs_queue (status, production_category, created_at),
  CONSTRAINT fk_production_jobs_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS production_material_usage (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  production_job_id BIGINT UNSIGNED NOT NULL,
  stock_item_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  note VARCHAR(500) NOT NULL DEFAULT '',
  stock_movement_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY ix_production_usage_job (production_job_id), KEY ix_production_usage_stock (stock_item_id),
  CONSTRAINT fk_production_usage_job FOREIGN KEY (production_job_id) REFERENCES production_jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_production_usage_stock FOREIGN KEY (stock_item_id) REFERENCES stock_items(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id BIGINT UNSIGNED NULL,
  session_id VARCHAR(80) NOT NULL,
  role ENUM('user','model','system') NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY ix_chat_session (session_id, created_at),
  CONSTRAINT fk_chat_account FOREIGN KEY (account_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Seed the current customer catalog. Existing rows are updated, not duplicated.
INSERT INTO products (name, slug, category, product_type, kind, unit, base_price, image_path, sizes_json) VALUES
('Cetak Sertifikat','cetak-sertif','biru','Sertifikat','paper','pcs',5000,'assets/products/biru/cetak-sertif.jpg','["A4","A3","Custom"]'),
('Stiker Chromo A3+','cromo-fz-edited','biru','Sticker','sticker','pcs',5000,'assets/products/biru/cromo-fz-edited.jpg','["A3"]'),
('Cetak Flyer/Brosur','flyer-brosur','biru','Flyer / Brosur','paper','pcs',1000,'assets/products/biru/flyer-brosur.jpg','["A4","A3","Custom"]'),
('Canvas Custom','foto-sampul-canvas','biru','Foto / Canvas','canvas','pcs',30000,'assets/products/biru/foto-sampul-canvas.jpg','["A4","A3","Custom"]'),
('Spanduk Banner','spanduk-banner','outdoor','Banner / Spanduk','banner','m²',25000,'assets/real/products/spanduk.jpg','["1x3 m","1x4 m","Custom"]'),
('Cetak Kertas Kado','foto-utama-kado','biru','Kertas','paper','pcs',5000,'assets/products/biru/foto-utama-kado.jpg','["A4","A3","Custom"]'),
('Gantungan Kunci','ganci','biru','Merchandise','merchandise','pcs',2800,'assets/products/biru/ganci.jpg','["Custom"]'),
('ID Card','id-card','biru','ID Card','card','pcs',12500,'assets/products/biru/id-card.jpg','["Custom"]'),
('Mini Banner','mini-banner','biru','Banner / Display','banner','pcs',30000,'assets/products/biru/mini-banner.jpg','["0.6x1.6 m","Custom"]'),
('Mug Custom','mug-custom','biru','Merchandise','merchandise','pcs',20000,'assets/products/biru/mug-custom.jpg','["Custom"]'),
('Roll Up Banner','roll-up-banner','biru','Banner / Display','banner','pcs',220000,'assets/products/biru/roll-up-banner.jpg','["0.8x2 m","Custom"]'),
('Stiker Meteran','sticker-transparant-meteran','biru','Sticker','sticker','pcs',70000,'assets/products/biru/sticker-transparant-meteran.jpg','["A3"]'),
('Stiker One Way','stiker-oneway','biru','Sticker','sticker','pcs',90000,'assets/products/biru/stiker-oneway.jpg','["Custom"]'),
('Stiker Transparan A3','stiker-transparant-a3','biru','Sticker','sticker','pcs',90000,'assets/products/biru/stiker-transparant-a3.jpg','["A3"]'),
('Stiker Vinyl A3+','vinyl-a3','biru','Sticker','sticker','pcs',12500,'assets/products/biru/vinyl-a3.jpg','["A3"]'),
('X/Y Banner','x-y-banner','biru','Banner / Display','banner','pcs',75000,'assets/products/biru/x-y-banner.jpg','["0.6x1.6 m","Custom"]'),
('Art Paper 120gsm','foto-utama-ap120','kuning','Art Paper','paper','pcs',3000,'assets/products/kuning/foto-utama-ap120.jpg','["A4","A3","Custom"]'),
('Art Paper 210gsm','foto-utama-copy-0','kuning','Art Paper','paper','pcs',4000,'assets/products/kuning/foto-utama-copy-0.jpg','["A4","A3","Custom"]'),
('Art Paper 150gsm','foto-utama','kuning','Art Paper','paper','pcs',3500,'assets/products/kuning/foto-utama.jpg','["A4","A3","Custom"]'),
('Art Paper 260gsm','tokopedia-mesin-laser-a3-260','kuning','Art Paper','paper','pcs',5000,'assets/products/kuning/tokopedia-mesin-laser-a3-260.jpg','["A4","A3","Custom"]'),
('Art Paper 310gsm','tokopedia-mesin-laser-a3-310','kuning','Art Paper','paper','pcs',6000,'assets/products/kuning/tokopedia-mesin-laser-a3-310.jpg','["A4","A3","Custom"]'),
('Tripod Banner','tripod-banner','kuning','Banner / Display','banner','pcs',25000,'assets/products/kuning/tripod-banner.jpg','["0.6x1.6 m","Custom"]')
ON DUPLICATE KEY UPDATE base_price=VALUES(base_price), image_path=VALUES(image_path), sizes_json=VALUES(sizes_json), is_active=1;

INSERT INTO products (name, slug, category, product_type, kind, unit, base_price, image_path, sizes_json) VALUES
('Banner','banner','biru','Banner outdoor','banner','m²',35000,'assets/real/products/banner.jpg','["3x1 m","4x1 m","Custom"]'),
('X-Banner','x-banner','biru','Display portable','banner','m²',85000,'assets/real/products/x-banner.jpg','["0.6x1.6 m","0.8x1.8 m","Custom"]'),
('Spanduk','spanduk','biru','Spanduk promosi','banner','m²',25000,'assets/real/products/spanduk.jpg','["1x3 m","1x4 m","Custom"]'),
('Sticker','sticker','biru','Sticker custom','sticker','lembar',15000,'assets/real/products/sticker.jpg','["A4","A3","Custom"]'),
('Poster','poster','biru','Poster print','poster','m²',20000,'assets/real/products/poster.jpg','["A4","A3","A2","Custom"]'),
('Kartu Nama','kartu-nama','biru','Kartu nama','card','pcs',30000,'assets/real/products/kartu-nama.jpg','["9x5.5 cm","Custom"]')
ON DUPLICATE KEY UPDATE base_price=VALUES(base_price), image_path=VALUES(image_path), sizes_json=VALUES(sizes_json), is_active=1;

UPDATE products
SET materials_json='["Flexi China 260","Flexi China 330","Korea 440"]'
WHERE slug='spanduk-banner';

INSERT INTO promotions (product_id, title, discount_percent, promo_price)
SELECT id, 'Promo katalog', 20, FLOOR(base_price * 0.80 / 100) * 100 FROM products WHERE slug='cetak-sertif'
ON DUPLICATE KEY UPDATE promo_price=VALUES(promo_price), is_active=1;

INSERT INTO promotions (product_id, title, discount_percent, promo_price)
SELECT id, 'Promo katalog', 15, FLOOR(base_price * 0.85 / 100) * 100 FROM products WHERE slug='flyer-brosur'
ON DUPLICATE KEY UPDATE promo_price=VALUES(promo_price), is_active=1;

INSERT INTO promotions (product_id, title, discount_percent, promo_price)
SELECT id, 'Promo katalog', 25, FLOOR(base_price * 0.75 / 100) * 100 FROM products WHERE slug='foto-sampul-canvas'
ON DUPLICATE KEY UPDATE promo_price=VALUES(promo_price), is_active=1;

INSERT INTO promotions (product_id, title, discount_percent, promo_price)
SELECT id, 'Promo katalog', 10, FLOOR(base_price * 0.90 / 100) * 100 FROM products WHERE slug='foto-utama-260-gsm'
ON DUPLICATE KEY UPDATE promo_price=VALUES(promo_price), is_active=1;
