import { useState, useRef, useEffect } from 'react';
import {
  Bookmark, FolderClosed, Plus, LogOut,
  MoreVertical, Pencil, Eye, Link2, Trash2, EyeOff,
  Shield, ChevronLeft, Eye as EyeIcon, RefreshCw, FolderSymlink, Check, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { foldersApi, storageApi, groupsApi } from '../../api/client';
import type { TelegramFolder } from '../../types';

interface SidebarProps {
  folders: TelegramFolder[];
  currentFolderId: string;
  loading: boolean;
  open: boolean;
  onSelectFolder: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onUpdateFolderPublicity: (id: string, isPublic: boolean, username?: string) => void;
  onLogout: () => void;
  onToggleCollapse: () => void;
  user?: any;
  theme?: string;
  onToggleTheme?: () => void;
  onAccessLogout?: () => void;
}

interface GroupItem {
  id: string;
  name: string;
  color: string;
}

const THEME_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Orange
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#ef4444', // Red
];

export function Sidebar({
  folders, currentFolderId, loading, open,
  onSelectFolder, onCreateFolder, onRenameFolder, onDeleteFolder, onUpdateFolderPublicity,
  onLogout, onToggleCollapse,
}: SidebarProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [activeFolderMenu, setActiveFolderMenu] = useState<string | null>(null);
  
  // Groups feature states
  const [showGroups, setShowGroups] = useState(true); // Toggle eye icon
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all'); // 'all', 'unassigned', or groupId
  
  // Create group form popup states
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  // Storage usage stats states
  const [usageStats, setUsageStats] = useState({ used: '160.83 MB', limit: '250 GB', percent: 0.1 });
  const [sidebarFolders, setSidebarFolders] = useState<TelegramFolder[]>(folders);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Sync folders prop into local state
  useEffect(() => {
    setSidebarFolders(folders);
  }, [folders]);

  // Load groups and storage stats on mount
  const loadGroups = async () => {
    try {
      const res = await groupsApi.list();
      setGroups(res.groups);
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await storageApi.stats();
        if (res) {
          const usedBytes = res.totalSize || 0;
          const limitBytes = 250 * 1024 * 1024 * 1024;
          const percent = Math.min((usedBytes / limitBytes) * 100, 100);
          
          const formatBytes = (bytes: number) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
          };
          
          setUsageStats({
            used: formatBytes(usedBytes),
            limit: '250 GB',
            percent,
          });
        }
      } catch {
        // Fallback
      }
    };
    fetchStats();
  }, [folders]);

  // Close folder menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveFolderMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setShowCreate(false);
    }
  };

  const handleRename = (folder: TelegramFolder) => {
    setActiveFolderMenu(null);
    const newName = prompt('Enter new folder name:', folder.name);
    if (newName && newName.trim() && newName.trim() !== folder.name) {
      onRenameFolder(folder.id, newName.trim());
    }
  };

  const handlePublicityToggle = async (folder: TelegramFolder) => {
    setActiveFolderMenu(null);
    const isCurrentlyPublic = !!folder.username;
    
    if (isCurrentlyPublic) {
      if (confirm(`Make folder "${folder.name}" private?`)) {
        onUpdateFolderPublicity(folder.id, false);
      }
    } else {
      const username = prompt(`Enter custom public username for folder "${folder.name}":`);
      if (username && username.trim()) {
        onUpdateFolderPublicity(folder.id, true, username.trim());
      }
    }
  };

  const handleCopyInviteLink = async (folder: TelegramFolder) => {
    setActiveFolderMenu(null);
    try {
      const res = await foldersApi.getInviteLink(folder.id);
      await navigator.clipboard.writeText(res.inviteLink);
      alert('Invite link copied!');
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  };

  const handleDelete = (folder: TelegramFolder) => {
    setActiveFolderMenu(null);
    if (confirm(`Are you sure you want to delete folder "${folder.name}"?`)) {
      onDeleteFolder(folder.id);
    }
  };

  // Group creation handler
  const handleSaveGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const res = await groupsApi.create(newGroupName.trim(), selectedColor);
      setGroups((prev) => [...prev, res.group]);
      setNewGroupName('');
      setShowAddGroup(false);
    } catch (err: any) {
      alert('Failed to create group: ' + err.message);
    }
  };

  // Assign folder to group handler
  const handleAssignGroup = async (folderId: string, groupId: string | null) => {
    setActiveFolderMenu(null);
    try {
      await groupsApi.assignFolder(folderId, groupId);
      setSidebarFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, groupId } : f))
      );
      // Refresh selected folder list triggers
      window.location.reload();
    } catch (err: any) {
      alert('Failed to assign group: ' + err.message);
    }
  };

  const handleDeleteGroup = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this group?')) return;
    try {
      await groupsApi.delete(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setSidebarFolders((prev) =>
        prev.map((f) => (f.groupId === groupId ? { ...f, groupId: null } : f))
      );
      if (selectedGroupFilter === groupId) {
        setSelectedGroupFilter('all');
      }
    } catch (err: any) {
      alert('Failed to delete group: ' + err.message);
    }
  };

  // Filter logic
  const filteredFolders = sidebarFolders.filter((f) => {
    if (selectedGroupFilter === 'all') return true;
    if (selectedGroupFilter === 'unassigned') return !f.groupId;
    return f.groupId === selectedGroupFilter;
  });

  return (
    <div className={`sidebar ${open ? 'open' : ''}`} style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
      {/* Brand */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Shield size={18} color="white" />
          </div>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            Telegram Drive
          </h3>
        </div>
        <button onClick={onToggleCollapse} className="btn btn-ghost btn-icon" style={{ padding: '4px', color: 'var(--text-muted)' }}>
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Group Section Header */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px'
        }}>
          <span>Groups</span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => setShowGroups(!showGroups)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
              title={showGroups ? "Hide Groups" : "Show Groups"}
            >
              {showGroups ? <EyeIcon size={14} /> : <EyeOff size={14} />}
            </button>
            <button
              onClick={() => setShowAddGroup(!showAddGroup)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
              title="Add Group"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Create Group Box Form (Matches Image exactly) */}
        <AnimatePresence>
          {showAddGroup && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                New Group Name
              </span>
              <input
                className="input"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name..."
                style={{
                  fontSize: '0.8125rem', marginBottom: '14px',
                  borderColor: 'var(--accent-primary)',
                  boxShadow: '0 0 0 1px var(--accent-primary)',
                }}
              />

              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Theme Color
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                {THEME_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: c, border: selectedColor === c ? '2px solid white' : 'none',
                      cursor: 'pointer', outline: 'none',
                      boxShadow: selectedColor === c ? '0 0 0 2px ' + c : 'none'
                    }}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddGroup(false)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-secondary)', fontSize: '0.8125rem',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveGroup}
                  style={{
                    background: 'var(--accent-gradient)', border: 'none', cursor: 'pointer',
                    color: 'white', fontSize: '0.8125rem', padding: '6px 14px',
                    borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <Check size={14} /> Save
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Group Pill Filters */}
        {showGroups && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
            <button
              onClick={() => setSelectedGroupFilter('all')}
              style={{
                padding: '4px 12px', fontSize: '0.75rem', borderRadius: '12px',
                border: 'none', cursor: 'pointer', fontWeight: 600,
                background: selectedGroupFilter === 'all' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)',
                color: selectedGroupFilter === 'all' ? 'white' : 'var(--text-secondary)',
                whiteSpace: 'nowrap'
              }}
            >
              All
            </button>
            <button
              onClick={() => setSelectedGroupFilter('unassigned')}
              style={{
                padding: '4px 12px', fontSize: '0.75rem', borderRadius: '12px',
                border: 'none', cursor: 'pointer', fontWeight: 600,
                background: selectedGroupFilter === 'unassigned' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)',
                color: selectedGroupFilter === 'unassigned' ? 'white' : 'var(--text-secondary)',
                whiteSpace: 'nowrap'
              }}
            >
              Unassigned
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGroupFilter(g.id)}
                style={{
                  padding: '4px 12px', fontSize: '0.75rem', borderRadius: '12px',
                  border: 'none', cursor: 'pointer', fontWeight: 600,
                  background: selectedGroupFilter === g.id ? g.color : 'rgba(255,255,255,0.05)',
                  color: selectedGroupFilter === g.id ? 'white' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px'
                }}
                onDoubleClick={(e) => handleDeleteGroup(g.id, e)}
                title="Double click to delete group"
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: g.color }} />
                {g.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Folders List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {loading ? (
          <div style={{ padding: '0 8px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: '36px', margin: '4px 8px', borderRadius: '6px' }} />
            ))}
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {filteredFolders.map((folder) => {
              const folderGroup = groups.find((g) => g.id === folder.groupId);
              return (
                <div
                  key={folder.id}
                  className={`sidebar-item ${currentFolderId === folder.id ? 'active' : ''}`}
                  onClick={() => onSelectFolder(folder.id)}
                  style={{
                    position: 'relative', paddingRight: '40px',
                    borderRadius: 'var(--radius-sm)', margin: '2px 8px'
                  }}
                >
                  {folder.type === 'saved' ? (
                    <Bookmark size={16} className="sidebar-icon" />
                  ) : (
                    <FolderClosed size={16} className="sidebar-icon" style={{ color: folderGroup?.color }} />
                  )}
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', flex: 1, fontSize: '0.8125rem'
                  }}>
                    {folder.name}
                    {folder.username && (
                      <span style={{ fontSize: '0.625rem', display: 'block', color: 'var(--text-accent)' }}>
                        @{folder.username}
                      </span>
                    )}
                  </span>

                  {/* Folder Options Dots */}
                  {folder.type !== 'saved' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveFolderMenu(activeFolderMenu === folder.id ? null : folder.id);
                      }}
                      style={{
                        position: 'absolute', right: '8px', top: '50%',
                        transform: 'translateY(-50%)', background: 'none',
                        border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                        padding: '4px', display: 'flex', alignItems: 'center',
                      }}
                    >
                      <MoreVertical size={12} />
                    </button>
                  )}

                  {/* Context menu for folder options */}
                  {activeFolderMenu === folder.id && (
                    <div
                      ref={menuRef}
                      style={{
                        position: 'absolute', left: '16px', top: '100%',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)', padding: '4px',
                        boxShadow: 'var(--shadow-lg)', zIndex: 100, minWidth: '170px',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{
                        padding: '6px 8px', fontSize: '0.75rem', fontWeight: 600,
                        color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)',
                        marginBottom: '4px',
                      }}>
                        {folder.name}
                      </div>
                      <button className="context-menu-item" onClick={() => handleRename(folder)}>
                        <Pencil size={14} style={{ color: 'var(--text-accent)' }} /> Rename
                      </button>
                      <button className="context-menu-item" onClick={() => handlePublicityToggle(folder)}>
                        {folder.username ? (
                          <><EyeOff size={14} style={{ color: '#ef4444' }} /> Make Private</>
                        ) : (
                          <><Eye size={14} style={{ color: '#10b981' }} /> Make Public</>
                        )}
                      </button>
                      <button className="context-menu-item" onClick={() => handleCopyInviteLink(folder)}>
                        <Link2 size={14} style={{ color: '#fbbf24' }} /> Copy Invite Link
                      </button>

                      {/* Group Assignment Sub-menu */}
                      <div className="context-menu-divider" />
                      <div style={{ padding: '4px 8px', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Assign Group
                      </div>
                      <button
                        className="context-menu-item"
                        onClick={() => handleAssignGroup(folder.id, null)}
                        style={{ fontWeight: !folder.groupId ? 600 : 400 }}
                      >
                        <FolderSymlink size={12} /> None
                      </button>
                      {groups.map((g) => (
                        <button
                          key={g.id}
                          className="context-menu-item"
                          onClick={() => handleAssignGroup(folder.id, g.id)}
                          style={{
                            color: g.color,
                            fontWeight: folder.groupId === g.id ? 700 : 400
                          }}
                        >
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: g.color, marginRight: '6px', display: 'inline-block' }} />
                          {g.name}
                        </button>
                      ))}

                      <div className="context-menu-divider" />
                      <button className="context-menu-item danger" onClick={() => handleDelete(folder)}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom controls panel */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px' }}>
        
        {/* Create Folder Box */}
        <div style={{ marginBottom: '16px' }}>
          <AnimatePresence>
            {showCreate ? (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleCreate}
              >
                <input
                  className="input"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  autoFocus
                  style={{ fontSize: '0.8125rem', marginBottom: '8px' }}
                  onBlur={() => { if (!newFolderName.trim()) setShowCreate(false); }}
                  onKeyDown={(e) => { if (e.key === 'Escape') setShowCreate(false); }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: '0.75rem' }}>
                    Create
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}
                    style={{ fontSize: '0.75rem' }}>
                    Cancel
                  </button>
                </div>
              </motion.form>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  width: '100%', height: '36px', borderRadius: '6px',
                  border: '1px dashed var(--border-default)', background: 'transparent',
                  color: 'var(--text-primary)', fontSize: '0.8125rem', fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} /> Create Folder
              </button>
            )}
          </AnimatePresence>
        </div>

        {/* Telegram connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Connected to Telegram</span>
        </div>

        {/* Action buttons (Sync & Logout) */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              flex: 1, height: '36px', borderRadius: '6px',
              border: 'none', background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa', fontSize: '0.8125rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} /> Sync
          </button>
          <button
            onClick={onLogout}
            style={{
              flex: 1, height: '36px', borderRadius: '6px',
              border: 'none', background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171', fontSize: '0.8125rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              cursor: 'pointer'
            }}
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>

        {/* Storage progress bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
            <span>Used Today:</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
            <div style={{ height: '100%', background: 'var(--accent-gradient)', width: `${usageStats.percent}%`, borderRadius: '3px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            <span>{usageStats.used}</span>
            <span>{usageStats.limit}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
