import { UITreeExtractor } from './src/desktop/tree.js'; new UITreeExtractor().getActiveWindowTree().then(r => console.log('Result:', JSON.stringify(r).substring(0, 100)));
