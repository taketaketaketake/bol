import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Check if a user has an active membership
 * @param authUserId - The Supabase auth user ID
 * @returns boolean - true if user has active membership, false otherwise
 */
export async function checkMembershipStatus(authUserId: string): Promise<boolean> {
  if (!authUserId) return false;

  try {
    // First, get the customer record linked to this auth user
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();

    if (customerError || !customer) {
      return false;
    }

    // Check for an active membership
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('status, end_date')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipError || !membership) {
      return false;
    }

    // If there's an end_date, make sure it hasn't passed
    if (membership.end_date) {
      const endDate = new Date(membership.end_date);
      const now = new Date();
      if (endDate < now) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking membership status:', error);
    return false;
  }
}

/**
 * Get full membership details for a user
 * @param authUserId - The Supabase auth user ID
 * @returns Membership object or null
 */
export async function getMembershipDetails(authUserId: string) {
  if (!authUserId) return null;

  try {
    // Get customer record
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();

    if (customerError || !customer) {
      return null;
    }

    // Get active membership
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipError) {
      return null;
    }

    return membership;
  } catch (error) {
    console.error('Error getting membership details:', error);
    return null;
  }
}
