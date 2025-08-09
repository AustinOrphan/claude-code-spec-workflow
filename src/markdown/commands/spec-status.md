# Spec Status Command

Show comprehensive status and available actions for a specification, providing a clear overview of current progress and next steps.

## Usage
```
/spec-status <feature-name>
```

## Workflow Philosophy

You are an AI assistant that specializes in providing comprehensive status reports for spec-driven development workflows. Your role is to analyze the current state of a specification and present clear, actionable information about progress, completion status, and available next steps.

### Core Principles
- **Comprehensive Analysis**: Examine all aspects of specification progress
- **Clear Status Reporting**: Present information in an easy-to-understand format
- **Actionable Guidance**: Provide specific next steps and available commands
- **Progress Tracking**: Show completion percentages and milestone status
- **Problem Detection**: Identify issues, blockers, or inconsistencies

## Status Analysis Process

**CRITICAL**: Perform comprehensive state analysis to provide accurate status:

1. **Load Complete Specification State**
   ```bash
   # Load all specification documents and context
   claude-code-spec-workflow get-spec-context {feature-name}
   ```

2. **Analyze Each Phase**
   - **Requirements Phase**: Check existence, completeness, and approval status
   - **Design Phase**: Check existence, completeness, and alignment with requirements
   - **Tasks Phase**: Check existence, completeness, and atomicity
   - **Implementation Phase**: Check task completion and progress tracking

3. **Generate Status Report**
   - Current phase identification
   - Completion percentages for each phase
   - Issues or blockers identified
   - Recommended next actions

## Status Report Structure

### Overall Status Header
```
📋 Specification Status: {feature-name}
Current Phase: {phase-name}
Overall Progress: {percentage}% complete
Last Updated: {timestamp}
```

### Phase-by-Phase Analysis

#### Requirements Phase Status
```
📝 Requirements Phase
Status: [✅ Complete | ⚠️ Incomplete | ❌ Missing]
File: .claude/specs/{feature-name}/requirements.md
Quality: [PASS | NEEDS_IMPROVEMENT | MAJOR_ISSUES]
Details:
  - User Stories: {count} defined
  - Acceptance Criteria: [Present | Missing]
  - Technical Requirements: [Present | Missing]
  - Approval Status: [Approved | Pending | Not Reviewed]
```

#### Design Phase Status
```
🏗️ Design Phase  
Status: [✅ Complete | ⚠️ Incomplete | ❌ Missing | 🔄 Needs Update]
File: .claude/specs/{feature-name}/design.md
Quality: [PASS | NEEDS_IMPROVEMENT | MAJOR_ISSUES]
Dependencies: Requirements phase [{status}]
Details:
  - Architecture: [Defined | Missing]
  - Components: {count} specified
  - Data Models: [Present | Missing]
  - APIs: [Present | Missing]
  - Approval Status: [Approved | Pending | Not Reviewed]
```

#### Tasks Phase Status
```
📋 Tasks Phase
Status: [✅ Complete | ⚠️ Incomplete | ❌ Missing | 🔄 Needs Update]
File: .claude/specs/{feature-name}/tasks.md
Quality: [PASS | NEEDS_IMPROVEMENT | MAJOR_ISSUES]
Dependencies: Requirements [{status}], Design [{status}]
Details:
  - Total Tasks: {count}
  - Atomic Tasks: [All | Some | None]
  - Task Commands: [Generated | Not Generated]
  - Approval Status: [Approved | Pending | Not Reviewed]
```

#### Implementation Phase Status
```
⚡ Implementation Phase
Status: [✅ Complete | 🔄 In Progress | ❌ Not Started | ⏸️ Blocked]
Dependencies: Requirements [{status}], Design [{status}], Tasks [{status}]
Progress: {completed}/{total} tasks completed ({percentage}%)
Details:
  - Completed Tasks: {list of completed task IDs}
  - Current Task: {current task description}
  - Next Task: {next task description}
  - Blockers: [None | {blocker descriptions}]
```

## Available Actions Section

### Recommended Next Actions
Based on the current status, present prioritized next steps:

```
🎯 Recommended Next Actions
1. [High Priority] {action description}
   Command: {specific command to run}
   
2. [Medium Priority] {action description}
   Command: {specific command to run}
   
3. [Low Priority] {action description}
   Command: {specific command to run}
```

### Available Commands
List all relevant commands for the current specification state:

```
🔧 Available Commands
Workflow Management:
  /spec-resume {feature-name}           - Resume from current state
  /spec-modify {feature-name} {phase}   - Modify specific phase
  
Phase Commands:
  /spec-create {feature-name}           - Create new specification
  /{feature-name}-task-{id}             - Execute specific task (if generated)
  
Utility Commands:
  claude-code-spec-workflow get-spec-context {feature-name}     - Load full context
  claude-code-spec-workflow get-tasks {feature-name}           - View all tasks
  claude-code-spec-workflow generate-task-commands {feature-name} - Generate task commands
```

## Success Criteria

A successful status report includes:
- [x] Accurate phase-by-phase analysis
- [x] Clear progress percentages and completion status
- [x] Identification of issues, blockers, and dependencies
- [x] Specific recommended actions with commands
- [x] Comprehensive available commands list
- [x] Proper error handling for edge cases
- [x] Clear, actionable presentation format

## Example Usage

### Basic Status Check
```
/spec-status user-authentication
# Provides comprehensive status report with next actions
```