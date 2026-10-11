-- Run once against fazima_print_customer to store detected location and
-- customer-entered address details separately.
ALTER TABLE orders
  ADD COLUMN location_label TEXT NULL AFTER address,
  ADD COLUMN address_detail TEXT NULL AFTER location_label;
