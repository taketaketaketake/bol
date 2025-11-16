import { AccessToken } from "livekit-server-sdk";

export async function createAgentToken(identity: string = "voice-agent") {
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;

  const token = new AccessToken(apiKey, apiSecret, { identity });

  token.addGrant({
    roomJoin: true,
    room: "twilio-test",
    canPublish: true,
    canSubscribe: true,
  });

  return await token.toJwt(); // 👈 await here
}
