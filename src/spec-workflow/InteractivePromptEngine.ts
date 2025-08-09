import inquirer from 'inquirer';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import * as path from 'path';
import { ContentSection, ContentMetadata, QualityMetrics } from './types/ParsedContent';
import { ModificationMenu, ModificationChoice, ModificationData, ModificationAction, ImpactAnalysis } from './types/ModificationMenu';
import { ModificationPreview, ChangeRecord, ChangeType, ValidationResult, RiskAssessment, ModificationStatistics } from './types/ModificationPreview';
import { SpecState } from './SpecStateDetector';

/**
 * InteractivePromptEngine - Handles all user interaction, prompts, and input collection
 * 
 * This class provides the user interface layer for the interactive spec modification system.
 * It uses Inquirer.js for interactive prompts, Chalk for colorized output, and Ora for 
 * progress indicators, following the established patterns from the CLI system.
 * 
 * The class is responsible for:
 * - Displaying specification content in a readable format with sections and quality metrics
 * - Presenting modification menus with keyboard navigation and numbered selections
 * - Collecting user input for various modification types with validation
 * - Showing change previews and requiring explicit confirmation before applying changes
 * - Providing consistent visual feedback and error handling throughout the workflow
 */
export class InteractivePromptEngine {
  private spinner: Ora | null = null;

  /**
   * Display content sections with quality metrics and metadata
   * 
   * Formats and displays specification content in readable sections using Chalk for
   * syntax highlighting and visual organization. Shows quality metrics like template
   * compliance, completeness percentage, and validation status.
   * 
   * Enhanced to include SpecStateDetector analysis for comprehensive workflow context.
   * 
   * @param sections - Array of modifiable sections to display
   * @param metadata - Content metadata including last modified date and approval status
   * @param qualityMetrics - Quality assessment data including scores and validation results
   * @param specState - Optional SpecStateDetector analysis for enhanced context display
   */
  showContentSections(
    sections: ContentSection[], 
    metadata: ContentMetadata, 
    qualityMetrics: QualityMetrics,
    specState?: SpecState | null
  ): void {
    // Display header with file information
    this.displaySectionHeader(
      '📄 Specification Content',
      `${path.basename(metadata.filePath)} • ${metadata.totalLines} lines • Last modified: ${metadata.lastModified.toLocaleString()}`
    );

    // Display quality metrics summary
    console.log(chalk.bold('\n📊 Quality Metrics'));
    console.log(chalk.gray('─'.repeat(20)));
    
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'pass': return chalk.green;
        case 'warning': return chalk.yellow;
        case 'error': return chalk.red;
        default: return chalk.gray;
      }
    };

    const getScoreColor = (score: number) => {
      if (score >= 80) return chalk.green;
      if (score >= 60) return chalk.yellow;
      return chalk.red;
    };

    console.log(`${chalk.cyan('Template Compliance:')} ${getScoreColor(qualityMetrics.templateCompliance)(`${qualityMetrics.templateCompliance}%`)}`);
    console.log(`${chalk.cyan('Completeness:')} ${getScoreColor(qualityMetrics.completeness)(`${qualityMetrics.completeness}%`)}`);
    console.log(`${chalk.cyan('Validation Status:')} ${getStatusColor(qualityMetrics.validationStatus)(qualityMetrics.validationStatus.toUpperCase())}`);
    console.log(`${chalk.cyan('Approval Status:')} ${qualityMetrics.approvalStatus ? chalk.green('✓ APPROVED') : chalk.yellow('⏳ PENDING')}`);
    
    if (qualityMetrics.issueCount > 0) {
      console.log(`${chalk.cyan('Issues Found:')} ${chalk.red(`${qualityMetrics.issueCount} issue${qualityMetrics.issueCount === 1 ? '' : 's'}`)}`);
    }
    
    console.log(`${chalk.cyan('Confidence Score:')} ${getScoreColor(qualityMetrics.confidenceScore)(`${qualityMetrics.confidenceScore}%`)}`);
    
    if (metadata.isDirty) {
      console.log(chalk.yellow('\n⚠️  File has unsaved changes'));
    }

    // Display enhanced state information if available
    if (specState) {
      this.displaySpecificationState(specState);
    }

    // Display content sections
    this.displaySectionHeader('\n📝 Content Sections', `${sections.length} section${sections.length === 1 ? '' : 's'} available`);
    
    if (sections.length === 0) {
      console.log(chalk.gray('No modifiable sections found in this specification.'));
      return;
    }

    sections.forEach((section, index) => {
      console.log(chalk.bold(`\n${index + 1}. ${section.title}`));
      
      // Section metadata
      const sectionMeta = [
        chalk.cyan(`Type: ${section.sectionType}`),
        chalk.gray(`Lines ${section.lineRange[0]}-${section.lineRange[1]}`),
        section.modifiable ? chalk.green('✓ Modifiable') : chalk.red('✗ Read-only')
      ].join(' • ');
      
      console.log(sectionMeta);
      
      // Content preview (first 200 characters)
      const preview = section.content.trim();
      const truncated = preview.length > 200 ? preview.substring(0, 200) + '...' : preview;
      
      console.log(chalk.gray('─'.repeat(60)));
      console.log(truncated);
      
      if (preview !== truncated) {
        console.log(chalk.gray(`[${preview.length - 200} more characters]`));
      }
    });

    // Footer with navigation hints
    console.log(chalk.gray('\n' + '─'.repeat(80)));
    console.log(chalk.blue('💡 Use the modification menu to edit these sections'));
  }

  /**
   * Present modification menu with interactive selection
   * 
   * Creates an Inquirer.js menu with numbered options for modification actions and
   * AI-generated suggestions. Supports keyboard navigation and provides clear
   * descriptions for each available action.
   * 
   * @param menu - ModificationMenu containing available actions and suggestions
   * @returns Promise resolving to the user's menu selection
   */
  async presentModificationMenu(menu: ModificationMenu): Promise<ModificationChoice> {
    // Clear screen for better menu presentation
    this.clearConsole();
    
    // Display menu header with context
    this.displaySectionHeader(
      `🛠️  ${menu.phase.toUpperCase()} Phase Modifications`,
      `${menu.context.specName} • Status: ${menu.context.phaseStatus} • Modified: ${menu.context.lastModified.toLocaleString()}`
    );

    // Show approval status and restrictions
    if (menu.context.approved) {
      console.log(chalk.green('✅ Phase approved') + chalk.gray(' • Changes may require re-approval'));
    } else {
      console.log(chalk.yellow('⏳ Approval pending') + chalk.gray(' • Changes can be made freely'));
    }

    if (menu.restrictions.length > 0) {
      console.log(chalk.red('🚫 Restrictions:'));
      menu.restrictions.forEach(restriction => {
        console.log(chalk.gray(`   • ${restriction}`));
      });
    }

    if (menu.hasApprovalRequired) {
      console.log(chalk.blue('ℹ️  Some actions require stakeholder approval'));
    }

    console.log(); // Add spacing

    // Prepare menu choices
    const choices: any[] = [];

    // Add section separator for actions
    if (menu.actions.length > 0) {
      choices.push(new inquirer.Separator(chalk.cyan('📋 Available Actions')));
      
      // Add each action as a choice
      menu.actions.forEach((action, index) => {
        const prefix = `${index + 1}.`;
        const shortcut = action.shortcut ? chalk.gray(` (${action.shortcut})`) : '';
        const approval = action.requiresApproval ? chalk.blue(' 👤') : '';
        const disabled = !action.enabled ? chalk.red(' ❌') : '';
        
        let name = `${prefix} ${action.label}${shortcut}${approval}${disabled}`;
        let description = action.description;
        
        if (!action.enabled && action.disabledReason) {
          description += ` (${action.disabledReason})`;
          name = chalk.gray(name);
        }
        
        choices.push({
          name: name,
          value: { type: 'action', action },
          disabled: !action.enabled ? action.disabledReason || 'Action not available' : false
        });
      });
    }

    // Add section separator for suggestions
    if (menu.suggestions.length > 0) {
      choices.push(new inquirer.Separator(chalk.yellow('💡 AI Suggestions')));
      
      // Add each suggestion as a choice
      menu.suggestions.forEach((suggestion, index) => {
        const prefix = `S${index + 1}.`;
        const confidence = chalk.gray(`${suggestion.confidence}%`);
        const priority = this.getPriorityIcon(suggestion.priority);
        const agent = chalk.gray(`[${suggestion.agentSource}]`);
        
        const name = `${prefix} ${suggestion.title} ${priority} ${confidence} ${agent}`;
        
        choices.push({
          name: name,
          value: { type: 'suggestion', suggestion }
        });
      });
    }

    // Add separator and exit option
    choices.push(new inquirer.Separator(chalk.gray('───────────────────')));
    choices.push({
      name: '0. Cancel / Go Back',
      value: { type: 'cancel' }
    });

    // Handle case where no actions or suggestions are available
    if (menu.actions.length === 0 && menu.suggestions.length === 0) {
      console.log(chalk.yellow('No modification options are currently available for this phase.'));
      console.log(chalk.gray('This may be due to:'));
      console.log(chalk.gray('  • Phase restrictions'));
      console.log(chalk.gray('  • User permissions'));
      console.log(chalk.gray('  • Content analysis in progress'));
      console.log();
      
      const { continue: shouldContinue } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continue',
          message: 'Would you like to return to the main menu?',
          default: true
        }
      ]);
      
      if (shouldContinue) {
        return { type: 'cancel' };
      } else {
        process.exit(0);
      }
    }

    try {
      // Present the interactive menu
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: 'Select a modification option:',
          choices: choices,
          pageSize: Math.min(choices.length, 15), // Limit visible options for better UX
          loop: false // Prevent wrapping at ends for cleaner navigation
        }
      ]);

      // Handle the user's selection
      const choice = answers.choice as ModificationChoice;
      
      // Display confirmation of selection
      if (choice.type === 'action' && choice.action) {
        console.log(chalk.green(`Selected action: ${choice.action.label}`));
        if (choice.action.requiresApproval) {
          console.log(chalk.blue('ℹ️  This action will require stakeholder approval'));
        }
      } else if (choice.type === 'suggestion' && choice.suggestion) {
        console.log(chalk.yellow(`Selected suggestion: ${choice.suggestion.title}`));
        console.log(chalk.gray(`Rationale: ${choice.suggestion.rationale}`));
        console.log(chalk.gray(`Estimated effort: ${choice.suggestion.estimatedEffort || 'Not specified'}`));
      } else if (choice.type === 'cancel') {
        console.log(chalk.gray('Operation cancelled'));
      }

      return choice;
      
    } catch (error) {
      // Handle Ctrl+C or other interruption
      if (error && typeof error === 'object' && 'isTtyError' in error) {
        console.log(chalk.yellow('\nMenu interrupted - operation cancelled'));
        return { type: 'cancel' };
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Collect modification input through guided prompts
   * 
   * Provides context-aware input prompts based on the selected modification action.
   * Includes real-time validation, template-guided forms for new content, and
   * incremental editing support for existing content modifications.
   * 
   * @param action - The modification action selected by the user
   * @param currentContent - Current content for modification (if editing existing)
   * @returns Promise resolving to collected modification data
   */
  async collectModificationInput(
    action: ModificationAction, 
    currentContent?: string
  ): Promise<ModificationData> {
    this.displaySectionHeader(
      `📝 ${action.label}`,
      `Action: ${action.actionType} • Target: ${action.targetSection || 'General'}`
    );

    // Show action description and requirements
    console.log(chalk.cyan('Description:'));
    console.log(chalk.gray(action.description));

    if (action.requiresApproval) {
      console.log(chalk.blue('\n👤 This action requires stakeholder approval after completion'));
    }

    console.log(); // Add spacing

    try {
      // Collect basic information
      const basicInfo = await this.collectBasicInformation(action);
      
      // Collect action-specific content based on the action type
      const content = await this.collectActionSpecificContent(action, currentContent);
      
      // Collect optional metadata
      const metadata = await this.collectOptionalMetadata();

      // Build and return the modification data
      const modificationData: ModificationData = {
        action,
        content,
        targetSection: basicInfo.targetSection || action.targetSection,
        position: basicInfo.position,
        metadata: {
          author: basicInfo.author || process.env.USER || 'Unknown User',
          timestamp: new Date(),
          reason: metadata.reason,
          relatedId: metadata.relatedId
        }
      };

      // Display summary for confirmation
      this.displayInputSummary(modificationData);

      return modificationData;

    } catch (error) {
      // Handle cancellation or errors
      if (error && typeof error === 'object' && 'isTtyError' in error) {
        console.log(chalk.yellow('Input collection cancelled'));
        throw new Error('User cancelled input collection');
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Display change preview and collect confirmation
   * 
   * Shows a diff-style preview of proposed changes with clear visual indicators
   * for additions, modifications, and deletions. Includes impact analysis and
   * requires explicit user confirmation before changes are applied.
   * 
   * @param preview - ModificationPreview containing change details and impact analysis
   * @returns Promise resolving to boolean indicating user's confirmation decision
   */
  async confirmChanges(preview: ModificationPreview): Promise<boolean> {
    // Clear screen for better preview presentation
    this.clearConsole();
    
    // Display preview header with summary
    this.displaySectionHeader(
      '🔍 Change Preview',
      `${preview.statistics.totalChanges} change${preview.statistics.totalChanges === 1 ? '' : 's'} • ${preview.statistics.sectionsAffected} section${preview.statistics.sectionsAffected === 1 ? '' : 's'} affected • ${preview.changeSummary}`
    );

    // Display modification statistics
    this.displayModificationStatistics(preview.statistics);

    // Check for blocking issues
    if (preview.blockingIssues.length > 0) {
      console.log(chalk.red('\n🚫 Blocking Issues'));
      console.log(chalk.gray('─'.repeat(20)));
      preview.blockingIssues.forEach((issue, index) => {
        console.log(`${chalk.red(`${index + 1}.`)} ${issue}`);
      });
      console.log(chalk.red('\nThese issues must be resolved before changes can be applied.'));
      
      const { continueAnyway } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueAnyway',
          message: 'Continue with preview despite blocking issues?',
          default: false
        }
      ]);
      
      if (!continueAnyway) {
        return false;
      }
    }

    // Display warnings if any
    if (preview.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings'));
      console.log(chalk.gray('─'.repeat(20)));
      preview.warnings.forEach((warning, index) => {
        console.log(`${chalk.yellow(`${index + 1}.`)} ${warning}`);
      });
    }

    // Display risk assessment
    this.displayRiskAssessment(preview.riskAssessment);

    // Display detailed changes with diff formatting
    this.displayDetailedChanges(preview.changes);

    // Display validation results
    this.displayValidationResults(preview.validationResults);

    // Display impact analysis
    this.displayImpactAnalysis(preview.impactAnalysis);

    // Show final safety assessment
    console.log(chalk.bold('\n📋 Safety Assessment'));
    console.log(chalk.gray('─'.repeat(20)));
    
    const safetyColor = preview.safeToApply ? chalk.green : chalk.red;
    const safetyStatus = preview.safeToApply ? '✅ SAFE TO APPLY' : '❌ NOT SAFE TO APPLY';
    console.log(`${chalk.cyan('Status:')} ${safetyColor(safetyStatus)}`);
    console.log(`${chalk.cyan('Ready for Application:')} ${preview.readyForApplication ? chalk.green('✓ Yes') : chalk.red('✗ No')}`);
    console.log(`${chalk.cyan('Requires Backup:')} ${preview.riskAssessment.requiresBackup ? chalk.yellow('⚠️  Yes') : chalk.gray('No')}`);
    console.log(`${chalk.cyan('Requires Review:')} ${preview.riskAssessment.recommendsReview ? chalk.yellow('⚠️  Yes') : chalk.gray('No')}`);

    // Display cascading changes warning
    if (preview.hasCascadingChanges) {
      console.log(chalk.yellow('\n🔗 This modification includes cascading changes that may affect other parts of the specification.'));
    }

    // Show estimated application time
    if (preview.statistics.estimatedApplyTime > 0) {
      const timeStr = preview.statistics.estimatedApplyTime > 60000 
        ? `${Math.round(preview.statistics.estimatedApplyTime / 60000)}m ${Math.round((preview.statistics.estimatedApplyTime % 60000) / 1000)}s`
        : `${Math.round(preview.statistics.estimatedApplyTime / 1000)}s`;
      console.log(`${chalk.cyan('Estimated Apply Time:')} ${timeStr}`);
    }

    // Final confirmation prompt
    console.log(chalk.bold('\n🔒 Confirmation Required'));
    console.log(chalk.gray('─'.repeat(25)));
    
    if (!preview.safeToApply) {
      console.log(chalk.red('⚠️  WARNING: Changes have been marked as potentially unsafe.'));
      console.log(chalk.red('   Proceeding may cause issues with your specification.'));
      console.log();
    }

    if (preview.riskAssessment.overallRisk === 'high' || preview.riskAssessment.overallRisk === 'critical') {
      console.log(chalk.red(`⚠️  HIGH RISK: This modification has been assessed as ${preview.riskAssessment.overallRisk} risk.`));
      console.log(chalk.red('   Carefully review all changes before proceeding.'));
      console.log();
    }

    // Multi-step confirmation for high-risk changes
    if (preview.riskAssessment.overallRisk === 'critical' || !preview.safeToApply) {
      const { acknowledgeRisk } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'acknowledgeRisk',
          message: chalk.red('I understand the risks and want to proceed anyway'),
          default: false
        }
      ]);
      
      if (!acknowledgeRisk) {
        console.log(chalk.gray('Operation cancelled for safety.'));
        return false;
      }
    }

    // Final confirmation
    const confirmationMessage = preview.safeToApply 
      ? 'Apply these changes to the specification?'
      : 'Apply these potentially unsafe changes? (This action cannot be undone)';

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: confirmationMessage,
        default: preview.safeToApply ? true : false
      }
    ]);

    if (confirmed) {
      console.log(chalk.green('\n✅ Changes confirmed and will be applied.'));
      
      if (preview.riskAssessment.requiresBackup) {
        console.log(chalk.blue('💾 Backup will be created before applying changes.'));
      }
    } else {
      console.log(chalk.gray('\n❌ Changes cancelled by user.'));
    }

    return confirmed;
  }

  /**
   * Collect basic information for the modification
   * 
   * @param action - The modification action being performed
   * @returns Promise resolving to basic information
   */
  private async collectBasicInformation(action: ModificationAction): Promise<{
    targetSection?: string;
    position?: number;
    author?: string;
  }> {
    const questions: any[] = [];

    // If action doesn't have a specific target section, ask user to specify
    if (!action.targetSection && (action.actionType === 'add' || action.actionType === 'modify')) {
      questions.push({
        type: 'input',
        name: 'targetSection',
        message: 'Target section (leave empty for general):',
        default: '',
        validate: (input: string) => {
          if (input.trim().length > 100) {
            return 'Section name should not exceed 100 characters';
          }
          return true;
        }
      });
    }

    // For add actions, ask about position
    if (action.actionType === 'add') {
      questions.push({
        type: 'list',
        name: 'positionChoice',
        message: 'Where should the new content be placed?',
        choices: [
          { name: 'At the beginning of the section', value: 'beginning' },
          { name: 'At the end of the section', value: 'end' },
          { name: 'At a specific position', value: 'specific' }
        ],
        default: 'end'
      });
    }

    // Ask for author if not available from environment
    if (!process.env.USER && !process.env.USERNAME) {
      questions.push({
        type: 'input',
        name: 'author',
        message: 'Your name (for modification tracking):',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Author name is required';
          }
          return true;
        }
      });
    }

    if (questions.length === 0) {
      return {};
    }

    const answers = await inquirer.prompt(questions);

    // Handle position selection
    let position: number | undefined;
    if (answers.positionChoice === 'beginning') {
      position = 0;
    } else if (answers.positionChoice === 'specific') {
      const positionAnswer = await inquirer.prompt([{
        type: 'number',
        name: 'specificPosition',
        message: 'Enter position number (0 for beginning):',
        default: 0,
        validate: (input: number) => {
          if (input < 0) {
            return 'Position must be a non-negative number';
          }
          return true;
        }
      }]);
      position = positionAnswer.specificPosition;
    }

    return {
      targetSection: answers.targetSection?.trim() || undefined,
      position,
      author: answers.author?.trim()
    };
  }

  /**
   * Collect action-specific content based on modification type
   * 
   * @param action - The modification action being performed
   * @param currentContent - Existing content for modifications
   * @returns Promise resolving to content string
   */
  private async collectActionSpecificContent(action: ModificationAction, currentContent?: string): Promise<string> {
    switch (action.actionType) {
      case 'add':
        return await this.collectAddContent(action);
      
      case 'modify':
        return await this.collectModifyContent(action, currentContent);
      
      case 'delete':
        return await this.collectDeleteContent(action, currentContent);
      
      case 'reorder':
        return await this.collectReorderContent(action);
      
      default:
        throw new Error(`Unsupported action type: ${action.actionType}`);
    }
  }

  /**
   * Collect content for add operations
   * 
   * @param action - The modification action
   * @returns Promise resolving to new content
   */
  private async collectAddContent(action: ModificationAction): Promise<string> {
    console.log(chalk.cyan('\n📄 Content to Add'));
    console.log(chalk.gray('Enter the content you want to add. Press Ctrl+D when finished.'));
    
    const answers = await inquirer.prompt([
      {
        type: 'editor',
        name: 'content',
        message: 'Enter new content:',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Content cannot be empty';
          }
          if (input.length > 10000) {
            return 'Content is too long (max 10000 characters)';
          }
          return true;
        }
      }
    ]);

    return answers.content.trim();
  }

  /**
   * Collect content for modify operations
   * 
   * @param action - The modification action
   * @param currentContent - Existing content to modify
   * @returns Promise resolving to modified content
   */
  private async collectModifyContent(action: ModificationAction, currentContent?: string): Promise<string> {
    console.log(chalk.cyan('\n✏️  Content Modification'));
    
    if (currentContent) {
      console.log(chalk.gray('Current content:'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(currentContent.substring(0, 500) + (currentContent.length > 500 ? '\n... (truncated)' : ''));
      console.log(chalk.gray('─'.repeat(60)));
    }

    const modificationChoice = await inquirer.prompt([
      {
        type: 'list',
        name: 'method',
        message: 'How would you like to modify the content?',
        choices: [
          { name: 'Replace entire content', value: 'replace' },
          { name: 'Edit existing content', value: 'edit' },
          { name: 'Add to existing content', value: 'append' }
        ]
      }
    ]);

    let newContent: string;

    switch (modificationChoice.method) {
      case 'replace':
        const replaceAnswer = await inquirer.prompt([
          {
            type: 'editor',
            name: 'content',
            message: 'Enter replacement content:',
            default: currentContent || '',
            validate: (input: string) => {
              if (!input.trim()) {
                return 'Content cannot be empty';
              }
              return true;
            }
          }
        ]);
        newContent = replaceAnswer.content.trim();
        break;

      case 'edit':
        const editAnswer = await inquirer.prompt([
          {
            type: 'editor',
            name: 'content',
            message: 'Edit the content:',
            default: currentContent || '',
            validate: (input: string) => {
              if (!input.trim()) {
                return 'Content cannot be empty';
              }
              return true;
            }
          }
        ]);
        newContent = editAnswer.content.trim();
        break;

      case 'append':
        const appendAnswer = await inquirer.prompt([
          {
            type: 'editor',
            name: 'additional',
            message: 'Enter content to add:',
            validate: (input: string) => {
              if (!input.trim()) {
                return 'Additional content cannot be empty';
              }
              return true;
            }
          }
        ]);
        newContent = (currentContent || '') + '\n\n' + appendAnswer.additional.trim();
        break;

      default:
        throw new Error('Invalid modification method');
    }

    return newContent;
  }

  /**
   * Collect content for delete operations
   * 
   * @param action - The modification action
   * @param currentContent - Content to potentially delete
   * @returns Promise resolving to deletion confirmation
   */
  private async collectDeleteContent(action: ModificationAction, currentContent?: string): Promise<string> {
    console.log(chalk.red('\n🗑️  Content Deletion'));
    
    if (currentContent) {
      console.log(chalk.gray('Content to be deleted:'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(currentContent.substring(0, 500) + (currentContent.length > 500 ? '\n... (truncated)' : ''));
      console.log(chalk.gray('─'.repeat(60)));
    }

    const confirmationAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: chalk.red('Are you sure you want to delete this content? This action cannot be undone.'),
        default: false
      }
    ]);

    if (!confirmationAnswer.confirmed) {
      throw new Error('Deletion cancelled by user');
    }

    // For delete operations, return empty string to indicate deletion
    return '';
  }

  /**
   * Collect content for reorder operations
   * 
   * @param action - The modification action
   * @returns Promise resolving to reorder instructions
   */
  private async collectReorderContent(action: ModificationAction): Promise<string> {
    console.log(chalk.yellow('\n🔀 Content Reordering'));
    console.log(chalk.gray('Specify how you want to reorder the content.'));

    const reorderAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'instructions',
        message: 'Describe the new order or provide specific instructions:',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Reorder instructions cannot be empty';
          }
          return true;
        }
      }
    ]);

    return reorderAnswer.instructions.trim();
  }

  /**
   * Collect optional metadata for the modification
   * 
   * @returns Promise resolving to metadata
   */
  private async collectOptionalMetadata(): Promise<{
    reason?: string;
    relatedId?: string;
  }> {
    console.log(chalk.blue('\n📋 Additional Information (Optional)'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'reason',
        message: 'Reason for this modification (optional):',
        validate: (input: string) => {
          if (input.length > 500) {
            return 'Reason should not exceed 500 characters';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'relatedId',
        message: 'Related issue/requirement ID (optional):',
        validate: (input: string) => {
          if (input && !/^[a-zA-Z0-9\-_#]*$/.test(input)) {
            return 'ID can only contain letters, numbers, hyphens, underscores, and hash symbols';
          }
          return true;
        }
      }
    ]);

    return {
      reason: answers.reason?.trim() || undefined,
      relatedId: answers.relatedId?.trim() || undefined
    };
  }

  /**
   * Display a summary of collected input for confirmation
   * 
   * @param data - The collected modification data
   */
  private displayInputSummary(data: ModificationData): void {
    console.log(chalk.green('\n✅ Input Collection Complete'));
    console.log(chalk.gray('─'.repeat(40)));
    
    console.log(`${chalk.cyan('Action:')} ${data.action.label}`);
    console.log(`${chalk.cyan('Type:')} ${data.action.actionType}`);
    
    if (data.targetSection) {
      console.log(`${chalk.cyan('Target Section:')} ${data.targetSection}`);
    }
    
    if (data.position !== undefined) {
      console.log(`${chalk.cyan('Position:')} ${data.position}`);
    }
    
    console.log(`${chalk.cyan('Author:')} ${data.metadata.author}`);
    console.log(`${chalk.cyan('Timestamp:')} ${data.metadata.timestamp.toLocaleString()}`);
    
    if (data.metadata.reason) {
      console.log(`${chalk.cyan('Reason:')} ${data.metadata.reason}`);
    }
    
    if (data.metadata.relatedId) {
      console.log(`${chalk.cyan('Related ID:')} ${data.metadata.relatedId}`);
    }

    console.log(chalk.cyan('\nContent Preview:'));
    console.log(chalk.gray('─'.repeat(60)));
    const contentPreview = data.content.length > 300 
      ? data.content.substring(0, 300) + '\n... (truncated)'
      : data.content;
    console.log(contentPreview);
    console.log(chalk.gray('─'.repeat(60)));

    if (data.action.requiresApproval) {
      console.log(chalk.blue('\n👤 Remember: This modification will require stakeholder approval'));
    }
  }

  /**
   * Start a progress spinner with message
   * 
   * Utility method for showing progress indicators during long-running operations
   * like content analysis, validation, or file operations.
   * 
   * @param message - Message to display with the spinner
   */
  startSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.stop();
    }
    this.spinner = ora(message).start();
  }

  /**
   * Update progress spinner message
   * 
   * @param message - New message for the spinner
   */
  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  /**
   * Stop progress spinner with success message
   * 
   * @param message - Success message to display
   */
  succeedSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    }
  }

  /**
   * Stop progress spinner with failure message
   * 
   * @param message - Failure message to display
   */
  failSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  /**
   * Display informational message with consistent formatting
   * 
   * @param message - Message to display
   * @param type - Message type for color coding ('info', 'success', 'warning', 'error')
   */
  displayMessage(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    switch (type) {
      case 'success':
        console.log(chalk.green(message));
        break;
      case 'warning':
        console.log(chalk.yellow(message));
        break;
      case 'error':
        console.log(chalk.red(message));
        break;
      default:
        console.log(chalk.cyan(message));
    }
  }

  /**
   * Display section header with consistent formatting
   * 
   * @param title - Section title
   * @param subtitle - Optional subtitle
   */
  displaySectionHeader(title: string, subtitle?: string): void {
    console.log();
    console.log(chalk.cyan.bold(title));
    if (subtitle) {
      console.log(chalk.gray(subtitle));
    }
    console.log(chalk.gray('─'.repeat(Math.max(title.length, subtitle?.length || 0))));
  }

  /**
   * Clear the console for better user experience
   */
  clearConsole(): void {
    // Only clear in interactive environments
    if (process.stdout.isTTY) {
      console.clear();
    }
  }

  /**
   * Get priority icon for suggestions
   * 
   * @param priority - Priority level ('low', 'medium', 'high')
   * @returns Colored icon representing the priority
   */
  private getPriorityIcon(priority: 'low' | 'medium' | 'high'): string {
    switch (priority) {
      case 'high':
        return chalk.red('🔴');
      case 'medium':
        return chalk.yellow('🟡');
      case 'low':
        return chalk.green('🟢');
      default:
        return chalk.gray('⚪');
    }
  }

  /**
   * Display modification statistics in a formatted table
   * 
   * @param statistics - ModificationStatistics to display
   */
  private displayModificationStatistics(statistics: ModificationStatistics): void {
    console.log(chalk.bold('\n📊 Change Statistics'));
    console.log(chalk.gray('─'.repeat(20)));
    
    // Create a two-column layout for better readability
    const leftColumn = [
      `${chalk.cyan('Total Changes:')} ${statistics.totalChanges}`,
      `${chalk.cyan('Sections Affected:')} ${statistics.sectionsAffected}`,
      `${chalk.cyan('Change Percentage:')} ${statistics.changePercentage.toFixed(1)}%`
    ];

    const rightColumn = [
      `${chalk.green('+')} ${statistics.additions} ${chalk.red('-')} ${statistics.deletions} ${chalk.yellow('~')} ${statistics.modifications}`,
      `${chalk.cyan('Lines:')} +${statistics.linesAdded} -${statistics.linesRemoved} ~${statistics.linesModified}`,
      statistics.estimatedApplyTime > 0 
        ? `${chalk.cyan('Est. Time:')} ${Math.round(statistics.estimatedApplyTime / 1000)}s`
        : ''
    ];

    // Display columns side by side
    for (let i = 0; i < Math.max(leftColumn.length, rightColumn.length); i++) {
      const left = (leftColumn[i] || '').padEnd(40);
      const right = rightColumn[i] || '';
      if (left.trim() || right.trim()) {
        console.log(`${left} ${right}`);
      }
    }
  }

  /**
   * Display risk assessment information
   * 
   * @param riskAssessment - RiskAssessment to display
   */
  private displayRiskAssessment(riskAssessment: RiskAssessment): void {
    console.log(chalk.bold('\n⚠️  Risk Assessment'));
    console.log(chalk.gray('─'.repeat(20)));
    
    // Overall risk with appropriate color coding
    const getRiskColor = (risk: string) => {
      switch (risk) {
        case 'critical': return chalk.red;
        case 'high': return chalk.red;
        case 'medium': return chalk.yellow;
        case 'low': return chalk.green;
        default: return chalk.gray;
      }
    };

    const riskColor = getRiskColor(riskAssessment.overallRisk);
    console.log(`${chalk.cyan('Overall Risk:')} ${riskColor(riskAssessment.overallRisk.toUpperCase())}`);

    if (riskAssessment.risks.length > 0) {
      console.log(chalk.cyan('\nIdentified Risks:'));
      
      riskAssessment.risks.forEach((risk, index) => {
        const typeColor = getRiskColor(risk.type.includes('critical') ? 'critical' : 'medium');
        console.log(`  ${chalk.gray(`${index + 1}.`)} ${typeColor(risk.type.toUpperCase())}`);
        console.log(`     ${chalk.gray('Description:')} ${risk.description}`);
        console.log(`     ${chalk.gray('Probability:')} ${risk.probability}% ${chalk.gray('•')} ${chalk.gray('Impact:')} ${risk.impact}`);
        
        if (risk.mitigation.length > 0) {
          console.log(`     ${chalk.gray('Mitigation:')} ${risk.mitigation.join(', ')}`);
        }
        console.log();
      });
    }

    // Additional recommendations
    if (riskAssessment.recommendsReview) {
      console.log(chalk.yellow('👤 Manual review recommended'));
    }
    
    if (riskAssessment.requiresBackup) {
      console.log(chalk.blue('💾 Backup will be created automatically'));
    }
  }

  /**
   * Display detailed changes with diff-style formatting
   * 
   * @param changes - Array of ChangeRecord to display
   */
  private displayDetailedChanges(changes: ChangeRecord[]): void {
    console.log(chalk.bold('\n📝 Detailed Changes'));
    console.log(chalk.gray('─'.repeat(20)));

    if (changes.length === 0) {
      console.log(chalk.gray('No detailed changes to display.'));
      return;
    }

    // Group changes by section for better organization
    const changesBySection = changes.reduce((groups, change) => {
      const section = change.section || 'General';
      if (!groups[section]) {
        groups[section] = [];
      }
      groups[section].push(change);
      return groups;
    }, {} as Record<string, ChangeRecord[]>);

    // Display each section's changes
    Object.entries(changesBySection).forEach(([section, sectionChanges]) => {
      console.log(chalk.cyan.bold(`\n▶ ${section}`));
      
      sectionChanges.forEach((change, index) => {
        const changeIcon = this.getChangeIcon(change.changeType);
        const changeColor = this.getChangeColor(change.changeType);
        
        console.log(`\n  ${changeIcon} ${changeColor(change.description)}`);
        console.log(`    ${chalk.gray('Lines:')} ${change.lineNumbers[0]}-${change.lineNumbers[1]}`);
        
        // Show before/after content with diff formatting
        if (change.beforeContent && change.afterContent) {
          // Modification - show diff
          this.displayDiffContent(change.beforeContent, change.afterContent);
        } else if (change.beforeContent && !change.afterContent) {
          // Deletion - show removed content
          console.log(chalk.gray('    Removed:'));
          this.displayContentLines(change.beforeContent, 'deletion');
        } else if (!change.beforeContent && change.afterContent) {
          // Addition - show added content
          console.log(chalk.gray('    Added:'));
          this.displayContentLines(change.afterContent, 'addition');
        }

        if (!change.reversible) {
          console.log(chalk.yellow('    ⚠️  This change is not reversible'));
        }
      });
    });
  }

  /**
   * Display validation results
   * 
   * @param validationResults - ValidationResult to display
   */
  private displayValidationResults(validationResults: ValidationResult): void {
    console.log(chalk.bold('\n✅ Validation Results'));
    console.log(chalk.gray('─'.repeat(20)));
    
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'pass': return chalk.green;
        case 'warning': return chalk.yellow;
        case 'error': return chalk.red;
        default: return chalk.gray;
      }
    };

    const statusColor = getStatusColor(validationResults.status);
    console.log(`${chalk.cyan('Status:')} ${statusColor(validationResults.status.toUpperCase())}`);
    console.log(`${chalk.cyan('Score:')} ${this.getScoreColor(validationResults.score)(`${validationResults.score}%`)}`);
    console.log(`${chalk.cyan('Quality Check:')} ${validationResults.passesMinimumQuality ? chalk.green('✓ Pass') : chalk.red('✗ Fail')}`);
    console.log(`${chalk.cyan('Confidence:')} ${validationResults.confidence.toUpperCase()}`);

    if (validationResults.issues.length > 0) {
      console.log(chalk.cyan('\nValidation Issues:'));
      
      // Group issues by severity
      const issuesBySeverity = validationResults.issues.reduce((groups, issue) => {
        if (!groups[issue.severity]) {
          groups[issue.severity] = [];
        }
        groups[issue.severity].push(issue);
        return groups;
      }, {} as Record<string, typeof validationResults.issues>);

      // Display in order of severity
      (['error', 'warning', 'info'] as const).forEach(severity => {
        const issues = issuesBySeverity[severity];
        if (issues?.length > 0) {
          const severityColor = severity === 'error' ? chalk.red : severity === 'warning' ? chalk.yellow : chalk.cyan;
          console.log(`\n  ${severityColor(severity.toUpperCase())} (${issues.length}):`);
          
          issues.forEach((issue, index) => {
            console.log(`    ${chalk.gray(`${index + 1}.`)} ${issue.message}`);
            if (issue.line) {
              console.log(`        ${chalk.gray('Line:')} ${issue.line}${issue.column ? `:${issue.column}` : ''}`);
            }
            if (issue.suggestedFix) {
              console.log(`        ${chalk.gray('Fix:')} ${issue.suggestedFix}`);
            }
          });
        }
      });
    }

    if (!validationResults.completed) {
      console.log(chalk.yellow('\n⚠️  Validation incomplete'));
      if (validationResults.error) {
        console.log(chalk.red(`Error: ${validationResults.error}`));
      }
    }
  }

  /**
   * Display impact analysis
   * 
   * @param impactAnalysis - ImpactAnalysis to display
   */
  private displayImpactAnalysis(impactAnalysis: ImpactAnalysis): void {
    console.log(chalk.bold('\n🔗 Impact Analysis'));
    console.log(chalk.gray('─'.repeat(20)));
    
    console.log(`${chalk.cyan('Affected Phases:')} ${impactAnalysis.affectedPhases.join(', ') || 'None'}`);
    console.log(`${chalk.cyan('Approval Required:')} ${impactAnalysis.approvalRequired ? chalk.blue('Yes') : chalk.gray('No')}`);

    if (impactAnalysis.effortImpact !== undefined) {
      console.log(`${chalk.cyan('Effort Impact:')} ${impactAnalysis.effortImpact} hour${impactAnalysis.effortImpact === 1 ? '' : 's'}`);
    }

    if (impactAnalysis.timelineImpact) {
      console.log(`${chalk.cyan('Timeline Impact:')} ${impactAnalysis.timelineImpact}`);
    }

    if (impactAnalysis.cascadeWarnings.length > 0) {
      console.log(chalk.cyan('\nCascade Warnings:'));
      impactAnalysis.cascadeWarnings.forEach((warning, index) => {
        console.log(`  ${chalk.yellow(`${index + 1}.`)} ${warning}`);
      });
    }

    if (impactAnalysis.conflictRisks.length > 0) {
      console.log(chalk.cyan('\nPotential Conflicts:'));
      impactAnalysis.conflictRisks.forEach((risk, index) => {
        const severityColor = risk.severity === 'critical' ? chalk.red : 
                             risk.severity === 'high' ? chalk.red :
                             risk.severity === 'medium' ? chalk.yellow : chalk.green;
        
        console.log(`  ${chalk.gray(`${index + 1}.`)} ${severityColor(risk.severity.toUpperCase())} - ${risk.type}`);
        console.log(`      ${chalk.gray('Description:')} ${risk.description}`);
        
        if (risk.mitigation.length > 0) {
          console.log(`      ${chalk.gray('Mitigation:')} ${risk.mitigation.join(', ')}`);
        }
        
        if (risk.affectedPhases.length > 0) {
          console.log(`      ${chalk.gray('Affected Phases:')} ${risk.affectedPhases.join(', ')}`);
        }
      });
    }
  }

  /**
   * Get icon for change type
   * 
   * @param changeType - Type of change
   * @returns Icon character
   */
  private getChangeIcon(changeType: ChangeType): string {
    switch (changeType) {
      case 'addition': return chalk.green('+');
      case 'deletion': return chalk.red('-');
      case 'modification': return chalk.yellow('~');
      case 'move': return chalk.blue('↔');
      default: return chalk.gray('•');
    }
  }

  /**
   * Get color function for change type
   * 
   * @param changeType - Type of change
   * @returns Chalk color function
   */
  private getChangeColor(changeType: ChangeType): (text: string) => string {
    switch (changeType) {
      case 'addition': return chalk.green;
      case 'deletion': return chalk.red;
      case 'modification': return chalk.yellow;
      case 'move': return chalk.blue;
      default: return chalk.gray;
    }
  }

  /**
   * Get color function for score values
   * 
   * @param score - Numeric score (0-100)
   * @returns Chalk color function
   */
  private getScoreColor(score: number): (text: string) => string {
    if (score >= 80) return chalk.green;
    if (score >= 60) return chalk.yellow;
    return chalk.red;
  }

  /**
   * Display content lines with change formatting
   * 
   * @param content - Content to display
   * @param changeType - Type of change for color coding
   */
  private displayContentLines(content: string, changeType: 'addition' | 'deletion'): void {
    const lines = content.split('\n');
    const prefix = changeType === 'addition' ? chalk.green('+') : chalk.red('-');
    const color = changeType === 'addition' ? chalk.green : chalk.red;
    
    lines.slice(0, 5).forEach(line => { // Show max 5 lines
      console.log(`      ${prefix} ${color(line)}`);
    });
    
    if (lines.length > 5) {
      console.log(`      ${chalk.gray(`... and ${lines.length - 5} more line${lines.length - 5 === 1 ? '' : 's'}`)}`);
    }
  }

  /**
   * Display diff content for modifications
   * 
   * @param beforeContent - Content before changes
   * @param afterContent - Content after changes
   */
  private displayDiffContent(beforeContent: string, afterContent: string): void {
    const beforeLines = beforeContent.split('\n');
    const afterLines = afterContent.split('\n');
    
    console.log(chalk.gray('    Changes:'));
    
    // Simple diff - show before and after (up to 3 lines each)
    const maxLines = 3;
    
    if (beforeLines.length > 0) {
      console.log(chalk.gray('      Before:'));
      beforeLines.slice(0, maxLines).forEach(line => {
        console.log(`        ${chalk.red('-')} ${chalk.red(line)}`);
      });
      if (beforeLines.length > maxLines) {
        console.log(`        ${chalk.gray(`... ${beforeLines.length - maxLines} more line${beforeLines.length - maxLines === 1 ? '' : 's'}`)}`);
      }
    }
    
    if (afterLines.length > 0) {
      console.log(chalk.gray('      After:'));
      afterLines.slice(0, maxLines).forEach(line => {
        console.log(`        ${chalk.green('+')} ${chalk.green(line)}`);
      });
      if (afterLines.length > maxLines) {
        console.log(`        ${chalk.gray(`... ${afterLines.length - maxLines} more line${afterLines.length - maxLines === 1 ? '' : 's'}`)}`);
      }
    }
  }

  /**
   * Display enhanced specification state information from SpecStateDetector
   * 
   * Shows workflow state, phase progression, and task completion status.
   * 
   * @param specState - SpecState analysis from SpecStateDetector
   * @private
   */
  private displaySpecificationState(specState: SpecState): void {
    console.log(chalk.bold('\n🔄 Specification State'));
    
    // Current phase and status
    const phaseDisplay = specState.phase.charAt(0).toUpperCase() + specState.phase.slice(1).replace('-', ' ');
    console.log(`${chalk.cyan('Current Phase:')} ${chalk.white(phaseDisplay)}`);
    
    // Phase status details
    const phaseStatuses = [];
    if (specState.requirements.exists) {
      phaseStatuses.push(`Requirements ${specState.requirements.approved ? chalk.green('✓') : chalk.yellow('○')}`);
    }
    if (specState.design.exists) {
      phaseStatuses.push(`Design ${specState.design.approved ? chalk.green('✓') : chalk.yellow('○')}`);
    }
    if (specState.tasks.exists) {
      phaseStatuses.push(`Tasks ${specState.tasks.approved ? chalk.green('✓') : chalk.yellow('○')}`);
    }
    
    if (phaseStatuses.length > 0) {
      console.log(`${chalk.cyan('Phase Progress:')} ${phaseStatuses.join(' • ')}`);
    }
    
    // Task completion status if tasks exist
    if (specState.tasks.exists && specState.tasks.total > 0) {
      const completionPercent = Math.round((specState.tasks.completed / specState.tasks.total) * 100);
      const completionColor = completionPercent === 100 ? chalk.green : 
                            completionPercent >= 50 ? chalk.yellow : chalk.red;
      
      console.log(`${chalk.cyan('Task Progress:')} ${completionColor(`${specState.tasks.completed}/${specState.tasks.total} tasks (${completionPercent}%)`)}`);
      
      if (specState.tasks.nextPendingTask) {
        console.log(`${chalk.cyan('Next Task:')} Task ${specState.tasks.nextPendingTask.id} - ${specState.tasks.nextPendingTask.description}`);
      }
    }
    
    // Modifiable phases
    if (specState.canModifyAt.length > 0) {
      const modifiablePhases = specState.canModifyAt.join(', ');
      console.log(`${chalk.cyan('Can Modify:')} ${chalk.green(modifiablePhases)}`);
    }
  }

  /**
   * Prompt user for concurrent modification recovery options
   * 
   * @returns Promise resolving to user's choice for handling concurrent modifications
   */
  async promptForConcurrentModificationRecovery(): Promise<'reload' | 'merge' | 'backup-restore' | 'diff' | 'exit'> {
    console.log(); // Add spacing
    
    const choices = [
      {
        name: '🔄 Reload content (accept external changes)',
        value: 'reload',
        short: 'Reload'
      },
      {
        name: '🔀 Attempt to merge changes (experimental)',
        value: 'merge',
        short: 'Merge'
      },
      {
        name: '⏪ Restore from backup (discard external changes)',
        value: 'backup-restore',
        short: 'Restore backup'
      },
      {
        name: '📊 View differences first',
        value: 'diff',
        short: 'View diff'
      },
      {
        name: '🚪 Exit session',
        value: 'exit',
        short: 'Exit'
      }
    ];

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: 'How would you like to handle the concurrent modification?',
        choices,
        default: 'reload',
        loop: false
      }
    ]);

    return answer.choice;
  }
}