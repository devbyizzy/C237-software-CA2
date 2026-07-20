document.addEventListener('DOMContentLoaded', function () {
  initNavInteractivity();
  loadNavProfile();
});

function initNavInteractivity() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebar = document.getElementById('sidebar');
  if (hamburgerBtn && sidebar) {
    hamburgerBtn.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
  }

  document.querySelectorAll('.create-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      alert('Create post/question flow coming soon!');
    });
  });

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
}

async function loadNavProfile() {
  const navAvatar = document.getElementById('navAvatar');
  const navUsername = document.getElementById('navUsername');
  if (!navAvatar && !navUsername) return;
  try {
    const res = await fetch(`${window.API_BASE_URL}/api/profile`);
    if (!res.ok) throw new Error('Failed to load profile');
    const data = await res.json();
    if (navAvatar) navAvatar.textContent = data.display_name.charAt(0).toUpperCase();
    if (navUsername) navUsername.textContent = data.display_name;
  } catch (err) {
    console.error('Failed to load nav profile:', err);
  }
}