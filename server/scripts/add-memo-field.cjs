#!/usr/bin/env node

/**
 * Script to add "memo" field to all generated-images JSON files
 * 
 * This script:
 * 1. Finds all JSON files in generated-images directories
 * 2. Adds "memo": "" field to the root level if it doesn't exist
 * 3. Preserves existing JSON structure and formatting
 * 
 * Usage:
 *   cd server/scripts
 *   node add-memo-field.cjs
 * 
 * Or from server directory:
 *   node scripts/add-memo-field.cjs
 * 
 * Or make it executable and run:
 *   chmod +x scripts/add-memo-field.cjs
 *   ./scripts/add-memo-field.cjs
 */

const fs = require('fs').promises;
const path = require('path');

// Path to projects directory (one level up from scripts directory)
const PROJECTS_DIR = path.join(__dirname, '..', 'uploads', 'projects');

/**
 * Recursively find all JSON files in generated-images directories
 */
async function findGeneratedImageJsonFiles(dir) {
  const files = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively search in subdirectories
        const subFiles = await findGeneratedImageJsonFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        // Check if this is in a generated-images directory
        if (dir.includes('generated-images')) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Skip directories that can't be accessed
    if (error.code !== 'ENOENT') {
      console.error(`Error reading directory ${dir}:`, error.message);
    }
  }
  
  return files;
}

/**
 * Add memo field to a JSON file if it doesn't exist
 */
async function addMemoField(jsonPath) {
  try {
    // Read the JSON file
    const content = await fs.readFile(jsonPath, 'utf-8');
    const data = JSON.parse(content);
    
    // Check if memo field already exists
    if ('memo' in data) {
      return { updated: false, reason: 'memo field already exists' };
    }
    
    // Add memo field to root level
    data.memo = '';
    
    // Write back to file with proper formatting (2 spaces indentation)
    await fs.writeFile(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    
    return { updated: true };
  } catch (error) {
    return { updated: false, reason: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Starting to add "memo" field to all generated-images JSON files...\n');
  
  // Check if projects directory exists
  try {
    await fs.access(PROJECTS_DIR);
  } catch (error) {
    console.error(`Error: Projects directory not found at ${PROJECTS_DIR}`);
    process.exit(1);
  }
  
  // Find all JSON files
  console.log('Scanning for JSON files...');
  const jsonFiles = await findGeneratedImageJsonFiles(PROJECTS_DIR);
  console.log(`Found ${jsonFiles.length} JSON files\n`);
  
  if (jsonFiles.length === 0) {
    console.log('No JSON files found. Exiting.');
    return;
  }
  
  // Process each file
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const jsonPath of jsonFiles) {
    const result = await addMemoField(jsonPath);
    
    if (result.updated) {
      updatedCount++;
      console.log(`✓ Updated: ${path.relative(PROJECTS_DIR, jsonPath)}`);
    } else if (result.reason === 'memo field already exists') {
      skippedCount++;
    } else {
      errorCount++;
      console.error(`✗ Error: ${path.relative(PROJECTS_DIR, jsonPath)} - ${result.reason}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Summary:');
  console.log(`  Updated: ${updatedCount}`);
  console.log(`  Skipped (already has memo): ${skippedCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Total: ${jsonFiles.length}`);
  console.log('='.repeat(50));
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
