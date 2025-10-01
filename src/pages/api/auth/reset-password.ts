import { supabase } from '../../../lib/supabase';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { password } = await request.json();

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the session from cookies
    const accessToken = cookies.get('sb-access-token');
    const refreshToken = cookies.get('sb-refresh-token');

    if (!accessToken || !refreshToken) {
      return new Response(
        JSON.stringify({ error: 'No session found' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Set the session
    await supabase.auth.setSession({
      access_token: accessToken.value,
      refresh_token: refreshToken.value,
    });

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
    const message = error instanceof Error ? error.message : 'Failed to reset password';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const prerender = false;
