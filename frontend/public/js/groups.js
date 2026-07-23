document.addEventListener('DOMContentLoaded', function () {
  initFiltersFromUrl();
  bindFilterForm();
  loadGroups();
  loadDashboardPanels();
});

var GROUP_TYPE_EMOJI = {
  class: '🏫',
  study: '📚',
  cca: '🎭',
  interest: '✨',
  friend: '🤝'
};

function currentUserId() {
  return window.CURRENT_USER && window.CURRENT_USER.userId ? window.CURRENT_USER.userId : null;
}

function getFilterValues() {
  return {
    search: document.getElementById('searchInput').value.trim(),
    type: document.getElementById('typeSelect').value,
    diploma: document.getElementById('diplomaInput').value.trim(),
    class_code: document.getElementById('classInput').value.trim(),
    sort: document.getElementById('sortSelect').value,
    mine: document.getElementById('mineToggleBtn').classList.contains('mine-active') ? '1' : ''
  };
}

function initFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('search')) document.getElementById('searchInput').value = params.get('search');
  if (params.get('type')) document.getElementById('typeSelect').value = params.get('type');
  if (params.get('diploma')) document.getElementById('diplomaInput').value = params.get('diploma');
  if (params.get('class_code')) document.getElementById('classInput').value = params.get('class_code');
  if (params.get('sort')) document.getElementById('sortSelect').value = params.get('sort');

  const mineBtn = document.getElementById('mineToggleBtn');
  if (params.get('mine') === '1') {
    mineBtn.classList.add('mine-active', 'btn-primary');
    mineBtn.classList.remove('btn-outline');
    document.getElementById('groupsTitle').textContent = 'My Groups';
  }
}

function bindFilterForm() {
  const form = document.getElementById('groupFilterForm');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    syncUrl();
    loadGroups();
  });

  document.getElementById('clearFiltersBtn').addEventListener('click', function () {
    form.reset();
    syncUrl();
    loadGroups();
  });

  document.getElementById('mineToggleBtn').addEventListener('click', function () {
    const mineBtn = document.getElementById('mineToggleBtn');
    const active = mineBtn.classList.toggle('mine-active');
    mineBtn.classList.toggle('btn-primary', active);
    mineBtn.classList.toggle('btn-outline', !active);
    document.getElementById('groupsTitle').textContent = active ? 'My Groups' : 'RP Circles';
    syncUrl();
    loadGroups();
  });
}

function syncUrl() {
  const filters = getFilterValues();
  const params = new URLSearchParams();
  Object.keys(filters).forEach(function (key) {
    if (filters[key]) params.set(key, filters[key]);
  });
  const query = params.toString();
  window.history.replaceState(null, '', query ? '/groups?' + query : '/groups');
}

async function loadGroups() {
  const container = document.getElementById('groupResults');
  const countEl = document.getElementById('resultsCount');
  if (!container) return;

  const filters = getFilterValues();
  const params = new URLSearchParams();
  Object.keys(filters).forEach(function (key) {
    if (filters[key]) params.set(key, filters[key]);
  });
  if (currentUserId()) params.set('user_id', currentUserId());

  try {
    const res = await fetch(`${window.API_BASE_URL}/api/groups?${params.toString()}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    renderGroups(data.results);
    if (countEl) countEl.textContent = `${data.count} group${data.count === 1 ? '' : 's'} found`;
  } catch (err) {
    console.error('Failed to load groups:', err);
    if (countEl) countEl.textContent = '';
    container.innerHTML = `<div class="card" style="border-color:#e11d48"><p class="card-content">Couldn't reach the backend API at ${window.API_BASE_URL}. Make sure the backend server is running.</p></div>`;
  }
}

function renderGroups(results) {
  const container = document.getElementById('groupResults');
  if (!container) return;

  if (!results.length) {
    container.innerHTML = `<div class="card"><p class="empty-state">No groups found. Try different filters or <a href="/groups/create" style="color:var(--accent);">create one</a>!</p></div>`;
    return;
  }

  container.innerHTML = results.map(renderGroupCard).join('');
  bindJoinButtons(container);
}

function membershipChip(group) {
  if (group.viewer_role === 'owner') return '<span class="badge" style="background:rgba(255,0,229,0.15);">👑 Owner</span>';
  if (group.viewer_status === 'accepted') return '<span class="badge" style="background:rgba(16,185,129,0.15);">✓ Joined</span>';
  if (group.viewer_status === 'pending') return '<span class="badge" style="background:rgba(245,158,11,0.15);">⏳ Pending</span>';
  return '';
}

function joinButtonHtml(group) {
  if (group.viewer_role === 'owner' || group.viewer_status === 'accepted' || group.viewer_status === 'pending') {
    return '';
  }
  if (group.max_members && group.member_count >= group.max_members) {
    return '<span class="mini-meta">Group full</span>';
  }
  const label = group.privacy === 'private' ? '🔒 Request to Join' : '+ Join';
  return `<button type="button" class="btn btn-outline join-group-btn" data-group-id="${group.group_id}" style="font-size:12px; padding:6px 12px;">${label}</button>`;
}

function renderGroupCard(group) {
  const emoji = GROUP_TYPE_EMOJI[group.group_type] || '👥';
  const capacity = group.max_members ? `${group.member_count}/${group.max_members}` : `${group.member_count}`;
  const metaBits = [group.diploma, group.class_code, group.module_code].filter(Boolean).map(escapeHtml).join(' · ');

  return `
    <div class="card student-card">
      <a href="/groups/${group.group_id}" style="display:block;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <span style="font-size:26px;">${emoji}</span>
          <div style="min-width:0;">
            <p class="card-title" style="margin-bottom:2px;">${escapeHtml(group.group_name)}</p>
            <p class="mini-meta">${escapeHtml(group.group_type_label || '')}${group.privacy === 'private' ? ' · 🔒 Private' : ''}</p>
          </div>
        </div>
        <p class="card-content" style="margin-bottom:8px;">${escapeHtml(group.description || 'No description yet.')}</p>
        ${metaBits ? `<p class="mini-meta" style="margin-bottom:6px;">🎓 ${metaBits}</p>` : ''}
        <p class="mini-meta">👥 ${capacity} member${group.member_count === 1 ? '' : 's'} · by ${escapeHtml(group.creator_name || 'Unknown')}</p>
      </a>
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:4px;">
        ${membershipChip(group)}
        ${joinButtonHtml(group)}
      </div>
    </div>`;
}

function bindJoinButtons(container) {
  container.querySelectorAll('.join-group-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const groupId = btn.getAttribute('data-group-id');
      if (!currentUserId()) {
        alert('Please log in first.');
        return;
      }

      btn.disabled = true;
      try {
        const res = await fetch(`${window.API_BASE_URL}/api/groups/${groupId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUserId() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);
        loadGroups();
        loadDashboardPanels();
      } catch (err) {
        console.error('Failed to join group:', err);
        alert(err.message || 'Failed to join group.');
        btn.disabled = false;
      }
    });
  });
}

async function loadDashboardPanels() {
  const params = new URLSearchParams();
  if (currentUserId()) params.set('user_id', currentUserId());

  try {
    const res = await fetch(`${window.API_BASE_URL}/api/groups/dashboard?${params.toString()}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    renderPanel('recommendedGroupsContent', data.recommendedGroups, 'No recommendations yet.');
    renderPanel('popularGroupsContent', data.popularGroups, 'No groups yet.');
    renderPanel('recentGroupsContent', data.recentGroups, 'No groups yet.');
    renderPanel('joinedGroupsContent', data.joinedGroups, "You haven't joined any groups yet.");
  } catch (err) {
    console.error('Failed to load group panels:', err);
    ['recommendedGroupsContent', 'popularGroupsContent', 'recentGroupsContent', 'joinedGroupsContent'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<p class="mini-meta">Unavailable right now.</p>';
    });
  }
}

function renderPanel(elementId, groups, emptyMessage) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (!groups || !groups.length) {
    el.innerHTML = `<p class="mini-meta">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  el.innerHTML = groups
    .map(function (group) {
      const emoji = GROUP_TYPE_EMOJI[group.group_type] || '👥';
      return `
        <a href="/groups/${group.group_id}" class="mini-card" style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:18px;">${emoji}</span>
          <div style="min-width:0;">
            <p class="mini-title">${escapeHtml(group.group_name)}</p>
            <p class="mini-meta">${escapeHtml(group.group_type_label || '')} · 👥 ${group.member_count}</p>
          </div>
        </a>`;
    })
    .join('');
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
