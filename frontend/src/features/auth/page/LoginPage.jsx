// src/features/auth/page/LoginPage.jsx
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import ThemeToggle from '@shared/ui/ThemeToggle';
import { useAuth } from '@features/auth/context/AuthProvider';
import { containsUnsafeText, validateEmail } from '@shared/lib/inputValidation';
import { 
  PenTool, 
  Mail, 
  Lock, 
  Loader2, 
  Check, 
  Sparkles,
  Users,
  History,
  MessageSquare,
  Layout,
  ArrowRight,
  Home,
  Phone
} from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1];
const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: EASE },
});

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithPassword, signInWithOtp, signInWithGoogle } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const redirectTo = location.state?.from?.pathname || '/dashboard';

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const emailError = validateEmail(form.email);
    if (emailError) {
      setError(emailError);
      return;
    }

    if (!form.password) {
      setError('Password is required.');
      return;
    }

    if (containsUnsafeText(form.password)) {
      setError('Password must be plain text only.');
      return;
    }

    setLoading(true);

    try {
      await signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const emailError = validateEmail(form.email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setError('');
    setOtpLoading(true);

    try {
      const email = form.email.trim();
      await signInWithOtp(email, { shouldCreateUser: false });
      toast.success('OTP sent. Check your email inbox.');
      navigate('/verify-otp', {
        state: {
          email,
          type: 'email',
          nextPath: redirectTo,
          heading: 'Check your inbox',
          description: 'Enter the one-time code sent to your email to finish signing in.',
        },
      });
    } catch (otpError) {
      setError(otpError.message || 'Failed to send OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');

    try {
      await signInWithGoogle();
    } catch (googleError) {
      setError(googleError.message || 'Google sign-in is not ready yet.');
    }
  };

  const features = [
    { icon: Users, text: 'Real-time multiplayer drawing' },
    { icon: History, text: 'Persistent rooms with history' },
    { icon: Mail, text: 'Password or email OTP sign-in' },
    { icon: MessageSquare, text: 'End-to-end encrypted chat' },
    { icon: Layout, text: 'Smart guides & object locking' }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-300">
      <ThemeToggle />

      <header className="py-5 px-6 border-b border-border/50">
        <Link to="/" className="inline-flex items-center space-x-3 group">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <PenTool className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-black tracking-tight">Aakrity</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          className="w-full max-w-4xl"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="grid md:grid-cols-2 rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
            {/* Left Panel - Branding */}
            <div className="hidden md:flex flex-col justify-between p-10 bg-primary text-primary-foreground relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-primary-foreground/5 blur-3xl" />
                <div className="absolute -bottom-10 -right-10 w-60 h-60 rounded-full bg-primary-foreground/5 blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 rounded-full bg-primary-foreground/3 blur-2xl" />
              </div>

              <motion.div {...fade(0.15)} className="flex items-center space-x-3 relative z-10">
                <div className="w-9 h-9 bg-primary-foreground/15 rounded-xl border border-primary-foreground/20 flex items-center justify-center">
                  <PenTool className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
                </div>
                <span className="text-xl font-black tracking-tight">Aakrity</span>
              </motion.div>

              <div className="relative z-10">
                <motion.h2 {...fade(0.22)} className="text-3xl font-black leading-tight mb-4">
                  Where ideas take<br />shape together
                </motion.h2>
                <motion.p {...fade(0.28)} className="text-primary-foreground/60 text-sm leading-relaxed">
                  A collaborative canvas for teams, creators, and dreamers.
                  Sign in to continue your journey.
                </motion.p>
                <div className="mt-8 space-y-3">
                  {features.map((feature, index) => (
                    <motion.div
                      key={feature.text}
                      {...fade(0.34 + index * 0.07)}
                      className="flex items-center gap-3 text-sm text-primary-foreground/85"
                    >
                      <span className="w-5 h-5 rounded-full bg-primary-foreground/15 border border-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                      </span>
                      {feature.text}
                    </motion.div>
                  ))}
                </div>
              </div>

              <motion.p {...fade(0.65)} className="text-xs text-primary-foreground/30 relative z-10">
                Free for individuals · Open source
              </motion.p>
            </div>

            {/* Right Panel - Login Form */}
            <div className="p-8 md:p-10">
              <motion.div {...fade(0.18)} className="mb-8">
                <h1 className="text-3xl font-black tracking-tight mb-2">Welcome back</h1>
                <p className="text-muted-foreground text-sm">Sign in to your Aakrity account</p>
              </motion.div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                >
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <motion.div {...fade(0.26)}>
                  <label className="block text-sm font-medium mb-2">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/25 transition placeholder-muted-foreground text-sm"
                    />
                  </div>
                </motion.div>

                <motion.div {...fade(0.32)}>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Enter your password"
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/25 transition placeholder-muted-foreground text-sm"
                    />
                  </div>
                </motion.div>

                <motion.div {...fade(0.37)} className="flex justify-between items-center gap-3">
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
                  >
                    <Lock className="w-3 h-3" />
                    Forgot password?
                  </Link>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpLoading}
                    className="text-sm font-medium text-primary hover:underline disabled:opacity-60 min-h-[24px] inline-flex items-center gap-1"
                  >
                    {otpLoading ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Email OTP
                        <ArrowRight className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </motion.div>

                <motion.div {...fade(0.42)} className="min-h-[48px]">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[48px] py-3 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 btn-metallic"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </motion.div>
              </form>

              <motion.div {...fade(0.48)} className="mt-6 rounded-2xl border border-border bg-background/70 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Email OTP</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Get a one-time code sent to your inbox. No password needed.
                </p>
              </motion.div>

              <motion.p {...fade(0.52)} className="mt-7 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link to="/register" className="text-foreground font-semibold hover:underline inline-flex items-center gap-1 group">
                  Create one free
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </motion.p>

              <motion.div {...fade(0.56)} className="mt-7 flex items-center gap-4">
                <div className="flex-1 h-px bg-border"></div>
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border"></div>
              </motion.div>

              <motion.div {...fade(0.6)} className="min-h-[48px]">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="mt-5 w-full min-h-[48px] py-3 text-sm font-medium border border-border rounded-xl hover:bg-muted transition flex items-center justify-center gap-3"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M47.532 24.552c0-1.636-.146-3.2-.418-4.698H24v9.01h13.192c-.58 3.016-2.29 5.57-4.858 7.28v6.04h7.858c4.6-4.236 7.34-10.48 7.34-17.632z" fill="#4285F4" />
                    <path d="M24 48c6.48 0 11.916-2.146 15.89-5.816l-7.858-6.04c-2.146 1.434-4.892 2.286-8.032 2.286-6.178 0-11.41-4.17-13.27-9.774H2.62v6.23C6.578 42.694 14.718 48 24 48z" fill="#34A853" />
                    <path d="M10.73 28.656A14.474 14.474 0 0 1 9.99 24c0-1.618.278-3.19.74-4.656v-6.23H2.62A23.92 23.92 0 0 0 0 24c0 3.866.924 7.52 2.62 10.886l8.11-6.23z" fill="#FBBC05" />
                    <path d="M24 9.568c3.48 0 6.604 1.198 9.066 3.548l6.798-6.798C35.908 2.376 30.48 0 24 0 14.718 0 6.578 5.306 2.62 13.114l8.11 6.23C12.59 13.738 17.822 9.568 24 9.568z" fill="#EA4335" />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border/50 flex items-center justify-center gap-3">
        <span>© {new Date().getFullYear()} Aakrity</span>
        <span className="w-1 h-1 rounded-full bg-border/50"></span>
        <Link to="/" className="hover:text-foreground transition-colors inline-flex items-center gap-1">
          <Home className="w-3 h-3" />
          Home
        </Link>
        <span className="w-1 h-1 rounded-full bg-border/50"></span>
        <Link to="/contact" className="hover:text-foreground transition-colors inline-flex items-center gap-1">
          <Phone className="w-3 h-3" />
          Contact
        </Link>
      </footer>
    </div>
  );
};

export default LoginPage;