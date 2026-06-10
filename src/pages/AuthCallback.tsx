import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');

    // Recovery email links arrive as /auth/callback?token_hash=xxx&type=recovery.
    // The Supabase client does not auto-exchange token_hash, so we call verifyOtp
    // explicitly here before redirecting to the reset-password form.
    if (tokenHash && type === 'recovery') {
      supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash }).then(({ error }) => {
        if (error) {
          // Link expired or already used — send to login form, not signup form.
          navigate('/auth', { replace: true, state: { defaultMode: 'login' } });
        } else {
          navigate('/auth?reset=true', { replace: true });
        }
      });
      return;
    }

    // For OAuth and magic-link callbacks, rely on the auth state change event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Unsubscribe before navigating so the subsequent SIGNED_IN event
        // (which Supabase always fires after PASSWORD_RECOVERY) does not
        // redirect the user away from the reset-password form.
        subscription.unsubscribe();
        navigate('/auth?reset=true', { replace: true });
      } else if (event === 'SIGNED_IN') {
        subscription.unsubscribe();
        navigate('/');
      }
    });

    // Safety timeout: if neither event fires within 10 s (e.g. no token in URL,
    // or the SDK fails silently), fall back to the login form.
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      navigate('/auth', { replace: true, state: { defaultMode: 'login' } });
    }, 10_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Completing sign in...</h2>
        <p className="text-muted-foreground">Please wait while we redirect you.</p>
      </div>
    </div>
  );
}
