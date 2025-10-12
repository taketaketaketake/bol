import type { APIRoute } from 'astro';
import { requireAuth, createAuthErrorResponse } from '../../../utils/require-auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Authenticate user and get Supabase client
    const { user, supabase } = await requireAuth(cookies);

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
    
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Authentication')) {
      return createAuthErrorResponse(error.message);
    }
    
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const prerender = false;
