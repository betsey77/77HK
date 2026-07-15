import { Request, Response, NextFunction } from 'express';
import { createUserClient } from '../services/supabase.js';

/**
 * requireAdmin middleware — checks that the authenticated user has an admin role.
 *
 * MUST be placed AFTER requireAuth in the middleware chain (requires req.userId and req.userJwt).
 *
 * Uses a user-scoped client (with the user's JWT) to query the user_roles table.
 * RLS on user_roles ensures the user can only read their own role row.
 * Returns 403 if the user lacks admin privileges.
 * Sets req.userRole to the highest admin role found ('admin' or 'super_admin').
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.userId || !req.userJwt) {
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  const db = createUserClient(req.userJwt);

  (async () => {
    try {
      const { data, error } = await db
        .from('user_roles')
        .select('role')
        .eq('user_id', req.userId)
        .in('role', ['admin', 'super_admin']);

      if (error) {
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }

      if (!data || data.length === 0) {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      // Set the highest role found
      const roles = data.map((r: { role: string }) => r.role);
      req.userRole = roles.includes('super_admin') ? 'super_admin' : 'admin';
      next();
    } catch {
      res.status(500).json({ error: 'Server configuration error' });
    }
  })();
}

/**
 * requireSuperAdmin — narrow gate for super-admin-only endpoints.
 *
 * MUST run after requireAuth + requireAdmin (uses req.userRole set by requireAdmin).
 * Does not replace requireAdmin; ordinary admin routes remain unaffected.
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.userRole === 'super_admin') {
    next();
    return;
  }
  res.status(403).json({ error: 'Super admin access required' });
}
