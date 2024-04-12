//const puppeteer = require('puppeteer');
// /*
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


const timestampCutoffTime = 60

let haloIDCSV, buffIDCSV, stashIDCSV;

const allRarities = ['Consumer', 'Industrial', 'Mil-Spec', 'Restricted', 'Classified', 'Covert'];

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

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        // Pick a random index from 0 to i
        const j = Math.floor(Math.random() * (i + 1));

        // Swap elements array[i] and array[j]
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}

async function readCsv(filePath) {
    try {
        const csvContent = await fs.readFile(filePath, { encoding: 'utf8' });
        return csvContent;  // This is your CSV content
    } catch (error) {
        console.error("Could not read CSV file:", error);
        return null;
    }
}

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

function getItemsByCollectionAndRarity(csvContent, collection, rarity) {
    // Split the CSV content into lines and trim each line
    const lines = csvContent.trim().split('\n').map(line => line.trim());

    // Filter lines by collection and rarity, then extract the item names
    const items = lines
        .map(line => line.split(','))  // Split each line into fields
        .filter(fields => fields[0] === collection && fields[1] === rarity)  // Filter by collection and rarity
        .map(fields => fields[2]);  // Extract the item name

    return items;
}

function getUpperRarity(rarity, rarities) {
    const index = rarities.indexOf(rarity);

    // Check if the rarity is found and it's not the last element
    if (index !== -1 && index < rarities.length - 1) {
        return rarities[index + 1];
    }

    // Return null or an appropriate value if there's no upper rarity
    return null;
}

async function updatePricesCSV(itemNameUnd, collection, rarity, otherWearResults, source, timestamp = getCurrentTimestamp(), minFloat = null, maxFloat = null) {
    //const timestamp = getCurrentTimestamp();
    const pricesCSV = `prices/${rarity}/${source}_prices_${rarity}.csv`;

    const dir = path.dirname(pricesCSV); // Ensure the directory exists
    if (!fsNormal.existsSync(dir)) {
        fsNormal.mkdirSync(dir, { recursive: true });
    }

    let pricesCSVNewItem = {
        Item: itemNameUnd,
        Collection: collection,
        Rarity: rarity,
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

    if (fsNormal.existsSync(pricesCSV)) { // Reading from the existing CSV file and updating logic...
        fsNormal.createReadStream(pricesCSV)
        .pipe(csv())
        .on('data', (row) => {
            if (row.Item === itemNameUnd) {
                dataExists = true;
                
                // Initialize variables to hold existing values if they are not empty
                let existingMinF = row.MinF !== '' ? row.MinF : null;
                let existingMaxF = row.MaxF !== '' ? row.MaxF : null;
        
                // Update the row with new item data
                Object.assign(row, pricesCSVNewItem);
        
                // Restore the original MinF and MaxF values if they were not empty
                if (existingMinF !== null) row.MinF = existingMinF;
                if (existingMaxF !== null) row.MaxF = existingMaxF;
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
                    console.log(`The ${source} prices CSV for ${itemNameUnd} was updated successfully`);
                } else {
                    console.log(`A new entry for ${itemNameUnd} was added to the ${source} prices CSV successfully`);
                }
            });
        });
    } else { // File doesn't exist, just write the new item
        existingItems.push(pricesCSVNewItem);
        csvWriter.writeRecords(existingItems)
        .then(() => console.log(`${source} CSV prices file for ${itemNameUnd} was created successfully`));
    }
}

async function scrapeOtherWears(page, source, exchangeRatio = null) {
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
            if (!fullText.includes("StatTrak") && !fullText.includes("Souvenir")) {
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
                lastItemTime = new Date();
            }
        });

        if (records.length >= totalItems) {
            console.log(`All (${totalItems}) items processed`);
            break;
        }

        const lastItemTimeout = 6;
        if (!newItemsAdded) {
            await randomScrollPage(page, 150, 300);
            await simulateMouseMovements(page, 5, width, height);
            /*
            const result = await Promise.race([
                new Promise(resolve => setTimeout(() => resolve('timeout'), 10000)),
                waitForRandomTimeout(page, 250, 1500)
            ]);
            if (result === 'timeout') {
                console.log('No new items loading');
            }
            */
            if (new Date() - lastItemTime > (lastItemTimeout*1000)) {
                console.log(`No new items found in the last ${lastItemTimeout}s, exiting..`);
                break;
            }
            console.log(`No new items found, current timer: ${((new Date() - lastItemTime)/1000).toFixed(2)}, checking again...`);
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
        //console.log(`itemNameUnd: (${itemNameUnd})`);
        const itemConditionFull = match[2].trim();
        let itemConditionAbbr = conditionMappings[itemConditionFull].toUpperCase();
        
        console.log(`Name: ${itemName}`);
        console.log(`Wear: ${itemConditionAbbr}`);
        console.log(`Items: ${totalItems}`)

        // Check if the fetched item name and wear match the expected values
        if (itemNameUnd === item && itemConditionAbbr === wear) {
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

function getId(csvContent, item, wear) {
    // Split the CSV content by lines
    const lines = csvContent.trim().replace(/\r\n/g, '\n').split('\n');
  
    // Split the header to get column names
    const headers = lines[0].split(',');
    //console.log(headers);
  
    // Find the index of the wear column
    const wearIndex = headers.indexOf(wear);
  
    // Iterate over each line to find the item
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
  
      // Check if the item matches
      if (row[0] === item) {
        //console.log(row);
        // Check if the value is 'Null'
        if (row[wearIndex] === 'Null') {
          return null;  // Return 'null' as a string
        }
  
        // Return the ID from the corresponding wear column
        return row[wearIndex];
      }
    }
  
    // Return null if the item is not found
    return null;
}

function getStashID(csvContent, item, collection, rarity) {
    // Split the CSV content by lines
    const lines = csvContent.trim().split('\n');

    // Iterate over each line, skipping the header
    for (let i = 1; i < lines.length; i++) {
        // Split the line by comma to get each field
        const fields = lines[i].split(',');

        // Extract values based on their position
        const rowCollection = fields[0].trim();
        const rowRarity = fields[1].trim();
        const rowItem = fields[2].trim();
        const rowId = fields[3].trim();

        // First check if the row matches the given collection and rarity
        if (rowCollection === collection && rowRarity === rarity) {
            // Then check for the item
            if (rowItem === item) {
                return rowId;  // Return the ID if a match is found
            }
        }
    }

    return null;  // Return null if no matching row is found
}

async function scrapeStash(page, item, collection, rarity) {
    console.log(`Item: ${item}`);
    const source = 'Stash';
    console.log(source);
    //const collection = 'Prisma';
    //const collectionID = collectionMapping[collection];
    //const collectionLinkName = collection.replace(' ', '_');
  
    //const collection_link = `https://csgostash.com/case/${collectionID}/${collectionLinkName}-Case`;
    //const startingTimestamp = getCurrentTimestamp();
    //console.log(`Current timestamp: ${startingTimestamp}`);
    const id = getStashID(stashIDCSV, item, collection, rarity);
    //console.log(id);
    if (id === null) {
        throw new Error(`ID not found for ${item} at ${wear}`);
    }

    const itemLinkName = item.replace('_', '-');
    const link = `https://csgostash.com/skin/${id}/${itemLinkName}`;
  
    // Navigate to the specified URL
    await page.goto(link, {waitUntil: 'networkidle0', timeout: 60000});
    
    await waitForRandomTimeout(page, 500, 2500);

    const cookieButtonXPath = '//*[@id="unic-b"]/div/div/div/div[2]/div[2]/button[2]';
    await acceptCookies(page, cookieButtonXPath);

    await waitForRandomTimeout(page, 300, 1000);

    //await page.goto('https://csgostash.com/setcurrency/USD');
    const { width, height } = await initializePage(page, 'https://csgostash.com/setcurrency/USD');

    //await waitForRandomTimeout(page, 3000, 5000);

    await randomScrollPage(page, 100, 400);

    let useless;

    const floatValues = await page.evaluate(() => {
        const minFloatElement = document.querySelector('.wear-min-value');
        const maxFloatElement = document.querySelector('.wear-max-value');
    
        const min_float = minFloatElement ? minFloatElement.getAttribute('data-wearmin') : null;
        const max_float = maxFloatElement ? maxFloatElement.getAttribute('data-wearmax') : null;
    
        //console.log(`Min float: ${min_float}`);
        //console.log(`Max float: ${max_float}`);
    
        return { min_float, max_float };
    });
    
    //console.log(`Min float: ${floatValues.min_float}`);
    //console.log(`Max float: ${floatValues.max_float}`);

    //const timestamp =
    const lastUpdated = await getLastUpdatedTimestampFromPage(page);
    //console.log(`Last updated timestamp: ${lastUpdated}`);

    await randomScrollPage(page, 100, 400);

    const stashResults = await scrapeOtherWears(page, source);
    //console.log(stashResults)
    updatePricesCSV(item, collection, rarity, stashResults, source, lastUpdated, floatValues.min_float, floatValues.max_float);


    const stashBitResults = await scrapeOtherWears(page, 'StashBit');
    //console.log(stashBitResults);
    updatePricesCSV(item, collection, rarity, stashBitResults, 'StashBit', lastUpdated, floatValues.min_float, floatValues.max_float);

    //await waitForRandomTimeout(page, 30000, 50000);

    await runPythonScript('./prices_csv_combiner.py', [rarity]);

    return floatValues;
}

async function scrapeHalo(page, item, wear, collection, rarity) {
    const source = 'Halo';
    console.log(source);

    const id = getId(haloIDCSV, item, wear);
    //console.log(id);
    if (id === null) {
        throw new Error(`ID not found for ${item} at ${wear}`);
    }

    const searchName = item.replace(/_/g, '+');
    const link = `https://haloskins.com/market/${id}?&keyword=${searchName}`;
    //await page.goto(link, {waitUntil: 'networkidle0', timeout: 60000});

    const { width, height } = await initializePage(page, link);

    let useless;
    const totalItems = await fetchItemDetails(page, item, wear, source, 'h3.text-textPrimary.font-medium.sm\\:text-2xl.text-lg', 'h4.text-xl.text-textPrimary', conditionMappings);

    const otherWearResults = await scrapeOtherWears(page, source);
    //console.log(otherWearResults)

    updatePricesCSV(item, collection, rarity, otherWearResults, source); // update the prices for other wears in the pricesCSV

    const cookieButtonXPath = '//*[@id="bodyEle"]/div[1]/div[2]/div/p[4]/button/span';
    await acceptCookies(page, cookieButtonXPath);

    const results = await scrapeItems(page, item, wear.toUpperCase(), source, totalItems, useless, width, height);
    await waitForRandomTimeout(page, 250, 750);
    //console.log(results)
    
    return results;
}

async function scrapeCS2GO(page, item, wear, collection, rarity) {
    const source = 'CS2GO';
    console.log(source);

    const searchName = (item + '-').toLowerCase().replace(/[_\.]/g, '-').replace(/--+/g, '-').replace(/'/g, '-');
    const searchWear = invertedConditionMappings[wear.toUpperCase()].toLowerCase().replace(/\s/g, "-");
    const link = `https://cs2go.com/spu/730/${searchName}${searchWear}`;

    const { width, height } = await initializePage(page, link);

    let useless;
    const totalItems = await fetchItemDetails(page, item, wear, source, 'div.item-name.detail-item > span', useless, conditionMappings);

    const goResults = await scrapeOtherWears(page, source);
    //console.log(goResults)
    updatePricesCSV(item, collection, rarity, goResults, source);

    const steResults = await scrapeOtherWears(page, 'CS2GOsteam');
    //console.log(steResults)
    updatePricesCSV(item, collection, rarity, steResults, 'CS2GOsteam');

    const cookieButtonXPath = '//*[@id="app"]/div[4]/div/div[2]/div[2]';
    await acceptCookies(page, cookieButtonXPath);

    await waitForRandomTimeout(page, 250, 1000);

    const results = await scrapeItems(page, item, wear.toUpperCase(), source, useless, totalItems, width, height);
    await waitForRandomTimeout(page, 250, 1000);
    return results;
}

async function scrapeBuff(page, item, wear, collection, rarity) {
    const source = 'Buff';
    console.log(source);

    const id = getId(buffIDCSV, item, wear);
    //console.log(id);
    if (id === null) {
        throw new Error(`ID not found for ${item} at ${wear}`);
    }
    
    const link = `https://buff.163.com/goods/${id}#tab=selling&page_num=1`;
    //await page.goto(link, {waitUntil: 'networkidle0', timeout: 60000});

    const { width, height } = await initializePage(page, link);

    let useless;
    const { totalItems, exchangeRatio } = await fetchItemDetails(page, item, wear, source, '.detail-header .detail-cont h1', useless, conditionMappings);
    
    //console.log('gets here');
    //await waitForRandomTimeout(page, 30000, 30000);

    const otherWearResults = await scrapeOtherWears(page, source, exchangeRatio);
    //console.log(otherWearResults);

    //await waitForRandomTimeout(page, 30000, 30000);

    await updatePricesCSV(item, collection, rarity, otherWearResults, source); // update the prices for other wears in the pricesCSV

    await randomScrollPage(page, 150, 300);

    await waitForRandomTimeout(page, 500, 1500);

    const results = await scrapeItems(page, item, wear.toUpperCase(), source, totalItems, exchangeRatio, width, height);
    await waitForRandomTimeout(page, 1000, 1000);
    //console.log(results)
    
    return results;
}

async function siteItemScrapers(page, item, wear, collection, rarity) {
    console.log('');
    console.log(`Item: ${item}`);
    console.log(`Wear: ${wear}`);

    let itemResults = [];
    //let csvFileName;
    //const csvFileName = `${item}_(${wear}).csv`;
    
    try {
        const resultsFromHalo = await scrapeHalo(page, item, wear, collection, rarity);
        itemResults = [...itemResults, ...resultsFromHalo];
    } catch (error) {
        console.error(`Error scraping Halo for item ${item}: ${error}`);
    }

    try {
        const resultsFrom2go = await scrapeCS2GO(page, item, wear, collection, rarity);
        itemResults = [...itemResults, ...resultsFrom2go];
    } catch (error) {
        console.error(`Error scraping CS2GO for item ${item}: ${error}`);
        // Proceed to next item or other necessary action
    }
    // */

    try {
        const resultsFromBuff = await scrapeBuff(page, item, wear, collection, rarity);
        itemResults = [...itemResults, ...resultsFromBuff];
    } catch (error) {
        console.error(`Error scraping Buff for item ${item}: ${error}`);
        // Proceed to next item or other necessary action
    }

    //const filePath = path.join(directoryPath, csvFileName); // Now include the subfolder in the path for your csvWriter
    const itemCSVFileName = `Items/${rarity}/${collection}/${item}_(${wear}).csv`;

    const dir = path.dirname(itemCSVFileName); // Ensure the directory exists
    if (!fsNormal.existsSync(dir)) {
        fsNormal.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(__dirname, itemCSVFileName);

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

    //await waitForRandomTimeout(page, 100, 500);

    await runPythonScript('./prices_csv_combiner.py', [rarity]);

    await runPythonScript('./csv_comb_n_filt.py', [collection, rarity]);
}

(async () => {
    stashIDCSV = await readCsv('C:/Users/Kristaps/Desktop/TUP-main/IDS/Stash/stash_ids.csv');
    haloIDCSV = await readCsv('C:/Users/Kristaps/Desktop/TUP-main/IDS/Halo/halo_ids.csv');
    buffIDCSV = await readCsv('C:/Users/Kristaps/Desktop/TUP-main/IDS/Buff/buff_ids.csv');

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    //console.log(haloIDCSV);

    //const rarity = 'Consumer';
    //const rarity = 'Industrial';
    //const rarity = 'Mil-Spec';
    const rarity = 'Restricted';
    //const rarity = 'Classified';

    const upperRarity = getUpperRarity(rarity, allRarities);

    //const collection = 'Clutch';
    //const collection = 'Danger_Zone';
    //const collection = 'Revolution';
    //const collection = 'Safehouse';
    //const collection = 'Anubis';
    const collections = ['Revolution'];
    
    for (const collection of collections) {

        //const wear = 'fn'.toUpperCase();
        //const wears = ['fn', 'mw', 'ft', 'ww', 'bs']
        //const items = ['MP5-SD_Phosphor', 'Desert_Eagle_Mecha_Industries', 'UMP-45_Momentum']
        //const items = ['USP-S_Cortex']
        //const items = ['Sawed-Off_Black_Sand']
        //const wears = ['fn', 'ww', 'bs']
        //const wears = ['mw']
        //const item = 'P90_Neoqueen';
        //const item = 'Glock-18_Umbral_Rabbit';
        //const item = "Nova_Sobek's_Bite";
        //const items = ['Glock-18_Umbral_Rabbit', 'P90_Neoqueen']
        const items = getItemsByCollectionAndRarity(stashIDCSV, collection, rarity);

        //console.log(`Item: ${item}`);

        let remainingWears = {};

        for (const item of items) {
            try {
                const floatValues = await scrapeStash(page, item, collection, rarity);
                //itemResults = [...itemResults, ...resultsFromHalo];
            } catch (error) {
                console.error(`Error scraping Stash for item ${item}: ${error}`);
            }

            //const possibleWears = determinePossibleWears(floatValues.min_float, floatValues.max_float);
            const possibleWears = [ 'FT', 'WW' ];
            const shuffledWears = shuffleArray([...possibleWears]);

            remainingWears[item] = shuffledWears.slice(1); // Store remaining types, excluding the first which will be processed now

            // Call Regular for the first type immediately
            if (shuffledWears.length > 0) {
                //console.log(`Item: ${item}`);
                //console.log(`Wear: ${shuffledWears[0]}`);

                //await callRegularFunction(item, shuffledWears[0]);
                await siteItemScrapers(page, item, shuffledWears[0], collection, rarity);
            }
        }

        // Second pass: Process remaining types in a round-robin fashion
        let itemsWithUnreadWears = Object.keys(remainingWears);
        while (itemsWithUnreadWears.length > 0) {
            for (const item of itemsWithUnreadWears) {
                if (remainingWears[item].length > 0) {
                    const wear = remainingWears[item].shift(); // Get and remove the first type from the remaining list
                    //await callRegularFunction(item, type);
                    await siteItemScrapers(page, item, wear, collection, rarity);
                }
            }
            // Update the list of items that still have remaining types to process
            itemsWithUnreadWears = itemsWithUnreadWears.filter(item => remainingWears[item].length > 0);
        }

    /*

    for (const wear in possibleWears) {

        console.log(`Item: ${item}`);
        console.log(`Wear: ${wear}`);
        
        await siteItemScrapers(page, item, wear, collection, rarity);

        await waitForRandomTimeout(page, 100, 500);
            
    }
    */
    }

    await browser.close();
})();
