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


// rarity and wears and prefixes
const allRarities = ['Consumer', 'Industrial', 'Mil-Spec', 'Restricted', 'Classified', 'Covert'];

const conditionMappings = {
    'Factory New': 'FN',
    'Minimal Wear': 'MW',
    'Field-Tested': 'FT',
    'Well-Worn': 'WW',
    'Battle-Scarred': 'BS'
};

const weaponPrefixes = [
    'Zeus x27', 'CZ75-Auto', 'Desert Eagle', 'Dual Berettas', 'Five-Seven', 'Glock-18', 'P2000', 'P250', 'R8 Revolver', 'Tec-9', 'USP-S',
    'MAC-10', 'MP5-SD', 'MP7', 'MP9', 'PP-Bizon', 'P90', 'UMP-45', 'MAG-7', 'Nova', 'Sawed-Off', 'XM1014', 'M249', 'Negev',
    'AK-47', 'AUG', 'AWP', 'FAMAS', 'G3SG1', 'Galil AR', 'M4A1-S', 'M4A4', 'SCAR-20', 'SG 553', 'SSG 08'
];

function getUpperRarity(rarity, rarities) {
    const index = rarities.indexOf(rarity);

    // Check if the rarity is found and it's not the last element
    if (index !== -1 && index < rarities.length - 1) {
        return rarities[index + 1];
    }

    // Return null or an appropriate value if there's no upper rarity
    return null;
}


// human sim functions
async function waitForRandomTimeout(page, minTimeout, maxTimeout) {
    const timeoutDuration = Math.floor(Math.random() * (maxTimeout - minTimeout + 1)) + minTimeout;
    await page.waitForTimeout(timeoutDuration);
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


// page functions
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


// csv functions
async function readCsv(filePath) {
    try {
        const csvContent = await fs.readFile(filePath, { encoding: 'utf8' });
        return csvContent;  // This is your CSV content
    } catch (error) {
        console.error("Could not read CSV file:", error);
        return null;
    }
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
        MinF: (source === 'A_DM' || source === 'A_Port') ? minFloat : null, // Assign minFloat if source is 'Stash'
        MaxF: (source === 'A_DM' || source === 'A_Port') ? maxFloat : null, // Assign maxFloat if source is 'St
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

function getCurrentTimestamp() {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    return timestamp;
}


// bit&money function to extract name
function processAltText(altText, source) {
    let itemName, conditionAbbr;

    if (source === 'Bit') {
        // Original logic for 'Bit' source
        const parts = altText.split(/ (Minimal Wear|Factory New|Field-Tested|Well-Worn|Battle-Scarred) /);
        let conditionPart = parts.length >= 2 ? parts[1] : null;
        let namePart = parts[0];

        // Find the prefix in the namePart and insert an underscore between the prefix and the rest of the name
        for (const prefix of weaponPrefixes) {
            if (namePart.startsWith(prefix)) {
                namePart = namePart.replace(prefix, `${prefix}_`);
                break; // Exit the loop once the prefix is found and processed
            }
        }

        // Replace spaces with underscores in the namePart
        itemName = namePart.replace(/\s+/g, '_');

        // Abbreviate the condition using the conditionMappings
        conditionAbbr = conditionMappings[conditionPart] || conditionPart;
    } else if (source === 'Money') {
        // Step 1: Remove '/csgo/' & remove anything after the next '/'
        let itemPart = altText.replace(/^\/csgo\//, '').split('/')[0];

        // Step 2: Search for wear and map it to conditionAbbr
        const wearPatterns = {
            'factory-new': 'FN',
            'minimal-wear': 'MW',
            'field-tested': 'FT',
            'well-worn': 'WW',
            'battle-scarred': 'BS'
        };
        Object.entries(wearPatterns).forEach(([pattern, abbreviation]) => {
            if (itemPart.includes(pattern)) {
                conditionAbbr = abbreviation; // Set condition abbreviation
                itemPart = itemPart.replace(pattern, ''); // Remove wear pattern from itemName
                return true; // Break the loop once a match is found
            }
        });

        // Step 3: Find weapon prefix (if any), and capitalize & replace characters in the remaining part
        let matchedPrefix = '';
        let remainingPart = itemPart;

        weaponPrefixes.forEach(prefix => {
            const lowerCasePrefix = prefix.toLowerCase().replace(/ /g, '-');
            if (remainingPart.startsWith(lowerCasePrefix)) {
                matchedPrefix = prefix; // Save the matched prefix
                remainingPart = remainingPart.slice(lowerCasePrefix.length); // Remove the prefix part from the remaining text
            }
        });

        // Capitalize and replace characters in the remaining part (after weapon prefix)
        remainingPart = remainingPart.split('-').map((segment, index) =>
            index === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
        ).join('_');

        remainingPart = remainingPart.replace(/^_+|_+$/g, '');

        const specialCases = {
            'Emphorosaur_S': 'Emphorosaur-S',
            // Add more special cases here if needed
        };

        Object.entries(specialCases).forEach(([original, replacement]) => {
            remainingPart = remainingPart.replace(original, replacement);
        });

        // Combine the preserved weapon prefix with the processed remaining part
        itemName = matchedPrefix + (matchedPrefix && remainingPart ? '_' : '') + remainingPart;

        itemName = itemName.replace(/\s+/g, '_');
    }

    return { itemName, conditionAbbr };
}


async function acceptCookiesByText(page) {
    try {
        // Wait for any button that contains the text 'Accept' or 'Accept All' to be visible on the page
        await page.waitForFunction(
            () => [...document.querySelectorAll('button')].some(button => button.innerText.includes('Accept')),
            { timeout: 5000 }
        );

        // Click the button with the text 'Accept' or 'Accept All'
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const targetButton = buttons.find(button => button.innerText.includes('Accept'));
            if (targetButton) targetButton.click();
        });

        console.log('Cookies accepted using button text.');
    } catch (error) {
        console.error('Error accepting cookies:', error);
    }
}


// item scraper function
async function scrapeCombinedItems(page, source, exchangeRatio, width, height, totalItems = null, minX = 0, minY = 0) {
    const startTime = new Date();
    const seenFloats = new Set();
    // const seenItems = new Set();
    let itemIndex = 1;
    const records = [];

    let lastItemTimeout = 20;
    const totalAllowedTime = 45;
    let lastItemTime = new Date();

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
    } else if (source === 'Bit') {
        floatSelector = 'div.market-items .item-float .float-value';
        priceSelector = 'div.market-items .item-price .amount';
        itemSelector = 'div.market-items .item-name';
        lastItemTimeout = 5;
    } else if (source === 'Money') {
        floatSelector = 'div.actioncard_wrapper__3jY0N .BaseCard_description__31IqW span.Text-module_body-x-sm__A6Pd9.CSGODescription_description__3cUg_'
        priceSelector = 'div.actioncard_wrapper__3jY0N .BaseCard_price__27L2x .price_price__2aKac span.styles_price__1m7op';
        itemSelector = 'div.actioncard_wrapper__3jY0N > a';
        lastItemTimeout = 30;
    }

    let floats, itemAlts;

    await waitForRandomTimeout(page, 100, 500);
    await randomScrollPage(page, 50, 250);
    while (true) {
        try {

            //await randomScrollPage(page, 50, 250);
            // Retrieve values for each visible item using selectors passed as parameters
            //const floats = await page.$$eval(floatSelector, elements => elements.map(el => el.textContent));
            if (source === 'Monkey') {
                floats = await page.$$eval(floatSelector, elements => elements.map(el => el.style.getPropertyValue('--float-value')));
            } else if (source === 'Money') {
                floats = await page.$$eval(floatSelector, elements => elements.map(el => {const match = el.textContent.match(/\b0\.\d+\b/); // Regex to match float values starting with '0.'
                    return match ? match[0] : ''; // Return the match or an empty string if no match is found
                  }));
            } else {
                floats = await page.$$eval(floatSelector, elements => elements.map(el => el.textContent));
            }
            const prices = await page.$$eval(priceSelector, elements => elements.map(el => el.textContent));

            //const floats = await page.$$eval(floatSelector, elements => elements.map(el => el.textContent.trim()));
            //const prices = await page.$$eval(priceSelector, elements => elements.map(el => el.textContent.trim().replace(/[^0-9.]+/g, "")));
            // const names = await page.$$eval(itemSelector, elements => elements.map(el => el.alt.split(' (')[0])); // Assuming the item name is in the alt text of an image
            
            if (source === 'Bit') {
                itemAlts = await page.$$eval(itemSelector, elements => elements.map(el => el.textContent));
            } else if (source === 'Money') {
                itemAlts = await page.$$eval(itemSelector, elements => elements.map(el => el.getAttribute('href')));
            } else {
                itemAlts = await page.$$eval(itemSelector, elements => elements.map(el => el.getAttribute('alt')));
            }
            
            //const conditions = await page.$$eval(conditionSelector, elements => elements.map(el => el.textContent.trim()));
            
            let newItemsAdded = false;
            const timestamp = getCurrentTimestamp();

            floats.forEach((float, index) => {
                if (!seenFloats.has(float)) {
                    const altText = itemAlts[index];
                    //console.log(altText);
                    //if (!altText.includes('StatTrak')) {
                    seenFloats.add(float);
                    //console.log(float);

                    

                    //const float = floats[index].trim();
                    const price = prices[index].trim();
                    //console.log(price);
                    const cleanPrice = parseFloat(price.replace(/[^0-9.]+/g, ""));
                    //const itemIdentifier = `${float}-${cleanPrice}`; // Use both float and cleaned price for uniqueness
                    
                    //const altText = itemAlts[index];
                    let itemName, conditionAbbr;
                    if (source === 'Bit' || source === 'Money') {
                        ({ itemName, conditionAbbr } = processAltText(altText, source));
                    } else {
                        const [fullName, conditionText] = altText.split(' (');
                        itemName = fullName.trim().replace(/ \|\s/g, '_').replace(/ /g, '_');
                        const condition = conditionText.replace(')', '').trim(); // Assuming the condition is at the end within parentheses
                        conditionAbbr = conditionMappings[condition] || condition;
                    }

                    
                    let realFloat, usdPrice;
                    if (source === 'Port') {
                        //realFloat = (parseFloat(float) + 0.00075).toFixed(6);
                        realFloat = parseFloat((parseFloat(float) + 0.0008).toFixed(7));
                        //usdPrice = (parseFloat(cleanPrice) * exchangeRatio).toFixed(6);
                        usdPrice = parseFloat((cleanPrice * exchangeRatio).toFixed(4));
                    } else if (source === 'DM') {
                        realFloat = parseFloat((parseFloat(float) + 0.00003).toFixed(7)); // adding 0.000025 instead would assume that, on average, the real value might be halfway between the displayed value and the next higher value at four decimal places.
                        // 0.000049;
                        usdPrice = cleanPrice;
                    } else if (source === 'Monkey') {
                        cleanFloat = float.replace(/[^0-9.]+/g, "");
                        realFloat = parseFloat(cleanFloat/100); 
                        //usdPrice = (parseFloat(cleanPrice) * 0.65).toFixed(6);
                        usdPrice = parseFloat((cleanPrice / 1.35).toFixed(4));
                    } else if (source === 'Bit') {
                        realFloat = parseFloat((parseFloat(float) + 0.0000008).toFixed(7));
                        usdPrice = cleanPrice;
                    } else if (source === 'Money') {
                        realFloat = parseFloat((parseFloat(float) + 0.00008).toFixed(7));
                        usdPrice = parseFloat((cleanPrice / 1.3).toFixed(4));
                    } else {
                        realFloat = float;
                        usdPrice = cleanPrice;
                    }

                    records.push({
                        index: itemIndex++,
                        price: usdPrice,
                        float: realFloat,
                        condition: conditionAbbr, // Assumes itemConditionAbbr is globally defined or passed in
                        name: itemName, // Assumes itemNameUnd is globally defined or passed in
                        site: source,
                        timestamp: timestamp
                    });
                    console.log(`${itemIndex}: ${itemName} - ${float} (${price}) at ${timestamp}`);
                    newItemsAdded = true;
                    lastItemTime = new Date();
                }
                //}
            });

            
            if (!newItemsAdded) {
                await waitForRandomTimeout(page, 250, 1000);
                //await randomScrollPage(page, 50, 500);
                //await simulateMouseMovements(page, 2, width, height);
                //await moveAndScroll(page, width, height, moveCount = 2, minScroll = 50, maxScroll = 250)
                await moveAndScroll(page, width, height, moveCount = 2, minScroll = 50, maxScroll = 150, minX, minY)
                
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
            await waitForRandomTimeout(page, 100, 500);
        } catch (error) {
            console.error("Error encountered during scrapeCombinedItems: ", error);
            // Optionally, you can decide to break out of the loop after an error
            // or continue to try the next iteration.
            break; // or continue; depending on your desired behavior
        }
    }
    return records;
}


// money function
async function scrapeMoney(page, collection, rarity) {
    const source = 'Money';
    console.log(source);
    let useless;

    //const collectionID = collection.replace(/\s/g, '%20').toLowerCase();

    const bitRarityMap = {
        'Consumer': 1,
        'Industrial': 2,
        'Mil-Spec': 3,
        'Restricted': 4,
        'Classified': 5
    };

    //const rarityID = bitRarityMap[rarity];
    
    const collectionLinkName = collection;

    //const link = `https://dmarket.com/ingame-items/item-list/csgo-skins?category_0=not_stattrak_tm&category_1=not_souvenir&collection=${collectionID}&quality=${rarityID}`;
    const link = `https://cs.money/csgo/trade/?sort=float&order=asc&rarity=${rarity}&isStatTrak=false&isSouvenir=false&collection=The%20${collectionLinkName}%20Collection`;
    //const link = `https://bitskins.com/market/cs2?search={"order":[{"field":"discount","order":"DESC"}],"where":{"category_id":[1],"quality_id":[4]}}`;
    const { width, height } = await initializePage(page, link, timeOut = 75000, wait = false);

    await waitForRandomTimeout(page, 2500, 3500);


    await acceptCookiesByText(page);

    await waitForRandomTimeout(page, 250, 750);


    // get the dimensions of scrolling field
    const elementSelector = '#layout-page-content-area > div > div > div.MediaQueries_desktop__TwhBE.TradePage_full_height__3Vv16 > div > div.TradePage_content__22N7o > div:nth-child(3) > div.bot-listing_container__1LBz1 > div.bot-listing_body__3xI0X';
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


    // change currency to usd if needed
    const currencyLabelSelector = '#layout-page-header > div.MediaQueries_desktop__TwhBE > div > div.Actions_actions__3e1Kp > div.CurrencyDropdown_dropdown__3YsPp > div > div.Dropdown_label__XSjlS > div > div';
    const currencyToSelectSelector = '#USD';
    const currentCurrency = await page.$eval(currencyLabelSelector, el => el.innerText.trim());
    // If the current currency is not '$ USD', click to open the dropdown and then select '$ USD'
    if (currentCurrency !== '$ USD') {
        // Click the currency label to open the dropdown
        await page.click(currencyLabelSelector);

        await waitForRandomTimeout(page, 250, 1250);
        // Wait for the dropdown to open and the '$ USD' option to be available, then click it
        await page.waitForSelector(currencyToSelectSelector, { visible: true });
        await page.click(currencyToSelectSelector);
    }

    await moveAndScroll(page, boundingBox.width, boundingBox.height, moveCount = 1, minScroll = 10, maxScroll = 50, minX = boundingBox.x, minY = boundingBox.y)

    const results = await scrapeCombinedItems(page, source, useless, boundingBox.width, boundingBox.height, useless, minX = boundingBox.x, minY = boundingBox.y);
    await waitForRandomTimeout(page, 250, 750);
    //console.log(results)
    
    return results;
}




(async () => {
    //stashIDCSV = await readCsv('C:/Users/Kristaps/Desktop/TUP-main/IDS/Stash/stash_ids.csv');
    // Launch the browser
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    //const collections = ['Revolution'];
    const collection = 'Revolution';
    const rarity = 'Restricted';

    console.log(`Rarity: ${rarity}`);
    console.log(`Collection: ${collection}`);

    const item = 'MAC-10_Sakkaku';
    console.log(`Item: ${item}`);


    let itemResults = [];

    try {
        const moneyResults = await scrapeMoney(page, collection, rarity);
        //console.log(moneyResults);
        itemResults = [...itemResults, ...moneyResults];
    } catch (error) {
        console.error(`Error scraping Money for ${collection} and ${rarity}: ${error}`);
    }

    console.log(itemResults);
  
    await waitForRandomTimeout(page, 50000, 100000);
    await browser.close();
})();