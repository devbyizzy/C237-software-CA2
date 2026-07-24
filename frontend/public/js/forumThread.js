document.addEventListener('DOMContentLoaded', function () {
  const questionId = window.QUESTION_ID;
  if (!questionId) return;

  loadThread();

  document.getElementById('replyForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const replyError = document.getElementById('replyError');
    replyError.style.display = 'none';

    if (!currentUserId()) {
      replyError.textContent = 'Please log in first.';
      replyError.style.display = 'block';
      return;
    }

    const content = document.getElementById('replyContent').value.trim();

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/questions/${questionId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId(), content })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);

      document.getElementById('replyContent').value = '';
      loadThread();
    } catch (err) {
      console.error('Failed to post reply:', err);
      replyError.textContent = err.message || 'Failed to post reply.';
      replyError.style.display = 'block';
    }
  });

  function currentUserId() {
    return window.CURRENT_USER && window.CURRENT_USER.userId ? window.CURRENT_USER.userId : null;
  }

  async function loadThread() {
    const questionContainer = document.getElementById('questionContainer');
    const repliesList = document.getElementById('repliesList');

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/questions/${questionId}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      questionContainer.innerHTML = renderQuestion(data.question);
      repliesList.innerHTML = data.replies.length
        ? data.replies.map(renderReply).join('')
        : `<div class="card"><p class="empty-state">No replies yet.</p></div>`;

      bindQuestionActions(data.question);
      bindReplyActions(data.replies);
    } catch (err) {
      console.error('Failed to load post:', err);
      questionContainer.innerHTML = `<div class="card" style="border-color:#e11d48"><p class="card-content">Couldn't reach the backend API. Make sure the backend server is running.</p></div>`;
    }
  }

  function renderQuestion(question) {
    const isAuthor = currentUserId() && Number(currentUserId()) === Number(question.user_id);
    const created = new Date(question.created_at).toLocaleDateString();

    return `
      <div class="card">
        <p class="card-title" style="font-size:20px;">${escapeHtml(question.title)}</p>
        <p class="mini-meta">by ${escapeHtml(question.author_name)} · ${created} · ${question.view_count} views${question.category ? ' · ' + escapeHtml(question.category) : ''}</p>
        <p class="card-content" style="margin-top:10px;">${escapeHtml(question.content)}</p>
        ${isAuthor ? `
          <div style="display:flex; gap:8px; margin-top:10px;">
            <button type="button" class="btn btn-outline" id="deleteQuestionBtn" style="font-size:12px; padding:6px 12px; color:#e11d48;">Delete Post</button>
          </div>` : ''}
      </div>`;
  }

  function renderReply(reply) {
    const isAuthor = currentUserId() && Number(currentUserId()) === Number(reply.user_id);
    const created = new Date(reply.created_at).toLocaleDateString();

    return `
      <div class="card" data-reply-id="${reply.reply_id}" style="margin-bottom:10px;">
        <p class="mini-meta">${escapeHtml(reply.author_name)} · ${created}</p>
        <p class="card-content" style="margin-top:4px; margin-bottom:${isAuthor ? '8px' : '0'};">${escapeHtml(reply.content)}</p>
        ${isAuthor ? `<button type="button" class="btn btn-outline delete-reply-btn" style="font-size:12px; padding:4px 10px; color:#e11d48;">Delete</button>` : ''}
      </div>`;
  }

  function bindQuestionActions(question) {
    const deleteBtn = document.getElementById('deleteQuestionBtn');
    if (!deleteBtn) return;

    deleteBtn.addEventListener('click', async function () {
      if (!confirm('Delete this post? This also removes all its replies.')) return;

      try {
        const res = await fetch(`${window.API_BASE_URL}/api/questions/${questionId}/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUserId() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);
        window.location.href = '/forum';
      } catch (err) {
        console.error('Failed to delete post:', err);
        alert(err.message || 'Failed to delete post.');
      }
    });
  }

  function bindReplyActions(replies) {
    document.querySelectorAll('.delete-reply-btn').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const card = btn.closest('[data-reply-id]');
        const replyId = card.getAttribute('data-reply-id');
        if (!confirm('Delete this reply?')) return;

        try {
          const res = await fetch(`${window.API_BASE_URL}/api/questions/${questionId}/replies/${replyId}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUserId() })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);
          loadThread();
        } catch (err) {
          console.error('Failed to delete reply:', err);
          alert(err.message || 'Failed to delete reply.');
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
