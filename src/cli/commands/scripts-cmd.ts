import { Command } from 'commander';
import chalk from 'chalk';
import { ScriptLoader } from '../../scripts/loader.js';
import { ScriptRunner } from '../../scripts/runner.js';
import { ConfigLoader } from '../../config/loader.js';

export function createScriptsCommand(): Command {
    const cmd = new Command('scripts')
        .description('Manage and run repeatable scripts');

    // ─── List scripts ───
    cmd.command('list')
        .description('List all available scripts')
        .action(async () => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const scriptLoader = new ScriptLoader();

            const installPaths = config.scripts?.installPaths ?? ['.agent/scripts'];
            await scriptLoader.loadAll(installPaths, process.cwd());

            // Also load from plugins
            const { PluginLoader } = await import('../../plugins/loader.js');
            const { SkillLoader } = await import('../../skills/loader.js');
            const { CommandLoader } = await import('../../commands/loader.js');
            const { HookRegistry } = await import('../../hooks/registry.js');

            const pluginLoader = new PluginLoader();
            const skillLoader = new SkillLoader(config);
            const commandLoader = new CommandLoader();
            const hookRegistry = new HookRegistry();

            await pluginLoader.loadAll(
                config.plugins.installPaths,
                process.cwd(),
                skillLoader,
                commandLoader,
                hookRegistry,
                scriptLoader
            );

            const scripts = scriptLoader.list();

            if (scripts.length === 0) {
                console.log(chalk.dim('\nNo scripts found.'));
                console.log(chalk.dim(`\nCreate scripts in ${chalk.white('.agent/scripts/')}`));
                console.log(chalk.dim('Each subdirectory with a script.yaml becomes a script.\n'));
                console.log(chalk.dim('Example structure:\n'));
                console.log(chalk.dim('  .agent/scripts/deploy-staging/'));
                console.log(chalk.dim('    ├── script.yaml'));
                console.log(chalk.dim('    └── deploy.sh\n'));
                return;
            }

            console.log(chalk.bold(`\n📜 Available Scripts (${scripts.length})\n`));

            for (const script of scripts) {
                const tags = script.manifest.tags?.length
                    ? chalk.dim(` [${script.manifest.tags.join(', ')}]`)
                    : '';
                const source = chalk.dim(` (${script.source})`);
                const ver = script.manifest.version ? chalk.dim(` v${script.manifest.version}`) : '';

                console.log(`  ${chalk.cyan.bold(script.manifest.name)}${ver}${source}`);
                console.log(`    ${script.manifest.description}${tags}`);

                // Show args if any
                if (script.manifest.args && Object.keys(script.manifest.args).length > 0) {
                    const argList = Object.entries(script.manifest.args)
                        .map(([name, def]) => {
                            const req = def.required ? chalk.red('*') : '';
                            const dflt = def.default !== undefined ? chalk.dim(` [=${def.default}]`) : '';
                            return `${chalk.white(name)}${req}${dflt}`;
                        })
                        .join(', ');
                    console.log(chalk.dim(`    Args: ${argList}`));
                }

                console.log();
            }

            console.log(chalk.dim(`  Run with: ${chalk.white('agent scripts run <name> [--arg value]')}\n`));
        });

    // ─── Run a script ───
    cmd.command('run')
        .description('Run a script by name')
        .argument('<name>', 'Script name')
        .option('--yes', 'Skip confirmation prompt')
        .allowUnknownOption(true)
        .action(async (name: string, options: Record<string, unknown>, command: Command) => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const scriptLoader = new ScriptLoader();

            const installPaths = config.scripts?.installPaths ?? ['.agent/scripts'];
            await scriptLoader.loadAll(installPaths, process.cwd());

            // Also load from plugins
            const { PluginLoader } = await import('../../plugins/loader.js');
            const { SkillLoader } = await import('../../skills/loader.js');
            const { CommandLoader } = await import('../../commands/loader.js');
            const { HookRegistry } = await import('../../hooks/registry.js');

            const pluginLoader = new PluginLoader();
            const skillLoader = new SkillLoader(config);
            const commandLoader = new CommandLoader();
            const hookRegistry = new HookRegistry();

            await pluginLoader.loadAll(
                config.plugins.installPaths,
                process.cwd(),
                skillLoader,
                commandLoader,
                hookRegistry,
                scriptLoader
            );

            const script = scriptLoader.get(name);
            if (!script) {
                console.error(chalk.red(`Script "${name}" not found`));

                const available = scriptLoader.list();
                if (available.length > 0) {
                    console.log(chalk.dim('\nAvailable scripts:'));
                    for (const s of available) {
                        console.log(chalk.dim(`  - ${s.manifest.name}: ${s.manifest.description}`));
                    }
                }
                process.exit(1);
            }

            // Parse remaining args as key-value pairs (--key value)
            const rawArgs = command.args.slice(1);
            const scriptArgs: Record<string, string | boolean | number> = {};

            for (let i = 0; i < rawArgs.length; i++) {
                const arg = rawArgs[i];
                if (arg.startsWith('--')) {
                    const key = arg.slice(2);
                    const nextArg = rawArgs[i + 1];

                    if (!nextArg || nextArg.startsWith('--')) {
                        scriptArgs[key] = true; // Boolean flag
                    } else {
                        scriptArgs[key] = nextArg;
                        i++;
                    }
                }
            }

            // Confirmation
            if (script.manifest.confirm && !options.yes) {
                const readline = await import('node:readline');
                const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                const answer = await new Promise<string>((resolve) => {
                    rl.question(chalk.yellow(`\n⚠  Run script "${name}"? [y/N] `), resolve);
                });
                rl.close();

                if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
                    console.log(chalk.dim('  Cancelled.'));
                    return;
                }
            }

            console.log(chalk.bold(`\n▶  Running script: ${chalk.cyan(name)}`));
            console.log(chalk.dim(`   ${script.manifest.description}`));

            if (Object.keys(scriptArgs).length > 0) {
                console.log(chalk.dim(`   Args: ${JSON.stringify(scriptArgs)}`));
            }

            console.log(chalk.dim('   ─'.repeat(20)));
            console.log();

            const runner = new ScriptRunner();
            const result = await runner.run(script, scriptArgs, {
                projectRoot: process.cwd(),
            });

            console.log();
            console.log(chalk.dim('   ─'.repeat(20)));

            if (result.success) {
                console.log(chalk.green(`   ✓ Script completed successfully (${result.durationMs}ms)`));
            } else {
                console.log(chalk.red(`   ✗ Script failed with exit code ${result.exitCode} (${result.durationMs}ms)`));
                process.exit(result.exitCode);
            }
        });

    // ─── Show script details ───
    cmd.command('show')
        .description('Show details of a script')
        .argument('<name>', 'Script name')
        .action(async (name: string) => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const scriptLoader = new ScriptLoader();

            const installPaths = config.scripts?.installPaths ?? ['.agent/scripts'];
            await scriptLoader.loadAll(installPaths, process.cwd());

            const script = scriptLoader.get(name);
            if (!script) {
                console.error(chalk.red(`Script "${name}" not found`));
                process.exit(1);
            }

            const m = script.manifest;
            console.log(chalk.bold(`\n📜 ${chalk.cyan(m.name)}`));
            console.log(`   ${m.description}`);
            if (m.version) console.log(chalk.dim(`   Version: ${m.version}`));
            if (m.author) console.log(chalk.dim(`   Author: ${m.author}`));
            console.log(chalk.dim(`   Source: ${script.source}`));
            console.log(chalk.dim(`   Path: ${script.path}`));
            console.log(chalk.dim(`   Entrypoint: ${m.entrypoint}`));
            console.log(chalk.dim(`   Timeout: ${m.timeout ?? 300000}ms`));
            console.log(chalk.dim(`   Confirm: ${m.confirm ?? false}`));

            if (m.env && Object.keys(m.env).length > 0) {
                console.log(chalk.bold('\n   Environment:'));
                for (const [key, value] of Object.entries(m.env)) {
                    console.log(chalk.dim(`     ${key}=${value}`));
                }
            }

            if (m.args && Object.keys(m.args).length > 0) {
                console.log(chalk.bold('\n   Arguments:'));
                for (const [argName, def] of Object.entries(m.args)) {
                    const req = def.required ? chalk.red(' (required)') : '';
                    const dflt = def.default !== undefined ? chalk.dim(` [default: ${def.default}]`) : '';
                    console.log(`     ${chalk.white(`--${argName}`)}${req}${dflt}`);
                    console.log(chalk.dim(`       ${def.description}`));
                }
            }

            if (m.tags?.length) {
                console.log(chalk.dim(`\n   Tags: ${m.tags.join(', ')}`));
            }

            console.log();
        });

    return cmd;
}
