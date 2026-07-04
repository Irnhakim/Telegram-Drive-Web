import { Router } from 'express';
import {
  initClient,
  sendCode,
  verifyCode,
  verify2FA,
  checkAuth,
  logout,
  getMe,
} from '../telegram.js';

export const authRouter = Router();

// Check authentication status
authRouter.get('/status', async (_req, res) => {
  try {
    const isAuth = await checkAuth();
    if (isAuth) {
      const me = await getMe();
      res.json({
        authenticated: true,
        user: me
          ? {
              id: me.id?.toString(),
              firstName: me.firstName,
              lastName: me.lastName || '',
              username: me.username || '',
              phone: me.phone || '',
            }
          : null,
      });
    } else {
      res.json({ authenticated: false, user: null });
    }
  } catch (err: any) {
    res.json({ authenticated: false, user: null, error: err.message });
  }
});

// Send verification code
authRouter.post('/send-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Phone number is required' } });
      return;
    }

    // Initialize client if not already
    await initClient();
    const result = await sendCode(phoneNumber);

    res.json({
      success: true,
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
authRouter.post('/verify-code', async (req, res) => {
  try {
    const { phoneNumber, code, phoneCodeHash } = req.body;
    if (!phoneNumber || !code || !phoneCodeHash) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Phone number, code and phoneCodeHash are required' },
      });
      return;
    }

    const result = await verifyCode(phoneNumber, code, phoneCodeHash);

    if (result.requires2FA) {
      res.json({ success: false, requires2FA: true });
      return;
    }

    const me = await getMe();
    res.json({
      success: true,
      user: me
        ? {
            id: me.id?.toString(),
            firstName: me.firstName,
            lastName: me.lastName || '',
            username: me.username || '',
            phone: me.phone || '',
          }
        : null,
    });
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
authRouter.post('/verify-2fa', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Password is required' } });
      return;
    }

    await verify2FA(password);
    const me = await getMe();

    res.json({
      success: true,
      user: me
        ? {
            id: me.id?.toString(),
            firstName: me.firstName,
            lastName: me.lastName || '',
            username: me.username || '',
            phone: me.phone || '',
          }
        : null,
    });
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

// Logout
authRouter.post('/logout', async (_req, res) => {
  try {
    await logout();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'LOGOUT_FAILED', message: err.message },
    });
  }
});
