//const puppeteer = require('puppeteer');
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const stealth = StealthPlugin();
//stealth.enabledEvasions.delete('chrome.runtime');
stealth.enabledEvasions.delete('iframe.contentWindow');
puppeteer.use(stealth);
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { parse } = require('csv-parse/sync');
const csv = require('csv-parser');
const { spawn } = require('child_process');

//const item = 'AK-47_Slate'
const item = 'Desert_Eagle_Trigger_Discipline'
const wear = 'mw'
const collection = 'Snakebite';
const quality = 'Restricted';

const conditionMappings = {
    'Factory New': 'FN',
    'Minimal Wear': 'MW',
    'Field-Tested': 'FT',
    'Well-Worn': 'WW',
    'Battle-Scarred': 'BS'
};

const invertedConditionMappings = Object.keys(conditionMappings).reduce((acc, key) => {
    const abbr = conditionMappings[key];
    acc[abbr] = key; // Assign the full name as the value for the abbreviation key
    return acc;
}, {});

async function waitForRandomTimeout(page, minTimeout, maxTimeout) {
    const timeoutDuration = Math.floor(Math.random() * (maxTimeout - minTimeout + 1)) + minTimeout;
    await page.waitForTimeout(timeoutDuration);
}

async function simulateMouseMovements(page, moveCount, width, height) {  // Simulate irregular mouse movements by randomly moving the mouse around within the viewport dimensions
    const timesToMove = Math.floor(Math.random() * moveCount + 1);
    for (let i = 0; i < timesToMove+1; i++) {
        const x = (Math.pow(Math.random(), 3) - 0.5) * width + width*0.5; // Random x-coordinate within the viewport width
        //const y = Math.random() * height; 
        const y = (Math.pow(Math.random(), 3) - 0.5) * height + height*0.4 // Random y-coordinate within the viewport height
        await page.mouse.move(x, y, { steps: 10 }); // Move mouse to (x, y) with intermediate steps for smoother movement
        //await moveCustomCursor(page, x, y);
        await waitForRandomTimeout(page, 0, 100);
    }
}

async function randomScrollPage(page, minScroll, maxScroll) {
    await page.evaluate((min, max) => {
        const randomScroll = Math.floor(Math.random() * (max - min + 1)) + min;
        window.scrollBy(0, randomScroll);
    }, minScroll, maxScroll);
}

function getCurrentTimestamp() {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    return timestamp;
}

async function acceptCookies(page, cookieButtonXPath) {
    try {
        // Find the cookie acceptance button using the provided XPath
        const cookieButtons = await page.$x(cookieButtonXPath);
        if (cookieButtons.length > 0) {
            const cookieButton = cookieButtons[0];
            const buttonBox = await cookieButton.boundingBox();
            
            if (buttonBox) {
                // Simulate human-like mouse movement to the button
                try {
                    await page.mouse.move(
                        buttonBox.x + buttonBox.width / 2 + Math.floor(Math.random() * 10) - 5,
                        buttonBox.y + buttonBox.height / 2 + Math.floor(Math.random() * 10) - 5,
                        { steps: 10 }
                    );

                    // Wait for a random timeout to simulate human pause before clicking
                    //await page.waitForTimeout(Math.floor(Math.random() * (1000 - 500) + 500));
                    await waitForRandomTimeout(page, 250, 1000);

                    // Click the cookie acceptance button
                    await cookieButton.click();
                    console.log('Cookies accepted.');
                } catch (clickError) {
                    console.error('Error clicking on cookie button:', clickError);
                }
            } else {
                console.log('Cookie button found, but unable to determine its position.');
            }
        } else {
            console.log('Cookie button not found using the provided XPath.');
        }
    } catch (error) {
        console.error('Error accepting cookies:', error);
    }
}

async function updatePricesCSV(itemNameUnd, collection, quality, otherWearResults, source) {
    const timestamp = getCurrentTimestamp();

    let pricesCSVNewItem = {
        Item: itemNameUnd,
        Collection: collection,
        Rarity: quality,
        MinF: null,
        MaxF: null,
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

    const pricesCSV = `prices/${quality}/${source}_prices_${quality}.csv`;
    let dataExists = false;
    const existingItems = [];

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

    if (fs.existsSync(pricesCSV)) {
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
    } else {
        existingItems.push(pricesCSVNewItem);
        csvWriter.writeRecords(existingItems)
        .then(() => console.log('CSV file was created successfully with the new item.'));
    }
}

async function scrapeOtherWears(page, source) {
    const otherWearResults = await page.evaluate((source) => {
        const items = [];
        let conditionSelector, priceSelector;

        // Determine selectors based on the source
        if (source === 'Halo') {
            conditionSelector = 'div.mb-1.text-center';
            priceSelector = '.numFont.text-xs.text-textPrimary';
        } else if (source === 'Go') {
            conditionSelector = 'span.allName';
            priceSelector = '.tone-price';
        } else if (source === 'ste') {
            conditionSelector = 'span.allName';
            // Assuming the .price-list element is a sibling of the condition element's parent
            priceSelector = '.price-list .price-list-item .price'; 
        }

        const conditionElements = document.querySelectorAll(conditionSelector);
        
        conditionElements.forEach((conditionElement) => {
            const condition = conditionElement.textContent.trim();
            if (!condition.includes("StatTrak")) {
                let priceElement;
            
                // Use nextElementSibling for 'Halo' and closest('div') + querySelector for 'Go'
                if (source === 'Halo') {
                    priceElement = conditionElement.nextElementSibling.querySelector(priceSelector);
                } else {
                    // For 'Go' and 'ste', find the price element relative to the condition element
                    priceElement = conditionElement.closest('li').querySelector(priceSelector);
                }

                if (priceElement) {
                    const price = priceElement.textContent.trim();
                    items.push(`${condition}: ${price}`);
                }
            }
        });

        return items;
    }, source);

    return otherWearResults;
}

async function scrapeItems(page, itemConditionAbbr, itemNameUnd, source, totalItems, width, height) {
    const startTime = new Date();
    const seenFloats = new Set();
    let itemIndex = 1;
    const records = [];

    let floatSelector, priceSelector;
    if (source === 'Halo') {
        floatSelector = '.text-textPrimary.text-xs.mb-2';
        priceSelector = '.numFont.text-xl.text-textPrimary';
    } else if (source === 'Go') {
        floatSelector = 'p.wear';
        priceSelector = 'span.value.price[style="font-size: 18px;"]';
    }

    while (true) {
        await randomScrollPage(page, 50, 250);

        // Retrieve values for each visible item using selectors passed as parameters
        const floats = await page.$$eval(floatSelector, elements => elements.map(el => el.textContent));
        const prices = await page.$$eval(priceSelector, elements => elements.map(el => el.textContent));

        let newItemsAdded = false;
        const timestamp = getCurrentTimestamp();

        floats.forEach((float, index) => {
            if (!seenFloats.has(float)) {
                seenFloats.add(float);
                records.push({
                    index: itemIndex++,
                    price: prices[index],
                    float: float,
                    condition: itemConditionAbbr, // Assumes itemConditionAbbr is globally defined or passed in
                    name: itemNameUnd, // Assumes itemNameUnd is globally defined or passed in
                    site: source,
                    timestamp: timestamp
                });
                newItemsAdded = true;
            }
        });

        if (records.length >= totalItems) {
            console.log('All items processed');
            break;
        }
        if (!newItemsAdded) {
            await randomScrollPage(page, 150, 300);
            await simulateMouseMovements(page, 5, width, height);
            const result = await Promise.race([
                new Promise(resolve => setTimeout(() => resolve('timeout'), 10000)),
                waitForRandomTimeout(page, 250, 1500)
            ]);
            if (result === 'timeout') {
                console.log('No new items loading');
            }
        }
        if (new Date() - startTime > 45000) {
            console.log(`${records.length} items processed`);
            console.log('Timeout reached');
            break;
        }

        await waitForRandomTimeout(page, 250, 750);
    }

    return records;
}

async function initializePage(page, link) {
    await page.goto(link, {waitUntil: 'networkidle0', timeout: 60000});

    // Retrieve the page dimensions
    const dimensions = await page.evaluate(() => {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    });

    // Perform a random starting mouse movement based on the page dimensions
    await page.mouse.move(Math.random() * dimensions.width, Math.random() * dimensions.height);

    // Perform a random scroll on the page
    await randomScrollPage(page, 50, 250);

    // Simulate mouse movements across the page based on the page dimensions
    await simulateMouseMovements(page, 3, dimensions.width, dimensions.height);

    // Return the dimensions for further use
    return dimensions;
}

async function readItems(page, item, wear) {
    const searchName = item.toLowerCase().replace(/_/g, '-');
    const searchWear = invertedConditionMappings[wear.toUpperCase()].toLowerCase().replace(/\s/g, "-");
    const link = `https://cs2go.com/spu/730/${searchName}-${searchWear}`;

    const { width, height } = await initializePage(page, link);

    const source = 'Go'

    let match;
    let itemNameUnd, itemConditionAbbr, csvFileName;

    while (!match) {
        try { // Use the new selector to fetch the item name and condition
            const itemNameAndCondition = await page.$eval('div.item-name.detail-item > span', el => el.textContent);
            match = itemNameAndCondition.match(/^(.*?)\s\|\s(.*?)\s\((.*?)\)$/);
    
        } catch (error) {
            console.log('Error fetching details, retrying...', error);
        }
    
        if (!match) {
            console.log('Retrying due to unsatisfied conditions (match)');
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for 1 second before retrying
        }
    }
    
    if (match) {
        // get item name and wear
        const itemName = match[1] + ' | ' + match[2]; // Combined to include the '|' in the name
        itemNameUnd = itemName.replace(/\|\s?/g, '').replace(/\s/g, '_'); // Replace '| ' with '';
        const itemConditionFull = match[3];
        itemConditionAbbr = conditionMappings[itemConditionFull];
    
        console.log(`Name: ${itemName}`);
        console.log(`Wear: ${itemConditionAbbr}`);
        //csvFileName = `${itemNameUnd}_(${itemConditionAbbr}).csv`;
        if (itemNameUnd === item && itemConditionAbbr.toLowerCase() === wear) {
            console.log('The item name and wear conditions match.');
        } else {
            console.log('THE ITEM NAME AND WEAR CONDITIONS DO NOT MATCH!!!');
        }
    } else {
        console.log('Item name and condition not found');
    }

    //const goResults = await NewscrapeItemDetails(page, 'Go');
    //console.log(goResults)

    //const steResults = await NewscrapeItemDetails(page, 'ste');
    //console.log(steResults)

    const cookieButtonXPath = '//*[@id="app"]/div[4]/div/div[2]/div[2]';
    await acceptCookies(page, cookieButtonXPath);

    //await simulateMouseMovements(page, Math.random() * 3, width, height);

    //await new Promise(resolve => setTimeout(resolve, 30000));

    let totalItems = 20;

    waitForRandomTimeout(page, 500, 1500)

    const results = await scrapeItems(page, itemConditionAbbr, itemNameUnd, source, totalItems, width, height)
    return results
}

(async () => {
    //const directoryPath = path.join(__dirname, quality, collection); // Create a path for the subfolder

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    const results = await readItems(page, item, wear);

    //console.log(results)

    await browser.close();
})();