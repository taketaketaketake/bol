/**
 * Centralized pricing configuration and utilities
 * Single source of truth for all pricing logic across the application
 */

export interface PricingInput {
  weightInPounds?: number;
  bagSize?: 'small' | 'medium' | 'large';
  isMember?: boolean;
  tier?: MembershipTier; // Optional tier parameter for new enum-based pricing
}

export interface PricingResult {
  ratePerPound?: number;
  weightInPounds?: number;
  subtotal: number;
  total: number;
  minimumOrderApplied: boolean;
  isMember: boolean;
  savings: number;
  bagPriceApplied?: boolean;
}

export interface OverweightResult {
  overweight: boolean;
  overageLbs: number;
  fee: number;
  weightLimit?: number;
  actualWeight?: number;
}

// ───────────────────────────────
// Pricing constants (in cents)
// ───────────────────────────────
export const STANDARD_RATE_CENTS = 225;  // $2.25/lb (non-member)
export const MEMBER_RATE_CENTS = 175;    // $1.75/lb (member)
export const MINIMUM_ORDER_CENTS = 3500; // $35 minimum for per-pound orders
export const BAG_PRICING_CENTS = {
  small: 3500, // $35
  medium: 5500, // $55
  large: 8500  // $85
};

// Bag weight limits (in pounds)
export const BAG_WEIGHT_LIMITS = {
  small: 20,   // 20 lbs
  medium: 35,  // 35 lbs  
  large: 50    // 50 lbs
};

// Overweight fee: $5 per 5lb increment (in cents)
export const OVERWEIGHT_FEE_PER_INCREMENT = 500; // $5
export const OVERWEIGHT_INCREMENT_LBS = 5;

// ───────────────────────────────
// Display versions (in dollars)
// ───────────────────────────────
export const STANDARD_RATE = STANDARD_RATE_CENTS / 100;
export const MEMBER_RATE = MEMBER_RATE_CENTS / 100;
export const MINIMUM_ORDER = MINIMUM_ORDER_CENTS / 100;

/**
 * Calculate pricing for laundry orders
 * Supports per-pound and per-bag models
 */
export function calculatePricing({
  weightInPounds,
  bagSize,
  isMember = false,
  tier
}: PricingInput): PricingResult {
  // ── Handle per-bag pricing ──
  if (bagSize) {
    const total = BAG_PRICING_CENTS[bagSize];
    return {
      subtotal: total,
      total,
      minimumOrderApplied: false,
      isMember,
      savings: 0,
      bagPriceApplied: true
    };
  }

  // ── Validate weight ──
  if (!Number.isFinite(weightInPounds) || weightInPounds <= 0) {
    throw new Error('Invalid weight provided for pricing calculation: must be a positive finite number');
  }

  // ── Handle per-pound pricing ──
  // Use tier if provided, otherwise fallback to isMember boolean
  const membershipTier = tier ?? getUserTier(isMember);
  const ratePerPoundDollars = getPerPoundRate(membershipTier);
  const ratePerPound = Math.round(ratePerPoundDollars * 100); // Convert to cents
  const subtotal = Math.round(weightInPounds * ratePerPound);
  const total = Math.max(subtotal, MINIMUM_ORDER_CENTS);

  return {
    ratePerPound,
    weightInPounds,
    subtotal,
    total,
    minimumOrderApplied: total > subtotal,
    isMember: membershipTier === MembershipTier.MEMBER,
    savings: membershipTier === MembershipTier.MEMBER
      ? Math.round(weightInPounds * (getPerPoundRate(MembershipTier.NON_MEMBER) - getPerPoundRate(MembershipTier.MEMBER)) * 100)
      : 0
  };
}

/**
 * Convert pricing results to display-friendly format (in dollars)
 */
export function calculateDisplayPricing(input: PricingInput) {
  const pricing = calculatePricing(input);
  return {
    ...pricing,
    ratePerPound: pricing.ratePerPound ? pricing.ratePerPound / 100 : undefined,
    subtotal: pricing.subtotal / 100,
    total: pricing.total / 100,
    savings: pricing.savings / 100
  };
}

/**
 * Validate minimum order requirement
 */
export function meetsMinimumOrder(amountInCents: number): boolean {
  return amountInCents >= MINIMUM_ORDER_CENTS;
}

/**
 * Get rate per pound based on membership status (in cents)
 * @deprecated Use getPerPoundRate() with MembershipTier enum instead
 */
export function getRatePerPound(isMember: boolean = false): number {
  const tier = getUserTier(isMember);
  return Math.round(getPerPoundRate(tier) * 100);
}

/**
 * Check if a bag order exceeds weight limits and calculate overweight fees
 * @param bagSize - Size of the bag ('small', 'medium', 'large')
 * @param actualWeight - Actual weight in pounds
 * @returns Overweight calculation result
 */
export function checkBagOverweight(
  bagSize: 'small' | 'medium' | 'large', 
  actualWeight: number
): OverweightResult {
  // Validate actual weight input
  if (!Number.isFinite(actualWeight) || actualWeight <= 0) {
    throw new Error('Invalid actual weight: must be a positive finite number');
  }

  const weightLimit = BAG_WEIGHT_LIMITS[bagSize];
  
  if (!weightLimit || actualWeight <= weightLimit) {
    return {
      overweight: false,
      overageLbs: 0,
      fee: 0,
      weightLimit,
      actualWeight
    };
  }

  const overageLbs = actualWeight - weightLimit;
  const incrementsOver = Math.ceil(overageLbs / OVERWEIGHT_INCREMENT_LBS);
  const fee = Math.round(incrementsOver * OVERWEIGHT_FEE_PER_INCREMENT);

  return {
    overweight: true,
    overageLbs: Math.round(overageLbs * 100) / 100, // Round to 2 decimal places
    fee: fee,
    weightLimit,
    actualWeight
  };
}

/**
 * Calculate total cost for a bag order including overweight fees
 * @param bagSize - Size of the bag ('small', 'medium', 'large')
 * @param actualWeight - Actual weight (optional, for overweight calculation)
 * @returns Complete pricing breakdown
 */
export function calculateBagPricingWithOverweight(
  bagSize: 'small' | 'medium' | 'large',
  actualWeight?: number
): {
  basePrice: number;
  overweightResult: OverweightResult;
  total: number;
} {
  const basePrice = BAG_PRICING_CENTS[bagSize];
  let overweightResult: OverweightResult = { overweight: false, overageLbs: 0, fee: 0 };

  if (typeof actualWeight === 'number' && Number.isFinite(actualWeight) && actualWeight > 0) {
    overweightResult = checkBagOverweight(bagSize, actualWeight);
  }

  return {
    basePrice,
    overweightResult,
    total: basePrice + overweightResult.fee,
  };
}

// =============================
// Membership Tier Enum
// =============================

export enum MembershipTier {
  NON_MEMBER = 'non_member',
  MEMBER = 'member',
}

// Map each tier to its attributes
export const MEMBERSHIP_TIERS = {
  [MembershipTier.NON_MEMBER]: {
    label: 'Non-Member',
    pricePerPound: 2.25,
    description: 'Standard per-pound pricing with no membership benefits.',
  },
  [MembershipTier.MEMBER]: {
    label: 'Member',
    pricePerPound: 1.75,
    membershipPrice: 49.99,
    durationMonths: 6,
    description: 'Enjoy discounted rates and priority service for six months.',
  },
} as const;

// =============================
// Membership Subscription Pricing
// =============================

// $49.99 for 6 months (in Stripe-compatible cents)
export const MEMBERSHIP_SUBSCRIPTION_CENTS = 4999;

// Duration for one membership cycle (in months)
export const MEMBERSHIP_DURATION_MONTHS = 6;

// Readable version in dollars
export const MEMBERSHIP_SUBSCRIPTION_PRICE = MEMBERSHIP_SUBSCRIPTION_CENTS / 100;

// Centralized membership display data
export const MEMBERSHIP_PLAN = {
  name: '6-Month Laundry Membership',
  priceDisplay: `${MEMBERSHIP_SUBSCRIPTION_PRICE.toFixed(2)}`,
  durationMonths: MEMBERSHIP_DURATION_MONTHS,
  description: 'Discounted rates and priority service for six months.',
};

// Date helper for membership expiration (requires date-fns if available)
export function getMembershipExpiration(startDate = new Date()): Date {
  // Add 6 months to start date
  const expiration = new Date(startDate);
  expiration.setMonth(expiration.getMonth() + MEMBERSHIP_DURATION_MONTHS);
  return expiration;
}

// =============================
// Membership Tier Helper Functions
// =============================

/**
 * Get per-pound rate for a membership tier
 * @param tier - The membership tier
 * @returns Rate per pound in dollars
 */
export function getPerPoundRate(tier: MembershipTier): number {
  return MEMBERSHIP_TIERS[tier].pricePerPound;
}

/**
 * Convert boolean membership status to tier enum
 * @param isMember - Boolean membership status
 * @returns Corresponding membership tier
 */
export function getUserTier(isMember: boolean): MembershipTier {
  return isMember ? MembershipTier.MEMBER : MembershipTier.NON_MEMBER;
}

/**
 * Calculate bag weight limits based on pricing and membership status
 * @param isMember - Whether the user is a member
 * @returns Object with weight limits for each bag size
 */
export function getBagWeightLimits(isMember: boolean) {
  const ratePerPound = isMember ? MEMBER_RATE : STANDARD_RATE;
  
  return {
    small: Math.ceil((BAG_PRICING_CENTS.small / 100) / ratePerPound),
    medium: Math.ceil((BAG_PRICING_CENTS.medium / 100) / ratePerPound), 
    large: Math.ceil((BAG_PRICING_CENTS.large / 100) / ratePerPound)
  };
}