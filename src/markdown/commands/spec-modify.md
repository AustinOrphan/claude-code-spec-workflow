# Spec Modify Command

Modify a specific phase of an existing specification, allowing targeted changes without restarting the entire workflow.

## Usage
```
/spec-modify <feature-name> <phase>
/spec-modify <feature-name> <phase> -i    # Interactive mode with guided prompts
```

### Interactive Mode
The interactive mode (`-i`) provides guided modification workflow with:
- **Content Analysis**: Displays current content with quality metrics
- **Phase-Specific Menus**: Contextual modification actions based on phase
- **AI Suggestions**: Agent-generated improvement recommendations
- **Change Preview**: Diff-style preview before applying changes
- **Validation**: Automatic validation using specialized agents

## Workflow Philosophy

You are an AI assistant that specializes in making targeted modifications to existing spec-driven development workflows. Your role is to enable precise changes to specific workflow phases while preserving the integrity of related work and maintaining proper dependencies.

### Core Principles
- **Surgical Precision**: Modify only the requested phase, preserving other approved work
- **Dependency Awareness**: Understand how changes affect downstream phases
- **Impact Analysis**: Clearly communicate what needs to be updated due to modifications
- **Approval Cascade**: Ensure dependent phases are re-approved after upstream changes
- **Context Preservation**: Maintain the overall specification integrity

## Interactive Workflow (Enhanced Mode)

When using interactive mode (`-i`), the system provides a guided experience with smart menus and AI assistance:

### 1. Content Display & Analysis
- **Structured Content View**: Displays current specification content parsed into logical sections
- **Quality Metrics**: Shows template compliance score, completeness percentage, validation status
- **Last Modified Info**: Displays when content was last changed and by whom
- **Error Detection**: Identifies corrupted or malformed content with recovery options

### 2. Phase-Specific Menu Options

#### Requirements Phase Interactive Options
- **Add User Story** (`u`): Create new user story with persona, goal, and benefit structure
- **Modify User Story** (`m`): Edit existing user story content or structure
- **Add Acceptance Criteria** (`a`): Define new acceptance criteria for user stories
- **Modify Acceptance Criteria** (`c`): Edit existing acceptance criteria for clarity
- **Add Business Rule** (`b`): Define new business rules or constraints
- **Define Success Metrics** (`s`): Add measurable success criteria and KPIs
- **Add Assumptions & Constraints** (`z`): Document project assumptions and constraints
- **Remove Requirement Element** (`d`): Delete user stories or acceptance criteria
- **Reorder Requirements** (`r`): Change priority and order of requirements
- **Validate Requirements** (`v`): Run completeness and quality validation checks

#### Design Phase Interactive Options
- **Modify Architecture** (`a`): Update system architecture and design patterns
- **Add Components** (`c`): Define new system components, modules, or services
- **Modify Components** (`m`): Edit existing component definitions
- **Update Data Models** (`d`): Modify database schemas and data structures
- **Change API Specifications** (`p`): Update REST/GraphQL API definitions
- **Update Integration Points** (`i`): Modify external system integrations
- **Remove Design Elements** (`r`): Delete components or design sections
- **Validate Design** (`v`): Run design consistency and completeness checks

#### Tasks Phase Interactive Options
- **Add New Task** (`n`): Create new implementation tasks with proper atomicity
- **Modify Existing Task** (`m`): Edit task descriptions, requirements, or dependencies
- **Re-prioritize Tasks** (`p`): Change task order and priority
- **Update Task Dependencies** (`d`): Modify task relationships and prerequisites
- **Improve Task Atomicity** (`a`): Break down or combine tasks for better execution
- **Remove Tasks** (`r`): Delete unnecessary or obsolete tasks
- **Validate Tasks** (`v`): Check task completeness and agent-friendliness
- **Generate Task Commands** (`g`): Create individual task command files

### 3. AI-Assisted Suggestions
The system provides intelligent suggestions based on content analysis:

- **Completeness Gaps**: Identifies missing sections or incomplete requirements
- **Quality Improvements**: Suggests better wording, structure, or detail level
- **Best Practices**: Recommends industry standards and proven patterns
- **Consistency Issues**: Highlights conflicts between different specification sections
- **Template Compliance**: Suggests improvements to match document templates
- **Dependency Warnings**: Alerts about potential conflicts with other phases

### 4. Interactive Change Preview
Before applying any modifications:

- **Diff Display**: Shows exactly what will be added, modified, or removed
- **Impact Analysis**: Explains how changes affect other phases and existing work
- **Validation Results**: Displays agent validation outcomes and any issues
- **Approval Requirements**: Indicates what changes need stakeholder approval
- **Cascade Warnings**: Highlights dependent phases that may need updates

### 5. Guided Input Collection
For each modification type, the system provides:

- **Template-Guided Forms**: Structured input prompts based on document templates
- **Real-time Validation**: Immediate feedback on input quality and completeness
- **Context-Aware Suggestions**: Smart defaults based on existing content
- **Progress Indicators**: Visual feedback for multi-step input processes
- **Cancellation Options**: Ability to abort modifications at any step

## Modification Process

**CRITICAL**: Always analyze the impact of modifications on dependent phases:

1. **Load Current State**
   ```bash
   # Load existing specification documents
   claude-code-spec-workflow get-spec-context {feature-name}
   ```

2. **Analyze Dependencies**
   - **Requirements → Design**: Changes to requirements may invalidate design decisions
   - **Design → Tasks**: Changes to design may require task modifications
   - **Tasks → Implementation**: Changes to tasks may affect completed implementation work

3. **Present Impact Analysis**
   - Show what currently exists in the target phase
   - Explain what changes will affect
   - Warn about dependent phases that may need updates

## Phase Modification Instructions

### Phase 1: Requirements Modification
**Target**: Modify requirements.md while preserving downstream work where possible

1. **Load Context**
   ```bash
   # Load steering documents and current spec
   claude-code-spec-workflow get-steering-context
   claude-code-spec-workflow get-spec-context {feature-name}
   claude-code-spec-workflow get-template-context spec
   ```

2. **Present Current Requirements**
   - Display existing requirements.md content
   - Highlight key sections (user stories, acceptance criteria, technical requirements)

3. **Modification Process**
   - Ask user what specific changes they want to make
   - Make targeted modifications to requirements.md
   - **Use requirements template structure**: Maintain proper formatting and sections
   - **Validate against steering documents**: Ensure changes align with product vision

4. **Impact Analysis**
   - Analyze if design.md needs updates due to requirement changes
   - Analyze if tasks.md needs updates due to requirement changes
   - **Warn about affected phases**: Clearly state what may need re-approval

5. **Validation and Approval**
   - Use `spec-requirements-validator` agent to validate modified requirements
   - Present changes to user for approval
   - **Explain cascading effects**: What happens to design and tasks after approval

### Phase 2: Design Modification
**Target**: Modify design.md while considering implementation impact

1. **Load Previous Work**
   ```bash
   # Load approved requirements and current design
   claude-code-spec-workflow get-spec-context {feature-name}
   ```

2. **Present Current Design**
   - Display existing design.md content
   - Highlight key sections (architecture, components, data models, APIs)

3. **Modification Process**
   - Ask user what specific design changes they want to make
   - Analyze existing codebase for impact of proposed changes
   - Make targeted modifications to design.md
   - **Use design template structure**: Maintain proper formatting and sections
   - **Incorporate tech.md standards**: Ensure changes follow technical guidelines

4. **Impact Analysis**
   - Analyze if tasks.md needs updates due to design changes
   - Check if any completed implementation work conflicts with design changes
   - **Warn about breaking changes**: Highlight potential conflicts with existing code

5. **Validation and Approval**
   - Use `spec-design-validator` agent to validate modified design
   - Present changes to user for approval
   - **Explain task implications**: What tasks may need to be updated

### Phase 3: Tasks Modification
**Target**: Modify tasks.md while considering implementation progress

1. **Load All Context**
   ```bash
   # Load approved requirements and design
   claude-code-spec-workflow get-spec-context {feature-name}
   ```

2. **Present Current Tasks**
   - Display existing tasks.md content
   - Show task completion status (if implementation has started)
   - Highlight which tasks are completed vs pending

3. **Modification Process**
   - Ask user what specific task changes they want to make
   - **Protect completed work**: Warn if changes affect completed tasks
   - Make targeted modifications to tasks.md
   - **Maintain atomicity**: Ensure modified tasks remain atomic and agent-friendly
   - **Use tasks template structure**: Follow proper checkbox formatting

4. **Impact Analysis**
   - Check which existing tasks are affected by modifications
   - Identify if completed tasks conflict with proposed changes
   - **Analyze implementation impact**: How do changes affect ongoing work?

5. **Validation and Approval**
   - Use `spec-task-validator` agent to validate modified tasks
   - Present changes to user for approval
   - **Offer task command regeneration**: Ask if user wants new task commands generated

## Supported Phases

### Requirements Phase
```
/spec-modify user-authentication requirements
```
- Modifies user stories, acceptance criteria, technical requirements
- **High Impact**: Affects design and tasks phases
- **Cascade Warning**: Design and tasks may need re-approval

### Design Phase
```
/spec-modify user-authentication design
```
- Modifies architecture, components, APIs, data models
- **Medium Impact**: Affects tasks phase and potentially completed work
- **Implementation Warning**: May conflict with existing code

### Tasks Phase
```
/spec-modify user-authentication tasks
```
- Modifies task breakdown, adds/removes/changes specific tasks
- **Low Impact**: Mainly affects implementation, but may invalidate completed tasks
- **Completion Warning**: May affect already completed tasks

## Interactive Mode Features

### Smart Content Analysis
- **Section Detection**: Automatically identifies user stories, acceptance criteria, components, tasks
- **Quality Assessment**: Calculates template compliance (0-100%), completeness percentage
- **Status Tracking**: Shows approval status, last modified date, validation results
- **Error Recovery**: Detects file corruption and offers backup restoration options

### Contextual Menus
- **Phase-Aware Actions**: Different menu options based on requirements/design/tasks phase
- **Permission-Based**: Actions filtered based on user permissions and approval status
- **Keyboard Shortcuts**: Single-key navigation (u=user story, a=acceptance criteria, etc.)
- **Dynamic Suggestions**: AI-generated improvement recommendations with rationale

### Advanced Validation
- **Agent Integration**: Uses specialized agents (spec-requirements-validator, spec-design-validator, spec-task-validator)
- **Real-time Feedback**: Validation during input collection, not just at the end
- **Template Compliance**: Ensures modifications follow document structure requirements
- **Dependency Checking**: Validates changes against dependent phases and existing work

### Change Management
- **Atomic Operations**: All changes applied as single transaction (success or rollback)
- **Preview Mode**: Shows exact diff of changes before application
- **Backup Creation**: Automatic backup of original files before modifications
- **Concurrent Detection**: Monitors files for external changes during session
- **Impact Warnings**: Alerts about cascading effects on other phases

### User Experience
- **Progress Indicators**: Visual feedback for long-running operations (>2 seconds)
- **Cancellation Support**: Ctrl+C graceful exit at any workflow step
- **Error Recovery**: Session state restoration after interruptions
- **Performance Monitoring**: Memory usage tracking with 50MB session limit
- **Accessibility**: Full keyboard navigation with clear status announcements

## Modification Strategies

### Additive Changes
- **Adding new requirements**: Usually safe, extends scope
- **Adding new design components**: Generally safe if not conflicting
- **Adding new tasks**: Safe if they don't conflict with completed work

### Subtractive Changes
- **Removing requirements**: May orphan design and task elements
- **Removing design components**: May orphan tasks and completed implementation
- **Removing tasks**: Safe if tasks aren't completed yet

### Replacement Changes
- **Changing user stories**: High impact, may require design updates
- **Changing architecture**: High impact, may require task and implementation updates
- **Changing task scope**: Medium impact, may affect implementation approach

## Safety Mechanisms

### Pre-Modification Checks
1. **Existence Validation**: Ensure target phase document exists
2. **Dependency Validation**: Check if dependent phases exist
3. **Completion Status**: Check implementation progress for tasks phase

### Impact Warnings
- **Downstream Effect Alerts**: Warn about phases that will be affected
- **Implementation Conflict Alerts**: Warn about conflicts with completed work
- **Re-approval Notifications**: Inform about what needs re-approval

### Rollback Options
- **Backup Creation**: Automatically backup existing documents before modification
- **Change Tracking**: Document what was changed for potential rollback
- **Incremental Changes**: Allow step-by-step modifications with approval points

## Integration Points

### With /spec-resume
- After modification, user can use `/spec-resume` to continue workflow
- Modified phases may require re-approval before proceeding

### With Task Commands
- Tasks phase modifications may require regenerating task commands
- Offer task command regeneration after tasks.md modification

### With Implementation Tracking
- Check existing task completion before modifying tasks
- Warn about conflicts between completed work and proposed changes

## Error Handling

### Invalid Phase
```
Error: Invalid phase 'implementation'. Valid phases: requirements, design, tasks
```

### Missing Specification
```
Error: Specification 'feature-name' not found. Use /spec-create to create it first.
```

### Missing Target Phase
```
Error: No requirements.md found for 'feature-name'. Use /spec-resume to complete earlier phases first.
```

### Implementation Conflicts
```
Warning: 3 tasks are already completed. Modifying tasks may invalidate completed work.
Continue? (y/n)
```

## Critical Modification Rules

### Preservation Rules
- **NEVER** delete content without explicit user confirmation
- **ALWAYS** backup existing documents before modifications
- **MAINTAIN** template structure and formatting requirements
- **PRESERVE** requirement traceability in downstream phases

### Dependency Rules
- **WARN** about cascading effects before making changes
- **REQUIRE** re-approval for dependent phases after upstream changes
- **CHECK** implementation status before modifying tasks
- **VALIDATE** all modified documents using appropriate agents

### Approval Rules
- **MODIFIED** content always requires new user approval
- **DEPENDENT** phases lose approval status after upstream changes
- **IMPLEMENTATION** conflicts require explicit user acknowledgment

## Success Criteria

A successful spec modification includes:

### Standard Mode Requirements
- [x] Targeted changes to specified phase only
- [x] Proper impact analysis and user warnings
- [x] Template structure and formatting maintained
- [x] Validation using appropriate specialist agents
- [x] Clear documentation of changes and effects
- [x] Proper handling of dependency cascades
- [x] User approval for all modifications

### Interactive Mode Requirements
- [x] Content displayed with quality metrics and section analysis
- [x] Phase-specific menu with keyboard shortcuts presented
- [x] AI suggestions generated with rationale and impact analysis
- [x] Guided input collection with template compliance checking
- [x] Change preview with diff display shown before application
- [x] Agent validation integrated with real-time feedback
- [x] Atomic change application with backup creation
- [x] Concurrent modification detection and handling
- [x] Performance monitoring with memory usage limits (50MB)
- [x] Graceful error handling with recovery options

## Example Usage

### Standard Mode Examples

#### Modify User Stories
```
/spec-modify user-authentication requirements
# Presents current requirements, asks for specific changes
# Warns: "Changes may affect design and tasks phases"
```

#### Update Architecture
```
/spec-modify shopping-cart design
# Shows current design, asks for modifications
# Warns: "3 tasks already completed, check for conflicts"
```

#### Add New Tasks
```
/spec-modify payment-system tasks
# Displays current tasks with completion status
# Offers task command regeneration after changes
```

### Interactive Mode Examples

#### Interactive Requirements Modification
```
/spec-modify user-authentication requirements -i
# 1. Displays current requirements with quality metrics
# 2. Shows interactive menu:
#    [u] Add User Story          [a] Add Acceptance Criteria
#    [m] Modify User Story       [c] Modify Acceptance Criteria  
#    [b] Add Business Rule       [s] Define Success Metrics
#    [v] Validate Requirements   [r] Reorder Requirements
# 3. User selects option, system provides guided prompts
# 4. Shows change preview with impact analysis
# 5. Validates changes and applies after confirmation
```

#### Interactive Design Modification
```
/spec-modify e-commerce design -i
# 1. Analyzes current design with component overview
# 2. Presents design-specific menu:
#    [a] Modify Architecture     [c] Add Components
#    [m] Modify Components       [d] Update Data Models
#    [p] Change API Specs        [i] Update Integrations
#    [v] Validate Design         [r] Remove Elements
# 3. AI suggests improvements based on requirements
# 4. Guided input with template compliance checking
# 5. Impact analysis shows affected tasks and implementation
```

#### Interactive Tasks Enhancement
```
/spec-modify checkout-flow tasks -i
# 1. Shows current tasks with completion status
# 2. Displays task management menu:
#    [n] Add New Task           [m] Modify Existing Task
#    [p] Re-prioritize Tasks    [d] Update Dependencies
#    [a] Improve Atomicity      [r] Remove Tasks
#    [g] Generate Commands      [v] Validate Tasks
# 3. Warns about completed tasks that might be affected
# 4. Preview shows task changes and command regeneration
# 5. Offers automatic task command file updates
```