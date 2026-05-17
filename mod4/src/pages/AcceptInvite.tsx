// MOD4 Invite Acceptance Page
// Handles driver invitation links sent from the Biko admin console

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase';
import { decodeInviteToken } from '@/lib/inviteToken';
import { Loader2, CheckCircle, XCircle, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';

type State = 'loading' | 'accepting' | 'success' | 'error';

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMsg('No invitation token found.');
      setState('error');
      return;
    }

    const run = async () => {
      // Supabase sets the session in the URL hash after magic-link auth.
      // getSession() waits for that to settle.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setErrorMsg('Could not verify your session. Please try clicking the link again.');
        setState('error');
        return;
      }

      setState('accepting');

      const { error } = await supabase.rpc('accept_invitation', { p_token: decodeInviteToken(token) });

      if (error) {
        setErrorMsg(error.message || 'Failed to accept the invitation.');
        setState('error');
        return;
      }

      setState('success');
      setTimeout(() => navigate('/activate'), 2000);
    };

    run();
  }, [token, navigate]);

  if (state === 'loading' || state === 'accepting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Truck className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        <p className="text-sm text-muted-foreground">
          {state === 'loading' ? 'Verifying your invitation…' : 'Accepting invitation…'}
        </p>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-xl font-bold">Invitation accepted!</h1>
        <p className="text-sm text-muted-foreground">Setting up your driver account…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <h1 className="text-xl font-bold">Invitation error</h1>
      <p className="text-sm text-muted-foreground max-w-xs">{errorMsg}</p>
      <Button variant="outline" onClick={() => navigate('/login')}>
        Go to login
      </Button>
    </div>
  );
}
