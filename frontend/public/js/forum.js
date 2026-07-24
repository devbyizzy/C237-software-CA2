document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('questionForm');
  if (!form) return;

  const formError = document.getElementById('formError');

  loadQuestions();
  document.getElementById('filterForm').addEventListener('submit', function (event) {
    event.preventDefault();
    loadQuestions();
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    hideError();

    if (!currentUserId()) {
      showError('Please log in first.');
      return;
    }

    const payload = {
      user_id: currentUserId(),
      title: document.getElementById('title').value.trim(),
      content: document.getElementById('content').value.trim(),
      category: document.getElementById('category').value.trim()
    };

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);

      form.reset();
      loadQuestions();
    } catch (err) {
      console.error('Failed to create post:', err);
      showError(err.message || 'Failed to create post.');
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

  async function loadQuestions() {
    const container = document.getElementById('questionResults');
    const countEl = document.getElementById('resultsCount');

    const params = new URLSearchParams();
    const search = document.getElementById('searchInput').value.trim();
    const category = document.getElementById('categoryInput').value.trim();
    const sort = document.getElementById('sortSelect').value;
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (sort) params.set('sort', sort);

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/questions?${params.toString()}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      renderQuestions(data.results);
      countEl.textContent = `${data.count} post${data.count === 1 ? '' : 's'} found`;
    } catch (err) {
      console.error('Failed to load posts:', err);
      countEl.textContent = '';
      container.innerHTML = `<div class="card" style="border-color:#e11d48"><p class="card-content">Couldn't reach the backend API. Make sure the backend server is running.</p></div>`;
    }
  }

  function renderQuestions(results) {
    const container = document.getElementById('questionResults');

    if (!results.length) {
      container.innerHTML = `<div class="card"><p class="empty-state">No posts yet. Be the first to ask something!</p></div>`;
      return;
    }

    container.innerHTML = results.map(renderCard).join('');
  }

  function renderCard(question) {
    const created = new Date(question.created_at).toLocaleDateString();
    return `
      <a href="/forum/${question.question_id}" class="card student-card" style="display:block; text-decoration:none; color:inherit;">
        <p class="card-title" style="margin-bottom:2px;">${escapeHtml(question.title)}</p>
        <p class="mini-meta">by ${escapeHtml(question.author_name || 'Unknown')} · ${created} · ${question.reply_count} repl${question.reply_count === 1 ? 'y' : 'ies'}${question.category ? ' · ' + escapeHtml(question.category) : ''}</p>
        <p class="card-content" style="margin-top:6px; margin-bottom:0;">${escapeHtml(question.content).slice(0, 160)}${question.content.length > 160 ? '…' : ''}</p>
      </a>`;
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
