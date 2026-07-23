document.addEventListener('DOMContentLoaded', function () {
  loadRequests();
});

function currentUserId() {
  return window.CURRENT_USER && window.CURRENT_USER.userId ? window.CURRENT_USER.userId : null;
}

function groupIdFromUrl() {
  // /groups/:id/requests
  const pathParts = window.location.pathname.split('/');
  const id = parseInt(pathParts[pathParts.length - 2], 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function loadRequests() {
  const root = document.getElementById('requestsRoot');
  const countEl = document.getElementById('resultsCount');
  const subtitleEl = document.getElementById('requestsSubtitle');
  const backLink = document.getElementById('backToGroupLink');
  const groupId = groupIdFromUrl();

  if (!groupId) {
    root.innerHTML = '<div class="card"><p class="empty-state">Invalid group id.</p></div>';
    return;
  }

  if (backLink) backLink.href = `/groups/${groupId}`;

  if (!currentUserId()) {
    root.innerHTML = '<div class="card"><p class="empty-state">Please log in first.</p></div>';
    return;
  }

  try {
    const res = await fetch(`${window.API_BASE_URL}/api/groups/${groupId}/requests?user_id=${currentUserId()}`);
    const data = await res.json();

    if (!res.ok) {
      root.innerHTML = `<div class="card"><p class="empty-state">${escapeHtml(data.error || 'Unable to load join requests.')}</p></div>`;
      if (countEl) countEl.textContent = '';
      return;
    }

    if (subtitleEl && data.group) {
      subtitleEl.textContent = `Pending requests for ${data.group.group_name}`;
    }

    if (countEl) {
      countEl.textContent = `${data.count} pending request${data.count === 1 ? '' : 's'}`;
    }

    if (!data.results.length) {
      root.innerHTML = '<div class="card"><p class="empty-state">🎉 No pending requests right now.</p></div>';
      return;
    }

    root.innerHTML = data.results.map(function (request) { return renderRequestCard(groupId, request); }).join('');
    bindDecisionButtons(groupId);
  } catch (err) {
    console.error('Failed to load join requests:', err);
    root.innerHTML = `<div class="card" style="border-color:#e11d48"><p class="card-content">Couldn't reach the backend API at ${window.API_BASE_URL}. Make sure the backend server is running.</p></div>`;
  }
}

function renderRequestCard(groupId, request) {
  const name = request.display_name || request.name || request.username;
  const meta = [
    request.diploma,
    request.class_code,
    request.year_of_study ? `Year ${request.year_of_study}` : null
  ]
    .filter(Boolean)
    .join(' · ');

  return `
    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:12px; min-width:0;">
          <div class="avatar">${escapeHtml(name.charAt(0).toUpperCase())}</div>
          <div style="min-width:0;">
            <p class="card-title" style="margin-bottom:2px;">${escapeHtml(name)}</p>
            ${meta ? `<p class="mini-meta">${escapeHtml(meta)}</p>` : ''}
            <p class="mini-meta">Requested ${timeAgo(request.requested_at)}</p>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-primary decision-btn" data-user-id="${request.user_id}" data-decision="accept">✓ Accept</button>
          <button type="button" class="btn btn-outline decision-btn" data-user-id="${request.user_id}" data-decision="reject" style="border-color:#e11d48; color:#e11d48;">✕ Reject</button>
        </div>
      </div>
      ${request.bio ? `<p class="card-content" style="margin-top:10px;">${escapeHtml(request.bio)}</p>` : ''}
    </div>`;
}

function bindDecisionButtons(groupId) {
  document.querySelectorAll('.decision-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const targetUserId = btn.getAttribute('data-user-id');
      const decision = btn.getAttribute('data-decision');

      btn.disabled = true;
      try {
        const res = await fetch(
          `${window.API_BASE_URL}/api/groups/${groupId}/requests/${targetUserId}/${decision}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUserId() })
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);

        loadRequests();
      } catch (err) {
        console.error('Failed to update request:', err);
        alert(err.message || 'Failed to update the request.');
        btn.disabled = false;
      }
    });
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  return days + 'd ago';
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
