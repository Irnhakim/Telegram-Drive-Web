import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'telegram-drive.db');
let db = null;
// Password hashing helpers
export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}
export function verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash)
        return false;
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
}
export async function initDatabase() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const SQL = await initSqlJs();
    // Load existing database if exists
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    }
    else {
        db = new SQL.Database();
    }
    // PRAGMA check to see if users table needs migration (does it have password_hash?)
    const hasUsersTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").length > 0;
    let needsMigration = false;
    if (hasUsersTable) {
        const tableInfo = db.exec("PRAGMA table_info(users)");
        if (tableInfo.length && tableInfo[0].values) {
            const columns = tableInfo[0].values.map(v => v[1]);
            if (!columns.includes('password_hash')) {
                needsMigration = true;
            }
        }
    }
    if (needsMigration || !hasUsersTable) {
        console.log('Migrating database schema for TeleDrive Web Accounts...');
        db.run('DROP TABLE IF EXISTS users');
        db.run('DROP TABLE IF EXISTS folder_cache');
        db.run('DROP TABLE IF EXISTS file_cache');
        db.run('DROP TABLE IF EXISTS thumbnail_cache');
        db.run('DROP TABLE IF EXISTS groups');
        db.run('DROP TABLE IF EXISTS share_links');
    }
    // 1. Users Table (TeleDrive Account + Linked Telegram Account details)
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      email TEXT,
      telegram_id TEXT,
      telegram_username TEXT,
      telegram_first_name TEXT,
      telegram_last_name TEXT,
      telegram_phone TEXT,
      session TEXT,
      api_id INTEGER,
      api_hash TEXT,
      token TEXT NOT NULL,
      created_at INTEGER,
      reset_token TEXT,
      reset_token_expires INTEGER
    )
  `);
    // Check if reset_token columns need to be added (for existing users tables)
    if (hasUsersTable) {
        const tableInfo = db.exec("PRAGMA table_info(users)");
        if (tableInfo.length && tableInfo[0].values) {
            const columns = tableInfo[0].values.map(v => v[1]);
            if (!columns.includes('reset_token')) {
                db.run('ALTER TABLE users ADD COLUMN reset_token TEXT');
            }
            if (!columns.includes('reset_token_expires')) {
                db.run('ALTER TABLE users ADD COLUMN reset_token_expires INTEGER');
            }
        }
    }
    // 2. Folder Cache
    db.run(`
    CREATE TABLE IF NOT EXISTS folder_cache (
      id TEXT,
      user_id TEXT,
      name TEXT NOT NULL,
      is_saved_messages INTEGER DEFAULT 0,
      group_id TEXT,
      updated_at INTEGER DEFAULT 0,
      PRIMARY KEY (id, user_id)
    )
  `);
    // 3. Groups Table
    db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT,
      user_id TEXT,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at INTEGER,
      PRIMARY KEY (id, user_id)
    )
  `);
    // 4. File Cache
    db.run(`
    CREATE TABLE IF NOT EXISTS file_cache (
      message_id INTEGER,
      folder_id TEXT,
      user_id TEXT,
      name TEXT,
      size INTEGER DEFAULT 0,
      mime_type TEXT,
      has_thumb INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at INTEGER DEFAULT 0,
      PRIMARY KEY (message_id, folder_id, user_id)
    )
  `);
    // 5. Thumbnail Cache
    db.run(`
    CREATE TABLE IF NOT EXISTS thumbnail_cache (
      message_id INTEGER,
      folder_id TEXT,
      user_id TEXT,
      data BLOB,
      PRIMARY KEY (message_id, folder_id, user_id)
    )
  `);
    // 6. Share Links Table
    db.run(`
    CREATE TABLE IF NOT EXISTS share_links (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      message_id INTEGER,
      folder_id TEXT,
      file_name TEXT,
      file_size INTEGER,
      mime_type TEXT,
      password TEXT,
      expires_at INTEGER,
      created_at INTEGER,
      downloads INTEGER DEFAULT 0
    )
  `);
    // Check if downloads column needs to be added (for existing share_links tables)
    const hasShareLinksTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='share_links'").length > 0;
    if (hasShareLinksTable) {
        const tableInfo = db.exec("PRAGMA table_info(share_links)");
        if (tableInfo.length && tableInfo[0].values) {
            const columns = tableInfo[0].values.map(v => v[1]);
            if (!columns.includes('downloads')) {
                db.run('ALTER TABLE share_links ADD COLUMN downloads INTEGER DEFAULT 0');
            }
        }
    }
    saveDb();
}
function saveDb() {
    if (!db)
        return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
    catch (e) {
        console.error('Failed to save database:', e);
    }
}
function getDb() {
    if (!db)
        throw new Error('Database not initialized');
    return db;
}
function mapUserRow(row) {
    return {
        id: row[0],
        username: row[1],
        passwordHash: row[2],
        email: row[3],
        telegramId: row[4],
        telegramUsername: row[5],
        telegramFirstName: row[6],
        telegramLastName: row[7],
        telegramPhone: row[8],
        session: row[9],
        apiId: row[10],
        apiHash: row[11],
        token: row[12],
        createdAt: row[13],
        resetToken: row[14],
        resetTokenExpires: row[15],
    };
}
export function getUserByToken(token) {
    const d = getDb();
    const results = d.exec('SELECT id, username, password_hash, email, telegram_id, telegram_username, telegram_first_name, telegram_last_name, telegram_phone, session, api_id, api_hash, token, created_at, reset_token, reset_token_expires FROM users WHERE token = ?', [token]);
    if (!results.length || !results[0].values.length)
        return null;
    return mapUserRow(results[0].values[0]);
}
export function getUserById(id) {
    const d = getDb();
    const results = d.exec('SELECT id, username, password_hash, email, telegram_id, telegram_username, telegram_first_name, telegram_last_name, telegram_phone, session, api_id, api_hash, token, created_at, reset_token, reset_token_expires FROM users WHERE id = ?', [id]);
    if (!results.length || !results[0].values.length)
        return null;
    return mapUserRow(results[0].values[0]);
}
export function getUserByUsername(username) {
    const d = getDb();
    const results = d.exec('SELECT id, username, password_hash, email, telegram_id, telegram_username, telegram_first_name, telegram_last_name, telegram_phone, session, api_id, api_hash, token, created_at, reset_token, reset_token_expires FROM users WHERE username = ?', [username.toLowerCase()]);
    if (!results.length || !results[0].values.length)
        return null;
    return mapUserRow(results[0].values[0]);
}
export function getUserByUsernameOrEmail(identifier) {
    const d = getDb();
    const results = d.exec('SELECT id, username, password_hash, email, telegram_id, telegram_username, telegram_first_name, telegram_last_name, telegram_phone, session, api_id, api_hash, token, created_at, reset_token, reset_token_expires FROM users WHERE username = ? OR email = ?', [identifier.toLowerCase(), identifier.toLowerCase()]);
    if (!results.length || !results[0].values.length)
        return null;
    return mapUserRow(results[0].values[0]);
}
export function getUserByEmail(email) {
    const d = getDb();
    const results = d.exec('SELECT id, username, password_hash, email, telegram_id, telegram_username, telegram_first_name, telegram_last_name, telegram_phone, session, api_id, api_hash, token, created_at, reset_token, reset_token_expires FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!results.length || !results[0].values.length)
        return null;
    return mapUserRow(results[0].values[0]);
}
export function getUserByResetToken(token) {
    const d = getDb();
    const results = d.exec('SELECT id, username, password_hash, email, telegram_id, telegram_username, telegram_first_name, telegram_last_name, telegram_phone, session, api_id, api_hash, token, created_at, reset_token, reset_token_expires FROM users WHERE reset_token = ?', [token]);
    if (!results.length || !results[0].values.length)
        return null;
    return mapUserRow(results[0].values[0]);
}
export function updateUserResetToken(userId, token, expires) {
    const d = getDb();
    d.run('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, userId]);
    saveDb();
}
export function updateUserPassword(userId, passwordHash) {
    const d = getDb();
    d.run('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [passwordHash, userId]);
    saveDb();
}
export function registerUser(username, passwordHash, email) {
    const d = getDb();
    const id = crypto.randomBytes(16).toString('hex');
    const token = crypto.randomBytes(32).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    d.run(`INSERT INTO users (id, username, password_hash, email, token, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`, [id, username.toLowerCase(), passwordHash, email || null, token, now]);
    saveDb();
    return getUserById(id);
}
export function updateUserTelegramSession(userId, tgData) {
    const d = getDb();
    d.run(`UPDATE users SET
       telegram_id = ?,
       telegram_username = ?,
       telegram_first_name = ?,
       telegram_last_name = ?,
       telegram_phone = ?,
       session = ?,
       api_id = ?,
       api_hash = ?
     WHERE id = ?`, [
        tgData.telegramId,
        tgData.telegramUsername || null,
        tgData.telegramFirstName || null,
        tgData.telegramLastName || null,
        tgData.telegramPhone || null,
        tgData.session,
        tgData.apiId,
        tgData.apiHash,
        userId,
    ]);
    saveDb();
}
export function disconnectUserTelegram(userId) {
    const d = getDb();
    d.run(`UPDATE users SET
       telegram_id = NULL,
       telegram_username = NULL,
       telegram_first_name = NULL,
       telegram_last_name = NULL,
       telegram_phone = NULL,
       session = NULL,
       api_id = NULL,
       api_hash = NULL
     WHERE id = ?`, [userId]);
    saveDb();
}
export function updateUserWebToken(userId, token) {
    const d = getDb();
    d.run('UPDATE users SET token = ? WHERE id = ?', [token, userId]);
    saveDb();
}
export function deleteUser(id) {
    const d = getDb();
    d.run('DELETE FROM users WHERE id = ?', [id]);
    d.run('DELETE FROM folder_cache WHERE user_id = ?', [id]);
    d.run('DELETE FROM file_cache WHERE user_id = ?', [id]);
    d.run('DELETE FROM thumbnail_cache WHERE user_id = ?', [id]);
    d.run('DELETE FROM groups WHERE user_id = ?', [id]);
    d.run('DELETE FROM share_links WHERE user_id = ?', [id]);
    saveDb();
}
// ── Folder Cache Operations ───────────────────────────────────
export function cacheFolders(userId, folders) {
    const d = getDb();
    const now = Math.floor(Date.now() / 1000);
    for (const f of folders) {
        d.run(`INSERT INTO folder_cache (id, user_id, name, is_saved_messages, updated_at) 
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id, user_id) DO UPDATE SET 
         name = excluded.name,
         is_saved_messages = excluded.is_saved_messages,
         updated_at = excluded.updated_at`, [f.id, userId, f.name, f.isSavedMessages ? 1 : 0, now]);
    }
    saveDb();
}
export function getCachedFolders(userId) {
    const d = getDb();
    const results = d.exec('SELECT id, name, is_saved_messages, group_id FROM folder_cache WHERE user_id = ? ORDER BY is_saved_messages DESC, name ASC', [userId]);
    if (!results.length)
        return [];
    return results[0].values.map((row) => ({
        id: row[0],
        name: row[1],
        is_saved_messages: row[2],
        group_id: row[3],
    }));
}
// ── File Cache Operations ─────────────────────────────────────
export function cacheFiles(userId, folderId, files) {
    const d = getDb();
    const now = Math.floor(Date.now() / 1000);
    for (const f of files) {
        d.run(`INSERT OR REPLACE INTO file_cache 
       (message_id, folder_id, user_id, name, size, mime_type, has_thumb, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [f.messageId, folderId, userId, f.name, f.size, f.mimeType, f.hasThumb ? 1 : 0, f.createdAt, now]);
    }
    saveDb();
}
export function getCachedFiles(userId, folderId) {
    const d = getDb();
    const results = d.exec('SELECT message_id, folder_id, name, size, mime_type, has_thumb, created_at FROM file_cache WHERE user_id = ? AND folder_id = ? ORDER BY message_id DESC', [userId, folderId]);
    if (!results.length)
        return [];
    return results[0].values.map((row) => ({
        message_id: row[0],
        folder_id: row[1],
        name: row[2],
        size: row[3],
        mime_type: row[4],
        has_thumb: row[5],
        created_at: row[6],
    }));
}
export function clearFileCache(userId, folderId) {
    const d = getDb();
    d.run('DELETE FROM file_cache WHERE user_id = ? AND folder_id = ?', [userId, folderId]);
    saveDb();
}
// ── Thumbnail Cache Operations ────────────────────────────────
export function cacheThumbnail(userId, messageId, folderId, data) {
    const d = getDb();
    d.run('INSERT OR REPLACE INTO thumbnail_cache (message_id, folder_id, user_id, data) VALUES (?, ?, ?, ?)', [messageId, folderId, userId, data]);
    saveDb();
}
export function getCachedThumbnail(userId, messageId, folderId) {
    const d = getDb();
    const results = d.exec('SELECT data FROM thumbnail_cache WHERE user_id = ? AND message_id = ? AND folder_id = ?', [userId, messageId, folderId]);
    if (!results.length || !results[0].values.length)
        return null;
    const data = results[0].values[0][0];
    if (data instanceof Uint8Array)
        return Buffer.from(data);
    return null;
}
// ── Storage Statistics ────────────────────────────────────────
export function getStorageStats(userId) {
    const d = getDb();
    const totalResult = d.exec('SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total FROM file_cache WHERE user_id = ?', [userId]);
    const totalRow = totalResult.length ? totalResult[0].values[0] : [0, 0];
    const folderResult = d.exec(`
    SELECT f.folder_id, COALESCE(fc.name, f.folder_id) as folder_name, 
           COUNT(*) as file_count, COALESCE(SUM(f.size), 0) as total_size
    FROM file_cache f
    LEFT JOIN folder_cache fc ON f.folder_id = fc.id AND f.user_id = fc.user_id
    WHERE f.user_id = ?
    GROUP BY f.folder_id
    ORDER BY total_size DESC
  `, [userId]);
    const mimeResult = d.exec(`
    SELECT COALESCE(mime_type, 'unknown') as mime_type, 
           COUNT(*) as file_count, COALESCE(SUM(size), 0) as total_size
    FROM file_cache
    WHERE user_id = ?
    GROUP BY mime_type
    ORDER BY total_size DESC
  `, [userId]);
    return {
        totalSize: totalRow[1],
        totalFiles: totalRow[0],
        byFolder: folderResult.length
            ? folderResult[0].values.map((r) => ({
                folderId: r[0],
                folderName: r[1],
                fileCount: r[2],
                totalSize: r[3],
            }))
            : [],
        byMimeType: mimeResult.length
            ? mimeResult[0].values.map((r) => ({
                mimeType: r[0],
                fileCount: r[1],
                totalSize: r[2],
            }))
            : [],
    };
}
// ── Share Link Operations ─────────────────────────────────────
export function createShareLink(userId, params) {
    const d = getDb();
    const now = Math.floor(Date.now() / 1000);
    d.run(`INSERT INTO share_links 
     (id, user_id, message_id, folder_id, file_name, file_size, mime_type, password, expires_at, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        params.id,
        userId,
        params.messageId,
        params.folderId,
        params.fileName,
        params.fileSize,
        params.mimeType,
        params.password || null,
        params.expiresAt || null,
        now,
    ]);
    saveDb();
}
export function getShareLink(id) {
    const d = getDb();
    const results = d.exec('SELECT id, user_id, message_id, folder_id, file_name, file_size, mime_type, password, expires_at, downloads FROM share_links WHERE id = ?', [id]);
    if (!results.length || !results[0].values.length)
        return null;
    const row = results[0].values[0];
    return {
        id: row[0],
        userId: row[1],
        messageId: row[2],
        folderId: row[3],
        fileName: row[4],
        fileSize: row[5],
        mimeType: row[6],
        password: row[7],
        expiresAt: row[8],
        downloads: row[9] || 0,
    };
}
export function getUserShareLinks(userId) {
    const d = getDb();
    const results = d.exec('SELECT id, user_id, message_id, folder_id, file_name, file_size, mime_type, password, expires_at, created_at, downloads FROM share_links WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    if (!results.length || !results[0].values.length)
        return [];
    return results[0].values.map((row) => ({
        id: row[0],
        userId: row[1],
        messageId: row[2],
        folderId: row[3],
        fileName: row[4],
        fileSize: row[5],
        mimeType: row[6],
        password: row[7],
        expiresAt: row[8],
        createdAt: row[9],
        downloads: row[10] || 0,
    }));
}
export function incrementShareLinkDownloads(id) {
    const d = getDb();
    d.run('UPDATE share_links SET downloads = downloads + 1 WHERE id = ?', [id]);
    saveDb();
}
export function deleteShareLink(id) {
    const d = getDb();
    d.run('DELETE FROM share_links WHERE id = ?', [id]);
    saveDb();
}
// ── Group Operations ──────────────────────────────────────────
export function createGroup(userId, id, name, color) {
    const d = getDb();
    const now = Math.floor(Date.now() / 1000);
    d.run('INSERT INTO groups (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)', [id, userId, name, color, now]);
    saveDb();
}
export function getGroups(userId) {
    const d = getDb();
    const results = d.exec('SELECT id, name, color FROM groups WHERE user_id = ? ORDER BY created_at ASC', [userId]);
    if (!results.length)
        return [];
    return results[0].values.map((row) => ({
        id: row[0],
        name: row[1],
        color: row[2],
    }));
}
export function deleteGroup(userId, id) {
    const d = getDb();
    d.run('DELETE FROM groups WHERE user_id = ? AND id = ?', [userId, id]);
    // Dissociate folders belonging to this group
    d.run('UPDATE folder_cache SET group_id = NULL WHERE user_id = ? AND group_id = ?', [userId, id]);
    saveDb();
}
export function updateFolderGroup(userId, folderId, groupId) {
    const d = getDb();
    d.run('UPDATE folder_cache SET group_id = ? WHERE user_id = ? AND id = ?', [groupId, userId, folderId]);
    saveDb();
}
//# sourceMappingURL=db.js.map