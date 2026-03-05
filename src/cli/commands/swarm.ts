import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigLoader } from '../../config/loader.js';
import { initSwarmOrchestrator, getSwarmOrchestrator } from '../../swarm/orchestrator.js';
import { getAllRoles } from '../../swarm/roles.js';

export function createSwarmCommand(): Command {
    const cmd = new Command('swarm')
        .description('Multi-agent swarm coordination');

    // ─── swarm start ───
    cmd.command('start')
        .description('Start a swarm session with a goal')
        .argument('<goal>', 'The goal for the swarm to accomplish')
        .option('-m, --model <model>', 'Model to use for agents', 'gpt-4o')
        .option('-n, --max-agents <n>', 'Max concurrent agents', '5')
        .action(async (goal, opts) => {
            console.log(chalk.cyan('🐝 Initializing multi-agent swarm...'));

            try {
                const configLoader = new ConfigLoader();
                const config = await configLoader.load();
                const swarmConfig = {
                    ...config.swarm,
                    enabled: true,
                    model: opts.model || config.swarm?.model || 'gpt-4o',
                    maxAgents: parseInt(opts.maxAgents) || config.swarm?.maxAgents || 5,
                };

                const orchestrator = initSwarmOrchestrator(swarmConfig);
                const state = await orchestrator.run(goal);

                console.log(chalk.green('✓ Swarm session started'));
                console.log(chalk.dim(`  Swarm ID:  ${state.id.slice(0, 12)}`));
                console.log(chalk.dim(`  Goal:      ${goal.slice(0, 80)}...`));
                console.log(chalk.dim(`  Agents:    ${state.agents.length}`));
                console.log(chalk.dim(`  Tasks:     ${state.tasks.length}`));
                console.log('');
                console.log(chalk.yellow('Run `agent swarm status` to monitor progress.'));
            } catch (err) {
                console.error(chalk.red(`✗ Failed to start swarm: ${(err as Error).message}`));
                process.exit(1);
            }
        });

    // ─── swarm status ───
    cmd.command('status')
        .description('Show swarm session status')
        .action(async () => {
            const orchestrator = getSwarmOrchestrator();
            if (!orchestrator) {
                console.log(chalk.yellow('No active swarm session.'));
                console.log(chalk.dim('Run `agent swarm start "your goal"` to begin.'));
                return;
            }

            const status = orchestrator.getStatus();

            console.log(chalk.bold('🐝 Swarm Status'));
            console.log(chalk.dim('─'.repeat(50)));
            console.log(`  Session:  ${chalk.cyan(status.swarmId.slice(0, 12))}`);
            console.log(`  Status:   ${statusColor(status.status)}`);
            if (status.goal) {
                console.log(`  Goal:     ${chalk.dim(status.goal.slice(0, 60))}`);
            }
            if (status.uptime) {
                const s = Math.floor(status.uptime / 1000);
                console.log(`  Uptime:   ${chalk.dim(`${Math.floor(s / 60)}m ${s % 60}s`)}`);
            }

            if (status.agents.length > 0) {
                console.log('');
                console.log(chalk.bold('  Agents:'));
                for (const a of status.agents) {
                    const icon = a.status === 'busy' ? '⚡' : a.status === 'idle' ? '💤' : '✓';
                    console.log(`    ${icon} ${chalk.cyan(a.id.slice(0, 20))} [${a.role}] ${statusColor(a.status)}`);
                }
            }

            if (status.tasks.length > 0) {
                console.log('');
                console.log(chalk.bold('  Tasks:'));
                for (const t of status.tasks) {
                    const icon = t.status === 'running' ? '🔄' : t.status === 'completed' ? '✅' : t.status === 'failed' ? '❌' : '⏳';
                    console.log(`    ${icon} ${chalk.dim(t.id.slice(0, 12))} [${t.role}] ${statusColor(t.status)}`);
                }
            }
        });

    // ─── swarm stop ───
    cmd.command('stop')
        .description('Stop the active swarm session')
        .action(async () => {
            const orchestrator = getSwarmOrchestrator();
            if (!orchestrator || !orchestrator.isActive) {
                console.log(chalk.yellow('No active swarm session to stop.'));
                return;
            }

            orchestrator.stop();
            console.log(chalk.green('✓ Swarm session stopped.'));
        });

    // ─── swarm roles ───
    cmd.command('roles')
        .description('List available agent roles')
        .action(() => {
            const roles = getAllRoles();
            console.log(chalk.bold('🐝 Available Agent Roles'));
            console.log(chalk.dim('─'.repeat(50)));
            for (const role of roles) {
                console.log(`  ${chalk.cyan(role.role.padEnd(12))} ${role.name}`);
                console.log(`  ${chalk.dim('Capabilities:')} ${role.capabilities.join(', ')}`);
                console.log(`  ${chalk.dim('Tools:')}        ${role.tools.join(', ')}`);
                console.log('');
            }
        });

    return cmd;
}

function statusColor(status: string): string {
    switch (status) {
        case 'running': case 'busy': return chalk.yellow(status);
        case 'completed': case 'done': case 'idle': return chalk.green(status);
        case 'failed': case 'error': return chalk.red(status);
        default: return chalk.dim(status);
    }
}
