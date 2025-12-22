/**
 * Rate Limiting Utility
 *
 * Implements sliding window rate limiting to protect API endpoints from abuse.
 * Uses in-memory storage suitable for single-instance deployments (Netlify/Vercel).
 *
 * For multi-instance production deployments, consider using Redis or similar.
 */

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests allowed in the window
  keyPrefix?: string;    // Optional prefix for identifying different rate limit buckets
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// Default rate limit configurations for different endpoint types
export const RATE_LIMITS = {
  // Authentication endpoints - strict to prevent brute force
  AUTH: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 5,             // 5 attempts per 15 minutes
    keyPrefix: 'auth'
  },

  // Password reset - very strict
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 3,             // 3 attempts per hour
    keyPrefix: 'password'
  },

  // Payment endpoints - moderate
  PAYMENT: {
    windowMs: 5 * 60 * 1000,   // 5 minutes
    maxRequests: 10,            // 10 requests per 5 minutes
    keyPrefix: 'payment'
  },

  // Order creation - moderate
  ORDER_CREATE: {
    windowMs: 10 * 60 * 1000,  // 10 minutes
    maxRequests: 20,            // 20 orders per 10 minutes
    keyPrefix: 'order-create'
  },

  // General API endpoints - lenient
  GENERAL: {
    windowMs: 1 * 60 * 1000,   // 1 minute
    maxRequests: 60,            // 60 requests per minute
    keyPrefix: 'general'
  },

  // Read-only endpoints - more lenient
  READ: {
    windowMs: 1 * 60 * 1000,   // 1 minute
    maxRequests: 100,           // 100 requests per minute
    keyPrefix: 'read'
  },

  // Webhook endpoints - very lenient (trusted sources)
  WEBHOOK: {
    windowMs: 1 * 60 * 1000,   // 1 minute
    maxRequests: 1000,          // 1000 requests per minute
    keyPrefix: 'webhook'
  }
} as const;

// In-memory store for rate limit tracking
interface RequestRecord {
  timestamps: number[];
  resetTime: number;
}

const store = new Map<string, RequestRecord>();

/**
 * Clean up old entries from the store periodically
 * Runs every 10 minutes to prevent memory leaks
 */
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];

    store.forEach((record, key) => {
      if (record.resetTime < now) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => store.delete(key));

    if (store.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL);
}

/**
 * Get client identifier from request
 * Uses IP address as primary identifier, with user ID as fallback for authenticated requests
 */
export function getClientId(request: Request, userId?: string): string {
  // Try to get real IP from various headers (reverse proxy support)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare

  let ip = 'unknown';

  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    ip = forwardedFor.split(',')[0].trim();
  } else if (realIp) {
    ip = realIp;
  } else if (cfConnectingIp) {
    ip = cfConnectingIp;
  }

  // Include user ID if available for better tracking of authenticated requests
  return userId ? `${ip}:${userId}` : ip;
}

/**
 * Check if a request should be rate limited
 * Implements sliding window algorithm
 */
export function checkRateLimit(
  clientId: string,
  config: RateLimitConfig
): RateLimitResult {
  startCleanup(); // Ensure cleanup is running

  const now = Date.now();
  const key = config.keyPrefix ? `${config.keyPrefix}:${clientId}` : clientId;

  // Get or create record for this client
  let record = store.get(key);

  if (!record) {
    record = {
      timestamps: [],
      resetTime: now + config.windowMs
    };
    store.set(key, record);
  }

  // Remove timestamps outside the current window
  const windowStart = now - config.windowMs;
  record.timestamps = record.timestamps.filter(ts => ts > windowStart);

  // Update reset time if needed
  if (record.resetTime < now) {
    record.resetTime = now + config.windowMs;
  }

  // Check if limit exceeded
  const currentCount = record.timestamps.length;
  const allowed = currentCount < config.maxRequests;

  if (allowed) {
    // Add current timestamp
    record.timestamps.push(now);
  }

  const remaining = Math.max(0, config.maxRequests - record.timestamps.length);
  const retryAfter = allowed ? undefined : Math.ceil((record.resetTime - now) / 1000);

  return {
    allowed,
    remaining,
    resetTime: record.resetTime,
    retryAfter
  };
}

/**
 * Middleware function to apply rate limiting to an API route
 * Returns null if allowed, or a Response object if rate limited
 */
export async function rateLimit(
  request: Request,
  config: RateLimitConfig,
  userId?: string
): Promise<Response | null> {
  const clientId = getClientId(request, userId);
  const result = checkRateLimit(clientId, config);

  // Always include rate limit headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetTime / 1000))
  };

  if (!result.allowed) {
    headers['Retry-After'] = String(result.retryAfter || 60);

    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter
      }),
      {
        status: 429,
        headers
      }
    );
  }

  return null; // Allowed - no response needed
}

/**
 * Helper to add rate limit headers to a successful response
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult,
  config: RateLimitConfig
): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-RateLimit-Limit', String(config.maxRequests));
  newHeaders.set('X-RateLimit-Remaining', String(result.remaining));
  newHeaders.set('X-RateLimit-Reset', String(Math.floor(result.resetTime / 1000)));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

/**
 * Clear rate limit for a specific client (useful for testing or manual intervention)
 */
export function clearRateLimit(clientId: string, keyPrefix?: string): void {
  const key = keyPrefix ? `${keyPrefix}:${clientId}` : clientId;
  store.delete(key);
}

/**
 * Get current rate limit status for a client without incrementing counter
 */
export function getRateLimitStatus(
  clientId: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = config.keyPrefix ? `${config.keyPrefix}:${clientId}` : clientId;

  const record = store.get(key);

  if (!record) {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs
    };
  }

  // Remove timestamps outside the current window
  const windowStart = now - config.windowMs;
  const validTimestamps = record.timestamps.filter(ts => ts > windowStart);

  const remaining = Math.max(0, config.maxRequests - validTimestamps.length);
  const allowed = validTimestamps.length < config.maxRequests;

  return {
    allowed,
    remaining,
    resetTime: record.resetTime,
    retryAfter: allowed ? undefined : Math.ceil((record.resetTime - now) / 1000)
  };
}
