/**
 * Auth Page - Modern Multi-Step Registration/Login
 *
 * Features:
 * - Dark theme with gradient accents
 * - Multi-step registration flow
 * - Social login options (Google, Microsoft)
 * - Smooth transitions between steps
 * - Profile preview on desktop
 */

import { useState, useEffect } from 'react';
import { decodeInviteToken } from '@/lib/inviteToken';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  User,
  Phone,
  Building2,
  Loader2,
  Eye,
  EyeOff,
  Shield,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';

// Validation schemas
const emailPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const passwordResetSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
});

type AuthMode = 'login' | 'signup' | 'otp-login' | 'forgot-password' | 'reset-password';
type SignupStep = 'credentials' | 'profile' | 'complete';
type OtpStep = 'email' | 'verify';
type DriverLoginTab = 'otp' | 'password';

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
}

// Google icon SVG component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// Microsoft icon SVG component
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

// Logo component
function RouteServeLogo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
        <Building2 className="w-5 h-5 text-white" />
      </div>
      <span className="text-xl font-semibold text-white">RouteServe</span>
    </div>
  );
}

// Gradient orb for visual interest
function GradientOrb() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-30 pointer-events-none">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/40 via-pink-500/30 to-orange-400/40 blur-3xl" />
    </div>
  );
}

export default function Auth() {
  const { signIn, signUp, signInWithGoogle, resetPassword, updatePassword, user, sendDriverOtp, verifyDriverOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Default to OTP login mode when accessed via /login (driver PWA)
  const isLoginRoute = location.pathname === '/login';
  const [mode, setMode] = useState<AuthMode>(() => {
    if (isLoginRoute) return 'otp-login';
    // Start in reset-password immediately when arriving at /auth?reset=true without
    // a token_hash — this prevents the redirect guard from bouncing an already-
    // authenticated recovery session to home before the mode-setting effect fires.
    if (searchParams.get('reset') === 'true' && !searchParams.get('token_hash')) return 'reset-password';
    // AuthCallback navigates here with state when a recovery token is expired/invalid,
    // or after a successful password reset.  Show login, not signup.
    if ((location.state as { defaultMode?: string } | null)?.defaultMode === 'login') return 'login';
    return 'signup';
  });
  const [step, setStep] = useState<SignupStep>('credentials');
  const [otpStep, setOtpStep] = useState<OtpStep>('email');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otpValue, setOtpValue] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [driverTab, setDriverTab] = useState<DriverLoginTab>('otp');
  const [driverIdentifier, setDriverIdentifier] = useState('');
  const [driverPassword, setDriverPassword] = useState('');
  const [showDriverPassword, setShowDriverPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
  });

  // Check for invitation token in URL
  const inviteToken = searchParams.get('invite');
  const isPasswordReset = searchParams.get('reset') === 'true';
  const recoveryTokenHash = searchParams.get('token_hash');
  const recoveryType = searchParams.get('type');

  // Only set mode immediately when there's no token_hash to verify.
  // When token_hash is present, the verifyOtp effect below sets mode after
  // the session is established so the form isn't interactive too early.
  useEffect(() => {
    if (isPasswordReset && !recoveryTokenHash) {
      setMode('reset-password');
    }
  }, [isPasswordReset, recoveryTokenHash]);

  // When navigated here in-place (component stays mounted) with a defaultMode hint
  // from AuthCallback, update mode accordingly.
  useEffect(() => {
    const stateMode = (location.state as { defaultMode?: string } | null)?.defaultMode;
    if (stateMode === 'login') {
      setMode('login');
      setStep('credentials');
      setErrors({});
    }
  }, [location.state]);

  // Exchange the recovery token_hash from the email link for a session
  // before showing the reset form. Show a loading state while this is in
  // progress so the user cannot submit before the session exists.
  useEffect(() => {
    if (recoveryTokenHash && recoveryType === 'recovery') {
      setVerifyingOtp(true);
      setMode('reset-password');
      (async () => {
        const { error } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: recoveryTokenHash,
        });
        if (error) {
          toast.error('Reset link invalid or expired', {
            description: error.message,
          });
          setMode('forgot-password');
        } else {
          // Strip sensitive params from URL now that the session is live.
          // Use navigate so React Router's searchParams state updates correctly.
          navigate('/auth?reset=true', { replace: true });
        }
        setVerifyingOtp(false);
      })();
    }
  }, [recoveryTokenHash, recoveryType, navigate]);

  // Pre-fill email from invitation when arriving with ?invite=TOKEN
  useEffect(() => {
    if (inviteToken && !formData.email) {
      const fetchInvitationEmail = async () => {
        try {
          let { data, error } = await supabase.rpc('get_invitation_by_token', {
            p_token: decodeInviteToken(inviteToken),
          });
          // Stale JWT → 401; clear dead session and retry as anon
          if (error && (error.message?.includes('401') || (error as any).status === 401)) {
            await supabase.auth.signOut();
            ({ data, error } = await supabase.rpc('get_invitation_by_token', {
              p_token: decodeInviteToken(inviteToken),
            }));
          }
          if (data && !error && data.email) {
            setFormData((prev) => ({ ...prev, email: data.email }));
          }
        } catch {
          // Silently fail — user can still type email manually
        }
      };
      fetchInvitationEmail();
    }
  }, [inviteToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if already logged in (but not during password recovery flow).
  // Also skip during verifyingOtp: the recovery session is established but
  // the user hasn't had a chance to set their password yet.
  useEffect(() => {
    if (user && mode !== 'reset-password' && !recoveryTokenHash && !verifyingOtp) {
      if (inviteToken) {
        navigate(`/invite/${inviteToken}`);
      } else {
        navigate(isLoginRoute ? '/mod4/driver' : '/');
      }
    }
  }, [user, navigate, inviteToken, isLoginRoute, mode, recoveryTokenHash, verifyingOtp]);

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const { error } = await signInWithGoogle();
      if (error) {
        toast.error('Google Sign In Failed', { description: error.message });
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (loading) return; // prevent double-submission

    const loginErrors: Record<string, string> = {};
    if (!formData.email || !z.string().email().safeParse(formData.email).success) {
      loginErrors.email = 'Please enter a valid email address';
    }
    if (!formData.password) {
      loginErrors.password = 'Please enter your password';
    }
    if (Object.keys(loginErrors).length > 0) {
      setErrors(loginErrors);
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(formData.email, formData.password);
      if (error) {
        // Map common Supabase Auth errors to user-friendly messages
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('email not confirmed')) {
          toast.error('Email Not Verified', {
            description: 'Please check your inbox and click the verification link before signing in.',
          });
        } else if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
          toast.error('Login Failed', {
            description: 'Incorrect email or password. Please try again.',
          });
        } else {
          toast.error('Login Failed', { description: error.message });
        }
      } else {
        if (inviteToken) {
          navigate(`/invite/${inviteToken}`);
        } else {
          // ProtectedRoute will redirect to /onboarding if needed
          navigate('/');
        }
      }
    } catch {
      toast.error('Login Failed', {
        description: 'Unable to reach the server. Please check your connection and try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialsNext = () => {
    try {
      emailPasswordSchema.parse({
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });
      setErrors({});
      setStep('profile');
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            fieldErrors[e.path[0] as string] = e.message;
          }
        });
        setErrors(fieldErrors);
      }
    }
  };

  const handleSignup = async () => {
    try {
      profileSchema.parse({
        fullName: formData.fullName,
        phone: formData.phone,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            fieldErrors[e.path[0] as string] = e.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setLoading(true);
    try {
      const { error } = await signUp(
        formData.email,
        formData.password,
        formData.fullName,
        formData.phone || undefined
      );

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('user already exists')) {
          toast.error('Account already exists', {
            description: 'An account with this email address already exists. Please sign in instead.',
          });
          setTimeout(switchToLogin, 1500);
        } else {
          toast.error('Signup Failed', { description: error.message });
        }
      } else {
        // For invited users, auto-confirm their email — the invitation
        // already validated the address so requiring a second confirmation
        // email creates a broken flow (can't sign in → can't accept).
        if (inviteToken) {
          await supabase.rpc('confirm_invited_email', {
            p_token: decodeInviteToken(inviteToken),
          });
        }

        // Check if user was auto-logged in (email confirmation not required)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (inviteToken) {
            // User signed up from an invitation — go accept it
            toast.success('Account Created', {
              description: 'Accepting your invitation...',
            });
            navigate(`/invite/${inviteToken}`);
          } else {
            toast.success('Account Created', {
              description: "Let's set up your workspace!",
            });
            navigate('/onboarding');
          }
        } else if (inviteToken) {
          // Email was just confirmed by the RPC — sign in and accept
          const { error: signInErr } = await signIn(formData.email, formData.password);
          if (!signInErr) {
            toast.success('Account Created', {
              description: 'Accepting your invitation...',
            });
            navigate(`/invite/${inviteToken}`);
          } else {
            // Fallback: show verification prompt
            setStep('complete');
            toast.success('Account Created', {
              description: 'Please check your email to verify your account.',
            });
          }
        } else {
          // Email verification required — show verification prompt
          setStep('complete');
          toast.success('Account Created', {
            description: 'Please check your email to verify your account.',
          });
        }
      }
    } catch {
      toast.error('An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  const switchToLogin = () => {
    setMode('login');
    setStep('credentials');
    setErrors({});
  };

  const switchToSignup = () => {
    setMode('signup');
    setStep('credentials');
    setErrors({});
  };

  const switchToOtpLogin = () => {
    setMode('otp-login');
    setOtpStep('email');
    setOtpEmail('');
    setOtpValue('');
    setErrors({});
  };

  const switchToForgotPassword = () => {
    setMode('forgot-password');
    setResetEmail(formData.email);
    setErrors({});
  };

  const handleForgotPassword = async () => {
    if (!resetEmail || !z.string().email().safeParse(resetEmail).success) {
      setErrors({ resetEmail: 'Please enter a valid email address' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await resetPassword(resetEmail);
      if (error) {
        toast.error('Reset Failed', { description: error.message });
      } else {
        toast.success('Password reset email sent', {
          description: `Check ${resetEmail} for a reset link.`,
        });
        switchToLogin();
      }
    } catch {
      toast.error('An error occurred while sending the reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    const result = passwordResetSchema.safeParse({
      password: newPassword,
      confirmPassword: confirmNewPassword,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        if (e.path[0]) {
          fieldErrors[e.path[0] as string] = e.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Reset link expired', {
        description: 'Please request a new password reset link.',
      });
      setMode('forgot-password');
      return;
    }

    setLoading(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        toast.error('Password Update Failed', { description: error.message });
      } else {
        toast.success('Password updated', {
          description: 'You can now sign in with your new password.',
        });
        setNewPassword('');
        setConfirmNewPassword('');
        // Sign out the recovery session so the user must authenticate with their
        // new password. signOut is awaited first so that the SIGNED_OUT event
        // (user→null) is batched with the subsequent mode change — this prevents
        // the redirect guard from firing while user is still truthy but mode is
        // already 'login'.
        await supabase.auth.signOut();
        navigate('/auth', { replace: true, state: { defaultMode: 'login' } });
        switchToLogin();
      }
    } catch {
      toast.error('An error occurred while updating your password');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpEmailSubmit = async () => {
    if (!otpEmail) {
      setErrors({ email: 'Please enter your email address' });
      return;
    }

    // Validate email format
    try {
      z.string().email().parse(otpEmail);
    } catch {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }

    setLoading(true);
    try {
      // TODO: Support multi-workspace — resolve workspace from driver's membership
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .limit(1)
        .maybeSingle();
      const wsId = membership?.workspace_id || DEFAULT_WORKSPACE_ID;
      const { error } = await sendDriverOtp(otpEmail, wsId);

      if (error) {
        toast.error('Failed to send OTP', {
          description: error.message || 'Please try again or contact support.'
        });
      } else {
        setOtpStep('verify');
        toast.success('OTP Sent', {
          description: `A login code has been sent to ${otpEmail}.`,
        });
      }
    } catch (err) {
      toast.error('An error occurred while sending OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    if (!otpEmail) {
      setErrors({ email: 'Please enter your email address' });
      return;
    }
    if (otpValue.length !== 6) {
      toast.error('Invalid OTP', { description: 'Please enter the complete 6-digit code' });
      return;
    }

    setLoading(true);
    try {
      const { success, error } = await verifyDriverOtp(otpEmail, otpValue);

      if (success) {
        toast.success('Device Registered', { description: 'Welcome to RouteServe Driver!' });
        if (inviteToken) {
          navigate(`/invite/${inviteToken}`);
        } else {
          navigate(isLoginRoute ? '/mod4/driver' : '/');
        }
      } else {
        toast.error('Verification Failed', {
          description: error?.message || 'Invalid or expired OTP code'
        });
        setOtpValue('');
      }
    } catch (err) {
      toast.error('An error occurred during verification');
      setOtpValue('');
    } finally {
      setLoading(false);
    }
  };

  // Render login form
  const renderLogin = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Welcome back</h1>
        <p className="text-zinc-400">Sign in to your account to continue.</p>
      </div>

      {/* Social Login */}
      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full h-12 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <GoogleIcon className="w-5 h-5 mr-3" />
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full h-12 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white"
          disabled={loading}
        >
          <MicrosoftIcon className="w-5 h-5 mr-3" />
          Continue with Microsoft
        </Button>
      </div>

      <div className="relative">
        <Separator className="bg-zinc-800" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-950 px-4 text-xs text-zinc-500 uppercase">
          or
        </span>
      </div>

      {/* Email/Password */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-300">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              className={cn(
                'h-12 pl-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20',
                errors.email && 'border-red-500'
              )}
            />
          </div>
          {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-zinc-300">
              Password
            </Label>
            <button
              type="button"
              onClick={switchToForgotPassword}
              className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              className={cn(
                'h-12 pl-11 pr-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20',
                errors.password && 'border-red-500'
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
        </div>
      </div>

      <Button
        onClick={handleLogin}
        disabled={loading}
        className="w-full h-12 bg-white hover:bg-zinc-200 text-black font-medium"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Signing in...
          </>
        ) : (
          'Sign In'
        )}
      </Button>

      <div className="space-y-3">
        <p className="text-center text-sm text-zinc-500">
          Don&apos;t have an account?{' '}
          <button onClick={switchToSignup} className="text-emerald-400 hover:text-emerald-300 font-medium">
            Sign up
          </button>
        </p>

        <div className="relative">
          <Separator className="bg-zinc-800" />
        </div>

        <button
          onClick={switchToOtpLogin}
          className="w-full flex items-center justify-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 py-2"
        >
          <Shield className="w-4 h-4" />
          Driver Login with Code
        </button>
      </div>
    </div>
  );

  const renderForgotPassword = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <button
          onClick={switchToLogin}
          className="flex items-center text-zinc-400 hover:text-zinc-200 text-sm mb-4"
          disabled={loading}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to sign in
        </button>
        <h1 className="text-3xl font-semibold text-white">Reset your password</h1>
        <p className="text-zinc-400">Enter your email and we&apos;ll send you a password reset link.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-email" className="text-zinc-300">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <Input
              id="reset-email"
              type="email"
              placeholder="Enter your email"
              value={resetEmail}
              onChange={(e) => {
                setResetEmail(e.target.value);
                if (errors.resetEmail) setErrors({});
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleForgotPassword(); }}
              className={cn(
                'h-12 pl-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20',
                errors.resetEmail && 'border-red-500'
              )}
            />
          </div>
          {errors.resetEmail && <p className="text-sm text-red-400">{errors.resetEmail}</p>}
        </div>
      </div>

      <Button
        onClick={handleForgotPassword}
        disabled={loading}
        className="w-full h-12 bg-white hover:bg-zinc-200 text-black font-medium"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Sending reset link...
          </>
        ) : (
          'Send Reset Link'
        )}
      </Button>
    </div>
  );

  const renderResetPassword = () => {
    if (verifyingOtp) {
      return (
        <div className="space-y-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          </div>
          <p className="text-zinc-400">Verifying your reset link…</p>
        </div>
      );
    }
    return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Create a new password</h1>
        <p className="text-zinc-400">Choose a secure password for your account.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password" className="text-zinc-300">
            New password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <Input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your new password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (errors.password) setErrors({});
              }}
              className={cn(
                'h-12 pl-11 pr-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20',
                errors.password && 'border-red-500'
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-new-password" className="text-zinc-300">
            Confirm new password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <Input
              id="confirm-new-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm your new password"
              value={confirmNewPassword}
              onChange={(e) => {
                setConfirmNewPassword(e.target.value);
                if (errors.confirmPassword) setErrors({});
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleUpdatePassword(); }}
              className={cn(
                'h-12 pl-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20',
                errors.confirmPassword && 'border-red-500'
              )}
            />
          </div>
          {errors.confirmPassword && <p className="text-sm text-red-400">{errors.confirmPassword}</p>}
        </div>
      </div>

      <Button
        onClick={handleUpdatePassword}
        disabled={loading}
        className="w-full h-12 bg-white hover:bg-zinc-200 text-black font-medium"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Updating password...
          </>
        ) : (
          'Update Password'
        )}
      </Button>
    </div>
    );
  };

  // Render signup step 1: credentials
  const renderCredentialsStep = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">
          Welcome to <span className="text-emerald-400">RouteServe.</span>
        </h1>
        <p className="text-zinc-400">Let&apos;s create your new account to get started.</p>
      </div>

      {/* Social Login */}
      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full h-12 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <GoogleIcon className="w-5 h-5 mr-3" />
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full h-12 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white"
          disabled={loading}
        >
          <MicrosoftIcon className="w-5 h-5 mr-3" />
          Continue with Microsoft
        </Button>
      </div>

      <div className="relative">
        <Separator className="bg-zinc-800" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-950 px-4 text-xs text-zinc-500 uppercase">
          or
        </span>
      </div>

      {/* Email/Password */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signup-email" className="text-zinc-300">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <Input
              id="signup-email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              className={cn(
                'h-12 pl-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20',
                errors.email && 'border-red-500'
              )}
            />
          </div>
          {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password" className="text-zinc-300">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <Input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a password"
              value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              className={cn(
                'h-12 pl-11 pr-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20',
                errors.password && 'border-red-500'
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
          <p className="text-xs text-zinc-500">Min 8 characters, uppercase, lowercase, and a number</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-confirm-password" className="text-zinc-300">
            Confirm Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <Input
              id="signup-confirm-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              className={cn(
                'h-12 pl-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20',
                errors.confirmPassword && 'border-red-500'
              )}
            />
          </div>
          {errors.confirmPassword && <p className="text-sm text-red-400">{errors.confirmPassword}</p>}
        </div>
      </div>

      <Button
        onClick={handleCredentialsNext}
        className="w-full h-12 bg-white hover:bg-zinc-200 text-black font-medium"
      >
        Continue with Email
        <ArrowRight className="w-5 h-5 ml-2" />
      </Button>

      <div className="space-y-4">
        <p className="text-center text-xs text-zinc-500">
          By continuing, you agree to our{' '}
          <a href="#" className="text-emerald-400 hover:underline">
            Terms of Service
          </a>{' '}
          &{' '}
          <a href="#" className="text-emerald-400 hover:underline">
            Privacy Policy
          </a>
        </p>

        <p className="text-center text-sm text-zinc-500">
          Already signed up?{' '}
          <button onClick={switchToLogin} className="text-emerald-400 hover:text-emerald-300 font-medium">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );

  // Render signup step 2: profile
  const renderProfileStep = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <button
          onClick={() => setStep('credentials')}
          className="flex items-center text-zinc-400 hover:text-zinc-200 text-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </button>
        <h1 className="text-3xl font-semibold text-white">Complete your profile</h1>
        <p className="text-zinc-400">Tell us a bit about yourself.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-emerald-500" />
        <div className="flex-1 h-1 rounded-full bg-emerald-500" />
        <div className="flex-1 h-1 rounded-full bg-zinc-800" />
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-zinc-300">
            Full name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <Input
              id="fullName"
              type="text"
              placeholder="Your display name"
              value={formData.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              className={cn(
                'h-12 pl-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20',
                errors.fullName && 'border-red-500'
              )}
            />
          </div>
          {errors.fullName && <p className="text-sm text-red-400">{errors.fullName}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-zinc-300">
            Phone number{' '}
            <span className="text-zinc-600">(optional)</span>
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <Input
              id="phone"
              type="tel"
              placeholder="+234 800 000 0000"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              className="h-12 pl-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>
        </div>

      </div>

      <Button
        onClick={handleSignup}
        disabled={loading}
        className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Creating account...
          </>
        ) : (
          <>
            Create Account
            <ArrowRight className="w-5 h-5 ml-2" />
          </>
        )}
      </Button>
    </div>
  );

  // Render signup complete — email verification needed
  const renderComplete = () => (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
        <Mail className="w-8 h-8 text-amber-400" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Verify your email</h1>
        <p className="text-zinc-400">
          We&apos;ve sent a verification link to <strong className="text-white">{formData.email}</strong>
        </p>
      </div>

      <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-left space-y-3">
        <h3 className="font-medium text-white">What happens next:</h3>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">1.</span>
            Click the verification link in your email
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">2.</span>
            You&apos;ll be taken to set up your organization workspace
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">3.</span>
            Invite your team and configure your fleet
          </li>
        </ul>
      </div>

      <Button
        onClick={switchToLogin}
        className="w-full h-12 bg-white hover:bg-zinc-200 text-black font-medium"
      >
        Already verified? Sign In
        <ArrowRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );

  // Render OTP login - email input
  const renderOtpEmailStep = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <button
          onClick={switchToLogin}
          className="flex items-center text-zinc-400 hover:text-zinc-200 text-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to login
        </button>
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-semibold text-white">Driver Login</h1>
        <p className="text-zinc-400">Enter your email to receive a one-time code.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="otp-email" className="text-zinc-300">
            Email Address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <Input
              id="otp-email"
              type="email"
              placeholder="driver@example.com"
              value={otpEmail}
              onChange={(e) => {
                setOtpEmail(e.target.value);
                if (errors.email) {
                  setErrors({});
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleOtpEmailSubmit();
                }
              }}
              className={cn(
                'h-12 pl-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-cyan-500 focus:ring-cyan-500/20',
                errors.email && 'border-red-500'
              )}
            />
          </div>
          {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
        </div>
      </div>

      <Button
        onClick={handleOtpEmailSubmit}
        disabled={loading}
        className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Sending code...
          </>
        ) : (
          <>
            Send Code
            <ArrowRight className="w-5 h-5 ml-2" />
          </>
        )}
      </Button>

      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <p className="text-sm text-blue-300">
          <strong>Driver Access Only:</strong> This login method is for authorized drivers. A 6-digit code will be sent to your email.
        </p>
      </div>
    </div>
  );

  // Render OTP verification step
  const renderOtpVerifyStep = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <button
          onClick={() => setOtpStep('email')}
          className="flex items-center text-zinc-400 hover:text-zinc-200 text-sm mb-4"
          disabled={loading}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Change email
        </button>
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-semibold text-white">Enter verification code</h1>
        <p className="text-zinc-400">
          We sent a 6-digit code to <strong className="text-white">{otpEmail}</strong>
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-zinc-300">Verification Code</Label>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otpValue}
              onChange={(value) => {
                setOtpValue(value);
                // Auto-submit when 6 digits are entered
                if (value.length === 6) {
                  setTimeout(() => {
                    handleOtpVerify();
                  }, 100);
                }
              }}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="w-12 h-12 text-lg bg-zinc-900 border-zinc-800 text-white" />
                <InputOTPSlot index={1} className="w-12 h-12 text-lg bg-zinc-900 border-zinc-800 text-white" />
                <InputOTPSlot index={2} className="w-12 h-12 text-lg bg-zinc-900 border-zinc-800 text-white" />
                <InputOTPSlot index={3} className="w-12 h-12 text-lg bg-zinc-900 border-zinc-800 text-white" />
                <InputOTPSlot index={4} className="w-12 h-12 text-lg bg-zinc-900 border-zinc-800 text-white" />
                <InputOTPSlot index={5} className="w-12 h-12 text-lg bg-zinc-900 border-zinc-800 text-white" />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <p className="text-xs text-center text-zinc-500">
            Code will auto-submit when complete
          </p>
        </div>
      </div>

      <Button
        onClick={handleOtpVerify}
        disabled={loading || otpValue.length !== 6}
        className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Verifying...
          </>
        ) : (
          'Verify Code'
        )}
      </Button>

      <button
        onClick={handleOtpEmailSubmit}
        disabled={loading}
        className="w-full text-sm text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
      >
        Didn&apos;t receive the code? Resend
      </button>
    </div>
  );

  // Detect whether input looks like a phone number
  const isPhoneInput = (value: string) => /^\+?\d[\d\s-]{6,}$/.test(value.trim());

  const handleDriverPasswordLogin = async () => {
    const loginErrors: Record<string, string> = {};
    if (!driverIdentifier) loginErrors.identifier = 'Please enter your phone number or email';
    if (!driverPassword) loginErrors.driverPassword = 'Please enter your password';
    if (Object.keys(loginErrors).length > 0) {
      setErrors(loginErrors);
      return;
    }

    setLoading(true);
    try {
      let loginEmail = driverIdentifier.trim();

      // If identifier looks like a phone, resolve it to an email via the DB
      if (isPhoneInput(loginEmail)) {
        const { data: resolvedEmail, error: lookupError } = await supabase.rpc(
          'lookup_driver_email',
          { p_identifier: loginEmail }
        );
        if (lookupError || !resolvedEmail) {
          setErrors({ identifier: 'No active driver account found for this phone number.' });
          setLoading(false);
          return;
        }
        loginEmail = resolvedEmail as string;
      }

      const { error } = await signIn(loginEmail, driverPassword);
      if (error) {
        if (error.message.toLowerCase().includes('invalid login')) {
          toast.error('Login Failed', { description: 'Incorrect password. Use "Forgot password?" to reset.' });
        } else {
          toast.error('Login Failed', { description: error.message });
        }
      } else {
        navigate('/mod4/driver', { replace: true });
      }
    } catch {
      toast.error('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  // Render driver onboarding form (tabbed: OTP code | Password)
  const renderDriverOnboarding = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-semibold text-white">Driver Login</h1>
        <p className="text-zinc-400">Sign in to access your deliveries.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-lg bg-zinc-900 border border-zinc-800 p-1">
        <button
          onClick={() => { setDriverTab('otp'); setErrors({}); }}
          className={cn(
            'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
            driverTab === 'otp'
              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          )}
        >
          Enter Code
        </button>
        <button
          onClick={() => { setDriverTab('password'); setErrors({}); }}
          className={cn(
            'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
            driverTab === 'password'
              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          )}
        >
          Password
        </button>
      </div>

      {/* OTP tab */}
      {driverTab === 'otp' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="driver-otp-identifier" className="text-zinc-300">
              Email or Phone Number
            </Label>
            <div className="relative">
              {isPhoneInput(otpEmail) ? (
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              ) : (
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              )}
              <Input
                id="driver-otp-identifier"
                type="text"
                placeholder="email@example.com or +234 800 000 0000"
                value={otpEmail}
                onChange={(e) => { setOtpEmail(e.target.value); if (errors.email) setErrors({}); }}
                className={cn(
                  'h-12 pl-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-cyan-500 focus:ring-cyan-500/20',
                  errors.email && 'border-red-500'
                )}
              />
            </div>
            {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Onboarding Code</Label>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otpValue} onChange={(value) => setOtpValue(value)}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="w-12 h-12 text-lg bg-zinc-900 border-zinc-800 text-white" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <Button
            onClick={handleOtpVerify}
            disabled={loading || otpValue.length !== 6 || !otpEmail}
            className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium disabled:opacity-50"
          >
            {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Registering...</> : <>Register Device<ArrowRight className="w-5 h-5 ml-2" /></>}
          </Button>

          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-300">
              <strong>First time?</strong> Enter the 6-digit onboarding code provided by your dispatcher.
            </p>
          </div>
        </div>
      )}

      {/* Password tab */}
      {driverTab === 'password' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="driver-pw-identifier" className="text-zinc-300">
              Phone Number or Email
            </Label>
            <div className="relative">
              {isPhoneInput(driverIdentifier) ? (
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              ) : (
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              )}
              <Input
                id="driver-pw-identifier"
                type="text"
                placeholder="+234 800 000 0000 or email@example.com"
                value={driverIdentifier}
                onChange={(e) => { setDriverIdentifier(e.target.value); if (errors.identifier) setErrors({}); }}
                className={cn(
                  'h-12 pl-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-cyan-500 focus:ring-cyan-500/20',
                  errors.identifier && 'border-red-500'
                )}
              />
            </div>
            {errors.identifier && <p className="text-sm text-red-400">{errors.identifier}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="driver-pw-password" className="text-zinc-300">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <Input
                id="driver-pw-password"
                type={showDriverPassword ? 'text' : 'password'}
                placeholder="Your password"
                value={driverPassword}
                onChange={(e) => { setDriverPassword(e.target.value); if (errors.driverPassword) setErrors({}); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleDriverPasswordLogin(); }}
                className={cn(
                  'h-12 pl-11 pr-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-cyan-500 focus:ring-cyan-500/20',
                  errors.driverPassword && 'border-red-500'
                )}
              />
              <button
                type="button"
                onClick={() => setShowDriverPassword(!showDriverPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showDriverPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.driverPassword && <p className="text-sm text-red-400">{errors.driverPassword}</p>}
          </div>

          <Button
            onClick={handleDriverPasswordLogin}
            disabled={loading || !driverIdentifier || !driverPassword}
            className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium disabled:opacity-50"
          >
            {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Signing in...</> : <>Sign In<ArrowRight className="w-5 h-5 ml-2" /></>}
          </Button>

          <p className="text-center text-sm text-zinc-500">
            No password yet?{' '}
            <button
              type="button"
              onClick={async () => {
                if (!driverIdentifier) {
                  setErrors({ identifier: 'Enter your email or phone number first' });
                  return;
                }
                let email = driverIdentifier.trim();
                if (isPhoneInput(email)) {
                  const { data } = await supabase.rpc('lookup_driver_email', { p_identifier: email });
                  if (!data) { setErrors({ identifier: 'No account found for this phone number.' }); return; }
                  email = data as string;
                }
                await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback` });
                toast.success('Password reset email sent', { description: `Check ${email} for a reset link.` });
              }}
              className="text-cyan-400 hover:text-cyan-300 font-medium"
            >
              Set a password
            </button>
          </p>
        </div>
      )}
    </div>
  );

  // Render current step
  const renderStep = () => {
    // Driver PWA onboarding — single email + OTP form
    if (isLoginRoute && mode === 'otp-login') {
      return renderDriverOnboarding();
    }

    if (mode === 'login') {
      return renderLogin();
    }

    if (mode === 'forgot-password') {
      return renderForgotPassword();
    }

    if (mode === 'reset-password') {
      return renderResetPassword();
    }

    if (mode === 'otp-login') {
      return otpStep === 'email' ? renderOtpEmailStep() : renderOtpVerifyStep();
    }

    switch (step) {
      case 'credentials':
        return renderCredentialsStep();
      case 'profile':
        return renderProfileStep();
      case 'complete':
        return renderComplete();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-[480px] min-h-screen flex flex-col p-8 relative overflow-hidden">
        <GradientOrb />

        <div className="relative z-10 flex-1 flex flex-col">
          {/* Logo */}
          <RouteServeLogo className="mb-12" />

          {/* Form Content */}
          <div className="flex-1 flex items-center">
            <div className="w-full max-w-sm mx-auto lg:mx-0">{renderStep()}</div>
          </div>

          {/* Footer */}
          <div className="mt-8">
            <div className="h-1 w-32 rounded-full bg-gradient-to-r from-zinc-800 to-transparent" />
          </div>
        </div>
      </div>

      {/* Right Panel - Preview (Desktop only) */}
      <div className="hidden lg:flex flex-1 bg-zinc-900/50 border-l border-zinc-800 items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-lg">
          {/* Preview Card */}
          <div className="rounded-2xl bg-zinc-900/80 backdrop-blur border border-zinc-800 overflow-hidden">
            {/* Header with gradient */}
            <div className="h-32 bg-gradient-to-br from-purple-500/60 via-pink-500/60 to-orange-400/60 relative">
              <div className="absolute -bottom-8 left-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-500 border-4 border-zinc-900" />
              </div>
            </div>

            {/* Content */}
            <div className="p-6 pt-12 space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {formData.fullName || 'Your Name'}
                </h3>
                <p className="text-zinc-500">{formData.email || 'your@email.com'}</p>
              </div>


              {/* Feature highlights */}
              <div className="pt-4 border-t border-zinc-800 space-y-3">
                <p className="text-sm text-zinc-500">What you can do with RouteServe:</p>
                <div className="grid grid-cols-2 gap-2">
                  {['Fleet Management', 'Route Planning', 'Driver Tracking', 'Analytics'].map((feature) => (
                    <div
                      key={feature}
                      className="px-3 py-2 rounded-lg bg-zinc-800/50 text-xs text-zinc-300"
                    >
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-center text-zinc-500 mt-8">
            Integrated Operations Platform for modern logistics
          </p>
        </div>
      </div>
    </div>
  );
}
