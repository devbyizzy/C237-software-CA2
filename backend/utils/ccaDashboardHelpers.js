/**
 * CCA Dashboard Helpers
 *
 * Utility functions for the dashboard to consume. The dashboard owner can
 * require this module and wire the returned arrays into their controller.
 * All helpers operate on the in-memory `ccas` array from sampleData.
 */

/**
 * Returns CCAs sorted by newest first (top 5).
 */
function getPopularCcas(ccas) {
  return [...ccas]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);
}

/**
 * Returns CCAs that have a training_day / training_time set (i.e. upcoming
 * sessions), sorted by day of the week for display purposes.
 */
function getUpcomingSessions(ccas) {
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return [...ccas]
    .filter(c => c.training_day && c.training_time)
    .sort((a, b) => dayOrder.indexOf(a.training_day) - dayOrder.indexOf(b.training_day));
}

/**
 * Returns CCAs recommended based on the current user's profile interests.
 * Matches by checking if any interest keyword appears in the CCA name,
 * description, or category (case-insensitive). Falls back to the 3 most
 * recent CCAs if no interest match is found.
 */
function getCcaRecommendations(ccas, profile) {
  if (!profile || !profile.interests) {
    return [...ccas].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
  }

  const interests = profile.interests.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const scored = ccas.map(c => {
    const haystack = (c.cca_name + ' ' + c.description + ' ' + c.category).toLowerCase();
    const score = interests.filter(interest => haystack.includes(interest)).length;
    return { cca: c, score };
  });

  const matched = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).map(s => s.cca);

  if (matched.length > 0) {
    return matched.slice(0, 3);
  }

  return [...ccas].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
}

module.exports = {
  getPopularCcas,
  getUpcomingSessions,
  getCcaRecommendations
};

