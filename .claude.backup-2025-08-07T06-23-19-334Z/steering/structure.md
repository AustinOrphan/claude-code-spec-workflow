# Project Structure

## Directory Organization

```
claude-code-spec-workflow/ (Local Fork)
├── src/                           # TypeScript source code
│   ├── cli.ts                    # Main CLI entry point with Commander.js
│   ├── setup.ts                  # .claude/ directory creation and management
│   ├── task-generator.ts         # Task parsing and command generation
│   ├── dashboard/               # Real-time web dashboard subsystem
│   │   ├── cli.ts              # Dashboard CLI entry point
│   │   ├── server.ts           # Fastify server with WebSocket
│   │   ├── parser.ts           # Spec document parsing
│   │   ├── watcher.ts          # File system watching
│   │   └── public/            # Frontend assets (HTML, JS, CSS, SVGs)
│   ├── markdown/               # Template source files
│   │   ├── commands/          # 11 slash command templates (.md)
│   │   ├── templates/         # 9 document templates (.md)
│   │   └── agents/           # 16 AI agent definitions (.md)
│   ├── get-content.ts         # Individual file reading utility
│   ├── get-*-context.ts       # Context optimization utilities
│   └── *.ts                  # Additional utility modules
├── tests/                     # Jest test files
├── dist/                      # Build output (TypeScript compilation + static files)
├── .claude/                   # Generated workflow structure (when setup runs)
│   ├── commands/             # Generated slash commands
│   ├── templates/            # Copied document templates  
│   ├── agents/              # Copied AI agent definitions
│   └── steering/            # Project context documents (this directory)
└── scripts/copy-static.js    # Custom build script for assets
```

## Naming Conventions

### Files
- **Components/Modules**: `kebab-case.ts` (e.g., `task-generator.ts`, `get-content.ts`)
- **Dashboard Components**: `camelCase.ts` (e.g., `server.ts`, `parser.ts`)
- **CLI Scripts**: `cli.ts` for entry points
- **Tests**: `[filename].test.ts` (e.g., `setup.test.ts`, `task-generator.test.ts`)
- **Markdown Files**: `kebab-case.md` (e.g., `bug-analyze.md`, `spec-create.md`)

### Code
- **Classes**: `PascalCase` (e.g., `SpecWorkflowSetup`, `DashboardServer`)
- **Functions**: `camelCase` (e.g., `parseTasksFromMarkdown`, `generateTaskCommand`)
- **Constants**: `UPPER_SNAKE_CASE` for globals, `camelCase` for local
- **Variables**: `camelCase` consistently throughout

## Import Patterns

### Import Order
1. Node.js built-in modules (`fs`, `path`)
2. External dependencies (`commander`, `fastify`, `chalk`)
3. Internal modules (relative imports from `./`)
4. Type-only imports last

### Module Organization
```typescript
// Standard pattern for source files:
import { promises as fs } from 'fs';           // Built-in
import { join } from 'path';                   // Built-in
import chalk from 'chalk';                     // External
import { Command } from 'commander';           // External
import { SpecWorkflowSetup } from './setup';  // Internal
import type { ParsedTask } from './types';    // Types
```

## Code Structure Patterns

### CLI Module Organization
```typescript
1. Imports and dependencies
2. Version/package info loading
3. Command program setup
4. Command definitions with handlers
5. Program parsing and execution
```

### Class Organization (e.g., SpecWorkflowSetup)
```typescript
1. Private property declarations
2. Constructor with directory path setup
3. Public utility methods (existence checks)
4. Core functionality methods
5. File generation and copying methods
6. Private helper methods
```

### Function Organization
```typescript
1. Parameter validation and defaults
2. Core processing logic
3. Error handling with specific error types
4. Return value construction
```

## Code Organization Principles

1. **Single Responsibility**: Each file has one clear purpose (CLI, setup, task generation, etc.)
2. **Template Separation**: All user-facing content stored as markdown in `src/markdown/`
3. **Fork Independence**: Local modifications preserved through build process
4. **Context Optimization**: Bulk loading functions separate from individual file operations
5. **Dashboard Isolation**: Dashboard completely self-contained with own CLI entry

## Module Boundaries

### Core vs Extensions
- **Core**: CLI, setup, task generation (`src/*.ts`)
- **Dashboard**: Self-contained subsystem (`src/dashboard/`)
- **Templates**: User-facing content (`src/markdown/`)
- **Context Optimization**: Bulk loading utilities (`src/get-*-context.ts`)

### Dependencies Direction
- CLI depends on Setup and Task Generator
- Dashboard is independent with own CLI entry
- Context utilities are standalone helpers
- Templates have no dependencies (pure markdown)

### Fork-Specific Boundaries
- **Local Commands**: Always use `claude-code-spec-workflow`
- **Build Artifacts**: `dist/` contains compiled TypeScript + copied static files
- **Generated Content**: `.claude/` directory created by setup, not committed

## Code Size Guidelines

- **File size**: Maximum 300-500 lines for maintainability
- **Function size**: Maximum 50 lines per function for readability
- **Class complexity**: Single responsibility principle, focused purpose
- **Nesting depth**: Maximum 4 levels to avoid complexity

## Dashboard Structure

### Self-contained Subsystem
```
src/dashboard/
├── cli.ts              # Independent CLI entry point
├── server.ts           # Fastify server with WebSocket
├── parser.ts           # Spec document analysis
├── watcher.ts          # File system monitoring
├── project-discovery.ts # Multi-project detection
└── public/            # Frontend assets (copied to dist/)
    ├── index.html     # Main dashboard UI
    ├── app.js         # Dashboard JavaScript
    └── *.svg         # Claude icons
```

### Separation Principles
- Own CLI entry point: `claude-spec-dashboard`
- Minimal dependencies on core workflow logic
- WebSocket-based real-time communication
- Can operate independently of main CLI

## Testing Structure

### Test Organization
```
tests/
├── setup.test.ts                    # Setup system tests
├── task-generator.test.ts           # Task parsing tests
├── templates.test.ts                # Template validation
├── steering.test.ts                 # Context loading tests
├── utils.test.ts                   # Utility function tests
└── dashboard/                      # Dashboard-specific tests
    └── parser-formats.test.ts      # Format parsing tests
```

### Test Patterns
- **Unit Tests**: Individual function testing with mocked dependencies
- **Integration Tests**: Full workflow testing with temporary directories
- **Pattern Consistency**: Validation of generated command structures
- **Template Validation**: Ensuring all templates exist and are valid

## Build and Distribution Structure

### Build Process
1. **TypeScript Compilation**: `src/` → `dist/` (preserving structure)
2. **Static File Copying**: Dashboard public files and markdown templates
3. **Binary Generation**: Three CLI entry points in package.json

### Generated Structure
```
dist/
├── cli.js                     # Main CLI entry
├── setup.js                   # Setup logic
├── task-generator.js          # Task generation
├── dashboard/                 # Dashboard subsystem
│   ├── cli.js                # Dashboard CLI
│   └── public/              # Frontend assets
└── markdown/                 # Template files
    ├── commands/            # Slash command templates
    ├── templates/           # Document templates
    └── agents/             # AI agent definitions
```

## Documentation Standards

- **CLAUDE.md**: Comprehensive guidance for Claude Code instances
- **README.md**: User-facing documentation with examples
- **Inline Comments**: Complex logic explanation, not obvious operations
- **Template Documentation**: All markdown templates self-documenting
- **Type Definitions**: TypeScript interfaces for complex data structures

## Fork-Specific Structure Considerations

### Command Usage Patterns
```bash
# Always use local fork
claude-code-spec-workflow get-content "/path/to/file"
claude-code-spec-workflow get-steering-context

# Never use unless explicitly specified
npx @pimzino/claude-code-spec-workflow@latest [command]
```

### Customization Protection
- Local modifications in `src/` preserved through build
- Fork-specific features maintained in separate modules
- Build process ensures no upstream overwrites without explicit approval

### Development Workflow
- Use `npm run dev` for development mode with ts-node
- Use `npm run build && npm install -g .` to test fork changes
- All context commands use local fork by default