import { Command } from 'commander';
import chalk from 'chalk';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ConfigLoader } from '../../config/loader.js';
import { MemoryStore } from '../../memory/store.js';
import { SkillLoader } from '../../skills/loader.js';
import { validateSkill } from '../../skills/validator.js';
import { getSkillsDir } from '../../utils/paths.js';
import { RegistryClient } from '../../hub/registry.js';

export function createSkillsCommand(): Command {
    const cmd = new Command('skills')
        .description('Manage skills');

    // ─── List installed skills ───
    cmd
        .command('list')
        .description('List installed skills')
        .action(async () => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const loader = new SkillLoader(config);
            const skills = await loader.loadAll();

            if (skills.length === 0) {
                console.log(chalk.yellow('\nNo skills installed.'));
                console.log(chalk.dim('  Create one: agent skills create <name>'));
                console.log(chalk.dim('  Or install: agent skills install <name>\n'));
                return;
            }

            console.log(chalk.bold.cyan('\n📦 Installed Skills\n'));
            for (const skill of skills) {
                const state = skill.manifest.state ?? 'draft';
                const stateColor = state === 'approved' ? chalk.green : state === 'deprecated' ? chalk.red : chalk.yellow;
                console.log(
                    `  ${chalk.white.bold(skill.manifest.name)}` +
                    ` ${chalk.dim(`v${skill.manifest.version}`)}` +
                    ` ${stateColor(`[${state}]`)}`
                );
                console.log(chalk.dim(`    ${skill.manifest.description}`));
                console.log(chalk.dim(`    Tools: ${skill.manifest.tools.join(', ')}`));
                console.log();
            }
        });

    // ─── Search the skill hub ───
    cmd
        .command('search <query>')
        .description('Search for skills on the Skill Hub')
        .option('-c, --category <category>', 'Filter by category')
        .action(async (query: string, opts: { category?: string }) => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const client = new RegistryClient({
                skillsUrl: config.skills?.registryUrl,
                pluginsUrl: config.skills?.registryUrl
            });

            console.log(chalk.dim(`\n🔍 Searching skill hub for "${query}"...\n`));

            try {
                const results = await client.search('skill', query, opts.category);

                if (results.length === 0) {
                    console.log(chalk.yellow(`  No skills found matching "${query}"`));
                    console.log(chalk.dim('  Try a broader search or browse categories.\n'));
                    return;
                }

                console.log(chalk.bold.cyan(`  Found ${results.length} skill(s):\n`));

                for (const skill of results) {
                    console.log(
                        `  ${chalk.white.bold(skill.name)}` +
                        ` ${chalk.dim(`v${skill.version}`)}` +
                        ` ${chalk.magenta(`[${skill.category}]`)}`
                    );
                    console.log(chalk.dim(`    ${skill.description}`));
                    console.log(chalk.dim(`    Tags: ${(skill.tags || []).join(', ')}`));
                    console.log(chalk.dim(`    Install: agent skills install ${skill.name}`));
                    console.log();
                }

                const registry = await client.getCatalog('skill');
                console.log(chalk.dim(`  Total: ${(registry.skills || []).length} skills available in hub\n`));

            } catch (err) {
                console.error(chalk.red(`\n✗ Failed to search hub: ${(err as Error).message}`));
                console.error(chalk.dim('  Check your internet connection or registry URL.\n'));
                process.exit(1);
            }
        });

    // ─── Create a new skill ───
    cmd
        .command('create <name>')
        .description('Create a new skill from template')
        .action(async (name: string) => {
            const skillDir = path.join(getSkillsDir(), name);
            await mkdir(skillDir, { recursive: true });

            const manifest = {
                name,
                version: '0.1.0',
                description: `Description for ${name}`,
                inputs: {},
                tools: ['fs.read'],
                permissions: { required: ['filesystem.read'] },
                entrypoint: 'prompt.md',
                state: 'draft',
            };

            await writeFile(
                path.join(skillDir, 'skill.json'),
                JSON.stringify(manifest, null, 2) + '\n',
                'utf-8'
            );

            await writeFile(
                path.join(skillDir, 'prompt.md'),
                `# ${name}\n\n## Description\nDescribe what this skill does.\n\n## Instructions\nProvide instructions for the LLM.\n\n## Input Variables\n{{input}}\n`,
                'utf-8'
            );

            console.log(chalk.green(`\n✓ Created skill "${name}" at ${skillDir}`));
            console.log(chalk.dim(`  Edit skill.json and prompt.md to customize.\n`));
        });

    // ─── Install a skill (local path OR from hub) ───
    cmd
        .command('install <source>')
        .description('Install a skill from the Skill Hub or a local path')
        .action(async (source: string) => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();

            // Check if source is a local path (starts with . or / or contains path separator)
            const isLocalPath = source.startsWith('.') || source.startsWith('/') || source.includes(path.sep);

            if (isLocalPath) {
                // Local install (existing logic)
                const loader = new SkillLoader(config);
                try {
                    const skill = await loader.installFromPath(source);
                    if (skill) {
                        console.log(chalk.green(`\n✓ Installed skill "${skill.manifest.name}" v${skill.manifest.version}\n`));
                    }
                } catch (err) {
                    console.error(chalk.red(`\n✗ Failed to install: ${(err as Error).message}\n`));
                    process.exit(1);
                }
            } else {
                // Remote install from skill hub
                console.log(chalk.dim(`\n📥 Installing "${source}" from Skill Hub...\n`));

                try {
                    const client = new RegistryClient({
                        skillsUrl: config.skills?.registryUrl,
                        pluginsUrl: config.skills?.registryUrl
                    });
                    const { item: skillInfo, destPath: skillDir } = await client.install('skill', source, process.cwd());

                    console.log(chalk.green(`  ✓ Installed "${skillInfo.name}" v${skillInfo.version}`));
                    console.log(chalk.dim(`    Category:    ${skillInfo.category}`));
                    console.log(chalk.dim(`    Description: ${skillInfo.description}`));
                    console.log(chalk.dim(`    Tools:       ${(skillInfo.tools || []).join(', ')}`));
                    console.log(chalk.dim(`    Path:        ${skillDir}`));
                    console.log(chalk.dim(`\n  Run: agent run --skill ${source} "<goal>"\n`));

                } catch (err) {
                    console.error(chalk.red(`\n✗ Failed to install "${source}": ${(err as Error).message}`));
                    console.error(chalk.dim('  Check your internet connection or try again later.\n'));
                    process.exit(1);
                }
            }
        });

    // ─── Remove a skill ───
    cmd
        .command('remove <name>')
        .description('Remove an installed skill')
        .action(async (name: string) => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const loader = new SkillLoader(config);
            await loader.loadAll();

            const removed = await loader.remove(name);
            if (removed) {
                console.log(chalk.green(`\n✓ Removed skill "${name}"\n`));
            } else {
                console.error(chalk.red(`\n✗ Skill "${name}" not found\n`));
            }
        });

    // ─── Show skill info ───
    cmd
        .command('info <name>')
        .description('Show detailed information about a skill')
        .action(async (name: string) => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const loader = new SkillLoader(config);
            await loader.loadAll();

            const skill = loader.get(name);
            if (!skill) {
                console.error(chalk.red(`\nSkill "${name}" not found\n`));
                process.exit(1);
            }

            const m = skill.manifest;
            console.log(chalk.bold.cyan(`\n${m.name} v${m.version}\n`));
            console.log(`  ${chalk.dim('Description:')} ${m.description}`);
            console.log(`  ${chalk.dim('State:')}       ${m.state ?? 'draft'}`);
            console.log(`  ${chalk.dim('Entrypoint:')}  ${m.entrypoint}`);
            console.log(`  ${chalk.dim('Tools:')}       ${m.tools.join(', ')}`);
            console.log(`  ${chalk.dim('Permissions:')} ${m.permissions.required.join(', ')}`);
            console.log(`  ${chalk.dim('Path:')}        ${skill.path}`);

            if (m.constraints) {
                if (m.constraints.os) console.log(`  ${chalk.dim('OS:')}          ${m.constraints.os.join(', ')}`);
                if (m.constraints.binaries) console.log(`  ${chalk.dim('Binaries:')}    ${m.constraints.binaries.join(', ')}`);
            }

            const validation = await validateSkill(skill);
            console.log(
                `\n  ${chalk.dim('Valid:')}       ${validation.valid ? chalk.green('Yes') : chalk.red('No')}`
            );
            if (!validation.valid) {
                for (const err of validation.errors) {
                    console.log(chalk.red(`    - ${err}`));
                }
            }
            if (validation.warnings.length > 0) {
                for (const w of validation.warnings) {
                    console.log(chalk.yellow(`    ⚠ ${w}`));
                }
            }
            console.log();
        });

    // ─── Update / sync skills from hub ───
    cmd
        .command('update')
        .description('Sync all installed skills with the latest from Skill Hub')
        .action(async () => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const loader = new SkillLoader(config);
            const installed = await loader.loadAll();
            // Removed the fallback URL, now directly uses config.skills?.registryUrl
            // const registryUrl = config.skills?.registryUrl ??
            //     'https://raw.githubusercontent.com/praveencs87/agent-skills/main';

            if (installed.length === 0) {
                console.log(chalk.yellow('\nNo skills installed to update.\n'));
                return;
            }

            console.log(chalk.dim(`\n🔄 Checking for updates...\n`));

            try {
                const client = new RegistryClient({
                    skillsUrl: config.skills?.registryUrl,
                    pluginsUrl: config.skills?.registryUrl
                });
                const catalog = await client.getCatalog('skill');
                const hubSkills = catalog.skills || [];
                let updated = 0;

                for (const skill of installed) {
                    const hubSkill = hubSkills.find(s => s.name === skill.manifest.name);
                    if (!hubSkill) {
                        console.log(chalk.dim(`  ⏭ ${skill.manifest.name} — not in hub (local skill)`));
                        continue;
                    }

                    if (hubSkill.version !== skill.manifest.version) {
                        console.log(
                            chalk.cyan(`  ⬆ ${skill.manifest.name}: `) +
                            chalk.dim(`${skill.manifest.version} → `) +
                            chalk.green(hubSkill.version)
                        );

                        // Re-download via client
                        await client.install('skill', hubSkill.name, process.cwd());
                        updated++;
                    } else {
                        console.log(chalk.dim(`  ✓ ${skill.manifest.name} — already latest (v${skill.manifest.version})`));
                    }
                }

                console.log(chalk.green(`\n✓ ${updated} skill(s) updated.\n`));
            } catch (err) {
                console.error(chalk.red(`\n✗ Failed to check updates: ${(err as Error).message}\n`));
                process.exit(1);
            }
        });

    // ─── Browse all available skills ───
    cmd
        .command('browse')
        .description('Browse all available skills on the Skill Hub')
        .action(async () => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const client = new RegistryClient({
                skillsUrl: config.skills?.registryUrl,
                pluginsUrl: config.skills?.registryUrl
            });

            console.log(chalk.dim(`\n📚 Fetching skill catalog...\n`));

            try {
                const registry = await client.getCatalog('skill');
                const skills = registry.skills || [];

                // Group by category
                const categories = new Map<string, any[]>();
                for (const skill of skills) {
                    const cat = skill.category || 'Uncategorized';
                    if (!categories.has(cat)) categories.set(cat, []);
                    categories.get(cat)!.push(skill);
                }

                console.log(chalk.bold.cyan(`  🧠 ${registry.name}\n`));

                for (const [category, catSkills] of categories) {
                    console.log(chalk.bold.magenta(`  ${category}`));
                    for (const s of catSkills) {
                        console.log(
                            `    ${chalk.white(s.name)}` +
                            chalk.dim(` — ${s.description}`)
                        );
                    }
                    console.log();
                }

                console.log(chalk.dim(`  Total: ${skills.length} skills available`));
                console.log(chalk.dim(`  Install: agent skills install <name>\n`));

            } catch (err) {
                console.error(chalk.red(`\n✗ Failed to fetch catalog: ${(err as Error).message}\n`));
                process.exit(1);
            }
        });

    // ─── Stats ───
    cmd
        .command('stats')
        .description('Show skill usage statistics')
        .action(async () => {
            const mem = MemoryStore.open(process.cwd());
            const metrics = mem.getSkillMetrics();

            if (metrics.length === 0) {
                console.log(chalk.yellow('\nNo skill usage recorded yet.\n'));
                return;
            }

            console.log(chalk.bold.cyan('\n📊 Skill Metrics\n'));

            // Column widths
            const nameW = 20;
            const callsW = 8;
            const successW = 10;
            const failuresW = 10;
            const rateW = 8;
            const timeW = 10;

            console.log(
                chalk.dim(
                    'SKILL'.padEnd(nameW) +
                    'CALLS'.padEnd(callsW) +
                    'SUCCESS'.padEnd(successW) +
                    'FAILURES'.padEnd(failuresW) +
                    'RATE'.padEnd(rateW) +
                    'AVG TIME'.padEnd(timeW)
                )
            );
            console.log(chalk.dim('-'.repeat(nameW + callsW + successW + failuresW + rateW + timeW)));

            for (const m of metrics) {
                const rate = Math.round((m.successes / m.calls) * 100);
                const avgTime = Math.round(m.total_duration_ms / m.calls);
                const rateColor = rate > 90 ? chalk.green : rate > 70 ? chalk.yellow : chalk.red;

                console.log(
                    chalk.white(m.skill.padEnd(nameW)) +
                    m.calls.toString().padEnd(callsW) +
                    chalk.green(m.successes.toString().padEnd(successW)) +
                    chalk.red(m.failures.toString().padEnd(failuresW)) +
                    rateColor((rate + '%').padEnd(rateW)) +
                    (avgTime + 'ms').padEnd(timeW)
                );
            }
            console.log();
        });


    // ─── Doctor ───
    cmd
        .command('doctor <name>')
        .description('Diagnose issues with a specific skill')
        .action(async (name: string) => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const skillLoader = new SkillLoader(config);
            await skillLoader.loadAll();
            const { LLMRouter } = await import('../../llm/router.js');
            const llm = new LLMRouter(config);
            const mem = MemoryStore.open(process.cwd());
            const { SkillDoctor } = await import('../../skills/doctor.js');

            const doctor = new SkillDoctor(mem, skillLoader, llm);
            console.log(chalk.dim(`\n🔍 Analyzing logs for "${name}"...\n`));

            const diagnosis = await doctor.diagnose(name);

            console.log(chalk.bold.cyan(`🩺 Diagnosis for "${name}"\n`));

            if (diagnosis.healthy) {
                console.log(chalk.green('✓ Skill appears healthy.'));
                if (diagnosis.logsanalyzed === 0) {
                    console.log(chalk.dim('  (No recent usage or errors found)'));
                }
            } else {
                console.log(chalk.red('✗ Issues detected:'));
                for (const issue of diagnosis.issues) {
                    console.log(chalk.yellow(`  - ${issue}`));
                }
                console.log(chalk.dim(`\n  Analyzed ${diagnosis.logsanalyzed} recent error logs.`));
                console.log(chalk.dim(`  Run 'agent skills fix ${name}' to attempt auto-repair.`));
            }
            console.log();
        });

    // ─── Fix ───
    cmd
        .command('fix <name>')
        .description('Attempt to auto-fix a broken skill using LLM')
        .action(async (name: string) => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const skillLoader = new SkillLoader(config);
            await skillLoader.loadAll();

            const { LLMRouter } = await import('../../llm/router.js');
            const llm = new LLMRouter(config);
            const mem = MemoryStore.open(process.cwd());
            const { SkillDoctor } = await import('../../skills/doctor.js');

            console.log(chalk.blue(`\n🔧 Attempting to fix "${name}" using LLM...`));
            console.log(chalk.dim(`  Reading source code and error logs...`));

            const doctor = new SkillDoctor(mem, skillLoader, llm);
            const result = await doctor.fix(name);

            if (result.success) {
                console.log(chalk.green(`\n✓ Successfully patched "${name}"!`));
                console.log(chalk.white(`  Reasoning: ${result.reasoning}`));
                console.log(chalk.dim(`  The skill has been reloaded and is ready to use.\n`));
            } else {
                console.log(chalk.red(`\n✗ Failed to fix "${name}"`));
                console.log(chalk.yellow(`  Reason: ${result.reasoning}\n`));
            }
        });

    // ─── Publish a skill ───
    cmd
        .command('publish <name>')
        .description('Publish a local skill to the Skill Hub')
        .action(async (name: string) => {
            const { Publisher } = await import('../../hub/publisher.js');
            const publisher = new Publisher(process.cwd());
            try {
                await publisher.publish('skill', name);
            } catch (err) {
                console.error(chalk.red(`\n✗ Failed to publish skill: ${(err as Error).message}\n`));
                process.exit(1);
            }
        });

    return cmd;
}
