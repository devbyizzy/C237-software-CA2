document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('searchForm');
  const clearBtn = document.getElementById('clearFiltersBtn');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    runSearch();
  });

  clearBtn.addEventListener('click', function () {
    form.reset();
    runSearch();
  });

  runSearch();
});

async function runSearch() {
  const search = document.getElementById('searchInput').value.trim();
  const category = document.getElementById('categorySelect').value;

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);

  const resultsContainer = document.getElementById('ccaResults');
  const countEl = document.getElementById('resultsCount');

  try {
    const res = await fetch(`${window.API_BASE_URL}/api/ccas?${params.toString()}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    renderResults(data.results);
    countEl.textContent = `${data.count} CCA${data.count === 1 ? '' : 's'} found`;
  } catch (err) {
    console.error('Failed to search CCAs:', err);
    countEl.textContent = '';
    resultsContainer.innerHTML = `<div class="card" style="border-color:#e11d48"><p class="card-content">Couldn't reach the backend API at ${window.API_BASE_URL}. Make sure the backend server is running.</p></div>`;
  }
}

function renderResults(results) {
  const container = document.getElementById('ccaResults');
  if (!results.length) {
    container.innerHTML = `<div class="card"><p class="empty-state">No CCAs match those filters.</p></div>`;
    return;
  }
  container.innerHTML = results.map(renderCcaCard).join('');
}

function renderCcaCard(c) {
  return `
    <a class="card student-card" href="/ccas/${c.cca_id}">
      ${c.image
        ? `<img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.cca_name)}" style="width:100%;height:140px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />`
        : `<div style="width:100%;height:140px;border-radius:8px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;background:#4a6cf7;color:#fff;font-size:24px;font-weight:700;text-align:center;padding:0 16px;line-height:1.3;">${escapeHtml(c.cca_name)}</div>`}
      <div>
        <p class="card-title" style="margin-bottom:4px;">${escapeHtml(c.cca_name)}</p>
        <span class="badge">${escapeHtml(c.category)}</span>
      </div>
      <p class="card-content" style="margin-bottom:0;">${escapeHtml(c.description)}</p>
      ${c.training_day ? `<p class="mini-meta" style="margin-top:8px;">📅 ${escapeHtml(c.training_day)}${c.training_time ? ' · ' + escapeHtml(c.training_time) : ''}</p>` : ''}
    </a>`;
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}
