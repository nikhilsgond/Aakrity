// src/features/auth/context/AuthProvider.jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { AUTH_REDIRECT_URL, PASSWORD_RESET_URL } from '@shared/lib/config';
import { apiRequest } from '@shared/lib/apiClient';
import { supabase } from '@shared/lib/supabaseClient';

const AuthContext = createContext(null);

const getDisplayName = (user, profile) => {
  return (
    profile?.name ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Anonymous'
  );
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);

  const syncProfile = async (activeSession) => {
    if (!activeSession?.access_token) {
      setProfile(null);
      return null;
    }

    setIsSyncingProfile(true);

    try {
      const payload = await apiRequest('/api/auth/me', {
        token: activeSession.access_token,
      });

      if (!payload) return null;

      setProfile(payload.profile || null);
      return payload.profile || null;
    } catch (error) {
      console.error('Failed to sync profile:', error);
      return null;
    } finally {
      setIsSyncingProfile(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }

        if (!isMounted) {
          return;
        }

        setSession(data.session || null);
        await syncProfile(data.session || null);
      } catch (error) {
        console.error('Failed to bootstrap auth session:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession || null);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        return;
      }

      await syncProfile(nextSession || null);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const authValue = useMemo(() => {
    const user = session?.user || null;

    return {
      session,
      user,
      profile,
      isAuthenticated: !!user,
      isLoading,
      isSyncingProfile,
      displayName: getDisplayName(user, profile),
      async signInWithPassword({ email, password }) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw error;
        }
      },
      async signUp({ email, password, displayName }) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: AUTH_REDIRECT_URL,
            data: {
              name: displayName,
              display_name: displayName,
            },
          },
        });

        if (error) {
          throw error;
        }

        return data;
      },
      async signInWithOtp(email, options = {}) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: options.shouldCreateUser ?? false,
            emailRedirectTo: AUTH_REDIRECT_URL,
          },
          type: 'email'
        });

        if (error) {
          throw error;
        }
      },
      async verifyOtp({ email, token, type = 'email' }) {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token,
          type,
        });

        if (error) {
          throw error;
        }
      },
      async resendOtp({ email, type = 'email' }) {
        if (type === 'signup') {
          const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: {
              emailRedirectTo: AUTH_REDIRECT_URL,
            },
          });

          if (error) {
            throw error;
          }

          return;
        }

        if (type === 'recovery') {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: PASSWORD_RESET_URL,
          });

          if (error) {
            throw error;
          }

          return;
        }

        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: AUTH_REDIRECT_URL,
          },
        });

        if (error) {
          throw error;
        }
      },
      async signInWithGoogle() {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: AUTH_REDIRECT_URL,
          },
        });

        if (error) {
          throw error;
        }
      },
      async sendPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: PASSWORD_RESET_URL,
        });

        if (error) {
          throw error;
        }
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          throw error;
        }
      },
      async uploadProfileAvatar(dataUrl) {
        if (!session?.access_token) {
          throw new Error('You must be signed in to upload an avatar.');
        }

        const payload = await apiRequest('/api/profile/avatar', {
          method: 'POST',
          token: session.access_token,
          body: { dataUrl },
        });

        setProfile(payload.profile || null);
        return payload.profile || null;
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      },
      async refreshProfile() {
        if (!session?.access_token) {
          return null;
        }

        return syncProfile(session);
      },
      notifyGoogleSetupMissing() {
        toast.info('Google sign-in also needs the Google provider configured in Supabase.');
      },
    };
  }, [isLoading, isSyncingProfile, profile, session]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
