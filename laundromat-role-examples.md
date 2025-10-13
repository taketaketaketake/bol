# Laundromat Staff Role - Usage Examples

## Role Hierarchy
With the new `laundromat_staff` role, your hierarchy now looks like:

```
admin → [driver, laundromat_staff, customer]
driver → [customer]
laundromat_staff → [customer]
customer → []
```

## Usage Examples

### 1. Laundromat-Only Endpoints
For operations that only laundromat staff (and admins) should perform:

```typescript
// src/pages/api/laundromat/mark-items-damaged.ts
import { requireRole, isLaundromatStaff } from '../../utils/require-role';

export const POST: APIRoute = async ({ cookies, request }) => {
  const { user, roles } = await requireRole(cookies, ['laundromat_staff', 'admin']);
  
  // Or alternatively with helper function:
  // if (!isLaundromatStaff(roles)) return createForbiddenResponse();
  
  // Laundromat staff can mark items as damaged
};
```

### 2. Multi-Role Endpoints
For the existing processing-complete endpoint that both drivers and laundromat staff might use:

```typescript
// Option A: Allow all three roles
const { user, roles } = await requireRole(cookies, ['driver', 'laundromat_staff', 'admin']);

// Option B: Check specific roles in logic
const { user, roles } = await requireRole(cookies, ['driver', 'laundromat_staff', 'admin']);
if (isDriver(roles)) {
  // Driver picked up from laundromat
} else if (isLaundromatStaff(roles)) {
  // Laundromat staff marked as complete
}
```

### 3. Helper Functions Available
```typescript
isAdmin(roles)           // true for admin only
isDriver(roles)          // true for driver OR admin  
isLaundromatStaff(roles) // true for laundromat_staff OR admin
isCustomer(roles)        // true for any authenticated user
```

## Database Setup
Your database should now have the laundromat_staff in the user_roles view:

```sql
-- Verify the role is working
SELECT * FROM user_roles WHERE role = 'laundromat_staff';

-- Add a test laundromat staff member  
INSERT INTO laundromat_staff (auth_user_id, full_name, facility_location) 
VALUES ('auth-user-id', 'Test Laundromat Staff', 'Main Facility');
```

## Access Patterns

| Role | Driver Endpoints | Laundromat Endpoints | Admin Endpoints |
|------|------------------|---------------------|-----------------|
| admin | ✅ (inherited) | ✅ (inherited) | ✅ |
| driver | ✅ | ❌ | ❌ |
| laundromat_staff | ❌ | ✅ | ❌ |
| customer | ❌ | ❌ | ❌ |

This role separation allows for secure operations while maintaining admin oversight across all functions.