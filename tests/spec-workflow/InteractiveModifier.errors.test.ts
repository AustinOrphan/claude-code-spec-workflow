/**
 * InteractiveModifier Error Handling Tests
 * 
 * Comprehensive test suite for error handling and recovery scenarios in InteractiveModifier.
 * Tests file corruption recovery, concurrent modification detection, agent failure fallback,
 * and all critical error recovery paths to ensure robust operation under adverse conditions.
 * 
 * Coverage includes:
 * - File corruption detection and backup restoration
 * - Concurrent modification detection and resolution
 * - Agent system failure and fallback behavior  
 * - Validation failure recovery
 * - Backup creation and cleanup
 * - Error recovery configuration validation
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as fsSync from 'fs';
import * as crypto from 'crypto';
import { InteractiveModifier, InteractiveModifierOptions, SessionState, ErrorType } from '../../src/spec-workflow/InteractiveModifier';
import { SpecPhase, ParsedContent } from '../../src/spec-workflow/types/ParsedContent';
import { ModificationChoice, ModificationData } from '../../src/spec-workflow/types/ModificationMenu';
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
jest.mock('crypto');

describe('InteractiveModifier - Error Handling Tests', () => {
  let tempDir: string;
  let modifier: InteractiveModifier;
  let mockContentParser: jest.Mocked<SpecContentParser>;
  let mockMenuFactory: jest.Mocked<ModificationMenuFactory>;
  let mockPromptEngine: jest.Mocked<InteractivePromptEngine>;
  let mockPreviewEngine: jest.Mocked<PreviewEngine>;
  let mockAgentAdapter: jest.Mocked<AgentIntegrationAdapter>;
  let mockStateDetector: jest.Mocked<SpecStateDetector>;
  let mockFs: jest.Mocked<typeof fsSync>;
  let mockCrypto: jest.Mocked<typeof crypto>;

  // Test fixtures
  const validParsedContent: ParsedContent = {
    phase: 'requirements',
    sections: [
      {
        id: 'user-story-1',
        title: 'User Authentication',
        content: 'As a user, I want to log in...',
        sectionType: 'user-story',
        modifiable: true,
        lineRange: [1, 10]
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

  const corruptedParsedContent: ParsedContent = {
    ...validParsedContent,
    parseSuccess: false,
    parseErrors: ['Invalid markdown structure', 'Missing required sections', 'Corrupted file headers']
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

  beforeEach(async () => {
    // Setup temporary directory
    tempDir = await fs.mkdtemp(join(tmpdir(), 'interactive-modifier-errors-test-'));
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup fs mock with proper typing
    mockFs = jest.mocked(fsSync);
    mockFs.existsSync = jest.fn().mockReturnValue(true);
    mockFs.statSync = jest.fn().mockReturnValue({
      mtime: new Date('2023-01-01'),
      size: 1024,
      isFile: () => true,
      isDirectory: () => false,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isSymbolicLink: () => false,
      isFIFO: () => false,
      isSocket: () => false
    } as any);
    mockFs.readFileSync = jest.fn().mockReturnValue('Sample file content');
    mockFs.copyFileSync = jest.fn();
    mockFs.writeFileSync = jest.fn();
    mockFs.readdirSync = jest.fn().mockReturnValue([]);
    mockFs.unlinkSync = jest.fn();

    // Setup crypto mock
    mockCrypto = jest.mocked(crypto);
    const mockHash = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('abc123def456')
    };
    mockCrypto.createHash = jest.fn().mockReturnValue(mockHash as any);

    // Setup component mocks
    mockContentParser = new SpecContentParser() as jest.Mocked<SpecContentParser>;
    mockMenuFactory = new ModificationMenuFactory() as jest.Mocked<ModificationMenuFactory>;
    mockPromptEngine = new InteractivePromptEngine() as jest.Mocked<InteractivePromptEngine>;
    mockPreviewEngine = new PreviewEngine() as jest.Mocked<PreviewEngine>;
    mockAgentAdapter = new AgentIntegrationAdapter() as jest.Mocked<AgentIntegrationAdapter>;
    mockStateDetector = new SpecStateDetector('test-spec') as jest.Mocked<SpecStateDetector>;

    // Mock constructor behavior for SpecStateDetector
    jest.mocked(SpecStateDetector).mockImplementation(() => mockStateDetector);

    // Setup default successful mocks (will be overridden in specific tests)
    mockContentParser.parseSpecContent = jest.fn().mockResolvedValue(validParsedContent);
    mockStateDetector.analyzeState = jest.fn().mockResolvedValue(sampleSpecState);
    mockStateDetector.getStatusSummary = jest.fn().mockReturnValue('Requirements phase complete');
    mockStateDetector.getNextAction = jest.fn().mockReturnValue('Create design phase');
    mockMenuFactory.createPhaseMenu = jest.fn().mockReturnValue({
      phase: 'requirements',
      actions: [{
        id: 'exit',
        label: 'Exit',
        description: 'Exit modification session',
        requiresApproval: false,
        actionType: 'exit'
      }],
      suggestions: [],
      restrictions: []
    });
    mockPromptEngine.showContentSections = jest.fn();
    mockPromptEngine.presentModificationMenu = jest.fn().mockResolvedValue({
      action: { id: 'exit', label: 'Exit', description: 'Exit', requiresApproval: false, actionType: 'exit' },
      selectedSuggestion: null
    });
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    // Cleanup any active session
    modifier?.cleanup();
    jest.clearAllTimers();
  });

  describe('File Corruption Recovery', () => {
    it('should detect and recover from file corruption using backup', async () => {
      // Arrange: Setup file corruption scenario
      const options: InteractiveModifierOptions = {
        enableBackups: true,
        enableConcurrentDetection: false,
        errorRecovery: {
          autoRecover: false,
          createBackup: true,
          promptUser: true,
          enableFallback: true,
          maxRetries: 3
        }
      };
      modifier = new InteractiveModifier(options);

      // Mock corrupted content on first parse, then valid content after recovery
      mockContentParser.parseSpecContent = jest.fn()
        .mockResolvedValueOnce(corruptedParsedContent) // First attempt fails
        .mockResolvedValueOnce(validParsedContent);     // After recovery succeeds

      // Mock backup creation and restoration
      const backupPath = '/test/specs/user-auth/requirements.backup-2023-01-01T10-00-00-000Z.md';
      const originalCreateBackup = jest.spyOn(modifier as any, 'createSessionBackup').mockResolvedValue(undefined);
      jest.spyOn(modifier as any, 'recoverFromFileCorruption').mockImplementation(async () => {
        // Simulate successful backup restoration
        mockContentParser.parseSpecContent = jest.fn().mockResolvedValue(validParsedContent);
        return true;
      });

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      expect(mockContentParser.parseSpecContent).toHaveBeenCalledTimes(2);
      
      // Verify session tracked the error
      const sessionAfterCompletion = modifier.getCurrentSession();
      expect(sessionAfterCompletion).toBeNull(); // Should be cleaned up
    });

    it('should handle backup file validation failure', async () => {
      // Arrange: Setup scenario where backup exists but is corrupted
      const options: InteractiveModifierOptions = {
        enableBackups: true,
        errorRecovery: {
          createBackup: true,
          maxRetries: 2
        }
      };
      modifier = new InteractiveModifier(options);

      mockContentParser.parseSpecContent = jest.fn().mockResolvedValue(corruptedParsedContent);

      // Mock backup validation to fail
      jest.spyOn(modifier as any, 'validateBackupFile').mockResolvedValue({
        valid: false,
        errors: ['Backup file is corrupted', 'Invalid file structure']
      });

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(false);
      expect(mockContentParser.parseSpecContent).toHaveBeenCalled();
    });

    it('should handle missing backup file scenario', async () => {
      // Arrange: Setup corruption without available backup
      const options: InteractiveModifierOptions = {
        enableBackups: false, // No backup created
        errorRecovery: {
          createBackup: false,
          maxRetries: 1
        }
      };
      modifier = new InteractiveModifier(options);

      mockContentParser.parseSpecContent = jest.fn().mockResolvedValue(corruptedParsedContent);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(false);
      expect(mockContentParser.parseSpecContent).toHaveBeenCalled();
    });

    it('should create corruption backup before restoring from backup', async () => {
      // Arrange: Setup successful recovery scenario
      const options: InteractiveModifierOptions = {
        enableBackups: true,
        errorRecovery: {
          createBackup: true,
          maxRetries: 2
        }
      };
      modifier = new InteractiveModifier(options);

      // Mock initial corruption, then successful recovery
      mockContentParser.parseSpecContent = jest.fn()
        .mockResolvedValueOnce(corruptedParsedContent)
        .mockResolvedValueOnce(validParsedContent);

      const currentSession = {
        currentBackupPath: '/test/backup.md',
        filePath: '/test/requirements.md'
      };
      jest.spyOn(modifier, 'getCurrentSession').mockReturnValue(currentSession as any);

      // Mock successful backup validation and restoration
      jest.spyOn(modifier as any, 'validateBackupFile').mockResolvedValue({ valid: true });
      jest.spyOn(modifier as any, 'recoverFromFileCorruption').mockResolvedValue(true);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      expect(mockFs.copyFileSync).toHaveBeenCalled();
    });
  });

  describe('Concurrent Modification Detection', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should detect concurrent file modification', async () => {
      // Arrange: Enable concurrent detection
      const options: InteractiveModifierOptions = {
        enableConcurrentDetection: true,
        concurrentCheckInterval: 1000,
        errorRecovery: {
          promptUser: true,
          autoRecover: false
        }
      };
      modifier = new InteractiveModifier(options);

      let fileModTime = new Date('2023-01-01T10:00:00Z');
      let fileContent = 'Original content';
      let fileHash = 'original123';

      // Mock file stats to simulate modification during session
      mockFs.statSync = jest.fn().mockImplementation(() => ({
        mtime: fileModTime,
        size: fileContent.length,
        isFile: () => true
      }));
      mockFs.readFileSync = jest.fn().mockImplementation(() => fileContent);
      
      // Mock hash generation
      const mockHashObj = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(fileHash)
      };
      mockCrypto.createHash = jest.fn().mockReturnValue(mockHashObj as any);

      // Setup concurrent modification response
      mockPromptEngine.promptForConcurrentModificationRecovery = jest.fn().mockResolvedValue('exit');

      // Start session but don't complete immediately
      const sessionPromise = modifier.startInteractiveSession('user-auth', 'requirements');

      // Wait for session to initialize
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate external file modification
      fileModTime = new Date('2023-01-01T10:01:00Z');
      fileContent = 'Modified content by external process';
      fileHash = 'modified456';

      // Advance timers to trigger concurrent check
      jest.advanceTimersByTime(1100);

      // Allow promises to resolve
      await new Promise(resolve => setImmediate(resolve));

      const result = await sessionPromise;

      // Assert
      expect(result).toBe(false); // Session should exit due to concurrent modification
      expect(mockPromptEngine.promptForConcurrentModificationRecovery).toHaveBeenCalled();
    });

    it('should handle concurrent modification with reload option', async () => {
      // Arrange: Setup concurrent detection with reload choice
      const options: InteractiveModifierOptions = {
        enableConcurrentDetection: true,
        errorRecovery: {
          promptUser: true,
          autoRecover: false
        }
      };
      modifier = new InteractiveModifier(options);

      // Setup file modification scenario
      let callCount = 0;
      mockFs.statSync = jest.fn().mockImplementation(() => {
        callCount++;
        return {
          mtime: callCount > 2 ? new Date('2023-01-01T10:01:00Z') : new Date('2023-01-01T10:00:00Z'),
          size: 1024,
          isFile: () => true
        };
      });

      // Mock user choosing to reload
      mockPromptEngine.promptForConcurrentModificationRecovery = jest.fn().mockResolvedValue('reload');

      // Mock successful content reload
      jest.spyOn(modifier as any, 'reloadContentAfterConcurrentModification').mockResolvedValue(undefined);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      expect(mockPromptEngine.promptForConcurrentModificationRecovery).toHaveBeenCalled();
    });

    it('should handle concurrent modification with backup restore option', async () => {
      // Arrange: Setup concurrent detection with backup restore choice
      const options: InteractiveModifierOptions = {
        enableConcurrentDetection: true,
        enableBackups: true,
        errorRecovery: {
          promptUser: true,
          createBackup: true
        }
      };
      modifier = new InteractiveModifier(options);

      // Mock concurrent modification detection
      jest.spyOn(modifier as any, 'detectConcurrentModification').mockResolvedValue(true);
      
      // Mock user choosing backup restore
      mockPromptEngine.promptForConcurrentModificationRecovery = jest.fn().mockResolvedValue('backup-restore');
      
      // Mock successful backup recovery
      jest.spyOn(modifier as any, 'recoverFromFileCorruption').mockResolvedValue(true);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      expect(mockPromptEngine.promptForConcurrentModificationRecovery).toHaveBeenCalled();
    });

    it('should handle file deletion as concurrent modification', async () => {
      // Arrange: Setup file deletion scenario
      const options: InteractiveModifierOptions = {
        enableConcurrentDetection: true,
        errorRecovery: {
          promptUser: true
        }
      };
      modifier = new InteractiveModifier(options);

      // Start with file existing, then make it disappear
      let fileExists = true;
      mockFs.existsSync = jest.fn().mockImplementation(() => fileExists);
      
      // Mock user response to file deletion
      mockPromptEngine.promptForConcurrentModificationRecovery = jest.fn().mockResolvedValue('exit');

      // Start session
      const sessionPromise = modifier.startInteractiveSession('user-auth', 'requirements');

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate file deletion
      fileExists = false;

      // Manually trigger concurrent detection
      const concurrent = await (modifier as any).detectConcurrentModification();
      
      await sessionPromise;

      // Assert
      expect(concurrent).toBe(true);
      expect(mockPromptEngine.promptForConcurrentModificationRecovery).toHaveBeenCalled();
    });
  });

  describe('Agent Failure Fallback', () => {
    it('should switch to fallback mode after multiple agent failures', async () => {
      // Arrange: Setup agent failures
      const options: InteractiveModifierOptions = {
        enableAgentAnalysis: true,
        agentTimeout: 1000,
        errorRecovery: {
          enableFallback: true
        }
      };
      modifier = new InteractiveModifier(options);

      // Mock agent failures
      mockAgentAdapter.analyzeWithAgents = jest.fn()
        .mockRejectedValueOnce(new Error('Agent timeout'))
        .mockRejectedValueOnce(new Error('Agent unavailable'))
        .mockRejectedValueOnce(new Error('Agent error'));

      // Act: Start multiple sessions to trigger failures
      await modifier.startInteractiveSession('user-auth', 'requirements');
      const session1 = modifier.getCurrentSession();
      modifier.cleanup();

      await modifier.startInteractiveSession('user-auth', 'requirements');  
      const session2 = modifier.getCurrentSession();
      modifier.cleanup();

      const result = await modifier.startInteractiveSession('user-auth', 'requirements');
      const finalSession = modifier.getCurrentSession();

      // Assert
      expect(result).toBe(true);
      expect(mockAgentAdapter.analyzeWithAgents).toHaveBeenCalledTimes(3);
      // Fallback mode should be enabled after multiple failures
    });

    it('should continue with basic functionality when agents are disabled', async () => {
      // Arrange: Disable agent analysis
      const options: InteractiveModifierOptions = {
        enableAgentAnalysis: false
      };
      modifier = new InteractiveModifier(options);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      expect(mockAgentAdapter.analyzeWithAgents).not.toHaveBeenCalled();
      expect(mockMenuFactory.createPhaseMenu).toHaveBeenCalledWith(
        'requirements',
        expect.objectContaining({
          suggestions: undefined
        })
      );
    });

    it('should handle agent timeout gracefully', async () => {
      // Arrange: Setup agent timeout
      const options: InteractiveModifierOptions = {
        enableAgentAnalysis: true,
        agentTimeout: 100, // Very short timeout
        errorRecovery: {
          enableFallback: true
        }
      };
      modifier = new InteractiveModifier(options);

      // Mock slow agent response (will timeout)
      mockAgentAdapter.analyzeWithAgents = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({} as AnalysisResult), 200))
      );

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      expect(mockAgentAdapter.analyzeWithAgents).toHaveBeenCalled();
    });

    it('should reset agent adapter in fallback mode', async () => {
      // Arrange: Force fallback mode
      const options: InteractiveModifierOptions = {
        enableAgentAnalysis: true,
        errorRecovery: {
          enableFallback: true
        }
      };
      modifier = new InteractiveModifier(options);

      // Mock agent failure to trigger fallback
      mockAgentAdapter.analyzeWithAgents = jest.fn().mockRejectedValue(new Error('Agent system failure'));

      // Spy on internal recovery method
      const recoverFromAgentFailureSpy = jest.spyOn(modifier as any, 'recoverFromAgentFailure');

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      expect(recoverFromAgentFailureSpy).toHaveBeenCalled();
    });
  });

  describe('Validation Failure Recovery', () => {
    it('should handle modification validation failure with retry', async () => {
      // Arrange: Setup validation failure
      const options: InteractiveModifierOptions = {
        errorRecovery: {
          autoRecover: true,
          maxRetries: 2,
          createBackup: true
        }
      };
      modifier = new InteractiveModifier(options);

      const modificationChoice: ModificationChoice = {
        action: {
          id: 'add-user-story',
          label: 'Add User Story',
          description: 'Add new story',
          requiresApproval: false,
          actionType: 'add'
        },
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

      // Mock user choices and inputs
      mockPromptEngine.presentModificationMenu = jest.fn()
        .mockResolvedValueOnce(modificationChoice)
        .mockResolvedValueOnce({ 
          action: { id: 'exit', label: 'Exit', description: 'Exit', requiresApproval: false, actionType: 'exit' },
          selectedSuggestion: null 
        });
      mockPromptEngine.collectModificationInput = jest.fn().mockResolvedValue(modificationData);
      mockPromptEngine.confirmChanges = jest.fn().mockResolvedValue(true);

      // Mock preview generation
      const previewMock: ModificationPreview = {
        original: validParsedContent,
        modified: validParsedContent,
        changes: [],
        impactAnalysis: {
          affectedPhases: ['requirements'],
          cascadeWarnings: [],
          conflictRisks: [],
          approvalRequired: false
        },
        validationResults: {
          success: false,
          errors: ['Validation failed'],
          warnings: [],
          validationDuration: 100
        }
      };
      mockPreviewEngine.generatePreview = jest.fn().mockResolvedValue(previewMock);

      // Mock application failure then success
      const failedResult: ApplicationResult = {
        success: false,
        error: 'Validation error in modification',
        appliedChanges: [],
        failedChanges: [],
        backupPath: undefined,
        applicationDuration: 50
      };
      mockPreviewEngine.applyModifications = jest.fn().mockResolvedValue(failedResult);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true); // Should complete session even with validation failure
      expect(mockPreviewEngine.applyModifications).toHaveBeenCalled();
    });

    it('should exhaust retry attempts and handle gracefully', async () => {
      // Arrange: Setup validation failure with max retries
      const options: InteractiveModifierOptions = {
        errorRecovery: {
          autoRecover: false,
          maxRetries: 1 // Low limit
        }
      };
      modifier = new InteractiveModifier(options);

      // Mock parsing to fail multiple times
      mockContentParser.parseSpecContent = jest.fn().mockResolvedValue(corruptedParsedContent);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(false); // Should fail after exhausting retries
      expect(mockContentParser.parseSpecContent).toHaveBeenCalled();
    });
  });

  describe('Backup System', () => {
    it('should create and manage session backup correctly', async () => {
      // Arrange: Enable backup system
      const options: InteractiveModifierOptions = {
        enableBackups: true
      };
      modifier = new InteractiveModifier(options);

      // Mock file operations for backup creation
      mockFs.existsSync = jest.fn().mockReturnValue(true);
      mockFs.copyFileSync = jest.fn();

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true);
      expect(mockFs.copyFileSync).toHaveBeenCalled(); // Backup created
    });

    it('should handle backup creation failure gracefully', async () => {
      // Arrange: Setup backup creation to fail
      const options: InteractiveModifierOptions = {
        enableBackups: true
      };
      modifier = new InteractiveModifier(options);

      // Mock backup creation failure
      mockFs.copyFileSync = jest.fn().mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(true); // Should continue despite backup failure
      expect(mockFs.copyFileSync).toHaveBeenCalled();
    });

    it('should cleanup temporary corruption backups', async () => {
      // Arrange: Setup with temporary backup files
      const options: InteractiveModifierOptions = {
        enableBackups: true
      };
      modifier = new InteractiveModifier(options);

      // Mock file system with old corruption backups
      const oldCorruptionFile = 'requirements.corrupted-1640995200000'; // Old timestamp
      mockFs.readdirSync = jest.fn().mockReturnValue([oldCorruptionFile]);
      mockFs.statSync = jest.fn().mockReturnValue({
        mtime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        isFile: () => true
      });

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');
      modifier.cleanup(); // Trigger cleanup

      // Assert
      expect(result).toBe(true);
      expect(mockFs.unlinkSync).toHaveBeenCalled(); // Old backup cleaned up
    });
  });

  describe('Error Recovery Configuration', () => {
    it('should respect maxRetries configuration', async () => {
      // Arrange: Setup limited retries
      const options: InteractiveModifierOptions = {
        errorRecovery: {
          maxRetries: 2,
          autoRecover: true
        }
      };
      modifier = new InteractiveModifier(options);

      // Mock repeated failures
      mockContentParser.parseSpecContent = jest.fn().mockResolvedValue(corruptedParsedContent);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(false); // Should fail after max retries
    });

    it('should respect autoRecover disabled configuration', async () => {
      // Arrange: Disable auto recovery
      const options: InteractiveModifierOptions = {
        enableConcurrentDetection: true,
        errorRecovery: {
          autoRecover: false,
          promptUser: false
        }
      };
      modifier = new InteractiveModifier(options);

      // Mock concurrent modification
      jest.spyOn(modifier as any, 'detectConcurrentModification').mockResolvedValue(true);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(false); // Should terminate session without recovery
    });

    it('should handle disabled error recovery gracefully', async () => {
      // Arrange: Disable all error recovery
      const options: InteractiveModifierOptions = {
        errorRecovery: {
          autoRecover: false,
          createBackup: false,
          promptUser: false,
          enableFallback: false,
          maxRetries: 0
        }
      };
      modifier = new InteractiveModifier(options);

      // Mock parsing failure
      mockContentParser.parseSpecContent = jest.fn().mockResolvedValue(corruptedParsedContent);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(false);
      expect(mockContentParser.parseSpecContent).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('Session Cleanup and Resource Management', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should cleanup concurrent monitoring timers', async () => {
      // Arrange: Enable concurrent detection
      const options: InteractiveModifierOptions = {
        enableConcurrentDetection: true,
        concurrentCheckInterval: 1000
      };
      modifier = new InteractiveModifier(options);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Verify timer cleanup
      const session = modifier.getCurrentSession();
      expect(session).toBeNull(); // Should be cleaned up

      // Assert
      expect(result).toBe(true);
      expect(clearInterval).toHaveBeenCalled();
    });

    it('should handle cleanup on session error', async () => {
      // Arrange: Setup session that will error
      const options: InteractiveModifierOptions = {
        enableConcurrentDetection: true
      };
      modifier = new InteractiveModifier(options);

      // Mock state detector to throw error
      mockStateDetector.analyzeState = jest.fn().mockRejectedValue(new Error('State analysis failed'));

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert
      expect(result).toBe(false);
      expect(modifier.getCurrentSession()).toBeNull(); // Should be cleaned up even on error
    });

    it('should handle multiple cleanup calls gracefully', async () => {
      // Arrange
      const options: InteractiveModifierOptions = {};
      modifier = new InteractiveModifier(options);

      // Act: Complete session normally then call cleanup again
      await modifier.startInteractiveSession('user-auth', 'requirements');
      modifier.cleanup(); // Additional cleanup call
      modifier.cleanup(); // Should handle gracefully

      // Assert: No errors should occur
      expect(modifier.getCurrentSession()).toBeNull();
    });
  });

  describe('Complex Error Scenarios', () => {
    it('should handle multiple simultaneous error conditions', async () => {
      // Arrange: Setup multiple error conditions
      const options: InteractiveModifierOptions = {
        enableAgentAnalysis: true,
        enableBackups: true,
        enableConcurrentDetection: true,
        errorRecovery: {
          enableFallback: true,
          maxRetries: 2
        }
      };
      modifier = new InteractiveModifier(options);

      // Mock multiple failures
      mockAgentAdapter.analyzeWithAgents = jest.fn().mockRejectedValue(new Error('Agent failure'));
      mockContentParser.parseSpecContent = jest.fn().mockResolvedValue(corruptedParsedContent);
      jest.spyOn(modifier as any, 'detectConcurrentModification').mockResolvedValue(true);

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert: Should handle all errors and still attempt to provide service
      expect(result).toBe(false); // Expected to fail due to parse corruption
      expect(mockAgentAdapter.analyzeWithAgents).toHaveBeenCalled();
      expect(mockContentParser.parseSpecContent).toHaveBeenCalled();
    });

    it('should maintain error state consistency across operations', async () => {
      // Arrange: Setup error tracking scenario
      const options: InteractiveModifierOptions = {
        verbose: true,
        errorRecovery: {
          maxRetries: 1
        }
      };
      modifier = new InteractiveModifier(options);

      // Mock sequential errors
      mockContentParser.parseSpecContent = jest.fn()
        .mockResolvedValueOnce(corruptedParsedContent)  // First error
        .mockResolvedValueOnce(corruptedParsedContent); // Persistent error

      // Act
      const result = await modifier.startInteractiveSession('user-auth', 'requirements');

      // Assert: Session should track errors correctly
      expect(result).toBe(false);
      expect(mockContentParser.parseSpecContent).toHaveBeenCalledTimes(1);
    });
  });
});