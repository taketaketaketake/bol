import { AccessToken } from "livekit-server-sdk"

export function createLiveKitToken(identity: string) {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
    identity,
  })
  at.addGrant({ roomJoin: true, room: "voice-agent" })
  return at.toJwt()
}
