#!/usr/bin/env node

import { cli, WorkerOptions } from '@livekit/agents';
import { fileURLToPath } from 'node:url';
import { ENV } from './config/env.js';

/**
 * Main entry point for the voice agent
 * Uses LiveKit Agents CLI for production deployment
 */
async function main() {
  console.log('🎙️ Starting Bags of Laundry Voice Agent...');
  console.log(`Environment: ${ENV.NODE_ENV}`);
  console.log(`LiveKit URL: ${ENV.LIVEKIT_URL}`);
  console.log(`Agent Name: ${ENV.AGENT_NAME}`);
  console.log(`Default Voice: ${ENV.DEFAULT_VOICE}`);

  // Start the agent using LiveKit CLI in development mode  
  // For testing: connect to a specific room
  process.argv.push('connect');
  process.argv.push('--room', 'call-test'); // Test room
  
  cli.runApp(new WorkerOptions({
    agent: fileURLToPath(new URL('./agent.ts', import.meta.url))
  }));
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down voice agent...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down voice agent...');
  process.exit(0);
});

// Run the agent
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Voice agent failed to start:', error);
    process.exit(1);
  });
}