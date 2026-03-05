import { Command } from 'commander';
import { createInitCommand } from './commands/init.js';
import { createRunCommand } from './commands/run.js';
import { createSkillsCommand } from './commands/skills.js';
import { createPlanCommand } from './commands/plan.js';
import { createDaemonCommand } from './commands/daemon.js';
import { createMcpCommand } from './commands/mcp.js';
import { createDoctorCommand } from './commands/doctor.js';
import { createConfigCommand } from './commands/config.js';
import { createMemoryCommand } from './commands/memory.js';
import { createGoalCommand, createApproveCommand } from './commands/goal.js';
import { createReportCommand } from './commands/report.js';
import { createHooksCommand } from './commands/hooks.js';
import { createCommandsCommand } from './commands/commands-cmd.js';
import { createPluginsCommand } from './commands/plugins.js';
import { createScriptsCommand } from './commands/scripts-cmd.js';
import { createStudioCommand } from './commands/studio-cmd.js';
import { createUpdateCommand } from './commands/update.js';
import { createSandboxCommand } from './commands/sandbox.js';
import { getAgentVersion } from '../utils/version.js';

/**
 * Create the CLI program with all commands
 */
export function createCLI(): Command {
    const program = new Command();

    program
        .name('agent')
        .description('Agent Runtime — autonomous, goal-oriented AI agent with skills, plans, memory, and permissioned tools')
        .version(getAgentVersion())
        .option('--verbose', 'Enable verbose output')
        .option('--no-color', 'Disable colored output')
        .option('--config <path>', 'Path to config file');

    // Register all commands
    program.addCommand(createInitCommand());
    program.addCommand(createRunCommand());
    program.addCommand(createSkillsCommand());
    program.addCommand(createPlanCommand());
    program.addCommand(createDaemonCommand());
    program.addCommand(createMcpCommand());
    program.addCommand(createDoctorCommand());
    program.addCommand(createConfigCommand());
    program.addCommand(createMemoryCommand());
    program.addCommand(createGoalCommand());
    program.addCommand(createApproveCommand());
    program.addCommand(createReportCommand());
    program.addCommand(createHooksCommand());
    program.addCommand(createCommandsCommand());
    program.addCommand(createPluginsCommand());
    program.addCommand(createScriptsCommand());
    program.addCommand(createStudioCommand());
    program.addCommand(createUpdateCommand());
    program.addCommand(createSandboxCommand());

    return program;
}
