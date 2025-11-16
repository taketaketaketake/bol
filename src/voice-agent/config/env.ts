import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const ENV = {
  // LiveKit Configuration
  LIVEKIT_URL: required('LIVEKIT_URL'),
  LIVEKIT_API_KEY: required('LIVEKIT_API_KEY'),
  LIVEKIT_API_SECRET: required('LIVEKIT_API_SECRET'),

  // OpenAI Configuration
  OPENAI_API_KEY: required('OPENAI_API_KEY'),

  // Agent Configuration
  AGENT_NAME: optional('AGENT_NAME', 'bags-laundry-agent'),
  DEFAULT_VOICE: optional('DEFAULT_VOICE', 'alloy'),
  LOG_LEVEL: optional('LOG_LEVEL', 'info'),

  // Runtime
  NODE_ENV: optional('NODE_ENV', 'development'),
} as const;