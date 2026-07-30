import { useState } from 'react';
import { User, Lock, Mail, Shield, Key, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { authApi } from '../../api/client';
import type { UserInfo } from '../../types';

interface SettingsManagerProps {
  user: UserInfo | null;
  onUpdateUser: (user: UserInfo) => void;
}

export function SettingsManager({ user, onUpdateUser }: SettingsManagerProps) {
  // Email states
  const [email, setEmail] = useState(user?.email || '');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');
    setEmailLoading(true);

    try {
      const res = await authApi.updateProfile(email.trim(), undefined, undefined);
      if (res.success) {
        setEmailSuccess('Email berhasil diperbarui!');
        if (res.user) {
          onUpdateUser(res.user);
        }
      }
    } catch (err: any) {
      setEmailError(err.message || 'Gagal memperbarui email');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Password saat ini wajib diisi');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password baru minimal harus 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password baru tidak cocok');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await authApi.updateProfile(undefined, currentPassword, newPassword);
      if (res.success) {
        setPasswordSuccess('Password berhasil diubah!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Gagal mengubah password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="file-explorer" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', overflowY: 'auto' }}>
      
      {/* Title Header */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={20} color="var(--text-accent)" />
          Account Profile & Settings
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '2px' }}>
          Manage your TeleDrive web account credentials, email, and password security.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Email & Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px'
          }}
        >
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '8px' }}>
            <Mail size={16} color="var(--text-accent)" />
            Profile Info
          </h3>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Username (Read-only)
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                type="text"
                disabled
                value={user?.username || ''}
                style={{ paddingLeft: '36px', background: 'rgba(255,255,255,0.01)', opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>
          </div>

          <form onSubmit={handleUpdateEmail} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com (Untuk pemulihan akun)"
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            {/* Email messages */}
            {emailError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#f87171' }}>
                <AlertCircle size={14} />
                <span>{emailError}</span>
              </div>
            )}
            {emailSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#34d399' }}>
                <CheckCircle2 size={14} />
                <span>{emailSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={emailLoading || email.trim() === (user?.email || '')}
              style={{ width: '100%', height: '36px', fontSize: '0.8125rem', marginTop: '4px' }}
            >
              {emailLoading ? 'Saving...' : 'Update Email'}
            </button>
          </form>
        </motion.div>

        {/* Password Security Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px'
          }}
        >
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '8px' }}>
            <Key size={16} color="var(--text-accent)" />
            Security & Password
          </h3>

          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Current Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 karakter"
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Min. 6 karakter"
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            {/* Password messages */}
            {passwordError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#f87171' }}>
                <AlertCircle size={14} />
                <span>{passwordError}</span>
              </div>
            )}
            {passwordSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#34d399' }}>
                <CheckCircle2 size={14} />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={passwordLoading || !currentPassword || !newPassword}
              style={{ width: '100%', height: '36px', fontSize: '0.8125rem', marginTop: '4px' }}
            >
              {passwordLoading ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </motion.div>

      </div>

    </div>
  );
}
