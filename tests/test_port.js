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

let haloIDCSV, buffIDCSV, stashIDCSV;

const allRarities = ['Consumer', 'Industrial', 'Mil-Spec', 'Restricted', 'Classified', 'Covert'];

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

async function readCsv(filePath) {
    try {
        const csvContent = await fs.readFile(filePath, { encoding: 'utf8' });
        return csvContent;  // This is your CSV content
    } catch (error) {
        console.error("Could not read CSV file:", error);
        return null;
    }
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

async function waitForRandomTimeout(page, minTimeout, maxTimeout) {
    const timeoutDuration = Math.floor(Math.random() * (maxTimeout - minTimeout + 1)) + minTimeout;
    await page.waitForTimeout(timeoutDuration);
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

function getRandomWeightedTowardsCenter() {
    const numRandom = 10; // Increase for a tighter concentration around the mean
    let sum = 0;
    for (let i = 0; i < numRandom; i++) {
        sum += Math.random();
    }
    return sum / numRandom;
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

async function randomScrollPage(page, minScroll, maxScroll) {
    await page.evaluate((min, max) => {
        const randomScroll = Math.floor(Math.random() * (max - min + 1)) + min;
        window.scrollBy(0, randomScroll);
    }, minScroll, maxScroll);
}

async function moveAndScroll(page, width, height, moveCount = 1, minScroll = 10, maxScroll = 50, minX = 0, minY = 0) {  // Simulate irregular mouse movements by randomly moving the mouse around within the viewport dimensions
    const timesToMove = Math.floor(Math.random() * moveCount + 1);
    for (let i = 0; i < timesToMove+1; i++) {
        const x = parseFloat(((getRandomWeightedTowardsCenter() - 0.5) * width + width * 0.5).toFixed(2)) + minX;
        const y = parseFloat(((getRandomWeightedTowardsCenter() - 0.5) * height + height * 0.4).toFixed(2)) + minY;
        await page.mouse.move(x, y, { steps: 5 }); // Move mouse to (x, y) with intermediate steps for smoother movement

        await waitForRandomTimeout(page, 10, 100);

        const deltaY = Math.floor(Math.random() * (maxScroll - minScroll + 1)) + minScroll;
        await page.mouse.wheel({ deltaY });

        console.log(`Moved to (${(100*x/(width+minX)).toFixed(2)}%, ${(100*y/(height+minY)).toFixed(2)}%, scrolled: ${deltaY})`);
    }
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

async function acceptCookiesTimed(page, cookieButtonXPath) {
    try {
        const timeoutPromise = new Promise((resolve, reject) => {
            // Set the timeout
            setTimeout(() => {
                console.log('Timeout triggered'); // Additional logging
                reject(new Error('Timeout: Cookies not accepted in time.'));
            }, 10000); // 10 seconds
        });

        const acceptCookiesPromise = (async () => {
            await page.waitForXPath(cookieButtonXPath, { timeout: 9000 }).catch(e => console.log('Waiting for XPath failed:', e)); // Wait for XPath with a slightly shorter timeout than the overall timeout
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
                        await waitForRandomTimeout(page, 250, 950);
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
        })();

        // Race the acceptCookiesPromise against the timeoutPromise
        await Promise.race([acceptCookiesPromise, timeoutPromise]);
    } catch (error) {
        console.error('Error accepting cookies:', error);
        throw error; // Rethrow the error to be handled by the caller if needed
    }
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

async function scrapeCombinedItems(page, source, exchangeRatio, width, height, totalItems = null, minX = 0, minY = 0) {
    const startTime = new Date();
    const seenFloats = new Set();
    // const seenItems = new Set();
    let itemIndex = 1;
    const records = [];

    let lastItemTimeout = 20;
    const totalAllowedTime = 45;
    let lastItemTime;

    let floatSelector, priceSelector, itemSelector;
    if (source === 'Port') {
        floatSelector = '.ItemPreview-wear .WearBar-value';
        priceSelector = '.ItemPreview-priceValue .Tooltip-link';
        itemSelector = '.ItemPreview-itemImage img';
        lastItemTimeout = 20;
    } else if (source === 'DM') {
        floatSelector = '.o-qualityChart__infoValue span';
        priceSelector = '.c-asset__priceNumber';
        itemSelector = '.c-asset__img'; 
    } else if (source === 'Monkey') {
        floatSelector = '.item-float.item-card__float';
        priceSelector = '.item-price.item-card__price';
        itemSelector = '.item-image.item-card__image';
        lastItemTimeout = 5;
    }

    let floats;

    await randomScrollPage(page, 50, 250);
    while (true) {
        try {

            //await randomScrollPage(page, 50, 250);
            // Retrieve values for each visible item using selectors passed as parameters
            //const floats = await page.$$eval(floatSelector, elements => elements.map(el => el.textContent));
            if (source === 'Monkey') {
                floats = await page.$$eval(floatSelector, elements => 
                    elements.map(el => el.style.getPropertyValue('--float-value'))
                );
            } else {
                floats = await page.$$eval(floatSelector, elements => elements.map(el => el.textContent));
            }
            const prices = await page.$$eval(priceSelector, elements => elements.map(el => el.textContent));

            //const floats = await page.$$eval(floatSelector, elements => elements.map(el => el.textContent.trim()));
            //const prices = await page.$$eval(priceSelector, elements => elements.map(el => el.textContent.trim().replace(/[^0-9.]+/g, "")));
            // const names = await page.$$eval(itemSelector, elements => elements.map(el => el.alt.split(' (')[0])); // Assuming the item name is in the alt text of an image
            const itemAlts = await page.$$eval(itemSelector, elements => elements.map(el => el.getAttribute('alt')));
            //const conditions = await page.$$eval(conditionSelector, elements => elements.map(el => el.textContent.trim()));
            
            let newItemsAdded = false;
            const timestamp = getCurrentTimestamp();

            floats.forEach((float, index) => {
                if (!seenFloats.has(float)) {
                    const altText = itemAlts[index];
                    if (!altText.includes('StatTrak')) {
                        seenFloats.add(float);

                        //console.log('gets after floats');

                        //const float = floats[index].trim();
                        const price = prices[index].trim();
                        const cleanPrice = price.replace(/[^0-9.]+/g, "");
                        //const itemIdentifier = `${float}-${cleanPrice}`; // Use both float and cleaned price for uniqueness
                        
                        //const altText = itemAlts[index];
                        const [fullName, conditionText] = altText.split(' (');
                        const name = fullName.trim().replace(/ \|\s/g, '_').replace(/ /g, '_');
                        const condition = conditionText.replace(')', '').trim(); // Assuming the condition is at the end within parentheses
                        const conditionAbbr = conditionMappings[condition] || condition;
                        
                        let realFloat, usdPrice;
                        if (source === 'Port') {
                            //realFloat = (parseFloat(float) + 0.00075).toFixed(6);
                            realFloat = parseFloat((parseFloat(float) + 0.0008).toFixed(6));
                            //usdPrice = (parseFloat(cleanPrice) * exchangeRatio).toFixed(6);
                            usdPrice = parseFloat((parseFloat(cleanPrice) * exchangeRatio).toFixed(6));
                        } else if (source === 'DM') {
                            realFloat = parseFloat((parseFloat(float) + 0.00003).toFixed(6)); // adding 0.000025 instead would assume that, on average, the real value might be halfway between the displayed value and the next higher value at four decimal places.
                            // 0.000049;
                            usdPrice = parseFloat(cleanPrice);
                        } else if (source === 'Monkey') {
                            cleanFloat = float.replace(/[^0-9.]+/g, "");
                            realFloat = parseFloat(cleanFloat/100); 
                            //usdPrice = (parseFloat(cleanPrice) * 0.65).toFixed(6);
                            usdPrice = (parseFloat(cleanPrice) / 1.35).toFixed(6);
                        } else if (source === 'Money') {
                            realFloat = parseFloat((parseFloat(float) + 0.00008).toFixed(6));
                            usdPrice = (parseFloat(cleanPrice) / 1.3).toFixed(6);
                        } else {
                            realFloat = float;
                            usdPrice = cleanPrice;
                        }

                        records.push({
                            index: itemIndex++,
                            price: usdPrice,
                            float: realFloat,
                            condition: conditionAbbr, // Assumes itemConditionAbbr is globally defined or passed in
                            name: name, // Assumes itemNameUnd is globally defined or passed in
                            site: source,
                            timestamp: timestamp
                        });
                        console.log(`${itemIndex}: ${name} - ${float} (${price}) at ${timestamp}`);
                        newItemsAdded = true;
                        lastItemTime = new Date();
                    }
                }
            });

            
            if (!newItemsAdded) {
                //await randomScrollPage(page, 50, 500);
                //await simulateMouseMovements(page, 2, width, height);
                //await moveAndScroll(page, width, height, moveCount = 2, minScroll = 50, maxScroll = 250)
                await moveAndScroll(page, width, height, moveCount = 2, minScroll = 50, maxScroll = 250, minX, minY)
                
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
            if (new Date() - startTime > (totalAllowedTime*1000)) {
                console.log(`${itemIndex + 1} items processed`);
                console.log(`Timeout (${totalAllowedTime}s) reached`);
                break;
            }
            await waitForRandomTimeout(page, 200, 1000);
        } catch (error) {
            console.error("Error encountered during scrapeCombinedItems: ", error);
            // Optionally, you can decide to break out of the loop after an error
            // or continue to try the next iteration.
            break; // or continue; depending on your desired behavior
        }
    }
    return records;
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
    console.log(id);
    if (id === null) {
        throw new Error(`ID not found for ${item}`);
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

async function scrapePort(page, collection, rarity) {
    const source = 'Port';
    console.log(source);

    const portCollectionMap = {
        'Kilowatt': 1369,
        'Dreams & Nightmares': 1236,
        'Fracture': 1101,
        'Recoil': 1241,
        'Revolution': 1287,
        'Chroma': 5,
        'Chroma 2': 7,
        'Chroma 3': 33,
        'Clutch': 37,
        'CS:GO Weapon': 6,
        'CS:GO Weapon 2': 44,
        'CS:GO Weapon 3': 45,
        'CS20': 103,
        'Danger Zone': 53,
        'eSports 2013': 21,
        'eSports 2013 Winter': 4,
        'eSports 2014 Summer': 14,
        'Falchion': 1,
        'Gamma': 28,
        'Gamma 2': 16,
        'Glove': 17,
        'Horizon': 244,
        'Huntsman Weapon': 25,
        'Operation Bravo': 9,
        'Operation Breakout Weapon': 48,
        'Operation Broken Fang': 1147,
        'Operation Hydra': 18,
        'Operation Phoenix Weapon': 22,
        'Operation Riptide': 1208,
        'Operation Vanguard Weapon': 26,
        'Operation Wildfire': 12,
        'Prisma': 56,
        'Prisma 2': 112,
        'Revolver': 19,
        'Shadow': 11,
        'Shattered Web': 105,
        'Snakebite': 1200,
        'Spectrum': 3,
        'Spectrum 2': 24,
        'Winter Offensive Weapon': 40,
        'Ancient': 1149,
        'Anubis': 1288,
        'Inferno (2018)': 55,
        'Mirage (2021)': 1205,
        'Nuke (2018)': 51,
        'Overpass': 39,
        'Vertigo (2021)': 1209,
        'Alpha': 27,
        'Assault': 34,
        'Aztec': 15,
        'Baggage': 10,
        'Bank': 8,
        'Cache': 35,
        'Canals': 107,
        'Chop Shop': 46,
        'Cobblestone': 38,
        'Control': 1148,
        'Dust': 20,
        'Dust 2 (2021)': 1206,
        'Dust 2 (Old)': 23,
        'Gods and Monsters': 32,
        'Havoc': 1151,
        'Inferno (2018)': 43,
        'Italy': 31,
        'Lake': 36,
        'Militia': 50,
        'Mirage (Old)': 29,
        'Norse': 104,
        'Nuke (Old)': 41,
        'Office': 49,
        'Rising Sun': 13,
        'Safehouse': 30,
        'St. Marc': 106,
        'Train (2021)': 1207,
        'Train (Old)': 42,
        'Vertigo (Old)': 2
    };

    const id = portCollectionMap[collection];
    console.log(id);
    if (id === null) {
        throw new Error(`ID not found for ${collection}`);
    }

    const portRarityMap = {
        'Consumer': 6,
        'Industrial': 5,
        'Mil-Spec': 2,
        'Restricted': 3,
        'Classified': 4,
        'Covert': 1
    };

    const rarityID = portRarityMap[rarity];

    const link = `https://skinport.com/market?sort=percent&order=desc&stattrak=0&souvenir=0&rarity=${rarityID}&collection=${id}`;

    const { width, height } = await initializePage(page, link, timeOut = 75000);

    let useless;

    await waitForRandomTimeout(page, 250, 750);
    //const totalItems = await fetchItemDetails(page, item, wear, source, 'h3.text-textPrimary.font-medium.sm\\:text-2xl.text-lg', 'h4.text-xl.text-textPrimary', conditionMappings);

    //const otherWearResults = await scrapeOtherWears(page, source);
    //console.log(otherWearResults)

    //updatePricesCSV(item, collection, rarity, otherWearResults, source); // update the prices for other wears in the pricesCSV

    const cookieButtonXPath = '//*[@id="root"]/div[3]/div/div[2]/button[1]/div';
    await acceptCookies(page, cookieButtonXPath);

    const eurusd = 1.08;

    const results = await scrapeCombinedItems(page, source, eurusd, width, height, useless);
    await waitForRandomTimeout(page, 250, 750);
    //console.log(results)
    
    return results;
}

async function scrapeDM(page, collection, rarity) {
    const source = 'DM';
    console.log(source);

    //const id = getId(haloIDCSV, item, wear);
    //console.log(id);
    //if (id === null) {
    //    throw new Error(`ID not found for ${item} at ${wear}`);
    //}

    //const searchName = item.replace(/_/g, '+');
    //const link = `https://haloskins.com/market/${id}?&keyword=${searchName}`;

    const collectionID = collection.replace(/\s/g, '%20').toLowerCase();

    const dmRarityMap = {
        'Consumer': 'consumer%20grade',
        'Industrial': 'industrial%20grade',
        'Mil-Spec': 'mil-spec%20grade',
        'Restricted': 'restricted',
        'Classified': 'classified',
        'Covert': 'covert'
    };

    //const rarityID = dMarketRarityMap[rarity];
    const rarityID = rarity.replace(/\s/g, '%20').toLowerCase();
    

    const link = `https://dmarket.com/ingame-items/item-list/csgo-skins?category_0=not_stattrak_tm&category_1=not_souvenir&collection=${collectionID}&quality=${rarityID}`;

    //console.log('gets here0');

    const { width, height } = await initializePage(page, link, timeOut = 75000, wait = false);

    let useless;

    //console.log('gets here1');

    await waitForRandomTimeout(page, 1500, 2500);
    //const totalItems = await fetchItemDetails(page, item, wear, source, 'h3.text-textPrimary.font-medium.sm\\:text-2xl.text-lg', 'h4.text-xl.text-textPrimary', conditionMappings);

    //const otherWearResults = await scrapeOtherWears(page, source);
    //console.log(otherWearResults)

    //updatePricesCSV(item, collection, rarity, otherWearResults, source); // update the prices for other wears in the pricesCSV

    const cookieButtonXPath = '/html/body/app-root/mat-sidenav-container/mat-sidenav-content/div[1]/app-header/header-banners/div/cookie-banner/div/div/div/div[2]/button';
    await acceptCookies(page, cookieButtonXPath);

    //console.log('gets here2');

    const results = await scrapeCombinedItems(page, source, useless, width, height, useless);
    await waitForRandomTimeout(page, 250, 750);
    //console.log(results)
    
    return results;
}

async function scrapeMonkey(page, collection, rarity) {
    const source = 'Monkey';
    console.log(source);

    //const id = getId(haloIDCSV, item, wear);
    //console.log(id);
    //if (id === null) {
    //    throw new Error(`ID not found for ${item} at ${wear}`);
    //}

    //const searchName = item.replace(/_/g, '+');
    //const link = `https://haloskins.com/market/${id}?&keyword=${searchName}`;
    const monkeyCollectionMap = {
        'Alpha': 8,
        'Ancient': 9, 
        'Anubis': 10, 
        'Assault': 14, 
        'Aztec': 15, 
        'Baggage': 16, 
        'Bank': 17, 
        'CS20': 30, 
        'CS:GO Weapon': 13, 
        'CS:GO Weapon 2': 11, 
        'CS:GO Weapon 3': 12, 
        'Cache': 21, 
        'Canals': 22, 
        'Chop Shop': 23, 
        'Chroma': 26, 
        'Chroma 2': 24, 
        'Chroma 3': 25, 
        'Clutch': 27, 
        'Cobblestone': 28, 
        'Control': 29, 
        'Danger Zone': 31, 
        'Dreams & Nightmares': 32, 
        'Dust': 34, 
        'Dust 2 (2021)': 4, 
        'Dust 2 (Old)': 33, 
        'Falchion': 39, 
        'Fracture': 40, 
        'Gamma': 42, 
        'Gamma 2': 41, 
        'Glove': 43, 
        'Gods and Monsters': 44, 
        'Havoc': 45, 
        'Horizon': 46, 
        'Huntsman Weapon': 47, 
        'Inferno (2018)': 48, 
        'Italy': 49, 
        'Kilowatt': 50, 
        'Lake': 51, 
        'Militia': 52, 
        'Mirage (2021)': 5, 
        'Mirage (Old)': 53, 
        'Norse': 54, 
        'Nuke (2018)': 3, 
        'Nuke (Old)': 55, 
        'Office': 56, 
        'Operation Bravo': 19, 
        'Operation Breakout Weapon': 20, 
        'Operation Broken Fang': 57, 
        'Operation Hydra': 1, 
        'Operation Phoenix Weapon': 60, 
        'Operation Riptide': 58, 
        'Operation Vanguard Weapon': 75, 
        'Operation Wildfire': 76, 
        'Overpass': 59, 
        'Prisma': 62, 
        'Prisma 2': 61, 
        'Recoil': 63, 
        'Revolution': 64, 
        'Revolver': 65, 
        'Rising Sun': 66, 
        'Safehouse': 67, 
        'Shadow': 68, 
        'Shattered Web': 69, 
        'Snakebite': 70, 
        'Spectrum': 72, 
        'Spectrum 2': 71, 
        'St. Marc': 73, 
        'Train (2021)': 6, 
        'Train (Old)': 74, 
        'Vertigo (2021)': 7, 
        'Vertigo (Old)': 2, 
        'Winter Offensive Weapon': 77, 
        'eSports 2013': 35, 
        'eSports 2013 Winter': 38, 
        'eSports 2014 Summer': 37
    };

    const link = `https://skinsmonkey.com/trade`;

    //console.log('gets here0');

    const { width, height } = await initializePage(page, link, timeOut = 75000, wait = false);

    let useless;

    //console.log('gets here1');

    await waitForRandomTimeout(page, 1500, 2500);
    //const totalItems = await fetchItemDetails(page, item, wear, source, 'h3.text-textPrimary.font-medium.sm\\:text-2xl.text-lg', 'h4.text-xl.text-textPrimary', conditionMappings);

    //const otherWearResults = await scrapeOtherWears(page, source);
    //console.log(otherWearResults)

    //advanced filtering
    await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__top > div > div > span:nth-child(2)');
    await waitForRandomTimeout(page, 1000, 2500);

    //await clickButton(page, 'Rarity filter', '');
    //rarity filter
    await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-rarity > div > span');
    await waitForRandomTimeout(page, 1000, 2500);

    //await clickButton(page, 'Restricted', '.trade-filter-option-generic__label [data-rarity="RESTRICTED"]');
    //click rarity
    const rarityUpper = rarity.toUpperCase();
    await page.click(`.trade-filter-option-generic__label [data-rarity="${rarityUpper}"]`);
    await waitForRandomTimeout(page, 1000, 2500);

    //collection filter
    await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection > div > span');
    await waitForRandomTimeout(page, 1000, 2500);

    //open collections
    await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection.expanded > div.trade-collapse__body > div > div.form-multiselect__body > div > div');
    await waitForRandomTimeout(page, 1000, 2500);
    
    //click collection
    const collectionID = monkeyCollectionMap[collection];
    await page.click(`#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection.expanded > div.trade-collapse__body > div > div.select-list > div > div:nth-child(${collectionID}) > div > div > div.trade-filter-collection-item > span`);
    await waitForRandomTimeout(page, 1000, 2500);


    const elementSelector = '#__layout > div > div.trade.main > div > div:nth-child(3) > div.inventory-grid';

    // Wait for the element to be rendered
    await page.waitForSelector(elementSelector);

    // Get the element handle
    const element = await page.$(elementSelector);

    // Get the bounding box of the element
    const boundingBox = await element.boundingBox();

    /*
    if (boundingBox) {
        console.log(`Dimensions and position of the element:`);
        console.log(`Width: ${boundingBox.width}`);
        console.log(`Height: ${boundingBox.height}`);
        console.log(`X (left): ${boundingBox.x}`);
        console.log(`Y (top): ${boundingBox.y}`);
    } else {
        console.log('The bounding box of the element could not be retrieved.');
    }
    */

    await moveAndScroll(page, boundingBox.width, boundingBox.height, moveCount = 5, minScroll = 50, maxScroll = 250, minX = boundingBox.x, minY = boundingBox.y)



    //updatePricesCSV(item, collection, rarity, otherWearResults, source); // update the prices for other wears in the pricesCSV

    const cookieButtonXPath = '/html/body/app-root/mat-sidenav-container/mat-sidenav-content/div[1]/app-header/header-banners/div/cookie-banner/div/div/div/div[2]/button';
    //await acceptCookies(page, cookieButtonXPath);

    //console.log('gets here2');

    const results = await scrapeCombinedItems(page, source, useless, boundingBox.width, boundingBox.height, useless, minX = boundingBox.x, minY = boundingBox.y);
    await waitForRandomTimeout(page, 250, 750);
    //console.log(results)
    
    return results;
}

(async () => {
    stashIDCSV = await readCsv('C:/Users/Kristaps/Desktop/TUP-main/IDS/Stash/stash_ids.csv');
    // Launch the browser
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    //const collection = 'Anubis';
    const collections = ['Revolution'];
    const rarity = 'Restricted';

    const upperRarity = getUpperRarity(rarity, allRarities);

    for (const collection of collections) {

        console.log(`Rarity: ${rarity}`);
        console.log(`Collection: ${collection}`);

        const upperItems = getItemsByCollectionAndRarity(stashIDCSV, collection, upperRarity);

        console.log(upperItems);

        for (const item of upperItems) {
            try {
                const floatValues = await scrapeStash(page, item, collection, upperRarity);
                await waitForRandomTimeout(page, 1500, 3000);
                //itemResults = [...itemResults, ...resultsFromHalo];
            } catch (error) {
                console.error(`Error scraping Stash for item ${item}: ${error}`);
            }
        }

        let itemResults = [];
    
        //const portResults = await scrapePort(page, collection, rarity);

        // /*
        try {
            const portResults = await scrapePort(page, collection, rarity);
            console.log(portResults);
            itemResults = [...itemResults, ...portResults];
        } catch (error) {
            console.error(`Error scraping Port for collection ${collection} at ${rarity}: ${error}`);
        }
        // */
        

        try {
            const dmResults = await scrapeDM(page, collection, rarity);
            console.log(dmResults);
            itemResults = [...itemResults, ...dmResults];
        } catch (error) {
            console.error(`Error scraping DM for collection ${collection} at ${rarity}: ${error}`);
        }


        try {
            const monkeyResults = await scrapeMonkey(page, collection, rarity);
            console.log(monkeyResults);
            itemResults = [...itemResults, ...monkeyResults];
        } catch (error) {
            console.error(`Error scraping Monkey for collection ${collection} at ${rarity}: ${error}`);
        }

        const itemCSVFileName = `Items/${rarity}/${collection}/all_items.csv`;

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
                    console.log(`CSV for ${collection} at ${rarity} file was written successfully`);
                    //console.log('CSV file was written successfully');
                });
        } else {
            console.log(`CSV for ${collection} at ${rarity} not written (empty)`);
        }

        //await waitForRandomTimeout(page, 100, 500);

        //await runPythonScript('./prices_csv_combiner.py', [rarity]);

        await runPythonScript('./csv_comb_n_filt.py', [collection, rarity]);

    }
    //console.log(itemResults);
  
    await waitForRandomTimeout(page, 50000, 100000);
    await browser.close();
})();