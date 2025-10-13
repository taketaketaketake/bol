/**
 * Unified Role-Based Access Control System
 * 
 * Provides centralized role checking with hierarchy support.
 * Admins automatically inherit driver and customer privileges.
 * 
 * ⚠️ SERVER-SIDE ONLY - Uses service role for secure role queries
 */

import type { AstroCookies } from 'astro';
import type { User } from '@supabase/supabase-js';
import { requireAuth, createAuthErrorResponse, type AuthResult } from './require-auth';
import { getServiceClient } from './order-status';

// Runtime check to ensure server-side only usage
if (typeof window !== 'undefined') {
  throw new Error('require-role.ts must only be used server-side - contains service role operations');
}

/**
 * Role hierarchy - admins inherit all lower role privileges
 */
const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  admin: ['driver', 'laundromat_staff', 'customer'],
  driver: ['customer'],
  laundromat_staff: ['customer'],
  customer: []
};

export type UserRole = 'admin' | 'driver' | 'laundromat_staff' | 'customer';

/**
 * Enhanced auth result with role information
 */
export interface RoleAuthResult extends AuthResult {
  roles: string[];
}

/**
 * Main role-based authentication function
 * 
 * @param cookies - Astro cookies containing auth tokens
 * @param allowedRoles - Array of roles that can access this endpoint
 * @returns Promise resolving to user, roles, and supabase client
 * @throws Response with 401/403 status if authentication/authorization fails
 */
export async function requireRole(
  cookies: AstroCookies, 
  allowedRoles: UserRole[]
): Promise<RoleAuthResult> {
  try {
    // 1️⃣ Authenticate user first
    const { user, supabase } = await requireAuth(cookies);
    
    // 2️⃣ Get user roles using service client for security
    const serviceClient = getServiceClient();
    const { data: roleData, error } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('auth_user_id', user.id);

    if (error) {
      console.error('[requireRole] Role query error:', error);
      throw createAuthErrorResponse('Failed to verify user permissions');
    }

    const userRoles = roleData?.map(r => r.role) || [];

    // 3️⃣ Check if user has any of the required roles (with hierarchy)
    if (!hasRoleOrAbove(userRoles, allowedRoles)) {
      const userRolesList = userRoles.join(', ') || 'none';
      const requiredRolesList = allowedRoles.join(', ');
      
      console.warn(`[requireRole] Access denied - User roles: [${userRolesList}], Required: [${requiredRolesList}]`);
      
      throw new Response(
        JSON.stringify({ 
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
          required: allowedRoles,
          current: userRoles
        }), 
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return {
      user,
      supabase,
      roles: userRoles
    };

  } catch (error) {
    // Pass through Response objects (already formatted)
    if (error instanceof Response) throw error;
    
    console.error('[requireRole] Fatal error:', error);
    throw createAuthErrorResponse('Authorization failed');
  }
}

/**
 * Check if user roles include required roles with hierarchy support
 * 
 * @param userRoles - Roles assigned to the user
 * @param requiredRoles - Roles required for access
 * @returns true if user has access through direct role or hierarchy
 */
export function hasRoleOrAbove(userRoles: string[], requiredRoles: string[]): boolean {
  return requiredRoles.some(required =>
    userRoles.includes(required) ||
    userRoles.some(userRole => 
      ROLE_HIERARCHY[userRole as UserRole]?.includes(required as UserRole)
    )
  );
}

/**
 * Simple role checking helper
 * 
 * @param roles - User's current roles
 * @param allowed - Allowed roles for operation
 * @returns true if user has any of the allowed roles
 */
export function hasRole(roles: string[], allowed: string[]): boolean {
  return allowed.some(role => roles.includes(role));
}

/**
 * Check if user is an admin (including hierarchy)
 * 
 * @param roles - User's current roles
 * @returns true if user is admin
 */
export function isAdmin(roles: string[]): boolean {
  return roles.includes('admin');
}

/**
 * Check if user can perform driver operations (driver or admin)
 * 
 * @param roles - User's current roles  
 * @returns true if user is driver or admin
 */
export function isDriver(roles: string[]): boolean {
  return roles.includes('driver') || roles.includes('admin');
}

/**
 * Check if user can perform laundromat operations (laundromat_staff or admin)
 * 
 * @param roles - User's current roles
 * @returns true if user is laundromat_staff or admin
 */
export function isLaundromatStaff(roles: string[]): boolean {
  return roles.includes('laundromat_staff') || roles.includes('admin');
}

/**
 * Check if user is a customer (any authenticated user)
 * 
 * @param roles - User's current roles
 * @returns true if user has customer role or above
 */
export function isCustomer(roles: string[]): boolean {
  return roles.includes('customer') || roles.includes('driver') || roles.includes('admin');
}

/**
 * Helper to create forbidden response for manual role checks
 * 
 * @param message - Optional error message
 * @returns 403 Forbidden response
 */
export function createForbiddenResponse(message = 'Insufficient permissions'): Response {
  return new Response(
    JSON.stringify({ 
      error: message,
      code: 'FORBIDDEN'
    }), 
    { 
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Optional helper for routes that need role checking without throwing
 * 
 * @param cookies - Astro cookies
 * @param allowedRoles - Required roles
 * @returns RoleAuthResult or null if not authorized
 */
export async function getRoleIfPresent(
  cookies: AstroCookies, 
  allowedRoles: UserRole[]
): Promise<RoleAuthResult | null> {
  try {
    return await requireRole(cookies, allowedRoles);
  } catch {
    return null;
  }
}