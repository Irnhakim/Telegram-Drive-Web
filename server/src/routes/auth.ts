import { Router } from 'express';
import crypto from 'crypto';
import {
  sendCode,
  verifyCode,
  verify2FA,
  deactivateClient,
  disconnectTelegram,
  sendQRToken,
  checkQRStatus,
} from '../telegram.js';
import {
  registerUser,
  getUserById,
  getUserByUsername,
  getUserByUsernameOrEmail,
  getUserByEmail,
  getUserByResetToken,
  updateUserResetToken,
  updateUserPassword,
  updateUserEmail,
  verifyPassword,
  updateUserWebToken,
  hashPassword,
} from '../db.js';
import { sendUsernameRecoveryEmail, sendPasswordResetEmail } from '../utils/mailer.js';
import { requireUserToken } from '../middleware/auth.js';

export const authRouter = Router();

// ── Public Web Account Authentication Routes ───────────────────────────

// Check username availability
authRouter.get('/check-username', (req, res) => {
  try {
    const username = (req.query.username as string || '').trim().toLowerCase();
    if (!username || username.length < 3) {
      res.json({ available: false });
      return;
    }
    const existing = getUserByUsername(username);
    res.json({ available: !existing });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// TeleDrive Account Registration
authRouter.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Username and password are required' },
      });
      return;
    }

    if (username.length < 3 || password.length < 6) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Username must be at least 3 chars, password at least 6 chars',
        },
      });
      return;
    }

    const existing = getUserByUsername(username);
    if (existing) {
      res.status(400).json({
        error: { code: 'USERNAME_EXISTS', message: 'Username is already taken' },
      });
      return;
    }

    const passwordHash = hashPassword(password);
    const user = registerUser(username, passwordHash, email);

    res.json({
      success: true,
      token: user.token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email || '',
        telegramConnected: false,
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({
      error: { code: 'REGISTRATION_FAILED', message: err.message || 'Failed to register account' },
    });
  }
});

// TeleDrive Account Login
authRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Username and password are required' },
      });
      return;
    }

    const user = getUserByUsernameOrEmail(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
      });
      return;
    }

    // Refresh web access token upon login
    const newToken = crypto.randomBytes(32).toString('hex');
    updateUserWebToken(user.id, newToken);
    user.token = newToken;

    res.json({
      success: true,
      token: user.token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email || '',
        telegramConnected: !!user.session,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({
      error: { code: 'LOGIN_FAILED', message: err.message || 'Failed to login' },
    });
  }
});

// Forgot Username Route
authRouter.post('/forgot-username', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Email wajib diisi' } });
      return;
    }
    const user = getUserByEmail(email);
    if (!user) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Gagal: Email tidak terdaftar di sistem' } });
      return;
    }
    await sendUsernameRecoveryEmail(user.email!, user.username);
    res.json({ success: true, message: 'Berhasil: Username telah dikirim ke email Anda! (Harap periksa juga folder SPAM/Promosi jika belum menerimanya)' });
  } catch (err: any) {
    console.error('Forgot username error:', err);
    res.status(500).json({ error: { code: 'RECOVERY_FAILED', message: 'Gagal mengirim email recovery: ' + err.message } });
  }
});

// Forgot Password Route
authRouter.post('/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Username atau Email wajib diisi' } });
      return;
    }
    const user = getUserByUsernameOrEmail(identifier);
    if (!user) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Gagal: Akun tidak ditemukan' } });
      return;
    }
    if (!user.email) {
      res.status(400).json({ error: { code: 'NO_EMAIL', message: 'Gagal: Akun ini tidak memiliki email pemulihan yang terdaftar' } });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = Math.floor(Date.now() / 1000) + 3600; // 1 hour expiry
    updateUserResetToken(user.id, resetToken, resetTokenExpires);

    // Extract client host to form absolute reset link
    const resetLink = `${req.protocol}://${req.get('host')}/?reset_token=${resetToken}`;
    await sendPasswordResetEmail(user.email, resetLink);
    
    res.json({ success: true, message: 'Berhasil: Link reset password telah dikirim ke email Anda! (Harap periksa juga folder SPAM/Promosi jika belum menerimanya)' });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: { code: 'RESET_REQUEST_FAILED', message: 'Gagal mengirim email reset: ' + err.message } });
  }
});

// Reset Password Route
authRouter.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Token and new password are required' } });
      return;
    }
    const user = getUserByResetToken(token);
    if (!user || !user.resetTokenExpires || Math.floor(Date.now() / 1000) > user.resetTokenExpires) {
      res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Token reset tidak valid atau telah kedaluwarsa' } });
      return;
    }

    const hashed = hashPassword(newPassword);
    updateUserPassword(user.id, hashed);
    res.json({ success: true, message: 'Password berhasil diubah. Silakan login kembali.' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: { code: 'RESET_FAILED', message: err.message || 'Failed to reset password' } });
  }
});

// ── Protected Telegram Auth Routing ────────────────────────────────────

// Start QR Code Auth Session
authRouter.post('/qr/start', requireUserToken, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const { apiId, apiHash, authSessionId } = req.body;
    const result = await sendQRToken(
      userId,
      authSessionId ? String(authSessionId) : undefined,
      apiId ? parseInt(apiId, 10) : undefined,
      apiHash ? String(apiHash) : undefined
    );
    res.json(result);
  } catch (err: any) {
    console.error('QR Start error:', err);
    res.status(500).json({
      error: { code: 'QR_START_FAILED', message: err.message || 'Failed to start QR session' },
    });
  }
});

// Poll QR Auth Status
authRouter.get('/qr/status', requireUserToken, async (req, res) => {
  try {
    const authSessionId = req.query.authSessionId as string;
    if (!authSessionId) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'authSessionId is required' } });
      return;
    }

    const statusResult = await checkQRStatus(authSessionId);
    res.json(statusResult);
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'QR_STATUS_FAILED', message: err.message },
    });
  }
});

// Send verification code (SMS)
authRouter.post('/send-code', requireUserToken, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const { phoneNumber, apiId, apiHash, authSessionId } = req.body;
    if (!phoneNumber) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Phone number is required' } });
      return;
    }

    let formattedPhone = String(phoneNumber).trim().replace(/[^0-9+]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+62' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('62') && !formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    const result = await sendCode(
      userId,
      authSessionId ? String(authSessionId) : undefined,
      formattedPhone,
      apiId ? parseInt(apiId, 10) : undefined,
      apiHash ? String(apiHash) : undefined
    );

    res.json({
      success: true,
      authSessionId: result.authSessionId,
      phoneCodeHash: result.phoneCodeHash,
    });
  } catch (err: any) {
    console.error('Send code error:', err);
    res.status(500).json({
      error: {
        code: 'SEND_CODE_FAILED',
        message: err.errorMessage || err.message || 'Failed to send code',
      },
    });
  }
});

// Verify code
authRouter.post('/verify-code', requireUserToken, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const { authSessionId, phoneNumber, code, phoneCodeHash } = req.body;
    if (!authSessionId || !phoneNumber || !code || !phoneCodeHash) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'authSessionId, phone, code and phoneCodeHash are required' },
      });
      return;
    }

    let formattedPhone = String(phoneNumber).trim().replace(/[^0-9+]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+62' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('62') && !formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    const result = await verifyCode(
      userId,
      String(authSessionId),
      formattedPhone,
      String(code),
      String(phoneCodeHash)
    );

    res.json(result);
  } catch (err: any) {
    console.error('Verify code error:', err);
    res.status(400).json({
      error: {
        code: 'VERIFY_FAILED',
        message: err.errorMessage || err.message || 'Invalid code',
      },
    });
  }
});

// Verify 2FA password
authRouter.post('/verify-2fa', requireUserToken, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const { authSessionId, password } = req.body;
    if (!authSessionId || !password) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'authSessionId and password are required' } });
      return;
    }

    const result = await verify2FA(userId, String(authSessionId), String(password));
    res.json(result);
  } catch (err: any) {
    console.error('2FA error:', err);
    res.status(400).json({
      error: {
        code: 'TWO_FA_FAILED',
        message: err.errorMessage || err.message || 'Invalid 2FA password',
      },
    });
  }
});

// ── Protected User Session Status Routes ───────────────────────────────

// Check authentication status
authRouter.get('/status', requireUserToken, async (req, res) => {
  const me = (req as any).user;
  res.json({
    authenticated: true,
    user: {
      id: me.id,
      username: me.username,
      email: me.email || '',
      telegramConnected: !!me.session,
      telegramUser: me.telegramId
        ? {
            id: me.telegramId,
            firstName: me.telegramFirstName || '',
            lastName: me.telegramLastName || '',
            username: me.telegramUsername || '',
            phone: me.telegramPhone || '',
          }
        : null,
    },
  });
});

// Logout
authRouter.post('/logout', requireUserToken, async (req, res) => {
  try {
    const me = (req as any).user;
    if (me) {
      // Deactivate client connection in memory
      await deactivateClient(me.id);
      // Invalidate token in database
      const newToken = crypto.randomBytes(32).toString('hex');
      updateUserWebToken(me.id, newToken);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'LOGOUT_FAILED', message: err.message },
    });
  }
});

// Disconnect Telegram Account
authRouter.post('/telegram/disconnect', requireUserToken, async (req, res) => {
  try {
    const me = (req as any).user;
    if (me) {
      await disconnectTelegram(me.id);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'DISCONNECT_FAILED', message: err.message },
    });
  }
});

// Update Profile Settings (Email and/or Password)
authRouter.put('/profile', requireUserToken, async (req, res) => {
  const userId = (req as any).user.id;
  const { email, currentPassword, newPassword } = req.body;
  try {
    const user = getUserById(userId);
    if (!user) {
      res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    // Email validation & duplication check
    if (email !== undefined) {
      const emailTrim = email.trim();
      if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
        res.status(400).json({ error: { code: 'INVALID_EMAIL', message: 'Format email tidak valid' } });
        return;
      }
      if (emailTrim) {
        const existing = getUserByEmail(emailTrim);
        if (existing && existing.id !== userId) {
          res.status(400).json({ error: { code: 'EMAIL_TAKEN', message: 'Email sudah digunakan oleh akun lain' } });
          return;
        }
      }
    }

    // Password validation & check current password
    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Password saat ini wajib diisi untuk mengubah password baru' } });
        return;
      }
      if (!verifyPassword(currentPassword, user.passwordHash)) {
        res.status(401).json({ error: { code: 'INVALID_PASSWORD', message: 'Password saat ini salah' } });
        return;
      }
    }

    // Save modifications
    if (email !== undefined) {
      updateUserEmail(userId, email.trim() || null);
    }
    if (newPassword) {
      const hashed = hashPassword(newPassword);
      updateUserPassword(userId, hashed);
    }

    res.json({
      success: true,
      message: 'Profil berhasil diperbarui!',
      user: {
        id: user.id,
        username: user.username,
        email: email !== undefined ? (email.trim() || '') : (user.email || ''),
        telegramConnected: !!user.session,
      }
    });
  } catch (err: any) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: { code: 'UPDATE_PROFILE_FAILED', message: err.message || 'Gagal memperbarui profil' } });
  }
});
