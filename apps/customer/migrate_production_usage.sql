-- Run once in the Fazima customer database before using the expanded operator production form.
ALTER TABLE production_material_usage
  MODIFY COLUMN production_job_id BIGINT UNSIGNED NULL,
  ADD COLUMN order_group ENUM('offline','online','internal') NOT NULL DEFAULT 'online' AFTER stock_item_id,
  ADD COLUMN channel VARCHAR(60) NOT NULL DEFAULT 'Fazima' AFTER order_group,
  ADD COLUMN operator_name VARCHAR(120) NOT NULL DEFAULT '' AFTER channel,
  ADD COLUMN reference VARCHAR(120) NOT NULL DEFAULT '' AFTER operator_name,
  ADD COLUMN usage_type ENUM('good','machine_reject','operator_error','other_reprint') NOT NULL DEFAULT 'good' AFTER reference,
  ADD KEY ix_production_usage_filter (order_group, channel, operator_name, created_at);


UPDATE products SET unit='m²' WHERE name IN ('Spanduk Banner','Banner','X-Banner','Spanduk','Poster');
UPDATE products SET unit='pcs' WHERE name IN ('Mini Banner','Roll Up Banner','X/Y Banner','Tripod Banner','polaroid');

UPDATE production_material_usage u
JOIN production_jobs j ON j.id=u.production_job_id
JOIN orders o ON o.id=j.order_id
SET u.order_group=CASE WHEN UPPER(o.source) IN ('OFFLINE','CASHIER') THEN 'offline' ELSE 'online' END,
    u.channel=CASE WHEN UPPER(o.source) IN ('WEB','FAZIMA') THEN 'Fazima' ELSE o.source END,
    u.operator_name=COALESCE(j.operator_name,'');
