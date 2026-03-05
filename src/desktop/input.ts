// ─── Input Controller ───
// Simulates mouse and keyboard input using platform-native CLI tools.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { MouseAction, KeyboardAction, DesktopActionResult } from './types.js';

const execFileAsync = promisify(execFile);

export class InputController {
    private delay: number;

    constructor(actionDelay: number = 100) {
        this.delay = actionDelay;
    }

    /**
     * Execute a mouse action.
     */
    async mouse(action: MouseAction): Promise<DesktopActionResult> {
        const platform = process.platform;

        try {
            if (platform === 'linux') {
                await this.mouseLinux(action);
            } else if (platform === 'darwin') {
                await this.mouseMac(action);
            } else {
                throw new Error(`Mouse control not supported on ${platform} yet.`);
            }

            await this.sleep(this.delay);
            return { success: true, action: `mouse.${action.type}` };
        } catch (err) {
            return { success: false, action: `mouse.${action.type}`, error: (err as Error).message };
        }
    }

    /**
     * Execute a keyboard action.
     */
    async keyboard(action: KeyboardAction): Promise<DesktopActionResult> {
        const platform = process.platform;

        try {
            if (platform === 'linux') {
                await this.keyboardLinux(action);
            } else if (platform === 'darwin') {
                await this.keyboardMac(action);
            } else {
                throw new Error(`Keyboard control not supported on ${platform} yet.`);
            }

            await this.sleep(this.delay);
            return { success: true, action: `keyboard.${action.type}` };
        } catch (err) {
            return { success: false, action: `keyboard.${action.type}`, error: (err as Error).message };
        }
    }

    // ─── Linux (xdotool) ───

    private async mouseLinux(action: MouseAction): Promise<void> {
        switch (action.type) {
            case 'move':
                await execFileAsync('xdotool', ['mousemove', String(action.x || 0), String(action.y || 0)]);
                break;
            case 'click':
                if (action.x !== undefined && action.y !== undefined) {
                    await execFileAsync('xdotool', ['mousemove', String(action.x), String(action.y)]);
                }
                await execFileAsync('xdotool', ['click', action.button === 'right' ? '3' : '1']);
                break;
            case 'doubleClick':
                if (action.x !== undefined && action.y !== undefined) {
                    await execFileAsync('xdotool', ['mousemove', String(action.x), String(action.y)]);
                }
                await execFileAsync('xdotool', ['click', '--repeat', '2', '1']);
                break;
            case 'rightClick':
                if (action.x !== undefined && action.y !== undefined) {
                    await execFileAsync('xdotool', ['mousemove', String(action.x), String(action.y)]);
                }
                await execFileAsync('xdotool', ['click', '3']);
                break;
            case 'scroll':
                await execFileAsync('xdotool', ['click', (action.scrollAmount || 0) > 0 ? '5' : '4']);
                break;
            case 'drag':
                await execFileAsync('xdotool', [
                    'mousemove', String(action.x || 0), String(action.y || 0),
                    'mousedown', '1',
                    'mousemove', String(action.toX || 0), String(action.toY || 0),
                    'mouseup', '1',
                ]);
                break;
        }
    }

    private async keyboardLinux(action: KeyboardAction): Promise<void> {
        switch (action.type) {
            case 'type':
                await execFileAsync('xdotool', ['type', '--clearmodifiers', action.text || '']);
                break;
            case 'press':
                await execFileAsync('xdotool', ['key', action.key || '']);
                break;
            case 'hotkey': {
                const combo = [...(action.modifiers || []), action.key || ''].join('+');
                await execFileAsync('xdotool', ['key', combo]);
                break;
            }
        }
    }

    // ─── macOS (osascript / cliclick) ───

    private async mouseMac(action: MouseAction): Promise<void> {
        switch (action.type) {
            case 'click':
                await execFileAsync('osascript', ['-e',
                    `tell application "System Events" to click at {${action.x || 0}, ${action.y || 0}}`
                ]);
                break;
            case 'move':
                // Use cliclick if available, else AppleScript
                try {
                    await execFileAsync('cliclick', [`m:${action.x || 0},${action.y || 0}`]);
                } catch {
                    // Fallback: mouse move isn't natively easy on macOS without cliclick
                }
                break;
            default:
                throw new Error(`Mouse action ${action.type} requires cliclick on macOS`);
        }
    }

    private async keyboardMac(action: KeyboardAction): Promise<void> {
        switch (action.type) {
            case 'type':
                await execFileAsync('osascript', ['-e',
                    `tell application "System Events" to keystroke "${(action.text || '').replace(/"/g, '\\"')}"`
                ]);
                break;
            case 'press':
                await execFileAsync('osascript', ['-e',
                    `tell application "System Events" to key code ${this.macKeyCode(action.key || '')}`
                ]);
                break;
            case 'hotkey': {
                const mods = (action.modifiers || []).map(m =>
                    m === 'ctrl' ? 'control down' : m === 'alt' ? 'option down' : m === 'meta' ? 'command down' : `${m} down`
                ).join(', ');
                await execFileAsync('osascript', ['-e',
                    `tell application "System Events" to keystroke "${action.key}" using {${mods}}`
                ]);
                break;
            }
        }
    }

    private macKeyCode(key: string): string {
        const codes: Record<string, number> = {
            'Return': 36, 'Tab': 48, 'Escape': 53, 'Space': 49,
            'Delete': 51, 'Up': 126, 'Down': 125, 'Left': 123, 'Right': 124,
        };
        return String(codes[key] || 0);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
