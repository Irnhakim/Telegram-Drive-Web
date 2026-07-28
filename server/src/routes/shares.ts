import { Router } from 'express';
import crypto from 'crypto';
import { Api, TelegramClient } from 'telegram';
import { createShareLink, getShareLink, deleteShareLink } from '../db.js';
import { getClientForUser, downloadFileStream, getSavedMessages } from '../telegram.js';
import { getMimeType, formatFileSize } from '../utils.js';

export const sharesRouter = Router();

// Enable CORS for all public share endpoints
sharesRouter.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Helper: resolve folder entity
async function resolveEntity(client: TelegramClient, folderId: string): Promise<Api.TypeEntityLike | null> {
  if (folderId === 'me' || !folderId) {
    return await getSavedMessages(client) || 'me';
  }

  try {
    const entity = await client.getEntity(BigInt(folderId) as any);
    return entity;
  } catch (e) {
    console.error('Failed to resolve entity:', folderId, e);
    return null;
  }
}

// Generate share link (AUTHENTICATED)
sharesRouter.post('/generate', async (req, res) => {
  const client = (req as any).telegramClient;
  const userId = (req as any).user.id;

  try {
    const { messageId, folderId, fileName, fileSize, mimeType, password, expiresHours } = req.body;

    if (!messageId || !folderId || !fileName || !fileSize) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Required parameters missing' } });
      return;
    }

    const shareId = crypto.randomBytes(6).toString('base64url');
    const expiresAt = expiresHours ? Math.floor(Date.now() / 1000) + (expiresHours * 3600) : undefined;

    createShareLink(userId, {
      id: shareId,
      messageId: parseInt(messageId, 10),
      folderId,
      fileName,
      fileSize: parseInt(fileSize, 10),
      mimeType: mimeType || getMimeType(fileName),
      password: password || undefined,
      expiresAt,
    });

    res.json({
      success: true,
      shareId,
      url: `/share/${shareId}`,
    });
  } catch (err: any) {
    console.error('Generate share link error:', err);
    res.status(500).json({ error: { code: 'SHARE_FAILED', message: err.message } });
  }
});

// GET share link details (PUBLIC)
sharesRouter.get('/:shareId', (req, res) => {
  try {
    const { shareId } = req.params;
    const share = getShareLink(shareId);

    if (!share) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Share link not found or expired' } });
      return;
    }

    // Check expiration
    if (share.expiresAt && Math.floor(Date.now() / 1000) > share.expiresAt) {
      deleteShareLink(shareId);
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Share link has expired' } });
      return;
    }

    res.json({
      id: share.id,
      fileName: share.fileName,
      fileSize: share.fileSize,
      fileSizeStr: formatFileSize(share.fileSize),
      mimeType: share.mimeType,
      passwordRequired: !!share.password,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SHARE_ERROR', message: err.message } });
  }
});

// Download shared file (PUBLIC - supports GET with query password)
sharesRouter.get('/:shareId/download', async (req, res) => {
  try {
    const { shareId } = req.params;
    const password = (req.query.password as string) || '';

    const share = getShareLink(shareId);

    if (!share) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Share link not found or expired' } });
      return;
    }

    // Check expiration
    if (share.expiresAt && Math.floor(Date.now() / 1000) > share.expiresAt) {
      deleteShareLink(shareId);
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Share link has expired' } });
      return;
    }

    // Check password protection
    if (share.password && share.password !== password) {
      res.status(401).json({ error: { code: 'INVALID_PASSWORD', message: 'Password is incorrect' } });
      return;
    }

    // If only verifying password, exit early
    if (req.query.verify) {
      res.json({ success: true, message: 'Password verified' });
      return;
    }

    // Initialize and connect Telegram client of the link owner
    const client = await getClientForUser(share.userId);
    if (!client) {
      res.status(500).json({ error: { code: 'NOT_CONNECTED', message: 'Owner Telegram session disconnected' } });
      return;
    }

    const entity = await resolveEntity(client, share.folderId);
    if (!entity) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } });
      return;
    }

    const msgs = await client.getMessages(entity, { ids: [share.messageId] });
    if (!msgs || msgs.length === 0 || !msgs[0]) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    res.setHeader('Content-Type', share.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(share.fileName)}"`);
    res.setHeader('Content-Length', share.fileSize.toString());
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // Stream chunks directly to client
    const stream = downloadFileStream(client, msgs[0] as Api.Message, share.fileSize);
    for await (const chunk of stream) {
      res.write(chunk);
      // Abort downloading if client closed the connection early
      if (res.destroyed) break;
    }
    res.end();
  } catch (err: any) {
    console.error('Download share file error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: { code: 'DOWNLOAD_FAILED', message: err.message } });
    }
  }
});
