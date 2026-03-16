// src/features/auth/page/VerifyOtpPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ThemeToggle from '@shared/ui/ThemeToggle';
import { useAuth } from '@features/auth/context/AuthProvider';
import { validateEmail } from '@shared/lib/inputValidation';
import { 
  PenTool, 
  Mail, 
  Loader2,
  ArrowLeft,
  Home,
  Phone
} from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1];
const OTP_LENGTH = 8;

const createEmptyOtp = () => Array.from({ length: OTP_LENGTH }, () => '');

export default function VerifyOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyOtp, resendOtp } = useAuth();

  const defaults = useMemo(
    () => ({
      email: location.state?.email || '',
      type: location.state?.type || 'email',
      nextPath: location.state?.nextPath || '/dashboard',
      heading: location.state?.heading || 'Verify OTP',
      description:
        location.state?.description ||
        'Enter the OTP sent to your email address.',
    }),
    [location.state]
  );

  const [form, setForm] = useState({
    email: defaults.email,
    code: createEmptyOtp(),
  });

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(
    defaults.email ? 30 : 0
  );

  useEffect(() => {
    if (resendCooldown <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleOtpChange = (value, index) => {
    if (!/^[0-9]?$/.test(value)) return;

    const updated = [...form.code];
    updated[index] = value;

    setForm((c) => ({ ...c, code: updated }));

    if (value && index < OTP_LENGTH - 1) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (event, index) => {
    if (event.key === 'Backspace' && !form.code[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handlePaste = (event) => {
    const paste = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!paste) return;

    const digits = paste.slice(0, OTP_LENGTH).split('');
    const updated = createEmptyOtp();

    digits.forEach((d, i) => {
      updated[i] = d;
    });

    setForm((c) => ({ ...c, code: updated }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    const emailError = validateEmail(form.email);
    const code = form.code.join('');

    if (emailError) {
      setError(emailError);
      return;
    }

    if (code.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH} digit OTP.`);
      return;
    }

    setLoading(true);

    try {
      await verifyOtp({
        email: form.email.trim(),
        token: code,
        type: defaults.type,
      });

      navigate(defaults.nextPath, { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice('');

    const emailError = validateEmail(form.email);

    if (emailError) {
      setError(emailError);
      return;
    }

    setResending(true);

    try {
      await resendOtp({
        email: form.email.trim(),
        type: defaults.type,
      });

      setForm((current) => ({
        ...current,
        code: createEmptyOtp(),
      }));
      setResendCooldown(30);
      setNotice(
        defaults.type === 'recovery'
          ? 'A new reset code has been sent to your email.'
          : 'A new verification code has been sent to your email.'
      );
    } catch (resendError) {
      setError(resendError.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-300">
      <ThemeToggle />

      <header className="py-5 px-6 border-b border-border/50">
        <Link to="/" className="inline-flex items-center space-x-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <PenTool className="w-4 h-4 text-primary-foreground" />
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
          <div className="rounded-3xl border border-border bg-card shadow-2xl px-6 py-10">
            <div className="mb-8 flex items-start gap-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="min-w-0">
                <h1 className="text-3xl font-black tracking-tight mb-2">
                  {defaults.heading}
                </h1>

                <p className="text-muted-foreground text-sm">
                  {defaults.description}
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            {notice && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
                {notice}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    readOnly
                    autoComplete="email"
                    value={form.email}
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed text-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div onPaste={handlePaste}>
                <label className="block text-sm font-medium mb-3">
                  OTP code
                </label>

                <div className="flex gap-3 justify-between">
                  {form.code.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) =>
                        handleOtpChange(e.target.value, index)
                      }
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className="w-12 h-12 text-center text-lg font-semibold rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/25 transition"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition disabled:opacity-60 min-h-[48px] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify OTP'
                )}
              </button>

              <div className="flex flex-col items-center gap-3 text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || resendCooldown > 0}
                  className="text-sm font-medium text-foreground hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {resending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending new code...
                    </>
                  ) : resendCooldown > 0 ? (
                    `Resend OTP in ${resendCooldown}s`
                  ) : (
                    'Resend OTP'
                  )}
                </button>
              </div>
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
