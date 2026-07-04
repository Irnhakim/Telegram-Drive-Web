import { Router } from 'express';
import { Api } from 'telegram';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  getTelegramClient,
  getMessages,
  getSavedMessages,
  uploadFile,
  downloadFileToBuffer,
  downloadThumbnail,
  deleteMessages,
  forwardMessage,
  editCaption,
} from '../telegram.js';
import { cacheFiles, cacheThumbnail, getCachedThumbnail, clearFileCache } from '../db.js';
import { getMimeType, formatFileSize, getFileCategory } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.resolve(__dirname, '../../data/uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({ dest: UPLOAD_DIR });

export const filesRouter = Router();

// Helper: resolve folder entity
async function resolveEntity(folderId: string): Promise<Api.TypeEntityLike | null> {
  const client = getTelegramClient();
  if (!client) return null;

  if (folderId === 'me' || !folderId) {
    return await getSavedMessages() || 'me';
  }

  try {
    // gram.js uses big-integer package for entity BigInt matching, let's cast to any to bypass strict compiler match
    const entity = await client.getEntity(BigInt(folderId) as any);
    return entity;
  } catch (e) {
    console.error('Failed to resolve entity:', folderId, e);
    return null;
  }
}

// Helper: extract file info from message
function extractFileInfo(msg: Api.Message, folderId: string) {
  let name = 'unknown';
  let size = 0;
  let mimeType = 'application/octet-stream';
  let hasThumb = false;

  if (msg.media) {
    if (msg.media instanceof Api.MessageMediaDocument && msg.media.document) {
      const doc = msg.media.document;
      if (doc instanceof Api.Document) {
        size = Number(doc.size);
        mimeType = doc.mimeType || 'application/octet-stream';
        hasThumb = (doc.thumbs && doc.thumbs.length > 0) || false;

        // Get filename from attributes
        for (const attr of doc.attributes) {
          if (attr instanceof Api.DocumentAttributeFilename) {
            name = attr.fileName;
          }
        }

        if (name === 'unknown') {
          name = `file_${msg.id}`;
        }
      }
    } else if (msg.media instanceof Api.MessageMediaPhoto) {
      name = `photo_${msg.id}.jpg`;
      mimeType = 'image/jpeg';
      hasThumb = true;
      if (msg.media.photo instanceof Api.Photo) {
        // Estimate size from largest photo size
        const sizes = msg.media.photo.sizes;
        if (sizes && sizes.length > 0) {
          const last = sizes[sizes.length - 1];
          if ('size' in last) {
            size = last.size;
          }
        }
      }
    }
  }

  // Use caption as display name if available
  if (msg.message && msg.message.trim() && name.startsWith('file_')) {
    name = msg.message.trim();
  }

  const createdAt = msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString();

  return {
    id: msg.id,
    name,
    size,
    sizeStr: formatFileSize(size),
    mimeType,
    category: getFileCategory(mimeType),
    hasThumb,
    createdAt,
    folderId,
  };
}

// List files in a folder
filesRouter.get('/', async (req, res) => {
  try {
    const folderId = (req.query.folder_id as string) || 'me';
    const limit = parseInt(req.query.limit as string) || 50;
    const offsetId = parseInt(req.query.offset_id as string) || 0;
    const search = (req.query.search as string) || '';
    const sort = (req.query.sort as string) || '';
    const order = (req.query.order as string) || 'desc';

    const entity = await resolveEntity(folderId);
    if (!entity) {
      res.status(404).json({
        error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' },
      });
      return;
    }

    const { messages, total } = await getMessages(entity, { limit, offsetId, search });

    const files = messages.map((msg) => extractFileInfo(msg, folderId));

    // Sort if requested
    if (sort) {
      files.sort((a, b) => {
        let cmp = 0;
        if (sort === 'name') cmp = a.name.localeCompare(b.name);
        else if (sort === 'size') cmp = a.size - b.size;
        else if (sort === 'created_at') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return order === 'asc' ? cmp : -cmp;
      });
    }

    // Cache files
    cacheFiles(
      folderId,
      files.map((f) => ({
        messageId: f.id,
        name: f.name,
        size: f.size,
        mimeType: f.mimeType,
        hasThumb: f.hasThumb,
        createdAt: f.createdAt,
      }))
    );

    res.json({
      files,
      total,
      page: Math.floor(offsetId / limit) + 1,
      limit,
    });
  } catch (err: any) {
    console.error('List files error:', err);
    res.status(500).json({
      error: { code: 'LIST_FILES_FAILED', message: err.message },
    });
  }
});

// Get file details
filesRouter.get('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const folderId = (req.query.folder_id as string) || 'me';

    const entity = await resolveEntity(folderId);
    if (!entity) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } });
      return;
    }

    const client = getTelegramClient();
    if (!client) {
      res.status(500).json({ error: { code: 'NOT_CONNECTED', message: 'Not connected' } });
      return;
    }

    const msgs = await client.getMessages(entity, { ids: [parseInt(messageId)] });
    if (!msgs || msgs.length === 0 || !msgs[0]) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    const info = extractFileInfo(msgs[0] as Api.Message, folderId);
    res.json(info);
  } catch (err: any) {
    console.error('Get file error:', err);
    res.status(500).json({
      error: { code: 'GET_FILE_FAILED', message: err.message },
    });
  }
});

// Download file
filesRouter.get('/:messageId/download', async (req, res) => {
  try {
    const { messageId } = req.params;
    const folderId = (req.query.folder_id as string) || 'me';

    const entity = await resolveEntity(folderId);
    if (!entity) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } });
      return;
    }

    const client = getTelegramClient();
    if (!client) {
      res.status(500).json({ error: { code: 'NOT_CONNECTED', message: 'Not connected' } });
      return;
    }

    const msgs = await client.getMessages(entity, { ids: [parseInt(messageId)] });
    if (!msgs || msgs.length === 0 || !msgs[0]) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    const msg = msgs[0] as Api.Message;
    const info = extractFileInfo(msg, folderId);

    const buffer = await downloadFileToBuffer(msg);
    if (!buffer) {
      res.status(500).json({ error: { code: 'DOWNLOAD_FAILED', message: 'Failed to download file' } });
      return;
    }

    res.setHeader('Content-Type', info.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(info.name)}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  } catch (err: any) {
    console.error('Download error:', err);
    res.status(500).json({
      error: { code: 'DOWNLOAD_FAILED', message: err.message },
    });
  }
});

// Get thumbnail
filesRouter.get('/:messageId/thumbnail', async (req, res) => {
  try {
    const { messageId } = req.params;
    const folderId = (req.query.folder_id as string) || 'me';
    const msgId = parseInt(messageId);

    // Check cache first
    const cached = getCachedThumbnail(msgId, folderId);
    if (cached) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(cached);
      return;
    }

    const entity = await resolveEntity(folderId);
    if (!entity) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } });
      return;
    }

    const client = getTelegramClient();
    if (!client) {
      res.status(500).json({ error: { code: 'NOT_CONNECTED', message: 'Not connected' } });
      return;
    }

    const msgs = await client.getMessages(entity, { ids: [msgId] });
    if (!msgs || msgs.length === 0 || !msgs[0]) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    const thumbBuffer = await downloadThumbnail(msgs[0] as Api.Message);
    if (!thumbBuffer) {
      res.status(404).json({ error: { code: 'NO_THUMBNAIL', message: 'No thumbnail available' } });
      return;
    }

    // Cache thumbnail
    cacheThumbnail(msgId, folderId, thumbBuffer);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(thumbBuffer);
  } catch (err: any) {
    console.error('Thumbnail error:', err);
    res.status(500).json({
      error: { code: 'THUMBNAIL_FAILED', message: err.message },
    });
  }
});

// Upload file
filesRouter.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'No file provided' } });
      return;
    }

    const folderId = (req.body.folder_id as string) || 'me';
    const entity = await resolveEntity(folderId);
    if (!entity) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } });
      return;
    }

    const originalName = file.originalname || `upload_${Date.now()}`;
    const result = await uploadFile(entity, file.path, originalName);

    // Clean up temp file
    try {
      fs.unlinkSync(file.path);
    } catch { /* ignore */ }

    // Clear file cache for this folder to force refresh
    clearFileCache(folderId);

    const info = extractFileInfo(result, folderId);
    res.json({
      success: true,
      file: info,
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    // Clean up temp file on error
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
    res.status(500).json({
      error: { code: 'UPLOAD_FAILED', message: err.message },
    });
  }
});

// Delete file
filesRouter.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const folderId = (req.query.folder_id as string) || 'me';

    const entity = await resolveEntity(folderId);
    if (!entity) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } });
      return;
    }

    const success = await deleteMessages(entity, [parseInt(messageId)]);
    if (!success) {
      res.status(500).json({ error: { code: 'DELETE_FAILED', message: 'Failed to delete file' } });
      return;
    }

    // Clear file cache
    clearFileCache(folderId);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete error:', err);
    res.status(500).json({
      error: { code: 'DELETE_FAILED', message: err.message },
    });
  }
});

// Rename file (edit caption)
filesRouter.patch('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { name } = req.body;
    const folderId = (req.query.folder_id as string) || 'me';

    if (!name) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'New name is required' } });
      return;
    }

    const entity = await resolveEntity(folderId);
    if (!entity) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } });
      return;
    }

    const success = await editCaption(entity, parseInt(messageId), name);
    if (!success) {
      res.status(500).json({ error: { code: 'RENAME_FAILED', message: 'Failed to rename file' } });
      return;
    }

    clearFileCache(folderId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Rename error:', err);
    res.status(500).json({
      error: { code: 'RENAME_FAILED', message: err.message },
    });
  }
});

// Copy file to another folder
filesRouter.post('/:messageId/copy', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { folder_id: targetFolderId, source_folder_id: sourceFolderId } = req.body;

    if (!targetFolderId) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Target folder_id is required' } });
      return;
    }

    const fromEntity = await resolveEntity(sourceFolderId || 'me');
    const toEntity = await resolveEntity(targetFolderId);

    if (!fromEntity || !toEntity) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } });
      return;
    }

    const success = await forwardMessage(fromEntity, toEntity, parseInt(messageId));
    if (!success) {
      res.status(500).json({ error: { code: 'COPY_FAILED', message: 'Failed to copy file' } });
      return;
    }

    clearFileCache(targetFolderId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Copy error:', err);
    res.status(500).json({
      error: { code: 'COPY_FAILED', message: err.message },
    });
  }
});

// Bulk operations (delete, move)
filesRouter.post('/bulk', async (req, res) => {
  try {
    const { action, file_ids, folder_id, payload } = req.body;
    const folderId = folder_id || 'me';

    if (!action || !file_ids || !Array.isArray(file_ids)) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Action and file_ids array are required' },
      });
      return;
    }

    const entity = await resolveEntity(folderId);
    if (!entity) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } });
      return;
    }

    if (action === 'delete') {
      const success = await deleteMessages(entity, file_ids);
      clearFileCache(folderId);
      res.json({ success, deleted: file_ids.length });
    } else if (action === 'move' && payload?.folder_id) {
      const toEntity = await resolveEntity(payload.folder_id);
      if (!toEntity) {
        res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Target folder not found' } });
        return;
      }

      let moved = 0;
      for (const fid of file_ids) {
        const ok = await forwardMessage(entity, toEntity, fid);
        if (ok) moved++;
      }

      // Delete from source after moving
      if (moved > 0) {
        await deleteMessages(entity, file_ids);
        clearFileCache(folderId);
        clearFileCache(payload.folder_id);
      }

      res.json({ success: true, moved });
    } else {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: `Unknown action: ${action}` },
      });
    }
  } catch (err: any) {
    console.error('Bulk operation error:', err);
    res.status(500).json({
      error: { code: 'BULK_FAILED', message: err.message },
    });
  }
});

import * as archiverModule from 'archiver';

// Bulk download ZIP stream (PUBLIC/AUTHENTICATED)
filesRouter.post('/bulk-download', async (req, res) => {
  try {
    const { file_ids, folder_id } = req.body;
    const folderId = folder_id || 'me';

    if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'file_ids array is required' } });
      return;
    }

    const entity = await resolveEntity(folderId);
    if (!entity) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } });
      return;
    }

    const client = getTelegramClient();
    if (!client) {
      res.status(500).json({ error: { code: 'NOT_CONNECTED', message: 'Not connected' } });
      return;
    }

    // Set response headers for zip file stream
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="telegram-drive-download-${Date.now()}.zip"`);

    const archiver = ((archiverModule as any).default || archiverModule) as any;
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Handle errors from archive packing
    archive.on('error', (err: any) => {
      console.error('ZIP packing error:', err);
      // If headers are already sent, we cannot send custom json error
      if (!res.headersSent) {
        res.status(500).send('Failed to package files');
      }
    });

    archive.pipe(res);

    // Download files and append them to zip archive
    for (const fid of file_ids) {
      try {
        const msgs = await client.getMessages(entity, { ids: [fid] });
        if (msgs && msgs.length > 0 && msgs[0]) {
          const msg = msgs[0] as Api.Message;
          const info = extractFileInfo(msg, folderId);
          const buffer = await downloadFileToBuffer(msg);
          
          if (buffer) {
            archive.append(buffer, { name: info.name });
          }
        }
      } catch (e) {
        console.error('Error adding file to zip:', fid, e);
        // Continue downloading remaining files even if one fails
      }
    }

    await archive.finalize();
  } catch (err: any) {
    console.error('Bulk ZIP download error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: { code: 'ZIP_FAILED', message: err.message } });
    }
  }
});
