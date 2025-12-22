import { supabase } from '../../../lib/supabase';
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { rateLimit, RATE_LIMITS } from '../../../utils/rate-limit';

const SignupSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  fullName: z.string().min(1, { message: 'Please enter your full name' }),
});

export const POST: APIRoute = async ({ request }) => {
  console.log('[Signup][POST] Incoming signup request');

  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.AUTH);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const rawData = await request.json();
    const data = SignupSchema.parse(rawData);
    console.log('[Signup][POST] Received data:', data);

    const { email, password, fullName } = data;

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: new URL('/auth/callback', request.url).toString(),
      },
    });

    if (error) {
      console.error('[Signup][POST] Supabase signUp error:', error);
      throw error;
    }

    console.log('[Signup][POST] Supabase signUp response:', signUpData);

    if (signUpData.user?.identities?.length === 0) {
      console.log('[Signup][POST] User already exists');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'An account with this email already exists'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if email confirmation is required
    if (signUpData.session === null) {
      console.log('[Signup][POST] Email confirmation required');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Please check your email to complete registration'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Signup][POST] Signup successful, redirecting to dashboard');
    return new Response(
      JSON.stringify({
        success: true,
        redirectTo: '/dashboard'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Signup][POST] Signup error:', error);
    let message = 'Registration failed, please try again';
    if (error instanceof z.ZodError) {
      message = error.errors[0]?.message || message;
    } else if (error instanceof Error) {
      message = error.message;
    }
    return new Response(
      JSON.stringify({
        success: false,
        error: message
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const prerender = false;