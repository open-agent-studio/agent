// ─── Desktop Automation Types ───

export interface DesktopConfig {
    /** Enable desktop automation */
    enabled: boolean;
    /** Screenshot format */
    screenshotFormat: 'png' | 'jpg';
    /** Screenshot quality (jpg only, 1-100) */
    screenshotQuality: number;
    /** Default delay between actions (ms) */
    actionDelay: number;
    /** Whether to use OCR on screenshots */
    ocrEnabled: boolean;
    /** Temporary directory for screenshots */
    tempDir: string;
}

export const DEFAULT_DESKTOP_CONFIG: DesktopConfig = {
    enabled: false,
    screenshotFormat: 'png',
    screenshotQuality: 80,
    actionDelay: 100,
    ocrEnabled: false,
    tempDir: '/tmp/agent-desktop',
};

export interface ScreenRegion {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface MouseAction {
    type: 'click' | 'doubleClick' | 'rightClick' | 'move' | 'drag' | 'scroll';
    x?: number;
    y?: number;
    toX?: number;
    toY?: number;
    scrollAmount?: number;
    button?: 'left' | 'right' | 'middle';
}

export interface KeyboardAction {
    type: 'type' | 'press' | 'hotkey';
    text?: string;
    key?: string;
    modifiers?: Array<'ctrl' | 'alt' | 'shift' | 'meta'>;
}

export interface ScreenCaptureResult {
    path: string;
    width: number;
    height: number;
    format: string;
    timestamp: Date;
}

export interface DesktopActionResult {
    success: boolean;
    action: string;
    error?: string;
    screenshot?: ScreenCaptureResult;
}
