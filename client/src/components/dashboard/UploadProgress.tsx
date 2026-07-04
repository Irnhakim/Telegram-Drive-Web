import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, X, Upload as UploadIcon, FileText } from 'lucide-react';
import type { UploadItem } from '../../types';

interface UploadProgressProps {
  uploads: UploadItem[];
  onDismiss: (id: string) => void;
}

export function UploadProgress({ uploads, onDismiss }: UploadProgressProps) {
  if (uploads.length === 0) return null;

  return (
    <div className="upload-queue glass-strong" style={{ borderRadius: 'var(--radius-lg)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UploadIcon size={16} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
            Uploads ({uploads.length})
          </span>
        </div>
      </div>

      {/* Items */}
      <div style={{ padding: '8px', maxHeight: '300px', overflowY: 'auto' }}>
        <AnimatePresence>
          {uploads.map((upload) => (
            <motion.div
              key={upload.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="upload-item"
            >
              <FileText size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.8125rem', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {upload.file.name}
                </div>
                {upload.status === 'uploading' && (
                  <div style={{ marginTop: '6px' }}>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${upload.progress}%` }} />
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                      {upload.progress}%
                    </span>
                  </div>
                )}
                {upload.status === 'error' && (
                  <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '4px' }}>
                    {upload.error || 'Upload failed'}
                  </div>
                )}
              </div>

              {upload.status === 'success' && (
                <CheckCircle size={18} style={{ color: '#34d399', flexShrink: 0 }} />
              )}
              {upload.status === 'error' && (
                <AlertCircle size={18} style={{ color: '#f87171', flexShrink: 0 }} />
              )}
              {(upload.status === 'success' || upload.status === 'error') && (
                <button
                  onClick={() => onDismiss(upload.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: '2px', flexShrink: 0,
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
