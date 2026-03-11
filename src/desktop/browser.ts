import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { getAgentDir } from '../utils/paths.js';

export class BrowserManager {
    private static instance: BrowserManager;
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    private readonly sessionFile: string;

    private constructor() {
        const agentDir = getAgentDir();
        if (!existsSync(agentDir)) {
            mkdirSync(agentDir, { recursive: true });
        }
        this.sessionFile = join(agentDir, 'browser-session.json');
    }

    public static getInstance(): BrowserManager {
        if (!BrowserManager.instance) {
            BrowserManager.instance = new BrowserManager();
        }
        return BrowserManager.instance;
    }

    /**
     * Initializes the browser and page if not already running.
     * Loads saved cookies and localStorage to persist sessions.
     */
    public async init(headless = true): Promise<Page> {
        if (this.page) return this.page;

        if (!this.browser) {
            this.browser = await chromium.launch({
                headless,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }

        const contextOptions: any = {
            viewport: { width: 1280, height: 800 },
        };

        if (existsSync(this.sessionFile)) {
            contextOptions.storageState = this.sessionFile;
        }

        this.context = await this.browser.newContext(contextOptions);
        this.page = await this.context.newPage();

        return this.page;
    }

    /**
     * Re-saves the browser session state (cookies, local storage) to disk
     */
    public async saveSession(): Promise<void> {
        if (this.context) {
            await this.context.storageState({ path: this.sessionFile });
        }
    }

    public getPage(): Page | null {
        return this.page;
    }

    public async close(): Promise<void> {
        if (this.context) {
            await this.saveSession(); // Auto-save on graceful close
        }
        if (this.page) await this.page.close();
        if (this.context) await this.context.close();
        if (this.browser) await this.browser.close();

        this.page = null;
        this.context = null;
        this.browser = null;
    }
}
