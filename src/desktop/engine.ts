// ─── Desktop Automation Engine ───
// Orchestrates screen capture and input simulation for desktop automation.

import { ScreenCapture } from './screen.js';
import { InputController } from './input.js';
import type { DesktopConfig, ScreenRegion, MouseAction, KeyboardAction, DesktopActionResult, ScreenCaptureResult } from './types.js';
import { DEFAULT_DESKTOP_CONFIG } from './types.js';

export class DesktopEngine {
    private config: DesktopConfig;
    private screen: ScreenCapture;
    private input: InputController;

    constructor(config?: Partial<DesktopConfig>) {
        this.config = { ...DEFAULT_DESKTOP_CONFIG, ...config };
        this.screen = new ScreenCapture(this.config.tempDir);
        this.input = new InputController(this.config.actionDelay);
    }

    get enabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Take a screenshot.
     */
    async screenshot(region?: ScreenRegion): Promise<ScreenCaptureResult> {
        return this.screen.capture(region);
    }

    /**
     * Perform a mouse action.
     */
    async mouseAction(action: MouseAction): Promise<DesktopActionResult> {
        return this.input.mouse(action);
    }

    /**
     * Perform a keyboard action.
     */
    async keyboardAction(action: KeyboardAction): Promise<DesktopActionResult> {
        return this.input.keyboard(action);
    }

    /**
     * Click at a position and take a screenshot after.
     */
    async clickAndCapture(x: number, y: number): Promise<{ click: DesktopActionResult; screenshot: ScreenCaptureResult }> {
        const click = await this.input.mouse({ type: 'click', x, y });
        await new Promise(r => setTimeout(r, 300)); // Wait for UI to update
        const screenshot = await this.screen.capture();
        return { click, screenshot };
    }

    /**
     * Type text and optionally press Enter.
     */
    async typeText(text: string, pressEnter: boolean = false): Promise<DesktopActionResult> {
        const result = await this.input.keyboard({ type: 'type', text });
        if (pressEnter && result.success) {
            await this.input.keyboard({ type: 'press', key: 'Return' });
        }
        return result;
    }

    /**
     * Press a keyboard shortcut (e.g., Ctrl+S).
     */
    async hotkey(key: string, modifiers: Array<'ctrl' | 'alt' | 'shift' | 'meta'>): Promise<DesktopActionResult> {
        return this.input.keyboard({ type: 'hotkey', key, modifiers });
    }

    /**
     * Clean up temporary files.
     */
    cleanup(): void {
        this.screen.cleanup();
    }
}

// ─── Singleton ───
let desktopInstance: DesktopEngine | null = null;

export function getDesktopEngine(): DesktopEngine | null {
    return desktopInstance;
}

export function initDesktopEngine(config?: Partial<DesktopConfig>): DesktopEngine {
    desktopInstance = new DesktopEngine(config);
    return desktopInstance;
}
