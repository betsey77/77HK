import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createUserClient } from '../services/supabase.js';

const router = Router();

/**
 * GET /api/me
 *
 * Returns the current user's profile from the `profiles` table
 * (or a minimal identity payload if the profiles table is not yet populated).
 *
 * Protected: requires a valid Supabase JWT in the Authorization header.
 * The database query is scoped to the authenticated user by RLS — the
 * user-scoped client can only read rows owned by that user.
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const jwt = req.headers.authorization!.slice('Bearer '.length);
    const db = createUserClient(jwt);

    // Try to fetch the user's profile from the profiles table.
    // RLS ensures the user can only read their own row.
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('*')
      .maybeSingle();

    // It's normal for a profile to not yet exist (e.g. user just signed up,
    // or the trigger hasn't run yet). Return identity-only payload in that case.
    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 = "no rows returned" — that's fine, not an error
      res.json({
        id: req.userId,
        email: req.userEmail,
        role: 'user',
        profile: null,
      });
      return;
    }

    res.json({
      id: req.userId,
      email: req.userEmail,
      role: profile?.role ?? 'user',
      profile,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

export default router;
