const GAME_NAME = 'Daily Murder Board';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

let caseData;
let storeKey;
let currentItem = null;
let zTop = 10;
const cards = {};

const load = (k) => JSON.parse(localStorage.getItem(`${storeKey}:${k}`) || 'null');
const save = (k, v) => localStorage.setItem(`${storeKey}:${k}`, JSON.stringify(v));

/* ---------- Loading ---------- */

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadCase() {
  const key = new URLSearchParams(location.search).get('case') || todayKey();
  for (const path of [`cases/${key}.json`, 'cases/sample.json']) {
    try {
      const res = await fetch(path);
      if (res.ok) return await res.json();
    } catch { /* try next */ }
  }
  throw new Error('No case file found');
}

async function init() {
  try {
    caseData = await loadCase('2026-11-01');  
    caseData = await loadCase();
  } catch {
    $('#case-title').textContent = 'Case file missing';
    $('#board').insertAdjacentHTML('beforeend',
      `<p class="error">Couldn't load today's case. If you opened this file directly, run it through a local server instead.</p>`);
    return;
  }
  storeKey = `dailycase-${caseData.date}`;
  $('#case-number').textContent = `Case #${caseData.caseNumber}`;
  $('#case-title').textContent = caseData.title;
  document.title = `${caseData.title} · ${GAME_NAME}`;

  renderBoard();
  setupNotepad();
  setupDialogs();
  setupAccusation();
  if (load('result')) $('#accuse-btn').textContent = 'View verdict';
}

/* ---------- Corkboard ---------- */

const initials = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2);

function tiltFor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h % 7) - 3; // -3deg to 3deg, same every load
}

function cardHTML(item) {
  const photo = (p, name) => `<div class="photo">${p
    ? `<img src="${esc(p)}" alt="">`
    : `<span>${esc(initials(name))}</span>`}</div>`;

  switch (item.kind) {
    case 'suspect':
      return `${photo(item.photo, item.name)}
        <div class="caption">${esc(item.name)}</div>
        <div class="stamp">Suspect ${item.number}</div>`;
    case 'victim':
      return `${photo(item.photo, item.name)}
        <div class="caption">${esc(item.name)}</div>
        <div class="stamp">Victim</div>`;
    case 'police':
      return `${photo(item.photo, item.name)}
        <div class="caption">${esc(item.name)}</div>
        <div class="stamp">Police</div>`;
    case 'scene':
      return `<h3>${esc(item.headline)}</h3>
        <p class="dateline">${esc(item.location)} — ${esc(item.time)}</p>
        <p>${esc(item.summary)}</p>`;
    default:
      return `${item.photo ? `<div class="clue-photo"><img src="${esc(item.photo)}" alt=""></div>` : ''}
        <span class="tag">${esc(item.type)}</span>
        <h4>${esc(item.title)}</h4>
        ${item.photo ? '' : `<p>${esc(item.summary)}</p>`}`;
  }
}

function renderBoard() {
  const board = $('#board');
  const positions = load('positions') || {};
  const items = [
    { ...caseData.victim, id: 'victim', kind: 'victim' },
  { ...caseData.scene, id: 'scene', kind: 'scene' },
  ...(caseData.police ? [{ ...caseData.police, id: 'police', kind: 'police' }] : []),
  ...caseData.suspects.map((s) => ({ ...s, kind: 'suspect' })),
  ...caseData.clues.map((c) => ({ ...c, kind: 'clue' })),
  ];

  for (const item of items) {
    const card = document.createElement('article');
    card.className = `card card--${item.kind}`;
    card.tabIndex = 0;
    card.innerHTML = cardHTML(item);
    const pos = positions[item.id] || item.pos || { x: 5, y: 5 };
    card.style.left = `${pos.x}%`;
    card.style.top = `${pos.y}%`;
    card.style.setProperty('--tilt', `${tiltFor(item.id)}deg`);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(item); }
    });
    makeDraggable(card, item, positions);
    board.appendChild(card);
    cards[item.id] = card;
  }

  drawStrings();
  window.addEventListener('resize', drawStrings);
  document.fonts?.ready.then(drawStrings);
}

function makeDraggable(card, item, positions) {
  const board = $('#board');
  let start = null;

  card.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, left: card.offsetLeft, top: card.offsetTop, moved: false };
    card.setPointerCapture(e.pointerId);
    card.style.zIndex = ++zTop;
  });

  card.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 5) return; // small wiggle = click
    start.moved = true;
    card.classList.add('dragging');
    const x = clamp(start.left + dx, 0, board.clientWidth - card.offsetWidth);
    const y = clamp(start.top + dy, 0, board.clientHeight - card.offsetHeight);
    card.style.left = `${(x / board.clientWidth) * 100}%`;
    card.style.top = `${(y / board.clientHeight) * 100}%`;
    drawStrings();
  });

  card.addEventListener('pointerup', () => {
    if (!start) return;
    card.classList.remove('dragging');
    if (start.moved) {
      positions[item.id] = { x: parseFloat(card.style.left), y: parseFloat(card.style.top) };
      save('positions', positions);
    } else {
      openDetail(item);
    }
    start = null;
  });
}

function pinPoint(id) {
  const c = cards[id];
  return { x: c.offsetLeft + c.offsetWidth / 2, y: c.offsetTop + 10 };
}

function drawStrings() {
  let svg = '';
  for (const [a, b] of caseData.connections || []) {
    if (!cards[a] || !cards[b]) continue;
    const p = pinPoint(a);
    const q = pinPoint(b);
    const sag = Math.hypot(q.x - p.x, q.y - p.y) * 0.08; // strings droop a little
    svg += `<path class="string" d="M${p.x} ${p.y} Q${(p.x + q.x) / 2} ${(p.y + q.y) / 2 + sag} ${q.x} ${q.y}"/>`;
  }
  for (const id in cards) {
    const p = pinPoint(id);
    svg += `<circle class="pin" cx="${p.x}" cy="${p.y}" r="7"/>`;
  }
  $('#string-layer').innerHTML = svg;
}

/* ---------- Detail popup ---------- */

function openDetail(item) {
  currentItem = item;
  const label = {
    victim: 'The victim', scene: 'The scene',
    suspect: `Suspect ${item.number}`, clue: item.type || 'Clue',
    police: 'Police Chief',
  }[item.kind];
  const meta = {
    suspect: [['Age', item.age], ['Occupation', item.occupation], ['Relation', item.relation]],
    victim: [['Age', item.age], ['Occupation', item.occupation], ['Cause of death', item.causeOfDeath]],
    scene: [['Location', item.location], ['Time', item.time]],
    clue: [],
    police: [['Relation', item.relation]],
  }[item.kind];

  $('#detail-body').innerHTML = `
    <p class="kicker">${esc(label)}</p>
    <h2>${esc(item.name || item.title || item.headline)}</h2>
    ${meta.length ? `<dl>${meta.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
    <p>${esc(item.description || item.summary)}</p>`;
  $('#detail').showModal();
}

/* ---------- Notepad ---------- */

function toggleNotes(force) {
  const open = $('#notepad').classList.toggle('open', force);
  $('#notes-toggle').setAttribute('aria-expanded', open);
}

function setupNotepad() {
  const ta = $('#notes');
  ta.value = load('notes') || '';
  ta.addEventListener('input', () => save('notes', ta.value));
  $('#notes-toggle').addEventListener('click', () => toggleNotes());
  $('#notes-close').addEventListener('click', () => toggleNotes(false));

  $('#detail-note').addEventListener('click', () => {
    const title = currentItem.name || currentItem.title || currentItem.headline;
    const needsBreak = ta.value && !ta.value.endsWith('\n');
    ta.value += `${needsBreak ? '\n' : ''}• ${title}: `;
    save('notes', ta.value);
    $('#detail').close();
    toggleNotes(true);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  });
}

/* ---------- Accusation ---------- */

const nameOf = (id) => (id === 'none' ? 'No accomplice' : caseData.suspects.find((s) => s.id === id)?.name);
const motiveOf = (id) => caseData.motives.find((m) => m.id === id)?.text;

function setupDialogs() {
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) e.target.closest('dialog').close();
  });
}

function setupAccusation() {
  const form = $('#accuse-form');
  const choice = (name, value, label) =>
    `<label class="choice"><input type="radio" name="${name}" value="${esc(value)}" required><span>${esc(label)}</span></label>`;
  const suspectChoices = (name) =>
    caseData.suspects.map((s) => choice(name, s.id, `${s.number}. ${s.name}`)).join('');

  $('#culprit-options').innerHTML = suspectChoices('culprit');
  $('#motive-options').innerHTML = caseData.motives.map((m) => choice('motive', m.id, m.text)).join('');
  $('#accomplice-options').innerHTML = suspectChoices('accomplice') + choice('accomplice', 'none', 'No accomplice');

  // The culprit can't be their own accomplice
  form.addEventListener('change', () => {
    const culprit = form.elements.culprit.value;
    form.querySelectorAll('[name=accomplice]').forEach((input) => {
      input.disabled = input.value === culprit;
      if (input.disabled) input.checked = false;
    });
  });

  $('#accuse-btn').addEventListener('click', () => {
    const prior = load('result');
    prior ? showResult(prior) : $('#accuse').showModal();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const guess = {
      culprit: form.elements.culprit.value,
      motive: form.elements.motive.value,
      accomplice: form.elements.accomplice.value,
    };
    const sol = caseData.solution;
    const result = {
      guess,
      correct: {
        culprit: guess.culprit === sol.culprit,
        motive: guess.motive === sol.motive,
        accomplice: guess.accomplice === sol.accomplice,
      },
    };
    save('result', result);
    $('#accuse').close();
    $('#accuse-btn').textContent = 'View verdict';
    showResult(result);
  });

  $('#share-btn').addEventListener('click', shareResult);
}

function showResult(r) {
  const sol = caseData.solution;
  const win = Object.values(r.correct).every(Boolean);
  const row = (label, key, fmt) => `
    <li>
      <span class="verdict-label">${label}</span>
      <span>${esc(fmt(r.guess[key]))} ${r.correct[key] ? '✅' : '❌'}</span>
    </li>`;

  $('#result-body').innerHTML = `
    <span class="result-stamp ${win ? 'win' : 'lose'}">${win ? 'Case closed' : 'Case gone cold'}</span>
    <h2>${win ? 'Brilliant work, detective.' : 'Not quite, detective.'}</h2>
    <ul class="verdict">
      ${row('Culprit', 'culprit', nameOf)}
      ${row('Motive', 'motive', motiveOf)}
      ${row('Accomplice', 'accomplice', nameOf)}
    </ul>
    <h3>What really happened</h3>
    <p>${esc(sol.explanation)}</p>`;
  $('#result').showModal();
}

function shareResult() {
  const c = load('result').correct;
  const sq = (ok) => (ok ? '🟩' : '🟥');
  const text = `${GAME_NAME} #${caseData.caseNumber}\n🔪 Culprit ${sq(c.culprit)}\n💭 Motive ${sq(c.motive)}\n🤝 Accomplice ${sq(c.accomplice)}\n${location.origin}`;
  navigator.clipboard.writeText(text).then(() => {
    const btn = $('#share-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = 'Share result'), 1800);
  });
}

init();
