import { z } from 'zod';
import type { ToolDefinition } from '../types.js';
import { UITreeExtractor } from '../../desktop/tree.js';

const uiTreeExtractor = new UITreeExtractor();

export const uiTreeTool: ToolDefinition = {
    name: 'desktop.ui_tree',
    category: 'desktop',
    description: 'Extracts the active OS window accessibility UI tree, returning a structured DOM-like JSON tree with explicit application roles, names, and precise `bounds: {x,y,width,height}` for exact coordinate clicking. Essential for GUI tasks running without computer vision.',
    permissions: ['ui_automation'],
    inputSchema: z.object({
        depth: z.number().optional().describe('Maximum depth to parse in the UI tree to avoid gigantic payloads. Default is 5. Max is 10.')
    }),
    outputSchema: z.any(),
    execute: async (input: any, _ctx) => {
        try {
            const tree = await uiTreeExtractor.getActiveWindowTree();
            if (!tree) {
                return {
                    success: false,
                    error: 'Failed to extract active window tree or not supported on this OS',
                    durationMs: 0
                };
            }
            
            // Truncate based on depth
            const maxDepth = input.depth || 5;
            const prune = (node: any, currentDepth: number): any => {
                if (currentDepth >= maxDepth) {
                    return { ...node, children: [] };
                }
                return {
                    ...node,
                    children: (node.children || []).map((c: any) => prune(c, currentDepth + 1))
                };
            };
            
            const prunedTree = prune(tree, 0);
            
            return {
                success: true,
                data: prunedTree,
                durationMs: 0
            };
        } catch (e) {
            return {
                success: false,
                error: (e as Error).message,
                durationMs: 0
            };
        }
    }
};
