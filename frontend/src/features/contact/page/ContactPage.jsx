import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Mail,
  Github,
  Database,
  ChevronDown,
  Send,
  Loader2,
  Sparkles
} from 'lucide-react';
import ThemeToggle from '@shared/ui/ThemeToggle';
import Navigation from '@features/home/components/Navigation';
import { apiRequest } from '@shared/lib/apiClient';
import {
  validateEmail,
  validatePlainText,
} from '@shared/lib/inputValidation';

// Add message validation helper
const validateMessageText = (value, options = {}) => {
  return validatePlainText(value, {
    label: options.label || 'Message',
    minLength: options.minLength || 10,
    maxLength: options.maxLength || 5000,
    pattern: options.pattern,
  });
};

const faqs = [
  { q: 'Is Aakrity free to use?', a: 'Yes. The current app is free to explore and collaborate with.' },
  { q: 'Do I need an account to collaborate?', a: 'Yes. Shared rooms use Supabase Auth so each collaborator has a real account.' },
  { q: 'Does it support mobile?', a: 'The UI is responsive, though the canvas experience is strongest on desktop.' },
  { q: 'How many people can join a room?', a: 'Each room owner chooses a member limit when the room is created.' },
];

const ContactPage = () => {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nameError = validatePlainText(form.name, {
      label: 'Name',
      minLength: 2,
      maxLength: 120,
      pattern: /^[a-zA-Z0-9 .,'-]+$/,
    });
    const emailError = validateEmail(form.email);
    const subjectError = form.subject
      ? validatePlainText(form.subject, {
        label: 'Subject',
        required: false,
        minLength: 2,
        maxLength: 200,
      })
      : null;
    const messageError = validateMessageText(form.message, {
      label: 'Message',
      minLength: 10,
      maxLength: 5000,
    });

    const firstError = nameError || emailError || subjectError || messageError;
    if (firstError) {
      toast.error(firstError);
      return;
    }

    setLoading(true);

    try {
      // Check online status
      if (!navigator.onLine) {
        throw new Error('You are offline. Please check your internet connection.');
      }

      await apiRequest('/api/contact', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject.trim() || null,
          message: form.message.trim(),
        },
      });

      toast.success('Message stored successfully.');
      setSent(true);
    } catch (error) {
      // Handle different error types
      if (error.status === 429) {
        toast.error('Too many messages. Please wait a while before trying again.');
      } else if (!navigator.onLine) {
        toast.error('You are offline. Please check your internet connection.');
      } else {
        toast.error(error.message || 'Failed to store your message. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-300">
      <ThemeToggle />
      <Navigation />

      <main className="flex-1 pt-24">
        <section className="py-20 px-4 text-center border-b border-border/40 bg-muted/20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 bg-background text-sm text-muted-foreground mb-6">
            <Mail className="w-3.5 h-3.5" />
            Get in touch
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tighter mb-4">
            Let&apos;s <span className="gradient-text">Connect</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Found a bug, have a feature idea, or want to leave feedback? Your message will be stored securely for review.
          </p>
        </section>

        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-10 items-start">
            <div className="lg:col-span-2 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">Contact Info</p>

              {[
                { icon: Mail, label: 'Email', value: 'nikhilsgond@gmail.com', href: 'mailto:nikhilsgond@gmail.com' },
                { icon: Github, label: 'GitHub', value: 'github.com/nikhilsgond', href: 'https://github.com/nikhilsgond', external: true },
              ].map(({ icon: Icon, label, value, href, external }) => (
                <div key={label} className="rounded-2xl border border-border bg-card px-5 py-4 flex items-center gap-4 hover:border-primary/40 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
                    {href ? (
                      <a
                        href={href}
                        target={external ? '_blank' : undefined}
                        rel={external ? 'noopener noreferrer' : undefined}
                        className="text-sm font-medium hover:text-primary transition-colors truncate block"
                      >
                        {value}
                      </a>
                    ) : (
                      <span className="text-sm font-medium">{value}</span>
                    )}
                  </div>
                </div>
              ))}

              <div className="pt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">FAQ</p>
                <div className="space-y-2">
                  {faqs.map((faq, index) => (
                    <div key={faq.q} className="rounded-xl border border-border bg-card overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
                        onClick={() => setOpenFaq(openFaq === index ? null : index)}
                        aria-expanded={openFaq === index}
                        aria-controls={`faq-answer-${index}`}
                      >
                        <span>{faq.q}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${openFaq === index ? 'rotate-180' : ''
                            }`}
                        />
                      </button>
                      {openFaq === index && (
                        <div id={`faq-answer-${index}`} className="px-4 pb-4 text-sm text-muted-foreground border-t border-border/40 pt-3">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="rounded-3xl border border-border bg-card p-8 shadow-xl">
                {sent ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center">
                      <Database className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-xl font-bold">Message stored</h3>
                    <p className="text-muted-foreground text-sm max-w-xs">
                      Your message has been saved and can be reviewed later from the database dashboard.
                    </p>
                    <button
                      onClick={() => {
                        setSent(false);
                        setForm({ name: '', email: '', subject: '', message: '' });
                      }}
                      className="mt-2 px-5 py-2 text-sm border border-border rounded-full hover:bg-muted transition-colors"
                    >
                      Send another
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-6">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-bold">Send a message</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            Name <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder="Your name"
                            className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 transition placeholder-muted-foreground text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            Email <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            placeholder="you@example.com"
                            className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 transition placeholder-muted-foreground text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Subject</label>
                        <input
                          type="text"
                          name="subject"
                          value={form.subject}
                          onChange={handleChange}
                          placeholder="What's this about?"
                          className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 transition placeholder-muted-foreground text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Message <span className="text-destructive">*</span>
                        </label>
                        <textarea
                          name="message"
                          value={form.message}
                          onChange={handleChange}
                          rows={6}
                          placeholder="Write your message here..."
                          className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 transition placeholder-muted-foreground text-sm resize-none"
                        />
                        <div className="flex justify-end mt-1">
                          <span className="text-xs text-muted-foreground">{form.message.length} chars</span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full min-h-[48px] py-3 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 btn-metallic"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Store Message</span>
                          </>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border/50">
        (c) {new Date().getFullYear()} Aakrity ·{' '}
        <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
        {' '}·{' '}
        <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
      </footer>
    </div>
  );
};

export default ContactPage;