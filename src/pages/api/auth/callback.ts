import { supabase } from '../../../lib/supabase';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('Error exchanging code for session:', error);
        return redirect('/login?error=oauth_failed');
      }

      // Set session cookies
      const { access_token, refresh_token } = data.session;
      cookies.set('sb-access-token', access_token, {
        path: '/',
        secure: import.meta.env.PROD,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
      
      cookies.set('sb-refresh-token', refresh_token, {
        path: '/',
        secure: import.meta.env.PROD,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });

      return redirect('/dashboard');
    } catch (error) {
      console.error('Error in OAuth callback:', error);
      return redirect('/login?error=oauth_failed');
    }
  }

  return redirect('/login?error=invalid_request');
};

export const prerender = false;
