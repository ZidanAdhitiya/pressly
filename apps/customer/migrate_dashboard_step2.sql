-- Step 2: persist Auto Layout output and transfer to Team Kasir.
-- Run once as a database administrator after migrate_dashboard_step1.sql.
USE fazima_print_customer;

ALTER TABLE orders
  ADD COLUMN layout_token CHAR(32) NULL AFTER setting_note,
  ADD COLUMN layout_output_name VARCHAR(255) NULL AFTER layout_token,
  ADD COLUMN layout_file_path VARCHAR(500) NULL AFTER layout_output_name,
  ADD COLUMN layout_saved_at DATETIME NULL AFTER layout_file_path,
  ADD COLUMN cashier_note TEXT NULL AFTER layout_saved_at,
  ADD KEY ix_orders_layout_token (layout_token);

ALTER TABLE layout_jobs
  ADD COLUMN output_name VARCHAR(255) NULL AFTER output_file,
  ADD COLUMN storage_path VARCHAR(500) NULL AFTER output_name,
  ADD COLUMN saved_at DATETIME NULL AFTER storage_path;
