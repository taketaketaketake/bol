import { supabase } from '../../../lib/supabase';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token');
    const refreshToken = cookies.get('sb-refresh-token');

    if (!accessToken || !refreshToken) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Set session
    const { data: { session } } = await supabase.auth.setSession({
      access_token: accessToken.value,
      refresh_token: refreshToken.value,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updates = await request.json();

    // Update user metadata
    const { error } = await supabase.auth.updateUser({
      data: updates,
    });

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Profile update error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const prerender = false;
