# Bug Report

## Bug Summary
On existing installations of claude-code-spec-workflow, attempting to enable agents using the configuration fails to actually enable agent functionality.

## Bug Details

### Expected Behavior
When users configure `agents_enabled: true` in their spec-config.json or use the setup process to enable agents on an existing installation, agents should become available and functional for use in spec workflows.

### Actual Behavior  
The agent enablement process appears to complete without errors, but agents remain non-functional. Users may see configuration changes but agents are not actually available for use in workflows.

### Steps to Reproduce
1. Have an existing installation of claude-code-spec-workflow
2. Attempt to enable agents through configuration or setup process
3. Try to use agent functionality
4. Observe that agents are not actually enabled despite configuration changes

### Environment
- **Version**: [Current version of claude-code-spec-workflow]
- **Platform**: Multiple (macOS, Linux, Windows)
- **Configuration**: Existing installations attempting to enable agents

## Impact Assessment

### Severity
- [x] High - Major functionality broken
- [ ] Critical - System unusable
- [ ] Medium - Feature impaired but workaround exists
- [ ] Low - Minor issue or cosmetic

### Affected Users
Existing users who want to enable agent functionality on previously installed projects.

### Affected Features
- Agent enablement process
- Agent-based automation in spec workflows
- Configuration management for agents

## Additional Context

### Error Messages
```
[To be populated during analysis - may include silent failures or missing agent functionality]
```

### Screenshots/Media
[Not applicable for this CLI-based issue]

### Related Issues
This may be related to:
- Configuration file updates not being properly applied
- Missing file installations when enabling agents
- Agent template/command generation not triggering on existing installs

## Initial Analysis

### Suspected Root Cause
The agent enablement process may not be properly:
1. Installing required agent files on existing installations
2. Updating all necessary configuration files
3. Triggering the complete setup process for agent functionality

### Affected Components
- Setup/installation system (`src/setup.ts`)
- Configuration management (`spec-config.json` handling)
- Agent file generation and installation
- Command generation for agent-based workflows