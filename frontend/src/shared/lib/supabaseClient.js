// src/shared/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@shared/lib/config';

let supabaseClient = null;

export const getSupabaseClient = () => {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase environment variables are missing.');
  }

  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseClient;
};

export const supabase = getSupabaseClient();
