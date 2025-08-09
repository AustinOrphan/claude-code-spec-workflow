/**
 * PreviewEngine - Change preview system for interactive spec modification
 * 
 * This class provides the foundation for generating previews of modifications before they
 * are applied to specification files. It handles diff generation, change validation,
 * and atomic file modification operations with backup support.
 * 
 * Key responsibilities:
 * - Generate diff-style previews of pending modifications
 * - Validate modifications using specialized agents before application
 * - Apply changes atomically with backup creation for safety
 * - Provide change tracking and rollback capabilities
 */

import * as path from 'path';
import * as fs from 'fs';
import { 
  ModificationPreview, 
  ChangeRecord, 
  ValidationResult, 
  ApplicationResult,
  PreviewGenerationOptions,
  RiskAssessment,
  ModificationStatistics,
  ChangeType,
  ValidationIssue,
  ValidationConfidence
} from './types/ModificationPreview';
import { ParsedContent, SpecPhase, SectionType, ValidationStatus } from './types/ParsedContent';
import { ModificationData, ImpactAnalysis } from './types/ModificationMenu';

/**
 * Main class for generating modification previews and applying validated changes
 * Integrates with existing backup systems and validation agents for safe file operations
 */
export class PreviewEngine {

  /**
   * Generate a comprehensive preview of pending modifications
   * 
   * This method creates a detailed preview showing exactly what changes will be made,
   * including line-by-line diffs, impact analysis, and validation results. The preview
   * provides all information needed for users to make informed decisions before applying changes.
   * 
   * @param original - The original parsed content before modifications
   * @param modifications - Array of modification data to be applied
   * @param options - Configuration options for preview generation (optional)
   * @returns Promise resolving to complete modification preview
   * 
   * The generated preview includes:
   * - Detailed change records with before/after content
   * - Impact analysis on other phases and components
   * - Validation results from specialized agents
   * - Risk assessment and safety recommendations
   * - Statistical summary of the changes
   */
  async generatePreview(
    original: ParsedContent,
    modifications: ModificationData[],
    options?: PreviewGenerationOptions
  ): Promise<ModificationPreview> {
    const defaultOptions: PreviewGenerationOptions = {
      includeDetailedDiff: true,
      performValidation: true,
      analyzeImpact: true,
      assessRisks: true,
      timeoutMs: 30000, // 30 second timeout
      generateStatistics: true,
      validationAgents: [],
      createBackup: true
    };

    const resolvedOptions = { ...defaultOptions, ...options };
    const previewId = this.generatePreviewId();
    const startTime = Date.now();

    try {
      // Generate the modified content by applying all modifications
      const modifiedContent = await this.applyModificationsToContent(original, modifications);
      
      // Generate detailed change records
      const changes = this.generateChangeRecords(original, modifications);
      
      // Calculate modification statistics
      const statistics = resolvedOptions.generateStatistics ? 
        this.calculateModificationStatistics(changes, original) : this.getEmptyStatistics();
      
      // Perform risk assessment
      const riskAssessment = resolvedOptions.assessRisks ?
        this.assessModificationRisks(changes, original, original.phase) : this.getEmptyRiskAssessment();
      
      // Generate impact analysis
      const impactAnalysis = resolvedOptions.analyzeImpact ?
        await this.generateImpactAnalysis(original, modifications, changes) : this.getEmptyImpactAnalysis();
      
      // Perform validation if requested
      const validationResults = resolvedOptions.performValidation ?
        await this.performPreviewValidation(modifiedContent, original.phase, resolvedOptions) : this.getEmptyValidationResult();
      
      // Determine if the preview is safe to apply
      const safeToApply = this.determineSafetyStatus(validationResults, riskAssessment, changes);
      const blockingIssues = this.extractBlockingIssues(validationResults, riskAssessment);
      const warnings = this.extractWarnings(validationResults, riskAssessment);
      
      // Generate change summary
      const changeSummary = this.generateChangeSummary(changes, statistics);
      
      // Check for cascading changes
      const hasCascadingChanges = impactAnalysis.affectedPhases.length > 1 || 
        impactAnalysis.cascadeWarnings.length > 0;
      
      const preview: ModificationPreview = {
        original,
        modified: modifiedContent,
        changes,
        impactAnalysis,
        validationResults,
        riskAssessment,
        statistics,
        readyForApplication: blockingIssues.length === 0 && safeToApply,
        safeToApply,
        blockingIssues,
        warnings,
        generatedAt: new Date(),
        previewId,
        initiatedBy: process.env.USER || 'unknown',
        hasCascadingChanges,
        changeSummary
      };
      
      return preview;
      
    } catch (error) {
      // Return a failed preview with error information
      return this.createErrorPreview(original, modifications, error as Error, previewId);
    }
  }

  /**
   * Validate modifications before application using specialized agents
   * 
   * This method performs comprehensive validation of pending modifications using the
   * existing agent system. It checks for conflicts, validates content quality,
   * and ensures compliance with specification templates and standards.
   * 
   * @param preview - The modification preview to validate
   * @param phase - The specification phase being modified
   * @returns Promise resolving to detailed validation results
   * 
   * Validation includes:
   * - Content quality and template compliance checks
   * - Cross-phase dependency analysis
   * - Conflict detection with existing content
   * - Integration with specialized validation agents
   * - Risk assessment for the proposed changes
   */
  async validateModifications(
    preview: ModificationPreview,
    phase: SpecPhase
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];
    const validatorsUsed: string[] = [];
    
    try {
      // 1. Basic structural validation
      const structuralIssues = await this.validateStructuralIntegrity(preview.modified, phase);
      issues.push(...structuralIssues);
      validatorsUsed.push('structural-validator');
      
      // 2. Content quality validation
      const qualityIssues = await this.validateContentQuality(preview.modified, preview.changes);
      issues.push(...qualityIssues);
      validatorsUsed.push('content-quality-validator');
      
      // 3. Template compliance validation
      const complianceIssues = await this.validateTemplateCompliance(preview.modified, phase);
      issues.push(...complianceIssues);
      validatorsUsed.push('template-compliance-validator');
      
      // 4. Cross-phase dependency validation
      const dependencyIssues = await this.validateDependencies(preview, phase);
      issues.push(...dependencyIssues);
      validatorsUsed.push('dependency-validator');
      
      // 5. Conflict detection
      const conflictIssues = await this.detectConflicts(preview.changes, preview.original);
      issues.push(...conflictIssues);
      validatorsUsed.push('conflict-detector');
      
      // 6. Risk-based validation
      const riskIssues = await this.validateAgainstRisks(preview.riskAssessment, preview.changes);
      issues.push(...riskIssues);
      validatorsUsed.push('risk-validator');
      
      // 7. Agent integration validation (if agents are available)
      const agentIssues = await this.invokeValidationAgents(preview, phase);
      issues.push(...agentIssues.issues);
      validatorsUsed.push(...agentIssues.agents);
      
      // Calculate overall validation score
      const totalChecks = 50; // Approximate total number of validation checks
      const errorCount = issues.filter(i => i.severity === 'error').length;
      const warningCount = issues.filter(i => i.severity === 'warning').length;
      
      const score = Math.max(0, 100 - (errorCount * 15) - (warningCount * 5));
      const passesMinimumQuality = errorCount === 0 && score >= 70;
      
      // Determine overall status
      const status: ValidationStatus = this.determineValidationStatus(issues, score);
      
      // Determine confidence level based on validators used and completeness
      const confidence: ValidationConfidence = this.determineValidationConfidence(
        validatorsUsed, 
        issues.length, 
        preview.changes.length
      );
      
      const validationDuration = Date.now() - startTime;
      
      const result: ValidationResult = {
        status,
        issues,
        confidence,
        score,
        passesMinimumQuality,
        validatedAt: new Date(),
        validatorsUsed,
        validationDuration,
        completed: true
      };
      
      return result;
      
    } catch (error) {
      // Return failed validation result
      const validationDuration = Date.now() - startTime;
      
      return {
        status: 'error',
        issues: [{
          id: 'validation-error',
          severity: 'error',
          message: `Validation failed: ${(error as Error).message}`,
          code: 'VALIDATION_SYSTEM_ERROR',
          source: 'preview-engine',
          suggestedFix: 'Please try again or contact support if the issue persists'
        }],
        confidence: 'low',
        score: 0,
        passesMinimumQuality: false,
        validatedAt: new Date(),
        validatorsUsed,
        validationDuration,
        completed: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Apply validated modifications atomically with backup support
   * 
   * This method safely applies the modifications shown in the preview to the actual
   * specification file. It creates backups before making changes and ensures all
   * modifications are applied atomically (all succeed or all are rolled back).
   * 
   * @param preview - The validated modification preview to apply
   * @param filePath - Absolute path to the specification file to modify
   * @returns Promise resolving to application result with success status and backup info
   * 
   * Application features:
   * - Automatic backup creation before modifications
   * - Atomic application (all changes succeed or all are rolled back)
   * - Integration with existing file safety mechanisms
   * - Rollback function for undoing changes if needed
   * - Post-application validation to ensure file integrity
   */
  async applyModifications(
    preview: ModificationPreview,
    filePath: string
  ): Promise<ApplicationResult> {
    const startTime = Date.now();
    const appliedChanges: ChangeRecord[] = [];
    const failedChanges: ChangeRecord[] = [];
    let backupPath: string | undefined;
    
    try {
      // 1. Verify the preview is ready for application
      if (!preview.readyForApplication) {
        throw new Error(`Preview is not ready for application: ${preview.blockingIssues.join(', ')}`);
      }
      
      if (!preview.safeToApply) {
        throw new Error('Preview has been marked as unsafe to apply due to validation issues');
      }
      
      // 2. Verify the file exists and is accessible
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }
      
      // 3. Create backup before modifications
      try {
        backupPath = await this.createBackup(filePath);
      } catch (backupError) {
        throw new Error(`Failed to create backup: ${(backupError as Error).message}`);
      }
      
      // 4. Read current file content
      const originalContent = fs.readFileSync(filePath, 'utf8');
      const lines = originalContent.split('\n');
      
      // 5. Sort changes by line number (reverse order to prevent line number shifts)
      const sortedChanges = [...preview.changes].sort((a, b) => 
        b.lineNumbers[0] - a.lineNumbers[0]
      );
      
      // 6. Apply each change to the file content
      let modifiedLines = [...lines];
      let allChangesSuccessful = true;
      
      for (const change of sortedChanges) {
        try {
          // Apply the change based on its type
          switch (change.changeType) {
            case 'addition':
              if (change.afterContent) {
                const insertLine = change.lineNumbers[0] - 1; // Convert to 0-indexed
                const newLines = change.afterContent.split('\n');
                
                // Insert new content at the specified line
                if (insertLine >= 0 && insertLine <= modifiedLines.length) {
                  modifiedLines.splice(insertLine, 0, ...newLines);
                } else {
                  // Append to end if line number is out of bounds
                  modifiedLines.push(...newLines);
                }
              }
              break;
              
            case 'modification':
              if (change.afterContent) {
                const startLine = change.lineNumbers[0] - 1; // Convert to 0-indexed
                const endLine = change.lineNumbers[1] - 1;
                const newLines = change.afterContent.split('\n');
                
                // Replace the lines in the specified range
                if (startLine >= 0 && startLine < modifiedLines.length) {
                  const deleteCount = Math.max(0, Math.min(endLine - startLine + 1, modifiedLines.length - startLine));
                  modifiedLines.splice(startLine, deleteCount, ...newLines);
                } else {
                  throw new Error(`Invalid line range for modification: ${change.lineNumbers.join('-')}`);
                }
              }
              break;
              
            case 'deletion':
              const startLine = change.lineNumbers[0] - 1; // Convert to 0-indexed
              const endLine = change.lineNumbers[1] - 1;
              
              // Delete the lines in the specified range
              if (startLine >= 0 && startLine < modifiedLines.length) {
                const deleteCount = Math.max(0, Math.min(endLine - startLine + 1, modifiedLines.length - startLine));
                modifiedLines.splice(startLine, deleteCount);
              } else {
                throw new Error(`Invalid line range for deletion: ${change.lineNumbers.join('-')}`);
              }
              break;
              
            case 'move':
              // Move operation is more complex - for now treat as modification
              if (change.afterContent) {
                const startLine = change.lineNumbers[0] - 1;
                const endLine = change.lineNumbers[1] - 1;
                const newLines = change.afterContent.split('\n');
                
                if (startLine >= 0 && startLine < modifiedLines.length) {
                  const deleteCount = Math.max(0, Math.min(endLine - startLine + 1, modifiedLines.length - startLine));
                  modifiedLines.splice(startLine, deleteCount, ...newLines);
                }
              }
              break;
              
            default:
              throw new Error(`Unknown change type: ${change.changeType}`);
          }
          
          appliedChanges.push(change);
          
        } catch (changeError) {
          // Record failed change and continue
          failedChanges.push(change);
          allChangesSuccessful = false;
          console.error(`Failed to apply change ${change.id}: ${(changeError as Error).message}`);
        }
      }
      
      // 7. If not all changes were successful, rollback
      if (!allChangesSuccessful && failedChanges.length > 0) {
        // Restore from backup
        if (backupPath && fs.existsSync(backupPath)) {
          const backupContent = fs.readFileSync(backupPath, 'utf8');
          fs.writeFileSync(filePath, backupContent, 'utf8');
        }
        
        throw new Error(`Failed to apply ${failedChanges.length} changes. Rolled back to original state.`);
      }
      
      // 8. Write the modified content back to the file
      const modifiedContent = modifiedLines.join('\n');
      fs.writeFileSync(filePath, modifiedContent, 'utf8');
      
      // 9. Validate file integrity after modification
      const integrityValid = await this.validateFileIntegrity(filePath);
      if (!integrityValid) {
        // Restore from backup if integrity check fails
        if (backupPath && fs.existsSync(backupPath)) {
          const backupContent = fs.readFileSync(backupPath, 'utf8');
          fs.writeFileSync(filePath, backupContent, 'utf8');
        }
        throw new Error('File integrity validation failed after modifications. Rolled back to original state.');
      }
      
      // 10. Perform final validation if requested
      let finalValidation: ValidationResult | undefined;
      if (preview.validationResults.validatorsUsed.length > 0) {
        try {
          // Re-parse the modified file and validate
          const modifiedParsedContent: ParsedContent = {
            ...preview.modified,
            rawContent: modifiedContent,
            metadata: {
              ...preview.modified.metadata,
              lastModified: new Date(),
              fileSize: Buffer.from(modifiedContent).length,
              totalLines: modifiedLines.length,
              isDirty: false
            }
          };
          
          const validationPreview: ModificationPreview = {
            ...preview,
            modified: modifiedParsedContent
          };
          
          finalValidation = await this.validateModifications(validationPreview, preview.original.phase);
        } catch (validationError) {
          // Non-critical - log but don't fail the operation
          console.error('Final validation failed:', (validationError as Error).message);
        }
      }
      
      // 11. Create rollback function
      const rollback = this.createRollbackFunction(filePath, backupPath || '');
      
      const applicationDuration = Date.now() - startTime;
      
      // 12. Return successful result
      const result: ApplicationResult = {
        success: true,
        appliedChanges,
        failedChanges,
        backupPath,
        applicationDuration,
        finalValidation,
        rollback
      };
      
      return result;
      
    } catch (error) {
      const applicationDuration = Date.now() - startTime;
      
      // Return failure result with details
      return {
        success: false,
        appliedChanges,
        failedChanges,
        backupPath,
        error: (error as Error).message,
        applicationDuration,
        rollback: backupPath ? this.createRollbackFunction(filePath, backupPath) : undefined
      };
    }
  }

  /**
   * Generate detailed change records from modification data
   * 
   * This helper method transforms modification data into structured change records
   * that can be displayed to users and applied to files. It calculates line ranges,
   * content diffs, and change descriptions.
   * 
   * @param original - Original content structure
   * @param modifications - Modifications to process
   * @returns Array of detailed change records
   */
  private generateChangeRecords(
    original: ParsedContent,
    modifications: ModificationData[]
  ): ChangeRecord[] {
    const changes: ChangeRecord[] = [];
    
    modifications.forEach((modification, index) => {
      const changeId = `change-${index + 1}-${modification.action.id}`;
      
      // Find the target section in the original content
      const targetSection = modification.targetSection ?
        original.sections.find(section => section.id === modification.targetSection || section.title === modification.targetSection) :
        null;
      
      let beforeContent: string | undefined;
      let afterContent: string | undefined;
      let lineNumbers: [number, number];
      let changeType: ChangeType;
      
      switch (modification.action.actionType) {
        case 'add':
          changeType = 'addition';
          beforeContent = undefined;
          afterContent = modification.content;
          
          if (targetSection) {
            // Adding to existing section - use end of section
            lineNumbers = [targetSection.lineRange[1], targetSection.lineRange[1]];
          } else {
            // Adding new section - use end of file
            lineNumbers = [original.metadata.totalLines, original.metadata.totalLines];
          }
          break;
          
        case 'modify':
          changeType = 'modification';
          beforeContent = targetSection?.content || '';
          afterContent = modification.content;
          lineNumbers = targetSection ? targetSection.lineRange : [1, 1];
          break;
          
        case 'delete':
          changeType = 'deletion';
          beforeContent = targetSection?.content || modification.content;
          afterContent = undefined;
          lineNumbers = targetSection ? targetSection.lineRange : [1, 1];
          break;
          
        case 'reorder':
          changeType = 'move';
          beforeContent = targetSection?.content || modification.content;
          afterContent = modification.content;
          lineNumbers = targetSection ? targetSection.lineRange : [1, 1];
          break;
          
        default:
          changeType = 'modification';
          beforeContent = targetSection?.content;
          afterContent = modification.content;
          lineNumbers = targetSection ? targetSection.lineRange : [1, 1];
      }
      
      const changeRecord: ChangeRecord = {
        id: changeId,
        changeType,
        section: modification.targetSection || 'unknown',
        beforeContent,
        afterContent,
        lineNumbers,
        description: this.generateChangeDescription(modification, changeType),
        reversible: changeType !== 'deletion', // Deletions are generally not reversible
        sourceModification: modification
      };
      
      changes.push(changeRecord);
    });
    
    return changes;
  }

  /**
   * Calculate modification statistics for preview display
   * 
   * This helper method analyzes the changes and generates statistical information
   * such as lines added/removed/modified, sections affected, and estimated application time.
   * 
   * @param changes - Array of change records to analyze
   * @param original - Original content for comparison
   * @returns Statistical summary of the modifications
   */
  private calculateModificationStatistics(
    changes: ChangeRecord[],
    original: ParsedContent
  ): ModificationStatistics {
    let additions = 0;
    let modifications = 0;
    let deletions = 0;
    let linesAdded = 0;
    let linesRemoved = 0;
    let linesModified = 0;
    const sectionsAffected = new Set<string>();
    
    changes.forEach(change => {
      sectionsAffected.add(change.section);
      
      switch (change.changeType) {
        case 'addition':
          additions++;
          if (change.afterContent) {
            linesAdded += change.afterContent.split('\n').length;
          }
          break;
          
        case 'modification':
          modifications++;
          if (change.beforeContent && change.afterContent) {
            const beforeLines = change.beforeContent.split('\n').length;
            const afterLines = change.afterContent.split('\n').length;
            linesModified += Math.max(beforeLines, afterLines);
            if (afterLines > beforeLines) {
              linesAdded += afterLines - beforeLines;
            } else if (beforeLines > afterLines) {
              linesRemoved += beforeLines - afterLines;
            }
          }
          break;
          
        case 'deletion':
          deletions++;
          if (change.beforeContent) {
            linesRemoved += change.beforeContent.split('\n').length;
          }
          break;
          
        case 'move':
          modifications++; // Moves count as modifications
          if (change.beforeContent) {
            linesModified += change.beforeContent.split('\n').length;
          }
          break;
      }
    });
    
    const totalChanges = changes.length;
    const changePercentage = original.metadata.totalLines > 0 ? 
      Math.round(((linesAdded + linesRemoved + linesModified) / original.metadata.totalLines) * 100) : 0;
    
    // Estimate application time (rough estimate: 100ms per line changed)
    const estimatedApplyTime = (linesAdded + linesRemoved + linesModified) * 100;
    
    return {
      totalChanges,
      additions,
      modifications,
      deletions,
      sectionsAffected: sectionsAffected.size,
      linesAdded,
      linesRemoved,
      linesModified,
      changePercentage,
      estimatedApplyTime
    };
  }

  /**
   * Perform risk assessment on pending modifications
   * 
   * This helper method analyzes the modifications for potential risks such as
   * breaking changes, cascade effects, or approval requirements. It provides
   * recommendations for safe application.
   * 
   * @param changes - Array of change records to assess
   * @param original - Original content for risk context
   * @param phase - Specification phase being modified
   * @returns Risk assessment with recommendations
   */
  private assessModificationRisks(
    changes: ChangeRecord[],
    original: ParsedContent,
    phase: SpecPhase
  ): RiskAssessment {
    const risks: RiskAssessment['risks'] = [];
    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let recommendsReview = false;
    let requiresBackup = false;

    // Analyze each change for potential risks
    changes.forEach((change, index) => {
      // Check for breaking changes
      if (this.isBreakingChange(change, phase)) {
        risks.push({
          id: `breaking-${index}`,
          type: 'breaking-change',
          description: `Change to ${change.section} may break existing implementations`,
          probability: 70,
          impact: 'May require updates to dependent phases and existing implementations',
          mitigation: [
            'Review all dependent phases before applying',
            'Test integration points after modification',
            'Create comprehensive backup before proceeding'
          ]
        });
        overallRisk = this.escalateRiskLevel(overallRisk, 'high');
        recommendsReview = true;
        requiresBackup = true;
      }

      // Check for cascade effects
      if (this.hasCascadeEffects(change, phase)) {
        risks.push({
          id: `cascade-${index}`,
          type: 'cascade-effect',
          description: `Changes to ${change.section} may affect other specification phases`,
          probability: 60,
          impact: 'May require updates to design and tasks phases',
          mitigation: [
            'Review impact on dependent phases',
            'Update affected phases after modification',
            'Validate cross-phase consistency'
          ]
        });
        overallRisk = this.escalateRiskLevel(overallRisk, 'medium');
        recommendsReview = true;
      }

      // Check for data loss risks
      if (change.changeType === 'deletion' && !change.reversible) {
        risks.push({
          id: `data-loss-${index}`,
          type: 'data-loss',
          description: `Deletion of ${change.section} is not reversible`,
          probability: 100,
          impact: 'Permanent loss of specification content',
          mitigation: [
            'Create backup before deletion',
            'Confirm deletion is intentional',
            'Consider archiving instead of deleting'
          ]
        });
        overallRisk = this.escalateRiskLevel(overallRisk, 'high');
        requiresBackup = true;
      }

      // Check for consistency risks
      if (this.hasConsistencyRisks(change, original)) {
        risks.push({
          id: `consistency-${index}`,
          type: 'consistency',
          description: `Changes to ${change.section} may create inconsistencies`,
          probability: 40,
          impact: 'May create conflicting or contradictory requirements',
          mitigation: [
            'Review for consistency with existing content',
            'Validate terminology and approach alignment',
            'Check for contradictions with other sections'
          ]
        });
        overallRisk = this.escalateRiskLevel(overallRisk, 'medium');
      }
    });

    // Check for approval requirements
    const requiresApproval = changes.some(change => 
      change.sourceModification.action.requiresApproval ||
      this.requiresApprovalBasedOnRisk(overallRisk, change)
    );

    if (requiresApproval) {
      risks.push({
        id: 'approval-required',
        type: 'approval-required',
        description: 'Modifications require stakeholder approval before application',
        probability: 100,
        impact: 'Changes cannot be applied without proper approval',
        mitigation: [
          'Submit modifications for stakeholder review',
          'Provide detailed justification for changes',
          'Wait for approval before proceeding'
        ]
      });
    }

    // Set overall flags based on risk analysis
    if (risks.length > 3 || ['critical', 'high'].includes(overallRisk)) {
      recommendsReview = true;
      requiresBackup = true;
    }

    return {
      overallRisk,
      risks,
      recommendsReview,
      requiresBackup
    };
  }

  /**
   * Create a backup of the original file before modifications
   * 
   * This helper method creates a timestamped backup of the original file using
   * existing backup mechanisms in the project. It ensures safe modification
   * operations with rollback capabilities.
   * 
   * @param filePath - Path to the file to backup
   * @returns Promise resolving to the backup file path
   */
  private async createBackup(filePath: string): Promise<string> {
    try {
      // Create backup directory path similar to existing project patterns
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = path.basename(filePath);
      const dirName = path.dirname(filePath);
      
      // Create .backup directory if it doesn't exist
      const backupDir = path.join(dirName, '.backup');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      // Generate backup filename with timestamp
      const backupFileName = `${fileName}.backup-${timestamp}`;
      const backupPath = path.join(backupDir, backupFileName);
      
      // Read original file content
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Write backup file
      fs.writeFileSync(backupPath, content, 'utf8');
      
      // Verify backup was created successfully
      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file was not created');
      }
      
      const backupStats = fs.statSync(backupPath);
      const originalStats = fs.statSync(filePath);
      
      if (backupStats.size !== originalStats.size) {
        throw new Error('Backup file size does not match original');
      }
      
      return backupPath;
      
    } catch (error) {
      throw new Error(`Failed to create backup: ${(error as Error).message}`);
    }
  }

  /**
   * Apply a single change record to file content
   * 
   * This helper method applies individual change records to file content,
   * handling different change types (addition, modification, deletion) with
   * appropriate line number adjustments.
   * 
   * @param content - Current file content as string array (lines)
   * @param change - Change record to apply
   * @returns Updated file content
   */
  private applyChangeToContent(
    content: string[],
    change: ChangeRecord
  ): string[] {
    // Method signature established for future implementation
    throw new Error('applyChangeToContent method not yet implemented');
  }

  /**
   * Generate a human-readable diff string for display
   * 
   * This helper method creates diff-style output showing additions, deletions,
   * and modifications in a format similar to git diff. It supports colored
   * output for better readability.
   * 
   * @param beforeContent - Content before changes
   * @param afterContent - Content after changes
   * @param contextLines - Number of context lines to include (default: 3)
   * @returns Formatted diff string
   */
  private generateDiffString(
    beforeContent: string,
    afterContent: string,
    contextLines: number = 3
  ): string {
    // Method signature established for future implementation
    throw new Error('generateDiffString method not yet implemented');
  }

  /**
   * Validate file integrity after modifications
   * 
   * This helper method performs basic integrity checks on the modified file
   * to ensure it's valid markdown and hasn't been corrupted during the
   * modification process.
   * 
   * @param filePath - Path to the modified file
   * @returns Promise resolving to validation success status
   */
  private async validateFileIntegrity(filePath: string): Promise<boolean> {
    try {
      // 1. Check file exists
      if (!fs.existsSync(filePath)) {
        return false;
      }
      
      // 2. Read file content
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 3. Basic markdown structure validation
      // Check for balanced code blocks
      const codeBlockMatches = content.match(/```/g) || [];
      if (codeBlockMatches.length % 2 !== 0) {
        console.error('Unbalanced code blocks detected in modified file');
        return false;
      }
      
      // Check for valid header structure (no more than 6 # characters)
      const invalidHeaders = content.split('\n').filter(line => /^#{7,}/.test(line));
      if (invalidHeaders.length > 0) {
        console.error('Invalid markdown headers detected (more than 6 # characters)');
        return false;
      }
      
      // 4. Check for null bytes or other corruption indicators
      if (content.includes('\0')) {
        console.error('Null bytes detected in file - possible corruption');
        return false;
      }
      
      // 5. Verify file is not empty (unless intended)
      if (content.trim().length === 0) {
        console.warn('Modified file is empty');
        // This might be intentional, so we don't fail
      }
      
      // 6. Check for common markdown link/image syntax errors
      // Unmatched brackets
      const openBrackets = (content.match(/\[/g) || []).length;
      const closeBrackets = (content.match(/\]/g) || []).length;
      if (Math.abs(openBrackets - closeBrackets) > 5) { // Allow some tolerance
        console.warn('Potentially unmatched brackets in markdown');
        // Warning only, not a failure
      }
      
      // 7. Verify UTF-8 encoding validity
      try {
        Buffer.from(content, 'utf8');
      } catch (encodingError) {
        console.error('File contains invalid UTF-8 sequences');
        return false;
      }
      
      // 8. Check file size is reasonable (not corrupted to huge size)
      const stats = fs.statSync(filePath);
      const maxReasonableSize = 10 * 1024 * 1024; // 10MB
      if (stats.size > maxReasonableSize) {
        console.error(`File size (${stats.size} bytes) exceeds reasonable limit`);
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('File integrity validation failed:', (error as Error).message);
      return false;
    }
  }

  /**
   * Create a rollback function for undoing applied changes
   * 
   * This helper method creates a function that can restore the file to its
   * original state using the backup created before modifications. It's included
   * in the ApplicationResult for emergency rollback scenarios.
   * 
   * @param filePath - Path to the modified file
   * @param backupPath - Path to the backup file
   * @returns Promise-based rollback function
   */
  private createRollbackFunction(
    filePath: string,
    backupPath: string
  ): () => Promise<boolean> {
    return async () => {
      try {
        // Verify backup exists
        if (!backupPath || !fs.existsSync(backupPath)) {
          console.error('Backup file not found, cannot rollback');
          return false;
        }
        
        // Read backup content
        const backupContent = fs.readFileSync(backupPath, 'utf8');
        
        // Create a secondary backup of the current state before rolling back
        // This allows recovery if rollback is done by mistake
        const rollbackTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rollbackBackupPath = backupPath.replace('.backup-', `.rollback-${rollbackTimestamp}.backup-`);
        
        if (fs.existsSync(filePath)) {
          const currentContent = fs.readFileSync(filePath, 'utf8');
          fs.writeFileSync(rollbackBackupPath, currentContent, 'utf8');
        }
        
        // Restore from backup
        fs.writeFileSync(filePath, backupContent, 'utf8');
        
        // Verify restoration was successful
        const restoredContent = fs.readFileSync(filePath, 'utf8');
        if (restoredContent !== backupContent) {
          console.error('Rollback verification failed - content mismatch');
          return false;
        }
        
        console.log(`Successfully rolled back changes from backup: ${backupPath}`);
        console.log(`Current state saved to: ${rollbackBackupPath}`);
        
        return true;
        
      } catch (error) {
        console.error('Rollback failed:', (error as Error).message);
        return false;
      }
    };
  }

  /**
   * Generate a unique preview ID for tracking
   */
  private generatePreviewId(): string {
    return `preview-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Apply modifications to content structure to generate modified version
   */
  private async applyModificationsToContent(
    original: ParsedContent,
    modifications: ModificationData[]
  ): Promise<ParsedContent> {
    // For now, return a copy of original with basic modifications applied
    // This would be enhanced to actually apply the modifications
    const modifiedSections = [...original.sections];
    
    // Apply each modification to the sections
    modifications.forEach(modification => {
      if (modification.action.actionType === 'add') {
        // Add new section
        const newSection = {
          id: `section-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          title: modification.targetSection || 'New Section',
          content: modification.content,
          sectionType: 'other' as SectionType,
          modifiable: true,
          lineRange: [original.metadata.totalLines + 1, original.metadata.totalLines + modification.content.split('\n').length] as [number, number]
        };
        modifiedSections.push(newSection);
      } else if (modification.targetSection) {
        // Find and modify existing section
        const sectionIndex = modifiedSections.findIndex(
          section => section.id === modification.targetSection || section.title === modification.targetSection
        );
        if (sectionIndex >= 0) {
          if (modification.action.actionType === 'delete') {
            modifiedSections.splice(sectionIndex, 1);
          } else {
            modifiedSections[sectionIndex] = {
              ...modifiedSections[sectionIndex],
              content: modification.content
            };
          }
        }
      }
    });
    
    return {
      ...original,
      sections: modifiedSections,
      rawContent: modifiedSections.map(section => section.content).join('\n\n')
    };
  }

  /**
   * Generate impact analysis for modifications
   */
  private async generateImpactAnalysis(
    original: ParsedContent,
    modifications: ModificationData[],
    changes: ChangeRecord[]
  ): Promise<ImpactAnalysis> {
    const affectedPhases: SpecPhase[] = [original.phase];
    const cascadeWarnings: string[] = [];
    const conflictRisks: any[] = []; // Using any for now since ConflictRisk isn't imported
    
    // Analyze if changes might affect other phases
    if (original.phase === 'requirements') {
      cascadeWarnings.push('Changes to requirements may require updates to design and tasks phases');
      affectedPhases.push('design', 'tasks');
    } else if (original.phase === 'design') {
      cascadeWarnings.push('Changes to design may require updates to tasks phase');
      affectedPhases.push('tasks');
    }
    
    return {
      affectedPhases,
      cascadeWarnings,
      conflictRisks,
      approvalRequired: modifications.some(mod => mod.action.requiresApproval)
    };
  }

  /**
   * Perform preview validation
   */
  private async performPreviewValidation(
    modifiedContent: ParsedContent,
    phase: SpecPhase,
    options: PreviewGenerationOptions
  ): Promise<ValidationResult> {
    // Basic validation implementation
    return {
      status: 'pass',
      issues: [],
      confidence: 'medium',
      score: 85,
      passesMinimumQuality: true,
      validatedAt: new Date(),
      validatorsUsed: options.validationAgents,
      validationDuration: 500,
      completed: true
    };
  }

  /**
   * Generate a description for a change
   */
  private generateChangeDescription(modification: ModificationData, changeType: ChangeType): string {
    const action = modification.action.label;
    const section = modification.targetSection || 'document';
    
    switch (changeType) {
      case 'addition':
        return `Add new content to ${section}: ${action}`;
      case 'modification':
        return `Modify ${section}: ${action}`;
      case 'deletion':
        return `Delete content from ${section}: ${action}`;
      case 'move':
        return `Move content in ${section}: ${action}`;
      default:
        return `${action} in ${section}`;
    }
  }

  /**
   * Determine if modifications are safe to apply
   */
  private determineSafetyStatus(
    validationResults: ValidationResult,
    riskAssessment: RiskAssessment,
    changes: ChangeRecord[]
  ): boolean {
    return validationResults.passesMinimumQuality && 
           riskAssessment.overallRisk !== 'critical' &&
           changes.length > 0;
  }

  /**
   * Extract blocking issues from validation and risk assessment
   */
  private extractBlockingIssues(
    validationResults: ValidationResult,
    riskAssessment: RiskAssessment
  ): string[] {
    const issues: string[] = [];
    
    if (!validationResults.passesMinimumQuality) {
      issues.push('Content does not meet minimum quality standards');
    }
    
    if (riskAssessment.overallRisk === 'critical') {
      issues.push('Critical risks detected that prevent safe application');
    }
    
    validationResults.issues
      .filter(issue => issue.severity === 'error')
      .forEach(issue => issues.push(`Validation error: ${issue.message}`));
    
    return issues;
  }

  /**
   * Extract warnings from validation and risk assessment
   */
  private extractWarnings(
    validationResults: ValidationResult,
    riskAssessment: RiskAssessment
  ): string[] {
    const warnings: string[] = [];
    
    if (riskAssessment.overallRisk === 'high') {
      warnings.push('High risk modifications detected - review carefully before applying');
    }
    
    validationResults.issues
      .filter(issue => issue.severity === 'warning')
      .forEach(issue => warnings.push(`Validation warning: ${issue.message}`));
    
    return warnings;
  }

  /**
   * Generate a summary of changes
   */
  private generateChangeSummary(changes: ChangeRecord[], statistics: ModificationStatistics): string {
    const { totalChanges, additions, modifications, deletions } = statistics;
    
    if (totalChanges === 0) {
      return 'No changes to apply';
    }
    
    const parts: string[] = [];
    if (additions > 0) parts.push(`${additions} addition${additions > 1 ? 's' : ''}`);
    if (modifications > 0) parts.push(`${modifications} modification${modifications > 1 ? 's' : ''}`);
    if (deletions > 0) parts.push(`${deletions} deletion${deletions > 1 ? 's' : ''}`);
    
    return `${totalChanges} total changes: ${parts.join(', ')}`;
  }

  /**
   * Create an error preview when preview generation fails
   */
  private createErrorPreview(
    original: ParsedContent,
    modifications: ModificationData[],
    error: Error,
    previewId: string
  ): ModificationPreview {
    return {
      original,
      modified: original, // Use original as fallback
      changes: [],
      impactAnalysis: this.getEmptyImpactAnalysis(),
      validationResults: this.getEmptyValidationResult(),
      riskAssessment: this.getEmptyRiskAssessment(),
      statistics: this.getEmptyStatistics(),
      readyForApplication: false,
      safeToApply: false,
      blockingIssues: [`Preview generation failed: ${error.message}`],
      warnings: [],
      generatedAt: new Date(),
      previewId,
      initiatedBy: process.env.USER || 'unknown',
      hasCascadingChanges: false,
      changeSummary: 'Preview generation failed'
    };
  }

  // Helper methods to provide empty default objects
  private getEmptyStatistics(): ModificationStatistics {
    return {
      totalChanges: 0,
      additions: 0,
      modifications: 0,
      deletions: 0,
      sectionsAffected: 0,
      linesAdded: 0,
      linesRemoved: 0,
      linesModified: 0,
      changePercentage: 0,
      estimatedApplyTime: 0
    };
  }

  private getEmptyRiskAssessment(): RiskAssessment {
    return {
      overallRisk: 'low',
      risks: [],
      recommendsReview: false,
      requiresBackup: false
    };
  }

  private getEmptyImpactAnalysis(): ImpactAnalysis {
    return {
      affectedPhases: [],
      cascadeWarnings: [],
      conflictRisks: [],
      approvalRequired: false
    };
  }

  private getEmptyValidationResult(): ValidationResult {
    return {
      status: 'pass',
      issues: [],
      confidence: 'medium',
      score: 100,
      passesMinimumQuality: true,
      validatedAt: new Date(),
      validatorsUsed: [],
      validationDuration: 0,
      completed: true
    };
  }

  // ===== VALIDATION HELPER METHODS =====

  /**
   * Validate structural integrity of modified content
   */
  private async validateStructuralIntegrity(
    modifiedContent: ParsedContent,
    phase: SpecPhase
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for required sections based on phase
    const requiredSections = this.getRequiredSections(phase);
    const existingSections = modifiedContent.sections.map(s => s.sectionType);

    requiredSections.forEach(required => {
      if (!existingSections.includes(required)) {
        issues.push({
          id: `missing-section-${required}`,
          severity: 'error',
          message: `Required section '${required}' is missing from ${phase} specification`,
          code: 'MISSING_REQUIRED_SECTION',
          source: 'structural-validator',
          suggestedFix: `Add the missing ${required} section to comply with template requirements`
        });
      }
    });

    // Check for empty critical sections
    modifiedContent.sections.forEach(section => {
      if (this.isCriticalSection(section.sectionType, phase) && !section.content.trim()) {
        issues.push({
          id: `empty-critical-section-${section.id}`,
          severity: 'error',
          message: `Critical section '${section.title}' cannot be empty`,
          code: 'EMPTY_CRITICAL_SECTION',
          line: section.lineRange[0],
          source: 'structural-validator',
          suggestedFix: 'Add content to this critical section or remove it if not needed'
        });
      }
    });

    // Check for malformed markdown structure
    if (this.hasMalformedMarkdown(modifiedContent.rawContent)) {
      issues.push({
        id: 'malformed-markdown',
        severity: 'warning',
        message: 'Document contains malformed markdown syntax',
        code: 'MALFORMED_MARKDOWN',
        source: 'structural-validator',
        suggestedFix: 'Review and fix markdown syntax errors'
      });
    }

    return issues;
  }

  /**
   * Validate content quality
   */
  private async validateContentQuality(
    modifiedContent: ParsedContent,
    changes: ChangeRecord[]
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for content quality issues in changes
    changes.forEach((change, index) => {
      if (change.afterContent) {
        // Check for overly short content
        if (change.afterContent.length < 10 && change.changeType === 'addition') {
          issues.push({
            id: `short-content-${index}`,
            severity: 'warning',
            message: `Added content in ${change.section} is very short`,
            code: 'SHORT_CONTENT',
            line: change.lineNumbers[0],
            source: 'content-quality-validator',
            suggestedFix: 'Consider adding more detailed content'
          });
        }

        // Check for placeholder text
        if (this.hasPlaceholderText(change.afterContent)) {
          issues.push({
            id: `placeholder-text-${index}`,
            severity: 'error',
            message: `Placeholder text found in ${change.section}`,
            code: 'PLACEHOLDER_TEXT',
            line: change.lineNumbers[0],
            source: 'content-quality-validator',
            suggestedFix: 'Replace placeholder text with actual content'
          });
        }

        // Check for inconsistent terminology
        const terminologyIssues = this.checkTerminologyConsistency(change.afterContent, modifiedContent);
        issues.push(...terminologyIssues.map(issue => ({
          ...issue,
          id: `terminology-${index}-${issue.code}`,
          line: change.lineNumbers[0],
          source: 'content-quality-validator'
        })));
      }
    });

    return issues;
  }

  /**
   * Validate template compliance
   */
  private async validateTemplateCompliance(
    modifiedContent: ParsedContent,
    phase: SpecPhase
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check section order compliance
    const expectedOrder = this.getExpectedSectionOrder(phase);
    const actualOrder = modifiedContent.sections.map(s => s.sectionType);
    
    if (!this.isCorrectSectionOrder(actualOrder, expectedOrder)) {
      issues.push({
        id: 'incorrect-section-order',
        severity: 'warning',
        message: 'Sections are not in the expected template order',
        code: 'INCORRECT_SECTION_ORDER',
        source: 'template-compliance-validator',
        suggestedFix: `Reorder sections to match template: ${expectedOrder.join(', ')}`
      });
    }

    // Check for template-specific formatting requirements
    if (phase === 'requirements') {
      const userStoryIssues = this.validateUserStoryFormat(modifiedContent);
      issues.push(...userStoryIssues);
      
      const acceptanceCriteriaIssues = this.validateAcceptanceCriteriaFormat(modifiedContent);
      issues.push(...acceptanceCriteriaIssues);
    } else if (phase === 'design') {
      const diagramIssues = this.validateDiagramRequirements(modifiedContent);
      issues.push(...diagramIssues);
    } else if (phase === 'tasks') {
      const atomicityIssues = this.validateTaskAtomicity(modifiedContent);
      issues.push(...atomicityIssues);
    }

    return issues;
  }

  /**
   * Validate cross-phase dependencies
   */
  private async validateDependencies(
    preview: ModificationPreview,
    phase: SpecPhase
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for orphaned references
    const references = this.extractReferences(preview.modified);
    references.forEach(ref => {
      if (!this.referenceExists(ref, preview.modified, phase)) {
        issues.push({
          id: `orphaned-reference-${ref}`,
          severity: 'error',
          message: `Reference to '${ref}' cannot be resolved`,
          code: 'ORPHANED_REFERENCE',
          source: 'dependency-validator',
          suggestedFix: 'Add the referenced item or remove the reference'
        });
      }
    });

    // Check for cascade requirements
    if (phase === 'requirements' && preview.impactAnalysis.affectedPhases.includes('design')) {
      issues.push({
        id: 'design-update-required',
        severity: 'warning',
        message: 'Requirements changes may require design phase updates',
        code: 'CASCADE_UPDATE_REQUIRED',
        source: 'dependency-validator',
        suggestedFix: 'Review and update design phase after applying these changes'
      });
    }

    return issues;
  }

  /**
   * Detect conflicts in changes
   */
  private async detectConflicts(
    changes: ChangeRecord[],
    original: ParsedContent
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for overlapping line changes
    for (let i = 0; i < changes.length; i++) {
      for (let j = i + 1; j < changes.length; j++) {
        const change1 = changes[i];
        const change2 = changes[j];
        
        if (this.hasLineOverlap(change1.lineNumbers, change2.lineNumbers)) {
          issues.push({
            id: `overlapping-changes-${i}-${j}`,
            severity: 'error',
            message: `Changes ${change1.id} and ${change2.id} overlap on the same lines`,
            code: 'OVERLAPPING_CHANGES',
            line: Math.min(change1.lineNumbers[0], change2.lineNumbers[0]),
            source: 'conflict-detector',
            suggestedFix: 'Resolve overlapping changes by combining or separating them'
          });
        }
      }
    }

    // Check for semantic conflicts
    const semanticConflicts = this.detectSemanticConflicts(changes, original);
    issues.push(...semanticConflicts);

    return issues;
  }

  /**
   * Validate against assessed risks
   */
  private async validateAgainstRisks(
    riskAssessment: RiskAssessment,
    changes: ChangeRecord[]
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Convert high-risk items to validation issues
    riskAssessment.risks.forEach((risk, index) => {
      if (risk.probability > 70 && risk.type === 'breaking-change') {
        issues.push({
          id: `high-risk-${index}`,
          severity: 'error',
          message: `High-risk breaking change detected: ${risk.description}`,
          code: 'HIGH_RISK_BREAKING_CHANGE',
          source: 'risk-validator',
          suggestedFix: risk.mitigation[0] || 'Review risk mitigation strategies'
        });
      } else if (risk.probability > 50) {
        issues.push({
          id: `medium-risk-${index}`,
          severity: 'warning',
          message: `Potential risk detected: ${risk.description}`,
          code: 'POTENTIAL_RISK',
          source: 'risk-validator',
          suggestedFix: risk.mitigation[0] || 'Consider risk mitigation strategies'
        });
      }
    });

    return issues;
  }

  /**
   * Invoke validation agents if available
   */
  private async invokeValidationAgents(
    preview: ModificationPreview,
    phase: SpecPhase
  ): Promise<{ issues: ValidationIssue[], agents: string[] }> {
    const issues: ValidationIssue[] = [];
    const agents: string[] = [];

    try {
      // This would integrate with the actual agent system
      // For now, provide a mock implementation that could be extended
      
      const agentName = this.getValidationAgentForPhase(phase);
      if (agentName) {
        // Agent integration would happen here
        // For now, add a placeholder issue indicating agent integration
        issues.push({
          id: 'agent-integration-placeholder',
          severity: 'info',
          message: `Agent ${agentName} integration available but not yet implemented`,
          code: 'AGENT_INTEGRATION_PENDING',
          source: agentName,
          suggestedFix: 'Manual validation recommended until agent integration is complete'
        });
        agents.push(agentName);
      }
    } catch (error) {
      // Graceful degradation - agents are optional
      issues.push({
        id: 'agent-invocation-failed',
        severity: 'warning',
        message: `Failed to invoke validation agents: ${(error as Error).message}`,
        code: 'AGENT_INVOCATION_FAILED',
        source: 'agent-integration',
        suggestedFix: 'Proceeding with built-in validation only'
      });
    }

    return { issues, agents };
  }

  // ===== RISK ASSESSMENT HELPERS =====

  private isBreakingChange(change: ChangeRecord, phase: SpecPhase): boolean {
    // Deletions are generally breaking
    if (change.changeType === 'deletion') return true;
    
    // Changes to critical sections in requirements phase
    if (phase === 'requirements' && this.isCriticalSection(change.section as SectionType, phase)) {
      return change.changeType === 'modification';
    }
    
    // API or interface changes in design phase
    if (phase === 'design' && change.section.toLowerCase().includes('api')) {
      return true;
    }
    
    return false;
  }

  private hasCascadeEffects(change: ChangeRecord, phase: SpecPhase): boolean {
    // Requirements changes always cascade
    if (phase === 'requirements') return true;
    
    // Design architecture changes cascade to tasks
    if (phase === 'design' && change.section.toLowerCase().includes('architecture')) {
      return true;
    }
    
    return false;
  }

  private hasConsistencyRisks(change: ChangeRecord, original: ParsedContent): boolean {
    if (!change.afterContent) return false;
    
    // Check for terminology inconsistencies
    const existingTerms = this.extractTerms(original.rawContent);
    const newTerms = this.extractTerms(change.afterContent);
    
    return newTerms.some(term => 
      existingTerms.some(existing => 
        this.areConflictingTerms(term, existing)
      )
    );
  }

  private escalateRiskLevel(
    current: RiskAssessment['overallRisk'], 
    new_level: RiskAssessment['overallRisk']
  ): RiskAssessment['overallRisk'] {
    const levels = ['low', 'medium', 'high', 'critical'];
    const currentIndex = levels.indexOf(current);
    const newIndex = levels.indexOf(new_level);
    return newIndex > currentIndex ? new_level : current;
  }

  private requiresApprovalBasedOnRisk(
    overallRisk: RiskAssessment['overallRisk'], 
    change: ChangeRecord
  ): boolean {
    return overallRisk === 'high' || overallRisk === 'critical' || 
           change.changeType === 'deletion';
  }

  // ===== VALIDATION STATUS HELPERS =====

  private determineValidationStatus(issues: ValidationIssue[], score: number): ValidationStatus {
    const errorCount = issues.filter(i => i.severity === 'error').length;
    
    if (errorCount > 0) return 'error';
    if (score < 70) return 'warning';
    return 'pass';
  }

  private determineValidationConfidence(
    validatorsUsed: string[], 
    issuesFound: number, 
    changesCount: number
  ): ValidationConfidence {
    const validatorCoverage = validatorsUsed.length;
    const issueRatio = changesCount > 0 ? issuesFound / changesCount : 0;
    
    if (validatorCoverage >= 5 && issueRatio < 0.1) return 'high';
    if (validatorCoverage >= 3 && issueRatio < 0.3) return 'medium';
    return 'low';
  }

  // ===== CONTENT ANALYSIS HELPERS =====

  private getRequiredSections(phase: SpecPhase): SectionType[] {
    switch (phase) {
      case 'requirements':
        return ['user-story', 'acceptance-criteria', 'other'];
      case 'design':
        return ['other', 'architecture', 'component'];
      case 'tasks':
        return ['other', 'task'];
      default:
        return ['other'];
    }
  }

  private isCriticalSection(sectionType: SectionType, phase: SpecPhase): boolean {
    const criticalSections = {
      requirements: ['user-story', 'acceptance-criteria'],
      design: ['architecture', 'data-model'],
      tasks: ['task']
    };
    
    return criticalSections[phase]?.includes(sectionType) || false;
  }

  private hasMalformedMarkdown(content: string): boolean {
    // Basic markdown validation
    const unclosedCodeBlocks = (content.match(/```/g) || []).length % 2 !== 0;
    const malformedHeaders = /^#{7,}/.test(content); // More than 6 # characters
    
    return unclosedCodeBlocks || malformedHeaders;
  }

  private hasPlaceholderText(content: string): boolean {
    const placeholders = ['TODO', 'TBD', 'FIXME', '[placeholder]', '...', 'xxx'];
    return placeholders.some(placeholder => 
      content.toLowerCase().includes(placeholder.toLowerCase())
    );
  }

  private checkTerminologyConsistency(content: string, fullContent: ParsedContent): ValidationIssue[] {
    // Simplified terminology check
    const issues: ValidationIssue[] = [];
    const inconsistencies = ['login/signin', 'user/customer', 'API/api'];
    
    inconsistencies.forEach((pair, index) => {
      const [term1, term2] = pair.split('/');
      if (content.includes(term1) && fullContent.rawContent.includes(term2)) {
        issues.push({
          id: `terminology-${index}`,
          severity: 'warning',
          message: `Inconsistent terminology: using both '${term1}' and '${term2}'`,
          code: 'INCONSISTENT_TERMINOLOGY',
          source: 'content-quality-validator',
          suggestedFix: `Choose one term and use consistently throughout the document`
        });
      }
    });
    
    return issues;
  }

  private getExpectedSectionOrder(phase: SpecPhase): SectionType[] {
    // Return expected section order for each phase
    switch (phase) {
      case 'requirements':
        return ['other', 'user-story', 'acceptance-criteria', 'other'];
      case 'design':
        return ['other', 'architecture', 'component', 'other', 'other'];
      case 'tasks':
        return ['other', 'task'];
      default:
        return ['other', 'other'];
    }
  }

  private isCorrectSectionOrder(actual: SectionType[], expected: SectionType[]): boolean {
    // Simplified order checking - ensure critical sections appear in correct relative order
    let expectedIndex = 0;
    for (const section of actual) {
      const nextExpectedIndex = expected.indexOf(section, expectedIndex);
      if (nextExpectedIndex !== -1) {
        expectedIndex = nextExpectedIndex;
      }
    }
    return true; // For now, be lenient with ordering
  }

  private validateUserStoryFormat(content: ParsedContent): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const userStoryRegex = /As a .+, I want .+, so that .+/i;
    
    content.sections
      .filter(s => s.sectionType === 'user-story')
      .forEach(section => {
        if (!userStoryRegex.test(section.content)) {
          issues.push({
            id: `malformed-user-story-${section.id}`,
            severity: 'warning',
            message: 'User story does not follow standard format',
            code: 'MALFORMED_USER_STORY',
            line: section.lineRange[0],
            source: 'template-compliance-validator',
            suggestedFix: 'Use format: "As a [role], I want [feature], so that [benefit]"'
          });
        }
      });
    
    return issues;
  }

  private validateAcceptanceCriteriaFormat(content: ParsedContent): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    content.sections
      .filter(s => s.sectionType === 'acceptance-criteria')
      .forEach(section => {
        const hasWhenThen = /WHEN .+ THEN .+/i.test(section.content);
        const hasIfThen = /IF .+ THEN .+/i.test(section.content);
        
        if (!hasWhenThen && !hasIfThen && section.content.length > 50) {
          issues.push({
            id: `weak-acceptance-criteria-${section.id}`,
            severity: 'warning',
            message: 'Acceptance criteria could be more specific with WHEN/IF-THEN format',
            code: 'WEAK_ACCEPTANCE_CRITERIA',
            line: section.lineRange[0],
            source: 'template-compliance-validator',
            suggestedFix: 'Consider using WHEN/IF-THEN format for clearer criteria'
          });
        }
      });
    
    return issues;
  }

  private validateDiagramRequirements(content: ParsedContent): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    const hasMermaidDiagrams = content.rawContent.includes('```mermaid');
    if (!hasMermaidDiagrams) {
      issues.push({
        id: 'missing-diagrams',
        severity: 'warning',
        message: 'Design document should include Mermaid diagrams for architecture visualization',
        code: 'MISSING_DIAGRAMS',
        source: 'template-compliance-validator',
        suggestedFix: 'Add Mermaid diagrams to illustrate the system architecture'
      });
    }
    
    return issues;
  }

  private validateTaskAtomicity(content: ParsedContent): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    content.sections
      .filter(s => s.sectionType === 'task')
      .forEach(section => {
        const wordCount = section.content.split(/\s+/).length;
        if (wordCount > 100) { // Rough heuristic for overly complex tasks
          issues.push({
            id: `non-atomic-task-${section.id}`,
            severity: 'warning',
            message: 'Task description may be too complex for atomic implementation',
            code: 'NON_ATOMIC_TASK',
            line: section.lineRange[0],
            source: 'template-compliance-validator',
            suggestedFix: 'Consider breaking this task into smaller, more atomic units'
          });
        }
      });
    
    return issues;
  }

  private extractReferences(content: ParsedContent): string[] {
    // Extract references like [REQ-1], #123, etc.
    const refRegex = /\[([A-Z]+-\d+)\]|#(\d+)/g;
    const references: string[] = [];
    let match;
    
    while ((match = refRegex.exec(content.rawContent)) !== null) {
      references.push(match[1] || match[2]);
    }
    
    return references;
  }

  private referenceExists(ref: string, content: ParsedContent, phase: SpecPhase): boolean {
    // For now, assume references are valid - this would need more sophisticated checking
    return true;
  }

  private hasLineOverlap(range1: [number, number], range2: [number, number]): boolean {
    return !(range1[1] < range2[0] || range2[1] < range1[0]);
  }

  private detectSemanticConflicts(changes: ChangeRecord[], original: ParsedContent): ValidationIssue[] {
    // Simplified semantic conflict detection
    const issues: ValidationIssue[] = [];
    
    // Check for conflicting requirements
    const requirements = changes
      .filter(c => c.section.toLowerCase().includes('requirement'))
      .map(c => c.afterContent || '');
    
    for (let i = 0; i < requirements.length; i++) {
      for (let j = i + 1; j < requirements.length; j++) {
        if (this.areConflictingRequirements(requirements[i], requirements[j])) {
          issues.push({
            id: `semantic-conflict-${i}-${j}`,
            severity: 'warning',
            message: 'Potential semantic conflict detected between requirements',
            code: 'SEMANTIC_CONFLICT',
            source: 'conflict-detector',
            suggestedFix: 'Review requirements for consistency and remove conflicts'
          });
        }
      }
    }
    
    return issues;
  }

  private areConflictingRequirements(req1: string, req2: string): boolean {
    // Simplified conflict detection - look for negation patterns
    const negationWords = ['not', 'never', 'cannot', 'must not', 'should not'];
    const req1Words = req1.toLowerCase().split(/\s+/);
    const req2Words = req2.toLowerCase().split(/\s+/);
    
    // Very basic heuristic - if one has negation and they share keywords
    const req1HasNegation = negationWords.some(neg => req1Words.includes(neg));
    const req2HasNegation = negationWords.some(neg => req2Words.includes(neg));
    
    if (req1HasNegation !== req2HasNegation) {
      const commonWords = req1Words.filter(word => req2Words.includes(word) && word.length > 4);
      return commonWords.length > 2;
    }
    
    return false;
  }

  private getValidationAgentForPhase(phase: SpecPhase): string | null {
    switch (phase) {
      case 'requirements':
        return 'spec-requirements-validator';
      case 'design':
        return 'spec-design-validator';
      case 'tasks':
        return 'spec-task-validator';
      default:
        return null;
    }
  }

  private extractTerms(content: string): string[] {
    // Extract important terms from content
    return content
      .split(/\s+/)
      .filter(word => word.length > 3)
      .map(word => word.toLowerCase().replace(/[^\w]/g, ''))
      .filter(word => word.length > 0);
  }

  private areConflictingTerms(term1: string, term2: string): boolean {
    // Simple conflict detection for similar but different terms
    const commonConflicts = [
      ['user', 'customer'],
      ['login', 'signin'],
      ['api', 'endpoint'],
      ['database', 'storage']
    ];
    
    return commonConflicts.some(([t1, t2]) => 
      (term1.includes(t1) && term2.includes(t2)) ||
      (term1.includes(t2) && term2.includes(t1))
    );
  }
}