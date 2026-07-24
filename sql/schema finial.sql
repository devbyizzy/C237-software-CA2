-- =====================================================================
--  RPConnect — FULL DATABASE (schema + sample data, one runnable file)
--  Target: MySQL 8.0  |  InnoDB  |  utf8mb4
--
--  JUST OPEN AND RUN:
--    MySQL Workbench:  File > Open SQL Script > this file > run (lightning bolt)
--    Terminal:         mysql -u root -p < schema.sql
--  No prior steps. It creates the database, all tables, a search view,
--  and sample data.
--
--  !! IMPORTANT — this file RESETS the database every time it runs.
--    The line DROP DATABASE IF EXISTS c237_001_teamcmi; wipes any
--    existing data so the run always succeeds cleanly. To KEEP existing
--    data, delete that DROP line; the CREATE below is non-destructive.
--
--  OWNERSHIP:
--    Person 1 (Auth)      users, login_otps          <- PLACEHOLDER, confirm
--    Person 2 (Nizamu)    questions, question_replies, helpful_votes
--    Person 3 (Wee Teck)  ccas
--    Person 4 (Isaiah)    app-wide SEARCH / SORT / FILTER
--                         -> owns the search_index VIEW + search indexes
--    Person 5 (Ryan)      student_groups + 3 more    <- PLACEHOLDER, confirm
--    Person 6 (Justin)    profiles + dashboard (reads every table)
--
--  Changelog + how Isaiah uses the search view are at the BOTTOM.
-- =====================================================================

DROP DATABASE IF EXISTS c237_001_teamcmi;   -- wipes old data for a clean run
CREATE DATABASE c237_001_teamcmi
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;
USE c237_001_teamcmi;


-- =====================================================================
--  PERSON 1 — AUTH / 2FA   !! PLACEHOLDER (Person 1 to confirm)
-- =====================================================================
CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    username      VARCHAR(50) NOT NULL UNIQUE,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'year1',   -- year1/year2/year3/admin
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_tokens (
    reset_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_password_reset_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_otps (
    otp_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    otp_code   VARCHAR(10) NOT NULL,
    expires_at DATETIME NOT NULL,
    is_used    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_otp_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
--  PERSON 6 — PROFILES (Dashboard + Student Finder)   [Justin]
--  is_searchable lets a student opt OUT of the Student Finder / search.
-- =====================================================================
CREATE TABLE profiles (
    profile_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL UNIQUE,
    display_name    VARCHAR(100),
    profile_picture VARCHAR(255),
    bio             TEXT,
    diploma         VARCHAR(150),
    year_of_study   INT,
    semester        INT,
    class_code      VARCHAR(30),
    interests       TEXT,
    skills          TEXT,
    looking_for     VARCHAR(100),
    is_searchable   BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_profiles_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
--  PERSON 3 — CCA DIRECTORY   [Wee Teck]
-- =====================================================================
CREATE TABLE ccas (
    cca_id             INT AUTO_INCREMENT PRIMARY KEY,
    cca_name           VARCHAR(150) NOT NULL,
    category           VARCHAR(100),
    description        TEXT,
    meeting_day        VARCHAR(30),
    meeting_start_time TIME,
    meeting_end_time   TIME,
    location           VARCHAR(150),
    contact_email      VARCHAR(150),
    image_url          VARCHAR(255),
    created_by         INT,
    status             VARCHAR(30) DEFAULT 'active',
    member_count       INT DEFAULT 0,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ccas_creator FOREIGN KEY (created_by)
        REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
    FULLTEXT KEY ft_ccas (cca_name, description)   -- keyword search
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cca_members (
    cca_member_id INT AUTO_INCREMENT PRIMARY KEY,
    cca_id        INT NOT NULL,
    user_id       INT NOT NULL,
    role          VARCHAR(20) DEFAULT 'member',        -- member/admin
    status        VARCHAR(20) DEFAULT 'active',        -- active/left
    joined_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cca_member UNIQUE (cca_id, user_id),
    CONSTRAINT fk_cm_cca FOREIGN KEY (cca_id)
        REFERENCES ccas(cca_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_cm_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
--  PERSON 5 — RP CIRCLES (GROUPS)   !! PLACEHOLDER (Ryan to confirm)
--  NAMING: student_groups, NOT groups (reserved word in MySQL 8).
-- =====================================================================
CREATE TABLE student_groups (
    group_id      INT AUTO_INCREMENT PRIMARY KEY,
    creator_id    INT NOT NULL,
    group_name    VARCHAR(150) NOT NULL,
    description   TEXT,
    group_type    VARCHAR(30),           -- class/study/cca/interest/friend
    diploma       VARCHAR(150),
    class_code    VARCHAR(30),
    module_code   VARCHAR(20),
    year_of_study INT,
    semester      INT,
    privacy       VARCHAR(10) DEFAULT 'public',
    max_members   INT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_groups_creator FOREIGN KEY (creator_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FULLTEXT KEY ft_groups (group_name, description)   -- keyword search
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE group_members (
    group_member_id INT AUTO_INCREMENT PRIMARY KEY,
    group_id        INT NOT NULL,
    user_id         INT NOT NULL,
    member_role     VARCHAR(20) DEFAULT 'member',    -- owner/moderator/member
    join_status     VARCHAR(20) DEFAULT 'pending',   -- pending/accepted/rejected
    joined_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_group_member UNIQUE (group_id, user_id),
    CONSTRAINT fk_gm_group FOREIGN KEY (group_id)
        REFERENCES student_groups(group_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_gm_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE group_posts (
    group_post_id INT AUTO_INCREMENT PRIMARY KEY,
    group_id      INT NOT NULL,
    user_id       INT NOT NULL,
    content       TEXT NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gp_group FOREIGN KEY (group_id)
        REFERENCES student_groups(group_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_gp_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE group_replies (
    group_reply_id INT AUTO_INCREMENT PRIMARY KEY,
    group_post_id  INT NOT NULL,
    user_id        INT NOT NULL,
    content        TEXT NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gr_post FOREIGN KEY (group_post_id)
        REFERENCES group_posts(group_post_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_gr_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
--  INDEXES for FILTER + SORT (Person 4's feature).
--  FULLTEXT (above) = keyword SEARCH per feature.
--  These b-tree indexes make FILTER (category/type/status) and
--  SORT (newest/oldest by created_at) fast. FK columns are already
--  auto-indexed by InnoDB, so they're skipped.
-- =====================================================================
CREATE INDEX idx_questions_category ON questions(category);
CREATE INDEX idx_questions_created  ON questions(created_at);
CREATE INDEX idx_ccas_category      ON ccas(category);
CREATE INDEX idx_ccas_created       ON ccas(created_at);
CREATE INDEX idx_groups_type        ON student_groups(group_type);
CREATE INDEX idx_groups_created     ON student_groups(created_at);


-- =====================================================================
--  PERSON 4 — APP-WIDE SEARCH VIEW   [Isaiah]
--  One virtual table that merges the searchable content from every
--  feature. Isaiah queries THIS instead of hand-writing UNION logic,
--  so one SELECT can search + filter (by feature/category) + sort
--  across the whole app.
--
--  Columns (same for every feature, so they line up):
--    source_type  which feature: 'question' | 'cca' | 'group' | 'student'
--    item_id      the row's id in its own table (link back to it)
--    heading      the title/name to show
--    body         the searchable text
--    category     a facet to filter on (category / group_type / diploma)
--    author_id    who owns it (join to users for a name)
--    created_at   for sorting newest/oldest
-- =====================================================================
CREATE OR REPLACE VIEW search_index AS
    SELECT 'question' AS source_type, q.question_id AS item_id,
           q.title AS heading, q.content AS body,
           q.category AS category, q.user_id AS author_id, q.created_at AS created_at
    FROM questions q
  UNION ALL
    SELECT 'cca', c.cca_id, c.cca_name, c.description,
           c.category, c.created_by, c.created_at
    FROM ccas c
  UNION ALL
    SELECT 'group', g.group_id, g.group_name, g.description,
           g.group_type, g.creator_id, g.created_at
    FROM student_groups g
  UNION ALL
    SELECT 'student', p.user_id, p.display_name, p.bio,
           p.diploma, p.user_id, p.created_at
    FROM profiles p
    WHERE p.is_searchable = TRUE;   -- respect the opt-out


-- =====================================================================
--  SAMPLE DATA  (so every page + search has content on first run)
--  Delete this section if you want empty tables.
-- =====================================================================
INSERT INTO users (name, username, email, password_hash, role) VALUES
('Nizamu', 'nizamu', 'nizamu@myrp.edu.sg', 'dev-not-a-real-hash', 'year2'),
('Senior Aisyah', 'aisyah', 'aisyah@myrp.edu.sg', 'dev-not-a-real-hash', 'year3'),
('Junior Ben', 'ben', 'ben@myrp.edu.sg', 'dev-not-a-real-hash', 'year1'),
('Admin Rahim', 'rahim', 'rahim@myrp.edu.sg', 'dev-not-a-real-hash', 'admin');

INSERT INTO profiles (user_id, display_name, bio, diploma, year_of_study, semester, class_code, interests) VALUES
  (1, 'Nizamu', 'DIT student, likes robotics.', 'Information Technology', 2, 1, 'E36A', 'robotics, gaming'),
  (2, 'Aisyah', 'Happy to help juniors.',       'Information Technology', 3, 1, 'E31C', 'web dev, coffee'),
  (3, 'Ben',    'Just started, saying hi!',     'Information Technology', 1, 1, 'E36A', 'anime, badminton');

INSERT INTO questions (user_id, title, content, category, status) VALUES
  (3, 'Is C237 hard with no coding background?',
      'Starting DIT next sem. How tough is C237 if I have never coded before?', 'Modules', 'open'),
  (1, 'Fastest food court near W block?',
      'Which food court is quickest between back-to-back lessons?', 'Food', 'resolved');

INSERT INTO question_replies (question_id, user_id, content) VALUES
  (1, 2, 'Manageable if you keep up weekly. The Express and database parts build on each other, so do not fall behind.'),
  (1, 4, 'Agreed. Do every lab and you will be fine.');

INSERT INTO helpful_votes (reply_id, user_id) VALUES (1, 1), (1, 3);

INSERT INTO ccas (cca_name, category, description, meeting_day, location, contact_email, created_by, member_count) VALUES
  ('Badminton Club',   'Sports',     'Casual and competitive play, all levels welcome.', 'Wednesday', 'Sports Hall',    'badminton@myrp.edu.sg', 4, 4),
  ('Photography IG',   'Arts',       'Learn photography and edit together.',              'Friday',    'Block E Studio', 'photo@myrp.edu.sg',     4, 3),
  ('Robotics Chapter', 'Technology', 'Build and program robots for competitions.',        'Tuesday',   'Makerspace',     'robotics@myrp.edu.sg',  4, 3);

INSERT INTO cca_members (cca_id, user_id, role, status) VALUES
  (1, 1, 'member', 'active'),
  (1, 2, 'member', 'active'),
  (1, 3, 'member', 'active'),
  (1, 4, 'admin',  'active'),
  (2, 1, 'member', 'active'),
  (2, 3, 'member', 'active'),
  (2, 4, 'admin',  'active'),
  (3, 1, 'member', 'active'),
  (3, 2, 'member', 'active'),
  (3, 4, 'admin',  'active');

INSERT INTO student_groups (creator_id, group_name, description, group_type, diploma, class_code, year_of_study, semester, privacy, max_members)
VALUES (1, 'DIT E36A Class Group', 'Find classmates and organise lunch.', 'class', 'Information Technology', 'E36A', 2, 1, 'public', 30);

INSERT INTO group_members (group_id, user_id, member_role, join_status) VALUES
  (1, 1, 'owner',  'accepted'),
  (1, 3, 'member', 'accepted');

INSERT INTO group_posts (group_id, user_id, content) VALUES
  (1, 1, 'Anyone up for lunch at South Food Court after C237 tomorrow?');

INSERT INTO group_replies (group_post_id, user_id, content) VALUES
  (1, 3, 'Count me in!');


-- =====================================================================
--  HOW ISAIAH USES THE SEARCH VIEW  (examples — copy into Express)
-- =====================================================================
--  SEARCH everything for a keyword, newest first:
--    SELECT * FROM search_index
--    WHERE heading LIKE CONCAT('%', ?, '%')
--       OR body    LIKE CONCAT('%', ?, '%')
--    ORDER BY created_at DESC;
--
--  SEARCH + FILTER to one feature (e.g. only CCAs):
--    SELECT * FROM search_index
--    WHERE (heading LIKE CONCAT('%', ?, '%') OR body LIKE CONCAT('%', ?, '%'))
--      AND source_type = ?                       -- 'question'/'cca'/'group'/'student'
--    ORDER BY heading ASC;                        -- SORT A-Z
--
--  FILTER by category + SORT oldest first (no keyword):
--    SELECT * FROM search_index
--    WHERE category = ?
--    ORDER BY created_at ASC;
--
--  Build the WHERE/ORDER BY dynamically from the user's search box,
--  feature dropdown, and sort dropdown. To link a result back to its
--  page, use source_type + item_id (e.g. /questions/<item_id>).
--
--  NOTE — FULLTEXT vs the view:
--    The view uses LIKE (works across the UNION, good enough for a
--    project). MySQL's faster, relevance-ranked FULLTEXT (MATCH..AGAINST)
--    does NOT work through a UNION view — it needs a single base table.
--    So for "smart" ranked search, query each base table's FULLTEXT index
--    (ft_questions / ft_ccas / ft_groups) and merge in code. The LIKE
--    view is the simpler default; FULLTEXT is the upgrade if time allows.


-- =====================================================================
--  CHANGELOG / NOTES
-- =====================================================================
--  ADDED THIS RUN (Person 4 = search/sort/filter across all features):
--    - search_index VIEW: merges questions, ccas, student_groups and
--      (searchable) profiles into one surface -> one query searches,
--      filters and sorts across every feature.
--    - FULLTEXT index on student_groups (questions + ccas already had one).
--    - B-tree indexes on created_at (SORT) and group_type (FILTER) so
--      sorting/filtering stays fast.
--    - Example search/sort/filter queries above.
--
--  HEADS-UP for Person 4 (raised before, restating once):
--    Cross-feature search is READ-ONLY (like Justin's dashboard). If your
--    CA2 grades each member on their own INSERT/UPDATE/DELETE, a pure
--    search feature may not show that. Easiest fix: Isaiah also owns ONE
--    small writable table (e.g. saved_searches or search_feedback) so he
--    has CRUD to demo. Confirm against your rubric.
--
--  CARRIED OVER: users/login_otps defined; run order correct; Q&A reply +
--    vote tables; student_groups (not reserved groups); InnoDB+utf8mb4;
--    DROP+CREATE + seed so it runs with zero manual steps.
--
--  STILL TEAM-OWNED: users/login_otps (Person 1) and group tables (Ryan)
--    are drafts. The search view must be treated as READ-ONLY; if a table
--    it references is missing on a teammate's machine, the view errors —
--    so create all tables (run this whole file) before using the view.
-- =====================================================================
