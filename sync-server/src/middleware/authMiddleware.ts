import { Request, Response, NextFunction } from 'express';
import { getDatabase, saveDatabase } from '../config/database';

export interface AuthenticatedUser {
  id: number;
  username: string;
}

// Resolve identity from WhiteNote's verified session, never client-supplied IDs.
export async function resolveSession(cookieHeader?: string): Promise<AuthenticatedUser | null> {
  if (!cookieHeader || !process.env.AUTH_BASE_URL) return null;
  try {
    const response = await fetch(new URL('/api/auth/session', process.env.AUTH_BASE_URL), {
      headers: { cookie: cookieHeader },
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    if (!response.ok) return null;
    const session = await response.json() as { user?: { id?: string; email?: string } };
    if (typeof session.user?.id !== 'string' || !session.user.id ||
        typeof session.user.email !== 'string' || !session.user.email) return null;

    // Map string IDs to unique persistent numeric IDs; parseInt fallbacks collide.
    const db = getDatabase();
    db.run(`INSERT OR IGNORE INTO auth_users (id, external_id)
      SELECT COALESCE(MAX(id), 0) + 1, ? FROM (
        SELECT id FROM auth_users UNION ALL SELECT user_id AS id FROM user_documents
      )`, [session.user.id]);
    const rows = db.exec('SELECT id FROM auth_users WHERE external_id = ?', [session.user.id]);
    const id = rows[0]?.values[0]?.[0];
    if (typeof id !== 'number' || !Number.isSafeInteger(id)) return null;
    saveDatabase();
    return { id, username: session.user.email };
  } catch {
    return null;
  }
}

export async function validateSession(req: Request, res: Response, next: NextFunction) {
  const user = await resolveSession(req.headers.cookie);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  next();
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
