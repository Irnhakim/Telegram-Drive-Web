import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, CloudOff } from 'lucide-react';
import { FileCard } from './FileCard';
import { FileListItem } from './FileListItem';
import { ContextMenu } from './ContextMenu';
import { ShareModal } from './ShareModal';
import { filesApi } from '../../api/client';
import type { TelegramFile, TelegramFolder, ViewMode } from '../../types';

interface FileExplorerProps {
  files: TelegramFile[];
  loading: boolean;
  viewMode: ViewMode;
  currentFolderId: string;
  folders: TelegramFolder[];
  onUpload: (files: FileList) => void;
  onDelete: (fileId: number) => void;
  onRename: (fileId: number, newName: string) => void;
  onRefresh: () => void;
}

export function FileExplorer({
  files, loading, viewMode, currentFolderId, folders,
  onUpload, onDelete, onRename,
}: FileExplorerProps) {
  const [dragOver, setDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; file: TelegramFile;
  } | null>(null);
  const [shareFile, setShareFile] = useState<TelegramFile | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Drag & Drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  }, [onUpload]);

  // Context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, file: TelegramFile) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }, []);

  const handleDownload = useCallback((file: TelegramFile) => {
    const url = filesApi.getDownloadUrl(file.id, currentFolderId);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [currentFolderId]);

  const handleRenamePrompt = useCallback((file: TelegramFile) => {
    const newName = prompt('Enter new name:', file.name);
    if (newName && newName !== file.name) {
      onRename(file.id, newName);
    }
  }, [onRename]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="content-area">
        <div className={viewMode === 'grid' ? 'file-grid' : ''}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton" style={{
              height: viewMode === 'grid' ? '180px' : '48px',
              borderRadius: 'var(--radius-lg)',
              marginBottom: viewMode === 'list' ? '8px' : 0,
            }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dropRef}
      className="content-area"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {/* Drag overlay */}
      {dragOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute', inset: '16px',
            border: '2px dashed var(--accent-primary)',
            borderRadius: 'var(--radius-xl)',
            background: 'rgba(59, 130, 246, 0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '12px', zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <Upload size={48} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
            Drop files to upload
          </span>
        </motion.div>
      )}

      {/* Empty state */}
      {files.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <CloudOff size={36} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h3 style={{ color: 'var(--text-secondary)' }}>No files yet</h3>
          <p style={{ fontSize: '0.875rem', maxWidth: '360px', textAlign: 'center' }}>
            Upload files by clicking the Upload button or drag & drop files here
          </p>
          <button className="btn btn-primary" onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files) onUpload(files);
            };
            input.click();
          }}>
            <Upload size={18} /> Upload Files
          </button>
        </div>
      )}

      {/* File grid/list */}
      {files.length > 0 && (
        viewMode === 'grid' ? (
          <div className="file-grid">
            {files.map((file, index) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.5) }}
              >
                <FileCard
                  file={file}
                  folderId={currentFolderId}
                  onDownload={() => handleDownload(file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div>
            {/* List header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '8px 16px', fontSize: '0.6875rem', fontWeight: 600,
              color: 'var(--text-muted)', textTransform: 'uppercase',
              letterSpacing: '0.08em', borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '4px',
            }}>
              <div style={{ width: '32px' }} />
              <div style={{ flex: 1 }}>Name</div>
              <div style={{ width: '100px', textAlign: 'right' }}>Size</div>
              <div style={{ width: '140px', textAlign: 'right' }}>Date</div>
              <div style={{ width: '60px' }} />
            </div>
            {files.map((file, index) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.3) }}
              >
                <FileListItem
                  file={file}
                  onDownload={() => handleDownload(file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                />
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          folders={folders}
          currentFolderId={currentFolderId}
          onClose={() => setContextMenu(null)}
          onDownload={() => { handleDownload(contextMenu.file); setContextMenu(null); }}
          onDelete={() => { onDelete(contextMenu.file.id); setContextMenu(null); }}
          onRename={() => { handleRenamePrompt(contextMenu.file); setContextMenu(null); }}
          onShare={() => { setShareFile(contextMenu.file); setContextMenu(null); }}
        />
      )}

      {/* Share Modal */}
      {shareFile && (
        <ShareModal
          file={shareFile}
          folderId={currentFolderId}
          onClose={() => setShareFile(null)}
        />
      )}
    </div>
  );
}
