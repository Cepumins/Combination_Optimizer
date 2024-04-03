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

checkTime = 12.5;

const caseCollectionMapping = {
    'Recoil': 'community_31',
    'Operation Riptide': 'community_29',
    'Operation Broken Fang': 'community_27',
    'Fracture': 'community_26',
    'Snakebite': 'community_28',
    'Operation Phoenix Weapon': 'community_2',
    'eSports 2013 Winter': 'esports_ii',
    'eSports 2014 Summer': 'esports_iii',
    'Winter Offensive Weapon': 'community_1',
    'CS:GO Weapon 3': 'weapons_iii',
    'Operation Bravo': 'bravo_i',
    'eSports 2013': 'esports',
    'CS:GO Weapon 2': 'weapons_ii',
    'CS:GO Weapon': 'weapons_i',
    'Prisma 2': 'community_25',
    'Operation Hydra': 'community_17',
    'Shattered Web': 'community_23',
    'CS20': 'community_24',
    'Prisma': 'community_22',
    'Danger Zone': 'community_21',
    'Horizon': 'community_20',
    'Clutch': 'community_19',
    'Spectrum 2': 'community_18',
    'Spectrum': 'community_16',
    'Glove': 'community_15',
    'Gamma 2': 'gamma_2',
    'Gamma': 'community_13',
    'Chroma 3': 'community_12',
    'Operation Wildfire': 'community_11',
    'Revolver': 'community_10',
    'Shadow': 'community_9',
    'Falchion': 'community_8',
    'Chroma 2': 'community_7',
    'Chroma': 'community_6',
    'Operation Vanguard Weapon': 'community_5',
    'Operation Breakout Weapon': 'community_4',
    'Huntsman Weapon': 'community_3',
    'Dreams & Nightmares': 'community_30',
    'Revolution': 'community_32',
    'Kilowatt': 'community_33',
};


const mapCollectionMapping = {
  'Ancient': 'op10_ancient',
  'Anubis': 'anubis',
  'Inferno (2018)': 'inferno_2',
  'Mirage (2021)': 'mirage_2021',
  'Nuke (2018)': 'nuke_2',
  'Overpass': 'overpass',
  'Vertigo (2021)': 'vertigo_2021',
  'Alpha': 'bravo_ii',
  'Assault': 'assault',
  'Aztec': 'aztec',
  'Baggage': 'baggage',
  'Bank': 'bank',
  //'Blacksite',
  'Cache': 'cache',
  'Canals': 'canals',
  'Chop Shop': 'chopshop',
  'Cobblestone': 'cobblestone',
  'Control': 'op10_ct',
  'Dust': 'dust',
  'Dust 2 (2021)': 'dust_2_2021',
  'Dust 2 (Old)': 'dust_2',
  'Gods and Monsters': 'gods_and_monsters',
  'Havoc': 'op10_t',
  'Inferno (Old)': 'inferno',
  'Italy': 'italy',
  'Lake': 'lake',
  'Militia': 'militia',
  'Mirage (Old)': 'mirage',
  'Norse': 'norse',
  'Nuke (Old)': 'nuke',
  'Office': 'office',
  'Rising Sun': 'kimono',
  'Safehouse': 'safehouse',
  'St. Marc': 'stmarc',
  'Train (2021)': 'train_2021',
  'Train (Old)': 'train',
  'Vertigo (Old)': 'vergigo'
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

async function loadItems(page) {
    const seenOutcomes = new Set();
    //const records = [];
    const startTime = new Date();
    let lastItemTime;

    while (true) {
        await randomScrollPage(page, 50, 250);

        const outcomes = await page.$$eval('div[class^="mt-1 grid gap-1 dynamic-grid grid-cols-dynamic"] > a', items => {
            return items.map(item => {
                // Extract the href attribute and get the ID from it
                const href = item.getAttribute('href');
                const idMatch = href.match(/\/market\/(\d+)/);
                const id = idMatch ? idMatch[1] : '';

                // Extract the item name from the <h4> tag
                const name = item.querySelector('h4') ? item.querySelector('h4').textContent.trim() : '';

                // Extract the condition (e.g., 'FT') from the div with class 'text-xs'
                //const condition = item.querySelector('.text-xs') ? item.querySelector('.text-xs').textContent.trim() : '';
                const conditionContainer = item.querySelector('div.flex.justify-between.items-center.mt-1 > div.flex.justify-start.items-center');
                const condition = conditionContainer ? conditionContainer.textContent.trim() : '';

                // Combine the extracted data
                return `${id};${name} (${condition})`;
            });
        });

        let newItemsAdded = false;
        outcomes.forEach(outcome => {
            if (!seenOutcomes.has(outcome)) {
                seenOutcomes.add(outcome);
                console.log(outcome); 
                newItemsAdded = true;
                lastItemTime = new Date();
                
            }
        });

        if (!newItemsAdded) {
            if (new Date() - lastItemTime > (checkTime*1000)) {
                console.log(`No new items found in the last ${checkTime}s, exiting..`);
                break;
            }
            console.log('No new items found, checking again...');
            // You might want to implement scrolling or wait logic here
        }

        if (new Date() - startTime > 45000) { // 45 seconds timeout
            console.log(`${seenOutcomes.length} items processed`);
            console.log('Timeout reached');
            break;
        }

        // Wait for a random amount of time before checking again
        await waitForRandomTimeout(page, 250, 750);
    }

    return seenOutcomes;
}

// Function to append new items to the file
function appendNewItems(results, path) {
    let existingItems = [];

    // Read the existing contents if the file exists
    try {
        const fileContent = fs.readFileSync(path, 'utf8');
        existingItems = fileContent.split('\n').filter(line => line.trim() !== '');
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('An error occurred while reading the file:', error);
            return;
        }
    }

    // Append new items that are not already in the file
    results.forEach((outcome) => {
        if (!existingItems.includes(outcome)) {
            console.log(outcome);
            fs.appendFileSync(path, outcome + '\n', 'utf8');
        }
    });
}

// Function to sort the file contents
function sortFile(path) {
    let lines = [];

    // Read the file content
    try {
        const fileContent = fs.readFileSync(path, 'utf8');
        lines = fileContent.split('\n').filter(line => line.trim() !== '');
    } catch (error) {
        console.error('An error occurred while reading the file:', error);
        return;
    }

    // Sort the lines based on the numeric part
    lines.sort((a, b) => {
        const numA = parseInt(a.split(';')[0], 10);
        const numB = parseInt(b.split(';')[0], 10);
        return numA - numB;
    });

    // Write the sorted lines back to the file
    fs.writeFileSync(path, lines.join('\n') + '\n', 'utf8');
}

async function stashItemInfo(page, collection) {

    let collectionType = '';
    if (Object.keys(mapCollectionMapping).includes(collection)) {
      collectionType = 'map';
    } else if (Object.keys(caseCollectionMapping).includes(collection)) {
      collectionType = 'case';
    } else {
      // If the collection is not found in either list, throw an error and terminate the script
      throw new Error(`Collection '${collection}' not found in any list.`);
    }
    console.log(`The collection '${collection}' is a '${collectionType}' type.`);

    let collectionID;
    if (collectionType === 'case') {
        collectionID = caseCollectionMapping[collection];
      } else if (collectionType === 'map') {
        collectionID = mapCollectionMapping[collection];
      }

    const link = `https://www.haloskins.com/market?keyword=&itemset=set_${collectionID}&quality=normal`;
    
    //await page.goto(link, {waitUntil: 'networkidle0', timeout: 60000});

    const { width, height } = await initializePage(page, link);

    await waitForRandomTimeout(page, 1000, 3000);

    const cookieButtonXPath = '//*[@id="bodyEle"]/div[1]/div[2]/div/p[4]/button/span';
    await acceptCookies(page, cookieButtonXPath);

    const results = await loadItems(page);

    const path = 'all_haloids.txt';

    console.log(`All outcomes for collection ${collection}: `);
    console.log(results);

    console.log(`Added outcomes for collection ${collection}: `);
    appendNewItems(results, path);
    sortFile(path);

    console.log(`File updated successfully with collection ${collection}`);

    return results;
}

(async () => {
    // Launch the browser
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    const collection = 'Revolution';
  
    const results = await stashItemInfo(page, collection);

    //console.log('All outcomes: ');
    //console.log(results);
  
    await waitForRandomTimeout(page, 1000, 5000);
    await browser.close();
  })();