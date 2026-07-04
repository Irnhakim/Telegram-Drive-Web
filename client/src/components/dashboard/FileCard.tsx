import { Download, MoreVertical } from 'lucide-react';
import { FileTypeIcon } from '../shared/FileTypeIcon';
import { filesApi } from '../../api/client';
import type { TelegramFile } from '../../types';

interface FileCardProps {
  file: TelegramFile;
  folderId: string;
  onDownload: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function FileCard({ file, folderId, onDownload, onContextMenu }: FileCardProps) {
  const showThumb = file.hasThumb && (file.category === 'image' || file.category === 'video');
  const thumbUrl = showThumb ? filesApi.getThumbnailUrl(file.id, folderId) : null;

  return (
    <div
      className="file-card"
      onContextMenu={onContextMenu}
      onDoubleClick={onDownload}
    >
      {/* Thumbnail or icon */}
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={file.name}
          className="file-card-thumb"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <FileTypeIcon mimeType={file.mimeType} category={file.category} size={28} />
      )}

      {/* File name */}
      <div className="file-card-name" title={file.name}>
        {file.name}
      </div>

      {/* Meta */}
      <div className="file-card-meta">
        {file.sizeStr}
      </div>

      {/* Hover actions */}
      <div style={{
        position: 'absolute', top: '8px', right: '8px',
        display: 'flex', gap: '4px', opacity: 0,
        transition: 'opacity 0.15s',
      }} className="file-card-actions">
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          style={{
            width: '28px', height: '28px', borderRadius: '6px',
            background: 'rgba(0,0,0,0.6)', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'white',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Download size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onContextMenu(e); }}
          style={{
            width: '28px', height: '28px', borderRadius: '6px',
            background: 'rgba(0,0,0,0.6)', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'white',
            backdropFilter: 'blur(8px)',
          }}
        >
          <MoreVertical size={14} />
        </button>
      </div>

      <style>{`
        .file-card:hover .file-card-actions {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
