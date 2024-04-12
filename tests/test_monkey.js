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
const { time } = require("console");

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

function getRandomWeightedTowardsCenter() {
    const numRandom = 10; // Increase for a tighter concentration around the mean
    let sum = 0;
    for (let i = 0; i < numRandom; i++) {
        sum += Math.random();
    }
    return sum / numRandom;
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
    //await randomScrollPage(page, 50, 250); // Perform a random scroll on the page
    //await simulateMouseMovements(page, 3, dimensions.width, dimensions.height); // Simulate mouse movements across the page based on the page dimensions
    await moveAndScroll(page, dimensions.width, dimensions.height, 1, 10, 50)
    return dimensions; // Return the dimensions for further use
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
    } else if (source === 'DMarket') {
        floatSelector = '.o-qualityChart__infoValue span';
        priceSelector = '.c-asset__priceNumber';
        itemSelector = '.c-asset__img'; 
    } else if (source === 'Monkey') {
        floatSelector = '.item-float.item-card__float';
        priceSelector = '.item-price.item-card__price';
        itemSelector = '.item-image.item-card__image';
        lastItemTimeout = 10;
    }

    let floats;

    await randomScrollPage(page, 50, 250);
    while (true) {
        try {

            //await randomScrollPage(page, 50, 250);
            // Retrieve values for each visible item using selectors passed as parameters
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
                    seenFloats.add(float);

                    //console.log('gets after floats');
                    console.log(float);

                    //const float = floats[index].trim();
                    const price = prices[index].trim();
                    const cleanPrice = price.replace(/[^0-9.]+/g, "");
                    //const itemIdentifier = `${float}-${cleanPrice}`; // Use both float and cleaned price for uniqueness
                    const altText = itemAlts[index];
                    const [fullName, conditionText] = altText.split(' (');
                    const name = fullName.trim().replace(/ \|\s/g, '_').replace(/ /g, '_');
                    const condition = conditionText.replace(')', '').trim(); // Assuming the condition is at the end within parentheses
                    const conditionAbbr = conditionMappings[condition] || condition;
                    
                    let realFloat, usdPrice;
                    let cleanFloat = float;
                    if (source === 'Port') {
                        //realFloat = (parseFloat(float) + 0.00075).toFixed(6);
                        realFloat = parseFloat((parseFloat(float) + 0.00075).toFixed(6));
                        //usdPrice = (parseFloat(cleanPrice) * exchangeRatio).toFixed(6);
                        usdPrice = parseFloat((parseFloat(cleanPrice) * exchangeRatio).toFixed(6));
                    } else if (source === 'DMarket') {
                        realFloat = parseFloat((parseFloat(float) + 0.000025).toFixed(6)); // adding 0.000025 instead would assume that, on average, the real value might be halfway between the displayed value and the next higher value at four decimal places.
                        // 0.000049;
                        usdPrice = parseFloat(cleanPrice);
                    } else if (source === 'Monkey') {
                        cleanFloat = float.replace(/[^0-9.]+/g, "");
                        realFloat = parseFloat(cleanFloat/100); // adding 0.000025 instead would assume that, on average, the real value might be halfway between the displayed value and the next higher value at four decimal places.
                        // 0.000049;
                        usdPrice = parseFloat(cleanPrice);
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
                    console.log(`${itemIndex++}: ${name} - ${float} (${price}) at ${timestamp}`);
                    newItemsAdded = true;
                    lastItemTime = new Date();
                }
            });

            
            if (!newItemsAdded) {
                //await randomScrollPage(page, 50, 500);
                //await simulateMouseMovements(page, 2, width, height);
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
                console.log(`${records.length} items processed`);
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
    await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection.expanded > div.trade-collapse__body > div > div.select-list > div > div:nth-child(10) > div > div > div.trade-filter-collection-item > span');
    await waitForRandomTimeout(page, 1000, 2500);


    const elementSelector = '#__layout > div > div.trade.main > div > div:nth-child(3) > div.inventory-grid';

    // Wait for the element to be rendered
    await page.waitForSelector(elementSelector);

    // Get the element handle
    const element = await page.$(elementSelector);

    // Get the bounding box of the element
    const boundingBox = await element.boundingBox();

    if (boundingBox) {
        console.log(`Dimensions and position of the element:`);
        console.log(`Width: ${boundingBox.width}`);
        console.log(`Height: ${boundingBox.height}`);
        console.log(`X (left): ${boundingBox.x}`);
        console.log(`Y (top): ${boundingBox.y}`);
    } else {
        console.log('The bounding box of the element could not be retrieved.');
    }

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
    // Launch the browser
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    const collection = 'Anubis';
    const rarity = 'Restricted';

    console.log(`Rarity: ${rarity}`);
    console.log(`Collection: ${collection}`);

    let itemResults = [];
  
    try {
        const monkeyResults = await scrapeMonkey(page, collection, rarity);
        //console.log(monkeyResults);
        itemResults = [...itemResults, ...monkeyResults];
    } catch (error) {
        console.error(`Error scraping Monkey for collection ${collection} at ${rarity}: ${error}`);
        // Proceed to next item or other necessary action
    }

    
    console.log(itemResults);
  
    await waitForRandomTimeout(page, 50000, 100000);
    await browser.close();
})();