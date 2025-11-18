import type { APIRoute } from 'astro';
import { requireAuth, createAuthErrorResponse } from '../../../utils/require-auth';
import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../../../utils/env';

const config = getConfig();

// Service role client for updating customer data
const serviceClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey
);

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Authenticate user and get Supabase client
    const { user, supabase } = await requireAuth(cookies);

    const updates = await request.json();

    // Update user metadata
    const { error: authError } = await supabase.auth.updateUser({
      data: updates,
    });

    if (authError) {
      throw authError;
    }

    // Also update customer record if phone or name is being updated
    const customerUpdates: any = {};
    if (updates.phone !== undefined) {
      customerUpdates.phone = updates.phone;
    }
    if (updates.full_name !== undefined) {
      customerUpdates.full_name = updates.full_name;
    }

    // Update customer table if we have updates
    if (Object.keys(customerUpdates).length > 0) {
      const { error: customerError } = await serviceClient
        .from('customers')
        .update(customerUpdates)
        .eq('auth_user_id', user.id);

      if (customerError) {
        console.warn('[Profile Update] Customer table update failed:', customerError);
        // Don't fail the whole request - auth metadata was updated successfully
      }
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
