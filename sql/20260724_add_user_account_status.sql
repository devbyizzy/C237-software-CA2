-- RPConnect user account-status migration.
--
-- Run this file manually against the RPConnect database. It is
-- non-destructive and safe to rerun: each schema object is added only when
-- it does not already exist. Existing users receive the default 'active'
-- status.
--
-- Target: MySQL 8.0.44. The CHECK constraint is enforced by this version.

SET @rpconnect_schema_name = DATABASE();

SET @rpconnect_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @rpconnect_schema_name
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'account_status'
);

SET @rpconnect_migration_sql = IF(
    @rpconnect_column_exists = 0,
    'ALTER TABLE `users`
       ADD COLUMN `account_status` VARCHAR(20) NOT NULL DEFAULT ''active''
       AFTER `role`',
    'SELECT ''users.account_status already exists'' AS migration_note'
);

PREPARE rpconnect_migration_statement
    FROM @rpconnect_migration_sql;
EXECUTE rpconnect_migration_statement;
DEALLOCATE PREPARE rpconnect_migration_statement;

SET @rpconnect_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @rpconnect_schema_name
      AND TABLE_NAME = 'users'
      AND INDEX_NAME = 'idx_users_account_status'
);

SET @rpconnect_migration_sql = IF(
    @rpconnect_index_exists = 0,
    'ALTER TABLE `users`
       ADD INDEX `idx_users_account_status` (`account_status`)',
    'SELECT ''idx_users_account_status already exists'' AS migration_note'
);

PREPARE rpconnect_migration_statement
    FROM @rpconnect_migration_sql;
EXECUTE rpconnect_migration_statement;
DEALLOCATE PREPARE rpconnect_migration_statement;

SET @rpconnect_check_exists = (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = @rpconnect_schema_name
      AND TABLE_NAME = 'users'
      AND CONSTRAINT_NAME = 'chk_users_account_status'
      AND CONSTRAINT_TYPE = 'CHECK'
);

SET @rpconnect_migration_sql = IF(
    @rpconnect_check_exists = 0,
    'ALTER TABLE `users`
       ADD CONSTRAINT `chk_users_account_status`
       CHECK (`account_status` IN (''active'', ''suspended''))',
    'SELECT ''chk_users_account_status already exists'' AS migration_note'
);

PREPARE rpconnect_migration_statement
    FROM @rpconnect_migration_sql;
EXECUTE rpconnect_migration_statement;
DEALLOCATE PREPARE rpconnect_migration_statement;
