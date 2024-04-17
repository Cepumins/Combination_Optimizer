const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AnonymizeUA = require('puppeteer-extra-plugin-anonymize-ua');
const UserPreferences = require('puppeteer-extra-plugin-user-preferences');
const BlockResources = require('puppeteer-extra-plugin-block-resources');

// Use the stealth plugin
const stealth = StealthPlugin();
stealth.enabledEvasions.delete('iframe.contentWindow');
//puppeteer.use(StealthPlugin());
puppeteer.use(stealth);

// Anonymize User-Agent
puppeteer.use(AnonymizeUA());

// Set user preferences
puppeteer.use(UserPreferences({
    userPrefs: {
        webkit: {
            webprefs: {
                default_font_size: 16
            }
        }
    }
}));

// Block images, stylesheets, and fonts
/*
puppeteer.use(BlockResources({
    blockedTypes: new Set(['image', 'stylesheet', 'font'])
}));
*/


// */
const fsNormal = require('fs');
const fs = require('fs').promises;
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { parse } = require('csv-parse/sync');
const csv = require('csv-parser');
const { spawn } = require('child_process');
const { createCursor } = require('ghost-cursor');

let haloIDCSV, buffIDCSV, stashIDCSV;
let cursor;


// rarity and wears
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


// python functions
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


async function interceptCanvasFingerprinting(page) {
    await page.evaluateOnNewDocument(() => {
        // Overwrite the CanvasRenderingContext2D prototype's method
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function() {
            const context = getContext.apply(this, arguments);
            if (context && arguments[0] === '2d') {
                // Intercept and modify the canvas context methods here
                const fillRect = context.fillRect;
                context.fillRect = function() {
                    fillRect.apply(this, arguments);
                    console.log('fillRect method intercepted!');
                };
                // Add more method interceptions as needed
            }
            return context;
        };
    });
    console.log('Canvas fingerprinting interception script set to run on new pages.');
}


// human sim functions
/*
async function waitForRandomTimeout(page, minTimeout, maxTimeout) {
    const timeoutDuration = Math.round(Math.random() * (maxTimeout - minTimeout + 1)) + minTimeout;
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
*/

function getRandomWeightedTowardsCenterWithRolls(rolls) {
    //const numRandom = 10; // Increase for a tighter concentration around the mean
    let sum = 0;
    for (let i = 0; i < rolls; i++) {
        sum += Math.random();
    }
    return sum / rolls;
}

/*
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

        //console.log(`Moved to (${(100*x/(width+minX)).toFixed(2)}%, ${(100*y/(height+minY)).toFixed(2)}%, scrolled: ${deltaY})`);
    }
}
*/

async function moveAndScrollWeighted(page, width, height, meanScroll = 50, minX = 0, minY = 0, moveCount = 2) {  // Simulate irregular mouse movements by randomly moving the mouse around within the viewport dimensions
    const timesToMove = Math.round(Math.random() * moveCount + 1);
    let totalScrolled = 0;
    for (let i = 0; i < timesToMove+1; i++) {
        const xCord = Math.round((getRandomWeightedTowardsCenterWithRolls(10)) * width) + minX;
        const yCord = Math.round((getRandomWeightedTowardsCenterWithRolls(10) - 0.1) * height) + minY;
        //await page.mouse.move(x, y, { steps: 5 }); // Move mouse to (x, y) with intermediate steps for smoother movement
        const destination = { x: xCord, y: yCord };
        await cursor.moveTo(destination);

       // await waitForRandomTimeout(page, 10, 100);
       await randomNormalTimeout(page, 50)

        const deltaY = Math.round(getRandomWeightedTowardsCenterWithRolls(3) * 2 * meanScroll + 10);
        await page.mouse.wheel({ deltaY });

        totalScrolled += deltaY;

        //console.log(`Moved to (${(100*x/(width+minX)).toFixed(2)}%, ${(100*y/(height+minY)).toFixed(2)}%, scrolled: ${deltaY})`);
        console.log(`Moved to (${xCord}, ${yCord}) scrolled: ${deltaY})`);
        
    }
    return totalScrolled;
}


// page functions
async function initializePage(page, link, timeOut = 87000, wait = true) {
    const waitOptions = wait ? { waitUntil: 'networkidle0', timeout: timeOut } : { timeout: timeOut };
    await page.goto(link, waitOptions);

    const dimensions = await page.evaluate(() => { // Retrieve the page dimensions
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    });
    //await page.mouse.move(Math.random() * dimensions.width, Math.random() * dimensions.height); // Perform a random starting mouse movement based on the page dimensions
    //await randomScrollPage(page, 50, 250); // Perform a random scroll on the page
    //await simulateMouseMovements(page, 3, dimensions.width, dimensions.height); // Simulate mouse movements across the page based on the page dimensions
    //await moveAndScrollWeighted(page, dimensions.width, dimensions.height)
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
                        buttonBox.x + buttonBox.width / 2 + Math.round(Math.random() * 10) - 5,
                        buttonBox.y + buttonBox.height / 2 + Math.round(Math.random() * 10) - 5,
                        { steps: 10 }
                    );
                    //await waitForRandomTimeout(page, 250, 1000);
                    await randomNormalTimeout(page, 500)
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

async function acceptCookiesByText(page) {
    try {
        // Wait for any button that contains the text 'Accept' or 'Accept All' to be visible on the page
        await page.waitForFunction(
            () => [...document.querySelectorAll('button')].some(
                button => /accept|agree/i.test(button.innerText)
            ),
            { timeout: 5000 }
        );

        // Click the button with the text 'Accept' or 'Accept All'
        const buttonSelector = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const targetButton = buttons.find(button => button.innerText.includes('Accept'));
            if (targetButton) {
                //targetButton.click();
                targetButton.setAttribute('data-target', 'accept-button');
                return 'button[data-target="accept-button"]';
            }
            return null;
        });
        if (buttonSelector) {
            await page.waitForSelector(buttonSelector);
            await cursor.click(buttonSelector);
        }

        console.log('Cookies accepted using button text.');
    } catch (error) {
        console.error('Error accepting cookies:', error);
    }
}

async function randomNormalTimeout(page, meanTimeout) {
    const rolls = 3; // Increase for a tighter concentration around the mean
    let sum = 0;
    for (let i = 0; i < rolls; i++) {
        sum += Math.random();
    }
    const randomNum = (sum / rolls) * 2;

    const timeoutDuration = Math.round(randomNum * meanTimeout + 50);
    console.log(`Waiting for ${timeoutDuration}ms`);
    await page.waitForTimeout(timeoutDuration);
}

async function installMouseHelper(page) {
    await page.evaluateOnNewDocument(() => {
        // Install mouse helper only for pages where you want to see the cursor
        window.addEventListener('DOMContentLoaded', () => {
            const box = document.createElement('puppeteer-mouse-pointer');
            const styleElement = document.createElement('style');
            styleElement.innerHTML = `
            puppeteer-mouse-pointer {
                pointer-events: none;
                position: absolute;
                top: 0;
                z-index: 10000;
                left: 0;
                width: 20px;
                height: 20px;
                background: rgba(255,165,0,0.7);
                border: 1px solid white;
                border-radius: 10px;
                margin-top: -10px;
                margin-left: -10px;
                transition: background .2s, border-radius .2s, border-color .2s;
            }
            puppeteer-mouse-pointer.button-1 {
                transition: none;
                background: rgba(0,0,255,0.9);
                border-color: white;
                border-radius: 4px;
            }
            puppeteer-mouse-pointer.button-2 {
                transition: none;
                border-color: rgba(255,0,0,0.9);
            }
            puppeteer-mouse-pointer.button-3 {
                transition: none;
                border-radius: 4px;
            }
            puppeteer-mouse-pointer.button-4 {
                transition: none;
                border-color: rgba(255,255,0,0.9);
            }
            puppeteer-mouse-pointer.button-5 {
                transition: none;
                border-color: rgba(0,255,0,0.9);
            }`;
            document.head.appendChild(styleElement);
            document.body.appendChild(box);
            document.addEventListener('mousemove', event => {
                box.style.left = event.pageX + 'px';
                box.style.top = event.pageY + 'px';
            }, true);
            document.addEventListener('mousedown', event => {
                box.classList.add('button-' + event.which);
            }, true);
            document.addEventListener('mouseup', event => {
                box.classList.remove('button-' + event.which);
            }, true);
        });
    });
}

async function clickAndWait(page, cursor, selector, text, timeout) {
    try {
        // Wait for the element to be available
        await page.waitForSelector(selector);
        
        // Click the element using the provided cursor
        await cursor.click(selector);
        console.log(`Clicked on: ${text}`);
        
        // Wait for a random duration between minTimeout and maxTimeout
        //await waitForRandomTimeout(page, minTimeout, maxTimeout);
        await randomNormalTimeout(page, timeout);
    } catch (error) {
        console.error(`Error clicking on: ${text}:`, error);
    }
}

async function clickAndWaitX(page, cursor, selector, text, timeout, isXPath = false) {
    try {
        let element;
        if (isXPath) {
            // Wait for the XPath and convert to ElementHandle
            await page.waitForXPath(selector, { timeout: timeout*10 });
            [element] = await page.$x(selector);
        } else {
            // Wait for the CSS selector
            await page.waitForSelector(selector, { timeout: timeout*10 });
            element = await page.$(selector);
        }
        await randomNormalTimeout(page, timeout);

        if (element) {
            // Use the ghost cursor to click on the ElementHandle
            await cursor.click(element);
            console.log(`Clicked on: ${text}`);
        } else {
            console.log(`Element not found: ${text}`);
        }
    } catch (error) {
        console.error(`Error clicking on ${text}: `, error);
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
        Collection: collection.replace(/ /g, '_'),
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

/*
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
*/

function getCurrentTimestamp() {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    return timestamp;
}


// item scraper functions
async function changeItemSorting(page, source, currentSort) {
    let newSort;
    try {
        console.log('gets to changing function');
        
        /*
        let cursorX, cursorY;
        const { width: pageWidth, height: pageHeight } = await page.evaluate(() => {
            return {
                width: window.innerWidth,
                height: window.innerHeight
            };
        });
        
        ({cursorX, cursorY} = await simulateMouseMovements(page, 1, pageWidth, pageHeight));
        console.log(`cursorX: ${cursorX}, cursorY: ${cursorY}`);
        */
        //cursor = createCursor(page);
        //console.log('creates cursor');
        //await waitForRandomTimeout(page, 500, 2500);  // adjust the timeout according to the response time of the website
        await randomNormalTimeout(page, 250);

        if (source === 'Bit') {
            // Click the sort dropdown to open it
            const sortingButtonSelector = '#market > div.items-content > div.content-bar.main > div.btns-row.btns-ip.flex > div.dropdown.market-sorting > button';
            //await page.waitForSelector(sortingButtonSelector);
            //await cursor.click(sortingButtonSelector);
            //console.log('Selected sorter');
            //await waitForRandomTimeout(page, 500, 2500); 
            await clickAndWait(page, cursor, sortingButtonSelector, 'sorting button', 1000);



            if (currentSort === 'default') {
                // Open the type of sorting dropdown
                const sortingDropdownSelector = 'div#vs1__combobox.vs__dropdown-toggle';
                //await page.waitForSelector(sortingDropdown);
                //await cursor.click(sortingDropdown);
                //console.log('Opened sorter types');
                //await waitForRandomTimeout(page, 150, 1500);
                await clickAndWait(page, cursor, sortingDropdownSelector, 'sorting dropdown', 500);

                // Select 'Float' option from the dropdown
                //({cursorX, cursorY} = await humanLikeMouseMove(page, 901, 699, cursorX, cursorY));
                //await page.click('li#vs1__option-4.vs__dropdown-option'); // Selector for 'Float'
                const floatSelector = 'li#vs1__option-4.vs__dropdown-option';
                //await page.waitForSelector(floatSelector);
                //await cursor.click(floatSelector);
                //console.log('Selected floats order');
                //await waitForRandomTimeout(page, 150, 1500);
                await clickAndWait(page, cursor, floatSelector, 'float from dropdown', 500);

                // Open the order direction dropdown (Lowest First/ Highest First)
                //({cursorX, cursorY} = await humanLikeMouseMove(page, 1066, 567, cursorX, cursorY));
                //await page.click('div#vs2__combobox.vs__dropdown-toggle');
                const orderDropdownSelector = 'div#vs2__combobox.vs__dropdown-toggle';
                //await page.waitForSelector(orderDropdown);
                //await cursor.click(orderDropdown);
                //console.log('Opened direction dropdown');
                //await waitForRandomTimeout(page, 150, 1500);
                await clickAndWait(page, cursor, orderDropdownSelector, 'order dropdown', 500);

                // Select 'Lowest first' option
                //({cursorX, cursorY} = await humanLikeMouseMove(page, 1087, 602, cursorX, cursorY));
                //await page.click('li#vs2__option-0.vs__dropdown-option'); // Selector for 'Lowest first'
                const lowestFirstSelector = 'li#vs2__option-0.vs__dropdown-option';
                //await page.waitForSelector(lowestFirst);
                //await cursor.click(lowestFirst);
                //console.log('Selected lowest first');
                //await waitForRandomTimeout(page, 150, 1500);
                await clickAndWait(page, cursor, lowestFirstSelector, 'lowest first (ascending)', 500);

                newSort = 'float';
            } else if (currentSort === 'float') {
                const sortingDropdownSelector = 'div#vs3__combobox.vs__dropdown-toggle';
                await clickAndWait(page, cursor, sortingDropdownSelector, 'sorting dropdown', 500);

                const discountSelector = 'li#vs3__option-2.vs__dropdown-option';
                await clickAndWait(page, cursor, discountSelector, 'discount from dropdown', 500);

                newSort = 'discount';
            } else if (currentSort === 'discount') {
                const sortingDropdownSelector = 'div#vs5__combobox.vs__dropdown-toggle';
                await clickAndWait(page, cursor, sortingDropdownSelector, 'sorting dropdown', 500);

                const priceSelector = 'li#vs5__option-0.vs__dropdown-option';
                await clickAndWait(page, cursor, priceSelector, 'price from dropdown', 500);

                const orderDropdownSelector = 'div#vs6__combobox.vs__dropdown-toggle';
                await clickAndWait(page, cursor, orderDropdownSelector, 'order dropdown', 500);

                const lowestFirstSelector = 'li#vs6__option-0.vs__dropdown-option';
                await clickAndWait(page, cursor, lowestFirstSelector, 'lowest first (ascending)', 500);

                newSort = 'price';
            } else {
                newSort = 'broken';
            }

            // Click the Apply button to apply the sorting
            //({cursorX, cursorY} = await humanLikeMouseMove(page, 1084, 670, cursorX, cursorY));
            //await page.click('button.btn.btn-primary'); // Simplified selector for the Apply button
            const applyButtonSelector = '#market .items-content .content-bar.main .btns-row.btns-ip.flex .dropdown.active.market-sorting .body.default .actions button.btn.btn-primary';
            //await page.waitForSelector(applyButtonSelector);
            //await cursor.click(applyButtonSelector);
            //console.log('Applied changes');
            //await waitForRandomTimeout(page, 500, 2500); // Final wait to ensure application of settings
            await clickAndWait(page, cursor, applyButtonSelector, 'apply changes', 750);

            const closeSorterSelector = '#market .dropdown.active.market-sorting .btn-close';
            await clickAndWait(page, cursor, closeSorterSelector, 'closed sorter', 500);
        } 
        else if (source === 'Money') {
            const sortingDropdownSelector = 'div.bot-listing_header__2VZJJ button#downshift-1-toggle-button';
            await clickAndWait(page, cursor, sortingDropdownSelector, 'sorting dropdown', 1000);

            if (currentSort === 'default') {
                const floatSelector = 'ul.csm_ui__options_list__05cf7 li#downshift-1-item-5';
                await clickAndWait(page, cursor, floatSelector, 'float ascending order', 750);
                newSort = 'float';
            } else if (currentSort === 'float') {
                const priceSelector = 'ul.csm_ui__options_list__05cf7 li#downshift-1-item-3';
                await clickAndWait(page, cursor, priceSelector, 'price ascending order', 750);
                newSort = 'price';
            }
        }
        else if (source === 'Monkey') {
            const sortingDropdownSelector = '#__layout > div > div.trade.main > div > div:nth-child(3) div.form-select__body';
            await clickAndWait(page, cursor, sortingDropdownSelector, 'sorting dropdown', 1000);

            if (currentSort === 'default') {
                const floatSelector = '#__layout > div > div.trade.main > div > div:nth-child(3) > div.inventory-toolbar > div.form-item.form-select.inventory-toolbar-select.inventory-toolbar-sort.trailing.active.lite > div.select-list > div:nth-child(4)';
                await clickAndWait(page, cursor, floatSelector, 'float ascending order', 750);
                newSort = 'float';
            } else if (currentSort === 'float') {
                const priceSelector = '#__layout > div > div.trade.main > div > div:nth-child(3) > div.inventory-toolbar > div.form-item.form-select.inventory-toolbar-select.inventory-toolbar-sort.trailing.active.lite > div.select-list > div:nth-child(2)';
                await clickAndWait(page, cursor, priceSelector, 'price ascending order', 750);
                newSort = 'price';
            }
        }
        else if (source === 'Port') {
            const sortingDropdownSelector = '#content > div > div.CatalogPage-content > div.CatalogPage-header > div > div.CatalogHeader-right > div.CatalogHeader-sort > div';
            await clickAndWait(page, cursor, sortingDropdownSelector, 'sorting dropdown', 1000);

            if (currentSort === 'default') {
                const floatSelector = '#content > div > div.CatalogPage-content > div.CatalogPage-header > div > div.CatalogHeader-right > div.CatalogHeader-sort > div > div > div:nth-child(7)';
                await clickAndWait(page, cursor, floatSelector, 'float ascending order', 750);
                newSort = 'float';
            } else if (currentSort === 'float') {
                const discountSelector = '#content > div > div.CatalogPage-content > div.CatalogPage-header > div > div.CatalogHeader-right > div.CatalogHeader-sort > div > div > div:nth-child(3)';
                await clickAndWait(page, cursor, discountSelector, 'discount order', 750);
                newSort = 'discount';
            } else if (currentSort === 'discount') {
                const priceSelector = '#content > div > div.CatalogPage-content > div.CatalogPage-header > div > div.CatalogHeader-right > div.CatalogHeader-sort > div > div > div:nth-child(5)';
                await clickAndWait(page, cursor, priceSelector, 'price ascending order', 750);
                newSort = 'price';
            }
        }
        else if (source === 'DM') {
            const sortingDropdownSelector = 'sort-items .o-select__current';
            //const sortingDropdownSelector = 'body > app-root > mat-sidenav-container > mat-sidenav-content > exchange > div > div > market-side > div > filters > div > div > div:nth-child(6)';
            
            await clickAndWait(page, cursor, sortingDropdownSelector, 'sorting dropdown', 1000);
            
            const baseSelector = 'div.mat-mdc-menu-content.ng-tns-c185672549-5';
            if (currentSort === 'default') {
                //const newestSelector = `${baseSelector} > button:nth-child(4)`;
                //const newestSelector = '#mat-menu-panel-1 > div > button:nth-child(4)';
                //await clickAndWait(page, cursor, newestSelector, 'newest order', 750);
                const newestSelector = '//button[span[contains(text(), "Date: Newest First")]]';
                await clickAndWaitX(page, cursor, newestSelector, 'newest order', 750, true);
                newSort = 'newest';
            } else if (currentSort === 'newest') {
                //const discountSelector = `${baseSelector} > button:nth-child(3)`;
                //const discountSelector = '#cdk-overlay-3 #mat-menu-panel-1 > div > button:nth-child(3)';
                //await clickAndWait(page, cursor, discountSelector, 'discount order', 750);
                const discountSelector = '//button[span[contains(text(), "Best Discount")]]';
                await clickAndWaitX(page, cursor, discountSelector, 'discount order', 750, true);
                newSort = 'discount';
            } else if (currentSort === 'discount') {
                //const priceSelector = `${baseSelector} > button:nth-child(6)`;
                //const priceSelector = '#cdk-overlay-3 #mat-menu-panel-1 > div > button:nth-child(6)';
                //await clickAndWait(page, cursor, priceSelector, 'price ascending order', 750);
                const priceSelector = '//button[span[contains(text(), "Price: Lowest First")]]';
                await clickAndWaitX(page, cursor, priceSelector, 'price ascending order', 750, true);
                newSort = 'price';
            }
        }

        
        console.log(`Changed sort order to ${newSort} for ${source}`);
        //return newSort;
    } catch (error) {
        console.error(`Error changing sort order for ${source}:`, error);
        //return 'broken';
        newSort = 'broken';
    }
    return newSort;
}

async function scrapeCombinedItems(page, source, exchangeRatio, width, height, totalItems = null, minX = 0, minY = 0) {
    const startTime = new Date();
    const seenFloats = new Set();
    // const seenItems = new Set();
    let itemIndex = 1;
    const records = [];
    let sortOrder = 'default';
    let scrolledTimes = 0;
    let scrolledAmount = 0;
    let scrolledTotalAmount = 0;

    const baseItemTimeout = 5;
    let currentItemTimeout = baseItemTimeout;
    //let aditionalTime = 5;
    const totalAllowedTime = 87;
    let lastItemTime = new Date();

    let floatSelector, priceSelector, itemSelector;
    if (source === 'Port') {
        floatSelector = '.ItemPreview-wear .WearBar-value';
        priceSelector = '.ItemPreview-priceValue .Tooltip-link';
        itemSelector = '.ItemPreview-itemImage img';
        //lastItemTimeout = 20;
        //let aditionalTime = 20;
    } else if (source === 'DM') {
        floatSelector = '.o-qualityChart__infoValue span';
        priceSelector = '.c-asset__priceNumber';
        itemSelector = '.c-asset__img';
        scrolledTimes = 1;
        //lastItemTimeout = 20;
    } else if (source === 'Monkey') {
        floatSelector = '.item-float.item-card__float';
        priceSelector = '.item-price.item-card__price';
        itemSelector = '.item-image.item-card__image';
    } else if (source === 'Bit') {
        floatSelector = 'div.market-items .item-float .float-value';
        priceSelector = 'div.market-items .item-price .amount';
        itemSelector = 'div.market-items .item-name';
    } else if (source === 'Money') {
        floatSelector = 'div.actioncard_wrapper__3jY0N .BaseCard_description__31IqW span.Text-module_body-x-sm__A6Pd9.CSGODescription_description__3cUg_'
        priceSelector = 'div.actioncard_wrapper__3jY0N .BaseCard_price__27L2x .price_price__2aKac span.styles_price__1m7op';
        itemSelector = 'div.actioncard_wrapper__3jY0N > a';
        //lastItemTimeout = 30;
    }

    let floats, prices, itemAlts;

    //await randomScrollPage(page, 50, 250);
    while (true) {
        try {
            // floats
            if (source === 'Monkey') {
                floats = await page.$$eval(floatSelector, elements => elements.map(el => el.style.getPropertyValue('--float-value')));
            } else if (source === 'Money') {
                floats = await page.$$eval(floatSelector, elements => elements.map(el => {const match = el.textContent.match(/\b0\.\d+\b/); // Regex to match float values starting with '0.'
                    return match ? match[0] : ''; // Return the match or an empty string if no match is found
                  }));
            } else {
                floats = await page.$$eval(floatSelector, elements => elements.map(el => el.textContent));
            }

            // prices
            if (source === 'Bit') {
                prices = await page.evaluate(() => {
                    const items = Array.from(document.querySelectorAll('div.market-items > div')); // Select each item container
                    return items.map(item => {
                        const priceElement = item.querySelector('.item-price.flex .price .amount'); // Select the actual price within each item
                        return priceElement ? priceElement.textContent.trim() : null; // Return the price text, ensuring it exists
                    }).filter(price => price !== null); // Filter out any null values if the price wasn't found
                });
            } else {
                prices = await page.$$eval(priceSelector, elements => elements.map(el => el.textContent));
            }

            // itemAlts
            if (source === 'Bit') {
                itemAlts = await page.$$eval(itemSelector, elements => elements.map(el => el.textContent));
            } else if (source === 'Money') {
                itemAlts = await page.$$eval(itemSelector, elements => elements.map(el => el.getAttribute('href')));
            } else {
                itemAlts = await page.$$eval(itemSelector, elements => elements.map(el => el.getAttribute('alt')));
            }
            
            let newItemsAdded = false;
            const timestamp = getCurrentTimestamp();

            floats.forEach((float, index) => {
                if (!seenFloats.has(float)) {

                    const altText = itemAlts[index];
                    let validItem = false;

                    if (source === 'Monkey') {
                        if (!/stattrak/i.test(altText)) {
                            // Scenario 1: 'monkey' source and no 'StatTrak' in altText
                            validItem = true;
                            //console.log('Condition met for adding float from "monkey" source without "StatTrak" in alt text.');
                        } else {
                            // Scenario 2: 'monkey' source and 'StatTrak' in altText
                            //console.log('Condition not met. "StatTrak" present in alt text for "monkey" source.');
                        }
                    } else {
                        // Scenario 3: Any other source
                        validItem = true;
                        //console.log('Condition met for adding float from source other than "monkey".');
                    }

                    // if source = 'monkey' then if altText doesnt include 'StatTrak' we only add it to seenFloats, if its other source we dont check the text
                    
                    if (validItem) {
                        seenFloats.add(float);
                        
                        const price = prices[index].trim();
                        const cleanPrice = price.replace(/[^0-9.]+/g, "");

                        let itemName, conditionAbbr;
                        if (source === 'Bit' || source === 'Money') {
                            ({ itemName, conditionAbbr } = processAltText(altText, source));
                        } else {
                            const [fullName, conditionText] = altText.split(' (');
                            itemName = fullName.trim().replace(/ \|\s/g, '_').replace(/ /g, '_');
                            const condition = conditionText.replace(')', '').trim();
                            conditionAbbr = conditionMappings[condition] || condition;
                        }
                        
                        let realFloat, usdPrice;
                        if (source === 'Port') {
                            //realFloat = (parseFloat(float) + 0.00075).toFixed(6);
                            realFloat = parseFloat((parseFloat(float) + 0.0008).toFixed(7));
                            //usdPrice = (parseFloat(cleanPrice) * exchangeRatio).toFixed(6);
                            usdPrice = parseFloat((parseFloat(cleanPrice) * exchangeRatio).toFixed(4));
                        } else if (source === 'DM') {
                            realFloat = parseFloat((parseFloat(float) + 0.00003).toFixed(7)); // adding 0.000025 instead would assume that, on average, the real value might be halfway between the displayed value and the next higher value at four decimal places.
                            // 0.000049;
                            usdPrice = parseFloat(cleanPrice);
                        } else if (source === 'Monkey') {
                            cleanFloat = float.replace(/[^0-9.]+/g, "");
                            realFloat = parseFloat(cleanFloat/100); 
                            //usdPrice = (parseFloat(cleanPrice) * 0.65).toFixed(6);
                            usdPrice = (parseFloat(cleanPrice) / 1.35).toFixed(4);
                        } else if (source === 'Bit') {
                            realFloat = parseFloat((parseFloat(float) + 0.0000008).toFixed(7));
                            usdPrice = parseFloat(cleanPrice);
                        } else if (source === 'Money') {
                            realFloat = parseFloat((parseFloat(float) + 0.00008).toFixed(7));
                            usdPrice = (parseFloat(cleanPrice) / 1.3).toFixed(4);
                        } else {
                            realFloat = float;
                            usdPrice = cleanPrice;
                        }

                        console.log(`${itemIndex}: ${itemName} - ${float} (${price}) at ${timestamp}`);
                        records.push({
                            index: itemIndex++,
                            price: usdPrice,
                            float: realFloat,
                            condition: conditionAbbr, // Assumes itemConditionAbbr is globally defined or passed in
                            name: itemName, // Assumes itemNameUnd is globally defined or passed in
                            site: source,
                            timestamp: timestamp
                        });
                        newItemsAdded = true;

                        thisItemTime = new Date();
                        //timeoutSaved = lastItemTime - thisItemTime + aditionalTime;

                        //timeToGiftNext = Math.min(aditionalTime, timeoutSaved);
                        //lastItemTime = thisItemTime;
                        lastItemTime = new Date();
                    }
                }
            });

            //let itemTimeout = aditionalTime + Math.log(itemIndex+1) + timeToGiftNext;
            currentItemTimeout = baseItemTimeout + Math.log(itemIndex+1);

            if (!newItemsAdded) {
                //await randomScrollPage(page, 50, 500);
                //await simulateMouseMovements(page, 2, width, height);
                //await moveAndScroll(page, width, height, moveCount = 2, minScroll = 50, maxScroll = 250)
                //await moveAndScroll(page, width, height, moveCount = 2, minScroll = 50, maxScroll = 250, minX, minY)
                
                if (new Date() - lastItemTime > (currentItemTimeout*1000)) {
                    console.log(`${itemIndex} items processed`);
                    console.log(`No new items found in the last ${currentItemTimeout.toFixed(2)}s, exiting..`);
                    break;
                }

                if (source === 'DM') {
                    const popUpSelector = '#mat-mdc-dialog-0 > div > div > auth-dialog > div > div.c-authDialog__header > button';
                    const elementExists = await page.waitForSelector(popUpSelector, { visible: true, timeout: 500 }).catch(e => false);
                    if (elementExists) {
                        console.log('DM Source - Pop up element found');
                        //await randomNormalTimeout(page, 300);
                        //await cursor.click(popUpSelector);
                        await clickAndWait(page, cursor, popUpSelector, 'closed popup', 750);
                        console.log('DM Source - Click performed on the pop up');
                    }
                }


                if (sortOrder === 'price') {
                    console.log("Proceeding with price sort order.");
                    //await moveAndScroll(page, width, height, moveCount = 2, minScroll = 50, maxScroll = 150, minX, minY)
                    await moveAndScrollWeighted(page, width, height, meanScroll = 100, minX, minY, moveCount = 3);
                } else if (sortOrder === 'broken') {
                    console.log('something has gone wrong in the changing order function');
                } else {

                    await randomNormalTimeout(page, 300);
                    if (scrolledTimes < 2) {
                        scrolledTimes++;
                        //await moveAndScroll(page, width, height, moveCount = 2, minScroll = 50, maxScroll = 150, minX, minY)
                        scrolledAmount = await moveAndScrollWeighted(page, width, height, meanScroll = 100, minX, minY, moveCount = 2);
                        //scrolledTotalAmount += scrolledAmount;
                        scrolledTotalAmount = await page.evaluate(() => {return window.scrollY;});
                        //console.log(`Total scrolled pixels: ${scrolledTotalAmount}`);
                    }
                    else {
                        while (scrolledTotalAmount > 0) {
                            scrolledAmount = await moveAndScrollWeighted(page, width, height, meanScroll = -100, minX, minY, moveCount = 5);
                            //scrolledTotalAmount += scrolledAmount;
                            scrolledTotalAmount = await page.evaluate(() => {return window.scrollY;});
                            //console.log(`Total scrolled pixels: ${scrolledTotalAmount}`);
                        }
                        await randomNormalTimeout(page, 250);
                        
                        sortOrder = await changeItemSorting(page, source, sortOrder);
                        //await waitForRandomTimeout(page, 2000, 5000);
                        scrolledTimes = -3;
                        await randomNormalTimeout(page, 2500);
                    }
                    
                    //await waitForRandomTimeout(page, 100, 500);


                    lastItemTime = new Date();
                }


                //console.log(`Current timeout: ${itemTimeout}`);
                console.log(`No new items found, current timer: ${((new Date() - lastItemTime)/1000).toFixed(2)} (timeout - ${currentItemTimeout.toFixed(2)}), checking again...`);
            }
            if (new Date() - startTime > (totalAllowedTime*1000)) {
                console.log(`${itemIndex} items processed`);
                console.log(`Timeout (${totalAllowedTime}s) reached`);
                break;
            }
            //await waitForRandomTimeout(page, 200, 1000);
            await randomNormalTimeout(page, 500);
        } catch (error) {
            console.error("Error encountered during scrapeCombinedItems: ", error);
            // Optionally, you can decide to break out of the loop after an error
            // or continue to try the next iteration.
            break; // or continue; depending on your desired behavior
        }
    }
    return records;
}

/* // stash functions
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
*/

// analyst determine possible wears from floats
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

// analyst function
async function scrapeAnalyst(page, item, collection, rarity) {
    console.log('');
    const source = 'Analyst';
    console.log(source);

    let useless;

    const itemLinkName = item.toLowerCase().replace('_', '-');
    const link = `https://csgo.steamanalyst.com/skin/${itemLinkName}`;
    const { width, height } = await initializePage(page, link, timeOut = 30000);

    //await waitForRandomTimeout(page, 1000, 2500);
    await randomNormalTimeout(page, 1500)

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
    updatePricesCSV(item, collection, rarity, wearDMResults, 'A_DM', getCurrentTimestamp(), floatValues.min_float, floatValues.max_float);

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

    updatePricesCSV(item, collection, rarity, wearPortResults, 'A_Port', getCurrentTimestamp(), floatValues.min_float, floatValues.max_float);

    return floatValues;
}

// port function
async function scrapePort(page, collection, rarity) {
    console.log('');
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

    //const link = `https://skinport.com/market?sort=percent&order=desc&stattrak=0&souvenir=0&rarity=${rarityID}&collection=${id}`;
    const link = `https://skinport.com/market?stattrak=0&souvenir=0&rarity=${rarityID}&collection=${id}`;

    const { width, height } = await initializePage(page, link, timeOut = 75000);

    let useless;

    //await waitForRandomTimeout(page, 250, 750);
    await randomNormalTimeout(page, 500);

    const cookieButtonXPath = '//*[@id="root"]/div[3]/div/div[2]/button[1]/div';
    await acceptCookies(page, cookieButtonXPath);
    //await acceptCookiesByText(page);

    await randomNormalTimeout(page, 500);

    const eurusd = 1.08;

    const results = await scrapeCombinedItems(page, source, eurusd, width, height, useless);
    //await waitForRandomTimeout(page, 250, 750);
    await randomNormalTimeout(page, 500);
    //console.log(results)
    
    return results;
}

// dm function
async function scrapeDM(page, collection, rarity) {
    console.log('');
    const source = 'DM';
    console.log(source);
    let useless;

    //const collectionID = collection.replace(/\s/g, '%20').toLowerCase();
    const collectionName = collection.replace(/ &/g, '').toLowerCase();
    const collectionID = encodeURIComponent(collectionName);

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
    const { width, height } = await initializePage(page, link, timeOut = 75000, wait = false);

    //await waitForRandomTimeout(page, 1500, 2500);
    await randomNormalTimeout(page, 500);

    const cookieButtonXPath = '/html/body/app-root/mat-sidenav-container/mat-sidenav-content/div[1]/app-header/header-banners/div/cookie-banner/div/div/div/div[2]/button';
    await acceptCookies(page, cookieButtonXPath);
    //await acceptCookiesByText(page);
    await randomNormalTimeout(page, 500);

    const closeTutorial = '#cdk-overlay-0 > div > div > mat-icon';
    await clickAndWait(page, cursor, closeTutorial, 'closed item filter', 500);



    const closeItemFilter = 'body > app-root > mat-sidenav-container > mat-sidenav-content > exchange > div > div > market-side > div > filters > div > div > filters-area > div > div.c-filtersArea__header > button';
    await clickAndWait(page, cursor, closeItemFilter, 'closed item filter', 750);

    
    const closeLiveFeed = 'body > app-root > mat-sidenav-container > mat-sidenav-content > exchange > div > div > market-side > div > market-inventory > live-feed-desktop > div > div > button';
    await clickAndWait(page, cursor, closeLiveFeed, 'closed live feed', 750);

    const results = await scrapeCombinedItems(page, source, useless, width, height, useless);
    //await waitForRandomTimeout(page, 250, 750);
    await randomNormalTimeout(page, 500);
    //console.log(results)
    
    return results;
}

// monkey function
async function scrapeMonkey(page, collection, rarity) {
    console.log('');
    const source = 'Monkey';
    console.log(source);
    let useless;

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
    const { width, height } = await initializePage(page, link, timeOut = 75000, wait = false);

    //await waitForRandomTimeout(page, 1500, 2500);
    //const cursor = createCursor(page);
    await randomNormalTimeout(page, 1000);

    //advanced filtering
    //await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__top > div > div > span:nth-child(2)');
    //await waitForRandomTimeout(page, 1000, 2500);
    const advancedFilteringSelector = '#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__top > div > div > span:nth-child(2)';
    //await clickAndWait(cursor, advancedFilteringSelector, 'advanced filtering', 500, 2500, page);
    await clickAndWait(page, cursor, advancedFilteringSelector, 'advanced filtering', 1250);

    //await clickButton(page, 'Rarity filter', '');
    //rarity filter
    //await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-rarity > div > span');
    //await waitForRandomTimeout(page, 1000, 2500);
    const rarityFilterSelector = '#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-rarity > div > span';
    //await clickAndWait(cursor, rarityFilterSelector, 'rarity selector', 500, 2500, page);
    await clickAndWait(page, cursor, rarityFilterSelector, 'rarity selector', 1000);

    //await clickButton(page, 'Restricted', '.trade-filter-option-generic__label [data-rarity="RESTRICTED"]');
    //click rarity
    const rarityUpper = rarity.toUpperCase();
    //await page.click(`.trade-filter-option-generic__label [data-rarity="${rarityUpper}"]`);
    //await waitForRandomTimeout(page, 1000, 2500);
    const upperRaritySelector = `.trade-filter-option-generic__label [data-rarity="${rarityUpper}"]`;
    //await clickAndWait(cursor, upperRaritySelector, `selected ${rarityUpper}`, 500, 2500, page);
    await clickAndWait(page, cursor, upperRaritySelector, `selected ${rarityUpper}`, 750);

    //collection filter
    //await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection > div > span');
    //await waitForRandomTimeout(page, 1000, 2500);
    const collectionFilterSelector = '#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection > div > span';
    //await clickAndWait(cursor, collectionFilterSelector, 'opened collections filtering', 500, 2500, page);
    await clickAndWait(page, cursor, collectionFilterSelector, 'opened collections filtering', 1000);

    //open collections
    //await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection.expanded > div.trade-collapse__body > div > div.form-multiselect__body > div > div');
    //await waitForRandomTimeout(page, 1000, 2500);
    const collectionDropdownSelector = '#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection.expanded > div.trade-collapse__body > div > div.form-multiselect__body > div > div'
    //await clickAndWait(cursor, collectionDropdownSelector, 'opened collections dropdown', 500, 2500, page);
    await clickAndWait(page, cursor, collectionDropdownSelector, 'opened collections dropdown', 750);
    
    //click collection
    //await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection.expanded > div.trade-collapse__body > div > div.select-list > div > div:nth-child(10) > div > div > div.trade-filter-collection-item > span');
    //await waitForRandomTimeout(page, 1000, 2500);
    const collectionID = monkeyCollectionMap[collection];
    const collectionSelector = `#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection.expanded > div.trade-collapse__body > div > div.select-list > div > div:nth-child(${collectionID}) > div > div > div.trade-filter-collection-item > span`;
    //await clickAndWait(cursor, collectionSelector, `selected collection ${collection}`, 500, 2500, page);
    await clickAndWait(page, cursor, collectionSelector, `selected collection ${collection}`, 750);


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

    //await moveAndScroll(page, boundingBox.width, boundingBox.height, moveCount = 5, minScroll = 50, maxScroll = 250, minX = boundingBox.x, minY = boundingBox.y)

    //updatePricesCSV(item, collection, rarity, otherWearResults, source); // update the prices for other wears in the pricesCSV

    //const cookieButtonXPath = '/html/body/app-root/mat-sidenav-container/mat-sidenav-content/div[1]/app-header/header-banners/div/cookie-banner/div/div/div/div[2]/button';
    //await acceptCookies(page, cookieButtonXPath);

    const results = await scrapeCombinedItems(page, source, useless, boundingBox.width, boundingBox.height, useless, minX = boundingBox.x, minY = boundingBox.y);
    //await waitForRandomTimeout(page, 250, 750);
    await randomNormalTimeout(page, 500);
    //console.log(results)
    
    return results;
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

// bit function
async function scrapeBit(page, item, collection, rarity) {
    console.log('');
    const source = 'Bit';
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

    const rarityID = bitRarityMap[rarity];
    
    const itemLinkName = item.toLowerCase().replace(/[_-]/g, '+');

    //const link = `https://dmarket.com/ingame-items/item-list/csgo-skins?category_0=not_stattrak_tm&category_1=not_souvenir&collection=${collectionID}&quality=${rarityID}`;
    //const link = `https://bitskins.com/market/cs2?search={"order":[{"field":"discount","order":"DESC"}],"where":{"category_id":[1],"quality_id":[4]}}`;
    //const link = `https://bitskins.com/market/cs2?search={"order":[{"field":"discount","order":"DESC"}],"where":{"category_id":[1],"quality_id":[${rarityID}],"skin_name":"${itemLinkName}"}}`;
    const link = `https://bitskins.com/market/cs2?search={"where":{"category_id":[1],"quality_id":[${rarityID}],"skin_name":"${itemLinkName}"}}`;
    const { width, height } = await initializePage(page, link, timeOut = 75000, wait = false);

    //await waitForRandomTimeout(page, 1500, 2500);
    await randomNormalTimeout(page, 1500);

    const cookieButtonXPath = '/html/body/app-root/mat-sidenav-container/mat-sidenav-content/div[1]/app-header/header-banners/div/cookie-banner/div/div/div/div[2]/button';
    //await acceptCookies(page, cookieButtonXPath);

    const results = await scrapeCombinedItems(page, source, useless, width, height, useless);
    //await waitForRandomTimeout(page, 50, 300);
    //console.log(results)
    
    return results;
}

// money function
async function scrapeMoney(page, collection, rarity) {
    console.log('');
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
    
    const collectionLinkName = encodeURIComponent(collection);

    //const link = `https://dmarket.com/ingame-items/item-list/csgo-skins?category_0=not_stattrak_tm&category_1=not_souvenir&collection=${collectionID}&quality=${rarityID}`;
    //const link = `https://cs.money/csgo/trade/?sort=float&order=asc&rarity=${rarity}&isStatTrak=false&isSouvenir=false&collection=The%20${collectionLinkName}%20Collection`;
    //const link = `https://bitskins.com/market/cs2?search={"order":[{"field":"discount","order":"DESC"}],"where":{"category_id":[1],"quality_id":[4]}}`;
    const link = `https://cs.money/csgo/trade/?rarity=${rarity}&isStatTrak=false&isSouvenir=false&collection=The%20${collectionLinkName}%20Collection`;
    const { width, height } = await initializePage(page, link, timeOut = 75000, wait = false);

    //await waitForRandomTimeout(page, 2500, 3500);
    await randomNormalTimeout(page, 2000);

    await acceptCookiesByText(page);

    //await waitForRandomTimeout(page, 250, 750);
    await randomNormalTimeout(page, 500);

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
       // await page.click(currencyLabelSelector);
       await cursor.click(currencyLabelSelector);

        //await waitForRandomTimeout(page, 250, 1250);
        await randomNormalTimeout(page, 500);
        // Wait for the dropdown to open and the '$ USD' option to be available, then click it
        await page.waitForSelector(currencyToSelectSelector, { visible: true });
        //await page.click(currencyToSelectSelector);
        await cursor.click(currencyToSelectSelector);
    }

    //await moveAndScroll(page, boundingBox.width, boundingBox.height, moveCount = 1, minScroll = 10, maxScroll = 50, minX = boundingBox.x, minY = boundingBox.y)

    const results = await scrapeCombinedItems(page, source, useless, boundingBox.width, boundingBox.height, useless, minX = boundingBox.x, minY = boundingBox.y);
    //await waitForRandomTimeout(page, 250, 750);
    await randomNormalTimeout(page, 500);
    //console.log(results)
    
    return results;
}

// main bot collection function
async function scrapeSites(page, collection, rarity, loop) {
    let siteResults = [];

    if (loop === 0) {
        try {
            const portResults = await scrapePort(page, collection, rarity);
            console.log(portResults);
            siteResults = [...siteResults, ...portResults];
        } catch (error) {
            console.error(`Error scraping Port for collection ${collection} at ${rarity}: ${error}`);
        }
    // /*
    } else if (loop === 1) {
        try {
            const dmResults = await scrapeDM(page, collection, rarity);
            console.log(dmResults);
            siteResults = [...siteResults, ...dmResults];
        } catch (error) {
            console.error(`Error scraping DM for collection ${collection} at ${rarity}: ${error}`);
        }
    // */
    } else if (loop === 2) {
        try {
            const monkeyResults = await scrapeMonkey(page, collection, rarity);
            console.log(monkeyResults);
            siteResults = [...siteResults, ...monkeyResults];
        } catch (error) {
            console.error(`Error scraping Monkey for collection ${collection} at ${rarity}: ${error}`);
        }
    } else if (loop === 3) {
        try {
            const moneyResults = await scrapeMoney(page, collection, rarity);
            //console.log(moneyResults);
            siteResults = [...siteResults, ...moneyResults];
        } catch (error) {
            console.error(`Error scraping Money for ${collection} and ${rarity}: ${error}`);
        }
    }

    return siteResults;
}

// main function
async function run() {
    stashIDCSV = await readCsv('C:/Users/Kristaps/Desktop/TUP-main/IDS/Stash/stash_ids.csv');
    // Launch the browser
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await interceptCanvasFingerprinting(page);

    /*
    // Setting custom headers
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Upgrade-Insecure-Requests': '1',
        // Additional headers as needed
    });
    */

    await installMouseHelper(page);
    cursor = createCursor(page);
    
    //const collections = ['Revolution', 'Anubis'];
    //const collections = ['Dreams & Nightmares'];
    const collections = ['Anubis'];
    const rarity = 'Restricted';
    //const rarity = 'Classified';

    const upperRarity = getUpperRarity(rarity, allRarities);

    for (const collection of collections) {

        console.log(`Rarity: ${rarity}`);
        console.log(`Collection: ${collection}`);


        const upperItems = getItemsByCollectionAndRarity(stashIDCSV, collection.replace(/ /g, '_'), upperRarity);
        //const upperItems = [];
        console.log(`Upper items: ${upperItems}`);

        const items = getItemsByCollectionAndRarity(stashIDCSV, collection.replace(/ /g, '_'), rarity);
        //const items = ['Glock-18_Umbral_Rabbit'];
        console.log(`Items: ${items}`);


        const siteCount = 4;
        const itemCount = items.length;
        const upperItemCount = upperItems.length;

        const loopsToDo = Math.max(siteCount, itemCount, upperItemCount);

        let itemResults = [];

        for (let loop = 0; loop < loopsToDo; loop++) {
            console.log(`Doing loop: ${loop+1}`);
            
            // /*
            // Check if the current index is within the bounds of upperItems
            if (loop < upperItemCount) {
                try {
                    //const floatValues = await scrapeStash(page, item, collection, upperRarity);
                    const floatValues = await scrapeAnalyst(page, upperItems[loop], collection, upperRarity);
                    //await waitForRandomTimeout(page, 1500, 3000);
                    //itemResults = [...itemResults, ...resultsFromHalo];
                } catch (error) {
                    console.error(`Error scraping Analyst for item ${upperItems[loop]}: ${error}`);
                }
            } else {
                console.log(`All ${upperItemCount} upper items have been checked`);
            }
            // */


            // Check if the current index is within the bounds of items
            /*
            if (loop < itemCount) {
                try {
                    const bitResults = await scrapeBit(page, items[loop], collection, rarity);
                    console.log(bitResults);
                    itemResults = [...itemResults, ...bitResults];
                } catch (error) {
                    console.error(`Error scraping Bit for item ${items[loop]} at ${collection} and ${rarity}: ${error}`);
                }
            } else {
                console.log(`All ${itemCount} items have been scraoed on Bit`);
            }
            // */

            // /*
            // Check if the current index is within the bounds of sites
            if (loop < siteCount) {
                //const floatValues = await scrapeAnalyst(page, upperItems[loop], collection, upperRarity);
                //function scrapeMoney(page, index, itemResults)
                const siteResults = await scrapeSites(page, collection, rarity, loop);
                itemResults = [...itemResults, ...siteResults];
                // Further processing with floatValues
            } else {
                console.log(`All ${siteCount} sites have been scraped`);
            }
            // */
            
        
        }
        /*
        const siteResults = await scrapeSites(page, collection, rarity, 3);
        itemResults = [...itemResults, ...siteResults];
        // */
        
        /*
        try {
            const bitResults = await scrapeBit(page, items[0], collection, rarity);
            console.log(bitResults);
            itemResults = [...itemResults, ...bitResults];
        } catch (error) {
            console.error(`Error scraping Bit for item ${items[0]} at ${collection} and ${rarity}: ${error}`);
        }
        */

        /*
        for (const upperItem of upperItems) {
            try {
                //const floatValues = await scrapeStash(page, item, collection, upperRarity);
                const floatValues = await scrapeAnalyst(page, upperItem, collection, upperRarity);
                await waitForRandomTimeout(page, 1500, 3000);
                //itemResults = [...itemResults, ...resultsFromHalo];
            } catch (error) {
                console.error(`Error scraping Analyst for item ${upperItem}: ${error}`);
            }
        }

        let itemResults = [];

        for (const item of items) {
            try {
                const bitResults = await scrapeBit(page, item, collection, rarity);
                console.log(bitResults);
                itemResults = [...itemResults, ...bitResults];
            } catch (error) {
                console.error(`Error scraping Bit for item ${item} at ${collection} and ${rarity}: ${error}`);
            }
        }
        */
    


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

        await runPythonScript('./prices_csv_combiner.py', [upperRarity]);

        await runPythonScript('./csv_comb_n_filt.py', [collection, rarity]);

    }
    //console.log(itemResults);
  
    //await waitForRandomTimeout(page, 50000, 100000);
    //await waitForRandomTimeout(page, 500, 1500);
    await randomNormalTimeout(page, 500);
    //await randomNormalTimeout(page, 50000);
    await browser.close();
}

run().catch(console.error);