import { Command } from 'commander';
import chalk from 'chalk';
import { initDesktopEngine, getDesktopEngine } from '../../desktop/engine.js';

export function createDesktopCommand(): Command {
    const cmd = new Command('desktop')
        .description('Desktop automation tools');

    // ─── desktop screenshot ───
    cmd.command('screenshot')
        .description('Capture a screenshot of the desktop')
        .option('-r, --region <region>', 'Region to capture (x,y,w,h)')
        .action(async (opts) => {
            const engine = initDesktopEngine({ enabled: true });

            try {
                let region;
                if (opts.region) {
                    const [x, y, width, height] = opts.region.split(',').map(Number);
                    region = { x, y, width, height };
                }

                const result = await engine.screenshot(region);
                console.log(chalk.green('✓ Screenshot captured'));
                console.log(chalk.dim(`  Path: ${result.path}`));
            } catch (err) {
                console.error(chalk.red(`✗ ${(err as Error).message}`));
            }
        });

    // ─── desktop click ───
    cmd.command('click')
        .description('Click at a screen position')
        .argument('<x>', 'X coordinate')
        .argument('<y>', 'Y coordinate')
        .action(async (x, y) => {
            const engine = initDesktopEngine({ enabled: true });
            const result = await engine.mouseAction({
                type: 'click',
                x: parseInt(x),
                y: parseInt(y),
            });

            if (result.success) {
                console.log(chalk.green(`✓ Clicked at (${x}, ${y})`));
            } else {
                console.error(chalk.red(`✗ ${result.error}`));
            }
        });

    // ─── desktop type ───
    cmd.command('type')
        .description('Type text using keyboard simulation')
        .argument('<text>', 'Text to type')
        .option('--enter', 'Press Enter after typing')
        .action(async (text, opts) => {
            const engine = initDesktopEngine({ enabled: true });
            const result = await engine.typeText(text, opts.enter);

            if (result.success) {
                console.log(chalk.green(`✓ Typed: "${text}"`));
            } else {
                console.error(chalk.red(`✗ ${result.error}`));
            }
        });

    // ─── desktop hotkey ───
    cmd.command('hotkey')
        .description('Press a keyboard shortcut')
        .argument('<combo>', 'Key combination (e.g., ctrl+s, alt+tab)')
        .action(async (combo) => {
            const engine = initDesktopEngine({ enabled: true });
            const parts = combo.split('+');
            const key = parts.pop()!;
            const modifiers = parts as Array<'ctrl' | 'alt' | 'shift' | 'meta'>;

            const result = await engine.hotkey(key, modifiers);
            if (result.success) {
                console.log(chalk.green(`✓ Pressed: ${combo}`));
            } else {
                console.error(chalk.red(`✗ ${result.error}`));
            }
        });

    return cmd;
}
