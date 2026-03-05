import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigLoader } from '../../config/loader.js';
import { initSandboxEngine, getSandboxEngine } from '../../sandbox/engine.js';

export function createSandboxCommand(): Command {
    const cmd = new Command('sandbox')
        .description('Manage sandboxed Docker execution');

    // ─── sandbox start ───
    cmd.command('start')
        .description('Start a sandboxed Docker container for command execution')
        .option('-i, --image <image>', 'Docker image to use', 'node:20-slim')
        .option('-n, --network <mode>', 'Network mode: bridge, host, none', 'bridge')
        .action(async (opts) => {
            console.log(chalk.cyan('🐳 Starting sandbox container...'));

            try {
                const configLoader = new ConfigLoader();
                const config = await configLoader.load();
                const sandboxConfig = {
                    ...config.sandbox,
                    enabled: true,
                    image: opts.image || config.sandbox?.image || 'node:20-slim',
                    network: opts.network || config.sandbox?.network || 'bridge',
                };

                const engine = initSandboxEngine(process.cwd(), sandboxConfig);
                const container = await engine.start();

                console.log(chalk.green('✓ Sandbox started'));
                console.log(chalk.dim(`  Container: ${container.containerId.slice(0, 12)}`));
                console.log(chalk.dim(`  Image:     ${container.image}`));
                console.log(chalk.dim(`  Name:      ${container.name}`));
                console.log('');
                console.log(chalk.yellow('All cmd.run commands will now execute inside the sandbox.'));
                console.log(chalk.dim('Run `agent sandbox stop` to destroy the container.'));
            } catch (err) {
                const error = err as Error;
                console.error(chalk.red(`✗ Failed to start sandbox: ${error.message}`));
                process.exit(1);
            }
        });

    // ─── sandbox stop ───
    cmd.command('stop')
        .description('Stop and destroy the sandbox container')
        .action(async () => {
            const engine = getSandboxEngine();
            if (!engine || !engine.isActive) {
                console.log(chalk.yellow('No active sandbox container found.'));
                return;
            }

            try {
                await engine.stop();
                console.log(chalk.green('✓ Sandbox container destroyed.'));
            } catch (err) {
                const error = err as Error;
                console.error(chalk.red(`✗ Failed to stop sandbox: ${error.message}`));
            }
        });

    // ─── sandbox status ───
    cmd.command('status')
        .description('Show sandbox status')
        .action(async () => {
            const engine = getSandboxEngine();
            if (!engine) {
                console.log(chalk.dim('Sandbox: ') + chalk.yellow('not initialized'));
                console.log(chalk.dim('Run `agent sandbox start` to create a sandbox.'));
                return;
            }

            const status = await engine.status();

            console.log(chalk.bold('🐳 Sandbox Status'));
            console.log(chalk.dim('─'.repeat(40)));
            console.log(`  Enabled:      ${status.enabled ? chalk.green('yes') : chalk.dim('no')}`);
            console.log(`  Running:      ${status.running ? chalk.green('yes') : chalk.red('no')}`);
            console.log(`  Image:        ${chalk.cyan(status.image)}`);
            if (status.containerId) {
                console.log(`  Container ID: ${chalk.dim(status.containerId.slice(0, 12))}`);
            }
            if (status.uptime) {
                const seconds = Math.floor(status.uptime / 1000);
                const minutes = Math.floor(seconds / 60);
                const hours = Math.floor(minutes / 60);
                const uptimeStr = hours > 0
                    ? `${hours}h ${minutes % 60}m`
                    : `${minutes}m ${seconds % 60}s`;
                console.log(`  Uptime:       ${chalk.dim(uptimeStr)}`);
            }
        });

    return cmd;
}
