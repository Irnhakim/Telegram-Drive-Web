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
import { initDatabase } from './db.js';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import { requireUserToken, requireTelegramLink } from './middleware/auth.js';

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
  });
});

import { sharesRouter } from './routes/shares.js';

// Public share routes (Accessible without web token)
app.use('/api/public/shares', sharesRouter);

import { groupsRouter } from './routes/groups.js';

// Auth routes (Self-routed internally for public/protected)
app.use('/api/auth', authRouter);

// Protected API routes require a valid user web token AND linked Telegram account
app.use('/api/folders', requireUserToken, requireTelegramLink, foldersRouter);
app.use('/api/files', requireUserToken, requireTelegramLink, filesRouter);
app.use('/api/storage', requireUserToken, requireTelegramLink, storageRouter);
app.use('/api/shares', requireUserToken, requireTelegramLink, sharesRouter);
app.use('/api/groups', requireUserToken, requireTelegramLink, groupsRouter);

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
  console.log('  ➜ Mode:       👥 Multi-User (Telegram Login)');
  console.log('');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`  ✅ Server running on port ${PORT}\n`);
  });
}

start().catch(console.error);
