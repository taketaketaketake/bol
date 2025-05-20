import { supabase } from '../../../lib/supabase';
import type { APIRoute } from 'astro';

export const get: APIRoute = async ({ request, redirect }) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: new URL('/api/auth/callback', request.url).toString(),
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
