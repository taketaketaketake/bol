import WebSocket from 'ws';
import { ENV } from '../config/env.js';
import type { RealtimeEvent, OpenAIVoice, LaundryTool } from '../../types/voice.js';

export class OpenAIRealtimeSession {
  private ws: WebSocket | null = null;
  private eventListeners: Map<string, ((event: RealtimeEvent) => void)[]> = new Map();
  private isConnected = false;

  constructor(private voice: OpenAIVoice = ENV.DEFAULT_VOICE as OpenAIVoice) {}

  /**
   * Connect to OpenAI Realtime API
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
      
      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${ENV.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      this.ws.on('open', () => {
        console.log('🤖 Connected to OpenAI Realtime API');
        this.isConnected = true;
        this.initializeSession();
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const event: RealtimeEvent = JSON.parse(data.toString());
          this.handleEvent(event);
        } catch (error) {
          console.error('Failed to parse OpenAI event:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('OpenAI WebSocket error:', error);
        this.isConnected = false;
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('🔴 OpenAI Realtime connection closed');
        this.isConnected = false;
      });
    });
  }

  /**
   * Initialize the session with configuration
   */
  private initializeSession(): void {
    this.sendEvent({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.getSystemInstructions(),
        voice: this.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        tools: this.getLaundryTools(),
        tool_choice: 'auto',
        temperature: 0.7,
        max_response_output_tokens: 4096
      }
    });
  }

  /**
   * System instructions for the voice agent
   */
  private getSystemInstructions(): string {
    return `You are a helpful voice assistant for Bags of Laundry, a premium laundry pickup and delivery service in Detroit.

Key information:
- Service areas: Detroit metro area (~30 miles from downtown)
- Pricing: $2.25/lb standard, $1.75/lb for members
- Membership: $49.99 for 6 months with discounted rates
- Services: Wash & fold, dry cleaning, commercial laundry
- Typical turnaround: 24-48 hours

Guidelines:
- Be warm, professional, and concise
- Always confirm details before booking
- If you need to check availability or schedule pickup, use the provided tools
- For complex issues, offer to transfer to a human agent
- Keep responses under 30 seconds when speaking

Common requests:
- Schedule pickup: Ask for address, preferred date/time
- Pricing questions: Explain per-pound vs membership pricing
- Service areas: Confirm if we serve their location
- Order status: Help track existing orders

Remember: You're speaking, not typing. Use conversational language.`;
  }

  /**
   * Define tools the agent can use for business operations
   */
  private getLaundryTools(): LaundryTool[] {
    return [
      {
        name: 'check_availability',
        description: 'Check if we service an address and get available pickup times',
        parameters: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Full address or ZIP code to check'
            },
            date: {
              type: 'string',
              description: 'Preferred pickup date (YYYY-MM-DD format)'
            }
          },
          required: ['address']
        }
      },
      {
        name: 'get_pricing',
        description: 'Get current pricing information',
        parameters: {
          type: 'object',
          properties: {
            weight: {
              type: 'number',
              description: 'Estimated weight in pounds (optional)'
            },
            isMember: {
              type: 'boolean',
              description: 'Whether customer has active membership'
            }
          },
          required: []
        }
      },
      {
        name: 'schedule_pickup',
        description: 'Schedule a laundry pickup (only after confirming availability)',
        parameters: {
          type: 'object',
          properties: {
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            address: { type: 'string' },
            date: { type: 'string' },
            timeWindow: { type: 'string' },
            specialInstructions: { type: 'string' }
          },
          required: ['customerName', 'customerPhone', 'address', 'date', 'timeWindow']
        }
      }
    ];
  }

  /**
   * Send audio data to OpenAI for processing
   */
  sendAudio(audioData: string): void {
    if (!this.isConnected) return;
    
    this.sendEvent({
      type: 'input_audio_buffer.append',
      audio: audioData
    });
  }

  /**
   * Commit audio buffer for processing
   */
  commitAudio(): void {
    if (!this.isConnected) return;
    
    this.sendEvent({
      type: 'input_audio_buffer.commit'
    });
  }

  /**
   * Send an event to OpenAI
   */
  private sendEvent(event: RealtimeEvent): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(event));
    }
  }

  /**
   * Handle incoming events from OpenAI
   */
  private handleEvent(event: RealtimeEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach(listener => listener(event));

    // Log important events
    if (event.type === 'error') {
      console.error('OpenAI error:', event);
    }
  }

  /**
   * Register event listener
   */
  on(eventType: string, listener: (event: RealtimeEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * Change voice during conversation
   */
  changeVoice(newVoice: OpenAIVoice): void {
    this.voice = newVoice;
    this.sendEvent({
      type: 'session.update',
      session: {
        voice: newVoice
      }
    });
  }

  /**
   * Interrupt current response
   */
  interrupt(): void {
    this.sendEvent({
      type: 'response.cancel'
    });
  }

  /**
   * Disconnect from OpenAI
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
}