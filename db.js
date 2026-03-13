const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'vod.db'));

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

// Create tables (base schema for new installs)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    filename TEXT NOT NULL,
    thumbnail TEXT DEFAULT '',
    duration REAL DEFAULT 0,
    file_size INTEGER DEFAULT 0,
    status TEXT DEFAULT 'processing' CHECK(status IN ('processing', 'ready', 'error')),
    views INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bandwidth_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT,
    bytes_sent INTEGER DEFAULT 0,
    quality TEXT DEFAULT '',
    client_ip TEXT DEFAULT '',
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_bandwidth_timestamp ON bandwidth_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_bandwidth_video ON bandwidth_logs(video_id);
`);

// Migrate: add new columns for existing databases
try { db.exec('ALTER TABLE videos ADD COLUMN user_id TEXT DEFAULT NULL'); } catch (e) { }
try { db.exec('ALTER TABLE videos ADD COLUMN visibility TEXT DEFAULT \'public\''); } catch (e) { }
try { db.exec('ALTER TABLE videos ADD COLUMN codec TEXT DEFAULT \'libx264\''); } catch (e) { }

// Create indexes after migration
try { db.exec('CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id)'); } catch (e) { }
try { db.exec('CREATE INDEX IF NOT EXISTS idx_videos_visibility ON videos(visibility)'); } catch (e) { }

// Seed default admin account
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
    const { v4: uuidv4 } = require('uuid');
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (id, username, password, display_name, role) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), 'admin', hashedPassword, 'Administrator', 'admin');
    console.log('Default admin created: admin / admin123');
}

module.exports = db;
