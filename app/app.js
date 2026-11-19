// Leonida Ledger — GTA 6 trophy guide and tracker.
// Static, offline: the only thing it loads is data/trophies.json from this same app.
// Progress lives in localStorage on this device and can be exported or imported.
const STORAGE_KEY = 'leonida-ledger-v1';
const KIND_LABELS = {
  story: 'Story',
  missable: 'Missable',
  collectibles: 'Collectibles',
  activities: 'Activities',
  online: 'Online',
};

const state = {
  earned: new Set(),
  spoiler: false,
  kind: 'all',
  grade: 'all',
  query: '',
  openId: null,
};

let doc = null;

const $ = (id) => document.getElementById(id);
const listEl = $('trophyList');
const detailEl = $('detail');

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    state.earned = new Set(Array.isArray(raw.earned) ? raw.earned : []);
    state.spoiler = raw.spoiler === true;
  } catch {
    state.earned = new Set();
    state.spoiler = false;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    earned: [...state.earned].sort((a, b) => a - b),
    spoiler: state.spoiler,
  }));
}

function trophyById(id) {
  return doc.trophies.find((t) => t.id === id);
}

function isSpoilerHidden(t) {
  return state.spoiler && t.kind === 'story' && !state.earned.has(t.id);
}

function gradeDot(t) {
  const dot = document.createElement('span');
  dot.className = 'trophy-grade-dot ' + t.grade;
  dot.title = t.grade;
  return dot;
}

function tag(text, cls) {
  const s = document.createElement('span');
  s.className = 'tag' + (cls ? ' ' + cls : '');
  s.textContent = text;
  return s;
}

function trophyCard(t) {
  const li = document.createElement('li');
  li.className = 'trophy-card' + (state.earned.has(t.id) ? ' earned' : '') + (state.openId === t.id ? ' open' : '');
  li.dataset.id = t.id;

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = state.earned.has(t.id);
  box.setAttribute('aria-label', 'Mark ' + t.name + ' as earned');
  box.addEventListener('click', (e) => e.stopPropagation());
  box.addEventListener('change', () => {
    if (box.checked) state.earned.add(t.id);
    else state.earned.delete(t.id);
    saveState();
    renderAll();
  });
  li.append(box);

  const body = document.createElement('div');
  const hidden = isSpoilerHidden(t);
  const name = document.createElement('div');
  name.className = 'trophy-name';
  name.textContent = hidden ? '???????? — hidden story trophy' : t.name;
  body.append(name);

  const desc = document.createElement('div');
  desc.className = 'trophy-desc';
  desc.textContent = hidden ? 'Spoilers on: earn this trophy to reveal its name and description.' : t.description;
  body.append(desc);

  const meta = document.createElement('div');
  meta.className = 'trophy-meta';
  meta.append(tag(t.grade, 'grade-' + t.grade));
  meta.append(tag(KIND_LABELS[t.kind] || t.kind));
  if (t.missable) meta.append(tag('Missable', 'missable'));
  if (t.hidden) meta.append(tag('Hidden', 'hidden-tag'));
  if (typeof t.count === 'number') meta.append(tag('× ' + t.count.toLocaleString('en-US'), 'count-tag'));
  body.append(meta);
  li.append(body);
  li.append(gradeDot(t));

  li.addEventListener('click', () => {
    state.openId = state.openId === t.id ? null : t.id;
    location.hash = state.openId ? '#/trophy/' + t.id : '#/checklist';
    renderAll();
  });
  return li;
}

function filteredTrophies() {
  const q = state.query.trim().toLowerCase();
  return doc.trophies.filter((t) => {
    if (state.kind !== 'all' && t.kind !== state.kind) return false;
    if (state.grade !== 'all' && t.grade !== state.grade) return false;
    if (q && !(t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))) return false;
    return true;
  });
}

function renderProgress() {
  const earned = state.earned.size;
  const total = doc.trophies.length;
  const pct = Math.round((earned / total) * 100);
  $('earnedCount').textContent = earned;
  $('progressFill').style.width = pct + '%';
  $('progressLabel').textContent = pct + '% to the platinum';
  const counts = {};
  for (const t of doc.trophies) {
    if (state.earned.has(t.id)) counts[t.grade] = (counts[t.grade] || 0) + 1;
  }
  const totals = {};
  for (const t of doc.trophies) totals[t.grade] = (totals[t.grade] || 0) + 1;
  $('gradeCounts').textContent =
    'Platinum ' + (counts.platinum || 0) + '/' + totals.platinum +
    ' · Gold ' + (counts.gold || 0) + '/' + totals.gold +
    ' · Silver ' + (counts.silver || 0) + '/' + totals.silver +
    ' · Bronze ' + (counts.bronze || 0) + '/' + totals.bronze;
}

function renderList() {
  const items = filteredTrophies();
  listEl.replaceChildren();
  if (items.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-note';
    li.textContent = state.kind === 'online'
      ? 'No online trophies: all 55 trophies are single-player and offline. PowerPyx and Push Square both confirm there are no online trophies at launch.'
      : 'No trophies match this filter. Clear the search or pick another kind.';
    listEl.append(li);
  } else {
    for (const t of items) listEl.append(trophyCard(t));
  }
  $('listMeta').textContent = 'Showing ' + items.length + ' of ' + doc.trophies.length + ' trophies' +
    (state.spoiler ? ' · spoilers hidden for unearned story trophies' : '');
}

function renderDetail() {
  detailEl.replaceChildren();
  const t = state.openId ? trophyById(state.openId) : null;
  if (!t) {
    const p = document.createElement('p');
    p.className = 'detail-empty';
    p.textContent = 'Pick a trophy to open its guide, steps and sources.';
    detailEl.append(p);
    return;
  }
  const hidden = isSpoilerHidden(t);
  const h = document.createElement('h3');
  h.textContent = hidden ? 'Hidden story trophy' : t.name;
  detailEl.append(h);

  const official = document.createElement('p');
  official.className = 'official';
  official.textContent = hidden
    ? 'Spoilers on: earn this trophy to reveal its official name and description.'
    : 'Official: "' + t.description + '" — ' + t.grade + (t.hidden ? ' · hidden on PlayStation' : '');
  detailEl.append(official);

  if (t.missable) {
    const warn = document.createElement('p');
    warn.className = 'missable-warning';
    warn.textContent = 'Missable — this is the only trophy in the set reported as missable. Do it in Chapter 1, before that chapter ends.';
    detailEl.append(warn);
  }

  const chapter = document.createElement('p');
  chapter.className = 'chapter-line';
  chapter.textContent = 'Where: ' + t.chapter + ' · Roadmap stage ' + t.stage +
    (typeof t.count === 'number' ? ' · Target: ' + t.count.toLocaleString('en-US') : '');
  detailEl.append(chapter);

  const guideTitle = document.createElement('h4');
  guideTitle.textContent = 'Guide';
  detailEl.append(guideTitle);
  const guide = document.createElement('p');
  guide.textContent = hidden ? 'Guide hidden until earned.' : t.guide;
  detailEl.append(guide);

  if (!hidden && Array.isArray(t.steps) && t.steps.length) {
    const stepsTitle = document.createElement('h4');
    stepsTitle.textContent = 'Steps';
    detailEl.append(stepsTitle);
    const ol = document.createElement('ol');
    for (const s of t.steps) {
      const li = document.createElement('li');
      li.textContent = s;
      ol.append(li);
    }
    detailEl.append(ol);
  }

  if (!hidden) {
    const srcTitle = document.createElement('h4');
    srcTitle.textContent = 'Sources';
    detailEl.append(srcTitle);
    const ul = document.createElement('ul');
    ul.className = 'sources';
    for (const s of t.sources) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = s.url;
      a.textContent = s.name;
      a.target = '_blank';
      a.rel = 'noopener';
      li.append(a);
      ul.append(li);
    }
    detailEl.append(ul);
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'earn-btn' + (state.earned.has(t.id) ? ' earned' : '');
  btn.textContent = state.earned.has(t.id) ? 'Earned — tap to unmark' : 'Mark as earned';
  btn.addEventListener('click', () => {
    if (state.earned.has(t.id)) state.earned.delete(t.id);
    else state.earned.add(t.id);
    saveState();
    renderAll();
  });
  detailEl.append(btn);
}

function renderRoadmap() {
  const ol = $('roadmapList');
  ol.replaceChildren();
  for (const stage of doc.roadmap) {
    const li = document.createElement('li');
    li.className = 'roadmap-stage';
    const h = document.createElement('h3');
    h.textContent = 'Stage ' + stage.stage + ' — ' + stage.title;
    li.append(h);
    const time = document.createElement('p');
    time.className = 'stage-time';
    time.textContent = stage.time;
    li.append(time);
    const text = document.createElement('p');
    text.textContent = stage.text;
    li.append(text);
    const ul = document.createElement('ul');
    for (const id of stage.trophies) {
      const t = trophyById(id);
      if (!t) continue;
      const item = document.createElement('li');
      const hidden = isSpoilerHidden(t);
      item.textContent = (hidden ? 'Hidden story trophy' : t.name) +
        ' (' + t.grade + ')' + (t.missable ? ' — MISSABLE' : '');
      ul.append(item);
    }
    li.append(ul);
    ol.append(li);
  }
}

function renderMissable() {
  const ul = $('missableList');
  ul.replaceChildren();
  const items = doc.trophies.filter((t) => t.missable);
  for (const t of items) ul.append(trophyCard(t));
  $('missableBadge').textContent = items.length;
}

function showView(name) {
  for (const v of ['checklist', 'roadmap', 'missable']) {
    $('view-' + v).hidden = v !== name;
  }
  for (const a of document.querySelectorAll('.tabs a')) {
    a.classList.toggle('active', a.dataset.view === name);
  }
}

function route() {
  const hash = location.hash || '#/checklist';
  const parts = hash.replace(/^#\//, '').split('/');
  if (parts[0] === 'trophy' && parts[1]) {
    state.openId = Number(parts[1]) || null;
    showView('checklist');
  } else if (parts[0] === 'roadmap') {
    state.openId = null;
    showView('roadmap');
  } else if (parts[0] === 'missable') {
    state.openId = null;
    showView('missable');
  } else {
    state.openId = null;
    showView('checklist');
  }
  renderAll();
}

function renderAll() {
  if (!doc) return;
  renderProgress();
  renderList();
  renderDetail();
  renderRoadmap();
  renderMissable();
}

function exportProgress() {
  const blob = new Blob([JSON.stringify({
    game: 'Grand Theft Auto VI',
    exported: 'leonida-ledger',
    earned: [...state.earned].sort((a, b) => a - b),
    spoiler: state.spoiler,
  }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importProgress(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const ids = Array.isArray(data) ? data : data.earned;
    const valid = new Set(doc.trophies.map((t) => t.id));
    state.earned = new Set((Array.isArray(ids) ? ids : []).map(Number).filter((id) => valid.has(id)));
    if (typeof data.spoiler === 'boolean') state.spoiler = data.spoiler;
    saveState();
    $('spoilerToggle').checked = state.spoiler;
    renderAll();
  } catch {
    alert('That file is not a Leonida Ledger progress export.');
  }
}

async function boot() {
  loadState();
  const res = await fetch('data/trophies.json');
  doc = await res.json();

  $('spoilerToggle').checked = state.spoiler;
  $('spoilerToggle').addEventListener('change', (e) => {
    state.spoiler = e.target.checked;
    saveState();
    renderAll();
  });
  $('search').addEventListener('input', (e) => {
    state.query = e.target.value;
    renderList();
  });
  $('gradeFilter').addEventListener('change', (e) => {
    state.grade = e.target.value;
    renderList();
  });
  $('kindChips').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-kind]');
    if (!btn) return;
    state.kind = btn.dataset.kind;
    for (const b of $('kindChips').querySelectorAll('button')) {
      b.classList.toggle('active', b === btn);
    }
    renderList();
  });
  $('exportBtn').addEventListener('click', exportProgress);
  $('importFile').addEventListener('change', (e) => {
    importProgress(e.target.files[0]);
    e.target.value = '';
  });
  $('resetBtn').addEventListener('click', () => {
    if (confirm('Clear all earned trophies and the spoiler setting?')) {
      state.earned = new Set();
      state.spoiler = false;
      $('spoilerToggle').checked = false;
      saveState();
      renderAll();
    }
  });

  window.addEventListener('hashchange', route);
  route();
}

boot();
