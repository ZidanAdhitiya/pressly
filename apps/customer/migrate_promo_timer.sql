-- Import once in phpMyAdmin for an existing fazima_print_customer database.
-- The timer state is global for the customer promo box and persists in MySQL.
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
