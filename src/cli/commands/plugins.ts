import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { PluginLoader } from '../../plugins/loader.js';
import { SkillLoader } from '../../skills/loader.js';
import { CommandLoader } from '../../commands/loader.js';
import { HookRegistry } from '../../hooks/registry.js';
import { ConfigLoader } from '../../config/loader.js';
import { cpSync, mkdirSync } from 'node:fs';

export function createPluginsCommand(): Command {
    const cmd = new Command('plugins')
        .description('Manage agent plugins');

    // ─── List plugins ───
    cmd.command('list')
        .description('List installed plugins')
        .action(async () => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const skillLoader = new SkillLoader(config);
            const commandLoader = new CommandLoader();
            const hookRegistry = new HookRegistry();
            const pluginLoader = new PluginLoader();

            const plugins = await pluginLoader.loadAll(
                config.plugins.installPaths,
                process.cwd(),
                skillLoader,
                commandLoader,
                hookRegistry
            );

            if (plugins.length === 0) {
                console.log(chalk.dim('\nNo plugins installed.'));
                console.log(chalk.dim(`Install plugins from a local path:\n  ${chalk.white('agent plugins install <path>')}\n`));
                return;
            }

            console.log(chalk.bold(`\n🔌 Installed Plugins (${plugins.length})\n`));

            for (const plugin of plugins) {
                console.log(`  ${chalk.cyan.bold(plugin.manifest.name)} ${chalk.dim(`v${plugin.manifest.version}`)}`);
                console.log(`    ${plugin.manifest.description}`);

                const parts: string[] = [];
                if (plugin.skillsCount > 0) parts.push(`${plugin.skillsCount} skills`);
                if (plugin.commandsCount > 0) parts.push(`${plugin.commandsCount} commands`);
                if (plugin.hooksCount > 0) parts.push(`${plugin.hooksCount} hooks`);
                if (plugin.scriptsCount > 0) parts.push(`${plugin.scriptsCount} scripts`);

                if (parts.length > 0) {
                    console.log(chalk.dim(`    Provides: ${parts.join(', ')}`));
                }
                console.log();
            }
        });

    // ─── Install a plugin ───
    cmd.command('install')
        .description('Install a plugin from a local path')
        .argument('<path>', 'Path to the plugin directory')
        .action(async (sourcePath: string) => {
            const absSource = path.resolve(sourcePath);
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();

            const targetDir = path.resolve(process.cwd(), config.plugins.installPaths[0] ?? '.agent/plugins');
            const pluginDirName = path.basename(absSource);
            const targetPath = path.join(targetDir, pluginDirName);

            mkdirSync(targetDir, { recursive: true });
            cpSync(absSource, targetPath, { recursive: true });

            console.log(chalk.green(`✓ Plugin installed to ${path.relative(process.cwd(), targetPath)}`));
            console.log(chalk.dim('  It will be loaded automatically on next agent run.'));
        });

    // ─── Remove a plugin ───
    cmd.command('remove')
        .description('Remove an installed plugin')
        .argument('<name>', 'Plugin name')
        .action(async (name: string) => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();

            const { rmSync } = await import('node:fs');

            for (const installPath of config.plugins.installPaths) {
                const pluginPath = path.resolve(process.cwd(), installPath, name);
                try {
                    rmSync(pluginPath, { recursive: true, force: true });
                    console.log(chalk.green(`✓ Plugin "${name}" removed`));
                    return;
                } catch {
                    // Not in this path
                }
            }

            console.error(chalk.red(`Plugin "${name}" not found`));
            process.exit(1);
        });

    return cmd;
}
