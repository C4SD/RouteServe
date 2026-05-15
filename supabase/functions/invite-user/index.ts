import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, invitation_token, workspace_name, target_app } = await req.json();

    if (!email || !invitation_token) {
      return new Response(
        JSON.stringify({ error: 'email and invitation_token are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appUrl = target_app === 'mod4'
      ? (Deno.env.get('MOD4_URL') ?? 'https://driverbiko.netlify.app')
      : (Deno.env.get('APP_URL') ?? 'https://appbiko.netlify.app');
    const redirectTo = `${appUrl}/invite/${invitation_token}`;

    // Use Supabase's built-in invite which creates the user and sends a magic link email
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        invitation_token,
        workspace_name: workspace_name || 'BIKO',
        invited_by: caller.email,
      },
    });

    if (error) {
      // User already exists in auth — send a magic link email via the OTP endpoint.
      // generateLink({ type: 'magiclink' }) only returns a token; it does NOT send email.
      // The /auth/v1/otp endpoint actually sends the email.
      const isAlreadyRegistered =
        (error as any).status === 422 ||
        error.message?.includes('already been registered') ||
        error.message?.includes('already exists') ||
        error.message?.includes('User already registered');
      if (isAlreadyRegistered) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

        const otpRes = await fetch(
          `${supabaseUrl}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`,
          {
            method: 'POST',
            headers: {
              'apikey': anonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email,
              create_user: false,
            }),
          }
        );

        if (!otpRes.ok) {
          const otpErr = await otpRes.json().catch(() => ({}));
          return new Response(
            JSON.stringify({
              error: 'Could not send sign-in link to existing user.',
              details: otpErr,
              invitation_url: redirectTo,
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            existing_user: true,
            message: `Sign-in link sent to ${email}`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        existing_user: false,
        message: `Invitation email sent to ${email}`,
        user_id: data.user?.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
