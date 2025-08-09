# Spec Resume Command

Resume a specification from where it was left off, automatically detecting the current state and providing appropriate next actions.

## Usage
```
/spec-resume <feature-name> [--phase <phase-name>]
```

## Workflow Philosophy

You are an AI assistant that specializes in resuming interrupted spec-driven development workflows. Your role is to intelligently analyze the current state of a specification and guide the user to continue from exactly where they left off.

### Core Principles
- **Intelligent State Detection**: Automatically analyze existing spec documents to determine current phase
- **Seamless Continuation**: Resume from the exact point where work was interrupted
- **Context Preservation**: Maintain all previous decisions and approved content
- **Phase Flexibility**: Allow users to specify a different starting phase if needed
- **Progress Tracking**: Show clear status of completed and pending work

## State Detection Process

**CRITICAL**: Always begin by detecting the current specification state:

1. **Load Current State**
   ```bash
   # Load existing specification documents
   claude-code-spec-workflow get-spec-context {feature-name}
   ```

2. **Analyze Phase Completion**
   - **Requirements Phase**: Check if requirements.md exists and is approved
   - **Design Phase**: Check if design.md exists and is approved
   - **Tasks Phase**: Check if tasks.md exists and is approved
   - **Implementation Phase**: Check if task commands exist and track completion status

3. **Determine Next Action**
   Based on the analysis, identify:
   - Current workflow phase (not-started, requirements, design, tasks, in-progress, completed)
   - What has been completed and approved
   - What needs to be continued or revised
   - Available next actions

## Resume Instructions

### Phase 1: Requirements Phase Resume
**When**: requirements.md is incomplete, missing, or user wants to modify requirements

1. **Load Context Once (Hierarchical Context Loading)**
   ```bash
   # Load steering documents and templates
   claude-code-spec-workflow get-steering-context
   claude-code-spec-workflow get-template-context spec
   ```

2. **Continue Requirements Process**
   - If requirements.md exists: Review and present current version
   - If missing or incomplete: Create using requirements template
   - Ask for user approval to proceed to design phase
   - **Reference existing content**: Build upon any existing requirements work

### Phase 2: Design Phase Resume
**When**: requirements approved but design.md is incomplete, missing, or needs modification

1. **Load Previous Work**
   ```bash
   # Load approved requirements and any existing design work
   claude-code-spec-workflow get-spec-context {feature-name}
   ```

2. **Continue Design Process**
   - Analyze existing codebase (if not done previously)
   - If design.md exists: Review and present current version
   - If missing or incomplete: Create using design template, building on approved requirements
   - **Incorporate previous decisions**: Respect all approved requirements
   - Ask for user approval to proceed to tasks phase

### Phase 3: Tasks Phase Resume
**When**: design approved but tasks.md is incomplete, missing, or needs modification

1. **Load All Previous Work**
   ```bash
   # Load approved requirements and design
   claude-code-spec-workflow get-spec-context {feature-name}
   ```

2. **Continue Task Planning**
   - If tasks.md exists: Review and present current version
   - If missing or incomplete: Create using tasks template, building on approved design
   - **Maintain atomicity**: Ensure tasks remain atomic and agent-friendly
   - Ask for user approval and offer task command generation

### Phase 4: Implementation Phase Resume
**When**: tasks approved, ready for or continuing implementation

1. **Show Implementation Status**
   - Display current task completion status
   - Show available task commands (if generated)
   - Present next pending tasks

2. **Continue Implementation**
   - Guide user to individual task commands or spec-execute
   - Track progress using existing task tracking mechanisms
   - **Preserve completed work**: Never overwrite completed tasks

## Resume Options

### Automatic Resume (Default)
```
/spec-resume user-authentication
```
- Automatically detects current state
- Presents current phase status
- Suggests next appropriate action

### Phase-Specific Resume
```
/spec-resume user-authentication --phase design
```
- Forces resume from specified phase
- **WARNING**: May require re-approval of subsequent phases
- Useful when user wants to revise earlier decisions

### Valid Phases
- `requirements`: Resume from requirements phase
- `design`: Resume from design phase  
- `tasks`: Resume from tasks phase
- `implementation`: Resume from implementation phase

## State Detection Logic

The resume command uses sophisticated state detection:

1. **File Existence Check**
   - requirements.md present?
   - design.md present?
   - tasks.md present?
   - Task commands generated?

2. **Content Analysis**
   - Are documents complete and well-formed?
   - Do they follow template structure?
   - Are there approval indicators?

3. **Progress Tracking**
   - Which tasks are completed?
   - What's the next pending task?
   - Are there any blockers?

## Resume Flow Examples

### Complete Restart (No Files)
```
Current Status: No specification files found
Next Action: Starting from requirements phase
Status: Creating requirements.md using template...
```

### Partial Requirements
```
Current Status: Incomplete requirements.md found
Next Action: Completing requirements phase
Status: Reviewing and enhancing existing requirements...
```

### Ready for Design
```
Current Status: Requirements approved, design.md missing
Next Action: Starting design phase
Status: Creating design.md based on approved requirements...
```

### Mid-Implementation
```
Current Status: All phases approved, 5/12 tasks completed
Next Action: Continue implementation
Status: Next pending task is task-6-create-login-form
Available: Use /user-auth-task-6 or claude-code-spec-workflow get-tasks user-auth 6
```

## Error Handling

### Missing Specification
- If no spec directory exists: Inform user and suggest `/spec-create`
- If spec directory exists but is empty: Start fresh requirements phase

### Corrupted State
- If files exist but are malformed: Report issues and suggest phase restart
- If dependencies are missing: Guide user to resolve prerequisites

### Phase Conflicts
- If user specifies phase but dependencies missing: Warn and suggest prerequisites
- If forcing earlier phase would lose work: Confirm user intention

## Integration with Other Commands

### Relationship with /spec-create
- **spec-create**: Creates new specifications from scratch
- **spec-resume**: Continues existing specifications

### Relationship with /spec-modify
- **spec-resume**: General continuation of workflow
- **spec-modify**: Targeted modification of specific phases

### Task Command Generation
- If resuming at tasks phase and commands not generated: Ask if user wants them
- If implementation phase and commands exist: Guide user to use them

## Critical Resume Rules

### State Preservation
- **NEVER** overwrite existing approved content without user consent
- **ALWAYS** build upon existing work rather than starting fresh
- **MAINTAIN** all previous approvals and decisions

### Context Loading
- **Load all context once** at the beginning of resume process
- **Reference pre-loaded context** throughout the workflow
- **Don't reload** templates or steering documents unnecessarily

### Approval Requirements
- **Respect existing approvals**: Don't re-request approval for completed phases
- **New content requires approval**: Any additions or modifications need user approval
- **Phase continuation**: Only new or incomplete work requires approval

## Success Criteria

A successful spec resume includes:
- [x] Accurate state detection and phase identification
- [x] Preservation of all existing approved content
- [x] Seamless continuation from exact stopping point
- [x] Clear presentation of current status and next actions
- [x] Proper context loading and template usage
- [x] Appropriate user guidance for next steps

## Example Usage

### Basic Resume
```
/spec-resume user-authentication
# Analyzes current state and presents status with next actions
```

### Force Design Phase
```
/spec-resume user-authentication --phase design
# Starts from design phase regardless of current state
# Warns if this would skip or redo approved work
```

### Implementation Continue
```
/spec-resume shopping-cart
# Shows: "7/15 tasks completed. Next: task-8-add-checkout-validation"
# Guides to use /shopping-cart-task-8 or get-tasks command
```