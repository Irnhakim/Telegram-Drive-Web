import { useState, useEffect } from 'react';
import { User, Lock, Mail, ArrowRight, HardDrive, Eye, EyeOff, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi } from '../../api/client';
import type { UserInfo } from '../../types';

interface WebAuthProps {
  onAuthSuccess: (user: UserInfo & { telegramConnected: boolean }) => void;
}

type AuthMode = 'login' | 'register' | 'forgot-username' | 'forgot-password' | 'reset-password';

export function WebAuth({ onAuthSuccess }: WebAuthProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [resetToken, setResetToken] = useState<string | null>(null);

  // Detect URL parameter for password reset
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    if (token) {
      setResetToken(token);
      setMode('reset-password');
      // Clean URL parameters without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (mode !== 'register' || username.trim().length < 3) {
      setUsernameAvailable('idle');
      return;
    }

    setUsernameAvailable('checking');
    const timer = setTimeout(async () => {
      try {
        const result = await authApi.checkUsername(username.trim());
        setUsernameAvailable(result.available ? 'available' : 'taken');
      } catch {
        setUsernameAvailable('idle');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!username.trim() || !password.trim()) {
          throw new Error('Username/Email and password are required');
        }
        const result = await authApi.login(username.trim(), password);
        localStorage.setItem('access_token', result.token);
        onAuthSuccess(result.user);
      } else if (mode === 'register') {
        if (!username.trim() || !password.trim()) {
          throw new Error('Username and password are required');
        }
        const result = await authApi.register(username.trim(), password, email.trim() || undefined);
        localStorage.setItem('access_token', result.token);
        onAuthSuccess(result.user);
      } else if (mode === 'forgot-username') {
        if (!email.trim()) {
          throw new Error('Email is required');
        }
        const result = await authApi.forgotUsername(email.trim());
        setSuccessMessage(result.message);
      } else if (mode === 'forgot-password') {
        if (!username.trim()) {
          throw new Error('Username or Email is required');
        }
        const result = await authApi.forgotPassword(username.trim());
        setSuccessMessage(result.message);
      } else if (mode === 'reset-password') {
        if (!password.trim()) {
          throw new Error('Password is required');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (!resetToken) {
          throw new Error('Reset token is missing');
        }
        const result = await authApi.resetPassword(resetToken, password);
        setSuccessMessage(result.message);
        setTimeout(() => {
          setMode('login');
          setPassword('');
          setConfirmPassword('');
          setSuccessMessage('');
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    clearStates();
  };

  const clearStates = () => {
    setError('');
    setSuccessMessage('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setEmail('');
    setUsernameAvailable('idle');
  };

  const getTitle = () => {
    switch (mode) {
      case 'register': return 'Create Account';
      case 'forgot-username': return 'Forgot Username';
      case 'forgot-password': return 'Forgot Password';
      case 'reset-password': return 'Reset Password';
      default: return 'Welcome Back';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'register': return 'Register a web account to start linking Telegram';
      case 'forgot-username': return 'Enter your email to retrieve your username';
      case 'forgot-password': return 'Enter your username or email to request a reset link';
      case 'reset-password': return 'Set a new strong password for your account';
      default: return 'Sign in to access your TeleDrive dashboard';
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
        style={{ width: '100%', maxWidth: '440px', padding: '40px', overflow: 'hidden' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                style={{
                  width: '68px', height: '68px', borderRadius: '18px',
                  background: 'linear-gradient(135deg, var(--accent-gradient) 0%, var(--accent-gradient) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: '0 8px 32px rgba(var(--accent-rgb), 0.3)',
                }}
              >
                {mode === 'reset-password' ? <Key size={28} color="white" /> : <HardDrive size={28} color="white" />}
              </motion.div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '6px' }}>
                {getTitle()}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                {getDescription()}
              </p>
            </div>

            {/* Status Messages */}
            <div style={{ minHeight: (error || successMessage) ? 'auto' : '0px' }}>
              {error && (
                <div
                  style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#f87171', fontSize: '0.8125rem', marginBottom: '20px',
                  }}
                >
                  {error}
                </div>
              )}

              {successMessage && (
                <div
                  style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
                    color: '#34d399', fontSize: '0.8125rem', marginBottom: '20px',
                  }}
                >
                  {successMessage}
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Username / Email Identifier */}
              {mode !== 'forgot-username' && mode !== 'reset-password' && (
                <div>
                  <div style={{ position: 'relative' }}>
                    <User size={18} style={{
                      position: 'absolute', left: '14px', top: '50%',
                      transform: 'translateY(-50%)', color: 'var(--text-muted)',
                    }} />
                    <input
                      className="input input-lg"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={mode === 'login' ? "Username or Email" : "Username"}
                      autoFocus
                      style={{ paddingLeft: '42px' }}
                    />
                  </div>
                  {mode === 'register' && username.trim().length >= 3 && (
                    <div style={{ fontSize: '0.75rem', marginTop: '6px', paddingLeft: '4px' }}>
                      {usernameAvailable === 'checking' && (
                        <span style={{ color: 'var(--text-muted)' }}>Checking availability...</span>
                      )}
                      {usernameAvailable === 'available' && (
                        <span style={{ color: '#4ade80', fontWeight: 600 }}>✓ Username is available</span>
                      )}
                      {usernameAvailable === 'taken' && (
                        <span style={{ color: '#f87171', fontWeight: 600 }}>✗ Username is already taken</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Email input for Forgot Username */}
              {mode === 'forgot-username' && (
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{
                    position: 'absolute', left: '14px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)',
                  }} />
                  <input
                    className="input input-lg"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address"
                    autoFocus
                    style={{ paddingLeft: '42px' }}
                  />
                </div>
              )}

              {/* Email input for Registration */}
              {mode === 'register' && (
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{
                    position: 'absolute', left: '14px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)',
                  }} />
                  <input
                    className="input input-lg"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address (Optional)"
                    style={{ paddingLeft: '42px' }}
                  />
                </div>
              )}

              {/* Password Input */}
              {mode !== 'forgot-username' && mode !== 'forgot-password' && (
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{
                    position: 'absolute', left: '14px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)',
                  }} />
                  <input
                    className="input input-lg"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'reset-password' ? "New Password" : "Password"}
                    style={{ paddingLeft: '42px', paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: '14px', top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                      outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              )}

              {/* Confirm Password (only for reset-password) */}
              {mode === 'reset-password' && (
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{
                    position: 'absolute', left: '14px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)',
                  }} />
                  <input
                    className="input input-lg"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm New Password"
                    style={{ paddingLeft: '42px', paddingRight: '40px' }}
                  />
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading || (mode === 'register' && usernameAvailable !== 'available')}
                style={{ width: '100%', gap: '10px', marginTop: '8px' }}
              >
                {loading ? (
                  <div className="animate-spin" style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                  }} />
                ) : (
                  <>
                    {mode === 'login' && 'Sign In'}
                    {mode === 'register' && 'Sign Up'}
                    {mode === 'forgot-username' && 'Retrieve Username'}
                    {mode === 'forgot-password' && 'Send Reset Link'}
                    {mode === 'reset-password' && 'Update Password'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            {/* Recovery Options (Forgot Username / Forgot Password) */}
            {mode === 'login' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => { setMode('forgot-username'); clearStates(); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', outline: 'none', padding: 0 }}
                >
                  Forgot Username?
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('forgot-password'); clearStates(); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', outline: 'none', padding: 0 }}
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {/* Back to Login Footer for Recovery Modes */}
            {mode !== 'login' && mode !== 'register' && mode !== 'reset-password' && (
              <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.8125rem' }}>
                <button
                  onClick={() => { setMode('login'); clearStates(); }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-accent)',
                    fontWeight: 600, cursor: 'pointer', padding: 0, outline: 'none',
                  }}
                >
                  Back to Sign In
                </button>
              </div>
            )}

            {/* Mode Toggle Footer */}
            {(mode === 'login' || mode === 'register') && (
              <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={toggleMode}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-accent)',
                    fontWeight: 600, cursor: 'pointer', padding: 0, outline: 'none',
                  }}
                >
                  {mode === 'login' ? 'Create one' : 'Sign in'}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
