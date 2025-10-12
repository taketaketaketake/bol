import type { AstroCookies } from 'astro';
import { requireAuth, createAuthErrorResponse, type AuthResult } from './require-auth';

/** Admin-specific return type */
export interface AdminAuthResult extends AuthResult {
  admin: {
    id: string;
    permissions: any;
    fullName: string | null;
    email: string | null;
  };
}

/** Member-specific return type */
export interface MemberAuthResult extends AuthResult {
  isMember: true;
  membership: {
    id: string;
    status: string;
    membershipType: string | null;
    endDate: string | null;
  };
}

/**
 * Require admin access for protected routes
 */
export async function requireAdmin(cookies: AstroCookies): Promise<AdminAuthResult> {
  try {
    const { user, supabase } = await requireAuth(cookies);

    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, permissions, full_name, email')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (error || !admin) throw createAuthErrorResponse('Admin access required');

    return {
      user,
      supabase,
      admin: {
        id: admin.id,
        permissions: admin.permissions,
        fullName: admin.full_name,
        email: admin.email,
      },
    };
  } catch (err) {
    // Pass through Response objects (already formatted)
    if (err instanceof Response) throw err;
    console.error('[requireAdmin]', err);
    throw createAuthErrorResponse('Authorization failed');
  }
}

/**
 * Require active membership for protected features
 */
export async function requireMember(cookies: AstroCookies): Promise<MemberAuthResult> {
  try {
    const { user, supabase } = await requireAuth(cookies);

    // 1️⃣ Find customer row
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!customer) throw createAuthErrorResponse('No customer profile found');

    // 2️⃣ Check active membership
    const { data: membership } = await supabase
      .from('memberships')
      .select('id, status, membership_type, end_date')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) throw createAuthErrorResponse('Active membership required');

    // 3️⃣ Optional expiry check
    if (membership.end_date && new Date(membership.end_date) < new Date()) {
      throw createAuthErrorResponse('Membership expired — please renew');
    }

    return {
      user,
      supabase,
      isMember: true,
      membership: {
        id: membership.id,
        status: membership.status,
        membershipType: membership.membership_type,
        endDate: membership.end_date,
      },
    };
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error('[requireMember]', err);
    throw createAuthErrorResponse('Membership verification failed');
  }
}

/**
 * Optional helper: check if user has admin access (no throw)
 */
export async function getAdminIfPresent(
  cookies: AstroCookies
): Promise<AdminAuthResult | null> {
  try {
    return await requireAdmin(cookies);
  } catch {
    return null;
  }
}

/**
 * Optional helper: check if user has membership (no throw)
 */
export async function getMemberIfPresent(
  cookies: AstroCookies
): Promise<MemberAuthResult | null> {
  try {
    return await requireMember(cookies);
  } catch {
    return null;
  }
}