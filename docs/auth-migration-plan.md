# Auth Migration Implementation Plan

This document outlines the complete plan for migrating from multiple authentication utilities to the unified role-based system.

## 🎯 **Overview**

**Goal**: Consolidate three authentication utilities into the unified `require-role.ts` system while maintaining security and functionality.

**Files to migrate**: 10 API endpoints total
- 2 admin-only endpoints (highest priority)
- 7 customer endpoints (medium priority)  
- 1 special case (membership pricing)

## **Phase 1: Pre-Migration Setup & Testing**

### **1.1 Create Test Users (Database)**
```sql
-- Add test users to your database for verification
INSERT INTO admins (auth_user_id, full_name, email) VALUES 
('admin-test-uuid', 'Test Admin', 'admin@test.com');

INSERT INTO customers (auth_user_id, full_name, email) VALUES 
('customer-test-uuid', 'Test Customer', 'customer@test.com');

INSERT INTO drivers (auth_user_id, full_name) VALUES 
('driver-test-uuid', 'Test Driver');
```

### **1.2 Manual Testing Checklist**
Create a simple test to verify current behavior:

**Admin Endpoints (Currently `requireAdmin()`):**
- [ ] `POST /api/orders/adjust-weight` - Admin can access ✅
- [ ] `POST /api/orders/adjust-weight` - Customer gets 403 ❌
- [ ] `POST /api/refund-payment` - Admin can access ✅  
- [ ] `POST /api/refund-payment` - Customer gets 403 ❌

**Customer Endpoints (Currently `requireAuth()`):**
- [ ] `POST /api/create-order` - Admin can access ✅
- [ ] `POST /api/create-order` - Customer can access ✅
- [ ] `POST /api/orders/cancel` - Admin can access ✅
- [ ] `POST /api/orders/cancel` - Customer can access ✅

## **Phase 2: Migration Implementation**

### **2.1 Start with Admin Endpoints (Safest)**

**File: `/api/orders/adjust-weight.ts`**
```typescript
// BEFORE
import { requireAdmin } from '../../../utils/require-roles';
const { user } = await requireAdmin(cookies);

// AFTER  
import { requireRole, isAdmin } from '../../../utils/require-role';
const { user, roles } = await requireRole(cookies, ['customer']);

// Add business logic check
if (!isAdmin(roles)) {
  console.warn(`Non-admin user ${user.id} attempted weight adjustment`);
  return new Response('Admin access required for weight adjustments', { status: 403 });
}
```

**File: `/api/refund-payment.ts`**
```typescript
// BEFORE
import { requireAdmin } from '../../utils/require-roles';  
const { user } = await requireAdmin(cookies);

// AFTER
import { requireRole, isAdmin } from '../../utils/require-role';
const { user, roles } = await requireRole(cookies, ['customer']);

// Add business logic check
if (!isAdmin(roles)) {
  console.warn(`Non-admin user ${user.id} attempted refund operation`);
  return new Response('Admin access required for refunds', { status: 403 });
}
```

### **2.2 Customer Endpoints (Straightforward)**

**Pattern for all 7 customer endpoints:**
```typescript
// BEFORE
import { requireAuth } from '../../utils/require-auth';
const { user, supabase } = await requireAuth(cookies);

// AFTER  
import { requireRole } from '../../utils/require-role';
const { user, supabase, roles } = await requireRole(cookies, ['customer']);
```

**Files to update:**
- `src/pages/api/create-order.ts`
- `src/pages/api/orders/cancel.ts`
- `src/pages/api/profile/update.ts` 
- `src/pages/api/profile/sms-preferences.ts`
- `src/pages/api/create-membership-payment-intent.ts`
- `src/pages/api/assign-laundromat.ts`
- `src/pages/api/auth/reset-password.ts`

## **Phase 3: Verification & Testing**

### **3.1 After Each Migration**
Test the specific endpoint with:
1. **Admin user** - Should still work ✅
2. **Customer user** - Should still work ✅  
3. **No auth** - Should get 401 ❌

### **3.2 Role Hierarchy Verification**
Confirm that:
- **Admin** can access all customer endpoints (inheritance working)
- **Customer** cannot access admin business logic (weight/refund)
- **Driver** can access customer endpoints (inheritance working)

## **Phase 4: Business Logic Security**

### **4.1 Admin-Only Operations Security**
For the formerly admin-only endpoints, add business logic checks:

```typescript
// In adjust-weight.ts and refund-payment.ts after migration
import { isAdmin } from '../../../utils/require-role';

const { user, roles } = await requireRole(cookies, ['customer']);

// Business logic security check
if (!isAdmin(roles)) {
  console.warn(`Security: Non-admin user ${user.id} attempted admin operation on ${request.url}`);
  return new Response(
    JSON.stringify({ 
      error: 'Admin access required for this operation',
      code: 'ADMIN_REQUIRED'
    }), 
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  );
}
```

## **Phase 5: Cleanup (Optional)**

### **5.1 Remove Legacy Files**
Once all migrations are complete and tested:
- Delete `src/utils/require-auth.ts`
- Delete `src/utils/require-roles.ts`  
- Update any remaining imports

### **5.2 Update Documentation**
- Update CLAUDE.md to remove migration notes
- Mark role system as "unified"

## **📋 Migration Order (Risk-Based)**

1. **Start Here**: `adjust-weight.ts` (admin-only, low traffic)
2. **Then**: `refund-payment.ts` (admin-only, low traffic)  
3. **Next**: `create-order.ts` (high traffic, test thoroughly)
4. **Continue**: Other customer endpoints one by one
5. **Finish**: Cleanup and documentation

## **🚨 Rollback Plan**

If something breaks during migration:

```bash
# Revert the specific file
git checkout HEAD~1 -- src/pages/api/problematic-endpoint.ts

# Test that the revert works
# Fix the issue
# Re-attempt migration
```

## **✅ Success Criteria**

- [ ] All endpoints return same responses as before migration
- [ ] Admin users can access all operations  
- [ ] Customer users can access customer operations
- [ ] Customer users cannot access admin business logic
- [ ] No new console errors or auth failures
- [ ] Role hierarchy working (admin inherits customer access)

## **Special Cases**

### **Membership Pricing (`/api/capture-payment.ts`)**
Currently uses `getMemberIfPresent()` for pricing logic. Consider:

**Option A: Keep Separate (Recommended)**
```typescript
const { user } = await requireRole(cookies, ['customer']); 
const isMember = await checkMembershipStatus(user.id, supabase);
```

**Option B: Integrate into Role System**
Add membership as a role, but may overcomplicate things.

## **Testing Strategy**

### **Manual Testing Flow**
For each migrated endpoint:

1. **Test with Admin User**:
   ```bash
   # Login as admin
   curl -X POST /api/auth/signin -d '{"email":"admin@test.com","password":"admin123"}'
   
   # Test endpoint (should work)
   curl -X POST /api/orders/adjust-weight -d '{"orderId":"test","actualWeight":25}'
   ```

2. **Test with Customer User**:
   ```bash
   # Login as customer  
   curl -X POST /api/auth/signin -d '{"email":"customer@test.com","password":"customer123"}'
   
   # Test customer endpoint (should work)
   curl -X POST /api/create-order -d '{...valid order data...}'
   
   # Test admin endpoint (should fail with 403)
   curl -X POST /api/orders/adjust-weight -d '{"orderId":"test","actualWeight":25}'
   ```

3. **Test with No Auth**:
   ```bash
   # Test without login (should fail with 401)
   curl -X POST /api/create-order -d '{...valid order data...}'
   ```

### **Database Verification**
Ensure all users have proper role assignments:

```sql
-- Check role assignments
SELECT u.email, ur.role 
FROM auth.users u
JOIN user_roles ur ON u.id = ur.auth_user_id
WHERE u.email IN ('admin@test.com', 'customer@test.com', 'driver@test.com');
```

## **Timeline Estimate**

- **Phase 1**: Setup & Testing - 30 minutes
- **Phase 2**: Implementation - 2-3 hours  
- **Phase 3**: Verification - 1 hour
- **Phase 4**: Security Checks - 30 minutes
- **Phase 5**: Cleanup - 30 minutes

**Total**: ~4-5 hours for complete migration

## **Risk Assessment**

### **Low Risk**
- Admin endpoints (`adjust-weight`, `refund-payment`) - Low traffic, admin-only
- Profile endpoints - Simple customer operations

### **Medium Risk**  
- `create-order.ts` - High traffic, core functionality
- `orders/cancel.ts` - Important customer feature

### **Mitigation**
- Test thoroughly in development first
- Migrate during low-traffic hours
- Have rollback plan ready
- Monitor logs for auth failures after deployment

---

**Ready to implement when you have time! Start with the admin endpoints for lowest risk.**