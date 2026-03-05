// ─── Screen Capture ───
// Takes screenshots using platform-native CLI tools (no npm dependencies).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ScreenCaptureResult, ScreenRegion } from './types.js';

const execFileAsync = promisify(execFile);

export class ScreenCapture {
    private tempDir: string;

    constructor(tempDir: string = '/tmp/agent-desktop') {
        this.tempDir = tempDir;
        if (!existsSync(this.tempDir)) {
            mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Capture a full screenshot or a specific region.
     */
    async capture(region?: ScreenRegion): Promise<ScreenCaptureResult> {
        const filename = `screenshot-${Date.now()}.png`;
        const filepath = join(this.tempDir, filename);
        const platform = process.platform;

        try {
            if (platform === 'linux') {
                await this.captureLinux(filepath, region);
            } else if (platform === 'darwin') {
                await this.captureMac(filepath, region);
            } else if (platform === 'win32') {
                await this.captureWindows(filepath, region);
            } else {
                throw new Error(`Unsupported platform: ${platform}`);
            }

            return {
                path: filepath,
                width: region?.width ?? 0,
                height: region?.height ?? 0,
                format: 'png',
                timestamp: new Date(),
            };
        } catch (err) {
            throw new Error(`Screenshot failed: ${(err as Error).message}`);
        }
    }

    private async captureLinux(filepath: string, region?: ScreenRegion): Promise<void> {
        // Try multiple tools in order of preference
        const tools = ['gnome-screenshot', 'scrot', 'import'];

        for (const tool of tools) {
            try {
                if (tool === 'gnome-screenshot') {
                    const args = ['-f', filepath];
                    if (region) {
                        args.push('-a'); // area mode fallback
                    }
                    await execFileAsync('gnome-screenshot', args, { timeout: 10000 });
                    return;
                } else if (tool === 'scrot') {
                    const args = region
                        ? ['-a', `${region.x},${region.y},${region.width},${region.height}`, filepath]
                        : [filepath];
                    await execFileAsync('scrot', args, { timeout: 10000 });
                    return;
                } else if (tool === 'import') {
                    // ImageMagick
                    const args = region
                        ? ['-window', 'root', '-crop', `${region.width}x${region.height}+${region.x}+${region.y}`, filepath]
                        : ['-window', 'root', filepath];
                    await execFileAsync('import', args, { timeout: 10000 });
                    return;
                }
            } catch {
                continue; // Try next tool
            }
        }
        throw new Error('No screenshot tool found. Install scrot, gnome-screenshot, or ImageMagick.');
    }

    private async captureMac(filepath: string, region?: ScreenRegion): Promise<void> {
        const args = ['-c', '-x']; // clipboard, no sound
        if (region) {
            args.push('-R', `${region.x},${region.y},${region.width},${region.height}`);
        }
        args.push(filepath);
        await execFileAsync('screencapture', args, { timeout: 10000 });
    }

    private async captureWindows(filepath: string, _region?: ScreenRegion): Promise<void> {
        // PowerShell screenshot command
        const script = `
            Add-Type -AssemblyName System.Windows.Forms;
            [System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object {
                $bmp = New-Object System.Drawing.Bitmap($_.Bounds.Width, $_.Bounds.Height);
                $graphics = [System.Drawing.Graphics]::FromImage($bmp);
                $graphics.CopyFromScreen($_.Bounds.Location, [System.Drawing.Point]::Empty, $_.Bounds.Size);
                $bmp.Save('${filepath.replace(/\\/g, '\\\\')}');
            }
        `;
        await execFileAsync('powershell', ['-Command', script], { timeout: 10000 });
    }

    /**
     * Clean up all temporary screenshots.
     */
    cleanup(): void {
        try {
            const { readdirSync, unlinkSync } = require('node:fs');
            const files = readdirSync(this.tempDir);
            for (const f of files) {
                if (f.startsWith('screenshot-')) {
                    unlinkSync(join(this.tempDir, f));
                }
            }
        } catch { /* ignore */ }
    }
}
