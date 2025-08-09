/**
 * AgentIntegrationAdapter - Foundation for agent integration in interactive spec modify workflow
 * 
 * This class provides the interface for integrating with the existing 16 specialized agents
 * architecture for content analysis, validation, and suggestions. It serves as an abstraction
 * layer between the interactive modification workflow and the agent system.
 * 
 * Key responsibilities:
 * - Provide standardized agent invocation patterns
 * - Aggregate analysis results from multiple agents
 * - Handle agent failures gracefully with fallback behavior
 * - Map agent responses to workflow-compatible data structures
 */

import { SpecPhase, ParsedContent, ValidationStatus } from './types/ParsedContent';
import { Suggestion, ImpactAnalysis } from './types/ModificationMenu';
import { ValidationResult, ValidationIssue, ValidationConfidence } from './types/ModificationPreview';

/**
 * Represents the result of agent analysis operations
 */
export interface AnalysisResult {
  /** Overall analysis status */
  status: 'success' | 'partial' | 'failed';
  
  /** Quality score from agent analysis (0-100) */
  qualityScore: number;
  
  /** Issues identified by agents */
  issues: AnalysisIssue[];
  
  /** Recommendations from agents */
  recommendations: AgentRecommendation[];
  
  /** Agents that participated in analysis */
  participatingAgents: string[];
  
  /** Agents that failed during analysis */
  failedAgents: string[];
  
  /** Raw responses from agents (for debugging) */
  agentResponses: Record<string, any>;
}

/**
 * Represents an issue identified during agent analysis
 */
export interface AnalysisIssue {
  /** Unique identifier for the issue */
  id: string;
  
  /** Severity level of the issue */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Type of issue (e.g., 'template-compliance', 'content-quality', 'validation') */
  type: string;
  
  /** Human-readable description of the issue */
  description: string;
  
  /** Location of the issue (line number, section) */
  location?: string;
  
  /** Agent that identified this issue */
  source: string;
  
  /** Suggested fixes for the issue */
  suggestedFixes: string[];
}

/**
 * Represents a recommendation from an agent
 */
export interface AgentRecommendation {
  /** Unique identifier for the recommendation */
  id: string;
  
  /** Agent that made the recommendation */
  agent: string;
  
  /** Title of the recommendation */
  title: string;
  
  /** Detailed description */
  description: string;
  
  /** Rationale for the recommendation */
  rationale: string;
  
  /** Confidence level (0-100) */
  confidence: number;
  
  /** Priority level */
  priority: 'low' | 'medium' | 'high';
  
  /** Expected impact of implementing */
  impact: string;
}

/**
 * Configuration for agent invocation
 */
export interface AgentConfig {
  /** Timeout for agent operations in milliseconds */
  timeout: number;
  
  /** Maximum number of retry attempts */
  maxRetries: number;
  
  /** Whether to continue on agent failures */
  continueOnFailure: boolean;
  
  /** Specific agents to use (empty means all applicable) */
  includeAgents?: string[];
  
  /** Agents to exclude from invocation */
  excludeAgents?: string[];
}

/**
 * Main class for integrating with the specialized agent system
 * Provides foundation for agent integration without implementing invocation details
 */
export class AgentIntegrationAdapter {
  
  private config: AgentConfig;
  
  /**
   * Initialize the agent integration adapter with configuration
   * 
   * @param config - Configuration for agent behavior and timeouts
   */
  constructor(config: Partial<AgentConfig> = {}) {
    this.config = {
      timeout: 10000, // 10 seconds default
      maxRetries: 1,
      continueOnFailure: true,
      ...config
    };
  }

  /**
   * Analyze specification content using appropriate specialized agents
   * 
   * @param content - The parsed specification content to analyze
   * @param phase - The specification phase being analyzed
   * @returns Promise resolving to aggregated analysis results
   * 
   * This method coordinates multiple agent invocations for comprehensive analysis:
   * - Requirements phase: spec-requirements-validator
   * - Design phase: spec-design-validator  
   * - Tasks phase: spec-task-validator
   * - Additional agents: spec-completion-reviewer, spec-duplication-detector
   */
  async analyzeWithAgents(content: ParsedContent, phase: SpecPhase): Promise<AnalysisResult> {
    const participatingAgents: string[] = [];
    const failedAgents: string[] = [];
    const issues: AnalysisIssue[] = [];
    const recommendations: AgentRecommendation[] = [];
    const agentResponses: Record<string, any> = {};
    
    try {
      // Determine which agents to invoke based on phase
      const targetAgents = this.getAgentsForPhase(phase);
      
      // Invoke each agent and aggregate results
      for (const agentName of targetAgents) {
        try {
          const agentResult = await this.invokeAgent(agentName, content, phase);
          
          if (agentResult.success) {
            participatingAgents.push(agentName);
            agentResponses[agentName] = agentResult.response;
            
            // Extract issues from agent analysis
            if (agentResult.analysis?.issues) {
              issues.push(...agentResult.analysis.issues.map(issue => ({
                ...issue,
                source: agentName
              })));
            }
            
            // Extract recommendations from agent analysis
            if (agentResult.analysis?.recommendations) {
              recommendations.push(...agentResult.analysis.recommendations.map(rec => ({
                ...rec,
                agent: agentName
              })));
            }
          } else {
            failedAgents.push(agentName);
            console.warn(`Agent ${agentName} failed:`, agentResult.error);
          }
        } catch (agentError) {
          failedAgents.push(agentName);
          console.warn(`Agent ${agentName} threw error:`, agentError);
          
          // Create an issue for the failed agent if it's critical
          if (this.isCriticalAgent(agentName)) {
            issues.push({
              id: `agent-failure-${agentName}`,
              severity: 'medium',
              type: 'agent-failure',
              description: `Critical agent ${agentName} failed to analyze content`,
              source: 'system',
              suggestedFixes: ['Retry analysis', 'Use fallback validation']
            });
          }
        }
      }
      
      // Calculate overall quality score based on agent feedback
      const qualityScore = this.calculateAggregateQualityScore(
        content.qualityMetrics.templateCompliance,
        issues,
        recommendations,
        participatingAgents.length,
        targetAgents.length
      );
      
      // Determine overall status
      const status = this.determineAnalysisStatus(
        participatingAgents.length,
        targetAgents.length,
        failedAgents.length,
        issues
      );
      
      return {
        status,
        qualityScore,
        issues,
        recommendations,
        participatingAgents,
        failedAgents,
        agentResponses
      };
      
    } catch (error) {
      return {
        status: 'failed',
        qualityScore: 0,
        issues: [{
          id: 'analysis-error',
          severity: 'high',
          type: 'system-error',
          description: `Agent analysis failed: ${error instanceof Error ? error.message : String(error)}`,
          source: 'system',
          suggestedFixes: ['Retry analysis', 'Check agent availability']
        }],
        recommendations,
        participatingAgents,
        failedAgents: ['system'],
        agentResponses: {}
      };
    }
  }

  /**
   * Generate improvement suggestions based on analysis results
   * 
   * @param analysisResult - Results from agent analysis
   * @returns Promise resolving to workflow-compatible suggestions
   * 
   * This method converts agent recommendations into suggestion objects
   * compatible with the modification menu system.
   */
  async getSuggestions(analysisResult: AnalysisResult): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    // Convert agent recommendations to workflow suggestions
    for (const recommendation of analysisResult.recommendations) {
      const suggestion: Suggestion = {
        id: recommendation.id,
        title: recommendation.title,
        description: recommendation.description,
        rationale: recommendation.rationale,
        impact: {
          affectedPhases: [], // TODO: Determine from recommendation
          cascadeWarnings: [],
          conflictRisks: [],
          approvalRequired: false,
          effortImpact: 1, // Default 1 hour
          timelineImpact: 'minimal'
        },
        confidence: recommendation.confidence,
        agentSource: recommendation.agent,
        category: this.mapRecommendationToCategory(recommendation),
        priority: recommendation.priority,
        estimatedEffort: recommendation.impact
      };
      
      suggestions.push(suggestion);
    }
    
    // Convert high-severity issues to improvement suggestions
    for (const issue of analysisResult.issues) {
      if (issue.severity === 'high' || issue.severity === 'critical') {
        const suggestion: Suggestion = {
          id: `fix-${issue.id}`,
          title: `Fix: ${issue.description}`,
          description: issue.suggestedFixes.join('; '),
          rationale: `Critical issue identified by ${issue.source}`,
          impact: {
            affectedPhases: [],
            cascadeWarnings: [],
            conflictRisks: [],
            approvalRequired: issue.severity === 'critical',
            effortImpact: issue.severity === 'critical' ? 4 : 2,
            timelineImpact: issue.severity === 'critical' ? 'significant' : 'moderate'
          },
          confidence: 90, // High confidence for agent-identified issues
          agentSource: issue.source,
          category: 'quality',
          priority: issue.severity === 'critical' ? 'high' : 'medium',
          estimatedEffort: issue.severity === 'critical' ? '2-4 hours' : '1-2 hours'
        };
        
        suggestions.push(suggestion);
      }
    }
    
    return suggestions;
  }

  /**
   * Validate modifications using appropriate specialized agents
   * 
   * @param modifications - Array of modification data to validate
   * @param phase - The specification phase being modified
   * @returns Promise resolving to validation results
   * 
   * This method uses validation agents to check modifications before application:
   * - Template compliance validation
   * - Content quality validation
   * - Cross-phase impact validation
   */
  async validateWithAgents(modifications: any[], phase: SpecPhase): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];
    const validatorsUsed: string[] = [];
    
    try {
      // Determine validation agents for phase
      const validationAgents = this.getValidationAgentsForPhase(phase);
      
      // Add general validation agents for comprehensive coverage
      const allValidationAgents = [
        ...validationAgents,
        'spec-completion-reviewer',
        'spec-breaking-change-detector'
      ];
      
      // Validate each modification using appropriate agents
      for (const modification of modifications) {
        await this.validateSingleModification(modification, phase, allValidationAgents, issues, validatorsUsed);
      }
      
      // Perform cross-modification validation
      await this.validateModificationInteractions(modifications, phase, allValidationAgents, issues, validatorsUsed);
      
      // Calculate validation score based on issues
      const score = this.calculateValidationScore(issues, modifications.length);
      
      // Determine overall validation status
      const status = this.determineValidationStatus(issues);
      
      // Check if minimum quality thresholds are met
      const passesMinimumQuality = this.checkMinimumQuality(issues, score);
      
      // Determine confidence based on agent participation and results
      const confidence = this.calculateValidationConfidence(validatorsUsed, allValidationAgents, issues);
      
      const validationDuration = Date.now() - startTime;
      
      return {
        status,
        issues,
        confidence,
        score,
        passesMinimumQuality,
        validatedAt: new Date(),
        validatorsUsed: [...new Set(validatorsUsed)], // Remove duplicates
        validationDuration,
        completed: true
      };
      
    } catch (error) {
      const validationDuration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Add system error to issues
      issues.push({
        id: 'validation-system-error',
        severity: 'error',
        message: `Validation system error: ${errorMessage}`,
        code: 'AGENT_VALIDATION_SYSTEM_ERROR',
        source: 'system',
        suggestedFix: 'Retry validation or contact administrator'
      });
      
      return {
        status: 'error',
        issues,
        confidence: 'low',
        score: 0,
        passesMinimumQuality: false,
        validatedAt: new Date(),
        validatorsUsed,
        validationDuration,
        completed: false,
        error: errorMessage
      };
    }
  }

  /**
   * Check if agents are available and responding
   * 
   * @returns Promise resolving to availability status
   * 
   * This method performs a health check on the agent system
   * to ensure reliable operation during interactive workflows.
   */
  async checkAgentAvailability(): Promise<{
    available: boolean;
    availableAgents: string[];
    unavailableAgents: string[];
    errors: string[];
  }> {
    // TODO: Implement actual agent availability check
    // For now, assume all agents are available
    
    const allAgents = this.getAllAvailableAgents();
    
    return {
      available: true,
      availableAgents: allAgents,
      unavailableAgents: [],
      errors: []
    };
  }

  /**
   * Get configuration for the adapter
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Update adapter configuration
   */
  updateConfig(newConfig: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Private helper methods

  /**
   * Get appropriate agents for a specific phase
   */
  private getAgentsForPhase(phase: SpecPhase): string[] {
    const baseAgents = ['spec-completion-reviewer'];
    
    switch (phase) {
      case 'requirements':
        return ['spec-requirements-validator', ...baseAgents];
      case 'design':
        return ['spec-design-validator', 'spec-duplication-detector', ...baseAgents];
      case 'tasks':
        return ['spec-task-validator', ...baseAgents];
      default:
        return baseAgents;
    }
  }

  /**
   * Get validation agents for a specific phase
   */
  private getValidationAgentsForPhase(phase: SpecPhase): string[] {
    switch (phase) {
      case 'requirements':
        return ['spec-requirements-validator'];
      case 'design':
        return ['spec-design-validator'];
      case 'tasks':
        return ['spec-task-validator'];
      default:
        return [];
    }
  }

  /**
   * Get all available agents in the system
   */
  private getAllAvailableAgents(): string[] {
    return [
      'spec-requirements-validator',
      'spec-design-validator',
      'spec-task-validator',
      'spec-task-executor',
      'bug-root-cause-analyzer',
      'spec-breaking-change-detector',
      'spec-completion-reviewer',
      'spec-dependency-analyzer',
      'spec-design-web-researcher',
      'spec-documentation-generator',
      'spec-duplication-detector',
      'spec-integration-tester',
      'spec-performance-analyzer',
      'spec-task-implementation-reviewer',
      'spec-test-generator',
      'steering-document-updater'
    ];
  }

  /**
   * Map agent recommendation to suggestion category
   */
  private mapRecommendationToCategory(recommendation: AgentRecommendation): string {
    // Simple mapping based on agent type and content
    if (recommendation.agent.includes('validator')) {
      return 'quality';
    }
    if (recommendation.agent.includes('completion')) {
      return 'completeness';
    }
    if (recommendation.agent.includes('duplication')) {
      return 'consistency';
    }
    if (recommendation.agent.includes('performance')) {
      return 'performance';
    }
    if (recommendation.agent.includes('test')) {
      return 'testing';
    }
    
    return 'improvement';
  }

  /**
   * Invoke a specific agent for content analysis
   * 
   * This method simulates agent invocation by analyzing content according to 
   * the agent's specialized criteria. In a production system, this could be
   * replaced with actual Claude API calls using the agent's prompt.
   */
  private async invokeAgent(
    agentName: string, 
    content: ParsedContent, 
    phase: SpecPhase
  ): Promise<{
    success: boolean;
    response?: any;
    analysis?: {
      issues: AnalysisIssue[];
      recommendations: AgentRecommendation[];
    };
    error?: string;
  }> {
    try {
      // Apply timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Agent timeout')), this.config.timeout);
      });
      
      const analysisPromise = this.performAgentAnalysis(agentName, content, phase);
      
      const result = await Promise.race([analysisPromise, timeoutPromise]);
      
      return {
        success: true,
        response: `Analysis completed by ${agentName}`,
        analysis: result as any
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Perform agent-specific analysis based on agent capabilities
   */
  private async performAgentAnalysis(
    agentName: string, 
    content: ParsedContent, 
    phase: SpecPhase
  ): Promise<{
    issues: AnalysisIssue[];
    recommendations: AgentRecommendation[];
  }> {
    const issues: AnalysisIssue[] = [];
    const recommendations: AgentRecommendation[] = [];
    
    // Simulate agent-specific analysis based on agent type
    switch (agentName) {
      case 'spec-requirements-validator':
        await this.analyzeRequirementsCompliance(content, issues, recommendations);
        break;
        
      case 'spec-design-validator':
        await this.analyzeDesignCompliance(content, issues, recommendations);
        break;
        
      case 'spec-task-validator':
        await this.analyzeTaskCompliance(content, issues, recommendations);
        break;
        
      case 'spec-completion-reviewer':
        await this.analyzeCompleteness(content, phase, issues, recommendations);
        break;
        
      case 'spec-duplication-detector':
        await this.analyzeDuplication(content, issues, recommendations);
        break;
        
      default:
        // Generic analysis for unknown agents
        await this.performGenericAnalysis(content, agentName, issues, recommendations);
    }
    
    return { issues, recommendations };
  }

  /**
   * Check if an agent is critical for the analysis
   */
  private isCriticalAgent(agentName: string): boolean {
    const criticalAgents = [
      'spec-requirements-validator',
      'spec-design-validator', 
      'spec-task-validator'
    ];
    return criticalAgents.includes(agentName);
  }

  /**
   * Calculate aggregate quality score from multiple sources
   */
  private calculateAggregateQualityScore(
    baseScore: number,
    issues: AnalysisIssue[],
    recommendations: AgentRecommendation[],
    successfulAgents: number,
    totalAgents: number
  ): number {
    // Start with base template compliance score
    let score = baseScore;
    
    // Penalize for issues
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;
    
    score -= (criticalIssues * 20) + (highIssues * 10) + (mediumIssues * 5);
    
    // Bonus for high-confidence recommendations
    const highConfidenceRecs = recommendations.filter(r => r.confidence > 80).length;
    score += Math.min(highConfidenceRecs * 2, 10); // Cap bonus at 10 points
    
    // Penalize for failed agents
    const agentSuccessRate = totalAgents > 0 ? successfulAgents / totalAgents : 1;
    if (agentSuccessRate < 0.5) {
      score -= 15; // Major penalty for less than 50% agent success
    } else if (agentSuccessRate < 0.8) {
      score -= 5; // Minor penalty for less than 80% agent success
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine overall analysis status based on results
   */
  private determineAnalysisStatus(
    successfulAgents: number,
    totalAgents: number,
    failedAgents: number,
    issues: AnalysisIssue[]
  ): 'success' | 'partial' | 'failed' {
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    
    // Failed if critical issues or more than half agents failed
    if (criticalIssues > 0 || failedAgents > totalAgents / 2) {
      return 'failed';
    }
    
    // Partial if some agents failed or high severity issues
    const highIssues = issues.filter(i => i.severity === 'high').length;
    if (failedAgents > 0 || highIssues > 0) {
      return 'partial';
    }
    
    return 'success';
  }

  // Agent-specific analysis methods
  
  /**
   * Analyze requirements compliance using requirements validator logic
   */
  private async analyzeRequirementsCompliance(
    content: ParsedContent,
    issues: AnalysisIssue[],
    recommendations: AgentRecommendation[]
  ): Promise<void> {
    const agentName = 'spec-requirements-validator';
    // Check for user stories format compliance
    let userStoryIssues = 0;
    let acceptanceCriteriaIssues = 0;
    
    for (const section of content.sections) {
      if (section.sectionType === 'user-story') {
        // Check if follows "As a... I want... so that..." format
        if (!section.content.includes('As a') || !section.content.includes('I want') || !section.content.includes('so that')) {
          userStoryIssues++;
        }
      } else if (section.sectionType === 'acceptance-criteria') {
        // Check for WHEN/IF/THEN patterns
        if (!section.content.includes('WHEN') && !section.content.includes('IF') && !section.content.includes('THEN')) {
          acceptanceCriteriaIssues++;
        }
      }
    }
    
    if (userStoryIssues > 0) {
      issues.push({
        id: 'user-story-format',
        severity: 'medium',
        type: 'template-compliance',
        description: `${userStoryIssues} user stories don't follow "As a... I want... so that..." format`,
        source: agentName,
        suggestedFixes: ['Reformat user stories to follow standard template']
      });
    }
    
    if (acceptanceCriteriaIssues > 0) {
      issues.push({
        id: 'acceptance-criteria-format',
        severity: 'medium', 
        type: 'template-compliance',
        description: `${acceptanceCriteriaIssues} acceptance criteria sections lack WHEN/IF/THEN structure`,
        source: agentName,
        suggestedFixes: ['Add WHEN/IF/THEN statements to acceptance criteria']
      });
    }
    
    // Add recommendations for improvement
    if (content.qualityMetrics.completeness < 80) {
      recommendations.push({
        id: 'improve-completeness',
        agent: agentName,
        title: 'Improve Requirements Completeness',
        description: 'Add missing sections to reach full template compliance',
        rationale: 'Complete requirements reduce implementation ambiguity',
        confidence: 85,
        priority: 'high',
        impact: 'Significantly improves downstream development phases'
      });
    }
  }

  /**
   * Analyze design compliance using design validator logic
   */
  private async analyzeDesignCompliance(
    content: ParsedContent,
    issues: AnalysisIssue[],
    recommendations: AgentRecommendation[]
  ): Promise<void> {
    const agentName = 'spec-design-validator';
    let missingDiagrams = 0;
    let missingComponents = 0;
    
    for (const section of content.sections) {
      if (section.title.toLowerCase().includes('architecture')) {
        // Check for Mermaid diagrams
        if (!section.content.includes('```mermaid')) {
          missingDiagrams++;
        }
      } else if (section.title.toLowerCase().includes('component')) {
        if (section.content.length < 100) { // Arbitrary minimum length
          missingComponents++;
        }
      }
    }
    
    if (missingDiagrams > 0) {
      issues.push({
        id: 'missing-architecture-diagrams',
        severity: 'high',
        type: 'documentation',
        description: 'Architecture sections are missing Mermaid diagrams',
        source: agentName,
        suggestedFixes: ['Add Mermaid diagrams to visualize system architecture']
      });
    }
    
    if (missingComponents > 0) {
      issues.push({
        id: 'incomplete-components',
        severity: 'medium',
        type: 'completeness',
        description: `${missingComponents} component sections appear incomplete`,
        source: agentName,
        suggestedFixes: ['Expand component descriptions with interfaces and responsibilities']
      });
    }
    
    // Recommend architecture improvements
    recommendations.push({
      id: 'enhance-integration',
      agent: agentName,
      title: 'Enhance System Integration',
      description: 'Add detailed integration points with existing systems',
      rationale: 'Clear integration patterns reduce implementation complexity',
      confidence: 90,
      priority: 'medium',
      impact: 'Improves implementation clarity and reduces integration bugs'
    });
  }

  /**
   * Analyze task compliance using task validator logic
   */
  private async analyzeTaskCompliance(
    content: ParsedContent,
    issues: AnalysisIssue[],
    recommendations: AgentRecommendation[]
  ): Promise<void> {
    const agentName = 'spec-task-validator';
    let atomicityIssues = 0;
    let dependencyIssues = 0;
    
    for (const section of content.sections) {
      if (section.sectionType === 'task') {
        // Check for task atomicity (reasonable length)
        if (section.content.length > 1000) {
          atomicityIssues++;
        }
        
        // Check for dependency mentions
        if (section.content.includes('depends on') || section.content.includes('after task')) {
          // Good - dependencies are mentioned
        } else if (section.content.includes('integrate') || section.content.includes('combine')) {
          dependencyIssues++;
        }
      }
    }
    
    if (atomicityIssues > 0) {
      issues.push({
        id: 'task-atomicity',
        severity: 'medium',
        type: 'task-structure',
        description: `${atomicityIssues} tasks appear too large and should be broken down`,
        source: agentName,
        suggestedFixes: ['Break large tasks into smaller, atomic units']
      });
    }
    
    if (dependencyIssues > 0) {
      issues.push({
        id: 'missing-dependencies',
        severity: 'low',
        type: 'task-structure', 
        description: `${dependencyIssues} tasks may have undocumented dependencies`,
        source: agentName,
        suggestedFixes: ['Document task dependencies and ordering requirements']
      });
    }
    
    // Recommend task improvements
    recommendations.push({
      id: 'improve-task-clarity',
      agent: agentName,
      title: 'Improve Task Clarity',
      description: 'Add specific success criteria to each task',
      rationale: 'Clear success criteria enable better validation and testing',
      confidence: 88,
      priority: 'medium',
      impact: 'Improves task execution quality and reduces rework'
    });
  }

  /**
   * Analyze completeness across all phases
   */
  private async analyzeCompleteness(
    content: ParsedContent,
    phase: SpecPhase,
    issues: AnalysisIssue[],
    recommendations: AgentRecommendation[]
  ): Promise<void> {
    const agentName = 'spec-completion-reviewer';
    const completenessScore = content.qualityMetrics.completeness;
    
    if (completenessScore < 70) {
      issues.push({
        id: 'low-completeness',
        severity: 'high',
        type: 'completeness',
        description: `${phase} phase is ${completenessScore}% complete, below recommended 70% threshold`,
        source: agentName,
        suggestedFixes: ['Add missing required sections', 'Expand existing content']
      });
    } else if (completenessScore < 85) {
      recommendations.push({
        id: 'enhance-completeness',
        agent: agentName,
        title: 'Enhance Phase Completeness',
        description: `Improve ${phase} completeness from ${completenessScore}% to 85%+`,
        rationale: 'Higher completeness scores lead to better implementation outcomes',
        confidence: 92,
        priority: 'medium',
        impact: 'Reduces implementation ambiguity and rework'
      });
    }
  }

  /**
   * Analyze for content duplication issues
   */
  private async analyzeDuplication(
    content: ParsedContent,
    issues: AnalysisIssue[],
    recommendations: AgentRecommendation[]
  ): Promise<void> {
    const agentName = 'spec-duplication-detector';
    // Simple duplication detection based on content similarity
    const sections = content.sections;
    let duplications = 0;
    
    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        const similarity = this.calculateSimilarity(sections[i].content, sections[j].content);
        if (similarity > 0.8) {
          duplications++;
        }
      }
    }
    
    if (duplications > 0) {
      issues.push({
        id: 'content-duplication',
        severity: 'medium',
        type: 'consistency',
        description: `Found ${duplications} potential content duplications`,
        source: agentName,
        suggestedFixes: ['Remove duplicate content', 'Consolidate similar sections']
      });
    }
    
    // Always recommend consistency improvements
    recommendations.push({
      id: 'improve-consistency',
      agent: agentName,
      title: 'Improve Content Consistency',
      description: 'Review content for terminology and structure consistency',
      rationale: 'Consistent content reduces confusion and improves clarity',
      confidence: 75,
      priority: 'low',
      impact: 'Improves overall document quality and readability'
    });
  }

  /**
   * Perform generic analysis for unknown agents
   */
  private async performGenericAnalysis(
    content: ParsedContent,
    agentName: string,
    issues: AnalysisIssue[],
    recommendations: AgentRecommendation[]
  ): Promise<void> {
    // Generic analysis based on basic quality metrics
    if (content.qualityMetrics.templateCompliance < 60) {
      issues.push({
        id: 'low-template-compliance',
        severity: 'medium',
        type: 'template-compliance',
        description: `Content has low template compliance (${content.qualityMetrics.templateCompliance}%)`,
        source: agentName,
        suggestedFixes: ['Review template requirements', 'Add missing sections']
      });
    }
    
    recommendations.push({
      id: 'general-improvement',
      agent: agentName,
      title: 'General Quality Improvement',
      description: `${agentName} suggests reviewing content for quality improvements`,
      rationale: 'Regular quality reviews maintain high standards',
      confidence: 60,
      priority: 'low',
      impact: 'Maintains consistent quality across specifications'
    });
  }

  /**
   * Calculate content similarity (simple implementation)
   */
  private calculateSimilarity(content1: string, content2: string): number {
    const words1 = content1.toLowerCase().split(/\s+/);
    const words2 = content2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  // Validation helper methods

  /**
   * Validate a single modification using specified agents
   */
  private async validateSingleModification(
    modification: any,
    phase: SpecPhase,
    agents: string[],
    issues: ValidationIssue[],
    validatorsUsed: string[]
  ): Promise<void> {
    for (const agentName of agents) {
      try {
        // Skip if agent is in exclude list
        if (this.config.excludeAgents?.includes(agentName)) {
          continue;
        }

        // Skip if include list is specified and agent not in it
        if (this.config.includeAgents?.length && !this.config.includeAgents.includes(agentName)) {
          continue;
        }

        const validationResult = await this.validateModificationWithAgent(
          modification,
          phase,
          agentName
        );

        if (validationResult.success) {
          validatorsUsed.push(agentName);
          
          // Add any issues found by the agent
          if (validationResult.issues) {
            issues.push(...validationResult.issues);
          }
        } else {
          // Handle agent failure gracefully
          if (this.config.continueOnFailure) {
            console.warn(`Agent ${agentName} failed validation:`, validationResult.error);
            
            // Add a warning issue for failed agent if it's critical
            if (this.isCriticalAgent(agentName)) {
              issues.push({
                id: `agent-validation-failure-${agentName}`,
                severity: 'warning',
                message: `Critical validator ${agentName} failed to validate modification`,
                code: 'AGENT_VALIDATION_FAILURE',
                source: 'system',
                suggestedFix: 'Manual review recommended due to validator failure'
              });
            }
          } else {
            throw new Error(`Critical agent ${agentName} failed: ${validationResult.error}`);
          }
        }
      } catch (error) {
        if (this.config.continueOnFailure) {
          console.warn(`Agent ${agentName} threw error during validation:`, error);
          issues.push({
            id: `agent-error-${agentName}`,
            severity: 'error',
            message: `Validator ${agentName} encountered an error`,
            code: 'AGENT_VALIDATION_ERROR',
            source: agentName,
            suggestedFix: 'Review modification manually or retry validation'
          });
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Validate interactions between multiple modifications
   */
  private async validateModificationInteractions(
    modifications: any[],
    phase: SpecPhase,
    agents: string[],
    issues: ValidationIssue[],
    validatorsUsed: string[]
  ): Promise<void> {
    // Only perform interaction validation if there are multiple modifications
    if (modifications.length < 2) {
      return;
    }

    try {
      // Use breaking change detector for interaction analysis
      const breakingChangeAgent = 'spec-breaking-change-detector';
      if (agents.includes(breakingChangeAgent)) {
        const interactionResult = await this.validateInteractionsWithAgent(
          modifications,
          phase,
          breakingChangeAgent
        );

        if (interactionResult.success) {
          validatorsUsed.push(breakingChangeAgent);
          if (interactionResult.issues) {
            issues.push(...interactionResult.issues);
          }
        }
      }

      // Check for potential conflicts between modifications
      const conflicts = this.detectModificationConflicts(modifications);
      for (const conflict of conflicts) {
        issues.push({
          id: `modification-conflict-${conflict.id}`,
          severity: 'warning',
          message: conflict.description,
          code: 'MODIFICATION_CONFLICT',
          source: 'system',
          suggestedFix: conflict.resolution
        });
      }
    } catch (error) {
      console.warn('Failed to validate modification interactions:', error);
      issues.push({
        id: 'interaction-validation-error',
        severity: 'warning',
        message: 'Could not validate modification interactions',
        code: 'INTERACTION_VALIDATION_ERROR',
        source: 'system',
        suggestedFix: 'Review modifications manually for potential conflicts'
      });
    }
  }

  /**
   * Calculate validation score based on issues found
   */
  private calculateValidationScore(issues: ValidationIssue[], modificationCount: number): number {
    let score = 100; // Start with perfect score

    // Deduct points for each issue based on severity
    for (const issue of issues) {
      switch (issue.severity) {
        case 'error':
          score -= 20;
          break;
        case 'warning':
          score -= 10;
          break;
        case 'info':
          score -= 2;
          break;
      }
    }

    // Bonus for having modifications (activity indicator)
    if (modificationCount > 0) {
      score += Math.min(modificationCount * 2, 10); // Max 10 point bonus
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine validation status from issues
   */
  private determineValidationStatus(issues: ValidationIssue[]): ValidationStatus {
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    if (errorCount > 0) {
      return 'error';
    } else if (warningCount > 0) {
      return 'warning';
    } else {
      return 'pass';
    }
  }

  /**
   * Check if modifications meet minimum quality thresholds
   */
  private checkMinimumQuality(issues: ValidationIssue[], score: number): boolean {
    // Must have score above 60 and no critical errors
    const criticalErrors = issues.filter(i => 
      i.severity === 'error' && 
      (i.code.includes('CRITICAL') || i.code.includes('BREAKING'))
    ).length;

    return score >= 60 && criticalErrors === 0;
  }

  /**
   * Calculate validation confidence based on agent participation and results
   */
  private calculateValidationConfidence(
    validatorsUsed: string[],
    targetAgents: string[],
    issues: ValidationIssue[]
  ): ValidationConfidence {
    const participationRate = targetAgents.length > 0 ? validatorsUsed.length / targetAgents.length : 0;
    const systemErrors = issues.filter(i => i.source === 'system' && i.severity === 'error').length;

    if (systemErrors > 0 || participationRate < 0.3) {
      return 'low';
    } else if (participationRate < 0.7) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Validate a modification using a specific agent
   */
  private async validateModificationWithAgent(
    modification: any,
    phase: SpecPhase,
    agentName: string
  ): Promise<{
    success: boolean;
    issues?: ValidationIssue[];
    error?: string;
  }> {
    try {
      // Apply timeout protection
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Validation timeout')), this.config.timeout);
      });

      const validationPromise = this.performAgentValidation(modification, phase, agentName);
      const result = await Promise.race([validationPromise, timeoutPromise]);

      return {
        success: true,
        issues: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate interactions between modifications using an agent
   */
  private async validateInteractionsWithAgent(
    modifications: any[],
    phase: SpecPhase,
    agentName: string
  ): Promise<{
    success: boolean;
    issues?: ValidationIssue[];
    error?: string;
  }> {
    try {
      const issues: ValidationIssue[] = [];

      // Simulate breaking change detection
      for (let i = 0; i < modifications.length; i++) {
        for (let j = i + 1; j < modifications.length; j++) {
          const mod1 = modifications[i];
          const mod2 = modifications[j];

          // Check for potential breaking changes between modifications
          if (this.detectBreakingChange(mod1, mod2)) {
            issues.push({
              id: `breaking-change-${i}-${j}`,
              severity: 'error',
              message: `Potential breaking change detected between modifications ${i + 1} and ${j + 1}`,
              code: 'BREAKING_CHANGE_DETECTED',
              source: agentName,
              suggestedFix: 'Review modification compatibility and adjust as needed'
            });
          }
        }
      }

      return {
        success: true,
        issues
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Perform agent-specific validation logic
   */
  private async performAgentValidation(
    modification: any,
    phase: SpecPhase,
    agentName: string
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Simulate agent-specific validation based on agent type
    switch (agentName) {
      case 'spec-requirements-validator':
        if (phase === 'requirements') {
          issues.push(...await this.validateRequirementsModification(modification));
        }
        break;

      case 'spec-design-validator':
        if (phase === 'design') {
          issues.push(...await this.validateDesignModification(modification));
        }
        break;

      case 'spec-task-validator':
        if (phase === 'tasks') {
          issues.push(...await this.validateTaskModification(modification));
        }
        break;

      case 'spec-completion-reviewer':
        issues.push(...await this.validateCompletionModification(modification, phase));
        break;

      case 'spec-breaking-change-detector':
        issues.push(...await this.validateBreakingChanges(modification, phase));
        break;

      default:
        // Generic validation for unknown agents
        issues.push(...await this.validateGenericModification(modification, agentName));
    }

    return issues;
  }

  /**
   * Detect potential conflicts between modifications
   */
  private detectModificationConflicts(modifications: any[]): Array<{
    id: string;
    description: string;
    resolution: string;
  }> {
    const conflicts: Array<{ id: string; description: string; resolution: string; }> = [];

    // Simple conflict detection based on modification targets
    for (let i = 0; i < modifications.length; i++) {
      for (let j = i + 1; j < modifications.length; j++) {
        const mod1 = modifications[i];
        const mod2 = modifications[j];

        // Check if modifications target the same section
        if (mod1.section && mod2.section && mod1.section === mod2.section) {
          conflicts.push({
            id: `${i}-${j}`,
            description: `Modifications ${i + 1} and ${j + 1} both target section '${mod1.section}'`,
            resolution: 'Review modifications for compatibility or combine them'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect if two modifications create a breaking change
   */
  private detectBreakingChange(mod1: any, mod2: any): boolean {
    // Simple breaking change detection
    // In a real implementation, this would be more sophisticated
    
    // Check if one removes something the other depends on
    if (mod1.changeType === 'deletion' && mod2.changeType === 'addition') {
      // Could be breaking if the deletion affects the addition
      return mod1.section === mod2.section;
    }

    // Check for conflicting modifications to the same content
    if (mod1.section === mod2.section && 
        mod1.changeType === 'modification' && 
        mod2.changeType === 'modification') {
      return true; // Potentially conflicting modifications
    }

    return false;
  }

  // Agent-specific validation methods

  /**
   * Validate requirements-specific modifications
   */
  private async validateRequirementsModification(modification: any): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for proper user story format
    if (modification.content && modification.content.includes('user story')) {
      if (!modification.content.includes('As a') || 
          !modification.content.includes('I want') || 
          !modification.content.includes('so that')) {
        issues.push({
          id: 'invalid-user-story-format',
          severity: 'warning',
          message: 'User story does not follow "As a... I want... so that..." format',
          code: 'INVALID_USER_STORY_FORMAT',
          source: 'spec-requirements-validator',
          suggestedFix: 'Reformat using standard user story template'
        });
      }
    }

    // Check for acceptance criteria format
    if (modification.content && modification.content.includes('acceptance criteria')) {
      if (!modification.content.includes('WHEN') && 
          !modification.content.includes('IF') && 
          !modification.content.includes('THEN')) {
        issues.push({
          id: 'missing-acceptance-criteria-structure',
          severity: 'warning',
          message: 'Acceptance criteria should include WHEN/IF/THEN statements',
          code: 'MISSING_ACCEPTANCE_CRITERIA_STRUCTURE',
          source: 'spec-requirements-validator',
          suggestedFix: 'Add structured WHEN/IF/THEN statements to acceptance criteria'
        });
      }
    }

    return issues;
  }

  /**
   * Validate design-specific modifications
   */
  private async validateDesignModification(modification: any): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for architecture diagrams
    if (modification.content && modification.content.includes('architecture')) {
      if (!modification.content.includes('```mermaid')) {
        issues.push({
          id: 'missing-architecture-diagram',
          severity: 'info',
          message: 'Architecture section could benefit from a Mermaid diagram',
          code: 'MISSING_ARCHITECTURE_DIAGRAM',
          source: 'spec-design-validator',
          suggestedFix: 'Add Mermaid diagram to visualize architecture'
        });
      }
    }

    // Check component specifications
    if (modification.content && modification.content.includes('component')) {
      if (modification.content.length < 100) {
        issues.push({
          id: 'insufficient-component-detail',
          severity: 'warning',
          message: 'Component description appears too brief',
          code: 'INSUFFICIENT_COMPONENT_DETAIL',
          source: 'spec-design-validator',
          suggestedFix: 'Expand component description with interfaces and responsibilities'
        });
      }
    }

    return issues;
  }

  /**
   * Validate task-specific modifications
   */
  private async validateTaskModification(modification: any): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check task atomicity
    if (modification.content && modification.content.length > 1000) {
      issues.push({
        id: 'task-too-large',
        severity: 'warning',
        message: 'Task appears too large and should be broken down',
        code: 'TASK_TOO_LARGE',
        source: 'spec-task-validator',
        suggestedFix: 'Break task into smaller, atomic units'
      });
    }

    // Check for success criteria
    if (modification.content && !modification.content.includes('success criteria') && 
        !modification.content.includes('acceptance criteria')) {
      issues.push({
        id: 'missing-success-criteria',
        severity: 'info',
        message: 'Task lacks explicit success criteria',
        code: 'MISSING_SUCCESS_CRITERIA',
        source: 'spec-task-validator',
        suggestedFix: 'Add clear success criteria to the task'
      });
    }

    return issues;
  }

  /**
   * Validate completion-related modifications
   */
  private async validateCompletionModification(modification: any, phase: SpecPhase): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check if modification improves or reduces completeness
    if (modification.changeType === 'deletion') {
      issues.push({
        id: 'completeness-reduction-warning',
        severity: 'warning',
        message: `Deletion in ${phase} phase may reduce completeness`,
        code: 'COMPLETENESS_REDUCTION_WARNING',
        source: 'spec-completion-reviewer',
        suggestedFix: 'Ensure deletion does not remove essential information'
      });
    }

    // Check for content quality
    if (modification.content && modification.content.length < 50) {
      issues.push({
        id: 'insufficient-content',
        severity: 'info',
        message: 'Modification content appears brief, consider expanding',
        code: 'INSUFFICIENT_CONTENT',
        source: 'spec-completion-reviewer',
        suggestedFix: 'Expand content with additional detail and context'
      });
    }

    return issues;
  }

  /**
   * Validate for breaking changes
   */
  private async validateBreakingChanges(modification: any, phase: SpecPhase): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for potentially breaking modifications
    if (modification.changeType === 'deletion') {
      issues.push({
        id: 'potential-breaking-deletion',
        severity: 'warning',
        message: 'Deletion may break dependent phases or implementations',
        code: 'POTENTIAL_BREAKING_DELETION',
        source: 'spec-breaking-change-detector',
        suggestedFix: 'Review impact on dependent components before applying'
      });
    }

    // Check for major modifications
    if (modification.changeType === 'modification' && modification.content && 
        modification.content.length > 500) {
      issues.push({
        id: 'major-modification-warning',
        severity: 'info',
        message: 'Large modification may require review of dependent phases',
        code: 'MAJOR_MODIFICATION_WARNING',
        source: 'spec-breaking-change-detector',
        suggestedFix: 'Review downstream impact of this modification'
      });
    }

    return issues;
  }

  /**
   * Generic validation for unknown agents
   */
  private async validateGenericModification(modification: any, agentName: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Basic validation that any agent can perform
    if (!modification.content || modification.content.trim().length === 0) {
      issues.push({
        id: 'empty-modification',
        severity: 'error',
        message: 'Modification contains no content',
        code: 'EMPTY_MODIFICATION',
        source: agentName,
        suggestedFix: 'Add meaningful content to the modification'
      });
    }

    return issues;
  }
}