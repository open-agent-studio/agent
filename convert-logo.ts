import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function convertSvgToPng() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Read the SVG specifically
    const svgContent = fs.readFileSync('logo.svg', 'utf8');
    
    await page.setContent(`
        <html>
            <body style="margin: 0; padding: 0; background-color: #030810; display: inline-block;">
                ${svgContent}
            </body>
        </html>
    `);
    
    // Get the bounding box of the body
    const bbox = await page.evaluate(() => {
        const body = document.body;
        return { width: body.scrollWidth, height: body.scrollHeight };
    });
    
    await page.setViewportSize(bbox);
    
    // Take screenshot
    await page.screenshot({ path: 'logo-static.png' });
    
    // Also save it to the github org folder
    fs.copyFileSync('logo-static.png', '/home/praveen/.github/profile/logo-static.png');
    
    await browser.close();
    console.log('✓ Converted SVG to PNG successfully');
}

convertSvgToPng().catch(console.error);
