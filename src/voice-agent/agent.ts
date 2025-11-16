import { defineAgent, type JobContext } from '@livekit/agents';
import { OpenAIRealtimeSession } from './services/openai-realtime.js';
import { ENV } from './config/env.js';
import type { OpenAIVoice, ConversationContext, ToolCall } from '../types/voice.js';
import { setupLoopbackAudio } from './audioLoopback.js';

/**
 * Session tracking for monitoring active calls
 */
class SessionTracker {
  private static activeSessions = new Map<string, Date>();
  
  static startSession(sessionId: string) {
    this.activeSessions.set(sessionId, new Date());
    console.log(`📊 Active sessions: ${this.activeSessions.size}`);
  }
  
  static endSession(sessionId: string) {
    const startTime = this.activeSessions.get(sessionId);
    if (startTime) {
      const duration = Date.now() - startTime.getTime();
      console.log(`⏱️ Session ${sessionId} duration: ${Math.round(duration / 1000)}s`);
      this.activeSessions.delete(sessionId);
    }
    console.log(`📊 Active sessions: ${this.activeSessions.size}`);
  }
}

/**
 * Resilient OpenAI session with reconnection capability
 */
class ResilientOpenAISession extends OpenAIRealtimeSession {
  private conversationBuffer: string[] = [];
  
  async connect(): Promise<void> {
    try {
      await super.connect();
    } catch (error) {
      console.error('OpenAI connection failed:', error);
      throw error; // For now, re-throw - we'll add retry logic later
    }
  }

  // Store conversation for recovery
  on(eventType: string, listener: Function) {
    if (eventType === 'conversation.item.input_audio_transcription.completed') {
      const originalListener = listener;
      listener = (event: any) => {
        this.conversationBuffer.push(event.transcript);
        originalListener(event);
      };
    }
    super.on(eventType, listener);
  }
}

/**
 * Main voice agent implementation using LiveKit Agents framework
 */
const voiceAgent = defineAgent({
  name: ENV.AGENT_NAME,
  metadata: {
    description: 'Bags of Laundry voice assistant for pickup scheduling and customer service',
    version: '1.0.0',
  },
  
  async run(ctx: JobContext) {
    const roomName = ctx.room.name;
    
    // Room Name Parsing - Only join phone call rooms
    if (!roomName.startsWith('call-')) {
      console.log(`⏭️ Skipping non-phone room: ${roomName}`);
      return;
    }
    
    // Extract call SID for tracking
    const callSid = roomName.replace('call-', '');
    
    // Session Registration
    console.log(`🎙️ Starting loopback test for room: ${roomName}`);
    console.log(`📞 Call SID: ${callSid}`);
    
    // Session Tracker Start
    SessionTracker.startSession(roomName);

    try {
      // Step 3A: Audio Loopback Test (temporarily replacing OpenAI pipeline)
      console.log(`🔊 Setting up audio loopback for call: ${callSid}`);
      setupLoopbackAudio(ctx);
      
      // Wait for participants and start loopback test
      await waitForParticipant(ctx);
      
      console.log(`✅ Audio loopback active for call: ${callSid} - speak to test echo`);
      
      // Lifecycle Handling - Keep running until call ends
      await ctx.room.waitForDisconnect();
      
    } catch (error) {
      console.error(`❌ Loopback test error for call ${callSid}:`, error);
    } finally {
      // Clean disconnection
      SessionTracker.endSession(roomName);
      console.log(`🔴 Loopback test ended for call: ${callSid}`);
    }
  }
});

/**
 * Wait for a participant to join the room
 */
async function waitForParticipant(ctx: JobContext): Promise<void> {
  // If participants already exist, return immediately
  if (ctx.room.participants.size > 0) {
    return;
  }
  
  // Otherwise wait for the first participant
  return new Promise((resolve) => {
    const handleParticipantConnected = () => {
      ctx.room.off('participantConnected', handleParticipantConnected);
      resolve();
    };
    
    ctx.room.on('participantConnected', handleParticipantConnected);
  });
}

/**
 * Set up event handlers for the voice conversation
 */
function setupEventHandlers(
  ctx: JobContext, 
  realtimeSession: OpenAIRealtimeSession, 
  conversationContext: ConversationContext
): void {
  
  // Handle incoming audio from participants
  ctx.room.on('trackSubscribed', (track, publication, participant) => {
    if (track.kind === 'audio' && participant.identity !== ENV.AGENT_NAME) {
      console.log(`🎤 Subscribed to audio from: ${participant.identity}`);
      
      // Convert LiveKit audio to PCM16 format for OpenAI
      // TODO: Implement audio processing pipeline
      // This would involve reading track frames and converting to base64 PCM16
    }
  });

  // Handle participant events
  ctx.room.on('participantConnected', (participant) => {
    console.log(`👤 Participant joined: ${participant.identity}`);
    
    // Send welcome message
    setTimeout(() => {
      sendWelcomeMessage(realtimeSession, conversationContext);
    }, 1000);
  });

  ctx.room.on('participantDisconnected', (participant) => {
    console.log(`👋 Participant left: ${participant.identity}`);
  });

  // Handle OpenAI events
  realtimeSession.on('response.audio.delta', (event) => {
    // Handle streaming audio response from OpenAI
    // TODO: Convert base64 PCM16 to LiveKit audio frames and publish
    console.log('🔊 Received audio delta from OpenAI');
  });

  realtimeSession.on('response.text.delta', (event) => {
    // Handle text responses (for debugging/logging)
    if (event.delta) {
      process.stdout.write(event.delta);
    }
  });

  realtimeSession.on('response.function_call', (event) => {
    // Handle function calls (business logic)
    handleFunctionCall(event, conversationContext, realtimeSession);
  });

  realtimeSession.on('conversation.item.input_audio_transcription.completed', (event) => {
    // Log user speech transcription
    console.log(`👤 User said: "${event.transcript}"`);
  });

  realtimeSession.on('error', (event) => {
    console.error('OpenAI Realtime error:', event.error);
  });
}

/**
 * Send initial welcome message
 */
function sendWelcomeMessage(
  realtimeSession: OpenAIRealtimeSession, 
  conversationContext: ConversationContext
): void {
  const welcomeMessage = conversationContext.customerPhone 
    ? `Hi! This is Bags of Laundry. How can I help you today?`
    : `Hello! You've reached Bags of Laundry, Detroit's premium pickup and delivery laundry service. How can I assist you?`;

  // Send text to OpenAI to generate welcome audio
  // TODO: Implement text-to-speech generation
  console.log(`🤖 Welcome: ${welcomeMessage}`);
}

/**
 * Handle function calls from OpenAI (business operations)
 */
async function handleFunctionCall(
  event: any,
  conversationContext: ConversationContext,
  realtimeSession: OpenAIRealtimeSession
): Promise<void> {
  const { call_id, name, arguments: args } = event;
  
  console.log(`🔧 Function call: ${name}`, args);
  
  try {
    let result: any;
    
    switch (name) {
      case 'check_availability':
        result = await checkAvailability(args.address, args.date);
        break;
        
      case 'get_pricing':
        result = await getPricing(args.weight, args.isMember);
        break;
        
      case 'schedule_pickup':
        result = await schedulePickup(args, conversationContext);
        break;
        
      default:
        throw new Error(`Unknown function: ${name}`);
    }
    
    // Send function result back to OpenAI
    realtimeSession.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id,
        output: JSON.stringify(result)
      }
    });
    
  } catch (error) {
    console.error(`Function call error (${name}):`, error);
    
    // Send error back to OpenAI
    realtimeSession.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id,
        output: JSON.stringify({ error: error.message })
      }
    });
  }
}

/**
 * Check availability for an address and date
 */
async function checkAvailability(address: string, date?: string): Promise<any> {
  // TODO: Integrate with existing /api/check-availability.ts
  console.log(`Checking availability for ${address} on ${date || 'any date'}`);
  
  // Mock response for now
  return {
    available: true,
    address,
    timeWindows: [
      { id: 'morning', label: 'Morning (8AM-12PM)', available: true },
      { id: 'afternoon', label: 'Afternoon (12PM-4PM)', available: true },
      { id: 'evening', label: 'Evening (4PM-8PM)', available: false }
    ]
  };
}

/**
 * Get pricing information
 */
async function getPricing(weight?: number, isMember?: boolean): Promise<any> {
  // TODO: Integrate with existing pricing utilities
  const baseRate = isMember ? 1.75 : 2.25;
  const estimatedWeight = weight || 15; // Default estimate
  
  return {
    baseRate,
    isMember,
    estimatedWeight,
    estimatedCost: baseRate * estimatedWeight,
    minimum: 35,
    membershipPrice: 49.99,
    membershipBenefits: 'Save $0.50/lb + access to per-bag pricing'
  };
}

/**
 * Schedule a pickup
 */
async function schedulePickup(args: any, context: ConversationContext): Promise<any> {
  // TODO: Integrate with existing /api/create-order.ts
  console.log('Scheduling pickup:', args);
  
  // Mock response for now
  return {
    success: true,
    orderId: 'ORDER_' + Math.random().toString(36).substr(2, 9),
    message: `Pickup scheduled for ${args.date} at ${args.address}. We'll send a confirmation text to ${args.customerPhone}.`
  };
}

/**
 * Extract phone number from room name (if following a pattern)
 */
function extractPhoneFromRoom(roomName: string): string | undefined {
  // Room names might include phone numbers, e.g., "call-+13135551234"
  const phoneMatch = roomName.match(/\+?1?(\d{10})/);
  return phoneMatch ? phoneMatch[1] : undefined;
}

// Default export for LiveKit Agents CLI
export default voiceAgent;