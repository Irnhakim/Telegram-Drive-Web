import { Download, MoreVertical } from 'lucide-react';
import { FileTypeIcon } from '../shared/FileTypeIcon';
import type { TelegramFile } from '../../types';

interface FileListItemProps {
  file: TelegramFile;
  folderId: string;
  onDownload: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function FileListItem({ file, folderId, onDownload, onContextMenu }: FileListItemProps) {
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
      className="file-list-item"
      onContextMenu={onContextMenu}
      onDoubleClick={onDownload}
    >
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
