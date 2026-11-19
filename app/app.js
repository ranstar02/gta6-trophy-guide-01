// Leonida Trophy Atlas — offline GTA 6 trophy guide + tracker.
// No build step, no network at runtime: the only fetch is the local data file.
// Progress lives in localStorage; export/import move it as a JSON file.
// URL helpers (for deep links and for the maker's screenshots):
//   ?seed=N       mark the first N trophies earned (only when no saved progress exists)
//   ?detail=ID    open trophy ID in the detail pane
//   ?tab=roadmap|missable|checklist   open a tab
//   ?filter=story|missable|collectibles|activities|online
//   ?spoilers=1   turn the spoiler shield on
//   ?grade=silver|gold|...            filter by grade

const STORAGE_KEY = 'leonida-trophy-atlas-v1';
const DATA_URL = 'data/trophies.json';

const GRADE_LABELS = { platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };
const KIND_LABELS = {
  story: 'Story', missable: 'Missable', collectibles: 'Collectibles',
  activities: 'Activities', online: 'Online',
};
const GRADE_DOT_COLORS = {
  platinum: '#e8ecf4', gold: '#ffd166', silver: '#c9d2de', bronze: '#d9905f',
};

const state = {
  trophies: [],
  roadmap: [],
  earned: new Set(),
  counts: {},
  kindFilter: 'all',
  gradeFilter: 'all',
  query: '',
  spoilerShield: false,
  selectedId: null,
  activeTab: 'checklist',
};

const $ = (id) => document.getElementById(id);
const listEl = $('trophy-list');
const detailEl = $('detail-col');
const metaEl = $('list-meta');
const emptyNoteEl = $('empty-note');

function loadSavedProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveProgress() {
  const payload = {
    earned: [...state.earned].sort((a, b) => a - b),
    counts: state.counts,
    spoilerShield: state.spoilerShield,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or unavailable (private mode): the tracker still works in memory.
  }
  $('save-note').textContent =
    'Progress saved in this browser (localStorage). Nothing leaves your device.';
}

function applyDemoParams() {
  const params = new URLSearchParams(window.location.search);
  const saved = loadSavedProgress();
  if (saved) {
    state.earned = new Set(saved.earned || []);
    state.counts = saved.counts || {};
    state.spoilerShield = Boolean(saved.spoilerShield);
  } else if (params.has('seed')) {
    const seedCount = Math.max(0, Math.min(state.trophies.length, Number(params.get('seed')) || 0));
    for (let i = 0; i < seedCount; i += 1) state.earned.add(state.trophies[i].id);
    for (const trophy of state.trophies) {
      if (trophy.count && state.earned.has(trophy.id)) state.counts[trophy.id] = trophy.count;
    }
    saveProgress();
  }
  if (params.get('spoilers') === '1') state.spoilerShield = true;
  if (params.get('filter') && KIND_LABELS[params.get('filter')]) state.kindFilter = params.get('filter');
  if (params.get('grade') && (params.get('grade') === 'all' || GRADE_LABELS[params.get('grade')])) {
    state.gradeFilter = params.get('grade');
  }
  if (params.get('tab') && ['checklist', 'roadmap', 'missable'].includes(params.get('tab'))) {
    state.activeTab = params.get('tab');
  }
  if (params.get('detail')) {
    const wanted = Number(params.get('detail'));
    if (state.trophies.some((t) => t.id === wanted)) state.selectedId = wanted;
  }
}

function trophyIsHiddenByShield(trophy) {
  return state.spoilerShield && trophy.kind === 'story' && !state.earned.has(trophy.id);
}

function displayName(trophy) {
  return trophyIsHiddenByShield(trophy) ? 'Hidden story trophy' : trophy.name;
}

function displayDescription(trophy) {
  return trophyIsHiddenByShield(trophy)
    ? 'Spoiler shield is on — earn this trophy to reveal its name and description.'
    : trophy.description;
}

function visibleTrophies() {
  const query = state.query.trim().toLowerCase();
  return state.trophies.filter((trophy) => {
    if (state.kindFilter !== 'all' && trophy.kind !== state.kindFilter) return false;
    if (state.gradeFilter !== 'all' && trophy.grade !== state.gradeFilter) return false;
    if (query) {
      const haystack = `${trophy.name} ${trophy.description} ${trophy.area || ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function gradeBreakdown() {
  const earned = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  const totals = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const trophy of state.trophies) {
    totals[trophy.grade] += 1;
    if (state.earned.has(trophy.id)) earned[trophy.grade] += 1;
  }
  return { earned, totals };
}

function renderProgress() {
  const earnedCount = state.earned.size;
  $('earned-count').textContent = String(earnedCount);
  const fill = $('progress-fill');
  fill.style.width = `${Math.round((earnedCount / state.trophies.length) * 100)}%`;
  $('progress-bar').setAttribute('aria-valuenow', String(earnedCount));
  const { earned, totals } = gradeBreakdown();
  $('grade-counts').innerHTML = Object.keys(GRADE_LABELS)
    .map((grade) => `<span><span class="grade-dot" style="background:${GRADE_DOT_COLORS[grade]}"></span>${GRADE_LABELS[grade]} <b>${earned[grade]}/${totals[grade]}</b></span>`)
    .join('');
}

function countLabel(trophy) {
  if (!trophy.count) return '';
  const current = state.counts[trophy.id] || 0;
  const unit = trophy.count >= 1000 ? `$${trophy.count.toLocaleString('en-US')}` : String(trophy.count);
  return `Progress: ${current.toLocaleString('en-US')} / ${unit}`;
}

function trophyCard(trophy) {
  const item = document.createElement('li');
  const earned = state.earned.has(trophy.id);
  item.className = `trophy-card${earned ? ' earned' : ''}${state.selectedId === trophy.id ? ' selected' : ''}`;
  item.dataset.id = String(trophy.id);

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = earned;
  checkbox.setAttribute('aria-label', `Mark ${trophy.name} as earned`);
  checkbox.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleEarned(trophy.id, checkbox.checked);
  });

  const body = document.createElement('div');
  const name = document.createElement('div');
  name.className = `trophy-name${trophyIsHiddenByShield(trophy) ? ' spoiler-name' : ''}`;
  name.textContent = displayName(trophy);
  const desc = document.createElement('div');
  desc.className = 'trophy-desc';
  desc.textContent = displayDescription(trophy);
  const meta = document.createElement('div');
  meta.className = 'trophy-meta';
  meta.innerHTML =
    `<span class="tag grade-${trophy.grade}">${GRADE_LABELS[trophy.grade]}</span>` +
    (trophy.kind === 'missable' ? '' : `<span class="tag kind">${KIND_LABELS[trophy.kind] || trophy.kind}</span>`) +
    (trophy.missable ? '<span class="tag missable">Missable</span>' : '') +
    (trophy.hidden ? '<span class="tag hidden-flag">Hidden on PSN</span>' : '');
  body.append(name, desc, meta);
  if (trophy.count) {
    const counter = document.createElement('div');
    counter.className = 'count-line';
    counter.textContent = countLabel(trophy);
    body.append(counter);
  }

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'chip';
  open.textContent = 'Guide';
  open.addEventListener('click', (event) => {
    event.stopPropagation();
    selectTrophy(trophy.id);
  });

  item.append(checkbox, body, open);
  item.addEventListener('click', () => selectTrophy(trophy.id));
  return item;
}

function renderList() {
  const visible = visibleTrophies();
  listEl.innerHTML = '';
  for (const trophy of visible) listEl.append(trophyCard(trophy));
  emptyNoteEl.hidden = visible.length > 0;
  const earnedVisible = visible.filter((t) => state.earned.has(t.id)).length;
  metaEl.textContent =
    `Showing ${visible.length} of ${state.trophies.length} trophies` +
    (visible.length ? ` — ${earnedVisible} earned in this view` : '') +
    (state.kindFilter === 'online' ? ' — this game has no online trophies.' : '');
}

function renderDetail() {
  const trophy = state.trophies.find((t) => t.id === state.selectedId);
  if (!trophy) {
    detailEl.innerHTML =
      '<div class="detail-empty"><h2>Pick a trophy</h2>' +
      '<p>Select any trophy on the left to read its guide here — what to do, where, how, and when it can be missed, with the sources each fact comes from.</p>' +
      '<p>Tick the box to mark it earned. Your progress is saved in this browser.</p></div>';
    return;
  }
  const earned = state.earned.has(trophy.id);
  const shielded = trophyIsHiddenByShield(trophy);
  const sources = (trophy.sources || [])
    .map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a></li>`)
    .join('');

  detailEl.innerHTML = `
    <h2>${escapeHtml(shielded ? 'Hidden story trophy' : trophy.name)}</h2>
    <div class="trophy-meta">
      <span class="tag grade-${trophy.grade}">${GRADE_LABELS[trophy.grade]}</span>
      ${trophy.kind === 'missable' ? '' : `<span class="tag kind">${KIND_LABELS[trophy.kind] || trophy.kind}</span>`}
      ${trophy.missable ? '<span class="tag missable">Missable</span>' : ''}
      ${trophy.hidden ? '<span class="tag hidden-flag">Hidden on PSN</span>' : ''}
    </div>
    <div class="detail-official">
      <span class="label">Official description (PlayStation)</span>
      <p>${escapeHtml(displayDescription(trophy))}</p>
    </div>
    <div class="detail-guide">
      <span class="label">Guide — our own words</span>
      <p>${escapeHtml(trophy.guide)}</p>
    </div>
    <p class="detail-where"><b>Where:</b> ${escapeHtml(trophy.area || 'Leonida')}</p>
    ${trophy.count ? `<div class="counter-box" id="counter-box"></div>` : ''}
    <div class="detail-sources">
      <span class="label">Sources — where each fact comes from</span>
      <ul>${sources}</ul>
    </div>
    <label class="detail-check">
      <input type="checkbox" id="detail-earned" ${earned ? 'checked' : ''}>
      Earned — tick it off
    </label>`;

  const detailCheckbox = $('detail-earned');
  detailCheckbox.addEventListener('change', () => toggleEarned(trophy.id, detailCheckbox.checked));
  if (trophy.count) renderCounterBox(trophy);
}

function renderCounterBox(trophy) {
  const box = $('counter-box');
  if (!box) return;
  const current = state.counts[trophy.id] || 0;
  const target = trophy.count;
  const displayTarget = target >= 1000 ? `$${target.toLocaleString('en-US')}` : String(target);
  box.innerHTML = `
    <span class="label" style="flex:1 1 100%">Your progress toward this trophy</span>
    <button type="button" id="count-down" aria-label="Decrease count">−</button>
    <span class="counter-value">${current.toLocaleString('en-US')} / ${displayTarget}</span>
    <button type="button" id="count-up" aria-label="Increase count">+</button>
    <p class="counter-note">Reaching the full count marks the trophy earned automatically.</p>`;
  $('count-up').addEventListener('click', () => setCount(trophy.id, current + 1));
  $('count-down').addEventListener('click', () => setCount(trophy.id, current - 1));
}

function setCount(id, value) {
  const trophy = state.trophies.find((t) => t.id === id);
  if (!trophy || !trophy.count) return;
  const clamped = Math.max(0, Math.min(trophy.count, value));
  state.counts[id] = clamped;
  if (clamped >= trophy.count) state.earned.add(id);
  else if (state.counts[id] < trophy.count && state.earned.has(id) && clamped !== trophy.count) {
    // Lowering the count below the target un-earns a trophy only if it was earned by the counter.
    state.earned.delete(id);
  }
  saveProgress();
  renderAll();
}

function toggleEarned(id, earned) {
  if (earned) {
    state.earned.add(id);
    const trophy = state.trophies.find((t) => t.id === id);
    if (trophy && trophy.count) state.counts[id] = trophy.count;
  } else {
    state.earned.delete(id);
    const trophy = state.trophies.find((t) => t.id === id);
    if (trophy && trophy.count) state.counts[id] = 0;
  }
  saveProgress();
  renderAll();
}

function selectTrophy(id) {
  state.selectedId = id;
  renderList();
  renderDetail();
}

function renderRoadmap() {
  const list = $('roadmap-list');
  list.innerHTML = '';
  for (const stage of state.roadmap) {
    const stageTrophies = state.trophies.filter((t) => t.stage === stage.stage);
    const earned = stageTrophies.filter((t) => state.earned.has(t.id)).length;
    const item = document.createElement('li');
    item.className = 'roadmap-stage';
    item.innerHTML = `
      <div class="stage-number" aria-hidden="true">${stage.stage}</div>
      <div>
        <h3>${escapeHtml(stage.title)}</h3>
        <p>${escapeHtml(stage.detail)}</p>
        <div class="stage-trophies">${stageTrophies.map((t) =>
          `<span class="tag${state.earned.has(t.id) ? ' kind' : ''}">${escapeHtml(t.name)}</span>`).join('')}</div>
        <div class="stage-progress">${earned} of ${stageTrophies.length} trophies in this stage earned</div>
      </div>`;
    list.append(item);
  }
}

function renderMissable() {
  const list = $('missable-list');
  list.innerHTML = '';
  for (const trophy of state.trophies.filter((t) => t.missable)) {
    list.append(trophyCard(trophy));
  }
  $('missable-badge').textContent = String(state.trophies.filter((t) => t.missable).length);
}

function renderTabs() {
  for (const button of document.querySelectorAll('.tab')) {
    button.classList.toggle('active', button.dataset.tab === state.activeTab);
  }
  $('tab-checklist').hidden = state.activeTab !== 'checklist';
  $('tab-roadmap').hidden = state.activeTab !== 'roadmap';
  $('tab-missable').hidden = state.activeTab !== 'missable';
  if (state.activeTab === 'roadmap') renderRoadmap();
  if (state.activeTab === 'missable') renderMissable();
}

function renderAll() {
  renderProgress();
  renderList();
  renderDetail();
  renderTabs();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function exportProgress() {
  const payload = {
    app: 'leonida-trophy-atlas',
    game: 'Grand Theft Auto VI',
    exported: state.trophies.length,
    earned: [...state.earned].sort((a, b) => a - b),
    counts: state.counts,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'gta6-trophy-progress.json';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  $('save-note').textContent = 'Progress exported to gta6-trophy-progress.json.';
}

function importProgressFile(file) {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const earned = Array.isArray(parsed.earned) ? parsed.earned : parsed;
      const validIds = new Set(state.trophies.map((t) => t.id));
      state.earned = new Set(earned.filter((id) => validIds.has(Number(id))).map(Number));
      state.counts = {};
      if (parsed.counts && typeof parsed.counts === 'object') {
        for (const [key, value] of Object.entries(parsed.counts)) {
          if (validIds.has(Number(key))) state.counts[Number(key)] = Math.max(0, Number(value) || 0);
        }
      }
      saveProgress();
      renderAll();
      $('save-note').textContent = `Imported progress: ${state.earned.size} trophies earned.`;
    } catch {
      $('save-note').textContent = 'That file could not be read as a progress export. Nothing was changed.';
    }
  });
  reader.readAsText(file);
}

function bindControls() {
  for (const button of document.querySelectorAll('.tab')) {
    button.addEventListener('click', () => {
      state.activeTab = button.dataset.tab;
      renderTabs();
    });
  }
  for (const chip of document.querySelectorAll('#kind-filters .chip')) {
    chip.addEventListener('click', () => {
      state.kindFilter = chip.dataset.kind;
      for (const other of document.querySelectorAll('#kind-filters .chip')) {
        other.classList.toggle('active', other === chip);
      }
      renderList();
    });
  }
  for (const chip of document.querySelectorAll('.chip-grade')) {
    chip.addEventListener('click', () => {
      state.gradeFilter = chip.dataset.grade;
      for (const other of document.querySelectorAll('.chip-grade')) {
        other.classList.toggle('active', other === chip);
      }
      renderList();
    });
  }
  $('search').addEventListener('input', (event) => {
    state.query = event.target.value;
    renderList();
  });
  $('spoiler-toggle').addEventListener('change', (event) => {
    state.spoilerShield = event.target.checked;
    saveProgress();
    renderAll();
  });
  $('export-btn').addEventListener('click', exportProgress);
  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', (event) => {
    if (event.target.files && event.target.files[0]) importProgressFile(event.target.files[0]);
    event.target.value = '';
  });
  $('reset-btn').addEventListener('click', () => {
    state.earned = new Set();
    state.counts = {};
    saveProgress();
    renderAll();
    $('save-note').textContent = 'Progress reset. All 55 trophies are unticked.';
  });
}

async function bootAtlas() {
  const response = await fetch(DATA_URL);
  const data = await response.json();
  state.trophies = data.trophies || [];
  state.roadmap = data.roadmap || [];
  applyDemoParams();
  if (state.selectedId === null && state.trophies.length > 0) state.selectedId = state.trophies[0].id;
  $('spoiler-toggle').checked = state.spoilerShield;
  for (const chip of document.querySelectorAll('#kind-filters .chip')) {
    chip.classList.toggle('active', chip.dataset.kind === state.kindFilter);
  }
  for (const chip of document.querySelectorAll('.chip-grade')) {
    chip.classList.toggle('active', chip.dataset.grade === state.gradeFilter);
  }
  bindControls();
  renderAll();
  const scrollTo = Number(new URLSearchParams(window.location.search).get('scroll')) || 0;
  if (scrollTo > 0) window.scrollTo(0, scrollTo);
}

bootAtlas();
