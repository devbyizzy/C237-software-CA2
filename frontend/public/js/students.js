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
  const diploma = document.getElementById('diplomaInput').value.trim();
  const classCode = document.getElementById('classInput').value.trim();
  const interest = document.getElementById('interestInput').value.trim();

  const params = new URLSearchParams();
  if (diploma) params.set('diploma', diploma);
  if (classCode) params.set('class_code', classCode);
  if (interest) params.set('interest', interest);

  const resultsContainer = document.getElementById('studentResults');
  const countEl = document.getElementById('resultsCount');

  try {
    const res = await fetch(`${window.API_BASE_URL}/api/students?${params.toString()}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    renderResults(data.results);
    countEl.textContent = `${data.count} student${data.count === 1 ? '' : 's'} found`;
  } catch (err) {
    console.error('Failed to search students:', err);
    countEl.textContent = '';
    resultsContainer.innerHTML = `<div class="card" style="border-color:#e11d48"><p class="card-content">Couldn't reach the backend API at ${window.API_BASE_URL}. Make sure the backend server is running.</p></div>`;
  }
}

function renderResults(results) {
  const container = document.getElementById('studentResults');
  if (!results.length) {
    container.innerHTML = `<div class="card"><p class="empty-state">No students match those filters.</p></div>`;
    return;
  }
  container.innerHTML = results.map(renderStudentCard).join('');
}

function renderStudentCard(s) {
  const interests = (s.interests || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 4);

  return `
    <a class="card student-card" href="/profile?id=${s.user_id}">
      <div class="student-card-top">
        <div class="avatar avatar-sm">${escapeHtml(s.display_name.charAt(0).toUpperCase())}</div>
        <div>
          <p class="card-title" style="margin-bottom:0;">${escapeHtml(s.display_name)}</p>
          <span class="mini-meta">${escapeHtml(s.diploma)} · ${escapeHtml(s.class_code)} · Year ${s.year_of_study}</span>
        </div>
      </div>
      ${interests.length ? `<div class="tag-list">${interests.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    </a>`;
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
