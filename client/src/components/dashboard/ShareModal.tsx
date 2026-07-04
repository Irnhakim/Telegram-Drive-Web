import { useState } from 'react';
import { X, Lock, Key, Calendar, Copy, Check, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sharesApi } from '../../api/client';
import type { TelegramFile } from '../../types';

interface ShareModalProps {
  file: TelegramFile;
  folderId: string;
  onClose: () => void;
}

type ExpOption = '1h' | '1d' | '7d' | 'never' | 'custom';

export function ShareModal({ file, folderId, onClose }: ShareModalProps) {
  const [passwordProtect, setPasswordProtect] = useState(false);
  const [password, setPassword] = useState('');
  const [expOption, setExpOption] = useState<ExpOption>('1d');
  const [customHours, setCustomHours] = useState('24');
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const getHours = () => {
    switch (expOption) {
      case '1h': return 1;
      case '1d': return 24;
      case '7d': return 168;
      case 'never': return 0;
      case 'custom': return parseInt(customHours, 10) || 24;
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const hours = getHours();
      const res = await sharesApi.generate({
        messageId: file.id,
        folderId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.mimeType,
        password: passwordProtect && password ? password : undefined,
        expiresHours: hours > 0 ? hours : undefined,
      });

      // Construct absolute share url based on current web location
      const absoluteUrl = `${window.location.origin}${res.url}`;
      setGeneratedLink(absoluteUrl);
    } catch (err: any) {
      alert('Failed to generate link: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="modal-content"
        style={{ maxWidth: '440px', padding: '24px' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <Link size={18} style={{ color: 'var(--text-accent)' }} />
            <h3 className="modal-title">Share File</h3>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {!generatedLink ? (
          <div>
            {/* File info card */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '20px',
            }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Sharing File
              </span>
              <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 2px', wordBreak: 'break-all' }}>
                {file.name}
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {file.sizeStr}
              </span>
            </div>

            {/* Password Protection */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={16} style={{ color: passwordProtect ? 'var(--text-accent)' : 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Password Protection</span>
              </div>
              <label className="switch" style={{
                position: 'relative', display: 'inline-block', width: '40px', height: '20px',
              }}>
                <input
                  type="checkbox"
                  checked={passwordProtect}
                  onChange={(e) => setPasswordProtect(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span className="slider" style={{
                  position: 'absolute', cursor: 'pointer', inset: 0,
                  backgroundColor: passwordProtect ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                  borderRadius: '34px', transition: '0.3s',
                }}>
                  <span style={{
                    position: 'absolute', content: '""', height: '14px', width: '14px',
                    left: passwordProtect ? '23px' : '3px', bottom: '3px',
                    backgroundColor: 'white', transition: '0.3s', borderRadius: '50%',
                  }} />
                </span>
              </label>
            </div>

            {/* Password Input */}
            <AnimatePresence>
              {passwordProtect && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden', marginBottom: '20px' }}
                >
                  <div style={{ position: 'relative' }}>
                    <Key size={14} style={{
                      position: 'absolute', left: '12px', top: '50%',
                      transform: 'translateY(-50%)', color: 'var(--text-muted)',
                    }} />
                    <input
                      className="input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter share password"
                      style={{ paddingLeft: '34px', fontSize: '0.8125rem' }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Expiration */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Expiration</span>
              </div>
              
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
                marginBottom: '8px',
              }}>
                {(['1h', '1d', '7d'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setExpOption(opt)}
                    style={{
                      padding: '8px', fontSize: '0.8125rem', fontWeight: 500,
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)',
                      background: expOption === opt ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.03)',
                      color: expOption === opt ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {opt === '1h' && '1 Hour'}
                    {opt === '1d' && '1 Day'}
                    {opt === '7d' && '7 Days'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setExpOption('never')}
                  style={{
                    flex: 1, padding: '8px', fontSize: '0.8125rem', fontWeight: 500,
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)',
                    background: expOption === 'never' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.03)',
                    color: expOption === 'never' ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Never
                </button>
                <button
                  onClick={() => setExpOption('custom')}
                  style={{
                    flex: 2, padding: '8px', fontSize: '0.8125rem', fontWeight: 500,
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)',
                    background: expOption === 'custom' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.03)',
                    color: expOption === 'custom' ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {expOption === 'custom' ? 'Custom Hours' : 'Custom Hours'}
                </button>
              </div>

              <AnimatePresence>
                {expOption === 'custom' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden', marginTop: '8px' }}
                  >
                    <input
                      className="input"
                      type="number"
                      value={customHours}
                      onChange={(e) => setCustomHours(e.target.value)}
                      placeholder="Expiration hours (e.g. 48)"
                      style={{ fontSize: '0.8125rem' }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action */}
            <button
              onClick={handleGenerate}
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px', fontWeight: 600 }}
            >
              {loading ? 'Generating...' : 'Generate Shareable Link'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '20px 0', gap: '12px',
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: 'rgba(16,185,129,0.1)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#10b981',
              }}>
                <Check size={24} />
              </div>
              <h4 style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Link Generated Successfully</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                You can copy the link below to share this file.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input
                className="input"
                value={generatedLink}
                readOnly
                style={{ fontSize: '0.8125rem', flex: 1, background: 'rgba(255,255,255,0.03)' }}
              />
              <button
                onClick={handleCopy}
                className="btn btn-secondary"
                style={{ padding: '0 12px', color: copied ? '#10b981' : 'var(--text-primary)' }}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>

            <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>
              Close
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
