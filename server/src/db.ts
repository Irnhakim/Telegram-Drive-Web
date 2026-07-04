import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'telegram-drive.db');

let db: SqlJsDatabase | null = null;

export async function initDatabase(): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  // Load existing database if exists
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS folder_cache (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_saved_messages INTEGER DEFAULT 0,
      updated_at INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS file_cache (
      message_id INTEGER,
      folder_id TEXT,
      name TEXT,
      size INTEGER DEFAULT 0,
      mime_type TEXT,
      has_thumb INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at INTEGER DEFAULT 0,
      PRIMARY KEY (message_id, folder_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS thumbnail_cache (
      message_id INTEGER,
      folder_id TEXT,
      data BLOB,
      PRIMARY KEY (message_id, folder_id)
    )
  `);

  saveDb();
}

function saveDb(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) {
    console.error('Failed to save database:', e);
  }
}

function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized');
  return db;
}

// Folder cache operations
export function cacheFolders(folders: Array<{ id: string; name: string; isSavedMessages: boolean }>) {
  const d = getDb();
  const now = Math.floor(Date.now() / 1000);

  for (const f of folders) {
    d.run(
      'INSERT OR REPLACE INTO folder_cache (id, name, is_saved_messages, updated_at) VALUES (?, ?, ?, ?)',
      [f.id, f.name, f.isSavedMessages ? 1 : 0, now]
    );
  }
  saveDb();
}

export function getCachedFolders(): Array<{ id: string; name: string; is_saved_messages: number }> {
  const d = getDb();
  const results = d.exec('SELECT id, name, is_saved_messages FROM folder_cache ORDER BY is_saved_messages DESC, name ASC');
  if (!results.length) return [];

  return results[0].values.map((row) => ({
    id: row[0] as string,
    name: row[1] as string,
    is_saved_messages: row[2] as number,
  }));
}

// File cache operations
export function cacheFiles(
  folderId: string,
  files: Array<{
    messageId: number;
    name: string;
    size: number;
    mimeType: string;
    hasThumb: boolean;
    createdAt: string;
  }>
) {
  const d = getDb();
  const now = Math.floor(Date.now() / 1000);

  for (const f of files) {
    d.run(
      `INSERT OR REPLACE INTO file_cache 
       (message_id, folder_id, name, size, mime_type, has_thumb, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [f.messageId, folderId, f.name, f.size, f.mimeType, f.hasThumb ? 1 : 0, f.createdAt, now]
    );
  }
  saveDb();
}

export function getCachedFiles(folderId: string) {
  const d = getDb();
  const results = d.exec('SELECT message_id, folder_id, name, size, mime_type, has_thumb, created_at FROM file_cache WHERE folder_id = ? ORDER BY message_id DESC', [folderId]);
  if (!results.length) return [];

  return results[0].values.map((row) => ({
    message_id: row[0] as number,
    folder_id: row[1] as string,
    name: row[2] as string,
    size: row[3] as number,
    mime_type: row[4] as string,
    has_thumb: row[5] as number,
    created_at: row[6] as string,
  }));
}

export function clearFileCache(folderId: string) {
  const d = getDb();
  d.run('DELETE FROM file_cache WHERE folder_id = ?', [folderId]);
  saveDb();
}

// Thumbnail cache
export function cacheThumbnail(messageId: number, folderId: string, data: Buffer) {
  const d = getDb();
  d.run(
    'INSERT OR REPLACE INTO thumbnail_cache (message_id, folder_id, data) VALUES (?, ?, ?)',
    [messageId, folderId, data]
  );
  saveDb();
}

export function getCachedThumbnail(messageId: number, folderId: string): Buffer | null {
  const d = getDb();
  const results = d.exec('SELECT data FROM thumbnail_cache WHERE message_id = ? AND folder_id = ?', [messageId, folderId]);
  if (!results.length || !results[0].values.length) return null;
  const data = results[0].values[0][0];
  if (data instanceof Uint8Array) return Buffer.from(data);
  return null;
}

// Storage stats from cache
export function getStorageStats() {
  const d = getDb();

  const totalResult = d.exec('SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total FROM file_cache');
  const totalRow = totalResult.length ? totalResult[0].values[0] : [0, 0];

  const folderResult = d.exec(`
    SELECT f.folder_id, COALESCE(fc.name, f.folder_id) as folder_name, 
           COUNT(*) as file_count, COALESCE(SUM(f.size), 0) as total_size
    FROM file_cache f
    LEFT JOIN folder_cache fc ON f.folder_id = fc.id
    GROUP BY f.folder_id
    ORDER BY total_size DESC
  `);

  const mimeResult = d.exec(`
    SELECT COALESCE(mime_type, 'unknown') as mime_type, 
           COUNT(*) as file_count, COALESCE(SUM(size), 0) as total_size
    FROM file_cache
    GROUP BY mime_type
    ORDER BY total_size DESC
  `);

  return {
    totalSize: totalRow[1] as number,
    totalFiles: totalRow[0] as number,
    byFolder: folderResult.length
      ? folderResult[0].values.map((r: any) => ({
          folderId: r[0] as string,
          folderName: r[1] as string,
          fileCount: r[2] as number,
          totalSize: r[3] as number,
        }))
      : [],
    byMimeType: mimeResult.length
      ? mimeResult[0].values.map((r: any) => ({
          mimeType: r[0] as string,
          fileCount: r[1] as number,
          totalSize: r[2] as number,
        }))
      : [],
  };
}
