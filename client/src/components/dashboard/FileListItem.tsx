import { Download, MoreVertical } from 'lucide-react';
import { FileTypeIcon } from '../shared/FileTypeIcon';
import type { TelegramFile } from '../../types';

interface FileListItemProps {
  file: TelegramFile;
  onDownload: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  isSelected: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
}

export function FileListItem({ file, onDownload, onContextMenu, isSelected, onToggleSelect }: FileListItemProps) {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div
      className={`file-list-item ${isSelected ? 'selected' : ''}`}
      onContextMenu={onContextMenu}
      onDoubleClick={onDownload}
      style={{
        background: isSelected ? 'rgba(245,158,11,0.05)' : undefined,
        borderLeft: isSelected ? '3px solid var(--accent-primary)' : undefined,
      }}
    >
      {/* Circle selector dot */}
      <div
        onClick={onToggleSelect}
        style={{
          width: '16px', height: '16px', borderRadius: '50%',
          border: isSelected ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.2)',
          background: isSelected ? 'rgba(0,0,0,0.4)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', marginRight: '10px',
        }}
      >
        {isSelected && (
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--accent-primary)'
          }} />
        )}
      </div>

      <FileTypeIcon mimeType={file.mimeType} category={file.category} size={18} />

      <div style={{
        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', fontSize: '0.875rem',
      }}>
        {file.name}
      </div>

      <div style={{
        width: '100px', textAlign: 'right',
        fontSize: '0.8125rem', color: 'var(--text-muted)',
      }}>
        {file.sizeStr}
      </div>

      <div style={{
        width: '140px', textAlign: 'right',
        fontSize: '0.8125rem', color: 'var(--text-muted)',
      }}>
        {formatDate(file.createdAt)}
      </div>

      <div style={{ width: '60px', display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          className="btn btn-ghost btn-icon"
          style={{ padding: '4px', color: 'var(--text-muted)' }}
        >
          <Download size={15} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onContextMenu(e); }}
          className="btn btn-ghost btn-icon"
          style={{ padding: '4px', color: 'var(--text-muted)' }}
        >
          <MoreVertical size={15} />
        </button>
      </div>
    </div>
  );
}
