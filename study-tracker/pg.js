// pg.js - PostgreSQL adapter mirroring the SQLite db.js interface.
// Activated automatically when DATABASE_URL is set (Railway/Render free tier).

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PG_SSL === 'false'
    ? false
    : { rejectUnauthorized: false }, // Railway/Render free Postgres often needs this
});

// ---------- Helpers ----------

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ---------- Schema ----------

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#c29b7d',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      duration_minutes INTEGER NOT NULL,
      notes TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS food_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      food_name TEXT NOT NULL,
      calories INTEGER NOT NULL,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL,
      serving_size TEXT,
      source TEXT,
      logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      pomodoro_work TEXT DEFAULT '25',
      pomodoro_break TEXT DEFAULT '5',
      pomodoro_long_break TEXT DEFAULT '15'
    );

    CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);
    CREATE INDEX IF NOT EXISTS idx_study_user ON study_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_food_user ON food_logs(user_id);
  `);
}

// ---------- Users & Auth ----------

async function registerUser(username, password, displayName) {
  const bcrypt = require('bcryptjs');
  const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username.trim().toLowerCase()]);
  if (existing.rows.length) throw new Error('Username is already taken.');

  const hash = bcrypt.hashSync(password, 10);
  const res = await pool.query(
    'INSERT INTO users (username, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
    [username.trim().toLowerCase(), hash, displayName.trim() || username]
  );
  const userId = res.rows[0].id;

  await pool.query('INSERT INTO app_settings (user_id) VALUES ($1)', [userId]);

  const defaultSubjects = [
    { name: 'Mathematics', color: '#b87d61' },
    { name: 'Programming', color: '#9c826b' },
    { name: 'Language', color: '#c49776' }
  ];
  for (const s of defaultSubjects) {
    await pool.query('INSERT INTO subjects (user_id, name, color) VALUES ($1, $2, $3)', [userId, s.name, s.color]);
  }

  return { id: userId, username: username.trim().toLowerCase(), display_name: displayName.trim() || username };
}

async function verifyUser(username, password) {
  const bcrypt = require('bcryptjs');
  const res = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim().toLowerCase()]);
  const user = res.rows[0];
  if (!user) return null;
  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) return null;
  return { id: user.id, username: user.username, display_name: user.display_name };
}

async function getUserById(id) {
  const res = await pool.query('SELECT id, username, display_name FROM users WHERE id = $1', [id]);
  return res.rows[0] || null;
}

// ---------- Subjects ----------

async function getSubjects(userId) {
  const res = await pool.query('SELECT * FROM subjects WHERE user_id = $1 ORDER BY name', [userId]);
  return res.rows;
}

async function getSubject(userId, id) {
  const res = await pool.query('SELECT * FROM subjects WHERE user_id = $1 AND id = $2', [userId, id]);
  return res.rows[0] || null;
}

async function addSubject(userId, name, color) {
  const res = await pool.query('INSERT INTO subjects (user_id, name, color) VALUES ($1, $2, $3) RETURNING id', [userId, name, color]);
  return { lastInsertRowid: res.rows[0].id };
}

async function deleteSubject(userId, id) {
  const res = await pool.query('DELETE FROM subjects WHERE user_id = $1 AND id = $2', [userId, id]);
  return { changes: res.rowCount };
}

// ---------- Study sessions ----------

async function addStudySession(userId, subjectId, durationMinutes, notes) {
  const res = await pool.query(
    'INSERT INTO study_sessions (user_id, subject_id, duration_minutes, notes) VALUES ($1, $2, $3, $4) RETURNING id',
    [userId, subjectId, durationMinutes, notes || null]
  );
  return { lastInsertRowid: res.rows[0].id };
}

async function getStudySessions(userId, limit = 100) {
  const res = await pool.query(`
    SELECT s.id, s.subject_id, s.duration_minutes, s.notes, s.started_at,
           sub.name AS subject_name, sub.color AS subject_color
    FROM study_sessions s
    JOIN subjects sub ON sub.id = s.subject_id
    WHERE s.user_id = $1
    ORDER BY s.started_at DESC
    LIMIT $2
  `, [userId, limit]);
  return res.rows;
}

async function getStudyTotalMinutes(userId) {
  const res = await pool.query(`
    SELECT COALESCE(SUM(duration_minutes), 0) AS total
    FROM study_sessions
    WHERE user_id = $1 AND DATE(started_at) = $2
  `, [userId, todayStr()]);
  return Number(res.rows[0].total);
}

// ---------- Food logs ----------

async function addFoodLog(userId, foodName, calories, protein, carbs, fat, servingSize, source) {
  const res = await pool.query(
    'INSERT INTO food_logs (user_id, food_name, calories, protein_g, carbs_g, fat_g, serving_size, source) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
    [userId, foodName, calories, protein || null, carbs || null, fat || null, servingSize || null, source || null]
  );
  return { lastInsertRowid: res.rows[0].id };
}

async function getFoodLogs(userId, limit = 100) {
  const res = await pool.query('SELECT * FROM food_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT $2', [userId, limit]);
  return res.rows;
}

async function getDailyCalorieTotal(userId, dateStr) {
  const res = await pool.query(`
    SELECT COALESCE(SUM(calories), 0) AS total, COUNT(*) AS count
    FROM food_logs
    WHERE user_id = $1 AND DATE(logged_at) = $2
  `, [userId, dateStr]);
  return { total: Number(res.rows[0].total), count: Number(res.rows[0].count) };
}

// ---------- Settings ----------

async function getSettings(userId) {
  let res = await pool.query('SELECT * FROM app_settings WHERE user_id = $1', [userId]);
  if (!res.rows.length) {
    await pool.query('INSERT INTO app_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
    res = await pool.query('SELECT * FROM app_settings WHERE user_id = $1', [userId]);
  }
  return res.rows[0];
}

async function updateSettings(userId, settings) {
  const current = await getSettings(userId);
  await pool.query(`
    UPDATE app_settings
    SET pomodoro_work = $1, pomodoro_break = $2, pomodoro_long_break = $3
    WHERE user_id = $4
  `, [
    settings.pomodoro_work ?? current.pomodoro_work,
    settings.pomodoro_break ?? current.pomodoro_break,
    settings.pomodoro_long_break ?? current.pomodoro_long_break,
    userId
  ]);
}

module.exports = {
  initSchema,
  todayStr,
  registerUser,
  verifyUser,
  getUserById,
  getSubjects,
  getSubject,
  addSubject,
  deleteSubject,
  addStudySession,
  getStudySessions,
  getStudyTotalMinutes,
  addFoodLog,
  getFoodLogs,
  getDailyCalorieTotal,
  getSettings,
  updateSettings,
  pool,
};