import { useState, useEffect } from 'react';
import { Link2, Trash2, Copy, ExternalLink, Shield, Calendar, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sharesApi } from '../../api/client';

interface ShareLink {
  id: string;
  userId: string;
  messageId: number;
  folderId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  password?: string | null;
  expiresAt?: number | null;
  createdAt: number;
}

export function SharesManager() {
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchShares = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await sharesApi.list();
      if (res.success) {
        setShares(res.shares);
      } else {
        throw new Error('Failed to load shares');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve shared links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, []);

  const handleCopyLink = (shareId: string) => {
    const absoluteUrl = `${window.location.origin}/share/${shareId}`;
    navigator.clipboard.writeText(absoluteUrl).then(() => {
      setCopiedId(shareId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleRevokeShare = async (shareId: string) => {
    if (!confirm('Are you sure you want to revoke this share link? Anyone with this link will no longer be able to download the file.')) {
      return;
    }
    try {
      const res = await sharesApi.revoke(shareId);
      if (res.success) {
        setShares((prev) => prev.filter((item) => item.id !== shareId));
      } else {
        throw new Error('Failed to revoke share link');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to revoke link');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredShares = shares.filter((s) =>
    s.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="file-explorer" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px' }}>
      
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link2 size={20} color="var(--text-accent)" />
            Shared Links Manager
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '2px' }}>
            Manage and revoke all public file download links you have generated.
          </p>
        </div>
        <button
          onClick={fetchShares}
          disabled={loading}
          className="btn btn-secondary btn-icon"
          style={{ width: '36px', height: '36px', borderRadius: '8px' }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Toolbar / Search */}
      <div style={{
        display: 'flex', gap: '16px', marginBottom: '20px',
        padding: '12px', background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{
            position: 'absolute', left: '12px', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-muted)',
          }} />
          <input
            className="input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shared files by name..."
            style={{ paddingLeft: '38px', height: '38px' }}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' }}>
            <div className="animate-spin" style={{
              width: '32px', height: '32px', borderRadius: '50%',
              border: '3px solid rgba(var(--accent-rgb), 0.1)', borderTopColor: 'var(--accent-primary)',
            }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Loading shares...</span>
          </div>
        ) : error ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '200px', gap: '12px', color: '#f87171', textAlign: 'center'
          }}>
            <AlertCircle size={32} />
            <div>
              <p style={{ fontWeight: 600 }}>Failed to Load Shared Links</p>
              <p style={{ fontSize: '0.8125rem', opacity: 0.8 }}>{error}</p>
            </div>
            <button onClick={fetchShares} className="btn btn-secondary btn-sm" style={{ marginTop: '8px' }}>
              Retry
            </button>
          </div>
        ) : filteredShares.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '300px', color: 'var(--text-muted)', textAlign: 'center',
            background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border-default)', padding: '24px'
          }}>
            <Link2 size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <h3 style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No Share Links Found</h3>
            <p style={{ fontSize: '0.8125rem', marginTop: '4px', maxWidth: '320px' }}>
              {searchQuery ? 'No shared links match your search query.' : 'You have not created any public download links yet. Share files from your explorer to see them here.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <AnimatePresence>
              {filteredShares.map((share) => {
                const isExpired = share.expiresAt ? Math.floor(Date.now() / 1000) > share.expiresAt : false;
                return (
                  <motion.div
                    key={share.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    style={{
                      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 20px', background: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
                      gap: '16px', boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    {/* File Meta Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '240px', flex: 1 }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '8px',
                        background: 'rgba(var(--accent-rgb), 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-accent)'
                      }}>
                        <Link2 size={20} />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <span style={{
                          display: 'block', fontWeight: 600, fontSize: '0.875rem',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: isExpired ? 'var(--text-muted)' : 'var(--text-primary)'
                        }} title={share.fileName}>
                          {share.fileName}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                          Size: {formatSize(share.fileSize)} • Created: {formatDate(share.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Status badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Password Protection Badge */}
                      {share.password && (
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          fontSize: '0.6875rem', fontWeight: 600, padding: '4px 10px',
                          borderRadius: '20px', background: 'rgba(251, 191, 36, 0.1)',
                          border: '1px solid rgba(251, 191, 36, 0.2)', color: '#fbbf24'
                        }}>
                          <Shield size={12} /> Password Protected
                        </span>
                      )}

                      {/* Expiration Badge */}
                      {share.expiresAt && (
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          fontSize: '0.6875rem', fontWeight: 600, padding: '4px 10px',
                          borderRadius: '20px',
                          background: isExpired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          border: isExpired ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                          color: isExpired ? '#ef4444' : '#10b981'
                        }}>
                          <Calendar size={12} />
                          {isExpired ? 'Expired' : `Expires: ${formatDate(share.expiresAt)}`}
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => handleCopyLink(share.id)}
                        className={`btn ${copiedId === share.id ? 'btn-success' : 'btn-secondary'} btn-sm`}
                        style={{ height: '32px', padding: '0 12px', fontSize: '0.75rem', gap: '4px' }}
                      >
                        <Copy size={12} />
                        {copiedId === share.id ? 'Copied!' : 'Copy Link'}
                      </button>

                      <a
                        href={`/share/${share.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ height: '32px', width: '32px', padding: 0, justifyContent: 'center' }}
                        title="Open Share Link"
                      >
                        <ExternalLink size={12} />
                      </a>

                      <button
                        onClick={() => handleRevokeShare(share.id)}
                        className="btn btn-secondary btn-sm danger"
                        style={{ height: '32px', width: '32px', padding: 0, justifyContent: 'center' }}
                        title="Revoke Share Link"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

    </div>
  );
}
