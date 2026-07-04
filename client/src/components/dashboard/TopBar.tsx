import { useRef } from 'react';
import {
  Search, LayoutGrid, List, Upload, RefreshCw, Menu,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import type { TelegramFolder, ViewMode, SortField, SortOrder } from '../../types';

interface TopBarProps {
  currentFolder?: TelegramFolder;
  viewMode: ViewMode;
  searchQuery: string;
  sortField: SortField;
  sortOrder: SortOrder;
  totalFiles: number;
  onViewModeChange: (mode: ViewMode) => void;
  onSearchChange: (query: string) => void;
  onSortFieldChange: (field: SortField) => void;
  onSortOrderChange: (order: SortOrder) => void;
  onUpload: (files: FileList) => void;
  onToggleSidebar: () => void;
  onRefresh: () => void;
}

export function TopBar({
  currentFolder, viewMode, searchQuery, sortField, sortOrder, totalFiles,
  onViewModeChange, onSearchChange, onSortFieldChange, onSortOrderChange,
  onUpload, onToggleSidebar, onRefresh,
}: TopBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div className="topbar">
      {/* Mobile menu */}
      <button
        className="btn btn-ghost btn-icon"
        onClick={onToggleSidebar}
        style={{ display: 'none' }}
        id="mobile-menu-btn"
      >
        <Menu size={20} />
      </button>

      {/* Current folder name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <h2 style={{
          fontSize: '1.125rem', fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {currentFolder?.name || 'Loading...'}
        </h2>
        <span className="badge badge-blue">{totalFiles}</span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '280px', flex: '0 1 280px' }}>
        <Search size={16} style={{
          position: 'absolute', left: '12px', top: '50%',
          transform: 'translateY(-50%)', color: 'var(--text-muted)',
        }} />
        <input
          className="input"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search files..."
          style={{ paddingLeft: '36px', fontSize: '0.8125rem', height: '36px' }}
        />
      </div>

      {/* Sort */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <select
          value={sortField}
          onChange={(e) => onSortFieldChange(e.target.value as SortField)}
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)', padding: '6px 8px',
            color: 'var(--text-secondary)', fontSize: '0.75rem',
            cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
          }}
        >
          <option value="created_at">Date</option>
          <option value="name">Name</option>
          <option value="size">Size</option>
        </select>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          style={{ padding: '6px' }}
        >
          {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
        </button>
      </div>

      {/* View mode toggle */}
      <div style={{
        display: 'flex', background: 'rgba(255,255,255,0.04)',
        borderRadius: 'var(--radius-md)', padding: '2px',
        border: '1px solid var(--border-subtle)',
      }}>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => onViewModeChange('grid')}
          style={{
            padding: '6px', borderRadius: 'var(--radius-sm)',
            background: viewMode === 'grid' ? 'rgba(59,130,246,0.15)' : 'transparent',
            color: viewMode === 'grid' ? 'var(--accent-primary)' : 'var(--text-muted)',
          }}
        >
          <LayoutGrid size={16} />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => onViewModeChange('list')}
          style={{
            padding: '6px', borderRadius: 'var(--radius-sm)',
            background: viewMode === 'list' ? 'rgba(59,130,246,0.15)' : 'transparent',
            color: viewMode === 'list' ? 'var(--accent-primary)' : 'var(--text-muted)',
          }}
        >
          <List size={16} />
        </button>
      </div>

      {/* Refresh */}
      <button className="btn btn-ghost btn-icon" onClick={onRefresh} title="Refresh" style={{ padding: '6px' }}>
        <RefreshCw size={16} />
      </button>

      {/* Upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}>
        <Upload size={16} /> Upload
      </button>

      {/* CSS for mobile menu button */}
      <style>{`
        @media (max-width: 768px) {
          #mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
