// db.js - Unified database layer.
// Uses PostgreSQL (pg.js) when DATABASE_URL is set (cloud hosting like
// Railway/Render free tier), otherwise falls back to local SQLite.

const usePostgres = !!process.env.DATABASE_URL;

let db;
if (usePostgres) {
  db = require('./pg');
  // Initialize schema on startup for cloud deployments.
  db.initSchema().catch((e) => {
    console.error('Postgres schema init failed:', e.message);
  });
} else {
  db = require('./sqlite');
}

module.exports = db;