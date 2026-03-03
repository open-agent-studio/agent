import { Command } from 'commander';
import chalk from 'chalk';
import { createStudioServer } from '../../server/app.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';

const execAsync = promisify(exec);

export function createStudioCommand(): Command {
    const cmd = new Command('studio')
        .description('Launch Agent Studio for observability')
        .option('-p, --port <number>', 'Port to run the studio server on', '3333')
        .option('--remote', 'Enable remote access via tunnel + QR code')
        .action(async (options) => {
            const port = parseInt(options.port, 10);
            const server = createStudioServer();

            server.listen(port, async () => {
                const url = `http://localhost:${port}`;
                console.log(chalk.cyan(`\n  ✨ Agent Studio is running at ${chalk.bold(url)}`));
                console.log(chalk.dim(`  Connects to all active agent instances on this machine.\n`));

                // Remote access via tunnel + QR code
                if (options.remote) {
                    try {
                        const token = randomBytes(16).toString('hex');
                        console.log(chalk.yellow('  🌐 Starting remote tunnel...'));

                        const localtunnel = (await import('localtunnel')).default;
                        const tunnel = await localtunnel({ port });
                        const remoteUrl = `${tunnel.url}?token=${token}`;

                        console.log(chalk.green(`\n  🔗 Remote URL: ${chalk.bold(remoteUrl)}`));
                        console.log(chalk.dim(`  Token: ${token}\n`));

                        // Print QR code in terminal
                        try {
                            const qrcode = (await import('qrcode-terminal')).default;
                            console.log(chalk.yellow('  📱 Scan this QR code to access from your phone:\n'));
                            qrcode.generate(remoteUrl, { small: true }, (qr: string) => {
                                const lines = qr.split('\n');
                                lines.forEach(line => console.log(`    ${line}`));
                            });
                        } catch {
                            console.log(chalk.dim('  (QR code generation not available)'));
                        }

                        console.log(chalk.dim(`\n  Remote session active. Share the URL or scan the QR code.`));
                        console.log(chalk.yellow(`  Press Ctrl+C to stop.\n`));

                        tunnel.on('close', () => {
                            console.log(chalk.red('\n  Tunnel closed.'));
                        });

                        // Store tunnel URL for Studio API
                        (server as any).__tunnelUrl = remoteUrl;
                        (server as any).__tunnelToken = token;

                    } catch (err) {
                        console.error(chalk.red(`  Failed to start tunnel: ${(err as Error).message}`));
                        console.log(chalk.dim('  Studio is still running locally.\n'));
                    }
                } else {
                    console.log(chalk.yellow(`  Press Ctrl+C to stop.`));
                    console.log(chalk.dim(`  Tip: Use ${chalk.bold('agent studio --remote')} to access from your phone.\n`));
                }

                try {
                    // Detect OS and open browser
                    if (process.platform === 'darwin') {
                        await execAsync(`open ${url}`);
                    } else if (process.platform === 'win32') {
                        await execAsync(`start ${url}`);
                    } else {
                        await execAsync(`xdg-open ${url}`);
                    }
                } catch (err) {
                    console.error(chalk.red(`Failed to launch browser: ${(err as Error).message}`));
                }
            });
        });

    return cmd;
}
