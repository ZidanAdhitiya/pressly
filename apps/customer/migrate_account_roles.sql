-- Correct the role-neutral table ownership:
-- users = customer accounts, accounts = internal employee accounts.
RENAME TABLE users TO employee_accounts_tmp, accounts TO users, employee_accounts_tmp TO accounts;

ALTER TABLE accounts ADD COLUMN role ENUM('cashier','operator') NOT NULL DEFAULT 'cashier' AFTER display_name;
UPDATE accounts SET role = 'operator' WHERE username IN ('operator1', 'operator2');
