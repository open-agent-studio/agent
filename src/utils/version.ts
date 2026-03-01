import { readFileSync } from 'node:fs';

let agentVersion = 'unknown';

try {
    const pkgUrl = new URL('../../../package.json', import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgUrl, 'utf-8'));
    agentVersion = pkg.version;
} catch {
    // Fallback if package.json is stripped or inaccessible
    agentVersion = '0.9.13';
}

/**
 * Returns the current version of the @praveencs/agent package
 */
export function getAgentVersion(): string {
    return agentVersion;
}
