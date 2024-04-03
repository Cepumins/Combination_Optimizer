//const puppeteer = require('puppeteer');
// /*
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const stealth = StealthPlugin();
//stealth.enabledEvasions.delete('chrome.runtime');
stealth.enabledEvasions.delete('iframe.contentWindow');
puppeteer.use(stealth);
// */
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { parse } = require('csv-parse/sync');
const csv = require('csv-parser');
const { spawn } = require('child_process');

async function waitForRandomTimeout(page, minTimeout, maxTimeout) {
    const timeoutDuration = Math.floor(Math.random() * (maxTimeout - minTimeout + 1)) + minTimeout;
    await page.waitForTimeout(timeoutDuration);
}

async function scrapeOtherWears(page, source, exchangeRatio) {
    const otherWearResults = await page.evaluate((source, exchangeRatio) => {
        const items = [];
        let conditionSelector, priceSelector;

        // Determine selectors based on the source
        if (source === 'Halo') {
            conditionSelector = 'div.mb-1.text-center';
            priceSelector = '.numFont.text-xs.text-textPrimary';
        } else if (source === 'CS2GO') {
            conditionSelector = 'span.allName';
            priceSelector = '.tone-price';
        } else if (source === 'CS2GOsteam') {
            conditionSelector = 'span.allName';
            priceSelector = '.price-list .price-list-item .price'; 
        } else if (source === 'Buff') {
            conditionSelector = 'div.scope-btns > a';
            priceSelector = '.price-list .price-list-item .price'; 
        } else if (source === 'Stash') {
            //conditionSelector = '.btn-group-sm > a > span.pull-left';
            //conditionSelector = '.btn-group-sm > a > span.pull-left:not(:first-child)';
            //priceSelector = '.btn-group-sm > a > span.pull-right';
            conditionSelector = '.price-details-table tbody tr';
            priceSelector = '.price-details-table tbody tr td:nth-child(2) a';
        }

        console.log('Here');
        console.log(`Condition elements found: ${document.querySelectorAll(conditionSelector).length}`);

        const conditionElements = document.querySelectorAll(conditionSelector);
        conditionElements.forEach((conditionElement) => {
            let condition, price, fullText, priceElement;
            console.log(`Condition text: ${conditionElement.textContent.trim()}`);
            fullText = conditionElement.textContent.trim();
            if (!fullText.includes("StatTrak")) {
                let cleanPrice;
                if (source === 'Halo') {
                    condition = fullText;
                    priceElement = conditionElement.nextElementSibling.querySelector(priceSelector);
                } else if (source === 'CS2GO' || source === 'CS2GOsteam') {
                    condition = fullText;
                    priceElement = conditionElement.closest('li').querySelector(priceSelector);
                } else if (source === 'Buff') {
                    [condition, price] = fullText.split('¥').map(part => part.trim()); // For 'Buff', split the fullText to get condition and price
                    cleanPrice = ((price.replace(/[^0-9.]+/g, "")) / exchangeRatio).toFixed(6);
                } else if (source === 'Stash') {
                    condition = conditionElement.textContent.trim();
                    price = priceElement.textContent.trim();
                }
                console.log(condition);
                console.log(price);

                if (priceElement && source !== 'Buff') {
                    price = priceElement.textContent.trim();
                    cleanPrice = price.replace(/[^0-9.]+/g, "");
                }
                console.log(`Condition: ${condition}, price: ${price}`);
        
                // Clean the price and add to items array
                if (price) {
                    //const cleanPrice = price.replace(/[^0-9.]+/g, ""); // Remove non-numeric characters except decimal points
                    items.push(`${condition}: ${cleanPrice}`); // Add condition and cleaned price to the items array
                }
            }
        });
        return items;
    }, source, exchangeRatio);
    return otherWearResults;
}

(async () => {
    // Launch the browser
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
  
    //const collection = 'Prisma';
    //const collectionID = collectionMapping[collection];
    //const collectionLinkName = collection.replace(' ', '_');
  
    //const collection_link = `https://csgostash.com/case/${collectionID}/${collectionLinkName}-Case`;
    const link = `https://csgostash.com/skin/1052/AK-47-Asiimov`;
  
    // Navigate to the specified URL
    await page.goto(link, {waitUntil: 'networkidle0', timeout: 60000});

    await waitForRandomTimeout(page, 10000, 10000);

    const source = 'Stash';
    let useless;

    const otherWearResults = await scrapeOtherWears(page, source, 5);

    console.log('there');
    console.log(otherWearResults);
  
    await waitForRandomTimeout(page, 50000, 100000);
    await browser.close();
  })();