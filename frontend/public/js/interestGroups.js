document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('interestGroupForm');
  if (!form) return;

  const formError = document.getElementById('formError');
  const editingIdInput = document.getElementById('editingId');
  const formTitle = document.getElementById('formTitle');
  const submitBtn = document.getElementById('submitBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');

  loadGroups();
  bindFilterForm();

  cancelEditBtn.addEventListener('click', resetForm);

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    hideError();

    if (!currentUserId()) {
      showError('Please log in first.');
      return;
    }

    const payload = {
      user_id: currentUserId(),
      group_name: document.getElementById('group_name').value.trim(),
      description: document.getElementById('description').value.trim()
    };

    const editingId = editingIdInput.value;
    const url = editingId
      ? `${window.API_BASE_URL}/api/interest-groups/${editingId}/edit`
      : `${window.API_BASE_URL}/api/interest-groups`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);

      resetForm();
      loadGroups();
    } catch (err) {
      console.error('Failed to save interest group:', err);
      showError(err.message || 'Failed to save the group.');
    }
  });

  function currentUserId() {
    return window.CURRENT_USER && window.CURRENT_USER.userId ? window.CURRENT_USER.userId : null;
  }

  function showError(message) {
    formError.textContent = message;
    formError.style.display = 'block';
  }

  function hideError() {
    formError.style.display = 'none';
  }

  function resetForm() {
    editingIdInput.value = '';
    form.reset();
    formTitle.textContent = 'Create an Interest Group';
    submitBtn.textContent = 'Create Group';
    cancelEditBtn.style.display = 'none';
    hideError();
  }

  function startEdit(group) {
    editingIdInput.value = group.group_id;
    document.getElementById('group_name').value = group.group_name;
    document.getElementById('description').value = group.description || '';
    formTitle.textContent = 'Edit Interest Group';
    submitBtn.textContent = 'Save Changes';
    cancelEditBtn.style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindFilterForm() {
    document.getElementById('filterForm').addEventListener('submit', function (event) {
      event.preventDefault();
      loadGroups();
    });
  }

  async function loadGroups() {
    const container = document.getElementById('groupResults');
    const countEl = document.getElementById('resultsCount');

    const params = new URLSearchParams();
    const search = document.getElementById('searchInput').value.trim();
    const sort = document.getElementById('sortSelect').value;
    if (search) params.set('search', search);
    if (sort) params.set('sort', sort);

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/interest-groups?${params.toString()}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      renderGroups(data.results);
      countEl.textContent = `${data.count} group${data.count === 1 ? '' : 's'} found`;
    } catch (err) {
      console.error('Failed to load interest groups:', err);
      countEl.textContent = '';
      container.innerHTML = `<div class="card" style="border-color:#e11d48"><p class="card-content">Couldn't reach the backend API. Make sure the backend server is running.</p></div>`;
    }
  }

  function renderGroups(results) {
    const container = document.getElementById('groupResults');

    if (!results.length) {
      container.innerHTML = `<div class="card"><p class="empty-state">No interest groups yet. Be the first to create one above!</p></div>`;
      return;
    }

    container.innerHTML = results.map(renderGroupCard).join('');
    bindCardButtons(results);
  }

  function renderGroupCard(group) {
    const isOwner = currentUserId() && Number(currentUserId()) === Number(group.creator_id);
    const created = new Date(group.created_at).toLocaleDateString();

    return `
      <div class="card student-card" data-group-id="${group.group_id}">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <span style="font-size:26px;">✨</span>
          <div style="min-width:0;">
            <p class="card-title" style="margin-bottom:2px;">${escapeHtml(group.group_name)}</p>
            <p class="mini-meta">by ${escapeHtml(group.creator_name || 'Unknown')} · ${created}</p>
          </div>
        </div>
        <p class="card-content" style="margin-bottom:8px;">${escapeHtml(group.description || 'No description yet.')}</p>
        ${isOwner ? `
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-outline edit-btn" style="font-size:12px; padding:6px 12px;">Edit</button>
            <button type="button" class="btn btn-outline delete-btn" style="font-size:12px; padding:6px 12px; color:#e11d48;">Delete</button>
          </div>` : ''}
      </div>`;
  }

  function bindCardButtons(results) {
    document.querySelectorAll('.edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const card = btn.closest('[data-group-id]');
        const groupId = card.getAttribute('data-group-id');
        const group = results.find((g) => String(g.group_id) === groupId);
        if (group) startEdit(group);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const card = btn.closest('[data-group-id]');
        const groupId = card.getAttribute('data-group-id');
        if (!confirm('Delete this interest group? This cannot be undone.')) return;

        try {
          const res = await fetch(`${window.API_BASE_URL}/api/interest-groups/${groupId}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUserId() })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);
          loadGroups();
        } catch (err) {
          console.error('Failed to delete interest group:', err);
          alert(err.message || 'Failed to delete group.');
        }
      });
    });
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});
