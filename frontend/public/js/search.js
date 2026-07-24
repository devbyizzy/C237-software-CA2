// =========================================================
//  ADVANCED SEARCH FEATURE — Browser-side Search Logic
//  This script handles:
//  - Reading URL query parameters
//  - Fetching search results from the backend API
//  - Rendering results, tabs, filters, sorting, pagination
//  - Clear Filters, filter chips, no-results handling
//
//  NO database logic — only frontend UI behaviour.
// =========================================================

document.addEventListener('DOMContentLoaded', function () {
  // Start the search when the page loads
  runSearch();
});

// -------------------------------------------------------
//  Read URL query parameters into an object
// -------------------------------------------------------

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);

  return {
    q: params.get('q') || '',
    type: params.get('type') || 'all',
    category: params.get('category') || '',
    diploma: params.get('diploma') || '',
    sort: params.get('sort') || 'newest',
    page: parseInt(params.get('page'), 10) || 1
  };
}

// -------------------------------------------------------
//  Build the search API URL from query parameters
// -------------------------------------------------------

function buildSearchUrl(params) {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set('q', params.q);
  }

  if (params.type && params.type !== 'all') {
    searchParams.set('type', params.type);
  }

  if (params.category) {
    searchParams.set('category', params.category);
  }

  if (params.diploma) {
    searchParams.set('diploma', params.diploma);
  }

  if (params.sort && params.sort !== 'newest') {
    searchParams.set('sort', params.sort);
  }

  if (params.page && params.page > 1) {
    searchParams.set('page', params.page);
  }

  const queryString = searchParams.toString();
  return `${window.API_BASE_URL}/api/search${queryString ? '?' + queryString : ''}`;
}

// -------------------------------------------------------
//  Update the browser URL without reloading the page
// -------------------------------------------------------

function updateBrowserUrl(params) {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set('q', params.q);
  }

  if (params.type && params.type !== 'all') {
    searchParams.set('type', params.type);
  }

  if (params.category) {
    searchParams.set('category', params.category);
  }

  if (params.diploma) {
    searchParams.set('diploma', params.diploma);
  }

  if (params.sort && params.sort !== 'newest') {
    searchParams.set('sort', params.sort);
  }

  if (params.page && params.page > 1) {
    searchParams.set('page', params.page);
  }

  const queryString = searchParams.toString();
  const newUrl = `/search${queryString ? '?' + queryString : ''}`;

  // Update the browser URL without reloading the page
  window.history.replaceState({}, '', newUrl);
}

// -------------------------------------------------------
//  Run the search — main function
// -------------------------------------------------------

async function runSearch() {
  // Get the search parameters from the URL
  const params = getQueryParams();

  // Update the hidden keyword input in the filter form
  const filterKeywordInput = document.getElementById('filterKeywordInput');
  if (filterKeywordInput) {
    filterKeywordInput.value = params.q;
  }

  // Update the search input value
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = params.q;
  }

  // Update the filter form controls to match the URL
  const categorySelect = document.getElementById('filterCategory');
  if (categorySelect) {
    categorySelect.value = params.category;
  }

  const diplomaInput = document.getElementById('filterDiploma');
  if (diplomaInput) {
    diplomaInput.value = params.diploma;
  }

  const sortSelect = document.getElementById('filterSort');
  if (sortSelect) {
    sortSelect.value = params.sort;
  }

  // Show loading indicator
  showLoading(true);

  // Hide previous results and messages
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('noResults').style.display = 'none';
  document.getElementById('emptySearch').style.display = 'none';
  document.getElementById('pagination').style.display = 'none';

  try {
    // Build the API URL
    const apiUrl = buildSearchUrl(params);

    // Fetch results from the backend
    const response = await fetch(apiUrl);
    const data = await response.json();

    // Hide loading indicator
    showLoading(false);

    if (!data.success) {
      // Show the error message
      showNoResults(params.q, 'Unable to complete the search. Please try again later.');
      return;
    }

    // Check if the search is empty (no keyword entered)
    if (!params.q) {
      document.getElementById('searchResults').style.display = 'none';
      document.getElementById('emptySearch').style.display = 'block';
      document.getElementById('pagination').style.display = 'none';
      // Still update the tabs with counts
      updateTabs(data.counts, params.type);
      updateResultsCount(data.counts, params.q);
      return;
    }

    // Update the result type tabs with counts
    updateTabs(data.counts, params.type);

    // Show the result count
    updateResultsCount(data.counts, params.q);

    // Render the filter chips
    renderFilterChips(params);

    // Check if there are any results
    if (!data.results || data.results.length === 0) {
      document.getElementById('searchResults').style.display = 'none';
      showNoResults(params.q);
      document.getElementById('pagination').style.display = 'none';
      return;
    }

    // Render the results
    renderResults(data.results);

    // Show the results container
    document.getElementById('searchResults').style.display = 'block';

    // Render pagination
    if (data.pagination && data.pagination.totalPages > 1) {
      renderPagination(data.pagination, params);
      document.getElementById('pagination').style.display = 'flex';
    } else {
      document.getElementById('pagination').style.display = 'none';
    }

    // Update the browser URL
    updateBrowserUrl(params);

  } catch (error) {
    console.error('Search error:', error);
    showLoading(false);
    showNoResults(params.q, 'Could not connect to the server. Make sure the backend is running.');
  }
}

// -------------------------------------------------------
//  Show or hide the loading indicator
// -------------------------------------------------------

function showLoading(visible) {
  const loading = document.getElementById('searchLoading');
  if (loading) {
    loading.style.display = visible ? 'block' : 'none';
  }
}

// -------------------------------------------------------
//  Update the result-type tabs with counts
// -------------------------------------------------------

function updateTabs(counts, activeType) {
  const tabs = document.querySelectorAll('.search-tab');

  tabs.forEach(function (tab) {
    const type = tab.getAttribute('data-type');
    const count = counts[type] !== undefined ? counts[type] : 0;

    // Update the tab label with the count
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    tab.innerHTML = label + ' <span class="tab-count">' + count + '</span>';

    // Mark the active tab
    if (type === activeType) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }

    // Add click handler
    tab.onclick = function () {
      // Get current params and change the type
      const params = getQueryParams();
      params.type = type;
      params.page = 1; // Reset to page 1 when changing tabs

      // Update the URL and re-run the search
      updateBrowserUrl(params);

      // Update form hidden input
      const filterKeywordInput = document.getElementById('filterKeywordInput');
      if (filterKeywordInput) {
        filterKeywordInput.value = params.q;
      }

      runSearch();
    };
  });
}

// -------------------------------------------------------
//  Update the results count text
// -------------------------------------------------------

function updateResultsCount(counts, keyword) {
  const resultsCount = document.getElementById('resultsCount');

  if (resultsCount) {
    const total = counts.all || 0;
    const keywordText = keyword ? ' for &ldquo;' + escapeHtml(keyword) + '&rdquo;' : '';
    resultsCount.innerHTML = total + ' result' + (total !== 1 ? 's' : '') + ' found' + keywordText + '.';
  }
}

// -------------------------------------------------------
//  Render the search results
// -------------------------------------------------------

function renderResults(results) {
  const container = document.getElementById('searchResults');
  if (!container) return;

  let html = '';

  results.forEach(function (item) {
    html += renderResultCard(item);
  });

  container.innerHTML = html;
}

// -------------------------------------------------------
//  Render a single result card based on its type
// -------------------------------------------------------

function renderResultCard(item) {
  const type = item.type || '';

  switch (type) {
    case 'group':
      return renderGroupCard(item);
    case 'cca':
      return renderCcaCard(item);
    case 'module':
      return renderModuleCard(item);
    default:
      return '';
  }
}

// -------------------------------------------------------
//  Render an Interest Group result card
// -------------------------------------------------------

function renderGroupCard(g) {
  return `
    <article class="search-result-card">
      <span class="search-result-type group">👥 Interest Group</span>
      <h3 class="search-result-title">${escapeHtml(g.group_name)}</h3>
      <p class="search-result-content">${escapeHtml(g.description)}</p>
      <div class="search-result-meta">
        <span>📂 ${escapeHtml(g.diploma || 'All diplomas')}</span>
        <span>👤 ${escapeHtml(g.creator_name || 'Unknown')}</span>
        <span>📅 ${formatDate(g.created_at)}</span>
        <span>👥 ${g.member_count || 0} member${g.member_count === 1 ? '' : 's'}</span>
        <span>🔒 ${g.privacy === 'private' ? 'Private' : 'Public'}</span>
      </div>
      <div class="search-result-footer">
        <span class="card-author">Group</span>
        <a href="/groups/${g.id}" class="btn btn-outline">View Group</a>
      </div>
    </article>`;
}

// -------------------------------------------------------
//  Render a CCA result card
// -------------------------------------------------------

function renderCcaCard(c) {
  return `
    <article class="search-result-card">
      <span class="search-result-type cca">🎭 CCA</span>
      <h3 class="search-result-title">${escapeHtml(c.cca_name)}</h3>
      <p class="search-result-content">${escapeHtml(c.description)}</p>
      <div class="search-result-meta">
        <span>📂 ${escapeHtml(c.category || 'Uncategorised')}</span>
        <span>📅 ${c.meeting_day || 'Flexible'}</span>
        <span>📍 ${escapeHtml(c.location || 'TBA')}</span>
        <span>👥 ${c.member_count || 0} member${c.member_count === 1 ? '' : 's'}</span>
      </div>
      <div class="search-result-footer">
        <span class="card-author">CCA</span>
        <a href="/ccas/${c.id}" class="btn btn-outline">View CCA</a>
      </div>
    </article>`;
}

// -------------------------------------------------------
//  Render a Module result card
//  Modules come from student_groups that have a
//  module_code set. This shows the study group that
//  is related to a module.
// -------------------------------------------------------

function renderModuleCard(m) {
  return `
    <article class="search-result-card">
      <span class="search-result-type module">📚 Module Study Group</span>
      <h3 class="search-result-title">${escapeHtml(m.group_name)}</h3>
      <p class="search-result-content">${escapeHtml(m.description)}</p>
      <div class="search-result-meta">
        <span>📋 Module: ${escapeHtml(m.module_code || 'N/A')}</span>
        <span>👤 ${escapeHtml(m.creator_name || 'Unknown')}</span>
        <span>📅 ${formatDate(m.created_at)}</span>
        <span>👥 ${m.member_count || 0} member${m.member_count === 1 ? '' : 's'}</span>
      </div>
      <div class="search-result-footer">
        <span class="card-author">Study Group</span>
        <a href="/groups/${m.id}" class="btn btn-outline">View Group</a>
      </div>
    </article>`;
}

// -------------------------------------------------------
//  Show the no-results message
// -------------------------------------------------------

function showNoResults(keyword, customMessage) {
  const noResults = document.getElementById('noResults');
  const message = document.getElementById('noResultsMessage');

  if (noResults && message) {
    if (customMessage) {
      message.textContent = customMessage;
    } else {
      const keywordText = keyword ? ' for &ldquo;' + escapeHtml(keyword) + '&rdquo;' : '';
      message.innerHTML = 'No results found' + keywordText + '.<br />Try using a different keyword or removing some filters.';
    }

    noResults.style.display = 'block';
  }
}

// -------------------------------------------------------
//  Render filter chips for active filters
// -------------------------------------------------------

function renderFilterChips(params) {
  const container = document.getElementById('activeFilterChips');
  if (!container) return;

  let chips = [];

  if (params.type && params.type !== 'all') {
    chips.push({ label: params.type.charAt(0).toUpperCase() + params.type.slice(1), field: 'type' });
  }

  if (params.category) {
    chips.push({ label: params.category, field: 'category' });
  }

  if (params.diploma) {
    chips.push({ label: params.diploma, field: 'diploma' });
  }

  if (chips.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'flex';

  let html = '<span class="filter-chip-label" style="font-size:13px; color:var(--text-muted); font-weight:600;">Applied filters:</span>';

  chips.forEach(function (chip) {
    html += '<span class="filter-chip">';
    html += escapeHtml(chip.label);
    html += '<button type="button" class="filter-chip-remove" data-field="' + chip.field + '" title="Remove this filter">×</button>';
    html += '</span>';
  });

  container.innerHTML = html;

  // Add click handlers to remove buttons
  container.querySelectorAll('.filter-chip-remove').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const field = btn.getAttribute('data-field');
      removeFilter(field);
    });
  });
}

// -------------------------------------------------------
//  Remove a single filter and re-run the search
// -------------------------------------------------------

function removeFilter(field) {
  const params = getQueryParams();

  if (field === 'type') {
    params.type = 'all';
  } else if (field === 'category') {
    params.category = '';
  } else if (field === 'diploma') {
    params.diploma = '';
  }

  params.page = 1;

  // Update the browser URL and re-run the search
  updateBrowserUrl(params);
  runSearch();
}

// -------------------------------------------------------
//  Render pagination controls
// -------------------------------------------------------

function renderPagination(pagination, params) {
  const pageNumbers = document.getElementById('pageNumbers');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  if (!pageNumbers || !prevBtn || !nextBtn) return;

  const currentPage = pagination.page || 1;
  const totalPages = pagination.totalPages || 1;

  // Previous button
  prevBtn.disabled = currentPage <= 1;
  prevBtn.onclick = function () {
    if (currentPage > 1) {
      params.page = currentPage - 1;
      updateBrowserUrl(params);
      runSearch();
    }
  };

  // Next button
  nextBtn.disabled = currentPage >= totalPages;
  nextBtn.onclick = function () {
    if (currentPage < totalPages) {
      params.page = currentPage + 1;
      updateBrowserUrl(params);
      runSearch();
    }
  };

  // Page number buttons
  let pageHtml = '';

  // Show max 5 page numbers
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);

  for (let i = startPage; i <= endPage; i++) {
    pageHtml += '<button type="button" class="page-number-btn' + (i === currentPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
  }

  pageNumbers.innerHTML = pageHtml;

  // Add click handlers to page number buttons
  pageNumbers.querySelectorAll('.page-number-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const page = parseInt(btn.getAttribute('data-page'), 10);
      if (page !== currentPage) {
        params.page = page;
        updateBrowserUrl(params);
        runSearch();
      }
    });
  });
}

// -------------------------------------------------------
//  Format a date string into a readable format
// -------------------------------------------------------

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';

  try {
    const date = new Date(dateStr);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  } catch (e) {
    return dateStr;
  }
}

// -------------------------------------------------------
//  Escape HTML to prevent XSS attacks
// -------------------------------------------------------

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

// -------------------------------------------------------
//  Clear Filters button handler
// -------------------------------------------------------

document.addEventListener('click', function (event) {
  // Clear Filters button
  if (event.target && event.target.id === 'clearFiltersBtn') {
    const params = getQueryParams();
    // Preserve the keyword, reset everything else
    params.type = 'all';
    params.category = '';
    params.diploma = '';
    params.sort = 'newest';
    params.page = 1;

    // Update the URL and re-run the search
    updateBrowserUrl(params);

    // Reset the filter form controls
    const categorySelect = document.getElementById('filterCategory');
    if (categorySelect) categorySelect.value = '';

    const diplomaInput = document.getElementById('filterDiploma');
    if (diplomaInput) diplomaInput.value = '';

    const sortSelect = document.getElementById('filterSort');
    if (sortSelect) sortSelect.value = 'newest';

    runSearch();
  }

  // No Results Clear button
  if (event.target && event.target.id === 'noResultsClearBtn') {
    document.getElementById('clearFiltersBtn').click();
  }
});

