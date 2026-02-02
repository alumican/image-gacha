#!/usr/bin/env node

/**
 * Launch script - Start development servers and open browser
 * Checks for existing servers and only starts what's needed
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn, exec } from 'child_process';
import readline from 'readline';
import { promisify } from 'util';
import { createConnection } from 'net';
import http from 'http';

const execAsync = promisify(exec);

// Default port configurations
const DEFAULT_FRONTEND_PORT = 5173;
const DEFAULT_BACKEND_PORT = 3001;
const DEFAULT_FRONTEND_URL = `http://localhost:${DEFAULT_FRONTEND_PORT}`;
const DEFAULT_BACKEND_URL = `http://localhost:${DEFAULT_BACKEND_PORT}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const envLocalPath = join(rootDir, '.env.local');
const serverDir = join(rootDir, 'server');

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
 * Extract port number from URL
 */
function extractPort(url, defaultPort) {
  if (!url) return defaultPort;
  const match = url.match(/^https?:\/\/[^:]+:(\d+)/);
  return match ? parseInt(match[1], 10) : defaultPort;
}

/**
 * Read value from .env.local
 */
function readEnvValue(key, defaultValue) {
  if (!existsSync(envLocalPath)) {
    return defaultValue;
  }
  
  try {
    const content = readFileSync(envLocalPath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [envKey, ...valueParts] = trimmed.split('=');
      if (envKey.trim() === key) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (value) return value;
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return defaultValue;
}

/**
 * Check if a port is in use
 */
async function checkPort(port) {
  try {
    // Try using lsof (macOS/Linux)
    try {
      await execAsync(`lsof -i :${port}`);
      return true;
    } catch {
      // lsof not available or port not in use
    }
    
    // Try using netstat (Linux)
    try {
      await execAsync(`netstat -an | grep ":${port}.*LISTEN"`);
      return true;
    } catch {
      // netstat not available or port not in use
    }
    
    // Try connecting to the port
    return new Promise((resolve) => {
      const socket = createConnection(port, 'localhost');
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        resolve(false);
      });
      setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 100);
    });
  } catch {
    return false;
  }
}

/**
 * Wait for a port to become available
 */
async function waitForPort(port, maxWait = 30) {
  for (let i = 0; i < maxWait; i++) {
    if (await checkPort(port)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

/**
 * Wait for HTTP server to be ready (responds to requests)
 */
async function waitForHttpServer(url, maxWait = 30) {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;
  const port = urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80);
  const path = urlObj.pathname || '/';
  
  for (let i = 0; i < maxWait; i++) {
    try {
      const ready = await new Promise((resolve) => {
        const req = http.request({
          hostname,
          port,
          path,
          method: 'HEAD',
          timeout: 2000,
        }, (res) => {
          // Any response (even 404) means server is ready
          resolve(true);
        });
        
        req.on('error', () => {
          resolve(false);
        });
        
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        
        req.end();
      });
      
      if (ready) {
        return true;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

/**
 * Open browser (cross-platform)
 */
function openBrowser(url) {
  const platform = process.platform;
  let command;
  
  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'linux') {
    command = `xdg-open "${url}" || gnome-open "${url}" || echo "⚠️  Could not automatically open browser. Please open ${url} manually"`;
  } else {
    console.log(`⚠️  Unsupported OS. Please open ${url} manually`);
    return;
  }
  
  setTimeout(() => {
    exec(command, (error) => {
      if (error) {
        console.log(`⚠️  Could not automatically open browser. Please open ${url} manually`);
      }
    });
  }, 1000);
}

/**
 * Cleanup function
 */
function cleanup(processes) {
  console.log('');
  console.log('Stopping servers...');
  processes.forEach(proc => {
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
    }
  });
  rl.close();
  process.exit(0);
}

async function main() {
  console.log('==========================================');
  console.log('Image Gacha - Launch');
  console.log('==========================================');
  console.log('');
  
  // Check if .env.local exists
  if (!existsSync(envLocalPath)) {
    console.log('⚠️  Warning: .env.local not found.');
    console.log('Please run "./setup.sh" first to configure the API key.');
    console.log('');
    const answer = await question('Do you want to run setup now? (y/N): ');
    console.log('');
    if (answer.toLowerCase() === 'y') {
      const setupProcess = spawn('npm', ['run', 'setup'], {
        stdio: 'inherit',
        shell: true,
        cwd: rootDir,
      });
      await new Promise((resolve, reject) => {
        setupProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Setup failed with code ${code}`));
          }
        });
        setupProcess.on('error', reject);
      });
    } else {
      console.log('Setup cancelled. Exiting.');
      rl.close();
      process.exit(1);
    }
  }
  
  // Read port configurations from .env.local
  const viteFrontendUrl = readEnvValue('VITE_FRONTEND_URL', DEFAULT_FRONTEND_URL);
  const viteApiUrl = readEnvValue('VITE_API_URL', DEFAULT_BACKEND_URL);
  
  // Extract ports from URLs
  const frontendPort = extractPort(viteFrontendUrl, DEFAULT_FRONTEND_PORT);
  const backendPort = extractPort(viteApiUrl, DEFAULT_BACKEND_PORT);
  
  // Check if servers are already running
  const viteRunning = await checkPort(frontendPort);
  const serverRunning = await checkPort(backendPort);
  
  if (viteRunning) {
    console.log(`✓ Vite server is already running on port ${frontendPort}`);
  } else {
    console.log('○ Vite server is not running');
  }
  
  if (serverRunning) {
    console.log(`✓ Backend server is already running on port ${backendPort}`);
  } else {
    console.log('○ Backend server is not running');
  }
  
  console.log('');
  
  // Start servers if needed
  const processes = [];
  let startedVite = false;
  let startedServer = false;
  
  if (!viteRunning) {
    console.log('🚀 Starting Vite server...');
    const viteProcess = spawn('npm', ['run', 'dev'], {
      cwd: rootDir,
      stdio: 'pipe',
      shell: true,
    });
    processes.push(viteProcess);
    startedVite = true;
  }
  
  if (!serverRunning) {
    console.log('🚀 Starting backend server...');
    const serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: serverDir,
      stdio: 'pipe',
      shell: true,
    });
    processes.push(serverProcess);
    startedServer = true;
  }
  
  // Wait for servers to be ready
  if (!viteRunning || !serverRunning) {
    console.log('');
    console.log('⏳ Waiting for servers to start...');
    
    if (!viteRunning) {
      const portReady = await waitForPort(frontendPort);
      if (portReady) {
        console.log('✓ Vite server port is open');
        // Wait for HTTP server to be ready
        console.log('⏳ Waiting for Vite server to respond...');
        const httpReady = await waitForHttpServer(viteFrontendUrl);
        if (httpReady) {
          console.log('✓ Vite server is ready');
        } else {
          console.log('⚠️  Vite server port is open but not responding yet');
        }
      } else {
        console.log('⚠️  Vite server failed to start');
      }
    }
    
    if (!serverRunning) {
      const portReady = await waitForPort(backendPort);
      if (portReady) {
        console.log('✓ Backend server port is open');
        // Wait for HTTP server to be ready
        console.log('⏳ Waiting for backend server to respond...');
        const httpReady = await waitForHttpServer(viteApiUrl);
        if (httpReady) {
          console.log('✓ Backend server is ready');
        } else {
          console.log('⚠️  Backend server port is open but not responding yet');
        }
      } else {
        console.log('⚠️  Backend server failed to start');
      }
    }
    
    console.log('');
  }
  
  // Ensure frontend server is ready before opening browser
  if (!viteRunning) {
    console.log('⏳ Verifying frontend server is ready...');
    const httpReady = await waitForHttpServer(viteFrontendUrl, 10);
    if (!httpReady) {
      console.log('⚠️  Frontend server may not be fully ready, but opening browser anyway...');
    }
  }
  
  console.log('==========================================');
  console.log('✓ All servers are running');
  console.log(`   Frontend: ${viteFrontendUrl}`);
  console.log(`   Backend:  ${viteApiUrl}`);
  console.log('==========================================');
  console.log('');
  console.log('Press Ctrl+C to stop the servers');
  console.log('');
  
  // Open browser after ensuring server is ready
  openBrowser(viteFrontendUrl);
  
  // Setup cleanup handlers
  const cleanupHandler = () => cleanup(processes);
  process.on('SIGINT', cleanupHandler);
  process.on('SIGTERM', cleanupHandler);
  
  // Keep script running
  if (startedVite || startedServer) {
    // Wait for processes
    await Promise.all(processes.map(proc => {
      return new Promise((resolve) => {
        proc.on('exit', resolve);
        proc.on('error', resolve);
      });
    }));
  } else {
    console.log('All servers were already running. Press Ctrl+C to exit.');
    // Wait indefinitely until interrupted
    await new Promise(() => {});
  }
}

main().catch((error) => {
  console.error('\nLaunch failed:', error.message);
  rl.close();
  process.exit(1);
});
