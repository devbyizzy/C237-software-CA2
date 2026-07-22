document.addEventListener('DOMContentLoaded', function () {
  loadCcas();
  initQuiz();
});

function getIconForCategory(category) {
  var theme = (window.RPCCA && window.RPCCA.getCategoryTheme) ? window.RPCCA.getCategoryTheme(category || '') : { gradient: ['#3A3A5C','#5A5A7A','#8A8AAA'], icon: 'ti-star' };
  return theme.icon || 'ti-star';
}

async function loadCcas() {
  const container = document.getElementById('ccaResults');
  const countEl = document.getElementById('resultsCount');
  if (!container) return;

  try {
    const res = await fetch(`${window.API_BASE_URL}/api/ccas`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    renderResults(data.results);
    if (countEl) countEl.textContent = `${data.count} CCA${data.count === 1 ? '' : 's'} found`;
    window.__allCcas = data.results || [];
    renderSidebarWidgets();
  } catch (err) {
    console.error('Failed to load CCAs:', err);
    if (countEl) countEl.textContent = '';
    container.innerHTML = `<div class="card" style="border-color:#e11d48"><p class="card-content">Couldn't reach the backend API at ${window.API_BASE_URL}. Make sure the backend server is running.</p></div>`;
  }
}

function renderSidebarWidgets() {
  renderPopularCcas();
  renderUpcomingSessions();
  renderCategories();
}

function renderResults(results) {
  const container = document.getElementById('ccaResults');
  if (!container) return;
  if (!results.length) {
    container.innerHTML = `<div class="card"><p class="empty-state">No CCAs to display.</p></div>`;
    return;
  }
  container.innerHTML = results.map(renderCcaCard).join('');
}

function renderCcaCard(c) {
  return `
    <a class="card student-card" href="/ccas/${c.cca_id}">
      <div class="cca-banner" data-category="${escapeHtml(c.category || '')}">
        <div class="cca-banner-bg"></div>
        ${c.image ? `<img class="cca-banner-img" src="${escapeHtml(c.image)}" alt="${escapeHtml(c.cca_name)}" onerror="this.style.display='none'" />` : ''}
        <div class="cca-banner-overlay"></div>
        <div class="cca-banner-deco">
          <span class="cca-icon-blob cca-icon-blob--lg"><i class="ti ${escapeHtml(getIconForCategory(c.category || ''))}"></i></span>
          <span class="cca-icon-blob cca-icon-blob--md"><i class="ti ${escapeHtml(getIconForCategory(c.category || ''))}"></i></span>
          <span class="cca-icon-blob cca-icon-blob--sm"><i class="ti ${escapeHtml(getIconForCategory(c.category || ''))}"></i></span>
        </div>
        <div class="cca-banner-text">
          <p class="cca-banner-name">${escapeHtml(c.cca_name)}</p>
          <span class="badge" style="background:rgba(255,255,255,0.18); color:#fff;">${escapeHtml(c.category || '')}</span>
        </div>
      </div>
      <p class="card-content" style="margin-top:8px; margin-bottom:0;">${escapeHtml(c.description)}</p>
      ${c.training_day ? `<p class="mini-meta" style="margin-top:8px;">📅 ${escapeHtml(c.training_day)}${c.training_time ? ' · ' + escapeHtml(c.training_time) : ''}</p>` : ''}
    </a>`;
}

function initQuiz() {
  const startBtn = document.getElementById('startQuizBtn');
  const closeBtn = document.getElementById('quizCloseBtn');
  const overlay = document.getElementById('quizOverlay');

  if (startBtn) {
    startBtn.addEventListener('click', function () {
      window.__quizStep = 1;
      window.__quizAnswers = {};
      showQuizStep(1);
      overlay.style.display = 'block';
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      overlay.style.display = 'none';
    });
  }

  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  }
}

function showQuizStep(step) {
  const body = document.getElementById('quizBody');
  const title = document.getElementById('quizTitle');
  if (!body || !title) return;

  title.textContent = '🧭 CCA Finder Quiz';

  if (step === 1) {
    body.innerHTML = quizStep1Html();
  } else if (step === 2) {
    body.innerHTML = quizStep2Html();
  } else if (step === 3) {
    body.innerHTML = quizStep3Html();
  } else if (step === 4) {
    body.innerHTML = quizStep4Html();
  } else if (step === 5) {
    body.innerHTML = quizStep5Html();
  }

  window.__quizStep = step;
  bindQuizNav();
}

function quizStep1Html() {
  return `
    <div class="quiz-step">
      <p class="quiz-question">1. What type of activities do you enjoy?</p>
      <div class="quiz-options">
        <label class="quiz-option"><input type="radio" name="activity" value="physical" /> Physical / Sports</label>
        <label class="quiz-option"><input type="radio" name="activity" value="creative" /> Creative / Arts</label>
        <label class="quiz-option"><input type="radio" name="activity" value="technical" /> Technical / Building</label>
        <label class="quiz-option"><input type="radio" name="activity" value="social" /> Social / Teams</label>
        <label class="quiz-option"><input type="radio" name="activity" value="explore" /> Explore all options</label>
      </div>
      <div class="quiz-actions">
        <button class="btn btn-primary" id="qNext1">Next</button>
      </div>
    </div>`;
}

function quizStep2Html() {
  return `
    <div class="quiz-step">
      <p class="quiz-question">2. How much time can you commit per week?</p>
      <div class="quiz-options">
        <label class="quiz-option"><input type="radio" name="commitment" value="casual" /> Casual (1-2 hours)</label>
        <label class="quiz-option"><input type="radio" name="commitment" value="moderate" /> Moderate (3-5 hours)</label>
        <label class="quiz-option"><input type="radio" name="commitment" value="competitive" /> Competitive (5+ hours)</label>
      </div>
      <div class="quiz-actions">
        <button class="btn btn-outline" id="qBack2">Back</button>
        <button class="btn btn-primary" id="qNext2">Next</button>
      </div>
    </div>`;
}

function quizStep3Html() {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const checks = days.map(function(d) {
    return `<label class="quiz-option"><input type="checkbox" name="days" value="${d}" /> ${d}</label>`;
  }).join('');
  return `
    <div class="quiz-step">
      <p class="quiz-question">3. Preferred day(s) for sessions?</p>
      <div class="quiz-options">
        ${checks}
      </div>
      <div class="quiz-actions">
        <button class="btn btn-outline" id="qBack3">Back</button>
        <button class="btn btn-primary" id="qNext3">Next</button>
      </div>
    </div>`;
}

function quizStep4Html() {
  return `
    <div class="quiz-step">
      <p class="quiz-question">4. Do you prefer indoor or outdoor activities?</p>
      <div class="quiz-options">
        <label class="quiz-option"><input type="radio" name="environment" value="indoor" /> Indoor</label>
        <label class="quiz-option"><input type="radio" name="environment" value="outdoor" /> Outdoor</label>
        <label class="quiz-option"><input type="radio" name="environment" value="either" /> Either</label>
      </div>
      <div class="quiz-actions">
        <button class="btn btn-outline" id="qBack4">Back</button>
        <button class="btn btn-primary" id="qNext4">Next</button>
      </div>
    </div>`;
}

function quizStep5Html() {
  return `
    <div class="quiz-step">
      <p class="quiz-question">5. Are you looking to try something new or build on existing skills?</p>
      <div class="quiz-options">
        <label class="quiz-option"><input type="radio" name="skillLevel" value="new" /> Try something new</label>
        <label class="quiz-option"><input type="radio" name="skillLevel" value="existing" /> Build on existing skills</label>
      </div>
      <div class="quiz-actions">
        <button class="btn btn-outline" id="qBack5">Back</button>
        <button class="btn btn-primary" id="qSubmit">See Recommendations</button>
      </div>
    </div>`;
}

function bindQuizNav() {
  const backMap = { 2: 'qBack2', 3: 'qBack3', 4: 'qBack4', 5: 'qBack5' };
  const forwardMap = { 1: 'qNext1', 2: 'qNext2', 3: 'qNext3', 4: 'qNext4' };

  Object.keys(backMap).forEach(function (s) { bindStepBtn(backMap[s], parseInt(s, 10) - 1); });
  Object.keys(forwardMap).forEach(function (s) { bindStepBtn(forwardMap[s], parseInt(s, 10) + 1); });

  const submitBtn = document.getElementById('qSubmit');
  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      persistAnswersForCurrentStep();
      submitQuiz();
    });
  }
}

function bindStepBtn(id, step) {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener('click', function () {
      persistAnswersForCurrentStep();
      window.__quizStep = step;
      showQuizStep(step);
    });
  }
}

function persistAnswersForCurrentStep() {
  const step = window.__quizStep || 1;
  if (step === 1) {
    var activity = getRadioValue('activity');
    if (activity) window.__quizAnswers.activity = activity;
  } else if (step === 2) {
    var commitment = getRadioValue('commitment');
    if (commitment) window.__quizAnswers.commitment = commitment;
  } else if (step === 3) {
    window.__quizAnswers.days = Array.from(document.querySelectorAll('input[name="days"]:checked')).map(function(el){ return el.value; });
  } else if (step === 4) {
    var environment = getRadioValue('environment');
    if (environment) window.__quizAnswers.environment = environment;
  } else if (step === 5) {
    var skillLevel = getRadioValue('skillLevel');
    if (skillLevel) window.__quizAnswers.skillLevel = skillLevel;
  }
}

function readAnswers() {
  var activity    = window.__quizAnswers.activity    || 'explore';
  var commitment  = window.__quizAnswers.commitment  || 'moderate';
  var days        = window.__quizAnswers.days       || [];
  var environment = window.__quizAnswers.environment || 'either';
  var skillLevel  = window.__quizAnswers.skillLevel  || 'new';
  return { activity: activity, commitment: commitment, days: days, environment: environment, skillLevel: skillLevel };
}

function submitQuiz() {
  const body = document.getElementById('quizBody');
  const title = document.getElementById('quizTitle');
  if (!body || !title) return;

  var answers = readAnswers();

  var ccas = window.__allCcas || [];
  var matches = computeCcaMatches(answers, ccas);

  if (!matches.length) {
    title.textContent = '🧭 CCA Finder Quiz';
    body.innerHTML = `
      <div class="quiz-step" style="display:flex; flex-direction:column; justify-content:center; min-height:180px; gap:14px;">
        <p class="quiz-question" style="margin-bottom:0;">No tight matches found.</p>
        <p class="card-content">Try broadening your preferences, or browse the full CCA list below.</p>
        <div class="quiz-actions">
          <button class="btn btn-outline" id="qDismiss">Dismiss</button>
          <button class="btn btn-primary" id="qRetake">Retake Quiz</button>
        </div>
      </div>`;
    document.getElementById('qDismiss').addEventListener('click', function() {
      document.getElementById('quizOverlay').style.display = 'none';
    });
    document.getElementById('qRetake').addEventListener('click', function() {
      window.__quizStep = 1;
      showQuizStep(1);
    });
    return;
  }

  title.textContent = '🧭 CCA Finder Quiz — Your Matches';
  body.innerHTML = `
    <div class="quiz-step" style="display:flex; flex-direction:column; justify-content:center; min-height:220px; gap:16px;">
      <p class="quiz-question" style="margin-bottom:0;">Top matches for you</p>
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${matches.map(function (m) {
          return `
          <div class="quiz-match">
            <h4 style="font-weight:700; margin-bottom:6px;">${escapeHtml(m.cca.cca_name || '')}</h4>
            <span class="badge" style="margin-bottom:8px; display:inline-block;">${escapeHtml(m.cca.category || '')}</span>
            <p class="card-content" style="margin-bottom:6px;">${escapeHtml(m.cca.description || '')}</p>
            <p class="mini-meta" style="margin-top:8px;">📅 ${escapeHtml(m.cca.training_day || 'TBD')}${m.cca.training_time ? ' · ' + escapeHtml(m.cca.training_time) : ''} · 📍 ${escapeHtml(m.cca.location || 'TBD')}</p>
            <p style="font-size:13px; color:var(--accent); margin-top:10px;">💡 ${escapeHtml(m.reasons.join('. ') + '.')}</p>
          </div>`;
        }).join('')}
      </div>
      <div class="quiz-actions">
        <button class="btn btn-outline" id="qDismiss2">Dismiss</button>
        <button class="btn btn-primary" id="qRetake2">Retake Quiz</button>
      </div>
    </div>`;

  document.getElementById('qDismiss2').addEventListener('click', function() {
    document.getElementById('quizOverlay').style.display = 'none';
  });
  document.getElementById('qRetake2').addEventListener('click', function() {
    window.__quizStep = 1;
    showQuizStep(1);
  });
}

function getRadioValue(name) {
  var checked = document.querySelector('input[name="' + name + '"]:checked');
  return checked ? checked.value : '';
}

function computeCcaMatches(answers, ccas) {
  var scored = ccas.map(function(cca) {
    var score = 0;
    var reasons = [];
    var haystack = ((cca.cca_name || '') + ' ' + (cca.description || '') + ' ' + (cca.category || '')).toLowerCase();
    var loc = ((cca.location || '') + ' ' + (cca.description || '')).toLowerCase();

    var activity = String(answers.activity || '').toLowerCase();

    if (activity && activity !== 'explore') {
      var matchesActivity = false;
      if (activity === 'physical' && /sports/.test(haystack)) { matchesActivity = true; score += 10; reasons.push("Matches your interest in Sports"); }
      if (activity === 'creative' && /arts|art|music|photo|paint|drama|dance/.test(haystack)) { matchesActivity = true; score += 10; reasons.push("Matches your interest in Arts / creative activities"); }
      if (activity === 'technical' && /tech|robot|code|program|build|mach|auto|game|computer|engineer|makerspace/.test(haystack)) { matchesActivity = true; score += 10; reasons.push("Matches your interest in Technology / hands-on building"); }
      if (activity === 'social' && /club|social|team|community|service|volunteer/.test(haystack)) { matchesActivity = true; score += 8; reasons.push("Great for socializing and teamwork"); }
      if (!matchesActivity) {
        return { cca: cca, score: 0, reasons: [] };
      }
    } else if (activity === 'explore') {
      if (/club|society|life|social/.test(haystack)) { score += 3; reasons.push("A friendly way to explore different interests"); }
    }

    if (answers.days && answers.days.length > 0 && cca.training_day) {
      var matchDay = answers.days.find(function(d) { return cca.training_day.toLowerCase() === d.toLowerCase(); });
      if (matchDay) {
        score += 2;
        reasons.push("Fits your availability on " + matchDay);
      }
    }

    if (answers.environment) {
      if (answers.environment === 'indoor' && /indoor|lab|studio|makerspace|library|block|room/.test(loc)) { score += 2; reasons.push("Indoor activities match your preference"); }
      if (answers.environment === 'outdoor' && /outdoor|field|park|complex|hall/.test(loc)) { score += 2; reasons.push("Outdoor activities match your preference"); }
      if (answers.environment === 'either') { score += 1; }
    }

    if (answers.skillLevel === 'new' && /all levels welcome|beginner|intro|basic|learn/.test(haystack)) { score += 2; reasons.push("Welcomes beginners and new learners"); }
    if (answers.skillLevel === 'existing' && /competitive|advanced|experienced|intermediate/.test(haystack)) { score += 2; reasons.push("Good for building on existing skills"); }

    return { cca: cca, score: score, reasons: reasons };
  });

  return scored
    .filter(function(s) { return s.score > 0; })
    .sort(function(a, b) { return b.score - a.score; })
    .slice(0, 3);
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

// ==============================
// Sidebar widgets
// ==============================
var DAY_ORDER = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

function dayIndex(name) {
  if (!name) return 7;
  return DAY_ORDER.indexOf(String(name).trim().toLowerCase());
}

function minutesFromMidnight(timeStr) {
  if (!timeStr) return 1440;
  var parts = String(timeStr).slice(0,5).split(':');
  if (parts.length < 2) return 1440;
  var h = parseInt(parts[0], 10) || 0;
  var m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function sortKeyForUpcoming(cca) {
  var today = new Date().getDay(); // 0-6
  var target = dayIndex(cca.training_day);
  var diff = target - today;
  if (diff <= 0) diff += 7;
  var startMin = minutesFromMidnight(cca.training_time);
  return diff * 1440 + startMin;
}

function renderSidebarWidgets() {
  renderPopularCcas();
  renderUpcomingSessions();
  renderCategories();
}

function renderPopularCcas() {
  var panel = document.getElementById('popularCcasPanel');
  var container = document.getElementById('popularCcasContent');
  if (!panel || !container) return;

  var ccas = (window.__allCcas || []).slice();
  ccas.sort(function(a, b) {
    var ma = parseInt(a.member_count || '0', 10) || 0;
    var mb = parseInt(b.member_count || '0', 10) || 0;
    if (mb !== ma) return mb - ma;
    return (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime());
  });

  var top = ccas.slice(0, 4);
  if (!top.length) {
    container.innerHTML = '<p class="empty-state">No CCAs yet.</p>';
    return;
  }

  var html = '<div style="display:flex; flex-direction:column; gap:8px;">';
  top.forEach(function(c, idx) {
    html += '<div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border);">';
    html += '<div style="width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:rgba(0,245,255,0.08); color:var(--accent); font-size:12px; font-weight:700;">' + (idx + 1) + '</div>';
    html += '<div style="min-width:0;"><p class="mini-title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + escapeHtml(c.cca_name) + '</p>';
    html += '<p class="mini-meta">' + parseInt(c.member_count || '0', 10) + ' members</p>';
    html += '</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderUpcomingSessions() {
  var container = document.getElementById('upcomingSessionsContent');
  if (!container) return;

  var ccas = (window.__allCcas || []).slice();
  ccas = ccas.filter(function(c) { return c.training_day && c.training_time; });
  if (!ccas.length) {
    container.innerHTML = '<p class="empty-state">No scheduled sessions yet.</p>';
    return;
  }

  ccas.sort(function(a, b) { return sortKeyForUpcoming(a) - sortKeyForUpcoming(b); });
  var next = ccas.slice(0, 3);

  var html = '<div style="display:flex; flex-direction:column; gap:8px;">';
  next.forEach(function(c) {
    var day = escapeHtml(c.training_day || 'TBD');
    var time = escapeHtml(c.training_time || '');
    var loc = escapeHtml(c.location || '');
    html += '<div style="padding:6px 0; border-bottom:1px solid var(--border);">';
    html += '<p class="mini-title" style="margin-bottom:2px;">' + escapeHtml(c.cca_name) + '</p>';
    html += '<p class="mini-meta">📅 ' + day + (time ? ' · ' + time : '') + (loc ? ' · 📍 ' + loc : '') + '</p>';
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderCategories() {
  var container = document.getElementById('categoriesContent');
  if (!container) return;

  var ccas = window.__allCcas || [];
  var map = {};
  ccas.forEach(function(c) {
    var key = String(c.category || 'Uncategorized').trim() || 'Uncategorized';
    map[key] = (map[key] || 0) + 1;
  });

  var categories = Object.keys(map).sort();
  if (!categories.length) {
    container.innerHTML = '<span class="empty-state">No categories yet.</span>';
    return;
  }

  var html = '<a href="#" class="tag" data-category="" style="background:rgba(42,42,58,0.35);color:var(--text-muted);border-color:var(--border);">All</a>';
  categories.forEach(function(cat) {
    var count = map[cat];
    html += '<a href="#" class="tag" data-category="' + escapeHtml(cat) + '">' + escapeHtml(cat) + ' · ' + count + '</a>';
  });
  container.innerHTML = html;

  container.querySelectorAll('.tag').forEach(function(tag) {
    tag.addEventListener('click', function(e) {
      e.preventDefault();
      var cat = tag.getAttribute('data-category');
      filterGridByCategory(cat);
    });
  });
}

function filterGridByCategory(category) {
  var all = window.__allCcas || [];
  if (!category) {
    renderResults(all);
  } else {
    renderResults(all.filter(function(c) {
      return String(c.category || 'Uncategorized').trim() === category;
    }));
  }
  var countEl = document.getElementById('resultsCount');
  if (countEl) {
    var list = category ? all.filter(function(c) { return String(c.category || 'Uncategorized').trim() === category; }) : all;
    countEl.textContent = list.length + ' CCA' + (list.length === 1 ? '' : 's') + ' found';
  }
}
