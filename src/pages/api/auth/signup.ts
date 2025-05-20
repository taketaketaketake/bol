import { supabase } from '../../../lib/supabase';
import type { APIRoute } from 'astro';
import { z } from 'zod';

const SignupSchema = z.object({
  email: z.string().email({ message: '請輸入有效的電子郵件' }),
  password: z.string().min(6, { message: '密碼至少需要 6 個字元' }),
  fullName: z.string().min(1, { message: '請填寫姓名' }),
});

export const POST: APIRoute = async ({ request }) => {
  console.log('[Signup][POST] Incoming signup request');
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
        emailRedirectTo: new URL('/dashboard', request.url).toString(),
      },
    });

    if (error) {
      console.error('[Signup][POST] Supabase signUp error:', error);
      throw error;
    }

    console.log('[Signup][POST] Supabase signUp response:', signUpData);

    if (signUpData.user?.identities?.length === 0) {
      console.log('[Signup][POST] User already exists or needs email verification');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: '請檢查您的電子郵件以完成註冊',
          redirectTo: '/login?message=check-email'
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
    let message = '註冊失敗，請稍後再試';
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