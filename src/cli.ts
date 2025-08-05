#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { SpecWorkflowSetup } from './setup';
import { detectProjectType, validateClaudeCode } from './utils';
import { parseTasksFromMarkdown, generateTaskCommand } from './task-generator';
import { getFileContent } from './get-content';
import { getAgentsEnabled } from './using-agents';
import { getTasks } from './get-tasks';
import { readFileSync, promises as fs } from 'fs';
import * as path from 'path';
import { join } from 'path';

// Read version from package.json
// Use require.resolve to find package.json in both dev and production
let packageJson: { version: string };
try {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
} catch {
  // Fallback for edge cases
  packageJson = { version: '1.3.0' };
}

const program = new Command();

// Debug logging for WSL issues
if (process.env.DEBUG_CLI) {
  console.log('process.argv:', process.argv);
  console.log('process.execPath:', process.execPath);
  console.log('__filename:', __filename);
}

program
  .name('claude-spec-setup')
  .description('Set up Claude Code Spec Workflow with automated orchestration in your project')
  .version(packageJson.version)
  .addHelpText('after', `
Examples:
  # Fresh installation
  npx @pimzino/claude-code-spec-workflow@latest install           # Install with default settings
  npx @pimzino/claude-code-spec-workflow@latest install --agents  # Install with agents enabled
  npx @pimzino/claude-code-spec-workflow@latest install --no-agents --yes  # Install without agents
  
  # Update existing installation
  npx @pimzino/claude-code-spec-workflow@latest update --all      # Update everything
  npx @pimzino/claude-code-spec-workflow@latest update --commands --agents  # Update specific components
  
  # Configuration management
  npx @pimzino/claude-code-spec-workflow@latest config agents enable   # Enable agents
  npx @pimzino/claude-code-spec-workflow@latest config agents disable  # Disable agents
  npx @pimzino/claude-code-spec-workflow@latest config reset           # Reset to defaults
  
  # Utilities
  npx @pimzino/claude-code-spec-workflow@latest using-agents       # Check if agents enabled
  npx @pimzino/claude-code-spec-workflow@latest get-content <file> # Read file content
  npx @pimzino/claude-code-spec-workflow@latest get-tasks <spec>   # Get tasks from spec
  npx @pimzino/claude-code-spec-workflow@latest dashboard          # Launch real-time dashboard

For help with a specific command:
  npx @pimzino/claude-code-spec-workflow@latest <command> --help
`);

// Install command (new focused command for fresh installations)
program
  .command('install')
  .description('Install Claude Code Spec Workflow in your project')
  .option('-p, --project <path>', 'Project directory', process.cwd())
  .option('--agents, --no-agents', 'Enable or disable Claude Code sub-agents', true)
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (options) => {
    console.log(chalk.cyan.bold('Claude Code Spec Workflow Installation'));
    console.log(chalk.gray('Setting up spec-driven development workflow'));
    console.log();

    await handleInstallCommand(options);
  });

// Update command (new focused command for updating existing installations)
program
  .command('update')
  .description('Update existing Claude Code Spec Workflow installation')
  .option('-p, --project <path>', 'Project directory', process.cwd())
  .option('--agents, --no-agents', 'Enable or disable Claude Code sub-agents')
  .option('--commands', 'Update slash commands')
  .option('--templates', 'Update document templates')
  .option('--agents-files', 'Update agent files')
  .option('--tasks', 'Regenerate task commands')
  .option('--all', 'Update all components')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (options) => {
    console.log(chalk.cyan.bold('Claude Code Spec Workflow Update'));
    console.log(chalk.gray('Updating existing installation'));
    console.log();

    await handleUpdateCommand(options);
  });

// Config command (new focused command for configuration management)
program
  .command('config')
  .description('Manage Claude Code Spec Workflow configuration')
  .argument('<action>', 'Configuration action: agents, reset')
  .argument('[value]', 'Configuration value (for agents: enable|disable)')
  .option('-p, --project <path>', 'Project directory', process.cwd())
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (action, value, options) => {
    console.log(chalk.cyan.bold('Claude Code Spec Workflow Configuration'));
    console.log(chalk.gray('Managing workflow configuration'));
    console.log();

    await handleConfigCommand(action, value, options);
  });

// Setup command (legacy - kept for backward compatibility)
program
  .command('setup')
  .description('[DEPRECATED] Set up Claude Code Spec Workflow in your project (use install/update instead)')
  .option('-p, --project <path>', 'Project directory', process.cwd())
  .option('-f, --force', '[DEPRECATED] Use "config reset" instead')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (options) => {
    // Show deprecation warning
    console.log(chalk.yellow.bold('⚠️  DEPRECATION WARNING'));
    console.log(chalk.yellow('The "setup" command is deprecated. Please use:'));
    console.log(chalk.gray('  • "install" for fresh installations'));
    console.log(chalk.gray('  • "update" for updating existing installations'));  
    console.log(chalk.gray('  • "config" for configuration management'));
    console.log();
    
    console.log(chalk.cyan.bold('Claude Code Spec Workflow Setup'));
    console.log(chalk.gray('Automated spec-driven development with intelligent orchestration'));
    console.log();

    const projectPath = options.project;
    const spinner = ora('Analyzing project...').start();

    try {
      // Detect project type
      const projectTypes = await detectProjectType(projectPath);
      spinner.succeed(`Project analyzed: ${projectPath}`);

      if (projectTypes.length > 0) {
        console.log(chalk.blue(`Detected project type(s): ${projectTypes.join(', ')}`));
      }

      // Check Claude Code availability
      const claudeAvailable = await validateClaudeCode();
      if (claudeAvailable) {
        console.log(chalk.green('Claude Code is available'));
      } else {
        console.log(chalk.yellow('WARNING: Claude Code not found. Please install Claude Code first.'));
        console.log(chalk.gray('   Visit: https://docs.anthropic.com/claude-code'));
      }

      // Check for existing .claude directory and installation completeness
      let setup = new SpecWorkflowSetup(projectPath);
      const claudeExists = await setup.claudeDirectoryExists();

      // For installation completeness check, we need to know if agents should be enabled
      // We'll do a preliminary check first, then a proper check after we know the agent preference
      let isComplete = false;

      if (claudeExists) {
        // Try to determine agent preference from existing config
        let agentsEnabled = false;
        try {
          const configPath = join(projectPath, '.claude', 'spec-config.json');
          const configContent = await fs.readFile(configPath, 'utf-8');
          const config = JSON.parse(configContent);
          agentsEnabled = config.spec_workflow?.agents_enabled || false;
        } catch {
          // Config doesn't exist or is malformed, assume agents disabled for completeness check
          agentsEnabled = false;
        }

        // Create temporary setup instance with detected agent preference for completeness check
        const tempSetup = new SpecWorkflowSetup(projectPath, agentsEnabled);
        isComplete = await tempSetup.isInstallationComplete();
      }

      // Handle incomplete installations
      if (claudeExists && !isComplete && !options.force) {
        if (!options.yes) {
          console.log(chalk.yellow('Incomplete installation detected'));
          console.log(chalk.gray('Some required files or directories are missing from your .claude installation.'));
          console.log(chalk.green('Your spec documents (requirements.md, design.md, tasks.md) will not be modified'));
          console.log();

          const { completeInstallation } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'completeInstallation',
              message: 'Would you like to complete the installation by adding missing files?',
              default: true
            }
          ]);

          if (!completeInstallation) {
            console.log(chalk.yellow('Installation completion cancelled.'));
            process.exit(0);
          }
        }
        // For incomplete installations, we'll proceed with fresh setup to add missing files
        // The setup process will only create missing files/directories
      }

      // Determine agent preference early for consistent handling
      let userAgentPreference: boolean = false;
      let agentPreferenceSet = false;

      if (claudeExists && isComplete && !options.force) {
        if (!options.yes) {
          console.log(chalk.cyan('Existing installation detected'));
          console.log(chalk.green('Your spec documents (requirements.md, design.md, tasks.md) will not be modified'));
          console.log();

          // Show recommendation note for task commands before selection
          console.log(chalk.cyan('💡 Task Commands Recommendation:'));
          console.log(chalk.gray('   Task commands often contain improved instructions, bug fixes, and enhanced'));
          console.log(chalk.gray('   functionality compared to older versions. Regenerating them ensures you get'));
          console.log(chalk.gray('   the latest optimizations and agent compatibility improvements.'));
          console.log();

          // Ask what to update
          const updateChoices = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'updateItems',
              message: 'What would you like to update?',
              choices: [
                { name: 'Commands (slash commands)', value: 'commands', checked: true },
                { name: 'Templates', value: 'templates', checked: true },
                { name: 'Agents', value: 'agents', checked: true },
                { name: 'Task commands (regenerate individual task commands from tasks.md files) - RECOMMENDED', value: 'taskCommands', checked: true }
              ],
              validate: (answer) => {
                if (answer.length < 1) {
                  return 'You must choose at least one item to update.';
                }
                return true;
              }
            }
          ]);

          console.log();
          console.log(chalk.yellow('WARNING: This will overwrite existing files'));

          // Dynamic warnings based on user selection
          const selectedItems = updateChoices.updateItems;

          if (selectedItems.includes('commands')) {
            console.log(chalk.gray('- Commands (slash commands) will be replaced with latest versions'));
          }

          if (selectedItems.includes('templates')) {
            console.log(chalk.gray('- Templates will be replaced with latest versions'));
          }

          if (selectedItems.includes('agents')) {
            console.log(chalk.gray('- Agents will be replaced with latest versions'));
          }

          if (selectedItems.includes('taskCommands')) {
            console.log(chalk.gray('- Task commands will be regenerated from existing tasks.md files'));
          }

          // Show backup warning if any component that might affect custom files is selected
          if (selectedItems.includes('commands') || selectedItems.includes('agents') || selectedItems.includes('templates')) {
            console.log(chalk.gray('- Custom files may be overwritten (automatic backup will be created)'));
          }

          // Always show this message
          console.log(chalk.green('Your spec documents (requirements.md, design.md, tasks.md) will not be modified'));
          console.log();

          const { confirmUpdate } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmUpdate',
              message: 'Continue with update?',
              default: true
            }
          ]);

          if (!confirmUpdate) {
            console.log(chalk.yellow('Update cancelled.'));
            process.exit(0);
          }

          // Store update choices for later use
          setup._updateChoices = updateChoices;
        } else {
          // Auto-select all items if --yes flag is used
          setup._updateChoices = {
            updateItems: ['commands', 'templates', 'agents', 'taskCommands']
          };
          // For --yes flag with existing complete installation, enable agents by default
          userAgentPreference = true;
          agentPreferenceSet = true;
        }
      }

      // Confirm setup and get agent preference if not already set
      if (!options.yes && !agentPreferenceSet) {
        console.log();
        console.log(chalk.cyan('This will create:'));
        console.log(chalk.gray('  .claude/ directory structure'));
        console.log(chalk.gray('  14 slash commands (9 spec workflow + 5 bug fix workflow)'));
        console.log(chalk.gray('  Auto-generated task commands'));
        console.log(chalk.gray('  Intelligent orchestrator for automated execution'));
        console.log(chalk.gray('  Document templates'));
        console.log(chalk.gray('  NPX-based task command generation'));
        console.log(chalk.gray('  Configuration files'));
        console.log(chalk.gray('  Complete workflow instructions embedded in each command'));
        console.log();

        const { useAgents } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'useAgents',
            message: 'Enable Claude Code sub-agents for enhanced task execution?',
            default: true
          }
        ]);
        
        userAgentPreference = useAgents;
        agentPreferenceSet = true;
      } else if (options.yes && !agentPreferenceSet) {
        // For --yes flag without existing complete installation, enable agents by default
        userAgentPreference = true;
        agentPreferenceSet = true;
      }
      
      // Create setup instance with agent preference, preserving update choices
      if (agentPreferenceSet) {
        const updateChoices = setup._updateChoices;
        setup = new SpecWorkflowSetup(projectPath, userAgentPreference);
        setup._updateChoices = updateChoices;
      }

      // Run setup or update
      if (claudeExists && isComplete && setup._updateChoices) {
        // This is an update scenario (complete installation being updated)
        const updateSpinner = ora('Creating backup...').start();

        const { SpecWorkflowUpdater } = await import('./update');
        const updater = new SpecWorkflowUpdater(projectPath);

        // Create backup before making any changes
        try {
          await updater.createBackup();
          updateSpinner.text = 'Updating installation...';
        } catch (error) {
          updateSpinner.fail('Backup creation failed');
          console.error(chalk.red('Update cancelled for safety. Error:'), error instanceof Error ? error.message : error);
          process.exit(1);
        }

        // Use the determined agent preference for config update
        const agentsEnabled = agentPreferenceSet ? userAgentPreference : setup.createAgents;

        if (setup._updateChoices.updateItems.includes('commands')) {
          await updater.updateCommands();
        }

        if (setup._updateChoices.updateItems.includes('templates')) {
          await updater.updateTemplates();
        }

        if (setup._updateChoices.updateItems.includes('agents')) {
          await updater.updateAgents();
        }

        if (setup._updateChoices.updateItems.includes('taskCommands')) {
          await updater.regenerateTaskCommands();
        }

        // Update config with agent preference
        await updater.updateConfig(agentsEnabled);

        // Clean up old backups (keep 5 most recent)
        await updater.cleanupOldBackups(5);

        updateSpinner.succeed('Update complete!');
      } else {
        // This is a fresh setup or completing an incomplete installation
        const isCompletion = claudeExists && !isComplete;
        const setupSpinner = ora(isCompletion ? 'Completing installation...' : 'Setting up spec workflow...').start();
        await setup.runSetup();
        setupSpinner.succeed(isCompletion ? 'Installation completed!' : 'Setup complete!');
      }

      // Success message
      console.log();
      if (claudeExists && isComplete && setup._updateChoices) {
        console.log(chalk.green.bold('Spec Workflow updated successfully!'));
        console.log(chalk.gray('A backup of your previous installation was created automatically.'));
      } else if (claudeExists && !isComplete) {
        console.log(chalk.green.bold('Spec Workflow installation completed successfully!'));
        console.log(chalk.gray('Missing files and directories have been added to your existing installation.'));
      } else {
        console.log(chalk.green.bold('Spec Workflow installed successfully!'));
      }
      console.log();
      console.log(chalk.cyan('Available commands:'));
      console.log(chalk.white.bold('Spec Workflow (for new features):'));
      console.log(chalk.gray('  /spec-create <feature-name>  - Create a new spec'));
      console.log(chalk.gray('  /spec-orchestrate <spec>     - NEW! Automated execution'));
      console.log(chalk.gray('  /spec-execute <task-id>      - Execute tasks manually'));
      console.log(chalk.gray('  /{spec-name}-task-{id}       - Auto-generated task commands'));
      console.log(chalk.gray('  /spec-status                 - Show status'));
      console.log(chalk.gray('  /spec-completion-review      - Final review when all tasks complete'));
      console.log(chalk.gray('  /spec-list                   - List all specs'));
      console.log();
      
      // Show agents section if enabled
      if (setup && setup['createAgents']) {
        console.log(chalk.white.bold('Sub-Agents (automatic):'));
        console.log(chalk.gray('  spec-task-executor                - Specialized task implementation agent'));
        console.log(chalk.gray('  spec-requirements-validator       - Requirements quality validation agent'));
        console.log(chalk.gray('  spec-design-validator             - Design quality validation agent'));
        console.log(chalk.gray('  spec-task-validator               - Task atomicity validation agent'));
        console.log(chalk.gray('  spec-task-implementation-reviewer - Post-implementation review agent'));
        console.log(chalk.gray('  spec-integration-tester           - Integration testing and validation agent'));
        console.log(chalk.gray('  spec-completion-reviewer          - End-to-end feature completion agent'));
        console.log(chalk.gray('  bug-root-cause-analyzer           - Enhanced bug analysis with git history'));
        console.log(chalk.gray('  steering-document-updater         - Analyzes codebase and suggests doc updates'));
        console.log(chalk.gray('  spec-dependency-analyzer          - Optimizes task execution order'));
        console.log(chalk.gray('  spec-test-generator               - Generates tests from requirements'));
        console.log(chalk.gray('  spec-documentation-generator      - Maintains project documentation'));
        console.log(chalk.gray('  spec-performance-analyzer         - Analyzes performance implications'));
        console.log(chalk.gray('  spec-duplication-detector         - Identifies code reuse opportunities'));
        console.log(chalk.gray('  spec-breaking-change-detector     - Detects API compatibility issues'));
        console.log();
      }
      
      console.log(chalk.white.bold('Bug Fix Workflow (for bug fixes):'));
      console.log(chalk.gray('  /bug-create <bug-name>       - Start bug fix'));
      console.log(chalk.gray('  /bug-analyze                 - Analyze root cause'));
      console.log(chalk.gray('  /bug-fix                     - Implement fix'));
      console.log(chalk.gray('  /bug-verify                  - Verify fix'));
      console.log(chalk.gray('  /bug-status                  - Show bug status'));
      console.log();
      // Show restart message if commands were updated or installation was completed
      if ((claudeExists && isComplete && setup._updateChoices &&
          (setup._updateChoices.updateItems.includes('commands') ||
           setup._updateChoices.updateItems.includes('taskCommands'))) ||
          (claudeExists && !isComplete)) {
        console.log(chalk.yellow.bold('RESTART REQUIRED:'));
        console.log(chalk.gray('You must restart Claude Code for updated commands to be visible'));
        console.log(chalk.white('- Run "claude --continue" to continue this conversation'));
        console.log(chalk.white('- Or run "claude" to start a fresh session'));
        console.log();
      }

      console.log(chalk.yellow('Next steps:'));
      console.log(chalk.gray('1. Run: claude'));
      console.log(chalk.gray('2. For new features: /spec-create my-feature'));
      console.log(chalk.gray('3. For bug fixes: /bug-create my-bug'));
      console.log();
      console.log(chalk.blue('For help, see the README or run /spec-list'));
      console.log(chalk.blue('To update later: npx @pimzino/claude-code-spec-workflow@latest'));

    } catch (error) {
      spinner.fail('Setup failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Handler functions for new commands
async function handleInstallCommand(options: any) {
  const projectPath = options.project;
  const enableAgents = options.agents;
  const spinner = ora('Analyzing project...').start();

  try {
    // Detect project type
    const projectTypes = await detectProjectType(projectPath);
    spinner.succeed(`Project analyzed: ${projectPath}`);

    if (projectTypes.length > 0) {
      console.log(chalk.blue(`Detected project type(s): ${projectTypes.join(', ')}`));
    }

    // Check Claude Code availability
    const claudeAvailable = await validateClaudeCode();
    if (claudeAvailable) {
      console.log(chalk.green('Claude Code is available'));
    } else {
      console.log(chalk.yellow('WARNING: Claude Code not found. Please install Claude Code first.'));
      console.log(chalk.gray('   Visit: https://docs.anthropic.com/claude-code'));
    }

    // Check if installation exists and is complete
    const setup = new SpecWorkflowSetup(projectPath, enableAgents);
    const claudeExists = await setup.claudeDirectoryExists();
    const isComplete = claudeExists ? await setup.isInstallationComplete() : false;
    
    if (claudeExists && isComplete && !options.yes) {
      console.log(chalk.yellow('⚠️  Complete installation already exists!'));
      console.log(chalk.gray('Use "update" command to modify existing installation.'));
      console.log();
      
      const { continueInstall } = await inquirer.prompt([{
        type: 'confirm',
        name: 'continueInstall',
        message: 'Continue with fresh installation? (This will overwrite existing files)',
        default: false
      }]);
      
      if (!continueInstall) {
        console.log(chalk.yellow('Installation cancelled. Use "update" to modify existing installation.'));
        return;
      }
    } else if (claudeExists && !isComplete) {
      console.log(chalk.cyan('Incomplete installation detected - completing setup...'));
    }

    const setupSpinner = ora('Installing spec workflow...').start();
    await setup.runSetup();
    setupSpinner.succeed('Installation complete!');

    console.log();
    console.log(chalk.green.bold('Spec Workflow installed successfully!'));
    showCommandList(enableAgents);
    
  } catch (error) {
    spinner.fail('Installation failed');
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function handleUpdateCommand(options: any) {
  const projectPath = options.project;
  const enableAgents = options.agents;
  const spinner = ora('Analyzing project...').start();

  try {
    // Check if installation exists
    const setup = new SpecWorkflowSetup(projectPath);
    const claudeExists = await setup.claudeDirectoryExists();
    
    if (!claudeExists) {
      spinner.fail('No existing installation found');
      console.log(chalk.yellow('Use "install" command to create a new installation.'));
      return;
    }

    spinner.succeed(`Project analyzed: ${projectPath}`);

    // Determine what to update
    let updateItems: string[] = [];
    
    if (options.all) {
      updateItems = ['commands', 'templates', 'agents', 'taskCommands'];
    } else {
      if (options.commands) updateItems.push('commands');
      if (options.templates) updateItems.push('templates');
      if (options.agentsFiles) updateItems.push('agents');
      if (options.tasks) updateItems.push('taskCommands');
      
      // If no specific options provided, ask user
      if (updateItems.length === 0 && !options.yes) {
        const choices = await inquirer.prompt([{
          type: 'checkbox',
          name: 'updateItems',
          message: 'What would you like to update?',
          choices: [
            { name: 'Commands (slash commands)', value: 'commands', checked: true },
            { name: 'Templates', value: 'templates', checked: true },
            { name: 'Agents', value: 'agents', checked: true },
            { name: 'Task commands (regenerate individual task commands)', value: 'taskCommands', checked: true }
          ],
          validate: (answer) => answer.length > 0 || 'You must choose at least one item to update.'
        }]);
        updateItems = choices.updateItems;
      } else if (updateItems.length === 0) {
        // Default to updating everything if --yes and no specific options
        updateItems = ['commands', 'templates', 'agents', 'taskCommands'];
      }
    }

    const updateSpinner = ora('Creating backup...').start();
    const { SpecWorkflowUpdater } = await import('./update');
    const updater = new SpecWorkflowUpdater(projectPath);

    // Create backup
    await updater.createBackup();
    updateSpinner.text = 'Updating installation...';

    // Update components
    if (updateItems.includes('commands')) {
      await updater.updateCommands();
    }
    if (updateItems.includes('templates')) {
      await updater.updateTemplates();
    }
    if (updateItems.includes('agents')) {
      await updater.updateAgents();
    }
    if (updateItems.includes('taskCommands')) {
      await updater.regenerateTaskCommands();
    }

    // Update config if agent preference specified
    if (enableAgents !== undefined) {
      await updater.updateConfig(enableAgents);
    }

    updateSpinner.succeed('Update complete!');

    console.log();
    console.log(chalk.green.bold('Spec Workflow updated successfully!'));
    showCommandList(enableAgents);
    
  } catch (error) {
    spinner.fail('Update failed');
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function handleConfigCommand(action: string, value: string, options: any) {
  const projectPath = options.project;

  try {
    // Check if installation exists
    const setup = new SpecWorkflowSetup(projectPath);
    const claudeExists = await setup.claudeDirectoryExists();
    
    if (!claudeExists) {
      console.log(chalk.red('No existing installation found.'));
      console.log(chalk.yellow('Use "install" command to create a new installation.'));
      return;
    }

    if (action === 'agents') {
      if (!value || !['enable', 'disable'].includes(value)) {
        console.log(chalk.red('Error: agents action requires "enable" or "disable"'));
        console.log(chalk.gray('Example: config agents enable'));
        return;
      }

      const enableAgents = value === 'enable';
      const { SpecWorkflowUpdater } = await import('./update');
      const updater = new SpecWorkflowUpdater(projectPath);
      
      await updater.updateConfig(enableAgents);
      
      console.log(chalk.green(`Agents ${enableAgents ? 'enabled' : 'disabled'} successfully!`));
      
    } else if (action === 'reset') {
      if (!options.yes) {
        console.log(chalk.yellow.bold('⚠️  WARNING: This will reset all configuration to defaults'));
        console.log(chalk.gray('This action will:'));
        console.log(chalk.gray('  • Reset agent configuration'));
        console.log(chalk.gray('  • Remove custom configuration fields'));
        console.log(chalk.gray('  • Restore all settings to defaults'));
        console.log();
        
        const { confirmReset } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmReset',
          message: 'Continue with configuration reset?',
          default: false
        }]);
        
        if (!confirmReset) {
          console.log(chalk.yellow('Configuration reset cancelled.'));
          return;
        }
      }

      const resetSetup = new SpecWorkflowSetup(projectPath, true); // Default to agents enabled
      await resetSetup.createConfigFile();
      
      console.log(chalk.green('Configuration reset to defaults successfully!'));
      
    } else {
      console.log(chalk.red(`Error: Unknown config action "${action}"`));
      console.log(chalk.gray('Available actions: agents, reset'));
    }
    
  } catch (error) {
    console.error(chalk.red('Config operation failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function showCommandList(enableAgents?: boolean) {
  console.log();
  console.log(chalk.cyan('Available commands:'));
  console.log(chalk.white.bold('Spec Workflow (for new features):'));
  console.log(chalk.gray('  /spec-create <feature-name>  - Create a new spec'));
  console.log(chalk.gray('  /spec-orchestrate <spec>     - Automated execution'));
  console.log(chalk.gray('  /spec-execute <task-id>      - Execute tasks manually'));
  console.log(chalk.gray('  /{spec-name}-task-{id}       - Auto-generated task commands'));
  console.log(chalk.gray('  /spec-status                 - Show status'));
  console.log(chalk.gray('  /spec-completion-review      - Final review when all tasks complete'));
  console.log(chalk.gray('  /spec-list                   - List all specs'));
  console.log();
  
  // Show agents section if enabled
  if (enableAgents) {
    console.log(chalk.white.bold('Sub-Agents (automatic):'));
    console.log(chalk.gray('  spec-task-executor                - Specialized task implementation agent'));
    console.log(chalk.gray('  spec-requirements-validator       - Requirements quality validation agent'));
    console.log(chalk.gray('  spec-design-validator             - Design quality validation agent'));
    console.log(chalk.gray('  spec-task-validator               - Task atomicity validation agent'));
    console.log(chalk.gray('  spec-task-implementation-reviewer - Post-implementation review agent'));
    console.log(chalk.gray('  spec-integration-tester           - Integration testing and validation agent'));
    console.log(chalk.gray('  spec-completion-reviewer          - End-to-end feature completion agent'));
    console.log(chalk.gray('  bug-root-cause-analyzer           - Enhanced bug analysis with git history'));
    console.log(chalk.gray('  steering-document-updater         - Analyzes codebase and suggests doc updates'));
    console.log(chalk.gray('  spec-dependency-analyzer          - Optimizes task execution order'));
    console.log(chalk.gray('  spec-test-generator               - Generates tests from requirements'));
    console.log(chalk.gray('  spec-documentation-generator      - Maintains project documentation'));
    console.log(chalk.gray('  spec-performance-analyzer         - Analyzes performance implications'));
    console.log(chalk.gray('  spec-duplication-detector         - Identifies code reuse opportunities'));
    console.log(chalk.gray('  spec-breaking-change-detector     - Detects API compatibility issues'));
    console.log();
  }
  
  console.log(chalk.white.bold('Bug Fix Workflow (for bug fixes):'));
  console.log(chalk.gray('  /bug-create <bug-name>       - Start bug fix'));
  console.log(chalk.gray('  /bug-analyze                 - Analyze root cause'));
  console.log(chalk.gray('  /bug-fix                     - Implement fix'));
  console.log(chalk.gray('  /bug-verify                  - Verify fix'));
  console.log(chalk.gray('  /bug-status                  - Show bug status'));
  console.log();
  
  console.log(chalk.yellow('Next steps:'));
  console.log(chalk.gray('1. Run: claude'));
  console.log(chalk.gray('2. For new features: /spec-create my-feature'));
  console.log(chalk.gray('3. For bug fixes: /bug-create my-bug'));
  console.log();
  console.log(chalk.blue('For help, see the README or run /spec-list'));
}

// Add test command
program
  .command('test')
  .description('Test the setup in a temporary directory')
  .action(async () => {
    console.log(chalk.cyan('Testing setup...'));

    const os = await import('os');
    const path = await import('path');
    const fs = await import('fs/promises');

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-spec-test-'));

    try {
      const setup = new SpecWorkflowSetup(tempDir);
      await setup.runSetup();

      console.log(chalk.green('Test completed successfully!'));
      console.log(chalk.gray(`Test directory: ${path.resolve(tempDir)}`));
      console.log(chalk.blue('You can inspect the generated files in the test directory.'));

    } catch (error) {
      console.error(chalk.red('Test failed:'), error);
      process.exit(1);
    }
  });

// Add generate-task-commands command
program
  .command('generate-task-commands')
  .description('Generate individual task commands for a spec')
  .argument('<spec-name>', 'Name of the spec to generate commands for')
  .option('-p, --project <path>', 'Project directory', process.cwd())
  .action(async (specName, options) => {
    console.log(chalk.cyan('Generating task commands...'));
    
    const path = await import('path');
    const fs = await import('fs/promises');
    
    const projectPath = options.project;
    const specDir = path.join(projectPath, '.claude', 'specs', specName);
    const tasksFile = path.join(specDir, 'tasks.md');
    const commandsSpecDir = path.join(projectPath, '.claude', 'commands', specName);
    
    const spinner = ora(`Generating commands for spec: ${specName}`).start();
    
    try {
      // Check if tasks.md exists
      try {
        await fs.access(tasksFile);
      } catch {
        spinner.fail(`tasks.md not found at ${tasksFile}`);
        process.exit(1);
      }
      
      // Read tasks.md
      const tasksContent = await fs.readFile(tasksFile, 'utf8');
      
      // Create spec commands directory
      await fs.mkdir(commandsSpecDir, { recursive: true });
      
      // Parse tasks and generate commands
      const tasks = parseTasksFromMarkdown(tasksContent);
      
      let taskCount = 0;
      for (const task of tasks) {
        await generateTaskCommand(commandsSpecDir, specName, task);
        taskCount++;
      }
      
      spinner.succeed(`Generated ${taskCount} task commands for spec: ${specName}`);
      
      console.log();
      console.log(chalk.green('Generated commands:'));
      for (const task of tasks) {
        console.log(chalk.gray(`  /${specName}-task-${task.id} - ${task.description}`));
      }
      
      console.log();
      console.log(chalk.yellow.bold('RESTART REQUIRED: You must restart Claude Code for the new commands to be visible'));
      console.log();
      console.log(chalk.cyan.bold('Instructions for the agent:'));
      console.log(chalk.gray('Tell the user they must exit Claude Code and restart it using:'));
      console.log(chalk.white('- Run "claude --continue" to continue this conversation with new commands'));
      console.log(chalk.white('- Or run "claude" to start a fresh session'));
      console.log(chalk.gray('The restart is absolutely necessary for the new task commands to appear.'));
      console.log();
      console.log(chalk.blue('After restart, you can use commands like:'));
      if (tasks.length > 0) {
        console.log(chalk.gray(`  /${specName}-task-${tasks[0].id}`));
        if (tasks.length > 1) {
          console.log(chalk.gray(`  /${specName}-task-${tasks[1].id}`));
        }
        console.log(chalk.gray('  etc.'));
      }
      
    } catch (error) {
      spinner.fail('Command generation failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Add get-content command
program
  .command('get-content')
  .description('Read and print the contents of a file')
  .argument('<file-path>', 'Full path to the file to read')
  .action(async (filePath) => {
    await getFileContent(filePath);
  });

// Add using-agents command
program
  .command('using-agents')
  .description('Check if agents are enabled in spec-config.json')
  .option('-p, --project <path>', 'Project directory', process.cwd())
  .action(async (options) => {
    await getAgentsEnabled(options.project);
  });


// Add get-tasks command
program
  .command('get-tasks')
  .description('Get tasks from a specification')
  .argument('<spec-name>', 'Name of the spec to get tasks from')
  .argument('[task-id]', 'Specific task ID to retrieve')
  .option('-m, --mode <mode>', 'Mode: all, single, next-pending, or complete', 'all')
  .option('-p, --project <path>', 'Project directory', process.cwd())
  .action(async (specName, taskId, options) => {
    let mode = options.mode as 'all' | 'single' | 'next-pending' | 'complete';
    
    // Auto-detect mode if taskId is provided and mode is default
    if (taskId && mode === 'all') {
      mode = 'single';
    }
    
    if (!['all', 'single', 'next-pending', 'complete'].includes(mode)) {
      console.error(chalk.red('Error: Invalid mode. Use: all, single, next-pending, or complete'));
      process.exit(1);
    }
    await getTasks(specName, taskId, mode, options.project);
  });

// Add dashboard command
program
  .command('dashboard')
  .description('Launch real-time dashboard for Claude Code Spec Workflow')
  .option('-p, --port <port>', 'Port to run the dashboard on', '3000')
  .option('-d, --dir <path>', 'Project directory containing .claude', process.cwd())
  .option('-o, --open', 'Open dashboard in browser automatically')
  .option('-m, --multi', 'Launch multi-project dashboard')
  .action(async (options) => {
    try {
      // Import and run dashboard
      const { launchDashboard } = await import('./dashboard/cli');
      await launchDashboard(options);
    } catch (error) {
      console.error(chalk.red('Dashboard failed to start:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Add error handling for unknown commands
program.on('command:*', () => {
  const availableCommands = program.commands.map(cmd => cmd.name()).filter(name => name !== 'help');
  console.error(chalk.red(`Error: Unknown command '${program.args[0]}'`));
  console.log();
  console.log(chalk.cyan('Available commands:'));
  availableCommands.forEach(cmd => {
    const command = program.commands.find(c => c.name() === cmd);
    if (command) {
      console.log(chalk.gray(`  ${cmd} - ${command.description()}`));
    }
  });
  console.log();
  console.log(chalk.yellow('For help with a specific command, run:'));
  console.log(chalk.gray('  npx @pimzino/claude-code-spec-workflow@latest <command> --help'));
  process.exit(1);
});

// Check if we should add 'setup' as default command
const args = process.argv.slice(2);
if (args.length === 0 || (args.length > 0 && !args[0].startsWith('-') && !program.commands.some(cmd => cmd.name() === args[0]))) {
  // No command provided or first arg is not a known command and not a flag
  // Insert 'setup' as the command
  process.argv.splice(2, 0, 'setup');
}

// Parse arguments normally - let Commander.js handle everything
program.parse();