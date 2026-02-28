import { Command } from 'commander';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import ora from 'ora';

export function createUpdateCommand(): Command {
    return new Command('update')
        .description('Update the agent CLI to the latest version')
        .action(async () => {
            console.log(chalk.cyan('⠋ Checking for updates to @praveencs/agent...'));

            try {
                // Get current version from package file
                // Note: The global install will update the version
                const spinner = ora('Installing latest version from npm...').start();

                execSync('npm install -g @praveencs/agent@latest', { stdio: 'inherit' });

                spinner.succeed(chalk.green('Successfully updated to the latest version!'));
                console.log(chalk.dim('\nRestart any running agent daemons to apply changes.'));
                console.log(chalk.cyan('Run `agent --version` to verify the update.'));
            } catch (error) {
                console.error(chalk.red('\nFailed to update agent CLI:'));
                console.error(chalk.red((error as Error).message));
                console.log(chalk.yellow('\nYou can try updating manually with: npm install -g @praveencs/agent@latest'));
                process.exit(1);
            }
        });
}
