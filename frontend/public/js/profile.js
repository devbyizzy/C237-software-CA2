document.addEventListener('DOMContentLoaded', function () {
  loadProfile();
});

function getViewedUserId() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  return id ? parseInt(id, 10) : null;
}

async function loadProfile() {
  const root = document.getElementById('profileRoot');
  const viewedId = getViewedUserId();
  const endpoint = viewedId
    ? `${window.API_BASE_URL}/api/profile/${viewedId}`
    : `${window.API_BASE_URL}/api/profile`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) {
      if (res.status === 404) {
        root.innerHTML = `<div class="card"><p class="card-content">Student not found.</p></div>`;
        return;
      }
      throw new Error(`API error: ${res.status}`);
    }
    const data = await res.json();
    renderProfileView(root, data);
  } catch (err) {
    console.error('Failed to load profile:', err);
    root.innerHTML = `<div class="card" style="border-color:#e11d48"><p class="card-content">Couldn't reach the backend API at ${window.API_BASE_URL}. Make sure the backend server is running.</p></div>`;
  }
}

function interestTags(interests) {
  const list = (interests || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (!list.length) return `<p class="empty-state">No interests added yet.</p>`;
  return `<div class="tag-list">${list.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`;
}

function renderProfileView(root, data) {
  document.title = `RPConnect - ${data.display_name}'s Profile`;

  root.innerHTML = `
    <section class="feed-section">
      <div class="card profile-header">
        <div class="avatar avatar-lg">${escapeHtml(data.display_name.charAt(0).toUpperCase())}</div>
        <div class="profile-header-info">
          <p class="profile-name">${escapeHtml(data.display_name)}</p>
          <p class="profile-subtext">${escapeHtml(data.full_name)} · ${escapeHtml(data.email)}</p>
          <div class="profile-meta-badges">
            <span class="badge">${escapeHtml(data.diploma)}</span>
            <span class="badge">${escapeHtml(data.class_code)}</span>
            <span class="badge">Year ${data.year_of_study}</span>
          </div>
        </div>
        ${data.isOwnProfile ? `<button class="btn btn-primary" id="editProfileBtn">Edit Profile</button>` : ''}
      </div>
    </section>

    <section class="feed-section">
      <div class="card">
        <h2 class="section-title">About</h2>
        <p class="card-content" style="margin-bottom:0;">${data.bio ? escapeHtml(data.bio) : '<span class="empty-state">No bio added yet.</span>'}</p>
      </div>
    </section>

    <section class="feed-section">
      <div class="card">
        <h2 class="section-title">Interests</h2>
        ${interestTags(data.interests)}
      </div>
    </section>

    <section class="feed-section">
      <div class="feed-section-header">
        <h2>Joined Groups</h2>
      </div>
      ${data.joinedGroups.length
        ? data.joinedGroups.map(g => `
          <article class="card group-card">
            <h3 class="card-title">${escapeHtml(g.group_name)}</h3>
            <p class="card-content">${escapeHtml(g.description)}</p>
            <div class="card-footer">
              <span class="card-author">${g.member_count} members</span>
            </div>
          </article>`).join('')
        : `<div class="card"><p class="empty-state">Not part of any groups yet.</p></div>`}
    </section>

    <section class="feed-section">
      <div class="feed-section-header">
        <h2>Questions Created</h2>
      </div>
      ${data.questionsCreated.length
        ? data.questionsCreated.map(q => `
          <article class="card question-card">
            <div class="card-top">
              <span class="badge">${escapeHtml(q.category)}</span>
            </div>
            <h3 class="card-title">${escapeHtml(q.title)}</h3>
            <p class="card-content">${escapeHtml(q.content)}</p>
            <div class="card-footer">
              <span class="card-author">${q.upvotes} upvotes · ${q.comments} comments</span>
            </div>
          </article>`).join('')
        : `<div class="card"><p class="empty-state">No questions posted yet.</p></div>`}
    </section>
  `;

  const editBtn = document.getElementById('editProfileBtn');
  if (editBtn) {
    editBtn.addEventListener('click', function () {
      renderProfileEditForm(root, data);
    });
  }
}

function renderProfileEditForm(root, data) {
  root.innerHTML = `
    <section class="feed-section">
      <div class="card">
        <h2 class="section-title">Edit Profile</h2>
        <div id="editError"></div>
        <form id="editProfileForm">
          <div class="form-group">
            <label class="form-label" for="displayNameInput">Display name</label>
            <input class="form-input" type="text" id="displayNameInput" maxlength="50" value="${escapeAttr(data.display_name)}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="bioInput">Bio</label>
            <textarea class="form-textarea" id="bioInput" maxlength="500">${escapeHtml(data.bio || '')}</textarea>
            <span class="form-hint">Up to 500 characters.</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="interestsInput">Interests</label>
            <input class="form-input" type="text" id="interestsInput" maxlength="300" value="${escapeAttr(data.interests || '')}" />
            <span class="form-hint">Comma-separated, e.g. "Web Development, Gaming, AI"</span>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save Changes</button>
            <button type="button" class="btn btn-outline" id="cancelEditBtn">Cancel</button>
          </div>
        </form>
      </div>
    </section>
  `;

  document.getElementById('cancelEditBtn').addEventListener('click', function () {
    renderProfileView(root, data);
  });

  document.getElementById('editProfileForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorBox = document.getElementById('editError');
    errorBox.innerHTML = '';

    const payload = {
      display_name: document.getElementById('displayNameInput').value,
      bio: document.getElementById('bioInput').value,
      interests: document.getElementById('interestsInput').value
    };

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const updated = await res.json();
      if (!res.ok) {
        throw new Error(updated.error || 'Failed to update profile');
      }
      renderProfileView(root, updated);
    } catch (err) {
      errorBox.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    }
  });
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

function escapeAttr(str) {
  return escapeHtml(str);
}