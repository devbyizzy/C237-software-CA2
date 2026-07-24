const pool = require('../utils/db');
const database = pool.promise();

function toId(value) {
  const id = parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cleanText(value, maxLength) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  return maxLength ? text.slice(0, maxLength) : text;
}

/*
|--------------------------------------------------------------------------
| List posts (search + category + sort)
| GET /api/questions?search=&category=&sort=newest|oldest|title
|--------------------------------------------------------------------------
*/
exports.getQuestions = async (req, res) => {
  try {
    const search = cleanText(req.query.search).toLowerCase();
    const category = cleanText(req.query.category);
    const sort = cleanText(req.query.sort).toLowerCase();

    let sql = `SELECT q.question_id, q.title, q.content, q.category, q.status,
                      q.view_count, q.created_at, q.user_id, u.name AS author_name,
                      (SELECT COUNT(*) FROM question_replies r WHERE r.question_id = q.question_id) AS reply_count
               FROM questions q
               JOIN users u ON u.user_id = q.user_id
               WHERE 1 = 1`;
    const params = [];

    if (search) {
      sql += ' AND (q.title LIKE ? OR q.content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      sql += ' AND q.category = ?';
      params.push(category);
    }

    if (sort === 'oldest') {
      sql += ' ORDER BY q.created_at ASC';
    } else if (sort === 'title') {
      sql += ' ORDER BY q.title ASC';
    } else {
      sql += ' ORDER BY q.created_at DESC';
    }

    const [rows] = await database.query(sql, params);
    res.json({ count: rows.length, results: rows });
  } catch (err) {
    console.error('Failed to fetch posts:', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

/*
|--------------------------------------------------------------------------
| Get a single post with its replies (also bumps view_count)
| GET /api/questions/:id
|--------------------------------------------------------------------------
*/
exports.getQuestionById = async (req, res) => {
  try {
    const questionId = toId(req.params.id);
    if (!questionId) return res.status(400).json({ error: 'Invalid post id' });

    const [questionRows] = await database.query(
      `SELECT q.question_id, q.title, q.content, q.category, q.status,
              q.view_count, q.created_at, q.user_id, u.name AS author_name
       FROM questions q
       JOIN users u ON u.user_id = q.user_id
       WHERE q.question_id = ?`,
      [questionId]
    );
    if (!questionRows.length) return res.status(404).json({ error: 'Post not found' });

    await database.query('UPDATE questions SET view_count = view_count + 1 WHERE question_id = ?', [questionId]);

    const [replies] = await database.query(
      `SELECT r.reply_id, r.content, r.created_at, r.user_id, u.name AS author_name
       FROM question_replies r
       JOIN users u ON u.user_id = r.user_id
       WHERE r.question_id = ?
       ORDER BY r.created_at ASC`,
      [questionId]
    );

    res.json({ question: questionRows[0], replies });
  } catch (err) {
    console.error('Failed to fetch post:', err);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
};

/*
|--------------------------------------------------------------------------
| Create a post
| POST /api/questions   body: { user_id, title, content, category }
|--------------------------------------------------------------------------
*/
exports.createQuestion = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = toId(body.user_id);
    const title = cleanText(body.title, 200);
    const content = cleanText(body.content);
    const category = cleanText(body.category, 100) || null;

    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!content) return res.status(400).json({ error: 'content is required' });

    const [insertResult] = await database.query(
      `INSERT INTO questions (user_id, title, content, category, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [userId, title, content, category]
    );

    res.status(201).json({ question_id: insertResult.insertId });
  } catch (err) {
    if (err && (err.code === 'ER_NO_REFERENCED_ROW' || err.code === 'ER_NO_REFERENCED_ROW_2')) {
      return res.status(400).json({ error: 'The given user_id does not exist' });
    }
    console.error('Failed to create post:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
};

/*
|--------------------------------------------------------------------------
| Update a post (author only)
| POST /api/questions/:id/edit   body: { user_id, title, content, category, status }
|--------------------------------------------------------------------------
*/
exports.updateQuestion = async (req, res) => {
  try {
    const questionId = toId(req.params.id);
    const body = req.body || {};
    const userId = toId(body.user_id);
    const title = cleanText(body.title, 200);
    const content = cleanText(body.content);
    const category = cleanText(body.category, 100) || null;
    const status = cleanText(body.status) || 'open';

    if (!questionId) return res.status(400).json({ error: 'Invalid post id' });
    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!content) return res.status(400).json({ error: 'content is required' });

    const [rows] = await database.query('SELECT user_id FROM questions WHERE question_id = ?', [questionId]);
    if (!rows.length) return res.status(404).json({ error: 'Post not found' });
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Only the author can edit this post' });
    }

    await database.query(
      'UPDATE questions SET title = ?, content = ?, category = ?, status = ? WHERE question_id = ?',
      [title, content, category, status, questionId]
    );

    res.json({ message: 'Post updated' });
  } catch (err) {
    console.error('Failed to update post:', err);
    res.status(500).json({ error: 'Failed to update post' });
  }
};

/*
|--------------------------------------------------------------------------
| Delete a post (author only)
| POST /api/questions/:id/delete   body: { user_id }
|--------------------------------------------------------------------------
*/
exports.deleteQuestion = async (req, res) => {
  try {
    const questionId = toId(req.params.id);
    const userId = toId((req.body || {}).user_id);

    if (!questionId) return res.status(400).json({ error: 'Invalid post id' });
    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });

    const [rows] = await database.query('SELECT user_id FROM questions WHERE question_id = ?', [questionId]);
    if (!rows.length) return res.status(404).json({ error: 'Post not found' });
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Only the author can delete this post' });
    }

    await database.query('DELETE FROM questions WHERE question_id = ?', [questionId]);
    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Failed to delete post:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
};

/*
|--------------------------------------------------------------------------
| Add a reply to a post
| POST /api/questions/:id/replies   body: { user_id, content }
|--------------------------------------------------------------------------
*/
exports.createReply = async (req, res) => {
  try {
    const questionId = toId(req.params.id);
    const body = req.body || {};
    const userId = toId(body.user_id);
    const content = cleanText(body.content);

    if (!questionId) return res.status(400).json({ error: 'Invalid post id' });
    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });
    if (!content) return res.status(400).json({ error: 'content is required' });

    const [questionRows] = await database.query('SELECT question_id FROM questions WHERE question_id = ?', [questionId]);
    if (!questionRows.length) return res.status(404).json({ error: 'Post not found' });

    const [insertResult] = await database.query(
      'INSERT INTO question_replies (question_id, user_id, content) VALUES (?, ?, ?)',
      [questionId, userId, content]
    );

    res.status(201).json({ reply_id: insertResult.insertId });
  } catch (err) {
    console.error('Failed to create reply:', err);
    res.status(500).json({ error: 'Failed to create reply' });
  }
};

/*
|--------------------------------------------------------------------------
| Delete a reply (author only)
| POST /api/questions/:id/replies/:replyId/delete   body: { user_id }
|--------------------------------------------------------------------------
*/
exports.deleteReply = async (req, res) => {
  try {
    const replyId = toId(req.params.replyId);
    const userId = toId((req.body || {}).user_id);

    if (!replyId) return res.status(400).json({ error: 'Invalid reply id' });
    if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });

    const [rows] = await database.query('SELECT user_id FROM question_replies WHERE reply_id = ?', [replyId]);
    if (!rows.length) return res.status(404).json({ error: 'Reply not found' });
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Only the author can delete this reply' });
    }

    await database.query('DELETE FROM question_replies WHERE reply_id = ?', [replyId]);
    res.json({ message: 'Reply deleted' });
  } catch (err) {
    console.error('Failed to delete reply:', err);
    res.status(500).json({ error: 'Failed to delete reply' });
  }
};
