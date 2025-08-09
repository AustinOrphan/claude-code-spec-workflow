/**
 * TypeScript interfaces for parsed specification content
 * Used by content parsing and analysis components in interactive spec modify
 */

/**
 * Represents the specification phase type
 */
export type SpecPhase = 'requirements' | 'design' | 'tasks';

/**
 * Represents different types of content sections within specification files
 */
export type SectionType = 'user-story' | 'acceptance-criteria' | 'architecture' | 'component' | 'task' | 'other';

/**
 * Validation status for content quality assessment
 */
export type ValidationStatus = 'pass' | 'warning' | 'error';

/**
 * Represents a logical section within parsed specification content
 */
export interface ContentSection {
  /** Unique identifier for the section */
  id: string;
  
  /** Display title of the section */
  title: string;
  
  /** Raw content of the section */
  content: string;
  
  /** Type classification for the section */
  sectionType: SectionType;
  
  /** Whether this section can be modified through interactive interface */
  modifiable: boolean;
  
  /** Line range in the original file [startLine, endLine] (1-indexed) */
  lineRange: [number, number];
}

/**
 * Metadata about the parsed specification content
 */
export interface ContentMetadata {
  /** Absolute path to the specification file */
  filePath: string;
  
  /** Size of the file in bytes */
  fileSize: number;
  
  /** When the file was last modified */
  lastModified: Date;
  
  /** Total number of lines in the file */
  totalLines: number;
  
  /** Character encoding of the file */
  encoding: string;
  
  /** Whether the file has been modified since last save */
  isDirty: boolean;
}

/**
 * Quality metrics calculated for the specification content
 */
export interface QualityMetrics {
  /** Template compliance score (0-100%) */
  templateCompliance: number;
  
  /** Content completeness score (0-100%) */
  completeness: number;
  
  /** Overall validation status */
  validationStatus: ValidationStatus;
  
  /** When the content was last modified */
  lastModified: Date;
  
  /** Whether the content has been approved for the current phase */
  approvalStatus: boolean;
  
  /** Number of validation issues found */
  issueCount: number;
  
  /** Confidence score for the quality assessment (0-100%) */
  confidenceScore: number;
}

/**
 * Main interface representing parsed and analyzed specification content
 */
export interface ParsedContent {
  /** The specification phase this content belongs to */
  phase: SpecPhase;
  
  /** Array of logical sections within the content */
  sections: ContentSection[];
  
  /** Metadata about the source file */
  metadata: ContentMetadata;
  
  /** Quality assessment metrics */
  qualityMetrics: QualityMetrics;
  
  /** Raw content of the entire file */
  rawContent: string;
  
  /** Whether the content parsing was successful */
  parseSuccess: boolean;
  
  /** Any errors encountered during parsing */
  parseErrors: string[];
}