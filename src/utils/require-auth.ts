import type { AstroCookies } from 'astro';
import type { User } from '@supabase/supabase-js';
import { createServerClient } from '../lib/supabase-server';

/**
 * Authentication result containing user data and Supabase client
 */
export interface AuthResult {
  user: User;
  supabase: ReturnType<typeof createServerClient>;
}

/**
 * Require authentication for API routes using cookie-based sessions
 * 
 * This function handles the common pattern in your API routes:
 * 1. Extract auth tokens from cookies
 * 2. Set session on Supabase client
 * 3. Return authenticated user
 * 
 * @param cookies - Astro cookies object containing auth tokens
 * @returns Promise resolving to authenticated user and Supabase client
 * @throws Error with descriptive message if authentication fails
 */
export async function requireAuth(cookies: AstroCookies): Promise<AuthResult> {
  // Create server-configured Supabase client
  const supabase = createServerClient();

  // Extract authentication tokens from cookies
  const accessToken = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

  // Validate tokens are present
  if (!accessToken || !refreshToken) {
    throw new Error('Authentication required: missing session tokens');
  }

  try {
    // Set session using tokens from cookies
    const { data: { session }, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (sessionError) {
      throw new Error(`Authentication failed: ${sessionError.message}`);
    }

    if (!session?.user) {
      throw new Error('Authentication failed: invalid session');
    }

    return {
      user: session.user,
      supabase
    };

  } catch (error) {
    // Re-throw with consistent error format
    const message = error instanceof Error ? error.message : 'Authentication failed';
    throw new Error(message);
  }
}

/**
 * Optional authentication helper that returns null instead of throwing
 * Useful for routes that have optional authentication
 * 
 * @param cookies - Astro cookies object
 * @returns Promise resolving to AuthResult or null if not authenticated
 */
export async function getAuthIfPresent(cookies: AstroCookies): Promise<AuthResult | null> {
  try {
    return await requireAuth(cookies);
  } catch {
    return null;
  }
}

/**
 * Utility function to create standardized auth error responses
 * 
 * @param message - Optional error message
 * @returns Response object with 401 status and JSON error
 */
export function createAuthErrorResponse(message = 'Authentication required'): Response {
  return new Response(
    JSON.stringify({ 
      error: message,
      code: 'UNAUTHORIZED'
    }), 
    { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}