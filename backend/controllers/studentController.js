const { users, profiles } = require('../data/sampleData');

// GET /api/students?diploma=&class_code=&interest=
exports.searchStudents = (req, res) => {
  const diploma = String(req.query.diploma || '').trim().toLowerCase();
  const classCode = String(req.query.class_code || '').trim().toLowerCase();
  const interest = String(req.query.interest || '').trim().toLowerCase();

  const results = profiles
    .filter(p => {
      const matchesDiploma = !diploma || p.diploma.toLowerCase().includes(diploma);
      const matchesClass = !classCode || p.class_code.toLowerCase().includes(classCode);
      const matchesInterest = !interest || p.interests.toLowerCase().includes(interest);
      return matchesDiploma && matchesClass && matchesInterest;
    })
    .map(p => {
      const user = users.find(u => u.user_id === p.user_id);
      return {
        user_id: p.user_id,
        full_name: user?.full_name,
        display_name: p.display_name,
        bio: p.bio,
        interests: p.interests,
        diploma: p.diploma,
        class_code: p.class_code,
        year_of_study: p.year_of_study
      };
    });

  res.json({ count: results.length, results });
};