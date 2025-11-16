import { AccessToken } from 'livekit-server-sdk';
import { ENV } from '../config/env.js';

/**
 * Creates a LiveKit access token for the voice agent
 */
export function createAgentToken(room: string = ENV.AGENT_ROOM || 'twilio-test'): string {
  const token = new AccessToken(ENV.LIVEKIT_API_KEY, ENV.LIVEKIT_API_SECRET, {
    identity: ENV.AGENT_NAME,
    name: 'Bags of Laundry Voice Agent',
  });

  token.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return token.toJwt();
}

/**
 * LiveKit connection configuration
 */
export const livekitConfig = {
  url: ENV.LIVEKIT_URL,
  apiKey: ENV.LIVEKIT_API_KEY,
  apiSecret: ENV.LIVEKIT_API_SECRET,
} as const;