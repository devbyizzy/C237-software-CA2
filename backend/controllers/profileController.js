const { users, profiles, questions, groups, CURRENT_USER_ID } = require('../data/sampleData');

function findProfile(userId) {
  return profiles.find(p => p.user_id === userId);
}

function findUser(userId) {
  return users.find(u => u.user_id === userId);
}

function buildProfilePayload(userId) {
  const profile = findProfile(userId);
  const user = findUser(userId);
  if (!profile || !user) return null;

  const joinedGroups = groups.filter(g => g.members.includes(userId));

  const questionsCreated = questions
    .filter(q => q.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return {
    user_id: user.user_id,
    full_name: user.full_name,
    email: user.email,
    display_name: profile.display_name,
    bio: profile.bio,
    interests: profile.interests,
    diploma: profile.diploma,
    class_code: profile.class_code,
    year_of_study: profile.year_of_study,
    joinedGroups,
    questionsCreated,
    isOwnProfile: userId === CURRENT_USER_ID
  };
}

exports.getMyProfile = (req, res) => {
  const payload = buildProfilePayload(CURRENT_USER_ID);
  if (!payload) return res.status(404).json({ error: 'Profile not found' });
  res.json(payload);
};

exports.getProfileById = (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  const payload = buildProfilePayload(userId);
  if (!payload) return res.status(404).json({ error: 'Profile not found' });
  res.json(payload);
};

exports.updateMyProfile = (req, res) => {
  const profile = findProfile(CURRENT_USER_ID);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const { bio, interests, display_name } = req.body || {};

  if (bio !== undefined) {
    if (typeof bio !== 'string' || bio.length > 500) {
      return res.status(400).json({ error: 'Bio must be a string up to 500 characters' });
    }
    profile.bio = bio.trim();
  }

  if (interests !== undefined) {
    if (typeof interests !== 'string' || interests.length > 300) {
      return res.status(400).json({ error: 'Interests must be a string up to 300 characters' });
    }
    profile.interests = interests.trim();
  }

  if (display_name !== undefined) {
    if (typeof display_name !== 'string' || !display_name.trim()) {
      return res.status(400).json({ error: 'Display name cannot be empty' });
    }
    profile.display_name = display_name.trim();
  }

  res.json(buildProfilePayload(CURRENT_USER_ID));
};