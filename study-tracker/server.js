// server.js - Updated Express server with User Sessions and Auth Middleware

const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db');
const { lookupFood } = require('./food-api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'study-diet-tracker-secret-key-9821',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

// Serve static files except index.html (we serve it conditionally or protect)
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Auth Middleware ----------
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
  }
  next();
}

// ---------- Auth API Routes ----------

app.post('/api/auth/register', (req, res) => {
  const { username, password, display_name } = req.body || {};
  if (!username || !password || String(username).trim().length < 2 || String(password).length < 4) {
    return res.status(400).json({ error: 'Username (min 2 chars) and Password (min 4 chars) are required.' });
  }
  try {
    const user = db.registerUser(username, password, display_name || username);
    req.session.userId = user.id;
    res.json({ ok: true, user });
  } catch (e) {
    res.status(409).json({ error: e.message || 'Registration failed.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const user = db.verifyUser(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  req.session.userId = user.id;
  res.json({ ok: true, user });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ user: null });
  }
  const user = db.getUserById(req.session.userId);
  res.json({ user: user || null });
});

// ---------- Protected API Routes (Per-User Data) ----------

app.get('/api/subjects', requireAuth, (req, res) => {
  res.json(db.getSubjects(req.session.userId));
});

app.post('/api/subjects', requireAuth, (req, res) => {
  const { name, color } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Subject name is required.' });
  }
  try {
    const result = db.addSubject(req.session.userId, String(name).trim(), color || '#b87d61');
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A subject with that name already exists.' });
    }
    throw e;
  }
});

app.delete('/api/subjects/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id.' });
  const result = db.deleteSubject(req.session.userId, id);
  if (result.changes === 0) return res.status(404).json({ error: 'Subject not found.' });
  res.json({ ok: true });
});

app.get('/api/study-sessions', requireAuth, (req, res) => {
  res.json(db.getStudySessions(req.session.userId, Number(req.query.limit) || 100));
});

app.post('/api/study-sessions', requireAuth, (req, res) => {
  const { subject_id, duration_minutes, notes } = req.body || {};
  if (!subject_id || !duration_minutes || Number(duration_minutes) <= 0) {
    return res.status(400).json({ error: 'Valid subject and duration are required.' });
  }
  if (!db.getSubject(req.session.userId, Number(subject_id))) {
    return res.status(404).json({ error: 'Subject not found.' });
  }
  const result = db.addStudySession(req.session.userId, Number(subject_id), Number(duration_minutes), notes);
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/study-total', requireAuth, (req, res) => {
  res.json({ total_minutes: db.getStudyTotalMinutes(req.session.userId) });
});

app.get('/api/food-logs', requireAuth, (req, res) => {
  res.json(db.getFoodLogs(req.session.userId, Number(req.query.limit) || 100));
});

app.post('/api/food-logs', requireAuth, async (req, res) => {
  const { food_name, calories, protein_g, carbs_g, fat_g, serving_size, source } = req.body || {};
  if (!food_name || !String(food_name).trim()) {
    return res.status(400).json({ error: 'Food name is required.' });
  }
  const result = db.addFoodLog(
    req.session.userId,
    String(food_name).trim(),
    Number(calories) || 0,
    protein_g, carbs_g, fat_g, serving_size, source
  );
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/daily-calories', requireAuth, (req, res) => {
  const date = req.query.date || db.todayStr();
  res.json(db.getDailyCalorieTotal(req.session.userId, date));
});

app.post('/api/food-lookup', requireAuth, async (req, res) => {
  const { query } = req.body || {};
  if (!query || !String(query).trim()) {
    return res.status(400).json({ error: 'A food query is required.' });
  }
  try {
    const result = await lookupFood(String(query).trim());
    if (!result) {
      return res.status(404).json({ error: 'No nutritional data found for that item.' });
    }
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: 'Could not fetch nutrition data right now.' });
  }
});

app.get('/api/settings', requireAuth, (req, res) => {
  res.json(db.getSettings(req.session.userId));
});

app.put('/api/settings', requireAuth, (req, res) => {
  db.updateSettings(req.session.userId, req.body || {});
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Study & Diet Tracker running at http://localhost:${PORT}`);
  console.log(`Database: ${path.join(__dirname, 'data', 'app.db')}`);
});