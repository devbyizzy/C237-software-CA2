const pool = require('../utils/db');
const database = pool.promise();

// This controller only ever touches group_type = 'interest'.
// It reuses the existing student_groups table (already created on the
// shared team database) instead of a new table, so there's no schema
// migration needed — just a fixed filter on group_type.

function toId(value) {
  const id = parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cleanText(value, maxLength) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  return maxLength ? text.slice(0, maxLength) : text;
}

exports.getInterestGroups = async (req, res) => {
  try {
    const search = cleanText(req.query.search).toLowerCase();
    const sort = cleanText(req.query.sort).toLowerCase();

    let sql = `SELECT g.group_id, g.group_name, g.description, g.creator_id,
                      g.created_at, u.name AS creator_name
               FROM student_groups g
               JOIN users u ON u.user_id = g.creator_id
               WHERE g.group_type = 'interest'`;
    const params = [];

    if (search) {
      sql += ' AND (g.group_name LIKE ? OR g.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (sort === 'oldest') {
      sql += ' ORDER BY g.created_at ASC';
    } else if (sort === 'name') {
      sql += ' ORDER BY g.group_name ASC';
    } else {
      sql += ' ORDER BY g.created_at DESC';
    }

    const [rows] = await database.query(sql, params);
    res.json({ count: rows.length, results: rows });
  } catch (err) {
    console.error('Failed to fetch interest groups:', err);
    res.status(500).json({ error: 'Failed to fetch interest groups' });
  }
};

exports.createInterestGroup = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = toId(body.user_id);
    const groupName = cleanText(body.group_name, 150);
    const description = cleanText(body.description);

    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });
    if (!groupName) return res.status(400).json({ error: 'group_name is required' });

    const [insertResult] = await database.query(
      `INSERT INTO student_groups (creator_id, group_name, description, group_type, privacy)
       VALUES (?, ?, ?, 'interest', 'public')`,
      [userId, groupName, description]
    );

    res.status(201).json({ group_id: insertResult.insertId });
  } catch (err) {
    if (err && (err.code === 'ER_NO_REFERENCED_ROW' || err.code === 'ER_NO_REFERENCED_ROW_2')) {
      return res.status(400).json({ error: 'The given user_id does not exist' });
    }
    console.error('Failed to create interest group:', err);
    res.status(500).json({ error: 'Failed to create interest group' });
  }
};

exports.updateInterestGroup = async (req, res) => {
  try {
    const groupId = toId(req.params.id);
    const body = req.body || {};
    const userId = toId(body.user_id);
    const groupName = cleanText(body.group_name, 150);
    const description = cleanText(body.description);

    if (!groupId) return res.status(400).json({ error: 'Invalid group id' });
    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });
    if (!groupName) return res.status(400).json({ error: 'group_name is required' });

    const [rows] = await database.query(
      "SELECT creator_id FROM student_groups WHERE group_id = ? AND group_type = 'interest'",
      [groupId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Interest group not found' });
    if (rows[0].creator_id !== userId) {
      return res.status(403).json({ error: 'Only the creator can edit this group' });
    }

    await database.query(
      'UPDATE student_groups SET group_name = ?, description = ? WHERE group_id = ?',
      [groupName, description, groupId]
    );

    res.json({ message: 'Group updated' });
  } catch (err) {
    console.error('Failed to update interest group:', err);
    res.status(500).json({ error: 'Failed to update interest group' });
  }
};

exports.deleteInterestGroup = async (req, res) => {
  try {
    const groupId = toId(req.params.id);
    const userId = toId((req.body || {}).user_id);

    if (!groupId) return res.status(400).json({ error: 'Invalid group id' });
    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });

    const [rows] = await database.query(
      "SELECT creator_id FROM student_groups WHERE group_id = ? AND group_type = 'interest'",
      [groupId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Interest group not found' });
    if (rows[0].creator_id !== userId) {
      return res.status(403).json({ error: 'Only the creator can delete this group' });
    }

    await database.query('DELETE FROM student_groups WHERE group_id = ?', [groupId]);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    console.error('Failed to delete interest group:', err);
    res.status(500).json({ error: 'Failed to delete interest group' });
  }
};
