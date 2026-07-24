document.addEventListener('DOMContentLoaded', function () {
  loadGroupPage();
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

function groupIdFromUrl() {
  const pathParts = window.location.pathname.split('/');
  const id = parseInt(pathParts[pathParts.length - 1], 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function loadGroupPage() {
  const headerRoot = document.getElementById('groupHeaderRoot');
  const groupId = groupIdFromUrl();

  if (!groupId) {
    headerRoot.innerHTML = '<div class="card"><p class="empty-state">Invalid group id.</p></div>';
    return;
  }

  try {
    const params = currentUserId() ? `?user_id=${currentUserId()}` : '';
    const res = await fetch(`${window.API_BASE_URL}/api/groups/${groupId}${params}`);
    if (!res.ok) {
      if (res.status === 404) {
        headerRoot.innerHTML = '<div class="card"><p class="empty-state">Group not found.</p></div>';
        return;
      }
      throw new Error(`API error: ${res.status}`);
    }
    const group = await res.json();

    renderGroupHeader(group);
    renderGroupInfo(group);
    loadMembers(groupId);
    setupPostsSection(group);
  } catch (err) {
    console.error('Failed to load group:', err);
    headerRoot.innerHTML = `<div class="card" style="border-color:#e11d48"><p class="card-content">Couldn't reach the backend API at ${window.API_BASE_URL}. Make sure the backend server is running.</p></div>`;
  }
}

function actionButtonsHtml(group) {
  const buttons = [];
  const isFull = group.max_members && group.member_count >= group.max_members;

  if (group.viewer_role === 'owner') {
    buttons.push(`<a href="/groups/${group.group_id}/edit" class="btn btn-outline">✏️ Edit Group</a>`);
  }

  if (group.viewer_role === 'owner' || group.viewer_role === 'moderator') {
    const pending = group.pending_count ? ` (${group.pending_count})` : '';
    buttons.push(`<a href="/groups/${group.group_id}/requests" class="btn btn-outline">📨 Join Requests${pending}</a>`);
  }

  if (group.viewer_status === 'accepted' && group.viewer_role !== 'owner') {
    buttons.push(`<button type="button" id="leaveGroupBtn" class="btn btn-outline" style="border-color:#e11d48; color:#e11d48;">Leave Group</button>`);
  } else if (group.viewer_status === 'pending') {
    buttons.push('<span class="badge" style="background:rgba(245,158,11,0.15);">⏳ Request pending</span>');
    buttons.push(`<button type="button" id="cancelRequestBtn" class="btn btn-outline">Cancel Request</button>`);
  } else if (!group.viewer_status || group.viewer_status === 'rejected') {
    if (isFull) {
      buttons.push('<span class="badge">Group full</span>');
    } else if (group.privacy === 'private') {
      buttons.push(`<button type="button" id="joinGroupBtn" class="btn btn-primary">🔒 Request to Join</button>`);
    } else {
      buttons.push(`<button type="button" id="joinGroupBtn" class="btn btn-primary">+ Join Group</button>`);
    }
    if (group.viewer_status === 'rejected') {
      buttons.push('<span class="mini-meta">Your previous request was rejected — you can try again.</span>');
    }
  }

  return buttons.join('');
}

function renderGroupHeader(group) {
  const headerRoot = document.getElementById('groupHeaderRoot');
  const emoji = GROUP_TYPE_EMOJI[group.group_type] || '👥';
  const capacity = group.max_members ? `${group.member_count}/${group.max_members}` : `${group.member_count}`;

  headerRoot.innerHTML = `
    <div class="card">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:14px; min-width:0;">
          <span style="font-size:44px;">${emoji}</span>
          <div style="min-width:0;">
            <h1 style="font-size:24px; font-weight:700; margin-bottom:4px;">${escapeHtml(group.group_name)}</h1>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <span class="badge">${escapeHtml(group.group_type_label || '')}</span>
              <span class="badge">${group.privacy === 'private' ? '🔒 Private' : '🌐 Public'}</span>
              <span class="badge">👥 ${capacity} member${group.member_count === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;" id="groupActions">
          ${actionButtonsHtml(group)}
        </div>
      </div>
      <p style="font-size:15px; color:var(--text-muted); margin-top:14px; line-height:1.6;">${escapeHtml(group.description || 'No description yet.')}</p>
      <p class="mini-meta" style="margin-top:10px;">Created by ${escapeHtml(group.creator_name || 'Unknown')} · ${formatDate(group.created_at)}</p>
    </div>`;

  bindHeaderActions(group);
}

function bindHeaderActions(group) {
  const joinBtn = document.getElementById('joinGroupBtn');
  const leaveBtn = document.getElementById('leaveGroupBtn');
  const cancelBtn = document.getElementById('cancelRequestBtn');

  if (joinBtn) {
    joinBtn.addEventListener('click', async function () {
      if (!currentUserId()) return alert('Please log in first.');
      joinBtn.disabled = true;
      try {
        const res = await fetch(`${window.API_BASE_URL}/api/groups/${group.group_id}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUserId() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);
        alert(data.message);
        window.location.reload();
      } catch (err) {
        alert(err.message || 'Failed to join group.');
        joinBtn.disabled = false;
      }
    });
  }

  if (leaveBtn) {
    leaveBtn.addEventListener('click', function () {
      if (confirm('Are you sure you want to leave this group?')) {
        leaveOrCancel(group.group_id, leaveBtn);
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function () {
      leaveOrCancel(group.group_id, cancelBtn);
    });
  }
}

async function leaveOrCancel(groupId, btn) {
  btn.disabled = true;
  try {
    const res = await fetch(`${window.API_BASE_URL}/api/groups/${groupId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUserId() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);
    window.location.reload();
  } catch (err) {
    alert(err.message || 'Something went wrong.');
    btn.disabled = false;
  }
}

function renderGroupInfo(group) {
  const infoEl = document.getElementById('groupInfoContent');
  const rows = [
    group.diploma ? ['🎓 Diploma', group.diploma] : null,
    group.class_code ? ['🏫 Class', group.class_code] : null,
    group.module_code ? ['📖 Module', group.module_code] : null,
    group.year_of_study ? ['📅 Year', `Year ${group.year_of_study}`] : null,
    group.semester ? ['🗓️ Semester', `Semester ${group.semester}`] : null,
    ['👥 Capacity', group.max_members ? `${group.member_count} / ${group.max_members}` : `${group.member_count} (no limit)`]
  ].filter(Boolean);

  infoEl.innerHTML = rows
    .map(function (row) {
      return `<div class="mini-card"><div><p class="mini-meta">${escapeHtml(row[0])}</p><p class="mini-title">${escapeHtml(row[1])}</p></div></div>`;
    })
    .join('');
}

async function loadMembers(groupId) {
  const membersEl = document.getElementById('groupMembersContent');
  try {
    const res = await fetch(`${window.API_BASE_URL}/api/groups/${groupId}/members`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    if (!data.results.length) {
      membersEl.innerHTML = '<p class="mini-meta">No members yet.</p>';
      return;
    }

    membersEl.innerHTML = data.results
      .map(function (member) {
        const name = member.display_name || member.name || member.username;
        const roleChip =
          member.member_role === 'owner'
            ? ' <span class="badge" style="font-size:10px; background:rgba(255,0,229,0.15);">👑 Owner</span>'
            : member.member_role === 'moderator'
              ? ' <span class="badge" style="font-size:10px;">🛡️ Mod</span>'
              : '';
        const meta = [member.diploma, member.class_code].filter(Boolean).join(' · ');
        return `
          <div class="mini-card" style="display:flex; align-items:center; gap:10px;">
            <div class="avatar avatar-sm">${escapeHtml(name.charAt(0).toUpperCase())}</div>
            <div style="min-width:0;">
              <p class="mini-title">${escapeHtml(name)}${roleChip}</p>
              ${meta ? `<p class="mini-meta">${escapeHtml(meta)}</p>` : ''}
            </div>
          </div>`;
      })
      .join('');
  } catch (err) {
    console.error('Failed to load members:', err);
    membersEl.innerHTML = '<p class="mini-meta">Unable to load members.</p>';
  }
}

function setupPostsSection(group) {
  const section = document.getElementById('groupPostsSection');
  const postsRoot = document.getElementById('groupPostsRoot');
  const newPostCard = document.getElementById('newPostCard');
  const isMember = group.viewer_status === 'accepted';

  section.style.display = '';

  if (group.privacy === 'private' && !isMember) {
    postsRoot.innerHTML = '<div class="card"><p class="empty-state">🔒 This group is private. Join the group to see its posts.</p></div>';
    return;
  }

  if (isMember) {
    newPostCard.style.display = '';
    bindNewPostForm(group.group_id);
  }

  loadPosts(group.group_id, isMember);
}

async function loadPosts(groupId, isMember) {
  const postsRoot = document.getElementById('groupPostsRoot');
  try {
    const params = currentUserId() ? `?user_id=${currentUserId()}` : '';
    const res = await fetch(`${window.API_BASE_URL}/api/groups/${groupId}/posts${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);

    if (!data.results.length) {
      postsRoot.innerHTML = `<div class="card"><p class="empty-state">No posts yet.${isMember ? ' Start the conversation!' : ''}</p></div>`;
      return;
    }

    postsRoot.innerHTML = data.results.map(function (post) { return renderPost(post, isMember); }).join('');
    if (isMember) bindReplyForms(groupId, isMember);
  } catch (err) {
    console.error('Failed to load posts:', err);
    postsRoot.innerHTML = `<div class="card"><p class="card-content">${escapeHtml(err.message || 'Unable to load posts.')}</p></div>`;
  }
}

function renderPost(post, isMember) {
  const author = post.display_name || post.name || post.username;
  const replies = (post.replies || [])
    .map(function (reply) {
      const replyAuthor = reply.display_name || reply.name || reply.username;
      return `
        <div style="display:flex; gap:10px; padding:8px 0 0 14px; border-left:2px solid var(--border); margin-left:6px; margin-top:8px;">
          <div class="avatar avatar-sm" style="width:28px; height:28px; font-size:12px; flex-shrink:0;">${escapeHtml(replyAuthor.charAt(0).toUpperCase())}</div>
          <div style="min-width:0;">
            <p class="mini-meta"><strong style="color:var(--text);">${escapeHtml(replyAuthor)}</strong> · ${timeAgo(reply.created_at)}</p>
            <p class="card-content" style="margin-bottom:0;">${escapeHtml(reply.content)}</p>
          </div>
        </div>`;
    })
    .join('');

  const replyForm = isMember
    ? `
      <form class="reply-form" data-post-id="${post.group_post_id}" style="display:flex; gap:8px; margin-top:10px;">
        <input class="form-input" type="text" name="content" placeholder="Write a reply..." required style="flex:1;" />
        <button type="submit" class="btn btn-outline" style="font-size:12px;">Reply</button>
      </form>`
    : '';

  return `
    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
        <div class="avatar avatar-sm">${escapeHtml(author.charAt(0).toUpperCase())}</div>
        <div>
          <p class="mini-title">${escapeHtml(author)}</p>
          <p class="mini-meta">${timeAgo(post.created_at)}</p>
        </div>
      </div>
      <p class="card-content">${escapeHtml(post.content)}</p>
      <p class="mini-meta" style="margin-top:6px;">💬 ${(post.replies || []).length} repl${(post.replies || []).length === 1 ? 'y' : 'ies'}</p>
      ${replies}
      ${replyForm}
    </div>`;
}

function bindNewPostForm(groupId) {
  const form = document.getElementById('newPostForm');
  const errorEl = document.getElementById('postError');

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    errorEl.style.display = 'none';

    const contentEl = document.getElementById('newPostContent');
    const content = contentEl.value.trim();
    if (!content) return;

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/groups/${groupId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId(), content })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);

      contentEl.value = '';
      loadPosts(groupId, true);
    } catch (err) {
      console.error('Failed to create post:', err);
      errorEl.textContent = err.message || 'Failed to create the post.';
      errorEl.style.display = 'block';
    }
  });
}

function bindReplyForms(groupId, isMember) {
  document.querySelectorAll('.reply-form').forEach(function (form) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      const postId = form.getAttribute('data-post-id');
      const input = form.querySelector('input[name="content"]');
      const content = input.value.trim();
      if (!content) return;

      try {
        const res = await fetch(`${window.API_BASE_URL}/api/group-posts/${postId}/replies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUserId(), content })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);

        loadPosts(groupId, isMember);
      } catch (err) {
        console.error('Failed to reply:', err);
        alert(err.message || 'Failed to post the reply.');
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

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
