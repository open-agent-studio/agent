import { Command } from 'commander';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { getAgentDir, getSkillsDir, getPlansDir, getRunsDir, getLogsDir, getPluginsDir, getConfigPath } from '../../utils/paths.js';
import { DEFAULT_CONFIG } from '../../config/defaults.js';
import { ToolRegistry } from '../../tools/registry.js';
import { fsTools } from '../../tools/core/fs.js';
import { cmdTools } from '../../tools/core/cmd.js';
import { gitTools } from '../../tools/core/git.js';
import { projectTools } from '../../tools/core/project.js';
import { cliTools } from '../../tools/core/cli-tools.js';
import { browserTools } from '../../tools/core/browser.js';
import { computerTool } from '../../tools/core/computer.js';
import { uiTreeTool } from '../../tools/core/desktop-tree.js';
import type { ToolDefinition } from '../../tools/types.js';

/**
 * Register all core tools in the registry
 */
export function registerCoreTools(registry: ToolRegistry): void {
    const allTools: ToolDefinition[] = [
        ...fsTools as ToolDefinition[],
        ...cmdTools as ToolDefinition[],
        ...gitTools as ToolDefinition[],
        ...projectTools as ToolDefinition[],
        ...cliTools as ToolDefinition[],
        ...browserTools as ToolDefinition[],
        computerTool as ToolDefinition,
        uiTreeTool as ToolDefinition,
    ];

    for (const tool of allTools) {
        if (!registry.has(tool.name)) {
            registry.register(tool);
        }
    }
}

export function createInitCommand(): Command {
    const cmd = new Command('init')
        .description('Initialize agent configuration in the current project')
        .action(async () => {
            console.log(chalk.bold.cyan('\n▶ Initializing Agent Runtime\n'));

            // Onboarding Prompts
            const { default: inquirer } = await import('inquirer');
            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'modelProvider',
                    message: 'Select your preferred LLM provider:',
                    choices: ['openai', 'anthropic', 'azure', 'ollama'],
                    default: 'openai'
                },
                {
                    type: 'input',
                    name: 'modelName',
                    message: 'Enter the model name (e.g., gpt-4o, claude-3-5-sonnet-20241022, llama3.2):',
                    default: (ans: any) => {
                        if (ans.modelProvider === 'openai') return 'gpt-4o';
                        if (ans.modelProvider === 'anthropic') return 'claude-3-5-sonnet-20241022';
                        if (ans.modelProvider === 'azure') return 'gpt-4o';
                        if (ans.modelProvider === 'ollama') return 'llama3.2';
                        return '';
                    }
                },
                {
                    type: 'input',
                    name: 'azureEndpoint',
                    message: 'Enter your Azure OpenAI Endpoint (e.g., https://your-resource.openai.azure.com):',
                    when: (ans: any) => ans.modelProvider === 'azure',
                },
                {
                    type: 'input',
                    name: 'azureApiVersion',
                    message: 'Enter your Azure API Version:',
                    default: '2024-02-15-preview',
                    when: (ans: any) => ans.modelProvider === 'azure',
                },
                {
                    type: 'password',
                    name: 'apiKey',
                    message: 'Enter your API Key (leave empty to use Environment Variables or Ollama):',
                    mask: '*'
                },
                {
                    type: 'list',
                    name: 'policyApproval',
                    message: 'Select the default policy approval level:',
                    choices: [
                        { name: 'Confirm (Ask before running tools)', value: 'confirm' },
                        { name: 'Allow (Autonomous run)', value: 'allow' },
                        { name: 'Deny (Strict mode)', value: 'deny' }
                    ],
                    default: 'confirm'
                },
                {
                    type: 'checkbox',
                    name: 'tools',
                    message: 'Select the core tools to enable by default:',
                    choices: [
                        { name: 'Filesystem (fs.*)', value: 'fs.*', checked: true },
                        { name: 'Execute Commands (cmd.run)', value: 'cmd.run', checked: true },
                        { name: 'Git (git.*)', value: 'git.*', checked: true },
                        { name: 'Project Info (project.*)', value: 'project.*', checked: true },
                        { name: 'CLI Tools (cli.*) [AI wrappers]', value: 'cli.*', checked: true },
                        { name: 'Browser Automation (desktop.browser.*)', value: 'desktop.browser.*', checked: true },
                    ]
                },
                {
                    type: 'confirm',
                    name: 'updateGitignore',
                    message: 'Add .agent/ and agent.config.json to your project root .gitignore?',
                    default: true
                }
            ]);

            console.log(chalk.cyan('\n⚙️  Applying configuration...\n'));

            const agentDir = getAgentDir();
            const dirs = [
                agentDir,
                getSkillsDir(),
                getPlansDir(),
                getRunsDir(),
                getLogsDir(),
                getPluginsDir(),
            ];

            // Create directories
            for (const dir of dirs) {
                await mkdir(dir, { recursive: true });
                console.log(chalk.green('  ✓ Created ') + chalk.dim(path.relative(process.cwd(), dir) + '/'));
            }

            // Create config file
            const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            config.models.routing.defaultProvider = answers.modelProvider;

            if (!config.models.providers[answers.modelProvider]) {
                config.models.providers[answers.modelProvider] = { type: answers.modelProvider };
            }
            config.models.providers[answers.modelProvider].model = answers.modelName;

            if (answers.apiKey) {
                config.models.providers[answers.modelProvider].apiKey = answers.apiKey;
            }
            if (answers.modelProvider === 'azure') {
                if (answers.azureEndpoint) config.models.providers.azure.baseUrl = answers.azureEndpoint;
                if (answers.azureApiVersion) config.models.providers.azure.apiVersion = answers.azureApiVersion;
                // For Azure, model acts as deploymentName in our schema by default unless overridden
                config.models.providers.azure.deploymentName = answers.modelName;
            }

            config.policy.defaultApproval = answers.policyApproval;
            config.tools.enabled = answers.tools;

            const configPath = getConfigPath();
            await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
            console.log(chalk.green('  ✓ Created ') + chalk.dim('agent.config.json'));

            // Create example plan
            const examplePlan = `name: example
description: An example plan showing the plan file structure
mode: execute

goals:
  - id: goal-1
    description: Demonstrate plan execution
    successCriteria:
      - "Output file is created"
    riskLevel: low

steps:
  - id: step-1
    name: Detect project
    tool: project.detect
    args: {}
    verify:
      command: "echo ok"

  - id: step-2
    name: List files
    tool: fs.list
    args:
      path: "."
      recursive: false

policy:
  approvals: per_step

trigger:
  type: manual
`;

            await writeFile(
                path.join(getPlansDir(), 'example.plan.yaml'),
                examplePlan,
                'utf-8'
            );
            console.log(chalk.green('  ✓ Created ') + chalk.dim('.agent/plans/example.plan.yaml'));

            // Create example skill
            const skillDir = path.join(getSkillsDir(), 'hello-world');
            await mkdir(skillDir, { recursive: true });

            await writeFile(
                path.join(skillDir, 'skill.json'),
                JSON.stringify({
                    name: 'hello-world',
                    version: '1.0.0',
                    description: 'A simple example skill',
                    inputs: {},
                    tools: ['fs.read'],
                    permissions: { required: ['filesystem.read'] },
                    entrypoint: 'prompt.md',
                    state: 'approved',
                }, null, 2) + '\n',
                'utf-8'
            );
            await writeFile(
                path.join(skillDir, 'prompt.md'),
                '# Hello World\n\nRead the README.md file and summarize its contents.\n',
                'utf-8'
            );
            console.log(chalk.green('  ✓ Created ') + chalk.dim('.agent/skills/hello-world/'));

            // Create local .gitignore for .agent
            await writeFile(
                path.join(agentDir, '.gitignore'),
                'runs/\nlogs/\ndaemon.pid\n.secrets\n',
                'utf-8'
            );
            console.log(chalk.green('  ✓ Created ') + chalk.dim('.agent/.gitignore'));

            // Update root .gitignore
            if (answers.updateGitignore) {
                const rootGitignore = path.join(process.cwd(), '.gitignore');
                try {
                    const fs = await import('node:fs/promises');
                    let gitignoreStr = '';
                    try {
                        gitignoreStr = await fs.readFile(rootGitignore, 'utf-8');
                    } catch { /* ignore if not exists */ }

                    const entriesToAdd = [];
                    // Check if already exactly present (crude check to prevent duplicates)
                    if (!gitignoreStr.includes('.agent/')) entriesToAdd.push('.agent/');
                    if (!gitignoreStr.includes('agent.config.json')) entriesToAdd.push('agent.config.json');

                    if (entriesToAdd.length > 0) {
                        const appendStr = (gitignoreStr && !gitignoreStr.endsWith('\n') ? '\n' : '') + '\n# Agent Runtime\n' + entriesToAdd.join('\n') + '\n';
                        await fs.appendFile(rootGitignore, appendStr, 'utf-8');
                        console.log(chalk.green('  ✓ Updated ') + chalk.dim('.gitignore ') + chalk.dim('(root)'));
                    } else {
                        console.log(chalk.green('  ✓ Root ') + chalk.dim('.gitignore ') + chalk.dim('already up to date'));
                    }
                } catch (e) {
                    console.error(chalk.red('  ✗ Failed to update root .gitignore'), e);
                }
            }

            console.log(chalk.bold.green('\n✓ Agent Runtime initialized!\n'));
            console.log(chalk.dim('  Next steps:'));
            console.log(chalk.dim('    1. Run: agent plan run example'));
            console.log(chalk.dim('    2. Create skills: agent skills create <name>'));
            console.log();
        });

    return cmd;
}
