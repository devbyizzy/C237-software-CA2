-- RPConnect admin activity log migration.
-- Run this file manually against the RPConnect database before using admin
-- actions that write activity logs. This migration is non-destructive: it
-- only creates admin_logs when the table does not already exist.

CREATE TABLE IF NOT EXISTS admin_logs (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    admin_user_id INT NULL,
    action        VARCHAR(100) NOT NULL,
    target_type   VARCHAR(50) NOT NULL,
    target_id     INT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_admin_logs_admin_user_id (admin_user_id),
    INDEX idx_admin_logs_created_at (created_at),
    INDEX idx_admin_logs_target (target_type, target_id),

    CONSTRAINT fk_admin_logs_admin_user
        FOREIGN KEY (admin_user_id)
        REFERENCES users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
