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

function determinePossibleWears(minFloat, maxFloat) {
    const wearRanges = {
        FN: { min: 0.00, max: 0.07 },
        MW: { min: 0.07, max: 0.15 },
        FT: { min: 0.15, max: 0.38 },
        WW: { min: 0.38, max: 0.45 },
        BS: { min: 0.45, max: 1.00 }
    };

    const possibleWears = [];

    for (const [wear, range] of Object.entries(wearRanges)) {
        if (minFloat < range.max && maxFloat >= range.min) {
            possibleWears.push(wear);
        }
    }

    return possibleWears;
}

function getRandomWeightedTowardsCenter() {
    const numRandom = 10; // Increase for a tighter concentration around the mean
    let sum = 0;
    for (let i = 0; i < numRandom; i++) {
        sum += Math.random();
    }
    return sum / numRandom;
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

async function simulateMouseMovements(page, moveCount, width, height) {  // Simulate irregular mouse movements by randomly moving the mouse around within the viewport dimensions
    const timesToMove = Math.floor(Math.random() * moveCount + 1);
    for (let i = 0; i < timesToMove+1; i++) {
        //const x = (Math.pow(Math.random(), 3) - 0.5) * width + width*0.5; // Random x-coordinate within the viewport width
        const x = (getRandomWeightedTowardsCenter() - 0.5) * width + width * 0.5;
        //const y = Math.random() * height; 
        //const y = (Math.pow(Math.random(), 3) - 0.5) * height + height*0.4 // Random y-coordinate within the viewport height
        const y = (getRandomWeightedTowardsCenter() - 0.5) * height + height * 0.4;
        await page.mouse.move(x, y, { steps: 10 }); // Move mouse to (x, y) with intermediate steps for smoother movement
        //await moveCustomCursor(page, x, y);
        await waitForRandomTimeout(page, 0, 100);
    }
}

async function initializePage(page, link, timeOut = 60000, wait = true) {
    const waitOptions = wait ? { waitUntil: 'networkidle0', timeout: timeOut } : { timeout: timeOut };
    await page.goto(link, waitOptions);

    const dimensions = await page.evaluate(() => { // Retrieve the page dimensions
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    });
    await page.mouse.move(Math.random() * dimensions.width, Math.random() * dimensions.height); // Perform a random starting mouse movement based on the page dimensions
    await randomScrollPage(page, 50, 250); // Perform a random scroll on the page
    await simulateMouseMovements(page, 3, dimensions.width, dimensions.height); // Simulate mouse movements across the page based on the page dimensions
    return dimensions; // Return the dimensions for further use
}

async function updatePricesCSV(itemNameUnd, collection, quality, otherWearResults, source, timestamp, minFloat = null, maxFloat = null) {
    const pricesCSV = `prices/${quality}/${source}_prices_${quality}.csv`;

    const dir = path.dirname(pricesCSV); // Ensure the directory exists
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    let pricesCSVNewItem = {
        Item: itemNameUnd,
        Collection: collection,
        Rarity: quality,
        MinF: (source === 'A_DM' || source === 'A_Port') ? minFloat : null, // Assign minFloat if source is 'Stash'
        MaxF: (source === 'A_DM' || source === 'A_Port') ? maxFloat : null, // Assign maxFloat if source is 'Stash'
        Timestamp: timestamp,
        CUR: 'USD',
        FN: null,
        MW: null,
        FT: null,
        WW: null,
        BS: null
    };
    
    /*
    otherWearResults.forEach(result => {
        const [condition, price] = result.split(': ');
        const conditionAbbr = conditionMappings[condition.trim()];
        if (conditionAbbr) {
            pricesCSVNewItem[conditionAbbr] = price.trim();
        }
    });
    */
   // Iterate over each entry in the otherWearResults object
    Object.entries(otherWearResults).forEach(([conditionAbbr, price]) => {
        // conditionAbbr is the abbreviation like 'FN', 'MW', etc.
        // price is the price associated with each condition
        pricesCSVNewItem[conditionAbbr] = price; // Assign the price to the corresponding abbreviation in pricesCSVNewItem
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

async function readAnalyst(page, item, wear, id) {
    //const collection = 'Prisma';
    //const collectionID = collectionMapping[collection];
    //const collectionLinkName = collection.replace(' ', '_');
  
    //const collection_link = `https://csgostash.com/case/${collectionID}/${collectionLinkName}-Case`;
    //const startingTimestamp = getCurrentTimestamp();
    //console.log(`Current timestamp: ${startingTimestamp}`);

    const itemLinkName = item.toLowerCase().replace('_', '-');
    //const link = `https://csgostash.com/skin/${id}/${itemLinkName}`;
    const link = `https://csgo.steamanalyst.com/skin/${itemLinkName}`;
  
    // Navigate to the specified URL
    //await page.goto(link, {waitUntil: 'networkidle0', timeout: 60000});
    const { width, height } = await initializePage(page, link, timeOut = 30000);

    await waitForRandomTimeout(page, 1000, 2500);

    //await page.goto('https://csgostash.com/setcurrency/USD');

    //await waitForRandomTimeout(page, 3000, 5000);

    const source = 'Analyst';
    let useless;
    const collection = 'Revolution';
    const quality = 'Restricted';


    const floatValues = await page.evaluate(() => {
    // Select the container that holds the float values
    const container = document.querySelector('.row.averagepricehistory');

    // Within the container, find the span elements that contain the float values
    const floatSpans = container.querySelectorAll('span');

    // Assuming the first span contains the minimum float value and the second one contains the maximum
    const min_float = floatSpans.length > 0 ? floatSpans[1].textContent.trim() : null;
    const max_float = floatSpans.length > 1 ? floatSpans[0].textContent.trim() : null;
    
        //console.log(`Min float: ${min_float}`);
        //console.log(`Max float: ${max_float}`);
    
        return { min_float, max_float };
    });
    
    console.log(`Min float: ${floatValues.min_float}`);
    console.log(`Max float: ${floatValues.max_float}`);

    const wearTypes = determinePossibleWears(floatValues.min_float, floatValues.max_float);

    //const timestamp =
    //const lastUpdated = await getLastUpdatedTimestampFromPage(page);
    //console.log(`Last updated timestamp: ${lastUpdated}`);


    const wearDMResults = await page.evaluate((wearTypes) => {
        const result = {};
        //const wearTypes = ['FN', 'MW', 'FT', 'WW', 'BS']; // Assuming the order of wear types in the table
        const wearCells = document.querySelectorAll('body > div.main > div.container.m-t-2.item-solo > div.col-xs-12.col-sm-12.col-md-6.col-lg-8.col-xl-8 > div.hidden-lg-down > div > table > tbody > tr:nth-child(3) > td');
        
        // Skip the first cell if it does not represent a wear type by starting the loop from the second cell
        for (let i = 1; i < wearCells.length; i++) {
            const priceLink = wearCells[i].querySelector('a');
            const priceText = priceLink ? priceLink.textContent.trim() : null;

            if (priceText && priceText !== 'N/A') {
            // If there's a price and it's not 'N/A', remove the dollar sign to get the number
            const price = priceText.replace('$', '');
            result[wearTypes[i - 1]] = parseFloat(price); // Use i-1 since we're skipping the first cell
            }
        }

    return result;
    }, wearTypes);
        
    console.log(wearDMResults);

    //console.log(stashResults)
    updatePricesCSV(item, collection, quality, wearDMResults, 'A_DM', getCurrentTimestamp(), floatValues.min_float, floatValues.max_float);

    const wearPortResults = await page.evaluate((wearTypes) => {
        const result = {};
        //const wearTypes = ['FN', 'MW', 'FT', 'WW', 'BS']; // Assuming the order of wear types in the table
        const wearCells = document.querySelectorAll('body > div.main > div.container.m-t-2.item-solo > div.col-xs-12.col-sm-12.col-md-6.col-lg-8.col-xl-8 > div.hidden-lg-down > div > table > tbody > tr:nth-child(4) > td');
        
        // Skip the first cell if it does not represent a wear type by starting the loop from the second cell
        for (let i = 1; i < wearCells.length; i++) {
            const priceLink = wearCells[i].querySelector('a');
            const priceText = priceLink ? priceLink.textContent.trim() : null;

            if (priceText && priceText !== 'N/A') {
            // If there's a price and it's not 'N/A', remove the dollar sign to get the number
            const price = priceText.replace('$', '');
            result[wearTypes[i - 1]] = parseFloat(price); // Use i-1 since we're skipping the first cell
            }
        }

    return result;
    }, wearTypes);
        
    console.log(wearPortResults);

    //console.log(stashResults)
    updatePricesCSV(item, collection, quality, wearPortResults, 'A_Port', getCurrentTimestamp(), floatValues.min_float, floatValues.max_float);

    return floatValues;

}

(async () => {
    // Launch the browser
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    let wear;
    //const id = 1052;
    //let item = 'AK-47_Asiimov';
    const id = 1057;
    let item = 'AWP_Asiimov';
  
    await readAnalyst(page, item, wear, id);
  
    await waitForRandomTimeout(page, 50000, 100000);
    await browser.close();
  })();