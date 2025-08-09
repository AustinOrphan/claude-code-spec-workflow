import { SpecStateDetector, SpecState, SpecPhase as WorkflowSpecPhase } from './SpecStateDetector';
import { SpecPhase } from './types/ParsedContent';
import { SpecWorkflowStateFactory, SpecWorkflowState } from './SpecWorkflowStates';
import { InteractiveModifier } from './InteractiveModifier';
import chalk from 'chalk';

/**
 * Abstract base command following the Command design pattern
 */
export abstract class SpecCommand {
  protected specName: string;
  protected projectPath: string;
  protected backup?: SpecState;

  constructor(specName: string, projectPath: string = process.cwd()) {
    this.specName = specName;
    this.projectPath = projectPath;
  }

  /**
   * Execute the command
   */
  abstract execute(): Promise<boolean>;

  /**
   * Undo the command (if supported)
   */
  abstract undo(): Promise<void>;

  /**
   * Get command description
   */
  abstract getDescription(): string;

  /**
   * Create a backup of the current state for undo functionality
   */
  protected async createBackup(): Promise<void> {
    const detector = new SpecStateDetector(this.specName, this.projectPath);
    this.backup = await detector.analyzeState();
  }
}

/**
 * Command to resume a spec from its current state
 */
export class SpecResumeCommand extends SpecCommand {
  private targetPhase?: WorkflowSpecPhase;

  constructor(specName: string, projectPath: string = process.cwd(), targetPhase?: WorkflowSpecPhase) {
    super(specName, projectPath);
    this.targetPhase = targetPhase;
  }

  async execute(): Promise<boolean> {
    try {
      await this.createBackup();

      const detector = new SpecStateDetector(this.specName, this.projectPath);
      const currentState = await detector.analyzeState();

      console.log(chalk.cyan(`\n📋 Resuming spec: ${this.specName}`));
      console.log(chalk.gray(`Current status: ${detector.getStatusSummary(currentState)}`));

      // Determine which phase to resume at
      let resumePhase: WorkflowSpecPhase;
      
      if (this.targetPhase) {
        // User specified a target phase
        if (!currentState.canResumeAt.includes(this.targetPhase) && 
            !currentState.canModifyAt.includes(this.targetPhase)) {
          console.log(chalk.red(`❌ Cannot resume at phase: ${this.targetPhase}`));
          console.log(chalk.yellow(`Available options: ${[...currentState.canResumeAt, ...currentState.canModifyAt].join(', ')}`));
          return false;
        }
        resumePhase = this.targetPhase;
      } else {
        // Auto-determine resume phase
        if (currentState.canResumeAt.length === 0) {
          console.log(chalk.red('❌ No resume options available'));
          console.log(chalk.yellow('Use /spec-status for more information'));
          return false;
        }
        resumePhase = currentState.canResumeAt[0];
      }

      console.log(chalk.green(`\n🔄 Resuming at: ${resumePhase} phase`));

      // Create and execute the appropriate state
      const workflowState = SpecWorkflowStateFactory.createState(
        resumePhase, 
        this.specName, 
        this.projectPath, 
        currentState
      );

      if (!workflowState.canExecute()) {
        console.log(chalk.red('❌ Cannot execute this phase'));
        console.log(chalk.yellow('Check prerequisites and try /spec-status for guidance'));
        return false;
      }

      await workflowState.execute();
      console.log(workflowState.getInstructions());

      const nextAction = detector.getNextAction(currentState);
      console.log(chalk.blue(`\n💡 Next Action: ${nextAction}`));

      return true;
    } catch (error) {
      console.error(chalk.red('Error resuming spec:'), error instanceof Error ? error.message : error);
      return false;
    }
  }

  async undo(): Promise<void> {
    if (this.backup) {
      console.log(chalk.yellow('⏪ Undoing resume operation...'));
      // For now, undo just shows what would be restored
      console.log(chalk.gray(`Would restore to: ${this.backup.phase} phase`));
    } else {
      console.log(chalk.gray('No backup available for undo'));
    }
  }

  getDescription(): string {
    const phaseInfo = this.targetPhase ? ` at ${this.targetPhase} phase` : '';
    return `Resume spec '${this.specName}'${phaseInfo}`;
  }
}

/**
 * Command to modify a specific phase of a spec
 */
export class SpecModifyCommand extends SpecCommand {
  private targetPhase: SpecPhase;
  private interactiveMode: boolean;

  constructor(specName: string, targetPhase: SpecPhase, projectPath: string = process.cwd(), interactive: boolean = false) {
    super(specName, projectPath);
    this.targetPhase = targetPhase;
    this.interactiveMode = interactive;
  }

  async execute(): Promise<boolean> {
    try {
      await this.createBackup();

      const detector = new SpecStateDetector(this.specName, this.projectPath);
      const currentState = await detector.analyzeState();

      console.log(chalk.cyan(`\n✏️  Modifying spec: ${this.specName}`));
      console.log(chalk.gray(`Current status: ${detector.getStatusSummary(currentState)}`));
      console.log(chalk.gray(`Target phase: ${this.targetPhase}`));
      console.log(chalk.gray(`Mode: ${this.interactiveMode ? 'Interactive' : 'Manual'}`));

      // Check if the target phase can be modified
      if (!currentState.canModifyAt.includes(this.targetPhase)) {
        console.log(chalk.red(`❌ Cannot modify phase: ${this.targetPhase}`));
        
        if (!this.phaseExists(currentState, this.targetPhase)) {
          console.log(chalk.yellow(`Phase '${this.targetPhase}' does not exist yet`));
          console.log(chalk.blue(`Use /spec-resume --phase=${this.targetPhase} to create it`));
        } else {
          console.log(chalk.yellow(`Available modification options: ${currentState.canModifyAt.join(', ')}`));
        }
        return false;
      }

      console.log(chalk.green(`\n🔧 Modifying: ${this.targetPhase} phase`));

      // Show current content info
      const phaseInfo = this.getPhaseInfo(currentState, this.targetPhase);
      if (phaseInfo) {
        console.log(chalk.gray(`Last modified: ${phaseInfo.lastModified?.toLocaleString() || 'Unknown'}`));
        console.log(chalk.gray(`Status: ${phaseInfo.approved ? 'Approved' : 'In Progress'}`));
      }

      // Handle interactive mode
      if (this.interactiveMode) {
        console.log(chalk.cyan('\n🎯 Starting interactive modification session...'));
        
        try {
          // Validate that this is a valid phase for interactive modification
          if (!this.isValidInteractivePhase(this.targetPhase)) {
            console.log(chalk.red(`❌ Interactive mode is not available for phase: ${this.targetPhase}`));
            console.log(chalk.yellow('Available interactive phases: requirements, design, tasks'));
            console.log(chalk.yellow('Falling back to manual mode...'));
          } else {
            const interactiveModifier = new InteractiveModifier({
              enableAgentAnalysis: true,
              verbose: false,
              userPermissions: {
                canAdd: true,
                canModify: true,
                canDelete: false,
                canReorder: true,
                canApprove: false,
                allowedPhases: ['requirements', 'design', 'tasks'],
                restrictedSections: []
              }
            });

            const success = await interactiveModifier.startInteractiveSession(this.specName, this.targetPhase);
            
            if (success) {
              console.log(chalk.green('\n✅ Interactive modification session completed successfully'));
              const nextAction = detector.getNextAction(currentState);
              console.log(chalk.blue(`💡 Next Action: ${nextAction}`));
            } else {
              console.log(chalk.yellow('\n⚠️  Interactive modification session ended without completion'));
            }
            
            return success;
          }
        } catch (interactiveError) {
          console.error(chalk.red('Interactive modification failed:'), 
                       interactiveError instanceof Error ? interactiveError.message : interactiveError);
          console.log(chalk.yellow('Falling back to manual mode...'));
          // Continue with manual mode as fallback
        }
      }

      // Manual mode (original behavior) or fallback from interactive mode failure
      const workflowState = SpecWorkflowStateFactory.createState(
        this.targetPhase, 
        this.specName, 
        this.projectPath, 
        currentState
      );

      console.log(`\n📝 You can now modify the ${this.targetPhase} phase:`);
      console.log(chalk.blue(`   Edit: .claude/specs/${this.specName}/${this.targetPhase}.md`));
      console.log(chalk.blue(`   Use template guidance and project standards`));

      console.log(workflowState.getInstructions());

      const nextAction = detector.getNextAction(currentState);
      console.log(chalk.blue(`\n💡 After modification: ${nextAction}`));

      return true;
    } catch (error) {
      console.error(chalk.red('Error modifying spec:'), error instanceof Error ? error.message : error);
      return false;
    }
  }

  async undo(): Promise<void> {
    if (this.backup) {
      console.log(chalk.yellow('⏪ Undoing modify operation...'));
      console.log(chalk.gray(`Would restore ${this.targetPhase} phase to previous state`));
    } else {
      console.log(chalk.gray('No backup available for undo'));
    }
  }

  getDescription(): string {
    const modeDescription = this.interactiveMode ? 'interactively' : 'manually';
    return `Modify ${this.targetPhase} phase of spec '${this.specName}' ${modeDescription}`;
  }

  /**
   * Get the interactive mode flag
   * @returns True if interactive mode is enabled
   */
  public isInteractiveMode(): boolean {
    return this.interactiveMode;
  }

  /**
   * Set the interactive mode flag
   * @param interactive - Whether to enable interactive mode
   */
  public setInteractiveMode(interactive: boolean): void {
    this.interactiveMode = interactive;
  }

  /**
   * Check if the target phase is valid for interactive modification
   * @param phase - The phase to check
   * @returns True if the phase supports interactive modification
   * @private
   */
  private isValidInteractivePhase(phase: SpecPhase): boolean {
    return ['requirements', 'design', 'tasks'].includes(phase);
  }

  private phaseExists(state: SpecState, phase: SpecPhase): boolean {
    switch (phase) {
      case 'requirements':
        return state.requirements.exists;
      case 'design':
        return state.design.exists;
      case 'tasks':
        return state.tasks.exists;
      default:
        return false;
    }
  }

  private getPhaseInfo(state: SpecState, phase: SpecPhase) {
    switch (phase) {
      case 'requirements':
        return state.requirements;
      case 'design':
        return state.design;
      case 'tasks':
        return state.tasks;
      default:
        return null;
    }
  }
}

/**
 * Command to show detailed status of a spec
 */
export class SpecStatusCommand extends SpecCommand {
  async execute(): Promise<boolean> {
    try {
      const detector = new SpecStateDetector(this.specName, this.projectPath);
      const state = await detector.analyzeState();

      console.log(chalk.cyan(`\n📊 Spec Status: ${this.specName}`));
      console.log(chalk.gray('═'.repeat(50)));

      // Current phase and status
      console.log(chalk.bold(`Current Phase: ${state.phase}`));
      console.log(chalk.gray(`Status: ${detector.getStatusSummary(state)}\n`));

      // Phase breakdown
      this.displayPhaseStatus('Requirements', state.requirements.exists, state.requirements.approved);
      this.displayPhaseStatus('Design', state.design.exists, state.design.approved);
      this.displayPhaseStatus('Tasks', state.tasks.exists, state.tasks.approved, 
        state.tasks.exists ? `${state.tasks.completed}/${state.tasks.total} complete` : undefined);

      // Available actions
      console.log(chalk.bold('\n🎯 Available Actions:'));
      
      if (state.canResumeAt.length > 0) {
        console.log(chalk.green('  Resume options:'));
        state.canResumeAt.forEach(phase => {
          console.log(chalk.gray(`    /spec-resume ${this.specName} --phase=${phase}`));
        });
      }

      if (state.canModifyAt.length > 0) {
        console.log(chalk.blue('  Modify options:'));
        state.canModifyAt.forEach(phase => {
          console.log(chalk.gray(`    /spec-modify ${this.specName} --phase=${phase}`));
        });
      }

      // Next recommended action
      console.log(chalk.bold('\n💡 Recommended Next Step:'));
      console.log(chalk.yellow(`  ${detector.getNextAction(state)}`));

      // Task details if in implementation phase
      if (state.phase === 'in-progress' && state.tasks.nextPendingTask) {
        console.log(chalk.bold('\n📋 Next Task:'));
        const task = state.tasks.nextPendingTask;
        console.log(chalk.gray(`  ${task.id}: ${task.description}`));
        if (task.requirements) console.log(chalk.gray(`  Requirements: ${task.requirements}`));
        if (task.leverage) console.log(chalk.gray(`  Leverage: ${task.leverage}`));
      }

      return true;
    } catch (error) {
      console.error(chalk.red('Error getting spec status:'), error instanceof Error ? error.message : error);
      return false;
    }
  }

  async undo(): Promise<void> {
    // Status command doesn't modify anything, so no undo needed
  }

  getDescription(): string {
    return `Show detailed status for spec '${this.specName}'`;
  }

  private displayPhaseStatus(phaseName: string, exists: boolean, approved: boolean, extraInfo?: string) {
    const status = exists 
      ? (approved ? chalk.green('✅ Complete') : chalk.yellow('🔄 In Progress'))
      : chalk.gray('⏸️  Not Started');
    
    const info = extraInfo ? chalk.gray(` (${extraInfo})`) : '';
    console.log(`  ${phaseName}: ${status}${info}`);
  }
}

/**
 * Command invoker that manages and executes commands
 * Implements the Invoker part of the Command pattern
 */
export class SpecCommandInvoker {
  private commandHistory: SpecCommand[] = [];

  async executeCommand(command: SpecCommand): Promise<boolean> {
    console.log(chalk.gray(`Executing: ${command.getDescription()}`));
    
    const success = await command.execute();
    
    if (success) {
      this.commandHistory.push(command);
      console.log(chalk.green('✅ Command completed successfully'));
    } else {
      console.log(chalk.red('❌ Command failed'));
    }
    
    return success;
  }

  async undoLastCommand(): Promise<void> {
    const lastCommand = this.commandHistory.pop();
    
    if (lastCommand) {
      console.log(chalk.yellow(`Undoing: ${lastCommand.getDescription()}`));
      await lastCommand.undo();
    } else {
      console.log(chalk.gray('No commands to undo'));
    }
  }

  getCommandHistory(): string[] {
    return this.commandHistory.map(cmd => cmd.getDescription());
  }
}