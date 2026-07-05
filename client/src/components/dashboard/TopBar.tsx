import { Search, LayoutGrid, List, X, ChevronRight, Menu } from 'lucide-react';
import type { TelegramFolder, ViewMode } from '../../types';

interface TopBarProps {
  currentFolder?: TelegramFolder;
  viewMode: ViewMode;
  searchQuery: string;
  totalFiles: number;
  onViewModeChange: (mode: ViewMode) => void;
  onSearchChange: (query: string) => void;
  onToggleSidebar: () => void;
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkDownload: () => void;
  onBulkMove: () => void;
  onBulkShare: () => void;
  sidebarCollapsed: boolean;
}

export function TopBar({
  currentFolder, viewMode, searchQuery,
  onViewModeChange, onSearchChange, onToggleSidebar,
  selectedCount, onClearSelection, onBulkDelete, onBulkDownload, onBulkMove, onBulkShare,
  sidebarCollapsed,
}: TopBarProps) {

  return (
    <div className="topbar" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 24px', background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-subtle)', height: 'var(--topbar-height)'
    }}>
      
      {/* Breadcrumb & Uncollapse Trigger (Left corner) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 500 }}>
        <button
          onClick={onToggleSidebar}
          className="btn btn-ghost btn-icon mobile-menu-btn"
          style={{
            padding: '4px', color: 'var(--text-primary)',
            background: 'rgba(255,255,255,0.05)', borderRadius: '4px',
            cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center'
          }}
          title="Toggle Sidebar"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <Menu size={16} />}
        </button>
        <span style={{ color: 'var(--text-muted)' }}>Start</span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentFolder?.name || 'Loading...'}</span>
      </div>

      {/* Centered Search Bar & Selection bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, maxWidth: selectedCount > 0 ? '750px' : '380px', margin: '0 auto' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{
            position: 'absolute', left: '14px', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-muted)',
          }} />
          <input
            className="input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search files..."
            style={{
              paddingLeft: '38px', fontSize: '0.8125rem', height: '36px',
              borderRadius: '18px', background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-default)', outline: 'none'
            }}
          />
        </div>

        {/* Bulk Actions Panel (Triggered if selectedCount > 0) */}
        {selectedCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              {selectedCount} items selected
              <X size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={onClearSelection} />
            </span>
            
            <button
              onClick={onBulkMove}
              style={{
                background: '#d97706', color: 'white', border: 'none',
                borderRadius: '4px', padding: '6px 12px', fontSize: '0.75rem',
                fontWeight: 600, cursor: 'pointer', outline: 'none'
              }}
            >
              Move to...
            </button>

            <button
              onClick={onBulkDownload}
              style={{
                background: '#1e293b', color: 'white', border: '1px solid var(--border-default)',
                borderRadius: '4px', padding: '6px 12px', fontSize: '0.75rem',
                fontWeight: 600, cursor: 'pointer', outline: 'none'
              }}
            >
              Download Selected
            </button>

            <button
              onClick={onBulkShare}
              style={{
                background: '#d97706', color: 'white', border: 'none',
                borderRadius: '4px', padding: '6px 12px', fontSize: '0.75rem',
                fontWeight: 600, cursor: 'pointer', outline: 'none'
              }}
            >
              Share ({selectedCount})
            </button>

            <button
              onClick={onBulkDelete}
              style={{
                background: '#7f1d1d', color: '#f87171', border: 'none',
                borderRadius: '4px', padding: '6px 12px', fontSize: '0.75rem',
                fontWeight: 600, cursor: 'pointer', outline: 'none'
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Right Utilites Icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: 'var(--text-muted)' }}>
        
        {/* Grid/List View switcher */}
        <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '2px' }}>
          <button
            onClick={() => onViewModeChange('grid')}
            style={{
              background: viewMode === 'grid' ? 'rgba(245,158,11,0.15)' : 'transparent',
              color: viewMode === 'grid' ? 'var(--accent-primary)' : 'var(--text-muted)',
              border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px'
            }}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            style={{
              background: viewMode === 'list' ? 'rgba(245,158,11,0.15)' : 'transparent',
              color: viewMode === 'list' ? 'var(--accent-primary)' : 'var(--text-muted)',
              border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px'
            }}
          >
            <List size={15} />
          </button>
        </div>
      </div>

    </div>
  );
}
