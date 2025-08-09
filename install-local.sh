#!/bin/bash

# Local Fork Installation Script
# This script handles the complete build and installation process for the local fork

set -e  # Exit on any error

echo "🔧 Installing Local Claude Code Spec Workflow Fork..."

# Uninstall any existing global installations
echo "📦 Removing any existing global installations..."
npm uninstall -g @pimzino/claude-code-spec-workflow 2>/dev/null || true
npm uninstall -g @austinorphan/claude-code-spec-workflow-fork 2>/dev/null || true

# Build the project
echo "🏗️  Building project..."
npm run build

# Verify CLI files are executable
echo "✅ Verifying executable permissions..."
ls -la dist/cli.js dist/dashboard/cli.js

# Install globally
echo "📦 Installing globally..."
npm install -g .

# Verify installation
echo "✅ Verifying installation..."
which claude-code-spec-workflow
claude-code-spec-workflow --version

echo "🎉 Local fork installed successfully!"
echo ""
echo "Available commands:"
echo "  claude-code-spec-workflow    - Main CLI"
echo "  claude-spec-setup           - Setup command"
echo "  claude-spec-dashboard       - Dashboard command"