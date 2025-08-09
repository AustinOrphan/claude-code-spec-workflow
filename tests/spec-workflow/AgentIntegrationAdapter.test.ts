/**
 * Tests for AgentIntegrationAdapter - Agent-based content analysis
 */

import { AgentIntegrationAdapter, AnalysisResult } from '../../src/spec-workflow/AgentIntegrationAdapter';
import { ParsedContent, SpecPhase } from '../../src/spec-workflow/types/ParsedContent';

describe('AgentIntegrationAdapter', () => {
  let adapter: AgentIntegrationAdapter;
  let mockContent: ParsedContent;

  beforeEach(() => {
    adapter = new AgentIntegrationAdapter();
    
    mockContent = {
      phase: 'requirements',
      sections: [
        {
          id: 'user-story-1',
          title: 'User Authentication',
          content: 'As a user, I want to log in so that I can access my account',
          sectionType: 'user-story',
          modifiable: true,
          lineRange: [1, 5]
        },
        {
          id: 'acceptance-criteria-1',
          title: 'Login Acceptance Criteria',
          content: 'WHEN user provides valid credentials THEN they are logged in',
          sectionType: 'acceptance-criteria',
          modifiable: true,
          lineRange: [6, 10]
        }
      ],
      metadata: {
        filePath: '/test/requirements.md',
        fileSize: 1024,
        lastModified: new Date(),
        totalLines: 20,
        encoding: 'utf8',
        isDirty: false
      },
      qualityMetrics: {
        templateCompliance: 85,
        completeness: 90,
        validationStatus: 'pass',
        lastModified: new Date(),
        approvalStatus: false,
        issueCount: 0,
        confidenceScore: 85
      },
      rawContent: 'Mock content for testing',
      parseSuccess: true,
      parseErrors: []
    };
  });

  describe('analyzeWithAgents', () => {
    it('should analyze requirements phase with appropriate agents', async () => {
      const result = await adapter.analyzeWithAgents(mockContent, 'requirements');

      expect(result.status).toBeDefined();
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.participatingAgents).toContain('spec-requirements-validator');
      expect(result.participatingAgents).toContain('spec-completion-reviewer');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should analyze design phase with appropriate agents', async () => {
      const designContent = { ...mockContent, phase: 'design' as SpecPhase };
      const result = await adapter.analyzeWithAgents(designContent, 'design');

      expect(result.participatingAgents).toContain('spec-design-validator');
      expect(result.participatingAgents).toContain('spec-duplication-detector');
      expect(result.status).toBeDefined();
    });

    it('should analyze tasks phase with appropriate agents', async () => {
      const tasksContent = { ...mockContent, phase: 'tasks' as SpecPhase };
      const result = await adapter.analyzeWithAgents(tasksContent, 'tasks');

      expect(result.participatingAgents).toContain('spec-task-validator');
      expect(result.participatingAgents).toContain('spec-completion-reviewer');
      expect(result.status).toBeDefined();
    });

    it('should identify issues with poorly formatted user stories', async () => {
      const poorContent = {
        ...mockContent,
        sections: [
          {
            id: 'user-story-bad',
            title: 'Bad User Story',
            content: 'User wants to login', // Missing proper format
            sectionType: 'user-story' as const,
            modifiable: true,
            lineRange: [1, 5] as [number, number]
          }
        ]
      };

      const result = await adapter.analyzeWithAgents(poorContent, 'requirements');
      
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'user-story-format',
            severity: 'medium'
          })
        ])
      );
    });

    it('should provide recommendations for low completeness', async () => {
      const lowCompletenessContent = {
        ...mockContent,
        qualityMetrics: {
          ...mockContent.qualityMetrics,
          completeness: 65 // Below threshold
        }
      };

      const result = await adapter.analyzeWithAgents(lowCompletenessContent, 'requirements');
      
      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'improve-completeness',
            priority: 'high'
          })
        ])
      );
    });

    it('should handle agent failures gracefully', async () => {
      const adapter = new AgentIntegrationAdapter({
        timeout: 1 // Very short timeout to force failures
      });

      const result = await adapter.analyzeWithAgents(mockContent, 'requirements');
      
      // Should still return a valid result even if agents fail
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(typeof result.qualityScore).toBe('number');
    });

    it('should calculate quality scores correctly', async () => {
      const highQualityContent = {
        ...mockContent,
        qualityMetrics: {
          ...mockContent.qualityMetrics,
          templateCompliance: 95,
          completeness: 95
        }
      };

      const result = await adapter.analyzeWithAgents(highQualityContent, 'requirements');
      
      expect(result.qualityScore).toBeGreaterThan(80);
    });

    it('should detect design-specific issues', async () => {
      const designContent: ParsedContent = {
        phase: 'design',
        sections: [
          {
            id: 'architecture',
            title: 'System Architecture',
            content: 'Basic architecture description', // Missing diagrams
            sectionType: 'other',
            modifiable: true,
            lineRange: [1, 5]
          }
        ],
        metadata: mockContent.metadata,
        qualityMetrics: mockContent.qualityMetrics,
        rawContent: 'Basic architecture description',
        parseSuccess: true,
        parseErrors: []
      };

      const result = await adapter.analyzeWithAgents(designContent, 'design');
      
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'missing-architecture-diagrams',
            severity: 'high'
          })
        ])
      );
    });

    it('should provide consistent agent responses', async () => {
      const result1 = await adapter.analyzeWithAgents(mockContent, 'requirements');
      const result2 = await adapter.analyzeWithAgents(mockContent, 'requirements');

      // Should have consistent agent participation
      expect(result1.participatingAgents.sort()).toEqual(result2.participatingAgents.sort());
      expect(result1.status).toBe(result2.status);
    });
  });

  describe('configuration', () => {
    it('should respect custom configuration', () => {
      const customAdapter = new AgentIntegrationAdapter({
        timeout: 5000,
        maxRetries: 3,
        continueOnFailure: false
      });

      const config = customAdapter.getConfig();
      expect(config.timeout).toBe(5000);
      expect(config.maxRetries).toBe(3);
      expect(config.continueOnFailure).toBe(false);
    });

    it('should allow configuration updates', () => {
      adapter.updateConfig({ timeout: 15000 });
      
      const config = adapter.getConfig();
      expect(config.timeout).toBe(15000);
    });
  });

  describe('checkAgentAvailability', () => {
    it('should report agent availability', async () => {
      const availability = await adapter.checkAgentAvailability();
      
      expect(availability.available).toBe(true);
      expect(Array.isArray(availability.availableAgents)).toBe(true);
      expect(availability.availableAgents.length).toBeGreaterThan(0);
      expect(availability.availableAgents).toContain('spec-requirements-validator');
      expect(availability.availableAgents).toContain('spec-design-validator');
      expect(availability.availableAgents).toContain('spec-task-validator');
    });
  });
});