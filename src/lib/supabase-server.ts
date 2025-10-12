import { createClient } from '@supabase/supabase-js';

// Validate environment variables
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  throw new Error('Missing PUBLIC_SUPABASE_ANON_KEY environment variable');
}

/**
 * Server-side Supabase client for API routes
 * Configured for server-side authentication patterns
 */
export const createServerClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Disable automatic token refresh on server
      autoRefreshToken: false,
      // Don't persist session on server
      persistSession: false,
      // Detect session from external sources (cookies)
      detectSessionInUrl: false,
    },
  });
};

// Export singleton for simple usage
export const supabaseServer = createServerClient();