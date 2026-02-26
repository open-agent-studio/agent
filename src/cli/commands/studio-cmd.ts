import { Command } from 'commander';
import chalk from 'chalk';
import { createStudioServer } from '../../server/app.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export function createStudioCommand(): Command {
    const cmd = new Command('studio')
        .description('Launch Agent Studio for observability')
        .option('-p, --port <number>', 'Port to run the studio server on', '3333')
        .action(async (options) => {
            const port = parseInt(options.port, 10);
            const server = createStudioServer();

            server.listen(port, async () => {
                const url = `http://localhost:${port}`;
                console.log(chalk.cyan(`\n  ✨ Agent Studio is running at ${chalk.bold(url)}`));
                console.log(chalk.dim(`  Connects to all active agent instances on this machine.\n`));
                console.log(chalk.yellow(`  Press Ctrl+C to stop.`));

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
