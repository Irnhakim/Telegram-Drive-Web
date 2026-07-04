import { useState } from 'react';
import { Phone, KeyRound, Lock, ArrowRight, ArrowLeft, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi } from '../../api/client';
import type { UserInfo, AuthStep } from '../../types';

interface LoginWizardProps {
  onLogin: (user: UserInfo) => void;
}

export function LoginWizard({ onLogin }: LoginWizardProps) {
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password2FA, setPassword2FA] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await authApi.sendCode(phone.trim());
      setPhoneCodeHash(result.phoneCodeHash);
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await authApi.verifyCode(phone, code.trim(), phoneCodeHash);
      if (result.requires2FA) {
        setStep('2fa');
      } else if (result.success && result.user) {
        onLogin(result.user);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password2FA.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await authApi.verify2FA(password2FA);
      if (result.success && result.user) {
        onLogin(result.user);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid 2FA password');
    } finally {
      setLoading(false);
    }
  };

  const slideVariants = {
    enter: { x: 50, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -50, opacity: 0 },
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
        {/* Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            style={{
              width: '72px', height: '72px', borderRadius: '20px',
              background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 32px rgba(42, 171, 238, 0.3)',
            }}
          >
            <Send size={30} color="white" />
          </motion.div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Sign in to Telegram</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {step === 'phone' && 'Enter your phone number to get started'}
            {step === 'code' && `We sent a code to ${phone}`}
            {step === '2fa' && 'Enter your 2-factor authentication password'}
          </p>
        </div>

        {/* Step Indicator */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '8px',
          marginBottom: '28px',
        }}>
          {['phone', 'code', '2fa'].map((s, i) => (
            <div key={s} style={{
              width: s === step ? '28px' : '8px',
              height: '8px',
              borderRadius: '99px',
              background: s === step ? 'var(--accent-primary)' :
                i < ['phone', 'code', '2fa'].indexOf(step) ? 'var(--accent-primary)' :
                  'rgba(255,255,255,0.1)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                padding: '10px 14px', borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171', fontSize: '0.8125rem', marginBottom: '16px',
                overflow: 'hidden',
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Forms */}
        <AnimatePresence mode="wait">
          {step === 'phone' && (
            <motion.form
              key="phone"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              onSubmit={handleSendCode}
            >
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <Phone size={18} style={{
                  position: 'absolute', left: '14px', top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-muted)',
                }} />
                <input
                  className="input input-lg"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                  autoFocus
                  style={{ paddingLeft: '42px' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading || !phone.trim()}
                style={{ width: '100%', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? (
                  <div className="animate-spin" style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                  }} />
                ) : (
                  <>Send Code <ArrowRight size={18} /></>
                )}
              </button>

              <p style={{
                textAlign: 'center', fontSize: '0.75rem',
                color: 'var(--text-muted)', marginTop: '20px', lineHeight: 1.6,
              }}>
                You need API credentials from{' '}
                <a href="https://my.telegram.org" target="_blank" rel="noopener"
                   style={{ color: 'var(--text-accent)', textDecoration: 'none' }}>
                  my.telegram.org
                </a>
                <br />configured in the server's .env file
              </p>
            </motion.form>
          )}

          {step === 'code' && (
            <motion.form
              key="code"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              onSubmit={handleVerifyCode}
            >
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <KeyRound size={18} style={{
                  position: 'absolute', left: '14px', top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-muted)',
                }} />
                <input
                  className="input input-lg"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter verification code"
                  autoFocus
                  maxLength={6}
                  style={{
                    paddingLeft: '42px', textAlign: 'center',
                    fontSize: '1.5rem', letterSpacing: '0.3em', fontWeight: 600,
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-lg"
                  onClick={() => { setStep('phone'); setError(''); setCode(''); }}
                  style={{ flex: '0 0 auto' }}
                >
                  <ArrowLeft size={18} />
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={loading || !code.trim()}
                  style={{ flex: 1, opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? (
                    <div className="animate-spin" style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                    }} />
                  ) : (
                    <>Verify <ArrowRight size={18} /></>
                  )}
                </button>
              </div>
            </motion.form>
          )}

          {step === '2fa' && (
            <motion.form
              key="2fa"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              onSubmit={handleVerify2FA}
            >
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <Lock size={18} style={{
                  position: 'absolute', left: '14px', top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-muted)',
                }} />
                <input
                  className="input input-lg"
                  type="password"
                  value={password2FA}
                  onChange={(e) => setPassword2FA(e.target.value)}
                  placeholder="2FA Password"
                  autoFocus
                  style={{ paddingLeft: '42px' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading || !password2FA.trim()}
                style={{ width: '100%', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? (
                  <div className="animate-spin" style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                  }} />
                ) : (
                  <>Sign In <ArrowRight size={18} /></>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
