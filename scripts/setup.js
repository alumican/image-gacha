#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';
import { execSync } from 'child_process';

// Default port configurations
const DEFAULT_FRONTEND_PORT = 5173;
const DEFAULT_BACKEND_PORT = 3001;
const DEFAULT_FRONTEND_URL = `http://localhost:${DEFAULT_FRONTEND_PORT}`;
const DEFAULT_BACKEND_URL = `http://localhost:${DEFAULT_BACKEND_PORT}`;

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


/**
 * Check Node.js version (requires 18+)
 */
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  
  if (majorVersion < 18) {
    console.error('❌ Error: Node.js version 18 or higher is required.');
    console.error(`Current version: ${nodeVersion}`);
    process.exit(1);
  }
  
  console.log(`✓ Node.js ${nodeVersion} detected`);
  console.log('');
}

/**
 * Install dependencies using npm
 */
function installDependencies(directory, name) {
  try {
    console.log(`📦 Installing ${name} dependencies...`);
    execSync('npm install', { 
      cwd: directory, 
      stdio: 'inherit',
      encoding: 'utf-8'
    });
    console.log(`✓ ${name} dependencies installed`);
    console.log('');
    return true;
  } catch (error) {
    console.error(`❌ Failed to install ${name} dependencies`);
    return false;
  }
}

async function main() {
  console.log('==========================================');
  console.log('Image Gacha - Setup');
  console.log('==========================================');
  console.log('');
  
  // Check Node.js version
  checkNodeVersion();
  
  // Install client dependencies
  if (!installDependencies(rootDir, 'client')) {
    process.exit(1);
  }
  
  // Install server dependencies
  const serverDir = join(rootDir, 'server');
  if (!existsSync(serverDir)) {
    console.error('❌ Error: server directory not found');
    console.error('Please make sure you\'re running this script from the app directory');
    process.exit(1);
  }
  
  if (!installDependencies(serverDir, 'server')) {
    process.exit(1);
  }
  
  // Configure API key
  console.log('⚙️  Configuring API key...');
  
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

# API Server URL (default: ${DEFAULT_BACKEND_URL})
VITE_API_URL=${DEFAULT_BACKEND_URL}

# Frontend URL (default: ${DEFAULT_FRONTEND_URL})
VITE_FRONTEND_URL=${DEFAULT_FRONTEND_URL}
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
    envContent += `\n# API Server URL (default: ${DEFAULT_BACKEND_URL})\nVITE_API_URL=${DEFAULT_BACKEND_URL}\n`;
  }
  if (!envContent.includes('VITE_FRONTEND_URL=')) {
    envContent += `\n# Frontend URL (default: ${DEFAULT_FRONTEND_URL})\nVITE_FRONTEND_URL=${DEFAULT_FRONTEND_URL}\n`;
  }
  
  // Write .env.local
  writeFileSync(envLocalPath, envContent, 'utf-8');
  
  console.log('');
  console.log('==========================================');
  console.log('✓ Setup complete!');
  console.log('==========================================');
  console.log('');
  console.log(`   Created ${envLocalPath}`);
  console.log('\nNote: To change API server URL or frontend URL, edit .env.local');
  console.log('\nNext steps:');
  console.log('   1. Run "./launch.sh" to start the application');
  console.log('   2. Or run "npm run dev:all" manually');
  console.log('');
  
  rl.close();
}

main().catch((error) => {
  console.error('\nSetup failed:', error.message);
  rl.close();
  process.exit(1);
});
