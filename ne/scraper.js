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

async function scrapeOtherWears(page, source) {
    const otherWearResults = await page.evaluate((source) => {
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
        }

        const conditionElements = document.querySelectorAll(conditionSelector);
        conditionElements.forEach((conditionElement) => {
            const condition = conditionElement.textContent.trim();
            if (!condition.includes("StatTrak")) {
                let priceElement;
                if (source === 'Halo') {
                    priceElement = conditionElement.nextElementSibling.querySelector(priceSelector);
                } else {
                    // For 'Go' and 'ste', find the price element relative to the condition element
                    priceElement = conditionElement.closest('li').querySelector(priceSelector);
                }

                if (priceElement) {
                    const price = priceElement.textContent.trim();
                    const cleanPrice = price.replace(/[^0-9.]+/g, "");
                    items.push(`${condition}: ${cleanPrice}`);
                }
            }
        });
        return items;
    }, source);
    return otherWearResults;
}

async function timestampCheck(directoryPath, item, wear, timestampCutoffTime) {
    const csvFileNameTestTimestamp = `${item}_(${wear.toUpperCase()}).csv`;
    const filePathTestTimestamp = path.join(directoryPath, csvFileNameTestTimestamp);

    if (fs.existsSync(filePathTestTimestamp)) {
        // File exists, so check the most recent timestamp
        let mostRecentTimestamp = null;

        await new Promise((resolve, reject) => {
            fs.createReadStream(filePathTestTimestamp)
                .pipe(csv())
                .on('data', (row) => {
                    if (row.Timestamp && row.Site === 'Halo') {
                        const timestamp = new Date(row.Timestamp);
                        if (!mostRecentTimestamp || timestamp > mostRecentTimestamp) {
                            mostRecentTimestamp = timestamp;
                        }
                    }
                })
                .on('end', () => resolve())
                .on('error', reject);
        });

        if (mostRecentTimestamp) {
            const diffMinutes = (new Date() - mostRecentTimestamp) / (1000 * 60);
            if (diffMinutes < timestampCutoffTime) {
                // The most recent timestamp is less than 30 minutes old, return true to indicate skipping
                //console.log(`Skipping ${item} in ${wear}: Recent entry less than ${timestampCutoffTime} minutes ago.`);
                return true; // Skip
            }
        }
    }

    return false; // Do not skip
}

async function scrapeItems(page, item, wear, source, totalItems, width, height) {
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

                const cleanPrice = prices[index].replace(/[^0-9.]+/g, "");
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

    while (!match && totalItems === 0) {
        try {
            // Use the new selector to fetch the item name and condition
            const itemNameAndCondition = await page.$eval(itemSelector, el => el.textContent);
            //console.log(`Test name: ${itemNameAndCondition}`)
            match = itemNameAndCondition.match(/^(.*?\s\|\s.*?)\s\((.*?)\)$/);

            if (source === 'Halo') {
                const totalItemsText = await page.$eval(itemCountSelector, el => el.innerText);
                totalItems = parseInt(totalItemsText.match(/\d+/)[0]); // Retrieve the total number of items
            } else if (source === 'CS2GO') {
                totalItems = 20;
            } else if (source === 'Buff') {
                totalItems = 10;
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
        /*
        let itemName, itemNameUnd, itemConditionAbbr, itemConditionFull;
        if (source === 'Halo') {
            itemName = match[1];
            itemNameUnd = itemName.replace(/\|\s?/g, '').replace(/\s/g, '_'); // Replace '| ' with '';
            itemConditionFull = match[2];
            //itemConditionAbbr = conditionMappings[itemConditionFull];
        } else if (source === 'CS2GO') {
            itemName = match[1]; //+ ' | ' + match[2]; // Combined to include the '|' in the name
            itemNameUnd = itemName.replace(/\|\s?/g, '').replace(/\s/g, '_'); // Replace '| ' with '' and spaces with '_'
            itemConditionFull = match[2];
        }*/
        const itemName = match[1];
        let itemNameUnd = itemName.replace(/\|\s?/g, '').replace(/\s/g, '_');
        const itemConditionFull = match[2];
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
        return totalItems;
    } else {
        console.log('Item name and condition not found');
        return null;
    }
}

async function scrapeHalo(page, item, wear, id) {
    const searchName = item.replace(/_/g, '+');
    const link = `https://haloskins.com/market/${id}?&keyword=${searchName}`;
    await page.goto(link, {waitUntil: 'networkidle0', timeout: 60000});

    const { width, height } = await initializePage(page, link);

    const source = 'Halo'
    console.log(source)

    //let match;
    //let totalItems = 0;
    
    /*
    while (!match || totalItems === 0) { // get total item count
        try {
            const itemNameAndCondition = await page.$eval('h3.text-textPrimary.font-medium.sm\\:text-2xl.text-lg', el => el.textContent);
            match = itemNameAndCondition.match(/^(.*?)\s\((.*?)\)$/);
    
            const totalItemsText = await page.$eval('h4.text-xl.text-textPrimary', el => el.innerText);
            totalItems = parseInt(totalItemsText.match(/\d+/)[0]); // Retrieve the total number of items
        } catch (error) {
            console.log('Error fetching details, retrying...', error);
        }
    
        if (!match || totalItems === 0) {
            console.log('Retrying due to unsatisfied conditions (match or totalItems)');
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for 1 second before retrying
        }
    }

    if (match) { // get item name and wear
        const itemName = match[1];
        let itemNameUnd = itemName.replace(/\|\s?/g, '').replace(/\s/g, '_'); // Replace '| ' with '';
        const itemConditionFull = match[2];
        let itemConditionAbbr = conditionMappings[itemConditionFull];

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

    console.log(`Items: ${totalItems}`)
    */
    const totalItems = await fetchItemDetails(page, item, wear, source, 'h3.text-textPrimary.font-medium.sm\\:text-2xl.text-lg', 'h4.text-xl.text-textPrimary', conditionMappings);

    const otherWearResults = await scrapeOtherWears(page, source);
    //console.log(otherWearResults)

    updatePricesCSV(item, collection, quality, otherWearResults, source); // update the prices for other wears in the pricesCSV

    const cookieButtonXPath = '//*[@id="bodyEle"]/div[1]/div[2]/div/p[4]/button/span';
    await acceptCookies(page, cookieButtonXPath);

    const results = await scrapeItems(page, item, wear.toUpperCase(), source, totalItems, width, height)
    await waitForRandomTimeout(page, 250, 750);
    //console.log(results)
    
    return results;
}

async function scrapeCS2GO(page, item, wear) {
    const searchName = (item + '-').toLowerCase().replace(/[_\.]/g, '-').replace(/--+/g, '-');
    const searchWear = invertedConditionMappings[wear.toUpperCase()].toLowerCase().replace(/\s/g, "-");
    const link = `https://cs2go.com/spu/730/${searchName}${searchWear}`;

    const { width, height } = await initializePage(page, link);

    const source = 'CS2GO'
    console.log(source)

    //let match;
    //let totalItems = 20;

    /*
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
        let itemNameUnd = itemName.replace(/\|\s?/g, '').replace(/\s/g, '_'); // Replace '| ' with '';
        const itemConditionFull = match[3];
        let itemConditionAbbr = conditionMappings[itemConditionFull];
    
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
    }*/
    let useless;
    const totalItems = await fetchItemDetails(page, item, wear, source, 'div.item-name.detail-item > span', useless, conditionMappings);

    const goResults = await scrapeOtherWears(page, source);
    //console.log(goResults)
    updatePricesCSV(item, collection, quality, goResults, source);

    const steResults = await scrapeOtherWears(page, 'CS2GOsteam');
    //console.log(steResults)
    updatePricesCSV(item, collection, quality, steResults, 'CS2GOsteam');

    const cookieButtonXPath = '//*[@id="app"]/div[4]/div/div[2]/div[2]';
    await acceptCookies(page, cookieButtonXPath);

    await waitForRandomTimeout(page, 500, 1500)

    const results = await scrapeItems(page, item, wear.toUpperCase(), source, totalItems, width, height)
    await waitForRandomTimeout(page, 250, 1500);
    return results
}

(async () => {
    const directoryPath = path.join(__dirname, quality, collection); // Create a path for the subfolder

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Check if the subfolder exists, create it if it doesn't
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    let IDLinkRecords;
    try {
        const linkCSV = fs.readFileSync(`C:/Users/Kristaps/Desktop/TUP-main/ne/links/links_${quality}.csv`, 'utf8');
        IDLinkRecords = parse(linkCSV, { columns: true, skip_empty_lines: true });
        if (!IDLinkRecords || IDLinkRecords.length === 0) {
            throw new Error('ID link records is empty, cannot proceed.');
        }
    } catch (error) {
        console.error('Error reading or parsing CSV:', error);
        return; // Exit if there's an error
    }

    for (const wear of wears) {
        for (const item of items) {
            var matchingItem = IDLinkRecords.find(IDLinkRecord => 
                IDLinkRecord.item === item && 
                IDLinkRecord.collection === collection && 
                IDLinkRecord.quality === quality
            );
            for (const numberOfNumbers of [1]) { // useless loop, otherwise records initialization breaks

                let id;
                if (matchingItem && matchingItem[wear] !== 'Null') {
                    id = matchingItem[wear];
                } else {
                    console.error(`ID is Null for ${item} at ${wear}`);
                    continue; // Skip to the next iteration of the loop
                }
                
                const shouldSkip = await timestampCheck(directoryPath, item, wear, timestampCutoffTime);

                if (shouldSkip) {
                    console.log(`Skipping ${item} in ${wear}: Recent entry less than ${timestampCutoffTime} minutes ago.`);
                    continue; // Skip to the next iteration of the loop
                }

                let itemResults = [];
                //let csvFileName;
                const csvFileName = `${item}_(${wear.toUpperCase()}).csv`;
                
                //const { itemResults, csvFileName } = await scrapeHalo(page, item, wear, id);
                //const { results: resultsFromHalo, csvFileName: fileName } = await scrapeHalo(page, item, wear, id);
                //const resultsFromHalo = await scrapeHalo(page, item, wear, id);
                //csvFileName = fileName;
                //itemResults = [...itemResults, ...resultsFromHalo];
                try {
                    const resultsFromHalo = await scrapeHalo(page, item, wear, id);
                    itemResults = [...itemResults, ...resultsFromHalo];
                } catch (error) {
                    console.error(`Error scraping Halo for item ${item}: ${error}`);
                    // Despite the error, we proceed to try scrape2go
                }

                //const resultsFromCS2GO = await scrapeCS2GO(page, item, wear);
                //itemResults = [...itemResults, ...resultsFromCS2GO];
                try {
                    const resultsFrom2go = await scrapeCS2GO(page, item, wear);
                    itemResults = [...itemResults, ...resultsFrom2go];
                } catch (error) {
                    console.error(`Error scraping CS2GO for item ${item}: ${error}`);
                    // Proceed to next item or other necessary action
                }

                const filePath = path.join(directoryPath, csvFileName); // Now include the subfolder in the path for your csvWriter

                if (itemResults.length > 0) {
                    const csvWriter = createCsvWriter({ // Configure CSV Writer
                        path: filePath,
                        header: [
                            { id: 'index', title: 'Index' },
                            { id: 'price', title: 'Price' },
                            { id: 'float', title: 'Float' },
                            { id: 'condition', title: 'Condition' },
                            { id: 'name', title: 'Name' },
                            { id: 'site', title: 'Site' },
                            { id: 'timestamp', title: 'Timestamp' }
                        ]
                    });

                    await csvWriter.writeRecords(itemResults) // Write the data to CSV
                        .then(() => {
                            console.log(`CSV for ${item} in ${wear} file was written successfully`);
                            //console.log('CSV file was written successfully');
                        });
                } else {
                    console.log(`CSV for ${item} in ${wear} not written (empty)`);
                }

                await waitForRandomTimeout(page, 100, 500);

                /*
                const pythonProcess = spawn('python', ['./csv_comb_n_filt.py', collection, quality]);

                pythonProcess.stdout.on('data', (data) => {
                    console.log(`stdout: ${data}`); // Log standard output from the Python script
                });
                
                pythonProcess.stderr.on('data', (data) => {
                    console.error(`stderr: ${data}`); // Log standard error from the Python script
                });
                
                pythonProcess.on('close', (code) => {
                    console.log(`child process exited with code ${code}`); // Log the exit code of the Python script
                });*/

                await runPythonScript('./prices_csv_combiner.py', [quality]);

                await runPythonScript('./csv_comb_n_filt.py', [collection, quality]);
            }
        }
    }
    await browser.close();
})();
