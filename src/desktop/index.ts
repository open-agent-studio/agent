// ─── Desktop Module Index ───
export { DesktopEngine, getDesktopEngine, initDesktopEngine } from './engine.js';
export { ScreenCapture } from './screen.js';
export { InputController } from './input.js';
export type { DesktopConfig, ScreenRegion, MouseAction, KeyboardAction, ScreenCaptureResult, DesktopActionResult } from './types.js';
export { DEFAULT_DESKTOP_CONFIG } from './types.js';
export { UITreeExtractor } from './tree.js';
export type { UIElementNode } from './tree.js';
