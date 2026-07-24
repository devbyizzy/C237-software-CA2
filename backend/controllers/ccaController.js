const pool = require('../utils/db');

function formatTime(val) {
  if (!val) return '';
  const trimmed = String(val).slice(0, 5);
  const [h, m] = trimmed.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')}${period}`;
}

function parse24HourTime(timeStr) {
  if (!timeStr) return null;
  const trimmed = timeStr.trim().toLowerCase().replace(/\s+/g, '');

  let match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const suffix = match[3];
    if (suffix === 'pm' && hours < 12) hours += 12;
    if (suffix === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}:00`;
  }

  match = trimmed.match(/^(\d{3,4})\s*(am|pm)?$/);
  if (match) {
    let hours = parseInt(match[1].slice(0, -2), 10);
    const minutes = match[1].slice(-2);
    const suffix = match[2];
    if (suffix === 'pm' && hours < 12) hours += 12;
    if (suffix === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}:00`;
  }

  match = trimmed.match(/^(\d{1,2})\s*(am|pm)?$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const suffix = match[2];
    if (suffix === 'pm' && hours < 12) hours += 12;
    if (suffix === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:00:00`;
  }

  return null;
}

function mapTrainingTime(start, end) {
  if (start) {
    return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
  }
  return null;
}

function rowToCca(row) {
  const mapped = {
    cca_id: row.cca_id,
    cca_name: row.cca_name,
    category: row.category,
    description: row.description,
    training_day: row.meeting_day,
    training_time: mapTrainingTime(row.meeting_start_time, row.meeting_end_time),
    location: row.location,
    contact_information: row.contact_email,
    image: row.image_url,
    created_at: row.created_at,
    member_count: typeof row.member_count === 'number' ? row.member_count : (typeof row.member_count === 'string' ? parseInt(row.member_count, 10) || 0 : 0)
  };
  return mapped;
}

exports.getAllCcas = (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim();

  const replacements = [];
  let sql = 'SELECT * FROM ccas WHERE status = "active"';

  if (category) {
    sql += ' AND category = ?';
    replacements.push(category);
  }

  if (search) {
    sql += ' AND (cca_name LIKE ? OR description LIKE ?)';
    const pattern = `%${search}%`;
    replacements.push(pattern, pattern);
  }

  pool.query(sql + ' ORDER BY member_count DESC, created_at DESC', replacements, (err, rows) => {
    if (err) {
      console.error('Failed to fetch CCAs:', err);
      return res.status(500).json({ error: 'Failed to fetch CCAs' });
    }
    res.json({ count: rows.length, results: rows.map(rowToCca) });
  });
};

exports.getCcaById = (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid CCA id' });
  }

  pool.query('SELECT * FROM ccas WHERE cca_id = ? AND status = "active"', [id], (err, rows) => {
    if (err) {
      console.error('Failed to fetch CCA:', err);
      return res.status(500).json({ error: 'Failed to fetch CCA' });
    }
    if (!rows.length) {
      return res.status(404).json({ error: 'CCA not found' });
    }
    res.json(rowToCca(rows[0]));
  });
};

exports.createCca = (req, res) => {
  const body = req.body || {};
  const cca_name = String(body.cca_name || '').trim();
  const category = String(body.category || '').trim();

  if (!cca_name) return res.status(400).json({ error: 'cca_name is required' });
  if (!category) return res.status(400).json({ error: 'category is required' });

  let meeting_start_time = null;
  let meeting_end_time = null;

  if (body.training_time) {
    const parts = String(body.training_time).split(/–|-/).map(s => s.trim());
    meeting_start_time = parse24HourTime(parts[0] || '');
    meeting_end_time = parse24HourTime(parts[1] || '');

    if (parts[0] && !meeting_start_time) {
      return res.status(400).json({ error: `Invalid start time format: "${parts[0]}". Accepted formats: 14:00, 2:00pm, 1400, or 2pm.` });
    }
    if (parts[1] && !meeting_end_time) {
      return res.status(400).json({ error: `Invalid end time format: "${parts[1]}". Accepted formats: 14:00, 2:00pm, 1400, or 2pm.` });
    }
  }

  pool.query(
    'INSERT INTO ccas (cca_name, category, description, meeting_day, meeting_start_time, meeting_end_time, location, contact_email, image_url, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      cca_name,
      category,
      String(body.description || '').trim(),
      String(body.training_day || '').trim() || null,
      meeting_start_time,
      meeting_end_time,
      String(body.location || '').trim() || null,
      String(body.contact_information || '').trim() || null,
      String(body.image || '').trim() || null,
      null,
      'active'
    ],
    function (err, result) {
      if (err) {
        console.error('Failed to create CCA:', err);
        return res.status(500).json({ error: 'Failed to create CCA' });
      }
      pool.query('SELECT * FROM ccas WHERE cca_id = ?', [result.insertId], (err2, rows) => {
        if (err2) {
          console.error('Failed to fetch created CCA:', err2);
          return res.status(201).json({ cca_id: result.insertId, cca_name, category, description: '', training_day: null, training_time: null, location: null, contact_information: null, image: null, created_at: new Date().toISOString() });
        }
        res.status(201).json(rowToCca(rows[0]));
      });
    }
  );
};

exports.updateCca = (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid CCA id' });
  }

  const body = req.body || {};
  const updates = [];
  const values = [];

  if (body.cca_name !== undefined) { updates.push('cca_name = ?'); values.push(String(body.cca_name).trim()); }
  if (body.category !== undefined) { updates.push('category = ?'); values.push(String(body.category).trim()); }
  if (body.description !== undefined) { updates.push('description = ?'); values.push(String(body.description).trim()); }
  if (body.training_day !== undefined) { updates.push('meeting_day = ?'); values.push(String(body.training_day).trim() || null); }

  if (body.training_time !== undefined) {
    const parts = String(body.training_time).split(/–|-/).map(s => s.trim());
    const startTime = parse24HourTime(parts[0] || '');
    const endTime = parse24HourTime(parts[1] || '');

    if (parts[0] && !startTime) {
      return res.status(400).json({ error: `Invalid start time format: "${parts[0]}". Accepted formats: 14:00, 2:00pm, 1400, or 2pm.` });
    }
    if (parts[1] && !endTime) {
      return res.status(400).json({ error: `Invalid end time format: "${parts[1]}". Accepted formats: 14:00, 2:00pm, 1400, or 2pm.` });
    }

    updates.push('meeting_start_time = ?');
    values.push(startTime);
    updates.push('meeting_end_time = ?');
    values.push(endTime);
  }

  if (body.location !== undefined) { updates.push('location = ?'); values.push(String(body.location).trim() || null); }
  if (body.contact_information !== undefined) { updates.push('contact_email = ?'); values.push(String(body.contact_information).trim() || null); }
  if (body.image !== undefined) { updates.push('image_url = ?'); values.push(String(body.image).trim() || null); }

  if (!updates.length) {
    return pool.query('SELECT * FROM ccas WHERE cca_id = ?', [id], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch CCA' });
      if (!rows.length) return res.status(404).json({ error: 'CCA not found' });
      res.json(rowToCca(rows[0]));
    });
  }

  values.push(id);

  pool.query(`UPDATE ccas SET ${updates.join(', ')} WHERE cca_id = ?`, values, (err) => {
    if (err) {
      console.error('Failed to update CCA:', err);
      return res.status(500).json({ error: 'Failed to update CCA' });
    }
    pool.query('SELECT * FROM ccas WHERE cca_id = ?', [id], (err2, rows) => {
      if (err2) return res.status(500).json({ error: 'Failed to fetch updated CCA' });
      if (!rows.length) return res.status(404).json({ error: 'CCA not found' });
      res.json(rowToCca(rows[0]));
    });
  });
};

exports.deleteCca = (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid CCA id' });
  }

  pool.query('DELETE FROM ccas WHERE cca_id = ?', [id], (err) => {
    if (err) {
      console.error('Failed to delete CCA:', err);
      return res.status(500).json({ error: 'Failed to delete CCA' });
    }
    res.json({ message: 'CCA deleted successfully' });
  });
};

exports.joinCca = (req, res) => {
  const ccaId = parseInt(req.params.id, 10);
  const body = req.body || {};
  const userId = parseInt(body.user_id, 10);

  if (Number.isNaN(ccaId)) {
    return res.status(400).json({ error: 'Invalid CCA id' });
  }
  if (Number.isNaN(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Valid user_id is required in request body' });
  }

  pool.query('SELECT cca_id FROM ccas WHERE cca_id = ? AND status = "active"', [ccaId], (err, rows) => {
    if (err) {
      console.error('Failed to verify CCA:', err);
      return res.status(500).json({ error: 'Failed to verify CCA' });
    }
    if (!rows.length) {
      return res.status(404).json({ error: 'CCA not found' });
    }

    pool.query('SELECT cca_member_id FROM cca_members WHERE cca_id = ? AND user_id = ?', [ccaId, userId], (err2, memberRows) => {
      if (err2) {
        console.error('Failed to check membership:', err2);
        return res.status(500).json({ error: 'Failed to check membership' });
      }
      if (memberRows.length) {
        return res.status(409).json({ error: 'User is already a member of this CCA' });
      }

      pool.query('INSERT INTO cca_members (cca_id, user_id, role, status) VALUES (?, ?, "member", "active")', [ccaId, userId], function (err3) {
        if (err3) {
          console.error('Failed to join CCA:', err3);
          return res.status(500).json({ error: 'Failed to join CCA' });
        }
        pool.query('UPDATE ccas SET member_count = member_count + 1 WHERE cca_id = ?', [ccaId], function () {
          pool.query('SELECT * FROM ccas WHERE cca_id = ?', [ccaId], (err4, ccaRows) => {
            if (err4) return res.status(500).json({ error: 'Failed to fetch updated CCA' });
            if (!ccaRows.length) return res.status(404).json({ error: 'CCA not found' });
            res.status(201).json(rowToCca(ccaRows[0]));
          });
        });
      });
    });
  });
};

exports.leaveCca = (req, res) => {
  const ccaId = parseInt(req.params.id, 10);
  const body = req.body || {};
  const userId = parseInt(body.user_id, 10);

  if (Number.isNaN(ccaId)) {
    return res.status(400).json({ error: 'Invalid CCA id' });
  }
  if (Number.isNaN(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Valid user_id is required in request body' });
  }

  pool.query('SELECT cca_id FROM ccas WHERE cca_id = ? AND status = "active"', [ccaId], (err, rows) => {
    if (err) {
      console.error('Failed to verify CCA:', err);
      return res.status(500).json({ error: 'Failed to verify CCA' });
    }
    if (!rows.length) {
      return res.status(404).json({ error: 'CCA not found' });
    }

    pool.query('SELECT cca_member_id FROM cca_members WHERE cca_id = ? AND user_id = ? AND status = "active"', [ccaId, userId], (err2, memberRows) => {
      if (err2) {
        console.error('Failed to check membership:', err2);
        return res.status(500).json({ error: 'Failed to check membership' });
      }
      if (!memberRows.length) {
        return res.status(404).json({ error: 'User is not a member of this CCA' });
      }

      pool.query('UPDATE cca_members SET status = "left", joined_at = joined_at WHERE cca_id = ? AND user_id = ?', [ccaId, userId], function (err3) {
        if (err3) {
          console.error('Failed to leave CCA:', err3);
          return res.status(500).json({ error: 'Failed to leave CCA' });
        }
        pool.query('UPDATE ccas SET member_count = GREATEST(member_count - 1, 0) WHERE cca_id = ?', [ccaId], function () {
          pool.query('SELECT * FROM ccas WHERE cca_id = ?', [ccaId], (err4, ccaRows) => {
            if (err4) return res.status(500).json({ error: 'Failed to fetch updated CCA' });
            if (!ccaRows.length) return res.status(404).json({ error: 'CCA not found' });
            res.json(rowToCca(ccaRows[0]));
          });
        });
      });
    });
  });
};
