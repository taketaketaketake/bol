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
    // Authenticate user
    const { user } = await requireAuth(cookies);

    const { sms_opt_in } = await request.json();

    if (typeof sms_opt_in !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'sms_opt_in must be a boolean value' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update customer SMS opt-in preference
    const { error } = await serviceClient
      .from('customers')
      .update({ 
        sms_opt_in: sms_opt_in 
      })
      .eq('auth_user_id', user.id);

    if (error) {
      console.error('[SMS Preferences] Update error:', error);
      throw new Error('Failed to update SMS preferences');
    }

    console.log(`[SMS Preferences] Updated for user ${user.id}: sms_opt_in=${sms_opt_in}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        sms_opt_in: sms_opt_in
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SMS Preferences] Error:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Authentication')) {
      return createAuthErrorResponse(error.message);
    }
    
    const message = error instanceof Error ? error.message : 'Failed to update SMS preferences';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const GET: APIRoute = async ({ cookies }) => {
  try {
    // Authenticate user
    const { user } = await requireAuth(cookies);

    // Get current SMS opt-in status
    const { data: customer, error } = await serviceClient
      .from('customers')
      .select('sms_opt_in, phone')
      .eq('auth_user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[SMS Preferences] Fetch error:', error);
      throw new Error('Failed to fetch SMS preferences');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        sms_opt_in: customer?.sms_opt_in || false,
        phone: customer?.phone || null
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SMS Preferences] Fetch error:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Authentication')) {
      return createAuthErrorResponse(error.message);
    }
    
    const message = error instanceof Error ? error.message : 'Failed to fetch SMS preferences';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const prerender = false;