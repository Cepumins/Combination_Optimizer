const fs = require('fs-extra');
const path = require('path');
const csv = require('csv-parser');
const moment = require('moment');
//const puppeteer = require('puppeteer');
// Require puppeteer-extra and puppeteer-extra-plugin-stealth
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const iconv = require('iconv-lite');
const { PythonShell } = require('python-shell');

let collection = "Recoil"
let prefix = `${collection}`

let minutes_to_check = 90;

// Add this line to read the CSV file with a specific encoding
const fileStream = fs.createReadStream(`${prefix}/${collection}.csv`).pipe(iconv.decodeStream('utf8'));

let wear = "FN";
let tradeup_rarity = "Covert";
let target_rarity;

switch (tradeup_rarity) {
  case "Covert":
    target_rarity = "Classified";
    break;
  case "Classified":
    target_rarity = "Restricted";
    break;
  case "Restricted":
    target_rarity = "Mil-Spec";
    break;
  default:
    console.error("Invalid tradeup_rarity value");
    process.exit(1);
}

async function processItems() {
    // extension path
    const CsgoFloat = 'C:/Users/Kristaps/AppData/Local/Google/Chrome/User Data/Profile 2/Extensions/jjicbefpemnphinccgikpdaagjebbnhg/3.0.3_1';

    const username = 'brd-customer-hl_ec87417e-zone-data_center';
    const password = 'mqmen5rnjit3';

    // Construct the proxy.
    const proxy = 'http://zproxy.lum-superproxy.io:22225';

    const browser = await puppeteer.launch({
        headless: false,
        args: [
            `--load-extension=${CsgoFloat}`,
            `--disable-extensions-except=${CsgoFloat}`,
            '--enable-automation',
            `--proxy-server=${proxy}`,
            //'--disable-web-security'
        ],
        
    });

    const page = await browser.newPage();

    // Set up the proxy authentication.
    await page.authenticate({username, password});

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
            req.abort();
        }
        else {
            req.continue();
        }
    });

    await page.setViewport({
        width: 1280,
        height: 1080,
    });

    await new Promise(resolve => setTimeout(resolve, 10000 + Math.floor(Math.random() * 1000)));

    //console.log("processItem() called");
    const items = await readCSVFile(`${prefix}/${collection}.csv`);
    const filteredItems = items.filter(item => item.Rarity === target_rarity);
    
    let wearsToProcess = [];

    if (wear === "ALL") {
        wearsToProcess = ["FN", "MW", "FT", "WW", "BS"];
    } else if (wear === "FN") {
        wearsToProcess = ["FN", "MW"];
    } else if (wear === "MW") {
        wearsToProcess = ["MW", "FT"];
    } else if (wear === "FT") {
        wearsToProcess = ["FT", "WW"];
    } else if (wear === "WW") {
        wearsToProcess = ["WW", "BS"];
    } else if (wear === "BS") {
        wearsToProcess = ["BS"];
    }
    
    for (const itemWear of wearsToProcess) {
        for (const item of filteredItems) {
            try {
                console.log("Processing item:", item.Name);
                const itemCSVPath = path.join(prefix, 'Items', 'SCM', target_rarity, `${item.Name} (${itemWear}).csv`);
                const shouldProcessItem = await isItemTimestampOlderThan(itemCSVPath);

                if (!shouldProcessItem) {
                    console.log(`Skipping ${item.Name} (${itemWear}) because it was updated less than ${minutes_to_check} minutes ago.`);
                    continue;
                }

                await processItem(item, itemWear, page);
            } catch (error) {
                if (error.message === 'Too many requests') {
                    console.log('Too many requests');
                    return;
                } else {
                    console.error('Error processing item:', error);
                }
            }
        }
    }
}

async function isItemTimestampOlderThan(filePath) {
    try {
        const data = await fs.promises.readFile(filePath, 'utf-8');
        const lines = data.split('\n');
        const firstItemLine = lines[1];

        if (firstItemLine) {
            const timestamp = firstItemLine.split(',')[7];
            const timestampMoment = moment(timestamp, 'YYYY-MM-DD HH:mm:ss');
            const diffMinutes = moment().diff(timestampMoment, 'minutes');

            // If the timestamp is found and is updated less than 90 minutes ago, return false
            if (diffMinutes <= minutes_to_check) {
                return false;
            }
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File does not exist, return true so it will be processed
            return true;
        } else {
            console.error('Error reading item CSV:', error);
        }
    }
    // If there is no timestamp or the timestamp is older than 90 minutes, return true
    return true;
}

function readCSVFile(filePath) {
    return new Promise((resolve, reject) => {
        const items = [];
        fs.createReadStream(filePath)
        fileStream.pipe(csv({ separator: ';' })) // Set the delimiter to semicolon
            .on('data', (row) => {
                //console.log(`Row: ${JSON.stringify(row)}`); // Add this line to log each row
                items.push(row);
            })
            .on('end', () => {
                //console.log(`Items read from CSV file: ${JSON.stringify(items)}`);
                resolve(items);
            })
            .on('error', reject);
    });
}

async function continuousScroll(page, interval = 500) {
    return new Promise(async (resolve, reject) => {
      try {
        const scrollInterval = setInterval(() => {
          page.evaluate(() => {
            const randomScrollAmount = -100 + Math.random() * 700;
            window.scrollBy(0, randomScrollAmount);
          });
        }, interval);
  
        resolve(scrollInterval);
      } catch (error) {
        reject(error);
      }
    });
}

async function checkAndSetPageSize100(page) {
    // Wait for the necessary elements to be available
    await page.waitForSelector("#searchResultsTable > csgofloat-utility-belt");
    //console.log("Found csgofloat shadow root");

    // Check if the page size is not 100
    const pageSizeNot100 = await page.evaluate(() => {
        const beltElement = document.querySelector("#searchResultsTable > csgofloat-utility-belt");
        const beltShadowRoot = beltElement.shadowRoot;
        const pageSizeElement = beltShadowRoot.querySelector("div > csgofloat-page-size");
        const pageSizeShadowRoot = pageSizeElement.shadowRoot;
        const selectElement = pageSizeShadowRoot.querySelector("select");
        const option100 = pageSizeShadowRoot.querySelector("select > option:nth-child(5)");

        return selectElement.value !== option100.value;
    });

    // Set the page size to 100 if the page size is not 100
    if (pageSizeNot100) {
        console.log("Page size is not 100, setting to 100");

        await page.evaluate(() => {
            const beltElement = document.querySelector("#searchResultsTable > csgofloat-utility-belt");
            const beltShadowRoot = beltElement.shadowRoot;
            const pageSizeElement = beltShadowRoot.querySelector("div > csgofloat-page-size");
            const pageSizeShadowRoot = pageSizeElement.shadowRoot;
            const selectElement = pageSizeShadowRoot.querySelector("select");
            const option100 = pageSizeShadowRoot.querySelector("select > option:nth-child(5)");

            selectElement.value = option100.value;
            selectElement.dispatchEvent(new Event('change'));
            //console.log("Executed!");
        });
    } else {
        //console.log("Page size is 100, skipping");
    }
}

async function checkForTooManyRequests(page) {
    try {
        const errorMessage = await page.$eval('#message h3', (elem) => elem.textContent);
        if (errorMessage.includes('You\'ve made too many requests recently.')) {
            throw new Error('Too many requests');
        }
    } catch (error) {
        if (error.message === 'Too many requests') {
            throw error;
        }
        // Error might be due to the element not being present on the page
    }
}

async function processItem(item, wear, page) {
    //console.log(`processItem() called for item: ${item.Name}`);
    let wear_link = "";
    if (wear === "FN") {
    wear_link = "%28Factory%20New%29";
    } else if (wear === "MW") {
    wear_link = "%28Minimal%20Wear%29";
    } else if (wear === "FT") {
    wear_link = "%28Field-Tested%29";
    } else if (wear === "WW") {
    wear_link = "%28Well-Worn%29";
    } else if (wear === "BS") {
    wear_link = "%28Battle-Scarred%29";
    }

    let StatTrak = false;
    let StatTrak_link = "";

    if (StatTrak === true) {
        StatTrak_link = "StatTrak%E2%84%A2%20";
    } else if (StatTrak === false) {
        StatTrak_link = "";
    }

    //const link = `https://steamcommunity.com/market/listings/730/${StatTrak_link}${item['SCM Link']}${wear_link}?query=&start=0&count=100`;
    const link = `https://steamcommunity.com/market/listings/730/${StatTrak_link}${item['SCM Link']}${wear_link}`;

    // Listen for requests and check if it's occurrence of a URL starting with the desired string
    page.on('request', async request => {
        if (request.url().startsWith('https://steamcommunity.com/market/listings/')) {
            //await checkForTooManyRequests(page);
            await checkAndSetPageSize100(page);
        }
    });

    await page.goto(link);

    // Check for "Too many requests" error
    const isTooManyRequests = await checkForTooManyRequests(page);
    if (isTooManyRequests) {
        console.log("Too many requests");
        await browser.close();
        throw new Error('Too many requests');
    }

    await new Promise(resolve => setTimeout(resolve, 3000 + Math.floor(Math.random() * 1000)));

    // Start continuous scrolling
    const scrollInterval = await continuousScroll(page);
        
    // waits for 3 seconds
    //await new Promise(resolve => setTimeout(resolve, 5000));
    //await new Promise(resolve => setTimeout(resolve, 0 + Math.floor(Math.random() * 2000)));

    // wait for the price elements to load
    await page.waitForSelector('.market_listing_price.market_listing_price_with_fee');

    await page.waitForSelector('csgofloat-item-row-wrapper');

    const currencySymbols = ['A$', 'ARS$', 'R$', 'CDN$', 'CHF', 'CLP$',  null, 'COL$',   '₡',   '€',   '£', 'HK$',   '₪',  'Rp',   '₹',   '¥',   '₩',  'KD',   '₸', 'Mex$',  'RM',  'kr', 'NZ$', 'S/.',   'P',  'zł',  'QR', 'pуб.',  'SR',  'S$',   '฿',  'TL', 'NT$',   '₴',   '$',  '$U',  '₫',    'R', 'kr'];
    const currencyList =   ['AUD', 'ARS', 'BRL', 'CAD', 'CHF',  'CLP', 'CNY',  'COP', 'CRC', 'EUR', 'GBP', 'HKD', 'ILS', 'IDR', 'INR', 'CNY', 'KRW', 'KWD', 'KZT',  'MXN', 'MYR', 'DKK', 'NZD', 'PEN', 'PHP', 'PLN', 'QAR',  'RUB', 'SAR', 'SGD', 'THB', 'TRY', 'TWD', 'UAH', 'USD', 'UYU', 'VND', 'ZAR'];

    const symbolCodeMap = new Map();
    for (let symbol of currencySymbols) {
        for (let code of currencyList) {
            if (code.startsWith(symbol)) {
                symbolCodeMap.set(symbol, code);
                break;
            }
        }
    }

    // extract the prices
    const prices = await page.evaluate(() => {
        const priceElements = document.querySelectorAll('.market_listing_price.market_listing_price_with_fee');
        return Array.from(priceElements).map(element => element.innerText);
    });

    const currencyCodes = [];
    const pricesValue = [];

    prices.forEach(price => {
        for (let i = 0; i < currencySymbols.length; i++) {
            if (price.indexOf(currencySymbols[i]) !== -1) {
                currencyCodes.push(currencyList[i]);
                let priceValue = price.replace(currencySymbols[i], '')
                                        .replace(' ', '')
                                        .replace(',', '.')
                                        .replace(/,/g, '.')
                                        .replace(/\.{1}(?=\d{3,})/g, '')
                                        .replace(/[^\d.]+/g, '');
                priceValue = parseFloat(priceValue);
                pricesValue.push(priceValue);
                break;
            }
        }
    });

    // Read the CSV file
    const data = fs.readFileSync('currency_data.csv', 'utf8');

    // Parse the CSV data into an array of objects
    const rows = data.split('\n').slice(1);
    const rates = rows.map(row => {
        const columns = row.split(',');
        return {
            currencyCode: columns[1],
            rateToEUR: parseFloat(columns[2])
        };
    });

    // Create a map of currency codes to rates
    const ratesMap = new Map();
    for (const rate of rates) {
        ratesMap.set(rate.currencyCode, rate.rateToEUR);
    }

    // Extract the item name and wear value from the page
    //const itemName = await page.$eval('#largeiteminfo_item_name', el => el.textContent);
    //const formattedItemName = itemName.replace(" |", "").replace("StatTrak™", "ST").replace("♥", "-");
    let itemName, formattedItemName;

    try {
        //console.log('Before getting item name');
        itemName = await page.$eval('#largeiteminfo_item_name', el => el.textContent);
        //console.log('Before formatting item name');
        formattedItemName = itemName.replace(" |", "").replace("StatTrak™", "ST")
                                    .replace('Dual Berettas', 'Dual-Berettas')
                                    .replace('R8 Revolver', 'R8-Revolver')
                                    .replace('SG 553', 'SG-553')
                                    .replace("Galil AR", "Galil-AR")
                                    .replace('Desert Eagle', 'Desert-Eagle')
                                    .replace('SSG 08', 'SSG-08')
                                    .replace("♥", "-");
        //console.log('Succesfully got the item name and replaced it:', formattedItemName);
        //console.log('After formatting item name:', formattedItemName);
    } catch (error) {
        console.error('Failed to find item name or format item name for item:', item.Name);
        itemName = 'Unknown';
        formattedItemName = 'Unknown';
    }


    let wearValue, itemRarityElement, itemRarity;
    //const wearValue = await page.$eval('#largeiteminfo_item_descriptors > div:nth-child(1)', el => el.textContent);
    try {
        wearValue = await page.$eval('#largeiteminfo_item_descriptors > div:nth-child(1)', el => el.textContent);
    } catch (error) {
        console.error('Failed to find wear value for item:', item.Name);
        wearValue = 'Unknown';
    }

    //const itemRarityElement = await page.$eval('#largeiteminfo_item_type', el => el.textContent);
    //const itemRarity = itemRarityElement.split(' ')[0];
    try {
        itemRarityElement = await page.$eval('#largeiteminfo_item_type', el => el.textContent);
        itemRarity = itemRarityElement.split(' ')[0];
        //console.log('Succesfully got the item rarity and replaced it: ', itemRarity)
    } catch (error) {
        console.error('Failed to find item rarity for item:', item.Name);
        itemRarity = 'Unknown';
    }

    const currencyCode = currencyCodes
    // Multiply the pricesValue by the corresponding exchange rate
    const pricesInEUR = pricesValue.map((price, index) => parseFloat(price) * parseFloat(ratesMap.get(currencyCode[index])));
    const formattedPrices = pricesInEUR.map(price => parseFloat(price).toLocaleString(undefined, {maximumFractionDigits: 2}).replace(',', ''));
    //console.log('Succesfully formatted the prices')

    const floatWears = await page.evaluate(() => {
        const floatElements = document.querySelectorAll('csgofloat-item-row-wrapper');
        return Array.from(floatElements).map(element => {
            const shadowDiv = element.shadowRoot.querySelector('div').textContent;
            const floatText = shadowDiv.split('\n').find(line => line.trim().startsWith('Float:'));
            return parseFloat(floatText.replace(/[^\d.]/g, ''));
        });
    });
    //console.log('Succesfully loaded the floats')

    const combinedValues = floatWears.map((floatWear, index) => {
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
        return {
            floatWear, 
            formattedPrice: formattedPrices[index], 
            price: pricesValue[index], 
            currencyCode: currencyCodes[index], 
            item: formattedItemName, 
            source: 'SCM',
            rarity: itemRarity,
            timestamp
        };
    });
    

    // Convert combinedValues map to an array
    const combinedValuesArray = Array.from(combinedValues);

    function arrayToCsv(data) {
        // Get the keys of the first object to use as column headers
        const headers = Object.keys(data[0]);

        // Create a 2D array with the data and headers
        const csvData = [headers];
        data.forEach(obj => {
            const row = headers.map(key => obj[key]);
            csvData.push(row);
        });

        // Convert the 2D array to a CSV string
        return csvData.map(row => row.join(",")).join("\r\n");
    }

    // Generate the output filename
    const formattedWearValue = wearValue.replace("Exterior: ", "").replace("Factory New", "FN").replace("Minimal Wear", "MW").replace("Field-Tested", "FT").replace("Well-Worn", "WW").replace("Battle-Scarred", "BS");
    //console.log('Succesfully formatted the Wear Value: ', formattedWearValue)
    const outputFileName = `${formattedItemName} (${formattedWearValue})`;
    
    const outputFilePath = path.join(`${prefix}/Items/SCM/${target_rarity}`, `${outputFileName}.csv`);
    //const outputFile = 
    //console.log(`Writing to '${outputFilePath}'..`)

    // Create the directory if it doesn't exist
    await fs.promises.mkdir(path.dirname(outputFilePath), { recursive: true });

    // Write the data to the output file
    const csv = arrayToCsv(combinedValuesArray);
    await fs.writeFile(outputFilePath, csv);
    console.log('Data written to file:', outputFilePath);

    PythonShell.run('combine_filter_data.py', { args: [collection, target_rarity] }, (err) => {
        if (err) {
          console.error(err);
        } else {
          console.log('Filter Python script finished');
        }
      });

    await new Promise(resolve => setTimeout(resolve, 15000 + Math.random() * 5000));

    clearInterval(scrollInterval);

    await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 5000));

    // keep the browser open for 0.5 seconds
    //setTimeout(() => {
    //    browser.close();
    //}, 1000);
}

// Call the processItems function to start processing
processItems().catch(console.error);