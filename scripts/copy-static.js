#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Recursively copy directory
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      // Preserve executable permissions for CLI files
      if (entry.name.endsWith('.js') && (srcPath.includes('cli.ts') || srcPath.includes('cli.js'))) {
        try {
          fs.chmodSync(destPath, 0o755);
        } catch (err) {
          // Ignore chmod errors for non-CLI files
        }
      }
    }
  }
}

// Copy dashboard public files
const dashboardSrc = path.join(__dirname, '..', 'src', 'dashboard', 'public');
const dashboardDest = path.join(__dirname, '..', 'dist', 'dashboard', 'public');

if (fs.existsSync(dashboardSrc)) {
  copyDirSync(dashboardSrc, dashboardDest);
  console.log('✓ Copied dashboard public files');
}

// Copy markdown files
const markdownSrc = path.join(__dirname, '..', 'src', 'markdown');
const markdownDest = path.join(__dirname, '..', 'dist', 'markdown');

if (fs.existsSync(markdownSrc)) {
  copyDirSync(markdownSrc, markdownDest);
  console.log('✓ Copied markdown files');
} else {
  console.error('✗ Markdown source directory not found:', markdownSrc);
}

console.log('Static file copy complete');