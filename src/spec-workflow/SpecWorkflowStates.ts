import { SpecState, SpecPhase } from './SpecStateDetector';

/**
 * Abstract base class for spec workflow states
 * Implements the State design pattern for workflow phase management
 */
export abstract class SpecWorkflowState {
  protected specName: string;
  protected projectPath: string;
  protected state: SpecState;

  constructor(specName: string, projectPath: string, state: SpecState) {
    this.specName = specName;
    this.projectPath = projectPath;
    this.state = state;
  }

  /**
   * Execute the current phase
   */
  abstract execute(): Promise<void>;

  /**
   * Get the phase name
   */
  abstract getPhase(): SpecPhase;

  /**
   * Check if this phase can be executed
   */
  abstract canExecute(): boolean;

  /**
   * Get instructions for the user
   */
  abstract getInstructions(): string;

  /**
   * Get the next phase after successful completion
   */
  abstract getNextPhase(): SpecPhase | null;
}

/**
 * Requirements phase state
 */
export class RequirementsState extends SpecWorkflowState {
  getPhase(): SpecPhase {
    return 'requirements';
  }

  canExecute(): boolean {
    return true; // Requirements can always be created/modified
  }

  async execute(): Promise<void> {
    console.log(`\n🔄 Resuming ${this.specName} at Requirements phase`);
    console.log('\n## Phase 1: Requirements Creation');
    
    if (this.state.requirements.exists && this.state.requirements.approved) {
      console.log('✅ Requirements already exist and are approved');
      console.log('You can modify them using: /spec-modify requirements');
      return;
    }

    if (this.state.requirements.exists) {
      console.log('📝 Requirements file exists but may need completion');
      console.log('Continue working on the requirements document or use /spec-modify requirements to revise');
    } else {
      console.log('📝 Creating new requirements document');
      console.log('Use the requirements template and steering documents for guidance');
    }
  }

  getInstructions(): string {
    return `
## Requirements Phase Instructions

1. **Load Context Documents**
   - Use steering documents for project context
   - Analyze existing codebase for similar features
   
2. **Create/Update Requirements**
   - Follow the requirements template structure
   - Write user stories in "As a [role], I want [feature], so that [benefit]" format
   - Define acceptance criteria using EARS format (WHEN/IF/THEN)
   
3. **Get Approval**
   - Present requirements to stakeholders
   - Make revisions based on feedback
   - Mark as approved when ready to proceed

**Next**: Once approved, proceed to design phase
`;
  }

  getNextPhase(): SpecPhase {
    return 'design';
  }
}

/**
 * Design phase state
 */
export class DesignState extends SpecWorkflowState {
  getPhase(): SpecPhase {
    return 'design';
  }

  canExecute(): boolean {
    return this.state.requirements.exists && this.state.requirements.approved;
  }

  async execute(): Promise<void> {
    console.log(`\n🔄 Resuming ${this.specName} at Design phase`);
    console.log('\n## Phase 2: Design Creation');
    
    if (!this.canExecute()) {
      console.log('❌ Cannot proceed: Requirements must be approved first');
      console.log('Use /spec-modify requirements to complete the requirements phase');
      return;
    }

    if (this.state.design.exists && this.state.design.approved) {
      console.log('✅ Design already exists and is approved');
      console.log('You can modify it using: /spec-modify design');
      return;
    }

    if (this.state.design.exists) {
      console.log('📝 Design file exists but may need completion');
      console.log('Continue working on the design document or use /spec-modify design to revise');
    } else {
      console.log('📝 Creating new design document');
      console.log('Build on existing patterns and follow technical standards');
    }
  }

  getInstructions(): string {
    return `
## Design Phase Instructions

1. **Research and Analysis**
   - Map existing patterns and components
   - Identify reusable code and integration points
   - Follow tech.md standards and structure.md conventions
   
2. **Create/Update Design**
   - Use the design template structure
   - Include Mermaid diagrams for visual representation
   - Define clear interfaces and API contracts
   
3. **Validation**
   - Ensure design adheres to project standards
   - Verify integration with existing systems
   - Get approval before proceeding

**Next**: Once approved, proceed to tasks phase
`;
  }

  getNextPhase(): SpecPhase {
    return 'tasks';
  }
}

/**
 * Tasks phase state
 */
export class TasksState extends SpecWorkflowState {
  getPhase(): SpecPhase {
    return 'tasks';
  }

  canExecute(): boolean {
    return this.state.design.exists && this.state.design.approved;
  }

  async execute(): Promise<void> {
    console.log(`\n🔄 Resuming ${this.specName} at Tasks phase`);
    console.log('\n## Phase 3: Task Creation');
    
    if (!this.canExecute()) {
      console.log('❌ Cannot proceed: Design must be approved first');
      console.log('Use /spec-modify design to complete the design phase');
      return;
    }

    if (this.state.tasks.exists && this.state.tasks.approved) {
      console.log('✅ Tasks already exist and are approved');
      console.log('You can modify them using: /spec-modify tasks');
      console.log('\n📊 Task Status:');
      console.log(`   Total: ${this.state.tasks.total}`);
      console.log(`   Completed: ${this.state.tasks.completed}`);
      console.log(`   Remaining: ${this.state.tasks.total - this.state.tasks.completed}`);
      return;
    }

    if (this.state.tasks.exists) {
      console.log('📝 Tasks file exists but may need completion');
      console.log('Continue working on the tasks document or use /spec-modify tasks to revise');
    } else {
      console.log('📝 Creating new tasks document');
      console.log('Break down the design into atomic, agent-friendly tasks');
    }
  }

  getInstructions(): string {
    return `
## Tasks Phase Instructions

1. **Task Breakdown**
   - Create atomic tasks (15-30 minutes each)
   - Specify exact files to create/modify
   - Reference specific requirements
   - Include leverage information for existing code
   
2. **Task Format**
   - Use checkbox format: - [ ] 1. Task description
   - Add metadata: _Requirements: 1.1, 2.2_ and _Leverage: component X_
   - Ensure each task is agent-friendly and testable
   
3. **Validation and Generation**
   - Validate tasks for atomicity and completeness
   - Get approval for task breakdown
   - Generate individual task commands if desired

**Next**: Once approved, begin implementation phase
`;
  }

  getNextPhase(): SpecPhase {
    return 'in-progress';
  }
}

/**
 * Implementation phase state
 */
export class ImplementationState extends SpecWorkflowState {
  getPhase(): SpecPhase {
    return 'in-progress';
  }

  canExecute(): boolean {
    return this.state.tasks.exists && this.state.tasks.approved;
  }

  async execute(): Promise<void> {
    console.log(`\n🔄 Resuming ${this.specName} at Implementation phase`);
    console.log('\n## Phase 4: Implementation');
    
    if (!this.canExecute()) {
      console.log('❌ Cannot proceed: Tasks must be approved first');
      console.log('Use /spec-modify tasks to complete the tasks phase');
      return;
    }

    console.log('📊 Implementation Status:');
    console.log(`   Total tasks: ${this.state.tasks.total}`);
    console.log(`   Completed: ${this.state.tasks.completed}`);
    console.log(`   Remaining: ${this.state.tasks.total - this.state.tasks.completed}`);

    if (this.state.tasks.nextPendingTask) {
      const nextTask = this.state.tasks.nextPendingTask;
      console.log(`\n⏭️  Next Task: ${nextTask.id} - ${nextTask.description}`);
      console.log(`   Execute with: /${this.specName}-task-${nextTask.id}`);
      console.log(`   Or use: /spec-orchestrate ${this.specName}`);
    } else {
      console.log('\n🎉 All tasks completed!');
      console.log('Run /spec-completion-review for final validation');
    }
  }

  getInstructions(): string {
    return `
## Implementation Phase Instructions

1. **Task Execution Options**
   - Individual task commands: /${this.specName}-task-{id}
   - Manual execution: /spec-execute {task-id} ${this.specName}
   - Automated orchestration: /spec-orchestrate ${this.specName}
   
2. **Best Practices**
   - Execute tasks in dependency order
   - Test each task after completion
   - Mark tasks complete when finished
   - Leverage existing code patterns
   
3. **Progress Tracking**
   - Use /spec-status ${this.specName} to check progress
   - Mark tasks complete using get-tasks --mode complete
   - Review completed work before proceeding

**Next**: Complete all tasks, then run completion review
`;
  }

  getNextPhase(): SpecPhase {
    return 'completed';
  }
}

/**
 * Factory for creating appropriate state instances
 */
export class SpecWorkflowStateFactory {
  static createState(phase: SpecPhase, specName: string, projectPath: string, state: SpecState): SpecWorkflowState {
    switch (phase) {
      case 'requirements':
      case 'not-started':
        return new RequirementsState(specName, projectPath, state);
      case 'design':
        return new DesignState(specName, projectPath, state);
      case 'tasks':
        return new TasksState(specName, projectPath, state);
      case 'in-progress':
      case 'completed':
        return new ImplementationState(specName, projectPath, state);
      default:
        throw new Error(`Unknown phase: ${phase}`);
    }
  }
}