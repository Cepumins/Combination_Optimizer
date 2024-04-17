const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const stealth = StealthPlugin();
//stealth.enabledEvasions.delete('chrome.runtime');
stealth.enabledEvasions.delete('iframe.contentWindow');
puppeteer.use(stealth);
// */
const fsNormal = require('fs');
const fs = require('fs').promises;
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { parse } = require('csv-parse/sync');
const csv = require('csv-parser');
const { spawn } = require('child_process');

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    //await page.goto('https://bitskins.com/market/cs2?search={%22where%22:{%22category_id%22:[1],%22quality_id%22:[4],%22skin_name%22:%22neoqueen%22}}');
    //const link = 'https://cs.money/csgo/trade/';
    //const link = `https://skinsmonkey.com/trade`;
    const link = `https://dmarket.com/ingame-items/item-list/csgo-skins`;
    //const link = 'https://bitskins.com/market/cs2';

    await page.goto(link);

    // Function to log clicks with x and y coordinates
    await page.exposeFunction('logClick', (selector, x, y) => {
        
        //console.log(`Click performed on: ${selector}`);
        console.log('');
        console.log('Clicked on: ');
        console.log(selector);
    });

    // Add a click event listener to all elements that logs selector and position
    await page.evaluate(() => {
        document.addEventListener('click', event => {
            const path = event.path || (event.composedPath && event.composedPath());
            const selector = path.map(el => {
                if (!el.tagName) return null; // Skip non-element nodes
                let sel = el.tagName.toLowerCase(); // Start with the tag name
                if (el.id) sel += `#${el.id}`; // Add ID if available
                if (el.className && typeof el.className === 'string' && el.className.trim()) {
                    // Add classes, replace spaces with dots for multiple classes
                    sel += `.${el.className.trim().replace(/\s+/g, '.')}`;
                }
                return sel;
            }).filter(Boolean).join(' > '); // Filter out nulls and join
            window.logClick(selector, event.clientX, event.clientY);
        }, true);
    });

    // Now, any manual click you perform on the page will be logged with its CSS selector path
    await page.waitForTimeout(120000); // Keep the browser open for 10 seconds to test clicks

    await browser.close();
})();