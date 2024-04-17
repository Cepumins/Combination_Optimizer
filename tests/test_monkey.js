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
const { createCursor } = require('ghost-cursor');

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

async function clickAndWait(cursor, selector, text, minTimeout, maxTimeout, page) {
    try {
        // Wait for the element to be available
        await page.waitForSelector(selector);
        
        // Click the element using the provided cursor
        await cursor.click(selector);
        console.log(`Clicked on: ${text}`);
        
        // Wait for a random duration between minTimeout and maxTimeout
        await waitForRandomTimeout(page, minTimeout, maxTimeout);
    } catch (error) {
        console.error(`Error clicking on: ${text}:`, error);
    }
}

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
        const cursor = createCursor(page);
        //console.log('creates cursor');
        await waitForRandomTimeout(page, 500, 2500);  // adjust the timeout according to the response time of the website

        if (source === 'Bit') {
            // Click the sort dropdown to open it
            const sortingButtonSelector = '#market > div.items-content > div.content-bar.main > div.btns-row.btns-ip.flex > div.dropdown.market-sorting > button';
            //await page.waitForSelector(sortingButtonSelector);
            //await cursor.click(sortingButtonSelector);
            //console.log('Selected sorter');
            //await waitForRandomTimeout(page, 500, 2500); 
            await clickAndWait(cursor, sortingButtonSelector, 'sorting button', 500, 2500, page);



            if (currentSort === 'default') {
                // Open the type of sorting dropdown
                const sortingDropdownSelector = 'div#vs1__combobox.vs__dropdown-toggle';
                //await page.waitForSelector(sortingDropdown);
                //await cursor.click(sortingDropdown);
                //console.log('Opened sorter types');
                //await waitForRandomTimeout(page, 150, 1500);
                await clickAndWait(cursor, sortingDropdownSelector, 'sorting dropdown', 150, 1500, page);

                // Select 'Float' option from the dropdown
                //({cursorX, cursorY} = await humanLikeMouseMove(page, 901, 699, cursorX, cursorY));
                //await page.click('li#vs1__option-4.vs__dropdown-option'); // Selector for 'Float'
                const floatSelector = 'li#vs1__option-4.vs__dropdown-option';
                //await page.waitForSelector(floatSelector);
                //await cursor.click(floatSelector);
                //console.log('Selected floats order');
                //await waitForRandomTimeout(page, 150, 1500);
                await clickAndWait(cursor, floatSelector, 'float from dropdown', 150, 1500, page);

                // Open the order direction dropdown (Lowest First/ Highest First)
                //({cursorX, cursorY} = await humanLikeMouseMove(page, 1066, 567, cursorX, cursorY));
                //await page.click('div#vs2__combobox.vs__dropdown-toggle');
                const orderDropdownSelector = 'div#vs2__combobox.vs__dropdown-toggle';
                //await page.waitForSelector(orderDropdown);
                //await cursor.click(orderDropdown);
                //console.log('Opened direction dropdown');
                //await waitForRandomTimeout(page, 150, 1500);
                await clickAndWait(cursor, orderDropdownSelector, 'order dropdown', 150, 1500, page);

                // Select 'Lowest first' option
                //({cursorX, cursorY} = await humanLikeMouseMove(page, 1087, 602, cursorX, cursorY));
                //await page.click('li#vs2__option-0.vs__dropdown-option'); // Selector for 'Lowest first'
                const lowestFirstSelector = 'li#vs2__option-0.vs__dropdown-option';
                //await page.waitForSelector(lowestFirst);
                //await cursor.click(lowestFirst);
                //console.log('Selected lowest first');
                //await waitForRandomTimeout(page, 150, 1500);
                await clickAndWait(cursor, lowestFirstSelector, 'lowest first (ascending)', 150, 1500, page);

                newSort = 'float';
            } else if (currentSort === 'float') {
                const sortingDropdownSelector = 'div#vs3__combobox.vs__dropdown-toggle';
                await clickAndWait(cursor, sortingDropdownSelector, 'sorting dropdown', 150, 1500, page);

                const discountSelector = 'li#vs1__option-2.vs__dropdown-option';
                await clickAndWait(cursor, discountSelector, 'discount from dropdown', 150, 1500, page);

                newSort = 'discount';
            } else if (currentSort === 'discount') {
                const sortingDropdownSelector = 'div#vs3__combobox.vs__dropdown-toggle';
                await clickAndWait(cursor, sortingDropdownSelector, 'sorting dropdown', 150, 1500, page);

                const priceSelector = 'li#vs1__option-0.vs__dropdown-option';
                await clickAndWait(cursor, priceSelector, 'price from dropdown', 150, 1500, page);

                const orderDropdownSelector = 'div#vs2__combobox.vs__dropdown-toggle';
                await clickAndWait(cursor, orderDropdownSelector, 'order dropdown', 150, 1500, page);

                const lowestFirstSelector = 'li#vs2__option-0.vs__dropdown-option';
                await clickAndWait(cursor, lowestFirstSelector, 'lowest first (ascending)', 150, 1500, page);

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
            await clickAndWait(cursor, applyButtonSelector, 'apply changes', 500, 2500, page);

            const closeSorterSelector = '#market .dropdown.active.market-sorting .btn-close';
            await clickAndWait(cursor, closeSorterSelector, 'closed sorter', 150, 1500, page);
        } 
        else if (source === 'Money') {
            const sortingDropdownSelector = 'div.bot-listing_header__2VZJJ button#downshift-1-toggle-button';
            await clickAndWait(cursor, sortingDropdownSelector, 'sorting dropdown', 150, 1500, page);

            if (currentSort === 'default') {
                const sortingDropdownSelector = 'ul.csm_ui__options_list__05cf7 li#downshift-1-item-5';
                await clickAndWait(cursor, sortingDropdownSelector, 'float ascending order', 150, 1500, page);
                newSort = 'float';
            } else if (currentSort === 'float') {
                const sortingDropdownSelector = 'ul.csm_ui__options_list__05cf7 li#downshift-1-item-3';
                await clickAndWait(cursor, sortingDropdownSelector, 'price ascending order', 150, 1500, page);
                newSort = 'price';
            }
        }
        else if (source === 'Monkey') {
            const sortingDropdownSelector = '#__layout > div > div.trade.main > div > div:nth-child(3) div.form-select__body';
            await clickAndWait(cursor, sortingDropdownSelector, 'sorting dropdown', 150, 1500, page);

            if (currentSort === 'default') {
                const sortingDropdownSelector = '#__layout > div > div.trade.main > div > div:nth-child(3) > div.inventory-toolbar > div.form-item.form-select.inventory-toolbar-select.inventory-toolbar-sort.trailing.active.lite > div.select-list > div:nth-child(4)';
                await clickAndWait(cursor, sortingDropdownSelector, 'float ascending order', 150, 1500, page);
                newSort = 'float';
            } else if (currentSort === 'float') {
                const sortingDropdownSelector = '#__layout > div > div.trade.main > div > div:nth-child(3) > div.inventory-toolbar > div.form-item.form-select.inventory-toolbar-select.inventory-toolbar-sort.trailing.active.lite > div.select-list > div:nth-child(2)';
                await clickAndWait(cursor, sortingDropdownSelector, 'price ascending order', 150, 1500, page);
                newSort = 'price';
            }
        }
        else if (source === 'Port') {
            const sortingDropdownSelector = '#content > div > div.CatalogPage-content > div.CatalogPage-header > div > div.CatalogHeader-right > div.CatalogHeader-sort > div';
            await clickAndWait(cursor, sortingDropdownSelector, 'sorting dropdown', 150, 1500, page);

            if (currentSort === 'default') {
                const sortingDropdownSelector = '#content > div > div.CatalogPage-content > div.CatalogPage-header > div > div.CatalogHeader-right > div.CatalogHeader-sort > div > div > div:nth-child(7)';
                await clickAndWait(cursor, sortingDropdownSelector, 'float ascending order', 150, 1500, page);
                newSort = 'float';
            } else if (currentSort === 'float') {
                const sortingDropdownSelector = '#content > div > div.CatalogPage-content > div.CatalogPage-header > div > div.CatalogHeader-right > div.CatalogHeader-sort > div > div > div:nth-child(3)';
                await clickAndWait(cursor, sortingDropdownSelector, 'discount order', 150, 1500, page);
                newSort = 'discount';
            } else if (currentSort === 'discount') {
                const sortingDropdownSelector = '#content > div > div.CatalogPage-content > div.CatalogPage-header > div > div.CatalogHeader-right > div.CatalogHeader-sort > div > div > div:nth-child(5)';
                await clickAndWait(cursor, sortingDropdownSelector, 'price ascending order', 150, 1500, page);
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

    //await randomScrollPage(page, 50, 250);
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

                    console.log(`${itemIndex}: ${name} - ${float} (${price}) at ${timestamp}`);
                    records.push({
                        index: itemIndex++,
                        price: usdPrice,
                        float: realFloat,
                        condition: conditionAbbr, // Assumes itemConditionAbbr is globally defined or passed in
                        name: name, // Assumes itemNameUnd is globally defined or passed in
                        site: source,
                        timestamp: timestamp
                    });
                    
                    newItemsAdded = true;
                    lastItemTime = new Date();
                }
            });

            
            if (!newItemsAdded) {
                //await randomScrollPage(page, 50, 500);
                //await simulateMouseMovements(page, 2, width, height);
                //await moveAndScroll(page, width, height, moveCount = 2, minScroll = 50, maxScroll = 250, minX, minY)
                
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

                if (sortOrder === 'price') {
                    console.log("Proceeding with price sort order.");
                    await moveAndScroll(page, width, height, moveCount = 2, minScroll = 50, maxScroll = 150, minX, minY)
                } else if (sortOrder === 'broken') {
                    console.log('something has gone wrong in the changing order function');
                } else {
                    await waitForRandomTimeout(page, 100, 500);
                    sortOrder = await changeItemSorting(page, source, sortOrder);
                    await waitForRandomTimeout(page, 2000, 5000);
                    lastItemTime = new Date();
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
    const cursor = createCursor(page);

    //advanced filtering
    //await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__top > div > div > span:nth-child(2)');
    //await waitForRandomTimeout(page, 1000, 2500);
    const advancedFilteringSelector = '#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__top > div > div > span:nth-child(2)';
    await clickAndWait(cursor, advancedFilteringSelector, 'advanced filtering', 500, 2500, page);

    //await clickButton(page, 'Rarity filter', '');
    //rarity filter
    //await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-rarity > div > span');
    //await waitForRandomTimeout(page, 1000, 2500);
    const rarityFilterSelector = '#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-rarity > div > span';
    await clickAndWait(cursor, rarityFilterSelector, 'rarity selector', 500, 2500, page);

    //await clickButton(page, 'Restricted', '.trade-filter-option-generic__label [data-rarity="RESTRICTED"]');
    //click rarity
    const rarityUpper = rarity.toUpperCase();
    //await page.click(`.trade-filter-option-generic__label [data-rarity="${rarityUpper}"]`);
    //await waitForRandomTimeout(page, 1000, 2500);
    const upperRaritySelector = `.trade-filter-option-generic__label [data-rarity="${rarityUpper}"]`;
    await clickAndWait(cursor, upperRaritySelector, `selected ${rarityUpper}`, 500, 2500, page);

    //collection filter
    //await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection > div > span');
    //await waitForRandomTimeout(page, 1000, 2500);
    const collectionFilterSelector = '#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection > div > span';
    await clickAndWait(cursor, collectionFilterSelector, 'opened collections filtering', 500, 2500, page);

    //open collections
    //await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection.expanded > div.trade-collapse__body > div > div.form-multiselect__body > div > div');
    //await waitForRandomTimeout(page, 1000, 2500);
    const collectionDropdownSelector = '#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection.expanded > div.trade-collapse__body > div > div.form-multiselect__body > div > div'
    await clickAndWait(cursor, collectionDropdownSelector, 'opened collections dropdown', 500, 2500, page);
    
    //click collection
    //await page.click('#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection.expanded > div.trade-collapse__body > div > div.select-list > div > div:nth-child(10) > div > div > div.trade-filter-collection-item > span');
    //await waitForRandomTimeout(page, 1000, 2500);
    const collectionID = monkeyCollectionMap[collection];
    const collectionSelector = `#__layout > div > div.trade.main > div > div.trade-panel > div.trade-panel__wrapper > div > div.trade-filters__body > div > div > div > div > div.trade-collapse.trade-filter-collection.expanded > div.trade-collapse__body > div > div.select-list > div > div:nth-child(${collectionID}) > div > div > div.trade-filter-collection-item > span`;
    await clickAndWait(cursor, collectionSelector, `selected collection ${collection}`, 500, 2500, page);


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

    //await moveAndScroll(page, boundingBox.width, boundingBox.height, moveCount = 5, minScroll = 50, maxScroll = 250, minX = boundingBox.x, minY = boundingBox.y)



    //updatePricesCSV(item, collection, rarity, otherWearResults, source); // update the prices for other wears in the pricesCSV

    //const cookieButtonXPath = '/html/body/app-root/mat-sidenav-container/mat-sidenav-content/div[1]/app-header/header-banners/div/cookie-banner/div/div/div/div[2]/button';
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

    await installMouseHelper(page);
    
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