-- Fazima Print operator migration.
-- Run this once as a database administrator in fazima_print_customer.
-- The application user must only need SELECT/INSERT/UPDATE/DELETE afterwards.
USE fazima_print_customer;

CREATE TABLE IF NOT EXISTS operator_size_presets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_name VARCHAR(120) NOT NULL,
  size VARCHAR(80) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'cm',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_operator_preset (product_name, size),
  KEY ix_operator_preset_product (product_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS operator_layout_jobs (
  id CHAR(36) NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  product_name VARCHAR(120) NOT NULL,
  size VARCHAR(80) NOT NULL,
  finishing VARCHAR(80) NOT NULL DEFAULT '',
  color_mode VARCHAR(20) NOT NULL DEFAULT 'Original',
  pack VARCHAR(120) NOT NULL DEFAULT '',
  rename_enabled TINYINT(1) NOT NULL DEFAULT 0,
  raw_name VARCHAR(255) NOT NULL,
  output_name VARCHAR(255) NOT NULL,
  raw_path VARCHAR(500) NOT NULL,
  output_path VARCHAR(500) NOT NULL,
  detail_path VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  scale_up TINYINT(1) NOT NULL DEFAULT 1,
  output_format VARCHAR(10) NOT NULL DEFAULT 'PDF',
  PRIMARY KEY (id), KEY ix_operator_layout_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(14,3) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_stock_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_item_categories (
  item_id BIGINT UNSIGNED NOT NULL,
  category VARCHAR(20) NOT NULL,
  PRIMARY KEY (item_id, category),
  CONSTRAINT fk_stock_category_item FOREIGN KEY (item_id) REFERENCES stock_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id BIGINT UNSIGNED NOT NULL,
  category VARCHAR(20) NOT NULL DEFAULT '',
  movement_type ENUM('in','out','adjustment') NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  balance_after DECIMAL(14,3) NOT NULL,
  reference VARCHAR(160) NOT NULL DEFAULT '',
  note TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY ix_stock_movement_created (created_at),
  CONSTRAINT fk_stock_movement_item FOREIGN KEY (item_id) REFERENCES stock_items(id)
) ENGINE=InnoDB;

INSERT IGNORE INTO stock_items (name, unit) VALUES
('Stiker Hologram','lembar'),('Stiker Vinyl Doff','lembar'),('Stiker Vinyl Glossy','lembar'),('Stiker Cromo','lembar'),('Stiker HVS','lembar'),('Stiker Silver','lembar'),('Stiker Gold','lembar'),('Artpaper 120','lembar'),('Artpaper 150','lembar'),('Artpaper 260','lembar'),('Artpaper 310','lembar'),('Artcarton 260','lembar'),('Linen','lembar'),('Concorde','lembar'),('BC','lembar'),('Jasmine','lembar'),
('Stiker China','m³'),('Quantac/Camel','m³'),('Ritrama','m³'),('Graftac','m³'),('Transparan','m³'),('Hologram','m³'),('Blockout','m³'),('Oneway','m³'),('Backlite','m³'),('Miror','m³'),('Kulit Jeruk','m³'),('Albatros','m³'),('Luster','m³'),
('Flexy China 260','m³'),('Flexy China 280','m³'),('Flexy China 340','m³'),('Korea 440','m³');

INSERT IGNORE INTO stock_item_categories (item_id, category)
SELECT id, 'A3' FROM stock_items WHERE name IN ('Stiker Hologram','Stiker Vinyl Doff','Stiker Vinyl Glossy','Stiker Cromo','Stiker HVS','Stiker Silver','Stiker Gold','Artpaper 120','Artpaper 150','Artpaper 260','Artpaper 310','Artcarton 260','Linen','Concorde','BC','Jasmine');
INSERT IGNORE INTO stock_item_categories (item_id, category)
SELECT id, 'Indoor' FROM stock_items WHERE name IN ('Stiker China','Quantac/Camel','Ritrama','Graftac','Transparan','Hologram','Blockout','Oneway','Backlite','Miror','Kulit Jeruk','Albatros','Luster');
INSERT IGNORE INTO stock_item_categories (item_id, category)
SELECT id, 'Outdoor' FROM stock_items WHERE name IN ('Flexy China 260','Flexy China 280','Flexy China 340','Korea 440','Backlite','Oneway');
