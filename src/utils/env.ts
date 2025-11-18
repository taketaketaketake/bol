/**
 * Environment variable validation and configuration
 * 
 * This module validates required environment variables on application startup
 * and provides type-safe access to configuration values.
 */

export interface AppConfig {
  // Supabase
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  
  // Application
  siteUrl: string;
  nodeEnv: 'development' | 'production' | 'test';
  
  // External Services
  mapboxToken: string;
  resendApiKey: string;
  resendFromEmail: string;
  notificationEmail: string;
  
  // Stripe
  stripeSecretKey: string;
  stripePublishableKey: string;
  stripeWebhookSecret: string;
  
  // Optional: SMS/Phone
  telnyxApiKey?: string;
  telnyxWebhookSecret?: string;
}

/**
 * Required environment variables
 */
const requiredEnvVars = [
  'PUBLIC_SUPABASE_URL',
  'PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PUBLIC_SITE_URL',
  'MAPBOX_ACCESS_TOKEN',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'YOUR_NOTIFICATION_EMAIL',
  'STRIPE_SECRET_KEY',
  'PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET'
] as const;

/**
 * Optional environment variables
 */
const optionalEnvVars = [
  'TELNYX_API_KEY',
  'TELNYX_WEBHOOK_SECRET'
] as const;

/**
 * Validate required environment variables
 * @throws Error if any required variables are missing
 */
export function validateEnvironment(): void {
  const missing: string[] = [];
  
  for (const envVar of requiredEnvVars) {
    if (!import.meta.env[envVar]) {
      missing.push(envVar);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}\n\n` +
      'Please check your .env file and ensure all required variables are set.\n' +
      'See ENVIRONMENT-SETUP.md for detailed setup instructions.'
    );
  }
}

/**
 * Get validated application configuration
 * @returns Typed configuration object
 */
export function getConfig(): AppConfig {
  // Validate environment first
  validateEnvironment();
  
  return {
    // Supabase
    supabaseUrl: import.meta.env.PUBLIC_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    
    // Application
    siteUrl: import.meta.env.PUBLIC_SITE_URL,
    nodeEnv: (import.meta.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    
    // External Services
    mapboxToken: import.meta.env.MAPBOX_ACCESS_TOKEN || import.meta.env.PUBLIC_MAPBOX_ACCESS_TOKEN,
    resendApiKey: import.meta.env.RESEND_API_KEY,
    resendFromEmail: import.meta.env.RESEND_FROM_EMAIL,
    notificationEmail: import.meta.env.YOUR_NOTIFICATION_EMAIL,
    
    // Stripe
    stripeSecretKey: import.meta.env.STRIPE_SECRET_KEY,
    stripePublishableKey: import.meta.env.PUBLIC_STRIPE_PUBLISHABLE_KEY,
    stripeWebhookSecret: import.meta.env.STRIPE_WEBHOOK_SECRET,
    
    // Optional: SMS/Phone
    telnyxApiKey: import.meta.env.TELNYX_API_KEY,
    telnyxWebhookSecret: import.meta.env.TELNYX_WEBHOOK_SECRET
  };
}

/**
 * Validate Stripe configuration
 * @throws Error if Stripe keys are misconfigured
 */
export function validateStripeConfig(): void {
  const config = getConfig();
  
  // Check if using test vs live keys consistently
  const isSecretTest = config.stripeSecretKey.startsWith('sk_test_');
  const isPublishableTest = config.stripePublishableKey.startsWith('pk_test_');
  
  if (isSecretTest !== isPublishableTest) {
    throw new Error(
      'Stripe key mismatch: secret and publishable keys must both be test keys or both be live keys.\n' +
      `Secret key type: ${isSecretTest ? 'test' : 'live'}\n` +
      `Publishable key type: ${isPublishableTest ? 'test' : 'live'}`
    );
  }
  
  // Warn if using live keys in development
  if (config.nodeEnv === 'development' && !isSecretTest) {
    console.warn(
      '⚠️  WARNING: Using live Stripe keys in development environment!\n' +
      '   This could result in real charges. Consider using test keys for development.'
    );
  }
}

/**
 * Get environment-specific database URL
 * Prioritizes DATABASE_URL, falls back to Supabase URL
 */
export function getDatabaseUrl(): string {
  const databaseUrl = import.meta.env.DATABASE_URL;
  if (databaseUrl) {
    return databaseUrl;
  }
  
  // Fallback to constructing from Supabase URL if needed
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    // Extract project ref from Supabase URL for database connection
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (projectRef) {
      // Note: This is a fallback - in production you should set DATABASE_URL explicitly
      console.warn('DATABASE_URL not set, constructing from Supabase URL. Set DATABASE_URL for production.');
      return `postgresql://postgres.${projectRef}:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:6543/postgres`;
    }
  }
  
  throw new Error('DATABASE_URL or PUBLIC_SUPABASE_URL must be set');
}

/**
 * Utility to check if running in production
 */
export const isProduction = (): boolean => getConfig().nodeEnv === 'production';

/**
 * Utility to check if running in development
 */
export const isDevelopment = (): boolean => getConfig().nodeEnv === 'development';

// Initialize and validate environment on module load
try {
  validateEnvironment();
  validateStripeConfig();
} catch (error) {
  console.error('Environment validation failed:', error);
  // In development, log the error but don't crash
  // In production, this should crash the app to prevent misconfiguration
  if (typeof import.meta.env !== 'undefined' && import.meta.env.NODE_ENV === 'production') {
    throw error;
  }
}