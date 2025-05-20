import { supabase } from '../../../lib/supabase';
import type { APIRoute } from 'astro';

export const get: APIRoute = async ({ request, redirect }) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: new URL('/api/auth/callback', request.url).toString(),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return redirect(data.url);
};
