import { readFile, access, stat } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';
import { parseAllTasksFromMarkdown, TaskInfo } from '../get-tasks';

export type SpecPhase = 'not-started' | 'requirements' | 'design' | 'tasks' | 'in-progress' | 'completed';

export interface SpecFileStatus {
  exists: boolean;
  approved: boolean;
  content?: string;
  lastModified?: Date;
}

export interface SpecState {
  name: string;
  phase: SpecPhase;
  requirements: SpecFileStatus;
  design: SpecFileStatus;
  tasks: SpecFileStatus & {
    total: number;
    completed: number;
    taskList: TaskInfo[];
    nextPendingTask?: TaskInfo;
  };
  canResumeAt: SpecPhase[];
  canModifyAt: SpecPhase[];
}

/**
 * Utility class to detect the current state of a specification
 * and determine what resume/modification options are available.
 */
export class SpecStateDetector {
  private projectPath: string;
  private specName: string;
  private specPath: string;

  constructor(specName: string, projectPath: string = process.cwd()) {
    this.specName = specName;
    this.projectPath = projectPath;
    this.specPath = join(projectPath, '.claude', 'specs', specName);
  }

  /**
   * Analyze the current state of the specification
   */
  async analyzeState(): Promise<SpecState> {
    const state: SpecState = {
      name: this.specName,
      phase: 'not-started',
      requirements: { exists: false, approved: false },
      design: { exists: false, approved: false },
      tasks: { exists: false, approved: false, total: 0, completed: 0, taskList: [] },
      canResumeAt: [],
      canModifyAt: []
    };

    // Check if spec directory exists
    if (!await this.fileExists(this.specPath)) {
      state.canResumeAt = ['requirements'];
      return state;
    }

    // Analyze requirements
    const requirementsPath = join(this.specPath, 'requirements.md');
    if (await this.fileExists(requirementsPath)) {
      const content = await readFile(requirementsPath, 'utf-8');
      const lastModified = await this.getLastModified(requirementsPath);
      
      state.requirements = {
        exists: true,
        approved: this.isPhaseApproved(content),
        content,
        lastModified
      };
      state.phase = 'requirements';

      if (state.requirements.approved) {
        state.phase = 'design';
      }
    } else {
      state.canResumeAt.push('requirements');
      return state;
    }

    // Analyze design
    const designPath = join(this.specPath, 'design.md');
    if (await this.fileExists(designPath)) {
      const content = await readFile(designPath, 'utf-8');
      const lastModified = await this.getLastModified(designPath);
      
      state.design = {
        exists: true,
        approved: this.isPhaseApproved(content),
        content,
        lastModified
      };

      if (state.design.approved) {
        state.phase = 'tasks';
      }
    }

    // Analyze tasks
    const tasksPath = join(this.specPath, 'tasks.md');
    if (await this.fileExists(tasksPath)) {
      const content = await readFile(tasksPath, 'utf-8');
      const lastModified = await this.getLastModified(tasksPath);
      const taskList = parseAllTasksFromMarkdown(content);
      const completed = taskList.filter(t => t.completed).length;
      const nextPendingTask = taskList.find(t => !t.completed);
      
      state.tasks = {
        exists: true,
        approved: this.isPhaseApproved(content),
        content,
        lastModified,
        total: taskList.length,
        completed,
        taskList,
        nextPendingTask
      };

      if (state.tasks.approved) {
        if (completed === 0) {
          state.phase = 'tasks';
        } else if (completed < taskList.length) {
          state.phase = 'in-progress';
        } else {
          state.phase = 'completed';
        }
      }
    }

    // Determine resume and modification options
    state.canResumeAt = this.determineResumeOptions(state);
    state.canModifyAt = this.determineModifyOptions(state);

    return state;
  }

  /**
   * Check if a phase appears to be approved based on content analysis
   */
  private isPhaseApproved(content: string): boolean {
    // Look for approval markers in the content
    const approvalMarkers = [
      /approved/i,
      /✅/,
      /complete/i,
      /ready for next phase/i,
      /phase.*complete/i,
      /sign-?off/i
    ];

    // Also check if the content seems complete (has substantial content)
    const hasSubstantialContent = content.trim().length > 500;
    const hasStructuredSections = (content.match(/^##?\s/gm) || []).length >= 3;

    // A phase is considered approved if it has approval markers OR substantial structured content
    const hasApprovalMarker = approvalMarkers.some(marker => marker.test(content));
    
    return hasApprovalMarker || (hasSubstantialContent && hasStructuredSections);
  }

  /**
   * Determine which phases can be resumed from
   */
  private determineResumeOptions(state: SpecState): SpecPhase[] {
    const options: SpecPhase[] = [];

    switch (state.phase) {
      case 'not-started':
        options.push('requirements');
        break;
      case 'requirements':
        if (state.requirements.approved) {
          options.push('design');
        } else {
          options.push('requirements');
        }
        break;
      case 'design':
        if (state.design.approved) {
          options.push('tasks');
        } else {
          options.push('design');
        }
        break;
      case 'tasks':
        if (state.tasks.approved) {
          options.push('in-progress');
        } else {
          options.push('tasks');
        }
        break;
      case 'in-progress':
        options.push('in-progress');
        break;
      case 'completed':
        // Can resume implementation if needed
        options.push('in-progress');
        break;
    }

    return options;
  }

  /**
   * Determine which phases can be modified
   */
  private determineModifyOptions(state: SpecState): SpecPhase[] {
    const options: SpecPhase[] = [];

    // Can always modify existing phases
    if (state.requirements.exists) options.push('requirements');
    if (state.design.exists) options.push('design');
    if (state.tasks.exists) options.push('tasks');

    return options;
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the last modified date of a file
   */
  private async getLastModified(filePath: string): Promise<Date> {
    try {
      const stats = await stat(filePath);
      return stats.mtime;
    } catch {
      return new Date();
    }
  }

  /**
   * Get a human-readable status summary
   */
  getStatusSummary(state: SpecState): string {
    const phase = state.phase.charAt(0).toUpperCase() + state.phase.slice(1).replace('-', ' ');
    const completionInfo = state.phase === 'in-progress' 
      ? ` (${state.tasks.completed}/${state.tasks.total} tasks complete)`
      : '';
    
    return `${phase}${completionInfo}`;
  }

  /**
   * Get next recommended action
   */
  getNextAction(state: SpecState): string {
    switch (state.phase) {
      case 'not-started':
        return 'Run /spec-create to start the specification';
      case 'requirements':
        return state.requirements.approved 
          ? 'Resume with design phase: /spec-resume --phase=design'
          : 'Complete requirements phase: /spec-modify requirements';
      case 'design':
        return state.design.approved
          ? 'Resume with tasks phase: /spec-resume --phase=tasks'
          : 'Complete design phase: /spec-modify design';
      case 'tasks':
        return state.tasks.approved
          ? 'Begin implementation: /spec-resume --phase=in-progress'
          : 'Complete tasks phase: /spec-modify tasks';
      case 'in-progress':
        const nextTask = state.tasks.nextPendingTask;
        return nextTask
          ? `Continue with task ${nextTask.id}: /${state.name}-task-${nextTask.id}`
          : 'All tasks complete! Run /spec-completion-review';
      case 'completed':
        return 'Specification is complete. Consider /spec-completion-review for final validation';
      default:
        return 'Unknown state. Run /spec-status for more information';
    }
  }
}