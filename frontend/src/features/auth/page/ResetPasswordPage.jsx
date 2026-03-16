// src/features/auth/page/ResetPasswordPage.jsx
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import ThemeToggle from '@shared/ui/ThemeToggle';
import { useAuth } from '@features/auth/context/AuthProvider';
import { containsUnsafeText } from '@shared/lib/inputValidation';
import { 
  PenTool, 
  Lock, 
  Loader2, 
  Check, 
  Eye,
  EyeOff,
  Home,
  Phone,
  Shield,
  Key
} from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1];
const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: EASE },
});

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { updatePassword, isAuthenticated, isLoading } = useAuth();

  const [form, setForm] = useState({
    password: '',
    confirm: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(location.state?.message || '');

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate('/forgot-password', {
        replace: true,
        state: {
          message: 'Verify your reset OTP before setting a new password.',
        },
      });
    }
  }, [isAuthenticated, isLoading, navigate]);
  
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setError('');

    if (!form.password || !form.confirm) {
      setError('Please fill in both password fields.');
      return;
    }

    if (
      containsUnsafeText(form.password) ||
      containsUnsafeText(form.confirm)
    ) {
      setError('Password must be plain text only.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      await updatePassword(form.password);

      toast.success('Password updated successfully.');

      navigate('/dashboard', { replace: true });
    } catch {
      setError('Failed to update password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const passwordStrength = () => {
    const pass = form.password;
    if (!pass) return 0;
    if (pass.length < 6) return 1;
    if (pass.length < 8) return 2;
    if (/[A-Z]/.test(pass) && /[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) return 4;
    if (/[A-Z]/.test(pass) || /[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) return 3;
    return 2;
  };

  const strengthLabels = ['Too short', 'Weak', 'Good', 'Strong', 'Very strong'];
  const strengthColors = ['bg-destructive', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];

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
                to="/forgot-password" 
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
              >
                <Key className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                Back to reset options
              </Link>
              <h1 className="text-3xl font-black tracking-tight mb-2 flex items-center gap-2">
                <Shield className="w-8 h-8 text-primary" />
                Set a new password
              </h1>
              <p className="text-muted-foreground text-sm">
                Enter a new password for your account.
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
                <label className="block text-sm font-medium mb-2">
                  New password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="At least 6 characters"
                    className="w-full pl-9 pr-10 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/25 transition text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password strength indicator */}
                {form.password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1 h-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`flex-1 rounded-full transition-colors ${
                            level <= passwordStrength()
                              ? strengthColors[passwordStrength() - 1]
                              : 'bg-border'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${
                      passwordStrength() >= 3 ? 'text-green-500' : 'text-muted-foreground'
                    }`}>
                      {strengthLabels[passwordStrength() - 1] || 'Enter password'}
                    </p>
                  </div>
                )}
              </motion.div>

              <motion.div {...fade(0.32)}>
                <label className="block text-sm font-medium mb-2">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        confirm: event.target.value,
                      }))
                    }
                    placeholder="Repeat your password"
                    className="w-full pl-9 pr-10 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/25 transition text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password match indicator */}
                {form.confirm && (
                  <div className="mt-2 flex items-center gap-1">
                    {form.password === form.confirm ? (
                      <>
                        <Check className="w-3 h-3 text-green-500" />
                        <span className="text-xs text-green-500">Passwords match</span>
                      </>
                    ) : (
                      <span className="text-xs text-destructive">Passwords do not match</span>
                    )}
                  </div>
                )}
              </motion.div>

              <motion.div {...fade(0.38)} className="min-h-[48px] pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[48px] py-3 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 btn-metallic"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </motion.div>

              <motion.div {...fade(0.42)} className="mt-6 rounded-2xl border border-border bg-background/70 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Password requirements</p>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 ${form.password.length >= 6 ? 'text-green-500' : 'text-muted-foreground'}`} />
                    At least 6 characters
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 ${/[A-Z]/.test(form.password) ? 'text-green-500' : 'text-muted-foreground'}`} />
                    At least one uppercase letter
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3 h-3 ${/[0-9]/.test(form.password) ? 'text-green-500' : 'text-muted-foreground'}`} />
                    At least one number
                  </li>
                </ul>
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
}