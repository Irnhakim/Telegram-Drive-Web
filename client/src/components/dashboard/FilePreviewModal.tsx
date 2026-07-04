import { useState, useEffect } from 'react';
import { X, Download, FileText, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { filesApi } from '../../api/client';
import type { TelegramFile } from '../../types';

interface FilePreviewModalProps {
  file: TelegramFile;
  folderId: string;
  onClose: () => void;
}

export function FilePreviewModal({ file, folderId, onClose }: FilePreviewModalProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState('');
  
  const downloadUrl = filesApi.getDownloadUrl(file.id, folderId);
  const isImage = file.category === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(file.name.split('.').pop()?.toLowerCase() || '');
  const isVideo = file.category === 'video' || ['mp4', 'webm', 'ogg', 'mkv'].includes(file.name.split('.').pop()?.toLowerCase() || '');
  const isAudio = file.category === 'audio' || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(file.name.split('.').pop()?.toLowerCase() || '');
  const isText = ['txt', 'json', 'md', 'css', 'js', 'ts', 'html', 'log', 'env', 'xml', 'yaml', 'yml'].includes(file.name.split('.').pop()?.toLowerCase() || '');

  useEffect(() => {
    if (isText) {
      const fetchText = async () => {
        setTextLoading(true);
        setTextError('');
        try {
          const res = await fetch(downloadUrl, {
            headers: {
              'X-Access-Token': localStorage.getItem('access_token') || '',
            }
          });
          if (!res.ok) throw new Error('Failed to read file content');
          const text = await res.text();
          setTextContent(text);
        } catch (err: any) {
          setTextError(err.message || 'Error loading text content');
        } finally {
          setTextLoading(false);
        }
      };
      fetchText();
    }
  }, [isText, downloadUrl]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100, background: 'rgba(0, 0, 0, 0.85)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="modal-content"
        style={{
          maxWidth: '85vw',
          maxHeight: '85vh',
          width: isText ? '800px' : 'auto',
          padding: 0,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)', background: 'var(--bg-primary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <FileText size={18} style={{ color: 'var(--text-accent)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.name}>
              {file.name}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>({file.sizeStr})</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleDownload}
              className="btn btn-ghost btn-icon"
              style={{ color: 'var(--text-secondary)', padding: '6px' }}
              title="Download File"
            >
              <Download size={16} />
            </button>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-icon"
              style={{ color: 'var(--text-secondary)', padding: '6px' }}
              title="Close Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body / Viewer */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#070a12', overflow: 'auto', minHeight: '300px', maxHeight: '70vh',
          position: 'relative', padding: isText ? '0' : '20px'
        }}>
          
          {/* IMAGE PREVIEW */}
          {isImage && (
            <img
              src={downloadUrl}
              alt={file.name}
              style={{
                maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain',
                borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
              }}
            />
          )}

          {/* VIDEO PREVIEW */}
          {isVideo && (
            <video
              src={downloadUrl}
              controls
              autoPlay
              style={{
                maxWidth: '100%', maxHeight: '65vh', outline: 'none',
                borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
              }}
            />
          )}

          {/* AUDIO PREVIEW */}
          {isAudio && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '16px', padding: '40px', background: 'var(--bg-surface)',
              borderRadius: '12px', border: '1px solid var(--border-subtle)',
              width: '100%', maxWidth: '400px'
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.1)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)'
              }}>
                <Volume2 size={32} />
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', textAlign: 'center', wordBreak: 'break-all' }}>
                {file.name}
              </span>
              <audio
                src={downloadUrl}
                controls
                autoPlay
                style={{ width: '100%', outline: 'none', marginTop: '8px' }}
              />
            </div>
          )}

          {/* TEXT PREVIEW */}
          {isText && (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              {textLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px', margin: 'auto' }}>
                  <div className="animate-spin" style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-primary)'
                  }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Reading file...</span>
                </div>
              )}

              {textError && (
                <div style={{ color: '#ef4444', fontSize: '0.875rem', padding: '24px', textAlign: 'center', margin: 'auto' }}>
                  {textError}
                </div>
              )}

              {textContent !== null && !textLoading && (
                <pre style={{
                  margin: 0, padding: '20px', fontSize: '0.8125rem',
                  fontFamily: 'Consolas, Monaco, monospace', color: '#cbd5e1',
                  background: '#090d16', overflow: 'auto', width: '100%',
                  maxHeight: '65vh', textAlign: 'left', whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {textContent}
                </pre>
              )}
            </div>
          )}

          {/* UNSUPPORTED FILE TYPE PREVIEW */}
          {!isImage && !isVideo && !isAudio && !isText && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '16px', padding: '40px', textAlign: 'center'
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.03)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'
              }}>
                <FileText size={32} />
              </div>
              <div>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>No preview available</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  This file type cannot be previewed directly in the browser.
                </p>
              </div>
              <button onClick={handleDownload} className="btn btn-primary btn-sm" style={{ marginTop: '8px' }}>
                <Download size={14} /> Download File
              </button>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
