import { browserTools } from './src/tools/core/browser.js';
import { BrowserManager } from './src/desktop/browser.js';

async function run() {
    console.log("--- Testing Browser Tools ---");

    const openTool = browserTools.find(t => t.name === 'desktop.browser.open')!;
    const scrapeTool = browserTools.find(t => t.name === 'desktop.browser.scrape')!;
    const closeTool = browserTools.find(t => t.name === 'desktop.browser.close')!;

    console.log("1. Opening example.com");
    await openTool.execute({ url: 'https://example.com', headless: true }, {} as any);

    console.log("2. Scraping <h1>");
    const h1 = await scrapeTool.execute({ selector: 'h1', mode: 'text' }, {} as any);
    console.log("Result:", h1);

    console.log("3. Closing browser");
    await closeTool.execute({}, {} as any);

    console.log("--- DONE ---");
}

run().catch(console.error);
