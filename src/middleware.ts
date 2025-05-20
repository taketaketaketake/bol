import { sequence } from 'astro:middleware';
import { supabase } from './lib/supabase';

const protectedRoutes = ['/dashboard'];
const authRoutes = ['/login', '/signup'];

export const onRequest = sequence(async ({ locals, url, cookies, redirect }, next) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  // Add the user to the locals
  locals.user = session?.user || null;
  
  // Check if the current path is protected
  const isProtectedRoute = protectedRoutes.some(route => url.pathname.startsWith(route));
  const isAuthRoute = authRoutes.includes(url.pathname);
  
  // Redirect to login if trying to access protected route without session
  if (isProtectedRoute && !session) {
    return redirect('/auth/login');
  }
  
  // Redirect to dashboard if trying to access auth route with active session
  if (isAuthRoute && session) {
    return redirect('/dashboard');
  }
  
  return next();
});
