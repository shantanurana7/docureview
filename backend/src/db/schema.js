import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'docureview.db');

let db;

export function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    initTables();
    seedAdmin();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','designer','reviewer')),
      stream TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      designer_id TEXT NOT NULL,
      reviewer_id TEXT,
      title TEXT NOT NULL,
      filepath TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      job_id TEXT NOT NULL,
      deliverable_type TEXT NOT NULL CHECK(deliverable_type IN ('assets','ecomms','marketing')),
      complexity TEXT DEFAULT '',
      due_date TEXT,
      delivery_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_review','reviewed','completed')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (designer_id) REFERENCES users(id),
      FOREIGN KEY (reviewer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      type TEXT NOT NULL,
      page_number INTEGER DEFAULT 1,
      severity TEXT NOT NULL,
      error_category TEXT DEFAULT 'Design',
      x REAL NOT NULL,
      y REAL NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      comment TEXT NOT NULL,
      is_resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL UNIQUE,
      reviewer_id TEXT NOT NULL,
      quality REAL NOT NULL,
      complexity REAL NOT NULL,
      ftp REAL NOT NULL,
      design REAL NOT NULL,
      repeat_offence REAL NOT NULL,
      composite_score REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      message TEXT NOT NULL,
      target_url TEXT DEFAULT '',
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

function seedAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`INSERT INTO users (id, email, password, name, role, stream) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('admin-001', 'admin@docureview.com', hash, 'Admin', 'admin', '');
    console.log('Seeded default admin user (admin@docureview.com / admin123)');
  }
}
