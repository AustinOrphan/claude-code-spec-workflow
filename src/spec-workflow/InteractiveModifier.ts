/**
 * InteractiveModifier - Main orchestration component for interactive spec modification
 * 
 * This class serves as the central coordinator for the interactive spec-modify workflow,
 * integrating all component dependencies to provide a seamless modification experience.
 * It orchestrates content parsing, menu generation, user interaction, and change application
 * while maintaining session state and handling error conditions gracefully.
 * 
 * Key responsibilities:
 * - Session management and workflow orchestration
 * - Integration of all interactive modification components
 * - Error handling and graceful degradation
 * - State management throughout the modification process
 * - Coordination of agent analysis and validation
 */

import { SpecPhase, ParsedContent } from './types/ParsedContent';
import { ModificationMenu, ModificationChoice, ModificationData, UserPermissions } from './types/ModificationMenu';
import { ModificationPreview, ApplicationResult } from './types/ModificationPreview';

// Import all component dependencies
import { SpecContentParser } from './SpecContentParser';
import { ModificationMenuFactory, MenuGenerationContext } from './ModificationMenuFactory';
import { InteractivePromptEngine } from './InteractivePromptEngine';
import { PreviewEngine } from './PreviewEngine';
import { AgentIntegrationAdapter, AnalysisResult } from './AgentIntegrationAdapter';
import { SpecStateDetector, SpecState } from './SpecStateDetector';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Error types for specific error handling scenarios
 */
export enum ErrorType {
  FILE_CORRUPTION = 'FILE_CORRUPTION',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION', 
  AGENT_FAILURE = 'AGENT_FAILURE',
  VALIDATION_FAILURE = 'VALIDATION_FAILURE',
  BACKUP_FAILURE = 'BACKUP_FAILURE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SESSION_TIMEOUT = 'SESSION_TIMEOUT'
}

/**
 * Error recovery options for different error scenarios
 */
export interface ErrorRecoveryOptions {
  /** Whether to attempt automatic recovery */
  autoRecover: boolean;
  
  /** Whether to create backup before recovery */
  createBackup: boolean;
  
  /** Whether to prompt user for recovery decisions */
  promptUser: boolean;
  
  /** Whether to fallback to basic functionality */
  enableFallback: boolean;
  
  /** Maximum number of recovery attempts */
  maxRetries: number;
}

/**
 * File integrity tracking for concurrent modification detection
 */
export interface FileIntegrity {
  /** File path */
  filePath: string;
  
  /** File modification time at session start */
  initialMTime: Date;
  
  /** File size at session start */
  initialSize: number;
  
  /** MD5 hash of content at session start */
  initialHash: string;
  
  /** Last checked modification time */
  lastCheckedMTime: Date;
  
  /** Whether concurrent modification has been detected */
  concurrentModificationDetected: boolean;
}

/**
 * Configuration options for interactive modification sessions
 */
export interface InteractiveModifierOptions {
  /** Enable agent analysis and suggestions (default: true) */
  enableAgentAnalysis?: boolean;
  
  /** Timeout for agent operations in milliseconds (default: 10000) */
  agentTimeout?: number;
  
  /** Enable automatic backup creation (default: true) */
  enableBackups?: boolean;
  
  /** User permissions for modification actions */
  userPermissions?: UserPermissions;
  
  /** Additional restrictions on modifications */
  restrictions?: string[];
  
  /** Enable verbose logging for debugging (default: false) */
  verbose?: boolean;
  
  /** Error recovery configuration */
  errorRecovery?: Partial<ErrorRecoveryOptions>;
  
  /** Enable concurrent modification detection (default: true) */
  enableConcurrentDetection?: boolean;
  
  /** Interval for checking file modifications in ms (default: 5000) */
  concurrentCheckInterval?: number;
}

/**
 * Represents the current state of an interactive modification session
 */
export interface SessionState {
  /** The specification name being modified */
  specName: string;
  
  /** The current phase being modified */
  phase: SpecPhase;
  
  /** Path to the specification file */
  filePath: string;
  
  /** Current parsed content */
  parsedContent: ParsedContent | null;
  
  /** Current modification menu */
  currentMenu: ModificationMenu | null;
  
  /** Agent analysis results */
  agentAnalysis: AnalysisResult | null;
  
  /** Specification state analysis */
  specState: SpecState | null;
  
  /** Session start time */
  sessionStart: Date;
  
  /** Whether the session is currently active */
  isActive: boolean;
  
  /** Any errors that occurred during the session */
  sessionErrors: string[];
  
  /** File integrity tracking */
  fileIntegrity: FileIntegrity | null;
  
  /** Number of error recovery attempts made */
  recoveryAttempts: number;
  
  /** Current backup file path (if created) */
  currentBackupPath: string | null;
  
  /** Agent failure count for fallback decisions */
  agentFailureCount: number;
  
  /** Whether currently operating in fallback mode */
  fallbackMode: boolean;
  
  /** Last error type encountered */
  lastErrorType: ErrorType | null;
  
  /** Concurrent check timer reference */
  concurrentCheckTimer: NodeJS.Timeout | null;
}

/**
 * Result of a modification workflow operation
 */
export interface ModificationResult {
  /** Whether the modification was successful */
  success: boolean;
  
  /** Any changes that were applied */
  appliedChanges?: ApplicationResult;
  
  /** Error message if modification failed */
  error?: string;
  
  /** Session state after the operation */
  finalState: SessionState;
}

/**
 * Main orchestration class for interactive spec modification workflow
 * 
 * This class coordinates all component dependencies to provide a cohesive
 * interactive experience for modifying specification files. It manages the
 * complete workflow from content analysis through change application.
 */
export class InteractiveModifier {
  private contentParser: SpecContentParser;
  private menuFactory: ModificationMenuFactory;
  private promptEngine: InteractivePromptEngine;
  private previewEngine: PreviewEngine;
  private agentAdapter: AgentIntegrationAdapter;
  private stateDetector: SpecStateDetector | null = null;
  
  private currentSession: SessionState | null = null;
  private options: Required<InteractiveModifierOptions>;

  /**
   * Initialize the InteractiveModifier with all component dependencies
   * 
   * @param options - Configuration options for the modifier (optional)
   * 
   * Creates instances of all required components and establishes the
   * orchestration layer for the interactive modification workflow.
   */
  constructor(options: InteractiveModifierOptions = {}) {
    // Initialize component dependencies
    this.contentParser = new SpecContentParser();
    this.menuFactory = new ModificationMenuFactory();
    this.promptEngine = new InteractivePromptEngine();
    this.previewEngine = new PreviewEngine();
    this.agentAdapter = new AgentIntegrationAdapter();
    
    // Set default options with error handling configuration
    this.options = {
      enableAgentAnalysis: options.enableAgentAnalysis ?? true,
      agentTimeout: options.agentTimeout ?? 10000,
      enableBackups: options.enableBackups ?? true,
      userPermissions: {
        canAdd: options.userPermissions?.canAdd ?? true,
        canModify: options.userPermissions?.canModify ?? true,
        canDelete: options.userPermissions?.canDelete ?? false,
        canReorder: options.userPermissions?.canReorder ?? true,
        canApprove: options.userPermissions?.canApprove ?? false,
        allowedPhases: options.userPermissions?.allowedPhases ?? ['requirements', 'design', 'tasks'],
        restrictedSections: options.userPermissions?.restrictedSections ?? []
      },
      restrictions: options.restrictions ?? [],
      verbose: options.verbose ?? false,
      errorRecovery: {
        autoRecover: options.errorRecovery?.autoRecover ?? false,
        createBackup: options.errorRecovery?.createBackup ?? true,
        promptUser: options.errorRecovery?.promptUser ?? true,
        enableFallback: options.errorRecovery?.enableFallback ?? true,
        maxRetries: options.errorRecovery?.maxRetries ?? 3,
        ...options.errorRecovery
      },
      enableConcurrentDetection: options.enableConcurrentDetection ?? true,
      concurrentCheckInterval: options.concurrentCheckInterval ?? 5000
    };
  }

  /**
   * Start an interactive modification session for a specification phase
   * 
   * This method serves as the main entry point for interactive modification sessions.
   * It initializes the session, parses content, generates menus, and handles the
   * complete interactive workflow until the user exits or completes modifications.
   * 
   * @param specName - Name of the specification to modify
   * @param phase - The specification phase (requirements, design, or tasks)
   * @returns Promise resolving to boolean indicating session success
   * 
   * The session workflow includes:
   * 1. Initialize session state and parse specification content
   * 2. Run agent analysis for quality assessment and suggestions
   * 3. Display content with quality metrics and modifiable sections
   * 4. Present modification menu and collect user choice
   * 5. Execute selected modification with preview and confirmation
   * 6. Apply changes atomically with backup and validation
   * 7. Update session state and continue or exit based on user choice
   * 
   * @example
   * ```typescript
   * const modifier = new InteractiveModifier({
   *   enableAgentAnalysis: true,
   *   userPermissions: { canAdd: true, canModify: true }
   * });
   * 
   * const success = await modifier.startInteractiveSession('user-auth', 'requirements');
   * if (success) {
   *   console.log('Session completed successfully');
   * }
   * ```
   */
  async startInteractiveSession(specName: string, phase: SpecPhase): Promise<boolean> {
    try {
      // Initialize session state
      const filePath = this.buildSpecFilePath(specName, phase);
      
      this.currentSession = {
        specName,
        phase,
        filePath,
        parsedContent: null,
        currentMenu: null,
        agentAnalysis: null,
        specState: null,
        sessionStart: new Date(),
        isActive: true,
        sessionErrors: [],
        fileIntegrity: null,
        recoveryAttempts: 0,
        currentBackupPath: null,
        agentFailureCount: 0,
        fallbackMode: false,
        lastErrorType: null,
        concurrentCheckTimer: null
      };

      this.logVerbose(`Starting interactive session for ${specName}:${phase}`);
      
      // Initialize file integrity tracking
      await this.initializeFileIntegrity(filePath);
      
      // Create initial backup if enabled
      if (this.options.enableBackups) {
        await this.createSessionBackup();
      }
      
      // Initialize SpecStateDetector for enhanced state analysis
      this.stateDetector = new SpecStateDetector(specName);
      
      // Start concurrent modification monitoring
      if (this.options.enableConcurrentDetection) {
        this.startConcurrentModificationMonitoring();
      }
      
      // Analyze specification state to understand current context
      const specState = await this.analyzeSpecificationState();
      this.currentSession.specState = specState;
      
      // Validate that the requested phase is appropriate for modification
      if (!this.validatePhaseModification(phase, specState)) {
        return this.handleSessionError(
          `Phase '${phase}' is not available for modification in current state '${specState.phase}'`
        );
      }
      
      // Parse specification content with error handling
      const parsedContent = await this.parseSpecificationContentWithRecovery();
      if (!parsedContent.parseSuccess) {
        return this.handleSessionError('Failed to parse specification content', parsedContent.parseErrors);
      }

      // Run agent analysis if enabled with fallback handling
      let agentAnalysis: AnalysisResult | null = null;
      if (this.options.enableAgentAnalysis && !this.currentSession.fallbackMode) {
        agentAnalysis = await this.runAgentAnalysisWithFallback(parsedContent);
        this.currentSession.agentAnalysis = agentAnalysis;
      }

      // Display content and start interactive workflow
      await this.displayContentAndMetrics(parsedContent);
      
      // Main interaction loop
      let continueModeifying = true;
      while (continueModeifying && this.currentSession.isActive) {
        continueModeifying = await this.handleModificationWorkflow(parsedContent, agentAnalysis);
      }

      this.logVerbose('Interactive session completed');
      
      // Clean up session resources
      this.cleanup();
      
      return this.currentSession ? this.currentSession.sessionErrors.length === 0 : false;

    } catch (error) {
      const errorMessage = `Session failed: ${error instanceof Error ? error.message : String(error)}`;
      this.handleSessionError(errorMessage);
      this.cleanup();
      return false;
    }
  }

  /**
   * Handle the complete modification workflow for a session
   * 
   * Coordinates the modification process from menu presentation through change application.
   * This method handles the core interactive loop where users select actions, provide input,
   * preview changes, and confirm modifications.
   * 
   * @param parsedContent - Current parsed content structure
   * @param agentAnalysis - Results from agent analysis (optional)
   * @returns Promise resolving to boolean indicating whether to continue modifying
   * 
   * The workflow includes:
   * - Generate and present modification menu
   * - Collect user choice and modification input
   * - Generate preview of changes
   * - Confirm changes with user
   * - Apply modifications atomically
   * - Update session state
   * 
   * @protected
   */
  protected async handleModificationWorkflow(
    parsedContent: ParsedContent, 
    agentAnalysis: AnalysisResult | null
  ): Promise<boolean> {
    try {
      // Check for concurrent modifications before proceeding
      if (this.options.enableConcurrentDetection && await this.detectConcurrentModification()) {
        const continueAfterConcurrent = await this.handleConcurrentModification();
        if (!continueAfterConcurrent) {
          return false;
        }
      }
      
      // Generate modification menu
      const menu = await this.generateModificationMenu(parsedContent, agentAnalysis);
      this.currentSession!.currentMenu = menu;

      // Present menu and collect user choice
      const userChoice = await this.promptEngine.presentModificationMenu(menu);
      
      // Handle exit choice
      if (userChoice.action?.id === 'exit') {
        this.logVerbose('User chose to exit modification workflow');
        return false;
      }

      // Collect modification input based on chosen action
      const modificationData = await this.promptEngine.collectModificationInput(userChoice.action!);
      
      // Generate preview of changes
      const preview = await this.previewEngine.generatePreview(
        parsedContent, 
        [modificationData]
      );

      // Show preview and confirm changes
      const confirmed = await this.promptEngine.confirmChanges(preview);
      if (!confirmed) {
        this.logVerbose('User cancelled modification');
        return true; // Continue workflow but don't apply changes
      }

      // Apply modifications with error recovery
      const applicationResult = await this.applyModificationsWithRecovery(preview);

      if (applicationResult.success) {
        this.logVerbose(`Successfully applied ${applicationResult.appliedChanges.length} changes`);
        
        // Update file integrity tracking after successful modification
        await this.updateFileIntegrity();
        
        // Re-parse content after modifications
        const updatedContent = await this.parseSpecificationContentWithRecovery();
        if (updatedContent.parseSuccess) {
          this.currentSession!.parsedContent = updatedContent;
          parsedContent = updatedContent; // Update reference for next iteration
        }
        
        return true; // Continue workflow
      } else {
        this.logVerbose(`Modification application failed: ${applicationResult.error}`);
        
        // Check if we can attempt recovery
        if (this.canAttemptRecovery(ErrorType.VALIDATION_FAILURE)) {
          const recovered = await this.attemptErrorRecovery(ErrorType.VALIDATION_FAILURE, applicationResult.error || 'Unknown error');
          if (recovered) {
            return true; // Try again after recovery
          }
        }
        
        this.handleSessionError(`Failed to apply modifications: ${applicationResult.error}`);
        return false;
      }

    } catch (error) {
      const errorMessage = `Workflow error: ${error instanceof Error ? error.message : String(error)}`;
      this.handleSessionError(errorMessage);
      return false;
    }
  }

  /**
   * Analyze the current specification state using SpecStateDetector
   * 
   * This provides enhanced context about the specification's current status,
   * helping determine appropriate modification options and workflow guidance.
   * 
   * @returns Promise resolving to specification state analysis
   * @private
   */
  private async analyzeSpecificationState(): Promise<SpecState> {
    if (!this.stateDetector) {
      throw new Error('SpecStateDetector not initialized');
    }

    this.logVerbose('Analyzing specification state...');
    
    const specState = await this.stateDetector.analyzeState();
    
    this.logVerbose(`Specification state: ${specState.phase}, can modify: ${specState.canModifyAt.join(', ')}`);
    
    return specState;
  }

  /**
   * Validate that the requested phase is available for modification
   * 
   * Uses SpecStateDetector results to ensure the phase exists and can be modified
   * based on the current specification state and workflow constraints.
   * 
   * @param requestedPhase - The phase the user wants to modify
   * @param specState - Current specification state analysis
   * @returns Boolean indicating if modification is valid
   * @private
   */
  private validatePhaseModification(requestedPhase: SpecPhase, specState: SpecState): boolean {
    // Check if the phase is in the list of modifiable phases
    const canModifyPhases = specState.canModifyAt as string[];
    
    if (!canModifyPhases.includes(requestedPhase)) {
      this.logVerbose(`Phase '${requestedPhase}' not in modifiable phases: ${canModifyPhases.join(', ')}`);
      return false;
    }

    // Additional validation based on phase status
    switch (requestedPhase) {
      case 'requirements':
        return specState.requirements.exists;
      case 'design':
        return specState.design.exists;
      case 'tasks':
        return specState.tasks.exists;
      default:
        this.logVerbose(`Unknown phase for validation: ${requestedPhase}`);
        return false;
    }
  }

  /**
   * Parse specification content using the SpecContentParser
   * 
   * @returns Promise resolving to parsed content structure
   * @private
   */
  private async parseSpecificationContent(): Promise<ParsedContent> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    this.logVerbose(`Parsing content from: ${this.currentSession.filePath}`);
    
    const parsedContent = await this.contentParser.parseSpecContent(
      this.currentSession.filePath,
      this.currentSession.phase
    );
    
    this.currentSession.parsedContent = parsedContent;
    return parsedContent;
  }

  /**
   * Run agent analysis on parsed content with fallback handling
   * 
   * @param content - The parsed content to analyze
   * @returns Promise resolving to analysis results or null if disabled/failed
   * @private
   */
  private async runAgentAnalysisWithFallback(content: ParsedContent): Promise<AnalysisResult | null> {
    if (!this.options.enableAgentAnalysis || this.currentSession?.fallbackMode) {
      return null;
    }

    try {
      this.logVerbose('Running agent analysis...');
      
      const analysisResult = await Promise.race([
        this.agentAdapter.analyzeWithAgents(content, content.phase),
        new Promise<AnalysisResult>((_, reject) => 
          setTimeout(() => reject(new Error('Agent analysis timeout')), this.options.agentTimeout)
        )
      ]);

      this.logVerbose(`Agent analysis completed with status: ${analysisResult.status}`);
      // Reset failure count on successful analysis
      if (this.currentSession) {
        this.currentSession.agentFailureCount = 0;
      }
      return analysisResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logVerbose(`Agent analysis failed: ${errorMessage}`);
      
      // Increment failure count and consider fallback mode
      if (this.currentSession) {
        this.currentSession.agentFailureCount++;
        this.currentSession.lastErrorType = ErrorType.AGENT_FAILURE;
        
        // Enter fallback mode if too many failures
        if (this.currentSession.agentFailureCount >= 3 && this.options.errorRecovery.enableFallback) {
          this.logVerbose('Multiple agent failures detected, switching to fallback mode');
          this.currentSession.fallbackMode = true;
          
          // Notify user about fallback mode
          console.warn('⚠️  Agent analysis is temporarily unavailable. Continuing with basic functionality.');
        }
      }
      
      // Graceful fallback - continue without agent analysis
      return null;
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use runAgentAnalysisWithFallback instead
   */
  private async runAgentAnalysis(content: ParsedContent): Promise<AnalysisResult | null> {
    return this.runAgentAnalysisWithFallback(content);
  }

  /**
   * Display specification content with quality metrics and state information
   * 
   * Enhanced to include SpecStateDetector analysis for comprehensive context display.
   * Shows both content structure and specification workflow state.
   * 
   * @param content - Parsed content to display
   * @private
   */
  private async displayContentAndMetrics(content: ParsedContent): Promise<void> {
    // Display content sections with enhanced state context
    this.promptEngine.showContentSections(
      content.sections,
      content.metadata,
      content.qualityMetrics,
      this.currentSession?.specState // Pass specification state for enhanced display
    );
    
    // Display additional state information if available
    if (this.currentSession?.specState && this.stateDetector) {
      const statusSummary = this.stateDetector.getStatusSummary(this.currentSession.specState);
      const nextAction = this.stateDetector.getNextAction(this.currentSession.specState);
      
      this.logVerbose(`Specification Status: ${statusSummary}`);
      this.logVerbose(`Suggested Next Action: ${nextAction}`);
    }
  }

  /**
   * Generate modification menu using the MenuFactory
   * 
   * @param content - Current parsed content
   * @param analysis - Agent analysis results
   * @returns Promise resolving to modification menu
   * @private
   */
  private async generateModificationMenu(
    content: ParsedContent,
    analysis: AnalysisResult | null
  ): Promise<ModificationMenu> {
    const specState = this.currentSession?.specState;
    
    const context: MenuGenerationContext = {
      specName: this.currentSession!.specName,
      phaseStatus: content.qualityMetrics.validationStatus,
      approved: content.qualityMetrics.approvalStatus,
      lastModified: content.metadata.lastModified,
      userPermissions: this.options.userPermissions,
      availableSections: content.sections
        .filter(s => s.modifiable)
        .map(s => s.sectionType),
      restrictions: this.options.restrictions,
      // Enhanced context from SpecStateDetector
      specificationState: specState,
      totalTasks: specState?.tasks.total ?? 0,
      completedTasks: specState?.tasks.completed ?? 0,
      nextPendingTask: specState?.tasks.nextPendingTask?.id
    };

    // Add agent suggestions if available
    if (analysis && this.options.enableAgentAnalysis) {
      context.suggestions = await this.agentAdapter.getSuggestions(analysis);
    }

    return this.menuFactory.createPhaseMenu(content.phase, context);
  }

  /**
   * Build file path for specification phase
   * 
   * @param specName - Name of the specification
   * @param phase - Specification phase
   * @returns Absolute file path to the specification file
   * @private
   */
  private buildSpecFilePath(specName: string, phase: SpecPhase): string {
    const phaseFileName = `${phase}.md`;
    return `/Users/austinorphan/src/claude-code-spec-workflow/main/.claude/specs/${specName}/${phaseFileName}`;
  }

  /**
   * Handle session errors and update session state
   * 
   * @param errorMessage - Error message to log
   * @param additionalErrors - Additional error details (optional)
   * @returns False to indicate session failure
   * @private
   */
  private handleSessionError(errorMessage: string, additionalErrors?: string[]): boolean {
    if (this.currentSession) {
      this.currentSession.sessionErrors.push(errorMessage);
      if (additionalErrors) {
        this.currentSession.sessionErrors.push(...additionalErrors);
      }
      this.currentSession.isActive = false;
    }

    console.error(`[InteractiveModifier] ${errorMessage}`);
    if (additionalErrors && this.options.verbose) {
      additionalErrors.forEach(err => console.error(`  - ${err}`));
    }

    return false;
  }

  /**
   * Log verbose messages if verbose mode is enabled
   * 
   * @param message - Message to log
   * @private
   */
  private logVerbose(message: string): void {
    if (this.options.verbose) {
      console.log(`[InteractiveModifier] ${message}`);
    }
  }

  /**
   * Get the current session state (for testing and debugging)
   * 
   * @returns Current session state or null if no session active
   */
  public getCurrentSession(): SessionState | null {
    return this.currentSession;
  }

  /**
   * Get the current configuration options
   * 
   * @returns Current modifier options
   */
  public getOptions(): Required<InteractiveModifierOptions> {
    return { ...this.options };
  }

  /**
   * Clean up session resources and reset state
   * 
   * Should be called when the session is complete or on error
   * to ensure proper cleanup of resources and state.
   */
  public cleanup(): void {
    if (this.currentSession) {
      this.currentSession.isActive = false;
      
      // Clean up concurrent modification monitoring
      if (this.currentSession.concurrentCheckTimer) {
        clearInterval(this.currentSession.concurrentCheckTimer);
        this.currentSession.concurrentCheckTimer = null;
      }
      
      // Clean up any temporary corruption backups older than 1 hour
      this.cleanupTemporaryBackups();
      
      this.logVerbose(`Session cleanup completed for ${this.currentSession.specName}`);
      this.currentSession = null;
    }
  }

  // ====================
  // ERROR HANDLING METHODS
  // ====================

  /**
   * Initialize file integrity tracking for concurrent modification detection
   * 
   * @param filePath - Path to the file to monitor
   * @private
   */
  private async initializeFileIntegrity(filePath: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) {
        this.logVerbose(`File does not exist yet: ${filePath}`);
        // Create minimal integrity record for new files
        if (this.currentSession) {
          this.currentSession.fileIntegrity = {
            filePath,
            initialMTime: new Date(),
            initialSize: 0,
            initialHash: '',
            lastCheckedMTime: new Date(),
            concurrentModificationDetected: false
          };
        }
        return;
      }

      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const hash = crypto.createHash('md5').update(content).digest('hex');

      if (this.currentSession) {
        this.currentSession.fileIntegrity = {
          filePath,
          initialMTime: stats.mtime,
          initialSize: stats.size,
          initialHash: hash,
          lastCheckedMTime: stats.mtime,
          concurrentModificationDetected: false
        };
      }

      this.logVerbose(`File integrity initialized for ${filePath} (size: ${stats.size}, hash: ${hash.substring(0, 8)}...)`);

    } catch (error) {
      this.logVerbose(`Failed to initialize file integrity: ${error instanceof Error ? error.message : String(error)}`);
      // Continue without integrity checking
    }
  }

  /**
   * Update file integrity tracking after successful modifications
   * 
   * @private
   */
  private async updateFileIntegrity(): Promise<void> {
    if (!this.currentSession?.fileIntegrity) {
      return;
    }

    try {
      const filePath = this.currentSession.fileIntegrity.filePath;
      
      if (!fs.existsSync(filePath)) {
        this.logVerbose(`File no longer exists for integrity update: ${filePath}`);
        return;
      }

      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const hash = crypto.createHash('md5').update(content).digest('hex');

      this.currentSession.fileIntegrity.initialMTime = stats.mtime;
      this.currentSession.fileIntegrity.initialSize = stats.size;
      this.currentSession.fileIntegrity.initialHash = hash;
      this.currentSession.fileIntegrity.lastCheckedMTime = stats.mtime;
      this.currentSession.fileIntegrity.concurrentModificationDetected = false;

      this.logVerbose(`File integrity updated (size: ${stats.size}, hash: ${hash.substring(0, 8)}...)`);

    } catch (error) {
      this.logVerbose(`Failed to update file integrity: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start concurrent modification monitoring
   * 
   * @private
   */
  private startConcurrentModificationMonitoring(): void {
    if (!this.currentSession) {
      return;
    }

    const checkInterval = this.options.concurrentCheckInterval;
    
    this.currentSession.concurrentCheckTimer = setInterval(async () => {
      if (this.currentSession?.isActive) {
        await this.detectConcurrentModification();
      }
    }, checkInterval);

    this.logVerbose(`Started concurrent modification monitoring (interval: ${checkInterval}ms)`);
  }

  /**
   * Detect if the file has been modified concurrently
   * 
   * @returns Promise resolving to true if concurrent modification detected
   * @private
   */
  private async detectConcurrentModification(): Promise<boolean> {
    if (!this.currentSession?.fileIntegrity) {
      return false;
    }

    try {
      const filePath = this.currentSession.fileIntegrity.filePath;
      
      if (!fs.existsSync(filePath)) {
        // File was deleted - this is a type of concurrent modification
        this.currentSession.fileIntegrity.concurrentModificationDetected = true;
        this.logVerbose('File was deleted - concurrent modification detected');
        return true;
      }

      const stats = fs.statSync(filePath);
      const lastModified = this.currentSession.fileIntegrity.lastCheckedMTime;
      
      if (stats.mtime > lastModified) {
        // File has been modified since last check
        const content = fs.readFileSync(filePath, 'utf-8');
        const currentHash = crypto.createHash('md5').update(content).digest('hex');
        
        if (currentHash !== this.currentSession.fileIntegrity.initialHash) {
          this.currentSession.fileIntegrity.concurrentModificationDetected = true;
          this.currentSession.fileIntegrity.lastCheckedMTime = stats.mtime;
          this.logVerbose('Concurrent file modification detected');
          return true;
        }
      }

      return false;

    } catch (error) {
      this.logVerbose(`Error detecting concurrent modification: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Handle detected concurrent modification
   * 
   * @returns Promise resolving to true if session should continue
   * @private
   */
  private async handleConcurrentModification(): Promise<boolean> {
    if (!this.currentSession?.fileIntegrity) {
      return true;
    }

    this.currentSession.lastErrorType = ErrorType.CONCURRENT_MODIFICATION;
    
    console.warn('\n⚠️  Concurrent file modification detected!');
    console.log(`The file ${this.currentSession.fileIntegrity.filePath} has been modified outside this session.`);
    
    if (this.options.errorRecovery.promptUser) {
      try {
        // Use proper prompting with enhanced options
        const choice = await this.promptEngine.promptForConcurrentModificationRecovery();
        
        switch (choice) {
          case 'reload':
            await this.reloadContentAfterConcurrentModification();
            return true;
          case 'merge':
            const mergeSuccess = await this.attemptContentMerge();
            return mergeSuccess;
          case 'backup-restore':
            const restoreSuccess = await this.recoverFromFileCorruption('Concurrent modification detected');
            if (restoreSuccess) {
              console.log('✓ Content restored from backup, concurrent changes discarded.');
              return true;
            } else {
              console.error('❌ Failed to restore from backup.');
              return false;
            }
          case 'diff':
            await this.showConcurrentModificationDiff();
            // After showing diff, prompt again for action
            return this.handleConcurrentModification();
          case 'exit':
            return false;
          default:
            this.logVerbose(`Unexpected choice for concurrent modification: ${choice}`);
            return false;
        }
      } catch (error) {
        this.logVerbose(`Error in concurrent modification prompting: ${error instanceof Error ? error.message : String(error)}`);
        // Fallback to simple recovery
        await this.reloadContentAfterConcurrentModification();
        return true;
      }
    } else {
      // Auto-recovery mode
      if (this.options.errorRecovery?.autoRecover ?? false) {
        await this.reloadContentAfterConcurrentModification();
        return true;
      } else {
        // Exit session
        this.handleSessionError('Session terminated due to concurrent modification');
        return false;
      }
    }
  }

  /**
   * Reload content after concurrent modification
   * 
   * @private
   */
  private async reloadContentAfterConcurrentModification(): Promise<void> {
    try {
      this.logVerbose('Reloading content after concurrent modification...');
      
      // Re-initialize file integrity
      if (this.currentSession) {
        await this.initializeFileIntegrity(this.currentSession.filePath);
        
        // Re-parse content
        const updatedContent = await this.parseSpecificationContentWithRecovery();
        if (updatedContent.parseSuccess) {
          this.currentSession.parsedContent = updatedContent;
          console.log('✓ Content reloaded successfully');
        } else {
          throw new Error('Failed to parse reloaded content');
        }
      }

    } catch (error) {
      this.handleSessionError(`Failed to reload content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a backup of the current session file
   * 
   * @private
   */
  private async createSessionBackup(): Promise<void> {
    if (!this.currentSession || !this.options.enableBackups) {
      return;
    }

    try {
      const filePath = this.currentSession.filePath;
      
      if (!fs.existsSync(filePath)) {
        this.logVerbose('File does not exist yet, skipping backup creation');
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.dirname(filePath);
      const fileName = path.basename(filePath, '.md');
      const backupFileName = `${fileName}.backup-${timestamp}.md`;
      const backupPath = path.join(backupDir, backupFileName);

      fs.copyFileSync(filePath, backupPath);
      
      this.currentSession.currentBackupPath = backupPath;
      this.logVerbose(`Session backup created: ${backupPath}`);

    } catch (error) {
      this.logVerbose(`Failed to create session backup: ${error instanceof Error ? error.message : String(error)}`);
      // Continue without backup - not critical
    }
  }

  /**
   * Parse specification content with recovery capabilities
   * 
   * @returns Promise resolving to parsed content with error recovery
   * @private
   */
  private async parseSpecificationContentWithRecovery(): Promise<ParsedContent> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    try {
      // First attempt normal parsing
      const parsedContent = await this.contentParser.parseSpecContent(
        this.currentSession.filePath,
        this.currentSession.phase
      );
      
      if (parsedContent.parseSuccess) {
        this.currentSession.parsedContent = parsedContent;
        return parsedContent;
      } else {
        // Parsing failed - attempt recovery
        this.currentSession.lastErrorType = ErrorType.FILE_CORRUPTION;
        
        if (this.canAttemptRecovery(ErrorType.FILE_CORRUPTION)) {
          const recovered = await this.attemptErrorRecovery(
            ErrorType.FILE_CORRUPTION, 
            `Parse errors: ${parsedContent.parseErrors?.join(', ')}`
          );
          
          if (recovered) {
            // Try parsing again after recovery
            const retryContent = await this.contentParser.parseSpecContent(
              this.currentSession.filePath,
              this.currentSession.phase
            );
            
            this.currentSession.parsedContent = retryContent;
            return retryContent;
          }
        }
        
        // Recovery failed, return original result
        return parsedContent;
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logVerbose(`Content parsing error: ${errorMessage}`);
      
      // Try to recover from corruption
      this.currentSession.lastErrorType = ErrorType.FILE_CORRUPTION;
      
      if (this.canAttemptRecovery(ErrorType.FILE_CORRUPTION)) {
        const recovered = await this.attemptErrorRecovery(ErrorType.FILE_CORRUPTION, errorMessage);
        if (recovered) {
          // Retry parsing
          return this.parseSpecificationContentWithRecovery();
        }
      }
      
      // Return a failed parse result
      return {
        phase: this.currentSession.phase,
        sections: [],
        metadata: {
          filePath: this.currentSession.filePath,
          fileSize: 0,
          lastModified: new Date(),
          totalLines: 0,
          encoding: 'utf-8',
          isDirty: false
        },
        qualityMetrics: {
          templateCompliance: 0,
          completeness: 0,
          validationStatus: 'error',
          lastModified: new Date(),
          approvalStatus: false,
          issueCount: 1,
          confidenceScore: 0
        },
        rawContent: '',
        parseSuccess: false,
        parseErrors: [errorMessage]
      };
    }
  }

  /**
   * Apply modifications with recovery capabilities
   * 
   * @param preview - The modification preview to apply
   * @returns Promise resolving to application result with recovery
   * @private
   */
  private async applyModificationsWithRecovery(preview: ModificationPreview): Promise<ApplicationResult> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    try {
      // First attempt normal application
      const result = await this.previewEngine.applyModifications(
        preview,
        this.currentSession.filePath
      );
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logVerbose(`Modification application error: ${errorMessage}`);
      
      // Attempt recovery if possible
      this.currentSession.lastErrorType = ErrorType.VALIDATION_FAILURE;
      
      if (this.canAttemptRecovery(ErrorType.VALIDATION_FAILURE)) {
        const recovered = await this.attemptErrorRecovery(ErrorType.VALIDATION_FAILURE, errorMessage);
        if (recovered) {
          // Retry application
          return this.applyModificationsWithRecovery(preview);
        }
      }
      
      // Return failed result
      return {
        success: false,
        error: errorMessage,
        appliedChanges: [],
        failedChanges: preview.changes,
        backupPath: undefined,
        applicationDuration: 0
      };
    }
  }

  /**
   * Check if error recovery can be attempted for a specific error type
   * 
   * @param errorType - Type of error that occurred
   * @returns Boolean indicating if recovery can be attempted
   * @private
   */
  private canAttemptRecovery(errorType: ErrorType): boolean {
    if (!this.currentSession || !this.options.errorRecovery) {
      return false;
    }

    // Check if we've exceeded max retry attempts
    const maxRetries = this.options.errorRecovery.maxRetries ?? 3;
    if (this.currentSession.recoveryAttempts >= maxRetries) {
      this.logVerbose(`Max recovery attempts (${maxRetries}) exceeded`);
      return false;
    }

    // Check if recovery is enabled for this error type
    switch (errorType) {
      case ErrorType.FILE_CORRUPTION:
        return (this.options.errorRecovery.createBackup ?? true) && this.currentSession.currentBackupPath !== null;
      
      case ErrorType.AGENT_FAILURE:
        return this.options.errorRecovery.enableFallback ?? true;
      
      case ErrorType.CONCURRENT_MODIFICATION:
        return (this.options.errorRecovery.promptUser ?? true) || (this.options.errorRecovery.autoRecover ?? false);
      
      case ErrorType.VALIDATION_FAILURE:
        return this.options.errorRecovery.autoRecover ?? false;
      
      default:
        return false;
    }
  }

  /**
   * Attempt error recovery for a specific error type
   * 
   * @param errorType - Type of error that occurred
   * @param errorMessage - Details about the error
   * @returns Promise resolving to true if recovery was successful
   * @private
   */
  private async attemptErrorRecovery(errorType: ErrorType, errorMessage: string): Promise<boolean> {
    if (!this.currentSession) {
      return false;
    }

    this.currentSession.recoveryAttempts++;
    this.logVerbose(`Attempting error recovery for ${errorType} (attempt ${this.currentSession.recoveryAttempts})`);

    try {
      switch (errorType) {
        case ErrorType.FILE_CORRUPTION:
          return await this.recoverFromFileCorruption(errorMessage);
        
        case ErrorType.CONCURRENT_MODIFICATION:
          return await this.handleConcurrentModification();
        
        case ErrorType.AGENT_FAILURE:
          return this.recoverFromAgentFailure();
        
        case ErrorType.VALIDATION_FAILURE:
          return await this.recoverFromValidationFailure(errorMessage);
        
        default:
          this.logVerbose(`No recovery strategy for error type: ${errorType}`);
          return false;
      }
      
    } catch (error) {
      this.logVerbose(`Error recovery failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Recover from file corruption by restoring from backup
   * 
   * @param errorMessage - Details about the corruption
   * @returns Promise resolving to true if recovery was successful
   * @private
   */
  private async recoverFromFileCorruption(errorMessage: string): Promise<boolean> {
    if (!this.currentSession?.currentBackupPath) {
      this.logVerbose('No backup available for corruption recovery');
      
      // Check if we can offer template reset as alternative
      if (this.options.errorRecovery.promptUser) {
        console.warn('⚠️  No backup found. File corruption cannot be recovered automatically.');
        console.log('You can try manually fixing the file or exit the session.');
      }
      return false;
    }

    try {
      const backupPath = this.currentSession.currentBackupPath;
      const targetPath = this.currentSession.filePath;

      if (!fs.existsSync(backupPath)) {
        this.logVerbose(`Backup file not found: ${backupPath}`);
        return false;
      }

      // Validate backup file before restoration
      const backupValidation = await this.validateBackupFile(backupPath);
      if (!backupValidation.valid) {
        this.logVerbose(`Backup file validation failed: ${backupValidation.errors?.join(', ')}`);
        console.warn('⚠️  Backup file appears to be corrupted. Cannot restore.');
        return false;
      }

      // Create a corruption backup before overwriting
      if (fs.existsSync(targetPath)) {
        const corruptionBackupPath = `${targetPath}.corrupted-${Date.now()}`;
        try {
          fs.copyFileSync(targetPath, corruptionBackupPath);
          this.logVerbose(`Corrupted file backed up to: ${corruptionBackupPath}`);
        } catch (backupError) {
          this.logVerbose(`Failed to backup corrupted file: ${backupError}`);
          // Continue with restoration anyway
        }
      }

      // Restore from backup
      fs.copyFileSync(backupPath, targetPath);
      
      console.log('🔄 File corruption detected. Content restored from backup.');
      this.logVerbose(`File restored from backup: ${backupPath} -> ${targetPath}`);
      
      // Update file integrity after restoration
      await this.updateFileIntegrity();
      
      // Validate the restored content
      const restoredContent = await this.contentParser.parseSpecContent(
        targetPath,
        this.currentSession.phase
      );
      
      if (restoredContent.parseSuccess) {
        console.log('✓ Restored content validation successful.');
        return true;
      } else {
        console.warn('⚠️  Restored content has validation issues.');
        if (restoredContent.parseErrors) {
          this.logVerbose(`Restored content errors: ${restoredContent.parseErrors.join(', ')}`);
        }
        // Return true anyway since we restored something readable
        return true;
      }

    } catch (error) {
      this.logVerbose(`Backup restoration failed: ${error instanceof Error ? error.message : String(error)}`);
      console.error('❌ Failed to restore from backup:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Recover from agent failure by switching to fallback mode
   * 
   * @returns True if fallback mode was enabled
   * @private
   */
  private recoverFromAgentFailure(): boolean {
    if (!this.currentSession) {
      return false;
    }

    if (!(this.options.errorRecovery?.enableFallback ?? true)) {
      console.error('❌ Agent analysis failed and fallback mode is disabled.');
      this.handleSessionError('Agent analysis failed and no fallback available');
      return false;
    }

    this.currentSession.fallbackMode = true;
    
    // Provide user with information about what functionality will be limited
    console.log('⚠️  Agent analysis failed. Switching to basic mode with reduced functionality:');
    console.log('   • No AI-powered suggestions or quality analysis');
    console.log('   • Basic validation only');
    console.log('   • Manual modification options still available');
    console.log();
    
    this.logVerbose(`Agent failure recovery: enabled fallback mode (failure count: ${this.currentSession.agentFailureCount})`);
    
    // Reset the agent adapter to prevent further issues
    try {
      this.agentAdapter = new AgentIntegrationAdapter();
      this.logVerbose('Agent adapter reset for fallback mode');
    } catch (error) {
      this.logVerbose(`Failed to reset agent adapter: ${error}`);
    }
    
    return true;
  }

  /**
   * Recover from validation failure by creating a new backup and retrying
   * 
   * @param errorMessage - Details about the validation failure
   * @returns Promise resolving to true if recovery was successful
   * @private
   */
  private async recoverFromValidationFailure(errorMessage: string): Promise<boolean> {
    if (!this.currentSession) {
      return false;
    }

    try {
      // Create a new backup before retrying
      if (this.options.errorRecovery?.createBackup ?? true) {
        await this.createSessionBackup();
      }

      this.logVerbose(`Validation failure recovery attempted: ${errorMessage}`);
      
      // For now, just indicate that we can try again
      // In a full implementation, this might involve more sophisticated recovery
      return true;

    } catch (error) {
      this.logVerbose(`Validation failure recovery failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  // ====================
  // ADDITIONAL ERROR HANDLING SUPPORT METHODS
  // ====================

  /**
   * Validate backup file integrity before restoration
   * 
   * @param backupPath - Path to the backup file to validate
   * @returns Promise resolving to validation result
   * @private
   */
  private async validateBackupFile(backupPath: string): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    const errors: string[] = [];
    
    try {
      if (!fs.existsSync(backupPath)) {
        errors.push('Backup file does not exist');
        return { valid: false, errors };
      }

      const stats = fs.statSync(backupPath);
      if (stats.size === 0) {
        errors.push('Backup file is empty');
        return { valid: false, errors };
      }

      // Try to read and parse the backup file
      const content = fs.readFileSync(backupPath, 'utf-8');
      if (content.trim().length === 0) {
        errors.push('Backup file contains no content');
        return { valid: false, errors };
      }

      // Check for basic markdown structure if it's a spec file
      if (!content.includes('#') && !content.includes('*') && content.length > 50) {
        errors.push('Backup file does not appear to be valid markdown');
      }

      return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };

    } catch (error) {
      errors.push(`Failed to validate backup file: ${error instanceof Error ? error.message : String(error)}`);
      return { valid: false, errors };
    }
  }

  /**
   * Attempt to merge concurrent modifications with current session changes
   * 
   * @returns Promise resolving to true if merge was successful
   * @private
   */
  private async attemptContentMerge(): Promise<boolean> {
    if (!this.currentSession?.fileIntegrity) {
      this.logVerbose('No file integrity information available for merge');
      return false;
    }

    try {
      console.log('🔄 Attempting to merge concurrent changes...');
      
      // For now, we'll implement a simple merge strategy
      // In a full implementation, this could use more sophisticated diff/merge algorithms
      
      // Read current file content
      const currentContent = fs.readFileSync(this.currentSession.filePath, 'utf-8');
      
      // Show the user what has changed
      console.log('⚠️  Concurrent changes detected. Automatic merge is not yet fully implemented.');
      console.log('The file will be reloaded with the external changes.');
      
      // Reload content (effectively accepting the external changes)
      await this.reloadContentAfterConcurrentModification();
      
      console.log('✓ Content reloaded with external changes');
      return true;

    } catch (error) {
      this.logVerbose(`Content merge failed: ${error instanceof Error ? error.message : String(error)}`);
      console.error('❌ Failed to merge changes:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Show differences between current session and external modifications
   * 
   * @private
   */
  private async showConcurrentModificationDiff(): Promise<void> {
    if (!this.currentSession?.fileIntegrity) {
      console.log('❌ Cannot show differences - no file integrity information');
      return;
    }

    try {
      console.log('📊 Concurrent Modification Differences:');
      console.log('=' .repeat(50));
      
      const currentContent = fs.readFileSync(this.currentSession.filePath, 'utf-8');
      const currentLines = currentContent.split('\n');
      
      // For this implementation, we'll show basic file information
      // In a full implementation, this would show a proper diff
      console.log(`File: ${this.currentSession.filePath}`);
      console.log(`Original size: ${this.currentSession.fileIntegrity.initialSize} bytes`);
      console.log(`Current size: ${currentLines.join('\n').length} bytes`);
      console.log(`Original modified: ${this.currentSession.fileIntegrity.initialMTime.toISOString()}`);
      
      const stats = fs.statSync(this.currentSession.filePath);
      console.log(`Current modified: ${stats.mtime.toISOString()}`);
      
      console.log('=' .repeat(50));
      console.log('⚠️  Full diff view is not yet implemented.');
      console.log('Please review the file externally if needed.');
      
    } catch (error) {
      this.logVerbose(`Failed to show diff: ${error instanceof Error ? error.message : String(error)}`);
      console.error('❌ Failed to display differences');
    }
  }

  /**
   * Clean up temporary backup files created during error recovery
   * 
   * @private
   */
  private cleanupTemporaryBackups(): void {
    if (!this.currentSession?.filePath) {
      return;
    }

    try {
      const fileDir = path.dirname(this.currentSession.filePath);
      const fileName = path.basename(this.currentSession.filePath, '.md');
      
      // Find corruption backup files
      if (fs.existsSync(fileDir)) {
        const files = fs.readdirSync(fileDir);
        const corruptionFiles = files.filter(f => 
          f.startsWith(`${fileName}.corrupted-`) || 
          f.includes('.corrupted.')
        );
        
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        for (const file of corruptionFiles) {
          try {
            const fullPath = path.join(fileDir, file);
            const stats = fs.statSync(fullPath);
            
            if (stats.mtime.getTime() < oneHourAgo) {
              fs.unlinkSync(fullPath);
              this.logVerbose(`Cleaned up old corruption backup: ${file}`);
            }
          } catch (cleanupError) {
            this.logVerbose(`Failed to cleanup backup ${file}: ${cleanupError}`);
          }
        }
      }
      
    } catch (error) {
      this.logVerbose(`Backup cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}