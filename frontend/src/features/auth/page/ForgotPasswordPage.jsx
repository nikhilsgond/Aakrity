// src/features/auth/page/ForgotPasswordPage.jsx
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import ThemeToggle from '@shared/ui/ThemeToggle';
import { useAuth } from '@features/auth/context/AuthProvider';
import { validateEmail } from '@shared/lib/inputValidation';
import { 
  ArrowLeft, 
  PenTool, 
  Mail, 
  Loader2,
  Home,
  Phone
} from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1];
const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: EASE },
});

const ForgotPasswordPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(location.state?.message || '');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const normalizedEmail = email.trim();
      await sendPasswordReset(normalizedEmail);

      toast.success('Password reset OTP sent. Check your email.');

      navigate('/verify-otp', {
        replace: true,
        state: {
          email: normalizedEmail,
          type: 'recovery',
          nextPath: '/update-password',
          heading: 'Verify reset code',
          description: 'Enter the OTP from your password reset email to continue.',
        },
      });
    } catch {
      setError('If the email exists, a reset code has been sent.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-300">
      <ThemeToggle />

      <header className="py-5 px-6 border-b border-border/50">
        <Link to="/" className="inline-flex items-center space-x-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <PenTool className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-black tracking-tight">Aakrity</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="p-10 rounded-3xl border border-border bg-card shadow-2xl">
            <motion.div {...fade(0.15)} className="mb-8">
              <Link 
                to="/login" 
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                Back to Sign In
              </Link>
              <h1 className="text-3xl font-black tracking-tight mb-2">Forgot password?</h1>
              <p className="text-muted-foreground text-sm">
                Enter your email and we&apos;ll send a password reset OTP.
              </p>
            </motion.div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm"
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <motion.div {...fade(0.25)}>
                <label className="block text-sm font-medium mb-2">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    autoComplete='email'
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError('');
                    }}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/25 transition placeholder-muted-foreground text-sm"
                  />
                </div>
              </motion.div>
              <motion.div {...fade(0.32)} className="min-h-[48px]">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] py-3 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 btn-metallic"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset OTP'
                  )}
                </button>
              </motion.div>
            </form>
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

export default ForgotPasswordPage;