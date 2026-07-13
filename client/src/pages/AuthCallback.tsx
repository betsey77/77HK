import { useEffect, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';

/**
 * Auth callback — handles email confirmation redirects.
 *
 * Two scenarios:
 * 1. User clicks the email link and arrives fresh → SIGNED_IN event fires.
 * 2. User already has a valid session (e.g., Supabase processed the hash
 *    before this component mounted) → we check `getSession()` proactively.
 *
 * The combination of `onAuthStateChange` listener + immediate `getSession()`
 * check ensures we never miss the auth event.
 */

export default function AuthCallback() {
  const { isDark } = useTheme();
  const [status, setStatus] = useState<'processing' | 'error' | 'success'>('processing');
  const [message, setMessage] = useState('正在验证邮箱…');

  useEffect(() => {
    let cancelled = false;

    // Check if session already exists (Supabase may have processed URL hash
    // before this component mounted via detectSessionInUrl)
    async function checkExisting() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session?.user?.email_confirmed_at) {
        setStatus('success');
        setMessage('邮箱验证成功！正在跳转…');
        setTimeout(() => { window.location.replace('/app'); }, 1500);
        return true; // handled
      }
      return false; // no existing confirmed session
    }

    // Listen for future auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (cancelled) return;

        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user?.email_confirmed_at) {
          setStatus('success');
          setMessage('邮箱验证成功！正在跳转…');
          setTimeout(() => { window.location.replace('/app'); }, 1500);
        }
      }
    );

    // Start checking
    checkExisting();

    // Safety timeout — if neither checkExisting nor onAuthStateChange resolves
    // within 15 seconds, show error
    const timeout = setTimeout(() => {
      if (cancelled) return;
      if (status === 'processing') {
        setStatus('error');
        setMessage('验证超时，请重新登录');
        setTimeout(() => { window.location.replace('/login'); }, 2000);
      }
    }, 15000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className={`min-h-full flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
      <div className="text-center space-y-4">
        {status === 'processing' && (
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-gray-700 border-t-emerald-400" />
        )}
        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          {message}
        </p>
      </div>
    </div>
  );
}
