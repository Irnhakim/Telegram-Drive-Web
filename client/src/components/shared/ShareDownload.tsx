import { useState, useEffect } from 'react';
import { Download, Key, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { sharesApi } from '../../api/client';
import { FileTypeIcon } from './FileTypeIcon';

interface ShareDownloadProps {
  shareId: string;
}

export function ShareDownload({ shareId }: ShareDownloadProps) {
  const [fileInfo, setFileInfo] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const details = await sharesApi.getDetails(shareId);
        setFileInfo(details);
      } catch (err: any) {
        setError(err.message || 'Share link has expired or is invalid.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [shareId]);

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fileInfo.passwordRequired && !password) return;

    setDownloading(true);
    setError('');

    try {
      // Direct POST download stream request with password verification
      const res = await fetch(sharesApi.downloadUrl(shareId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: { message: 'Download failed' } }));
        throw new Error(errJson.error?.message || 'Invalid password or expired link');
      }

      // Convert body stream to Blob to download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInfo.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-bg" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="animate-spin" style={{
            width: '40px', height: '40px', borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: 'var(--accent-primary)',
          }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading shared file...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-bg" style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="auth-card"
        style={{ width: '100%', maxWidth: '440px', padding: '40px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            {fileInfo ? (
              <FileTypeIcon
                mimeType={fileInfo.mimeType}
                category={fileInfo.mimeType.split('/')[0]}
                size={40}
              />
            ) : (
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(239,68,68,0.1)', color: '#f87171',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertCircle size={32} />
              </div>
            )}
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px', wordBreak: 'break-all' }}>
            {fileInfo ? fileInfo.fileName : 'Link Expired'}
          </h2>
          {fileInfo && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
              Size: {fileInfo.fileSizeStr}
            </p>
          )}
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171', fontSize: '0.8125rem', marginBottom: '20px',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {fileInfo && (
          <form onSubmit={handleDownload}>
            {fileInfo.passwordRequired && (
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <Key size={14} style={{
                  position: 'absolute', left: '12px', top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-muted)',
                }} />
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter file password to unlock"
                  required
                  style={{ paddingLeft: '34px', fontSize: '0.8125rem' }}
                />
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={downloading || success}
              style={{ width: '100%', gap: '10px', background: success ? 'rgba(16,185,129,0.2)' : undefined, color: success ? '#10b981' : undefined }}
            >
              {downloading ? (
                <div className="animate-spin" style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                }} />
              ) : success ? (
                <>
                  <CheckCircle size={18} /> Download Started
                </>
              ) : (
                <>
                  <Download size={18} /> Download File
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
