import { exec } from 'node:child_process';
import chalk from 'chalk';

const PACKAGE_NAME = '@praveencs/agent';

/**
 * Check if a newer version of the agent CLI is available on npm.
 * If outdated, attempt a background auto-update.
 * Designed to be fast (~1s) and never block the REPL on failure.
 */
export async function checkForUpdates(currentVersion: string): Promise<void> {
    try {
        // Quick fetch of the latest version from npm registry (timeout 4s)
        const res = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`, {
            signal: AbortSignal.timeout(4000),
        });

        if (!res.ok) return;

        const data = await res.json() as { version: string };
        const latestVersion = data.version;

        if (latestVersion === currentVersion) return;
        if (!isNewer(latestVersion, currentVersion)) return;

        console.log();
        console.log(chalk.yellow(`  ⬆ Update available: ${chalk.dim(`v${currentVersion}`)} → ${chalk.green.bold(`v${latestVersion}`)}`));

        // Fire-and-forget background update — don't block the REPL
        const child = exec(`npm install -g ${PACKAGE_NAME}@${latestVersion}`, { timeout: 120000 });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(chalk.green(`\n  ✓ Auto-updated to v${latestVersion}. Restart agent to use the new version.\n`));
            } else {
                console.log(chalk.yellow(`\n  ⚠ Auto-update failed. Run: ${chalk.cyan(`npm i -g ${PACKAGE_NAME}@latest`)}\n`));
            }
        });

        child.on('error', () => {
            // Permission error or npm not found — show manual instruction
            console.log(chalk.yellow(`  ⚠ Run manually: ${chalk.cyan(`npm i -g ${PACKAGE_NAME}@latest`)}`));
        });

        // Don't await — let the REPL start immediately
        console.log(chalk.dim(`    Updating in background...`));
        console.log();
    } catch {
        // Network timeout, offline, registry down — silently skip
    }
}

/**
 * Simple semver comparison: returns true if `a` is newer than `b`
 */
function isNewer(a: string, b: string): boolean {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
        const va = pa[i] ?? 0;
        const vb = pb[i] ?? 0;
        if (va > vb) return true;
        if (va < vb) return false;
    }
    return false;
}
