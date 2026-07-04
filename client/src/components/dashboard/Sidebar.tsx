import { useState } from 'react';
import { Bookmark, FolderClosed, Plus, LogOut, Lock, ChevronDown, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TelegramFolder, UserInfo } from '../../types';

interface SidebarProps {
  folders: TelegramFolder[];
  currentFolderId: string;
  loading: boolean;
  user: UserInfo | null;
  open: boolean;
  onSelectFolder: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onLogout: () => void;
  onAccessLogout?: () => void;
}

export function Sidebar({
  folders, currentFolderId, loading, user, open,
  onSelectFolder, onCreateFolder, onLogout, onAccessLogout,
}: SidebarProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setShowCreate(false);
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
          <div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
              Telegram Drive
            </h3>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Cloud Storage</span>
          </div>
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
          <div>
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={`sidebar-item ${currentFolderId === folder.id ? 'active' : ''}`}
                onClick={() => onSelectFolder(folder.id)}
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
                </span>
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
