import { RequestHandler } from 'express';
import { getUserByToken } from '../db.js';
import { getClientForUser } from '../telegram.js';

export const requireUserToken: RequestHandler = async (req, res, next) => {
  // Check x-access-token header or token query parameter
  const token = (req.headers['x-access-token'] as string) || (req.query.token as string);

  if (!token) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication token required' },
    });
    return;
  }

  try {
    const user = getUserByToken(token);
    if (!user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid authentication token' },
      });
      return;
    }

    // Attach user to request
    (req as any).user = user;

    // Retrieve Telegram client if session exists
    if (user.session) {
      try {
        const client = await getClientForUser(user.id);
        if (client) {
          (req as any).telegramClient = client;
        }
      } catch (err) {
        console.warn(`Failed to connect Telegram client for user ${user.id}:`, err);
      }
    }

    next();
  } catch (err: any) {
    console.error('requireUserToken middleware error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to verify session' },
    });
  }
};

// Middleware to block endpoints that require an active Telegram connection
export const requireTelegramLink: RequestHandler = (req, res, next) => {
  const client = (req as any).telegramClient;
  if (!client) {
    res.status(403).json({
      error: {
        code: 'TELEGRAM_NOT_LINKED',
        message: 'You must link your Telegram account before performing this action',
      },
    });
    return;
  }
  next();
};
