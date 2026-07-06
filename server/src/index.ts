import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';

import { authRouter } from './routes/auth.js';
import { foldersRouter } from './routes/folders.js';
import { filesRouter } from './routes/files.js';
import { storageRouter } from './routes/storage.js';
import { getTelegramClient } from './telegram.js';
import { initDatabase } from './db.js';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || '';

// In-memory token store (simple approach for single-user)
const validTokens = new Set<string>();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Web Access Password Protection ──────────────────────────
// If ACCESS_PASSWORD is set, ALL routes (except /api/access/*) require a valid token

// Login with access password
app.post('/api/access/login', (req, res) => {
  if (!ACCESS_PASSWORD) {
    // No password configured, auto-grant
    const token = crypto.randomBytes(32).toString('hex');
    validTokens.add(token);
    res.json({ success: true, token });
    return;
  }

  const { password } = req.body;
  if (password === ACCESS_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    validTokens.add(token);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: { code: 'INVALID_PASSWORD', message: 'Invalid access password' } });
  }
});

// Check if access password is required
app.get('/api/access/check', (_req, res) => {
  res.json({
    passwordRequired: !!ACCESS_PASSWORD,
  });
});

// Logout access session
app.post('/api/access/logout', (req, res) => {
  const token = req.headers['x-access-token'] as string;
  if (token) validTokens.delete(token);
  res.json({ success: true });
});

// Access protection middleware
const requireAccess: express.RequestHandler = (req, res, next) => {
  // If no password is configured, allow all
  if (!ACCESS_PASSWORD) {
    next();
    return;
  }

  const token = (req.headers['x-access-token'] as string) || (req.query.token as string);
  if (token && validTokens.has(token)) {
    next();
    return;
  }

  res.status(403).json({
    error: { code: 'ACCESS_DENIED', message: 'Access password required' },
  });
};

// Auth check middleware for Telegram-protected routes
const requireTelegramAuth: express.RequestHandler = async (_req, res, next) => {
  try {
    const client = getTelegramClient();
    if (!client || !client.connected) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated with Telegram' } });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated with Telegram' } });
  }
};

// Health check (public)
app.get('/api/health', (_req, res) => {
  const client = getTelegramClient();
  res.json({
    status: 'ok',
    version: '1.0.0',
    connected: client?.connected || false,
  });
});

import { sharesRouter } from './routes/shares.js';

// Public share routes (Accessible without access password)
app.use('/api/public/shares', sharesRouter);

import { groupsRouter } from './routes/groups.js';

// All API routes require access password
app.use('/api/auth', requireAccess, authRouter);
app.use('/api/folders', requireAccess, requireTelegramAuth, foldersRouter);
app.use('/api/files', requireAccess, requireTelegramAuth, filesRouter);
app.use('/api/storage', requireAccess, requireTelegramAuth, storageRouter);
app.use('/api/shares', requireAccess, requireTelegramAuth, sharesRouter);
app.use('/api/groups', requireAccess, requireTelegramAuth, groupsRouter);

// Serve static frontend in production
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    next();
  } else {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  }
});

// Initialize
async function start() {
  await initDatabase();

  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║     Telegram Drive Web Server        ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  console.log(`  ➜ Local:      http://localhost:${PORT}`);
  console.log(`  ➜ Network:    http://0.0.0.0:${PORT}`);
  console.log(`  ➜ Password:   ${ACCESS_PASSWORD ? '✅ Protected' : '⚠️  No password (set ACCESS_PASSWORD)'}`);
  console.log('');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`  ✅ Server running on port ${PORT}\n`);
  });
}

start().catch(console.error);
