import { supabase } from '../lib/supabase';
import type { AstroCookies } from 'astro';

export async function getSession(cookies: AstroCookies) {
  const accessToken = cookies.get('sb-access-token');
  const refreshToken = cookies.get('sb-refresh-token');

  if (!accessToken || !refreshToken) {
    return null;
  }

  const { data } = await supabase.auth.setSession({
    access_token: accessToken.value,
    refresh_token: refreshToken.value
  });

  return data.session;
}
