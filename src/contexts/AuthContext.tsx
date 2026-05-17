import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  sendDriverOtp: (email: string, workspaceId: string) => Promise<{ data?: string; error: any }>;
  verifyDriverOtp: (email: string, otp: string) => Promise<{ success: boolean; error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const redirectUrl = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, phone?: string) => {
    const redirectUrl = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });
    return { error };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  }, [navigate]);

  const sendDriverOtp = useCallback(async (email: string, workspaceId: string) => {
    const { data, error } = await supabase.rpc('generate_mod4_otp', {
      p_email: email,
      p_workspace_id: workspaceId,
    });
    return { data, error };
  }, []);

  const verifyDriverOtp = useCallback(async (identifier: string, otp: string) => {
    const isPhone = /^\+?\d[\d\s-]{6,}$/.test(identifier.trim());
    const cleanIdentifier = isPhone
      ? identifier.replace(/[^\d+]/g, '')
      : identifier.trim();

    const { data, error } = await supabase.rpc('verify_mod4_otp', {
      p_email: cleanIdentifier,
      p_otp: otp,
    });

    if (error) {
      return { success: false, error };
    }

    if (!data) {
      return { success: false, error: new Error('Invalid or expired OTP code') };
    }

    const resolvedEmail = data as string;
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password: otp,
    });

    if (signInError) {
      return { success: false, error: signInError };
    }

    if (signInData.session) {
      setSession(signInData.session);
      setUser(signInData.session.user);
      return { success: true, error: null };
    }

    return { success: false, error: new Error('Failed to create session') };
  }, []);

  const contextValue = useMemo(() => ({
    user, session, loading, signIn, signInWithGoogle, signUp, resetPassword, updatePassword, signOut, sendDriverOtp, verifyDriverOtp,
  }), [user, session, loading, signIn, signInWithGoogle, signUp, resetPassword, updatePassword, signOut, sendDriverOtp, verifyDriverOtp]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
