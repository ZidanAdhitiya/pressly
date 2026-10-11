-- Run once against the fazima_print_customer database before deploying.
ALTER TABLE orders
  ADD COLUMN shipping_courier VARCHAR(16) NULL AFTER delivery_method;
