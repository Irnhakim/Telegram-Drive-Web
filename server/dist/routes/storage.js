import { Router } from 'express';
import { getStorageStats } from '../db.js';
import { formatFileSize } from '../utils.js';
export const storageRouter = Router();
// Storage statistics
storageRouter.get('/stats', async (_req, res) => {
    try {
        const stats = getStorageStats();
        res.json({
            total_storage_used_bytes: stats.totalSize,
            total_storage_used: formatFileSize(stats.totalSize),
            total_file_count: stats.totalFiles,
            folders: stats.byFolder.map((f) => ({
                id: f.folderId,
                name: f.folderName,
                file_count: f.fileCount,
                size_bytes: f.totalSize,
                size: formatFileSize(f.totalSize),
            })),
            mime_types: stats.byMimeType.map((m) => ({
                mime_type: m.mimeType,
                file_count: m.fileCount,
                size_bytes: m.totalSize,
                size: formatFileSize(m.totalSize),
            })),
        });
    }
    catch (err) {
        console.error('Storage stats error:', err);
        res.status(500).json({
            error: { code: 'STATS_FAILED', message: err.message },
        });
    }
});
//# sourceMappingURL=storage.js.map