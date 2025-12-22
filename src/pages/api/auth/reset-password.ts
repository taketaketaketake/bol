import type { APIRoute } from 'astro';
import { requireRole } from '../../../utils/require-role';
import { createAuthErrorResponse } from '../../../utils/require-auth';
import { rateLimit, RATE_LIMITS } from '../../../utils/rate-limit';

export const POST: APIRoute = async ({ request, cookies }) => {
  // Apply strict rate limiting for password reset
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.PASSWORD_RESET);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Authenticate user and get Supabase client
    const { user, roles, supabase } = await requireRole(cookies, ['customer']);

    const { password } = await request.json();

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update the password
    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Reset password error:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Authentication')) {
      return createAuthErrorResponse(error.message);
    }
    
    const message = error instanceof Error ? error.message : 'Failed to reset password';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const prerender = false;
