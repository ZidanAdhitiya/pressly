-- Internal Operator and Cashier accounts are separate from customer users.
-- Safe to run on an existing install; it does not rename or move customer data.
USE fazima_print_customer;

CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(80) NOT NULL,
  display_name VARCHAR(120) NOT NULL DEFAULT '',
  role ENUM('cashier','operator') NOT NULL DEFAULT 'cashier',
  password_salt CHAR(32) NOT NULL,
  password_hash CHAR(64) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_accounts_username (username),
  KEY ix_accounts_role_active (role, is_active)
) ENGINE=InnoDB;
