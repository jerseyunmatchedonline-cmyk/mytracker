// db.js - Updated SQLite layer with User Authentication & Per-User Data Partitioning

const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const fs = require('fs');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'app.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- Schema ----------

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#c29b7d',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
  );

  CREATE TABLE IF NOT EXISTS study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    notes TEXT,
    started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS food_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    food_name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    serving_size TEXT,
    source TEXT,
    logged_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    user_id INTEGER PRIMARY KEY,
    pomodoro_work TEXT DEFAULT '25',
    pomodoro_break TEXT DEFAULT '5',
    pomodoro_long_break TEXT DEFAULT '15',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);
  CREATE INDEX IF NOT EXISTS idx_study_user ON study_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_food_user ON food_logs(user_id);
`);

// ---------- Helpers ----------

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ---------- Users & Auth ----------

function registerUser(username, password, displayName) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim().toLowerCase());
  if (existing) {
    throw new Error('Username is already taken.');
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)'
  ).run(username.trim().toLowerCase(), hash, displayName.trim() || username);

  const userId = result.lastInsertRowid;

  // Seed default settings and subjects for new user
  db.prepare('INSERT INTO app_settings (user_id) VALUES (?)').run(userId);

  const defaultSubjects = [
    { name: 'Mathematics', color: '#b87d61' },
    { name: 'Programming', color: '#9c826b' },
    { name: 'Language', color: '#c49776' }
  ];
  const insSub = db.prepare('INSERT INTO subjects (user_id, name, color) VALUES (?, ?, ?)');
  for (const s of defaultSubjects) {
    insSub.run(userId, s.name, s.color);
  }

  return { id: userId, username: username.trim().toLowerCase(), display_name: displayName.trim() || username };
}

function verifyUser(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
  if (!user) return null;
  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) return null;
  return { id: user.id, username: user.username, display_name: user.display_name };
}

function getUserById(id) {
  const user = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(id);
  return user || null;
}

// ---------- Subjects ----------

function getSubjects(userId) {
  return db.prepare('SELECT * FROM subjects WHERE user_id = ? ORDER BY name').all(userId);
}

function getSubject(userId, id) {
  return db.prepare('SELECT * FROM subjects WHERE user_id = ? AND id = ?').get(userId, id);
}

function addSubject(userId, name, color) {
  const stmt = db.prepare('INSERT INTO subjects (user_id, name, color) VALUES (?, ?, ?)');
  return stmt.run(userId, name, color);
}

function deleteSubject(userId, id) {
  return db.prepare('DELETE FROM subjects WHERE user_id = ? AND id = ?').run(userId, id);
}

// ---------- Study sessions ----------

function addStudySession(userId, subjectId, durationMinutes, notes) {
  return db.prepare(
    'INSERT INTO study_sessions (user_id, subject_id, duration_minutes, notes, started_at) VALUES (?, ?, ?, ?, datetime(\'now\', \'localtime\'))'
  ).run(userId, subjectId, durationMinutes, notes || null);
}

function getStudySessions(userId, limit = 100) {
  return db.prepare(`
    SELECT s.id, s.subject_id, s.duration_minutes, s.notes, s.started_at,
           sub.name AS subject_name, sub.color AS subject_color
    FROM study_sessions s
    JOIN subjects sub ON sub.id = s.subject_id
    WHERE s.user_id = ?
    ORDER BY s.started_at DESC
    LIMIT ?
  `).all(userId, limit);
}

function getStudyTotalMinutes(userId) {
  const today = todayStr();
  const row = db.prepare(`
    SELECT COALESCE(SUM(duration_minutes), 0) AS total
    FROM study_sessions
    WHERE user_id = ? AND strftime('%Y-%m-%d', started_at) = ?
  `).get(userId, today);
  return row.total;
}

// ---------- Food logs ----------

function addFoodLog(userId, foodName, calories, protein, carbs, fat, servingSize, source) {
  return db.prepare(
    'INSERT INTO food_logs (user_id, food_name, calories, protein_g, carbs_g, fat_g, serving_size, source, logged_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\', \'localtime\'))'
  ).run(userId, foodName, calories, protein || null, carbs || null, fat || null, servingSize || null, source || null);
}

function getFoodLogs(userId, limit = 100) {
  return db.prepare('SELECT * FROM food_logs WHERE user_id = ? ORDER BY logged_at DESC LIMIT ?').all(userId, limit);
}

function getDailyCalorieTotal(userId, dateStr) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(calories), 0) AS total, COUNT(*) AS count
    FROM food_logs
    WHERE user_id = ? AND strftime('%Y-%m-%d', logged_at) = ?
  `).get(userId, dateStr);
  return row;
}

// ---------- Settings ----------

function getSettings(userId) {
  let row = db.prepare('SELECT * FROM app_settings WHERE user_id = ?').get(userId);
  if (!row) {
    db.prepare('INSERT OR IGNORE INTO app_settings (user_id) VALUES (?)').run(userId);
    row = db.prepare('SELECT * FROM app_settings WHERE user_id = ?').get(userId);
  }
  return row;
}

function updateSettings(userId, settings) {
  const current = getSettings(userId);
  db.prepare(`
    UPDATE app_settings
    SET pomodoro_work = ?, pomodoro_break = ?, pomodoro_long_break = ?
    WHERE user_id = ?
  `).run(
    settings.pomodoro_work ?? current.pomodoro_work,
    settings.pomodoro_break ?? current.pomodoro_break,
    settings.pomodoro_long_break ?? current.pomodoro_long_break,
    userId
  );
}

module.exports = {
  db,
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
};