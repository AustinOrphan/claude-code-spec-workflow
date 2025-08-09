/**
 * TypeScript interfaces for modification menu system and suggestions
 * Used by interactive spec modify workflow for menu generation and user interaction
 */

import { SpecPhase } from './ParsedContent';

/**
 * Represents the type of modification action that can be performed
 */
export type ActionType = 'add' | 'modify' | 'delete' | 'reorder';

/**
 * Represents the severity level of a conflict risk
 */
export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Represents a potential conflict when modifications are made
 */
export interface ConflictRisk {
  /** Unique identifier for the conflict risk */
  id: string;
  
  /** Type of conflict (e.g., 'dependency', 'approval', 'implementation') */
  type: string;
  
  /** Human-readable description of the conflict risk */
  description: string;
  
  /** Severity level of the potential conflict */
  severity: ConflictSeverity;
  
  /** Suggested mitigation actions */
  mitigation: string[];
  
  /** Phases that would be affected by this conflict */
  affectedPhases: SpecPhase[];
}

/**
 * Analysis of the impact that modifications will have on other phases and work
 */
export interface ImpactAnalysis {
  /** Specification phases that will be affected by the modifications */
  affectedPhases: SpecPhase[];
  
  /** Warnings about potential cascade effects */
  cascadeWarnings: string[];
  
  /** Potential conflicts that may arise from the modifications */
  conflictRisks: ConflictRisk[];
  
  /** Whether stakeholder approval is required for these modifications */
  approvalRequired: boolean;
  
  /** Estimated effort impact (hours) */
  effortImpact?: number;
  
  /** Timeline impact assessment */
  timelineImpact?: string;
}

/**
 * Represents a specific modification action that can be performed
 */
export interface ModificationAction {
  /** Unique identifier for the action */
  id: string;
  
  /** Display label for the action in menus */
  label: string;
  
  /** Detailed description of what the action does */
  description: string;
  
  /** Whether this action requires stakeholder approval */
  requiresApproval: boolean;
  
  /** Optional target section within the specification */
  targetSection?: string;
  
  /** Type of modification this action performs */
  actionType: ActionType;
  
  /** Whether this action is currently enabled/available */
  enabled: boolean;
  
  /** Reason why action might be disabled */
  disabledReason?: string;
  
  /** Keyboard shortcut for quick access */
  shortcut?: string;
}

/**
 * AI-generated suggestion for improving specification content
 */
export interface Suggestion {
  /** Unique identifier for the suggestion */
  id: string;
  
  /** Short title summarizing the suggestion */
  title: string;
  
  /** Detailed description of the suggestion */
  description: string;
  
  /** Explanation of why this suggestion is being made */
  rationale: string;
  
  /** Analysis of the impact if this suggestion is implemented */
  impact: ImpactAnalysis;
  
  /** Confidence level in the suggestion (0-100%) */
  confidence: number;
  
  /** Name of the AI agent that generated this suggestion */
  agentSource: string;
  
  /** Category of the suggestion (e.g., 'quality', 'completeness', 'consistency') */
  category: string;
  
  /** Priority level for implementing this suggestion */
  priority: 'low' | 'medium' | 'high';
  
  /** Estimated time to implement this suggestion */
  estimatedEffort?: string;
}

/**
 * User permissions for modification operations
 */
export interface UserPermissions {
  /** Whether user can add new content */
  canAdd: boolean;
  
  /** Whether user can modify existing content */
  canModify: boolean;
  
  /** Whether user can delete content */
  canDelete: boolean;
  
  /** Whether user can reorder content */
  canReorder: boolean;
  
  /** Whether user can approve changes */
  canApprove: boolean;
  
  /** Phases the user has permission to modify */
  allowedPhases: SpecPhase[];
  
  /** Sections the user is restricted from modifying */
  restrictedSections: string[];
}

/**
 * Main interface representing the modification menu for a specification phase
 */
export interface ModificationMenu {
  /** The specification phase this menu is for */
  phase: SpecPhase;
  
  /** Available modification actions for this phase */
  actions: ModificationAction[];
  
  /** AI-generated suggestions for improving the content */
  suggestions: Suggestion[];
  
  /** Current restrictions or limitations on modifications */
  restrictions: string[];
  
  /** User permissions affecting this menu */
  userPermissions: UserPermissions;
  
  /** Whether any actions require approval */
  hasApprovalRequired: boolean;
  
  /** Context information for displaying the menu */
  context: {
    /** Name of the specification */
    specName: string;
    
    /** Current phase status */
    phaseStatus: string;
    
    /** Last modified timestamp */
    lastModified: Date;
    
    /** Whether the phase has been approved */
    approved: boolean;
  };
}

/**
 * User's choice from the modification menu
 */
export interface ModificationChoice {
  /** Type of choice made */
  type: 'action' | 'suggestion' | 'cancel';
  
  /** Selected action (if type is 'action') */
  action?: ModificationAction;
  
  /** Selected suggestion (if type is 'suggestion') */
  suggestion?: Suggestion;
  
  /** Additional context or parameters for the choice */
  parameters?: Record<string, any>;
}

/**
 * Data collected from user for a specific modification
 */
export interface ModificationData {
  /** The action being performed */
  action: ModificationAction;
  
  /** User-provided content or changes */
  content: string;
  
  /** Target section for the modification */
  targetSection?: string;
  
  /** Position within the section (for insertions) */
  position?: number;
  
  /** Additional metadata for the modification */
  metadata: {
    /** User who made the modification */
    author: string;
    
    /** Timestamp of the modification */
    timestamp: Date;
    
    /** Reason or comment for the modification */
    reason?: string;
    
    /** Related issue or requirement ID */
    relatedId?: string;
  };
}