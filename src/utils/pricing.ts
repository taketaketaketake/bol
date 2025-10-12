/**
 * Centralized pricing configuration and utilities
 * Single source of truth for all pricing logic across the application
 */

export interface PricingInput {
  weightInPounds?: number;
  bagSize?: 'small' | 'medium' | 'large';
  isMember?: boolean;
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
  isMember = false
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
  const ratePerPound = isMember ? MEMBER_RATE_CENTS : STANDARD_RATE_CENTS;
  const subtotal = Math.round(weightInPounds * ratePerPound);
  const total = Math.max(subtotal, MINIMUM_ORDER_CENTS);

  return {
    ratePerPound,
    weightInPounds,
    subtotal,
    total,
    minimumOrderApplied: total > subtotal,
    isMember,
    savings: isMember
      ? Math.round(weightInPounds * (STANDARD_RATE_CENTS - MEMBER_RATE_CENTS))
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
 * Get rate per pound based on membership status
 */
export function getRatePerPound(isMember: boolean = false): number {
  return isMember ? MEMBER_RATE_CENTS : STANDARD_RATE_CENTS;
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