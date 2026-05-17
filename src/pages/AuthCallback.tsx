import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
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
    return () => subscription.unsubscribe();
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
