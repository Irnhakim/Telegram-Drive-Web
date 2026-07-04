import { useEffect, useRef } from 'react';
import { Download, Pencil, Trash2, Link } from 'lucide-react';
import { motion } from 'framer-motion';
import type { TelegramFile, TelegramFolder } from '../../types';

interface ContextMenuProps {
  x: number;
  y: number;
  file: TelegramFile;
  folders: TelegramFolder[];
  currentFolderId: string;
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onRename: () => void;
  onShare: () => void;
}

export function ContextMenu({
  x, y, file, onClose, onDownload, onDelete, onRename, onShare,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position to stay in viewport
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;

    if (rect.right > window.innerWidth) {
      menu.style.left = `${Math.max(8, maxX)}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${Math.max(8, maxY)}px`;
    }
  }, []);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = () => onClose();
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.12 }}
      className="context-menu"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* File info header */}
      <div style={{
        padding: '8px 12px 6px', fontSize: '0.75rem', fontWeight: 600,
        color: 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px',
      }}>
        {file.name}
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
          {file.sizeStr}
        </div>
      </div>

      <button className="context-menu-item" onClick={onDownload}>
        <Download size={15} /> Download
      </button>
      <button className="context-menu-item" onClick={onRename}>
        <Pencil size={15} /> Rename
      </button>
      <button className="context-menu-item" onClick={onShare}>
        <Link size={15} style={{ color: 'var(--text-accent)' }} /> Share File
      </button>
      <div className="context-menu-divider" />
      <button className="context-menu-item danger" onClick={onDelete}>
        <Trash2 size={15} /> Delete
      </button>
    </motion.div>
  );
}
