// =================================================================
// DB.JS — Connexion PostgreSQL + création table
// =================================================================
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inscriptions (
      id          SERIAL PRIMARY KEY,
      timestamp   TEXT,
      full_name   TEXT NOT NULL,
      gender      TEXT,
      phone       TEXT,
      church      TEXT,
      email       TEXT    DEFAULT 'N/A',
      ticket_id   TEXT    UNIQUE NOT NULL,
      scan_status TEXT    DEFAULT 'Non scanné',
      scan_time   TEXT    DEFAULT ''
    )
  `);
}

module.exports = { pool, initDB };
