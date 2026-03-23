import { z } from 'zod';
import type { ToolDefinition } from '../types.js';
import { InputController } from '../../desktop/input.js';
import { ScreenCapture } from '../../desktop/screen.js';

const inputController = new InputController(150);
const screenCapture = new ScreenCapture();

export const computerTool: ToolDefinition = {
    name: 'computer_20241022',
    category: 'desktop',
    description: 'Use the computer natively. Supports mouse movement, clicking, typing, and taking screenshots. This tool directly implements the Anthropic Computer Use API specification.',
    permissions: ['ui_automation'],
    inputSchema: z.object({
        action: z.enum([
            'key',
            'type',
            'mouse_move',
            'left_click',
            'left_click_drag',
            'right_click',
            'middle_click',
            'double_click',
            'screenshot',
            'cursor_position',
        ]).describe('The action to perform on the computer.'),
        coordinate: z.array(z.number()).length(2).optional().describe('(x, y) pixel coordinates for mouse movement or drag.'),
        text: z.string().optional().describe('Text to string to type or key combination to press.'),
    }),
    outputSchema: z.any(),
    execute: async (input: any, _ctx) => {
        const { action, coordinate, text } = input;
        
        switch (action) {
            case 'mouse_move':
                if (!coordinate) return { success: false, error: 'coordinate is required for mouse_move', durationMs: 0 };
                await inputController.mouse({ type: 'move', x: coordinate[0], y: coordinate[1] });
                return { success: true, data: { text: `Moved mouse to ${coordinate[0]}, ${coordinate[1]}` }, durationMs: 0 };
            
            case 'left_click':
                await inputController.mouse({ type: 'click', button: 'left' });
                return { success: true, data: { text: 'Clicked left mouse button' }, durationMs: 0 };
                
            case 'right_click':
                await inputController.mouse({ type: 'click', button: 'right' });
                return { success: true, data: { text: 'Clicked right mouse button' }, durationMs: 0 };
                
            case 'middle_click':
                await inputController.mouse({ type: 'click', button: 'middle' });
                return { success: true, data: { text: 'Clicked middle mouse button' }, durationMs: 0 };
            
            case 'double_click':
                await inputController.mouse({ type: 'doubleClick' });
                return { success: true, data: { text: 'Double clicked mouse' }, durationMs: 0 };
                
            case 'left_click_drag':
                if (!coordinate) return { success: false, error: 'coordinate is required for left_click_drag', durationMs: 0 };
                await inputController.mouse({ type: 'drag', toX: coordinate[0], toY: coordinate[1] });
                return { success: true, data: { text: `Dragged to ${coordinate[0]}, ${coordinate[1]}` }, durationMs: 0 };
                
            case 'type':
                if (!text) return { success: false, error: 'text is required for typing', durationMs: 0 };
                await inputController.keyboard({ type: 'type', text: text });
                return { success: true, data: { text: `Typed string: "${text}"` }, durationMs: 0 };
                
            case 'key':
                if (!text) return { success: false, error: 'text is required for key press', durationMs: 0 };
                if (text.includes('+')) {
                    const parts = text.split('+');
                    const key = parts.pop() || '';
                    const modifiers = parts as ('ctrl' | 'alt' | 'shift' | 'meta')[];
                    await inputController.keyboard({ type: 'hotkey', key, modifiers });
                } else {
                    await inputController.keyboard({ type: 'press', key: text });
                }
                return { success: true, data: { text: `Pressed key: ${text}` }, durationMs: 0 };
                
            case 'screenshot':
                try {
                    const res = await screenCapture.capture();
                    const fs = await import('node:fs/promises');
                    const imageBuffer = await fs.readFile(res.path);
                    const base64Image = imageBuffer.toString('base64');
                    return { 
                        success: true, 
                        data: {
                            image_url: `data:image/png;base64,${base64Image}`,
                            text: 'Screenshot captured'
                        },
                        durationMs: 0
                    };
                } catch (e) {
                    return { success: false, error: 'Failed to take screenshot', durationMs: 0 };
                }
                
            case 'cursor_position':
                return { success: false, error: 'cursor_position is not implemented yet via xdotool mapping', durationMs: 0 };
                
            default:
                return { success: false, error: 'Unknown action type', durationMs: 0 };
        }
    }
};
