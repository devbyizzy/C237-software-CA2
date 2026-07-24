-- RPConnect question-moderation table migration.
--
-- Run this file manually against the RPConnect database. It is
-- non-destructive and safe to rerun because it uses CREATE TABLE IF NOT
-- EXISTS and does not alter, drop, or seed existing data.
--
-- These definitions reconstruct the model implied by the repository's SQL
-- seed statements, search view, and sample question data. They provide the
-- relationships needed for admin question and reply moderation.

CREATE TABLE IF NOT EXISTS questions (
    question_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    title       VARCHAR(200) NOT NULL,
    content     TEXT NOT NULL,
    category    VARCHAR(100) NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_questions_user_id (user_id),
    INDEX idx_questions_status (status),
    INDEX idx_questions_category (category),
    INDEX idx_questions_created_at (created_at),
    FULLTEXT KEY ft_questions_title_content (title, content),

    CONSTRAINT fk_questions_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT chk_questions_status
        CHECK (status IN ('open', 'resolved'))
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS question_replies (
    reply_id    INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    user_id     INT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_question_replies_question_id (question_id),
    INDEX idx_question_replies_user_id (user_id),
    INDEX idx_question_replies_created_at (created_at),

    CONSTRAINT fk_question_replies_question
        FOREIGN KEY (question_id)
        REFERENCES questions(question_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_question_replies_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS helpful_votes (
    vote_id    INT AUTO_INCREMENT PRIMARY KEY,
    reply_id   INT NOT NULL,
    user_id    INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_helpful_votes_reply_user (reply_id, user_id),
    INDEX idx_helpful_votes_user_id (user_id),
    INDEX idx_helpful_votes_created_at (created_at),

    CONSTRAINT fk_helpful_votes_reply
        FOREIGN KEY (reply_id)
        REFERENCES question_replies(reply_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_helpful_votes_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
