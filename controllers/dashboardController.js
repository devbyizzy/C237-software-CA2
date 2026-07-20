const { users, profiles, questions, groups, ccas, timetables, CURRENT_USER_ID } = require('../data/sampleData');

function getProfileByUserId(userId) {
  return profiles.find(p => p.user_id === userId);
}

exports.showDashboard = (req, res) => {
  const currentProfile = getProfileByUserId(CURRENT_USER_ID);
  const currentUser = users.find(u => u.user_id === CURRENT_USER_ID);

  // Latest questions, sorted by created_at desc
  const latestQuestions = [...questions].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  // Trending = top by upvotes
  const trendingQuestions = [...questions]
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 4);

  const newGroups = [...groups].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const popularGroups = [...groups]
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, 4);

  const ccaAnnouncements = [...ccas].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const recommendedCcas = ccas.slice(0, 3);

  // Suggested students = everyone except current user
  const suggestedStudents = profiles
    .filter(p => p.user_id !== CURRENT_USER_ID)
    .slice(0, 5)
    .map(p => ({ ...p, full_name: users.find(u => u.user_id === p.user_id)?.full_name }));

  // Shared timetables from classmates/friends, most recent first
  const sharedTimetables = [...timetables].sort(
    (a, b) => new Date(b.shared_at) - new Date(a.shared_at)
  );

  // Demo notification count for the navbar bell
  const notifCount = 3;

  res.render('dashboard', {
    activePage: 'home',
    pageTitle: 'Dashboard',
    currentUser,
    currentProfile,
    latestQuestions,
    newGroups,
    ccaAnnouncements,
    sharedTimetables,
    trendingQuestions,
    popularGroups,
    recommendedCcas,
    suggestedStudents,
    notifCount
  });
};
