# Installation Guide - Local Fork

This guide explains how to install and use your local fork of claude-code-spec-workflow.

## Prerequisites

- Node.js 24.x or higher
- npm or yarn package manager
- Git (for managing the fork)

## Installation Methods

### Method 1: Global Installation (Recommended)

Install your local fork globally to use the commands from anywhere:

```bash
# 1. Navigate to your fork directory
cd /Users/austinorphan/src/claude-code-spec-workflow/main

# 2. Build the project
npm run build

# 3. Make CLI files executable
chmod +x dist/cli.js dist/dashboard/cli.js

# 4. Install globally
npm install -g .
```

After installation, these commands will be available globally:
- `claude-code-spec-workflow` - Main CLI command
- `claude-spec-setup` - Setup command (alias for main CLI)
- `claude-spec-dashboard` - Dashboard server

#### Verify Installation

```bash
# Check version
claude-code-spec-workflow --version

# Get help
claude-code-spec-workflow --help

# Test a command
claude-code-spec-workflow get-content "/path/to/file"
```

### Method 2: Development Mode

For active development without global installation:

```bash
# Use TypeScript directly (no build required)
npm run dev -- [command] [options]

# Examples:
npm run dev -- --version
npm run dev -- get-content "/path/to/file"
npm run dev -- setup
```

### Method 3: Using Built Files Directly

After building, you can run the compiled JavaScript directly:

```bash
# Build first
npm run build

# Run with node
node dist/cli.js [command] [options]

# Examples:
node dist/cli.js --version
node dist/cli.js get-content "/path/to/file"
```

### Method 4: Shell Alias

Create a persistent alias in your shell configuration:

```bash
# Add to ~/.bashrc, ~/.zshrc, or equivalent
alias claude-code-spec-workflow="node /Users/austinorphan/src/claude-code-spec-workflow/main/dist/cli.js"
alias ccw="node /Users/austinorphan/src/claude-code-spec-workflow/main/dist/cli.js"  # Short alias

# Reload shell configuration
source ~/.zshrc  # or ~/.bashrc
```

## Updating Your Fork

When you make changes to your fork:

```bash
# 1. Make your code changes
# 2. Rebuild the project
npm run build

# 3. If globally installed, reinstall
npm install -g .

# The global command will now use your updated code
```

## Troubleshooting

### Command Not Found

If `claude-code-spec-workflow` is not found after global installation:

1. Check npm's global bin directory is in your PATH:
   ```bash
   npm config get prefix
   # Should return something like /Users/username/.nvm/versions/node/v24.5.0
   # Ensure /Users/username/.nvm/versions/node/v24.5.0/bin is in PATH
   ```

2. Verify installation:
   ```bash
   npm ls -g --depth=0 | grep claude
   ```

### Permission Denied

If you get permission errors when running the command:

```bash
# Make sure the CLI files are executable
chmod +x dist/cli.js dist/dashboard/cli.js

# Reinstall globally
npm uninstall -g @pimzino/claude-code-spec-workflow
npm install -g .
```

### Using with npx

If you encounter issues with `npx`, clear the cache:

```bash
# Clear npx cache
rm -rf ~/.npm/_npx/*

# Use the locally installed version
npx claude-code-spec-workflow --version
```

## Important Notes

### Fork vs Official Package

This is your **local fork**, not the official NPM package. Key differences:

1. **Commands use local fork**: All commands reference `claude-code-spec-workflow` not `npx @pimzino/claude-code-spec-workflow@latest`
2. **No automatic updates**: Your fork won't auto-update from upstream
3. **Custom modifications**: Your changes are preserved and won't be overwritten

### Build Process

The build process (`npm run build`) does three things:
1. Cleans the dist directory (`rimraf dist`)
2. Compiles TypeScript to JavaScript (`tsc`)
3. Copies static files (`node scripts/copy-static.js`)

Always rebuild after making changes to see them reflected in the global command.

### Package Name

The package.json still shows `"name": "@pimzino/claude-code-spec-workflow"` - this is intentional and required for the build system to work correctly. The package name doesn't affect your local fork's functionality.

## Common Commands

After global installation, you can use:

```bash
# Setup in a new project
claude-code-spec-workflow setup

# Generate task commands
claude-code-spec-workflow generate-task-commands my-spec

# Get file content
claude-code-spec-workflow get-content "/path/to/file"

# Get steering context
claude-code-spec-workflow get-steering-context

# Get spec context
claude-code-spec-workflow get-spec-context spec-name

# Launch dashboard
claude-spec-dashboard

# Check if agents are enabled
claude-code-spec-workflow using-agents
```

## Development Workflow

For active development on the fork:

```bash
# 1. Make changes to source files in src/
# 2. Run tests
npm test

# 3. Build the project
npm run build

# 4. Test your changes
npm run dev -- [test-command]

# 5. If satisfied, reinstall globally
npm install -g .

# 6. Commit your changes
git add .
git commit -m "Your changes"
```

## Maintaining Your Fork

To protect your fork from accidental overwrites:

1. **Never run** `npm install -g @pimzino/claude-code-spec-workflow` (this would install the official package)
2. **Always use** your local directory for installation: `npm install -g .`
3. **Keep steering documents** in `.claude/steering/` that emphasize fork independence
4. **Document changes** in CHANGELOG.md or a separate FORK_CHANGES.md

## Getting Help

- Check the README.md for usage documentation
- Review CLAUDE.md for fork-specific information
- Run `claude-code-spec-workflow --help` for command help
- Check test files in `tests/` for usage examples