#!/usr/bin/env node

// Production startup script for SvelteKit app
// This script ensures the app runs on port 8004 in production

process.env.PORT = '8004';
process.env.HOST = '0.0.0.0';

// Import and start the built application
import('./build/index.js').then(() => {
  console.log('SvelteKit app started on port 8004');
}).catch(error => {
  console.error('Failed to start SvelteKit app:', error);
  process.exit(1);
});
