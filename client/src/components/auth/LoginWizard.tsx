import { useState, useEffect, useRef } from 'react';
import { Phone, KeyRound, Lock, ArrowRight, ArrowLeft, Send, QrCode, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { authApi } from '../../api/client';
import type { UserInfo, AuthStep } from '../../types';

interface LoginWizardProps {
  onLogin: (user: UserInfo) => void;
}

export function LoginWizard({ onLogin }: LoginWizardProps) {
  const [step, setStep] = useState<AuthStep>('method-select');
  const [apiId, setApiId] = useState(() => localStorage.getItem('tg_api_id') || '');
  const [apiHash, setApiHash] = useState(() => localStorage.getItem('tg_api_hash') || '');
  const [showConfig, setShowConfig] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password2FA, setPassword2FA] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pollingRef = useRef<any>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const validateConfig = () => {
    if (!apiId.trim() || !apiHash.trim()) {
      setError('Telegram API ID and API Hash are required! Please fill them in the Configuration box.');
      setShowConfig(true);
      return false;
    }
    setError('');
    // Store in localStorage for convenience
    localStorage.setItem('tg_api_id', apiId.trim());
    localStorage.setItem('tg_api_hash', apiHash.trim());
    return true;
  };

  const handleStartQR = async () => {
    if (!validateConfig()) return;
    setStep('qr');
    setQrLoading(true);
    setError('');

    try {
      const result = await authApi.startQR(apiId.trim(), apiHash.trim());
      setQrUrl(result.tokenUrl);
      setQrLoading(false);

      // Start polling status
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(async () => {
        try {
          const check = await authApi.pollQRStatus();
          if (check.status === 'success' && check.user) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            onLogin(check.user);
          } else if (check.status === 'requires2FA') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setStep('2fa');
          } else if (check.status === 'expired' || check.status === 'error') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setError(check.error || 'QR Code session expired. Please retry.');
            setStep('method-select');
          }
        } catch {
          // ignore transient errors
        }
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to initialize QR code login');
      setStep('method-select');
      setQrLoading(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    if (!validateConfig()) return;

    setLoading(true);
    setError('');

    try {
      const result = await authApi.sendCode(phone.trim(), apiId.trim(), apiHash.trim());
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

  const handleGoBack = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setError('');
    setStep('method-select');
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
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            style={{
              width: '68px', height: '68px', borderRadius: '18px',
              background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 32px rgba(42, 171, 238, 0.3)',
            }}
          >
            <Send size={28} color="white" />
          </motion.div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: '6px' }}>Sign in to Telegram</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
            {step === 'method-select' && 'Select how you want to log in'}
            {step === 'phone' && 'Enter your phone number to get started'}
            {step === 'qr' && 'Scan QR Code using Telegram app'}
            {step === 'code' && `We sent a code to ${phone}`}
            {step === '2fa' && 'Enter your 2-factor authentication password'}
          </p>
        </div>

        {/* Dynamic API ID & API Hash Configuration Section */}
        {step === 'method-select' && (
          <div style={{ marginBottom: '24px' }}>
            <button
              onClick={() => setShowConfig(!showConfig)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'none', border: 'none', color: 'var(--text-accent)',
                fontSize: '0.8125rem', cursor: 'pointer', outline: 'none',
                padding: '4px 0', margin: '0 auto',
              }}
            >
              <Settings size={14} /> 
              {showConfig ? 'Hide API Configuration' : 'Configure Telegram API Credentials'}
            </button>
            
            <AnimatePresence>
              {showConfig && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    overflow: 'hidden', marginTop: '12px',
                    display: 'flex', flexDirection: 'column', gap: '10px',
                    padding: '12px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      API ID
                    </label>
                    <input
                      className="input"
                      type="text"
                      value={apiId}
                      onChange={(e) => setApiId(e.target.value)}
                      placeholder="e.g. 12345678"
                      style={{ height: '36px', fontSize: '0.8125rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      API Hash
                    </label>
                    <input
                      className="input"
                      type="password"
                      value={apiHash}
                      onChange={(e) => setApiHash(e.target.value)}
                      placeholder="e.g. abcd1234efgh5678..."
                      style={{ height: '36px', fontSize: '0.8125rem' }}
                    />
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Retrieve these keys from <a href="https://my.telegram.org" target="_blank" rel="noopener" style={{ color: 'var(--text-accent)' }}>my.telegram.org</a>. They remain locally saved in your browser and backend.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

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
          {step === 'method-select' && (
            <motion.div
              key="method-select"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={handleStartQR}
                style={{ width: '100%', gap: '12px', background: 'var(--accent-gradient)' }}
              >
                <QrCode size={20} /> Login with QR Code
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={() => setStep('phone')}
                style={{ width: '100%', gap: '12px' }}
              >
                <Phone size={20} /> Login with Phone Number
              </button>
            </motion.div>
          )}

          {step === 'qr' && (
            <motion.div
              key="qr"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              {qrLoading ? (
                <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
                  <div className="animate-spin" style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    border: '3px solid rgba(255,255,255,0.1)',
                    borderTopColor: 'var(--accent-primary)',
                  }} />
                </div>
              ) : (
                <div style={{
                  padding: '16px',
                  background: 'white',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-md)',
                  marginBottom: '20px',
                }}>
                  {qrUrl && <QRCodeSVG value={qrUrl} size={180} level="M" includeMargin={false} />}
                </div>
              )}

              <p style={{
                fontSize: '0.75rem', color: 'var(--text-muted)',
                textAlign: 'center', lineHeight: 1.6, marginBottom: '20px',
              }}>
                1. Open Telegram on your phone.<br />
                2. Go to **Settings** &rarr; **Devices** &rarr; **Link Desktop Device**.<br />
                3. Point your camera at this screen to scan the QR code.
              </p>

              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={handleGoBack}
                style={{ width: '100%', gap: '10px' }}
              >
                <ArrowLeft size={16} /> Choose Another Method
              </button>
            </motion.div>
          )}

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

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-lg"
                  onClick={handleGoBack}
                  style={{ flex: '0 0 auto' }}
                >
                  <ArrowLeft size={18} />
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={loading || !phone.trim()}
                  style={{ flex: 1, opacity: loading ? 0.7 : 1 }}
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
              </div>
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
                  placeholder="OTP"
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
