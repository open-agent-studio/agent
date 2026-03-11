import { Command } from 'commander';
import chalk from 'chalk';
import { SessionStore } from '../../session/session-store.js';
import { writeFileSync } from 'node:fs';
import { startREPL } from '../repl.js';
import { resolve } from 'node:path';

export function createSessionsCommand(): Command {
    const cmd = new Command('sessions')
        .description('Manage persistent agent conversations');

    const store = new SessionStore(process.cwd());

    // ─── sessions list ───
    cmd.command('list')
        .description('List all saved sessions')
        .option('-n, --limit <n>', 'Maximum number to show', '50')
        .action((opts) => {
            const sessions = store.list(parseInt(opts.limit));
            if (sessions.length === 0) {
                console.log(chalk.yellow('\n  No saved sessions found.'));
                return;
            }

            console.log(chalk.bold('\n  💾 Saved Sessions'));
            console.log(chalk.dim('  ' + '─'.repeat(80)));
            console.log(chalk.dim('  ID      Name                 Turns  Status     Last Active'));
            console.log(chalk.dim('  ' + '─'.repeat(80)));

            for (const s of sessions) {
                const id = s.id.slice(0, 8);
                const name = (s.name || '<unnamed>').padEnd(20).slice(0, 20);
                const turns = s.turnCount.toString().padStart(5);
                const status = s.status === 'active' ? chalk.green(s.status.padEnd(8)) : chalk.dim(s.status.padEnd(8));
                const date = s.updatedAt.toLocaleString();
                console.log(`  ${chalk.cyan(id)}  ${name}  ${turns}  ${status}  ${chalk.dim(date)}`);
            }
            console.log(chalk.dim(`\n  ${sessions.length} session(s) total\n`));
        });

    // ─── sessions resume ───
    cmd.command('resume')
        .description('Resume a saved session interactively')
        .argument('<id>', 'Session ID to resume')
        .action(async (id) => {
            const data = store.load(id);
            if (!data) {
                console.error(chalk.red(`\n  ✗ Session '${id}' not found.\n`));
                process.exit(1);
            }

            console.log(chalk.green(`\n  ✓ Resuming session: ${data.name || id}`));
            console.log(chalk.dim(`    Turns: ${data.turnCount} | Last active: ${data.updatedAt.toLocaleString()}\n`));

            // Set env var to tell the REPL to load this session
            process.env.AGENT_RESUME_SESSION = id;
            await startREPL();
        });

    // ─── sessions delete ───
    cmd.command('delete')
        .description('Delete a session completely')
        .argument('<id>', 'Session ID to delete')
        .action((id) => {
            const ok = store.delete(id);
            if (ok) {
                console.log(chalk.green(`\n  ✓ Session '${id}' deleted.\n`));
            } else {
                console.log(chalk.yellow(`\n  Session '${id}' not found.\n`));
            }
        });

    // ─── sessions export ───
    cmd.command('export')
        .description('Export a session to a JSON file')
        .argument('<id>', 'Session ID to export')
        .argument('[file]', 'Output JSON file path (defaults to session-<id>.json)')
        .action((id, file) => {
            const data = store.load(id);
            if (!data) {
                console.error(chalk.red(`\n  ✗ Session '${id}' not found.\n`));
                process.exit(1);
            }

            const outPath = resolve(file || `session-${id}.json`);
            writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
            console.log(chalk.green(`\n  ✓ Session exported to ${outPath}\n`));
        });

    return cmd;
}
