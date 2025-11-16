// OpenAI Realtime API types
export interface RealtimeEvent {
  type: string;
  event_id?: string;
  [key: string]: any;
}

export interface AudioData {
  audio: string; // base64 encoded audio
  delta?: string; // for streaming audio chunks
}

export interface ConversationItem {
  id: string;
  type: 'message' | 'function_call' | 'function_call_output';
  role: 'user' | 'assistant' | 'system';
  content?: Array<{
    type: 'text' | 'audio';
    text?: string;
    audio?: string;
  }>;
}

// Agent types
export interface AgentSession {
  sessionId: string;
  roomName: string;
  participantId: string;
  startTime: Date;
  endTime?: Date;
}

export interface ConversationContext {
  customerPhone?: string;
  customerName?: string;
  intent?: 'scheduling' | 'pricing' | 'support' | 'general';
  orderInProgress?: {
    address?: string;
    date?: string;
    timeWindow?: string;
  };
}

// Available OpenAI voices
export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// Tool definitions for function calling
export interface LaundryTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  id: string;
  result: any;
  error?: string;
}