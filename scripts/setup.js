#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const envLocalPath = join(rootDir, '.env.local');
const envExamplePath = join(rootDir, '.env.example');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper function to ask questions
function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}


async function main() {
  console.log('Setup - Image Gacha\n');
  
  // Check if .env.local already exists
  if (existsSync(envLocalPath)) {
    const overwrite = await question('.env.local already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      rl.close();
      return;
    }
  }
  
  // Read .env.example if it exists
  let envContent = '';
  if (existsSync(envExamplePath)) {
    envContent = readFileSync(envExamplePath, 'utf-8');
  } else {
    // Default template
    envContent = `# Gemini API Configuration
VITE_GEMINI_API_KEY=

# API Server URL (default: http://localhost:3001)
VITE_API_URL=http://localhost:3001

# Frontend URL (default: http://localhost:5173)
VITE_FRONTEND_URL=http://localhost:5173
`;
  }
  
  // Get API key
  const apiKey = await question('Gemini API Key (required): ');
  if (!apiKey.trim()) {
    console.error('\nAPI key is required. Setup cancelled.');
    rl.close();
    process.exit(1);
  }
  
  // Replace API key in envContent (URLs use defaults)
  envContent = envContent.replace(
    /VITE_GEMINI_API_KEY=.*/,
    `VITE_GEMINI_API_KEY=${apiKey.trim()}`
  );
  
  // Ensure URLs are set to defaults if not present
  if (!envContent.includes('VITE_API_URL=')) {
    envContent += '\n# API Server URL (default: http://localhost:3001)\nVITE_API_URL=http://localhost:3001\n';
  }
  if (!envContent.includes('VITE_FRONTEND_URL=')) {
    envContent += '\n# Frontend URL (default: http://localhost:5173)\nVITE_FRONTEND_URL=http://localhost:5173\n';
  }
  
  // Write .env.local
  writeFileSync(envLocalPath, envContent, 'utf-8');
  
  console.log('\nSetup complete!');
  console.log(`   Created ${envLocalPath}`);
  console.log('\nNote: To change API server URL or frontend URL, edit .env.local');
  console.log('\nNext steps:');
  console.log('   1. Run "npm run dev:all" to start the application');
  console.log('   2. Open http://localhost:5173 in your browser\n');
  
  rl.close();
}

main().catch((error) => {
  console.error('\nSetup failed:', error.message);
  rl.close();
  process.exit(1);
});
