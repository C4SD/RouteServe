// MOD4 Login Screen
// PIN-based auth for returning drivers, activation entry for new drivers

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  KeyRound,
  UserPlus,
  ChevronRight,
  Smartphone,
  Mail,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import {
  useAuthStore,
  getLinkedEmail,
  clearLinkedEmail,
  maskEmail,
} from '@/stores/authStore';

type LoginMode = 'default' | 'email';

export default function Login() {
  const linkedEmail = getLinkedEmail();
  const [mode, setMode] = useState<LoginMode>('default');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { loginWithPIN, login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handlePinLogin = async () => {
    if (pin.length !== 4) return;
    setError('');

    const result = await loginWithPIN(pin);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Invalid PIN');
      setPin('');
    }
  };

  const handleSwitchAccount = () => {
    clearLinkedEmail();
    // Force re-render by navigating to same page
    window.location.reload();
  };

  const handleEmailPasswordLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    setError('');

    const result = await login(email, password);
    if (result.success) {
      // Store the email for future PIN logins
      localStorage.setItem('mod4_linked_email', email);
      navigate('/');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden safe-top safe-bottom">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-50 via-yellow-50 to-white dark:from-amber-950/20 dark:via-yellow-950/10 dark:to-background" />

      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.02] dark:opacity-[0.03]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="px-6 pb-8"
        >
          <div className="max-w-sm mx-auto space-y-6">
            {/* App Title */}
            <div className="text-center space-y-2 mb-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <Smartphone className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground tracking-tight">
                MOD4 Driver Access
              </h1>
              <p className="text-sm text-gray-600 dark:text-muted-foreground">
                {linkedEmail
                  ? 'Enter your PIN to sign in'
                  : 'Activate your account or request access to get started.'}
              </p>
            </div>

            {linkedEmail ? (
              /* ============ RETURNING DRIVER: PIN LOGIN ============ */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="space-y-6"
              >
                {/* Masked email */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Signed in as</p>
                  <p className="font-medium">{maskEmail(linkedEmail)}</p>
                </div>

                {/* PIN input */}
                <div className="flex flex-col items-center space-y-4">
                  <InputOTP
                    maxLength={4}
                    pattern={REGEXP_ONLY_DIGITS}
                    value={pin}
                    onChange={(v) => { setPin(v); setError(''); }}
                    onComplete={handlePinLogin}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="w-14 h-14 text-xl" />
                      <InputOTPSlot index={1} className="w-14 h-14 text-xl" />
                      <InputOTPSlot index={2} className="w-14 h-14 text-xl" />
                      <InputOTPSlot index={3} className="w-14 h-14 text-xl" />
                    </InputOTPGroup>
                  </InputOTP>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-destructive"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>

                {/* Sign In button */}
                <Button
                  onClick={handlePinLogin}
                  disabled={pin.length !== 4 || isLoading}
                  className="w-full h-14 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-semibold text-base rounded-full shadow-lg shadow-amber-500/30 transition-all duration-200"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                {/* Switch account */}
                <button
                  onClick={handleSwitchAccount}
                  className="w-full py-2 text-center text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Not you? Use a different account
                </button>
              </motion.div>
            ) : mode === 'email' ? (
              /* ============ EMAIL/PASSWORD LOGIN ============ */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                <button
                  onClick={() => { setMode('default'); setError(''); }}
                  className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors mb-2"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </button>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="driver-email" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                      Email
                    </label>
                    <Input
                      id="driver-email"
                      name="email"
                      type="email"
                      placeholder="driver@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      className="h-12"
                    />
                  </div>

                  <div>
                    <label htmlFor="driver-pin" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                      Your 4-digit PIN
                    </label>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={4}
                        pattern={REGEXP_ONLY_DIGITS}
                        value={password}
                        onChange={(v) => { setPassword(v); setError(''); }}
                        onComplete={() => { if (email) handleEmailPasswordLogin(); }}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} className="w-14 h-14 text-xl" />
                          <InputOTPSlot index={1} className="w-14 h-14 text-xl" />
                          <InputOTPSlot index={2} className="w-14 h-14 text-xl" />
                          <InputOTPSlot index={3} className="w-14 h-14 text-xl" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-destructive"
                  >
                    {error}
                  </motion.p>
                )}

                <Button
                  onClick={handleEmailPasswordLogin}
                  disabled={!email || password.length !== 4 || isLoading}
                  className="w-full h-14 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-semibold text-base rounded-full shadow-lg shadow-amber-500/30 transition-all duration-200"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </motion.div>
            ) : (
              /* ============ DEFAULT: ACTIVATE / REQUEST / EMAIL LOGIN ============ */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="space-y-4"
              >
                {/* Activate Account */}
                <Button
                  onClick={() => navigate('/activate')}
                  className="w-full h-14 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-semibold text-base rounded-full shadow-lg shadow-amber-500/30 transition-all duration-200 hover:shadow-xl"
                >
                  <KeyRound className="w-5 h-5 mr-2" />
                  Activate Account
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>

                <div className="relative flex items-center py-2">
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                  <span className="px-3 text-xs text-muted-foreground">or</span>
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                </div>

                {/* Request Access */}
                <Button
                  onClick={() => navigate('/request-access')}
                  variant="outline"
                  className="w-full h-14 font-semibold text-base rounded-full border-2"
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  Request Access
                </Button>

                <div className="relative flex items-center py-2">
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                  <span className="px-3 text-xs text-muted-foreground">or</span>
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                </div>

                {/* Sign in with Email */}
                <Button
                  onClick={() => setMode('email')}
                  variant="outline"
                  className="w-full h-14 font-semibold text-base rounded-full border-2"
                >
                  <Mail className="w-5 h-5 mr-2" />
                  Sign in with Email &amp; PIN
                </Button>

                <p className="text-center text-xs text-gray-500 dark:text-muted-foreground pt-2">
                  Have an activation code? Tap <strong>Activate Account</strong>.
                  <br />
                  New driver? Tap <strong>Request Access</strong> and your admin will set you up.
                  <br />
                  Already onboarded? Tap <strong>Sign in with Email &amp; PIN</strong>.
                </p>
              </motion.div>
            )}

            {/* Footer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center text-xs text-gray-400 dark:text-muted-foreground mt-8"
            >
              Offline-first &middot; Event-sourced &middot; Field-ready
            </motion.p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
