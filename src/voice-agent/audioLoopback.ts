import { tts, type JobContext } from "@livekit/agents";
// AudioSource and AudioFrame are in the tts module
const { AudioSource } = tts;

/**
 * Simple audio loopback for testing LiveKit audio pipeline
 * Captures caller audio and immediately plays it back (echo test)
 */
export function setupLoopbackAudio(ctx: JobContext) {
  console.log("🔄 Setting up audio loopback test...");
  
  // Create audio source for playback at 24kHz
  const audioSource = new AudioSource(24000);
  
  // Publish the audio track to the room
  const loopbackTrack = ctx.room.localParticipant.publishAudioTrack(audioSource);
  console.log("📢 Published loopback audio track");

  // Listen for incoming audio tracks
  ctx.room.on("trackSubscribed", (track, publication, participant) => {
    if (track.kind === "audio" && participant.identity !== ctx.room.localParticipant.identity) {
      console.log(`🎧 Loopback: audio track subscribed from ${participant.identity}`);

      // Set up frame handler for immediate echo
      track.onFrame = (frame: any) => {
        try {
          // Immediately play back the frame data
          audioSource.captureFrame(frame);
          
          // Optional: Log periodic frame info
          if (Math.random() < 0.01) { // 1% sampling to avoid spam
            console.log(`🔊 Loopback frame: ${frame.data?.length || 'unknown'} bytes`);
          }
        } catch (error) {
          console.error("❌ Loopback frame error:", error);
        }
      };
    }
  });

  // Handle participant events for debugging
  ctx.room.on("participantConnected", (participant) => {
    console.log(`👤 Participant joined loopback test: ${participant.identity}`);
  });

  ctx.room.on("participantDisconnected", (participant) => {
    console.log(`👋 Participant left loopback test: ${participant.identity}`);
  });

  console.log("✅ Audio loopback setup complete - ready for echo test");
}