import chalk from 'chalk';
import type { AgentConfig } from '../../config/schema.js';

/**
 * Render the welcome banner for interactive mode
 */
export function renderBanner(_config: AgentConfig, meta: {
    version: string;
    project?: string;
    skillCount: number;
    commandCount: number;
    scriptCount?: number;
    provider: string;
}): void {
    const width = 48;
    const top = `╭${'─'.repeat(width)}╮`;
    const bottom = `╰${'─'.repeat(width)}╯`;

    const pad = (text: string, rawLen: number) => {
        const padding = width - rawLen;
        return `│ ${text}${' '.repeat(Math.max(0, padding - 1))}│`;
    };

    console.log();
    console.log(chalk.cyan(top));
    console.log(chalk.cyan(pad(
        `${chalk.bold('🤖 Agent Runtime')} ${chalk.dim(`v${meta.version}`)}`,
        `🤖 Agent Runtime v${meta.version}`.length + 1
    )));

    if (meta.project) {
        const projLine = `  Project: ${meta.project}`;
        console.log(chalk.cyan(pad(chalk.white(projLine), projLine.length)));
    }

    const scriptsPart = meta.scriptCount ? ` │ ${meta.scriptCount} scripts` : '';
    const infoLine = `  Model: ${meta.provider} │ ${meta.skillCount} skills │ ${meta.commandCount} commands${scriptsPart}`;
    console.log(chalk.cyan(pad(chalk.dim(infoLine), infoLine.length)));

    console.log(chalk.cyan(bottom));
    console.log();
    console.log(chalk.dim('  Type a goal, a /command, or /help for help.'));
    console.log();
}

/**
 * Render a compact tool call inline
 */
export function renderToolCall(name: string, args: unknown, status: 'running' | 'success' | 'error', error?: string): void {
    const argsStr = typeof args === 'object' ? JSON.stringify(args) : String(args);
    const truncated = argsStr.length > 60 ? argsStr.slice(0, 57) + '...' : argsStr;

    switch (status) {
        case 'running':
            process.stdout.write(chalk.dim(`  ⚡ ${name}(`) + chalk.dim(truncated) + chalk.dim(') '));
            break;
        case 'success':
            console.log(chalk.green('✓'));
            break;
        case 'error':
            console.log(chalk.red(`✗ ${error ?? 'failed'}`));
            break;
    }
}

/**
 * Render a section separator
 */
export function renderSeparator(): void {
    console.log(chalk.dim('  ' + '─'.repeat(56)));
}

/**
 * Render a boxed summary
 */
export function renderSummary(title: string, durationMs: number): void {
    renderSeparator();
    const secs = (durationMs / 1000).toFixed(1);
    console.log(chalk.green.bold(`  ✓ ${title}`) + chalk.dim(` (${secs}s)`));
    console.log();
}

/**
 * Render an error result
 */
export function renderError(message: string): void {
    renderSeparator();
    console.log(chalk.red.bold(`  ✗ ${message}`));
    console.log();
}

/**
 * Render streaming text character by character
 */
export async function renderStreaming(text: string, delayMs = 8): Promise<void> {
    for (const char of text) {
        process.stdout.write(char);
        if (delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
}
