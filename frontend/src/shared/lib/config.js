// src/shared/lib/config.js
const trimTrailingSlash = (value) => value?.replace(/\/+$/, '') || '';

// Get base URL safely (works in browser and during build)
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // During build/SSR, use environment variable or localhost
  return import.meta.env.VITE_APP_URL || 'http://localhost:5173';
};

export const API_URL = trimTrailingSlash(
  import.meta.env.VITE_API_URL || 
  import.meta.env.VITE_SOCKET_URL || 
  (import.meta.env.PROD ? '' : 'http://localhost:3001')
);

export const SOCKET_URL = trimTrailingSlash(
  import.meta.env.VITE_SOCKET_URL || API_URL
);

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Safe URLs that work in all environments
export const AUTH_REDIRECT_URL = `${getBaseUrl()}/auth/callback`;
export const PASSWORD_RESET_URL = `${getBaseUrl()}/update-password`;

// Validate required env vars
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
}