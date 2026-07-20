document.addEventListener('DOMContentLoaded', function () {
  loadCcaDetails();
});

async function loadCcaDetails() {
  const root = document.getElementById('ccaDetailsRoot');
  if (!root) return;

  // Extract CCA id from URL path: /ccas/:id
  const pathParts = window.location.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  if (!id || isNaN(parseInt(id, 10))) {
    root.innerHTML = `<div class="card"><p class="empty-state">Invalid CCA id.</p></div>`;
    return;
  }

  try {
    const res = await fetch(`${window.API_BASE_URL}/api/ccas/${id}`);
    if (!res.ok) {
      if (res.status === 404) {
        root.innerHTML = `<div class="card"><p class="empty-state">CCA not found.</p></div>`;
        return;
      }
      throw new Error(`API error: ${res.status}`);
    }
    const cca = await res.json();
    renderCcaDetails(cca);
  } catch (err) {
    console.error('Failed to load CCA details:', err);
    root.innerHTML = `<div class="card" style="border-color:#e11d48"><p class="card-content">Couldn't reach the backend API at ${window.API_BASE_URL}. Make sure the backend server is running.</p></div>`;
  }
}

function renderCcaDetails(c) {
  const root = document.getElementById('ccaDetailsRoot');

  root.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      ${c.image ? `<img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.cca_name)}" style="width:100%;height:240px;object-fit:cover;" onerror="this.style.display='none'" />` : ''}
      <div style="padding:20px 24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
          <div>
            <h1 style="font-size:24px;font-weight:700;margin-bottom:4px;">${escapeHtml(c.cca_name)}</h1>
            <span class="badge">${escapeHtml(c.category)}</span>
          </div>
          <a href="/admin/ccas/${c.cca_id}/edit" class="btn btn-outline">✏️ Edit</a>
        </div>

        <p style="font-size:15px;color:var(--text-muted);margin-bottom:20px;line-height:1.6;">${escapeHtml(c.description)}</p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
          ${c.training_day ? `
          <div class="mini-card" style="border:none;padding:0;">
            <div>
              <p class="mini-meta" style="font-size:12px;">Training Day</p>
              <p class="mini-title" style="font-size:14px;">${escapeHtml(c.training_day)}</p>
            </div>
          </div>` : ''}
          ${c.training_time ? `
          <div class="mini-card" style="border:none;padding:0;">
            <div>
              <p class="mini-meta" style="font-size:12px;">Training Time</p>
              <p class="mini-title" style="font-size:14px;">${escapeHtml(c.training_time)}</p>
            </div>
          </div>` : ''}
          ${c.location ? `
          <div class="mini-card" style="border:none;padding:0;">
            <div>
              <p class="mini-meta" style="font-size:12px;">Location</p>
              <p class="mini-title" style="font-size:14px;">${escapeHtml(c.location)}</p>
            </div>
          </div>` : ''}
          ${c.contact_information ? `
          <div class="mini-card" style="border:none;padding:0;">
            <div>
              <p class="mini-meta" style="font-size:12px;">Contact</p>
              <p class="mini-title" style="font-size:14px;">${escapeHtml(c.contact_information)}</p>
            </div>
          </div>` : ''}
        </div>
      </div>
    </div>
    <div style="margin-top:8px;">
      <a href="/ccas" class="btn btn-outline">← Back to CCAs</a>
    </div>
  `;
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
