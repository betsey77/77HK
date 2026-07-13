import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/supabase.js';

// Extend Express Request to carry authenticated user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userJwt?: string;
      userRole?: string;
    }
  }
}

/**
 * requireAuth middleware — verifies the Supabase JWT from the Authorization header.
 *
 * Usage: router.get('/protected', requireAuth, handler)
 *
 * On success, sets req.userId and req.userEmail for downstream middleware/handlers.
 * On failure, returns 401 with a JSON error and does NOT call next().
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice('Bearer '.length);

  verifyToken(token)
    .then((user) => {
      if (!user) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }

      req.userId = user.sub;
      req.userEmail = user.email;
      req.userJwt = token;
      next();
    })
    .catch(() => {
      res.status(401).json({ error: 'Invalid or expired token' });
    });
}
