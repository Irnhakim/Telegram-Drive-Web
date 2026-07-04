import { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { accessApi, setAccessToken } from '../../api/client';

interface AccessGateProps {
  onSuccess: () => void;
}

export function AccessGate({ onSuccess }: AccessGateProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await accessApi.login(password);
      if (result.success) {
        setAccessToken(result.token);
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg" style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="auth-card"
        style={{ width: '100%', maxWidth: '420px', padding: '40px' }}
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          style={{
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'var(--accent-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)',
          }}
        >
          <Shield size={32} color="white" />
        </motion.div>

        <h2 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '1.5rem' }}>
          Telegram Drive
        </h2>
        <p style={{
          textAlign: 'center', color: 'var(--text-secondary)',
          marginBottom: '32px', fontSize: '0.875rem',
        }}>
          Enter access password to continue
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <Lock size={18} style={{
              position: 'absolute', left: '14px', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)',
            }} />
            <input
              className="input input-lg"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access Password"
              autoFocus
              style={{ paddingLeft: '42px', paddingRight: '42px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: '10px', top: '50%',
                transform: 'translateY(-50%)', background: 'none',
                border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                padding: '4px',
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '10px 14px', borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171', fontSize: '0.8125rem', marginBottom: '16px',
              }}
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading || !password.trim()}
            style={{ width: '100%', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <div className="animate-spin" style={{
                width: '20px', height: '20px', borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
              }} />
            ) : (
              <>
                Unlock <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
