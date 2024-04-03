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

const conditionMappings = {
    'Factory New': 'FN',
    'Minimal Wear': 'MW',
    'Field-Tested': 'FT',
    'Well-Worn': 'WW',
    'Battle-Scarred': 'BS'
};

async function waitForRandomTimeout(page, minTimeout, maxTimeout) {
    const timeoutDuration = Math.floor(Math.random() * (maxTimeout - minTimeout + 1)) + minTimeout;
    await page.waitForTimeout(timeoutDuration);
}

function getCurrentTimestamp() {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    return timestamp;
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
            // Use the table rows as the condition selector for 'Stash'
            conditionSelector = '.price-details-table tbody tr';
            priceSelector = 'td:nth-child(2) a'; // The price is in the second column
        } else if (source === 'StashBit') {
            // Use the table rows as the condition selector for 'Stash'
            conditionSelector = '.price-details-table tbody tr';
            priceSelector = 'td a.bitskins-button'; // The price is in the second column
        }

        const conditionElements = document.querySelectorAll(conditionSelector);
        conditionElements.forEach((conditionElement) => {
            let condition, price, fullText, priceElement;
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
                } else if (source === 'Stash' || source === 'StashBit') {
                    const wearCell = conditionElement.querySelector('td:nth-child(1)');
                    condition = wearCell ? wearCell.innerText.trim() : '';
                    priceElement = conditionElement.querySelector(priceSelector);
                }

                if (priceElement && source !== 'Buff') {
                    price = priceElement.textContent.trim();
                    cleanPrice = price.replace(/[^0-9.]+/g, "");
                }
        
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

function getLastUpdatedTimestamp(lastUpdatedText) {
    const now = new Date();
    const match = lastUpdatedText.match(/(\d+) (second[s]?|minute[s]?|hour[s]?) ago/);

    if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 'second':
            case 'seconds':
                now.setSeconds(now.getSeconds() - value);
                break;
            case 'minute':
            case 'minutes':
                now.setMinutes(now.getMinutes() - value);
                break;
            case 'hour':
            case 'hours':
                now.setHours(now.getHours() - value);
                break;
        }
    }

    const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    return timestamp;
}

async function getLastUpdatedTimestampFromPage(page) {
    const lastUpdatedText = await page.evaluate(() => {
        const updateElement = document.querySelector('.tab-pane.active .price-modified-time p.text-center.small.nomargin');
        if (updateElement) {
            const fullText = updateElement.textContent.trim();
            const match = fullText.match(/updated (\d+ (minute[s]?|second[s]?|hour[s]?) ago)/);
            return match ? match[1] : 'Time not found';
        }
        return 'Update element not found';
    });

    console.log(`Last updated: ${lastUpdatedText}`);

    const now = new Date();
    const match = lastUpdatedText.match(/(\d+) (second[s]?|minute[s]?|hour[s]?) ago/);

    if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 'second':
            case 'seconds':
                now.setSeconds(now.getSeconds() - value);
                break;
            case 'minute':
            case 'minutes':
                now.setMinutes(now.getMinutes() - value);
                break;
            case 'hour':
            case 'hours':
                now.setHours(now.getHours() - value);
                break;
        }
    }

    const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    return timestamp;
}

async function updatePricesCSV(itemNameUnd, collection, quality, otherWearResults, source, timestamp, minFloat = null, maxFloat = null) {
    /*
    let timestamp;
    if (source === 'Stash' || source === 'StashBit') {
        timestamp = 
    }
    else {
        timestamp = getCurrentTimestamp();
    } 
    */
    const pricesCSV = `prices/${quality}/${source}_prices_${quality}.csv`;

    const dir = path.dirname(pricesCSV); // Ensure the directory exists
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    let pricesCSVNewItem = {
        Item: itemNameUnd,
        Collection: collection,
        Rarity: quality,
        //MinF: null,
        //MaxF: null,
        MinF: (source === 'Stash' || source === 'StashBit') ? minFloat : null, // Assign minFloat if source is 'Stash'
        MaxF: (source === 'Stash' || source === 'StashBit') ? maxFloat : null, // Assign maxFloat if source is 'Stash'
        Timestamp: timestamp,
        CUR: 'USD',
        FN: null,
        MW: null,
        FT: null,
        WW: null,
        BS: null
    };
    
    otherWearResults.forEach(result => {
        const [condition, price] = result.split(': ');
        const conditionAbbr = conditionMappings[condition.trim()];
        if (conditionAbbr) {
            pricesCSVNewItem[conditionAbbr] = price.trim();
        }
    });

    const csvWriter = createCsvWriter({
        path: pricesCSV,
        header: [
            {id: 'Item', title: 'Item'},
            {id: 'Collection', title: 'Collection'},
            {id: 'Rarity', title: 'Rarity'},
            {id: 'MinF', title: 'MinF'},
            {id: 'MaxF', title: 'MaxF'},
            {id: 'Timestamp', title: 'Timestamp'},
            {id: 'CUR', title: 'CUR'},
            {id: 'FN', title: 'FN'},
            {id: 'MW', title: 'MW'},
            {id: 'FT', title: 'FT'},
            {id: 'WW', title: 'WW'},
            {id: 'BS', title: 'BS'}
        ]
    });

    let dataExists = false;
    const existingItems = [];

    if (fs.existsSync(pricesCSV)) { // Reading from the existing CSV file and updating logic...
        fs.createReadStream(pricesCSV)
        .pipe(csv())
        .on('data', (row) => {
            if (row.Item === itemNameUnd) {
                dataExists = true;
                const existingMinF = row.MinF;
                const existingMaxF = row.MaxF;
                Object.assign(row, pricesCSVNewItem);
                row.MinF = existingMinF;
                row.MaxF = existingMaxF;
            }
            existingItems.push(row);
        })
        .on('end', () => {
            if (!dataExists) {
                existingItems.push(pricesCSVNewItem);
            }
            
            csvWriter.writeRecords(existingItems)
            .then(() => {
                if (dataExists) {
                    console.log(`The prices CSV for ${itemNameUnd} was updated successfully`);
                } else {
                    console.log(`A new entry for ${itemNameUnd} was added to the prices CSV successfully`);
                }
            });
        });
    } else { // File doesn't exist, just write the new item
        existingItems.push(pricesCSVNewItem);
        csvWriter.writeRecords(existingItems)
        .then(() => console.log(`CSV file for ${itemNameUnd} was created successfully`));
    }
}

async function readStash(page, item, wear, id) {
    //const collection = 'Prisma';
    //const collectionID = collectionMapping[collection];
    //const collectionLinkName = collection.replace(' ', '_');
  
    //const collection_link = `https://csgostash.com/case/${collectionID}/${collectionLinkName}-Case`;
    const startingTimestamp = getCurrentTimestamp();
    console.log(`Current timestamp: ${startingTimestamp}`);

    const itemLinkName = item.replace('_', '-');
    const link = `https://csgostash.com/skin/${id}/${itemLinkName}`;
  
    // Navigate to the specified URL
    await page.goto(link, {waitUntil: 'networkidle0', timeout: 60000});

    await waitForRandomTimeout(page, 1000, 2500);

    await page.goto('https://csgostash.com/setcurrency/USD');

    await waitForRandomTimeout(page, 3000, 5000);

    const source = 'Stash';
    let useless;
    const collection = 'Prisma';
    const quality = 'Restricted';


    const floatValues = await page.evaluate(() => {
        const minFloatElement = document.querySelector('.wear-min-value');
        const maxFloatElement = document.querySelector('.wear-max-value');
    
        const min_float = minFloatElement ? minFloatElement.getAttribute('data-wearmin') : null;
        const max_float = maxFloatElement ? maxFloatElement.getAttribute('data-wearmax') : null;
    
        console.log(`Min float: ${min_float}`);
        console.log(`Max float: ${max_float}`);
    
        return { min_float, max_float };
    });
    
    console.log(`Min float: ${floatValues.min_float}`);
    console.log(`Max float: ${floatValues.max_float}`);

    //const timestamp =
    const lastUpdated = await getLastUpdatedTimestampFromPage(page);
    console.log(`Last updated timestamp: ${lastUpdated}`);


    const stashResults = await scrapeOtherWears(page, source, useless)
    console.log(stashResults)
    updatePricesCSV(item, collection, quality, stashResults, source, lastUpdated, floatValues.min_float, floatValues.max_float);


    const stashBitResults = await scrapeOtherWears(page, 'StashBit', useless)
    console.log(stashBitResults)
    updatePricesCSV(item, collection, quality, stashBitResults, 'StashBit', lastUpdated, floatValues.min_float, floatValues.max_float);

    /*
    const lastUpdatedText = await page.evaluate(() => {
        const updateElement = document.querySelector('.tab-pane.active .price-modified-time p.text-center.small.nomargin');
        if (updateElement) {
            const fullText = updateElement.textContent.trim();
            const match = fullText.match(/updated (\d+ (minute[s]?|second[s]?) ago)/);
            return match ? match[1] : 'Time not found';
        }
        return 'Update element not found';
    });
    
    console.log(`Last updated: ${lastUpdatedText}`);

    //const timestamp = getCurrentTimestamp();

    const lastUpdated = getLastUpdatedTimestamp(lastUpdatedText);
    console.log(`Last updated timestamp: ${lastUpdated}`);
    */
}

(async () => {
    // Launch the browser
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    let wear;
    //const id = 1052;
    //let item = 'AK-47_Asiimov';
    const id = 1057;
    let item = 'AK-47_Uncharted';
  
    await readStash(page, item, wear, id);
  
    await waitForRandomTimeout(page, 50000, 100000);
    await browser.close();
  })();