/**
 * InteractiveModifier Workflow Integration Tests
 * 
 * Comprehensive integration tests that validate the complete workflow orchestration
 * from menu selection through input collection to preview generation and application.
 * Tests the full end-to-end interactive modification experience with mocked dependencies.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { InteractiveModifier, InteractiveModifierOptions, SessionState, ErrorType } from '../../src/spec-workflow/InteractiveModifier';
import { SpecPhase, ParsedContent } from '../../src/spec-workflow/types/ParsedContent';
import { ModificationMenu, ModificationChoice, ModificationData } from '../../src/spec-workflow/types/ModificationMenu';
import { ModificationPreview, ApplicationResult } from '../../src/spec-workflow/types/ModificationPreview';
import { SpecContentParser } from '../../src/spec-workflow/SpecContentParser';
import { ModificationMenuFactory } from '../../src/spec-workflow/ModificationMenuFactory';
import { InteractivePromptEngine } from '../../src/spec-workflow/InteractivePromptEngine';
import { PreviewEngine } from '../../src/spec-workflow/PreviewEngine';
import { AgentIntegrationAdapter, AnalysisResult } from '../../src/spec-workflow/AgentIntegrationAdapter';
import { SpecStateDetector, SpecState } from '../../src/spec-workflow/SpecStateDetector';

// Mock all component dependencies
jest.mock('../../src/spec-workflow/SpecContentParser');
jest.mock('../../src/spec-workflow/ModificationMenuFactory');
jest.mock('../../src/spec-workflow/InteractivePromptEngine');
jest.mock('../../src/spec-workflow/PreviewEngine');
jest.mock('../../src/spec-workflow/AgentIntegrationAdapter');
jest.mock('../../src/spec-workflow/SpecStateDetector');
jest.mock('fs');

describe('InteractiveModifier - Workflow Integration Tests', () => {
  let tempDir: string;
  let modifier: InteractiveModifier;
  let mockContentParser: jest.Mocked<SpecContentParser>;
  let mockMenuFactory: jest.Mocked<ModificationMenuFactory>;
  let mockPromptEngine: jest.Mocked<InteractivePromptEngine>;
  let mockPreviewEngine: jest.Mocked<PreviewEngine>;
  let mockAgentAdapter: jest.Mocked<AgentIntegrationAdapter>;
  let mockStateDetector: jest.Mocked<SpecStateDetector>;
  let mockFs: jest.Mocked<typeof import('fs')>;

  // Test fixtures
  const sampleParsedContent: ParsedContent = {
    phase: 'requirements',
    sections: [
      {
        id: 'user-story-1',
        title: 'User Authentication',
        content: 'As a user, I want to log in...',
        sectionType: 'user-story',
        modifiable: true,
        lineRange: [1, 10]
      },
      {
        id: 'acceptance-criteria-1',
        title: 'Login Validation',
        content: '1. Username and password required',
        sectionType: 'acceptance-criteria',
        modifiable: true,
        lineRange: [11, 15]
      }
    ],
    metadata: {
      filePath: '/test/specs/user-auth/requirements.md',
      fileSize: 1024,
      lastModified: new Date('2023-01-01'),
      totalLines: 50,
      encoding: 'utf-8',
      isDirty: false
    },
    qualityMetrics: {
      templateCompliance: 85,
      completeness: 75,
      validationStatus: 'pass',
      lastModified: new Date('2023-01-01'),
      approvalStatus: true,
      issueCount: 0,
      confidenceScore: 90
    },
    rawContent: 'Sample content',
    parseSuccess: true,
    parseErrors: undefined
  };

  const sampleSpecState: SpecState = {
    phase: 'requirements',
    requirements: { exists: true, approved: true },
    design: { exists: false, approved: false },
    tasks: { exists: false, approved: false, total: 0, completed: 0, nextPendingTask: null },
    canModifyAt: ['requirements'],
    suggestedNextAction: 'Create design phase',
    specName: 'user-auth'
  };

  const sampleModificationMenu: ModificationMenu = {
    phase: 'requirements',
    actions: [
      {
        id: 'add-user-story',
        label: 'Add User Story',
        description: 'Add a new user story to requirements',
        requiresApproval: false,
        targetSection: 'user-stories',
        actionType: 'add'
      },
      {
        id: 'modify-acceptance-criteria',
        label: 'Modify Acceptance Criteria',
        description: 'Update existing acceptance criteria',
        requiresApproval: true,
        targetSection: 'acceptance-criteria-1',
        actionType: 'modify'
      },
      {
        id: 'exit',
        label: 'Exit',
        description: 'Exit modification session',
        requiresApproval: false,
        actionType: 'exit'
      }
    ],
    suggestions: [
      {
        id: 'suggestion-1',
        title: 'Add Password Strength Requirements',
        description: 'Consider adding password complexity requirements',
        rationale: 'Improves security compliance',
        impact: {
          affectedPhases: ['requirements', 'design'],
          cascadeWarnings: ['May require UI changes'],
          conflictRisks: [],
          approvalRequired: false
        },
        confidence: 85,
        agentSource: 'spec-requirements-validator'
      }
    ],
    restrictions: []
  };

  const sampleAgentAnalysis: AnalysisResult = {
    status: 'completed',
    analysisId: 'analysis-123',
    timestamp: new Date('2023-01-01'),
    phase: 'requirements',
    qualityScore: 85,
    suggestions: [
      {
        id: 'suggestion-1',
        title: 'Add Password Strength Requirements',
        description: 'Consider adding password complexity requirements',
        rationale: 'Improves security compliance',
        impact: {
          affectedPhases: ['requirements', 'design'],
          cascadeWarnings: ['May require UI changes'],
          conflictRisks: [],
          approvalRequired: false
        },
        confidence: 85,
        agentSource: 'spec-requirements-validator'
      }
    ],
    issues: [],
    completionMetrics: {
      totalSections: 5,
      completedSections: 4,
      missingRequiredSections: ['technical-requirements']
    },
    validationResults: {
      templateCompliance: true,
      requiredSectionsPresent: true,
      contentQuality: 'good',
      errors: [],
      warnings: ['Consider adding technical requirements section']
    }
  };

  beforeEach(async () => {
    // Setup temporary directory for testing
    tempDir = await fs.mkdtemp(join(tmpdir(), 'interactive-modifier-test-'));
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup fs mock
    mockFs = jest.mocked(require('fs'));
    mockFs.existsSync = jest.fn().mockReturnValue(true);
    mockFs.statSync = jest.fn().mockReturnValue({
      mtime: new Date('2023-01-01'),
      size: 1024,
      isFile: () => true
    });
    mockFs.readFileSync = jest.fn().mockReturnValue('Sample file content');
    mockFs.copyFileSync = jest.fn();
    mockFs.writeFileSync = jest.fn();

    // Setup component mocks
    mockContentParser = new SpecContentParser() as jest.Mocked<SpecContentParser>;
    mockMenuFactory = new ModificationMenuFactory() as jest.Mocked<ModificationMenuFactory>;
    mockPromptEngine = new InteractivePromptEngine() as jest.Mocked<InteractivePromptEngine>;
    mockPreviewEngine = new PreviewEngine() as jest.Mocked<PreviewEngine>;
    mockAgentAdapter = new AgentIntegrationAdapter() as jest.Mocked<AgentIntegrationAdapter>;
    mockStateDetector = new SpecStateDetector('test-spec') as jest.Mocked<SpecStateDetector>;

    // Mock constructor behavior for SpecStateDetector
    jest.mocked(SpecStateDetector).mockImplementation(() => mockStateDetector);

    // Setup default mock implementations
    mockContentParser.parseSpecContent = jest.fn().mockResolvedValue(sampleParsedContent);
    mockStateDetector.analyzeState = jest.fn().mockResolvedValue(sampleSpecState);
    mockStateDetector.getStatusSummary = jest.fn().mockReturnValue('Requirements phase complete');
    mockStateDetector.getNextAction = jest.fn().mockReturnValue('Create design phase');
    mockMenuFactory.createPhaseMenu = jest.fn().mockReturnValue(sampleModificationMenu);
    mockAgentAdapter.analyzeWithAgents = jest.fn().mockResolvedValue(sampleAgentAnalysis);
    mockAgentAdapter.getSuggestions = jest.fn().mockResolvedValue(sampleAgentAnalysis.suggestions);
    
    // Create modifier instance
    const options: InteractiveModifierOptions = {
      enableAgentAnalysis: true,
      agentTimeout: 5000,
      enableBackups: true,
      verbose: false,
      enableConcurrentDetection: false // Disable for simpler testing
    };
    
    modifier = new InteractiveModifier(options);
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    // Cleanup any active session
    modifier.cleanup();
  });

  describe('Complete Workflow Integration', () => {
    it('should execute successful modification workflow with user story addition', async () => {
      // Arrange: Setup successful workflow mocks
      const userChoice: ModificationChoice = {
        action: sampleModificationMenu.actions[0], // add-user-story
        selectedSuggestion: null
      };
      
      const modificationData: ModificationData = {
        actionId: 'add-user-story',
        actionType: 'add',
        targetSection: 'user-stories',
        inputData: {
          title: 'User Registration',
          content: 'As a new user, I want to create an account...',
          additionalFields: {}
        },
        metadata: {
          timestamp: new Date(),
          userId: 'test-user',
          sessionId: 'session-123'
        }
      };
      
      const modificationPreview: ModificationPreview = {
        original: sampleParsedContent,
        modified: {
          ...sampleParsedContent,
          sections: [
            ...sampleParsedContent.sections,
            {
              id: 'user-story-2',
              title: 'User Registration',
              content: 'As a new user, I want to create an account...',
              sectionType: 'user-story',
              modifiable: true,
              lineRange: [16, 20]
            }
          ]
        },
        changes: [
          {
            changeType: 'addition',
            section: 'user-stories',
            afterContent: 'As a new user, I want to create an account...',
            lineNumbers: [16, 20]
          }
        ],
        impactAnalysis: {
          affectedPhases: ['requirements'],
          cascadeWarnings: [],
          conflictRisks: [],
          approvalRequired: false
        },
        validationResults: {
          success: true,
          errors: [],
          warnings: [],
          validationDuration: 100
        }
      };
      
      const applicationResult: ApplicationResult = {
        success: true,
        appliedChanges: [modificationPreview.changes[0]],
        failedChanges: [],
        backupPath: '/test/backup/requirements.backup.md',
        applicationDuration: 250
      };

      // Setup mock responses for workflow steps
      mockPromptEngine.presentModificationMenu = jest.fn().mockResolvedValue(userChoice);
      mockPromptEngine.collectModificationInput = jest.fn().mockResolvedValue(modificationData);
      mockPromptEngine.confirmChanges = jest.fn().mockResolvedValue(true);
      mockPromptEngine.showContentSections = jest.fn();
      
      mockPreviewEngine.generatePreview = jest.fn().mockResolvedValue(modificationPreview);
      mockPreviewEngine.applyModifications = jest.fn().mockResolvedValue(applicationResult);

      // Act: Execute the workflow
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert: Verify successful workflow execution
      expect(result).toBe(true);
      
      // Verify workflow orchestration steps
      expect(mockStateDetector.analyzeState).toHaveBeenCalled();
      expect(mockContentParser.parseSpecContent).toHaveBeenCalledWith(
        expect.stringContaining('user-auth/requirements.md'),
        'requirements'
      );
      expect(mockAgentAdapter.analyzeWithAgents).toHaveBeenCalledWith(
        sampleParsedContent,
        'requirements'
      );
      expect(mockPromptEngine.showContentSections).toHaveBeenCalledWith(
        sampleParsedContent.sections,
        sampleParsedContent.metadata,
        sampleParsedContent.qualityMetrics,
        sampleSpecState
      );
      expect(mockMenuFactory.createPhaseMenu).toHaveBeenCalledWith(
        'requirements',
        expect.objectContaining({
          specName: 'user-auth',
          phaseStatus: 'pass',
          approved: true
        })
      );
      expect(mockPromptEngine.presentModificationMenu).toHaveBeenCalledWith(sampleModificationMenu);
      expect(mockPromptEngine.collectModificationInput).toHaveBeenCalledWith(userChoice.action);
      expect(mockPreviewEngine.generatePreview).toHaveBeenCalledWith(
        sampleParsedContent,
        [modificationData]
      );
      expect(mockPromptEngine.confirmChanges).toHaveBeenCalledWith(modificationPreview);
      expect(mockPreviewEngine.applyModifications).toHaveBeenCalledWith(
        modificationPreview,
        expect.stringContaining('user-auth/requirements.md')
      );
    });

    it('should handle workflow with user cancellation at preview step', async () => {
      // Arrange: Setup workflow that user cancels at confirmation
      const userChoice: ModificationChoice = {
        action: sampleModificationMenu.actions[1], // modify-acceptance-criteria
        selectedSuggestion: null
      };
      
      const modificationData: ModificationData = {
        actionId: 'modify-acceptance-criteria',
        actionType: 'modify',
        targetSection: 'acceptance-criteria-1',
        inputData: {
          content: 'Updated acceptance criteria content',
          additionalFields: {}
        },
        metadata: {
          timestamp: new Date(),
          userId: 'test-user',
          sessionId: 'session-123'
        }
      };

      const modificationPreview: ModificationPreview = {
        original: sampleParsedContent,
        modified: sampleParsedContent,
        changes: [
          {
            changeType: 'modification',
            section: 'acceptance-criteria-1',
            beforeContent: '1. Username and password required',
            afterContent: 'Updated acceptance criteria content',
            lineNumbers: [11, 15]
          }
        ],
        impactAnalysis: {
          affectedPhases: ['requirements', 'design'],
          cascadeWarnings: ['May affect existing design decisions'],
          conflictRisks: [],
          approvalRequired: true
        },
        validationResults: {
          success: true,
          errors: [],
          warnings: ['Approval required for this change'],
          validationDuration: 150
        }
      };

      // Setup mocks - user cancels at confirmation
      mockPromptEngine.presentModificationMenu = jest.fn().mockResolvedValue(userChoice);
      mockPromptEngine.collectModificationInput = jest.fn().mockResolvedValue(modificationData);
      mockPromptEngine.confirmChanges = jest.fn().mockResolvedValue(false); // User cancels
      mockPromptEngine.showContentSections = jest.fn();
      
      // Setup exit choice for second iteration
      const exitChoice: ModificationChoice = {
        action: sampleModificationMenu.actions[2], // exit
        selectedSuggestion: null
      };
      mockPromptEngine.presentModificationMenu = jest.fn()
        .mockResolvedValueOnce(userChoice)  // First call
        .mockResolvedValueOnce(exitChoice); // Second call after cancellation
      
      mockPreviewEngine.generatePreview = jest.fn().mockResolvedValue(modificationPreview);

      // Act: Execute workflow
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert: Should complete successfully despite cancellation
      expect(result).toBe(true);
      
      // Verify cancellation flow
      expect(mockPreviewEngine.generatePreview).toHaveBeenCalledTimes(1);
      expect(mockPromptEngine.confirmChanges).toHaveBeenCalledWith(modificationPreview);
      expect(mockPreviewEngine.applyModifications).not.toHaveBeenCalled();
      expect(mockPromptEngine.presentModificationMenu).toHaveBeenCalledTimes(2);
    });

    it('should handle workflow with exit choice immediately', async () => {
      // Arrange: Setup immediate exit choice
      const exitChoice: ModificationChoice = {
        action: sampleModificationMenu.actions[2], // exit
        selectedSuggestion: null
      };

      mockPromptEngine.presentModificationMenu = jest.fn().mockResolvedValue(exitChoice);
      mockPromptEngine.showContentSections = jest.fn();

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      
      // Verify immediate exit flow
      expect(mockPromptEngine.presentModificationMenu).toHaveBeenCalledTimes(1);
      expect(mockPromptEngine.collectModificationInput).not.toHaveBeenCalled();
      expect(mockPreviewEngine.generatePreview).not.toHaveBeenCalled();
      expect(mockPreviewEngine.applyModifications).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle agent analysis failure and fallback to basic mode', async () => {
      // Arrange: Setup agent failure
      mockAgentAdapter.analyzeWithAgents = jest.fn().mockRejectedValue(new Error('Agent timeout'));
      
      const exitChoice: ModificationChoice = {
        action: { ...sampleModificationMenu.actions[2] }, // exit
        selectedSuggestion: null
      };
      mockPromptEngine.presentModificationMenu = jest.fn().mockResolvedValue(exitChoice);
      mockPromptEngine.showContentSections = jest.fn();

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      
      // Verify fallback behavior
      expect(mockAgentAdapter.analyzeWithAgents).toHaveBeenCalled();
      expect(mockPromptEngine.showContentSections).toHaveBeenCalledWith(
        sampleParsedContent.sections,
        sampleParsedContent.metadata,
        sampleParsedContent.qualityMetrics,
        sampleSpecState
      );
      
      // Menu should be created without agent suggestions
      expect(mockMenuFactory.createPhaseMenu).toHaveBeenCalledWith(
        'requirements',
        expect.objectContaining({
          specName: 'user-auth',
          suggestions: undefined // No agent suggestions due to failure
        })
      );
    });

    it('should handle content parsing failure', async () => {
      // Arrange: Setup parsing failure
      const failedParsedContent: ParsedContent = {
        ...sampleParsedContent,
        parseSuccess: false,
        parseErrors: ['Invalid markdown structure', 'Missing required sections']
      };
      
      mockContentParser.parseSpecContent = jest.fn().mockResolvedValue(failedParsedContent);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(false);
      
      // Verify error handling
      expect(mockContentParser.parseSpecContent).toHaveBeenCalled();
      expect(mockPromptEngine.showContentSections).not.toHaveBeenCalled();
      
      // Check session state
      const session = modifier.getCurrentSession();
      expect(session).toBeNull(); // Session should be cleaned up after failure
    });

    it('should handle invalid phase modification request', async () => {
      // Arrange: Setup state that doesn't allow modification of requested phase
      const invalidSpecState: SpecState = {
        ...sampleSpecState,
        canModifyAt: ['design'], // Requirements not modifiable
        phase: 'design'
      };
      
      mockStateDetector.analyzeState = jest.fn().mockResolvedValue(invalidSpecState);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(false);
      
      // Verify validation flow
      expect(mockStateDetector.analyzeState).toHaveBeenCalled();
      expect(mockContentParser.parseSpecContent).not.toHaveBeenCalled();
    });

    it('should handle modification application failure with recovery', async () => {
      // Arrange: Setup successful workflow until application fails
      const userChoice: ModificationChoice = {
        action: sampleModificationMenu.actions[0],
        selectedSuggestion: null
      };
      
      const modificationData: ModificationData = {
        actionId: 'add-user-story',
        actionType: 'add',
        targetSection: 'user-stories',
        inputData: {
          title: 'Test Story',
          content: 'Test content',
          additionalFields: {}
        },
        metadata: {
          timestamp: new Date(),
          userId: 'test-user',
          sessionId: 'session-123'
        }
      };

      const modificationPreview: ModificationPreview = {
        original: sampleParsedContent,
        modified: sampleParsedContent,
        changes: [],
        impactAnalysis: {
          affectedPhases: ['requirements'],
          cascadeWarnings: [],
          conflictRisks: [],
          approvalRequired: false
        },
        validationResults: {
          success: true,
          errors: [],
          warnings: [],
          validationDuration: 100
        }
      };

      const failedApplicationResult: ApplicationResult = {
        success: false,
        error: 'File write permission denied',
        appliedChanges: [],
        failedChanges: [],
        backupPath: undefined,
        applicationDuration: 50
      };

      // Setup mocks
      mockPromptEngine.presentModificationMenu = jest.fn()
        .mockResolvedValueOnce(userChoice)
        .mockResolvedValueOnce({ action: sampleModificationMenu.actions[2] }); // exit after failure
      mockPromptEngine.collectModificationInput = jest.fn().mockResolvedValue(modificationData);
      mockPromptEngine.confirmChanges = jest.fn().mockResolvedValue(true);
      mockPromptEngine.showContentSections = jest.fn();
      
      mockPreviewEngine.generatePreview = jest.fn().mockResolvedValue(modificationPreview);
      mockPreviewEngine.applyModifications = jest.fn().mockResolvedValue(failedApplicationResult);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true); // Should still complete session gracefully
      
      // Verify error handling
      expect(mockPreviewEngine.applyModifications).toHaveBeenCalled();
      expect(mockPromptEngine.presentModificationMenu).toHaveBeenCalledTimes(2); // Retry after failure
    });
  });

  describe('Session State Management', () => {
    it('should properly initialize and maintain session state', async () => {
      // Arrange: Setup for session state inspection
      const exitChoice: ModificationChoice = {
        action: sampleModificationMenu.actions[2],
        selectedSuggestion: null
      };
      mockPromptEngine.presentModificationMenu = jest.fn().mockResolvedValue(exitChoice);
      mockPromptEngine.showContentSections = jest.fn();

      // Act: Start session and immediately check state
      const sessionPromise = modifier.startInteractiveSession('user-auth', 'requirements');
      
      // Wait a moment for session initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const sessionDuringExecution = modifier.getCurrentSession();
      expect(sessionDuringExecution).not.toBeNull();
      expect(sessionDuringExecution?.specName).toBe('user-auth');
      expect(sessionDuringExecution?.phase).toBe('requirements');
      expect(sessionDuringExecution?.isActive).toBe(true);
      expect(sessionDuringExecution?.sessionErrors).toHaveLength(0);
      
      await sessionPromise;

      // Assert: Session should be cleaned up after completion
      const sessionAfterCompletion = modifier.getCurrentSession();
      expect(sessionAfterCompletion).toBeNull();
    });

    it('should track session errors appropriately', async () => {
      // Arrange: Force an error during session
      mockContentParser.parseSpecContent = jest.fn().mockRejectedValue(new Error('Parse error'));

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(false);
      
      // Session should be cleaned up even after error
      const session = modifier.getCurrentSession();
      expect(session).toBeNull();
    });

    it('should properly cleanup resources on session end', async () => {
      // Arrange
      const exitChoice: ModificationChoice = {
        action: sampleModificationMenu.actions[2],
        selectedSuggestion: null
      };
      mockPromptEngine.presentModificationMenu = jest.fn().mockResolvedValue(exitChoice);
      mockPromptEngine.showContentSections = jest.fn();

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      
      // Verify cleanup
      const session = modifier.getCurrentSession();
      expect(session).toBeNull();
    });
  });

  describe('Agent Integration Workflow', () => {
    it('should integrate agent suggestions into modification menu', async () => {
      // Arrange: Setup with agent suggestions
      const enrichedMenu: ModificationMenu = {
        ...sampleModificationMenu,
        suggestions: sampleAgentAnalysis.suggestions
      };
      
      mockMenuFactory.createPhaseMenu = jest.fn().mockReturnValue(enrichedMenu);
      
      const exitChoice: ModificationChoice = {
        action: sampleModificationMenu.actions[2],
        selectedSuggestion: null
      };
      mockPromptEngine.presentModificationMenu = jest.fn().mockResolvedValue(exitChoice);
      mockPromptEngine.showContentSections = jest.fn();

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      
      // Verify agent integration
      expect(mockAgentAdapter.analyzeWithAgents).toHaveBeenCalledWith(
        sampleParsedContent,
        'requirements'
      );
      expect(mockAgentAdapter.getSuggestions).toHaveBeenCalledWith(sampleAgentAnalysis);
      expect(mockMenuFactory.createPhaseMenu).toHaveBeenCalledWith(
        'requirements',
        expect.objectContaining({
          suggestions: sampleAgentAnalysis.suggestions
        })
      );
      expect(mockPromptEngine.presentModificationMenu).toHaveBeenCalledWith(enrichedMenu);
    });

    it('should handle agent suggestion selection in workflow', async () => {
      // Arrange: Setup suggestion selection
      const suggestionChoice: ModificationChoice = {
        action: sampleModificationMenu.actions[0],
        selectedSuggestion: sampleAgentAnalysis.suggestions[0]
      };
      
      const suggestionBasedModification: ModificationData = {
        actionId: 'add-user-story',
        actionType: 'add',
        targetSection: 'technical-requirements',
        inputData: {
          title: 'Password Strength Requirements',
          content: 'System must enforce strong password policies...',
          additionalFields: {
            suggestionId: 'suggestion-1',
            agentSource: 'spec-requirements-validator'
          }
        },
        metadata: {
          timestamp: new Date(),
          userId: 'test-user',
          sessionId: 'session-123'
        }
      };

      // Setup mocks
      mockPromptEngine.presentModificationMenu = jest.fn()
        .mockResolvedValueOnce(suggestionChoice)
        .mockResolvedValueOnce({ action: sampleModificationMenu.actions[2] }); // exit
      mockPromptEngine.collectModificationInput = jest.fn().mockResolvedValue(suggestionBasedModification);
      mockPromptEngine.confirmChanges = jest.fn().mockResolvedValue(true);
      mockPromptEngine.showContentSections = jest.fn();
      
      const previewWithSuggestion: ModificationPreview = {
        original: sampleParsedContent,
        modified: sampleParsedContent,
        changes: [
          {
            changeType: 'addition',
            section: 'technical-requirements',
            afterContent: 'System must enforce strong password policies...',
            lineNumbers: [51, 55]
          }
        ],
        impactAnalysis: {
          affectedPhases: ['requirements', 'design'],
          cascadeWarnings: ['May require UI changes'],
          conflictRisks: [],
          approvalRequired: false
        },
        validationResults: {
          success: true,
          errors: [],
          warnings: [],
          validationDuration: 120
        }
      };
      
      const successfulApplication: ApplicationResult = {
        success: true,
        appliedChanges: [previewWithSuggestion.changes[0]],
        failedChanges: [],
        backupPath: '/test/backup/requirements.backup.md',
        applicationDuration: 300
      };
      
      mockPreviewEngine.generatePreview = jest.fn().mockResolvedValue(previewWithSuggestion);
      mockPreviewEngine.applyModifications = jest.fn().mockResolvedValue(successfulApplication);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      
      // Verify suggestion-based workflow
      expect(mockPromptEngine.collectModificationInput).toHaveBeenCalledWith(suggestionChoice.action);
      expect(mockPreviewEngine.generatePreview).toHaveBeenCalledWith(
        sampleParsedContent,
        [suggestionBasedModification]
      );
      expect(successfulApplication.appliedChanges).toHaveLength(1);
      expect(successfulApplication.appliedChanges[0].section).toBe('technical-requirements');
    });
  });

  describe('Configuration and Options', () => {
    it('should respect agent analysis disabled configuration', async () => {
      // Arrange: Create modifier with agents disabled
      const modifierWithoutAgents = new InteractiveModifier({
        enableAgentAnalysis: false,
        verbose: true
      });
      
      const exitChoice: ModificationChoice = {
        action: sampleModificationMenu.actions[2],
        selectedSuggestion: null
      };
      mockPromptEngine.presentModificationMenu = jest.fn().mockResolvedValue(exitChoice);
      mockPromptEngine.showContentSections = jest.fn();

      // Act
      const result = await modifierWithoutAgents.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      
      // Verify agents were not called
      expect(mockAgentAdapter.analyzeWithAgents).not.toHaveBeenCalled();
      expect(mockAgentAdapter.getSuggestions).not.toHaveBeenCalled();
      
      // Menu should be created without suggestions
      expect(mockMenuFactory.createPhaseMenu).toHaveBeenCalledWith(
        'requirements',
        expect.objectContaining({
          suggestions: undefined
        })
      );
      
      // Cleanup
      modifierWithoutAgents.cleanup();
    });

    it('should respect user permissions in workflow', async () => {
      // Arrange: Create modifier with restricted permissions
      const restrictedModifier = new InteractiveModifier({
        userPermissions: {
          canAdd: false,
          canModify: true,
          canDelete: false,
          canReorder: false,
          canApprove: false,
          allowedPhases: ['requirements'],
          restrictedSections: ['acceptance-criteria']
        }
      });
      
      const exitChoice: ModificationChoice = {
        action: sampleModificationMenu.actions[2],
        selectedSuggestion: null
      };
      mockPromptEngine.presentModificationMenu = jest.fn().mockResolvedValue(exitChoice);
      mockPromptEngine.showContentSections = jest.fn();

      // Act
      const result = await restrictedModifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      
      // Verify permissions were passed to menu factory
      expect(mockMenuFactory.createPhaseMenu).toHaveBeenCalledWith(
        'requirements',
        expect.objectContaining({
          userPermissions: expect.objectContaining({
            canAdd: false,
            canModify: true,
            canDelete: false,
            restrictedSections: ['acceptance-criteria']
          })
        })
      );
      
      // Cleanup
      restrictedModifier.cleanup();
    });
  });
});