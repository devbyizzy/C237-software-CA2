const pool = require('../utils/db');

const database = pool.promise();

const GROUP_TYPES = ['class', 'study', 'cca', 'interest', 'friend'];

const GROUP_TYPE_LABELS = {
  class: 'Class Group',
  study: 'Study Group',
  cca: 'CCA Group',
  interest: 'Interest Group',
  friend: 'Friend Group'
};

const MEMBER_COUNT_SQL =
  "(SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.group_id AND gm.join_status = 'accepted')";

function toId(value) {
  const id = parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function toOptionalInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = parseInt(value, 10);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function cleanText(value, maxLength) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  return maxLength ? text.slice(0, maxLength) : text;
}

function rowToGroup(row) {
  return {
    group_id: row.group_id,
    group_name: row.group_name,
    description: row.description,
    group_type: row.group_type,
    group_type_label: GROUP_TYPE_LABELS[row.group_type] || row.group_type,
    diploma: row.diploma,
    class_code: row.class_code,
    module_code: row.module_code,
    year_of_study: row.year_of_study,
    semester: row.semester,
    privacy: row.privacy,
    max_members: row.max_members,
    creator_id: row.creator_id,
    creator_name: row.creator_name || null,
    member_count: Number(row.member_count) || 0,
    pending_count: row.pending_count === undefined ? undefined : Number(row.pending_count) || 0,
    viewer_status: row.viewer_status || null,
    viewer_role: row.viewer_role || null,
    created_at: row.created_at
  };
}

async function getGroupRow(groupId) {
  const [rows] = await database.query(
    `SELECT g.*, u.name AS creator_name, ${MEMBER_COUNT_SQL} AS member_count
     FROM student_groups g
     JOIN users u ON u.user_id = g.creator_id
     WHERE g.group_id = ?`,
    [groupId]
  );
  return rows.length ? rows[0] : null;
}

async function getMembership(groupId, userId) {
  const [rows] = await database.query(
    'SELECT group_member_id, member_role, join_status FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );
  return rows.length ? rows[0] : null;
}

function canManage(membership) {
  return Boolean(
    membership &&
    membership.join_status === 'accepted' &&
    (membership.member_role === 'owner' || membership.member_role === 'moderator')
  );
}

/*
|--------------------------------------------------------------------------
| Browse / search / filter groups
| GET /api/groups?search=&type=&diploma=&class_code=&sort=&mine=&user_id=
|--------------------------------------------------------------------------
*/

exports.getAllGroups = async (req, res) => {
  try {
    const search = cleanText(req.query.search).toLowerCase();
    const type = cleanText(req.query.type).toLowerCase();
    const diploma = cleanText(req.query.diploma);
    const classCode = cleanText(req.query.class_code);
    const sort = cleanText(req.query.sort).toLowerCase();
    const mine = req.query.mine === '1' || req.query.mine === 'true';
    const userId = toId(req.query.user_id);

    const params = [];

    let viewerJoin = '';
    let viewerColumns = 'NULL AS viewer_status, NULL AS viewer_role,';

    if (userId) {
      viewerJoin = 'LEFT JOIN group_members vm ON vm.group_id = g.group_id AND vm.user_id = ?';
      viewerColumns = 'vm.join_status AS viewer_status, vm.member_role AS viewer_role,';
      params.push(userId);
    }

    let sql = `SELECT g.*, u.name AS creator_name, ${viewerColumns} ${MEMBER_COUNT_SQL} AS member_count
      FROM student_groups g
      JOIN users u ON u.user_id = g.creator_id
      ${viewerJoin}
      WHERE 1 = 1`;

    if (mine && userId) {
      sql += " AND vm.join_status = 'accepted'";
    }

    if (type && GROUP_TYPES.includes(type)) {
      sql += ' AND g.group_type = ?';
      params.push(type);
    }

    if (diploma) {
      sql += ' AND g.diploma LIKE ?';
      params.push(`%${diploma}%`);
    }

    if (classCode) {
      sql += ' AND g.class_code LIKE ?';
      params.push(`%${classCode}%`);
    }

    if (search) {
      sql += ' AND (g.group_name LIKE ? OR g.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (sort === 'oldest') {
      sql += ' ORDER BY g.created_at ASC';
    } else if (sort === 'popular') {
      sql += ' ORDER BY member_count DESC, g.created_at DESC';
    } else if (sort === 'name') {
      sql += ' ORDER BY g.group_name ASC';
    } else {
      sql += ' ORDER BY g.created_at DESC';
    }

    const [rows] = await database.query(sql, params);
    res.json({ count: rows.length, results: rows.map(rowToGroup) });
  } catch (err) {
    console.error('Failed to fetch groups:', err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
};

/*
|--------------------------------------------------------------------------
| Dashboard data: popular / recommended / recent / joined
| GET /api/groups/dashboard?user_id=
|--------------------------------------------------------------------------
*/

exports.getDashboardGroups = async (req, res) => {
  try {
    const userId = toId(req.query.user_id);

    const baseSelect = `SELECT g.*, u.name AS creator_name, ${MEMBER_COUNT_SQL} AS member_count
      FROM student_groups g
      JOIN users u ON u.user_id = g.creator_id`;

    const [popularRows] = await database.query(
      `${baseSelect} ORDER BY member_count DESC, g.created_at DESC LIMIT 4`
    );

    const [recentRows] = await database.query(
      `${baseSelect} ORDER BY g.created_at DESC LIMIT 4`
    );

    let joinedRows = [];
    let recommendedRows = [];

    if (userId) {
      [joinedRows] = await database.query(
        `SELECT g.*, u.name AS creator_name, vm.member_role AS viewer_role, vm.join_status AS viewer_status,
                ${MEMBER_COUNT_SQL} AS member_count
         FROM group_members vm
         JOIN student_groups g ON g.group_id = vm.group_id
         JOIN users u ON u.user_id = g.creator_id
         WHERE vm.user_id = ? AND vm.join_status = 'accepted'
         ORDER BY vm.joined_at DESC`,
        [userId]
      );

      const [profileRows] = await database.query(
        'SELECT diploma, class_code, interests FROM profiles WHERE user_id = ?',
        [userId]
      );
      const profile = profileRows.length ? profileRows[0] : {};

      const interestTerms = cleanText(profile.interests)
        .split(',')
        .map((term) => term.trim())
        .filter(Boolean)
        .slice(0, 5);

      const scoreParts = [
        '(g.class_code IS NOT NULL AND g.class_code = ?)',
        '(g.diploma IS NOT NULL AND g.diploma = ?)'
      ];
      const scoreParams = [profile.class_code || '', profile.diploma || ''];

      interestTerms.forEach((term) => {
        scoreParts.push('(g.group_name LIKE ? OR g.description LIKE ?)');
        scoreParams.push(`%${term}%`, `%${term}%`);
      });

      [recommendedRows] = await database.query(
        `SELECT g.*, u.name AS creator_name, ${MEMBER_COUNT_SQL} AS member_count,
                (${scoreParts.join(' + ')}) AS match_score
         FROM student_groups g
         JOIN users u ON u.user_id = g.creator_id
         WHERE g.group_id NOT IN (
           SELECT gm2.group_id FROM group_members gm2
           WHERE gm2.user_id = ? AND gm2.join_status IN ('pending', 'accepted')
         )
         ORDER BY match_score DESC, member_count DESC, g.created_at DESC
         LIMIT 4`,
        [...scoreParams, userId]
      );
    } else {
      recommendedRows = popularRows;
    }

    res.json({
      popularGroups: popularRows.map(rowToGroup),
      recommendedGroups: recommendedRows.map(rowToGroup),
      recentGroups: recentRows.map(rowToGroup),
      joinedGroups: joinedRows.map(rowToGroup)
    });
  } catch (err) {
    console.error('Failed to fetch dashboard groups:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard groups' });
  }
};

/*
|--------------------------------------------------------------------------
| Group details
| GET /api/groups/:id?user_id=
|--------------------------------------------------------------------------
*/

exports.getGroupById = async (req, res) => {
  try {
    const groupId = toId(req.params.id);
    if (!groupId) return res.status(400).json({ error: 'Invalid group id' });

    const row = await getGroupRow(groupId);
    if (!row) return res.status(404).json({ error: 'Group not found' });

    const userId = toId(req.query.user_id);

    if (userId) {
      const membership = await getMembership(groupId, userId);
      if (membership) {
        row.viewer_status = membership.join_status;
        row.viewer_role = membership.member_role;
      }

      if (canManage(membership)) {
        const [pendingRows] = await database.query(
          "SELECT COUNT(*) AS pending_count FROM group_members WHERE group_id = ? AND join_status = 'pending'",
          [groupId]
        );
        row.pending_count = pendingRows[0].pending_count;
      }
    }

    res.json(rowToGroup(row));
  } catch (err) {
    console.error('Failed to fetch group:', err);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
};

/*
|--------------------------------------------------------------------------
| View group members
| GET /api/groups/:id/members
|--------------------------------------------------------------------------
*/

exports.getGroupMembers = async (req, res) => {
  try {
    const groupId = toId(req.params.id);
    if (!groupId) return res.status(400).json({ error: 'Invalid group id' });

    const row = await getGroupRow(groupId);
    if (!row) return res.status(404).json({ error: 'Group not found' });

    const [members] = await database.query(
      `SELECT m.user_id, m.member_role, m.joined_at,
              u.name, u.username,
              p.display_name, p.diploma, p.class_code, p.profile_picture
       FROM group_members m
       JOIN users u ON u.user_id = m.user_id
       LEFT JOIN profiles p ON p.user_id = m.user_id
       WHERE m.group_id = ? AND m.join_status = 'accepted'
       ORDER BY FIELD(m.member_role, 'owner', 'moderator', 'member'), m.joined_at ASC`,
      [groupId]
    );

    res.json({ count: members.length, results: members });
  } catch (err) {
    console.error('Failed to fetch group members:', err);
    res.status(500).json({ error: 'Failed to fetch group members' });
  }
};

/*
|--------------------------------------------------------------------------
| Group posts with replies
| GET /api/groups/:id/posts?user_id=
| Private groups only show posts to accepted members.
|--------------------------------------------------------------------------
*/

exports.getGroupPosts = async (req, res) => {
  try {
    const groupId = toId(req.params.id);
    if (!groupId) return res.status(400).json({ error: 'Invalid group id' });

    const group = await getGroupRow(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (group.privacy === 'private') {
      const userId = toId(req.query.user_id);
      const membership = userId ? await getMembership(groupId, userId) : null;
      if (!membership || membership.join_status !== 'accepted') {
        return res.status(403).json({ error: 'Only members can view posts in a private group' });
      }
    }

    const [posts] = await database.query(
      `SELECT p.group_post_id, p.group_id, p.user_id, p.content, p.created_at,
              u.name, u.username, pr.display_name
       FROM group_posts p
       JOIN users u ON u.user_id = p.user_id
       LEFT JOIN profiles pr ON pr.user_id = p.user_id
       WHERE p.group_id = ?
       ORDER BY p.created_at DESC, p.group_post_id DESC`,
      [groupId]
    );

    const [replies] = await database.query(
      `SELECT r.group_reply_id, r.group_post_id, r.user_id, r.content, r.created_at,
              u.name, u.username, pr.display_name
       FROM group_replies r
       JOIN group_posts p ON p.group_post_id = r.group_post_id
       JOIN users u ON u.user_id = r.user_id
       LEFT JOIN profiles pr ON pr.user_id = r.user_id
       WHERE p.group_id = ?
       ORDER BY r.created_at ASC, r.group_reply_id ASC`,
      [groupId]
    );

    const repliesByPost = {};
    replies.forEach((reply) => {
      if (!repliesByPost[reply.group_post_id]) repliesByPost[reply.group_post_id] = [];
      repliesByPost[reply.group_post_id].push(reply);
    });

    const results = posts.map((post) => ({
      ...post,
      replies: repliesByPost[post.group_post_id] || []
    }));

    res.json({ count: results.length, results });
  } catch (err) {
    console.error('Failed to fetch group posts:', err);
    res.status(500).json({ error: 'Failed to fetch group posts' });
  }
};

/*
|--------------------------------------------------------------------------
| Pending join requests (owner / moderator only)
| GET /api/groups/:id/requests?user_id=
|--------------------------------------------------------------------------
*/

exports.getJoinRequests = async (req, res) => {
  try {
    const groupId = toId(req.params.id);
    const userId = toId(req.query.user_id);
    if (!groupId) return res.status(400).json({ error: 'Invalid group id' });
    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });

    const group = await getGroupRow(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const membership = await getMembership(groupId, userId);
    if (!canManage(membership)) {
      return res.status(403).json({ error: 'Only the group owner or moderators can view join requests' });
    }

    const [requests] = await database.query(
      `SELECT m.user_id, m.joined_at AS requested_at,
              u.name, u.username,
              p.display_name, p.diploma, p.class_code, p.year_of_study, p.bio, p.profile_picture
       FROM group_members m
       JOIN users u ON u.user_id = m.user_id
       LEFT JOIN profiles p ON p.user_id = m.user_id
       WHERE m.group_id = ? AND m.join_status = 'pending'
       ORDER BY m.joined_at ASC`,
      [groupId]
    );

    res.json({ group: rowToGroup(group), count: requests.length, results: requests });
  } catch (err) {
    console.error('Failed to fetch join requests:', err);
    res.status(500).json({ error: 'Failed to fetch join requests' });
  }
};

/*
|--------------------------------------------------------------------------
| Create a group (creator becomes the accepted owner)
| POST /api/groups
|--------------------------------------------------------------------------
*/

exports.createGroup = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = toId(body.user_id);
    const groupName = cleanText(body.group_name, 150);
    const groupType = cleanText(body.group_type).toLowerCase();
    const privacy = cleanText(body.privacy).toLowerCase() === 'private' ? 'private' : 'public';

    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });
    if (!groupName) return res.status(400).json({ error: 'group_name is required' });
    if (!GROUP_TYPES.includes(groupType)) {
      return res.status(400).json({ error: `group_type must be one of: ${GROUP_TYPES.join(', ')}` });
    }

    const maxMembers = toOptionalInt(body.max_members);
    if (maxMembers !== null && maxMembers < 2) {
      return res.status(400).json({ error: 'max_members must be at least 2' });
    }

    const [insertResult] = await database.query(
      `INSERT INTO student_groups
         (creator_id, group_name, description, group_type, diploma, class_code, module_code,
          year_of_study, semester, privacy, max_members)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        groupName,
        cleanText(body.description),
        groupType,
        cleanText(body.diploma, 150) || null,
        cleanText(body.class_code, 30) || null,
        cleanText(body.module_code, 20) || null,
        toOptionalInt(body.year_of_study),
        toOptionalInt(body.semester),
        privacy,
        maxMembers
      ]
    );

    await database.query(
      "INSERT INTO group_members (group_id, user_id, member_role, join_status) VALUES (?, ?, 'owner', 'accepted')",
      [insertResult.insertId, userId]
    );

    const row = await getGroupRow(insertResult.insertId);
    res.status(201).json(rowToGroup(row));
  } catch (err) {
    if (err && (err.code === 'ER_NO_REFERENCED_ROW' || err.code === 'ER_NO_REFERENCED_ROW_2')) {
      return res.status(400).json({ error: 'The given user_id does not exist' });
    }
    console.error('Failed to create group:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
};

/*
|--------------------------------------------------------------------------
| Update a group (owner only)
| POST /api/groups/:id/edit
|--------------------------------------------------------------------------
*/

exports.updateGroup = async (req, res) => {
  try {
    const groupId = toId(req.params.id);
    const body = req.body || {};
    const userId = toId(body.user_id);
    if (!groupId) return res.status(400).json({ error: 'Invalid group id' });
    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });

    const group = await getGroupRow(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.creator_id !== userId) {
      return res.status(403).json({ error: 'Only the group owner can edit this group' });
    }

    const updates = [];
    const values = [];

    if (body.group_name !== undefined) {
      const groupName = cleanText(body.group_name, 150);
      if (!groupName) return res.status(400).json({ error: 'group_name cannot be empty' });
      updates.push('group_name = ?');
      values.push(groupName);
    }

    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(cleanText(body.description));
    }

    if (body.group_type !== undefined) {
      const groupType = cleanText(body.group_type).toLowerCase();
      if (!GROUP_TYPES.includes(groupType)) {
        return res.status(400).json({ error: `group_type must be one of: ${GROUP_TYPES.join(', ')}` });
      }
      updates.push('group_type = ?');
      values.push(groupType);
    }

    if (body.diploma !== undefined) {
      updates.push('diploma = ?');
      values.push(cleanText(body.diploma, 150) || null);
    }

    if (body.class_code !== undefined) {
      updates.push('class_code = ?');
      values.push(cleanText(body.class_code, 30) || null);
    }

    if (body.module_code !== undefined) {
      updates.push('module_code = ?');
      values.push(cleanText(body.module_code, 20) || null);
    }

    if (body.year_of_study !== undefined) {
      updates.push('year_of_study = ?');
      values.push(toOptionalInt(body.year_of_study));
    }

    if (body.semester !== undefined) {
      updates.push('semester = ?');
      values.push(toOptionalInt(body.semester));
    }

    if (body.privacy !== undefined) {
      updates.push('privacy = ?');
      values.push(cleanText(body.privacy).toLowerCase() === 'private' ? 'private' : 'public');
    }

    if (body.max_members !== undefined) {
      const maxMembers = toOptionalInt(body.max_members);
      if (maxMembers !== null && maxMembers < 2) {
        return res.status(400).json({ error: 'max_members must be at least 2' });
      }
      updates.push('max_members = ?');
      values.push(maxMembers);
    }

    if (updates.length) {
      values.push(groupId);
      await database.query(`UPDATE student_groups SET ${updates.join(', ')} WHERE group_id = ?`, values);
    }

    const row = await getGroupRow(groupId);
    res.json(rowToGroup(row));
  } catch (err) {
    console.error('Failed to update group:', err);
    res.status(500).json({ error: 'Failed to update group' });
  }
};

/*
|--------------------------------------------------------------------------
| Delete a group (owner only)
| POST /api/groups/:id/delete
|--------------------------------------------------------------------------
*/

exports.deleteGroup = async (req, res) => {
  try {
    const groupId = toId(req.params.id);
    const userId = toId((req.body || {}).user_id);
    if (!groupId) return res.status(400).json({ error: 'Invalid group id' });
    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });

    const group = await getGroupRow(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.creator_id !== userId) {
      return res.status(403).json({ error: 'Only the group owner can delete this group' });
    }

    await database.query('DELETE FROM student_groups WHERE group_id = ?', [groupId]);
    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    console.error('Failed to delete group:', err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
};

/*
|--------------------------------------------------------------------------
| Join a group
| POST /api/groups/:id/join
| Public groups accept immediately; private groups create a pending request.
|--------------------------------------------------------------------------
*/

exports.joinGroup = async (req, res) => {
  try {
    const groupId = toId(req.params.id);
    const userId = toId((req.body || {}).user_id);
    if (!groupId) return res.status(400).json({ error: 'Invalid group id' });
    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });

    const group = await getGroupRow(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const newStatus = group.privacy === 'private' ? 'pending' : 'accepted';

    if (newStatus === 'accepted' && group.max_members && Number(group.member_count) >= group.max_members) {
      return res.status(409).json({ error: 'This group is already full' });
    }

    const membership = await getMembership(groupId, userId);

    if (membership) {
      if (membership.join_status === 'accepted') {
        return res.status(409).json({ error: 'You are already a member of this group' });
      }
      if (membership.join_status === 'pending') {
        return res.status(409).json({ error: 'Your join request is still pending' });
      }
      // Previously rejected: allow the student to try again.
      await database.query(
        "UPDATE group_members SET join_status = ?, member_role = 'member', joined_at = CURRENT_TIMESTAMP WHERE group_member_id = ?",
        [newStatus, membership.group_member_id]
      );
    } else {
      await database.query(
        "INSERT INTO group_members (group_id, user_id, member_role, join_status) VALUES (?, ?, 'member', ?)",
        [groupId, userId, newStatus]
      );
    }

    res.status(201).json({
      status: newStatus,
      message:
        newStatus === 'accepted'
          ? 'You have joined the group'
          : 'Your request to join has been sent to the group owner'
    });
  } catch (err) {
    if (err && (err.code === 'ER_NO_REFERENCED_ROW' || err.code === 'ER_NO_REFERENCED_ROW_2')) {
      return res.status(400).json({ error: 'The given user_id does not exist' });
    }
    console.error('Failed to join group:', err);
    res.status(500).json({ error: 'Failed to join group' });
  }
};

/*
|--------------------------------------------------------------------------
| Leave a group (also cancels a pending request)
| POST /api/groups/:id/leave
|--------------------------------------------------------------------------
*/

exports.leaveGroup = async (req, res) => {
  try {
    const groupId = toId(req.params.id);
    const userId = toId((req.body || {}).user_id);
    if (!groupId) return res.status(400).json({ error: 'Invalid group id' });
    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });

    const group = await getGroupRow(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const membership = await getMembership(groupId, userId);
    if (!membership || membership.join_status === 'rejected') {
      return res.status(404).json({ error: 'You are not a member of this group' });
    }

    if (membership.member_role === 'owner') {
      return res.status(409).json({ error: 'The owner cannot leave the group. Delete the group instead.' });
    }

    await database.query('DELETE FROM group_members WHERE group_member_id = ?', [membership.group_member_id]);

    res.json({
      message:
        membership.join_status === 'pending'
          ? 'Your join request has been cancelled'
          : 'You have left the group'
    });
  } catch (err) {
    console.error('Failed to leave group:', err);
    res.status(500).json({ error: 'Failed to leave group' });
  }
};

/*
|--------------------------------------------------------------------------
| Accept / reject a join request (owner or moderator only)
| POST /api/groups/:id/requests/:userId/accept
| POST /api/groups/:id/requests/:userId/reject
|--------------------------------------------------------------------------
*/

async function resolveRequest(req, res, decision) {
  const groupId = toId(req.params.id);
  const targetUserId = toId(req.params.userId);
  const actingUserId = toId((req.body || {}).user_id);
  if (!groupId) return res.status(400).json({ error: 'Invalid group id' });
  if (!targetUserId) return res.status(400).json({ error: 'Invalid request user id' });
  if (!actingUserId) return res.status(400).json({ error: 'Valid user_id is required' });

  const group = await getGroupRow(groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const actingMembership = await getMembership(groupId, actingUserId);
  if (!canManage(actingMembership)) {
    return res.status(403).json({ error: 'Only the group owner or moderators can manage join requests' });
  }

  const targetMembership = await getMembership(groupId, targetUserId);
  if (!targetMembership || targetMembership.join_status !== 'pending') {
    return res.status(404).json({ error: 'No pending join request found for this user' });
  }

  if (decision === 'accepted' && group.max_members && Number(group.member_count) >= group.max_members) {
    return res.status(409).json({ error: 'This group is already full' });
  }

  await database.query(
    'UPDATE group_members SET join_status = ? WHERE group_member_id = ?',
    [decision, targetMembership.group_member_id]
  );

  res.json({
    status: decision,
    message: decision === 'accepted' ? 'Join request accepted' : 'Join request rejected'
  });
}

exports.acceptRequest = async (req, res) => {
  try {
    await resolveRequest(req, res, 'accepted');
  } catch (err) {
    console.error('Failed to accept join request:', err);
    res.status(500).json({ error: 'Failed to accept join request' });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    await resolveRequest(req, res, 'rejected');
  } catch (err) {
    console.error('Failed to reject join request:', err);
    res.status(500).json({ error: 'Failed to reject join request' });
  }
};

/*
|--------------------------------------------------------------------------
| Create a post inside a group (accepted members only)
| POST /api/groups/:id/posts
|--------------------------------------------------------------------------
*/

exports.createPost = async (req, res) => {
  try {
    const groupId = toId(req.params.id);
    const body = req.body || {};
    const userId = toId(body.user_id);
    const content = cleanText(body.content);

    if (!groupId) return res.status(400).json({ error: 'Invalid group id' });
    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });
    if (!content) return res.status(400).json({ error: 'Post content cannot be empty' });

    const group = await getGroupRow(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const membership = await getMembership(groupId, userId);
    if (!membership || membership.join_status !== 'accepted') {
      return res.status(403).json({ error: 'Only members can post in this group' });
    }

    const [insertResult] = await database.query(
      'INSERT INTO group_posts (group_id, user_id, content) VALUES (?, ?, ?)',
      [groupId, userId, content]
    );

    const [rows] = await database.query(
      `SELECT p.group_post_id, p.group_id, p.user_id, p.content, p.created_at,
              u.name, u.username, pr.display_name
       FROM group_posts p
       JOIN users u ON u.user_id = p.user_id
       LEFT JOIN profiles pr ON pr.user_id = p.user_id
       WHERE p.group_post_id = ?`,
      [insertResult.insertId]
    );

    res.status(201).json({ ...rows[0], replies: [] });
  } catch (err) {
    console.error('Failed to create group post:', err);
    res.status(500).json({ error: 'Failed to create group post' });
  }
};

/*
|--------------------------------------------------------------------------
| Reply to a group post (accepted members only)
| POST /api/group-posts/:id/replies
|--------------------------------------------------------------------------
*/

exports.createReply = async (req, res) => {
  try {
    const postId = toId(req.params.id);
    const body = req.body || {};
    const userId = toId(body.user_id);
    const content = cleanText(body.content);

    if (!postId) return res.status(400).json({ error: 'Invalid post id' });
    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });
    if (!content) return res.status(400).json({ error: 'Reply content cannot be empty' });

    const [postRows] = await database.query(
      'SELECT group_post_id, group_id FROM group_posts WHERE group_post_id = ?',
      [postId]
    );
    if (!postRows.length) return res.status(404).json({ error: 'Post not found' });

    const membership = await getMembership(postRows[0].group_id, userId);
    if (!membership || membership.join_status !== 'accepted') {
      return res.status(403).json({ error: 'Only members can reply in this group' });
    }

    const [insertResult] = await database.query(
      'INSERT INTO group_replies (group_post_id, user_id, content) VALUES (?, ?, ?)',
      [postId, userId, content]
    );

    const [rows] = await database.query(
      `SELECT r.group_reply_id, r.group_post_id, r.user_id, r.content, r.created_at,
              u.name, u.username, pr.display_name
       FROM group_replies r
       JOIN users u ON u.user_id = r.user_id
       LEFT JOIN profiles pr ON pr.user_id = r.user_id
       WHERE r.group_reply_id = ?`,
      [insertResult.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Failed to create group reply:', err);
    res.status(500).json({ error: 'Failed to create group reply' });
  }
};
