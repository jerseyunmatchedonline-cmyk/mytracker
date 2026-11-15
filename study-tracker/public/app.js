// app.js - Refactored for User Authentication & Updated UI

const $ = (id) => document.getElementById(id);

// --- Global UI Logic ---

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.module-section').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// Authentication UI toggling
const loginForm = $('loginForm');
const registerForm = $('registerForm');
const toggleAuthBtn = $('toggleAuthBtn');
const authHeaderTitle = $('authHeaderTitle');
const authHeaderSub = $('authHeaderSub');

function toggleAuthMode() {
  const isLogin = !loginForm.classList.contains('hidden');
  if (isLogin) {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    authHeaderTitle.textContent = 'Join us.';
    authHeaderSub.textContent = 'Create your account to start tracking your study sessions and diet.';
    toggleAuthBtn.textContent = 'Login';
  } else {
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    authHeaderTitle.textContent = 'Welcome.';
    authHeaderSub.textContent = 'Your mindful space for study focus and daily nutrition tracking.';
    toggleAuthBtn.textContent = 'Register';
  }
}
toggleAuthBtn.addEventListener('click', toggleAuthMode);

// App entry point & Auth state
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      initApp(data.user);
    } else {
      showAuth();
    }
  } catch(e) {
    showAuth();
  }
}

function showAuth() {
  $('authContainer').classList.remove('hidden');
  $('appContainer').classList.add('hidden');
}

function initApp(user) {
  $('authContainer').classList.add('hidden');
  $('appContainer').classList.remove('hidden');
  $('userGreeting').textContent = `Welcome, ${user.display_name}`;

  // Trigger loaders for modules
  loadSubjects();
  loadStudySessions();
  loadFoodLogs();
  loadDailyCalories();
}

// Auth Actions
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: $('loginUsername').value,
      password: $('loginPassword').value
    })
  });
  if (res.ok) {
    const data = await res.json();
    initApp(data.user);
  } else {
    alert('Invalid login');
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: $('regUsername').value,
      password: $('regPassword').value,
      display_name: $('regDisplayName').value
    })
  });
  if (res.ok) {
    const data = await res.json();
    initApp(data.user);
  } else {
    const err = await res.json();
    alert(err.error);
  }
});

$('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.reload();
});

// --- API Helper ---
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error);
  }
  return res.json();
}

// --- Module Data Logic ---
async function loadSubjects() {
  const list = await api('/api/subjects');
  const container = $('subjectChipsContainer');
  container.innerHTML = '';
  list.forEach(s => {
    const el = document.createElement('div');
    el.className = 'chip-item';
    el.innerHTML = `<span class="chip-dot" style="background:${s.color}"></span> ${escapeHtml(s.name)} <span class="chip-del">&times;</span>`;
    container.appendChild(el);
  });
  // Populate dropdowns
  const logSelect = $('logSubjectSelect');
  logSelect.innerHTML = list.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

async function loadStudySessions() {
  const list = await api('/api/study-sessions');
  const ul = $('studyHistoryList');
  ul.innerHTML = list.map(s => `
    <li class="history-item">
      <span>${escapeHtml(s.subject_name)}</span>
      <span>${s.duration_minutes} min</span>
      <span style="color:var(--text-light)">${new Date(s.started_at).toLocaleDateString()}</span>
    </li>
  `).join('');
}

async function loadFoodLogs() {
  const logs = await api('/api/food-logs');
  const ul = $('foodHistoryList');
  ul.innerHTML = logs.map(l => `
    <li class="history-item">
      <span>${escapeHtml(l.food_name)}</span>
      <span style="font-weight:700">${l.calories} kcal</span>
    </li>
  `).join('');
}

async function loadDailyCalories() {
  const data = await api('/api/daily-calories');
  const total = data.total || 0;
  $('macroCal').textContent = total;
}

// --- Helper ---
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Init
document.addEventListener('DOMContentLoaded', checkAuth);
