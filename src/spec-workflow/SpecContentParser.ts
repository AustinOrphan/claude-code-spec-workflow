/**
 * SpecContentParser - Content analysis and parsing for interactive spec modification
 * 
 * This class provides the foundation for parsing specification files into structured,
 * modifiable sections and analyzing content quality for the interactive spec-modify workflow.
 * 
 * Key responsibilities:
 * - Parse markdown specification files into logical sections
 * - Analyze content quality and template compliance
 * - Extract modifiable sections for user interaction
 * - Provide structured data for modification workflows
 */

import * as path from 'path';
import { statSync } from 'fs';
import { getCachedFileContent, cachedFileExists } from '../file-cache';
import { 
  ParsedContent, 
  ContentSection, 
  ContentMetadata, 
  QualityMetrics, 
  SpecPhase, 
  SectionType, 
  ValidationStatus 
} from './types/ParsedContent';

/**
 * Main class for parsing and analyzing specification content
 * Leverages existing parser patterns from dashboard/parser.ts and file utilities
 */
export class SpecContentParser {
  
  /**
   * Parse a specification file into structured, analyzable content
   * 
   * @param filePath - Absolute path to the specification file
   * @param phase - The specification phase (requirements, design, tasks)
   * @returns Promise resolving to parsed content structure
   * 
   * This method serves as the main entry point for content parsing,
   * coordinating file reading, section extraction, and quality analysis.
   */
  async parseSpecContent(filePath: string, phase: SpecPhase): Promise<ParsedContent> {
    const parseErrors: string[] = [];
    
    try {
      // Read file content and metadata
      const fileData = await this.readFileContent(filePath);
      if (!fileData) {
        return {
          phase,
          sections: [],
          metadata: {
            filePath,
            fileSize: 0,
            lastModified: new Date(),
            totalLines: 0,
            encoding: 'utf-8',
            isDirty: false
          },
          qualityMetrics: this.createInitialQualityMetrics({
            filePath,
            fileSize: 0,
            lastModified: new Date(),
            totalLines: 0,
            encoding: 'utf-8',
            isDirty: false
          }),
          rawContent: '',
          parseSuccess: false,
          parseErrors: ['File not found or not readable']
        };
      }

      const { content, metadata } = fileData;
      const sections = this.parseMarkdownIntoSections(content);
      
      // Calculate initial quality metrics
      const qualityMetrics = this.createInitialQualityMetrics(metadata);

      return {
        phase,
        sections,
        metadata,
        qualityMetrics,
        rawContent: content,
        parseSuccess: true,
        parseErrors
      };

    } catch (error) {
      parseErrors.push(`Error parsing content: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        phase,
        sections: [],
        metadata: {
          filePath,
          fileSize: 0,
          lastModified: new Date(),
          totalLines: 0,
          encoding: 'utf-8',
          isDirty: false
        },
        qualityMetrics: this.createInitialQualityMetrics({
          filePath,
          fileSize: 0,
          lastModified: new Date(),
          totalLines: 0,
          encoding: 'utf-8',
          isDirty: false
        }),
        rawContent: '',
        parseSuccess: false,
        parseErrors
      };
    }
  }

  /**
   * Analyze the quality of parsed specification content
   * 
   * @param content - The parsed content structure to analyze
   * @returns Content quality report with metrics and recommendations
   * 
   * This method calculates template compliance, completeness scores,
   * and performs validation checks using existing validation patterns.
   */
  analyzeContentQuality(content: ParsedContent): QualityMetrics {
    const { phase, sections, metadata, rawContent } = content;
    
    // Initialize quality metrics
    let templateCompliance = 0;
    let completeness = 0;
    let issueCount = 0;
    let validationStatus: ValidationStatus = 'pass';
    
    // Phase-specific analysis based on existing dashboard parser patterns
    switch (phase) {
      case 'requirements':
        return this.analyzeRequirementsQuality(sections, rawContent, metadata);
      case 'design':
        return this.analyzeDesignQuality(sections, rawContent, metadata);
      case 'tasks':
        return this.analyzeTasksQuality(sections, rawContent, metadata);
      default:
        // Generic analysis for unknown phases
        return {
          templateCompliance: 50,
          completeness: this.calculateGenericCompleteness(sections),
          validationStatus: sections.length === 0 ? 'warning' : 'pass',
          lastModified: metadata.lastModified,
          approvalStatus: rawContent.includes('✅ APPROVED') || rawContent.includes('**Approved:** ✓'),
          issueCount: sections.length === 0 ? 1 : 0,
          confidenceScore: 70
        };
    }
  }

  /**
   * Extract modifiable sections from parsed content for user interaction
   * 
   * @param content - The parsed content structure
   * @returns Array of sections that can be modified through the interactive interface
   * 
   * This method identifies which sections can be safely modified and provides
   * the necessary metadata for interactive modification workflows.
   */
  extractModifiableSections(content: ParsedContent): ContentSection[] {
    // Method signature established - implementation will be added in future tasks
    throw new Error('extractModifiableSections method not yet implemented');
  }

  /**
   * Private helper method to read and validate file access
   * Leverages existing file utilities for consistent behavior
   */
  private async readFileContent(filePath: string): Promise<{ content: string; metadata: ContentMetadata } | null> {
    try {
      // Normalize path for cross-platform compatibility
      const normalizedPath = path.resolve(filePath);

      // Check if file exists using cached utility
      if (!cachedFileExists(normalizedPath)) {
        return null;
      }

      // Read file content using cached utility
      const content = getCachedFileContent(normalizedPath);
      if (content === null) {
        return null;
      }

      // Get file metadata
      const stats = statSync(normalizedPath);
      const metadata: ContentMetadata = {
        filePath: normalizedPath,
        fileSize: stats.size,
        lastModified: stats.mtime,
        totalLines: content.split('\n').length,
        encoding: 'utf-8',
        isDirty: false // Will be determined during parsing
      };

      return { content, metadata };
    } catch (error) {
      return null;
    }
  }

  /**
   * Private method to parse markdown content into logical sections
   * Leverages patterns from task-generator.ts for consistent parsing
   */
  private parseMarkdownIntoSections(content: string): ContentSection[] {
    const sections: ContentSection[] = [];
    const lines = content.split('\n');
    
    let currentSection: Partial<ContentSection> | null = null;
    let currentContent: string[] = [];
    let currentLineStart = 1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Detect section headers (# Header, ## Header, ### Header)
      const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      
      if (headerMatch) {
        // Save previous section if it exists
        if (currentSection && currentSection.title) {
          const sectionContent = currentContent.join('\n').trim();
          const sectionType = this.determineSectionType(currentSection.title, sectionContent);
          
          sections.push({
            id: this.generateSectionId(currentSection.title, sections.length),
            title: currentSection.title,
            content: sectionContent,
            sectionType,
            modifiable: this.isSectionModifiable(sectionType, sectionContent),
            lineRange: [currentLineStart, i]
          });
        }
        
        // Start new section
        const headerLevel = headerMatch[1].length;
        const title = headerMatch[2];
        
        currentSection = { title };
        currentContent = [];
        currentLineStart = i + 1;
      } else if (currentSection) {
        // Add line to current section content
        currentContent.push(line);
      } else if (trimmedLine && !currentSection) {
        // Content before first header - create a "preamble" section
        currentSection = { title: 'Document Preamble' };
        currentContent = [line];
        currentLineStart = i + 1;
      }
    }
    
    // Don't forget the last section
    if (currentSection && currentSection.title) {
      const sectionContent = currentContent.join('\n').trim();
      const sectionType = this.determineSectionType(currentSection.title, sectionContent);
      
      sections.push({
        id: this.generateSectionId(currentSection.title, sections.length),
        title: currentSection.title,
        content: sectionContent,
        sectionType,
        modifiable: this.isSectionModifiable(sectionType, sectionContent),
        lineRange: [currentLineStart, lines.length]
      });
    }
    
    return sections;
  }

  /**
   * Private helper method to generate unique section IDs
   */
  private generateSectionId(title: string, index: number): string {
    // Create a slug from the title
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove non-alphanumeric chars except spaces and hyphens
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Replace multiple hyphens with single
      .replace(/^-|-$/g, '');   // Remove leading/trailing hyphens
    
    return slug || `section-${index + 1}`;
  }

  /**
   * Private helper method to determine if a section can be modified
   */
  private isSectionModifiable(sectionType: SectionType, content: string): boolean {
    // Most sections are modifiable, but we can add logic for read-only sections
    // For example, generated sections or metadata sections might not be modifiable
    
    // Tasks with completed checkmarks might be less modifiable
    if (sectionType === 'task' && content.includes('- [x]')) {
      return false; // Completed tasks are read-only
    }
    
    // All other sections are modifiable by default
    return true;
  }

  /**
   * Private helper method to determine section type based on content patterns
   * Uses parsing patterns similar to dashboard/parser.ts
   */
  private determineSectionType(title: string, content: string): SectionType {
    const lowerTitle = title.toLowerCase();
    const lowerContent = content.toLowerCase();
    
    // User story detection
    if (lowerTitle.includes('user story') || 
        lowerTitle.startsWith('us-') || 
        lowerTitle.startsWith('story') ||
        content.includes('As a ') || 
        content.includes('I want ') || 
        content.includes('So that ')) {
      return 'user-story';
    }
    
    // Acceptance criteria detection
    if (lowerTitle.includes('acceptance criteria') || 
        lowerTitle.includes('acceptance') ||
        lowerTitle.includes('criteria') ||
        content.includes('Given ') || 
        content.includes('When ') || 
        content.includes('Then ')) {
      return 'acceptance-criteria';
    }
    
    // Architecture detection
    if (lowerTitle.includes('architecture') || 
        lowerTitle.includes('system design') ||
        lowerTitle.includes('technical design') ||
        lowerTitle.includes('system overview')) {
      return 'architecture';
    }
    
    // Component detection
    if (lowerTitle.includes('component') || 
        lowerTitle.includes('interface') ||
        lowerTitle.includes('api') ||
        lowerTitle.includes('endpoint') ||
        lowerTitle.includes('class') ||
        lowerTitle.includes('module')) {
      return 'component';
    }
    
    // Task detection - enhanced from task-generator patterns
    if (lowerTitle.includes('task') || 
        lowerTitle.includes('implementation') ||
        lowerTitle.includes('todo') ||
        content.includes('- [ ]') || 
        content.includes('- [x]') ||
        /^\s*[-*]\s*\[\s*[x\s]\s*\]/m.test(content)) {
      return 'task';
    }
    
    return 'other';
  }

  /**
   * Private helper method to create initial quality metrics structure
   * Will be populated by analyzeContentQuality method
   */
  private createInitialQualityMetrics(metadata: ContentMetadata): QualityMetrics {
    return {
      templateCompliance: 0,
      completeness: 0,
      validationStatus: 'warning' as ValidationStatus,
      lastModified: metadata.lastModified,
      approvalStatus: false,
      issueCount: 0,
      confidenceScore: 0
    };
  }

  /**
   * Analyze requirements phase quality using patterns from dashboard parser
   * Leverages existing user story and acceptance criteria detection
   */
  private analyzeRequirementsQuality(sections: ContentSection[], rawContent: string, metadata: ContentMetadata): QualityMetrics {
    let templateCompliance = 0;
    let completeness = 0;
    let issueCount = 0;
    let confidenceScore = 0;

    // Check for required sections based on dashboard parser patterns
    const hasUserStories = sections.some(s => s.sectionType === 'user-story') || 
                          rawContent.includes('**User Story:**') ||
                          rawContent.includes('As a ') && rawContent.includes('I want ') && rawContent.includes('So that ');
    
    const hasAcceptanceCriteria = sections.some(s => s.sectionType === 'acceptance-criteria') ||
                                 rawContent.includes('#### Acceptance Criteria') ||
                                 rawContent.includes('**Acceptance Criteria**') ||
                                 rawContent.includes('GIVEN ') && rawContent.includes('WHEN ') && rawContent.includes('THEN ');

    const hasRequirements = sections.some(s => s.title.toLowerCase().includes('requirement')) ||
                           /###\s+(?:Requirement\s+\d+|FR-\d+|NFR-\d+):/m.test(rawContent);

    // Calculate template compliance (0-100)
    let complianceScore = 0;
    if (hasUserStories) complianceScore += 30;
    if (hasAcceptanceCriteria) complianceScore += 30;
    if (hasRequirements) complianceScore += 30;
    if (sections.length >= 3) complianceScore += 10; // Bonus for having multiple sections
    templateCompliance = Math.min(100, complianceScore);

    // Calculate completeness based on content quality
    let completenessScore = 0;
    
    // User stories quality check
    if (hasUserStories) {
      const userStoryCount = this.countUserStories(rawContent);
      if (userStoryCount > 0) completenessScore += 25;
      if (userStoryCount >= 3) completenessScore += 10; // Bonus for comprehensive stories
    }
    
    // Acceptance criteria quality check
    if (hasAcceptanceCriteria) {
      const criteriaCount = this.countAcceptanceCriteria(rawContent);
      if (criteriaCount > 0) completenessScore += 25;
      if (criteriaCount >= 5) completenessScore += 10; // Bonus for detailed criteria
    }

    // Content depth check
    const averageSectionLength = sections.reduce((sum, s) => sum + s.content.length, 0) / sections.length;
    if (averageSectionLength > 100) completenessScore += 15; // Well-detailed sections
    if (averageSectionLength > 300) completenessScore += 15; // Very detailed sections

    completeness = Math.min(100, completenessScore);

    // Issue counting
    if (!hasUserStories) issueCount++;
    if (!hasAcceptanceCriteria) issueCount++;
    if (sections.length === 0) issueCount++;
    if (averageSectionLength < 50) issueCount++; // Sections too short

    // Determine validation status
    let validationStatus: ValidationStatus = 'pass';
    if (issueCount > 2) validationStatus = 'error';
    else if (issueCount > 0) validationStatus = 'warning';

    // Calculate confidence score
    confidenceScore = Math.floor((templateCompliance + completeness) / 2);
    if (issueCount === 0) confidenceScore += 10;

    return {
      templateCompliance,
      completeness,
      validationStatus,
      lastModified: metadata.lastModified,
      approvalStatus: rawContent.includes('✅ APPROVED') || rawContent.includes('**Approved:** ✓'),
      issueCount,
      confidenceScore: Math.min(100, confidenceScore)
    };
  }

  /**
   * Analyze design phase quality using patterns from dashboard parser
   * Checks for architecture, components, and code reuse analysis
   */
  private analyzeDesignQuality(sections: ContentSection[], rawContent: string, metadata: ContentMetadata): QualityMetrics {
    let templateCompliance = 0;
    let completeness = 0;
    let issueCount = 0;
    let confidenceScore = 0;

    // Check for required design sections
    const hasArchitecture = sections.some(s => s.sectionType === 'architecture') ||
                           rawContent.includes('## Architecture') ||
                           rawContent.includes('## System Design') ||
                           rawContent.includes('## Technical Design');

    const hasComponents = sections.some(s => s.sectionType === 'component') ||
                         rawContent.includes('## Components') ||
                         rawContent.includes('## Interface') ||
                         rawContent.includes('## API');

    const hasCodeReuseAnalysis = rawContent.includes('## Code Reuse Analysis') || 
                                rawContent.includes('### Existing Components to Reuse') ||
                                rawContent.includes('## Existing Components') ||
                                rawContent.includes('## Code Reuse');

    // Calculate template compliance
    let complianceScore = 0;
    if (hasArchitecture) complianceScore += 40;
    if (hasComponents) complianceScore += 30;
    if (hasCodeReuseAnalysis) complianceScore += 20;
    if (sections.length >= 4) complianceScore += 10;
    templateCompliance = Math.min(100, complianceScore);

    // Calculate completeness
    let completenessScore = 0;
    
    if (hasArchitecture) {
      const archSections = sections.filter(s => s.sectionType === 'architecture');
      if (archSections.some(s => s.content.length > 200)) completenessScore += 25;
    }
    
    if (hasComponents) {
      const componentSections = sections.filter(s => s.sectionType === 'component');
      completenessScore += Math.min(25, componentSections.length * 5);
    }

    if (hasCodeReuseAnalysis) {
      const codeReuseContent = this.extractCodeReuseFromContent(rawContent);
      if (codeReuseContent.length > 0) completenessScore += 20;
      if (codeReuseContent.length >= 3) completenessScore += 10; // Multiple reuse items
    }

    // Check for implementation details
    if (rawContent.includes('## Implementation') || rawContent.includes('## Technical Details')) {
      completenessScore += 15;
    }

    completeness = Math.min(100, completenessScore);

    // Issue counting
    if (!hasArchitecture) issueCount++;
    if (!hasComponents) issueCount++;
    if (!hasCodeReuseAnalysis) issueCount++;
    if (sections.length < 2) issueCount++;

    // Determine validation status
    let validationStatus: ValidationStatus = 'pass';
    if (issueCount > 2) validationStatus = 'error';
    else if (issueCount > 0) validationStatus = 'warning';

    // Calculate confidence score
    confidenceScore = Math.floor((templateCompliance + completeness) / 2);
    if (hasCodeReuseAnalysis && issueCount <= 1) confidenceScore += 10;

    return {
      templateCompliance,
      completeness,
      validationStatus,
      lastModified: metadata.lastModified,
      approvalStatus: rawContent.includes('✅ APPROVED'),
      issueCount,
      confidenceScore: Math.min(100, confidenceScore)
    };
  }

  /**
   * Analyze tasks phase quality using patterns from dashboard parser
   * Leverages existing task parsing and completion tracking
   */
  private analyzeTasksQuality(sections: ContentSection[], rawContent: string, metadata: ContentMetadata): QualityMetrics {
    let templateCompliance = 0;
    let completeness = 0;
    let issueCount = 0;
    let confidenceScore = 0;

    // Use existing task parsing patterns from dashboard parser
    const taskSections = sections.filter(s => s.sectionType === 'task');
    const hasTasks = taskSections.length > 0 || this.hasTaskCheckboxes(rawContent);

    // Parse tasks using similar logic to dashboard parser
    const taskCount = this.countTasks(rawContent);
    const completedTaskCount = this.countCompletedTasks(rawContent);

    // Calculate template compliance
    let complianceScore = 0;
    if (hasTasks) complianceScore += 50;
    if (taskCount > 0) complianceScore += 25;
    if (rawContent.includes('Requirements:') || rawContent.includes('_Requirements:')) complianceScore += 15;
    if (rawContent.includes('Leverage:') || rawContent.includes('_Leverage:')) complianceScore += 10;
    templateCompliance = Math.min(100, complianceScore);

    // Calculate completeness
    let completenessScore = 0;
    
    if (taskCount > 0) {
      completenessScore += 30;
      
      // Bonus for task quantity
      if (taskCount >= 5) completenessScore += 15;
      if (taskCount >= 10) completenessScore += 10;
      
      // Check task quality indicators
      const hasRequirements = rawContent.includes('_Requirements:');
      const hasLeverage = rawContent.includes('_Leverage:');
      const hasAtomicTasks = this.checkTaskAtomicity(rawContent);
      
      if (hasRequirements) completenessScore += 15;
      if (hasLeverage) completenessScore += 15;
      if (hasAtomicTasks) completenessScore += 15;
    }

    completeness = Math.min(100, completenessScore);

    // Issue counting
    if (!hasTasks) issueCount++;
    if (taskCount === 0) issueCount++;
    if (taskCount > 0 && !rawContent.includes('_Requirements:')) issueCount++;
    if (sections.length === 0) issueCount++;

    // Check for common task issues
    if (rawContent.includes('- [ ] ') && !this.checkTaskAtomicity(rawContent)) {
      issueCount++; // Tasks might be too broad
    }

    // Determine validation status
    let validationStatus: ValidationStatus = 'pass';
    if (issueCount > 2) validationStatus = 'error';
    else if (issueCount > 0) validationStatus = 'warning';

    // Calculate confidence score
    confidenceScore = Math.floor((templateCompliance + completeness) / 2);
    if (taskCount > 5 && issueCount <= 1) confidenceScore += 10;

    return {
      templateCompliance,
      completeness,
      validationStatus,
      lastModified: metadata.lastModified,
      approvalStatus: rawContent.includes('✅ APPROVED'),
      issueCount,
      confidenceScore: Math.min(100, confidenceScore)
    };
  }

  /**
   * Helper methods for quality analysis
   */
  private calculateGenericCompleteness(sections: ContentSection[]): number {
    if (sections.length === 0) return 0;
    
    const totalContent = sections.reduce((sum, s) => sum + s.content.length, 0);
    const averageLength = totalContent / sections.length;
    
    // Scale based on average section length
    if (averageLength > 500) return 100;
    if (averageLength > 200) return 80;
    if (averageLength > 100) return 60;
    if (averageLength > 50) return 40;
    return 20;
  }

  private countUserStories(content: string): number {
    // Count user stories using dashboard parser patterns
    const userStoryPatterns = [
      /\*\*User Story:\*\*/g,
      /###\s+US-\d+:/g,
      /As a .+I want .+So that/g
    ];
    
    let count = 0;
    for (const pattern of userStoryPatterns) {
      const matches = content.match(pattern);
      if (matches) count += matches.length;
    }
    return count;
  }

  private countAcceptanceCriteria(content: string): number {
    // Count acceptance criteria items
    const criteriaPatterns = [
      /\*\*GIVEN\*\*|\*\*WHEN\*\*|\*\*THEN\*\*/g,
      /GIVEN .+WHEN .+THEN/g,
      /#### Acceptance Criteria[\s\S]*?(?=###|$)/g
    ];
    
    let count = 0;
    for (const pattern of criteriaPatterns) {
      const matches = content.match(pattern);
      if (matches) count += matches.length;
    }
    return count;
  }

  private extractCodeReuseFromContent(content: string): string[] {
    // Simple extraction of code reuse items
    const items: string[] = [];
    const lines = content.split('\n');
    let inCodeReuseSection = false;

    for (const line of lines) {
      if (line.includes('## Code Reuse') || line.includes('## Existing Components')) {
        inCodeReuseSection = true;
        continue;
      }

      if (inCodeReuseSection && (line.startsWith('## ') && !line.includes('Code Reuse'))) {
        break;
      }

      if (inCodeReuseSection && (line.startsWith('- ') || line.match(/^\d+\./))) {
        const item = line.replace(/^[-•\d.]\s*/, '').trim();
        if (item) items.push(item);
      }
    }

    return items;
  }

  private hasTaskCheckboxes(content: string): boolean {
    return /- \[[x\s]\]/.test(content);
  }

  private countTasks(content: string): number {
    const matches = content.match(/- \[[x\s]\] (?:\*\*)?(\d+(?:\.\d+)*)\./g);
    return matches ? matches.length : 0;
  }

  private countCompletedTasks(content: string): number {
    const matches = content.match(/- \[x\] (?:\*\*)?(\d+(?:\.\d+)*)\./g);
    return matches ? matches.length : 0;
  }

  private checkTaskAtomicity(content: string): boolean {
    // Check if tasks appear to be atomic (not too broad)
    const taskLines = content.split('\n').filter(line => /- \[[x\s]\]/.test(line));
    if (taskLines.length === 0) return false;

    // Heuristic: atomic tasks should be reasonably short and specific
    const averageTaskLength = taskLines.reduce((sum, line) => sum + line.length, 0) / taskLines.length;
    const hasSpecificActions = taskLines.some(line => 
      /\b(create|implement|add|update|modify|test|write|build)\b/i.test(line)
    );

    return averageTaskLength < 150 && hasSpecificActions;
  }
}