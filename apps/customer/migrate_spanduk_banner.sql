-- Replace the three legacy Flexi China catalog rows with one Spanduk Banner product.
-- Run this once in phpMyAdmin as a database administrator.
USE fazima_print_customer;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS materials_json JSON NULL AFTER sizes_json;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS material VARCHAR(80) NOT NULL DEFAULT '' AFTER size_label;

UPDATE products
SET name='Spanduk Banner',
    slug='spanduk-banner',
    category='outdoor',
    product_type='Banner / Spanduk',
    kind='banner',
    unit='m³',
    base_price=25000,
    image_path='assets/real/products/spanduk.jpg',
    description='Spanduk banner dengan pilihan bahan untuk kebutuhan promosi outdoor.',
    sizes_json='["1x3 m","1x4 m","Custom"]',
    materials_json='["Flexi China 260","Flexi China 330","Korea 440"]',
    is_active=1
WHERE name='Flexi China 260gsm';

UPDATE products
SET is_active=0
WHERE name IN ('Flexi China 280gsm', 'Flexi China 440gsm');

DELETE pr FROM promotions pr
JOIN products p ON p.id=pr.product_id
WHERE p.name IN ('Flexi China 280gsm', 'Flexi China 440gsm');
