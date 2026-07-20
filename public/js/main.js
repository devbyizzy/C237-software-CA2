document.addEventListener('DOMContentLoaded', function () {
  // Sidebar toggle (mobile)
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebar = document.getElementById('sidebar');
  if (hamburgerBtn && sidebar) {
    hamburgerBtn.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
  }

  // Upvote toggle
  document.querySelectorAll('.upvote-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const countEl = btn.querySelector('.count');
      let count = parseInt(countEl.textContent, 10);
      const upvoted = btn.classList.toggle('upvoted');
      count = upvoted ? count + 1 : count - 1;
      countEl.textContent = count;
    });
  });

  // Join button feedback
  document.querySelectorAll('.join-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const joined = btn.classList.toggle('joined');
      btn.textContent = joined ? 'Joined ✓' : 'Join';
    });
  });

  // Create button placeholder
  document.querySelectorAll('.create-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      alert('Create post/question flow coming soon!');
    });
  });

  // Profile dropdown (notifications bell + user menu)
  const profileMenuBtn = document.getElementById('profileMenuBtn');
  const profileMenu = document.getElementById('profileMenu');
  if (profileMenuBtn && profileMenu) {
    profileMenuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      profileMenu.classList.toggle('open');
    });
    document.addEventListener('click', function () {
      profileMenu.classList.remove('open');
    });
  }

  document.querySelectorAll('.notif-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      alert("No new notifications beyond what's shown here!");
    });
  });

  // View timetable placeholder
  document.querySelectorAll('.view-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      alert('Timetable viewer coming soon!');
    });
  });
});
