# Membership Tier System - Usage Examples

## New Tier System Implementation

The pricing system now supports both the legacy boolean `isMember` parameter and the new enum-based tier system.

## Usage Examples

### 1. Legacy Boolean API (Still Works)
```typescript
import { calculatePricing } from '../utils/pricing';

// Existing code continues to work unchanged
const memberPricing = calculatePricing({
  weightInPounds: 10,
  isMember: true
});

const nonMemberPricing = calculatePricing({
  weightInPounds: 10,
  isMember: false
});
```

### 2. New Enum-Based API
```typescript
import { calculatePricing, MembershipTier } from '../utils/pricing';

// New enum-based approach
const memberPricing = calculatePricing({
  weightInPounds: 10,
  tier: MembershipTier.MEMBER
});

const nonMemberPricing = calculatePricing({
  weightInPounds: 10,
  tier: MembershipTier.NON_MEMBER
});
```

### 3. Helper Functions
```typescript
import { getPerPoundRate, getUserTier, MembershipTier, MEMBERSHIP_TIERS } from '../utils/pricing';

// Get rate for specific tier
const memberRate = getPerPoundRate(MembershipTier.MEMBER); // 1.75
const nonMemberRate = getPerPoundRate(MembershipTier.NON_MEMBER); // 2.25

// Convert boolean to tier
const tier = getUserTier(true); // MembershipTier.MEMBER

// Access tier attributes
const memberInfo = MEMBERSHIP_TIERS[MembershipTier.MEMBER];
console.log(memberInfo.label); // "Member"
console.log(memberInfo.description); // "Enjoy discounted rates..."
```

### 4. In Components/Pages
```typescript
// Example: pricing display in Astro component
---
import { MembershipTier, MEMBERSHIP_TIERS, getPerPoundRate } from '../utils/pricing';

const memberTier = MEMBERSHIP_TIERS[MembershipTier.MEMBER];
const nonMemberTier = MEMBERSHIP_TIERS[MembershipTier.NON_MEMBER];
---

<div>
  <h3>{memberTier.label} - ${memberTier.pricePerPound.toFixed(2)}/lb</h3>
  <p>{memberTier.description}</p>
  
  <h3>{nonMemberTier.label} - ${nonMemberTier.pricePerPound.toFixed(2)}/lb</h3>
  <p>{nonMemberTier.description}</p>
</div>
```

### 5. Future Stripe Metadata Enhancement
```typescript
// Optional enhancement for payment intents
const tier = getUserTier(isMember);
const metadata = {
  membership_tier: tier,
  price_per_pound: getPerPoundRate(tier),
  tier_label: MEMBERSHIP_TIERS[tier].label,
};
```

## Backwards Compatibility

✅ **All existing code using `isMember: boolean` continues to work unchanged**  
✅ **New enum-based code can be gradually introduced**  
✅ **Both approaches produce identical pricing results**  
✅ **Type safety improved with enum validation**

## Future Expansion

Adding new tiers is now straightforward:

```typescript
export enum MembershipTier {
  NON_MEMBER = 'non_member',
  MEMBER = 'member',
  ANNUAL_MEMBER = 'annual_member',    // Future
  PREMIUM_MEMBER = 'premium_member',  // Future
}

export const MEMBERSHIP_TIERS = {
  // ... existing tiers
  [MembershipTier.ANNUAL_MEMBER]: {
    label: 'Annual Member',
    pricePerPound: 1.50,
    membershipPrice: 89.99,
    durationMonths: 12,
    description: 'Best value with lowest per-pound pricing.',
  },
} as const;
```

This architecture provides a clean migration path and sets the foundation for future membership expansion.