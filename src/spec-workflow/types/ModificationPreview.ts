/**
 * TypeScript interfaces for modification preview, change tracking, and validation
 * Used by the preview engine in interactive spec modify workflow
 */

import { SpecPhase, ParsedContent, ValidationStatus } from './ParsedContent';
import { ImpactAnalysis, ModificationData } from './ModificationMenu';

/**
 * Represents the type of change being made to content
 */
export type ChangeType = 'addition' | 'modification' | 'deletion' | 'move';

/**
 * Represents the confidence level in validation results
 */
export type ValidationConfidence = 'low' | 'medium' | 'high';

/**
 * Detailed record of a specific change within a modification preview
 */
export interface ChangeRecord {
  /** Unique identifier for this change */
  id: string;
  
  /** Type of change being made */
  changeType: ChangeType;
  
  /** Section or area where the change is being made */
  section: string;
  
  /** Content before the change (undefined for additions) */
  beforeContent?: string;
  
  /** Content after the change (undefined for deletions) */
  afterContent?: string;
  
  /** Line numbers affected by this change [startLine, endLine] (1-indexed) */
  lineNumbers: [number, number];
  
  /** Character position within the line for precise changes */
  characterRange?: [number, number];
  
  /** Human-readable description of the change */
  description: string;
  
  /** Whether this change is reversible */
  reversible: boolean;
  
  /** Related modification data that produced this change */
  sourceModification: ModificationData;
}

/**
 * Individual validation issue found during content validation
 */
export interface ValidationIssue {
  /** Unique identifier for the issue */
  id: string;
  
  /** Severity level of the issue */
  severity: 'error' | 'warning' | 'info';
  
  /** Human-readable description of the issue */
  message: string;
  
  /** Code or type identifier for the issue */
  code: string;
  
  /** Line number where the issue occurs (1-indexed) */
  line?: number;
  
  /** Column number where the issue occurs (1-indexed) */
  column?: number;
  
  /** Suggested fix or resolution for the issue */
  suggestedFix?: string;
  
  /** Name of the validator that detected this issue */
  source: string;
}

/**
 * Result of validation performed on modified content
 */
export interface ValidationResult {
  /** Overall validation status */
  status: ValidationStatus;
  
  /** Individual issues found during validation */
  issues: ValidationIssue[];
  
  /** Confidence level in the validation results */
  confidence: ValidationConfidence;
  
  /** Total score representing validation quality (0-100%) */
  score: number;
  
  /** Whether the content passes minimum quality thresholds */
  passesMinimumQuality: boolean;
  
  /** Validation timestamp */
  validatedAt: Date;
  
  /** Names of validators that were used */
  validatorsUsed: string[];
  
  /** Time taken to complete validation (in milliseconds) */
  validationDuration: number;
  
  /** Whether validation was completed successfully */
  completed: boolean;
  
  /** Error message if validation failed to complete */
  error?: string;
}

/**
 * Analysis of potential risks associated with the modifications
 */
export interface RiskAssessment {
  /** Overall risk level for the modifications */
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  
  /** Specific risks identified */
  risks: {
    /** Risk identifier */
    id: string;
    
    /** Type of risk */
    type: 'breaking-change' | 'cascade-effect' | 'approval-required' | 'data-loss' | 'consistency';
    
    /** Risk description */
    description: string;
    
    /** Probability of the risk occurring (0-100%) */
    probability: number;
    
    /** Potential impact if the risk occurs */
    impact: string;
    
    /** Suggested mitigation strategies */
    mitigation: string[];
  }[];
  
  /** Whether manual review is recommended before applying changes */
  recommendsReview: boolean;
  
  /** Whether automated backup should be created */
  requiresBackup: boolean;
}

/**
 * Statistical summary of the modifications being previewed
 */
export interface ModificationStatistics {
  /** Total number of changes */
  totalChanges: number;
  
  /** Number of additions */
  additions: number;
  
  /** Number of modifications */
  modifications: number;
  
  /** Number of deletions */
  deletions: number;
  
  /** Number of sections affected */
  sectionsAffected: number;
  
  /** Number of lines added */
  linesAdded: number;
  
  /** Number of lines removed */
  linesRemoved: number;
  
  /** Number of lines modified */
  linesModified: number;
  
  /** Percentage of the file that will be changed */
  changePercentage: number;
  
  /** Estimated time to apply all changes */
  estimatedApplyTime: number;
}

/**
 * Main interface representing a complete preview of modifications before they are applied
 */
export interface ModificationPreview {
  /** Original content before modifications */
  original: ParsedContent;
  
  /** Content after modifications are applied */
  modified: ParsedContent;
  
  /** Detailed record of all changes being made */
  changes: ChangeRecord[];
  
  /** Analysis of impact on other phases and components */
  impactAnalysis: ImpactAnalysis;
  
  /** Validation results for the modified content */
  validationResults: ValidationResult;
  
  /** Risk assessment for the modifications */
  riskAssessment: RiskAssessment;
  
  /** Statistical summary of the changes */
  statistics: ModificationStatistics;
  
  /** Whether the preview is ready for user confirmation */
  readyForApplication: boolean;
  
  /** Whether the changes can be safely applied */
  safeToApply: boolean;
  
  /** Any blocking issues that prevent application */
  blockingIssues: string[];
  
  /** Warnings that should be presented to the user */
  warnings: string[];
  
  /** Preview generation timestamp */
  generatedAt: Date;
  
  /** Unique identifier for this preview session */
  previewId: string;
  
  /** User who initiated the modifications */
  initiatedBy: string;
  
  /** Whether this preview includes cascading changes */
  hasCascadingChanges: boolean;
  
  /** Summary of what will be accomplished by these changes */
  changeSummary: string;
}

/**
 * Configuration options for preview generation
 */
export interface PreviewGenerationOptions {
  /** Whether to include detailed diff information */
  includeDetailedDiff: boolean;
  
  /** Whether to perform full validation */
  performValidation: boolean;
  
  /** Whether to analyze impact on other phases */
  analyzeImpact: boolean;
  
  /** Whether to assess risks */
  assessRisks: boolean;
  
  /** Maximum time to spend on preview generation (milliseconds) */
  timeoutMs: number;
  
  /** Whether to generate statistics */
  generateStatistics: boolean;
  
  /** Validation agents to use for quality assessment */
  validationAgents: string[];
  
  /** Whether to create backup before modifications */
  createBackup: boolean;
}

/**
 * Result of applying modifications from a preview
 */
export interface ApplicationResult {
  /** Whether the application was successful */
  success: boolean;
  
  /** Changes that were successfully applied */
  appliedChanges: ChangeRecord[];
  
  /** Changes that failed to apply */
  failedChanges: ChangeRecord[];
  
  /** Path to backup file created before modifications */
  backupPath?: string;
  
  /** Error message if application failed */
  error?: string;
  
  /** Time taken to apply changes (milliseconds) */
  applicationDuration: number;
  
  /** Final validation results after application */
  finalValidation?: ValidationResult;
  
  /** Rollback function to undo the changes if needed */
  rollback?: () => Promise<boolean>;
}