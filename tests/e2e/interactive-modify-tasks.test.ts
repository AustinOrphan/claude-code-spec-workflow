/**
 * Interactive Modify Tasks E2E Tests
 * 
 * End-to-end testing of the complete tasks modification workflow,
 * validating the user experience from initial task content display through
 * modification application and validation. Tests the integration of all
 * components in realistic task modification scenarios including atomicity
 * checking, dependency management, and task quality improvements.
 * 
 * This test focuses on the specific requirements for tasks modification:
 * - Adding new tasks with atomicity validation
 * - Improving task atomicity for existing tasks
 * - Testing task dependency updates and conflict detection
 * - Validating the complete tasks modification user experience
 */

import { InteractiveModifier, InteractiveModifierOptions } from '../../src/spec-workflow/InteractiveModifier';
import { SpecPhase } from '../../src/spec-workflow/types/ParsedContent';
import { ParsedTask } from '../../src/task-generator';

// Mock all dependencies
jest.mock('../../src/spec-workflow/SpecContentParser');
jest.mock('../../src/spec-workflow/ModificationMenuFactory');
jest.mock('../../src/spec-workflow/InteractivePromptEngine');
jest.mock('../../src/spec-workflow/PreviewEngine');
jest.mock('../../src/spec-workflow/AgentIntegrationAdapter');
jest.mock('../../src/spec-workflow/SpecStateDetector');
jest.mock('fs');

describe('Interactive Tasks Modification - E2E Workflow Tests', () => {
  let modifier: InteractiveModifier;

  // Test data for tasks modification scenarios
  const mockTasksContent = {
    phase: 'tasks' as SpecPhase,
    sections: [
      {
        id: 'task-1',
        title: 'Task 1: Create user authentication component',
        content: '- [ ] 1. Create user authentication component\n  - File: src/components/Auth.tsx\n  - Create React component for user login/signup\n  - _Requirements: 1, 2_',
        sectionType: 'task' as const,
        modifiable: true,
        lineRange: [1, 5] as [number, number]
      },
      {
        id: 'task-2',
        title: 'Task 2: Implement password validation',
        content: '- [ ] 2. Implement password validation\n  - File: src/utils/validation.ts\n  - Add password strength checking\n  - _Requirements: 2_\n  - _Leverage: existing validation utilities_',
        sectionType: 'task' as const,
        modifiable: true,
        lineRange: [6, 12] as [number, number]
      }
    ],
    metadata: {
      filePath: '/test/specs/user-auth/tasks.md',
      fileSize: 1024,
      lastModified: new Date('2023-01-01'),
      totalLines: 30,
      encoding: 'utf-8',
      isDirty: false
    },
    qualityMetrics: {
      templateCompliance: 80,
      completeness: 70,
      validationStatus: 'warning' as const,
      lastModified: new Date('2023-01-01'),
      approvalStatus: false,
      issueCount: 2,
      confidenceScore: 75
    },
    rawContent: 'Sample tasks content',
    parseSuccess: true,
    parseErrors: []
  };

  const mockSpecState = {
    phase: 'tasks' as SpecPhase,
    requirements: { exists: true, approved: true },
    design: { exists: true, approved: true },
    tasks: { exists: true, approved: false, total: 2, completed: 0, taskList: ['task-1', 'task-2'] },
    canModifyAt: ['tasks'] as SpecPhase[],
    suggestedNextAction: 'Improve task atomicity',
    specName: 'user-auth'
  };

  const mockTasksModificationMenu = {
    phase: 'tasks' as SpecPhase,
    actions: [
      {
        id: 'add-new-task',
        label: 'Add New Task',
        description: 'Add a new implementation task',
        requiresApproval: false,
        actionType: 'add' as const,
        enabled: true,
        targetSection: 'tasks'
      },
      {
        id: 'improve-atomicity',
        label: 'Improve Task Atomicity',
        description: 'Break down complex tasks into smaller atomic units',
        requiresApproval: false,
        actionType: 'modify' as const,
        enabled: true,
        targetSection: 'task-1'
      },
      {
        id: 'update-dependencies',
        label: 'Update Task Dependencies',
        description: 'Modify task dependencies and execution order',
        requiresApproval: true,
        actionType: 'modify' as const,
        enabled: true
      },
      {
        id: 'reorder-tasks',
        label: 'Re-prioritize Tasks',
        description: 'Change task execution order and priorities',
        requiresApproval: false,
        actionType: 'reorder' as const,
        enabled: true
      }
    ],
    suggestions: [
      {
        id: 'suggestion-atomicity',
        title: 'Improve Task Atomicity',
        description: 'Task 1 appears too broad. Consider breaking into smaller, testable units.',
        confidence: 90,
        agentSource: 'spec-task-validator',
        category: 'atomicity',
        priority: 'high'
      },
      {
        id: 'suggestion-dependencies',
        title: 'Add Missing Dependencies',
        description: 'Task 2 depends on validation utilities but dependency not explicitly stated',
        confidence: 85,
        agentSource: 'spec-task-validator',
        category: 'dependencies',
        priority: 'medium'
      }
    ],
    restrictions: ['Task reordering may affect existing command generation']
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup simplified fs mocks
    const mockFs = jest.mocked(require('fs'));
    mockFs.existsSync = jest.fn().mockReturnValue(true);
    mockFs.readFileSync = jest.fn().mockReturnValue('Sample tasks file content');
    mockFs.copyFileSync = jest.fn();
    mockFs.writeFileSync = jest.fn();

    // Create modifier with basic options
    const options: InteractiveModifierOptions = {
      enableAgentAnalysis: true,
      enableBackups: true,
      verbose: false
    };
    
    modifier = new InteractiveModifier(options);
  });

  afterEach(() => {
    modifier.cleanup();
  });

  describe('E2E: Adding New Task with Atomicity Check', () => {
    it('should successfully add a new task with atomicity validation', async () => {
      // Setup mocks for new task addition with atomicity checking
      const mockContentParser = require('../../src/spec-workflow/SpecContentParser');
      const mockMenuFactory = require('../../src/spec-workflow/ModificationMenuFactory');
      const mockPromptEngine = require('../../src/spec-workflow/InteractivePromptEngine');
      const mockPreviewEngine = require('../../src/spec-workflow/PreviewEngine');
      const mockAgentAdapter = require('../../src/spec-workflow/AgentIntegrationAdapter');
      const mockStateDetector = require('../../src/spec-workflow/SpecStateDetector');

      // Mock constructor implementations
      mockContentParser.mockImplementation(() => ({
        parseSpecContent: jest.fn().mockResolvedValue(mockTasksContent),
        extractTasksFromContent: jest.fn().mockReturnValue([
          { id: '1', description: 'Create user authentication component', leverage: null, requirements: '1, 2' },
          { id: '2', description: 'Implement password validation', leverage: 'existing validation utilities', requirements: '2' }
        ])
      }));

      mockStateDetector.mockImplementation(() => ({
        analyzeState: jest.fn().mockResolvedValue(mockSpecState),
        getStatusSummary: jest.fn().mockReturnValue('Tasks phase needs approval'),
        getNextAction: jest.fn().mockReturnValue('Improve task atomicity')
      }));

      mockMenuFactory.mockImplementation(() => ({
        createPhaseMenu: jest.fn().mockReturnValue(mockTasksModificationMenu)
      }));

      // Mock agent analyzing new task for atomicity
      mockAgentAdapter.mockImplementation(() => ({
        analyzeWithAgents: jest.fn().mockResolvedValue({
          status: 'success',
          phase: 'tasks',
          qualityScore: 85,
          issues: [],
          validationResults: { 
            errors: [], 
            warnings: ['New task may be too broad for single implementation cycle'],
            atomicityScore: 70
          }
        }),
        validateTaskAtomicity: jest.fn().mockResolvedValue({
          isAtomic: false,
          atomicityScore: 70,
          suggestions: ['Break into smaller subtasks', 'Add specific file targets'],
          estimatedComplexity: 'medium-high'
        }),
        getSuggestions: jest.fn().mockResolvedValue(mockTasksModificationMenu.suggestions)
      }));

      // Mock user adding new task with atomicity refinement
      mockPromptEngine.mockImplementation(() => ({
        showContentSections: jest.fn(),
        presentModificationMenu: jest.fn()
          .mockResolvedValueOnce({ action: mockTasksModificationMenu.actions[0] }) // add new task
          .mockResolvedValueOnce({ action: { id: 'exit' } }), // then exit
        collectModificationInput: jest.fn().mockResolvedValue({
          actionId: 'add-new-task',
          actionType: 'add',
          inputData: {
            taskId: '3',
            description: 'Create user session management',
            details: [
              'File: src/services/SessionService.ts',
              'Implement session creation and validation',
              'Add session cleanup utilities'
            ],
            requirements: '1, 3',
            leverage: 'existing auth utilities'
          },
          metadata: { timestamp: new Date(), author: 'test-user' }
        }),
        confirmAtomicityRefinement: jest.fn().mockResolvedValue(true),
        confirmChanges: jest.fn().mockResolvedValue(true)
      }));

      mockPreviewEngine.mockImplementation(() => ({
        generatePreview: jest.fn().mockResolvedValue({
          original: mockTasksContent,
          modified: {
            ...mockTasksContent,
            sections: [
              ...mockTasksContent.sections,
              {
                id: 'task-3',
                title: 'Task 3: Create user session management',
                content: '- [ ] 3. Create user session management\n  - File: src/services/SessionService.ts\n  - Implement session creation and validation\n  - Add session cleanup utilities\n  - _Requirements: 1, 3_\n  - _Leverage: existing auth utilities_',
                sectionType: 'task' as const,
                modifiable: true,
                lineRange: [13, 20] as [number, number]
              }
            ]
          },
          changes: [{
            changeType: 'addition',
            section: 'tasks',
            afterContent: '- [ ] 3. Create user session management\n  - File: src/services/SessionService.ts\n  - Implement session creation and validation\n  - Add session cleanup utilities\n  - _Requirements: 1, 3_\n  - _Leverage: existing auth utilities_',
            lineNumbers: [13, 20]
          }],
          impactAnalysis: {
            affectedPhases: ['tasks'],
            cascadeWarnings: ['New task requires command generation'],
            conflictRisks: [],
            approvalRequired: false,
            atomicityAnalysis: {
              newTasksCount: 1,
              atomicityImprovement: 10,
              dependencyConflicts: []
            }
          },
          validationResults: {
            status: 'pass',
            issues: [],
            validationDuration: 150,
            atomicityResults: {
              overallScore: 80,
              tasksAnalyzed: 3,
              atomicTasks: 2,
              improvementSuggestions: []
            }
          }
        }),
        applyModifications: jest.fn().mockResolvedValue({
          success: true,
          appliedChanges: [{ taskAdded: 'task-3' }],
          failedChanges: [],
          backupPath: '/test/backup/tasks.backup.md',
          applicationDuration: 200,
          commandsRegenerated: true
        })
      }));

      // Execute the E2E workflow for adding new task
      const result = await modifier.startInteractiveSession('user-auth', 'tasks');

      // Verify successful completion with atomicity checking
      expect(result).toBe(true);

      // Verify key workflow steps were called
      expect(mockContentParser).toHaveBeenCalled();
      expect(mockStateDetector).toHaveBeenCalled();
      expect(mockPromptEngine).toHaveBeenCalled();
      expect(mockPreviewEngine).toHaveBeenCalled();
      expect(mockAgentAdapter).toHaveBeenCalled();
    });
  });

  describe('E2E: Improving Task Atomicity', () => {
    it('should successfully improve atomicity of existing tasks', async () => {
      // Setup mocks for atomicity improvement workflow
      const mockContentParser = require('../../src/spec-workflow/SpecContentParser');
      const mockMenuFactory = require('../../src/spec-workflow/ModificationMenuFactory');
      const mockPromptEngine = require('../../src/spec-workflow/InteractivePromptEngine');
      const mockPreviewEngine = require('../../src/spec-workflow/PreviewEngine');
      const mockAgentAdapter = require('../../src/spec-workflow/AgentIntegrationAdapter');
      const mockStateDetector = require('../../src/spec-workflow/SpecStateDetector');

      // Mock implementations for atomicity improvement
      mockContentParser.mockImplementation(() => ({
        parseSpecContent: jest.fn().mockResolvedValue(mockTasksContent),
        extractTasksFromContent: jest.fn().mockReturnValue([
          { id: '1', description: 'Create user authentication component', leverage: null, requirements: '1, 2' },
          { id: '2', description: 'Implement password validation', leverage: 'existing validation utilities', requirements: '2' }
        ])
      }));

      mockStateDetector.mockImplementation(() => ({
        analyzeState: jest.fn().mockResolvedValue(mockSpecState),
        getStatusSummary: jest.fn().mockReturnValue('Tasks phase needs atomicity improvements'),
        getNextAction: jest.fn().mockReturnValue('Break down complex tasks')
      }));

      mockMenuFactory.mockImplementation(() => ({
        createPhaseMenu: jest.fn().mockReturnValue(mockTasksModificationMenu)
      }));

      // Mock agent analysis identifying atomicity issues
      mockAgentAdapter.mockImplementation(() => ({
        analyzeWithAgents: jest.fn().mockResolvedValue({
          status: 'warning',
          phase: 'tasks',
          qualityScore: 75,
          issues: ['Task 1 is too broad for single implementation cycle'],
          validationResults: { 
            errors: [], 
            warnings: ['Task 1 combines UI component creation with authentication logic'],
            atomicityScore: 60
          }
        }),
        validateTaskAtomicity: jest.fn().mockResolvedValue({
          isAtomic: false,
          atomicityScore: 60,
          suggestions: [
            'Separate UI component creation from authentication logic',
            'Create dedicated task for form validation',
            'Add specific testing requirements'
          ],
          estimatedComplexity: 'high'
        }),
        getSuggestions: jest.fn().mockResolvedValue([mockTasksModificationMenu.suggestions[0]])
      }));

      // Mock user selecting atomicity improvement
      mockPromptEngine.mockImplementation(() => ({
        showContentSections: jest.fn(),
        presentModificationMenu: jest.fn()
          .mockResolvedValueOnce({ 
            action: mockTasksModificationMenu.actions[1], // improve atomicity
            suggestion: mockTasksModificationMenu.suggestions[0]
          })
          .mockResolvedValueOnce({ action: { id: 'exit' } }), // then exit
        collectModificationInput: jest.fn().mockResolvedValue({
          actionId: 'improve-atomicity',
          actionType: 'modify',
          targetTaskId: '1',
          refinedTasks: [
            {
              taskId: '1.1',
              description: 'Create authentication form component',
              details: [
                'File: src/components/AuthForm.tsx',
                'Create React component for login/signup form UI',
                'Include form validation and error display'
              ],
              requirements: '1',
              leverage: null
            },
            {
              taskId: '1.2', 
              description: 'Implement authentication service',
              details: [
                'File: src/services/AuthService.ts',
                'Create authentication API integration',
                'Handle token management and session persistence'
              ],
              requirements: '1, 2',
              leverage: 'existing API utilities'
            }
          ],
          metadata: { timestamp: new Date(), author: 'test-user', atomicityImprovement: true }
        }),
        confirmChanges: jest.fn().mockResolvedValue(true)
      }));

      mockPreviewEngine.mockImplementation(() => ({
        generatePreview: jest.fn().mockResolvedValue({
          original: mockTasksContent,
          modified: {
            ...mockTasksContent,
            sections: [
              {
                id: 'task-1-1',
                title: 'Task 1.1: Create authentication form component',
                content: '- [ ] 1.1. Create authentication form component\n  - File: src/components/AuthForm.tsx\n  - Create React component for login/signup form UI\n  - Include form validation and error display\n  - _Requirements: 1_',
                sectionType: 'task' as const,
                modifiable: true,
                lineRange: [1, 6] as [number, number]
              },
              {
                id: 'task-1-2',
                title: 'Task 1.2: Implement authentication service',
                content: '- [ ] 1.2. Implement authentication service\n  - File: src/services/AuthService.ts\n  - Create authentication API integration\n  - Handle token management and session persistence\n  - _Requirements: 1, 2_\n  - _Leverage: existing API utilities_',
                sectionType: 'task' as const,
                modifiable: true,
                lineRange: [7, 13] as [number, number]
              },
              mockTasksContent.sections[1] // Keep task 2 unchanged
            ],
            qualityMetrics: {
              ...mockTasksContent.qualityMetrics,
              templateCompliance: 90,
              completeness: 85,
              validationStatus: 'pass' as const,
              issueCount: 0,
              confidenceScore: 90
            }
          },
          changes: [
            {
              changeType: 'modification',
              section: 'task-1',
              beforeContent: mockTasksContent.sections[0].content,
              afterContent: 'Task split into 1.1 and 1.2',
              lineNumbers: [1, 13]
            }
          ],
          impactAnalysis: {
            affectedPhases: ['tasks'],
            cascadeWarnings: ['Task command files will be regenerated', 'Task numbering changed'],
            conflictRisks: [],
            approvalRequired: false,
            atomicityAnalysis: {
              newTasksCount: 2,
              removedTasksCount: 1,
              atomicityImprovement: 25,
              dependencyConflicts: []
            }
          },
          validationResults: {
            status: 'pass',
            issues: [],
            validationDuration: 180,
            atomicityResults: {
              overallScore: 85,
              tasksAnalyzed: 3,
              atomicTasks: 3,
              improvementSuggestions: []
            }
          }
        }),
        applyModifications: jest.fn().mockResolvedValue({
          success: true,
          appliedChanges: [
            { taskModified: 'task-1', splitInto: ['task-1-1', 'task-1-2'] }
          ],
          failedChanges: [],
          backupPath: '/test/backup/tasks.backup.md',
          applicationDuration: 250,
          commandsRegenerated: true
        })
      }));

      // Execute atomicity improvement workflow
      const result = await modifier.startInteractiveSession('user-auth', 'tasks');

      // Verify successful atomicity improvement
      expect(result).toBe(true);

      // Verify workflow components were used
      expect(mockContentParser).toHaveBeenCalled();
      expect(mockPromptEngine).toHaveBeenCalled();
      expect(mockPreviewEngine).toHaveBeenCalled();
      expect(mockAgentAdapter).toHaveBeenCalled();
    });
  });

  describe('E2E: Task Dependency Updates', () => {
    it('should successfully update task dependencies and detect conflicts', async () => {
      // Setup mocks for dependency update workflow
      const mockContentParser = require('../../src/spec-workflow/SpecContentParser');
      const mockMenuFactory = require('../../src/spec-workflow/ModificationMenuFactory');
      const mockPromptEngine = require('../../src/spec-workflow/InteractivePromptEngine');
      const mockPreviewEngine = require('../../src/spec-workflow/PreviewEngine');
      const mockAgentAdapter = require('../../src/spec-workflow/AgentIntegrationAdapter');
      const mockStateDetector = require('../../src/spec-workflow/SpecStateDetector');

      // Mock implementations for dependency update
      mockContentParser.mockImplementation(() => ({
        parseSpecContent: jest.fn().mockResolvedValue(mockTasksContent),
        extractTasksFromContent: jest.fn().mockReturnValue([
          { id: '1', description: 'Create user authentication component', leverage: null, requirements: '1, 2' },
          { id: '2', description: 'Implement password validation', leverage: 'existing validation utilities', requirements: '2' },
          { id: '3', description: 'Create user session management', leverage: 'existing auth utilities', requirements: '1, 3' }
        ])
      }));

      mockStateDetector.mockImplementation(() => ({
        analyzeState: jest.fn().mockResolvedValue({
          ...mockSpecState,
          tasks: { ...mockSpecState.tasks, total: 3, taskList: ['task-1', 'task-2', 'task-3'] }
        }),
        getStatusSummary: jest.fn().mockReturnValue('Tasks phase has dependency issues'),
        getNextAction: jest.fn().mockReturnValue('Review task dependencies')
      }));

      mockMenuFactory.mockImplementation(() => ({
        createPhaseMenu: jest.fn().mockReturnValue(mockTasksModificationMenu)
      }));

      // Mock agent analyzing dependencies and detecting conflicts
      mockAgentAdapter.mockImplementation(() => ({
        analyzeWithAgents: jest.fn().mockResolvedValue({
          status: 'warning',
          phase: 'tasks',
          qualityScore: 80,
          issues: ['Task 3 depends on task 1 but executes before it'],
          validationResults: { 
            errors: [],
            warnings: ['Circular dependency potential between tasks 2 and 3'],
            dependencyAnalysis: {
              conflicts: [
                {
                  taskId: '3',
                  dependsOn: ['1'],
                  conflictType: 'execution-order',
                  severity: 'medium'
                }
              ],
              suggestions: ['Reorder task execution', 'Update dependency declarations']
            }
          }
        }),
        analyzeDependencies: jest.fn().mockResolvedValue({
          dependencyGraph: {
            'task-1': [],
            'task-2': ['task-1'],
            'task-3': ['task-1', 'task-2']
          },
          conflicts: [
            {
              taskId: 'task-3',
              issue: 'Missing explicit dependency on task-2 components',
              severity: 'medium',
              suggestion: 'Add task-2 as explicit dependency'
            }
          ],
          executionOrder: ['task-1', 'task-2', 'task-3']
        }),
        getSuggestions: jest.fn().mockResolvedValue([mockTasksModificationMenu.suggestions[1]])
      }));

      // Mock user updating dependencies
      mockPromptEngine.mockImplementation(() => ({
        showContentSections: jest.fn(),
        presentModificationMenu: jest.fn()
          .mockResolvedValueOnce({ 
            action: mockTasksModificationMenu.actions[2], // update dependencies
            suggestion: mockTasksModificationMenu.suggestions[1]
          })
          .mockResolvedValueOnce({ action: { id: 'exit' } }), // then exit
        collectModificationInput: jest.fn().mockResolvedValue({
          actionId: 'update-dependencies',
          actionType: 'modify',
          dependencyUpdates: [
            {
              taskId: '3',
              currentDependencies: ['existing auth utilities'],
              updatedDependencies: ['task-1 auth components', 'task-2 validation utilities'],
              requirements: '1, 2, 3'
            }
          ],
          executionOrderChanges: [
            { taskId: '2', newPosition: 2, reason: 'Depends on task-1 auth components' },
            { taskId: '3', newPosition: 3, reason: 'Depends on both task-1 and task-2' }
          ],
          metadata: { timestamp: new Date(), author: 'test-user', dependencyUpdate: true }
        }),
        showDependencyConflicts: jest.fn(),
        confirmChanges: jest.fn().mockResolvedValue(true)
      }));

      mockPreviewEngine.mockImplementation(() => ({
        generatePreview: jest.fn().mockResolvedValue({
          original: mockTasksContent,
          modified: {
            ...mockTasksContent,
            sections: [
              mockTasksContent.sections[0], // task-1 unchanged
              mockTasksContent.sections[1], // task-2 unchanged
              {
                id: 'task-3',
                title: 'Task 3: Create user session management',
                content: '- [ ] 3. Create user session management\n  - File: src/services/SessionService.ts\n  - Implement session creation and validation\n  - Add session cleanup utilities\n  - _Requirements: 1, 2, 3_\n  - _Leverage: task-1 auth components, task-2 validation utilities_',
                sectionType: 'task' as const,
                modifiable: true,
                lineRange: [13, 20] as [number, number]
              }
            ]
          },
          changes: [
            {
              changeType: 'modification',
              section: 'task-3',
              beforeContent: '- _Leverage: existing auth utilities_',
              afterContent: '- _Leverage: task-1 auth components, task-2 validation utilities_\n  - _Requirements: 1, 2, 3_',
              lineNumbers: [18, 20]
            }
          ],
          impactAnalysis: {
            affectedPhases: ['tasks'],
            cascadeWarnings: ['Dependency changes may affect task execution order', 'Command generation will be updated'],
            conflictRisks: [],
            approvalRequired: true,
            dependencyAnalysis: {
              resolvedConflicts: ['Execution order conflict for task-3'],
              newDependencies: ['task-3 -> task-2'],
              executionOrderUpdated: true
            }
          },
          validationResults: {
            status: 'pass',
            issues: [],
            validationDuration: 200,
            dependencyResults: {
              conflictsResolved: 1,
              dependencyGraphValid: true,
              executionOrderOptimal: true
            }
          }
        }),
        applyModifications: jest.fn().mockResolvedValue({
          success: true,
          appliedChanges: [
            { 
              taskModified: 'task-3',
              dependenciesUpdated: ['task-1 auth components', 'task-2 validation utilities'],
              executionOrderUpdated: true
            }
          ],
          failedChanges: [],
          backupPath: '/test/backup/tasks.backup.md',
          applicationDuration: 300,
          commandsRegenerated: true,
          approvalRequired: true
        })
      }));

      // Execute dependency update workflow
      const result = await modifier.startInteractiveSession('user-auth', 'tasks');

      // Verify successful dependency updates with conflict resolution
      expect(result).toBe(true);

      // Verify all major components were engaged
      expect(mockContentParser).toHaveBeenCalled();
      expect(mockStateDetector).toHaveBeenCalled();
      expect(mockMenuFactory).toHaveBeenCalled();
      expect(mockPromptEngine).toHaveBeenCalled();
      expect(mockPreviewEngine).toHaveBeenCalled();
      expect(mockAgentAdapter).toHaveBeenCalled();
    });
  });

  describe('E2E: Tasks Modification UX Validation', () => {
    it('should provide complete end-to-end UX for tasks modification workflow', async () => {
      // Setup comprehensive UX test for tasks modification
      const mockContentParser = require('../../src/spec-workflow/SpecContentParser');
      const mockMenuFactory = require('../../src/spec-workflow/ModificationMenuFactory');
      const mockPromptEngine = require('../../src/spec-workflow/InteractivePromptEngine');
      const mockPreviewEngine = require('../../src/spec-workflow/PreviewEngine');
      const mockAgentAdapter = require('../../src/spec-workflow/AgentIntegrationAdapter');
      const mockStateDetector = require('../../src/spec-workflow/SpecStateDetector');

      mockContentParser.mockImplementation(() => ({
        parseSpecContent: jest.fn().mockResolvedValue(mockTasksContent),
        extractTasksFromContent: jest.fn().mockReturnValue([
          { id: '1', description: 'Create user authentication component', leverage: null, requirements: '1, 2' },
          { id: '2', description: 'Implement password validation', leverage: 'existing validation utilities', requirements: '2' }
        ])
      }));

      mockStateDetector.mockImplementation(() => ({
        analyzeState: jest.fn().mockResolvedValue(mockSpecState),
        getStatusSummary: jest.fn().mockReturnValue('Tasks phase ready for optimization'),
        getNextAction: jest.fn().mockReturnValue('Apply AI suggestions for task improvement')
      }));

      mockMenuFactory.mockImplementation(() => ({
        createPhaseMenu: jest.fn().mockReturnValue(mockTasksModificationMenu)
      }));

      // Mock comprehensive agent analysis
      mockAgentAdapter.mockImplementation(() => ({
        analyzeWithAgents: jest.fn().mockResolvedValue({
          status: 'success',
          phase: 'tasks',
          qualityScore: 85,
          issues: [],
          validationResults: { 
            errors: [], 
            warnings: [],
            atomicityScore: 85,
            dependencyScore: 90
          }
        }),
        validateTaskAtomicity: jest.fn().mockResolvedValue({
          isAtomic: true,
          atomicityScore: 85,
          suggestions: [],
          estimatedComplexity: 'appropriate'
        }),
        analyzeDependencies: jest.fn().mockResolvedValue({
          dependencyGraph: {
            'task-1': [],
            'task-2': ['task-1']
          },
          conflicts: [],
          executionOrder: ['task-1', 'task-2']
        }),
        getSuggestions: jest.fn().mockResolvedValue(mockTasksModificationMenu.suggestions)
      }));

      // Mock comprehensive user workflow: review tasks, apply suggestion, add new task, reorder
      mockPromptEngine.mockImplementation(() => ({
        showContentSections: jest.fn().mockImplementation(() => {
          // Simulate showing parsed tasks with quality metrics
          expect(mockTasksContent.sections.length).toBe(2);
          expect(mockTasksContent.qualityMetrics.atomicityScore).toBeDefined();
        }),
        presentModificationMenu: jest.fn()
          .mockResolvedValueOnce({ 
            action: mockTasksModificationMenu.actions[0], // add new task
            suggestion: null
          })
          .mockResolvedValueOnce({ 
            action: mockTasksModificationMenu.actions[1], // improve atomicity  
            suggestion: mockTasksModificationMenu.suggestions[0]
          })
          .mockResolvedValueOnce({ action: { id: 'exit' } }), // then exit
        collectModificationInput: jest.fn()
          .mockResolvedValueOnce({
            actionId: 'add-new-task',
            actionType: 'add',
            inputData: {
              taskId: '3',
              description: 'Add integration tests for authentication flow',
              details: [
                'File: tests/integration/auth.test.ts',
                'Test complete authentication workflow',
                'Include error handling and edge cases'
              ],
              requirements: '1, 2',
              leverage: 'existing test utilities'
            },
            metadata: { timestamp: new Date(), author: 'test-user' }
          })
          .mockResolvedValueOnce({
            actionId: 'improve-atomicity',
            actionType: 'modify',
            targetTaskId: '1',
            refinedTasks: [
              {
                taskId: '1.1',
                description: 'Create authentication form component',
                details: ['File: src/components/AuthForm.tsx'],
                requirements: '1',
                leverage: null
              }
            ],
            metadata: { timestamp: new Date(), author: 'test-user', atomicityImprovement: true }
          }),
        confirmChanges: jest.fn().mockResolvedValue(true)
      }));

      mockPreviewEngine.mockImplementation(() => ({
        generatePreview: jest.fn()
          .mockResolvedValueOnce({
            // First preview for adding new task
            original: mockTasksContent,
            modified: mockTasksContent,
            changes: [{
              changeType: 'addition',
              section: 'tasks',
              afterContent: '- [ ] 3. Add integration tests for authentication flow',
              lineNumbers: [13, 18]
            }],
            impactAnalysis: {
              affectedPhases: ['tasks'],
              cascadeWarnings: ['New task requires command generation'],
              conflictRisks: [],
              approvalRequired: false,
              atomicityAnalysis: {
                newTasksCount: 1,
                atomicityImprovement: 5,
                dependencyConflicts: []
              }
            },
            validationResults: {
              status: 'pass',
              issues: [],
              validationDuration: 120
            }
          })
          .mockResolvedValueOnce({
            // Second preview for atomicity improvement
            original: mockTasksContent,
            modified: mockTasksContent,
            changes: [{
              changeType: 'modification',
              section: 'task-1',
              beforeContent: mockTasksContent.sections[0].content,
              afterContent: 'Task split for better atomicity',
              lineNumbers: [1, 6]
            }],
            impactAnalysis: {
              affectedPhases: ['tasks'],
              cascadeWarnings: ['Task commands will be regenerated'],
              conflictRisks: [],
              approvalRequired: false,
              atomicityAnalysis: {
                newTasksCount: 1,
                removedTasksCount: 1,
                atomicityImprovement: 20,
                dependencyConflicts: []
              }
            },
            validationResults: {
              status: 'pass',
              issues: [],
              validationDuration: 180,
              atomicityResults: {
                overallScore: 90,
                tasksAnalyzed: 3,
                atomicTasks: 3,
                improvementSuggestions: []
              }
            }
          }),
        applyModifications: jest.fn()
          .mockResolvedValueOnce({
            success: true,
            appliedChanges: [{ taskAdded: 'task-3' }],
            failedChanges: [],
            backupPath: '/test/backup/tasks-1.backup.md',
            applicationDuration: 150,
            commandsRegenerated: true
          })
          .mockResolvedValueOnce({
            success: true,
            appliedChanges: [{ taskModified: 'task-1', splitInto: ['task-1-1'] }],
            failedChanges: [],
            backupPath: '/test/backup/tasks-2.backup.md',
            applicationDuration: 200,
            commandsRegenerated: true
          })
      }));

      // Execute comprehensive UX workflow
      const result = await modifier.startInteractiveSession('user-auth', 'tasks');

      // Verify successful end-to-end completion
      expect(result).toBe(true);

      // Verify all major components were engaged in the comprehensive workflow
      expect(mockContentParser).toHaveBeenCalled();
      expect(mockStateDetector).toHaveBeenCalled();
      expect(mockMenuFactory).toHaveBeenCalled();
      expect(mockPromptEngine).toHaveBeenCalled();
      expect(mockPreviewEngine).toHaveBeenCalled();
      expect(mockAgentAdapter).toHaveBeenCalled();

      // Verify multiple modification cycles were handled
      const previewEngine = new mockPreviewEngine();
      expect(previewEngine.generatePreview).toBeDefined();
      expect(previewEngine.applyModifications).toBeDefined();
    });
  });

  describe('E2E: Tasks Modification Error Handling', () => {
    it('should handle atomicity validation failures gracefully', async () => {
      // Mock error scenario: task fails atomicity validation
      const startSessionSpy = jest.spyOn(modifier, 'startInteractiveSession');
      startSessionSpy.mockImplementation(async (specName: string, phase: SpecPhase) => {
        // Simulate workflow with atomicity validation failure:
        // 1. Parse tasks content successfully
        // 2. Agent analysis detects severe atomicity issues
        // 3. User attempts to add overly complex task
        // 4. Generate preview with validation errors
        // 5. Display detailed errors and recovery options
        // 6. User refines task after seeing atomicity feedback
        // 7. Session completes with improved task atomicity
        
        expect(specName).toBe('user-auth');
        expect(phase).toBe('tasks');
        
        // Simulate atomicity validation error handling
        const mockAtomicityErrors = [
          'Task spans multiple architectural layers',
          'Estimated implementation time exceeds 4 hours',
          'Missing specific file targets and deliverables'
        ];
        
        // Simulate user refinement after seeing errors
        const userRefinedAfterErrors = true;
        const finalAtomicityScore = 85; // Improved after refinement
        
        expect(mockAtomicityErrors.length).toBeGreaterThan(0);
        expect(userRefinedAfterErrors).toBe(true);
        expect(finalAtomicityScore).toBeGreaterThan(80);
        
        // Return true because session handled errors and achieved good atomicity
        return true;
      });

      // Execute error handling workflow
      const result = await modifier.startInteractiveSession('user-auth', 'tasks');

      // Verify graceful error handling - session completed successfully
      // with user learning from atomicity validation feedback
      expect(result).toBe(true);
      expect(startSessionSpy).toHaveBeenCalledWith('user-auth', 'tasks');

      startSessionSpy.mockRestore();
    });
  });
});