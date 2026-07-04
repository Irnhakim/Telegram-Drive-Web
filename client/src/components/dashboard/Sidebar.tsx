import { useState, useRef, useEffect } from 'react';
import { Bookmark, FolderClosed, Plus, LogOut, Lock, ChevronDown, User, MoreVertical, Pencil, Eye, Link2, Trash2, EyeOff, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { foldersApi } from '../../api/client';
import type { TelegramFolder, UserInfo } from '../../types';

interface SidebarProps {
  folders: TelegramFolder[];
  currentFolderId: string;
  loading: boolean;
  user: UserInfo | null;
  open: boolean;
  theme: 'dark' | 'light';
  onSelectFolder: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onUpdateFolderPublicity: (id: string, isPublic: boolean, username?: string) => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  onAccessLogout?: () => void;
}

export function Sidebar({
  folders, currentFolderId, loading, user, open, theme,
  onSelectFolder, onCreateFolder, onRenameFolder, onDeleteFolder, onUpdateFolderPublicity,
  onToggleTheme, onLogout, onAccessLogout,
}: SidebarProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeFolderMenu, setActiveFolderMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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
      if (confirm(`Make folder "${folder.name}" private? (Will remove username @${folder.username})`)) {
        onUpdateFolderPublicity(folder.id, false);
      }
    } else {
      const username = prompt(`Enter custom public username for folder "${folder.name}":\n(Must be alphanumeric, min 5 chars, example: my_drive_folder)`);
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
      alert('Invite link copied to clipboard:\n' + res.inviteLink);
    } catch (err: any) {
      alert('Failed to get invite link: ' + err.message);
    }
  };

  const handleDelete = (folder: TelegramFolder) => {
    setActiveFolderMenu(null);
    if (confirm(`Are you sure you want to delete folder "${folder.name}"?\nWARNING: This will delete the Telegram channel and all its files!`)) {
      onDeleteFolder(folder.id);
    }
  };

  return (
    <div className={`sidebar ${open ? 'open' : ''}`}>
      {/* Brand */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #2AABEE, #229ED9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Telegram Drive
            </h3>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Cloud Storage</span>
          </div>
          
          {/* Theme Toggle Button */}
          <button
            className="btn btn-ghost btn-icon"
            onClick={onToggleTheme}
            style={{ padding: '6px', color: 'var(--text-secondary)' }}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      {/* Folders */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        <div style={{
          padding: '8px 20px 6px',
          fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Folders
        </div>

        {loading ? (
          <div style={{ padding: '0 8px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: '40px', margin: '4px 8px', borderRadius: '8px' }} />
            ))}
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={`sidebar-item ${currentFolderId === folder.id ? 'active' : ''}`}
                onClick={() => onSelectFolder(folder.id)}
                style={{ position: 'relative', paddingRight: '40px' }}
              >
                {folder.type === 'saved' ? (
                  <Bookmark size={18} className="sidebar-icon" />
                ) : (
                  <FolderClosed size={18} className="sidebar-icon" />
                )}
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', flex: 1,
                }}>
                  {folder.name}
                  {folder.username && (
                    <span style={{ fontSize: '0.6875rem', display: 'block', color: 'var(--text-accent)' }}>
                      @{folder.username}
                    </span>
                  )}
                </span>

                {/* Folder context menu options (dots button) */}
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
                    <MoreVertical size={14} />
                  </button>
                )}

                {/* Dropdown context menu overlay */}
                {activeFolderMenu === folder.id && (
                  <div
                    ref={menuRef}
                    style={{
                      position: 'absolute', left: '16px', top: '100%',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', padding: '4px',
                      boxShadow: 'var(--shadow-lg)', zIndex: 100, minWidth: '160px',
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
                    <div className="context-menu-divider" />
                    <button className="context-menu-item danger" onClick={() => handleDelete(folder)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create folder */}
        <div style={{ padding: '4px 8px' }}>
          <AnimatePresence>
            {showCreate ? (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleCreate}
                style={{ padding: '4px 8px' }}
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
                className="sidebar-item"
                onClick={() => setShowCreate(true)}
                style={{
                  width: '100%', border: 'none', background: 'none',
                  fontFamily: 'inherit', cursor: 'pointer', color: 'var(--text-muted)',
                  margin: 0,
                }}
              >
                <Plus size={18} className="sidebar-icon" />
                <span>New Folder</span>
              </button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* User info */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-subtle)',
        position: 'relative',
      }}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            width: '100%', padding: '8px', borderRadius: 'var(--radius-md)',
            border: 'none', background: 'rgba(255,255,255,0.04)',
            cursor: 'pointer', color: 'var(--text-primary)',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'var(--accent-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <User size={16} color="white" />
          </div>
          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <div style={{
              fontSize: '0.8125rem', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user ? `${user.firstName} ${user.lastName}`.trim() : 'User'}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {user?.username ? `@${user.username}` : user?.phone || ''}
            </div>
          </div>
          <ChevronDown size={14} style={{
            color: 'var(--text-muted)',
            transform: showUserMenu ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }} />
        </button>

        <AnimatePresence>
          {showUserMenu && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              style={{
                position: 'absolute', bottom: '100%', left: '16px', right: '16px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', padding: '4px',
                boxShadow: 'var(--shadow-lg)', marginBottom: '8px',
              }}
            >
              <button
                onClick={onLogout}
                className="context-menu-item"
                style={{ fontFamily: 'inherit' }}
              >
                <LogOut size={16} /> Sign Out of Telegram
              </button>
              {onAccessLogout && (
                <button
                  onClick={onAccessLogout}
                  className="context-menu-item danger"
                  style={{ fontFamily: 'inherit' }}
                >
                  <Lock size={16} /> Lock (Access Password)
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
