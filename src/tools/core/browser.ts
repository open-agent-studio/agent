import { z } from 'zod';
import type { ToolDefinition } from '../types.js';
import { BrowserManager } from '../../desktop/browser.js';

export const browserTools: ToolDefinition<any, any>[] = [
    {
        name: 'desktop.browser.open',
        category: 'desktop',
        description: 'Open a URL in the agent browser. Initializes the browser if not already running.',
        inputSchema: z.object({
            url: z.string().url().describe('The URL to navigate to'),
            headless: z.boolean().default(true).describe('Whether to run headless (default: true)')
        }),
        outputSchema: z.any(),
        permissions: [],
        execute: async (args: { url: string, headless: boolean }) => {
            const manager = BrowserManager.getInstance();
            const page = await manager.init(args.headless);
            await page.goto(args.url, { waitUntil: 'domcontentloaded' });
            return { success: true, data: `Successfully opened ${args.url}`, durationMs: 0 };
        }
    },
    {
        name: 'desktop.browser.click',
        category: 'desktop',
        description: 'Click an element on the active browser page',
        inputSchema: z.object({
            selector: z.string().describe('CSS or XPath selector of the element to click')
        }),
        outputSchema: z.any(),
        permissions: [],
        execute: async (args: { selector: string }) => {
            const page = BrowserManager.getInstance().getPage();
            if (!page) throw new Error('Browser is not open. Call desktop.browser.open first.');
            await page.click(args.selector);
            return { success: true, data: `Clicked element matching selector: ${args.selector}`, durationMs: 0 };
        }
    },
    {
        name: 'desktop.browser.fill',
        category: 'desktop',
        description: 'Type text into an input element on the active browser page',
        inputSchema: z.object({
            selector: z.string().describe('CSS or XPath selector of the input element'),
            text: z.string().describe('The text to type into the input field')
        }),
        outputSchema: z.any(),
        permissions: [],
        execute: async (args: { selector: string, text: string }) => {
            const page = BrowserManager.getInstance().getPage();
            if (!page) throw new Error('Browser is not open. Call desktop.browser.open first.');
            await page.fill(args.selector, args.text);
            return { success: true, data: `Filled text into selector: ${args.selector}`, durationMs: 0 };
        }
    },
    {
        name: 'desktop.browser.scrape',
        category: 'desktop',
        description: 'Extract text from the current page',
        inputSchema: z.object({
            selector: z.string().optional().describe('CSS selector to scrape. If omitted, extracts the body text.'),
            mode: z.enum(['text', 'html']).default('text').describe('Extraction mode (text or html)')
        }),
        outputSchema: z.any(),
        permissions: [],
        execute: async (args: { selector?: string, mode: 'text' | 'html' }) => {
            const page = BrowserManager.getInstance().getPage();
            if (!page) throw new Error('Browser is not open. Call desktop.browser.open first.');

            const target = args.selector || 'body';

            try {
                let content: string;
                if (args.mode === 'html') {
                    content = await page.innerHTML(target);
                } else {
                    content = await page.innerText(target);
                }
                return { success: true, data: content, durationMs: 0 };
            } catch (e) {
                return { success: false, error: `Failed to scrape selector ${target}: ${(e as Error).message}`, durationMs: 0 };
            }
        }
    },
    {
        name: 'desktop.browser.screenshot',
        category: 'desktop',
        description: 'Take a screenshot of the current page and return the base64 encoded image',
        inputSchema: z.object({
            fullPage: z.boolean().default(false).describe('Whether to take a full page scrollable screenshot')
        }),
        outputSchema: z.any(),
        permissions: [],
        execute: async (args: { fullPage: boolean }) => {
            const page = BrowserManager.getInstance().getPage();
            if (!page) throw new Error('Browser is not open. Call desktop.browser.open first.');

            const buffer = await page.screenshot({ fullPage: args.fullPage });
            return { success: true, data: `data:image/png;base64,${buffer.toString('base64')}`, durationMs: 0 };
        }
    },
    {
        name: 'desktop.browser.close',
        category: 'desktop',
        description: 'Close the active browser and persist the session state (cookies/localStorage)',
        inputSchema: z.object({}),
        outputSchema: z.any(),
        permissions: [],
        execute: async () => {
            const manager = BrowserManager.getInstance();
            await manager.close();
            return { success: true, data: 'Browser closed and session saved successfully', durationMs: 0 };
        }
    }
];
