#!/usr/bin/env node

/**
 * Uninstall script - Remove node_modules directories
 * Does not delete .env.local or uploads directories
 */

import { rmSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const serverDir = join(rootDir, 'server');

console.log('==========================================');
console.log('Image Gacha - Uninstall');
console.log('==========================================');
console.log('');

// Remove client node_modules
const clientNodeModules = join(rootDir, 'node_modules');
if (existsSync(clientNodeModules)) {
  console.log('📦 Removing client node_modules...');
  rmSync(clientNodeModules, { recursive: true, force: true });
  console.log('✓ Client node_modules removed');
} else {
  console.log('○ Client node_modules not found');
}

// Remove server node_modules
const serverNodeModules = join(serverDir, 'node_modules');
if (existsSync(serverNodeModules)) {
  console.log('📦 Removing server node_modules...');
  rmSync(serverNodeModules, { recursive: true, force: true });
  console.log('✓ Server node_modules removed');
} else {
  console.log('○ Server node_modules not found');
}

console.log('');
console.log('==========================================');
console.log('✓ Uninstall complete!');
console.log('==========================================');
console.log('');
console.log('Note: .env.local and uploads directories were not deleted.');
console.log('');
