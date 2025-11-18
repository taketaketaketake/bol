import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../utils/env';

// Get validated configuration
const config = getConfig();

/**
 * Server-side Supabase client for API routes
 * Configured for server-side authentication patterns
 */
export const createServerClient = () => {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
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