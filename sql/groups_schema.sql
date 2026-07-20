-- ============================================================
-- RPConnect: Class and Friend Groups feature (Member 5 - Ryan)
-- Run this script once in MySQL to create the tables.
--   mysql -u root -p < sql/groups_schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS rpconnect;
USE rpconnect;

-- ------------------------------------------------------------
-- users table is OWNED BY Member 1 (accounts/login feature).
-- Created here with IF NOT EXISTS only so the groups feature
-- can run standalone on this branch. Member 1's version wins.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id        INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(100) NOT NULL UNIQUE,
    password       VARCHAR(255) NOT NULL,          -- hashed by Member 1's code
    diploma        VARCHAR(100),
    year_of_study  INT,
    role           VARCHAR(20) DEFAULT 'student'
);

-- ------------------------------------------------------------
-- groups: one row per group (class / study / CCA / interest / friend).
-- NOTE: "groups" is a reserved word in MySQL 8, so it must be
-- written in backticks in every SQL query.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `groups` (
    group_id        INT AUTO_INCREMENT PRIMARY KEY,
    creator_id      INT NOT NULL,                      -- user who created the group
    group_name      VARCHAR(100) NOT NULL,
    description     TEXT,
    group_type      ENUM('Class','Study','CCA','Interest','Friend') NOT NULL,
    diploma         VARCHAR(100),                      -- optional: only for class/study groups
    class_code      VARCHAR(20),                       -- e.g. E36A
    module_code     VARCHAR(20),                       -- e.g. C237
    year_of_study   INT,
    semester        INT,
    privacy         ENUM('public','private') NOT NULL DEFAULT 'public',
    maximum_members INT NOT NULL DEFAULT 50,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(user_id)
);

-- ------------------------------------------------------------
-- group_members: who is in (or has requested to join) a group.
-- join_status implements the join-request flow:
--   pending  -> requested a private group, waiting for owner
--   accepted -> full member
--   rejected -> owner turned the request down
-- UNIQUE(group_id, user_id) means a user can only have ONE
-- membership row per group (used by INSERT ... ON DUPLICATE KEY).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_members (
    group_member_id INT AUTO_INCREMENT PRIMARY KEY,
    group_id        INT NOT NULL,
    user_id         INT NOT NULL,
    member_role     ENUM('owner','moderator','member') NOT NULL DEFAULT 'member',
    join_status     ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
    joined_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_group_user (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES `groups`(group_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(user_id)     ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- group_posts: discussion board posts inside a group.
-- ON DELETE CASCADE: deleting a group also deletes its posts.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_posts (
    group_post_id INT AUTO_INCREMENT PRIMARY KEY,
    group_id      INT NOT NULL,
    user_id       INT NOT NULL,
    content       TEXT NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES `groups`(group_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(user_id)     ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- group_replies: replies under a group post.
-- ON DELETE CASCADE: deleting a post also deletes its replies.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_replies (
    group_reply_id INT AUTO_INCREMENT PRIMARY KEY,
    group_post_id  INT NOT NULL,
    user_id        INT NOT NULL,
    content        TEXT NOT NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_post_id) REFERENCES group_posts(group_post_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)       REFERENCES users(user_id)             ON DELETE CASCADE
);

-- ============================================================
-- Sample data for the live demo (safe to delete later).
-- ============================================================
INSERT INTO users (name, email, password, diploma, year_of_study) VALUES
    ('Ryan',   'ryan@example.com',   'demo', 'Information Technology', 1),
    ('Aisha',  'aisha@example.com',  'demo', 'Business',               2),
    ('Marcus', 'marcus@example.com', 'demo', 'Information Technology', 1);

INSERT INTO `groups`
    (creator_id, group_name, description, group_type, diploma, class_code, module_code, year_of_study, semester, privacy, maximum_members)
VALUES
    (1, 'DIT E36A Class',        'A group for E36A students to find classmates and share reminders.', 'Class',    'Information Technology', 'E36A', NULL,   1, 1, 'public',  40),
    (1, 'C237 Study Group',      'Revise C237 Software Application Development together.',            'Study',    'Information Technology', NULL,   'C237', 1, 1, 'public',  20),
    (2, 'Anime Fans in RP',      'Weekly hangouts to talk about the current anime season.',           'Interest', NULL,                     NULL,   NULL,   NULL, NULL, 'private', 30);

-- Creators are automatically owners of their own groups.
INSERT INTO group_members (group_id, user_id, member_role, join_status) VALUES
    (1, 1, 'owner',  'accepted'),
    (2, 1, 'owner',  'accepted'),
    (3, 2, 'owner',  'accepted'),
    (1, 3, 'member', 'accepted'),
    (3, 1, 'member', 'pending');   -- pending request to demo the accept/reject flow

INSERT INTO group_posts (group_id, user_id, content) VALUES
    (1, 3, 'Anyone wants to have lunch at South Food Court after C237 tomorrow?');

INSERT INTO group_replies (group_post_id, user_id, content) VALUES
    (1, 1, 'Count me in! Meet outside the classroom at 12:30.');
