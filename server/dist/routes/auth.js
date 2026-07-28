import { Router } from 'express';
import crypto from 'crypto';
import { sendCode, verifyCode, verify2FA, logout, sendQRToken, checkQRStatus, } from '../telegram.js';
import { registerUser, getUserByUsername, verifyPassword, updateUserWebToken, hashPassword, } from '../db.js';
import { requireUserToken } from '../middleware/auth.js';
export const authRouter = Router();
// ── Public Web Account Authentication Routes ───────────────────────────
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
    }
    catch (err) {
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
        const user = getUserByUsername(username);
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
    }
    catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            error: { code: 'LOGIN_FAILED', message: err.message || 'Failed to login' },
        });
    }
});
// ── Protected Telegram Auth Routing ────────────────────────────────────
// Start QR Code Auth Session
authRouter.post('/qr/start', requireUserToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const { apiId, apiHash, authSessionId } = req.body;
        const result = await sendQRToken(userId, authSessionId ? String(authSessionId) : undefined, apiId ? parseInt(apiId, 10) : undefined, apiHash ? String(apiHash) : undefined);
        res.json(result);
    }
    catch (err) {
        console.error('QR Start error:', err);
        res.status(500).json({
            error: { code: 'QR_START_FAILED', message: err.message || 'Failed to start QR session' },
        });
    }
});
// Poll QR Auth Status
authRouter.get('/qr/status', requireUserToken, async (req, res) => {
    try {
        const authSessionId = req.query.authSessionId;
        if (!authSessionId) {
            res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'authSessionId is required' } });
            return;
        }
        const statusResult = await checkQRStatus(authSessionId);
        res.json(statusResult);
    }
    catch (err) {
        res.status(500).json({
            error: { code: 'QR_STATUS_FAILED', message: err.message },
        });
    }
});
// Send verification code (SMS)
authRouter.post('/send-code', requireUserToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const { phoneNumber, apiId, apiHash, authSessionId } = req.body;
        if (!phoneNumber) {
            res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Phone number is required' } });
            return;
        }
        const result = await sendCode(userId, authSessionId ? String(authSessionId) : undefined, String(phoneNumber), apiId ? parseInt(apiId, 10) : undefined, apiHash ? String(apiHash) : undefined);
        res.json({
            success: true,
            authSessionId: result.authSessionId,
            phoneCodeHash: result.phoneCodeHash,
        });
    }
    catch (err) {
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
    const userId = req.user.id;
    try {
        const { authSessionId, phoneNumber, code, phoneCodeHash } = req.body;
        if (!authSessionId || !phoneNumber || !code || !phoneCodeHash) {
            res.status(400).json({
                error: { code: 'BAD_REQUEST', message: 'authSessionId, phone, code and phoneCodeHash are required' },
            });
            return;
        }
        const result = await verifyCode(userId, String(authSessionId), String(phoneNumber), String(code), String(phoneCodeHash));
        res.json(result);
    }
    catch (err) {
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
    const userId = req.user.id;
    try {
        const { authSessionId, password } = req.body;
        if (!authSessionId || !password) {
            res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'authSessionId and password are required' } });
            return;
        }
        const result = await verify2FA(userId, String(authSessionId), String(password));
        res.json(result);
    }
    catch (err) {
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
    const me = req.user;
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
        const me = req.user;
        if (me) {
            await logout(me.id);
        }
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({
            error: { code: 'LOGOUT_FAILED', message: err.message },
        });
    }
});
//# sourceMappingURL=auth.js.map