import { useState, useEffect, useCallback } from 'react';
import { authApi, clearAccessToken } from './api/client';
import { WebAuth } from './components/auth/WebAuth';
import { LoginWizard } from './components/auth/LoginWizard';
import { Dashboard } from './components/dashboard/Dashboard';
import { ShareDownload } from './components/shared/ShareDownload';
import type { UserInfo } from './types';

type AppState = 'loading' | 'login' | 'link-telegram' | 'dashboard' | 'public-share';

function App() {
  const [state, setState] = useState<AppState>('loading');
  const [user, setUser] = useState<(UserInfo & { telegramConnected?: boolean }) | null>(null);
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
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const authStatus = await authApi.status();
          if (authStatus.authenticated && authStatus.user) {
            setUser(authStatus.user);
            setState(authStatus.user.telegramConnected ? 'dashboard' : 'link-telegram');
            return;
          }
        } catch {
          // Token might be invalid
          clearAccessToken();
        }
      }
      setState('login');
    };
    init();
  }, []);

  const handleWebAuthSuccess = useCallback((userInfo: UserInfo & { telegramConnected: boolean }) => {
    setUser(userInfo);
    setState(userInfo.telegramConnected ? 'dashboard' : 'link-telegram');
  }, []);

  const handleTelegramLogin = useCallback(() => {
    setUser((prev: any) => prev ? { ...prev, telegramConnected: true } : null);
    setState('dashboard');
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch { /* ignore */ }
    clearAccessToken();
    setUser(null);
    setState('login');
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

  // TeleDrive Login/Register
  if (state === 'login') {
    return <WebAuth onAuthSuccess={handleWebAuthSuccess} />;
  }

  // Telegram Linking Wizard
  if (state === 'link-telegram') {
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
    />
  );
}

export default App;
