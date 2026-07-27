const pool = require('../utils/db');
const database = pool.promise();

async function fetchUserWithProfile(userId) {
  const [rows] = await database.execute(
    `SELECT
       u.user_id,
       u.name        AS full_name,
       u.username,
       u.email,
       COALESCE(p.display_name, u.name) AS display_name,
       p.bio,
       p.diploma,
       p.year_of_study,
       p.semester,
       p.class_code,
       p.interests
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.user_id
     WHERE u.user_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function fetchJoinedGroups(userId) {
  const [rows] = await database.execute(
    `SELECT g.group_id, g.group_name, g.description
     FROM student_groups g
     JOIN group_members gm ON gm.group_id = g.group_id
     WHERE gm.user_id = ? AND gm.join_status = 'accepted'
     ORDER BY gm.joined_at DESC`,
    [userId]
  );
  return rows;
}

async function fetchQuestionsCreated(userId) {
  const [rows] = await database.execute(
    `SELECT question_id, title, content, category, created_at
     FROM questions
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function buildProfilePayload(userId, viewerId) {
  const user = await fetchUserWithProfile(userId);
  if (!user) return null;
  const [joinedGroups, questionsCreated] = await Promise.all([
    fetchJoinedGroups(userId),
    fetchQuestionsCreated(userId)
  ]);
  return {
    user_id: user.user_id,
    full_name: user.full_name,
    username: user.username,
    email: user.email,
    display_name: user.display_name,
    bio: user.bio,
    interests: user.interests,
    diploma: user.diploma,
    class_code: user.class_code,
    year_of_study: user.year_of_study,
    joinedGroups,
    questionsCreated,
    isOwnProfile: viewerId != null && Number(viewerId) === Number(userId)
  };
}

exports.getProfileById = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
  const viewerId = req.query.viewerId ? parseInt(req.query.viewerId, 10) : null;
  try {
    const payload = await buildProfilePayload(userId, viewerId);
    if (!payload) return res.status(404).json({ error: 'Profile not found' });
    res.json(payload);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Unable to load profile at the moment.' });
  }
};

exports.updateProfile = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

  const { bio, interests, display_name, diploma, class_code, year_of_study } = req.body || {};

  if (bio !== undefined && (typeof bio !== 'string' || bio.length > 500)) {
    return res.status(400).json({ error: 'Bio must be a string up to 500 characters' });
  }
  if (interests !== undefined && (typeof interests !== 'string' || interests.length > 300)) {
    return res.status(400).json({ error: 'Interests must be a string up to 300 characters' });
  }
  if (display_name !== undefined && (typeof display_name !== 'string' || !display_name.trim())) {
    return res.status(400).json({ error: 'Display name cannot be empty' });
  }
  if (diploma !== undefined && typeof diploma !== 'string') {
    return res.status(400).json({ error: 'Diploma must be a string' });
  }
  if (diploma !== undefined && diploma.length > 150) {
    return res.status(400).json({ error: 'Diploma must be under 150 characters' });
  }
  if (class_code !== undefined && typeof class_code !== 'string') {
    return res.status(400).json({ error: 'Class code must be a string' });
  }
  if (class_code !== undefined && class_code.length > 30) {
    return res.status(400).json({ error: 'Class code must be under 30 characters' });
  }

  let normalisedYear;
  if (year_of_study === undefined) {
    normalisedYear = undefined;
  } else if (year_of_study === null || year_of_study === '') {
    normalisedYear = null;
  } else {
    normalisedYear = parseInt(year_of_study, 10);
    if (Number.isNaN(normalisedYear) || normalisedYear < 1 || normalisedYear > 6) {
      return res.status(400).json({ error: 'Year of study must be a number between 1 and 6' });
    }
  }

  try {
    const existingUser = await fetchUserWithProfile(userId);
    if (!existingUser) return res.status(404).json({ error: 'Profile not found' });

    await database.execute(
      `INSERT INTO profiles (user_id, display_name, bio, interests, diploma, class_code, year_of_study)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         display_name  = COALESCE(VALUES(display_name), display_name),
         bio           = COALESCE(VALUES(bio), bio),
         interests     = COALESCE(VALUES(interests), interests),
         diploma       = COALESCE(VALUES(diploma), diploma),
         class_code    = COALESCE(VALUES(class_code), class_code),
         year_of_study = COALESCE(VALUES(year_of_study), year_of_study)`,
      [
        userId,
        display_name !== undefined ? display_name.trim() : null,
        bio !== undefined ? bio.trim() : null,
        interests !== undefined ? interests.trim() : null,
        diploma !== undefined ? diploma.trim() : null,
        class_code !== undefined ? class_code.trim() : null,
        normalisedYear !== undefined ? normalisedYear : null
      ]
    );

    const payload = await buildProfilePayload(userId, userId);
    res.json(payload);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Unable to update profile at the moment.' });
  }
};