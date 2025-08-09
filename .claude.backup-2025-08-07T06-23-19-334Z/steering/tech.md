# Technology Stack

## Project Type
CLI tool and development workflow automation system - a customized fork of claude-code-spec-workflow with enhanced capabilities and local modifications.

## Core Technologies

### Primary Language(s)
- **Language**: TypeScript 5.7.2 (ES2020 target)
- **Runtime**: Node.js 16.0.0+ (development on 24.x)
- **Language-specific tools**: npm, ts-node for development mode

### Key Dependencies/Libraries
- **Commander.js 12.1.0**: CLI argument parsing and command structure
- **Fastify 4.24.3**: High-performance web server for dashboard
- **@fastify/websocket 8.2.1**: Real-time dashboard updates
- **Inquirer.js 8.2.6**: Interactive command-line prompts
- **Chalk 4.1.2**: Colored terminal output
- **simple-git 3.28.0**: Git integration and project discovery
- **chokidar 3.5.3**: File system watching for dashboard
- **ora 5.4.1**: Terminal spinners and loading indicators

### Application Architecture
Template-based generation system with hierarchical context management:
- **Markdown-driven**: All commands, agents, and templates stored as markdown files
- **Dynamic Command Generation**: NPX-based individual task commands
- **Agent System**: 16 specialized AI agents for workflow automation
- **Context Optimization**: Bulk document loading with 60-80% token reduction
- **Multi-binary Package**: 3 CLI entry points (main, setup, dashboard)

### Data Storage
- **Primary storage**: File system with .claude/ directory structure
- **Caching**: In-memory file caching system with change detection
- **Data formats**: Markdown files, JSON configuration, generated command files
- **Templates**: Markdown templates for all document types

### External Integrations
- **Claude Code Integration**: Primary integration for AI-powered development
- **Git Integration**: Project discovery and repository analysis
- **NPM Ecosystem**: Global package installation and local fork management
- **File System**: Dynamic command generation and template management

### Monitoring & Dashboard Technologies
- **Dashboard Framework**: Vanilla JavaScript frontend with modern CSS
- **Real-time Communication**: WebSocket for live progress updates
- **Visualization**: HTML/CSS-based progress indicators and project listings
- **State Management**: File system as source of truth with WebSocket synchronization

## Development Environment

### Build & Development Tools
- **Build System**: npm scripts with custom static file copying
- **Package Management**: npm with global installation support
- **Development workflow**: ts-node for direct TypeScript execution
- **Static Assets**: Custom copy-static.js script for dashboard and markdown files

### Code Quality Tools
- **Static Analysis**: ESLint 9.17.0 with TypeScript parser
- **Formatting**: Prettier 3.4.2 for code style enforcement
- **Testing Framework**: Jest 29.7.0 with ts-jest for TypeScript support
- **Documentation**: Markdown-based with comprehensive CLAUDE.md

### Version Control & Collaboration
- **VCS**: Git with custom fork management
- **Branching Strategy**: Feature branches for development
- **Fork Independence**: Local customizations protected from upstream changes
- **Update Policy**: Manual analysis required for official distribution integration

### Dashboard Development
- **Live Reload**: File watching with chokidar for development
- **Port Management**: Dynamic port allocation with availability checking
- **Multi-Instance Support**: Multiple project dashboard monitoring

## Deployment & Distribution

### Target Platform(s)
- **Primary**: Command-line interface on macOS, Linux, Windows
- **Distribution**: Local fork installation via npm install -g
- **Requirements**: Node.js 16.0.0+, Claude Code installation

### Distribution Method
- **Local Fork**: Custom enhanced version with `claude-code-spec-workflow` command
- **Installation**: Local npm install from project directory
- **Update Mechanism**: Manual builds and reinstalls to preserve customizations

### Installation Requirements
- Node.js 16.0.0 or higher
- Claude Code CLI installed and accessible
- Git for project discovery features
- Terminal with color support for optimal experience

## Technical Requirements & Constraints

### Performance Requirements
- **Token Efficiency**: 60-80% reduction through context optimization
- **Command Response**: Sub-second response for CLI commands
- **Dashboard Load**: Real-time WebSocket updates without lag
- **File Processing**: Efficient markdown parsing and command generation

### Compatibility Requirements  
- **Platform Support**: Cross-platform Node.js compatibility
- **Dependency Versions**: Pinned versions for stability
- **Claude Code Integration**: Compatible with latest Claude Code CLI

### Security & Compliance
- **Local Operations**: All processing happens locally
- **No External Dependencies**: No remote API calls beyond Claude Code
- **File System Security**: Safe file operations within project boundaries
- **Command Injection Prevention**: Proper escaping in generated commands

## Technical Decisions & Rationale

### Decision Log
1. **Fork-based Development**: Enables independent enhancement while maintaining upstream compatibility
2. **Template-driven Architecture**: Provides consistency and easy customization across all generated content
3. **Context Optimization System**: Reduces token usage significantly through bulk document loading
4. **Fastify for Dashboard**: High-performance alternative to Express with WebSocket support
5. **Markdown Storage**: Human-readable templates and commands for easy modification

## Known Limitations

- **Test Failures**: setup.test.ts missing `createConfigFile` method, task-generator.test.ts format mismatches
- **Fork Synchronization**: Manual process required to incorporate upstream changes
- **Platform Dependencies**: Relies on Node.js and Claude Code CLI availability
- **Local-only Dashboard**: No remote dashboard sharing capabilities currently

## Critical Fork Considerations

### Fork-Specific Commands
- **Always use**: `claude-code-spec-workflow` (local fork command)
- **Never use**: `npx @pimzino/claude-code-spec-workflow` unless explicitly specified
- **Context Commands**: Use local fork for all get-content, get-steering-context, etc.

### Customization Protection
- **Build Process**: Custom static file copying preserves local modifications
- **Configuration**: Local spec-config.json reflects fork-specific settings
- **Agent System**: All 16 agents enabled by default in fork version