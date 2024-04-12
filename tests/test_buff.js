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

const collection = 'Clutch';
//const collection = 'Danger_Zone';
//const collection = 'Revolution';
//const collection = 'Safehouse';
//const collection = 'Snakebite';


//const quality = 'Mil-Spec';
//const quality = 'Restricted';
const quality = 'Classified';

//const wear = 'fn';
//const wears = ['fn', 'mw', 'ft', 'ww', 'bs']
//const items = ['MP5-SD_Phosphor', 'Desert_Eagle_Mecha_Industries', 'UMP-45_Momentum']
const items = ['USP-S_Cortex']
//const items = ['Sawed-Off_Black_Sand']
//const wears = ['fn', 'ww', 'bs']
const wears = ['mw']
const timestampCutoffTime = 60

const conditionMappings = {
    'Factory New': 'FN',
    'Minimal Wear': 'MW',
    'Field-Tested': 'FT',
    'Well-Worn': 'WW',
    'Battle-Scarred': 'BS'
};

function runPythonScript(scriptPath, args = []) {
    const pythonProcess = spawn('python', [scriptPath, ...args]);
  
    pythonProcess.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`); // Log standard output from the Python script
    });
  
    pythonProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`); // Log standard error from the Python script
    });
  
    pythonProcess.on('close', (code) => {
      console.log(`child process exited with code ${code}`); // Log the exit code of the Python script
    });
  }

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
                try {
                    await page.mouse.move(
                        buttonBox.x + buttonBox.width / 2 + Math.floor(Math.random() * 10) - 5,
                        buttonBox.y + buttonBox.height / 2 + Math.floor(Math.random() * 10) - 5,
                        { steps: 10 }
                    );
                    await waitForRandomTimeout(page, 250, 1000);
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
    const pricesCSV = `prices/${quality}/${source}_prices_${quality}.csv`;

    const dir = path.dirname(pricesCSV); // Ensure the directory exists
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

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

async function scrapeItems(page, item, wear, source, totalItems, exchangeRatio, width, height) {
    const startTime = new Date();
    const seenFloats = new Set();
    let itemIndex = 1;
    const records = [];

    let floatSelector, priceSelector;
    if (source === 'Halo') {
        floatSelector = '.text-textPrimary.text-xs.mb-2';
        priceSelector = '.numFont.text-xl.text-textPrimary';
    } else if (source === 'CS2GO') {
        floatSelector = 'p.wear';
        priceSelector = 'span.value.price[style="font-size: 18px;"]';
    } else if (source === 'Buff') {
        floatSelector = '.wear-value';
        priceSelector = '.f_Strong';
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

                let cleanPrice;
                if (source === 'Buff') {
                    cleanPrice = ((prices[index + 1].replace(/[^0-9.]+/g, "")) / exchangeRatio).toFixed(6);
                    float = float.replace(/[^0-9.]+/g, "");
                } else {
                    cleanPrice = prices[index].replace(/[^0-9.]+/g, "");
                }
                records.push({
                    index: itemIndex++,
                    price: cleanPrice,
                    float: float,
                    condition: wear, // Assumes itemConditionAbbr is globally defined or passed in
                    name: item, // Assumes itemNameUnd is globally defined or passed in
                    site: source,
                    timestamp: timestamp
                });
                newItemsAdded = true;
            }
        });

        if (records.length >= totalItems) {
            console.log(`All (${totalItems}) items processed`);
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

async function fetchItemDetails(page, item, wear, source, itemSelector, itemCountSelector, conditionMappings) {
    let match = null;
    let totalItems = 0;
    let exchangeRatio = 0;

    while (!match && totalItems === 0) {
        try {
            // Use the new selector to fetch the item name and condition
            const itemNameAndCondition = await page.$eval(itemSelector, el => el.textContent.trim());

            //console.log(`Test name: ${itemNameAndCondition}`);
            match = itemNameAndCondition.match(/^(.*?\s\|\s.*?)\s\((.*?)\)$/);
            //console.log(`Match: ${match}`);

            if (source === 'Halo') {
                const totalItemsText = await page.$eval(itemCountSelector, el => el.innerText);
                totalItems = parseInt(totalItemsText.match(/\d+/)[0]); // Retrieve the total number of items
            } else if (source === 'CS2GO') {
                totalItems = 20;
            } else if (source === 'Buff') {
                totalItems = 10;
                const combinedPrice = await page.$eval('.detail-summ .f_Strong', el => el.textContent.trim());
                const cnyPrice = combinedPrice.split('(')[0].trim();
                const usdPrice = combinedPrice.split('(')[1].trim().slice(0, -1);

                const cnyPriceClean = cnyPrice.replace(/[^0-9.]+/g, "");
                const usdPriceClean = usdPrice.replace(/[^0-9.]+/g, "");
                exchangeRatio = (cnyPriceClean / usdPriceClean).toFixed(6);
                //console.log(`Exchange ratio: ${exchangeRatio}`);
            }
        } catch (error) {
            console.log('Error fetching details, retrying...', error);
        }

        if (!match) {
            console.log('Retrying due to unsatisfied conditions (match)');
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for 0.5 seconds before retrying
        }
    }

    if (match) {
        // Get item name and wear
        const itemName = match[1].trim();
        let itemNameUnd = itemName.replace(/\|\s?/g, '').replace(/\s/g, '_');
        console.log(`itemNameUnd: (${itemNameUnd})`);
        const itemConditionFull = match[2].trim();
        let itemConditionAbbr = conditionMappings[itemConditionFull];
        
        console.log(`Name: ${itemName}`);
        console.log(`Wear: ${itemConditionAbbr}`);
        console.log(`Items: ${totalItems}`)

        // Check if the fetched item name and wear match the expected values
        if (itemNameUnd === item && itemConditionAbbr.toLowerCase() === wear) {
            console.log('The item name and wear conditions match');
        } else {
            console.log('THE ITEM NAME AND WEAR CONDITIONS DO NOT MATCH!!!');
        }
        
        //return { itemName, itemNameUnd, itemConditionFull, itemConditionAbbr };
    } else {
        console.log('Item name and condition not found');
        //return null;
    }
    return { totalItems, exchangeRatio };
}

async function readBuff(page, item, wear, id) {
    //const searchName = item.replace(/_/g, '+');
    //const link = `https://haloskins.com/market/${id}?&keyword=${searchName}`;
    const link = `https://buff.163.com/goods/${id}#tab=selling&page_num=1`;
    await page.goto(link, {waitUntil: 'networkidle0', timeout: 60000});

    const { width, height } = await initializePage(page, link);

    const source = 'Buff';
    console.log(source);

    let useless;
    const { totalItems, exchangeRatio } = await fetchItemDetails(page, item, wear, source, '.detail-header .detail-cont h1', useless, conditionMappings);
    
    //console.log('gets here');
    //await waitForRandomTimeout(page, 30000, 30000);

    const otherWearResults = await scrapeOtherWears(page, source, exchangeRatio);
    //console.log(otherWearResults);

    //await waitForRandomTimeout(page, 30000, 30000);

    updatePricesCSV(item, collection, quality, otherWearResults, source); // update the prices for other wears in the pricesCSV

    const results = await scrapeItems(page, item, wear.toUpperCase(), source, totalItems, exchangeRatio, width, height)
    await waitForRandomTimeout(page, 250, 750);
    //console.log(results)
    
    return results;
}

(async () => {
    //const directoryPath = path.join(__dirname, quality, collection); // Create a path for the subfolder
    //let item, wear, id;
    let item = 'AWP_Phobos';
    let wear = 'mw';
    let id = '34114';

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    const results = await readBuff(page, item, wear, id);

    //console.log(results)

    await browser.close();
})();
