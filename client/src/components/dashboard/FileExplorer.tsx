import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FilePlus, FolderPlus } from 'lucide-react';
import { FileCard } from './FileCard';
import { FileListItem } from './FileListItem';
import { ContextMenu } from './ContextMenu';
import { ShareModal } from './ShareModal';
import { filesApi } from '../../api/client';
import type { TelegramFile, TelegramFolder, ViewMode } from '../../types';

interface FileExplorerProps {
  files: TelegramFile[];
  viewMode: ViewMode;
  currentFolderId: string;
  folders: TelegramFolder[];
  onUpload: (files: FileList) => void;
  onDelete: (fileId: number) => void;
  onRename: (fileId: number, newName: string) => void;
  selectedFileIds: number[];
  onToggleSelectFile: (fileId: number) => void;
}

export function FileExplorer({
  files, viewMode, currentFolderId, folders,
  onUpload, onDelete, onRename,
  selectedFileIds, onToggleSelectFile,
}: FileExplorerProps) {
  const [dragOver, setDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; file: TelegramFile;
  } | null>(null);
  const [shareFile, setShareFile] = useState<TelegramFile | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [sortField, setSortField] = useState<'name' | 'size' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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

  const handleDownload = (file: TelegramFile) => {
    const url = filesApi.getDownloadUrl(file.id, currentFolderId);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRenamePrompt = (file: TelegramFile) => {
    const newName = prompt('Enter new file name:', file.name);
    if (newName && newName.trim() && newName.trim() !== file.name) {
      onRename(file.id, newName.trim());
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadFolderClick = () => {
    if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      e.target.value = '';
    }
  };

  // Sort files helper
  const sortedFiles = [...files].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortField === 'size') {
      cmp = a.size - b.size;
    } else if (sortField === 'date') {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  return (
    <div
      ref={dropRef}
      className="content-area"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', padding: '20px' }}
    >
      {/* Invisible inputs for file/folder upload */}
      <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
      <input
        ref={folderInputRef}
        type="file"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        {...({ webkitdirectory: "", directory: "" } as any)}
      />

      {/* Sorter Bar & Zoom Slider */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)'
      }}>
        
        {/* Sort triggers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Sort by:</span>
          
          <button
            onClick={() => {
              if (sortField === 'name') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
              else setSortField('name');
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: sortField === 'name' ? 'var(--text-accent)' : 'var(--text-secondary)',
              fontWeight: sortField === 'name' ? 600 : 500, display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            Name {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>

          <button
            onClick={() => {
              if (sortField === 'size') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
              else setSortField('size');
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: sortField === 'size' ? 'var(--text-accent)' : 'var(--text-secondary)',
              fontWeight: sortField === 'size' ? 600 : 500, display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            Size {sortField === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>

          <button
            onClick={() => {
              if (sortField === 'date') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
              else setSortField('date');
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: sortField === 'date' ? 'var(--text-accent)' : 'var(--text-secondary)',
              fontWeight: sortField === 'date' ? 600 : 500, display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            Date {sortField === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
        </div>

        {/* Zoom Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>🔍</span>
          <input
            type="range"
            min="60"
            max="140"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseInt(e.target.value))}
            style={{ accentColor: 'var(--accent-primary)', width: '80px', cursor: 'pointer' }}
          />
          <span style={{ minWidth: '34px', textAlign: 'right' }}>{zoomLevel}%</span>
        </div>

      </div>

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
            background: 'rgba(245, 158, 11, 0.05)',
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

      {/* Grid view containing files + dynamic upload cards */}
      {viewMode === 'grid' ? (
        <div className="file-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(180 * (zoomLevel / 100))}px, 1fr))` }}>
          
          {/* File Cards list */}
          {sortedFiles.map((file, index) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.4) }}
            >
              <FileCard
                file={file}
                folderId={currentFolderId}
                onDownload={() => handleDownload(file)}
                onContextMenu={(e) => handleContextMenu(e, file)}
                isSelected={selectedFileIds.includes(file.id)}
                onToggleSelect={(e) => {
                  e.stopPropagation();
                  onToggleSelectFile(file.id);
                }}
              />
            </motion.div>
          ))}

          {/* Dotted Upload File Action Card */}
          <div
            onClick={handleUploadClick}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '24px 16px', background: 'rgba(255,255,255,0.01)',
              border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-lg)',
              cursor: 'pointer', minHeight: '140px', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'rgba(255,255,255,0.01)'; }}
          >
            <FilePlus size={28} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Upload File</span>
          </div>

          {/* Dotted Upload Folder Action Card */}
          <div
            onClick={handleUploadFolderClick}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '24px 16px', background: 'rgba(255,255,255,0.01)',
              border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-lg)',
              cursor: 'pointer', minHeight: '140px', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'rgba(255,255,255,0.01)'; }}
          >
            <FolderPlus size={28} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Upload Folder</span>
          </div>

        </div>
      ) : (
        /* List View */
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
          {sortedFiles.map((file, index) => (
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
                isSelected={selectedFileIds.includes(file.id)}
                onToggleSelect={(e) => {
                  e.stopPropagation();
                  onToggleSelectFile(file.id);
                }}
              />
            </motion.div>
          ))}
        </div>
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
