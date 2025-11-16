import { defineAgent } from '@livekit/agents';

// Simple voice agent for testing SIP integration
export default defineAgent({
  name: 'simple-voice-agent',
  async run(ctx) {
    const roomName = ctx.room.name;
    console.log(`🎙️ Agent joined room: ${roomName}`);
    
    // Only handle phone call rooms
    if (!roomName.startsWith('call-')) {
      console.log(`⏭️ Skipping non-phone room: ${roomName}`);
      return;
    }
    
    console.log(`📞 Phone call detected in room: ${roomName}`);
    console.log(`👥 Current participants: ${ctx.room.participants.size}`);
    
    // Wait for participants to join
    ctx.room.on('participantConnected', (participant) => {
      console.log(`👤 Participant joined: ${participant.identity}`);
    });
    
    ctx.room.on('participantDisconnected', (participant) => {
      console.log(`👋 Participant left: ${participant.identity}`);
    });
    
    // Log audio tracks
    ctx.room.on('trackSubscribed', (track, publication, participant) => {
      if (track.kind === 'audio') {
        console.log(`🎤 Audio track from: ${participant.identity}`);
      }
    });
    
    // Keep the agent running until the room disconnects
    console.log(`✅ Voice agent active for: ${roomName}`);
    await ctx.room.waitForDisconnect();
    console.log(`🔴 Call ended: ${roomName}`);
  }
});