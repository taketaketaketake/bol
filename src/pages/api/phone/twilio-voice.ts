// src/pages/api/phone/twilio-voice.ts
import type { APIRoute } from "astro";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse.js";
import { AccessToken } from "livekit-server-sdk";

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const from = formData.get("From");
    const to = formData.get("To");

    console.log("📞 Incoming call from:", from, "to:", to);

    // Create unique room name using caller number
    const callerNumber = from?.toString().replace(/[^\d]/g, '') || 'unknown';
    const callSid = formData.get('CallSid');
    const roomName = `call-${callerNumber}-${Date.now()}`;
    
    console.log("🏠 Creating room for SIP:", roomName, "for CallSid:", callSid);

    const twiml = new VoiceResponse();
    
    // Use SIP dial instead of WebSocket streaming
    const dial = twiml.dial({
      answerOnBridge: true,
      ringTone: 'us'
    });
    
    // SIP URI format: sip:username@domain
    const sipUri = `sip:${roomName}@${process.env.LIVEKIT_SIP_DOMAIN || 'sip.livekit.cloud'}`;
    
    dial.sip({
      uri: sipUri,
      username: process.env.LIVEKIT_SIP_USERNAME || 'bags-laundry-sip',
      password: process.env.LIVEKIT_SIP_PASSWORD || 'secure-sip-password-2024'
    });

    return new Response(twiml.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("❌ Twilio Voice error:", err);
    return new Response("<Response><Say>Error processing request</Say></Response>", {
      headers: { "Content-Type": "text/xml" },
      status: 500,
    });
  }
};
