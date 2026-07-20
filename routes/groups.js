// routes/groups.js - Class and Friend Groups feature (Member 5 - Ryan).
// Every route follows the C237 flow:
//   user action -> Express route -> SQL query -> database response -> EJS update
//
// NOTE: "groups" is a reserved word in MySQL 8, so the table name is
// always written as `groups` (backticks) inside SQL strings.
const express = require('express');
const router = express.Router();
const db = require('../db');

// Single source of truth for the group-type dropdowns in the EJS forms
// (matches the ENUM in sql/groups_schema.sql - no values hardcoded in views).
const GROUP_TYPES = ['Class', 'Study', 'CCA', 'Interest', 'Friend'];

// ------------------------------------------------------------------
// Middleware: block every group route from unauthenticated visitors.
// Member 1's login sets req.session.userId; without it -> /login.
// ------------------------------------------------------------------
function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
}

// ==================================================================
// READ: GET /groups - browse and search all groups.
// Filters come from the search form's query string (?q=&type=&diploma=)
// and are appended to the SQL as parameterised WHERE conditions.
// ==================================================================
router.get('/groups', requireLogin, async (req, res) => {
    try {
        const { q, type, diploma } = req.query;

        // Base query: every group + how many ACCEPTED members it has.
        let sql = `
            SELECT g.*, COUNT(gm.group_member_id) AS member_count
            FROM \`groups\` g
            LEFT JOIN group_members gm
                   ON gm.group_id = g.group_id AND gm.join_status = 'accepted'
            WHERE 1 = 1`;
        const params = [];

        // Each filter is optional - only added if the user filled it in.
        if (q) {                       // keyword search on name/description/module
            sql += ' AND (g.group_name LIKE ? OR g.description LIKE ? OR g.module_code LIKE ?)';
            params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        if (type) {                    // filter by group type (Class/Study/...)
            sql += ' AND g.group_type = ?';
            params.push(type);
        }
        if (diploma) {                 // filter by diploma
            sql += ' AND g.diploma = ?';
            params.push(diploma);
        }
        sql += ' GROUP BY g.group_id ORDER BY g.created_at DESC';

        const [groups] = await db.query(sql, params);

        // Distinct diplomas already stored in the DB -> filter dropdown options.
        const [diplomas] = await db.query(
            'SELECT DISTINCT diploma FROM `groups` WHERE diploma IS NOT NULL ORDER BY diploma');

        // Database response -> EJS update.
        res.render('groups', {
            groups,
            groupTypes: GROUP_TYPES,
            diplomas: diplomas.map(row => row.diploma),
            filters: { q: q || '', type: type || '', diploma: diploma || '' }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading groups');
    }
});

// ==================================================================
// CREATE (form): GET /groups/create - show the "new group" form.
// ==================================================================
router.get('/groups/create', requireLogin, (req, res) => {
    res.render('createGroup', { groupTypes: GROUP_TYPES });
});

// ==================================================================
// CREATE (insert): POST /groups/create
// 1) INSERT the group  2) INSERT the creator as its accepted owner.
// ==================================================================
router.post('/groups/create', requireLogin, async (req, res) => {
    try {
        const { group_name, description, group_type, diploma, class_code,
                module_code, year_of_study, semester, privacy, maximum_members } = req.body;

        // INSERT the new group; empty optional fields are stored as NULL.
        const [result] = await db.query(
            `INSERT INTO \`groups\`
                (creator_id, group_name, description, group_type, diploma,
                 class_code, module_code, year_of_study, semester, privacy, maximum_members)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.session.userId, group_name, description, group_type,
             diploma || null, class_code || null, module_code || null,
             year_of_study || null, semester || null,
             privacy, Number(maximum_members) || 50]);

        // The creator automatically becomes the group's owner.
        await db.query(
            `INSERT INTO group_members (group_id, user_id, member_role, join_status)
             VALUES (?, ?, 'owner', 'accepted')`,
            [result.insertId, req.session.userId]);

        // Redirect straight to the new group's page (uses the new auto id).
        res.redirect(`/groups/${result.insertId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating group');
    }
});

// ==================================================================
// READ: GET /groups/:id - one group's details + discussion board.
// Runs several SELECTs and passes everything to groupDetails.ejs.
// ==================================================================
router.get('/groups/:id', requireLogin, async (req, res) => {
    try {
        const groupId = req.params.id;

        // 1) The group itself, joined with its creator's name.
        const [groupRows] = await db.query(
            `SELECT g.*, u.name AS creator_name
             FROM \`groups\` g
             JOIN users u ON u.user_id = g.creator_id
             WHERE g.group_id = ?`, [groupId]);
        if (groupRows.length === 0) return res.status(404).send('Group not found');
        const group = groupRows[0];

        // 2) Accepted members (owner first) for the member list + count.
        const [members] = await db.query(
            `SELECT gm.user_id, gm.member_role, gm.joined_at, u.name, u.diploma
             FROM group_members gm
             JOIN users u ON u.user_id = gm.user_id
             WHERE gm.group_id = ? AND gm.join_status = 'accepted'
             ORDER BY FIELD(gm.member_role, 'owner', 'moderator', 'member'), gm.joined_at`,
            [groupId]);

        // 3) The viewer's own membership row (decides which buttons to show).
        const [myRows] = await db.query(
            'SELECT member_role, join_status FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, req.session.userId]);
        const myMembership = myRows[0] || null;
        const isOwner = myMembership && myMembership.member_role === 'owner'
                        && myMembership.join_status === 'accepted';
        const isMember = myMembership && myMembership.join_status === 'accepted';

        // 4) Pending join requests - only fetched for the owner/moderator.
        let pendingRequests = [];
        if (isOwner || (isMember && myMembership.member_role === 'moderator')) {
            const [pending] = await db.query(
                `SELECT gm.user_id, gm.joined_at, u.name, u.diploma
                 FROM group_members gm
                 JOIN users u ON u.user_id = gm.user_id
                 WHERE gm.group_id = ? AND gm.join_status = 'pending'
                 ORDER BY gm.joined_at`, [groupId]);
            pendingRequests = pending;
        }

        // 5) Discussion board: posts (newest first) with author names...
        const [posts] = await db.query(
            `SELECT p.group_post_id, p.content, p.created_at, u.name AS author_name
             FROM group_posts p
             JOIN users u ON u.user_id = p.user_id
             WHERE p.group_id = ?
             ORDER BY p.created_at DESC`, [groupId]);

        // ...and all replies for this group's posts, attached to each post in JS.
        const [replies] = await db.query(
            `SELECT r.group_post_id, r.content, r.created_at, u.name AS author_name
             FROM group_replies r
             JOIN group_posts p ON p.group_post_id = r.group_post_id
             JOIN users u ON u.user_id = r.user_id
             WHERE p.group_id = ?
             ORDER BY r.created_at`, [groupId]);
        posts.forEach(post => {
            post.replies = replies.filter(r => r.group_post_id === post.group_post_id);
        });

        // Database responses -> one EJS page.
        res.render('groupDetails', {
            group, members, posts, pendingRequests, myMembership, isMember, isOwner
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading group');
    }
});

// ==================================================================
// CREATE membership: POST /groups/:id/join
// Public group  -> instantly 'accepted'.
// Private group -> 'pending' until the owner approves.
// ON DUPLICATE KEY lets a previously rejected user request again.
// ==================================================================
router.post('/groups/:id/join', requireLogin, async (req, res) => {
    try {
        const groupId = req.params.id;

        const [groupRows] = await db.query(
            'SELECT privacy, maximum_members FROM `groups` WHERE group_id = ?', [groupId]);
        if (groupRows.length === 0) return res.status(404).send('Group not found');
        const group = groupRows[0];

        // Capacity check: count current accepted members before letting anyone in.
        const [[{ count }]] = await db.query(
            `SELECT COUNT(*) AS count FROM group_members
             WHERE group_id = ? AND join_status = 'accepted'`, [groupId]);
        if (group.privacy === 'public' && count >= group.maximum_members) {
            return res.status(400).send('This group is already full');
        }

        // Public -> accepted immediately; private -> pending request.
        const status = group.privacy === 'public' ? 'accepted' : 'pending';

        // UNIQUE(group_id, user_id) means an existing row (e.g. 'rejected')
        // is UPDATEd back to a fresh request instead of inserting a duplicate.
        await db.query(
            `INSERT INTO group_members (group_id, user_id, member_role, join_status)
             VALUES (?, ?, 'member', ?)
             ON DUPLICATE KEY UPDATE
                join_status = IF(join_status = 'accepted', join_status, VALUES(join_status)),
                joined_at = NOW()`,
            [groupId, req.session.userId, status]);

        res.redirect(`/groups/${groupId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error joining group');
    }
});

// ==================================================================
// UPDATE membership: POST /groups/:id/requests/:userId/accept
// Only the owner/moderator may approve a pending join request.
// ==================================================================
router.post('/groups/:id/requests/:userId/accept', requireLogin, async (req, res) => {
    try {
        const { id: groupId, userId } = req.params;

        // Authorisation: the logged-in user must be this group's owner/moderator.
        const [roleRows] = await db.query(
            `SELECT member_role FROM group_members
             WHERE group_id = ? AND user_id = ? AND join_status = 'accepted'
               AND member_role IN ('owner', 'moderator')`,
            [groupId, req.session.userId]);
        if (roleRows.length === 0) return res.status(403).send('Only the group owner can manage requests');

        // Capacity check before approving.
        const [[{ count }]] = await db.query(
            `SELECT COUNT(*) AS count FROM group_members
             WHERE group_id = ? AND join_status = 'accepted'`, [groupId]);
        const [[group]] = await db.query(
            'SELECT maximum_members FROM `groups` WHERE group_id = ?', [groupId]);
        if (count >= group.maximum_members) return res.status(400).send('Group is full');

        // UPDATE the pending row to accepted (the "U" in CRUD).
        await db.query(
            `UPDATE group_members SET join_status = 'accepted', joined_at = NOW()
             WHERE group_id = ? AND user_id = ? AND join_status = 'pending'`,
            [groupId, userId]);

        res.redirect(`/groups/${groupId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error accepting request');
    }
});

// ==================================================================
// UPDATE membership: POST /groups/:id/requests/:userId/reject
// Same authorisation as accept, but marks the request 'rejected'.
// ==================================================================
router.post('/groups/:id/requests/:userId/reject', requireLogin, async (req, res) => {
    try {
        const { id: groupId, userId } = req.params;

        const [roleRows] = await db.query(
            `SELECT member_role FROM group_members
             WHERE group_id = ? AND user_id = ? AND join_status = 'accepted'
               AND member_role IN ('owner', 'moderator')`,
            [groupId, req.session.userId]);
        if (roleRows.length === 0) return res.status(403).send('Only the group owner can manage requests');

        await db.query(
            `UPDATE group_members SET join_status = 'rejected'
             WHERE group_id = ? AND user_id = ? AND join_status = 'pending'`,
            [groupId, userId]);

        res.redirect(`/groups/${groupId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error rejecting request');
    }
});

// ==================================================================
// DELETE membership: POST /groups/:id/leave
// The owner cannot leave (they must delete the group instead).
// ==================================================================
router.post('/groups/:id/leave', requireLogin, async (req, res) => {
    try {
        await db.query(
            `DELETE FROM group_members
             WHERE group_id = ? AND user_id = ? AND member_role != 'owner'`,
            [req.params.id, req.session.userId]);
        res.redirect('/groups');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error leaving group');
    }
});

// ==================================================================
// CREATE post: POST /groups/:id/posts
// Only accepted members may post on the group's discussion board.
// ==================================================================
router.post('/groups/:id/posts', requireLogin, async (req, res) => {
    try {
        const groupId = req.params.id;

        // Authorisation: must be an accepted member of this group.
        const [memberRows] = await db.query(
            `SELECT group_member_id FROM group_members
             WHERE group_id = ? AND user_id = ? AND join_status = 'accepted'`,
            [groupId, req.session.userId]);
        if (memberRows.length === 0) return res.status(403).send('Join the group before posting');

        if (req.body.content && req.body.content.trim()) {
            await db.query(
                'INSERT INTO group_posts (group_id, user_id, content) VALUES (?, ?, ?)',
                [groupId, req.session.userId, req.body.content.trim()]);
        }
        res.redirect(`/groups/${groupId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating post');
    }
});

// ==================================================================
// CREATE reply: POST /group-posts/:postId/replies
// Looks up which group the post belongs to, checks membership, inserts.
// ==================================================================
router.post('/group-posts/:postId/replies', requireLogin, async (req, res) => {
    try {
        // Find the parent post so we know which group to check membership in.
        const [postRows] = await db.query(
            'SELECT group_id FROM group_posts WHERE group_post_id = ?', [req.params.postId]);
        if (postRows.length === 0) return res.status(404).send('Post not found');
        const groupId = postRows[0].group_id;

        const [memberRows] = await db.query(
            `SELECT group_member_id FROM group_members
             WHERE group_id = ? AND user_id = ? AND join_status = 'accepted'`,
            [groupId, req.session.userId]);
        if (memberRows.length === 0) return res.status(403).send('Join the group before replying');

        if (req.body.content && req.body.content.trim()) {
            await db.query(
                'INSERT INTO group_replies (group_post_id, user_id, content) VALUES (?, ?, ?)',
                [req.params.postId, req.session.userId, req.body.content.trim()]);
        }
        res.redirect(`/groups/${groupId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating reply');
    }
});

// ==================================================================
// UPDATE group (form): GET /groups/:id/edit - owner-only edit form.
// ==================================================================
router.get('/groups/:id/edit', requireLogin, async (req, res) => {
    try {
        const [groupRows] = await db.query(
            'SELECT * FROM `groups` WHERE group_id = ?', [req.params.id]);
        if (groupRows.length === 0) return res.status(404).send('Group not found');
        const group = groupRows[0];

        // Authorisation: only the creator may edit the group's details.
        if (group.creator_id !== req.session.userId) {
            return res.status(403).send('Only the group owner can edit this group');
        }
        res.render('editGroup', { group, groupTypes: GROUP_TYPES });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading edit form');
    }
});

// ==================================================================
// UPDATE group: POST /groups/:id/edit - the "U" in CRUD for groups.
// ==================================================================
router.post('/groups/:id/edit', requireLogin, async (req, res) => {
    try {
        const groupId = req.params.id;
        const { group_name, description, group_type, diploma, class_code,
                module_code, year_of_study, semester, privacy, maximum_members } = req.body;

        // UPDATE only runs when the WHERE clause matches the owner's id,
        // so nobody can edit a group they did not create.
        await db.query(
            `UPDATE \`groups\` SET
                group_name = ?, description = ?, group_type = ?, diploma = ?,
                class_code = ?, module_code = ?, year_of_study = ?, semester = ?,
                privacy = ?, maximum_members = ?
             WHERE group_id = ? AND creator_id = ?`,
            [group_name, description, group_type,
             diploma || null, class_code || null, module_code || null,
             year_of_study || null, semester || null,
             privacy, Number(maximum_members) || 50,
             groupId, req.session.userId]);

        res.redirect(`/groups/${groupId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating group');
    }
});

// ==================================================================
// DELETE group: POST /groups/:id/delete - the "D" in CRUD.
// ON DELETE CASCADE in the schema removes members, posts and replies.
// ==================================================================
router.post('/groups/:id/delete', requireLogin, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM `groups` WHERE group_id = ? AND creator_id = ?',
            [req.params.id, req.session.userId]);
        res.redirect('/groups');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error deleting group');
    }
});

module.exports = router;
