import { Request, Response, NextFunction } from 'express';
import cookie from 'cookie';

// Simple in-memory user cache for demo purposes
// In production, validate against external auth API
const userCache = new Map<string, { id: number; username: string }>();

export async function validateSession(req: Request, res: Response, next: NextFunction) {
  try {
    // Try to get user info from custom headers (set by frontend)
    const userId = req.headers['x-user-id'];
    const username = req.headers['x-username'];

    if (userId && username) {
      req.user = {
        id: parseInt(userId as string),
        username: username as string
      };
      return next();
    }

    // Fallback: Get cookies from request
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionCookie = cookies.session_id || cookies.connect_sid;

    if (!sessionCookie) {
      return res.status(401).json({ error: 'No session cookie found' });
    }

    // Demo mode: Create user from session hash
    const userIdNum = parseInt(sessionCookie.substring(0, 8), 16) % 10000 || 1;

    req.user = {
      id: userIdNum,
      username: `user_${userIdNum}`
    };

    next();
  } catch (error) {
    console.error('Auth validation error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
      };
    }
  }
}

// Socket.io authentication middleware
export async function validateSocketAuth(token: string): Promise<{ id: number; username: string } | null> {
  if (!token) return null;

  // Demo mode: create user from token
  const userId = parseInt(token.substring(0, 8), 16) % 10000 || 1;

  return {
    id: userId,
    username: `user_${userId}`
  };
}
