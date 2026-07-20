document.addEventListener('DOMContentLoaded', function () {
  initInteractivity();
  loadDashboard();
});

function initInteractivity() {
  // Sidebar toggle (mobile)
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebar = document.getElementById('sidebar');
  if (hamburgerBtn && sidebar) {
    hamburgerBtn.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
  }

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
}

// Delegated handlers for content rendered after fetch
function bindDynamicHandlers(root) {
  root.querySelectorAll('.upvote-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const countEl = btn.querySelector('.count');
      let count = parseInt(countEl.textContent, 10);
      const upvoted = btn.classList.toggle('upvoted');
      count = upvoted ? count + 1 : count - 1;
      countEl.textContent = count;
    });
  });

  root.querySelectorAll('.join-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const joined = btn.classList.toggle('joined');
      btn.textContent = joined ? 'Joined ✓' : 'Join';
    });
  });

  root.querySelectorAll('.view-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      alert('Timetable viewer coming soon!');
    });
  });
}

async function loadDashboard() {
  const feed = document.querySelector('main.feed');
  try {
    const res = await fetch(`${window.API_BASE_URL}/api/dashboard`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    renderDashboard(data);
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
    if (feed) {
      feed.insertAdjacentHTML(
        'afterbegin',
        `<div class="card" style="border-color:#e11d48"><p class="card-content">Couldn't reach the backend API at ${window.API_BASE_URL}. Make sure the backend server is running.</p></div>`
      );
    }
  }
}

function renderDashboard(data) {
  document.title = `RPConnect${data.pageTitle ? ' - ' + data.pageTitle : ''}`;

  const feedTitle = document.getElementById('feedTitle');
  if (feedTitle && data.currentProfile) {
    feedTitle.textContent = `Welcome back, ${data.currentProfile.display_name} 👋`;
  }

  const navAvatar = document.getElementById('navAvatar');
  const navUsername = document.getElementById('navUsername');
  if (data.currentProfile) {
    if (navAvatar) navAvatar.textContent = data.currentProfile.display_name.charAt(0).toUpperCase();
    if (navUsername) navUsername.textContent = data.currentProfile.display_name;
  }

  const notifDot = document.getElementById('notifDot');
  if (notifDot) {
    if (data.notifCount > 0) {
      notifDot.hidden = false;
      notifDot.textContent = data.notifCount;
    } else {
      notifDot.hidden = true;
    }
  }

  setSection('latestQuestions', data.latestQuestions, renderQuestionCard);
  setSection('newGroups', data.newGroups, renderGroupCard);
  setSection('ccaAnnouncements', data.ccaAnnouncements, renderCcaCard);
  setSection('sharedTimetables', data.sharedTimetables, renderTimetableCard);

  setSection('trendingQuestions', data.trendingQuestions, renderTrendingMini);
  setSection('popularGroups', data.popularGroups, renderPopularGroupMini);
  setSection('recommendedCcas', data.recommendedCcas, renderCcaMini);
  setSection('suggestedStudents', data.suggestedStudents, renderStudentMini);

  bindDynamicHandlers(document);
}

function setSection(containerId, items, renderFn) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = (items || []).map(renderFn).join('');
}

function renderQuestionCard(q) {
  return `
    <article class="card question-card">
      <div class="card-top">
        <span class="badge">${escapeHtml(q.category)}</span>
        <span class="card-date">${escapeHtml(q.time_ago)}</span>
      </div>
      <h3 class="card-title">${escapeHtml(q.title)}</h3>
      <p class="card-content">${escapeHtml(q.content)}</p>
      <div class="card-footer">
        <span class="card-author">by ${escapeHtml(q.author_name)}</span>
        <div class="card-actions">
          <button class="action-btn upvote-btn" data-count="${q.upvotes}">
            ⬆️ <span class="count">${q.upvotes}</span>
          </button>
          <button class="action-btn">💬 ${q.comments}</button>
        </div>
      </div>
    </article>`;
}

function renderGroupCard(g) {
  return `
    <article class="card group-card">
      <h3 class="card-title">${escapeHtml(g.group_name)}</h3>
      <p class="card-content">${escapeHtml(g.description)}</p>
      <div class="card-footer">
        <span class="card-author">created by ${escapeHtml(g.creator_name)}</span>
        <button class="btn btn-outline join-btn">Join</button>
      </div>
    </article>`;
}

function renderCcaCard(c) {
  return `
    <article class="card cca-card">
      <div class="card-top">
        <span class="badge">🎭 ${escapeHtml(c.category)}</span>
        <span class="card-date">${escapeHtml(c.time_ago)}</span>
      </div>
      <h3 class="card-title">${escapeHtml(c.cca_name)}</h3>
      <p class="card-content">${escapeHtml(c.description)}</p>
    </article>`;
}

function renderTimetableCard(t) {
  return `
    <article class="card timetable-card">
      <div class="card-top">
        <span class="badge">🗓️ ${escapeHtml(t.class_code)}</span>
        <span class="card-date">${escapeHtml(t.time_ago)}</span>
      </div>
      <h3 class="card-title">${escapeHtml(t.title)}</h3>
      <p class="card-content">${escapeHtml(t.diploma)}</p>
      <div class="card-footer">
        <span class="card-author">shared by ${escapeHtml(t.owner_name)}</span>
        <button class="btn btn-outline view-btn">View</button>
      </div>
    </article>`;
}

function renderTrendingMini(q) {
  return `
    <div class="mini-card">
      <p class="mini-title">${escapeHtml(q.title)}</p>
      <span class="mini-meta">${q.upvotes} upvotes · ${q.comments} comments</span>
    </div>`;
}

function renderPopularGroupMini(g) {
  return `
    <div class="mini-card">
      <p class="mini-title">${escapeHtml(g.group_name)}</p>
      <span class="mini-meta">${g.member_count} members</span>
    </div>`;
}

function renderCcaMini(c) {
  return `
    <div class="mini-card">
      <p class="mini-title">${escapeHtml(c.cca_name)}</p>
      <span class="mini-meta">${escapeHtml(c.category)}</span>
    </div>`;
}

function renderStudentMini(s) {
  return `
    <div class="mini-card student-suggestion">
      <div class="avatar avatar-sm">${escapeHtml(s.display_name.charAt(0).toUpperCase())}</div>
      <div>
        <p class="mini-title">${escapeHtml(s.display_name)}</p>
        <span class="mini-meta">${escapeHtml(s.diploma)}</span>
      </div>
    </div>`;
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
