import { useState, useEffect, useCallback } from 'react';
import { accessApi, authApi, setAccessToken, clearAccessToken } from './api/client';
import { AccessGate } from './components/auth/AccessGate';
import { LoginWizard } from './components/auth/LoginWizard';
import { Dashboard } from './components/dashboard/Dashboard';
import { ShareDownload } from './components/shared/ShareDownload';
import type { UserInfo } from './types';

type AppState = 'loading' | 'access-gate' | 'login' | 'dashboard' | 'public-share';

function App() {
  const [state, setState] = useState<AppState>('loading');
  const [user, setUser] = useState<UserInfo | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);

  // Check initial state
  useEffect(() => {
    // Check if accessing a public share link
    const path = window.location.pathname;
    if (path.startsWith('/share/')) {
      const id = path.substring(7); // Remove '/share/'
      if (id) {
        setShareId(id);
        setState('public-share');
        return;
      }
    }
    const init = async () => {
      try {
        // 1. Check if access password is required
        const accessCheck = await accessApi.check();
        setPasswordRequired(accessCheck.passwordRequired);

        // 2. If we have a stored token, check if Telegram is authed
        const token = localStorage.getItem('access_token');
        if (token || !accessCheck.passwordRequired) {
          // If no password required, get a token
          if (!token && !accessCheck.passwordRequired) {
            const result = await accessApi.login('');
            setAccessToken(result.token);
          }

          try {
            const authStatus = await authApi.status();
            if (authStatus.authenticated && authStatus.user) {
              setUser(authStatus.user);
              setState('dashboard');
              return;
            }
          } catch {
            // Token might be invalid
          }
          setState(accessCheck.passwordRequired && !token ? 'access-gate' : 'login');
        } else {
          setState('access-gate');
        }
      } catch {
        setState('access-gate');
      }
    };
    init();
  }, []);

  const handleAccessLogin = useCallback(() => {
    // After access password verified, check Telegram auth
    authApi.status().then((res) => {
      if (res.authenticated && res.user) {
        setUser(res.user);
        setState('dashboard');
      } else {
        setState('login');
      }
    }).catch(() => setState('login'));
  }, []);

  const handleTelegramLogin = useCallback((loggedInUser: UserInfo) => {
    setUser(loggedInUser);
    setState('dashboard');
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch { /* ignore */ }
    setUser(null);
    setState('login');
  }, []);

  const handleAccessLogout = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setState('access-gate');
  }, []);

  // Loading splash
  if (state === 'loading') {
    return (
      <div className="auth-bg" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="animate-spin" style={{
            width: '40px', height: '40px', borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: 'var(--accent-primary)',
          }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Initializing...</span>
        </div>
      </div>
    );
  }

  // Access gate (web password)
  if (state === 'access-gate') {
    return <AccessGate onSuccess={handleAccessLogin} />;
  }

  // Telegram login
  if (state === 'login') {
    return <LoginWizard onLogin={handleTelegramLogin} />;
  }

  // Public share landing page
  if (state === 'public-share' && shareId) {
    return <ShareDownload shareId={shareId} />;
  }

  // Dashboard
  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
      onAccessLogout={passwordRequired ? handleAccessLogout : undefined}
    />
  );
}

export default App;
