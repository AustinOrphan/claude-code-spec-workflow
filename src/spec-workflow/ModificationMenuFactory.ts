/**
 * ModificationMenuFactory - Generates phase-specific modification menus for interactive spec modify
 * 
 * This factory class creates contextual menus with available modification actions based on:
 * - Current specification phase (requirements, design, tasks)
 * - User permissions and content analysis
 * - AI-generated suggestions from agent analysis
 * 
 * The factory provides the foundation for the interactive menu generation system
 * used by the InteractiveModifier orchestrator.
 */

import { SpecPhase } from './types/ParsedContent';
import { 
  ModificationMenu, 
  ModificationAction, 
  Suggestion, 
  UserPermissions,
  ActionType,
  ConflictSeverity
} from './types/ModificationMenu';
import { SpecState } from './SpecStateDetector';

/**
 * Context required for menu generation including content analysis and user state
 */
export interface MenuGenerationContext {
  /** The specification name */
  specName: string;
  
  /** Current phase status information */
  phaseStatus: string;
  
  /** Whether the current phase has been approved */
  approved: boolean;
  
  /** When the content was last modified */
  lastModified: Date;
  
  /** Current user permissions */
  userPermissions: UserPermissions;
  
  /** Available content sections that can be modified */
  availableSections: string[];
  
  /** Current restrictions on modifications */
  restrictions: string[];
  
  /** AI-generated suggestions (if available) */
  suggestions?: Suggestion[];
  
  /** Enhanced context from SpecStateDetector (optional) */
  specificationState?: SpecState | null;
  
  /** Total number of tasks in the specification */
  totalTasks?: number;
  
  /** Number of completed tasks */
  completedTasks?: number;
  
  /** ID of the next pending task */
  nextPendingTask?: string;
}

/**
 * Factory class for generating phase-specific modification menus
 * 
 * The factory creates contextual menus that adapt to the current specification phase,
 * user permissions, and content analysis results. Each phase has specific modification
 * actions available that align with the workflow requirements.
 */
export class ModificationMenuFactory {
  
  /**
   * Creates a phase-specific modification menu with available actions and suggestions
   * 
   * This method serves as the main entry point for menu generation. It analyzes the
   * current phase and context to determine which modification actions are available
   * and appropriate for the user.
   * 
   * @param phase - The current specification phase (requirements, design, or tasks)
   * @param context - Context information including user permissions and content state
   * @returns A ModificationMenu configured for the specified phase and context
   * 
   * @example
   * ```typescript
   * const factory = new ModificationMenuFactory();
   * const menu = factory.createPhaseMenu('requirements', {
   *   specName: 'user-auth',
   *   phaseStatus: 'in-progress',
   *   approved: false,
   *   lastModified: new Date(),
   *   userPermissions: { canAdd: true, canModify: true, ... },
   *   availableSections: ['user-story', 'acceptance-criteria'],
   *   restrictions: []
   * });
   * ```
   */
  createPhaseMenu(phase: SpecPhase, context: MenuGenerationContext): ModificationMenu {
    switch (phase) {
      case 'requirements':
        return this.createRequirementsMenu(context);
      case 'design':
        return this.createDesignMenu(context);
      case 'tasks':
        return this.createTasksMenu(context);
      default:
        throw new Error(`Unsupported phase: ${phase}`);
    }
  }

  /**
   * Creates the base menu structure that is common across all phases
   * 
   * @param phase - The specification phase
   * @param context - Menu generation context
   * @returns Base menu structure to be extended by phase-specific logic
   * @protected
   */
  protected createBaseMenu(phase: SpecPhase, context: MenuGenerationContext): Partial<ModificationMenu> {
    // Foundation method - implementation will be added in subsequent tasks
    throw new Error('ModificationMenuFactory.createBaseMenu() - Implementation pending in subsequent tasks');
  }

  /**
   * Validates user permissions against requested actions
   * 
   * @param action - The modification action to validate
   * @param permissions - Current user permissions
   * @returns Whether the action is permitted
   * @protected
   */
  protected validateActionPermissions(action: ModificationAction, permissions: UserPermissions): boolean {
    // Validation method - implementation will be added in subsequent tasks
    throw new Error('ModificationMenuFactory.validateActionPermissions() - Implementation pending in subsequent tasks');
  }

  /**
   * Creates a requirements-specific modification menu with actions for user stories,
   * acceptance criteria, and other requirements documentation
   * 
   * @param context - Menu generation context
   * @returns ModificationMenu configured for requirements phase
   * @protected
   */
  protected createRequirementsMenu(context: MenuGenerationContext): ModificationMenu {
    const actions: ModificationAction[] = [];
    const { userPermissions, availableSections, restrictions } = context;

    // Add user story action
    if (userPermissions.canAdd && !restrictions.includes('no-user-stories')) {
      actions.push({
        id: 'add-user-story',
        label: 'Add User Story',
        description: 'Add a new user story with persona, goal, and benefit',
        requiresApproval: false,
        targetSection: 'user-story',
        actionType: 'add',
        enabled: true,
        shortcut: 'u'
      });
    }

    // Modify existing user story action
    if (userPermissions.canModify && availableSections.includes('user-story')) {
      actions.push({
        id: 'modify-user-story',
        label: 'Modify Existing User Story',
        description: 'Edit an existing user story content or structure',
        requiresApproval: context.approved,
        targetSection: 'user-story',
        actionType: 'modify',
        enabled: true,
        shortcut: 'm'
      });
    }

    // Add acceptance criteria action
    if (userPermissions.canAdd && !restrictions.includes('no-acceptance-criteria')) {
      actions.push({
        id: 'add-acceptance-criteria',
        label: 'Add Acceptance Criteria',
        description: 'Add new acceptance criteria for a user story',
        requiresApproval: false,
        targetSection: 'acceptance-criteria',
        actionType: 'add',
        enabled: true,
        shortcut: 'a'
      });
    }

    // Modify acceptance criteria action
    if (userPermissions.canModify && availableSections.includes('acceptance-criteria')) {
      actions.push({
        id: 'modify-acceptance-criteria',
        label: 'Modify Acceptance Criteria',
        description: 'Edit existing acceptance criteria for clarity or completeness',
        requiresApproval: context.approved,
        targetSection: 'acceptance-criteria',
        actionType: 'modify',
        enabled: true,
        shortcut: 'c'
      });
    }

    // Add business rules action
    if (userPermissions.canAdd && !restrictions.includes('no-business-rules')) {
      actions.push({
        id: 'add-business-rule',
        label: 'Add Business Rule',
        description: 'Define a new business rule or constraint',
        requiresApproval: false,
        targetSection: 'business-rules',
        actionType: 'add',
        enabled: true,
        shortcut: 'b'
      });
    }

    // Add success metrics action
    if (userPermissions.canAdd && !restrictions.includes('no-metrics')) {
      actions.push({
        id: 'add-success-metrics',
        label: 'Define Success Metrics',
        description: 'Add measurable success criteria and KPIs',
        requiresApproval: false,
        targetSection: 'success-metrics',
        actionType: 'add',
        enabled: true,
        shortcut: 's'
      });
    }

    // Add assumptions and constraints action
    if (userPermissions.canAdd && !restrictions.includes('no-assumptions')) {
      actions.push({
        id: 'add-assumptions',
        label: 'Add Assumptions & Constraints',
        description: 'Document project assumptions and known constraints',
        requiresApproval: false,
        targetSection: 'assumptions',
        actionType: 'add',
        enabled: true,
        shortcut: 'z'
      });
    }

    // Delete/remove actions (if user has delete permissions)
    if (userPermissions.canDelete && !context.approved) {
      actions.push({
        id: 'remove-requirement',
        label: 'Remove Requirement Element',
        description: 'Remove a user story, acceptance criteria, or other requirement',
        requiresApproval: false,
        actionType: 'delete',
        enabled: true,
        shortcut: 'd'
      });
    }

    // Reorder requirements action
    if (userPermissions.canReorder && availableSections.length > 1) {
      actions.push({
        id: 'reorder-requirements',
        label: 'Reorder Requirements',
        description: 'Change the order and priority of requirements elements',
        requiresApproval: context.approved,
        actionType: 'reorder',
        enabled: true,
        shortcut: 'r'
      });
    }

    // Validate requirements action
    if (userPermissions.canModify) {
      actions.push({
        id: 'validate-requirements',
        label: 'Validate Requirements Completeness',
        description: 'Run completeness checks and quality validation',
        requiresApproval: false,
        actionType: 'modify',
        enabled: true,
        shortcut: 'v'
      });
    }

    // Filter suggestions for requirements phase
    const filteredSuggestions = context.suggestions 
      ? this.filterSuggestions(context.suggestions, 'requirements', context)
      : [];

    // Check if any actions require approval
    const hasApprovalRequired = actions.some(action => action.requiresApproval);

    return {
      phase: 'requirements',
      actions,
      suggestions: filteredSuggestions,
      restrictions,
      userPermissions,
      hasApprovalRequired,
      context: {
        specName: context.specName,
        phaseStatus: context.phaseStatus,
        lastModified: context.lastModified,
        approved: context.approved
      }
    };
  }

  /**
   * Creates a design-specific modification menu with actions for architecture,
   * components, data models, and other design documentation
   * 
   * @param context - Menu generation context
   * @returns ModificationMenu configured for design phase
   * @protected
   */
  protected createDesignMenu(context: MenuGenerationContext): ModificationMenu {
    const actions: ModificationAction[] = [];
    const { userPermissions, availableSections, restrictions } = context;

    // Modify architecture action
    if (userPermissions.canModify && availableSections.includes('architecture')) {
      actions.push({
        id: 'modify-architecture',
        label: 'Modify Architecture',
        description: 'Update system architecture, patterns, or high-level design decisions',
        requiresApproval: context.approved,
        targetSection: 'architecture',
        actionType: 'modify',
        enabled: true,
        shortcut: 'a'
      });
    }

    // Add components action
    if (userPermissions.canAdd && !restrictions.includes('no-components')) {
      actions.push({
        id: 'add-component',
        label: 'Add Components',
        description: 'Define new system components, modules, or services',
        requiresApproval: false,
        targetSection: 'components',
        actionType: 'add',
        enabled: true,
        shortcut: 'c'
      });
    }

    // Modify existing components action
    if (userPermissions.canModify && availableSections.includes('components')) {
      actions.push({
        id: 'modify-component',
        label: 'Modify Existing Components',
        description: 'Update component specifications, interfaces, or responsibilities',
        requiresApproval: context.approved,
        targetSection: 'components',
        actionType: 'modify',
        enabled: true,
        shortcut: 'm'
      });
    }

    // Add data models action
    if (userPermissions.canAdd && !restrictions.includes('no-data-models')) {
      actions.push({
        id: 'add-data-model',
        label: 'Add Data Models',
        description: 'Define new data structures, entities, or database schemas',
        requiresApproval: false,
        targetSection: 'data-models',
        actionType: 'add',
        enabled: true,
        shortcut: 'd'
      });
    }

    // Modify data models action
    if (userPermissions.canModify && availableSections.includes('data-models')) {
      actions.push({
        id: 'modify-data-model',
        label: 'Modify Data Models',
        description: 'Update existing data structures or relationships',
        requiresApproval: context.approved,
        targetSection: 'data-models',
        actionType: 'modify',
        enabled: true,
        shortcut: 'o'
      });
    }

    // Add API specifications action
    if (userPermissions.canAdd && !restrictions.includes('no-api-specs')) {
      actions.push({
        id: 'add-api-spec',
        label: 'Add API Specifications',
        description: 'Define REST endpoints, GraphQL schemas, or service interfaces',
        requiresApproval: false,
        targetSection: 'api-specifications',
        actionType: 'add',
        enabled: true,
        shortcut: 'p'
      });
    }

    // Modify API specifications action
    if (userPermissions.canModify && availableSections.includes('api-specifications')) {
      actions.push({
        id: 'modify-api-spec',
        label: 'Modify API Specifications',
        description: 'Update existing API endpoints, parameters, or response formats',
        requiresApproval: context.approved,
        targetSection: 'api-specifications',
        actionType: 'modify',
        enabled: true,
        shortcut: 'i'
      });
    }

    // Add UI/UX design action
    if (userPermissions.canAdd && !restrictions.includes('no-ui-design')) {
      actions.push({
        id: 'add-ui-design',
        label: 'Add UI/UX Design',
        description: 'Define user interface layouts, flows, or interaction patterns',
        requiresApproval: false,
        targetSection: 'ui-design',
        actionType: 'add',
        enabled: true,
        shortcut: 'u'
      });
    }

    // Add security design action
    if (userPermissions.canAdd && !restrictions.includes('no-security')) {
      actions.push({
        id: 'add-security-design',
        label: 'Add Security Design',
        description: 'Define authentication, authorization, or security measures',
        requiresApproval: false,
        targetSection: 'security-design',
        actionType: 'add',
        enabled: true,
        shortcut: 's'
      });
    }

    // Modify security design action
    if (userPermissions.canModify && availableSections.includes('security-design')) {
      actions.push({
        id: 'modify-security-design',
        label: 'Modify Security Design',
        description: 'Update security policies, access controls, or threat models',
        requiresApproval: context.approved,
        targetSection: 'security-design',
        actionType: 'modify',
        enabled: true,
        shortcut: 'e'
      });
    }

    // Add technology stack action
    if (userPermissions.canAdd && !restrictions.includes('no-tech-stack')) {
      actions.push({
        id: 'add-tech-stack',
        label: 'Add Technology Stack',
        description: 'Define frameworks, libraries, tools, or infrastructure choices',
        requiresApproval: false,
        targetSection: 'technology-stack',
        actionType: 'add',
        enabled: true,
        shortcut: 't'
      });
    }

    // Modify technology stack action
    if (userPermissions.canModify && availableSections.includes('technology-stack')) {
      actions.push({
        id: 'modify-tech-stack',
        label: 'Modify Technology Stack',
        description: 'Update technology choices, versions, or architectural decisions',
        requiresApproval: context.approved,
        targetSection: 'technology-stack',
        actionType: 'modify',
        enabled: true,
        shortcut: 'k'
      });
    }

    // Add design patterns action
    if (userPermissions.canAdd && !restrictions.includes('no-patterns')) {
      actions.push({
        id: 'add-design-patterns',
        label: 'Add Design Patterns',
        description: 'Document design patterns, conventions, or coding standards',
        requiresApproval: false,
        targetSection: 'design-patterns',
        actionType: 'add',
        enabled: true,
        shortcut: 'n'
      });
    }

    // Add performance considerations action
    if (userPermissions.canAdd && !restrictions.includes('no-performance')) {
      actions.push({
        id: 'add-performance',
        label: 'Add Performance Considerations',
        description: 'Define performance requirements, optimization strategies, or metrics',
        requiresApproval: false,
        targetSection: 'performance',
        actionType: 'add',
        enabled: true,
        shortcut: 'f'
      });
    }

    // Add deployment design action
    if (userPermissions.canAdd && !restrictions.includes('no-deployment')) {
      actions.push({
        id: 'add-deployment-design',
        label: 'Add Deployment Design',
        description: 'Define deployment strategies, environments, or CI/CD workflows',
        requiresApproval: false,
        targetSection: 'deployment-design',
        actionType: 'add',
        enabled: true,
        shortcut: 'l'
      });
    }

    // Delete/remove design elements (if user has delete permissions)
    if (userPermissions.canDelete && !context.approved) {
      actions.push({
        id: 'remove-design-element',
        label: 'Remove Design Element',
        description: 'Remove a component, API, data model, or other design element',
        requiresApproval: false,
        actionType: 'delete',
        enabled: true,
        shortcut: 'r'
      });
    }

    // Reorder design elements action
    if (userPermissions.canReorder && availableSections.length > 1) {
      actions.push({
        id: 'reorder-design-elements',
        label: 'Reorder Design Elements',
        description: 'Change the organization and flow of design documentation',
        requiresApproval: context.approved,
        actionType: 'reorder',
        enabled: true,
        shortcut: 'g'
      });
    }

    // Validate design consistency action
    if (userPermissions.canModify) {
      actions.push({
        id: 'validate-design-consistency',
        label: 'Validate Design Consistency',
        description: 'Check for design conflicts, gaps, or consistency issues',
        requiresApproval: false,
        actionType: 'modify',
        enabled: true,
        shortcut: 'v'
      });
    }

    // Generate design documentation action
    if (userPermissions.canModify && !restrictions.includes('no-documentation')) {
      actions.push({
        id: 'generate-design-docs',
        label: 'Generate Design Documentation',
        description: 'Auto-generate diagrams, API docs, or technical specifications',
        requiresApproval: false,
        actionType: 'add',
        enabled: true,
        shortcut: 'b'
      });
    }

    // Filter suggestions for design phase
    const filteredSuggestions = context.suggestions 
      ? this.filterSuggestions(context.suggestions, 'design', context)
      : [];

    // Check if any actions require approval
    const hasApprovalRequired = actions.some(action => action.requiresApproval);

    return {
      phase: 'design',
      actions,
      suggestions: filteredSuggestions,
      restrictions,
      userPermissions,
      hasApprovalRequired,
      context: {
        specName: context.specName,
        phaseStatus: context.phaseStatus,
        lastModified: context.lastModified,
        approved: context.approved
      }
    };
  }

  /**
   * Creates a tasks-specific modification menu with actions for task management,
   * atomicity improvements, dependency updates, and other task-related modifications
   * 
   * @param context - Menu generation context
   * @returns ModificationMenu configured for tasks phase
   * @protected
   */
  protected createTasksMenu(context: MenuGenerationContext): ModificationMenu {
    const actions: ModificationAction[] = [];
    const { userPermissions, availableSections, restrictions } = context;

    // Add new task action
    if (userPermissions.canAdd && !restrictions.includes('no-new-tasks')) {
      actions.push({
        id: 'add-task',
        label: 'Add New Task',
        description: 'Create a new implementation task with clear requirements and acceptance criteria',
        requiresApproval: false,
        targetSection: 'task',
        actionType: 'add',
        enabled: true,
        shortcut: 't'
      });
    }

    // Modify existing task action
    if (userPermissions.canModify && availableSections.includes('task')) {
      actions.push({
        id: 'modify-task',
        label: 'Modify Existing Task',
        description: 'Update task content, requirements, or acceptance criteria',
        requiresApproval: context.approved,
        targetSection: 'task',
        actionType: 'modify',
        enabled: true,
        shortcut: 'm'
      });
    }

    // Improve task atomicity action
    if (userPermissions.canModify && availableSections.includes('task')) {
      actions.push({
        id: 'improve-atomicity',
        label: 'Improve Task Atomicity',
        description: 'Break down complex tasks into smaller, more atomic units for better parallel execution',
        requiresApproval: context.approved,
        targetSection: 'task',
        actionType: 'modify',
        enabled: true,
        shortcut: 'a'
      });
    }

    // Update task dependencies action
    if (userPermissions.canModify && availableSections.includes('task')) {
      actions.push({
        id: 'update-dependencies',
        label: 'Update Task Dependencies',
        description: 'Modify task dependencies, prerequisites, or execution order',
        requiresApproval: context.approved,
        targetSection: 'task',
        actionType: 'modify',
        enabled: true,
        shortcut: 'd'
      });
    }

    // Re-prioritize tasks action
    if (userPermissions.canReorder && availableSections.includes('task')) {
      actions.push({
        id: 'reprioritize-tasks',
        label: 'Re-prioritize Tasks',
        description: 'Change task priority order and execution sequence',
        requiresApproval: context.approved,
        targetSection: 'task',
        actionType: 'reorder',
        enabled: true,
        shortcut: 'p'
      });
    }

    // Add task acceptance criteria action
    if (userPermissions.canAdd && !restrictions.includes('no-acceptance-criteria')) {
      actions.push({
        id: 'add-task-acceptance',
        label: 'Add Task Acceptance Criteria',
        description: 'Define specific acceptance criteria and completion requirements for tasks',
        requiresApproval: false,
        targetSection: 'task-acceptance-criteria',
        actionType: 'add',
        enabled: true,
        shortcut: 'c'
      });
    }

    // Add task validation rules action
    if (userPermissions.canAdd && !restrictions.includes('no-validation')) {
      actions.push({
        id: 'add-validation-rules',
        label: 'Add Task Validation Rules',
        description: 'Define validation requirements, testing criteria, or quality gates',
        requiresApproval: false,
        targetSection: 'task-validation',
        actionType: 'add',
        enabled: true,
        shortcut: 'v'
      });
    }

    // Add task implementation notes action
    if (userPermissions.canAdd && !restrictions.includes('no-implementation-notes')) {
      actions.push({
        id: 'add-implementation-notes',
        label: 'Add Implementation Notes',
        description: 'Provide technical guidance, patterns, or implementation hints',
        requiresApproval: false,
        targetSection: 'implementation-notes',
        actionType: 'add',
        enabled: true,
        shortcut: 'n'
      });
    }

    // Add task testing requirements action
    if (userPermissions.canAdd && !restrictions.includes('no-testing')) {
      actions.push({
        id: 'add-testing-requirements',
        label: 'Add Testing Requirements',
        description: 'Define unit tests, integration tests, or other testing requirements',
        requiresApproval: false,
        targetSection: 'testing-requirements',
        actionType: 'add',
        enabled: true,
        shortcut: 'e'
      });
    }

    // Add task effort estimation action
    if (userPermissions.canAdd && !restrictions.includes('no-effort-estimation')) {
      actions.push({
        id: 'add-effort-estimation',
        label: 'Add Effort Estimation',
        description: 'Provide time estimates, complexity analysis, or resource requirements',
        requiresApproval: false,
        targetSection: 'effort-estimation',
        actionType: 'add',
        enabled: true,
        shortcut: 'f'
      });
    }

    // Add task categories/labels action
    if (userPermissions.canAdd && !restrictions.includes('no-categories')) {
      actions.push({
        id: 'add-task-categories',
        label: 'Add Task Categories',
        description: 'Organize tasks with categories, labels, or groupings',
        requiresApproval: false,
        targetSection: 'task-categories',
        actionType: 'add',
        enabled: true,
        shortcut: 'g'
      });
    }

    // Merge tasks action (for improving atomicity)
    if (userPermissions.canModify && availableSections.includes('task')) {
      actions.push({
        id: 'merge-tasks',
        label: 'Merge Related Tasks',
        description: 'Combine closely related tasks that should be executed together',
        requiresApproval: context.approved,
        targetSection: 'task',
        actionType: 'modify',
        enabled: true,
        shortcut: 'j'
      });
    }

    // Split task action (for improving atomicity)
    if (userPermissions.canModify && availableSections.includes('task')) {
      actions.push({
        id: 'split-task',
        label: 'Split Complex Task',
        description: 'Break down a complex task into multiple atomic sub-tasks',
        requiresApproval: context.approved,
        targetSection: 'task',
        actionType: 'modify',
        enabled: true,
        shortcut: 's'
      });
    }

    // Add task milestones action
    if (userPermissions.canAdd && !restrictions.includes('no-milestones')) {
      actions.push({
        id: 'add-milestones',
        label: 'Add Task Milestones',
        description: 'Define checkpoints, milestones, or intermediate deliverables',
        requiresApproval: false,
        targetSection: 'task-milestones',
        actionType: 'add',
        enabled: true,
        shortcut: 'i'
      });
    }

    // Update task status action
    if (userPermissions.canModify && availableSections.includes('task')) {
      actions.push({
        id: 'update-task-status',
        label: 'Update Task Status',
        description: 'Change task status, progress, or completion state',
        requiresApproval: false,
        targetSection: 'task',
        actionType: 'modify',
        enabled: true,
        shortcut: 'u'
      });
    }

    // Add task risk assessment action
    if (userPermissions.canAdd && !restrictions.includes('no-risk-assessment')) {
      actions.push({
        id: 'add-risk-assessment',
        label: 'Add Risk Assessment',
        description: 'Document potential risks, blockers, or challenges for tasks',
        requiresApproval: false,
        targetSection: 'risk-assessment',
        actionType: 'add',
        enabled: true,
        shortcut: 'k'
      });
    }

    // Delete/remove tasks action (if user has delete permissions)
    if (userPermissions.canDelete && !context.approved) {
      actions.push({
        id: 'remove-task',
        label: 'Remove Task',
        description: 'Remove a task or task element that is no longer needed',
        requiresApproval: false,
        actionType: 'delete',
        enabled: true,
        shortcut: 'r'
      });
    }

    // Validate task completeness action
    if (userPermissions.canModify) {
      actions.push({
        id: 'validate-task-completeness',
        label: 'Validate Task Completeness',
        description: 'Check tasks for completeness, atomicity, and implementation readiness',
        requiresApproval: false,
        actionType: 'modify',
        enabled: true,
        shortcut: 'l'
      });
    }

    // Generate task commands action
    if (userPermissions.canModify && !restrictions.includes('no-command-generation')) {
      actions.push({
        id: 'generate-task-commands',
        label: 'Generate Task Commands',
        description: 'Regenerate individual task command files from updated task definitions',
        requiresApproval: false,
        actionType: 'add',
        enabled: true,
        shortcut: 'o'
      });
    }

    // Optimize task parallelization action
    if (userPermissions.canModify && availableSections.includes('task')) {
      actions.push({
        id: 'optimize-parallelization',
        label: 'Optimize Task Parallelization',
        description: 'Reorganize tasks to maximize parallel execution opportunities',
        requiresApproval: context.approved,
        targetSection: 'task',
        actionType: 'modify',
        enabled: true,
        shortcut: 'z'
      });
    }

    // Filter suggestions for tasks phase
    const filteredSuggestions = context.suggestions 
      ? this.filterSuggestions(context.suggestions, 'tasks', context)
      : [];

    // Check if any actions require approval
    const hasApprovalRequired = actions.some(action => action.requiresApproval);

    return {
      phase: 'tasks',
      actions,
      suggestions: filteredSuggestions,
      restrictions,
      userPermissions,
      hasApprovalRequired,
      context: {
        specName: context.specName,
        phaseStatus: context.phaseStatus,
        lastModified: context.lastModified,
        approved: context.approved
      }
    };
  }

  /**
   * Generates dynamic suggestions based on content analysis and agent insights
   * 
   * This method analyzes the current content and leverages AI agents to generate
   * contextual suggestions for improvements. It combines content analysis with
   * agent-based insights to provide actionable recommendations.
   * 
   * @param phase - Current specification phase
   * @param context - Menu generation context including parsed content
   * @param contentAnalysis - Results from content parsing and quality analysis
   * @returns Array of AI-generated suggestions tailored to the current phase and content
   * 
   * @example
   * ```typescript
   * const factory = new ModificationMenuFactory();
   * const suggestions = await factory.generateDynamicSuggestions(
   *   'requirements',
   *   context,
   *   { completeness: 0.8, qualityScore: 0.75, missingElements: ['success-metrics'] }
   * );
   * ```
   */
  async generateDynamicSuggestions(
    phase: SpecPhase, 
    context: MenuGenerationContext, 
    contentAnalysis?: any
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    try {
      // Phase-specific suggestion generation
      switch (phase) {
        case 'requirements':
          suggestions.push(...await this.generateRequirementsSuggestions(context, contentAnalysis));
          break;
        case 'design':
          suggestions.push(...await this.generateDesignSuggestions(context, contentAnalysis));
          break;
        case 'tasks':
          suggestions.push(...await this.generateTasksSuggestions(context, contentAnalysis));
          break;
      }
      
      // Add universal suggestions that apply to all phases
      suggestions.push(...await this.generateUniversalSuggestions(context, contentAnalysis));
      
      // Filter and prioritize based on context and user permissions
      return this.filterSuggestions(suggestions, phase, context);
      
    } catch (error) {
      // Graceful fallback - return basic suggestions on agent failure
      console.warn(`Agent analysis failed for ${phase} suggestions:`, error);
      return this.generateFallbackSuggestions(phase, context);
    }
  }

  /**
   * Generates requirements-specific suggestions using agent analysis
   * 
   * @param context - Menu generation context
   * @param contentAnalysis - Content analysis results
   * @returns Array of requirements-focused suggestions
   * @protected
   */
  protected async generateRequirementsSuggestions(
    context: MenuGenerationContext, 
    contentAnalysis?: any
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    // Analyze completeness gaps
    if (contentAnalysis?.completeness < 0.8) {
      suggestions.push({
        id: 'req-completeness-' + Date.now(),
        title: 'Improve Requirements Completeness',
        description: 'Requirements document appears incomplete. Consider adding missing user stories, acceptance criteria, or business rules.',
        rationale: `Completeness score is ${Math.round((contentAnalysis?.completeness || 0) * 100)}%. Higher completeness reduces development risks and clarifies scope.`,
        impact: {
          affectedPhases: ['requirements', 'design', 'tasks'],
          cascadeWarnings: ['Incomplete requirements may lead to design gaps', 'Implementation tasks may be unclear or missing'],
          conflictRisks: [],
          approvalRequired: false,
          effortImpact: 2,
          timelineImpact: 'Low impact - clarification phase'
        },
        confidence: 85,
        agentSource: 'spec-requirements-validator',
        category: 'completeness',
        priority: 'high',
        estimatedEffort: '30-60 minutes'
      });
    }

    // Check for missing user stories
    if (contentAnalysis?.missingElements?.includes('user-story')) {
      suggestions.push({
        id: 'req-user-stories-' + Date.now(),
        title: 'Add Missing User Stories',
        description: 'User stories section appears to be missing or incomplete. Consider adding user stories for all key personas and scenarios.',
        rationale: 'User stories provide essential context for understanding user needs and drive feature development decisions.',
        impact: {
          affectedPhases: ['requirements', 'design', 'tasks'],
          cascadeWarnings: ['Design decisions may lack user context', 'Implementation may not address user needs'],
          conflictRisks: [],
          approvalRequired: false,
          effortImpact: 3,
          timelineImpact: 'Medium impact - affects design phase planning'
        },
        confidence: 90,
        agentSource: 'spec-requirements-validator',
        category: 'quality',
        priority: 'high',
        estimatedEffort: '45-90 minutes'
      });
    }

    // Check for missing acceptance criteria
    if (contentAnalysis?.missingElements?.includes('acceptance-criteria')) {
      suggestions.push({
        id: 'req-acceptance-criteria-' + Date.now(),
        title: 'Define Acceptance Criteria',
        description: 'Acceptance criteria are missing or incomplete. Add specific, testable criteria for each user story.',
        rationale: 'Clear acceptance criteria reduce implementation ambiguity and enable better testing validation.',
        impact: {
          affectedPhases: ['requirements', 'tasks'],
          cascadeWarnings: ['Tasks may lack clear completion criteria', 'Testing requirements may be unclear'],
          conflictRisks: [],
          approvalRequired: false,
          effortImpact: 2,
          timelineImpact: 'Low impact - improves clarity'
        },
        confidence: 88,
        agentSource: 'spec-requirements-validator',
        category: 'quality',
        priority: 'medium',
        estimatedEffort: '30-45 minutes'
      });
    }

    // Check for missing success metrics
    if (contentAnalysis?.missingElements?.includes('success-metrics')) {
      suggestions.push({
        id: 'req-success-metrics-' + Date.now(),
        title: 'Define Success Metrics',
        description: 'Success metrics and KPIs are not defined. Consider adding measurable success criteria.',
        rationale: 'Success metrics enable post-implementation validation and help measure feature effectiveness.',
        impact: {
          affectedPhases: ['requirements'],
          cascadeWarnings: [],
          conflictRisks: [],
          approvalRequired: false,
          effortImpact: 1,
          timelineImpact: 'Minimal impact - documentation enhancement'
        },
        confidence: 75,
        agentSource: 'spec-requirements-validator',
        category: 'completeness',
        priority: 'medium',
        estimatedEffort: '15-30 minutes'
      });
    }

    return suggestions;
  }

  /**
   * Generates design-specific suggestions using agent analysis
   * 
   * @param context - Menu generation context
   * @param contentAnalysis - Content analysis results
   * @returns Array of design-focused suggestions
   * @protected
   */
  protected async generateDesignSuggestions(
    context: MenuGenerationContext, 
    contentAnalysis?: any
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    // Check for missing architecture section
    if (contentAnalysis?.missingElements?.includes('architecture')) {
      suggestions.push({
        id: 'design-architecture-' + Date.now(),
        title: 'Define System Architecture',
        description: 'System architecture is not clearly defined. Consider adding architectural decisions, patterns, and high-level design.',
        rationale: 'Clear architecture reduces implementation confusion and ensures consistent technical decisions across the team.',
        impact: {
          affectedPhases: ['design', 'tasks'],
          cascadeWarnings: ['Implementation tasks may lack technical context', 'Component integration may be unclear'],
          conflictRisks: [],
          approvalRequired: true,
          effortImpact: 4,
          timelineImpact: 'Medium impact - affects implementation approach'
        },
        confidence: 92,
        agentSource: 'spec-design-validator',
        category: 'architecture',
        priority: 'high',
        estimatedEffort: '1-2 hours'
      });
    }

    // Check for missing data models
    if (contentAnalysis?.missingElements?.includes('data-models')) {
      suggestions.push({
        id: 'design-data-models-' + Date.now(),
        title: 'Define Data Models',
        description: 'Data models and structures are not defined. Consider adding entity definitions, relationships, and schemas.',
        rationale: 'Well-defined data models prevent implementation errors and ensure data consistency across the system.',
        impact: {
          affectedPhases: ['design', 'tasks'],
          cascadeWarnings: ['Database tasks may be incomplete', 'API design may be inconsistent'],
          conflictRisks: [],
          approvalRequired: true,
          effortImpact: 3,
          timelineImpact: 'Medium impact - affects data layer implementation'
        },
        confidence: 87,
        agentSource: 'spec-design-validator',
        category: 'design',
        priority: 'high',
        estimatedEffort: '45-90 minutes'
      });
    }

    // Check for performance considerations
    if (contentAnalysis?.qualityScore < 0.7 || contentAnalysis?.missingElements?.includes('performance')) {
      suggestions.push({
        id: 'design-performance-' + Date.now(),
        title: 'Add Performance Considerations',
        description: 'Performance requirements and optimization strategies are not addressed. Consider adding performance criteria.',
        rationale: 'Early performance planning prevents costly optimizations later and ensures user experience requirements are met.',
        impact: {
          affectedPhases: ['design', 'tasks'],
          cascadeWarnings: ['Performance issues may emerge during implementation', 'Load testing requirements may be unclear'],
          conflictRisks: [],
          approvalRequired: false,
          effortImpact: 2,
          timelineImpact: 'Low impact - proactive planning'
        },
        confidence: 80,
        agentSource: 'spec-performance-analyzer',
        category: 'performance',
        priority: 'medium',
        estimatedEffort: '30-45 minutes'
      });
    }

    // Check for security design
    if (contentAnalysis?.missingElements?.includes('security-design')) {
      suggestions.push({
        id: 'design-security-' + Date.now(),
        title: 'Define Security Design',
        description: 'Security design and authentication/authorization are not specified. Consider adding security requirements.',
        rationale: 'Security by design is more effective and cost-efficient than retrofitting security measures later.',
        impact: {
          affectedPhases: ['design', 'tasks'],
          cascadeWarnings: ['Security vulnerabilities may be introduced', 'Compliance requirements may be missed'],
          conflictRisks: [{
            id: 'security-compliance-risk',
            type: 'compliance',
            description: 'Missing security design may violate compliance requirements',
            severity: 'high' as ConflictSeverity,
            mitigation: ['Review compliance requirements', 'Add security design section', 'Consult security team'],
            affectedPhases: ['design', 'tasks']
          }],
          approvalRequired: true,
          effortImpact: 3,
          timelineImpact: 'Medium impact - security review required'
        },
        confidence: 93,
        agentSource: 'spec-design-validator',
        category: 'security',
        priority: 'high',
        estimatedEffort: '1-2 hours'
      });
    }

    return suggestions;
  }

  /**
   * Generates tasks-specific suggestions using agent analysis
   * 
   * @param context - Menu generation context
   * @param contentAnalysis - Content analysis results
   * @returns Array of tasks-focused suggestions
   * @protected
   */
  protected async generateTasksSuggestions(
    context: MenuGenerationContext, 
    contentAnalysis?: any
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    // Check for task atomicity issues
    if (contentAnalysis?.atomicityScore && contentAnalysis.atomicityScore < 0.8) {
      suggestions.push({
        id: 'tasks-atomicity-' + Date.now(),
        title: 'Improve Task Atomicity',
        description: 'Some tasks appear to be too complex or non-atomic. Consider breaking them down into smaller, focused tasks.',
        rationale: 'Atomic tasks enable better parallel execution, clearer progress tracking, and reduced implementation risk.',
        impact: {
          affectedPhases: ['tasks'],
          cascadeWarnings: ['Complex tasks may block parallel development', 'Progress tracking may be unclear'],
          conflictRisks: [],
          approvalRequired: context.approved,
          effortImpact: 2,
          timelineImpact: 'Low impact - improves execution efficiency'
        },
        confidence: 89,
        agentSource: 'spec-task-validator',
        category: 'atomicity',
        priority: 'high',
        estimatedEffort: '30-60 minutes'
      });
    }

    // Check for missing dependencies
    if (contentAnalysis?.missingElements?.includes('dependencies')) {
      suggestions.push({
        id: 'tasks-dependencies-' + Date.now(),
        title: 'Define Task Dependencies',
        description: 'Task dependencies are not clearly defined. Consider adding prerequisite relationships and execution order.',
        rationale: 'Clear dependencies enable proper task sequencing and prevent blocking issues during implementation.',
        impact: {
          affectedPhases: ['tasks'],
          cascadeWarnings: ['Tasks may be executed in wrong order', 'Blocking dependencies may emerge'],
          conflictRisks: [],
          approvalRequired: context.approved,
          effortImpact: 1,
          timelineImpact: 'Low impact - improves planning'
        },
        confidence: 85,
        agentSource: 'spec-dependency-analyzer',
        category: 'dependency',
        priority: 'medium',
        estimatedEffort: '20-40 minutes'
      });
    }

    // Check for missing acceptance criteria
    if (contentAnalysis?.missingElements?.includes('task-acceptance-criteria')) {
      suggestions.push({
        id: 'tasks-acceptance-criteria-' + Date.now(),
        title: 'Add Task Acceptance Criteria',
        description: 'Tasks lack clear acceptance criteria. Consider adding specific completion requirements for each task.',
        rationale: 'Clear acceptance criteria reduce ambiguity about task completion and enable better quality validation.',
        impact: {
          affectedPhases: ['tasks'],
          cascadeWarnings: ['Task completion may be ambiguous', 'Quality validation may be inconsistent'],
          conflictRisks: [],
          approvalRequired: false,
          effortImpact: 2,
          timelineImpact: 'Low impact - improves clarity'
        },
        confidence: 87,
        agentSource: 'spec-task-validator',
        category: 'quality',
        priority: 'medium',
        estimatedEffort: '30-45 minutes'
      });
    }

    // Check for testing requirements
    if (contentAnalysis?.missingElements?.includes('testing-requirements')) {
      suggestions.push({
        id: 'tasks-testing-' + Date.now(),
        title: 'Define Testing Requirements',
        description: 'Testing requirements are not specified. Consider adding unit test, integration test, and validation requirements.',
        rationale: 'Well-defined testing requirements ensure quality and reduce post-implementation bugs.',
        impact: {
          affectedPhases: ['tasks'],
          cascadeWarnings: ['Quality issues may emerge post-implementation', 'Testing coverage may be inconsistent'],
          conflictRisks: [],
          approvalRequired: false,
          effortImpact: 2,
          timelineImpact: 'Low impact - quality improvement'
        },
        confidence: 82,
        agentSource: 'spec-test-generator',
        category: 'quality',
        priority: 'medium',
        estimatedEffort: '30-60 minutes'
      });
    }

    // Check for parallel execution optimization
    if (contentAnalysis?.parallelizationScore && contentAnalysis.parallelizationScore < 0.7) {
      suggestions.push({
        id: 'tasks-parallelization-' + Date.now(),
        title: 'Optimize Task Parallelization',
        description: 'Tasks could be better organized for parallel execution. Consider reorganizing task structure and dependencies.',
        rationale: 'Better parallelization reduces overall implementation time and improves development efficiency.',
        impact: {
          affectedPhases: ['tasks'],
          cascadeWarnings: [],
          conflictRisks: [],
          approvalRequired: context.approved,
          effortImpact: 1,
          timelineImpact: 'Positive impact - faster execution'
        },
        confidence: 78,
        agentSource: 'spec-task-validator',
        category: 'task',
        priority: 'low',
        estimatedEffort: '20-40 minutes'
      });
    }

    return suggestions;
  }

  /**
   * Generates universal suggestions that apply across all phases
   * 
   * @param context - Menu generation context
   * @param contentAnalysis - Content analysis results
   * @returns Array of universal suggestions
   * @protected
   */
  protected async generateUniversalSuggestions(
    context: MenuGenerationContext, 
    contentAnalysis?: any
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    // Check overall quality score
    if (contentAnalysis?.qualityScore && contentAnalysis.qualityScore < 0.7) {
      suggestions.push({
        id: 'universal-quality-' + Date.now(),
        title: 'Improve Overall Quality',
        description: 'Overall document quality could be improved. Consider reviewing for clarity, completeness, and consistency.',
        rationale: `Quality score is ${Math.round((contentAnalysis.qualityScore || 0) * 100)}%. Higher quality reduces misunderstandings and implementation errors.`,
        impact: {
          affectedPhases: [context.specName as SpecPhase || 'requirements'], // Fallback to requirements if specName doesn't match SpecPhase
          cascadeWarnings: ['Poor quality may lead to implementation errors', 'Stakeholder approval may be delayed'],
          conflictRisks: [],
          approvalRequired: false,
          effortImpact: 3,
          timelineImpact: 'Medium impact - quality improvement'
        },
        confidence: 75,
        agentSource: 'spec-completion-reviewer',
        category: 'quality',
        priority: 'medium',
        estimatedEffort: '1-2 hours'
      });
    }

    // Check for consistency issues
    if (contentAnalysis?.consistencyIssues && contentAnalysis.consistencyIssues.length > 0) {
      suggestions.push({
        id: 'universal-consistency-' + Date.now(),
        title: 'Resolve Consistency Issues',
        description: `Found ${contentAnalysis.consistencyIssues.length} consistency issues. Consider reviewing terminology, formatting, and cross-references.`,
        rationale: 'Consistent documentation reduces confusion and improves professional appearance.',
        impact: {
          affectedPhases: ['requirements', 'design', 'tasks'],
          cascadeWarnings: ['Inconsistencies may cause implementation confusion'],
          conflictRisks: [],
          approvalRequired: false,
          effortImpact: 2,
          timelineImpact: 'Low impact - documentation improvement'
        },
        confidence: 83,
        agentSource: 'spec-completion-reviewer',
        category: 'consistency',
        priority: 'low',
        estimatedEffort: '30-60 minutes'
      });
    }

    return suggestions;
  }

  /**
   * Generates basic fallback suggestions when agent analysis fails
   * 
   * @param phase - Current specification phase
   * @param context - Menu generation context
   * @returns Array of basic suggestions
   * @protected
   */
  protected generateFallbackSuggestions(
    phase: SpecPhase, 
    context: MenuGenerationContext
  ): Suggestion[] {
    const fallbackSuggestions: Suggestion[] = [];
    
    // Generic phase-specific suggestions
    if (phase === 'requirements') {
      fallbackSuggestions.push({
        id: 'fallback-req-review-' + Date.now(),
        title: 'Review Requirements Completeness',
        description: 'Review requirements document for completeness and clarity.',
        rationale: 'Regular reviews help identify missing requirements and improve quality.',
        impact: {
          affectedPhases: ['requirements'],
          cascadeWarnings: [],
          conflictRisks: [],
          approvalRequired: false
        },
        confidence: 60,
        agentSource: 'fallback-system',
        category: 'quality',
        priority: 'low',
        estimatedEffort: '30 minutes'
      });
    } else if (phase === 'design') {
      fallbackSuggestions.push({
        id: 'fallback-design-review-' + Date.now(),
        title: 'Review Design Documentation',
        description: 'Review design document for architectural clarity and completeness.',
        rationale: 'Design reviews help ensure technical decisions are well-documented.',
        impact: {
          affectedPhases: ['design'],
          cascadeWarnings: [],
          conflictRisks: [],
          approvalRequired: false
        },
        confidence: 60,
        agentSource: 'fallback-system',
        category: 'quality',
        priority: 'low',
        estimatedEffort: '30 minutes'
      });
    } else if (phase === 'tasks') {
      fallbackSuggestions.push({
        id: 'fallback-tasks-review-' + Date.now(),
        title: 'Review Task Structure',
        description: 'Review tasks for atomicity and clear acceptance criteria.',
        rationale: 'Task review helps ensure implementation readiness and clarity.',
        impact: {
          affectedPhases: ['tasks'],
          cascadeWarnings: [],
          conflictRisks: [],
          approvalRequired: false
        },
        confidence: 60,
        agentSource: 'fallback-system',
        category: 'task',
        priority: 'low',
        estimatedEffort: '30 minutes'
      });
    }

    return fallbackSuggestions;
  }

  /**
   * Filters and prioritizes suggestions based on phase and context
   * 
   * @param suggestions - Raw suggestions from agent analysis
   * @param phase - Current specification phase
   * @param context - Menu generation context
   * @returns Filtered and prioritized suggestions for the menu
   * @protected
   */
  protected filterSuggestions(suggestions: Suggestion[], phase: SpecPhase, context: MenuGenerationContext): Suggestion[] {
    if (!suggestions || suggestions.length === 0) {
      return [];
    }

    return suggestions
      .filter(suggestion => {
        // Filter by phase relevance
        if (phase === 'requirements') {
          return suggestion.category === 'completeness' ||
                 suggestion.category === 'quality' ||
                 suggestion.category === 'consistency' ||
                 suggestion.title.toLowerCase().includes('user story') ||
                 suggestion.title.toLowerCase().includes('acceptance criteria') ||
                 suggestion.title.toLowerCase().includes('requirement');
        } else if (phase === 'design') {
          return suggestion.category === 'architecture' ||
                 suggestion.category === 'design' ||
                 suggestion.category === 'consistency' ||
                 suggestion.category === 'performance' ||
                 suggestion.category === 'security' ||
                 suggestion.title.toLowerCase().includes('component') ||
                 suggestion.title.toLowerCase().includes('architecture') ||
                 suggestion.title.toLowerCase().includes('api') ||
                 suggestion.title.toLowerCase().includes('data model') ||
                 suggestion.title.toLowerCase().includes('interface') ||
                 suggestion.title.toLowerCase().includes('design') ||
                 suggestion.title.toLowerCase().includes('pattern') ||
                 suggestion.title.toLowerCase().includes('security') ||
                 suggestion.title.toLowerCase().includes('performance');
        } else if (phase === 'tasks') {
          return suggestion.category === 'task' ||
                 suggestion.category === 'atomicity' ||
                 suggestion.category === 'dependency' ||
                 suggestion.category === 'completeness' ||
                 suggestion.title.toLowerCase().includes('task') ||
                 suggestion.title.toLowerCase().includes('atomic') ||
                 suggestion.title.toLowerCase().includes('dependency') ||
                 suggestion.title.toLowerCase().includes('implementation') ||
                 suggestion.title.toLowerCase().includes('parallel');
        }
        return true;
      })
      .filter(suggestion => {
        // Filter by user permissions
        if (suggestion.category === 'delete' && !context.userPermissions.canDelete) {
          return false;
        }
        if (suggestion.category === 'add' && !context.userPermissions.canAdd) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by priority and confidence
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        return b.confidence - a.confidence;
      })
      .slice(0, 10); // Limit to top 10 suggestions to avoid overwhelming the user
  }
}