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

    // ─── Search plugins ───
    cmd.command('search <query>')
        .description('Search for plugins on the Agent Hub (agent-skills registry)')
        .option('-c, --category <category>', 'Filter by category')
        .action(async (query: string, opts: { category?: string }) => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const { RegistryClient } = await import('../../hub/registry.js');
            const client = new RegistryClient({
                skillsUrl: config.skills?.registryUrl,
                pluginsUrl: config.skills?.registryUrl
            });

            console.log(chalk.dim(`\n🔍 Searching Agent Hub (via agent-skills) for plugins matching "${query}"...\n`));

            try {
                const results = await client.search('plugin', query, opts.category);
                if (results.length === 0) {
                    console.log(chalk.yellow(`  No plugins found matching "${query}"`));
                    return;
                }

                console.log(chalk.bold.cyan(`  Found ${results.length} plugin(s):\n`));
                for (const plugin of results) {
                    console.log(`  ${chalk.white.bold(plugin.name)} ${chalk.dim(`v${plugin.version}`)} ${chalk.magenta(`[${plugin.category || 'Uncategorized'}]`)}`);
                    console.log(chalk.dim(`    ${plugin.description}`));
                    console.log(chalk.dim(`    Install: agent plugins install ${plugin.name}\n`));
                }
            } catch (err) {
                console.error(chalk.red(`\n✗ Failed to search hub: ${(err as Error).message}\n`));
                process.exit(1);
            }
        });

    // ─── Install a plugin ───
    cmd.command('install <source>')
        .description('Install a plugin from the Agent Hub (agent-skills) or a local path')
        .action(async (source: string) => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();

            const isLocalPath = source.startsWith('.') || source.startsWith('/') || source.includes(path.sep);

            if (isLocalPath) {
                const absSource = path.resolve(source);
                const targetDir = path.resolve(process.cwd(), config.plugins.installPaths[0] ?? '.agent/plugins');
                const pluginDirName = path.basename(absSource);
                const targetPath = path.join(targetDir, pluginDirName);

                mkdirSync(targetDir, { recursive: true });
                cpSync(absSource, targetPath, { recursive: true });

                console.log(chalk.green(`✓ Local plugin installed to ${path.relative(process.cwd(), targetPath)}`));
                console.log(chalk.dim('  It will be loaded automatically on next agent run.'));
            } else {
                console.log(chalk.dim(`\n📥 Installing plugin "${source}" from Agent Hub (via agent-skills)...\n`));
                try {
                    const { RegistryClient } = await import('../../hub/registry.js');
                    const client = new RegistryClient({
                        skillsUrl: config.skills?.registryUrl,
                        pluginsUrl: config.skills?.registryUrl
                    });
                    const { item, destPath } = await client.install('plugin', source, process.cwd());

                    console.log(chalk.green(`  ✓ Installed "${item.name}" v${item.version}`));
                    console.log(chalk.dim(`    Description: ${item.description}`));
                    console.log(chalk.dim(`    Path:        ${destPath}\n`));
                } catch (err) {
                    console.error(chalk.red(`\n✗ Failed to install "${source}": ${(err as Error).message}\n`));
                    process.exit(1);
                }
            }
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
