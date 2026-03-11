import { Command } from 'commander';
import chalk from 'chalk';
import { generateApiKey, listApiKeys, revokeApiKey } from '../../server/auth.js';

export function createApiKeysCommand(): Command {
    const cmd = new Command('api-keys')
        .description('Manage API keys for the Agent Studio REST API');

    // ─── api-keys create ───
    cmd.command('create')
        .description('Generate a new API key')
        .option('-l, --label <label>', 'Label for the key', 'cli-generated')
        .action(async (opts) => {
            try {
                const { rawKey, entry } = await generateApiKey(opts.label);
                console.log(chalk.green('\n  ✓ API key created\n'));
                console.log(chalk.bold(`  Key:     ${chalk.cyan(rawKey)}`));
                console.log(chalk.dim(`  ID:      ${entry.id}`));
                console.log(chalk.dim(`  Label:   ${entry.label}`));
                console.log(chalk.dim(`  Created: ${new Date(entry.createdAt).toLocaleString()}`));
                console.log(chalk.yellow('\n  ⚠ Save this key now — it cannot be shown again.\n'));
            } catch (err) {
                console.error(chalk.red(`  ✗ Failed: ${(err as Error).message}`));
                process.exit(1);
            }
        });

    // ─── api-keys list ───
    cmd.command('list')
        .description('List all API keys')
        .action(async () => {
            try {
                const keys = await listApiKeys();
                if (keys.length === 0) {
                    console.log(chalk.yellow('\n  No API keys found.'));
                    console.log(chalk.dim('  Run `agent api-keys create` to generate one.\n'));
                    return;
                }
                console.log(chalk.bold('\n  🔑 API Keys'));
                console.log(chalk.dim('  ' + '─'.repeat(50)));
                for (const k of keys) {
                    const date = new Date(k.createdAt).toLocaleDateString();
                    console.log(`  ${chalk.cyan(k.id)}  ${k.label.padEnd(20)}  ${chalk.dim(date)}`);
                }
                console.log(chalk.dim(`\n  ${keys.length} key(s) total\n`));
            } catch (err) {
                console.error(chalk.red(`  ✗ Failed: ${(err as Error).message}`));
                process.exit(1);
            }
        });

    // ─── api-keys revoke ───
    cmd.command('revoke')
        .description('Revoke an API key by its ID')
        .argument('<id>', 'The key ID to revoke')
        .action(async (id) => {
            try {
                const ok = await revokeApiKey(id);
                if (ok) {
                    console.log(chalk.green(`\n  ✓ Key ${id} revoked.\n`));
                } else {
                    console.log(chalk.yellow(`\n  Key ${id} not found.\n`));
                }
            } catch (err) {
                console.error(chalk.red(`  ✗ Failed: ${(err as Error).message}`));
                process.exit(1);
            }
        });

    return cmd;
}
