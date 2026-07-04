import {
  Search, LayoutGrid, List, Settings, Database, Globe
} from 'lucide-react';
import type { TelegramFolder, ViewMode } from '../../types';

interface TopBarProps {
  currentFolder?: TelegramFolder;
  viewMode: ViewMode;
  searchQuery: string;
  totalFiles: number;
  onViewModeChange: (mode: ViewMode) => void;
  onSearchChange: (query: string) => void;
  onToggleSidebar: () => void;
}

export function TopBar({
  currentFolder, viewMode, searchQuery,
  onViewModeChange, onSearchChange,
}: TopBarProps) {

  return (
    <div className="topbar" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 24px', background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-subtle)', height: 'var(--topbar-height)'
    }}>
      
      {/* Breadcrumb (Left corner) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', fontWeight: 500 }}>
        <span style={{ color: 'var(--text-muted)' }}>Start</span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentFolder?.name || 'Loading...'}</span>
      </div>

      {/* Centered Search Bar */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
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

      {/* Right Utilites Icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: 'var(--text-muted)' }}>
        
        {/* Storage DB Stats Icon */}
        <button className="btn btn-ghost btn-icon" style={{ padding: '6px' }} title="Storage statistics">
          <Database size={16} />
        </button>

        {/* Global Public shares Icon */}
        <button className="btn btn-ghost btn-icon" style={{ padding: '6px' }} title="Public Shares">
          <Globe size={16} />
        </button>

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

        {/* App Settings Icon */}
        <button className="btn btn-ghost btn-icon" style={{ padding: '6px' }} title="Settings">
          <Settings size={16} />
        </button>
      </div>

    </div>
  );
}
